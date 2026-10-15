/**
 * Contract test: se alguém editar `data/pricing-table.json` e quebrar a forma,
 * este teste falha antes que o app carregue com valores absurdos. Vale mais que
 * um schema em runtime — pega o problema no CI, não em produção.
 */
import { describe, it, expect } from "vitest";
import { z } from "zod";
import table from "@/data/pricing-table.json";

const DamageCost = z.object({
  labor_hours: z.number().nonnegative(),
  paint_cost: z.number().nonnegative(),
  parts_cost: z.number().nonnegative(),
});

const Table = z.object({
  version: z.string().min(1),
  effectiveFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "AAAA-MM-DD"),
  source: z.string().min(1),
  rates: z.object({
    laborHourRate: z.number().positive(),
    materialsMultiplier: z.number().min(0).max(1),
    workshopMargin: z.number().min(0).max(1),
    overlapFactor: z.number().min(0).max(1),
  }),
  vehicleFactor: z.object({
    referenceMarketValue: z.number().positive(),
    marketValueExponent: z.number().positive().max(1),
    min: z.number().positive(),
    max: z.number().positive(),
    category: z.record(z.string(), z.number().positive()),
    brandTier: z.record(z.string(), z.number().positive()),
    brands: z.record(z.string(), z.string()),
  }),
  businessRules: z
    .object({
      totalLossThreshold: z.number().min(0).max(1),
      totalLossWarnBand: z.number().min(0).max(1),
    })
    .passthrough(),
  fallback: DamageCost,
  parts: z.record(z.string(), z.record(z.string(), DamageCost)),
});

describe("pricing-table.json — contract", () => {
  it("passa no schema", () => {
    const r = Table.safeParse(table);
    if (!r.success) throw new Error(r.error.message);
  });

  it("warn band < threshold (senão o warn nunca dispara)", () => {
    expect(table.businessRules.totalLossWarnBand).toBeLessThan(
      table.businessRules.totalLossThreshold,
    );
  });

  it("vehicleFactor.min < vehicleFactor.max", () => {
    expect(table.vehicleFactor.min).toBeLessThan(table.vehicleFactor.max);
  });

  it("todo brandTier referenciado por `brands` existe", () => {
    const tiers = new Set(Object.keys(table.vehicleFactor.brandTier));
    const usados = new Set(Object.values(table.vehicleFactor.brands));
    for (const t of usados) {
      // "mainstream" é o default no código quando a marca não está no dict,
      // então precisa existir em brandTier mesmo que nenhuma marca referencie.
      expect(tiers.has(t), `tier "${t}" usado em brands mas sem entry em brandTier`).toBe(true);
    }
    expect(tiers.has("mainstream"), 'brandTier precisa do fallback "mainstream"').toBe(true);
  });
});
