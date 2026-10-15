"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type {
  Budget,
  BudgetExtra,
  BudgetExtraKind,
  BudgetStatus,
  ContactedOficina,
  DamageItem,
  DamageRecord,
  Vehicle,
} from "@/types";
import { uid, budgetCode } from "@/lib/ids";
import { estimate, PRICING_VERSION } from "@/lib/pricing";
import { PART_LABELS } from "@/lib/car-parts";

/**
 * Catálogo de serviços extras oferecidos como upsell no orçamento.
 * Preços fixos por enquanto (mesmos das promos do sidebar) — quando
 * integrar com fornecedor, virar consulta ao catálogo real.
 */
export const EXTRA_CATALOG: Record<
  BudgetExtraKind,
  { label: string; price: number }
> = {
  oil_change: { label: "Troca de óleo (óleo + filtro)", price: 149 },
  wheel_alignment: { label: "Geometria + balanceamento", price: 129 },
};

export interface BuildBudgetInput {
  userId: string;
  vehicle: Vehicle;
  damages: DamageRecord[];
  photos?: string[];
  customerName: string;
  customerPhone?: string;
  location?: string;
  notes?: string;
  source: Budget["source"];
  color?: string;
}

function buildBudget(input: BuildBudgetInput, status: BudgetStatus): Budget {
  const now = new Date().toISOString();
  const items: DamageItem[] = [];
  let labor = 0;
  let paint = 0;
  let parts = 0;
  let materials = 0;
  let margin = 0;
  let subtotal = 0;
  let total = 0;
  let confidenceSum = 0;

  for (const d of input.damages) {
    if (d.resolved) continue;
    const r = estimate(d.part, d.damages, {
      category: input.vehicle.category,
      brand: input.vehicle.brand,
    });
    labor += r.labor;
    paint += r.paint;
    parts += r.parts;
    materials += r.materials;
    margin += r.margin;
    subtotal += r.subtotal;
    total += r.total;
    confidenceSum += r.confidence;
    items.push({
      id: d.id,
      part: d.part,
      partLabel: PART_LABELS[d.part],
      damages: d.damages,
      severity:
        r.total > 3000 ? "high" : r.total > 1200 ? "medium" : "low",
      notes: d.notes,
      photos: d.photos,
      estimatedCost: r.total,
    });
  }

  const confidence = items.length ? Math.round(confidenceSum / items.length) : 0;

  return {
    id: uid("bud"),
    code: budgetCode(),
    userId: input.userId,
    vehicleId: input.vehicle.id,
    vehicleSnapshot: {
      brand: input.vehicle.brand,
      model: input.vehicle.model,
      year: input.vehicle.year,
      glb: input.vehicle.glb,
      category: input.vehicle.category,
      color: input.color,
    },
    customerName: input.customerName,
    customerPhone: input.customerPhone,
    items,
    extras: [],
    photos: input.photos ?? [],
    location: input.location,
    notes: input.notes,
    subtotal: Math.round(subtotal * 100) / 100,
    laborTotal: Math.round(labor * 100) / 100,
    paintTotal: Math.round(paint * 100) / 100,
    partsTotal: Math.round(parts * 100) / 100,
    materialsTotal: Math.round(materials * 100) / 100,
    marginTotal: Math.round(margin * 100) / 100,
    total: Math.round(total * 100) / 100,
    confidence,
    pricingVersion: PRICING_VERSION,
    status,
    source: input.source,
    createdAt: now,
    updatedAt: now,
  };
}

interface BudgetsState {
  budgets: Budget[];

  createFromDashboard: (input: BuildBudgetInput) => Budget;
  saveDraft: (input: BuildBudgetInput) => Budget;
  setStatus: (id: string, status: BudgetStatus) => void;
  updateBudget: (id: string, patch: Partial<Budget>) => void;
  addExtra: (budgetId: string, kind: BudgetExtraKind) => BudgetExtra | undefined;
  removeExtra: (budgetId: string, extraId: string) => void;
  removeBudget: (id: string) => void;
  recordOficinaContact: (
    budgetId: string,
    oficina: Omit<ContactedOficina, "sentAt">,
  ) => void;
  getBudget: (id: string) => Budget | undefined;
  budgetsFor: (userId: string) => Budget[];
  draftsFor: (userId: string) => Budget[];
}

export const useBudgetsStore = create<BudgetsState>()(
  persist(
    (set, get) => ({
      budgets: [],

      createFromDashboard: (input) => {
        const budget = buildBudget(input, "sent");
        set((s) => ({ budgets: [budget, ...s.budgets] }));
        return budget;
      },

      saveDraft: (input) => {
        const budget = buildBudget(input, "draft");
        set((s) => ({ budgets: [budget, ...s.budgets] }));
        return budget;
      },

      setStatus: (id, status) =>
        set((s) => ({
          budgets: s.budgets.map((b) =>
            b.id === id ? { ...b, status, updatedAt: new Date().toISOString() } : b,
          ),
        })),

      updateBudget: (id, patch) =>
        set((s) => ({
          budgets: s.budgets.map((b) =>
            b.id === id ? { ...b, ...patch, updatedAt: new Date().toISOString() } : b,
          ),
        })),

      addExtra: (budgetId, kind) => {
        const entry = EXTRA_CATALOG[kind];
        if (!entry) return undefined;
        const extra: BudgetExtra = {
          id: uid("ext"),
          kind,
          label: entry.label,
          price: entry.price,
          addedAt: new Date().toISOString(),
        };
        set((s) => ({
          budgets: s.budgets.map((b) =>
            b.id === budgetId
              ? {
                  ...b,
                  extras: [...(b.extras ?? []), extra],
                  updatedAt: new Date().toISOString(),
                }
              : b,
          ),
        }));
        return extra;
      },

      removeExtra: (budgetId, extraId) =>
        set((s) => ({
          budgets: s.budgets.map((b) =>
            b.id === budgetId
              ? {
                  ...b,
                  extras: (b.extras ?? []).filter((e) => e.id !== extraId),
                  updatedAt: new Date().toISOString(),
                }
              : b,
          ),
        })),

      removeBudget: (id) =>
        set((s) => ({ budgets: s.budgets.filter((b) => b.id !== id) })),

      recordOficinaContact: (budgetId, oficina) => {
        const entry: ContactedOficina = {
          ...oficina,
          sentAt: new Date().toISOString(),
        };
        set((s) => ({
          budgets: s.budgets.map((b) => {
            if (b.id !== budgetId) return b;
            // Contactou a mesma oficina de novo — deixamos os dois registros,
            // porque o cliente pode estar reforçando um envio anterior.
            return {
              ...b,
              contactedOficinas: [...(b.contactedOficinas ?? []), entry],
              updatedAt: new Date().toISOString(),
            };
          }),
        }));
      },

      getBudget: (id) => get().budgets.find((b) => b.id === id),
      budgetsFor: (userId) => get().budgets.filter((b) => b.userId === userId),
      draftsFor: (userId) =>
        get().budgets.filter((b) => b.userId === userId && b.status === "draft"),
    }),
    {
      name: "reparo360:budgets",
      storage: createJSONStorage(() => localStorage),
    },
  ),
);
