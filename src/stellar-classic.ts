import { Account, Asset, Keypair, Memo, Networks, Operation, Transaction, TransactionBuilder } from "@stellar/stellar-sdk/base";
import type { AgreementStore, FrozenAgreement } from "./agreements.js";

interface AgreementRef {
  roundId: string;
  version: number;
  hash: string;
}

export interface PreparedSettlement {
  agreement: AgreementRef;
  sourceSequence: string;
  baseFeeAtomic: string;
  maxTime: number;
  unsignedXdr: string;
  transactionHash: string;
}

export class SettlementError extends Error {
  constructor(
    public readonly code: "INVALID_SETTLEMENT" | "XDR_MISMATCH" | "BAD_SIGNATURE" | "MISSING_SIGNATURE" | "EXPIRED",
    message: string,
  ) {
    super(message);
    this.name = "SettlementError";
  }
}

function xlm(atomic: string): string {
  const digits = atomic.padStart(8, "0");
  return digits.slice(0, -7) + "." + digits.slice(-7);
}

function buildBody(agreement: FrozenAgreement, prepared: Omit<PreparedSettlement, "unsignedXdr" | "transactionHash">): Transaction {
  const { accounts, payments } = agreement;
  if (!accounts || payments.length === 0 || agreement.network !== "stellar-testnet" || agreement.asset !== "XLM") {
    throw new SettlementError("INVALID_SETTLEMENT", "A testnet agreement with XLM payments is required");
  }
  const { sourceSequence, baseFeeAtomic, maxTime } = prepared;
  if (typeof sourceSequence !== "string" || !/^(0|[1-9][0-9]*)$/.test(sourceSequence) || sourceSequence !== sourceSequence.trim()
    || BigInt(sourceSequence) >= (1n << 63n) - 1n
    || typeof baseFeeAtomic !== "string" || !/^[1-9][0-9]*$/.test(baseFeeAtomic) || baseFeeAtomic !== baseFeeAtomic.trim()
    || !Number.isSafeInteger(maxTime) || maxTime <= 0 || maxTime > Math.floor(agreement.settleBy / 1000)) {
    throw new SettlementError("INVALID_SETTLEMENT", "Invalid sequence, base fee or transaction time bound");
  }
  const fee = BigInt(baseFeeAtomic) * BigInt(payments.length);
  if (fee > BigInt(agreement.feeCapAtomic) || fee > 0xffffffffn) {
    throw new SettlementError("INVALID_SETTLEMENT", "Transaction fee exceeds the allowed cap");
  }

  const builder = new TransactionBuilder(new Account(accounts[agreement.transactionSourceId], sourceSequence), {
    fee: baseFeeAtomic,
    networkPassphrase: Networks.TESTNET,
  }).addMemo(Memo.hash(prepared.agreement.hash)).setTimebounds(0, maxTime);

  for (const { debtorId, creditorId, amountAtomic } of payments) {
    builder.addOperation(Operation.payment({
      source: accounts[debtorId],
      destination: accounts[creditorId],
      asset: Asset.native(),
      amount: xlm(amountAtomic),
    }));
  }
  return builder.build();
}

export class StellarClassicAdapter {
  constructor(private readonly store: AgreementStore, private readonly clock: () => number = Date.now) {}

  prepare(agreement: AgreementRef, sourceSequence: string, baseFeeAtomic: string): PreparedSettlement {
    const agreed = this.store.requireSignedAgreement(agreement.roundId, agreement.version, agreement.hash).agreement;
    const now = this.clock();
    const maxTime = Math.floor(Math.min(agreed.settleBy, now + 300_000) / 1000);
    this.checkWindow(maxTime, now);
    const params = { agreement: { ...agreement }, sourceSequence, baseFeeAtomic, maxTime };
    const body = buildBody(agreed, params);
    return { ...params, unsignedXdr: body.toXDR(), transactionHash: body.hash().toString("hex") };
  }

  attachSignature(prepared: PreparedSettlement, envelopeXdr: string, signer: Keypair): string {
    const { transaction, required, present } = this.inspectEnvelope(prepared, envelopeXdr);
    const address = signer.publicKey();
    if (!required.has(address) || !signer.canSign()) {
      throw new SettlementError("BAD_SIGNATURE", "Signer is not an authorized source for this transaction");
    }
    if (!present.has(address)) transaction.sign(signer);
    return transaction.toXDR();
  }

  requireReady(prepared: PreparedSettlement, envelopeXdr: string): Transaction {
    const { transaction, required, present } = this.inspectEnvelope(prepared, envelopeXdr);
    if (present.size !== required.size) {
      throw new SettlementError("MISSING_SIGNATURE", "Every transaction and payment source must sign the same body");
    }
    return transaction;
  }

  private checkWindow(maxTime: number, now = this.clock()): void {
    if (now >= maxTime * 1000) throw new SettlementError("EXPIRED", "Classic Stellar transaction window has expired");
  }

  private inspectEnvelope(prepared: PreparedSettlement, envelopeXdr: string) {
    const now = this.clock();
    this.checkWindow(prepared.maxTime, now);
    if (prepared.maxTime > Math.floor((now + 300_000) / 1000)) {
      throw new SettlementError("INVALID_SETTLEMENT", "Classic Stellar transaction window exceeds five minutes");
    }
    const { roundId, version, hash } = prepared.agreement;
    const { agreement } = this.store.requireSignedAgreement(roundId, version, hash);
    const expected = buildBody(agreement, prepared);
    if (expected.toXDR() !== prepared.unsignedXdr || expected.hash().toString("hex") !== prepared.transactionHash) {
      throw new SettlementError("XDR_MISMATCH", "Prepared transaction differs from its expected body");
    }
    let transaction;
    try {
      transaction = TransactionBuilder.fromXDR(envelopeXdr, Networks.TESTNET);
    } catch {
      throw new SettlementError("XDR_MISMATCH", "Malformed Stellar envelope");
    }
    if (!(transaction instanceof Transaction) || !transaction.signatureBase().equals(expected.signatureBase())) {
      throw new SettlementError("XDR_MISMATCH", "Envelope body differs from the approved classic transaction");
    }

    const accounts = agreement.accounts!;
    const required = new Set([accounts[agreement.transactionSourceId],
      ...agreement.payments.map(({ debtorId }) => accounts[debtorId])]);
    const verifiers = [...required].map((address) => Keypair.fromPublicKey(address));
    const present = new Set<string>();
    const transactionHash = transaction.hash();
    for (const signature of transaction.signatures) {
      const signer = verifiers.find((key) => signature.hint().equals(key.signatureHint())
        && key.verify(transactionHash, signature.signature()));
      if (!signer || present.has(signer.publicKey())) {
        throw new SettlementError("BAD_SIGNATURE", "Envelope has an invalid, duplicate or unexpected signature");
      }
      present.add(signer.publicKey());
    }
    return { transaction, required, present };
  }
}
