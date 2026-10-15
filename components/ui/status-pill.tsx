import { cn } from "@/lib/utils";
import type { Budget } from "@/types";

const LABELS: Record<Budget["status"], string> = {
  draft: "Rascunho",
  ready: "Pronto pra enviar",
  sent: "Enviado",
  reviewing: "Em análise",
  approved: "Aprovado",
  rejected: "Rejeitado",
  completed: "Concluído",
};

const STYLES: Record<Budget["status"], string> = {
  draft: "bg-white/5 text-text-secondary",
  ready: "bg-white/10 text-white/85",
  sent: "bg-[color:var(--color-primary)]/15 text-[color:var(--color-primary-soft)]",
  reviewing: "bg-yellow-500/15 text-yellow-300",
  approved: "bg-[color:var(--color-success)]/15 text-[color:var(--color-success)]",
  rejected: "bg-[color:var(--color-danger)]/15 text-[color:var(--color-danger)]",
  completed: "bg-[color:var(--color-warning)]/15 text-[color:var(--color-warning)]",
};

export function StatusPill({ status }: { status: Budget["status"] }) {
  return (
    <span className={cn("inline-flex items-center rounded-full px-3 py-1 text-xs font-medium", STYLES[status])}>
      {LABELS[status]}
    </span>
  );
}
