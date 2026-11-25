import { statSync } from "node:fs";
import { Horizon } from "@stellar/stellar-sdk";
import { AgreementStore } from "../dist/agreements.js";
import { lookupTransactionByHash } from "../dist/horizon-settlement.js";
import { SettlementCoordinator } from "../dist/settlement-coordinator.js";

const [path, hash, flag] = process.argv.slice(2);
if (!path || !/^[a-f0-9]{64}$/.test(hash ?? "") || flag !== "--execute-testnet") {
  console.error("Pass an existing SQLite journal, its transaction hash and --execute-testnet.");
  process.exitCode = 2;
} else {
  let store;
  try {
    if (!statSync(path).isFile()) throw new Error("Journal is not a file");
    store = new AgreementStore(path);
    const server = new Horizon.Server("https://horizon-testnet.stellar.org");
    const coordinator = new SettlementCoordinator(store, {
      lookup: (hash) => lookupTransactionByHash(server, hash),
    });
    const result = await coordinator.reconcile(hash);
    console.log(JSON.stringify(result, null, 2));
    if (result.state === "RECONCILING") process.exitCode = 3;
  } catch {
    console.error("Could not reconcile the transaction. Check the journal path and stored hash.");
    process.exitCode = 1;
  } finally {
    store?.close();
  }
}
