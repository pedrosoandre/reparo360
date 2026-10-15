/**
 * Consulta de valor de mercado na tabela FIPE.
 *
 * Usa a API pública em parallelum.com.br, que expõe a FIPE em quatro níveis:
 * marcas → modelos → anos → valor. Uma consulta completa gasta 4 requisições
 * e o limite sem token é 500/dia — por isso tudo aqui é cacheado, inclusive
 * as falhas (senão os modelos que não existem na FIPE queimam a cota a cada
 * render).
 *
 * Só roda no servidor: a rota /api/fipe é o único consumidor.
 */

const BASE = "https://parallelum.com.br/fipe/api/v1/carros";
const TIMEOUT_MS = 8000;

/**
 * Modelos populares têm dezenas de versões na FIPE. Varremos em lotes e
 * paramos assim que uma cobre o ano exato — o caso comum resolve no primeiro
 * lote. O teto evita que um modelo patológico queime a cota inteira.
 */
const CANDIDATE_BATCH = 8;
const MAX_CANDIDATES = 40;

/**
 * Diferença máxima de ano aceitável. Acima disso o valor é de outra geração
 * do carro e mente mais do que ajuda — melhor devolver "não encontrado" e
 * deixar o cálculo cair na heurística de categoria/marca.
 */
const MAX_YEAR_GAP = 2;

/** Catálogo muda pouco; valor é republicado uma vez por mês. */
const TTL_CATALOG = 24 * 60 * 60 * 1000;
const TTL_VALUE = 12 * 60 * 60 * 1000;
/** Falha de match não muda até alguém mexer no catálogo — não insista. */
const TTL_MISS = 6 * 60 * 60 * 1000;

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

const cache = new Map<string, CacheEntry<unknown>>();

function cached<T>(key: string): T | undefined {
  const hit = cache.get(key);
  if (!hit) return undefined;
  if (Date.now() > hit.expiresAt) {
    cache.delete(key);
    return undefined;
  }
  return hit.value as T;
}

function store<T>(key: string, value: T, ttl: number): T {
  cache.set(key, { value, expiresAt: Date.now() + ttl });
  return value;
}

/** Última cota reportada pela API — útil pra diagnosticar antes de estourar. */
let lastQuota: { limit: number; remaining: number } | null = null;

export function fipeQuota() {
  return lastQuota;
}

async function getJson<T>(path: string): Promise<T> {
  const token = process.env.FIPE_TOKEN;

  const res = await fetch(`${BASE}${path}`, {
    signal: AbortSignal.timeout(TIMEOUT_MS),
    headers: {
      accept: "application/json",
      // Sem token são 500 req/dia num pool compartilhado com todo mundo;
      // com token, 1000 exclusivas.
      ...(token ? { "X-Subscription-Token": token } : {}),
    },
  });

  const limit = Number.parseInt(res.headers.get("x-ratelimit-limit") ?? "", 10);
  const remaining = Number.parseInt(res.headers.get("x-ratelimit-remaining") ?? "", 10);
  if (Number.isFinite(limit) && Number.isFinite(remaining)) {
    lastQuota = { limit, remaining };
  }

  if (!res.ok) {
    throw new FipeError(
      res.status === 429
        ? `Cota diária da API FIPE esgotada${lastQuota ? ` (${lastQuota.limit}/dia)` : ""}.`
        : `FIPE respondeu ${res.status} em ${path}`,
      res.status === 429 ? "quota" : "upstream",
    );
  }
  return (await res.json()) as T;
}

export class FipeError extends Error {
  constructor(
    message: string,
    readonly kind: "quota" | "upstream" | "timeout",
  ) {
    super(message);
  }
}

/** Sem acento, minúsculo, sem pontuação, espaços colapsados. */
export function normalize(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** "R$ 66.489,00" → 66489 */
export function parseBRL(v: string): number | null {
  const digits = v.replace(/[^\d,.-]/g, "").replace(/\./g, "").replace(",", ".");
  const n = Number.parseFloat(digits);
  return Number.isFinite(n) ? n : null;
}

interface FipeBrand {
  codigo: string;
  nome: string;
}
interface FipeModel {
  codigo: number;
  nome: string;
}
interface FipeYear {
  codigo: string;
  nome: string;
}
interface FipeValue {
  Valor: string;
  Marca: string;
  Modelo: string;
  AnoModelo: number;
  Combustivel: string;
  CodigoFipe: string;
  MesReferencia: string;
}

export interface FipeLookup {
  /** Valor de mercado em BRL. */
  marketValue: number;
  /** O que a FIPE realmente casou — pra o usuário conferir se bate. */
  matched: { brand: string; model: string; year: number; fuel: string };
  fipeCode: string;
  reference: string;
  /** true quando o ano exato não existia e caímos no mais próximo. */
  yearApproximated: boolean;
}

/**
 * A FIPE nomeia marca de forma inconsistente ("GM - Chevrolet", "VW - VolksWagen",
 * "ASTON MARTIN"). Casamos por igualdade normalizada e, falhando, por conter o
 * nome como sequência de tokens.
 */
export function matchBrand(brands: FipeBrand[], query: string): FipeBrand | null {
  const q = normalize(query);
  if (!q) return null;

  const exact = brands.find((b) => normalize(b.nome) === q);
  if (exact) return exact;

  const contains = brands.filter((b) => {
    const n = normalize(b.nome);
    return n === q || n.endsWith(` ${q}`) || n.startsWith(`${q} `) || n.includes(` ${q} `);
  });
  return contains[0] ?? null;
}

/**
 * Nomes de modelo na FIPE trazem versão completa ("500 Cabrio Dualogic Flex
 * 1.4 8V") enquanto o catálogo tem só a família ("500"). Casamos por prefixo
 * de token e escolhemos o nome mais curto — que é a versão base, o proxy mais
 * honesto pro modelo quando não sabemos a versão do cliente.
 */
export function candidateModels(models: FipeModel[], query: string): FipeModel[] {
  const q = normalize(query);
  if (!q) return [];

  const exact = models.filter((m) => normalize(m.nome) === q);
  if (exact.length) return exact;

  const prefix = models.filter((m) => {
    const n = normalize(m.nome);
    return n === q || n.startsWith(`${q} `);
  });
  const pool = prefix.length
    ? prefix
    : models.filter((m) => normalize(m.nome).includes(` ${q} `));

  // Nome curto = versão base, o proxy mais honesto quando não sabemos a versão
  // do cliente. Mas é só o desempate: quem manda é cobrir o ano pedido.
  return [...pool].sort((a, b) => a.nome.length - b.nome.length).slice(0, MAX_CANDIDATES);
}

/** Códigos de ano são "2014-5"; "32000-x" é o marcador de zero-km. */
export function yearOf(code: string): number {
  const raw = Number.parseInt(code.split("-")[0] ?? "", 10);
  if (!Number.isFinite(raw)) return Number.NaN;
  return raw === 32000 ? new Date().getFullYear() : raw;
}

export function matchYear(years: FipeYear[], target: number): { entry: FipeYear; exact: boolean } | null {
  if (!years.length) return null;

  const exact = years.find((y) => yearOf(y.codigo) === target);
  if (exact) return { entry: exact, exact: true };

  const sorted = [...years]
    .map((y) => ({ y, diff: Math.abs(yearOf(y.codigo) - target) }))
    .filter((x) => Number.isFinite(x.diff))
    .sort((a, b) => a.diff - b.diff);

  return sorted.length ? { entry: sorted[0].y, exact: false } : null;
}

/**
 * Retorna null quando o veículo simplesmente não existe na FIPE (carro de
 * corrida, conceito, modelo importado fora de tabela). Quem chama deve cair
 * na heurística de categoria/marca, não tratar isso como erro.
 */
export async function lookupFipe(
  brandName: string,
  modelName: string,
  year: number,
): Promise<FipeLookup | null> {
  const key = `lookup:${normalize(brandName)}|${normalize(modelName)}|${year}`;
  const hit = cached<FipeLookup | null>(key);
  if (hit !== undefined) return hit;

  const brands =
    cached<FipeBrand[]>("brands") ??
    store("brands", await getJson<FipeBrand[]>("/marcas"), TTL_CATALOG);

  const brand = matchBrand(brands, brandName);
  if (!brand) return store(key, null, TTL_MISS);

  const modelsKey = `models:${brand.codigo}`;
  const models =
    cached<FipeModel[]>(modelsKey) ??
    store(
      modelsKey,
      (await getJson<{ modelos: FipeModel[] }>(`/marcas/${brand.codigo}/modelos`)).modelos,
      TTL_CATALOG,
    );

  const candidates = candidateModels(models, modelName);
  if (!candidates.length) return store(key, null, TTL_MISS);

  // Buscamos os anos de cada versão candidata e escolhemos a que realmente
  // cobre o ano pedido — não a de nome mais bonito.
  type Viable = { model: FipeModel; entry: FipeYear; exact: boolean; gap: number };
  const viable: Viable[] = [];

  for (let i = 0; i < candidates.length; i += CANDIDATE_BATCH) {
    const batch = candidates.slice(i, i + CANDIDATE_BATCH);

    const results = await Promise.all(
      batch.map(async (m) => {
        const yearsKey = `years:${brand.codigo}:${m.codigo}`;
        const years =
          cached<FipeYear[]>(yearsKey) ??
          store(
            yearsKey,
            await getJson<FipeYear[]>(`/marcas/${brand.codigo}/modelos/${m.codigo}/anos`),
            TTL_CATALOG,
          );
        const match = matchYear(years, year);
        return match ? { model: m, ...match } : null;
      }),
    );

    for (const r of results) {
      if (!r) continue;
      const gap = Math.abs(yearOf(r.entry.codigo) - year);
      if (gap <= MAX_YEAR_GAP) viable.push({ ...r, gap });
    }

    // Ano exato encontrado: não há o que melhorar varrendo o resto.
    if (viable.some((v) => v.exact)) break;
  }

  // Menor distância de ano manda; nome mais curto (versão base) desempata.
  viable.sort((a, b) => a.gap - b.gap || a.model.nome.length - b.model.nome.length);

  const best = viable[0];
  if (!best) return store(key, null, TTL_MISS);

  const value = await getJson<FipeValue>(
    `/marcas/${brand.codigo}/modelos/${best.model.codigo}/anos/${best.entry.codigo}`,
  );

  const marketValue = parseBRL(value.Valor);
  if (marketValue === null) return store(key, null, TTL_MISS);

  return store(
    key,
    {
      marketValue,
      matched: {
        brand: value.Marca,
        model: value.Modelo,
        year: value.AnoModelo,
        fuel: value.Combustivel,
      },
      fipeCode: value.CodigoFipe,
      reference: value.MesReferencia,
      yearApproximated: !best.exact,
    },
    TTL_VALUE,
  );
}
