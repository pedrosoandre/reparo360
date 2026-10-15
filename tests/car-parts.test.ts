import { describe, it, expect } from "vitest";
import { PART_LABELS, DAMAGE_LABELS, VEHICLE_BRANDS } from "@/lib/car-parts";
import type { CarPart, DamageType } from "@/types";

/**
 * O tipo CarPart e o dicionário PART_LABELS têm que andar juntos: se alguém
 * adicionar uma peça no tipo e esquecer da label (ou vice-versa), a UI mostra
 * "undefined" e o PDF/WhatsApp fica sem nome. TypeScript pega parte disso —
 * mas não pega "peça a mais na label sem correspondente no tipo".
 */
describe("catálogo de peças e danos", () => {
  const ALL_PARTS: CarPart[] = [
    "front_bumper",
    "hood",
    "grille",
    "headlight_left",
    "headlight_right",
    "fender_left",
    "fender_right",
    "door_front_left",
    "door_front_right",
    "door_rear_left",
    "door_rear_right",
    "mirror_left",
    "mirror_right",
    "rear_bumper",
    "trunk",
    "taillight_left",
    "taillight_right",
    "roof",
    "wheel_fl",
    "wheel_fr",
    "wheel_rl",
    "wheel_rr",
  ];

  const ALL_DAMAGES: DamageType[] = [
    "scratch_light",
    "scratch_deep",
    "dent_light",
    "dent_medium",
    "break",
    "misalignment",
    "other",
  ];

  it("toda peça do tipo tem label", () => {
    for (const p of ALL_PARTS) {
      expect(PART_LABELS[p], `label ausente para ${p}`).toBeTruthy();
    }
  });

  it("PART_LABELS não tem chaves fantasmas fora do tipo", () => {
    const labelKeys = Object.keys(PART_LABELS);
    for (const k of labelKeys) {
      expect(ALL_PARTS as string[]).toContain(k);
    }
  });

  it("todo dano do tipo tem label", () => {
    for (const d of ALL_DAMAGES) {
      expect(DAMAGE_LABELS[d], `label ausente para ${d}`).toBeTruthy();
    }
  });

  it("labels de peça são únicas (dois códigos com o mesmo label confundem no PDF)", () => {
    const values = Object.values(PART_LABELS);
    expect(new Set(values).size).toBe(values.length);
  });

  it("catálogo de marcas está em ordem alfabética (contrato do dropdown)", () => {
    const sorted = [...VEHICLE_BRANDS].sort((a, b) => a.localeCompare(b, "pt-BR"));
    expect(VEHICLE_BRANDS).toEqual(sorted);
  });

  it("marcas não têm duplicatas", () => {
    expect(new Set(VEHICLE_BRANDS).size).toBe(VEHICLE_BRANDS.length);
  });
});
