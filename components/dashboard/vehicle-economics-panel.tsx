"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, TrendingDown, ShieldQuestion, Info } from "lucide-react";
import { formatBRL } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { assessTotalLoss, assessClaim } from "@/lib/vehicle-economics";
import { useFipeHistoryStore, depreciationFrom } from "@/stores/fipe-history-store";
import { useVehiclesStore } from "@/stores/vehicles-store";
import type { FipeState } from "@/lib/use-fipe";

interface Props {
  vehicleId: string;
  fipe: FipeState;
  /** Soma dos danos ativos. */
  repairTotal: number;
  deductible?: number;
}

export function VehicleEconomicsPanel({ vehicleId, fipe, repairTotal, deductible }: Props) {
  const record = useFipeHistoryStore((s) => s.record);
  const history = useFipeHistoryStore((s) => s.history[vehicleId]);
  const updateVehicle = useVehiclesStore((s) => s.updateVehicle);

  const [editingDeductible, setEditingDeductible] = useState(false);
  const [draft, setDraft] = useState(deductible ? String(deductible) : "");

  // Cada consulta bem-sucedida vira um ponto do nosso histórico.
  useEffect(() => {
    if (fipe.status === "found" && fipe.marketValue && fipe.reference) {
      record(vehicleId, { reference: fipe.reference, value: fipe.marketValue });
    }
  }, [fipe.status, fipe.marketValue, fipe.reference, vehicleId, record]);

  const totalLoss = assessTotalLoss(repairTotal, fipe.marketValue);
  const claim = assessClaim(repairTotal, deductible);
  const depreciation = depreciationFrom(history ?? []);

  function saveDeductible() {
    const parsed = Number.parseFloat(draft.replace(/\./g, "").replace(",", "."));
    updateVehicle(vehicleId, {
      deductible: Number.isFinite(parsed) && parsed > 0 ? parsed : undefined,
    });
    setEditingDeductible(false);
  }

  if (fipe.status === "loading") {
    return (
      <div className="rounded-2xl bg-white/[0.02] border border-white/[0.06] p-4">
        <p className="text-xs text-[color:var(--color-muted)]">Consultando a tabela FIPE…</p>
      </div>
    );
  }

  if (fipe.status === "absent" || fipe.status === "error") {
    return (
      <div className="rounded-2xl bg-white/[0.02] border border-white/[0.06] p-4">
        <p className="flex items-start gap-1.5 text-xs text-[color:var(--color-muted)]">
          <Info size={13} className="mt-px shrink-0" />
          {fipe.reason ?? "Sem valor de mercado para este veículo."} Sem ele não dá pra
          avaliar perda total nem se vale acionar o seguro.
        </p>
      </div>
    );
  }

  if (fipe.status !== "found" || !fipe.marketValue) return null;

  return (
    <div className="flex flex-col gap-3">
      {/* Perda total — a leitura que a oficina não faz */}
      {totalLoss && (
        <div
          className={cn(
            "rounded-2xl border p-4",
            totalLoss.verdict === "total_loss"
              ? "bg-[color:var(--color-danger)]/10 border-[color:var(--color-danger)]/30"
              : totalLoss.verdict === "approaching"
                ? "bg-[color:var(--color-warning,#f59e0b)]/10 border-[color:var(--color-warning,#f59e0b)]/30"
                : "bg-white/[0.02] border-white/[0.06]",
          )}
        >
          <div className="flex items-start gap-2">
            {totalLoss.verdict !== "ok" && (
              <AlertTriangle
                size={15}
                className={cn(
                  "mt-0.5 shrink-0",
                  totalLoss.verdict === "total_loss"
                    ? "text-[color:var(--color-danger)]"
                    : "text-[color:var(--color-warning,#f59e0b)]",
                )}
              />
            )}
            <div className="min-w-0">
              <p className="text-sm font-semibold">
                {totalLoss.verdict === "total_loss"
                  ? "Provável perda total — não vale consertar"
                  : totalLoss.verdict === "approaching"
                    ? "Chegando perto da perda total"
                    : "Reparo compatível com o valor do carro"}
              </p>
              <p className="mt-1 text-xs text-[color:var(--color-muted)]">
                O reparo está em {Math.round(totalLoss.ratio * 100)}% do valor de mercado
                ({formatBRL(fipe.marketValue)}). Acima de{" "}
                {Math.round(totalLoss.threshold * 100)}% —{" "}
                {formatBRL(totalLoss.thresholdValue)} — a seguradora normalmente indeniza
                em vez de consertar.
              </p>
              {totalLoss.verdict === "total_loss" ? (
                <p className="mt-2 text-xs">
                  Peça a indenização integral em vez do conserto. O orçamento abaixo
                  continua visível, mas consertar tende a custar mais do que o carro vale.
                </p>
              ) : (
                <p className="mt-2 text-xs text-[color:var(--color-muted)]">
                  Ainda cabem {formatBRL(totalLoss.headroom)} de reparo antes de virar
                  perda total.
                </p>
              )}
              <p className="mt-2 text-[10px] text-[color:var(--color-muted)]">
                Prática de mercado, não lei — o percentual exato está na sua apólice.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Vale acionar o seguro? */}
      <div className="rounded-2xl bg-white/[0.02] border border-white/[0.06] p-4">
        <div className="flex items-start gap-2">
          <ShieldQuestion size={15} className="mt-0.5 shrink-0 text-[color:var(--color-muted)]" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">Vale acionar o seguro?</p>

            {!deductible || editingDeductible ? (
              <div className="mt-2">
                <p className="text-xs text-[color:var(--color-muted)]">
                  Informe a franquia da sua apólice — é o número que falta pra responder.
                </p>
                <div className="mt-2 flex items-center gap-2">
                  <input
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && saveDeductible()}
                    inputMode="decimal"
                    placeholder="Ex.: 3200"
                    className="h-9 flex-1 min-w-0 rounded-xl bg-white/[0.04] border border-white/[0.06] px-3 text-body text-white outline-none focus:border-[color:var(--color-primary)]/50"
                  />
                  <button
                    onClick={saveDeductible}
                    className="shrink-0 rounded-xl border border-white/[0.12] px-3 py-2 text-xs hover:bg-white/[0.06] transition"
                  >
                    Salvar
                  </button>
                </div>
              </div>
            ) : (
              <>
                <p className="mt-1 text-xs text-[color:var(--color-muted)]">
                  Franquia {formatBRL(deductible)} · reparo {formatBRL(repairTotal)}
                </p>
                {claim && (
                  <p className="mt-2 text-xs">
                    {claim.verdict === "below_deductible"
                      ? `Não acione. O reparo custa menos que a franquia — você pagaria ${formatBRL(deductible)} pra receber ${formatBRL(repairTotal)} de serviço, e ainda perderia bônus na renovação.`
                      : claim.verdict === "marginal"
                        ? `Provavelmente não compensa. O seguro cobriria só ${formatBRL(claim.netBenefit)} além da franquia, e isso costuma sair mais caro no bônus da renovação.`
                        : `Compensa acionar. Acima da franquia, o seguro cobre ${formatBRL(claim.netBenefit)}.`}
                  </p>
                )}
                <button
                  onClick={() => {
                    setDraft(String(deductible));
                    setEditingDeductible(true);
                  }}
                  className="mt-2 text-[11px] text-[color:var(--color-primary-glow)] hover:brightness-125"
                >
                  Alterar franquia
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Valor de mercado e depreciação própria */}
      <div className="rounded-2xl bg-white/[0.02] border border-white/[0.06] p-4">
        <div className="flex items-start gap-2">
          <TrendingDown size={15} className="mt-0.5 shrink-0 text-[color:var(--color-muted)]" />
          <div className="min-w-0">
            <p className="text-sm font-semibold">{formatBRL(fipe.marketValue)}</p>
            <p className="mt-0.5 text-xs text-[color:var(--color-muted)]">
              FIPE {fipe.reference} · {fipe.matched?.model}
              {fipe.yearApproximated && " · ano aproximado"}
            </p>

            {depreciation ? (
              <p className="mt-2 text-xs">
                {depreciation.change < 0 ? "Desvalorizou " : "Valorizou "}
                <span
                  className={
                    depreciation.change < 0
                      ? "text-[color:var(--color-danger)]"
                      : "text-[color:var(--color-success)]"
                  }
                >
                  {formatBRL(Math.abs(depreciation.change))}
                </span>{" "}
                ({Math.abs(Math.round(depreciation.ratio * 100))}%) desde{" "}
                {depreciation.from.reference}.
              </p>
            ) : (
              <p className="mt-2 text-[11px] text-[color:var(--color-muted)]">
                Registramos o valor a cada consulta. A curva de depreciação aparece a
                partir do segundo mês — a FIPE pública não deixa consultar meses passados.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
