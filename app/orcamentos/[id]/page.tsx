"use client";

import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useState } from "react";
import {
  ChevronLeft,
  X,
  Download,
  Camera,
  Droplet,
  Wrench,
  Plus,
  FileText,
  AlertTriangle,
  Trash2,
  ChevronDown,
  Check,
} from "lucide-react";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { SendWorkshopModal } from "@/components/budget/send-workshop-modal";
import { OficinasInline } from "@/components/budget/oficinas-inline";
import { useCurrentUser } from "@/stores/auth-store";
import { EXTRA_CATALOG, useBudgetsStore } from "@/stores/budgets-store";
import { downloadBudgetPDF } from "@/lib/budget-pdf";
import { toast } from "@/stores/toast-store";
import { formatBRL, formatDate } from "@/lib/utils";
import { DAMAGE_LABELS } from "@/lib/car-parts";
import { splitServiceParts } from "@/lib/pricing";
import { usePhotoUrls } from "@/lib/use-photo-urls";
import type { BudgetStatus } from "@/types";
import { confirmDialog } from "@/stores/confirm-store";

const STATUS_LABEL: Record<BudgetStatus, string> = {
  draft: "Rascunho",
  ready: "Pronto pra enviar",
  sent: "Enviado",
  reviewing: "Em análise",
  approved: "Aprovado",
  rejected: "Recusado",
  completed: "Concluído",
};

const STATUS_COLOR: Record<BudgetStatus, string> = {
  draft: "bg-white/[0.06] text-white/70",
  ready: "bg-white/[0.1] text-white/85",
  sent: "bg-[color:var(--color-primary)]/15 text-[color:var(--color-primary-glow)]",
  reviewing: "bg-yellow-500/15 text-yellow-300",
  approved: "bg-[color:var(--color-success)]/15 text-[color:var(--color-success)]",
  rejected: "bg-[color:var(--color-danger)]/15 text-[color:var(--color-danger)]",
  completed: "bg-emerald-500/15 text-emerald-300",
};

const LOW_CONFIDENCE_THRESHOLD = 40;

export default function BudgetDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const user = useCurrentUser();
  const budget = useBudgetsStore((s) => s.getBudget(params.id));
  const removeBudget = useBudgetsStore((s) => s.removeBudget);
  const addExtra = useBudgetsStore((s) => s.addExtra);
  const removeExtra = useBudgetsStore((s) => s.removeExtra);
  const recordOficinaContact = useBudgetsStore((s) => s.recordOficinaContact);
  const [sendOpen, setSendOpen] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);

  if (!budget) {
    return (
      <DashboardShell>
        <div className="premium-card p-6 text-center">
          <p className="text-sm">Orçamento não encontrado.</p>
          <Link
            href="/orcamentos"
            className="inline-flex items-center gap-1 text-xs text-[color:var(--color-primary-glow)] mt-3 hover:brightness-125"
          >
            <ChevronLeft size={12} /> Voltar
          </Link>
        </div>
      </DashboardShell>
    );
  }

  if (user && budget.userId !== user.id) {
    return (
      <DashboardShell>
        <div className="premium-card p-6 text-center">
          <p className="text-sm">Este orçamento não é seu.</p>
        </div>
      </DashboardShell>
    );
  }

  const extrasTotal = (budget.extras ?? []).reduce((a, e) => a + e.price, 0);
  const serviceTotal = splitServiceParts({
    parts: budget.partsTotal,
    total: budget.total,
  }).service;
  const grandTotal = budget.total + extrasTotal;
  const isLowConfidence = budget.confidence < LOW_CONFIDENCE_THRESHOLD;
  const extrasCount = budget.extras?.length ?? 0;
  const photosCount = budget.photos.length;
  const contactsCount = budget.contactedOficinas?.length ?? 0;

  async function handlePDF() {
    if (!budget) return;
    setPdfBusy(true);
    try {
      await downloadBudgetPDF(budget);
      toast("PDF gerado — baixando…", "success");
    } catch (e) {
      toast(`Erro ao gerar PDF: ${(e as Error).message}`, "error");
    } finally {
      setPdfBusy(false);
    }
  }

  function exportJSON() {
    if (!budget) return;
    const blob = new Blob([JSON.stringify(budget, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${budget.code}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <DashboardShell>
      <div className="flex flex-col gap-4">
        {/* Nav */}
        <div className="flex items-center justify-between">
          <Link
            href="/orcamentos"
            className="inline-flex items-center gap-1 text-xs text-[color:var(--color-muted)] hover:text-white transition-colors"
          >
            <ChevronLeft size={13} /> Meus orçamentos
          </Link>
          <span
            className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-wider ${STATUS_COLOR[budget.status]}`}
          >
            {STATUS_LABEL[budget.status]}
          </span>
        </div>

        {/* HEADER minimalista — só o valor e o veículo */}
        <div className="premium-card p-6 sm:p-8 text-center">
          <p className="text-[11px] uppercase tracking-wider text-[color:var(--color-muted)]">
            Total estimado
          </p>
          <p className="text-5xl sm:text-6xl font-bold tracking-tight mt-2">
            {formatBRL(grandTotal)}
          </p>
          <p className="text-sm text-[color:var(--color-muted)] mt-3">
            {budget.vehicleSnapshot.brand} {budget.vehicleSnapshot.model} ·{" "}
            {budget.vehicleSnapshot.year}
          </p>

          {isLowConfidence && (
            <div className="mt-5 rounded-2xl border border-yellow-500/40 bg-yellow-500/10 p-3 flex items-start gap-2.5 text-left">
              <AlertTriangle
                size={16}
                className="text-yellow-300 shrink-0 mt-0.5"
              />
              <div className="text-xs leading-relaxed">
                <p className="font-semibold text-yellow-100">
                  Confiança baixa ({budget.confidence}%) — estimativa grosseira.
                </p>
                <p className="text-yellow-200/70 mt-0.5">
                  Espere variações quando a oficina orçar de fato.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* CTA principal — enviar para oficina, lista completa */}
        <OficinasInline
          budget={budget}
          onOficinaContacted={(o) =>
            recordOficinaContact(budget.id, {
              nome: o.nome,
              cidade: o.cidade,
              waId: o.waId,
            })
          }
          onOpenFullPicker={() => setSendOpen(true)}
        />

        {/* MAIS INFORMAÇÕES — tudo colapsado num seletor só */}
        <details className="premium-card group [&_summary::-webkit-details-marker]:hidden">
          <summary className="p-4 sm:p-5 cursor-pointer list-none flex items-center justify-between gap-3 hover:bg-white/[0.02] transition-colors rounded-[inherit]">
            <div className="min-w-0">
              <p className="font-semibold text-sm">Mais informações</p>
              <p className="text-[11px] text-[color:var(--color-muted)] mt-0.5">
                Código, peças, extras, fotos e exportações
              </p>
            </div>
            <ChevronDown
              size={16}
              className="text-[color:var(--color-muted)] shrink-0 transition-transform group-open:rotate-180"
            />
          </summary>

          <div className="px-4 sm:px-5 pb-5 flex flex-col gap-5">
            {/* Metadados do orçamento */}
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
              <dt className="text-[color:var(--color-muted)]">Código</dt>
              <dd className="font-mono">{budget.code}</dd>
              <dt className="text-[color:var(--color-muted)]">Criado em</dt>
              <dd>{formatDate(budget.createdAt)}</dd>
              {budget.updatedAt !== budget.createdAt && (
                <>
                  <dt className="text-[color:var(--color-muted)]">
                    Atualizado em
                  </dt>
                  <dd>{formatDate(budget.updatedAt)}</dd>
                </>
              )}
              <dt className="text-[color:var(--color-muted)]">Mão de obra</dt>
              <dd>{formatBRL(serviceTotal)}</dd>
              <dt className="text-[color:var(--color-muted)]">Peças</dt>
              <dd>{formatBRL(budget.partsTotal)}</dd>
              {extrasTotal > 0 && (
                <>
                  <dt className="text-[color:var(--color-muted)]">Extras</dt>
                  <dd>{formatBRL(extrasTotal)}</dd>
                </>
              )}
            </dl>

            {/* Peças & danos */}
            <div>
              <p className="text-[11px] uppercase tracking-wider text-[color:var(--color-muted)] mb-2">
                Peças & danos ({budget.items.length})
              </p>
              <div className="flex flex-col gap-2">
                {budget.items.map((item) => (
                  <div
                    key={item.id}
                    className="rounded-2xl bg-white/[0.02] border border-white/[0.06] p-3"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">
                          {item.partLabel}
                        </p>
                        <p className="text-[11px] text-[color:var(--color-muted)] truncate mt-0.5">
                          {item.damages.map((d) => DAMAGE_LABELS[d]).join(", ")}
                        </p>
                        {item.notes && (
                          <p className="text-[11px] text-[color:var(--color-muted)] mt-1 italic">
                            &ldquo;{item.notes}&rdquo;
                          </p>
                        )}
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-semibold">
                          {formatBRL(item.estimatedCost)}
                        </p>
                        <SeverityPill severity={item.severity} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Serviços extras */}
            <div>
              <div className="flex items-center justify-between gap-3 flex-wrap mb-2">
                <p className="text-[11px] uppercase tracking-wider text-[color:var(--color-muted)]">
                  Serviços extras
                </p>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <button
                    onClick={() => addExtra(budget.id, "oil_change")}
                    className="inline-flex items-center gap-1 rounded-full bg-[#F5A524]/15 hover:bg-[#F5A524]/25 border border-[#F5A524]/30 px-2.5 py-1 text-[11px] font-medium text-[#F5A524] transition"
                  >
                    <Plus size={11} /> Troca de óleo
                  </button>
                  <button
                    onClick={() => addExtra(budget.id, "wheel_alignment")}
                    className="inline-flex items-center gap-1 rounded-full bg-[color:var(--color-primary)]/15 hover:bg-[color:var(--color-primary)]/25 border border-[color:var(--color-primary)]/40 px-2.5 py-1 text-[11px] font-medium text-white transition"
                  >
                    <Plus size={11} /> Geometria
                  </button>
                </div>
              </div>
              {extrasCount === 0 ? (
                <p className="text-xs text-[color:var(--color-muted)]">
                  Nenhum extra adicionado.
                </p>
              ) : (
                <div className="flex flex-col gap-2">
                  {budget.extras!.map((e) => (
                    <div
                      key={e.id}
                      className="rounded-2xl bg-white/[0.02] border border-white/[0.06] p-3 flex items-center gap-3"
                    >
                      <div className="w-9 h-9 rounded-xl bg-white/[0.05] border border-white/[0.06] flex items-center justify-center shrink-0 text-[color:var(--color-muted)]">
                        {e.kind === "oil_change" ? (
                          <Droplet size={15} />
                        ) : (
                          <Wrench size={15} />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">
                          {e.label}
                        </p>
                        <p className="text-[11px] text-[color:var(--color-muted)] mt-0.5">
                          Catálogo: {formatBRL(EXTRA_CATALOG[e.kind].price)}
                        </p>
                      </div>
                      <p className="text-sm font-semibold shrink-0">
                        {formatBRL(e.price)}
                      </p>
                      <button
                        onClick={() => removeExtra(budget.id, e.id)}
                        title="Remover serviço"
                        aria-label="Remover serviço"
                        className="w-7 h-7 rounded-full hover:bg-[color:var(--color-danger)]/15 hover:text-[color:var(--color-danger)] text-[color:var(--color-muted)] flex items-center justify-center transition-colors shrink-0"
                      >
                        <X size={13} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Fotos */}
            {photosCount > 0 && (
              <div>
                <p className="text-[11px] uppercase tracking-wider text-[color:var(--color-muted)] mb-2 flex items-center gap-1.5">
                  <Camera size={12} /> Fotos ({photosCount})
                </p>
                <BudgetPhotoGrid refs={budget.photos} />
              </div>
            )}

            {/* Contatos feitos */}
            {contactsCount > 0 && (
              <div>
                <p className="text-[11px] uppercase tracking-wider text-[color:var(--color-muted)] mb-2 flex items-center gap-1.5">
                  <Check size={12} className="text-[color:var(--color-success)]" />
                  Contatos feitos ({contactsCount})
                </p>
                <div className="flex flex-col gap-1.5">
                  {budget.contactedOficinas!.map((c, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between gap-3 rounded-xl bg-white/[0.02] border border-white/[0.06] px-3 py-2"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{c.nome}</p>
                        <p className="text-[11px] text-[color:var(--color-muted)]">
                          {c.cidade}
                        </p>
                      </div>
                      <p className="text-[11px] text-[color:var(--color-muted)] shrink-0">
                        {formatDate(c.sentAt)}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Ações — exportar e apagar */}
            <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-white/[0.06]">
              <button
                onClick={handlePDF}
                disabled={pdfBusy}
                className="inline-flex items-center gap-1.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] px-3 py-1.5 text-xs font-medium text-white transition disabled:opacity-60"
              >
                <FileText size={12} /> {pdfBusy ? "Gerando…" : "Baixar PDF"}
              </button>
              <button
                onClick={exportJSON}
                className="inline-flex items-center gap-1.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] px-3 py-1.5 text-xs font-medium text-white transition"
                title="Exportar JSON bruto (backup)"
              >
                <Download size={12} /> Exportar JSON
              </button>
              <button
                onClick={async () => {
                  const ok = await confirmDialog({
                    message: `Apagar orçamento ${budget.code}?`,
                    confirmLabel: "Apagar",
                    danger: true,
                  });
                  if (ok) {
                    removeBudget(budget.id);
                    router.push("/orcamentos");
                  }
                }}
                className="ml-auto inline-flex items-center gap-1.5 rounded-xl bg-white/[0.02] hover:bg-[color:var(--color-danger)]/15 border border-white/[0.06] hover:border-[color:var(--color-danger)]/30 px-3 py-1.5 text-xs font-medium text-[color:var(--color-muted)] hover:text-[color:var(--color-danger)] transition"
              >
                <Trash2 size={12} /> Apagar
              </button>
            </div>
          </div>
        </details>
      </div>

      {sendOpen && budget && (
        <SendWorkshopModal
          budget={budget}
          initialCity={budget.location}
          onOficinaContacted={(o) =>
            recordOficinaContact(budget.id, {
              nome: o.nome,
              cidade: o.cidade,
              waId: o.waId,
            })
          }
          onClose={() => setSendOpen(false)}
        />
      )}
    </DashboardShell>
  );
}

function BudgetPhotoGrid({ refs }: { refs: string[] }) {
  const urls = usePhotoUrls(refs);
  return (
    <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
      {refs.map((ref, i) => (
        <div
          key={ref}
          className="aspect-square rounded-lg overflow-hidden border border-white/[0.06] bg-white/[0.03]"
        >
          {urls[i] && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={urls[i]!}
              alt=""
              className="w-full h-full object-cover"
              loading="lazy"
            />
          )}
        </div>
      ))}
    </div>
  );
}

function SeverityPill({ severity }: { severity: "low" | "medium" | "high" }) {
  const map = {
    low: {
      label: "Baixa",
      cls: "bg-[color:var(--color-success)]/15 text-[color:var(--color-success)]",
    },
    medium: { label: "Média", cls: "bg-yellow-500/15 text-yellow-300" },
    high: {
      label: "Alta",
      cls: "bg-[color:var(--color-danger)]/15 text-[color:var(--color-danger)]",
    },
  } as const;
  const it = map[severity];
  return (
    <span
      className={`inline-block mt-1 text-[9px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded ${it.cls}`}
    >
      {it.label}
    </span>
  );
}
