import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import { AgreementStore } from "../dist/agreements.js";

const fixture = JSON.parse(readFileSync(new URL("../fixtures/cuatro-empresas.json", import.meta.url), "utf8"));
const ROUND = "ronda-sintetica";
const START = Date.UTC(2026, 10, 24, 15, 0);
const CONSENT_BY = START + 60_000;

function draft(overrides = {}) {
  return {
    ...structuredClone(fixture),
    transactionSourceId: "A",
    feeCapAtomic: "300",
    consentBy: CONSENT_BY,
    ...overrides,
  };
}

function setup(t) {
  const directory = mkdtempSync(join(tmpdir(), "cuynexo-t02-"));
  const path = join(directory, "agreements.sqlite");
  let now = START;
  const clock = () => now;
  const connections = [];
  function open() {
    const db = new AgreementStore(path, clock);
    connections.push(db);
    return db;
  }
  t.after(() => {
    for (const db of connections.reverse()) db.close();
    rmSync(directory, { recursive: true, force: true });
  });
  const store = open();
  store.createRound(ROUND);
  return {
    store, open, path,
    disconnect(connection) {
      connection.close();
      connections.splice(connections.indexOf(connection), 1);
    },
    setTime: (value) => { now = value; },
  };
}

function vote(store, view, participantId, decision = "ACCEPT", overrides = {}) {
  return store.recordConsent({
    roundId: view.agreement.roundId,
    version: view.agreement.version,
    agreementHash: view.hash,
    participantId,
    decision,
    ...overrides,
  });
}

function acceptAll(store, view) {
  for (const participant of view.agreement.participants) view = vote(store, view, participant);
  return view;
}

test("T02: ronda, versión y decisiones persistidas en SQLite", (t) => {
  const { store, open, disconnect } = setup(t);
  const view = store.freezeVersion(ROUND, null, draft());
  const updated = vote(store, view, "A");
  assert.equal(updated.agreement.residualAtomic, "600000000");
  disconnect(store);
  assert.deepEqual(open().getVersion(ROUND, 1), updated);
  assert.deepEqual(updated.consents, [{ participantId: "A", decision: "ACCEPT", receivedAt: START }]);
});

test("T02: payload congelado y hash canónico reproducible", (t) => {
  const { store, path } = setup(t);
  const input = draft();
  const first = store.freezeVersion(ROUND, null, input);
  input.obligations[0].amountAtomic = "1";
  const persisted = store.getVersion(ROUND, 1);
  assert.deepEqual(persisted, first);
  assert.equal(first.hash, "ea6ef706836bfa169a1b9ceef33b4fc283bfeae7373b00a4efa35cc111caf863");
  assert.equal(first.agreement.settleBy, CONSENT_BY + 600_000);

  const db = new DatabaseSync(path);
  try {
    const { payload } = db.prepare("SELECT payload FROM agreement_versions").get();
    assert.equal(createHash("sha256").update(payload, "utf8").digest("hex"), first.hash);
    assert.throws(() => db.exec("UPDATE agreement_versions SET payload = '{}'"), /immutable/);
    assert.throws(() => db.exec("UPDATE agreement_versions SET hash = 'modified'"), /immutable/);
  } finally {
    db.close();
  }

  const reversed = new AgreementStore(":memory:", () => START);
  try {
    reversed.createRound(ROUND);
    assert.deepEqual(reversed.freezeVersion(ROUND, null, draft({
      participants: [...fixture.participants].reverse(),
      obligations: [...fixture.obligations].reverse(),
    })), first);
    reversed.closeRound(ROUND, 1);
    reversed.createRound("otra-ronda");
    assert.notEqual(reversed.freezeVersion("otra-ronda", null, draft()).hash, first.hash);
  } finally {
    reversed.close();
  }
});

test("T02: requiere los cuatro consentimientos válidos, con reintentos idempotentes", (t) => {
  const { store, open, setTime } = setup(t);
  const initial = store.freezeVersion(ROUND, null, draft());
  const first = vote(store, initial, "A");
  setTime(START + 1);
  assert.deepEqual(vote(open(), initial, "A"), first);
  assert.throws(() => vote(store, initial, "A", "REJECT"), { code: "INVALID_CONSENT" });
  assert.throws(() => vote(store, initial, "X"), { code: "INVALID_CONSENT" });
  assert.throws(() => vote(store, initial, "B", "ACCEPT", { agreementHash: "0".repeat(64) }),
    { code: "INVALID_CONSENT" });
  assert.throws(() => vote(store, initial, "B", "ACCEPT", { version: 2 }), { code: "INVALID_CONSENT" });
  assert.throws(() => vote(store, initial, "B", "ACCEPT", { roundId: "otra-ronda" }), { code: "INVALID_CONSENT" });
  vote(store, initial, "B");
  const three = vote(store, initial, "C");
  assert.equal(three.validApprovalCount, 3);
  assert.equal(three.status, "PENDING_CONSENT");
  assert.equal(three.canAdvance, false);
  const four = vote(store, initial, "D");
  assert.equal(four.validApprovalCount, 4);
  assert.equal(four.status, "APPROVED");
  assert.equal(four.canAdvance, true);
  assert.deepEqual(open().getVersion(ROUND, 1), four);
});

test("T02/B03 local: un rechazo bloquea la versión y se conserva tras reabrir", (t) => {
  const { store, open } = setup(t);
  const initial = store.freezeVersion(ROUND, null, draft());
  vote(store, initial, "A");
  vote(store, initial, "B");
  const rejected = vote(store, initial, "C", "REJECT");
  assert.equal(rejected.status, "REJECTED");
  assert.equal(rejected.canAdvance, false);
  assert.equal(rejected.validApprovalCount, 0);
  const reopened = open();
  assert.deepEqual(reopened.getVersion(ROUND, 1), rejected);
  assert.deepEqual(vote(reopened, initial, "C", "REJECT"), rejected);
  assert.throws(() => vote(reopened, initial, "C"), { code: "INVALID_CONSENT" });
  assert.throws(() => vote(reopened, initial, "D"), { code: "INVALID_CONSENT" });
  assert.deepEqual(store.getVersion(ROUND, 1), rejected);
});

test("T02/B03 local: cambiar una obligación invalida las cuatro aprobaciones anteriores", (t) => {
  const { store, open } = setup(t);
  const first = acceptAll(store, store.freezeVersion(ROUND, null, draft()));
  const changed = draft();
  changed.obligations[0].amountAtomic = "1010000000";
  const second = open().freezeVersion(ROUND, 1, changed);
  assert.equal(second.agreement.version, 2);
  assert.notEqual(second.hash, first.hash);
  assert.equal(second.agreement.grossAtomic, "3210000000");
  assert.deepEqual(second.consents, []);
  assert.equal(second.canAdvance, false);
  const prior = store.getVersion(ROUND, 1);
  assert.equal(prior.status, "SUPERSEDED");
  assert.equal(prior.validApprovalCount, 0);
  assert.equal(prior.canAdvance, false);
  assert.equal(prior.consents.length, 4);
  assert.throws(() => vote(store, first, "A"), { code: "INVALID_CONSENT" });
  assert.throws(() => vote(store, second, "A", "ACCEPT", { agreementHash: first.hash }),
    { code: "INVALID_CONSENT" });
  assert.equal(acceptAll(store, second).canAdvance, true);
});

test("T02: cambiar el plazo crea otra versión y una edición desactualizada falla", (t) => {
  const { store, open } = setup(t);
  const first = store.freezeVersion(ROUND, null, draft());
  const partial = vote(store, first, "A");
  assert.throws(() => store.freezeVersion(ROUND, 1, draft({ consentBy: START })), { code: "INVALID_INPUT" });
  assert.deepEqual(store.getVersion(ROUND, 1), partial);
  const updated = open().freezeVersion(ROUND, 1, draft({ consentBy: CONSENT_BY + 5000 }));
  assert.notEqual(updated.hash, first.hash);
  assert.equal(store.getVersion(ROUND, 1).validApprovalCount, 0);
  assert.equal(updated.validApprovalCount, 0);
  assert.throws(() => store.freezeVersion(ROUND, 1, draft()), { code: "VERSION_CONFLICT" });
  assert.throws(() => store.freezeVersion(ROUND, 2, draft({ feeCapAtomic: "300\n" })), { code: "INVALID_INPUT" });
  assert.deepEqual(store.getVersion(ROUND, 2), updated);
});

test("T02/B03 local: al llegar a consentBy se invalidan las aprobaciones parciales", (t) => {
  const { store, open, setTime } = setup(t);
  const initial = store.freezeVersion(ROUND, null, draft());
  setTime(CONSENT_BY - 1);
  assert.equal(vote(store, initial, "A").validApprovalCount, 1);
  setTime(CONSENT_BY);
  assert.throws(() => vote(store, initial, "B"), { code: "INVALID_CONSENT" });
  setTime(CONSENT_BY - 1);
  const reopened = open();
  const expired = reopened.getVersion(ROUND, 1);
  assert.equal(expired.status, "EXPIRED");
  assert.equal(expired.canAdvance, false);
  assert.equal(expired.validApprovalCount, 0);
  assert.equal(expired.consents.length, 1);
  const renewed = reopened.freezeVersion(ROUND, 1, draft({ consentBy: CONSENT_BY + 5000 }));
  assert.equal(renewed.agreement.version, 2);
  assert.equal(renewed.validApprovalCount, 0);
});

test("T02/B03 local: la unanimidad vigente caduca en settleBy", (t) => {
  const { store, setTime } = setup(t);
  const approved = acceptAll(store, store.freezeVersion(ROUND, null, draft()));
  setTime(CONSENT_BY);
  assert.equal(store.getVersion(ROUND, 1).canAdvance, true);
  assert.throws(() => vote(store, approved, "A"), { code: "INVALID_CONSENT" });
  setTime(approved.agreement.settleBy - 1);
  assert.equal(store.getVersion(ROUND, 1).canAdvance, true);
  setTime(approved.agreement.settleBy);
  const expired = store.getVersion(ROUND, 1);
  assert.equal(expired.status, "EXPIRED");
  assert.equal(expired.canAdvance, false);
  assert.equal(expired.validApprovalCount, 0);
  assert.equal(expired.consents.length, 4);
});

test("T02: el neto cero exige unanimidad y no habilita el avance a preparación", (t) => {
  const { store } = setup(t);
  const initial = store.freezeVersion(ROUND, null, draft({ obligations: [] }));
  const unanimous = acceptAll(store, initial);
  assert.equal(unanimous.status, "NET_ZERO");
  assert.equal(unanimous.consents.length, 4);
  assert.equal(unanimous.canAdvance, false);
});

test("T02: una sola ronda activa y conservación del historial al cerrar", (t) => {
  const { store, open } = setup(t);
  const view = store.freezeVersion(ROUND, null, draft());
  vote(store, view, "A");
  const reopened = open();
  assert.throws(() => reopened.createRound("ronda-siguiente"), { code: "ROUND_ACTIVE" });
  assert.throws(() => reopened.closeRound(ROUND, null), { code: "VERSION_CONFLICT" });
  reopened.closeRound(ROUND, 1);
  reopened.createRound("ronda-siguiente");
  assert.equal(store.getVersion(ROUND, 1).status, "CANCELLED");
  assert.equal(store.getVersion(ROUND, 1).consents.length, 1);
  assert.throws(() => vote(store, view, "A"), { code: "INVALID_CONSENT" });
});
