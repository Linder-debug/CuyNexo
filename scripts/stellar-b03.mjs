import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import { Horizon, NotFoundError, TransactionFailedError } from "@stellar/stellar-sdk";
import { Keypair, Networks, TransactionBuilder } from "@stellar/stellar-sdk/base";
import { AgreementStore } from "../dist/agreements.js";
import { signConsent } from "../dist/consents.js";
import { lookupTransactionByHash } from "../dist/horizon-settlement.js";
import { StellarClassicAdapter } from "../dist/stellar-classic.js";
import { nativeBalance, UNIT } from "./testnet-evidence.mjs";

const EVIDENCE_ROOT = fileURLToPath(new URL("../evidence/b03/", import.meta.url));
const fixture = JSON.parse(readFileSync(new URL("../fixtures/cuatro-empresas.json", import.meta.url)));

const modes = {
  firma: {
    scenario: "B03-firma-faltante",
    signers: ["A"],
    resultCodes: { transaction: "tx_failed", operations: ["op_success", "op_success", "op_bad_auth"] },
  },
  vencido: {
    scenario: "B03-sobre-vencido",
    signers: ["A", "B"],
    resultCodes: { transaction: "tx_too_late", operations: [] },
  },
};

export function prepareProbe(mode, keys, sequence, baseFee, clock = Date.now) {
  const now = clock();
  const store = new AgreementStore(":memory:", () => now);
  try {
    const roundId = `b03-${mode}`;
    store.createRound(roundId);
    const accounts = Object.fromEntries(fixture.participants.map((id) => [id, keys[id].publicKey()]));
    const agreement = store.freezeVersion(roundId, null, {
      ...fixture, accounts, transactionSourceId: "A",
      feeCapAtomic: String(BigInt(baseFee) * 3n), consentBy: now + 60_000,
    });
    for (const participantId of fixture.participants) {
      store.recordSignedConsent(signConsent({
        roundId, version: 1, agreementHash: agreement.hash, participantId, decision: "ACCEPT",
      }, keys[participantId]));
    }

    // The adapter's five-minute maximum yields a maxTime about five minutes in the past.
    const adapter = new StellarClassicAdapter(store, () => mode === "vencido" ? now - 600_000 : now);
    const prepared = adapter.prepare({ roundId, version: 1, hash: agreement.hash }, sequence, baseFee);
    const expectedSigners = modes[mode].signers;
    let envelope = prepared.unsignedXdr;
    for (const id of expectedSigners) envelope = adapter.attachSignature(prepared, envelope, keys[id]);
    const transaction = TransactionBuilder.fromXDR(envelope, Networks.TESTNET);
    const bodyHash = transaction.hash();
    const signers = ["A", "B"].filter((id) => transaction.signatures.some((signature) =>
      signature.hint().equals(keys[id].signatureHint()) && keys[id].verify(bodyHash, signature.signature())));
    assert.deepEqual(signers, expectedSigners);
    assert.equal(transaction.signatures.length, signers.length);
    return { transaction, signers };
  } finally {
    store.close();
  }
}

export async function submitProbe(server, mode, transaction, record, clock = Date.now) {
  const sentAt = new Date(clock());
  const expiresAt = new Date(Number(transaction.timeBounds.maxTime) * 1000);
  assert.ok(mode === "vencido" ? expiresAt <= sentAt : expiresAt > sentAt);
  record({ sentAt: sentAt.toISOString(), expiresAt: expiresAt.toISOString() });

  try {
    // A negative ledger probe needs the POST itself, without SDK memo preflight on the fresh accounts.
    await server.submitTransaction(transaction, { skipMemoRequiredCheck: true });
  } catch (error) {
    if (!(error instanceof TransactionFailedError) || error.getResponse()?.status !== 400) throw error;
    const resultCodes = error.getResultCodes();
    const code = (value) => typeof value === "string" && /^[a-z][a-z0-9_]{0,63}$/.test(value) ? value : null;
    record({
      rejection: {
        httpStatus: 400, observedAt: new Date(clock()).toISOString(),
        resultCodes: {
          transaction: code(resultCodes.transaction),
          operations: Array.isArray(resultCodes.operations) ? resultCodes.operations.slice(0, 3).map(code) : [],
        },
      },
    });
    assert.deepEqual(resultCodes, modes[mode].resultCodes, "Unexpected rejection codes");
    return;
  }
  assert.fail("Horizon accepted an envelope that should have been rejected");
}

export async function observeHash(server, hash, record, wait = sleep, clock = Date.now) {
  for (const delay of [0, ...Array(9).fill(1500), 6000]) {
    if (delay) await wait(delay);
    const observedAt = new Date(clock()).toISOString();
    try {
      const transaction = await lookupTransactionByHash(server, hash);
      record({ observedAt, httpStatus: 200, ledger: transaction.ledger_attr ?? null });
      return "found";
    } catch (error) {
      if (!(error instanceof NotFoundError)) throw error;
      record({ observedAt, httpStatus: 404 });
    }
  }
  return "not-observed";
}

async function snapshots(server, addresses) {
  return Object.fromEntries(await Promise.all(fixture.participants.map(async (id) => {
    const account = await server.loadAccount(addresses[id]);
    return [id, { balanceAtomic: nativeBalance(account).toString(), sequence: account.sequenceNumber() }];
  })));
}

function writeEvidence(path, value) {
  writeFileSync(path + ".tmp", JSON.stringify(value, null, 2) + "\n", { mode: 0o600 });
  renameSync(path + ".tmp", path);
}

async function run(mode) {
  const server = new Horizon.Server("https://horizon-testnet.stellar.org");
  const keys = Object.fromEntries(fixture.participants.map((id) => [id, Keypair.random()]));
  const addresses = Object.fromEntries(fixture.participants.map((id) => [id, keys[id].publicKey()]));
  mkdirSync(EVIDENCE_ROOT, { recursive: true });
  const directory = mkdtempSync(join(EVIDENCE_ROOT, `${mode}-`));
  const evidencePath = join(directory, "evidence.json");
  for (const address of Object.values(addresses)) await server.friendbot(address).call();
  const before = await snapshots(server, addresses);
  assert.ok(BigInt(before.A.balanceAtomic) >= 51n * UNIT && BigInt(before.B.balanceAtomic) >= 11n * UNIT);
  const baseFee = String(await server.fetchBaseFee());
  const { transaction, signers } = prepareProbe(mode, keys, before.A.sequence, baseFee);
  const hash = transaction.hash().toString("hex");
  const evidence = {
    schemaVersion: 2, scenario: modes[mode].scenario, network: "stellar-testnet",
    status: "incomplete", hash, asset: "XLM", signers,
    envelopeSha256: createHash("sha256").update(transaction.toEnvelope().toXDR()).digest("hex"),
    sourceSequence: transaction.sequence, addresses, before, hashLookups: [],
  };
  const save = (fields) => writeEvidence(evidencePath, Object.assign(evidence, fields));
  save({});
  console.log(JSON.stringify({ scenario: evidence.scenario, hash, evidencePath }));
  await submitProbe(server, mode, transaction, save);
  const hashObservation = await observeHash(server, hash, (observation) => {
    evidence.hashLookups.push(observation);
    save({});
  });
  const after = await snapshots(server, addresses);
  save({ hashObservation, after });
  assert.equal(hashObservation, "not-observed", "The lookup found an included transaction");
  assert.deepEqual(after, before, "The balances or sequences changed during observation");
  save({ status: "rejection-verified" });
  console.log(JSON.stringify({ hash, status: evidence.status, hashObservation }));
}

async function main() {
  const [mode, flag, ...extra] = process.argv.slice(2);
  if (!Object.hasOwn(modes, mode) || flag !== "--execute-testnet" || extra.length) {
    console.error("Usage: stellar-b03.mjs firma|vencido --execute-testnet");
    process.exitCode = 2;
    return;
  }
  try {
    await run(mode);
  } catch (error) {
    console.error(error instanceof assert.AssertionError ? "B03 did not meet its expected checks. Review the incomplete evidence."
      : "B03 stopped. Review the evidence path and hash if printed.");
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
