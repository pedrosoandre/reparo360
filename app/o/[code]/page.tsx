"use client";

/**
 * View pública do orçamento — o que a oficina vê ao clicar no link do
 * WhatsApp. Payload vem codificado em base64url na query `?d=`, então
 * funciona sem login e sem backend.
 *
 * Ações (Aceitar/Recusar/Contra-proposta) por enquanto abrem WhatsApp
 * pré-preenchido pra oficina responder o cliente. Quando tiver backend,
 * viram POST reais.
 */
import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Check,
  X,
  MessageCircle,
  Car,
  Wrench,
  Droplet,
  Phone,
  ShieldCheck,
  Handshake,
} from "lucide-react";
import { readPublicBudget, type ShareableBudget } from "@/lib/budget-share";
import { formatBRL } from "@/lib/utils";

export default function OrcamentoPublicoPage() {
  const params = useParams<{ code: string }>();
  const search = useSearchParams();
  const [budget, setBudget] = useState<ShareableBudget | null>(null);
  const [verified, setVerified] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const d = search.get("d");
    const s = search.get("s");
    if (!d) {
      setError("Link inválido — falta o payload.");
      return;
    }
    const parsed = readPublicBudget(d, s);
    if (!parsed) {
      setError(
        "Não deu pra ler o orçamento. O link pode estar corrompido ou o valor foi editado.",
      );
      return;
    }
    setBudget(parsed.budget);
    setVerified(parsed.verified);
  }, [search]);

  if (error) {
    return (
      <PageWrap>
        <div className="premium-card p-6 text-center max-w-md mx-auto">
          <p className="text-body text-[color:var(--color-danger)]">{error}</p>
          <Link
            href="/"
            className="inline-flex items-center gap-1 text-label text-[color:var(--color-primary-glow)] mt-3 hover:brightness-125"
          >
            <ArrowLeft size={12} /> Voltar
          </Link>
        </div>
      </PageWrap>
    );
  }
  if (!budget) {
    return (
      <PageWrap>
        <div className="premium-card p-6 text-center max-w-md mx-auto">
          <div className="w-8 h-8 rounded-full border-2 border-white/20 border-t-white animate-spin mx-auto" />
        </div>
      </PageWrap>
    );
  }

  function respond(kind: "aceitar" | "contra" | "recusar") {
    if (!budget) return;
    const phone = (budget.customerPhone || "").replace(/\D/g, "");
    let msg = "";
    if (kind === "aceitar") {
      msg = `Olá ${budget.customerName}! Recebemos seu pedido ${budget.code}. Podemos assumir o serviço no valor estimado de ${formatBRL(budget.grandTotal)}. Quando prefere trazer o carro?`;
    } else if (kind === "contra") {
      msg = `Olá ${budget.customerName}! Recebemos seu pedido ${budget.code}. Analisando as fotos, nosso orçamento oficial ficou em R$ __ — posso te enviar em detalhes?`;
    } else {
      msg = `Olá ${budget.customerName}! Recebemos seu pedido ${budget.code}, mas infelizmente não conseguimos assumir esse serviço no momento. Obrigado pelo contato.`;
    }
    if (!phone) {
      // sem telefone, só copia
      navigator.clipboard?.writeText(msg);
      alert("Sem telefone do cliente. Mensagem copiada.");
      return;
    }
    const wa = phone.startsWith("55") ? phone : `55${phone}`;
    window.open(
      `https://wa.me/${wa}?text=${encodeURIComponent(msg)}`,
      "_blank",
      "noopener,noreferrer",
    );
  }

  return (
    <PageWrap>
      <div className="max-w-2xl mx-auto flex flex-col gap-4">
        {!verified && (
          <div className="premium-card p-3 text-label text-[color:var(--color-warn,#f59e0b)] border border-[color:var(--color-warn,#f59e0b)]/30">
            Link antigo sem assinatura de integridade. Confirme os valores com quem enviou antes de fechar orçamento.
          </div>
        )}
        {/* Header */}
        <div className="premium-card p-5 sm:p-6">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <ShieldCheck size={14} className="text-[color:var(--color-primary-glow)]" />
                <span className="text-meta uppercase tracking-[0.08em] text-[color:var(--color-muted)]">
                  Orçamento Reparo360
                </span>
              </div>
              <p className="font-mono tabular text-title font-semibold">{budget.code}</p>
              <p className="text-label text-[color:var(--color-muted)] mt-1">
                Solicitado por <span className="text-white font-medium">{budget.customerName}</span>
                {budget.customerPhone && ` · ${budget.customerPhone}`}
              </p>
            </div>
            <div className="text-right">
              <p className="text-meta uppercase tracking-[0.08em] text-[color:var(--color-muted)]">
                Estimativa
              </p>
              <p className="tabular text-metric font-semibold">{formatBRL(budget.grandTotal)}</p>
              <p className="text-meta text-[color:var(--color-muted)]">
                (gerada pelo sistema, sujeita ao seu orçamento oficial)
              </p>
            </div>
          </div>
        </div>

        {/* Veículo */}
        <div className="premium-card p-4 sm:p-5">
          <h2 className="text-title font-semibold mb-2 flex items-center gap-2">
            <Car size={14} /> Veículo
          </h2>
          <p className="text-body">
            {budget.vehicle} · {budget.vehicleYear}
          </p>
        </div>

        {/* Peças */}
        <div className="premium-card p-4 sm:p-5">
          <h2 className="text-title font-semibold mb-3">
            Peças com dano ({budget.items.length})
          </h2>
          <div className="flex flex-col gap-2">
            {budget.items.map((it, i) => (
              <div
                key={i}
                className="rounded-2xl bg-white/[0.02] border border-white/[0.06] p-3 flex items-center gap-3"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-body font-medium truncate">{it.label}</p>
                  <p className="text-meta text-[color:var(--color-muted)] truncate mt-0.5">
                    {it.damages.join(", ")}
                  </p>
                </div>
                <p className="tabular text-body font-semibold shrink-0">
                  {formatBRL(it.cost)}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Extras */}
        {budget.extras.length > 0 && (
          <div className="premium-card p-4 sm:p-5">
            <h2 className="text-title font-semibold mb-3">
              Serviços extras ({budget.extras.length})
            </h2>
            <div className="flex flex-col gap-2">
              {budget.extras.map((e, i) => (
                <div
                  key={i}
                  className="rounded-2xl bg-white/[0.02] border border-white/[0.06] p-3 flex items-center gap-3"
                >
                  <div className="w-8 h-8 rounded-lg bg-white/[0.05] border border-white/[0.06] flex items-center justify-center shrink-0 text-[color:var(--color-muted)]">
                    {/oleo|óleo/i.test(e.label) ? <Droplet size={14} /> : <Wrench size={14} />}
                  </div>
                  <p className="text-body flex-1">{e.label}</p>
                  <p className="tabular text-body font-semibold shrink-0">
                    {formatBRL(e.price)}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Totais */}
        <div className="premium-card p-4 sm:p-5">
          <div className="tabular flex justify-between text-body">
            <span className="text-[color:var(--color-muted)]">Reparo estimado</span>
            <span>{formatBRL(budget.totalRepair)}</span>
          </div>
          <div className="tabular flex justify-between text-body mt-1">
            <span className="text-[color:var(--color-muted)]">Serviços extras</span>
            <span>{formatBRL(budget.totalExtras)}</span>
          </div>
          <div className="mt-3 pt-3 border-t border-white/[0.08] flex justify-between items-center">
            <span className="font-semibold">Total geral</span>
            <span className="tabular text-metric font-semibold">
              {formatBRL(budget.grandTotal)}
            </span>
          </div>
        </div>

        {/* Ações da oficina */}
        <div className="premium-card p-4 sm:p-5">
          <h2 className="text-title font-semibold mb-3 flex items-center gap-2">
            <Handshake size={14} /> Sua resposta
          </h2>
          <p className="text-label text-[color:var(--color-muted)] mb-3">
            Cada botão abre o WhatsApp com uma mensagem pronta pro cliente
            {budget.customerPhone ? "" : " (adicione o número quando pedir)"}.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <button
              onClick={() => respond("aceitar")}
              className="h-11 rounded-2xl bg-[color:var(--color-success)]/15 hover:bg-[color:var(--color-success)]/25 border border-[color:var(--color-success)]/30 text-[color:var(--color-success)] font-semibold text-label flex items-center justify-center gap-2 transition"
            >
              <Check size={14} /> Aceitar valor
            </button>
            <button
              onClick={() => respond("contra")}
              className="h-11 rounded-2xl bg-[color:var(--color-primary)]/15 hover:bg-[color:var(--color-primary)]/25 border border-[color:var(--color-primary)]/40 text-white font-semibold text-label flex items-center justify-center gap-2 transition"
            >
              <MessageCircle size={14} /> Contra-proposta
            </button>
            <button
              onClick={() => respond("recusar")}
              className="h-11 rounded-2xl bg-white/[0.04] hover:bg-[color:var(--color-danger)]/15 border border-white/[0.06] hover:border-[color:var(--color-danger)]/30 hover:text-[color:var(--color-danger)] text-[color:var(--color-muted)] font-semibold text-label flex items-center justify-center gap-2 transition"
            >
              <X size={14} /> Recusar
            </button>
          </div>
          {budget.customerPhone && (
            <a
              href={`tel:${budget.customerPhone}`}
              className="mt-2 w-full h-10 rounded-2xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] text-white text-label font-medium flex items-center justify-center gap-2 transition"
            >
              <Phone size={12} /> Ligar pro cliente ({budget.customerPhone})
            </a>
          )}
        </div>
      </div>
    </PageWrap>
  );
}

function PageWrap({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gradient-to-b from-[#111318] to-[#0F1116] py-6 sm:py-10 px-3 sm:px-5">
      {children}
    </div>
  );
}
