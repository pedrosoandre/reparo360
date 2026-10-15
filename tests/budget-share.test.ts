import { describe, it, expect } from "vitest";
import {
  toBase64Url,
  fromBase64Url,
  toShareable,
  whatsappMessage,
  whatsappLink,
  publicBudgetUrl,
  signPayload,
  verifyPayload,
  readPublicBudget,
} from "@/lib/budget-share";
import type { Budget } from "@/types";

const BUDGET: Budget = {
  id: "b1",
  code: "R360-A3F9K",
  userId: "u1",
  vehicleId: "v1",
  vehicleSnapshot: {
    brand: "Fiat",
    model: "Uno",
    year: 2015,
    glb: "uno.glb",
    category: "hatchback",
  },
  customerName: "Maria",
  customerPhone: "5551999999999",
  items: [
    {
      id: "i1",
      part: "hood",
      partLabel: "Capô",
      damages: ["scratch_deep"],
      severity: "medium",
      estimatedCost: 800,
    },
    {
      id: "i2",
      part: "front_bumper",
      partLabel: "Para-choque dianteiro",
      damages: ["break"],
      severity: "high",
      estimatedCost: 1200,
    },
  ],
  extras: [
    { id: "e1", kind: "oil_change", label: "Troca de óleo", price: 149, addedAt: "2026-01-01" },
  ],
  photos: [],
  subtotal: 2000,
  laborTotal: 800,
  paintTotal: 300,
  partsTotal: 700,
  materialsTotal: 100,
  marginTotal: 100,
  total: 2000,
  confidence: 80,
  pricingVersion: "1.0.0",
  status: "draft",
  source: "wizard",
  createdAt: "2026-01-15T12:00:00Z",
  updatedAt: "2026-01-15T12:00:00Z",
};

describe("base64url roundtrip", () => {
  it("recupera o mesmo objeto", () => {
    const obj = { a: 1, b: "olá 🚗", c: [1, 2, 3] };
    expect(fromBase64Url(toBase64Url(obj))).toEqual(obj);
  });

  it("usa alfabeto url-safe (sem +, /, =)", () => {
    // JSON com muitos caracteres não-ASCII pra forçar padding e chars especiais.
    const s = toBase64Url({ p: "ção áéíóú çãõ".repeat(20) });
    expect(s).not.toMatch(/[+/=]/);
  });

  it("aguenta payload grande de orçamento sem estourar", () => {
    const share = toShareable(BUDGET);
    const round = fromBase64Url(toBase64Url(share));
    expect(round).toEqual(share);
  });
});

describe("toShareable", () => {
  it("resume itens com label + danos + custo", () => {
    const s = toShareable(BUDGET);
    expect(s.items).toHaveLength(2);
    expect(s.items[0].label).toBe("Capô");
    expect(s.items[0].damages[0]).toBe("Arranhão profundo"); // vindo de DAMAGE_LABELS
  });

  it("soma extras separado do reparo", () => {
    const s = toShareable(BUDGET);
    expect(s.totalRepair).toBe(2000);
    expect(s.totalExtras).toBe(149);
    expect(s.grandTotal).toBe(2149);
  });

  it("sem extras não quebra", () => {
    const s = toShareable({ ...BUDGET, extras: undefined });
    expect(s.totalExtras).toBe(0);
    expect(s.grandTotal).toBe(s.totalRepair);
  });
});

describe("whatsappMessage", () => {
  it("inclui código, veículo, itens e link público", () => {
    const msg = whatsappMessage(BUDGET, "Oficina do João", "https://reparo360.app/o/R360-A3F9K?d=abc");
    expect(msg).toContain("Oficina do João");
    expect(msg).toContain("R360-A3F9K");
    expect(msg).toContain("Fiat Uno 2015");
    expect(msg).toContain("Capô");
    expect(msg).toContain("Troca de óleo");
    expect(msg).toContain("https://reparo360.app/o/R360-A3F9K?d=abc");
  });

  it("assina com nome do cliente quando disponível", () => {
    const msg = whatsappMessage(BUDGET, "X", "https://y");
    expect(msg).toContain("— Maria");
  });
});

describe("whatsappLink", () => {
  it("codifica o texto na querystring", () => {
    const link = whatsappLink("5551999999999", "Olá, tudo bem?");
    expect(link).toBe("https://wa.me/5551999999999?text=Ol%C3%A1%2C%20tudo%20bem%3F");
  });
});

describe("publicBudgetUrl", () => {
  it("põe payload em ?d= e assinatura em &s=", () => {
    const url = publicBudgetUrl(BUDGET, "https://reparo360.app");
    expect(url.startsWith("https://reparo360.app/o/R360-A3F9K?d=")).toBe(true);
    expect(url).toMatch(/&s=[a-z0-9]+$/);

    const u = new URL(url);
    const d = u.searchParams.get("d")!;
    const back = fromBase64Url<ReturnType<typeof toShareable>>(d);
    expect(back.code).toBe("R360-A3F9K");
    expect(back.grandTotal).toBe(2149);
  });
});

describe("integridade do link", () => {
  it("signPayload é determinístico", () => {
    expect(signPayload("abc")).toBe(signPayload("abc"));
  });

  it("payloads diferentes → assinaturas diferentes", () => {
    expect(signPayload("abc")).not.toBe(signPayload("abd"));
  });

  it("verifyPayload aceita a mesma assinatura e recusa mudança de 1 char", () => {
    const p = "eyJoZWxsbyI6ICJ3b3JsZCJ9";
    const sig = signPayload(p);
    expect(verifyPayload(p, sig)).toBe(true);
    expect(verifyPayload(p + "x", sig)).toBe(false);
  });

  it("readPublicBudget devolve verified=true no fluxo normal", () => {
    const url = publicBudgetUrl(BUDGET, "https://reparo360.app");
    const u = new URL(url);
    const out = readPublicBudget(u.searchParams.get("d"), u.searchParams.get("s"))!;
    expect(out.verified).toBe(true);
    expect(out.budget.code).toBe("R360-A3F9K");
  });

  it("readPublicBudget recusa payload adulterado (assinatura não bate)", () => {
    const url = publicBudgetUrl(BUDGET, "https://reparo360.app");
    const u = new URL(url);
    // Payload modificado, assinatura antiga: deve recusar.
    const forged = toBase64Url({ ...toShareable(BUDGET), grandTotal: 1 });
    expect(readPublicBudget(forged, u.searchParams.get("s"))).toBeNull();
  });

  it("readPublicBudget aceita link legado sem assinatura mas marca verified=false", () => {
    const payload = toBase64Url(toShareable(BUDGET));
    const out = readPublicBudget(payload, null)!;
    expect(out.verified).toBe(false);
    expect(out.budget.code).toBe("R360-A3F9K");
  });

  it("readPublicBudget devolve null quando falta o payload", () => {
    expect(readPublicBudget(null, null)).toBeNull();
    expect(readPublicBudget("", null)).toBeNull();
  });

  it("readPublicBudget devolve null quando o base64 é lixo", () => {
    expect(readPublicBudget("!!!not-base64!!!", null)).toBeNull();
  });
});
