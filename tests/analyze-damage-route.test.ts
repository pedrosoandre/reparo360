import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

/**
 * Proteções da rota de análise por IA que rodam ANTES de chamar a Anthropic:
 * nenhum destes casos chega na API (sem rede, sem custo).
 */

const ORIGINAL_KEY = process.env.ANTHROPIC_API_KEY;

function post(body: unknown, headers: Record<string, string> = {}) {
  const json = JSON.stringify(body);
  return new Request("https://reparo360.vercel.app/api/analyze-damage", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "content-length": String(json.length),
      origin: "https://reparo360.vercel.app",
      ...headers,
    },
    body: json,
  });
}

async function loadRoute() {
  vi.resetModules();
  return import("@/app/api/analyze-damage/route");
}

describe("POST /api/analyze-damage", () => {
  beforeEach(() => {
    process.env.ANTHROPIC_API_KEY = "teste";
  });
  afterEach(() => {
    if (ORIGINAL_KEY === undefined) delete process.env.ANTHROPIC_API_KEY;
    else process.env.ANTHROPIC_API_KEY = ORIGINAL_KEY;
  });

  it("sem chave configurada, responde 503 com mensagem pro cliente, sem detalhe técnico", async () => {
    delete process.env.ANTHROPIC_API_KEY;
    const { POST } = await loadRoute();
    const res = await POST(post({ photos: [] }));
    expect(res.status).toBe(503);
    const data = await res.json();
    expect(data.message).not.toMatch(/env|ANTHROPIC|servidor/i);
  });

  it("recusa pedido vindo de outro site", async () => {
    const { POST } = await loadRoute();
    const res = await POST(post({ photos: [] }, { origin: "https://outro-site.com" }));
    expect(res.status).toBe(403);
  });

  it("recusa corpo grande demais com JSON (a Vercel responderia HTML)", async () => {
    const { POST } = await loadRoute();
    const res = await POST(post({ photos: [] }, { "content-length": String(5 * 1024 * 1024) }));
    expect(res.status).toBe(413);
    expect((await res.json()).message).toBeTruthy();
  });

  it("limita pedidos repetidos do mesmo IP", async () => {
    const { POST } = await loadRoute();
    const ip = { "x-forwarded-for": "203.0.113.7" };
    let last: Response | undefined;
    for (let i = 0; i < 20; i++) {
      last = await POST(post({ photos: [] }, ip));
      if (last.status === 429) break;
    }
    expect(last!.status).toBe(429);
    expect(Number(last!.headers.get("retry-after"))).toBeGreaterThan(0);
    // Outro IP continua passando (cai no 400 de "envie ao menos uma foto").
    const outro = await POST(post({ photos: [] }, { "x-forwarded-for": "198.51.100.9" }));
    expect(outro.status).toBe(400);
  });
});
