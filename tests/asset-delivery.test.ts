import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import nextConfig from "@/next.config.mjs";
import { requiredAssets, missingAssets, checkAssets } from "@/scripts/check-assets.mjs";

/**
 * Em 15/10/2026 um deploy subiu sem os .glb (o `.vercelignore` excluía
 * `public/cars|scenery` e não havia `NEXT_PUBLIC_ASSETS_BASE`). O 404 saiu com
 * `immutable` de 1 ano e ficou preso no Chrome de quem abriu o site naquela
 * janela. Estes testes travam as duas pontas: cache curto e build que falha.
 */

describe("cache dos assets 3D", () => {
  it("não usa immutable nem cache longo (vale também pro 404)", async () => {
    const rules = (await nextConfig.headers?.()) ?? [];
    const rule = rules.find((r) => r.source.includes("scenery"));
    expect(rule).toBeDefined();
    const value = rule!.headers.find((h) => h.key.toLowerCase() === "cache-control")?.value ?? "";
    expect(value).not.toMatch(/immutable/);
    const maxAge = Number(/max-age=(\d+)/.exec(value)?.[1]);
    expect(maxAge).toBeGreaterThan(0);
    expect(maxAge).toBeLessThanOrEqual(86400);
  });
});

describe("requiredAssets", () => {
  it("lê cenários e carros dos catálogos do projeto", () => {
    const list = requiredAssets(path.resolve(import.meta.dirname, ".."));
    expect(list).toContain("/scenery/brutalist-interior.glb");
    expect(list).toContain("/scenery/garage-desert.glb");
    expect(list).toContain("/cars/fiat-uno.glb");
    expect(list.filter((p) => p.startsWith("/cars/")).length).toBeGreaterThan(100);
  });
});

describe("checagem de assets no build", () => {
  let root: string;

  beforeEach(() => {
    root = mkdtempSync(path.join(tmpdir(), "reparo360-assets-"));
    mkdirSync(path.join(root, "lib"));
    mkdirSync(path.join(root, "public", "scenery"), { recursive: true });
    mkdirSync(path.join(root, "public", "cars"), { recursive: true });
    writeFileSync(
      path.join(root, "lib", "scenery.ts"),
      `export const SCENERY_CATALOG = [{ id: "a", file: "/scenery/a.glb" }];`,
    );
    writeFileSync(
      path.join(root, "lib", "vehicles.ts"),
      `export const VEHICLE_CATALOG = [{ glb: "x.glb" }, { glb: "y.glb" }];`,
    );
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it("missingAssets aponta só o que não está em public/", () => {
    writeFileSync(path.join(root, "public", "scenery", "a.glb"), "");
    writeFileSync(path.join(root, "public", "cars", "x.glb"), "");
    expect(missingAssets(root, requiredAssets(root))).toEqual(["/cars/y.glb"]);
  });

  it("sem ASSETS_BASE e com arquivo faltando, falha", () => {
    writeFileSync(path.join(root, "public", "scenery", "a.glb"), "");
    const r = checkAssets({ root, assetsBase: "" });
    expect(r.ok).toBe(false);
    expect(r.message).toContain("/cars/x.glb");
  });

  it("sem ASSETS_BASE e com tudo no lugar, passa", () => {
    for (const f of ["scenery/a.glb", "cars/x.glb", "cars/y.glb"]) {
      writeFileSync(path.join(root, "public", f), "");
    }
    expect(checkAssets({ root, assetsBase: undefined }).ok).toBe(true);
  });

  it("com ASSETS_BASE, não exige os arquivos locais", () => {
    expect(checkAssets({ root, assetsBase: "https://cdn.exemplo.com" }).ok).toBe(true);
  });

  it("catálogo ilegível falha em vez de passar calado", () => {
    writeFileSync(path.join(root, "lib", "scenery.ts"), "export const SCENERY_CATALOG = [];");
    writeFileSync(path.join(root, "lib", "vehicles.ts"), "export const VEHICLE_CATALOG = [];");
    expect(checkAssets({ root, assetsBase: "" }).ok).toBe(false);
  });
});
