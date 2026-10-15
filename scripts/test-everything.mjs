import { chromium, devices } from "playwright";

const BASE = process.env.TEST_URL ?? "https://reparo360.vercel.app";
const CPU_RATE = Number(process.env.CPU_RATE ?? "4");

const results = [];
const globalErrors = [];

async function runScenario(name, deviceProfile, cpuRate) {
  const browser = await chromium.launch();
  const context = await browser.newContext(deviceProfile);
  const page = await context.newPage();
  if (cpuRate > 1) {
    const client = await context.newCDPSession(page);
    await client.send("Emulation.setCPUThrottlingRate", { rate: cpuRate });
  }
  const errors = [];
  page.on("pageerror", (e) => errors.push({ where: name, msg: "PAGEERROR: " + String(e) }));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push({ where: name, msg: "CONSOLE.ERR: " + m.text() });
  });
  page.on("requestfailed", (r) => {
    const err = r.failure()?.errorText ?? "";
    if (!/Aborted/i.test(err)) errors.push({ where: name, msg: `REQ FAIL: ${r.url()} — ${err}` });
  });

  const events = [];
  async function step(label, fn) {
    const t0 = Date.now();
    try {
      await fn();
      events.push({ label, ms: Date.now() - t0, ok: true });
    } catch (e) {
      events.push({ label, ms: Date.now() - t0, ok: false, err: String(e).split("\n")[0] });
      throw e;
    }
  }

  try {
    await step("goto dashboard", () => page.goto(`${BASE}/dashboard`, { waitUntil: "domcontentloaded", timeout: 60000 }));
    await page.waitForTimeout(2000);

    await step("fill vehicle picker", async () => {
      const selects = await page.$$("select");
      if (selects.length >= 2) {
        await selects[0].selectOption({ index: 1 });
        await page.waitForTimeout(500);
        await selects[1].selectOption({ index: 1 });
        await page.waitForTimeout(300);
        await page.getByRole("button", { name: /confirmar/i }).first().click();
      }
    });

    await step("wait viewer ready", async () => {
      // Espera canvas OU svg do carro (mobile default)
      await page.waitForFunction(
        () => !!document.querySelector("canvas") || !!document.querySelector("svg[aria-label*='veículo']"),
        { timeout: 60000 },
      );
    });
    await page.waitForTimeout(4000);

    // Screenshot inicial
    await page.screenshot({ path: `scripts/full-${name}-1-loaded.png` });

    // Verifica se tem canvas (3D ativo) ou svg (light mode)
    const has3D = await page.evaluate(() => !!document.querySelector("canvas"));
    events.push({ label: `viewer mode`, mode: has3D ? "3D" : "SVG" });

    // Clica em cada cor e mede longtasks
    await page.evaluate(() => {
      window.__longTasks = [];
      new PerformanceObserver((l) => {
        for (const e of l.getEntries()) window.__longTasks.push({ dur: e.duration, start: e.startTime });
      }).observe({ type: "longtask" });
    });

    for (const color of ["Branco", "Vermelho", "Azul", "Original"]) {
      const start = await page.evaluate(() => { window.__longTasks.splice(0); return performance.now(); });
      const ok = await page.evaluate((c) => {
        const b = document.querySelector(`button[title="${c}"]`);
        if (!b) return false;
        b.click();
        return true;
      }, color);
      if (!ok) {
        events.push({ label: `color: ${color}`, err: "not found" });
        continue;
      }
      await page.waitForTimeout(1200);
      const lts = await page.evaluate((s) => window.__longTasks.filter((t) => t.start >= s - 5), start);
      const worst = lts.length ? Math.max(...lts.map((t) => t.dur)) : 0;
      const blocking = lts.reduce((s, t) => s + Math.max(0, t.dur - 50), 0);
      events.push({ label: `color: ${color}`, longtasks: lts.length, worst, blocking });
    }

    // Testa botões dentro do 3D (só se 3D)
    if (has3D) {
      const buttons = [
        ["zoom+", "button[aria-label='Aproximar']"],
        ["zoom-", "button[aria-label='Afastar']"],
        ["recenter", "button[aria-label='Recentralizar']"],
        ["toggle markers", "button[aria-label*='marcadores']"],
      ];
      for (const [label, sel] of buttons) {
        const start = await page.evaluate(() => { window.__longTasks.splice(0); return performance.now(); });
        const ok = await page.evaluate((s) => {
          const el = document.querySelector(s);
          if (!el) return false;
          el.click();
          return true;
        }, sel);
        if (!ok) { events.push({ label, err: "not found" }); continue; }
        await page.waitForTimeout(1000);
        const lts = await page.evaluate((s) => window.__longTasks.filter((t) => t.start >= s - 5), start);
        const worst = lts.length ? Math.max(...lts.map((t) => t.dur)) : 0;
        events.push({ label, longtasks: lts.length, worst });
      }
    }

    // Click "Iniciar orçamento" abre modal com picker de peças
    await step("open damage editor", async () => {
      const ok = await page.evaluate(() => {
        for (const b of document.querySelectorAll("button")) {
          if ((b.textContent || "").trim().toLowerCase().includes("iniciar orçamento")) {
            b.click();
            return true;
          }
        }
        return false;
      });
      if (!ok) throw new Error("Iniciar orçamento button not found");
      await page.waitForTimeout(2000);
    });

    await page.screenshot({ path: `scripts/full-${name}-2-editor.png` });

    // Fecha o modal
    await page.evaluate(() => {
      // Procura botão X ou click fora
      const closeBtn = document.querySelector("[aria-label*='ech']") || document.querySelector("button[aria-label='Fechar']");
      if (closeBtn) closeBtn.click();
      else document.body.click();
    });
    await page.waitForTimeout(500);
    await page.keyboard.press("Escape");
    await page.waitForTimeout(500);

    // Testa navegação pra listagem de orçamentos
    await step("goto orcamentos", async () => {
      await page.goto(`${BASE}/orcamentos`, { waitUntil: "domcontentloaded", timeout: 30000 });
      await page.waitForTimeout(1500);
    });
    await page.screenshot({ path: `scripts/full-${name}-3-orcamentos.png` });

    // Testa página inicial
    await step("goto /", async () => {
      await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded", timeout: 30000 });
      await page.waitForTimeout(1500);
    });
    await page.screenshot({ path: `scripts/full-${name}-4-home.png` });

  } catch (e) {
    events.push({ error: "SCENARIO ABORTED: " + String(e).split("\n")[0] });
  } finally {
    for (const e of errors) globalErrors.push(e);
    results.push({ name, events });
    await browser.close();
  }
}

// Roda 3 cenários: desktop, iPhone (SVG default), iPhone com 3D forçado
await runScenario("desktop", { viewport: { width: 1440, height: 900 } }, 1);
await runScenario("mobile-svg", devices["iPhone 13"], CPU_RATE);
await runScenario("mobile-3d-forced", {
  ...devices["iPhone 13"],
  storageState: {
    origins: [
      {
        origin: BASE,
        localStorage: [{ name: "reparo360.viewer.lightMode", value: "0" }],
      },
    ],
    cookies: [],
  },
}, CPU_RATE);

// Report
console.log(`\n====== TEST RESULTS (BASE=${BASE}, CPU=${CPU_RATE}x on mobile) ======\n`);
for (const r of results) {
  console.log(`--- ${r.name} ---`);
  for (const e of r.events) {
    if (e.longtasks !== undefined) {
      console.log(`  [${e.label.padEnd(18)}] worst=${(e.worst ?? 0).toFixed(0).padStart(4)}ms blocking=${(e.blocking ?? 0).toFixed(0).padStart(4)}ms tasks=${e.longtasks}`);
    } else if (e.mode) {
      console.log(`  [viewer mode         ] ${e.mode}`);
    } else if (e.error) {
      console.log(`  [ABORT              ] ${e.error}`);
    } else if (e.err) {
      console.log(`  [${e.label.padEnd(18)}] FAIL ${e.ms}ms — ${e.err}`);
    } else {
      console.log(`  [${e.label.padEnd(18)}] ok ${e.ms}ms`);
    }
  }
  console.log("");
}

if (globalErrors.length === 0) {
  console.log("NO JS ERRORS. All scenarios completed.");
} else {
  console.log(`\n${globalErrors.length} ERRORS:`);
  for (const e of globalErrors.slice(0, 40)) console.log(`  [${e.where}] ${e.msg.slice(0, 250)}`);
}
