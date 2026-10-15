import { describe, it, expect } from "vitest";
import { assessTotalLoss, assessClaim, TOTAL_LOSS_THRESHOLD } from "@/lib/vehicle-economics";

/** FIPE real de agosto/2026, usada como âncora dos casos. */
const UNO = 27_321;
const FERRARI = 2_874_274;

describe("perda total", () => {
  it("acima do limiar recomenda não consertar", () => {
    expect(assessTotalLoss(22_000, UNO)?.verdict).toBe("total_loss");
  });

  it("exatamente no limiar já conta como perda total", () => {
    const limiar = UNO * TOTAL_LOSS_THRESHOLD;
    expect(assessTotalLoss(limiar, UNO)?.verdict).toBe("total_loss");
  });

  it("avisa antes de estourar", () => {
    expect(assessTotalLoss(18_000, UNO)?.verdict).toBe("approaching");
  });

  it("reparo pequeno não gera alarme", () => {
    expect(assessTotalLoss(5_000, UNO)?.verdict).toBe("ok");
  });

  it("o mesmo reparo é irrelevante num carro caro", () => {
    // Este é o ponto da FIPE: R$22 mil é perda total no Uno e trivial na Ferrari.
    expect(assessTotalLoss(22_000, UNO)?.verdict).toBe("total_loss");
    expect(assessTotalLoss(22_000, FERRARI)?.verdict).toBe("ok");
  });

  it("cala a boca quando não há valor de mercado", () => {
    // Sem FIPE não existe julgamento possível — chutar seria pior que omitir.
    expect(assessTotalLoss(22_000, undefined)).toBeNull();
    expect(assessTotalLoss(22_000, 0)).toBeNull();
  });

  it("a folga informada bate com o limiar", () => {
    const a = assessTotalLoss(18_000, UNO)!;
    expect(a.headroom).toBeCloseTo(a.thresholdValue - 18_000, 2);
  });
});

describe("vale acionar o seguro?", () => {
  const FRANQUIA = 3_200;

  it("reparo abaixo da franquia: não acione", () => {
    expect(assessClaim(2_000, FRANQUIA)?.verdict).toBe("below_deductible");
  });

  it("reparo igual à franquia também não compensa", () => {
    expect(assessClaim(FRANQUIA, FRANQUIA)?.verdict).toBe("below_deductible");
  });

  it("ganho magro acima da franquia é marginal", () => {
    // O bônus perdido na renovação come a diferença.
    expect(assessClaim(4_000, FRANQUIA)?.verdict).toBe("marginal");
  });

  it("ganho relevante compensa", () => {
    const a = assessClaim(8_000, FRANQUIA)!;
    expect(a.verdict).toBe("worth_claiming");
    expect(a.netBenefit).toBe(4_800);
  });

  it("sem franquia informada não opina", () => {
    expect(assessClaim(8_000, undefined)).toBeNull();
  });
});
