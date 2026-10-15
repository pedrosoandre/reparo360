import { chromium } from "playwright";

const browser = await chromium.launch({ args: ["--use-angle=swiftshader"] });
try {
  for (const vehicle of [
    { brand: "Volkswagen", model: "Polo", glb: "vw-polo.glb", category: "hatchback" },
    { brand: "Volkswagen", model: "Gol", glb: "volkswagen-gol.glb", category: "hatchback" },
    { brand: "Toyota", model: "Supra Mk4", glb: "toyota-supra-mk4.glb", category: "coupe" },
  ]) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.addInitScript((vehicle) => {
    const user = { id: "opening-test", name: "Teste", email: "test@local", passwordHash: "", createdAt: new Date().toISOString() };
    localStorage.setItem("reparo360:auth", JSON.stringify({ state: { users: [user], currentUserId: user.id }, version: 0 }));
    localStorage.setItem("reparo360:vehicles", JSON.stringify({ state: { vehicles: [{ id: "opening-car", userId: user.id, year: 2020, ...vehicle }], activeVehicleId: "opening-car" }, version: 0 }));
  }, vehicle);
  await page.goto(`${process.env.TEST_URL ?? "http://localhost:3000"}/dashboard`, { timeout: 120000 });
  const open = page.getByRole("button", { name: "Abrir portas e porta-malas", exact: true });
  await open.waitFor({ timeout: 120000 });
  await page.waitForFunction(() => {
    const button = [...document.querySelectorAll("button")].find((b) => b.textContent === "Abrir portas e porta-malas");
    return button && !button.disabled;
  }, undefined, { timeout: 120000 });
  await open.click();
  await page.waitForTimeout(5000);
  await page.screenshot({ path: `scripts/${vehicle.glb}-open.png` });
  await page.getByRole("button", { name: "Fechar portas e porta-malas", exact: true }).click();
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `scripts/${vehicle.glb}-closed.png` });
  await page.setViewportSize({ width: 390, height: 844 });
  await open.click();
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `scripts/${vehicle.glb}-mobile.png` });
  await page.getByRole("button", { name: "Fechar portas e porta-malas", exact: true }).click();
  if (await open.getAttribute("aria-pressed") !== "false") throw new Error("Mobile close state failed");
  if (errors.length) throw new Error(errors.join("\n"));
  console.log(`${vehicle.model}: desktop and mobile opening/closing passed without page errors.`);
  await page.close();
  }
} finally {
  await browser.close();
}
