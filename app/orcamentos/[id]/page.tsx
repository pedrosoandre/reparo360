"use client";

import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  ChevronLeft,
  Check,
  X,
  Download,
  FileEdit,
  Car,
  Camera,
  Droplet,
  Wrench,
  Plus,
  MessageCircle,
  FileText,
  AlertTriangle,
  Trash2,
} from "lucide-react";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { SendWorkshopModal } from "@/components/budget/send-workshop-modal";
import { OficinasInline } from "@/components/budget/oficinas-inline";
import { MobileActionBar } from "@/components/ui/mobile-action-bar";
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
  sent: "Enviado",
  reviewing: "Em análise",
  approved: "Aprovado",
  rejected: "Recusado",
  completed: "Concluído",
};

const STATUS_COLOR: Record<BudgetStatus, string> = {
  draft: "bg-white/[0.06] text-white/70",
  sent: "bg-[color:var(--color-primary)]/15 text-[color:var(--color-primary-glow)]",
  reviewing: "bg-yellow-500/15 text-yellow-300",
  approved: "bg-[color:var(--color-success)]/15 text-[color:var(--color-success)]",
  rejected: "bg-[color:var(--color-danger)]/15 text-[color:var(--color-danger)]",
  completed: "bg-emerald-500/15 text-emerald-300",
};

/** Confiança abaixo disso vira alerta amarelo. */
const LOW_CONFIDENCE_THRESHOLD = 40;

export default function BudgetDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const user = useCurrentUser();
  const budget = useBudgetsStore((s) => s.getBudget(params.id));
  const setStatus = useBudgetsStore((s) => s.setStatus);
  const removeBudget = useBudgetsStore((s) => s.removeBudget);
  const addExtra = useBudgetsStore((s) => s.addExtra);
  const removeExtra = useBudgetsStore((s) => s.removeExtra);
  const recordOficinaContact = useBudgetsStore((s) => s.recordOficinaContact);
  const [sendOpen, setSendOpen] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);

  // A barra fixa do celular leva até a seção de oficinas; quando a seção já
  // está na tela, a barra sai pra não cobrir os botões de WhatsApp.
  const oficinasRef = useRef<HTMLDivElement>(null);
  const [oficinasVisible, setOficinasVisible] = useState(false);
  const budgetId = budget?.id;
  useEffect(() => {
    const el = oficinasRef.current;
    if (!el) return;
    // isIntersecting é true com 1px visível; o que conta é quanto da seção
    // está na tela, por isso a proporção e os dois limiares.
    const io = new IntersectionObserver(
      ([entry]) => setOficinasVisible(entry.intersectionRatio >= 0.15),
      { threshold: [0, 0.15] },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [budgetId]);

  if (!budget) {
    return (
      <DashboardShell>
        <div className="premium-card p-6 text-center">
          <p className="text-body">Orçamento não encontrado.</p>
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-1 text-label text-[color:var(--color-primary-glow)] mt-3 hover:brightness-125"
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
          <p className="text-body">Este orçamento não é seu.</p>
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
        {/* Nav curta — só voltar */}
        <div className="flex items-center justify-between">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-1 text-label text-[color:var(--color-muted)] hover:text-white transition-colors"
          >
            <ChevronLeft size={13} /> Voltar ao dashboard
          </Link>
          <span
            className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-meta font-semibold uppercase tracking-[0.08em] ${STATUS_COLOR[budget.status]}`}
          >
            {STATUS_LABEL[budget.status]}
          </span>
        </div>

        {/* HEADER — código, veículo, total dominante, aviso de confiança */}
        <div className="premium-card p-5 sm:p-7">
          <div className="flex items-start justify-between gap-6 flex-wrap">
            <div className="min-w-0">
              <p className="text-meta uppercase tracking-[0.08em] text-[color:var(--color-muted)]">
                Código do orçamento
              </p>
              <p className="font-mono tabular text-metric font-semibold">{budget.code}</p>
              <div className="mt-3 flex items-center gap-2 text-label">
                <Car size={14} className="text-[color:var(--color-muted)]" />
                <span className="font-medium">
                  {budget.vehicleSnapshot.brand} {budget.vehicleSnapshot.model}
                </span>
                <span className="text-[color:var(--color-muted)]">·</span>
                <span className="text-[color:var(--color-muted)]">
                  {budget.vehicleSnapshot.year}
                </span>
              </div>
              <p className="text-meta text-[color:var(--color-muted)] mt-2">
                Criado em {formatDate(budget.createdAt)}
                {budget.updatedAt !== budget.createdAt && (
                  <> · Atualizado em {formatDate(budget.updatedAt)}</>
                )}
              </p>
            </div>
            <div className="text-right">
              <p className="text-meta uppercase tracking-[0.08em] text-[color:var(--color-muted)]">
                Total estimado
              </p>
              <p className="tabular text-metric font-bold mt-1">
                {formatBRL(grandTotal)}
              </p>
              <p className="text-meta text-[color:var(--color-muted)] mt-1">
                Reparo {formatBRL(budget.total)}
                {extrasTotal > 0 && ` + extras ${formatBRL(extrasTotal)}`}
              </p>
            </div>
          </div>

          {isLowConfidence && (
            <div className="mt-5 rounded-2xl border border-yellow-500/40 bg-yellow-500/10 p-3 flex items-start gap-2.5">
              <AlertTriangle
                size={16}
                className="text-yellow-300 shrink-0 mt-0.5"
              />
              <div className="text-label leading-relaxed">
                <p className="font-semibold text-yellow-100">
                  Confiança baixa ({budget.confidence}%) — combinação de danos
                  fora da tabela.
                </p>
                <p className="text-yellow-200/70 mt-0.5">
                  O valor é uma estimativa grosseira. Espere variações
                  significativas quando a oficina orçar de fato.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* PEÇAS & DANOS */}
        <div className="premium-card p-4 sm:p-6">
          <h2 className="font-semibold mb-3">
            Peças & danos ({budget.items.length})
          </h2>
          <div className="flex flex-col gap-2">
            {budget.items.map((item) => (
              <div
                key={item.id}
                className="rounded-2xl bg-white/[0.02] border border-white/[0.06] p-3"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-body font-medium truncate">
                      {item.partLabel}
                    </p>
                    <p className="text-meta text-[color:var(--color-muted)] truncate mt-0.5">
                      {item.damages.map((d) => DAMAGE_LABELS[d]).join(", ")}
                    </p>
                    {item.notes && (
                      <p className="text-meta text-[color:var(--color-muted)] mt-1 italic">
                        &ldquo;{item.notes}&rdquo;
                      </p>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <p className="tabular text-body font-semibold">
                      {formatBRL(item.estimatedCost)}
                    </p>
                    <SeverityPill severity={item.severity} />
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Breakdown compacto — só a matemática, sem competir com o total */}
          <div className="mt-4 pt-3 border-t border-white/[0.06] flex items-center justify-between text-meta text-[color:var(--color-muted)]">
            <span>
              Mão de obra + pintura:{" "}
              <span className="text-white font-medium">
                {formatBRL(serviceTotal)}
              </span>
            </span>
            <span>
              Peças:{" "}
              <span className="text-white font-medium">
                {formatBRL(budget.partsTotal)}
              </span>
            </span>
            {extrasTotal > 0 && (
              <span>
                Extras:{" "}
                <span className="text-white font-medium">
                  {formatBRL(extrasTotal)}
                </span>
              </span>
            )}
          </div>
        </div>

        {/* SERVIÇOS EXTRAS */}
        <div className="premium-card p-4 sm:p-6">
          <div className="flex items-center justify-between mb-3 gap-3 flex-wrap">
            <h2 className="font-semibold">
              Serviços extras{" "}
              <span className="text-[color:var(--color-muted)] font-normal">
                ({budget.extras?.length ?? 0})
              </span>
            </h2>
            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                onClick={() => addExtra(budget.id, "oil_change")}
                className="inline-flex items-center gap-1 rounded-full bg-[#F5A524]/15 hover:bg-[#F5A524]/25 border border-[#F5A524]/30 px-2.5 py-1 text-label font-medium text-[#F5A524] transition"
              >
                <Plus size={11} /> Troca de óleo
              </button>
              <button
                onClick={() => addExtra(budget.id, "wheel_alignment")}
                className="inline-flex items-center gap-1 rounded-full bg-[color:var(--color-primary)]/15 hover:bg-[color:var(--color-primary)]/25 border border-[color:var(--color-primary)]/40 px-2.5 py-1 text-label font-medium text-white transition"
              >
                <Plus size={11} /> Geometria + balanceamento
              </button>
            </div>
          </div>
          {(budget.extras?.length ?? 0) === 0 ? (
            <p className="text-label text-[color:var(--color-muted)]">
              Nenhum extra adicionado. Ofereça para o cliente durante o
              atendimento — é upsell direto.
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
                    <p className="text-body font-medium truncate">{e.label}</p>
                    <p className="text-meta text-[color:var(--color-muted)] mt-0.5">
                      Adicionado em {formatDate(e.addedAt)} · Catálogo:{" "}
                      {formatBRL(EXTRA_CATALOG[e.kind].price)}
                    </p>
                  </div>
                  <p className="tabular text-body font-semibold shrink-0">
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

        {/* ENVIAR PARA OFICINA — bloco principal em destaque */}
        <div ref={oficinasRef} id="enviar-oficina" className="scroll-mt-20">
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
        </div>

        {/* CONTATOS FEITOS — só aparece quando tem algo */}
        {(budget.contactedOficinas?.length ?? 0) > 0 && (
          <div className="premium-card p-4 sm:p-6">
            <h2 className="font-semibold mb-3 flex items-center gap-2">
              <Check size={15} className="text-[color:var(--color-success)]" />
              Contatos feitos ({budget.contactedOficinas!.length})
            </h2>
            <div className="flex flex-col gap-1.5">
              {budget.contactedOficinas!.map((c, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between gap-3 rounded-xl bg-white/[0.02] border border-white/[0.06] px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="text-body font-medium truncate">{c.nome}</p>
                    <p className="text-meta text-[color:var(--color-muted)]">
                      {c.cidade}
                    </p>
                  </div>
                  <p className="text-meta text-[color:var(--color-muted)] shrink-0">
                    Enviado em {formatDate(c.sentAt)}
                  </p>
                </div>
              ))}
            </div>
            <p className="text-meta text-[color:var(--color-muted)] mt-3 leading-relaxed">
              As respostas voltam pelo WhatsApp da oficina. Quando registrar
              contra-propostas aqui, dá pra comparar — em breve.
            </p>
          </div>
        )}

        {/* FOTOS */}
        {budget.photos.length > 0 && (
          <div className="premium-card p-4 sm:p-6">
            <h2 className="font-semibold mb-3 flex items-center gap-2">
              <Camera size={14} /> Fotos ({budget.photos.length})
            </h2>
            <BudgetPhotoGrid refs={budget.photos} />
          </div>
        )}

        {/* AÇÕES SECUNDÁRIAS — status + exportar + apagar */}
        <div className="premium-card p-4 sm:p-6">
          <h2 className="font-semibold mb-3 text-label uppercase tracking-[0.08em] text-[color:var(--color-muted)]">
            Ações do orçamento
          </h2>

          {/* Mudança de status */}
          {budget.status !== "approved" && budget.status !== "completed" && (
            <div className="flex flex-wrap items-center gap-2 mb-3">
              <button
                onClick={() => setStatus(budget.id, "approved")}
                className="inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-[color:var(--color-success)]/15 hover:bg-[color:var(--color-success)]/25 border border-[color:var(--color-success)]/30 px-3.5 py-2 text-label font-medium text-[color:var(--color-success)] transition lg:min-h-0"
              >
                <Check size={13} /> Marcar como aprovado
              </button>
              <button
                onClick={() => setStatus(budget.id, "rejected")}
                className="inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-[color:var(--color-danger)]/10 hover:bg-[color:var(--color-danger)]/20 border border-[color:var(--color-danger)]/30 px-3.5 py-2 text-label font-medium text-[color:var(--color-danger)] transition lg:min-h-0"
              >
                <X size={13} /> Recusar
              </button>
              {budget.status === "draft" && (
                <button
                  onClick={() => router.push("/dashboard")}
                  className="inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] px-3.5 py-2 text-label font-medium text-white transition lg:min-h-0"
                >
                  <FileEdit size={13} /> Continuar editando
                </button>
              )}
            </div>
          )}

          {/* Exportar + apagar — separados visualmente pra não competir com status */}
          <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-white/[0.06]">
            <button
              onClick={handlePDF}
              disabled={pdfBusy}
              className="inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] px-3 py-1.5 text-label font-medium text-white transition disabled:opacity-60 lg:min-h-0"
            >
              <FileText size={12} /> {pdfBusy ? "Gerando…" : "Baixar PDF"}
            </button>
            <button
              onClick={exportJSON}
              className="inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] px-3 py-1.5 text-label font-medium text-white transition lg:min-h-0"
              title="Exportar JSON bruto (backup)"
            >
              <Download size={12} /> Exportar JSON
            </button>
            {/* "Apagar" sozinho numa linha, com divisória: no celular ele ficava
                8px abaixo do PDF e do JSON, com a mesma altura. */}
            <div className="ml-auto max-lg:ml-0 max-lg:mt-2 max-lg:w-full max-lg:border-t max-lg:border-white/[0.06] max-lg:pt-4">
              <button
                onClick={async () => {
                  const ok = await confirmDialog({
                    message: `Apagar orçamento ${budget.code}?`,
                    confirmLabel: "Apagar",
                    danger: true,
                  });
                  if (ok) {
                    removeBudget(budget.id);
                    router.push("/dashboard");
                  }
                }}
                className="inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-white/[0.02] hover:bg-[color:var(--color-danger)]/15 border border-white/[0.06] hover:border-[color:var(--color-danger)]/30 px-3 py-1.5 text-label font-medium text-[color:var(--color-muted)] hover:text-[color:var(--color-danger)] transition max-lg:w-full max-lg:justify-center lg:min-h-0"
              >
                <Trash2 size={12} /> Apagar orçamento
              </button>
            </div>
          </div>
        </div>
      </div>

      {!oficinasVisible && (
        <MobileActionBar>
          <div className="min-w-0 flex-1">
            <p className="text-meta text-[color:var(--color-muted)]">Total estimado</p>
            <p className="text-title font-semibold tabular truncate">{formatBRL(grandTotal)}</p>
          </div>
          <button
            onClick={() =>
              document.getElementById("enviar-oficina")?.scrollIntoView({
                behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
                  ? "auto"
                  : "smooth",
                block: "start",
              })
            }
            className="h-12 shrink-0 rounded-2xl bg-[color:var(--color-primary)] px-5 text-label font-semibold text-white flex items-center gap-2"
          >
            <MessageCircle size={16} />
            Enviar para oficina
          </button>
        </MobileActionBar>
      )}

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

/** Referências das fotos moram no IndexedDB; o orçamento guarda só o pointer. */
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
      className={`inline-block mt-1 text-meta font-semibold uppercase tracking-[0.08em] px-1.5 py-0.5 rounded ${it.cls}`}
    >
      {it.label}
    </span>
  );
}
