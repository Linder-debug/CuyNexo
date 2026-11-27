import assert from "node:assert/strict";
import test from "node:test";
import { Horizon } from "@stellar/stellar-sdk";
import { lookupTransactionByHash } from "../dist/horizon-settlement.js";

test("T03: SDK 16.4.1 consulta por hash una transacción exitosa o fallida sin includeFailed", async (t) => {
  const server = new Horizon.Server("https://horizon.invalid");
  const hash = "a".repeat(64);
  const requested = [];
  let successful = true;
  t.mock.method(server.httpClient, "get", async (url) => {
    requested.push(String(url));
    return { data: { hash, successful, ledger: 42, _links: {
      ledger: { href: "https://horizon.invalid/ledgers/42" },
    } }, status: 200, headers: {} };
  });

  assert.equal(typeof server.transactions().transaction(hash).includeFailed, "undefined");
  for (successful of [true, false]) {
    const transaction = await lookupTransactionByHash(server, hash);
    assert.equal(transaction.hash, hash);
    assert.equal(transaction.successful, successful);
    assert.equal(transaction.ledger_attr, 42);
  }
  assert.deepEqual(requested, Array(2).fill(`https://horizon.invalid/transactions/${hash}`));
});
