"use client";

import { useEffect, useRef } from "react";
import { useConfirmStore } from "@/stores/confirm-store";
import { cn } from "@/lib/utils";

export function ConfirmDialog() {
  const pending = useConfirmStore((s) => s.pending);
  const answer = useConfirmStore((s) => s.answer);
  const confirmRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!pending) return;
    confirmRef.current?.focus();

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") answer(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pending, answer]);

  if (!pending) return null;

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      onClick={() => answer(false)}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-label={pending.title ?? "Confirmação"}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm premium-card border border-white/[0.08] p-5"
      >
        {pending.title && <h2 className="text-base font-semibold mb-1">{pending.title}</h2>}
        <p className="text-sm text-[color:var(--color-muted)]">{pending.message}</p>

        <div className="mt-5 flex items-center justify-end gap-2">
          <button
            onClick={() => answer(false)}
            className="rounded-xl border border-white/[0.12] px-3 py-2 text-xs font-medium hover:bg-white/[0.06] transition"
          >
            {pending.cancelLabel ?? "Cancelar"}
          </button>
          <button
            ref={confirmRef}
            onClick={() => answer(true)}
            className={cn(
              "rounded-xl px-3 py-2 text-xs font-medium transition border",
              pending.danger
                ? "bg-[color:var(--color-danger)]/15 hover:bg-[color:var(--color-danger)]/25 border-[color:var(--color-danger)]/40 text-[color:var(--color-danger)]"
                : "bg-[color:var(--color-primary)]/15 hover:bg-[color:var(--color-primary)]/25 border-[color:var(--color-primary)]/40 text-[color:var(--color-primary-glow)]",
            )}
          >
            {pending.confirmLabel ?? "Confirmar"}
          </button>
        </div>
      </div>
    </div>
  );
}
