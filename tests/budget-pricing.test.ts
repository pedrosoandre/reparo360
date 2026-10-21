import { describe, it, expect } from "vitest";
import { useBudgetsStore } from "@/stores/budgets-store";
import { summarize } from "@/stores/damages-store";
import type { DamageRecord, Vehicle } from "@/types";

/**
 * O total que a tela mostra (summarize com o contexto de preço) tem que ser o
 * total que fica salvo no orçamento. Antes, o dashboard calculava com o valor
 * FIPE e o orçamento salvo ignorava a FIPE (Civic de R$120k: fator 1,18 na
 * tela, 1,0 no orçamento).
 */

const VEHICLE: Vehicle = {
  id: "v1",
  userId: "u1",
  brand: "Honda",
  model: "Civic",
  year: 2020,
  glb: "honda-civic.glb",
  category: "sedan",
  createdAt: "2026-10-21T00:00:00.000Z",
} as Vehicle;

const DAMAGES: DamageRecord[] = [
  {
    id: "d1",
    vehicleId: "v1",
    part: "hood",
    damages: ["dent_medium"],
    photos: [],
    resolved: false,
    createdAt: "2026-10-21T00:00:00.000Z",
    updatedAt: "2026-10-21T00:00:00.000Z",
  },
];

describe("preço do orçamento salvo", () => {
  it("usa o mesmo valor FIPE que a tela usou", () => {
    const marketValue = 120_000;
    const naTela = summarize(DAMAGES, {
      category: VEHICLE.category,
      brand: VEHICLE.brand,
      marketValue,
    }).total;
    const salvo = useBudgetsStore.getState().createFromDashboard({
      userId: "u1",
      vehicle: VEHICLE,
      damages: DAMAGES,
      customerName: "Teste",
      source: "dashboard",
      marketValue,
    });
    expect(salvo.total).toBeCloseTo(naTela, 2);
    expect(salvo.total).not.toBeCloseTo(summarize(DAMAGES, { category: "sedan", brand: "Honda" }).total, 2);
  });
});
