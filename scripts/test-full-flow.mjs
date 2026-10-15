import { chromium, devices } from "playwright";

const BASE = process.env.TEST_URL ?? "https://reparo360.vercel.app";

const browser = await chromium.launch();
const context = await browser.newContext({
  ...devices["iPhone 13"],
});
// Simulate slow mobile CPU (4x slower than desktop)
const client = await context.newCDPSession(await context.newPage());
await client.send("Emulation.setCPUThrottlingRate", { rate: 4 });
const page = await context.newPage();

const errors = [];
page.on("pageerror", (e) => errors.push("PAGEERROR: " + String(e)));
page.on("console", (m) => {
  if (m.type() === "error") errors.push("CONSOLE.ERROR: " + m.text());
});
page.on("requestfailed", (r) => errors.push(`REQ FAIL: ${r.url()} — ${r.failure()?.errorText}`));

async function step(label, fn) {
  const t0 = Date.now();
  try {
    const out = await fn();
    console.log(`[${label}] ok (${Date.now() - t0}ms)${out ? " " + out : ""}`);
  } catch (e) {
    console.log(`[${label}] FAIL (${Date.now() - t0}ms) ${String(e).split("\n")[0]}`);
  }
}

await step("goto dashboard", () => page.goto(`${BASE}/dashboard`, { waitUntil: "domcontentloaded", timeout: 60000 }));
await page.waitForTimeout(3000);

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

await step("wait canvas", () => page.waitForSelector("canvas", { timeout: 60000 }));
await page.waitForTimeout(5000);

await page.screenshot({ path: "scripts/flow-1-dashboard.png" });

// Click color
await step("click Vermelho", async () => {
  const ok = await page.evaluate(() => {
    const b = document.querySelector("button[title='Vermelho']");
    if (!b) return false;
    b.click();
    return true;
  });
  if (!ok) throw new Error("Vermelho button not found");
  await page.waitForTimeout(2000);
});

await page.screenshot({ path: "scripts/flow-2-vermelho.png" });

// Click zoom in
await step("click zoom in (+)", async () => {
  const ok = await page.evaluate(() => {
    const b = document.querySelector("button[aria-label='Aproximar']");
    if (!b) return false;
    b.click();
    return true;
  });
  if (!ok) throw new Error("Zoom in button not found");
  await page.waitForTimeout(1500);
});

// Try clicking a car part to open budget flow
await step("click 'Iniciar orçamento'", async () => {
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
  await page.waitForTimeout(2500);
});

await page.screenshot({ path: "scripts/flow-3-orcamento-modal.png" });

console.log("\n=== ERRORS ===");
if (errors.length === 0) console.log("(none)");
else for (const e of errors.slice(0, 40)) console.log("-", e.slice(0, 300));

await browser.close();
