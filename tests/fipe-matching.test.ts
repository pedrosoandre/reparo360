import { describe, it, expect } from "vitest";
import { normalize, parseBRL, matchBrand, candidateModels, matchYear, yearOf } from "@/lib/fipe";

/** Nomes reais colhidos da API, incluindo as inconsistências dela. */
const MARCAS = [
  { codigo: "21", nome: "Fiat" },
  { codigo: "23", nome: "GM - Chevrolet" },
  { codigo: "59", nome: "VW - VolksWagen" },
  { codigo: "189", nome: "ASTON MARTIN" },
  { codigo: "20", nome: "Ferrari" },
  { codigo: "39", nome: "Mercedes-Benz" },
];

describe("normalização", () => {
  it("tira acento, caixa e pontuação", () => {
    expect(normalize("Mercedes-Benz")).toBe("mercedes benz");
    expect(normalize("ASTON MARTIN")).toBe("aston martin");
    expect(normalize("Genérico")).toBe("generico");
  });
});

describe("marcas com nome inconsistente na FIPE", () => {
  it("acha Chevrolet dentro de 'GM - Chevrolet'", () => {
    expect(matchBrand(MARCAS, "Chevrolet")?.codigo).toBe("23");
  });

  it("acha Volkswagen dentro de 'VW - VolksWagen'", () => {
    expect(matchBrand(MARCAS, "Volkswagen")?.codigo).toBe("59");
  });

  it("ignora caixa alta", () => {
    expect(matchBrand(MARCAS, "Aston Martin")?.codigo).toBe("189");
  });

  it("marca inexistente devolve null em vez de casar errado", () => {
    expect(matchBrand(MARCAS, "Genérico")).toBeNull();
  });
});

describe("códigos de ano", () => {
  it("extrai o ano do código composto", () => {
    expect(yearOf("2014-5")).toBe(2014);
  });

  it("trata 32000 como zero-km do ano corrente", () => {
    expect(yearOf("32000-1")).toBe(new Date().getFullYear());
  });

  it("prefere o ano exato", () => {
    const anos = [
      { codigo: "2017-5", nome: "2017 Flex" },
      { codigo: "2015-5", nome: "2015 Flex" },
    ];
    const m = matchYear(anos, 2015)!;
    expect(m.exact).toBe(true);
    expect(m.entry.codigo).toBe("2015-5");
  });

  it("cai no mais próximo e sinaliza que aproximou", () => {
    const anos = [{ codigo: "2017-5", nome: "2017 Flex" }];
    const m = matchYear(anos, 2015)!;
    expect(m.exact).toBe(false);
  });
});

describe("candidatos de modelo", () => {
  // O bug original: escolher pelo nome mais curto pegava uma geração que nem
  // existia no ano pedido — Uno 2015 virava Uno 1997.
  const MODELOS = [
    { codigo: 1, nome: "Uno 1.6 mpi 2p e 4p" },
    { codigo: 2, nome: "UNO WAY 1.0 Flex 6V 5p" },
    { codigo: 3, nome: "UNO Furgão 1.0 Fire Flex 8V 3p" },
    { codigo: 4, nome: "Palio 1.0" },
  ];

  it("traz todas as versões da família, não só a de nome curto", () => {
    const c = candidateModels(MODELOS, "Uno");
    expect(c.length).toBe(3);
    expect(c.map((m) => m.codigo)).not.toContain(4);
  });

  it("ordena pela versão base primeiro (desempate)", () => {
    expect(candidateModels(MODELOS, "Uno")[0].codigo).toBe(1);
  });

  it("modelo inexistente não casa por acidente", () => {
    expect(candidateModels(MODELOS, "Roma")).toEqual([]);
  });
});

describe("valor monetário", () => {
  it("converte o formato brasileiro da FIPE", () => {
    expect(parseBRL("R$ 66.489,00")).toBe(66489);
    expect(parseBRL("R$ 2.874.274,00")).toBe(2874274);
  });

  it("devolve null no que não é número", () => {
    expect(parseBRL("indisponível")).toBeNull();
  });
});
