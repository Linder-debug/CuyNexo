import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const script = fileURLToPath(new URL("../scripts/stellar-b04.mjs", import.meta.url));

function setup(t) {
  const root = mkdtempSync(join(tmpdir(), "cuynexo-b04-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const directory = join(root, "run");
  const run = (phase, ...flags) => spawnSync(process.execPath, [script, phase, directory, ...flags], {
    encoding: "utf8", timeout: 10_000,
  });
  const evidence = () => JSON.parse(readFileSync(join(directory, "evidence.json"), "utf8"));
  return { directory, run, evidence };
}

test("B04: dos solicitudes, una transmisión y recuperación del mismo hash en otro proceso", (t) => {
  const { run, evidence } = setup(t);
  const start = run("start", "--offline");
  assert.equal(start.status, 0, start.stderr);
  const initial = evidence();
  assert.equal(initial.status, "awaiting-recovery");
  assert.equal(initial.submission.requests, 2);
  assert.equal(initial.submission.submitCalls, 1);
  assert.equal(initial.submission.responseDiscarded, true);
  assert.deepEqual(initial.submission.statuses, ["RECONCILING", "RECONCILING"]);

  const recovery = run("recover", "--offline");
  assert.equal(recovery.status, 0, recovery.stderr);
  const report = evidence();
  assert.notEqual(report.submission.processId, report.recovery.processId);
  assert.equal(report.status, "simulated-pass");
  assert.equal(report.recovery.hash, initial.hash);
  assert.equal(report.recovery.previousState, "RECONCILING");
  assert.equal(report.recovery.state, "SETTLED");
  assert.equal(report.recovery.submitCalls, 0);
  assert.deepEqual(report.sourceHashes, [initial.hash]);
  assert.equal(report.operations.length, 3);
  assert.equalBigInt(report.after.A.sequence) - BigInt(report.before.A.sequence), 1n);
  assert.equal(report.explorerUrl, null);
  assert.doesNotMatch(JSON.stringify(report), /envelope_xdr|\bS[A-Z2-7]{55}\b/);
});

test("B04: sin confirmación sigue pendiente y el historial duplicado impide aprobar", (t) => {
  const { directory, run, evidence } = setup(t);
  const start = run("start", "--offline");
  assert.equal(start.status, 0, start.stderr);
  const ledger = join(directory, "simulated-ledger.json");
  const hidden = ledger + ".hidden";
  renameSync(ledger, hidden);
  const pending = run("recover", "--offline");
  assert.equal(pending.status, 3, pending.stderr);
  assert.equal(evidence().recovery.state, "RECONCILING");
  assert.equal(evidence().status, "recovery-incomplete");
  renameSync(hidden, ledger);

  const state = JSON.parse(readFileSync(ledger, "utf8"));
  state.transactions.push{
    ...state.transactions[0], hash: "b".repeat(64),
    source_account_sequence: (BigInt(state.transactions[0].source_account_sequence) + 1n).toString(),
  });
  writeFileSync(ledger, JSON.stringify(state));
  const duplicate = run("recover", "--offline");
  assert.equal(duplicate.status, 1, duplicate.stderr);
  assert.equal(evidence().recovery.state, "SETTLED");
  assert.equal(evidence().status, "recovery-incomplete");
});

test("B04: exige modo explícito y no permite iniciar dos veces en el mismo directorio", (t) => {
  const { run, evidence } = setup(t);
  assert.equal(run("start").status, 2);
  const start = run("start", "--offline");
  assert.equal(start.status, 0, start.stderr);
  const initial = evidence();
  assert.equal(run("start", "--offline").status, 1);
  assert.equal(run("recover", "--execute-testnet").status, 1);
  assert.deepEqual(evidence(), initial);
});
