"use client";

import { Car3DLazy } from "@/components/car/car-3d-lazy";
import { GlassCard } from "@/components/ui/glass-card";
import { PART_LABELS } from "@/lib/car-parts";
import { useBudgetDraft } from "@/stores/budget-store";
import { X } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";

export function PartsStep() {
  const { items, togglePart, removePart } = useBudgetDraft();
  const selectedParts = items.map((i) => i.part);

  return (
    <div className="grid lg:grid-cols-[1fr_320px] gap-6">
      <GlassCard className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-title font-semibold">Toque na peça danificada</h2>
            <p className="text-body text-text-secondary">Selecione uma ou mais áreas afetadas.</p>
          </div>
          <span className="text-label bg-[color:var(--color-primary)]/15 text-[color:var(--color-primary-soft)] rounded-full px-3 py-1">
            {items.length} {items.length === 1 ? "peça" : "peças"}
          </span>
        </div>
        <Car3DLazy selectedParts={selectedParts} onSelectPart={togglePart} autoRotate={false} />
      </GlassCard>

      <GlassCard className="p-6">
        <h3 className="text-title font-semibold mb-4">Peças selecionadas</h3>
        {items.length === 0 && (
          <p className="text-body text-text-secondary">
            Clique nos pontos azuis do carro para começar.
          </p>
        )}
        <div className="flex flex-col gap-2">
          <AnimatePresence>
            {items.map((it) => (
              <motion.div
                key={it.part}
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                className="flex items-center justify-between rounded-2xl bg-white/[0.03] border border-[color:var(--color-border)] px-4 py-3"
              >
                <span className="text-body">{PART_LABELS[it.part]}</span>
                <button
                  onClick={() => removePart(it.part)}
                  className="text-text-secondary hover:text-[color:var(--color-danger)] transition-colors"
                >
                  <X size={16} />
                </button>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </GlassCard>
    </div>
  );
}
