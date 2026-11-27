import { createRequire } from "node:module";
import { createHash } from "node:crypto";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
const req = createRequire(process.cwd() + "/package.json");
const browserRequire = createRequire(
  resolve(process.env.CUYNEXO_BROWSER_TOOLS, "package.json"),
);
const { default: puppeteer } = await import(
  browserRequire.resolve("puppeteer-core")
);
const chromium = process.env.CUYNEXO_CHROME
  ? { executablePath: () => process.env.CUYNEXO_CHROME, args: ["--no-sandbox"] }
  : (await import(browserRequire.resolve("@sparticuz/chromium"))).default;
const { Keypair, Networks, TransactionBuilder } = req(
  "@stellar/stellar-sdk/base",
);
const { application } = await import(
  process.cwd() + "/scripts/operative-web.mjs"
);
const dir = mkdtempSync(join(tmpdir(), "cuy-browser-"));
let reentry;
const app = application(
  join(dir, "test.sqlite"),
  Date.now,
  "lost-response",
  undefined,
  (code) => {
    reentry = code;
  },
);
await new Promise((ok) => app.server.listen(0, "127.0.0.1", ok));
const origin = "http://127.0.0.1:" + app.server.address().port;
const browser = await puppeteer.launch({
  executablePath: await chromium.executablePath(),
  args: chromium.args.filter((a) => !a.includes("disable-web-security")),
  headless: true,
});
try {
  async function page() {
    const ctx = await browser.createBrowserContext(),
      p = await ctx.newPage();
    await p.setViewport({
      width: Number(process.env.CUYNEXO_WIDTH ?? 1440),
      height: 900,
    });
    p.on("dialog", (d) => d.accept());
    await p.goto(origin, { waitUntil: "networkidle2" });
    p.setDefaultTimeout(5000);
    return p;
  }
  const admin = await page();
  async function click(p, id, condition) {
    await p.waitForSelector("#" + id, { visible: true });
    await p.$eval("#" + id, (e) => e.scrollIntoView({ block: "center" }));
    await p.waitForFunction(
      (id) => {
        const b = document.getElementById(id),
          r = b.getBoundingClientRect();
        return b.contains(
          document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2),
        );
      },
      { timeout: 5000 },
      id,
    );
    await p.click("#" + id);
    if (condition)
      try {
        await p.waitForFunction(condition, { timeout: 5000 });
      } catch (e) {
        console.log(id, await p.$eval("#notice", (e) => e.textContent));
        throw e;
      }
  }
  const keys = Object.fromEntries(
    "ABCD".split("").map((id) => [id, Keypair.random()]),
  );
  await click(admin, "openAdmin");
  await admin.type("#code", app.code);
  await click(admin, "admin", "!document.querySelector('#editor').hidden");
  await click(
    admin,
    "fixture",
    "document.querySelector('#rows').textContent.includes('O1')",
  );
  await click(admin, "add");
  await admin.type("#value", "1.12345678");
  await admin.click("#rowForm button");
  await admin.waitForSelector("#rowError", { visible: true });
  assert.match(
    await admin.$eval("#rowError", (e) => e.textContent),
    /decimales/,
  );
  await click(admin, "back");
  await click(
    admin,
    "calculate",
    "!document.querySelector('#ac').hidden && document.querySelector('#agreement').textContent.includes('320')",
  );
  for (const [id, key] of Object.entries(keys))
    await admin.type('#accounts input[data-id="' + id + '"]', key.publicKey());
  await click(
    admin,
    "freeze",
    "document.querySelector('#agreement').textContent.includes('Pendiente de decisiones')",
  );
  await click(
    admin,
    "cancel",
    "document.querySelector('#agreement').textContent.includes('Versión cancelada')",
  );
  await click(admin, "newVersion", "!document.querySelector('#ob').hidden");
  await click(admin, "calculate", "!document.querySelector('#ac').hidden");
  await click(
    admin,
    "freeze",
    "document.querySelector('#agreement').textContent.includes('Pendiente de decisiones')",
  );
  const pages = {};
  for (const [id, k] of Object.entries(keys)) {
    const p = (pages[id] = await page());
    await p.exposeFunction("testSignMessage", (m) =>
      k
        .sign(
          createHash("sha256")
            .update("Stellar Signed Message:\n")
            .update(m)
            .digest(),
        )
        .toString("base64"),
    );
    await p.exposeFunction("testSignTx", (x) => {
      const tx = TransactionBuilder.fromXDR(x, Networks.TESTNET);
      tx.sign(k);
      return tx.toXDR();
    });
    await p.evaluate((address) => {
      window.freighterApi = {
        requestAccess: async () => ({ address }),
        getNetwork: async () => ({
          networkPassphrase: "Test SDF Network ; September 2015",
        }),
        signMessage: async (m) => ({
          signerAddress: address,
          signedMessage: await window.testSignMessage(m),
        }),
        signTransaction: async (x) => ({
          signerAddress: address,
          signedTxXdr: await window.testSignTx(x),
        }),
      };
    }, k.publicKey());
    await click(p, "openCompany");
    await p.type("#company", id);
    await click(
      p,
      "login",
      "document.querySelector('#identity').textContent.startsWith('Empresa')",
    );
    await p.click('a[href="#ac"]');
    if (id === "A") {
      await click(
        p,
        "reject",
        "document.querySelector('#agreement').textContent.includes('Versión bloqueada por rechazo')",
      );
      assert.equal(await p.$eval("#accept", (e) => e.disabled), true);
      assert.equal(await p.$eval("#reject", (e) => e.disabled), true);
      await click(
        admin,
        "refresh",
        "document.querySelector('#agreement').textContent.includes('Versión bloqueada por rechazo')",
      );
      await click(admin, "newVersion", "!document.querySelector('#ob').hidden");
      await click(admin, "calculate", "!document.querySelector('#ac').hidden");
      await click(
        admin,
        "freeze",
        "document.querySelector('#agreement').textContent.includes('Pendiente de decisiones')",
      );
      await click(p, "refresh", "!document.querySelector('#accept').disabled");
    }
    await click(p, "accept", "document.querySelector('#accept').disabled");
  }
  await admin.click('a[href="#au"]');
  await click(admin, "refresh", "!document.querySelector('#prepare').disabled");
  await click(
    admin,
    "prepare",
    "document.querySelector('#auth').textContent.includes('Plazo para firmar')",
  );
  for (const id of ["B", "A"]) {
    await pages[id].click('a[href="#au"]');
    await click(
      pages[id],
      "refresh",
      "!document.querySelector('#partial').disabled",
    );
    await click(
      pages[id],
      "partial",
      "document.querySelector('#partial').disabled",
    );
    if (id === "B") {
      await pages.C.click('a[href="#au"]');
      await click(
        pages.C,
        "refresh",
        "document.querySelector('#auth').textContent.includes('Falta la firma de A')",
      );
    }
  }
  await admin.click('a[href="#re"]');
  await click(admin, "refresh", "!document.querySelector('#submit').disabled");
  await click(
    admin,
    "submit",
    "document.querySelector('#result').textContent.includes('Verificando')",
  );
  const originalAttempt = await admin.$eval("#result", (e) => e.textContent);
  await click(admin, "logout", "!document.querySelector('#access').hidden");
  await click(admin, "openAdmin");
  await admin.type("#code", reentry);
  await click(
    admin,
    "admin",
    "document.querySelector('#workspace').hidden===false",
  );
  assert.equal(
    await admin.$eval("#result", (e) => e.textContent),
    originalAttempt,
  );
  await pages.C.click('a[href="#re"]');
  await click(
    pages.C,
    "refresh",
    "!document.querySelector('#lookup').disabled",
  );
  await click(
    pages.C,
    "lookup",
    "document.querySelector('#result').textContent.includes('Resultado confirmado')",
  );
  assert.match(
    await pages.C.$eval("#verified", (e) => e.textContent),
    /recibido 20 XLM/,
  );
  await pages.C.browserContext().setDownloadBehavior({
    policy: "allow",
    downloadPath: dir,
  });
  const download = pages.C.waitForResponse(
    (r) => r.url() === origin + "/export",
  );
  await pages.C.click("details:has(#download) summary");
  await click(pages.C, "download");
  const evidence = await (await download).json();
  const path = join(dir, "CuyNexo-" + evidence.agreementHash + ".json");
  let saved;
  for (let i = 0; i < 50; i++) {
    try {
      saved = JSON.parse(readFileSync(path, "utf8"));
      break;
    } catch {
      await new Promise((ok) => setTimeout(ok, 100));
    }
  }
  assert.deepEqual(saved, evidence);
  assert.equal(saved.operations.length, 3);
  assert.equal(saved.result, "SETTLED");
  for (const id of ["w01", "b05"]) {
    await click(pages.C, id, "!document.querySelector('#archivePanel').hidden");
    assert.match(
      await pages.C.$eval("#archiveTitle", (e) => e.textContent),
      new RegExp(id, "i"),
    );
    await click(pages.C, "archiveBack");
  }
  await click(pages.C, "roundBack");
  assert.match(
    await pages.C.$eval("#result", (e) => e.textContent),
    /Recibido: 20 XLM/,
  );
  assert.equal(await pages.C.$eval("#submit", (e) => e.hidden), true);
  assert.equal(
    await pages.C.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    true,
  );
  console.log(
    "PASS Chromium: 5 sesiones, 4 consentimientos, 2 firmas, respuesta perdida y recuperación de C. Wallet de prueba.",
  );
} finally {
  await browser.close();
  await new Promise((done) => app.server.close(done));
  rmSync(dir, { recursive: true, force: true });
}
