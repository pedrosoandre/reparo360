import { describe, it, expect } from "vitest";
import { cn, formatBRL, splitBRLCents, formatDate } from "@/lib/utils";

describe("cn — merge de classes tailwind", () => {
  it("deduplica classes conflitantes deixando a última", () => {
    expect(cn("p-2", "p-4")).toBe("p-4");
  });

  it("ignora falsy sem quebrar", () => {
    expect(cn("a", false, undefined, null, "b")).toBe("a b");
  });
});

describe("formatBRL", () => {
  it("formata inteiro com prefixo e separadores brasileiros", () => {
    // Intl usa NBSP entre R$ e o número — remover pra comparar.
    expect(formatBRL(1234.56).replace(/\s/g, " ")).toBe("R$ 1.234,56");
  });

  it("zero é R$ 0,00", () => {
    expect(formatBRL(0).replace(/\s/g, " ")).toBe("R$ 0,00");
  });

  it("valor negativo mantém sinal", () => {
    const out = formatBRL(-50).replace(/\s/g, " ");
    expect(out.startsWith("-")).toBe(true);
  });
});

describe("splitBRLCents", () => {
  it("separa reais e centavos", () => {
    expect(splitBRLCents("R$ 1.234,56")).toEqual(["R$ 1.234", "56"]);
  });

  it("sem vírgula assume 00 de centavos", () => {
    expect(splitBRLCents("R$ 100")).toEqual(["R$ 100", "00"]);
  });

  it("mantém tudo antes da última vírgula", () => {
    // Caso improvável mas defensivo: se algum formato tiver duas vírgulas,
    // só a última conta como separador de centavos.
    expect(splitBRLCents("1,000,50")).toEqual(["1,000", "50"]);
  });
});

describe("formatDate", () => {
  it("aceita string ISO", () => {
    // pt-BR usa mês abreviado com "de" — checar componentes, não string exata.
    const out = formatDate("2026-01-15T12:00:00Z");
    expect(out).toMatch(/15/);
    expect(out).toMatch(/2026/);
  });

  it("aceita Date", () => {
    const out = formatDate(new Date("2026-06-01T12:00:00Z"));
    expect(out).toMatch(/2026/);
  });
});
