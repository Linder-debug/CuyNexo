import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { calculateNetting } from "../dist/netting.js";

export const UNIT = 10_000_000n;
export const fixture = JSON.parse(readFileSync(new URL("../fixtures/cuatro-empresas.json", import.meta.url)));
export const netting = calculateNetting(fixture);
export const participants = fixture.participants;

export function formatXlm(value) {
  const amount = BigInt(value);
  const magnitude = amount < 0n ? -amount : amount;
  const decimals = (magnitude % UNIT).toString().padStart(7, "0").replace(/0+$/, "");
  return `${amount < 0n ? "−" : ""}${magnitude / UNIT}${decimals ? "," + decimals : ""}`;
}

export function explorerUrl(hash) {
  return /^[a-f0-9]{64}$/.test(hash) ? `https://stellar.expert/explorer/testnet/tx/${hash}` : null;
}

function readEvidence(name) {
  return JSON.parse(readFileSync(new URL(`../doc/evidencia-t04/${name}.json`, import.meta.url)));
}

export function observedResults() {
  const success = readEvidence("B01");
  const failure = readEvidence("B02");
  const recovery = readEvidence("B04");
  for (const [evidence, expectedSuccess] of [[success, true], [failure, false]]) {
    assert.equal(evidence.network, "stellar-testnet");
    assert.equal(evidence.status, "verified");
    assert.equal(evidence.successful, expectedSuccess);
    assert.equal(evidence.explorerUrl, explorerUrl(evidence.hash));
    const aliases = Object.fromEntries(participants.map((id) => [evidence.accounts[id].address, id]));
    assert.deepEqual(evidence.operations.map(({ source, destination, amountAtomic, applied }) => {
      assert.equal(applied, expectedSuccess);
      return { debtorId: aliases[source], creditorId: aliases[destination], amountAtomic };
    }), netting.payments);
  }
  assert.equal(recovery.mode, "testnet");
  assert.equal(recovery.status, "testnet-verified");
  assert.equal(recovery.successful, true);
  assert.equal(recovery.explorerUrl, explorerUrl(recovery.hash));
  assert.equal(recovery.recovery.hash, recovery.hash);
  assert.equal(recovery.recovery.previousState, "RECONCILING");
  assert.equal(recovery.recovery.state, "SETTLED");
  assert.equal(recovery.submission.requests, 2);
  assert.equal(recovery.submission.submitCalls, 1);
  assert.equal(recovery.submission.responseDiscarded, true);
  assert.notEqual(recovery.submission.processId, recovery.recovery.processId);
  assert.equal(recovery.recovery.submitCalls, 0);
  assert.deepEqual(recovery.submission.statuses, ["RECONCILING", "RECONCILING"]);
  assert.deepEqual(recovery.sourceHashes, [recovery.hash]);
  assert.deepEqual(recovery.operations.map(({ from, to, xlm }) => ({
    debtorId: from, creditorId: to, amountAtomic: xlm.replace(".", "").replace(/^0+(?=\d)/, ""),
  })), netting.payments);
  return { success, failure, recovery };
}
