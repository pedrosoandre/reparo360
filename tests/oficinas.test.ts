import { describe, it, expect } from "vitest";
import { findCidade, rankOficinas, type Oficina, type OficinasCatalog } from "@/lib/oficinas";

const of = (over: Partial<Oficina> = {}): Oficina => ({
  nome: over.nome ?? "Oficina X",
  cidade: over.cidade ?? "Porto Alegre",
  endereco: "Rua qualquer",
  telefone: "5199999",
  waId: over.waId ?? null,
  rating: over.rating ?? null,
  reviews: over.reviews ?? 0,
  categorias: [],
  mapsUrl: "https://maps",
});

describe("findCidade", () => {
  const cat: OficinasCatalog = {
    meta: { totalOficinas: 0, totalCidades: 0, geradoEm: "", fonte: "" },
    cidades: [
      { nome: "Porto Alegre", total: 0, comRating: 0, oficinas: [] },
      { nome: "Canoas", total: 0, comRating: 0, oficinas: [] },
    ],
  };

  it("acha por igualdade exata", () => {
    expect(findCidade(cat, "Canoas")?.nome).toBe("Canoas");
  });

  it("ignora caixa e espaços em volta", () => {
    expect(findCidade(cat, "  porto alegre  ")?.nome).toBe("Porto Alegre");
  });

  it("cidade fora do catálogo devolve undefined", () => {
    expect(findCidade(cat, "Curitiba")).toBeUndefined();
  });
});

describe("rankOficinas", () => {
  it("prefere rating alto e desempata por número de reviews", () => {
    const list = [
      of({ nome: "A", rating: 4.5, reviews: 10 }),
      of({ nome: "B", rating: 4.8, reviews: 100 }),
      of({ nome: "C", rating: 4.8, reviews: 5 }),
    ];
    const { top } = rankOficinas(list, 10);
    expect(top.map((o) => o.nome)).toEqual(["B", "C", "A"]);
  });

  it("oficinas sem rating vão pra 'outras', ordenadas alfabeticamente", () => {
    const list = [
      of({ nome: "Zulu", rating: null }),
      of({ nome: "Alfa", rating: null }),
      of({ nome: "Bravo", rating: 4.0, reviews: 10 }),
    ];
    const { top, outras } = rankOficinas(list, 10);
    expect(top.map((o) => o.nome)).toEqual(["Bravo"]);
    expect(outras.map((o) => o.nome)).toEqual(["Alfa", "Zulu"]);
  });

  it("respeita o topN e joga o excedente com rating pra 'outras' antes das sem rating", () => {
    const list = [
      of({ nome: "R1", rating: 5, reviews: 10 }),
      of({ nome: "R2", rating: 5, reviews: 8 }),
      of({ nome: "R3", rating: 4, reviews: 20 }),
      of({ nome: "S1", rating: null }),
    ];
    const { top, outras } = rankOficinas(list, 2);
    expect(top.map((o) => o.nome)).toEqual(["R1", "R2"]);
    // R3 (com rating) vem antes de S1 (sem rating), mesmo tendo caído do topN.
    expect(outras.map((o) => o.nome)).toEqual(["R3", "S1"]);
  });

  it("catálogo vazio não quebra", () => {
    const { top, outras } = rankOficinas([]);
    expect(top).toEqual([]);
    expect(outras).toEqual([]);
  });
});
