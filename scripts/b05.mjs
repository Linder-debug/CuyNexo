import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
import { netting, observedResults, participants, UNIT } from "./t05-data.mjs";

export function simulateIndependentPayments(failB) {
  // Same residual instructions as B01/B02. B holds 2 XLM in the failure case,
  // less than the intended 10, regardless of reserve. Commissions are unmodelled.
  const opening = Object.fromEntries(participants.map((id) => [id, failB && id === "B" ? 2n * UNIT : 100n * UNIT]));
  const closing = { ...opening };
  const transfers = netting.payments.map((payment, index) => {
    const { debtorId, creditorId, amountAtomic } = payment;
    const amount = BigInt(amountAtomic);
    const applied = closing[debtorId] >= amount;
    if (applied) {
      closing[debtorId] -= amount;
      closing[creditorId] += amount;
    }
    return { number: index + 1, ...payment, state: applied ? "APPLIED" : "INSUFFICIENT_FUNDS" };
  });
  return {
    source: "simulation-local",
    transfers,
    appliedOperations: transfers.filter(({ state }) => state === "APPLIED").length,
    paymentDeltasAtomic: Object.fromEntries(participants.map((id) => [id, (closing[id] - opening[id]).toString()])),
    settlementState: transfers.every(({ state }) => state === "APPLIED") ? "COMPLETE" : "PARTIAL",
    feeAtomic: null, submitToConfirmationMs: null,
  };
}

function testnetSample(evidence) {
  const deltas = Object.fromEntries(participants.map((id) => {
    const { before, after } = evidence.accounts[id];
    const fee = evidence.accounts[id].address === evidence.feeAccount ? BigInt(evidence.feeAtomic) : 0n;
    return [id, (BigInt(after.balanceAtomic) - BigInt(before.balanceAtomic) + fee).toString()];
  }));
  const applied = evidence.operations.filter(({ applied }) => applied).length;
  assert.deepEqual(deltas, evidence.successful
    ? Object.fromEntries(netting.balances.map(({ participantId, amountAtomic }) => [participantId, amountAtomic]))
    : Object.fromEntries(participants.map((id) => [id, "0"])));
  assert.equal(applied, evidence.successful ? netting.payments.length : 0);
  return {
    source: "observed-testnet", scenario: evidence.scenario, hash: evidence.hash,
    ledger: evidence.ledger, appliedOperations: applied, paymentDeltasAtomic: deltas,
    settlementState: evidence.settlementState, feeAtomic: evidence.feeAtomic,
    resultCodes: evidence.resultCodes, submitToConfirmationMs: null,
  };
}

export function buildB05() {
  const { success, failure, recovery } = observedResults();
  return {
    scenario: "B05",
    scope: "same-three-residual-payments",
    observed: { success: testnetSample(success), failure: testnetSample(failure) },
    simulated: { success: simulateIndependentPayments(false), failure: simulateIndependentPayments(true) },
    recoveryObserved: {
      scenario: "B04", hash: recovery.hash, ledger: recovery.ledger, feeAtomic: recovery.feeAtomic,
      clientResponseLoss: "injected", requests: recovery.submission.requests,
      submitCalls: recovery.submission.submitCalls, stateBefore: recovery.recovery.previousState,
      stateAfter: recovery.recovery.state, recoverySubmitCalls: recovery.recovery.submitCalls,
      sourceHashes: recovery.sourceHashes, submitToConfirmationMs: null,
    },
    modeledActions: {
      atomic: { roundConsents: 4, envelopeSignatures: 2, sendInstructions: 1, resultRecords: 1 },
      independent: { roundConsents: 0, perTransferApprovals: 3, sendInstructions: 3, resultRecords: 3 },
    },
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  console.log(JSON.stringify(buildB05(), null, 2));
}
