import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Horizon, TransactionFailedError } from "@stellar/stellar-sdk";
import { Keypair, Networks, Operation, TransactionBuilder } from "@stellar/stellar-sdk/base";
import { AgreementStore } from "../dist/agreements.js";
import { signConsent } from "../dist/consents.js";
import { lookupTransactionByHash } from "../dist/horizon-settlement.js";
import { SettlementCoordinator } from "../dist/settlement-coordinator.js";
import { StellarClassicAdapter } from "../dist/stellar-classic.js";
import { nativeBalance, UNIT, writeTestnetEvidence } from "./testnet-evidence.mjs";

const HORIZON = "https://horizon-testnet.stellar.org";
const EVIDENCE_ROOT = fileURLToPath(new URL("../evidence/t03/", import.meta.url));
const fixture = JSON.parse(readFileSync(new URL("../fixtures/cuatro-empresas.json", import.meta.url), "utf8"));

async function loadAccounts(server, addresses) {
  return Object.fromEntries(await Promise.all(Object.entries(addresses)
    .map(async ([id, address]) => [id, await server.loadAccount(address)])));
}

async function setupAccounts(server, keys, addresses, scenario) {
  const funded = scenario === "success" ? fixture.participants : ["A", "C", "D"];
  for (const id of funded) await server.friendbot(addresses[id]).call();
  if (scenario === "failure") {
    const source = await server.loadAccount(addresses.A);
    const baseFee = await server.fetchBaseFee();
    const setup = new TransactionBuilder(source, {
      networkPassphrase: Networks.TESTNET, fee: String(baseFee),
    }).addOperation(Operation.createAccount({
      destination: addresses.B, startingBalance: "2.0000000",
    })).setTimeout(120).build();
    setup.sign(keys.A);
    await server.submitTransaction(setup);
  }
}

async function runScenario(scenario) {
  const server = new Horizon.Server(HORIZON);
  let store;
  let evidencePath;
  let evidence;
  try {
    const keys = Object.fromEntries(fixture.participants.map((id) => [id, Keypair.random()]));
    const addresses = Object.fromEntries(Object.entries(keys).map(([id, key]) => [id, key.publicKey()]));
    mkdirSync(EVIDENCE_ROOT, { recursive: true });
    evidencePath = join(mkdtempSync(join(EVIDENCE_ROOT, scenario === "success" ? "B01-" : "B02-")), "evidence.json");
    const journalPath = join(dirname(evidencePath), "settlement.sqlite");
    store = new AgreementStore(journalPath);
    evidence = { scenario, addresses, status: "started" };
    writeTestnetEvidence(evidencePath, evidence);
    console.log(JSON.stringify({ evidencePath, journalPath }));
    await setupAccounts(server, keys, addresses, scenario);
    const before = await loadAccounts(server, addresses);
    evidence.before = before;
    writeTestnetEvidence(evidencePath, evidence);
    if (scenario === "failure") {
      // B is a fresh XLM-only account. Even before subtracting reserve it cannot pay 10 XLM.
      assert.equal(nativeBalance(before.B), 2n * UNIT);
    } else {
      assert.ok(nativeBalance(before.B) >= 11n * UNIT);
    }
    assert.ok(nativeBalance(before.A) >= 51n * UNIT);

    const baseFee = await server.fetchBaseFee();
    const roundId = `testnet-${scenario}`;
    store.createRound(roundId);
    const agreement = store.freezeVersion(roundId, null, {
      ...fixture,
      accounts: addresses,
      transactionSourceId: "A",
      feeCapAtomic: String(BigInt(baseFee) * 3n),
      consentBy: Date.now() + 60_000,
    });
    for (const id of fixture.participants) {
      store.recordSignedConsent(signConsent({
        roundId, version: 1, agreementHash: agreement.hash, participantId: id, decision: "ACCEPT",
      }, keys[id]));
    }
    const adapter = new StellarClassicAdapter(store);
    const prepared = adapter.prepare({ roundId, version: 1, hash: agreement.hash },
      before.A.sequenceNumber(), String(baseFee));
    const signedA = adapter.attachSignature(prepared, prepared.unsignedXdr, keys.A);
    const signedAB = adapter.attachSignature(prepared, signedA, keys.B);

    // Load a fresh authoritative view before submission, including the current local time window.
    const transaction = adapter.requireReady(prepared, signedAB);
    Object.assign(evidence, { status: "prepared", transaction });
    writeTestnetEvidence(evidencePath, evidence);
    console.log(JSON.stringify({ scenario, submittingHash: prepared.transactionHash }));
    let rejection;
    let committed;
    const coordinator = new SettlementCoordinator(store, {
      async submit(tx) {
        try {
          await server.submitTransaction(tx);
        } catch (error) {
          rejection = error instanceof TransactionFailedError ? error.getResultCodes() : undefined;
          evidence.resultCodes = rejection;
          throw error;
        }
      },
      async lookup(hash) {
        committed = await lookupTransactionByHash(server, hash);
        return committed;
      },
    });
    const attempt = await coordinator.submit(prepared, signedAB);
    evidence.settlementState = attempt.state;
    if (attempt.state === "RECONCILING") {
      console.log(JSON.stringify({ state: attempt.state, detail: attempt.detail, hash: attempt.transactionHash }));
      throw new Error("Settlement pending. Reconcile the printed hash with the same journal.");
    }
    if (rejection?.transaction !== "tx_failed" && scenario === "failure") {
      throw new Error("The expected tx_failed response was not observed.");
    }
    assert.equal(committed.hash, prepared.transactionHash);
    Object.assign(evidence, { committed, status: "included" });
    writeTestnetEvidence(evidencePath, evidence);
    const after = await loadAccounts(server, addresses);
    evidence.after = after;
    writeTestnetEvidence(evidencePath, evidence);
    assert.equal(Boolean(rejection), scenario === "failure");
    if (rejection) assert.deepEqual(rejection.operations, ["op_success", "op_success", "op_underfunded"]);
    assert.equal(committed.successful, scenario === "success");
    assert.equal(committed.operation_count, 3);
    const ledger = committed.ledger_attr ?? committed.ledger;
    assert.ok(Number.isInteger(ledger) && ledger > 0);
    const fee = BigInt(committed.fee_charged);
    const expected = scenario === "success" ? { A: -50n, B: -10n, C: 20n, D: 40n }
      : { A: 0n, B: 0n, C: 0n, D: 0n };
    const paymentsByAccount = Object.fromEntries(fixture.participants.map((id) => {
      const paymentDelta = nativeBalance(after[id]) - nativeBalance(before[id]) + (id === "A" ? fee : 0n);
      assert.equal(paymentDelta, expected[id] * UNIT);
      return [id, paymentDelta.toString()];
    }));
    assert.equal(BigInt(after.A.sequenceNumber()) - BigInt(before.A.sequenceNumber()), 1n);
    evidence.status = "verified";
    writeTestnetEvidence(evidencePath, evidence);
    console.log(JSON.stringify({
      scenario, hash: committed.hash, ledger,
      successful: committed.successful, feeAtomic: fee.toString(), paymentsByAccount,
      ...(rejection ? { resultCodes: rejection } : {}),
    }, null, 2));
  } catch (error) {
    if (evidence) {
      evidence.status = "incomplete";
      writeTestnetEvidence(evidencePath, evidence);
    }
    throw error;
  } finally {
    store?.close();
  }
}

const [scenario, flag] = process.argv.slice(2);
if ((scenario !== "success" && scenario !== "failure") || flag !== "--execute-testnet") {
  console.error("Specify success or failure and explicitly pass --execute-testnet to contact Stellar testnet.");
  process.exitCode = 2;
} else {
  try {
    await runScenario(scenario);
  } catch (error) {
    // Do not print SDK responses, envelopes, key material or stack traces.
    console.error(error instanceof assert.AssertionError ? "The observed result differed from the scenario."
      : "The testnet run stopped. Check any printed hash before retrying.");
    process.exitCode = 1;
  }
}
