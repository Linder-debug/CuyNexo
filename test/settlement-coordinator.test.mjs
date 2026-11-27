import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import { Keypair } from "@stellar/stellar-sdk/base";
import { AgreementStore } from "../dist/agreements.js";
import { signConsent } from "../dist/consents.js";
import { SettlementCoordinator } from "../dist/settlement-coordinator.js";
import { StellarClassicAdapter } from "../dist/stellar-classic.js";

const fixture = JSON.parse(readFileSync(new URL("../fixtures/cuatro-empresas.json", import.meta.url)));
const START = Date.UTC(2026, 10, 24, 17);
const ROUND = "t04-sintetica";

function setup(t) {
  const directory = mkdtempSync(join(tmpdir(), "cuynexo-t04-"));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const path = join(directory, "agreement.sqlite");
  let now = START;
  const clock = () => now;
  const keys = Object.fromEntries(fixture.participants.map((id) => [id, Keypair.random()]));
  const accounts = Object.fromEntries(Object.entries(keys).map(([id, key]) => [id, key.publicKey()]));
  const draft = { ...fixture, accounts, transactionSourceId: "A", feeCapAtomic: "300", consentBy: START + 60_000 };
  const open = () => {
    const store = new AgreementStore(path, clock);
    let closed = false;
    const close = () => {
      if (!closed) store.close();
      closed = true;
    };
    t.after(close);
    return { store, close };
  };
  const { store, close } = open();
  store.createRound(ROUND);
  const view = store.freezeVersion(ROUND, null, draft);
  for (const participantId of fixture.participants) {
    store.recordSignedConsent(signConsent({
      roundId: ROUND, version: 1, agreementHash: view.hash, participantId, decision: "ACCEPT",
    }, keys[participantId]));
  }
  const adapter = new StellarClassicAdapter(store, clock);
  const prepared = adapter.prepare({ roundId: ROUND, version: 1, hash: view.hash }, "420", "100");
  const signedA = adapter.attachSignature(prepared, prepared.unsignedXdr, keys.A);
  const signed = adapter.attachSignature(prepared, signedA, keys.B);
  const receipt = {
    hash: prepared.transactionHash, ledger_attr: 42, fee_charged: "300",
    operation_count: 3, successful: true, envelope_xdr: signed,
  };
  return { store, close, open, path, clock, draft, adapter, prepared, signed, signedA, receipt,
    hash: prepared.transactionHash, expire: () => { now = START + 700_000; } };
}

test("T04 B04: conserva el sobre y el hash antes del envío; recupera tras respuesta perdida y reinicio", async (t) => {
  const s = setup(t);
  let submissions = 0;
  let persistedAtPost;
  let submittedXdr;
  const lookups = [];
  let indexed = false;
  const transport = {
    async submit(tx) {
      submissions++;
      const db = new DatabaseSync(s.path, { readOnly: true });
      try {
        persistedAtPost = db.prepare("SELECT transaction_hash, envelope_xdr, state FROM settlement_attempts").get();
        submittedXdr = tx.toXDR();
      } finally {
        db.close();
      }
      throw new Error("POST accepted but its reply was lost");
    },
    async lookup(hash) {
      lookups.push(hash);
      if (!indexed) throw Object.assign(new Error("Not indexed yet"), { status: 404 });
      return s.receipt;
    },
  };
  const before = await new SettlementCoordinator(s.store, transport, s.clock).submit(s.prepared, s.signed);
  assert.equal(persistedAtPost.transaction_hash, s.hash);
  assert.equal(persistedAtPost.state, "SUBMITTED");
  assert.equal(persistedAtPost.envelope_xdr, submittedXdr);
  assert.equal(submittedXdr, s.signed);
  assert.equal(before.state, "RECONCILING");
  assert.equal(before.detail, "UNCONFIRMED");
  assert.equal(s.store.getVersion(ROUND, 1).canAdvance, false);
  s.close();

  const { store } = s.open();
  const restarted = new SettlementCoordinator(store, transport, s.clock);
  s.expire();
  assert.equal((await restarted.reconcile(s.hash)).state, "RECONCILING");
  assert.throws(() => store.closeRound(ROUND, 1), { code: "INVALID_STATE" });
  assert.throws(() => store.freezeVersion(ROUND, 1, s.draft), { code: "INVALID_STATE" });
  indexed = true;
  const final = await restarted.reconcile(s.hash);
  assert.equal(final.state, "SETTLED");
  assert.equal(final.ledger, 42);
  assert.equal(final.feeAtomic, "300");
  assert.deepEqual(await restarted.submit(s.prepared, s.signed), final);
  assert.equal(submissions, 1);
  assert.deepEqual(lookups, [s.hash, s.hash, s.hash]);

  store.createRound("ronda-siguiente");
  assert.throws(() => store.freezeVersion("ronda-siguiente", null, {
    ...s.draft, consentBy: s.clock() + 10_000,
  }), /already settled/);
});

test("T04 B04: dos coordinadores concurrentes envían una vez y una consulta tardía no degrada SETTLED", async (t) => {
  const s = setup(t);
  const other = s.open();
  const posting = Promise.withResolvers();
  const lateLookup = Promise.withResolvers();
  let submissions = 0;
  const first = new SettlementCoordinator(s.store, {
    submit() {
      submissions++;
      return posting.promise;
    },
    lookup: async () => s.receipt,
  }, s.clock);
  const second = new SettlementCoordinator(other.store, {
    submit: async () => { submissions++; },
    lookup(hash) {
      assert.equal(hash, s.hash);
      return lateLookup.promise;
    },
  }, s.clock);
  const primary = first.submit(s.prepared, s.signed);
  assert.equal(other.store.getSettlementByHash(s.hash).state, "SUBMITTED");
  const duplicate = second.submit(s.prepared, s.signed);
  posting.resolve();
  const settled = await primary;
  assert.equal(settled.state, "SETTLED");
  lateLookup.reject(new Error("Stale 404"));
  assert.deepEqual(await duplicate, settled);
  assert.equal(submissions, 1);
});

test("T04: reinicio entre la reserva SQLite y el POST conserva el intento sin volver a enviarlo", async (t) => {
  const s = setup(t);
  const { roundId, version, hash } = s.prepared.agreement;
  const { reserved } = s.store.reserveSettlement({
    roundId, version, agreementHash: hash, transactionHash: s.hash,
    envelopeXdr: s.signed, maxTime: s.prepared.maxTime, operationCount: 3,
  });
  assert.equal(reserved, true);
  s.close();

  const { store } = s.open();
  let posts = 0;
  const restarted = new SettlementCoordinator(store, {
    submit: async () => { posts++; },
    lookup: async () => { throw new Error("Not found"); },
  }, s.clock);
  assert.equal((await restarted.submit(s.prepared, s.signed)).state, "RECONCILING");
  s.expire();
  assert.equal((await restarted.reconcile(s.hash)).state, "RECONCILING");
  assert.equal(posts, 0);
});

test("T04: una respuesta contradictoria deja LEDGER_MISMATCH y no admite un hash alternativo", async (t) => {
  const s = setup(t);
  const alternate = s.adapter.prepare(s.prepared.agreement, "421", "100");
  let receipt = { ...s.receipt, envelope_xdr: alternate.unsignedXdr };
  let submissions = 0;
  const coordinator = new SettlementCoordinator(s.store, {
    async submit() { submissions++; },
    async lookup() { return receipt; },
  }, s.clock);
  const result = await coordinator.submit(s.prepared, s.signed);
  assert.equal(result.state, "RECONCILING");
  assert.equal(result.detail, "LEDGER_MISMATCH");
  await assert.rejects(coordinator.submit(alternate, alternate.unsignedXdr), { code: "VERSION_CONFLICT" });
  receipt = s.receipt;
  assert.equal((await coordinator.reconcile(s.hash)).state, "SETTLED");
  assert.equal(submissions, 1);
});

test("T04: un fallo atómico confirmado permite una versión nueva con consentimientos nuevos", async (t) => {
  const s = setup(t);
  const coordinator = new SettlementCoordinator(s.store, {
    submit: async () => { throw new Error("tx_failed"); },
    lookup: async () => ({ ...s.receipt, successful: false }),
  }, s.clock);
  const result = await coordinator.submit(s.prepared, s.signed);
  assert.equal(result.state, "FAILED");
  assert.equal(result.feeAtomic, "300");
  const next = s.store.freezeVersion(ROUND, 1, s.draft);
  assert.equal(next.agreement.version, 2);
  assert.equal(next.status, "PENDING_CONSENT");
  assert.equal(next.validApprovalCount, 0);
  assert.deepEqual(await coordinator.reconcile(s.hash), result);
});

test("T04: firma faltante y hash desconocido no reservan ni contactan el transporte", async (t) => {
  const s = setup(t);
  let calls = 0;
  const coordinator = new SettlementCoordinator(s.store, {
    submit: async () => { calls++; },
    lookup: async () => { calls++; },
  }, s.clock);
  await assert.rejects(coordinator.submit(s.prepared, s.signedA), { code: "MISSING_SIGNATURE" });
  await assert.rejects(coordinator.reconcile(s.hash), { code: "NOT_FOUND" });
  assert.equal(calls, 0);
  assert.equal(s.store.findSettlementForVersion(ROUND, 1), undefined);
});
