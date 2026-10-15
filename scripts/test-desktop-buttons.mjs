import { chromium } from "playwright";

const BASE = process.env.TEST_URL ?? "http://localhost:3000";

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();

const errors = [];
page.on("pageerror", (e) => errors.push("PAGEERROR: " + String(e)));
page.on("console", (m) => {
  if (m.type() === "error") errors.push("CONSOLE.ERR: " + m.text());
});

await page.goto(`${BASE}/dashboard`, { waitUntil: "domcontentloaded", timeout: 60000 });
await page.waitForTimeout(2000);

const selects = await page.$$("select");
if (selects.length >= 2) {
  await selects[0].selectOption({ index: 1 });
  await page.waitForTimeout(400);
  await selects[1].selectOption({ index: 1 });
  await page.waitForTimeout(300);
  await page.getByRole("button", { name: /confirmar/i }).first().click();
  console.log("vehicle confirmed");
}
await page.waitForSelector("canvas", { timeout: 60000 });
await page.waitForTimeout(5000);
console.log("canvas ready");

await page.evaluate(() => {
  window.__longTasks = [];
  window.__po = new PerformanceObserver((list) => {
    for (const e of list.getEntries()) window.__longTasks.push({ dur: e.duration, start: e.startTime });
  });
  window.__po.observe({ type: "longtask" });
});

async function measureClick(label, selector) {
  const start = await page.evaluate(() => {
    window.__longTasks.splice(0);
    return performance.now();
  });
  const ok = await page.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (!el) return false;
    el.click();
    return true;
  }, selector);
  if (!ok) {
    console.log(`[${label.padEnd(28)}] SELECTOR NOT FOUND: ${selector}`);
    return;
  }
  await page.waitForTimeout(1500);
  const lts = await page.evaluate((s) => window.__longTasks.filter((t) => t.start >= s - 5), start);
  const worst = lts.length ? Math.max(...lts.map((t) => t.dur)) : 0;
  const blocking = lts.reduce((s, t) => s + Math.max(0, t.dur - 50), 0);
  console.log(`[${label.padEnd(28)}] longtasks=${lts.length.toString().padStart(2)} worst=${worst.toFixed(0).padStart(4)}ms blocking=${blocking.toFixed(0).padStart(4)}ms`);
}

// Baseline (canvas already up with autoRotate spinning)
await measureClick("BASELINE                    ", "body"); // click body = noop, just measure passive

await measureClick("zoom +", "button[aria-label='Aproximar']");
await measureClick("zoom -", "button[aria-label='Afastar']");
await measureClick("recenter", "button[aria-label='Recentralizar']");
await measureClick("toggle markers", "button[aria-label*='marcadores']");
await measureClick("open scenery picker", "button[aria-label='Alterar cenário']");
await page.waitForTimeout(500);
// Click a scenery option — pick the second (non-active) one
const scenaryClicked = await page.evaluate(() => {
  const opts = document.querySelectorAll("[role='option']");
  for (const o of opts) {
    if (o.getAttribute("aria-selected") === "false") {
      o.click();
      return true;
    }
  }
  return false;
});
if (scenaryClicked) {
  await page.waitForTimeout(3000);
  const lts = await page.evaluate(() => window.__longTasks.splice(0));
  const worst = lts.length ? Math.max(...lts.map((t) => t.dur)) : 0;
  console.log(`[change scenery              ] longtasks=${lts.length.toString().padStart(2)} worst=${worst.toFixed(0).padStart(4)}ms`);
}

// Try clicking a hotspot on the canvas — check by getting canvas center
const box = await page.evaluate(() => {
  const c = document.querySelector("canvas");
  const r = c.getBoundingClientRect();
  return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
});
{
  const start = await page.evaluate(() => { window.__longTasks.splice(0); return performance.now(); });
  await page.mouse.click(box.x + 40, box.y + 20);
  await page.waitForTimeout(2000);
  const lts = await page.evaluate((s) => window.__longTasks.filter((t) => t.start >= s - 5), start);
  const worst = lts.length ? Math.max(...lts.map((t) => t.dur)) : 0;
  console.log(`[click hotspot on canvas     ] longtasks=${lts.length.toString().padStart(2)} worst=${worst.toFixed(0).padStart(4)}ms`);
}

console.log("\n=== ERRORS ===");
for (const e of errors.slice(0, 30)) console.log("-", e.slice(0, 300));

await browser.close();
