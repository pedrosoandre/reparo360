import type { CarPart, DamageType } from "@/types";
import table from "@/data/pricing-table.json";

interface DamageCost {
  labor_hours: number;
  paint_cost: number;
  parts_cost: number;
}

/**
 * Versão da tabela que produziu um cálculo. Persistir junto de qualquer
 * orçamento salvo — sem isso não dá pra auditar por que um valor antigo
 * era aquele.
 */
export const PRICING_VERSION = table.version;
export const PRICING_SOURCE = table.source;

const { laborHourRate, materialsMultiplier, workshopMargin, overlapFactor } = table.rates;

const BASE_PRICING = table.parts as Partial<Record<CarPart, Partial<Record<DamageType, DamageCost>>>>;
const FALLBACK: DamageCost = table.fallback;

/**
 * Contexto do veículo. `marketValue` é o valor FIPE em reais — quando presente
 * manda no cálculo. Sem ele, caímos na heurística categoria × marca, que é uma
 * aproximação grosseira e rebaixa a confiança do orçamento.
 */
export interface PricingContext {
  category?: string;
  brand?: string;
  /** Valor de mercado (FIPE) em BRL. */
  marketValue?: number;
}

export interface VehicleFactor {
  factor: number;
  /** "fipe" = derivado do valor de mercado; "heuristic" = categoria × marca; "none" = sem contexto. */
  basis: "fipe" | "heuristic" | "none";
}

/**
 * Peça de carro popular e peça de exótico não custam o mesmo, e mão de obra
 * em painel de alumínio/fibra não rende igual à de aço. Este fator corrige isso.
 *
 * Ele cresce menos que o preço do carro (expoente < 1): um veículo 10× mais caro
 * não custa 10× mais pra reparar — peça pesa mais que hora de funilaria.
 */
export function vehicleFactor(ctx?: PricingContext): VehicleFactor {
  const cfg = table.vehicleFactor;
  if (!ctx) return { factor: 1, basis: "none" };

  if (typeof ctx.marketValue === "number" && ctx.marketValue > 0) {
    const raw = Math.pow(ctx.marketValue / cfg.referenceMarketValue, cfg.marketValueExponent);
    return { factor: clamp(round2(raw), cfg.min, cfg.max), basis: "fipe" };
  }

  const categoryFactor =
    (cfg.category as Record<string, number>)[ctx.category ?? ""] ?? 1;
  const tier = (cfg.brands as Record<string, string>)[ctx.brand ?? ""] ?? "mainstream";
  const brandFactor = (cfg.brandTier as Record<string, number>)[tier] ?? 1;

  if (!ctx.category && !ctx.brand) return { factor: 1, basis: "none" };

  return {
    factor: clamp(round2(categoryFactor * brandFactor), cfg.min, cfg.max),
    basis: "heuristic",
  };
}

export interface EstimateResult {
  labor: number;
  paint: number;
  parts: number;
  materials: number;
  margin: number;
  subtotal: number;
  total: number;
  confidence: number;
  /** Danos que não existiam na tabela e caíram no fallback — o valor é chute. */
  fallbackDamages: DamageType[];
  hasFallback: boolean;
  vehicleFactor: number;
  vehicleFactorBasis: VehicleFactor["basis"];
  pricingVersion: string;
}

/**
 * Custo de reparo de UMA peça com um ou mais danos.
 *
 * Danos na mesma peça não somam: quem lixa e repinta um painel por arranhão
 * profundo já resolveu o arranhão leve no mesmo processo. O dano mais caro
 * domina (100% de mão de obra e pintura) e os demais entram só com o retrabalho
 * extra (`overlapFactor`). Se a peça vai ser trocada (`break`), os danos
 * menores não custam nada — peça nova não herda amassado.
 *
 * `parts_cost` sempre soma: são componentes distintos a comprar.
 */
export function estimate(
  part: CarPart,
  damages: DamageType[],
  ctx?: PricingContext,
): EstimateResult {
  const partTable = BASE_PRICING[part] ?? {};

  const entries = damages.map((d) => {
    const cost = partTable[d];
    return { damage: d, cost: cost ?? FALLBACK, isFallback: !cost };
  });

  const fallbackDamages = entries.filter((e) => e.isFallback).map((e) => e.damage);

  // Peso = quanto o dano custa em serviço (mão de obra + pintura).
  const weighted = [...entries].sort(
    (a, b) =>
      b.cost.labor_hours * laborHourRate +
      b.cost.paint_cost -
      (a.cost.labor_hours * laborHourRate + a.cost.paint_cost),
  );

  const dominant = weighted[0];
  const replacesPart = dominant?.damage === "break";

  let labor_hours = 0;
  let paint = 0;
  let parts = 0;

  weighted.forEach((entry, i) => {
    const share = i === 0 ? 1 : replacesPart ? 0 : overlapFactor;
    labor_hours += entry.cost.labor_hours * share;
    paint += entry.cost.paint_cost * share;
    parts += entry.cost.parts_cost;
  });

  const vf = vehicleFactor(ctx);

  const labor = labor_hours * laborHourRate * vf.factor;
  const paintAdjusted = paint * vf.factor;
  const partsAdjusted = parts * vf.factor;

  const materials = (labor + paintAdjusted + partsAdjusted) * materialsMultiplier;
  const subtotal = labor + paintAdjusted + partsAdjusted + materials;
  const margin = subtotal * workshopMargin;
  const total = subtotal + margin;

  return {
    labor: round2(labor),
    paint: round2(paintAdjusted),
    parts: round2(partsAdjusted),
    materials: round2(materials),
    margin: round2(margin),
    subtotal: round2(subtotal),
    total: round2(total),
    confidence: confidenceFor(entries.length, fallbackDamages.length, vf.basis),
    fallbackDamages,
    hasFallback: fallbackDamages.length > 0,
    vehicleFactor: vf.factor,
    vehicleFactorBasis: vf.basis,
    pricingVersion: PRICING_VERSION,
  };
}

/**
 * Confiança = cobertura da tabela penalizada pela qualidade do contexto de
 * veículo. Continua sendo uma medida de "quanto disso eu tinha cadastrado",
 * não de acurácia contra oficina real — a tabela nunca foi calibrada.
 */
function confidenceFor(
  total: number,
  fallbacks: number,
  basis: VehicleFactor["basis"],
): number {
  if (total === 0) return 0;
  const coverage = (total - fallbacks) / total;
  const contextPenalty = basis === "fipe" ? 1 : basis === "heuristic" ? 0.85 : 0.7;
  return Math.round(coverage * contextPenalty * 90 + 5);
}

/**
 * Mão de obra e pintura são cobradas como um serviço só; materiais e margem
 * da oficina entram nesse mesmo serviço. O que de fato varia no orçamento é
 * se há peça nova a instalar. Vale sempre: service + parts === total.
 *
 * O serviço é derivado do total menos as peças — e não da soma dos componentes
 * arredondados — pra que as duas linhas exibidas sempre fechem com o total
 * exibido, sem sobra de centavo.
 */
export function splitServiceParts(v: { parts: number; total: number }): {
  service: number;
  parts: number;
} {
  const parts = round2(v.parts);
  return { service: round2(v.total - parts), parts };
}

function clamp(v: number, min: number, max: number): number {
  return Math.min(Math.max(v, min), max);
}

function round2(v: number): number {
  return Math.round(v * 100) / 100;
}
