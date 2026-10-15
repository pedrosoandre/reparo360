/**
 * Resolve URL de asset estático pesado (GLB de carro, cenário, HDRI).
 *
 * Motivação: `public/cars/` sozinho tem ~1.8 GB de modelos glb. Em dev,
 * `/cars/foo.glb` serve direto do filesystem — rápido e sem CORS. Em produção
 * (Vercel Hobby/Pro), commitar 1.8 GB de binário no repo é inviável.
 *
 * Solução: quando `NEXT_PUBLIC_ASSETS_BASE` está definida, ela prefixa o path
 * do asset. Aponte pro Vercel Blob, R2, S3, ou qualquer CDN que sirva CORS.
 * Deixando vazia, tudo continua servido do `public/` local — o dev não muda.
 *
 * Exemplo de valor em produção:
 *   NEXT_PUBLIC_ASSETS_BASE=https://cdn.reparo360.app
 */

/** Retira barra final pra não gerar `//cars/`. */
function normalizeBase(v: string | undefined): string {
  if (!v) return "";
  return v.endsWith("/") ? v.slice(0, -1) : v;
}

const BASE = normalizeBase(process.env.NEXT_PUBLIC_ASSETS_BASE);

/** Prefixa o path do asset com a base configurada. */
export function assetUrl(path: string): string {
  const clean = path.startsWith("/") ? path : `/${path}`;
  return `${BASE}${clean}`;
}
