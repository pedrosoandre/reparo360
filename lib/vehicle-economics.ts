import table from "@/data/pricing-table.json";

const { totalLossThreshold, totalLossWarnBand } = table.businessRules;

export const TOTAL_LOSS_THRESHOLD = totalLossThreshold;

export type TotalLossVerdict = "ok" | "approaching" | "total_loss";

export interface TotalLossAssessment {
  verdict: TotalLossVerdict;
  /** custo do reparo ÷ valor de mercado */
  ratio: number;
  /** Valor de reparo a partir do qual vira perda total. */
  thresholdValue: number;
  /** Quanto ainda cabe de reparo antes de estourar o limiar. Negativo = já estourou. */
  headroom: number;
  threshold: number;
}

/**
 * Reparo acima de ~75% do valor de mercado costuma levar a seguradora a
 * indenizar em vez de consertar. É prática de mercado, não lei — o percentual
 * exato está na apólice.
 *
 * Este é o único julgamento do app que a oficina nunca vai fazer: ela ganha
 * consertando. Por isso o limiar é grosso de propósito — não depende da
 * estimativa estar precisa, só na ordem de grandeza certa.
 *
 * Retorna null quando não há valor de mercado (veículo fora da FIPE): sem ele
 * não existe julgamento possível, e chutar aqui seria pior que calar.
 */
export function assessTotalLoss(
  repairTotal: number,
  marketValue?: number,
): TotalLossAssessment | null {
  if (!marketValue || marketValue <= 0 || repairTotal <= 0) return null;

  const ratio = repairTotal / marketValue;
  const thresholdValue = marketValue * totalLossThreshold;

  return {
    verdict:
      ratio >= totalLossThreshold
        ? "total_loss"
        : ratio >= totalLossWarnBand
          ? "approaching"
          : "ok",
    ratio,
    thresholdValue: round2(thresholdValue),
    headroom: round2(thresholdValue - repairTotal),
    threshold: totalLossThreshold,
  };
}

export type ClaimVerdict = "below_deductible" | "marginal" | "worth_claiming";

export interface ClaimAssessment {
  verdict: ClaimVerdict;
  /** Quanto o seguro efetivamente cobriria: reparo menos franquia. */
  netBenefit: number;
  deductible: number;
}

/**
 * Acionar o seguro por um reparo que custa menos que a franquia é prejuízo
 * duplo: paga a franquia e ainda queima o bônus da renovação.
 *
 * A franquia vem da apólice do usuário — número real, informado por ele. É de
 * propósito que esta função não estime nada: metade da conta é fato.
 */
export function assessClaim(
  repairTotal: number,
  deductible?: number,
): ClaimAssessment | null {
  if (!deductible || deductible <= 0 || repairTotal <= 0) return null;

  const netBenefit = round2(repairTotal - deductible);

  return {
    verdict:
      netBenefit <= 0
        ? "below_deductible"
        : // Ganho magro não paga a perda de bônus na renovação.
          netBenefit < deductible * 0.5
          ? "marginal"
          : "worth_claiming",
    netBenefit,
    deductible,
  };
}

function round2(v: number): number {
  return Math.round(v * 100) / 100;
}
