"use client";

import { create } from "zustand";

export interface ConfirmRequest {
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Pinta o botão de confirmação como destrutivo. */
  danger?: boolean;
}

interface ConfirmState {
  pending: (ConfirmRequest & { resolve: (ok: boolean) => void }) | null;
  answer: (ok: boolean) => void;
  request: (req: ConfirmRequest) => Promise<boolean>;
}

export const useConfirmStore = create<ConfirmState>((set, get) => ({
  pending: null,

  request: (req) =>
    new Promise<boolean>((resolve) => {
      // Se já houver um diálogo aberto, o anterior é cancelado — nunca
      // empilhamos dois, senão o usuário responde um e o outro fica preso.
      const current = get().pending;
      if (current) current.resolve(false);
      set({ pending: { ...req, resolve } });
    }),

  answer: (ok) => {
    const p = get().pending;
    if (!p) return;
    set({ pending: null });
    p.resolve(ok);
  },
}));

/**
 * Substitui `window.confirm()`. O nativo é síncrono e trava a thread; este
 * devolve uma Promise, então a chamada vira `if (!(await confirmDialog(...)))`.
 */
export function confirmDialog(req: ConfirmRequest | string): Promise<boolean> {
  const normalized = typeof req === "string" ? { message: req } : req;
  return useConfirmStore.getState().request(normalized);
}
