import { chromium } from "playwright";

const browser = await chromium.launch({ args: ["--use-angle=swiftshader"] });
try {
  const page = await browser.newPage();
  await page.addInitScript(() => {
    const user = { id: "fallback-test", name: "Teste", email: "test@local", passwordHash: "" };
    localStorage.setItem("reparo360:auth", JSON.stringify({ state: { users: [user], currentUserId: user.id }, version: 0 }));
    localStorage.setItem("reparo360:vehicles", JSON.stringify({ state: { vehicles: [{ id: "test-car", userId: user.id, brand: "Volkswagen", model: "Polo", year: 2020, glb: "vw-polo.glb", category: "hatchback" }], activeVehicleId: "test-car" }, version: 0 }));
  });
  await page.route("**/scenery/*.glb", (route) => route.fulfill({ status: 404, body: "Missing scenery test" }));
  await page.goto(`${process.env.TEST_URL ?? "http://localhost:3000"}/dashboard`, { timeout: 120000 });
  await page.getByRole("status").filter({ hasText: "Não foi possível carregar o 3D" }).waitFor({ timeout: 60000 });
  if (await page.getByText("Application error:", { exact: false }).count()) throw new Error("Page crashed");
  await page.getByRole("button", { name: "Iniciar orçamento", exact: true }).waitFor();
  await page.screenshot({ path: "scripts/viewer-fallback.png" });
  console.log("Missing scenery: 2D fallback visible and dashboard preserved.");
} finally {
  await browser.close();
}
