import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { Account, Asset, Keypair, Networks, Operation, TransactionBuilder } from "@stellar/stellar-sdk/base";
import { writeTestnetEvidence } from "../scripts/testnet-evidence.mjs";

function setup(t) {
  const dir = mkdtempSync(join(tmpdir(), "cuynexo-evidence-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const path = join(dir, "evidence.json");
  const keys = Object.fromEntries(["A", "B", "C", "D"].map((id) => [id, Keypair.random()]));
  const addresses = Object.fromEntries(Object.entries(keys).map(([id, key]) => [id, key.publicKey()]));
  const builder = new TransactionBuilder(new Account(addresses.A, "420"), {
    networkPassphrase: Networks.TESTNET, fee: "100",
  }).setTimebounds(0, 2_000_000_000);
  for (const [source, destination, amount] of [["A", "C", "20"], ["A", "D", "30"], ["B", "D", "10"]]) {
    builder.addOperation(Operation.payment({
      source: addresses[source], destination: addresses[destination], amount, asset: Asset.native(),
    }));
  }
  const transaction = builder.build();
  transaction.sign(keys.A, keys.B);
  return { dir, path, keys, addresses, transaction, hash: transaction.hash().toString("hex") };
}

function snapshot(balance, sequence = "420", extra = {}) {
  return { balances: [{ asset_type: "native", balance }], sequenceNumber: () => sequence, ...extra };
}

function snapshots(balances, after = false) {
  return Object.fromEntries(Object.entries(balances).map(([id, amount]) =>
    [id, snapshot(amount, id === "A" && after ? "421" : "420")]));
}

test("T03 evidencia B01: guarda direcciones, operaciones y balances exactos sin material de firma", (t) => {
  const { path, keys, addresses, transaction, hash } = setup(t);
  const secret = keys.A.secret();
  const before = snapshots({ A: "100.0000000", B: "20.0000000", C: "2.0000000", D: "2.0000000" });
  before.A = snapshot("100.0000000", "420", { privateKey: secret });
  const after = snapshots({ A: "49.9999700", B: "10.0000000", C: "22.0000000", D: "42.0000000" }, true);
  writeTestnetEvidence(path, {
    scenario: "success", status: "verified", addresses, transaction, before, after,
    committed: { hash, successful: true, ledger: 77, fee_charged: "300", fee_account: addresses.A,
      envelope_xdr: transaction.toXDR(), seed: secret },
    submittedKeys: keys,
  });
  const raw = readFileSync(path, "utf8");
  const record = JSON.parse(raw);
  assert.equal(record.scenario, "B01");
  assert.equal(record.status, "verified");
  assert.equal(record.hash, hash);
  assert.equal(record.explorerUrl, `https://stellar.expert/explorer/testnet/tx/${hash}`);
  assert.equal(record.ledger, 77);
  assert.equal(record.feeAtomic, "300");
  assert.equal(record.feeAccount, addresses.A);
  assert.deepEqual(record.operations, [
    { index: 1, source: addresses.A, destination: addresses.C, amountAtomic: "200000000", resultCode: null, applied: true },
    { index: 2, source: addresses.A, destination: addresses.D, amountAtomic: "300000000", resultCode: null, applied: true },
    { index: 3, source: addresses.B, destination: addresses.D, amountAtomic: "100000000", resultCode: null, applied: true },
  ]);
  assert.deepEqual(record.accounts.A, {
    address: addresses.A,
    before: { balanceAtomic: "1000000000", sequence: "420" },
    after: { balanceAtomic: "499999700", sequence: "421" },
  });
  assert.deepEqual(Object.fromEntries(Object.entries(record.accounts).map(([id, item]) => [id, item.address])), addresses);
  assert.equal(raw.includes(secret), false);
  assert.equal(raw.includes(transaction.toXDR()), false);
  assert.equal(raw.includes("privateKey"), false);
  assert.equal(raw.includes("submittedKeys"), false);
});

test("T03 evidencia B02: conserva los códigos de rechazo y muestra las tres operaciones sin aplicar", (t) => {
  const { path, addresses, transaction, hash } = setup(t);
  const before = snapshots({ A: "100", B: "2", C: "2", D: "2" });
  const after = snapshots({ A: "99.9999700", B: "2", C: "2", D: "2" }, true);
  const resultCodes = { transaction: "tx_failed", operations: ["op_success", "op_success", "op_underfunded"] };
  writeTestnetEvidence(path, { scenario: "failure", status: "verified", addresses, transaction, before, after,
    committed: { hash, successful: false, ledger_attr: 78, fee_charged: 300 }, resultCodes });
  const record = JSON.parse(readFileSync(path, "utf8"));
  assert.equal(record.scenario, "B02");
  assert.equal(record.successful, false);
  assert.equal(record.explorerUrl, `https://stellar.expert/explorer/testnet/tx/${hash}`);
  assert.deepEqual(record.resultCodes, resultCodes);
  assert.deepEqual(record.operations.map(({ applied, resultCode }) => [applied, resultCode]), [
    [false, "op_success"], [false, "op_success"], [false, "op_underfunded"],
  ]);
  for (const id of ["B", "C", "D"]) assert.deepEqual(record.accounts[id].before, record.accounts[id].after);
  assert.equal(BigInt(record.accounts.A.before.balanceAtomic) - BigInt(record.accounts.A.after.balanceAtomic), 300n);
});

test("T03 evidencia parcial: conserva el hash local sin enlace ni resultado de ledger confirmado", (t) => {
  const { path, dir, keys, addresses, transaction, hash } = setup(t);
  const input = { scenario: "failure", addresses };
  writeTestnetEvidence(path, { ...input, status: "started" });
  const started = JSON.parse(readFileSync(path, "utf8"));
  assert.equal(started.hash, null);
  assert.deepEqual(started.operations, []);
  writeTestnetEvidence(path, {
    ...input, transaction, status: "incomplete",
    committed: { hash: "00".repeat(32), successful: false, ledger: 78 },
    resultCodes: { transaction: keys.A.secret(), operations: [keys.A.secret()] },
  });
  const raw = readFileSync(path, "utf8");
  const record = JSON.parse(raw);
  assert.equal(record.hash, hash);
  assert.equal(record.explorerUrl, null);
  assert.equal(record.successful, null);
  assert.equal(record.accounts.B.after, null);
  assert.equal(record.operations[2].applied, null);
  assert.deepEqual(record.resultCodes, { transaction: null, operations: [null] });
  assert.equal(raw.includes(keys.A.secret()), false);
  assert.deepEqual(readdirSync(dir), ["evidence.json"]);
});

test("T03 evidencia: rechaza una semilla donde se espera una dirección pública", (t) => {
  const { path, dir, keys, addresses } = setup(t);
  assert.throws(() => writeTestnetEvidence(path, {
    scenario: "success", status: "started", addresses: { ...addresses, A: keys.A.secret() },
  }), /only public Stellar account addresses/);
  assert.deepEqual(readdirSync(dir), []);
});
