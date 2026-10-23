"use client";

import Link from "next/link";
import { useMemo } from "react";
import { Trash2, Send, FileEdit, ChevronRight } from "lucide-react";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { EmptyState } from "@/components/ui/empty-state";
import { useCurrentUser } from "@/stores/auth-store";
import { useBudgetsStore } from "@/stores/budgets-store";
import { formatBRL, formatDate } from "@/lib/utils";
import { confirmDialog } from "@/stores/confirm-store";

export default function RascunhosPage() {
  const user = useCurrentUser();
  const allBudgets = useBudgetsStore((s) => s.budgets);
  const drafts = useMemo(
    () =>
      user
        ? allBudgets.filter((b) => b.userId === user.id && b.status === "draft")
        : [],
    [allBudgets, user],
  );
  const removeBudget = useBudgetsStore((s) => s.removeBudget);
  const setStatus = useBudgetsStore((s) => s.setStatus);

  function handleSend(id: string) {
    setStatus(id, "sent");
  }

  return (
    <DashboardShell>
      <div className="premium-card p-4 sm:p-5">
        <h1 className="text-lg font-semibold">Rascunhos</h1>
        <p className="text-xs text-[color:var(--color-muted)] mb-4">
          Orçamentos que você começou mas ainda não enviou.
        </p>

        {drafts.length === 0 ? (
          <EmptyState
            icon={FileEdit}
            title="Nenhum rascunho"
            description="Quando você começar a montar um orçamento, ele aparece aqui até ser enviado."
          />
        ) : (
          <div className="flex flex-col gap-2">
            {drafts.map((b) => (
              <div
                key={b.id}
                className="flex items-center gap-3 rounded-2xl bg-[color:var(--color-surface)] border border-[color:var(--color-border)] p-3 hover:border-[color:var(--color-border-strong)] transition-colors"
              >
                <div className="w-10 h-10 rounded-xl bg-[color:var(--color-primary)]/10 border border-[color:var(--color-primary)]/20 flex items-center justify-center text-[color:var(--color-primary-glow)] shrink-0">
                  <FileEdit size={16} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">
                    {b.vehicleSnapshot.brand} {b.vehicleSnapshot.model} · {b.vehicleSnapshot.year}
                  </p>
                  <p className="text-[11px] text-[color:var(--color-muted)] flex items-center gap-2 mt-0.5">
                    <span className="font-mono">{b.code}</span>
                    <span>· {b.items.length} peça(s)</span>
                    <span>· {formatDate(b.updatedAt)}</span>
                  </p>
                </div>
                <div className="text-right shrink-0 mr-2">
                  <p className="text-sm font-semibold">{formatBRL(b.total)}</p>
                  <p className="text-[10px] text-[color:var(--color-muted)]">estimado</p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => handleSend(b.id)}
                    aria-label="Enviar"
                    title="Enviar orçamento"
                    className="w-8 h-8 rounded-xl bg-[color:var(--color-primary)]/15 hover:bg-[color:var(--color-primary)]/30 text-[color:var(--color-primary-glow)] flex items-center justify-center transition-colors"
                  >
                    <Send size={13} />
                  </button>
                  <Link
                    href={`/orcamentos/${b.id}`}
                    aria-label="Abrir"
                    className="w-8 h-8 rounded-xl bg-[color:var(--color-surface)] hover:bg-[color:var(--color-surface-3)] text-[color:var(--color-muted)] hover:text-[color:var(--color-text)] flex items-center justify-center transition-colors"
                  >
                    <ChevronRight size={14} />
                  </Link>
                  <button
                    onClick={async () => {
                      const ok = await confirmDialog({
                        message: `Apagar rascunho ${b.code}?`,
                        confirmLabel: "Apagar",
                        danger: true,
                      });
                      if (ok) removeBudget(b.id);
                    }}
                    aria-label="Apagar"
                    className="w-8 h-8 rounded-xl bg-[color:var(--color-surface)] hover:bg-[color:var(--color-danger)]/15 text-[color:var(--color-muted)] hover:text-[color:var(--color-danger)] flex items-center justify-center transition-colors"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </DashboardShell>
  );
}
