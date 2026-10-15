/**
 * Catálogo de oficinas do RS coletado do Google Maps.
 *
 * Fonte: `public/data/oficinas-rs.json` (5-6 MB), gerado por
 * `oficinas-rs-scraper/export_json.py`. Carregado sob demanda no primeiro
 * uso (fetch + cache module-level) — não entra no bundle inicial.
 */
export interface Oficina {
  nome: string;
  cidade: string;
  endereco: string;
  telefone: string;
  /** Número em formato E.164 sem `+` (ex.: "5551993316493"), pronto pra `wa.me/`. */
  waId: string | null;
  rating: number | null;
  reviews: number;
  categorias: string[];
  mapsUrl: string;
}

export interface CidadeOficinas {
  nome: string;
  total: number;
  comRating: number;
  oficinas: Oficina[];
}

export interface OficinasCatalog {
  meta: {
    totalOficinas: number;
    totalCidades: number;
    geradoEm: string;
    fonte: string;
  };
  cidades: CidadeOficinas[];
}

let cache: OficinasCatalog | null = null;
let inflight: Promise<OficinasCatalog> | null = null;

export async function loadOficinasCatalog(): Promise<OficinasCatalog> {
  if (cache) return cache;
  if (inflight) return inflight;
  inflight = fetch("/data/oficinas-rs.json")
    .then((r) => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.json() as Promise<OficinasCatalog>;
    })
    .then((json) => {
      cache = json;
      inflight = null;
      return json;
    })
    .catch((e) => {
      inflight = null;
      throw e;
    });
  return inflight;
}

export function findCidade(catalog: OficinasCatalog, nome: string): CidadeOficinas | undefined {
  const target = nome.trim().toLowerCase();
  return catalog.cidades.find((c) => c.nome.toLowerCase() === target);
}

/**
 * Ranking dentro de uma cidade:
 *   1. As com rating: por rating desc, empate por número de reviews desc.
 *      Retorna as `topN` melhores (default 10).
 *   2. As sem rating: em seguida, ordenadas alfabeticamente.
 */
export function rankOficinas(oficinas: Oficina[], topN = 10): {
  top: Oficina[];
  outras: Oficina[];
} {
  const comRating = oficinas
    .filter((o) => o.rating !== null)
    .sort((a, b) => {
      const ra = a.rating ?? 0;
      const rb = b.rating ?? 0;
      if (rb !== ra) return rb - ra;
      return (b.reviews ?? 0) - (a.reviews ?? 0);
    });
  const semRating = oficinas
    .filter((o) => o.rating === null)
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));

  return {
    top: comRating.slice(0, topN),
    outras: [...comRating.slice(topN), ...semRating],
  };
}
