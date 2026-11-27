import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import { Keypair, Networks, TransactionBuilder } from "@stellar/stellar-sdk/base";
import { AgreementStore } from "../dist/agreements.js";
import { signConsent } from "../dist/consents.js";
import { SettlementCoordinator } from "../dist/settlement-coordinator.js";
import { StellarClassicAdapter } from "../dist/stellar-classic.js";
import { buildB05 } from "../scripts/b05.mjs";
import { fixture, observedResults } from "../scripts/t05-data.mjs";
import { createReviewServer } from "../scripts/t05-web.mjs";

async function serve(t, options) {
  const server = createReviewServer(options);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  return (path = "/", init) => fetch(`http://127.0.0.1:${server.address().port}${path}`, init);
}

test("T05: vista B04 reproduce RECONCILING y su recuperación con el mismo hash", async (t) => {
  const get = await serve(t);
  const pending = await (await get("/?caso=b04-pendiente&empresa=C")).text();
  for (const id of ["obligaciones", "acuerdo", "autorizaciones", "resultado"]) {
    assert.match(pending, new RegExp(`<section id="${id}"`));
  }
  const { recovery } = observedResults();
  assert.match(pending, new RegExp(recovery.hash));
  assert.match(pending, /RECONCILING/);
  assert.match(pending, /El resultado aún no se conoce/);
  assert.match(pending, /C puede ver 20 XLM ya abonados aunque B siga pendiente/);
  assert.doesNotMatch(pending, /Ver en el explorador|Comisión registrada/);
  const recovered = await (await get("/?caso=b04-recuperado&empresa=C")).text();
  assert.match(recovered, new RegExp(recovery.hash));
  assert.match(recovered, /SETTLED/);
  assert.match(recovered, /Pagos aplicados: 3 de 3/);
  assert.match(recovered, /Ledger 5922902/);
  assert.match(recovered, /Comisión registrada: 300 stroops/);
});

test("T05: distingue fallo atómico, firma pendiente y rechazo del acuerdo", async (t) => {
  const get = await serve(t);
  const failure = await (await get("/?caso=b02-fallo&empresa=B")).text();
  assert.match(failure, /FAILED/);
  assert.match(failure, /op_underfunded/);
  assert.match(failure, /Pagos aplicados: 0 de 3/);
  const missing = await (await get("/?caso=firma-pendiente&empresa=A")).text();
  assert.match(missing, /Falta la firma de B/);
  assert.match(missing, /<td>B<\/td><td>Aceptó<\/td><td>Pendiente<\/td>/);
  assert.match(missing, /<td>C<\/td><td>Aceptó<\/td><td>No firma el pago<\/td>/);
  const rejected = await (await get("/?caso=c-rechaza")).text();
  assert.match(rejected, /REJECTED/);
  assert.match(rejected, /<td>C<\/td><td>Rechazó<\/td>/);
  assert.equal((await get("/?caso=__proto__")).status, 400);
  assert.equal((await get("/?empresa=X")).status, 400);
  assert.equal((await get("/", { method: "POST" })).status, 405);
  assert.equal((await get("/estilos.css")).headers.get("content-type"), "text/css; charset=utf-8");
  assert.equal((await get("/logo.png")).headers.get("content-type"), "image/png");
});

test("T05: diario SQLite muestra el intento actual sin exportar sobre ni firmas", async (t) => {
  const directory = mkdtempSync(join(tmpdir(), "cuynexo-t05-"));
  const path = join(directory, "round.sqlite");
  const store = new AgreementStore(path);
  const reader = new AgreementStore(path, Date.now, true);
  t.after(() => { store.close(); reader.close(); rmSync(directory, { recursive: true, force: true }); });
  const keys = Object.fromEntries(fixture.participants.map((id) => [id, Keypair.random()]));
  const accounts = Object.fromEntries(fixture.participants.map((id) => [id, keys[id].publicKey()]));
  const roundId = "t05";
  store.createRound(roundId);
  const { hash } = store.freezeVersion(roundId, null, {
    ...fixture, accounts, transactionSourceId: "A", feeCapAtomic: "300", consentBy: Date.now() + 60_000,
  });
  const consents = fixture.participants.map((participantId) =>
    signConsent({ roundId, version: 1, agreementHash: hash, participantId, decision: "ACCEPT" }, keys[participantId]));
  consents.forEach((consent) => store.recordSignedConsent(consent));
  const adapter = new StellarClassicAdapter(store);
  const prepared = adapter.prepare({ roundId, version: 1, hash }, "420", "100");
  const first = adapter.attachSignature(prepared, prepared.unsignedXdr, keys.A);
  const signed = adapter.attachSignature(prepared, first, keys.B);
  const transaction = TransactionBuilder.fromXDR(signed, Networks.TESTNET);
  const transport = { submit: async () => {}, lookup: async () => { throw new Error("Not yet available"); } };
  const coordinator = new SettlementCoordinator(store, transport);
  await coordinator.submit(prepared, signed);
  const get = await serve(t, { readJournal: () => reader.inspectVersion(roundId, 1) });
  const pending = await (await get()).text();
  assert.match(pending, /Diario de conciliación/);
  assert.match(pending, /RECONCILING/);
  assert.ok(pending.includes(prepared.transactionHash));
  assert.ok(!pending.includes(signed) && !pending.includes(consents[0].signature));
  transport.lookup = async () => ({
    hash: prepared.transactionHash, successful: true, ledger_attr: 42, fee_charged: "300",
    operation_count: transaction.operations.length, envelope_xdr: signed,
  });
  await coordinator.reconcile(prepared.transactionHash);
  const settled = await (await get()).text();
  assert.match(settled, /SETTLED/);
  assert.match(settled, /Ledger 42/);
});

test("T05: consulta vencimiento sin cambiar el acuerdo persistido", (t) => {
  const directory = mkdtempSync(join(tmpdir(), "cuynexo-t05-"));
  const path = join(directory, "round.sqlite");
  let now = 100;
  const clock = () => now;
  const store = new AgreementStore(path, clock);
  const reader = new AgreementStore(path, clock, true);
  const raw = new DatabaseSync(path, { readOnly: true });
  t.after(() => { raw.close(); reader.close(); store.close(); rmSync(directory, { recursive: true, force: true }); });
  store.createRound("round");
  store.freezeVersion("round", null, { ...fixture, transactionSourceId: "A", feeCapAtomic: "300", consentBy: 200 });
  now = 200;
  assert.equal(reader.inspectVersion("round", 1).view.status, "EXPIRED");
  assert.equal(raw.prepare("SELECT status FROM agreement_versions").get().status, "PENDING_CONSENT");
});

test("B05: conserva el mismo guion y separa evidencia, simulación y datos sin medir", () => {
  const report = buildB05();
  assert.deepEqual(report.simulated.success.paymentDeltasAtomic, report.observed.success.paymentDeltasAtomic);
  assert.equal(report.observed.failure.appliedOperations, 0);
  assert.deepEqual(Object.values(report.observed.failure.paymentDeltasAtomic), ["0", "0", "0", "0"]);
  assert.equal(report.simulated.failure.appliedOperations, 2);
  assert.deepEqual(report.simulated.failure.paymentDeltasAtomic, { A: "-500000000", B: "0", C: "200000000", D: "300000000" });
  assert.equal(report.simulated.failure.transfers[2].state, "INSUFFICIENT_FUNDS");
  assert.equal(report.observed.failure.feeAtomic, "300");
  assert.equal(report.simulated.success.feeAtomic, null);
  assert.equal(report.simulated.failure.feeAtomic, null);
  assert.ok([...Object.values(report.observed), ...Object.values(report.simulated), report.recoveryObserved]
    .every(({ submitToConfirmationMs }) => submitToConfirmationMs === null));
  assert.deepEqual(JSON.parse(readFileSync(new URL("../doc/evidencia-t05/B05.json", import.meta.url))), report);
});
