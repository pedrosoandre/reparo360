import { chromium, devices } from "playwright";

const URL = process.env.TEST_URL ?? "https://reparo360.vercel.app/dashboard";

const browser = await chromium.launch();
const context = await browser.newContext({
  ...devices["iPhone 13"],
});
const page = await context.newPage();

const events = [];
page.on("pageerror", (e) => events.push({ type: "pageerror", msg: String(e) }));
page.on("console", (msg) => events.push({ type: msg.type(), msg: msg.text() }));

console.log("navigating…", URL);
await page.goto(URL, { waitUntil: "domcontentloaded", timeout: 60000 });
await page.waitForTimeout(2000);

// Fill vehicle picker
const selects = await page.$$("select");
if (selects.length >= 2) {
  await selects[0].selectOption({ index: 1 });
  await page.waitForTimeout(400);
  await selects[1].selectOption({ index: 1 });
  await page.waitForTimeout(300);
  await page.getByRole("button", { name: /confirmar/i }).first().click();
  console.log("vehicle confirmed");
}

await page.waitForSelector("canvas", { timeout: 45000 });
console.log("canvas up, waiting 5s for full load");
await page.waitForTimeout(5000);

// Inject longtask observer (no buffered — only capture what happens AFTER we start listening per click)
await page.evaluate(() => {
  window.__longTasks = [];
  window.__po = new PerformanceObserver((list) => {
    for (const e of list.getEntries()) window.__longTasks.push({ dur: e.duration, start: e.startTime });
  });
  window.__po.observe({ type: "longtask" });
});

// Measure baseline first (no click)
{
  const startMark = await page.evaluate(() => {
    window.__longTasks.splice(0);
    return performance.now();
  });
  await page.waitForTimeout(1000);
  const lt = await page.evaluate((s) => window.__longTasks.filter((t) => t.start >= s - 5), startMark);
  const worst = lt.length ? Math.max(...lt.map((t) => t.dur)) : 0;
  const blocking = lt.reduce((s, t) => s + Math.max(0, t.dur - 50), 0);
  console.log(`[BASELINE ] longtasks=${lt.length.toString().padStart(2)} worst=${worst.toFixed(0).padStart(4)}ms blocking=${blocking.toFixed(0).padStart(4)}ms`);
}

const colorTitles = ["Branco", "Vermelho", "Azul", "Preto", "Original"];
for (const title of colorTitles) {
  // Clear observer and mark start time
  const startMark = await page.evaluate(() => {
    window.__longTasks.splice(0);
    return performance.now();
  });
  // Fire click
  const clicked = await page.evaluate((sel) => {
    const el = document.querySelector(`button[title="${sel}"]`);
    if (!el) return false;
    el.click();
    return true;
  }, title);
  if (!clicked) {
    console.log(`[${title}] button not found`);
    continue;
  }
  // Wait 1000ms for tasks to complete
  await page.waitForTimeout(1000);
  const longTasks = await page.evaluate((start) =>
    window.__longTasks.filter((t) => t.start >= start - 5),
    startMark,
  );
  const worst = longTasks.length ? Math.max(...longTasks.map((t) => t.dur)) : 0;
  const blockingSum = longTasks.reduce((s, t) => s + Math.max(0, t.dur - 50), 0);
  console.log(
    `[${title.padEnd(9)}] longtasks=${longTasks.length.toString().padStart(2)} worst=${worst.toFixed(0).padStart(4)}ms blocking=${blockingSum.toFixed(0).padStart(4)}ms`,
  );
}

console.log("\n=== events ===");
for (const e of events.slice(-30)) {
  console.log(`[${e.type}]`, e.msg.slice(0, 200));
}

await browser.close();
