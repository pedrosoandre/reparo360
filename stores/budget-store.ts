"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { CarPart, DamageType, Vehicle } from "@/types";

export interface BudgetDraftItem {
  part: CarPart;
  damages: DamageType[];
}

interface BudgetDraftState {
  step: number;
  vehicle: Partial<Vehicle>;
  items: BudgetDraftItem[];
  photos: string[];
  customerName: string;
  customerPhone: string;
  notes: string;

  setStep: (step: number) => void;
  next: () => void;
  back: () => void;

  setVehicle: (v: Partial<Vehicle>) => void;
  togglePart: (part: CarPart) => void;
  setDamages: (part: CarPart, damages: DamageType[]) => void;
  removePart: (part: CarPart) => void;

  addPhoto: (url: string) => void;
  removePhoto: (url: string) => void;

  setCustomer: (fields: { name?: string; phone?: string }) => void;
  setNotes: (notes: string) => void;

  reset: () => void;
}

const initial = {
  step: 0,
  vehicle: {} as Partial<Vehicle>,
  items: [] as BudgetDraftItem[],
  photos: [] as string[],
  customerName: "",
  customerPhone: "",
  notes: "",
};

export const useBudgetDraft = create<BudgetDraftState>()(
  persist(
    (set) => ({
      ...initial,
      setStep: (step) => set({ step }),
      next: () => set((s) => ({ step: Math.min(s.step + 1, 4) })),
      back: () => set((s) => ({ step: Math.max(s.step - 1, 0) })),

      setVehicle: (v) => set((s) => ({ vehicle: { ...s.vehicle, ...v } })),

      togglePart: (part) =>
        set((s) => {
          const exists = s.items.find((i) => i.part === part);
          if (exists) return { items: s.items.filter((i) => i.part !== part) };
          return { items: [...s.items, { part, damages: [] }] };
        }),

      setDamages: (part, damages) =>
        set((s) => ({
          items: s.items.map((i) => (i.part === part ? { ...i, damages } : i)),
        })),

      removePart: (part) =>
        set((s) => ({ items: s.items.filter((i) => i.part !== part) })),

      addPhoto: (url) => set((s) => ({ photos: [...s.photos, url] })),
      removePhoto: (url) =>
        set((s) => ({ photos: s.photos.filter((p) => p !== url) })),

      setCustomer: ({ name, phone }) =>
        set((s) => ({
          customerName: name ?? s.customerName,
          customerPhone: phone ?? s.customerPhone,
        })),
      setNotes: (notes) => set({ notes }),

      reset: () => set(initial),
    }),
    {
      name: "reparo360:budget-draft",
      storage: createJSONStorage(() => localStorage),
    },
  ),
);
