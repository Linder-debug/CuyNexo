import assert from "node:assert/strict";
import test from "node:test";
import { Horizon } from "@stellar/stellar-sdk";
import { Keypair } from "@stellar/stellar-sdk/base";
import { observeHash, prepareProbe, submitProbe } from "../scripts/stellar-b03.mjs";

const now = Date.UTC(2026, 10, 25, 20);
const clock = () => now;
const keys = Object.fromEntries(["A", "B", "C", "D"].map((id) => [id, Keypair.random()]));
const server = () => new Horizon.Server("https://horizon.invalid");

function failedHttp(status, data = {}) {
  return Object.assign(new Error(`HTTP ${status}`), { response: { status, data } });
}

for (const [mode, signers, resultCodes] of [
  ["firma", ["A"], { transaction: "tx_failed", operations: ["op_success", "op_success", "op_bad_auth"] }],
  ["vencido", ["A", "B"], { transaction: "tx_too_late" }],
]) {
  test(`B03 ${mode}: verifica el sobre y registra el rechazo HTTP 400 del SDK instalado`, async (t) => {
    const horizon = server();
    const probe = prepareProbe(mode, keys, "420", "100", clock);
    assert.deepEqual(probe.signers, signers);
    assert.equal(probe.transaction.source, keys.A.publicKey());
    assert.equal(probe.transaction.operations[2].source, keys.B.publicKey());
    assert.equal(probe.transaction.sequence, "421");
    assert.equal(Number(probe.transaction.timeBounds.maxTime), now / 1000 + (mode === "vencido" ? -300 : 300));
    t.mock.method(horizon.httpClient, "get", async () => assert.fail("Unexpected preflight"));
    const post = t.mock.method(horizon.httpClient, "post", async () => {
      throw failedHttp(400, { extras: { result_codes: resultCodes } });
    });
    const observations = [];
    await submitProbe(horizon, mode, probe.transaction, (entry) => observations.push(entry), clock);
    assert.equal(post.mock.callCount(), 1);
    const [url, body] = post.mock.calls[0].arguments;
    assert.equal(url, "https://horizon.invalid/transactions");
    assert.equal(new URLSearchParams(body).get("tx"), probe.transaction.toXDR());
    assert.deepEqual(observations[1].rejection.resultCodes, { operations: [], ...resultCodes });
    assert.equal(observations[1].rejection.httpStatus, 400);
  });
}

test("B03: una respuesta perdida o un código de otra causa no certifican rechazo", async (t) => {
  const horizon = server();
  const { transaction } = prepareProbe("firma", keys, "420", "100", clock);
  let error = new Error("timeout");
  t.mock.method(horizon.httpClient, "post", async () => { throw error; });
  const observations = [];
  const record = (entry) => observations.push(entry);
  await assert.rejects(submitProbe(horizon, "firma", transaction, record, clock), /timeout/);
  assert.equal(observations.length, 1);
  error = failedHttp(400, { extras: { result_codes: {
    transaction: "tx_failed", operations: ["op_success", "op_success", "op_underfunded"],
  } } });
  await assert.rejects(submitProbe(horizon, "firma", transaction, record, clock), /Unexpected rejection codes/);
  assert.equal(observations.at(-1).rejection.resultCodes.operations.at(-1), "op_underfunded");
});

test("B03: un 404 tipado del SDK sin status en el cuerpo solo acredita ausencia observada", async (t) => {
  const horizon = server();
  const hash = "a".repeat(64);
  const get = t.mock.method(horizon.httpClient, "get", async () => { throw failedHttp(404); });
  const observations = [];
  const result = await observeHash(horizon, hash, (entry) => observations.push(entry), async () => {}, clock);
  assert.equal(result, "not-observed");
  assert.equal(observations.length, 11);
  assert.ok(observations.every(({ httpStatus }) => httpStatus === 404));
  assert.equal(get.mock.calls[0].arguments[0], `https://horizon.invalid/transactions/${hash}`);
});

test("B03: una inclusión o un fallo de consulta se distinguen del 404", async (t) => {
  const horizon = server();
  const hash = "a".repeat(64);
  let unavailable = false;
  t.mock.method(horizon.httpClient, "get", async () => {
    if (unavailable) throw failedHttp(503);
    return { data: { hash, ledger: 42, _links: { ledger: { href: "https://horizon.invalid/ledgers/42" } } } };
  });
  const observations = [];
  const record = (entry) => observations.push(entry);
  assert.equal(await observeHash(horizon, hash, record), "found");
  assert.deepEqual(observations.map(({ httpStatus, ledger }) => [httpStatus, ledger]), [[200, 42]]);
  unavailable = true;
  await assert.rejects(observeHash(horizon, hash, record));
  assert.equal(observations.length, 1);
});
