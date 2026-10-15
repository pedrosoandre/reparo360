import { describe, it, expect } from "vitest";
import { estimate, splitServiceParts, vehicleFactor } from "@/lib/pricing";

const POPULAR = { category: "hatchback", brand: "Fiat" };
const EXOTIC = { category: "coupe", brand: "Ferrari" };

describe("danos na mesma peça não somam linearmente", () => {
  it("não repinta o mesmo painel duas vezes", () => {
    // O bug original: arranhão leve + profundo no capô somavam mão de obra e
    // pintura inteiras dos dois, como se o painel fosse pintado duas vezes.
    const so = estimate("hood", ["scratch_deep"]);
    const ambos = estimate("hood", ["scratch_light", "scratch_deep"]);
    const soma = estimate("hood", ["scratch_light"]).total + so.total;

    expect(ambos.total).toBeGreaterThan(so.total);
    expect(ambos.total).toBeLessThan(soma);
  });

  it("peça que vai ser trocada absorve os danos menores", () => {
    // Para-choque quebrado vai ser substituído; o arranhão nele não custa nada.
    const soQuebra = estimate("front_bumper", ["break"], POPULAR);
    const comArranhao = estimate("front_bumper", ["break", "scratch_light"], POPULAR);
    expect(comArranhao.total).toBe(soQuebra.total);
  });

  it("o dano mais caro domina, independente da ordem informada", () => {
    const a = estimate("hood", ["scratch_light", "dent_medium"]);
    const b = estimate("hood", ["dent_medium", "scratch_light"]);
    expect(a.total).toBe(b.total);
  });
});

describe("serviço + peças fecha com o total exibido", () => {
  const casos: [Parameters<typeof estimate>[0], Parameters<typeof estimate>[1], object | undefined][] = [
    ["hood", ["scratch_light", "scratch_deep"], POPULAR],
    ["headlight_left", ["break"], POPULAR],
    ["front_bumper", ["scratch_deep", "break"], EXOTIC],
    ["wheel_fl", ["dent_medium"], POPULAR],
    ["roof", ["dent_medium"], undefined],
  ];

  it.each(casos)("%s %j reconcilia", (part, damages, ctx) => {
    const e = estimate(part, damages, ctx);
    const s = splitServiceParts(e);
    // Arredondar componentes separadamente sobrava um centavo contra o total.
    expect(Math.round((s.service + s.parts) * 100) / 100).toBe(e.total);
  });
});

describe("fator de veículo", () => {
  it("valor FIPE manda quando existe", () => {
    const semFipe = vehicleFactor(EXOTIC);
    const comFipe = vehicleFactor({ ...EXOTIC, marketValue: 2_874_274 });
    expect(semFipe.basis).toBe("heuristic");
    expect(comFipe.basis).toBe("fipe");
  });

  it("sem contexto nenhum não inventa ajuste", () => {
    const f = vehicleFactor(undefined);
    expect(f).toEqual({ factor: 1, basis: "none" });
    expect(vehicleFactor({}).basis).toBe("none");
  });

  it("carro caro custa mais caro pra consertar", () => {
    const barato = estimate("hood", ["dent_medium"], POPULAR);
    const caro = estimate("hood", ["dent_medium"], EXOTIC);
    expect(caro.total).toBeGreaterThan(barato.total);
  });

  it("cresce menos que o preço do carro", () => {
    // 100× mais caro não significa 100× mais caro pra consertar.
    const a = vehicleFactor({ marketValue: 30_000 }).factor;
    const b = vehicleFactor({ marketValue: 3_000_000 }).factor;
    expect(b / a).toBeLessThan(100);
  });
});

describe("fallback é sinalizado, não escondido", () => {
  it("marca a combinação que não está tabelada", () => {
    const e = estimate("wheel_fl", ["dent_medium"], POPULAR);
    expect(e.hasFallback).toBe(true);
    expect(e.fallbackDamages).toContain("dent_medium");
    expect(e.confidence).toBeLessThan(30);
  });

  it("combinação tabelada não levanta a flag", () => {
    const e = estimate("hood", ["dent_medium"], POPULAR);
    expect(e.hasFallback).toBe(false);
    expect(e.fallbackDamages).toEqual([]);
  });

  it("carimba a versão da tabela pra auditoria", () => {
    expect(estimate("hood", ["dent_medium"]).pricingVersion).toBeTruthy();
  });
});
