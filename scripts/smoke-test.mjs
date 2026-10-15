import puppeteer from "puppeteer";

const URL = "http://localhost:3000/dashboard";

const browser = await puppeteer.launch({ headless: "new" });
const page = await browser.newPage();

const errors = [];
page.on("pageerror", (err) => errors.push(`pageerror: ${err.message}`));
page.on("console", (msg) => {
  if (msg.type() === "error") errors.push(`console: ${msg.text()}`);
});

try {
  await page.goto(URL, { waitUntil: "networkidle0", timeout: 60000 });
} catch (e) {
  console.log("NAV_TIMEOUT:", e.message);
}

// Aguarda até 8s pra hidratar
await new Promise((r) => setTimeout(r, 8000));

const bodyText = await page.evaluate(() => document.body.innerText.slice(0, 500));
const hasSpinner = await page.evaluate(
  () => !!document.querySelector(".animate-spin"),
);
const hasVehiclePicker = await page.evaluate(
  () => !!document.querySelector('button[aria-label="Fechar"], select'),
);
const hasSidebar = await page.evaluate(() =>
  !!document.body.innerText.includes("Avaliação de danos"),
);
const currentUrl = page.url();

console.log("URL:", currentUrl);
console.log("hasSpinner:", hasSpinner);
console.log("hasVehiclePicker:", hasVehiclePicker);
console.log("hasSidebar:", hasSidebar);
console.log("BODY TEXT:", JSON.stringify(bodyText));
console.log("ERRORS:", errors.slice(0, 10));

await browser.close();
