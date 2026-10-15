"use client";

import { GlassCard } from "@/components/ui/glass-card";
import { ConfidenceBadge } from "@/components/ui/confidence-badge";
import { PART_LABELS, DAMAGE_LABELS } from "@/lib/car-parts";
import { estimate, splitServiceParts } from "@/lib/pricing";
import { useBudgetDraft } from "@/stores/budget-store";
import { formatBRL } from "@/lib/utils";
import { useMemo } from "react";
import { Car3DLazy } from "@/components/car/car-3d-lazy";
import { CheckCircle2 } from "lucide-react";

export function SummaryStep() {
  const { items, vehicle, customerName, photos } = useBudgetDraft();

  const breakdown = useMemo(() => {
    const rows = items.map((i) => ({
      part: i.part,
      damages: i.damages,
      est: estimate(i.part, i.damages, {
        category: vehicle.category,
        brand: vehicle.brand,
      }),
    }));
    const labor = rows.reduce((s, r) => s + r.est.labor, 0);
    const paint = rows.reduce((s, r) => s + r.est.paint, 0);
    const parts = rows.reduce((s, r) => s + r.est.parts, 0);
    const materials = rows.reduce((s, r) => s + r.est.materials, 0);
    const margin = rows.reduce((s, r) => s + r.est.margin, 0);
    const total = rows.reduce((s, r) => s + r.est.total, 0);
    const confidence = rows.length
      ? Math.round(rows.reduce((s, r) => s + r.est.confidence, 0) / rows.length)
      : 0;
    const split = splitServiceParts({ parts, total });
    const hasFallback = rows.some((r) => r.est.hasFallback);
    return { rows, service: split.service, parts: split.parts, total, confidence, hasFallback };
  }, [items, vehicle.category, vehicle.brand]);

  return (
    <div className="grid lg:grid-cols-[1fr_380px] gap-6">
      <div className="flex flex-col gap-4">
        <GlassCard className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-xl font-semibold">Estimativa gerada</h2>
              <p className="text-sm text-text-secondary">
                {vehicle.brand} {vehicle.model} {vehicle.year} · {customerName || "Cliente"}
              </p>
            </div>
            <ConfidenceBadge value={breakdown.confidence} />
          </div>
          <Car3DLazy selectedParts={items.map((i) => i.part)} interactive={false} autoRotate showHotspots={false} />
        </GlassCard>

        <GlassCard className="p-6">
          <h3 className="text-lg font-semibold mb-4">Itens do orçamento</h3>
          <div className="flex flex-col divide-y divide-[color:var(--color-border)]">
            {breakdown.rows.map((r) => (
              <div key={r.part} className="py-4 first:pt-0 last:pb-0 flex items-start justify-between gap-4">
                <div>
                  <p className="font-medium">{PART_LABELS[r.part]}</p>
                  <p className="text-sm text-text-secondary">
                    {r.damages.map((d) => DAMAGE_LABELS[d]).join(", ") || "Sem danos selecionados"}
                  </p>
                </div>
                <p className="text-right font-semibold whitespace-nowrap">{formatBRL(r.est.total)}</p>
              </div>
            ))}
          </div>
        </GlassCard>
      </div>

      <div className="flex flex-col gap-4">
        <GlassCard glow className="p-6">
          <p className="text-xs uppercase tracking-wider text-text-secondary">Valor estimado</p>
          <p className="text-4xl font-semibold mt-1">{formatBRL(breakdown.total)}</p>
          <div className="mt-4 flex flex-col gap-2 text-sm">
            <Row label="Pintura/Mão de obra" value={breakdown.service} />
            <Row label="Peças" value={breakdown.parts} />
          </div>
          {breakdown.hasFallback && (
            <p className="mt-3 text-xs text-[color:var(--color-warning,#f59e0b)]">
              Parte deste orçamento usa valor genérico — a combinação de peça e dano não
              está na tabela. Confirme com a oficina.
            </p>
          )}
        </GlassCard>

        <GlassCard className="p-6">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="text-[color:var(--color-success)] mt-0.5" size={20} />
            <div>
              <p className="font-medium">Pronto para enviar</p>
              <p className="text-sm text-text-secondary">
                {photos.length} fotos anexadas · {items.length} peças analisadas
              </p>
            </div>
          </div>
        </GlassCard>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between text-text-secondary">
      <span>{label}</span>
      <span className="text-text">{formatBRL(value)}</span>
    </div>
  );
}
