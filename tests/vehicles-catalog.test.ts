import { describe, it, expect } from "vitest";
import { VEHICLE_BRANDS, VEHICLE_CATALOG, modelsForBrand } from "@/lib/vehicles";
import { vehicleFactor } from "@/lib/pricing";

describe("catálogo de veículos", () => {
  it("marcas em ordem alfabética, com Genérico no fim (contrato do seletor)", () => {
    expect(VEHICLE_BRANDS.at(-1)).toBe("Genérico");
    const reais = VEHICLE_BRANDS.slice(0, -1);
    expect(reais).toEqual([...reais].sort((a, b) => a.localeCompare(b, "pt-BR")));
  });

  it("o mesmo .glb nas duas marcas aponta pro mesmo arquivo do catálogo", () => {
    // R34 e Charger aparecem em Nissan/Dodge e em Velozes & Furiosos.
    const files = new Set(VEHICLE_CATALOG.filter((v) => v.brand !== "Velozes & Furiosos").map((v) => v.glb));
    expect(files.has("nissan-gt-r.glb")).toBe(true);
    expect(files.has("dodge-dominic-toretto-s.glb")).toBe(true);
  });

  it("Velozes & Furiosos tem os 4 carros dos filmes", () => {
    const carros = modelsForBrand("Velozes & Furiosos").map((v) => [v.model, v.glb, v.years]);
    expect(carros).toEqual([
      ["Dodge Charger R/T", "dodge-dominic-toretto-s.glb", [1970]],
      ["Mitsubishi Eclipse", "mitsubishi-eclipse-robocar.glb", [1995]],
      ["Nissan Skyline R34", "nissan-gt-r.glb", [1999]],
      ["Toyota Supra MK IV", "toyota-supra-mk4-ff.glb", [1994]],
    ]);
  });

  it("marca que não é montadora cai no preço padrão, igual à Toyota", () => {
    const vf = vehicleFactor({ brand: "Velozes & Furiosos", category: "sports" });
    expect(vf).toEqual(vehicleFactor({ brand: "Toyota", category: "sports" }));
  });
});
