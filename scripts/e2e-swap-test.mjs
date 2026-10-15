// One-off Playwright script pra medir a troca de carro na produção.
// Rodar: node scripts/e2e-swap-test.mjs
// Não commita — deletar depois de usar.

import { chromium } from "playwright";

const URL = process.env.E2E_URL ?? "https://reparo360.vercel.app/dashboard";
const HEADLESS = process.env.E2E_HEADFUL !== "1";

const SWAPS = [
  "Giulia",
  "A4",
  "Golf",
  "Corolla",
  "Civic",
  "Mustang",
  "Camaro",
  "Cayenne",
  "911",
  "Panamera",
];

const consoleErrors = [];
const pageErrors = [];
const glLosses = [];

function fmtMB(n) {
  if (!n) return "n/a";
  return (n / 1024 / 1024).toFixed(1) + " MB";
}

async function heap(page) {
  return await page.evaluate(() => {
    // @ts-ignore
    const m = performance.memory;
    return m ? { used: m.usedJSHeapSize, total: m.totalJSHeapSize, limit: m.jsHeapSizeLimit } : {};
  });
}

async function waitForCanvasFrame(page, timeout = 20000) {
  const start = Date.now();
  await page.waitForSelector("canvas", { timeout });
  while (Date.now() - start < timeout) {
    const drew = await page.evaluate(() => {
      const c = document.querySelector("canvas");
      if (!c) return false;
      const gl =
        c.getContext("webgl2") ??
        c.getContext("webgl") ??
        c.getContext("experimental-webgl");
      if (!gl) return false;
      // Se tem contexto WebGL vivo e canvas tem tamanho, consideramos "pronto".
      // Não dá pra pegar drawCount confiável cross-browser.
      return c.width > 0 && c.height > 0;
    });
    if (drew) return Date.now() - start;
    await page.waitForTimeout(80);
  }
  throw new Error("Canvas nunca ficou pronto");
}

(async () => {
  const browser = await chromium.launch({
    headless: HEADLESS,
    args: ["--enable-precise-memory-info"],
  });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
  });
  const page = await context.newPage();

  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });
  page.on("pageerror", (err) => pageErrors.push(err.message));
  // Detecta perda de contexto WebGL (sintoma clássico de VRAM esgotada)
  await page.exposeFunction("__reportGLLoss", (info) => glLosses.push(info));
  await page.addInitScript(() => {
    const orig = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (...args) {
      const ctx = orig.apply(this, args);
      if (ctx && (args[0] === "webgl" || args[0] === "webgl2")) {
        this.addEventListener("webglcontextlost", (e) => {
          // @ts-ignore
          window.__reportGLLoss?.({ ts: Date.now(), reason: e.statusMessage || "unknown" });
        });
      }
      return ctx;
    };
  });

  console.log(`Abrindo ${URL} ...`);
  const t0 = Date.now();
  await page.goto(URL, { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle").catch(() => {});
  console.log(`  page load: ${Date.now() - t0} ms`);

  // Pick inicial: se o modal aparecer, escolhe qualquer carro
  const hasModal = await page
    .locator("text=Escolha o seu veículo")
    .first()
    .isVisible()
    .catch(() => false);
  if (hasModal) {
    console.log("Modal de escolha detectado — pegando o primeiro carro do catálogo");
    const selects = page.locator("select");
    await selects.nth(0).selectOption({ index: 1 });
    await page.waitForTimeout(200);
    await selects.nth(1).selectOption({ index: 1 });
    await page.getByRole("button", { name: "Confirmar" }).click();
  } else {
    console.log("Sem modal — usuário já tinha carro salvo");
  }

  console.log("Esperando primeiro canvas ...");
  const firstCanvasMs = await waitForCanvasFrame(page);
  console.log(`  first canvas: ${firstCanvasMs} ms`);

  const heapAfterFirst = await heap(page);
  console.log(`  heap: ${fmtMB(heapAfterFirst.used)} / limit ${fmtMB(heapAfterFirst.limit)}`);

  // Loop de swaps
  const results = [];
  for (const q of SWAPS) {
    console.log(`\nSwap → "${q}"`);
    try {
      // Antes de abrir picker novo, espera 1s pra deixar o render do swap anterior
      // terminar. Sem isso, o main thread ocupado quebra actionability checks.
      await page.waitForTimeout(1000);

      const pickerBtn = page
        .getByRole("button")
        .filter({ hasText: /,\s*(19|20)\d{2}\s*$/ })
        .first();
      await pickerBtn.click({ force: true, timeout: 10000 });

      const search = page.getByPlaceholder(/Buscar entre/i);
      await search.waitFor({ state: "visible", timeout: 10000 });
      await search.click({ force: true }).catch(() => {});
      // Type direto pelo teclado — evita o check "editable" do fill()
      await page.keyboard.type(q, { delay: 20 });
      await page.waitForTimeout(400);

      const first = page.locator(".max-h-72 button").first();
      const exists = await first.isVisible().catch(() => false);
      if (!exists) {
        console.log(`  nenhum resultado — pulando`);
        await page.keyboard.press("Escape").catch(() => {});
        continue;
      }
      const t = Date.now();
      await first.click({ force: true });

      // Espera o canvas "estabilizar" — dá 3s pra download+parse+first render
      await page.waitForTimeout(3000);
      const swapMs = Date.now() - t;
      const h = await heap(page);
      results.push({ q, ms: swapMs, heapMB: h.used ? +(h.used / 1024 / 1024).toFixed(1) : null });
      console.log(`  swap done: ${swapMs} ms — heap ${fmtMB(h.used)} — gl-loss: ${glLosses.length}`);
    } catch (e) {
      console.log(`  ERRO: ${e.message.split("\n")[0]}`);
      results.push({ q, error: e.message.split("\n")[0] });
      // Fecha qualquer picker aberto pra próxima iteração ficar limpa
      await page.keyboard.press("Escape").catch(() => {});
      await page.waitForTimeout(500);
    }
  }

  console.log("\n=== RESUMO ===");
  console.log("Swap times:");
  for (const r of results) {
    if (r.error) console.log(`  ${r.q.padEnd(12)}  ERRO: ${r.error}`);
    else console.log(`  ${r.q.padEnd(12)}  ${String(r.ms).padStart(5)} ms   heap ${r.heapMB} MB`);
  }
  const okTimes = results.filter((r) => r.ms).map((r) => r.ms);
  if (okTimes.length) {
    const avg = okTimes.reduce((a, b) => a + b, 0) / okTimes.length;
    const max = Math.max(...okTimes);
    console.log(`\n  média ${avg.toFixed(0)} ms  |  pior ${max} ms`);
  }
  console.log(`\nConsole errors: ${consoleErrors.length}`);
  consoleErrors.slice(0, 8).forEach((e) => console.log(`  - ${e.slice(0, 200)}`));
  console.log(`Page errors: ${pageErrors.length}`);
  pageErrors.slice(0, 8).forEach((e) => console.log(`  - ${e.slice(0, 200)}`));
  console.log(`WebGL context loss events: ${glLosses.length}`);

  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
