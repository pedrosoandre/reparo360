import type { BudgetStatus } from "@/types";

/**
 * Selo de status do orçamento: um quadrado da cor do estado e o rótulo ao
 * lado. É o `.r360-status` da identidade — quadrado, não bolinha, porque nada
 * nesta marca é redondo.
 *
 * A cor carrega o estado sozinha (o quadrado é visível de longe), e o rótulo
 * repete em texto para quem não distingue as cores: o selo não depende só do
 * matiz para ser entendido.
 */
const COR: Record<BudgetStatus, string> = {
  draft: "var(--color-border)",
  reviewing: "var(--color-warning)",
  sent: "var(--color-text)",
  approved: "var(--color-success)",
  rejected: "var(--color-danger)",
  completed: "var(--color-success)",
};

export const STATUS_LABEL: Record<BudgetStatus, string> = {
  draft: "Rascunho",
  reviewing: "Em análise",
  sent: "Enviado à oficina",
  approved: "Aprovado",
  rejected: "Recusado",
  completed: "Concluído",
};

export function StatusBadge({
  status,
  className = "",
}: {
  status: BudgetStatus;
  className?: string;
}) {
  return (
    <span className={`inline-flex items-center gap-2 text-label font-medium ${className}`}>
      <span
        aria-hidden
        className="inline-block h-2.5 w-2.5 shrink-0"
        style={{ background: COR[status] }}
      />
      {STATUS_LABEL[status]}
    </span>
  );
}
