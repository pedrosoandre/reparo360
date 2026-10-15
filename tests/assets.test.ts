import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

/**
 * `lib/assets.ts` lê `process.env.NEXT_PUBLIC_ASSETS_BASE` na hora do import,
 * então cada cenário precisa `resetModules` + `vi.stubEnv` antes de importar.
 */

describe("assetUrl", () => {
  const ORIGINAL = process.env.NEXT_PUBLIC_ASSETS_BASE;

  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    if (ORIGINAL === undefined) delete process.env.NEXT_PUBLIC_ASSETS_BASE;
    else process.env.NEXT_PUBLIC_ASSETS_BASE = ORIGINAL;
  });

  it("sem base configurada, devolve o path do público como veio (dev mode)", async () => {
    delete process.env.NEXT_PUBLIC_ASSETS_BASE;
    const { assetUrl } = await import("@/lib/assets");
    expect(assetUrl("/cars/fiat-uno.glb")).toBe("/cars/fiat-uno.glb");
  });

  it("com base configurada, prefixa a URL", async () => {
    process.env.NEXT_PUBLIC_ASSETS_BASE = "https://cdn.reparo360.app";
    const { assetUrl } = await import("@/lib/assets");
    expect(assetUrl("/cars/fiat-uno.glb")).toBe("https://cdn.reparo360.app/cars/fiat-uno.glb");
  });

  it("base terminando em / não gera // no meio", async () => {
    process.env.NEXT_PUBLIC_ASSETS_BASE = "https://cdn.reparo360.app/";
    const { assetUrl } = await import("@/lib/assets");
    expect(assetUrl("/hdri/x.hdr")).toBe("https://cdn.reparo360.app/hdri/x.hdr");
  });

  it("path sem barra inicial ainda funciona", async () => {
    process.env.NEXT_PUBLIC_ASSETS_BASE = "https://cdn.reparo360.app";
    const { assetUrl } = await import("@/lib/assets");
    expect(assetUrl("scenery/brutalist.glb")).toBe(
      "https://cdn.reparo360.app/scenery/brutalist.glb",
    );
  });
});
