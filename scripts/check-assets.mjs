/**
 * Roda antes do `next build` (ver `package.json`). Sem `NEXT_PUBLIC_ASSETS_BASE`,
 * o app busca os .glb do próprio deploy — então todo cenário de `lib/scenery.ts`
 * e todo carro de `lib/vehicles.ts` precisa existir em `public/`. Se faltar
 * algum, o build falha e a produção atual continua no ar.
 *
 * Motivo: em 15/10/2026 um deploy subiu sem os .glb (o `.vercelignore`
 * excluía `public/cars|scenery`), todo modelo 3D deu 404 e o navegador de
 * quem abriu o site naquela janela guardou o 404 em cache.
 */
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

/**
 * Paths públicos (`/scenery/x.glb`, `/cars/y.glb`) que os catálogos usam.
 * @param {string} root raiz do projeto
 * @returns {string[]}
 */
export function requiredAssets(root) {
  const scenery = readFileSync(path.join(root, "lib", "scenery.ts"), "utf8");
  const vehicles = readFileSync(path.join(root, "lib", "vehicles.ts"), "utf8");
  const sceneryFiles = [...scenery.matchAll(/file:\s*"(\/scenery\/[^"]+)"/g)].map((m) => m[1]);
  const carFiles = [...vehicles.matchAll(/glb:\s*"([^"]+\.glb)"/g)].map((m) => `/cars/${m[1]}`);
  return [...new Set([...sceneryFiles, ...carFiles])];
}

/**
 * @param {string} root raiz do projeto
 * @param {string[]} paths paths públicos, ex. `/cars/fiat-uno.glb`
 * @returns {string[]} os que não existem em `public/`
 */
export function missingAssets(root, paths) {
  return paths.filter((p) => !existsSync(path.join(root, "public", p)));
}

/**
 * @param {{ root: string, assetsBase: string | undefined }} opts
 * @returns {{ ok: boolean, message: string }}
 */
export function checkAssets({ root, assetsBase }) {
  if (assetsBase && assetsBase.trim()) {
    return { ok: true, message: `assets: servidos de ${assetsBase.trim()}, sem checagem local` };
  }
  const required = requiredAssets(root);
  const hasScenery = required.some((p) => p.startsWith("/scenery/"));
  const hasCars = required.some((p) => p.startsWith("/cars/"));
  if (!hasScenery || !hasCars) {
    return {
      ok: false,
      message:
        "assets: não achei os .glb em lib/scenery.ts ou lib/vehicles.ts. " +
        "O formato dos catálogos mudou? Ajuste scripts/check-assets.mjs.",
    };
  }
  const missing = missingAssets(root, required);
  if (missing.length > 0) {
    const shown = missing.slice(0, 10).map((p) => `  public${p}`).join("\n");
    const more = missing.length > 10 ? `\n  … e mais ${missing.length - 10}` : "";
    return {
      ok: false,
      message:
        `assets: ${missing.length} de ${required.length} arquivos 3D faltando e ` +
        `NEXT_PUBLIC_ASSETS_BASE está vazia.\n${shown}${more}\n` +
        "Confira se o .vercelignore não está excluindo public/cars ou public/scenery.",
    };
  }
  return { ok: true, message: `assets: ${required.length} arquivos 3D em public/` };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const root = fileURLToPath(new URL("..", import.meta.url));
  const result = checkAssets({ root, assetsBase: process.env.NEXT_PUBLIC_ASSETS_BASE });
  if (result.ok) {
    console.log(result.message);
  } else {
    console.error(result.message);
    process.exit(1);
  }
}
