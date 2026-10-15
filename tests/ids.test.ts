import { describe, it, expect } from "vitest";
import { uid, budgetCode, fakeHash } from "@/lib/ids";

describe("uid", () => {
  it("sem prefixo devolve string curta e não vazia", () => {
    const id = uid();
    expect(id).toMatch(/^[a-z0-9]+$/);
    expect(id.length).toBeGreaterThan(4);
  });

  it("com prefixo separa por underscore", () => {
    const id = uid("veh");
    expect(id.startsWith("veh_")).toBe(true);
  });

  it("gera IDs diferentes em execuções seguidas (o time mudou ou o random mudou)", () => {
    const s = new Set(Array.from({ length: 50 }, () => uid()));
    expect(s.size).toBe(50);
  });
});

describe("budgetCode", () => {
  it("segue o padrão R360-XXXXX", () => {
    const code = budgetCode();
    expect(code).toMatch(/^R360-[A-Z0-9]{5}$/);
  });

  it("nunca usa caracteres ambíguos (I, L, O, 0, 1)", () => {
    // 500 códigos = ~2500 caracteres — cobre a chance de um ambíguo escapar.
    const AMBIG = /[ILO01]/;
    for (let i = 0; i < 500; i++) {
      const c = budgetCode().slice(5);
      expect(AMBIG.test(c)).toBe(false);
    }
  });
});

describe("fakeHash", () => {
  it("mesma entrada → mesmo hash (determinístico)", () => {
    expect(fakeHash("segredo")).toBe(fakeHash("segredo"));
  });

  it("entradas diferentes → hashes diferentes", () => {
    expect(fakeHash("a")).not.toBe(fakeHash("b"));
  });

  it("nunca devolve número negativo em string", () => {
    // O bit-shift `>>> 0` no fim garante unsigned — regressão sutil se remover.
    for (const s of ["", "abc", "\u{1F600}", "1234567890".repeat(20)]) {
      const h = fakeHash(s);
      expect(h.startsWith("-")).toBe(false);
    }
  });

  it("input vazio ainda produz saída válida", () => {
    expect(fakeHash("").length).toBeGreaterThan(0);
  });
});
