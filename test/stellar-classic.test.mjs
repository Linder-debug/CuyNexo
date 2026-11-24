import assert from "node:assert/strict";
import { readFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { Account, Asset, Keypair, Memo, Networks, Operation, TransactionBuilder } from "@stellar/stellar-sdk";
import { AgreementStore } from "../dist/agreements.js";
import { signConsent } from "../dist/consents.js";
import { StellarClassicAdapter } from "../dist/stellar-classic.js";

const fixture = JSON.parse(readFileSync(new URL("../fixtures/cuatro-empresas.json", import.meta.url), "utf8"));
const ROUND = "t03-sintetica";
const START = Date.UTC(2026, 10, 24, 17);
const SEQUENCE = "420";
const BASE_FEE = "100";

function setup(t, { path = ":memory:", bound = true } = {}) {
  let now = START;
  const clock = () => now;
  const keys = Object.fromEntries(fixture.participants.map((id) => [id, Keypair.random()]));
  const accounts = Object.fromEntries(Object.entries(keys).map(([id, key]) => [id, key.publicKey()]));
  const draft = {
    ...structuredClone(fixture), ...(bound ? { accounts } : {}),
    transactionSourceId: "A", feeCapAtomic: "300", consentBy: START + 60_000,
  };
  const store = new AgreementStore(path, clock);
  let closed = false;
  const close = () => { if (!closed) store.close(); closed = true; };
  t.after(close);
  store.createRound(ROUND);
  const view = store.freezeVersion(ROUND, null, draft);
  return {
    store, close, clock, keys, accounts, draft, view, adapter: new StellarClassicAdapter(store, clock),
    ref: { roundId: ROUND, version: 1, hash: view.hash },
    setTime: (value) => { now = value; },
  };
}

function voteInput(ref, id, decision = "ACCEPT") {
  return { roundId: ref.roundId, version: ref.version, agreementHash: ref.hash, participantId: id, decision };
}

function accept(scenario, ids = fixture.participants) {
  for (const id of ids) {
    scenario.store.recordSignedConsent(signConsent(voteInput(scenario.ref, id), scenario.keys[id]));
  }
}

function prepare(scenario) {
  accept(scenario);
  return scenario.adapter.prepare(scenario.ref, SEQUENCE, BASE_FEE);
}

function signAB({ adapter, keys }, prepared) {
  const signedA = adapter.attachSignature(prepared, prepared.unsignedXdr, keys.A);
  return adapter.attachSignature(prepared, signedA, keys.B);
}

test("T03: cuatro consentimientos Ed25519 distintos y transacción clásica exacta", (t) => {
  const s = setup(t);
  accept(s, ["A", "B", "C"]);
  assert.throws(() => s.adapter.prepare(s.ref, SEQUENCE, BASE_FEE), { code: "INVALID_STATE" });
  accept(s, ["D"]);
  const prepared = s.adapter.prepare(s.ref, SEQUENCE, BASE_FEE);
  const signed = signAB(s, prepared);
  const ready = s.adapter.requireReady(prepared, signed);
  assert.equal(ready.source, s.accounts.A);
  assert.equal(ready.sequence, "421");
  assert.equal(ready.fee, "300");
  assert.equal(ready.memo.type, "hash");
  assert.equal(ready.memo.value.toString("hex"), s.ref.hash);
  assert.equal(ready.timeBounds.maxTime, String((START + 300_000) / 1000));
  assert.equal(ready.hash().toString("hex"), prepared.transactionHash);
  assert.deepEqual(ready.operations.map((op) => [op.type, op.source, op.destination, op.amount, op.asset.isNative()]), [
    ["payment", s.accounts.A, s.accounts.C, "20.0000000", true],
    ["payment", s.accounts.A, s.accounts.D, "30.0000000", true],
    ["payment", s.accounts.B, s.accounts.D, "10.0000000", true],
  ]);
  assert.equal(ready.signatures.length, 2);
  assert.equal(s.adapter.attachSignature(prepared, signed, s.keys.B), signed);
  assert.throws(() => s.adapter.prepare(s.ref, SEQUENCE, "101"), { code: "INVALID_SETTLEMENT" });
});

test("T03: firma de consentimiento inválida si cambia la identidad, decisión, hash o dominio", (t) => {
  const s = setup(t);
  const input = voteInput(s.ref, "C");
  const signed = signConsent(input, s.keys.C);
  for (const attempt of [
    { ...signed, participantId: "D" },
    { ...signed, decision: "REJECT" },
    { ...signed, agreementHash: "11".repeat(32) },
    { ...signed, signature: s.keys.C.sign(Buffer.from("other-domain")).toString("base64") },
    signConsent(input, s.keys.A),
  ]) {
    assert.throws(() => s.store.recordSignedConsent(attempt), { code: "INVALID_CONSENT" });
  }
  assert.throws(() => s.store.recordConsent(input), { code: "INVALID_CONSENT" });
  assert.deepEqual(s.store.getVersion(ROUND, 1).consents, []);
});

test("T03: el voto sintético histórico no habilita el adaptador", (t) => {
  const s = setup(t, { bound: false });
  for (const id of fixture.participants) s.store.recordConsent(voteInput(s.ref, id));
  assert.equal(s.store.getVersion(ROUND, 1).canAdvance, true);
  assert.throws(() => s.adapter.prepare(s.ref, SEQUENCE, BASE_FEE), { code: "INVALID_STATE" });
});

test("T03: un rechazo Ed25519 de C impide preparar el XDR", (t) => {
  const s = setup(t);
  accept(s, ["A", "B"]);
  const rejected = s.store.recordSignedConsent(signConsent(voteInput(s.ref, "C", "REJECT"), s.keys.C));
  assert.equal(rejected.status, "REJECTED");
  assert.throws(() => s.adapter.prepare(s.ref, SEQUENCE, BASE_FEE), { code: "INVALID_STATE" });
});

test("T03: el consentimiento firmado persiste y se verifica tras reabrir SQLite", (t) => {
  const directory = mkdtempSync(join(tmpdir(), "cuynexo-t03-"));
  const path = join(directory, "agreements.sqlite");
  try {
    const s = setup(t, { path });
    try {
      accept(s);
    } finally {
      s.close();
    }
    const reopened = new AgreementStore(path, s.clock);
    try {
      const authorized = reopened.requireSignedAgreement(ROUND, 1, s.ref.hash);
      assert.equal(authorized.consents.length, 4);
      assert.ok(authorized.consents.every(({ signature }) => typeof signature === "string"));
    } finally {
      reopened.close();
    }
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("T03: faltan firmas de A o B, y C no puede firmar un pago", (t) => {
  const s = setup(t);
  const prepared = prepare(s);
  for (const id of ["A", "B"]) {
    const onlyOne = s.adapter.attachSignature(prepared, prepared.unsignedXdr, s.keys[id]);
    assert.throws(() => s.adapter.requireReady(prepared, onlyOne), { code: "MISSING_SIGNATURE" });
  }
  assert.throws(() => s.adapter.requireReady(prepared, prepared.unsignedXdr), { code: "MISSING_SIGNATURE" });
  assert.throws(() => s.adapter.attachSignature(prepared, prepared.unsignedXdr, s.keys.C), { code: "BAD_SIGNATURE" });
});

test("T03: se rechazan cambios de destino, monto, memo y vigencia aunque A y B firmen", (t) => {
  const s = setup(t);
  const prepared = prepare(s);
  for (const change of [
    { destination: s.accounts.D },
    { amount: "21" },
    { memo: "33".repeat(32) },
    { maxTime: prepared.maxTime + 1 },
  ]) {
    const builder = new TransactionBuilder(new Account(s.accounts.A, SEQUENCE), {
      networkPassphrase: Networks.TESTNET, fee: BASE_FEE,
    }).setTimebounds(0, change.maxTime ?? prepared.maxTime).addMemo(Memo.hash(change.memo ?? s.ref.hash));
    const altered = builder
      .addOperation(Operation.payment({ source: s.accounts.A, destination: change.destination ?? s.accounts.C,
        asset: Asset.native(), amount: change.amount ?? "20" }))
      .addOperation(Operation.payment({ source: s.accounts.A, destination: s.accounts.D, asset: Asset.native(), amount: "30" }))
      .addOperation(Operation.payment({ source: s.accounts.B, destination: s.accounts.D, asset: Asset.native(), amount: "10" }))
      .build();
    altered.sign(s.keys.A, s.keys.B);
    assert.throws(() => s.adapter.requireReady(prepared, altered.toXDR()), { code: "XDR_MISMATCH" });
    const forgedPlan = { ...prepared, unsignedXdr: altered.toXDR(), transactionHash: altered.hash().toString("hex") };
    assert.throws(() => s.adapter.requireReady(forgedPlan, altered.toXDR()), { code: "XDR_MISMATCH" });
  }
  assert.throws(() => s.adapter.requireReady(prepared, "invalid-xdr"), { code: "XDR_MISMATCH" });
});

test("T03: se rechazan firmas de otra red, fuente extra y firmas duplicadas", (t) => {
  const s = setup(t);
  const prepared = prepare(s);
  const wrongNetwork = TransactionBuilder.fromXDR(prepared.unsignedXdr, Networks.PUBLIC);
  wrongNetwork.sign(s.keys.A, s.keys.B);
  assert.throws(() => s.adapter.requireReady(prepared, wrongNetwork.toXDR()), { code: "BAD_SIGNATURE" });
  for (const keys of [[s.keys.A, s.keys.A], [s.keys.A, s.keys.B, s.keys.C]]) {
    const transaction = TransactionBuilder.fromXDR(prepared.unsignedXdr, Networks.TESTNET);
    transaction.sign(...keys);
    assert.throws(() => s.adapter.requireReady(prepared, transaction.toXDR()), { code: "BAD_SIGNATURE" });
  }
});

test("T03: el sobre firmado se bloquea desde el segundo exacto de maxTime", (t) => {
  const s = setup(t);
  const prepared = prepare(s);
  const signed = signAB(s, prepared);
  s.setTime(prepared.maxTime * 1000 - 1);
  s.adapter.requireReady(prepared, signed);
  s.setTime(prepared.maxTime * 1000);
  assert.throws(() => s.adapter.requireReady(prepared, signed), { code: "EXPIRED" });
  assert.throws(() => s.adapter.attachSignature(prepared, prepared.unsignedXdr, s.keys.A), { code: "EXPIRED" });
});

test("T03: una versión nueva exige nuevos consentimientos y nuevas firmas", (t) => {
  const s = setup(t);
  const prepared = prepare(s);
  const signed = signAB(s, prepared);
  const oldConsent = signConsent(voteInput(s.ref, "A"), s.keys.A);
  const updated = s.store.freezeVersion(ROUND, 1, { ...s.draft, consentBy: s.draft.consentBy + 1000 });
  assert.throws(() => s.adapter.requireReady(prepared, signed), { code: "INVALID_STATE" });
  assert.throws(() => s.store.recordSignedConsent(oldConsent), { code: "INVALID_CONSENT" });
  const ref = { roundId: ROUND, version: updated.agreement.version, hash: updated.hash };
  accept({ ...s, ref });
  const newPrepared = s.adapter.prepare(ref, SEQUENCE, BASE_FEE);
  assert.throws(() => s.adapter.requireReady(newPrepared, signed), { code: "XDR_MISMATCH" });
});
