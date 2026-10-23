"use client";

import { GlassCard } from "@/components/ui/glass-card";
import { DAMAGE_LABELS, PART_LABELS } from "@/lib/car-parts";
import { useBudgetDraft } from "@/stores/budget-store";
import type { DamageType } from "@/types";
import { cn } from "@/lib/utils";

const DAMAGE_OPTIONS: DamageType[] = [
  "scratch_light",
  "scratch_deep",
  "dent_light",
  "dent_medium",
  "break",
  "misalignment",
  "other",
];

export function DamageStep() {
  const { items, setDamages, notes, setNotes } = useBudgetDraft();

  if (items.length === 0) {
    return (
      <GlassCard className="p-8 text-center">
        <p className="text-text-secondary">Volte e selecione ao menos uma peça primeiro.</p>
      </GlassCard>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {items.map((it) => (
        <GlassCard key={it.part} className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-title font-semibold">{PART_LABELS[it.part]}</h3>
            <span className="text-label text-text-secondary">
              {it.damages.length} {it.damages.length === 1 ? "dano" : "danos"} selecionado(s)
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {DAMAGE_OPTIONS.map((d) => {
              const active = it.damages.includes(d);
              return (
                <button
                  key={d}
                  onClick={() => {
                    const next = active
                      ? it.damages.filter((x) => x !== d)
                      : [...it.damages, d];
                    setDamages(it.part, next);
                  }}
                  className={cn(
                    "rounded-2xl px-4 py-2.5 text-label border transition-all duration-200",
                    active
                      ? "bg-[color:var(--color-primary)]/15 border-[color:var(--color-primary)]/50 text-[color:var(--color-primary-soft)]"
                      : "bg-[color:var(--color-surface)] border-[color:var(--color-border)] text-text-secondary hover:text-text hover:border-[color:var(--color-primary)]/30",
                  )}
                >
                  {DAMAGE_LABELS[d]}
                </button>
              );
            })}
          </div>
        </GlassCard>
      ))}

      <GlassCard className="p-6">
        <label className="flex flex-col gap-2">
          <span className="text-meta uppercase tracking-[0.08em] text-text-secondary">Observações (opcional)</span>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={4}
            placeholder="Descreva contexto adicional: colisão traseira, batida em poste, etc."
            className="w-full p-4 rounded-2xl bg-[color:var(--color-surface)] border border-[color:var(--color-border)] text-body resize-none focus:outline-none focus:border-[color:var(--color-primary)] focus:ring-2 focus:ring-[color:var(--color-primary)]/20"
          />
        </label>
      </GlassCard>
    </div>
  );
}
