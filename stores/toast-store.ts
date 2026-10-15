"use client";

import { create } from "zustand";

export type ToastKind = "info" | "error" | "success";

export interface Toast {
  id: number;
  message: string;
  kind: ToastKind;
}

interface ToastState {
  toasts: Toast[];
  push: (message: string, kind?: ToastKind) => void;
  dismiss: (id: number) => void;
}

let nextId = 1;

/**
 * Substitui `alert()`. O nativo trava a thread, não é estilizável e no mobile
 * aparece como caixa do sistema, destoando do resto do app.
 *
 * Não é persistido: aviso é efêmero por natureza.
 */
export const useToastStore = create<ToastState>((set) => ({
  toasts: [],

  push: (message, kind = "info") => {
    const id = nextId++;
    set((s) => ({ toasts: [...s.toasts, { id, message, kind }] }));
    setTimeout(() => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })), 5000);
  },

  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

/**
 * Chamável de fora de componente, igual ao `alert()` que substitui — por isso
 * lê o store direto em vez de exigir um hook.
 */
export function toast(message: string, kind: ToastKind = "info") {
  useToastStore.getState().push(message, kind);
}
