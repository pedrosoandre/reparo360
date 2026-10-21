import { describe, it, expect } from "vitest";
import { createRateLimiter } from "@/lib/rate-limit";

describe("createRateLimiter", () => {
  it("deixa passar até o limite na janela e bloqueia o seguinte", () => {
    const limiter = createRateLimiter({ limit: 3, windowMs: 60_000 });
    const t = 1_000_000;
    expect(limiter.check("ip-a", t).ok).toBe(true);
    expect(limiter.check("ip-a", t + 1).ok).toBe(true);
    expect(limiter.check("ip-a", t + 2).ok).toBe(true);
    const bloqueado = limiter.check("ip-a", t + 3);
    expect(bloqueado.ok).toBe(false);
    expect(bloqueado.retryAfterSec).toBe(60);
  });

  it("libera de novo quando a janela passa", () => {
    const limiter = createRateLimiter({ limit: 1, windowMs: 60_000 });
    expect(limiter.check("ip-a", 0).ok).toBe(true);
    expect(limiter.check("ip-a", 59_999).ok).toBe(false);
    expect(limiter.check("ip-a", 60_000).ok).toBe(true);
  });

  it("conta cada chave separado", () => {
    const limiter = createRateLimiter({ limit: 1, windowMs: 60_000 });
    expect(limiter.check("ip-a", 0).ok).toBe(true);
    expect(limiter.check("ip-b", 0).ok).toBe(true);
    expect(limiter.check("ip-a", 1).ok).toBe(false);
  });
});
