export interface Obligation {
  obligationId: string;
  debtorId: string;
  creditorId: string;
  amountAtomic: string;
}

export interface NettingInput {
  participants: readonly string[];
  obligations: readonly Obligation[];
}

export interface NettingResult {
  balances: { participantId: string; amountAtomic: string }[];
  payments: Omit<Obligation, "obligationId">[];
  grossAtomic: string;
  residualAtomic: string;
}

export class NettingError extends Error {
  constructor(public readonly code: "INVALID_INPUT" | "PAYMENT_AMOUNT_OUT_OF_RANGE", message: string) {
    super(message);
    this.name = "NettingError";
  }
}

const MAX_PAYMENT_ATOMIC = (1n << 63n) - 1n;

function requireInput(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new NettingError("INVALID_INPUT", message);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isIdentifier(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && !/[^\x21-\x7E]/.test(value);
}

export function calculateNetting(input: unknown): NettingResult {
  requireInput(isRecord(input), "Expected a netting input object");
  const { participants, obligations } = input;
  requireInput(Array.isArray(participants) && participants.length >= 3 && participants.length <= 8,
    "Expected 3 to 8 participants");
  requireInput(Array.isArray(obligations), "Expected an obligations array");

  const balances = new Map<string, bigint>();
  for (const participant of participants) {
    requireInput(isIdentifier(participant), "Participant IDs must be nonempty printable ASCII without spaces");
    requireInput(!balances.has(participant), "Participant IDs must be unique");
    balances.set(participant, 0n);
  }

  let gross = 0n;
  const obligationIds = new Set<string>();
  for (const obligation of obligations) {
    requireInput(isRecord(obligation), "Expected an obligation object");
    const { obligationId, debtorId, creditorId, amountAtomic } = obligation;
    requireInput(isIdentifier(obligationId), "Expected a valid obligation ID");
    requireInput(!obligationIds.has(obligationId), "Obligation IDs must be unique");
    requireInput(typeof debtorId === "string" && typeof creditorId === "string" && debtorId !== creditorId,
      "Debtor and creditor must be distinct participant IDs");
    const debtor = balances.get(debtorId);
    const creditor = balances.get(creditorId);
    requireInput(debtor !== undefined && creditor !== undefined, "Obligation references an unknown participant");
    requireInput(typeof amountAtomic === "string" && /^[1-9][0-9]*$/.test(amountAtomic) && amountAtomic.trim() === amountAtomic,
      "Amount must be a canonical positive integer string in atomic units");

    const amount = BigInt(amountAtomic);
    obligationIds.add(obligationId);
    balances.set(debtorId, debtor - amount);
    balances.set(creditorId, creditor + amount);
    gross += amount;
  }

  const sortedBalances = [...balances.entries()]
    .sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0)
    .map(([participantId, amount]) => ({ participantId, amount }));
  const debtors = sortedBalances.filter(({ amount }) => amount < 0n)
    .map(({ participantId, amount }) => ({ participantId, remaining: -amount }));
  const creditors = sortedBalances.filter(({ amount }) => amount > 0n)
    .map(({ participantId, amount }) => ({ participantId, remaining: amount }));

  const payments: NettingResult["payments"] = [];
  let residual = 0n;
  let debtorIndex = 0;
  let creditorIndex = 0;
  while (debtorIndex < debtors.length && creditorIndex < creditors.length) {
    const debtor = debtors[debtorIndex];
    const creditor = creditors[creditorIndex];
    const amount = debtor.remaining < creditor.remaining ? debtor.remaining : creditor.remaining;
    if (amount > MAX_PAYMENT_ATOMIC) {
      throw new NettingError("PAYMENT_AMOUNT_OUT_OF_RANGE", "Residual payment exceeds the signed 64-bit limit");
    }
    payments.push({
      debtorId: debtor.participantId,
      creditorId: creditor.participantId,
      amountAtomic: amount.toString(),
    });
    residual += amount;
    debtor.remaining -= amount;
    creditor.remaining -= amount;
    if (debtor.remaining === 0n) debtorIndex++;
    if (creditor.remaining === 0n) creditorIndex++;
  }

  return {
    balances: sortedBalances.map(({ participantId, amount }) => ({ participantId, amountAtomic: amount.toString() })),
    payments,
    grossAtomic: gross.toString(),
    residualAtomic: residual.toString(),
  };
}
