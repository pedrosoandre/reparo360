"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Receipt, Filter, ChevronRight, Trash2 } from "lucide-react";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { EmptyState } from "@/components/ui/empty-state";
import { useCurrentUser } from "@/stores/auth-store";
import { useBudgetsStore } from "@/stores/budgets-store";
import { formatBRL, formatDate, cn } from "@/lib/utils";
import type { BudgetStatus } from "@/types";
import { confirmDialog } from "@/stores/confirm-store";

const STATUS_LABEL: Record<BudgetStatus, string> = {
  draft: "Rascunho",
  sent: "Enviado",
  reviewing: "Em análise",
  approved: "Aprovado",
  rejected: "Recusado",
  completed: "Concluído",
};

const STATUS_STYLES: Record<BudgetStatus, string> = {
  draft: "bg-white/[0.06] text-white/70",
  sent: "bg-[color:var(--color-primary)]/15 text-[color:var(--color-primary-glow)]",
  reviewing: "bg-yellow-500/15 text-yellow-300",
  approved: "bg-[color:var(--color-success)]/15 text-[color:var(--color-success)]",
  rejected: "bg-[color:var(--color-danger)]/15 text-[color:var(--color-danger)]",
  completed: "bg-emerald-500/15 text-emerald-300",
};

const FILTERS: { key: BudgetStatus | "all"; label: string }[] = [
  { key: "all", label: "Todos" },
  { key: "draft", label: "Rascunhos" },
  { key: "sent", label: "Enviados" },
  { key: "approved", label: "Aprovados" },
  { key: "rejected", label: "Recusados" },
  { key: "completed", label: "Concluídos" },
];

export default function OrcamentosPage() {
  const user = useCurrentUser();
  const allBudgets = useBudgetsStore((s) => s.budgets);
  const removeBudget = useBudgetsStore((s) => s.removeBudget);
  const [filter, setFilter] = useState<BudgetStatus | "all">("all");

  const budgets = useMemo(() => {
    const mine = user ? allBudgets.filter((b) => b.userId === user.id) : [];
    return mine.sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
    );
  }, [allBudgets, user]);

  const filtered = filter === "all" ? budgets : budgets.filter((b) => b.status === filter);
  const total = budgets.reduce((sum, b) => sum + b.total, 0);

  return (
    <DashboardShell>
      <div className="flex flex-col gap-4">
        <div className="premium-card p-4 sm:p-5">
          <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
            <div>
              <h1 className="text-lg font-semibold">Meus orçamentos</h1>
              <p className="text-xs text-[color:var(--color-muted)]">
                {budgets.length} no total · {formatBRL(total)} estimado
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 flex-wrap mb-4">
            <Filter size={12} className="text-[color:var(--color-muted)]" />
            {FILTERS.map((f) => {
              const count =
                f.key === "all"
                  ? budgets.length
                  : budgets.filter((b) => b.status === f.key).length;
              const active = filter === f.key;
              return (
                <button
                  key={f.key}
                  onClick={() => setFilter(f.key)}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] transition-colors",
                    active
                      ? "bg-[color:var(--color-primary)]/15 border-[color:var(--color-primary)]/40 text-white"
                      : "bg-white/[0.02] border-white/[0.06] text-[color:var(--color-muted)] hover:text-white hover:bg-white/[0.05]",
                  )}
                >
                  {f.label}
                  <span className="text-[10px] opacity-60">{count}</span>
                </button>
              );
            })}
          </div>

          {filtered.length === 0 ? (
            <EmptyState
              icon={Receipt}
              title={filter === "all" ? "Nenhum orçamento" : "Nada aqui com esse filtro"}
              description={
                filter === "all"
                  ? "Cadastre danos no dashboard e clique em Finalizar orçamento pra ter o primeiro registro."
                  : "Tente outro filtro pra ver mais orçamentos."
              }
            />
          ) : (
            <div className="flex flex-col gap-2">
              {filtered.map((b) => (
                <div
                  key={b.id}
                  className="flex items-center gap-3 rounded-2xl bg-white/[0.02] border border-white/[0.06] p-3 hover:border-white/[0.12] transition-colors"
                >
                  <div className="w-10 h-10 rounded-xl bg-[color:var(--color-primary)]/10 border border-[color:var(--color-primary)]/20 flex items-center justify-center text-[color:var(--color-primary-glow)] shrink-0">
                    <Receipt size={16} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">
                      {b.vehicleSnapshot.brand} {b.vehicleSnapshot.model} ·{" "}
                      {b.vehicleSnapshot.year}
                    </p>
                    <p className="text-[11px] text-[color:var(--color-muted)] flex items-center gap-2 mt-0.5">
                      <span className="font-mono">{b.code}</span>
                      <span>· {b.items.length} peça(s)</span>
                      <span>· {formatDate(b.updatedAt)}</span>
                    </p>
                  </div>
                  <div className="text-right shrink-0 mr-2">
                    <p className="text-sm font-semibold">{formatBRL(b.total)}</p>
                    <span
                      className={cn(
                        "inline-block mt-0.5 text-[9px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded",
                        STATUS_STYLES[b.status],
                      )}
                    >
                      {STATUS_LABEL[b.status]}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Link
                      href={`/orcamentos/${b.id}`}
                      aria-label="Abrir"
                      className="w-8 h-8 rounded-xl bg-white/[0.03] hover:bg-white/[0.08] text-[color:var(--color-muted)] hover:text-white flex items-center justify-center transition-colors"
                    >
                      <ChevronRight size={14} />
                    </Link>
                    <button
                      onClick={async () => {
                        const ok = await confirmDialog({
                          message: `Apagar orçamento ${b.code}?`,
                          confirmLabel: "Apagar",
                          danger: true,
                        });
                        if (ok) removeBudget(b.id);
                      }}
                      aria-label="Apagar"
                      className="w-8 h-8 rounded-xl bg-white/[0.03] hover:bg-[color:var(--color-danger)]/15 text-[color:var(--color-muted)] hover:text-[color:var(--color-danger)] flex items-center justify-center transition-colors"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </DashboardShell>
  );
}
