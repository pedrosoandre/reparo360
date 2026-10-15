"use client";

import { useEffect, useMemo, useState } from "react";
import {
  X,
  Search,
  ChevronLeft,
  Star,
  MessageCircle,
  Download,
  MapPin,
  Phone,
  Loader2,
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
  whatsappLink,
  whatsappMessage,
  publicBudgetUrl,
} from "@/lib/budget-share";
import { downloadBudgetPDF } from "@/lib/budget-pdf";
import { toast } from "@/stores/toast-store";
import { cn } from "@/lib/utils";

interface Props {
  budget: Budget;
  onClose: () => void;
  /**
   * Cidade a pré-selecionar. Se bater com uma cidade do catálogo, o modal
   * abre já na lista de oficinas dessa cidade — pula o step de busca.
   * Se não bater (ou for undefined), começa no step de busca normal.
   */
  initialCity?: string;
  /**
   * Chamado assim que o usuário dispara o envio real por WhatsApp. Usado
   * pelo parent pra registrar em `Budget.contactedOficinas` (via store).
   */
  onOficinaContacted?: (oficina: Oficina) => void;
}

type Step = "city" | "oficina" | "send";

export function SendWorkshopModal({
  budget,
  onClose,
  initialCity,
  onOficinaContacted,
}: Props) {
  const [step, setStep] = useState<Step>("city");
  const [catalog, setCatalog] = useState<OficinasCatalog | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [cityQuery, setCityQuery] = useState("");
  const [selectedCity, setSelectedCity] = useState<CidadeOficinas | null>(null);
  const [selectedOficina, setSelectedOficina] = useState<Oficina | null>(null);
  const [pdfBusy, setPdfBusy] = useState(false);

  useEffect(() => {
    loadOficinasCatalog()
      .then(setCatalog)
      .catch((e) => setLoadError(String(e.message ?? e)));
  }, []);

  // Assim que catálogo chega, tenta casar `initialCity`. Só roda quando o
  // usuário ainda está no step "city" — se ele já navegou, não interrompe.
  useEffect(() => {
    if (!catalog || !initialCity || step !== "city") return;
    const match = findCidade(catalog, initialCity);
    if (match) {
      setSelectedCity(match);
      setStep("oficina");
    }
  }, [catalog, initialCity, step]);

  const cidadesFiltradas = useMemo(() => {
    if (!catalog) return [];
    const q = cityQuery.trim().toLowerCase();
    if (!q) return catalog.cidades;
    return catalog.cidades.filter((c) => c.nome.toLowerCase().includes(q));
  }, [catalog, cityQuery]);

  const ranking = useMemo(
    () => (selectedCity ? rankOficinas(selectedCity.oficinas, 10) : { top: [], outras: [] }),
    [selectedCity],
  );

  function pickCity(c: CidadeOficinas) {
    setSelectedCity(c);
    setSelectedOficina(null);
    setStep("oficina");
  }

  function pickOficina(o: Oficina) {
    setSelectedOficina(o);
    setStep("send");
  }

  async function handleDownloadPDF() {
    setPdfBusy(true);
    try {
      await downloadBudgetPDF(budget, {
        oficinaNome: selectedOficina?.nome,
        oficinaCidade: selectedOficina?.cidade,
      });
      toast("PDF gerado — baixando…", "success");
    } catch (e) {
      toast(`Erro ao gerar PDF: ${(e as Error).message}`, "error");
    } finally {
      setPdfBusy(false);
    }
  }

  function handleWhatsApp() {
    if (!selectedOficina || !selectedOficina.waId) {
      toast("Essa oficina não tem WhatsApp cadastrado.", "error");
      return;
    }
    const origin =
      typeof window !== "undefined" ? window.location.origin : "";
    const url = publicBudgetUrl(budget, origin);
    const msg = whatsappMessage(budget, selectedOficina.nome, url);
    const link = whatsappLink(selectedOficina.waId, msg);
    window.open(link, "_blank", "noopener,noreferrer");
    onOficinaContacted?.(selectedOficina);
    toast("Abrindo WhatsApp…", "success");
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="w-full max-w-lg premium-card border border-white/[0.08] p-5 relative max-h-[85vh] overflow-hidden flex flex-col">
        <button
          onClick={onClose}
          aria-label="Fechar"
          className="absolute top-3 right-3 w-7 h-7 rounded-full bg-white/[0.04] hover:bg-white/[0.1] text-[color:var(--color-muted)] hover:text-white flex items-center justify-center transition-colors z-10"
        >
          <X size={14} />
        </button>

        {/* Cabeçalho */}
        <div className="flex items-center gap-2 mb-1 pr-8">
          {step !== "city" && (
            <button
              onClick={() =>
                setStep(step === "send" ? "oficina" : "city")
              }
              className="text-[color:var(--color-muted)] hover:text-white transition-colors"
              aria-label="Voltar"
            >
              <ChevronLeft size={16} />
            </button>
          )}
          <h2 className="text-base font-semibold">
            {step === "city" && "Escolha a cidade"}
            {step === "oficina" && `Oficinas em ${selectedCity?.nome}`}
            {step === "send" && "Enviar orçamento"}
          </h2>
        </div>
        <p className="text-xs text-[color:var(--color-muted)] mb-4">
          {step === "city" && "Selecione a cidade da oficina que vai receber."}
          {step === "oficina" &&
            `${selectedCity?.total} oficinas · top ${ranking.top.length} por avaliação do Google.`}
          {step === "send" && "Confira os dados e envie."}
        </p>

        {loadError && (
          <p className="text-xs text-[color:var(--color-danger)]">
            Falha ao carregar catálogo: {loadError}
          </p>
        )}

        {/* Step: city */}
        {step === "city" && (
          <>
            <div className="flex items-center gap-2 rounded-xl bg-white/[0.04] px-2.5 py-1.5 mb-3">
              <Search size={13} className="text-[color:var(--color-muted)] shrink-0" />
              <input
                autoFocus
                value={cityQuery}
                onChange={(e) => setCityQuery(e.target.value)}
                placeholder={`Buscar entre ${catalog?.cidades.length ?? "…"} cidades`}
                className="w-full bg-transparent text-sm text-white placeholder:text-[color:var(--color-muted)] outline-none"
              />
            </div>
            {!catalog ? (
              <div className="flex items-center gap-2 text-xs text-[color:var(--color-muted)] py-4">
                <Loader2 size={13} className="animate-spin" /> Carregando catálogo…
              </div>
            ) : (
              <div className="flex-1 min-h-0 overflow-y-auto pr-1 [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-thumb]:bg-white/10 [&::-webkit-scrollbar-thumb]:rounded-full">
                {cidadesFiltradas.map((c) => (
                  <button
                    key={c.nome}
                    onClick={() => pickCity(c)}
                    className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm text-left text-[color:var(--color-muted)] hover:text-white hover:bg-white/[0.04] transition-colors"
                  >
                    <MapPin size={13} className="shrink-0" />
                    <span className="truncate flex-1 font-medium">{c.nome}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-white/[0.06] shrink-0">
                      {c.total} oficina{c.total === 1 ? "" : "s"}
                    </span>
                  </button>
                ))}
                {cidadesFiltradas.length === 0 && catalog && (
                  <p className="text-xs text-[color:var(--color-muted)] text-center py-6">
                    Nenhuma cidade encontrada.
                  </p>
                )}
              </div>
            )}
          </>
        )}

        {/* Step: oficina */}
        {step === "oficina" && selectedCity && (
          <div className="flex-1 min-h-0 overflow-y-auto pr-1 [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-thumb]:bg-white/10 [&::-webkit-scrollbar-thumb]:rounded-full">
            {ranking.top.length > 0 && (
              <>
                <p className="text-[10px] uppercase tracking-wider text-[color:var(--color-muted)] px-1 mb-1">
                  Top {ranking.top.length} do Google
                </p>
                {ranking.top.map((o, i) => (
                  <OficinaRow
                    key={o.nome + o.endereco}
                    rank={i + 1}
                    oficina={o}
                    onClick={() => pickOficina(o)}
                  />
                ))}
              </>
            )}
            {ranking.outras.length > 0 && (
              <>
                <p className="text-[10px] uppercase tracking-wider text-[color:var(--color-muted)] px-1 mt-3 mb-1">
                  Outras ({ranking.outras.length})
                </p>
                {ranking.outras.map((o) => (
                  <OficinaRow
                    key={o.nome + o.endereco}
                    oficina={o}
                    onClick={() => pickOficina(o)}
                  />
                ))}
              </>
            )}
            {selectedCity.oficinas.length === 0 && (
              <p className="text-xs text-[color:var(--color-muted)] text-center py-6">
                Nenhuma oficina catalogada nessa cidade.
              </p>
            )}
          </div>
        )}

        {/* Step: send */}
        {step === "send" && selectedOficina && (
          <div className="flex flex-col gap-3">
            <div className="rounded-2xl bg-white/[0.03] border border-white/[0.06] p-3">
              <p className="text-sm font-semibold">{selectedOficina.nome}</p>
              <p className="text-[11px] text-[color:var(--color-muted)] mt-0.5">
                {selectedOficina.endereco} · {selectedOficina.cidade}
              </p>
              <div className="flex items-center gap-3 mt-2 text-[11px] text-[color:var(--color-muted)]">
                {selectedOficina.rating !== null && (
                  <span className="inline-flex items-center gap-1 text-white/85">
                    <Star size={11} className="text-[#F5A524] fill-[#F5A524]" />
                    {selectedOficina.rating.toFixed(1)} ({selectedOficina.reviews})
                  </span>
                )}
                {selectedOficina.telefone && (
                  <span className="inline-flex items-center gap-1">
                    <Phone size={11} /> {selectedOficina.telefone}
                  </span>
                )}
              </div>
            </div>

            <button
              onClick={handleWhatsApp}
              disabled={!selectedOficina.waId}
              className="w-full h-11 rounded-2xl bg-[#25D366] hover:brightness-105 text-white font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed transition"
            >
              <MessageCircle size={15} />
              {selectedOficina.waId
                ? "Enviar por WhatsApp"
                : "Sem WhatsApp cadastrado"}
            </button>

            <button
              onClick={handleDownloadPDF}
              disabled={pdfBusy}
              className="w-full h-10 rounded-2xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] text-white text-xs font-medium flex items-center justify-center gap-2 transition disabled:opacity-60"
            >
              {pdfBusy ? (
                <Loader2 size={13} className="animate-spin" />
              ) : (
                <Download size={13} />
              )}
              Baixar PDF do orçamento
            </button>

            <p className="text-[10px] text-[color:var(--color-muted)] leading-relaxed mt-1">
              O WhatsApp abre com uma mensagem pronta e um link público do
              orçamento. A oficina responde direto por lá com o valor final.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function OficinaRow({
  rank,
  oficina,
  onClick,
}: {
  rank?: number;
  oficina: Oficina;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full text-left px-3 py-2.5 rounded-xl transition-colors hover:bg-white/[0.04] flex items-center gap-3",
      )}
    >
      {rank !== undefined && (
        <span className="w-6 h-6 rounded-full bg-[color:var(--color-primary)]/20 border border-[color:var(--color-primary)]/40 text-[10px] font-bold text-white flex items-center justify-center shrink-0">
          {rank}
        </span>
      )}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{oficina.nome}</p>
        <p className="text-[11px] text-[color:var(--color-muted)] truncate mt-0.5">
          {oficina.endereco || "Endereço não disponível"}
        </p>
      </div>
      {oficina.rating !== null ? (
        <span className="inline-flex items-center gap-1 text-[11px] text-white/85 shrink-0">
          <Star size={11} className="text-[#F5A524] fill-[#F5A524]" />
          {oficina.rating.toFixed(1)}
          <span className="text-[color:var(--color-muted)]">
            ({oficina.reviews})
          </span>
        </span>
      ) : (
        <span className="text-[10px] text-[color:var(--color-muted)] shrink-0">sem nota</span>
      )}
    </button>
  );
}
