/**
 * Publica o COMMIT atual na Vercel (produção), não a pasta.
 *
 *   npm run deploy            → checa, publica e cria a tag deploy-AAAAMMDD-HHMM
 *   npm run deploy -- --dry-run → monta a cópia e para antes de publicar
 *
 * Por quê: o `vercel deploy` sobe a pasta inteira — mudança não commitada,
 * video/, .claude/ e o que mais estiver lá iam junto, e não havia como saber
 * qual commit estava no ar. Aqui o deploy sai de um worktree limpo do HEAD,
 * com só os .glb que o catálogo daquele commit usa (os .glb não estão no git).
 *
 * Token: VERCEL_TOKEN no ambiente ou em .env.local.
 */
import { execFileSync } from "node:child_process";
import { copyFileSync, cpSync, existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { requiredAssets } from "./check-assets.mjs";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const SCOPE = "pedrosoandres-projects";
const dryRun = process.argv.includes("--dry-run");

const git = (...args) => execFileSync("git", args, { cwd: ROOT, encoding: "utf8" }).trimEnd();
const run = (cmd, args, opts = {}) =>
  execFileSync(cmd, args, { stdio: "inherit", shell: process.platform === "win32", ...opts });

function fail(message) {
  console.error(`\ndeploy: ${message}`);
  process.exit(1);
}

function vercelToken() {
  if (process.env.VERCEL_TOKEN) return process.env.VERCEL_TOKEN;
  const envFile = path.join(ROOT, ".env.local");
  if (!existsSync(envFile)) return null;
  const line = readFileSync(envFile, "utf8").split(/\r?\n/).find((l) => l.startsWith("VERCEL_TOKEN="));
  return line ? line.slice("VERCEL_TOKEN=".length).trim() : null;
}

// 1. Só publica o que está commitado.
const dirty = git("status", "--porcelain", "--untracked-files=no");
if (dirty) fail(`há mudanças não commitadas:\n${dirty}\nCommite ou descarte antes de publicar.`);
const sha = git("rev-parse", "--short", "HEAD");
const branch = git("rev-parse", "--abbrev-ref", "HEAD");
if (branch !== "main") console.warn(`deploy: atenção, publicando a branch "${branch}" (não é a main).`);

const token = vercelToken();
if (!token && !dryRun) fail("VERCEL_TOKEN não encontrado (ambiente ou .env.local).");

// 2. Mesmos checks do CI.
console.log(`deploy: checando ${sha}…`);
run("npm", ["run", "check"], { cwd: ROOT });

// 3. Cópia limpa do commit + os assets que o catálogo dele usa.
// Sobra de uma tentativa anterior precisa sair, mas no Windows o OneDrive e o
// antivírus seguram arquivos e o apagar falha com EPERM. Antes isso derrubava
// o deploy inteiro. Agora tenta remover das três formas e, se ainda assim a
// pasta resistir, publica de uma pasta nova em vez de desistir.
const base = path.join(tmpdir(), `reparo360-deploy-${sha}`);
let dir = base;
try { git("worktree", "prune"); } catch { /* sem worktrees registrados */ }
if (existsSync(dir)) {
  try { git("worktree", "remove", "--force", dir); } catch { /* não era worktree */ }
  if (existsSync(dir)) try { rmSync(dir, { recursive: true, force: true }); } catch { /* travado */ }
  if (existsSync(dir)) {
    dir = `${base}-${Date.now().toString(36)}`;
    console.warn(`deploy: ${base} está travado pelo sistema; usando ${dir}.`);
  }
}
git("worktree", "add", "--detach", dir, "HEAD");

try {
  mkdirSync(path.join(dir, ".vercel"), { recursive: true });
  copyFileSync(path.join(ROOT, ".vercel", "project.json"), path.join(dir, ".vercel", "project.json"));
  cpSync(path.join(ROOT, "public", "hdri"), path.join(dir, "public", "hdri"), { recursive: true });

  const assets = requiredAssets(dir);
  for (const p of assets) {
    const to = path.join(dir, "public", p);
    mkdirSync(path.dirname(to), { recursive: true });
    copyFileSync(path.join(ROOT, "public", p), to);
  }
  const credits = path.join(ROOT, "public", "cars", "CREDITS.md");
  if (existsSync(credits)) copyFileSync(credits, path.join(dir, "public", "cars", "CREDITS.md"));
  console.log(`deploy: ${assets.length} arquivos 3D copiados pra ${dir}`);

  run("node", ["scripts/check-assets.mjs"], { cwd: dir });

  if (dryRun) {
    console.log("deploy: --dry-run, parando antes de publicar.");
  } else {
    // 4. Sem --archive: o caminho temporário não tem acento, e a Vercel
    // deduplica os .glb que já recebeu (sobe só o que mudou).
    run("npx", ["--yes", "vercel", "deploy", "--yes", "--prod", `--scope=${SCOPE}`], {
      cwd: dir,
      env: { ...process.env, VERCEL_TOKEN: token },
    });

    // 5. Marca o commit que foi pro ar.
    const stamp = new Date().toISOString().slice(0, 16).replace(/[-:]/g, "").replace("T", "-");
    const tag = `deploy-${stamp}`;
    git("tag", "-a", tag, "-m", `Produção na Vercel (${sha})`);
    console.log(`\ndeploy: publicado. Tag ${tag} criada; pra enviar: git push origin ${tag}`);
  }
} finally {
  try { git("worktree", "remove", "--force", dir); } catch { /* já removido */ }
}
