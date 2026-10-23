"use client";

import { X, AlertTriangle, CheckCircle2, Info } from "lucide-react";
import { useToastStore } from "@/stores/toast-store";
import { cn } from "@/lib/utils";

const ICONS = {
  info: Info,
  error: AlertTriangle,
  success: CheckCircle2,
} as const;

export function Toaster() {
  const toasts = useToastStore((s) => s.toasts);
  const dismiss = useToastStore((s) => s.dismiss);

  if (toasts.length === 0) return null;

  return (
    <div
      // Assertivo porque substitui alert(), que interrompia o usuário.
      role="alert"
      aria-live="assertive"
      className="fixed z-[80] bottom-4 left-1/2 -translate-x-1/2 w-[min(28rem,calc(100vw-2rem))] flex flex-col gap-2"
    >
      {toasts.map((t) => {
        const Icon = ICONS[t.kind];
        return (
          <div
            key={t.id}
            className={cn(
              "flex items-start gap-2 rounded-2xl border px-3 py-2.5 backdrop-blur-md shadow-lg",
              t.kind === "error"
                ? "bg-[color:var(--color-danger)]/15 border-[color:var(--color-danger)]/40"
                : t.kind === "success"
                  ? "bg-[color:var(--color-success)]/15 border-[color:var(--color-success)]/40"
                  : "bg-[color:var(--color-surface)]/95 border-[color:var(--color-border-strong)]",
            )}
          >
            <Icon
              size={14}
              className={cn(
                "mt-0.5 shrink-0",
                t.kind === "error"
                  ? "text-[color:var(--color-danger)]"
                  : t.kind === "success"
                    ? "text-[color:var(--color-success)]"
                    : "text-[color:var(--color-muted)]",
              )}
            />
            <p className="flex-1 text-xs text-[color:var(--color-text)]">{t.message}</p>
            <button
              onClick={() => dismiss(t.id)}
              aria-label="Fechar aviso"
              className="shrink-0 text-[color:var(--color-muted)] hover:text-[color:var(--color-text)] transition-colors"
            >
              <X size={13} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
