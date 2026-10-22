"use client";

/**
 * Bloco "Enviar para oficina" que aparece INLINE na página do orçamento.
 * Substitui o padrão anterior de "botão abre modal": o cliente vê as 5
 * melhores oficinas da cidade default direto na página, cada uma com botão
 * de WhatsApp próprio. Trocar cidade / ver todas continua abrindo o modal
 * completo (SendWorkshopModal) — este componente é um atalho pro caso comum.
 */
import { useEffect, useMemo, useState } from "react";
import {
  Star,
  MessageCircle,
  MapPin,
  Loader2,
  Search,
  ChevronRight,
  Check,
} from "lucide-react";
import type { Budget } from "@/types";
import {
  findCidade,
  loadOficinasCatalog,
  rankOficinas,
  type CidadeOficinas,
  type Oficina,
  type OficinasCatalog,
} from "@/lib/oficinas";
import {
  publicBudgetUrl,
  whatsappLink,
  whatsappMessage,
} from "@/lib/budget-share";
import { toast } from "@/stores/toast-store";
import { useCurrentUser } from "@/stores/auth-store";

const FALLBACK_CITY = "Porto Alegre";
const INLINE_TOP_N = 5;

interface Props {
  budget: Budget;
  onOficinaContacted: (o: Oficina) => void;
  /** Abre o modal completo pra buscar outra cidade / ver todas as oficinas. */
  onOpenFullPicker: () => void;
}

export function OficinasInline({
  budget,
  onOficinaContacted,
  onOpenFullPicker,
}: Props) {
  const user = useCurrentUser();
  const [catalog, setCatalog] = useState<OficinasCatalog | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    loadOficinasCatalog()
      .then(setCatalog)
      .catch((e) => setLoadError(String(e.message ?? e)));
  }, []);

  const cidade = useMemo<CidadeOficinas | null>(() => {
    if (!catalog) return null;
    // Ordem: cidade do orçamento > cidade do perfil > POA > primeira do catálogo.
    const wanted =
      budget.location?.trim() ||
      user?.city?.trim() ||
      FALLBACK_CITY;
    const match =
      findCidade(catalog, wanted) ??
      findCidade(catalog, FALLBACK_CITY) ??
      catalog.cidades[0];
    return match ?? null;
  }, [catalog, budget.location, user?.city]);

  const ranking = useMemo(
    () => (cidade ? rankOficinas(cidade.oficinas, INLINE_TOP_N) : null),
    [cidade],
  );

  const contactedWaIds = useMemo(
    () => new Set((budget.contactedOficinas ?? []).map((c) => c.waId ?? c.nome)),
    [budget.contactedOficinas],
  );

  function handleSend(o: Oficina) {
    if (!o.waId) {
      toast("Essa oficina não tem WhatsApp cadastrado.", "error");
      return;
    }
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const url = publicBudgetUrl(budget, origin);
    const msg = whatsappMessage(budget, o.nome, url);
    window.open(whatsappLink(o.waId, msg), "_blank", "noopener,noreferrer");
    onOficinaContacted(o);
    toast(`Abrindo WhatsApp de ${o.nome}…`, "success");
  }

  const cidadeVieDoOrcamento =
    !!budget.location &&
    !!cidade &&
    cidade.nome.toLowerCase() === budget.location.trim().toLowerCase();

  return (
    <div className="premium-card p-4 sm:p-6 border border-[#25D366]/25">
      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <h2 className="font-semibold flex items-center gap-2 text-title">
          <MessageCircle size={16} className="text-[#25D366]" />
          Enviar para oficina
        </h2>
        {cidade && (
          <div className="flex items-center gap-2 text-label text-[color:var(--color-muted)]">
            <MapPin size={12} />
            <span>
              {cidade.nome}
              {cidadeVieDoOrcamento ? " (do orçamento)" : ""}
            </span>
            <button
              onClick={onOpenFullPicker}
              className="inline-flex min-h-11 items-center px-2 text-[color:var(--color-primary-glow)] hover:brightness-125 font-medium lg:min-h-0 lg:px-0"
            >
              trocar cidade
            </button>
          </div>
        )}
      </div>

      {loadError && (
        <p className="text-label text-[color:var(--color-danger)] mb-2">
          Falha ao carregar oficinas: {loadError}
        </p>
      )}

      {!catalog ? (
        <div className="flex items-center gap-2 text-label text-[color:var(--color-muted)] py-3">
          <Loader2 size={13} className="animate-spin" /> Carregando oficinas…
        </div>
      ) : !ranking || ranking.top.length === 0 ? (
        <div className="rounded-2xl bg-white/[0.03] border border-white/[0.06] p-4 text-center">
          <p className="text-label text-[color:var(--color-muted)]">
            Nenhuma oficina catalogada em {cidade?.nome ?? "sua cidade"}.
          </p>
          <button
            onClick={onOpenFullPicker}
            className="mt-2 inline-flex items-center gap-1 text-label text-[color:var(--color-primary-glow)] hover:brightness-125"
          >
            <Search size={12} /> Buscar em outra cidade
          </button>
        </div>
      ) : (
        <>
          <div className="flex flex-col gap-2">
            {ranking.top.map((o, i) => {
              const contacted = contactedWaIds.has(o.waId ?? o.nome);
              return (
                <div
                  key={o.nome + o.endereco}
                  className="rounded-2xl bg-white/[0.02] border border-white/[0.06] p-3 flex items-center gap-3"
                >
                  <span className="w-7 h-7 rounded-full bg-[color:var(--color-primary)]/20 border border-[color:var(--color-primary)]/40 text-label font-bold text-white flex items-center justify-center shrink-0">
                    {i + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-body font-medium truncate">{o.nome}</p>
                    <p className="text-meta text-[color:var(--color-muted)] truncate mt-0.5">
                      {o.endereco || "Endereço não disponível"}
                    </p>
                  </div>
                  <div className="hidden sm:flex items-center gap-1 text-meta shrink-0">
                    {o.rating !== null ? (
                      <>
                        <Star size={11} className="text-[#F5A524] fill-[#F5A524]" />
                        <span className="text-white/85">
                          {o.rating.toFixed(1)}
                        </span>
                        <span className="text-[color:var(--color-muted)]">
                          ({o.reviews})
                        </span>
                      </>
                    ) : (
                      <span className="text-[color:var(--color-muted)]">
                        sem nota
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => handleSend(o)}
                    disabled={!o.waId}
                    className="inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-[#25D366] hover:brightness-105 disabled:opacity-40 disabled:cursor-not-allowed disabled:bg-white/[0.06] disabled:text-[color:var(--color-muted)] px-3 py-1.5 text-label font-semibold text-white transition shrink-0 lg:min-h-0"
                    title={o.waId ? "Enviar orçamento via WhatsApp" : "Sem WhatsApp cadastrado"}
                  >
                    {contacted ? <Check size={12} /> : <MessageCircle size={12} />}
                    {o.waId ? (contacted ? "Enviar de novo" : "WhatsApp") : "Sem WhatsApp"}
                  </button>
                </div>
              );
            })}
          </div>

          {(ranking.outras.length > 0 || (cidade && cidade.total > ranking.top.length)) && (
            <button
              onClick={onOpenFullPicker}
              className="mt-3 w-full min-h-11 text-label text-[color:var(--color-muted)] hover:text-white transition inline-flex items-center justify-center gap-1 lg:min-h-0"
            >
              Ver mais {ranking.outras.length} oficinas em {cidade?.nome}
              <ChevronRight size={12} />
            </button>
          )}
        </>
      )}
    </div>
  );
}
