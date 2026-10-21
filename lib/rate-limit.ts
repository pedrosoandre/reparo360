/**
 * Limite de pedidos por chave (IP) numa janela deslizante, em memória.
 *
 * Em serverless cada instância tem a própria memória, então isto não é um
 * teto global — é o freio contra alguém martelando a rota (cada análise por
 * IA custa dinheiro). Um teto global de verdade precisa de um store
 * compartilhado (KV/Redis) ou de regra no firewall da Vercel.
 */
export interface RateLimiter {
  check(key: string, now?: number): { ok: boolean; retryAfterSec: number };
}

/** Acima disso descarta as chaves mais antigas pra não crescer sem fim. */
const MAX_KEYS = 5000;

export function createRateLimiter(opts: { limit: number; windowMs: number }): RateLimiter {
  const hits = new Map<string, number[]>();

  return {
    check(key, now = Date.now()) {
      const since = now - opts.windowMs;
      const recent = (hits.get(key) ?? []).filter((t) => t > since);
      if (recent.length >= opts.limit) {
        hits.set(key, recent);
        return { ok: false, retryAfterSec: Math.ceil((recent[0] + opts.windowMs - now) / 1000) };
      }
      recent.push(now);
      hits.delete(key); // reinsere no fim: o Map fica em ordem de uso
      hits.set(key, recent);
      if (hits.size > MAX_KEYS) hits.delete(hits.keys().next().value!);
      return { ok: true, retryAfterSec: 0 };
    },
  };
}
