import { Networks, Transaction, TransactionBuilder } from "@stellar/stellar-sdk/base";
import { AgreementError, type AgreementStore, type SettlementAttempt, type SettlementOutcome } from "./agreements.js";
import { StellarClassicAdapter, type PreparedSettlement } from "./stellar-classic.js";

export interface SettlementReceipt {
  hash: string;
  successful: boolean;
  envelope_xdr: string;
  operation_count: number;
  ledger_attr: number;
  fee_charged: string | number;
}

export interface SettlementTransport {
  submit(transaction: Transaction): Promise<unknown>;
  lookup(hash: string): Promise<SettlementReceipt>;
}

export class SettlementCoordinator {
  private readonly adapter: StellarClassicAdapter;

  constructor(
    private readonly store: AgreementStore,
    private readonly transport: SettlementTransport,
    clock: () => number = Date.now,
  ) {
    this.adapter = new StellarClassicAdapter(store, clock);
  }

  async submit(prepared: PreparedSettlement, signedXdr: string): Promise<SettlementAttempt> {
    const { roundId, version, hash } = prepared.agreement;
    let attempt = this.store.findSettlementForVersion(roundId, version);
    if (!attempt) {
      let transaction;
      try {
        transaction = this.adapter.requireReady(prepared, signedXdr);
      } catch (error) {
        const concurrent = this.store.findSettlementForVersion(roundId, version);
        if (!concurrent) throw error;
        return this.reconcileExisting(concurrent, prepared);
      }
      const reservation = this.store.reserveSettlement({
        roundId, version, agreementHash: hash, transactionHash: prepared.transactionHash,
        envelopeXdr: transaction.toXDR(), operationCount: transaction.operations.length,
        maxTime: prepared.maxTime,
      });
      attempt = reservation.attempt;
      if (reservation.reserved) {
        try {
          await this.transport.submit(transaction);
        } catch {
          // A transport error cannot establish whether the payment reached the ledger.
        }
      }
    }
    return this.reconcileExisting(attempt, prepared);
  }

  private reconcileExisting(attempt: SettlementAttempt, prepared: PreparedSettlement): Promise<SettlementAttempt> {
    if (attempt.transactionHash !== prepared.transactionHash || attempt.agreementHash !== prepared.agreement.hash) {
      throw new AgreementError("VERSION_CONFLICT", "An existing settlement has a different hash");
    }
    return this.reconcile(attempt.transactionHash);
  }

  async reconcile(hash: string): Promise<SettlementAttempt> {
    const attempt = this.store.getSettlementByHash(hash);
    if (attempt.state === "SETTLED" || attempt.state === "FAILED") return attempt;
    let receipt: SettlementReceipt;
    try {
      receipt = await this.transport.lookup(attempt.transactionHash);
    } catch {
      return this.store.recordSettlementOutcome(hash, { state: "RECONCILING", detail: "UNCONFIRMED" });
    }
    return this.store.recordSettlementOutcome(hash, verifyReceipt(attempt, receipt));
  }
}

function verifyReceipt(attempt: SettlementAttempt, receipt: SettlementReceipt): SettlementOutcome {
  const mismatch = { state: "RECONCILING", detail: "LEDGER_MISMATCH" } as const;
  if (!receipt || receipt.hash !== attempt.transactionHash || typeof receipt.successful !== "boolean"
    || receipt.operation_count !== attempt.operationCount
    || !Number.isSafeInteger(receipt.ledger_attr) || receipt.ledger_attr <= 0) return mismatch;
  const fee = String(receipt.fee_charged);
  if (!/^(0|[1-9][0-9]*)$/.test(fee)) return mismatch;
  let transaction;
  try {
    transaction = TransactionBuilder.fromXDR(receipt.envelope_xdr, Networks.TESTNET);
  } catch {
    return mismatch;
  }
  if (!(transaction instanceof Transaction) || transaction.hash().toString("hex") !== attempt.transactionHash
    || transaction.operations.length !== attempt.operationCount || BigInt(fee) > BigInt(transaction.fee)) {
    return mismatch;
  }
  return { state: receipt.successful ? "SETTLED" : "FAILED", ledger: receipt.ledger_attr, feeAtomic: fee };
}
