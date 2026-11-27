import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { parseArgs } from "node:util";
import { pathToFileURL } from "node:url";
import { AgreementStore } from "../dist/agreements.js";
import { cases, demoView, journalView, renderView } from "./t05-view.mjs";
import { observedResults } from "./t05-data.mjs";

const assets = new Map([
  ["/estilos.css", ["text/css; charset=utf-8", new URL("../web/t05.css", import.meta.url)]],
  ["/logo.png", ["image/png", new URL("../assets/logo/4-cuynexo-logo.png", import.meta.url)]],
]);

export function createReviewServer({ readJournal, evidence = readJournal ? null : observedResults() } = {}) {
  return createServer((request, response) => {
    response.setHeader("Cache-Control", "no-store");
    response.setHeader("Content-Security-Policy", "default-src 'none'; img-src 'self'; style-src 'self'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'");
    response.setHeader("X-Content-Type-Options", "nosniff");

    if (request.method !== "GET") {
      response.writeHead(405, { Allow: "GET" }).end("Método no permitido");
      return;
    }

    try {
      const url = new URL(request.url, "http://127.0.0.1");
      const asset = assets.get(url.pathname);
      if (asset) {
        const [type, path] = asset;
        const content = readFileSync(path);
        response.writeHead(200, { "Content-Type": type }).end(content);
        return;
      }
      if (url.pathname !== "/") {
        response.writeHead(404).end("Ruta no encontrada");
        return;
      }
      const selected = url.searchParams.get("caso") ?? "b04-pendiente";
      if (!readJournal && !Object.hasOwn(cases, selected)) {
        response.writeHead(400).end("Escenario desconocido");
        return;
      }
      const model = readJournal ? journalView(readJournal()) : demoView(selected, evidence);
      const participant = url.searchParams.get("empresa") ?? (model.participants.includes("C") ? "C" : model.participants[0]);
      if (!model.participants.includes(participant)) {
        response.writeHead(400).end("Empresa desconocida");
        return;
      }
      const html = renderView(model, participant);
      response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" }).end(html);
    } catch {
      response.writeHead(500).end("No se pudo leer el escenario o el diario.");
    }
  });
}

function start() {
  const { values } = parseArgs({ options: {
    port: { type: "string", default: "4173" },
    journal: { type: "string" }, round: { type: "string" }, version: { type: "string" },
  } });
  const port = Number(values.port);
  if (!/^\d+$/.test(values.port) || port < 1 || port > 65535) throw new Error("Puerto inválido");
  if (values.journal || values.round || values.version) {
    if (!values.journal || !values.round || !/^[1-9]\d*$/.test(values.version ?? "")
      || !Number.isSafeInteger(Number(values.version))) {
      throw new Error("Indica --journal, --round y --version juntos");
    }
  }
  const store = values.journal ? new AgreementStore(values.journal, Date.now, true) : null;
  let server;
  try {
    const readJournal = store ? () => store.inspectVersion(values.round, Number(values.version)) : undefined;
    if (readJournal) readJournal();
    server = createReviewServer({ readJournal });
    if (store) server.once("close", () => store.close());
    server.listen(port, "127.0.0.1", () => console.log(`CuyNexo · http://127.0.0.1:${port}`));
  } catch (error) {
    store?.close();
    throw error;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    start();
  } catch {
    console.error("No se pudo iniciar la vista. Revisa el puerto y, si corresponde, el diario y la versión.");
    process.exitCode = 1;
  }
}
