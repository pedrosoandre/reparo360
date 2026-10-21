import { describe, it, expect, vi, beforeEach } from "vitest";

// IndexedDB e canvas não existem no node: o armazenamento e o encoder do
// navegador são substituídos; a regra de aceitar/recusar é a real.
vi.mock("@/lib/blob-store", () => ({ putBlob: vi.fn(async () => "idb:teste") }));
vi.mock("@/lib/image-compress", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/image-compress")>()),
  compressImage: vi.fn(),
}));

import { fitWithin, compressImage } from "@/lib/image-compress";
import { filesToPhotos } from "@/lib/photos";
import { putBlob } from "@/lib/blob-store";

const MB = 1024 * 1024;
const file = (name: string, type: string, bytes: number) =>
  new File([new Uint8Array(bytes)], name, { type });

describe("fitWithin", () => {
  it("reduz mantendo a proporção pelo lado maior", () => {
    expect(fitWithin(4000, 3000, 1600)).toEqual({ width: 1600, height: 1200 });
    expect(fitWithin(3000, 4000, 1600)).toEqual({ width: 1200, height: 1600 });
  });

  it("não amplia foto menor que o limite", () => {
    expect(fitWithin(800, 600, 1600)).toEqual({ width: 800, height: 600 });
  });
});

describe("filesToPhotos", () => {
  beforeEach(() => {
    vi.mocked(putBlob).mockClear();
    vi.mocked(compressImage).mockReset();
  });

  it("aceita foto de celular de 5 MB guardando a versão comprimida", async () => {
    const pequena = new Blob([new Uint8Array(300 * 1024)], { type: "image/jpeg" });
    vi.mocked(compressImage).mockResolvedValue(pequena);
    const r = await filesToPhotos([file("carro.jpg", "image/jpeg", 5 * MB)], 6);
    expect(r.rejected).toEqual([]);
    expect(r.refs).toHaveLength(1);
    expect(putBlob).toHaveBeenCalledWith(pequena);
  });

  it("recusa formato que o navegador não abre (HEIC no Chrome) em vez de guardar cru", async () => {
    vi.mocked(compressImage).mockResolvedValue(null);
    const r = await filesToPhotos([file("IMG_0001.heic", "image/heic", 1 * MB)], 6);
    expect(r.refs).toEqual([]);
    expect(r.rejected[0].reason).toMatch(/formato/);
  });
});
