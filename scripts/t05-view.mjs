import { explorerUrl, fixture, formatXlm, netting, observedResults } from "./t05-data.mjs";
import { simulateIndependentPayments } from "./b05.mjs";

export const cases = {
  "b04-pendiente": "B04 · Verificando",
  "b04-recuperado": "B04 · Recuperado",
  "b01-exito": "B01 · Éxito",
  "b02-fallo": "B02 · Fallo",
  "firma-pendiente": "Falta la firma de B",
  "c-rechaza": "C rechaza",
};

const statuses = {
  RECONCILING: ["Verificando en Stellar", "El resultado aún no se conoce. Consulta el mismo hash. Evita volver a enviar.", "pending"],
  SUBMITTED: ["Envío iniciado", "El intento está guardado. Espera la verificación por el mismo hash.", "pending"],
  SETTLED: ["Liquidación confirmada", "El resultado verificado por hash confirma la aplicación conjunta.", "success"],
  FAILED: ["Liquidación fallida", "El resultado verificado por hash registra un fallo. Ningún pago de la ronda se aplicó.", "failure"],
  REJECTED: ["Acuerdo rechazado", "La ronda queda bloqueada por falta de unanimidad.", "failure"],
  APPROVED: ["Acuerdo aprobado", "El diario todavía no registra un intento.", "pending"],
  PENDING_CONSENT: ["Consentimiento pendiente", "La misma versión requiere la aprobación de todos los participantes.", "pending"],
  NET_ZERO: ["Ronda sin pagos", "El acuerdo tiene neto cero y se completa sin enviar una transacción.", "success"],
  EXPIRED: ["Acuerdo vencido", "La vigencia de esta versión terminó.", "failure"],
  SUPERSEDED: ["Versión reemplazada", "Revisa la versión vigente del acuerdo.", "failure"],
  CANCELLED: ["Acuerdo cancelado", "La versión quedó cancelada.", "failure"],
};

const escape = (value) => String(value).replace(/[&<>"']/g, (char) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
const amount = (value) => `${formatXlm(value)} XLM`;

export function demoView(selected, evidence = observedResults()) {
  const { success, failure, recovery } = evidence;
  const base = { ...fixture, ...netting, transactionSourceId: "A", version: 1, case: selected };
  const record = { "b01-exito": success, "b02-fallo": failure, "b04-pendiente": recovery, "b04-recuperado": recovery }[selected];
  if (record) {
    const pending = selected === "b04-pendiente";
    return {
      ...base, origin: pending ? "Reproducción del estado observado · B04" : "Evidencia archivada · Stellar testnet",
      agreementHash: null, consents: fixture.participants.map((id) => [id, "ACCEPT"]), signatures: "reserved",
      result: {
        state: pending ? recovery.recovery.previousState : record.settlementState ?? recovery.recovery.state,
        hash: record.hash, feeAtomic: pending ? null : record.feeAtomic, ledger: pending ? null : record.ledger,
        codes: pending ? null : record.resultCodes, detail: null,
      },
    };
  }
  return {
    ...base, origin: "Escenario de práctica · Simulación local", agreementHash: null,
    consents: fixture.participants.map((id) => [id, selected === "c-rechaza" && id === "C" ? "REJECT" : "ACCEPT"]),
    signatures: selected === "firma-pendiente" ? "missing-b" : "blocked",
    result: { state: selected === "c-rechaza" ? "REJECTED" : "APPROVED" },
  };
}

export function journalView({ view, attempt }) {
  return {
    ...view.agreement, origin: "Diario de conciliación · SQLite local", agreementHash: view.hash,
    consents: view.consents.map(({ participantId, decision }) => [participantId, decision]),
    signatures: attempt ? "reserved" : view.status === "REJECTED" ? "blocked" : "unrecorded",
    result: {
      state: attempt?.state ?? view.status, hash: attempt?.transactionHash, ledger: attempt?.ledger,
      feeAtomic: attempt?.feeAtomic, detail: attempt?.detail,
    },
  };
}

function table(headers, rows) {
  return `<div class="table-wrap"><table><thead><tr>${headers.map((header) =>
    `<th scope="col">${escape(header)}</th>`).join("")}</tr></thead><tbody>${rows.map((row) =>
    `<tr>${row.map((cell) => `<td>${escape(cell)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
}

function section(id, title, content) {
  return `<section id="${id}" class="panel"><h2>${title}</h2>${content}</section>`;
}

function controls(model, participant) {
  return `<form method="get" action="/" class="controls">
    ${model.case ? `<label>Escenario<select name="caso">${Object.entries(cases).map(([id, label]) =>
      `<option value="${id}"${id === model.case ? " selected" : ""}>${escape(label)}</option>`).join("")}</select></label>` : ""}
    <label>Ver como<select name="empresa">${model.participants.map((id) =>
      `<option${id === participant ? " selected" : ""} value="${escape(id)}">Empresa ${escape(id)}</option>`).join("")}</select></label>
    <button type="submit">Ver escenario</button>
  </form>`;
}

function signatureStatus(model, id, required) {
  if (!required.has(id)) return "No firma el pago";
  if (model.signatures === "reserved") return "Firma en el intento";
  if (model.signatures === "missing-b") return id === "B" ? "Pendiente" : "Registrada";
  return model.signatures === "blocked" ? "Bloqueada" : "No registrada en el diario";
}

function authorizationSummary(model) {
  if (model.signatures === "missing-b") return "Falta la firma de B sobre el mismo cuerpo. La ronda aún no se puede enviar.";
  if (model.result.state === "REJECTED") return "El rechazo impide preparar el envío de esta versión.";
  return "Cada empresa consiente la versión. Las cuentas fuente firman el sobre por separado.";
}

function comparison(caseId, participant) {
  const independent = simulateIndependentPayments(true);
  const visible = BigInt(independent.paymentDeltasAtomic[participant]);
  const detail = participant === "C"
    ? "Si A paga primero, C puede ver 20 XLM ya abonados aunque B siga pendiente. En Stellar los tres pagos se aplican juntos. Mientras se verifica el hash, C todavía no sabe el resultado."
    : `Si A paga primero y B falla, el movimiento neto de la empresa ${escape(participant)} es ${amount(visible)} en la simulación. En Stellar los tres pagos se aplican juntos.`;
  return `<aside class="comparison"><h3>Si A paga antes que B</h3><p>${detail}</p>
    <p><strong>Transferencias independientes · Simulación B05</strong><br>2 de 3 pagos aplicados. La ronda queda parcial y solo queda por recuperar la instrucción de B.</p>
    ${caseId === "b02-fallo" ? "<p><strong>Stellar · B02 archivado</strong><br>0 de 3 pagos aplicados.</p>" : ""}</aside>`;
}

export function renderView(model, participant) {
  const { state, hash, ledger, feeAtomic, detail, codes } = model.result;
  const [title, message, tone] = statuses[state];
  const who = escape(participant);
  const personal = model.balances.find(({ participantId }) => participantId === participant).amountAtomic;
  const required = new Set(model.payments.map(({ debtorId }) => debtorId));
  if (model.payments.length) required.add(model.transactionSourceId);
  const vote = new Map(model.consents);
  const gross = BigInt(model.grossAtomic);
  const basisPoints = gross ? (gross - BigInt(model.residualAtomic)) * 10_000n / gross : 0n;
  const reduction = `${basisPoints / 100n},${(basisPoints % 100n).toString().padStart(2, "0")}`;
  const link = ledger && explorerUrl(hash);
  const settlementNote = model.case === "b04-pendiente"
    ? '<p>Esta etapa reproduce el estado anterior a la recuperación. <a href="/?caso=b04-recuperado&amp;empresa=' + encodeURIComponent(participant) + '">Ver recuperación con el mismo hash</a>.</p>' : "";
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
  <title>CuyNexo · Revisión de ronda</title><link rel="stylesheet" href="/estilos.css"></head><body>
  <header class="masthead"><div class="brand"><img src="/logo.png" alt="" width="44" height="44"><strong>CuyNexo</strong></div>
  <nav aria-label="Secciones"><a href="#obligaciones">Obligaciones</a><a href="#acuerdo">Acuerdo</a><a href="#autorizaciones">Autorizaciones</a><a href="#resultado">Resultado</a></nav></header>
  <main>
  <div class="intro"><p class="source">${escape(model.origin)}</p><h1>Revisión de ronda</h1>
  <p>Datos sintéticos · Versión ${escape(model.version)}</p>${controls(model, participant)}</div>
  <div class="summary"><div><span>Obligaciones brutas</span><strong>${amount(model.grossAtomic)}</strong></div>
  <div><span>Pagos tras el neteo</span><strong>${amount(model.residualAtomic)}</strong><small>${reduction} % menos volumen</small></div>
  <div><span>Saldo neto de la empresa ${who}</span><strong>${amount(personal)}</strong><small>${BigInt(personal) < 0n ? "Por pagar" : BigInt(personal) > 0n ? "Por recibir" : "Sin pagos"}</small></div></div>
  <div class="sections">
  ${section("obligaciones", "Obligaciones", table(["ID", "Deudor", "Acreedor", "Importe"], model.obligations.map((item) =>
    [item.obligationId, item.debtorId, item.creditorId, amount(item.amountAtomic)])))}
  ${section("acuerdo", "Acuerdo", `<p>Saldos y pagos de la versión ${escape(model.version)}. Selecciona tu empresa para identificar su importe.</p>
    ${model.agreementHash ? `<p>Hash del acuerdo <code>${escape(model.agreementHash)}</code></p>` : ""}
    ${table(["Empresa", "Saldo neto"], model.balances.map((item) => [item.participantId, amount(item.amountAtomic)]))}
    <h3>Pagos residuales</h3>${table(["Origen", "Destino", "Importe"], model.payments.map((item) => [item.debtorId, item.creditorId, amount(item.amountAtomic)]))}`)}
  ${section("autorizaciones", "Autorizaciones", `<p>${authorizationSummary(model)}</p>
    ${table(["Empresa", "Consentimiento", "Firma del pago"], model.participants.map((id) =>
      [id, ({ ACCEPT: "Aceptó", REJECT: "Rechazó" })[vote.get(id)] ?? "Pendiente", signatureStatus(model, id, required)]))}
    ${model.payments.length ? `<p>La empresa ${escape(model.transactionSourceId)} es la cuenta fuente y asume la comisión de la transacción.</p>` : ""}
    ${model.case ? "<p>Los consentimientos y roles ilustran el guion del caso base.</p>" : ""}`)}
  ${section("resultado", "Resultado", `<div class="state ${tone}" role="status"><code>${state}</code><h3>${title}</h3><p>${message}</p></div>
    ${state === "SETTLED" || state === "FAILED" ? `<p>Pagos aplicados: ${state === "SETTLED" ? model.payments.length : 0} de ${model.payments.length}.</p>` : ""}
    ${hash ? `<p>Hash de la transacción <code>${escape(hash)}</code></p>` : ""}
    ${ledger ? `<p>Ledger ${escape(ledger)}${link ? ` · <a href="${link}">Ver en el explorador</a>` : ""}</p>` : ""}
    ${feeAtomic != null ? `<p>Comisión registrada: ${escape(feeAtomic)} stroops (${amount(feeAtomic)}).</p>` : ""}
    ${codes?.operations?.includes("op_underfunded") ? "<p>Motivo: saldo insuficiente de B para el tercer pago (<code>op_underfunded</code>).</p>"
      : state === "FAILED" ? "<p>El diario guarda el fallo confirmado. El código de operación no está disponible en esta vista.</p>" : ""}
    ${detail === "LEDGER_MISMATCH" ? "<p>La evidencia de red no coincide con el intento guardado.</p>" : ""}
    ${settlementNote}
    ${model.case ? comparison(model.case, participant) : ""}`)}
  </div></main><footer>Vista local de revisión · Consentimientos, firmas y verificación mediante el flujo del coordinador</footer>
  </body></html>`;
}
