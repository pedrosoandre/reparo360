"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { DamageRecord, CarPart, DamageType } from "@/types";
import { uid } from "@/lib/ids";
import { estimate, type PricingContext } from "@/lib/pricing";
import { PART_LABELS, DAMAGE_LABELS } from "@/lib/car-parts";
import { formatBRL } from "@/lib/utils";

export interface DamageWithCost extends DamageRecord {
  label: string;
  damagesLabel: string;
  cost: number;
  confidence: number;
  /** Algum dano caiu no fallback da tabela — o valor é chute, não tabelado. */
  hasFallback: boolean;
}

interface DamagesState {
  damages: DamageRecord[];

  addDamage: (
    vehicleId: string,
    input: {
      part: CarPart;
      damages: DamageType[];
      photos?: string[];
      notes?: string;
      location?: string;
    },
  ) => DamageRecord;
  updateDamage: (id: string, patch: Partial<DamageRecord>) => void;
  removeDamage: (id: string) => void;
  toggleResolved: (id: string) => void;
  addPhotos: (id: string, photos: string[]) => void;
  removePhoto: (id: string, photoIndex: number) => void;
  setNotes: (id: string, notes: string) => void;
  damagesFor: (vehicleId: string) => DamageRecord[];
  clearForVehicle: (vehicleId: string) => void;
}

export const useDamagesStore = create<DamagesState>()(
  persist(
    (set, get) => ({
      damages: [],

      addDamage: (vehicleId, input) => {
        const now = new Date().toISOString();
        const record: DamageRecord = {
          id: uid("dmg"),
          vehicleId,
          part: input.part,
          damages: input.damages,
          photos: input.photos ?? [],
          notes: input.notes,
          location: input.location,
          resolved: false,
          createdAt: now,
          updatedAt: now,
        };
        set((s) => ({ damages: [...s.damages, record] }));
        return record;
      },

      updateDamage: (id, patch) =>
        set((s) => ({
          damages: s.damages.map((d) =>
            d.id === id ? { ...d, ...patch, updatedAt: new Date().toISOString() } : d,
          ),
        })),

      removeDamage: (id) =>
        set((s) => ({ damages: s.damages.filter((d) => d.id !== id) })),

      toggleResolved: (id) =>
        set((s) => ({
          damages: s.damages.map((d) =>
            d.id === id
              ? { ...d, resolved: !d.resolved, updatedAt: new Date().toISOString() }
              : d,
          ),
        })),

      addPhotos: (id, photos) =>
        set((s) => ({
          damages: s.damages.map((d) =>
            d.id === id
              ? {
                  ...d,
                  photos: [...d.photos, ...photos],
                  updatedAt: new Date().toISOString(),
                }
              : d,
          ),
        })),

      removePhoto: (id, photoIndex) =>
        set((s) => ({
          damages: s.damages.map((d) =>
            d.id === id
              ? {
                  ...d,
                  photos: d.photos.filter((_, i) => i !== photoIndex),
                  updatedAt: new Date().toISOString(),
                }
              : d,
          ),
        })),

      setNotes: (id, notes) =>
        set((s) => ({
          damages: s.damages.map((d) =>
            d.id === id
              ? { ...d, notes, updatedAt: new Date().toISOString() }
              : d,
          ),
        })),

      damagesFor: (vehicleId) => get().damages.filter((d) => d.vehicleId === vehicleId),

      clearForVehicle: (vehicleId) =>
        set((s) => ({ damages: s.damages.filter((d) => d.vehicleId !== vehicleId) })),
    }),
    {
      name: "reparo360:damages",
      storage: createJSONStorage(() => localStorage),
    },
  ),
);

/** Enriquece um DamageRecord com labels formatados + custo estimado. */
export function withCost(d: DamageRecord, ctx?: PricingContext): DamageWithCost {
  const result = estimate(d.part, d.damages, ctx);
  const typeLabels = d.damages.map((t) => DAMAGE_LABELS[t].toLowerCase());
  const count = d.damages.length;
  return {
    ...d,
    label: PART_LABELS[d.part],
    damagesLabel:
      count === 0
        ? "Sem tipo cadastrado"
        : `${count} dano${count > 1 ? "s" : ""}: ${typeLabels.join(", ")}`,
    cost: result.total,
    confidence: result.confidence,
    hasFallback: result.hasFallback,
  };
}

export function summarize(records: DamageRecord[], ctx?: PricingContext) {
  const items = records.map((r) => withCost(r, ctx));
  const total = items.reduce((sum, i) => sum + (i.resolved ? 0 : i.cost), 0);
  return {
    items,
    total,
    formattedTotal: formatBRL(total),
    activeCount: items.filter((i) => !i.resolved).length,
  };
}
