import { renameSync, writeFileSync } from "node:fs";
import { StrKey } from "@stellar/stellar-sdk/base";

export const UNIT = 10_000_000n;

function atomic(amount) {
  if (typeof amount !== "string" || !/^\d+(?:\.\d{1,7})?$/.test(amount) || amount.trim() !== amount) {
    throw new Error("Invalid XLM amount for evidence");
  }
  const [whole, fraction = ""] = amount.split(".");
  return BigInt(whole) * UNIT + BigInt(fraction.padEnd(7, "0"));
}

export function nativeBalance(account) {
  return atomic(account.balances.find(({ asset_type }) => asset_type === "native").balance);
}

function publicAddress(address) {
  if (typeof address !== "string" || !StrKey.isValidEd25519PublicKey(address)) {
    throw new Error("Evidence accepts only public Stellar account addresses");
  }
  return address;
}

function unsignedDecimal(value) {
  const number = typeof value === "number" && Number.isSafeInteger(value) ? String(value) : value;
  if (typeof number !== "string" || !/^(0|[1-9][0-9]*)$/.test(number) || number.trim() !== number) {
    throw new Error("Invalid unsigned integer for evidence");
  }
  return number;
}

function publicSnapshot(account) {
  return account ? {
    balanceAtomic: nativeBalance(account).toString(),
    sequence: unsignedDecimal(account.sequenceNumber()),
  } : null;
}

function publicResultCodes(codes) {
  if (!codes) return null;
  const transaction = typeof codes.transaction === "string" && /^tx_[a-z0-9_]{1,48}$/.test(codes.transaction)
    ? codes.transaction : null;
  const operations = Array.isArray(codes.operations)
    ? Array.from({ length: Math.min(codes.operations.length, 3) }, (_, index) => {
      const value = codes.operations[index];
      return typeof value === "string" && /^op_[a-z0-9_]{1,48}$/.test(value) ? value : null;
    })
    : [];
  return { transaction, operations };
}

export function writeTestnetEvidence(path, { scenario, status, addresses, before, after, transaction, committed, resultCodes }) {
  if (!["success", "failure"].includes(scenario)
    || !["started", "prepared", "included", "verified", "incomplete"].includes(status)) {
    throw new Error("Invalid evidence scenario or status");
  }
  const hash = transaction?.hash().toString("hex") ?? null;
  if (hash !== null && !/^[0-9a-f]{64}$/.test(hash)) throw new Error("Invalid transaction hash");
  const codes = publicResultCodes(resultCodes);
  const ledger = committed?.ledger_attr ?? committed?.ledger;
  const included = Boolean(committed && hash && committed.hash === hash
    && Number.isSafeInteger(ledger) && ledger > 0 && typeof committed.successful === "boolean");

  const evidence = {
    schemaVersion: 1,
    scenario: scenario === "success" ? "B01" : "B02",
    network: "stellar-testnet",
    status,
    asset: "XLM",
    accounts: Object.fromEntries(["A", "B", "C", "D"].map((id) => [id, {
      address: publicAddress(addresses[id]),
      before: publicSnapshot(before?.[id]),
      after: publicSnapshot(after?.[id]),
    }])),
    operations: transaction?.operations.map((operation, index) => {
      if (operation.type !== "payment" || !operation.asset.isNative()) {
        throw new Error("Expected a native Stellar payment in evidence");
      }
      return {
        index: index + 1,
        source: publicAddress(operation.source ?? transaction.source),
        destination: publicAddress(operation.destination),
        amountAtomic: atomic(operation.amount).toString(),
        resultCode: codes?.operations[index] ?? null,
        applied: included ? committed.successful : null,
      };
    }) ?? [],
    hash,
    explorerUrl: included ? `https://stellar.expert/explorer/testnet/tx/${hash}` : null,
    ledger: included ? ledger : null,
    successful: included ? committed.successful : null,
    feeAtomic: included ? unsignedDecimal(committed.fee_charged) : null,
    feeAccount: included ? publicAddress(committed.fee_account ?? transaction.source) : null,
    resultCodes: codes,
  };

  const temporaryPath = `${path}.tmp`;
  writeFileSync(temporaryPath, JSON.stringify(evidence, null, 2) + "\n", { mode: 0o600 });
  renameSync(temporaryPath, path);
}
