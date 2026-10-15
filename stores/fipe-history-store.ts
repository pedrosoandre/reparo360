"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

export interface FipeSnapshot {
  /** Mês de referência da FIPE, ex.: "agosto de 2026". Chave de deduplicação. */
  reference: string;
  value: number;
  /** Quando registramos — não é a data da FIPE. */
  recordedAt: string;
}

interface FipeHistoryState {
  /** vehicleId → snapshots em ordem cronológica de registro. */
  history: Record<string, FipeSnapshot[]>;
  record: (vehicleId: string, snapshot: Omit<FipeSnapshot, "recordedAt">) => void;
  forVehicle: (vehicleId: string) => FipeSnapshot[];
  clear: (vehicleId: string) => void;
}

/**
 * Histórico próprio de valor de mercado.
 *
 * A API pública da FIPE lista os meses passados mas não deixa consultá-los —
 * testei os três nomes de parâmetro e todos devolvem o mês corrente; histórico
 * é recurso do plano pago. Então construímos o nosso: a cada consulta,
 * guardamos o valor do mês. Começa vazio e ganha valor com o tempo.
 */
export const useFipeHistoryStore = create<FipeHistoryState>()(
  persist(
    (set, get) => ({
      history: {},

      record: (vehicleId, snapshot) =>
        set((s) => {
          const existing = s.history[vehicleId] ?? [];
          // Um registro por mês de referência — consultar de novo no mesmo mês
          // não cria ponto novo.
          if (existing.some((e) => e.reference === snapshot.reference)) return s;

          return {
            history: {
              ...s.history,
              [vehicleId]: [
                ...existing,
                { ...snapshot, recordedAt: new Date().toISOString() },
              ],
            },
          };
        }),

      forVehicle: (vehicleId) => get().history[vehicleId] ?? [],

      clear: (vehicleId) =>
        set((s) => {
          const next = { ...s.history };
          delete next[vehicleId];
          return { history: next };
        }),
    }),
    {
      name: "reparo360:fipe-history",
      storage: createJSONStorage(() => localStorage),
    },
  ),
);

export interface Depreciation {
  /** Variação absoluta em BRL entre o primeiro e o último snapshot. */
  change: number;
  /** Variação relativa. Negativa = desvalorizou. */
  ratio: number;
  from: FipeSnapshot;
  to: FipeSnapshot;
}

/** Precisa de pelo menos dois meses distintos pra dizer qualquer coisa. */
export function depreciationFrom(snapshots: FipeSnapshot[]): Depreciation | null {
  if (snapshots.length < 2) return null;
  const from = snapshots[0];
  const to = snapshots[snapshots.length - 1];
  if (from.value <= 0) return null;

  return {
    change: Math.round((to.value - from.value) * 100) / 100,
    ratio: (to.value - from.value) / from.value,
    from,
    to,
  };
}
