import assert from "node:assert/strict";
import { mkdirSync, readFileSync, renameSync, statSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { Horizon } from "@stellar/stellar-sdk";
import { Keypair, Networks, Transaction, TransactionBuilder } from "@stellar/stellar-sdk/base";
import { AgreementStore } from "../dist/agreements.js";
import { signConsent } from "../dist/consents.js";
import { lookupTransactionByHash } from "../dist/horizon-settlement.js";
import { SettlementCoordinator } from "../dist/settlement-coordinator.js";
import { StellarClassicAdapter } from "../dist/stellar-classic.js";
import { nativeBalance, UNIT } from "./testnet-evidence.mjs";

const fixture = JSON.parse(readFileSync(new URL("../fixtures/cuatro-empresas.json", import.meta.url)));
const participants = fixture.participants;
const read = (path) => JSON.parse(readFileSync(path, "utf8"));

function write(path, value) {
  writeFileSync(path + ".tmp", JSON.stringify(value, null, 2) + "\n", { mode: 0o600 });
  renameSync(path + ".tmp", path);
}

function simulatedLedger(directory) {
  const path = join(directory, "simulated-ledger.json");
  return {
    async fund(addresses) {
      const accounts = Object.fromEntries(Object.values(addresses).map((address) =>
        [address, { balanceAtomic: (100n * UNIT).toString(), sequence: "420" }]));
      write(path, { accounts, transactions: [] });
    },
    baseFee: async () => "100",
    async account(address) {
      return read(path).accounts[address];
    },
    async submit(transaction) {
      const state = read(path);
      const source = state.accounts[transaction.source];
      assert.equal(BigInt(transaction.sequence), BigInt(source.sequence) + 1n);
      source.sequence = transaction.sequence;
      source.balanceAtomic = (BigInt(source.balanceAtomic) - BigInt(transaction.fee)).toString();
      for (const { source, destination, amount } of transaction.operations) {
        const payment = nativeBalance({ balances: [{ asset_type: "native", balance: amount }] });
        const debtor = state.accounts[source];
        const creditor = state.accounts[destination];
        debtor.balanceAtomic = (BigInt(debtor.balanceAtomic) - payment).toString();
        creditor.balanceAtomic = (BigInt(creditor.balanceAtomic) + payment).toString();
      }
      state.transactions.push({
        hash: transaction.hash().toString("hex"), successful: true, ledger_attr: 1,
        source_account: transaction.source, source_account_sequence: transaction.sequence,
        operation_count: transaction.operations.length, fee_charged: transaction.fee, envelope_xdr: transaction.toXDR(),
      });
      write(path, state);
    },
    async lookup(hash) {
      const match = read(path).transactions.find((record) => record.hash === hash);
      if (!match) throw new Error("No simulated ledger record");
      return match;
    },
    async sourcedAfter(address, sequence) {
      return sourcedAfter(read(path).transactions, address, sequence);
    },
  };
}

function sourcedAfter(records, address, sequence) {
  return records.filter((record) => record.source_account === address &&
    BigInt(record.source_account_sequence) > BigInt(sequence)).map(({ hash }) => hash);
}

function testnetLedger() {
  const server = new Horizon.Server("https://horizon-testnet.stellar.org");
  return {
    async fund(addresses) {
      for (const address of Object.values(addresses)) await server.friendbot(address).call();
    },
    baseFee: async () => String(await server.fetchBaseFee()),
    async account(address) {
      const account = await server.loadAccount(address);
      return { balanceAtomic: nativeBalance(account).toString(), sequence: account.sequenceNumber() };
    },
    submit: (transaction) => server.submitTransaction(transaction),
    lookup: (hash) => lookupTransactionByHash(server, hash),
    async sourcedAfter(address, sequence) {
      const page = await server.transactions().forAccount(address).includeFailed(true).order("desc").limit(200).call();
      assert.ok(page.records.length < 200, "The fresh source account history must fit in one page");
      return sourcedAfter(page.records, address, sequence);
    },
  };
}

async function snapshots(ledger, addresses) {
  return Object.fromEntries(await Promise.all(participants.map(async (id) => [id, await ledger.account(addresses[id])])));
}

async function start(directory, ledger, report) {
  const keys = Object.fromEntries(participants.map((id) => [id, Keypair.random()]));
  const addresses = Object.fromEntries(participants.map((id) => [id, keys[id].publicKey()]));
  await ledger.fund(addresses);
  const before = await snapshots(ledger, addresses);
  assert.ok(BigInt(before.A.balanceAtomic) >= 51n * UNIT && BigInt(before.B.balanceAtomic) >= 11n * UNIT);
  const baseFee = await ledger.baseFee();
  const journal = join(directory, "settlement.sqlite");
  const store = new AgreementStore(journal);
  try {
    const roundId = "b04";
    store.createRound(roundId);
    const agreement = store.freezeVersion(roundId, null, {
      ...fixture, accounts: addresses, transactionSourceId: "A",
      feeCapAtomic: String(BigInt(baseFee) * 3n), consentBy: Date.now() + 60_000,
    });
    for (const participantId of participants) {
      store.recordSignedConsent(signConsent({
        roundId, version: 1, agreementHash: agreement.hash, participantId, decision: "ACCEPT",
      }, keys[participantId]));
    }
    const adapter = new StellarClassicAdapter(store);
    const prepared = adapter.prepare({ roundId, version: 1, hash: agreement.hash }, before.A.sequence, baseFee);
    const signedA = adapter.attachSignature(prepared, prepared.unsignedXdr, keys.A);
    const signed = adapter.attachSignature(prepared, signedA, keys.B);
    const hash = prepared.transactionHash;
    const submission = { processId: process.pid, requests: 0, submitCalls: 0, responseDiscarded: false, statuses: [] };
    Object.assign(report, { hash, addresses, before, submission });
    const persist = () => write(join(directory, "evidence.json"), report);
    persist();
    console.log(JSON.stringify({ directory, hash }));

    const other = new AgreementStore(journal);
    try {
      const transport = {
        async submit(transaction) {
          submission.submitCalls++;
          persist();
          // Yield before transmission so the second request contends with this pending attempt.
          await Promise.resolve();
          await ledger.submit(transaction);
          submission.responseDiscarded = true;
          persist();
          throw new Error("B04: successful response deliberately discarded at the client boundary");
        },
        async lookup() {
          throw new Error("B04: lookup deliberately unavailable before restart");
        },
      };
      const first = new SettlementCoordinator(store, transport);
      const second = new SettlementCoordinator(other, transport);
      submission.requests = 2;
      const attempts = await Promise.all([first.submit(prepared, signed), second.submit(prepared, signed)]);
      submission.statuses = attempts.map(({ state }) => state);
      persist();
      assert.equal(submission.submitCalls, 1, "Expected exactly one transport submission");
      for (const attempt of attempts) {
        assert.equal(attempt.transactionHash, hash);
        assert.equal(attempt.state, "RECONCILING");
      }
      assert.equal(submission.responseDiscarded, true, "The client did not observe a successful response to discard");
    } finally {
      other.close();
    }
  } finally {
    store.close();
  }
}

async function recover(directory, ledger, report) {
  const { hash, addresses, before, submission } = report;
  assert.match(hash, /^[a-f0-9]{64}$/);
  assert.equal(process.pid === submission.processId, false, "Use a separate process to test restart");
  const journal = join(directory, "settlement.sqlite");
  assert.ok(statSync(journal).isFile(), "Recovery requires the original SQLite journal");
  const store = new AgreementStore(journal);
  const persist = () => write(join(directory, "evidence.json"), report);
  try {
    const attempt = store.getSettlementByHash(hash);
    report.status = "recovery-incomplete";
    report.recovery = { processId: process.pid, hash, previousState: attempt.state, submitCalls: 0 };
    persist();
    let receipt;
    const coordinator = new SettlementCoordinator(store, {
      async lookup(expectedHash) {
        receipt = await ledger.lookup(expectedHash);
        return receipt;
      },
    });
    const result = await coordinator.reconcile(hash);
    report.recovery.state = result.state;
    report.recovery.detail = result.detail;
    persist();
    if (result.state === "RECONCILING") {
      console.log(JSON.stringify({ hash, state: result.state, detail: result.detail }));
      return 3;
    }
    assert.equal(result.state, "SETTLED");
    receipt ??= await ledger.lookup(hash);
    const transaction = TransactionBuilder.fromXDR(receipt.envelope_xdr, Networks.TESTNET);
    assert.ok(transaction instanceof Transaction && receipt.successful === true);
    assert.equal(receipt.hash, hash);
    assert.equal(receipt.ledger_attr, result.ledger);
    assert.equal(String(receipt.fee_charged), result.feeAtomic);
    assert.equal(transaction.hash().toString("hex"), hash);
    assert.equal(transaction.source, addresses.A);

    const aliases = Object.fromEntries(participants.map((id) => [addresses[id], id]));
    const operations = transaction.operations.map(({ type, source, destination, asset, amount }) => {
      assert.ok(type === "payment" && asset.isNative());
      return { from: aliases[source], to: aliases[destination], xlm: amount };
    });
    assert.deepEqual(operations, [
      { from: "A", to: "C", xlm: "20.0000000" },
      { from: "A", to: "D", xlm: "30.0000000" },
      { from: "B", to: "D", xlm: "10.0000000" },
    ]);

    const after = await snapshots(ledger, addresses);
    const sourceHashes = await ledger.sourcedAfter(addresses.A, before.A.sequence);
    assert.deepEqual(sourceHashes, [hash], "Expected one sourced transaction since the initial snapshot");
    assert.equal(BigInt(after.A.sequence) - BigInt(before.A.sequence), 1n);
    const expected = { A: -50n, B: -10n, C: 20n, D: 40n };
    const paymentDeltasAtomic = {};
    for (const id of participants) {
      const fee = id === "A" ? BigInt(result.feeAtomic) : 0n;
      const delta = BigInt(after[id].balanceAtomic) - BigInt(before[id].balanceAtomic) + fee;
      assert.equal(delta, expected[id] * UNIT);
      paymentDeltasAtomic[id] = delta.toString();
    }
    const complete = submission.responseDiscarded && submission.requests === 2 && submission.submitCalls === 1
      && submission.statuses.length === 2 && submission.statuses.every((state) => state === "RECONCILING");
    Object.assign(report, {
      status: complete ? (report.mode === "offline" ? "simulated-pass" : "testnet-verified") : "recovery-incomplete",
      after, operations, sourceHashes, paymentDeltasAtomic, successful: true,
      ledger: result.ledger, feeAtomic: result.feeAtomic,
      explorerUrl: report.mode === "offline" ? null : `https://stellar.expert/explorer/testnet/tx/${hash}`,
    });
    persist();
    console.log(JSON.stringify({ hash, state: result.state, status: report.status }));
    return complete ? 0 : 1;
  } finally {
    store.close();
  }
}

const [phase, directoryArgument, flag, ...extra] = process.argv.slice(2);
if (!["start", "recover"].includes(phase) || !directoryArgument
  || !["--offline", "--execute-testnet"].includes(flag) || extra.length) {
  console.error("Usage: stellar-b04.mjs start|recover DIRECTORY --offline|--execute-testnet");
  process.exitCode = 2;
} else {
  try {
    const directory = resolve(directoryArgument);
    const mode = flag === "--offline" ? "offline" : "testnet";
    const reportPath = join(directory, "evidence.json");
    if (phase === "recover") {
      const report = read(reportPath);
      assert.ok(report.scenario === "B04" && report.mode === mode, "Run mode must match the original submission");
      const ledger = mode === "offline" ? simulatedLedger(directory) : testnetLedger();
      process.exitCode = await recover(directory, ledger, report);
    } else {
      mkdirSync(directory, { mode: 0o700 });
      const ledger = mode === "offline" ? simulatedLedger(directory) : testnetLedger();
      await start(directory, ledger, { scenario: "B04", mode, status: "awaiting-recovery" });
    }
  } catch {
    console.error("B04 stopped. If the attempt was saved, recover with the original directory and mode.");
    process.exitCode = 1;
  }
}
