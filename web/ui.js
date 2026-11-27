"use strict";
const el = (id) => document.getElementById(id);
const net = "Test SDF Network ; September 2015";
let state = {};
async function api(action, body = {}) {
  const r = await fetch("/" + action, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const value = await r.json();
  if (!r.ok) throw Error(value.error);
  return value;
}
function amount(value) {
  const digits = String(value).replace("-", "").padStart(8, "0");
  return (
    (String(value).startsWith("-") ? "-" : "") +
    (digits.slice(0, -7) + "." + digits.slice(-7)).replace(/\.?0+$/, "")
  );
}
function describe(a) {
  return [
    "Bruto " +
      amount(a.grossAtomic) +
      " XLM · Residual " +
      amount(a.residualAtomic) +
      " XLM",
    ...a.balances.map(
      (x) => x.participantId + " " + amount(x.amountAtomic) + " XLM",
    ),
    ...a.payments.map(
      (x) =>
        x.debtorId +
        " → " +
        x.creditorId +
        " " +
        amount(x.amountAtomic) +
        " XLM",
    ),
  ].join("\n");
}
const stages = ["ob", "ac", "au", "re"];
function route() {
  const step = stages.includes(location.hash.slice(1))
    ? location.hash.slice(1)
    : "ob";
  for (const id of stages) {
    el(id).hidden = id !== step;
    document
      .querySelector('a[href="#' + id + '"]')
      .toggleAttribute("aria-current", id === step);
  }
}
window.addEventListener("hashchange", () => {
  route();
  if (state.actor) refresh().catch(showError);
});
const labels = {
  PENDING_CONSENT: "Pendiente de decisiones",
  APPROVED: "Acuerdo aprobado",
  REJECTED: "Versión bloqueada por rechazo",
  EXPIRED: "Versión vencida",
  CANCELLED: "Versión cancelada",
  SUPERSEDED: "Versión sustituida",
  NET_ZERO: "Acuerdo completado · No hay pagos por hacer",
  SUBMITTED: "Verificando",
  RECONCILING: "Verificando",
  SETTLED: "Resultado confirmado",
  FAILED: "Fallo conjunto confirmado",
};
let preview = null,
  draftBase = null,
  editing = false,
  obligations = [],
  serial = 0;
function draw() {
  const s = state,
    a = s.agreement,
    admin = s.actor === "coordinator",
    person = s.actor === "participant",
    attempt = s.attempt;
  const sim = s.transport === "simulation",
    prefix = sim ? "Simulación · " : "";
  const now = Date.now(),
    expiredSign = s.maxTime && now >= s.maxTime * 1000;
  const deadline =
    !attempt &&
    a &&
    (s.status === "EXPIRED"
      ? s.votes.filter((v) => v.decision === "ACCEPT").length ===
        a.participants.length
        ? "Plazo para liquidar vencido"
        : "Plazo para decidir vencido"
      : s.status === "APPROVED" && expiredSign
        ? "Plazo para firmar vencido"
        : "");
  const missing = (s.required ?? []).filter(
    (id) => !s.signers.includes(a.accounts[id]),
  );
  const waiting = missing.length
    ? "Falta la firma de " + missing.join(" y ")
    : s.transactionHash
      ? "Firmas de pago completas"
      : "Pendiente de preparar los pagos";
  const status = labels[attempt?.state ?? s.status] ?? "Sin versión congelada";
  el("identity").textContent = admin
    ? "Coordinador"
    : person
      ? "Empresa " + s.id
      : "Sin sesión";
  if (s.actor)
    document.querySelectorAll("#access dialog[open]").forEach((d) => d.close());
  el("access").hidden = !!s.actor;
  el("workspace").hidden = el("logout").hidden = !s.actor;
  const draft = admin && (!a || editing);
  el("editor").hidden = !draft;
  el("setup").hidden = !draft || !preview;
  const figures = draft ? preview : a;
  el("metrics").hidden = !figures;
  if (figures) {
    el("gross").textContent = amount(figures.grossAtomic) + " XLM";
    el("residual").textContent = amount(figures.residualAtomic) + " XLM";
    el("count").textContent = figures.balances.length;
  }
  const blocked =
    !!deadline ||
    ["CANCELLED", "SUPERSEDED", "REJECTED", "EXPIRED"].includes(s.status);
  let next = "Carga las obligaciones y calcula el acuerdo.";
  if (preview && draft)
    next =
      "Revisa los importes en Acuerdo, vincula las direcciones y congela la versión.";
  else if (blocked)
    next =
      (deadline || status) +
      " · " +
      (admin
        ? "Puedes preparar una nueva versión."
        : "Espera la nueva versión del coordinador.");
  else if (attempt)
    next =
      attempt.state === "RECONCILING"
        ? "Verifica el mismo intento en Resultado."
        : "Consulta el resultado y el expediente.";
  else if (s.status === "NET_ZERO") next = labels.NET_ZERO;
  else if (s.status === "PENDING_CONSENT")
    next =
      person && !s.votes.some((v) => v.participantId === s.id)
        ? "Revisa tu importe y acepta o rechaza en Acuerdo."
        : "Espera las decisiones pendientes en Acuerdo.";
  else if (s.status === "APPROVED")
    next = !s.transactionHash
      ? admin
        ? "Prepara los pagos en Autorizaciones."
        : "Espera que el coordinador prepare los pagos."
      : missing.length
        ? missing.includes(s.id)
          ? "Falta tu firma. Revisa los pagos en Autorizaciones."
          : waiting
        : admin
          ? "Envía el intento desde Resultado."
          : "Espera el envío del coordinador.";
  el("nextAction").textContent = next;
  el("summary").textContent = draft
    ? preview
      ? describe(preview)
      : ""
    : a
      ? [
          "Aquí consultas las obligaciones de tu ronda.",
          ...a.obligations.map(
            (o) =>
              o.obligationId +
              " · " +
              o.debtorId +
              " → " +
              o.creditorId +
              " · " +
              amount(o.amountAtomic) +
              " XLM",
          ),
          describe(a),
        ].join("\n")
      : "";
  const time = (t) => (t ? new Date(t).toLocaleString("es-PE") : "Sin dato");
  el("agreement").textContent = a
    ? [
        "Versión " + a.version + " · " + status,
        deadline,
        "Plazo para decidir · " + time(a.consentBy),
        "Plazo para liquidar · " + time(a.settleBy),
        s.votes.length + " de " + a.participants.length + " decisiones",
        ...a.participants.map(
          (id) =>
            id +
            " · " +
            ({ ACCEPT: "Aceptó", REJECT: "Rechazó" }[
              s.votes.find((v) => v.participantId === id)?.decision
            ] ?? "Pendiente"),
        ),
      ]
        .filter(Boolean)
        .join("\n")
    : preview
      ? describe(preview)
      : status;
  el("detail").textContent = a
    ? [
        "Ronda " + a.roundId,
        "Huella de la versión " + s.hash,
        describe(a),
        ...Object.entries(a.accounts).map(([id, addr]) => id + " · " + addr),
      ].join("\n")
    : "Sin versión";
  const rows =
    s.evidence?.companies.filter((x) => admin || x.id === s.id) ?? [];
  el("impact").textContent = rows
    .map(
      (x) =>
        "Empresa " +
        x.id +
        " · Por pagar " +
        amount(x.pay) +
        " XLM · Por recibir " +
        amount(x.receive) +
        " XLM" +
        (x.plannedFeePayer
          ? " · Comisión prevista: " +
            (s.evidence.plannedFeeAtomic == null
              ? "importe pendiente"
              : amount(s.evidence.plannedFeeAtomic) + " XLM")
          : ""),
    )
    .join("\n");
  const expected = rows
    .map((x) =>
      BigInt(x.receive) > 0n
        ? "Por recibir: " + amount(x.receive) + " XLM"
        : "Por pagar: " + amount(x.pay) + " XLM",
    )
    .join(" · ");
  el("auth").textContent = a
    ? [
        deadline || status,
        person ? expected : "",
        a.payments.length
          ? s.transactionHash
            ? s.required.length -
              missing.length +
              " de " +
              s.required.length +
              " firmas de pago · " +
              waiting
            : s.status === "APPROVED"
              ? "El coordinador puede preparar los pagos."
              : blocked
                ? "Firmas bloqueadas para esta versión."
                : "Se requieren las decisiones de todas las empresas antes de firmar los pagos."
          : "Sin pagos por firmar",
        "Plazo para firmar · " + time(s.maxTime * 1000),
      ]
        .filter(Boolean)
        .join("\n")
    : "Sin versión";
  el("result").textContent = [
    prefix + (deadline || status),
    attempt ? "Intento · " + attempt.transactionHash : "Sin recibo de pago",
    !blocked && !attempt && a?.payments.length ? waiting : "",
    person && !blocked && !attempt ? expected : "",
    person && ["FAILED", "SETTLED"].includes(attempt?.state)
      ? rows
          .map(
            (x) =>
              "Pagado: " +
              amount(x.paid) +
              " XLM · Recibido: " +
              amount(x.received) +
              " XLM",
          )
          .join("")
      : "",
    attempt?.state === "RECONCILING"
      ? "El resultado aún no se conoce. Verifica este mismo intento."
      : "",
  ]
    .filter(Boolean)
    .join("\n");
  const xlm = (n) => (n == null ? "Sin dato" : amount(n) + " XLM");
  const e = s.evidence;
  el("verified").textContent = e
    ? [
        prefix + "Efecto por empresa",
        ...rows.map(
          (x) =>
            x.id +
            " · pagado " +
            xlm(x.paid) +
            " · recibido " +
            xlm(x.received) +
            " · comisión " +
            xlm(x.feeAtomic) +
            "\nSaldo antes " +
            xlm(x.before?.amountAtomic) +
            " · después " +
            xlm(x.after?.amountAtomic),
        ),
        "Comisión total · " +
          xlm(e.feeAtomic) +
          " · Cuenta: " +
          (e.feeAccount ?? "Sin dato"),
        "Ledger · " + (e.ledger ?? "Sin dato"),
        "Tiempo hasta observar la confirmación · " +
          (e.elapsedMs == null ? "Sin dato" : e.elapsedMs + " ms"),
        ...(e.operations ?? []).map(
          (o) =>
            o.source +
            " → " +
            o.destination +
            " · " +
            o.amountXlm +
            " XLM · " +
            (o.applied ? "Aplicada" : "Sin aplicar"),
        ),
      ].join("\n")
    : "Sin dato";
  for (const id of stages)
    el(id).querySelector("h2").dataset.origin = s.actor
      ? sim
        ? "Simulación"
        : "Testnet"
      : "";
  function control(id, visible, enabled = visible) {
    el(id).hidden = !visible;
    el(id).disabled = !enabled;
  }
  control(
    "accept",
    person,
    person &&
      s.status === "PENDING_CONSENT" &&
      !s.votes.some((v) => v.participantId === s.id),
  );
  control("reject", person, !el("accept").disabled);
  control(
    "prepare",
    admin,
    admin && s.status === "APPROVED" && !s.transactionHash,
  );
  control(
    "partial",
    person && s.required?.includes(s.id),
    s.status === "APPROVED" && !deadline && !attempt && missing.includes(s.id),
  );
  control(
    "submit",
    admin,
    admin &&
      s.status === "APPROVED" &&
      !deadline &&
      !!s.transactionHash &&
      !missing.length &&
      !attempt,
  );
  control("lookup", !!attempt);
  control(
    "retry",
    admin &&
      attempt?.state === "RECONCILING" &&
      attempt.detail === "UNCONFIRMED" &&
      !expiredSign &&
      now < a.settleBy,
  );
  control(
    "cancel",
    admin &&
      !!a &&
      !attempt &&
      ["APPROVED", "PENDING_CONSENT"].includes(s.status),
  );
  control("newVersion", admin && !!a && !editing && !attempt);
  el("evidencePreview").textContent = e
    ? [
        prefix + "Versión " + a.version,
        status,
        s.votes.length +
          " decisiones · " +
          s.signers.length +
          " firmas de pago",
        attempt ? "Intento " + attempt.transactionHash : "Sin envío",
      ].join("\n")
    : "Sin expediente";
  control("download", !!e);
  route();
}
function showError(e) {
  el("notice").textContent = e.message;
  const alert = document.querySelector('#access dialog[open] [role="alert"]');
  if (alert) alert.textContent = e.message;
}
let requestId = 0;
async function refresh() {
  const n = ++requestId;
  try {
    const next = await api("state");
    if (n !== requestId) return;
    state = next;
    draw();
  } catch (e) {
    if (n !== requestId) return;
    if (["Se requiere sesión", "Cuenta modificada"].includes(e.message)) {
      state = {};
      resetDraft();
      draw();
    }
    throw e;
  }
}
async function account() {
  if (!window.freighterApi) throw Error("Cliente Varial no disponible");
  const r = await freighterApi.requestAccess();
  if (r.error || !r.address)
    throw Error("Acceso cancelado o cuenta de Varial no disponible");
  const n = await freighterApi.getNetwork();
  if (n.error || n.networkPassphrase !== net)
    throw Error("Conecta la cuenta de prueba en Testnet");
  if (state.address && state.address !== r.address) {
    await api("logout");
    ++requestId;
    state = {};
    resetDraft();
    draw();
    throw Error("Cuenta modificada. Identifícate de nuevo");
  }
  return r.address;
}
async function signMessage(message, address) {
  const r = await freighterApi.signMessage(message, {
    address,
    networkPassphrase: net,
  });
  if (r.error || r.signerAddress !== address)
    throw Error("Firma cancelada o cuenta incorrecta");
  return r.signedMessage;
}
function action(id, fn) {
  el(id).onclick = async () => {
    try {
      el("notice").textContent = "";
      await fn();
    } catch (e) {
      el("notice").textContent = e.message;
      const alert = document.querySelector(
        '#access dialog[open] [role="alert"]',
      );
      if (alert) alert.textContent = e.message;
    }
  };
}
action("admin", async () => {
  await api("admin", { code: el("code").value });
  el("code").value = "";
  await refresh();
});
action("logout", async () => {
  await api("logout");
  ++requestId;
  state = {};
  resetDraft();
  draw();
});
action("login", async () => {
  const address = await account(),
    id = el("company").value.trim();
  const c = await api("challenge", { id, address });
  await api("login", {
    nonce: c.nonce,
    signature: await signMessage(c.message, address),
  });
  await refresh();
});
function members() {
  return el("members")
    .value.split(",")
    .map((x) => x.trim());
}
function input() {
  return { participants: members(), obligations };
}
function options(select, ids) {
  select.replaceChildren(...ids.map((id) => new Option(id, id)));
}
function addresses() {
  return Object.fromEntries(
    Array.from(el("accounts").querySelectorAll("input"), (i) => [
      i.dataset.id,
      i.value.trim(),
    ]),
  );
}
function bindings(values = {}, source) {
  const ids = members();
  options(el("source"), ids);
  if (ids.includes(source)) el("source").value = source;
  el("accounts").replaceChildren(
    ...ids.map((id) => {
      const label = document.createElement("label"),
        field = document.createElement("input");
      label.textContent = "Dirección de prueba · " + id;
      field.dataset.id = id;
      field.value = Object.hasOwn(values, id) ? values[id] : "";
      label.append(field);
      return label;
    }),
  );
}
function renderRows() {
  el("rows").replaceChildren();
  if (!obligations.length)
    el("rows").textContent = "Todavía no hay obligaciones.";
  obligations.forEach((row, index) => {
    const line = document.createElement("p");
    line.textContent =
      row.obligationId +
      " · " +
      row.debtorId +
      " → " +
      row.creditorId +
      " · " +
      amount(row.amountAtomic) +
      " XLM ";
    for (const [label, fn] of [
      ["Editar", () => editRow(index)],
      [
        "Quitar",
        () => {
          if (confirm("¿Quitar " + row.obligationId + "?")) {
            obligations.splice(index, 1);
            changed();
          }
        },
      ],
    ]) {
      const button = document.createElement("button");
      button.textContent = label;
      button.onclick = fn;
      line.append(button);
    }
    el("rows").append(line);
  });
}
function changed() {
  preview = null;
  renderRows();
  draw();
}
function resetDraft() {
  preview = null;
  editing = false;
  draftBase = null;
  obligations = [];
  el("members").value = "A, B, C";
  bindings();
  renderRows();
}
let rowIndex;
function editRow(index) {
  rowIndex = index;
  const row = obligations[index],
    ids = members();
  for (const id of ["from", "to"]) options(el(id), ids);
  el("from").value = row?.debtorId ?? ids[0];
  el("to").value = row?.creditorId ?? ids[1];
  el("value").value = row ? amount(row.amountAtomic) : "";
  el("rowError").textContent = "";
  el("rowDialog").showModal();
}
el("members").oninput = changed;
el("add").onclick = () => editRow(-1);
el("back").onclick = () => el("rowDialog").close();
el("rowForm").onsubmit = async (event) => {
  event.preventDefault();
  const v = el("value").value.trim().replace(",", "."),
    error = el("rowError");
  if (!/^\d+(?:\.\d{1,7})?$/.test(v)) {
    error.textContent =
      "Ingresa un importe positivo con hasta siete decimales.";
    return;
  }
  const [whole, frac = ""] = v.split("."),
    atomic = BigInt(whole + frac.padEnd(7, "0"));
  if (atomic === 0n || el("from").value === el("to").value) {
    error.textContent =
      "El importe debe ser positivo y las empresas distintas.";
    return;
  }
  let id = obligations[rowIndex]?.obligationId;
  if (!id) {
    do {
      id = "O" + ++serial;
    } while (obligations.some((o) => o.obligationId === id));
  }
  const next = obligations.slice();
  next[rowIndex < 0 ? next.length : rowIndex] = {
    obligationId: id,
    debtorId: el("from").value,
    creditorId: el("to").value,
    amountAtomic: String(atomic),
  };
  try {
    await api("calculate", {
      input: { participants: members(), obligations: next },
    });
    obligations = next;
    el("rowDialog").close();
    changed();
  } catch (e) {
    error.textContent = e.message;
  }
};
action("fixture", async () => {
  const f = await (await fetch("/fixture.json")).json();
  el("members").value = f.participants.join(", ");
  obligations = f.obligations;
  bindings();
  changed();
});
action("newVersion", async () => {
  if (
    !confirm(
      "¿Preparar una nueva versión? La vigente se conserva hasta congelar la nueva.",
    )
  )
    return;
  const a = state.agreement;
  editing = true;
  draftBase = state.hash;
  el("members").value = a.participants.join(", ");
  obligations = a.obligations.slice();
  bindings(a.accounts, a.transactionSourceId);
  changed();
  location.hash = "ob";
});
action("calculate", async () => {
  preview = await api("calculate", { input: input() });
  bindings(addresses(), el("source").value);
  draw();
  location.hash = "ac";
});
action("freeze", async () => {
  await api("freeze", {
    previous: draftBase,
    input: {
      ...input(),
      accounts: addresses(),
      transactionSourceId: el("source").value,
      consentBy: Date.now() + Number(el("minutes").value) * 60000,
    },
  });
  resetDraft();
  await refresh();
});
for (const [id, decision] of [
  ["accept", "ACCEPT"],
  ["reject", "REJECT"],
])
  action(id, async () => {
    const hash = state.hash;
    if (
      !confirm(
        (decision === "ACCEPT" ? "Confirmar aceptación" : "Confirmar rechazo") +
          " de la versión " +
          state.agreement.version +
          " · " +
          el("impact").textContent +
          " · La firma del pago viene después.",
      )
    )
      return;
    const address = await account(),
      { message } = await api("message", { hash, decision });
    await api("vote", {
      hash,
      decision,
      signature: await signMessage(message, address),
    });
    await refresh();
  });
action("partial", async () => {
  const hash = state.hash,
    unsignedXdr = state.unsignedXdr;
  if (
    !confirm(
      "¿Firmar los pagos de la versión " +
        state.agreement.version +
        "? " +
        el("impact").textContent,
    )
  )
    return;
  const address = await account();
  const r = await freighterApi.signTransaction(unsignedXdr, {
    address,
    networkPassphrase: net,
  });
  if (r.error || r.signerAddress !== address)
    throw Error("Firma cancelada o cuenta incorrecta");
  await api("partial", { hash, xdr: r.signedTxXdr });
  await refresh();
});
for (const id of ["prepare", "submit", "lookup", "retry"])
  action(id, async () => {
    if (
      id === "retry" &&
      !confirm("¿Retransmitir exactamente el mismo intento?")
    )
      return;
    await api(id, { hash: state.hash });
    await refresh();
  });
action("refresh", refresh);
resetDraft();
draw();
refresh().catch(() => {});

action("cancel", async () => {
  if (!window.confirm("¿Cancelar esta versión y bloquear sus firmas y envío?"))
    return;
  await api("cancel", { hash: state.hash });
  await refresh();
});
action("download", async () => {
  const report = await api("export", { hash: state.hash });
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(report, null, 2)], { type: "application/json" }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = "CuyNexo-" + report.agreementHash + ".json";
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
});

function archive(title, description) {
  el("archiveTitle").textContent = title;
  el("archiveText").textContent = description;
  el("archiveIndex").hidden = true;
  el("archivePanel").hidden = false;
}
action("w01", async () =>
  archive(
    "W01 · Ronda anterior en Stellar testnet",
    "26 de noviembre de 2026 · Varial 5.53.1. Cuatro empresas aceptaron la misma versión. A y B firmaron los tres pagos por 60 XLM de prueba. Ledger 5938099 · Comisión 0.00003 XLM. Hash 6ab275cabda0b3d9c5154dfba56d3c485c03f75b115548d3582dfc12343e9c6e.",
  ),
);
action("b05", async () => {
  const b = await (await fetch("/b05.json")).json();
  archive(
    "B05 · Comparación archivada",
    "Fallo conjunto observado en testnet: " +
      b.observed.failure.appliedOperations +
      " pagos aplicados. En la comparación simulada con transferencias independientes se aplicaron " +
      b.simulated.failure.appliedOperations +
      " pagos y C recibió " +
      amount(b.simulated.failure.paymentDeltasAtomic.C) +
      " XLM simulados.",
  );
});
function closeArchive() {
  el("archiveIndex").hidden = false;
  el("archivePanel").hidden = true;
}
el("archiveBack").onclick = closeArchive;
el("roundBack").onclick = () => {
  closeArchive();
  el("roundBack").closest("details").open = false;
};
setInterval(() => {
  if (state.actor && !document.hidden) refresh().catch(showError);
}, 10000);

for (const [trigger, id] of [
  ["openAdmin", "adminDialog"],
  ["openCompany", "companyDialog"],
]) {
  const dialog = el(id);
  el(trigger).onclick = () => {
    dialog.querySelector('[role="alert"]').textContent = "";
    dialog.showModal();
  };
  dialog.querySelector(".back").onclick = () => dialog.close();
}
