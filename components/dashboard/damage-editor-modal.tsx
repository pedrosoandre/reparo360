"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { X, Upload, Trash2, Save, Check, Sparkles, Loader2, AlertTriangle } from "lucide-react";
import { PART_LABELS, DAMAGE_LABELS } from "@/lib/car-parts";
import { estimate, splitServiceParts } from "@/lib/pricing";
import { formatBRL } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { filesToPhotos, refToAnalysisDataUrl } from "@/lib/photos";
import { deleteBlob } from "@/lib/blob-store";
import { usePhotoUrls } from "@/lib/use-photo-urls";
import type { CarPart, DamageRecord, DamageType } from "@/types";
import { toast } from "@/stores/toast-store";
import { confirmDialog } from "@/stores/confirm-store";

const MAX_PHOTOS = 6;

const DAMAGE_ORDER: DamageType[] = [
  "scratch_light",
  "scratch_deep",
  "dent_light",
  "dent_medium",
  "break",
  "misalignment",
  "other",
];

const ALL_PARTS: CarPart[] = Object.keys(PART_LABELS) as CarPart[];

interface Detection {
  part: CarPart;
  damages: DamageType[];
  confidence: number;
  rationale: string;
}

interface AnalysisResult {
  detections: Detection[];
  unusable: string[];
  notes: string;
}

interface DamageEditorModalProps {
  /** Se editing tem valor, é edição; senão, criação. */
  editing?: DamageRecord | null;
  /** Peça pré-selecionada (ex.: veio de clique em hotspot). */
  initialPart?: CarPart | null;
  /** Peças já com dano cadastrado (pra desabilitar no seletor em modo criação). */
  disabledParts?: CarPart[];
  /** Contexto do veículo — entra no cálculo do custo e na análise por IA. */
  vehicle?: {
    brand?: string;
    model?: string;
    year?: number;
    category?: string;
    /** Valor FIPE, quando encontrado. Manda no fator de veículo. */
    marketValue?: number;
    /** Texto pronto explicando de onde veio (ou não veio) o valor FIPE. */
    fipeLabel?: string;
  };
  onSave: (data: {
    part: CarPart;
    damages: DamageType[];
    photos: string[];
    notes?: string;
    location?: string;
  }) => void;
  onDelete?: () => void;
  onClose: () => void;
}

export function DamageEditorModal({
  editing,
  initialPart,
  disabledParts = [],
  vehicle,
  onSave,
  onDelete,
  onClose,
}: DamageEditorModalProps) {
  const [part, setPart] = useState<CarPart | "">(editing?.part ?? initialPart ?? "");
  const [damages, setDamages] = useState<DamageType[]>(editing?.damages ?? []);
  const [photos, setPhotos] = useState<string[]>(editing?.photos ?? []);
  const [notes, setNotes] = useState(editing?.notes ?? "");
  const [location, setLocation] = useState(editing?.location ?? "");
  const inputRef = useRef<HTMLInputElement>(null);

  const photoUrls = usePhotoUrls(photos);
  const [photoError, setPhotoError] = useState<string | null>(null);

  const [analyzing, setAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);

  const preview = useMemo(() => {
    if (!part || damages.length === 0) return null;
    return estimate(part as CarPart, damages, {
      category: vehicle?.category,
      brand: vehicle?.brand,
      marketValue: vehicle?.marketValue,
    });
  }, [part, damages, vehicle?.category, vehicle?.brand, vehicle?.marketValue]);

  useEffect(() => {
    function onEsc(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onEsc);
    return () => window.removeEventListener("keydown", onEsc);
  }, [onClose]);

  function toggleDamage(d: DamageType) {
    setDamages((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]));
  }

  async function handleFiles(files: FileList | null) {
    const next = await filesToPhotos(files, MAX_PHOTOS - photos.length);
    if (next.refs.length) setPhotos((p) => [...p, ...next.refs]);
    setPhotoError(
      next.rejected.length
        ? next.rejected.map((r) => `"${r.name}": ${r.reason}`).join(" · ")
        : null,
    );
    if (inputRef.current) inputRef.current.value = "";
  }

  /**
   * Só apaga o binário se a foto foi adicionada nesta sessão de edição. Fotos
   * já salvas podem estar referenciadas por um orçamento gerado antes.
   */
  async function removePhotoAt(index: number) {
    const ref = photos[index];
    setPhotos((prev) => prev.filter((_, j) => j !== index));
    if (ref && !(editing?.photos ?? []).includes(ref)) {
      await deleteBlob(ref).catch(() => {});
    }
  }

  async function analyzePhotos() {
    setAnalyzing(true);
    setAnalysisError(null);
    setAnalysis(null);
    try {
      // A API precisa do base64; o estado guarda só referências do IndexedDB.
      const inline = (
        await Promise.all(photos.map((p) => refToAnalysisDataUrl(p).catch(() => null)))
      ).filter((x): x is string => x !== null);

      if (inline.length === 0) {
        setAnalysisError("Não foi possível ler as fotos gravadas no navegador.");
        return;
      }

      const res = await fetch("/api/analyze-damage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          photos: inline,
          partHint: part ? PART_LABELS[part as CarPart] : undefined,
          vehicle,
        }),
      });
      // 413/504 da Vercel vêm em HTML: sem esta checagem o res.json() lançava
      // e o usuário via "Falha de rede", que não era o problema.
      const isJson = res.headers.get("content-type")?.includes("application/json");
      const data = isJson ? await res.json() : null;
      if (!res.ok) {
        setAnalysisError(
          data?.message ??
            (res.status === 413
              ? "As fotos ficaram grandes demais pra análise. Tente com menos fotos."
              : `A análise não respondeu (erro ${res.status}). Tente de novo em instantes.`),
        );
        return;
      }
      setAnalysis(data as AnalysisResult);
    } catch {
      setAnalysisError("Falha de rede ao chamar a análise.");
    } finally {
      setAnalyzing(false);
    }
  }

  /** Traz a leitura da IA pro formulário. O usuário confirma antes de salvar. */
  function applyDetection(d: Detection) {
    if (!editing) setPart(d.part);
    setDamages((prev) => Array.from(new Set([...prev, ...d.damages])));
  }

  function handleSave() {
    if (!part) {
      toast("Escolha a peça.", "error");
      return;
    }
    if (damages.length === 0) {
      toast("Marque ao menos um tipo de dano.", "error");
      return;
    }
    onSave({
      part: part as CarPart,
      damages,
      photos,
      notes: notes.trim() || undefined,
      location: location.trim() || undefined,
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="w-full max-w-lg premium-card border border-white/[0.08] p-5 relative max-h-[92vh] overflow-y-auto">
        <button
          onClick={onClose}
          aria-label="Fechar"
          className="absolute top-3 right-3 w-8 h-8 rounded-full bg-white/[0.04] hover:bg-white/[0.1] text-[color:var(--color-muted)] hover:text-white flex items-center justify-center transition-colors"
        >
          <X size={15} />
        </button>

        <h2 className="text-base font-semibold mb-1">
          {editing ? "Editar dano" : "Adicionar dano"}
        </h2>
        <p className="text-xs text-[color:var(--color-muted)] mb-4">
          Marque a peça e os tipos de dano — o custo estimado atualiza embaixo.
        </p>

        {/* Peça */}
        <div className="mb-4">
          <label className="text-[10px] uppercase tracking-wider text-[color:var(--color-muted)]">
            Peça
          </label>
          <select
            value={part}
            onChange={(e) => setPart(e.target.value as CarPart)}
            disabled={!!editing}
            className="mt-1 w-full h-10 rounded-xl bg-white/[0.04] border border-white/[0.06] px-3 text-body text-white outline-none focus:border-[color:var(--color-primary)]/50 transition-colors disabled:opacity-60"
          >
            <option value="" className="bg-[#111318]">
              Selecione…
            </option>
            {ALL_PARTS.map((p) => (
              <option
                key={p}
                value={p}
                disabled={!editing && disabledParts.includes(p) && p !== initialPart}
                className="bg-[#111318]"
              >
                {PART_LABELS[p]}
                {disabledParts.includes(p) && p !== initialPart ? " (já cadastrada)" : ""}
              </option>
            ))}
          </select>
        </div>

        {/* Tipos de dano */}
        <div className="mb-4">
          <label className="text-[10px] uppercase tracking-wider text-[color:var(--color-muted)]">
            Tipos de dano
          </label>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {DAMAGE_ORDER.map((d) => {
              const active = damages.includes(d);
              return (
                <button
                  key={d}
                  onClick={() => toggleDamage(d)}
                  className={cn(
                    "flex items-center gap-2 rounded-xl border px-3 py-2 text-xs text-left transition-all",
                    active
                      ? "bg-[color:var(--color-primary)]/15 border-[color:var(--color-primary)]/40 text-white"
                      : "bg-white/[0.02] border-white/[0.06] text-[color:var(--color-muted)] hover:text-white hover:border-white/[0.14]",
                  )}
                >
                  <span
                    className={cn(
                      "w-4 h-4 rounded-md border flex items-center justify-center shrink-0",
                      active
                        ? "bg-[color:var(--color-primary)] border-[color:var(--color-primary)]"
                        : "border-white/20",
                    )}
                  >
                    {active && <Check size={10} className="text-white" />}
                  </span>
                  <span className="truncate">{DAMAGE_LABELS[d]}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Fotos */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <label className="text-[10px] uppercase tracking-wider text-[color:var(--color-muted)]">
              Fotos ({photos.length}/{MAX_PHOTOS})
            </label>
            {photos.length < MAX_PHOTOS && (
              <label className="inline-flex items-center gap-1.5 text-[11px] text-[color:var(--color-primary-glow)] cursor-pointer hover:brightness-125">
                <Upload size={12} />
                Adicionar
                <input
                  ref={inputRef}
                  type="file"
                  multiple
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => handleFiles(e.target.files)}
                />
              </label>
            )}
          </div>
          {photos.length > 0 ? (
            <div className="grid grid-cols-4 gap-2">
              {photos.map((p, i) => (
                <div key={p} className="relative aspect-square rounded-lg overflow-hidden border border-white/[0.06] bg-white/[0.03]">
                  {photoUrls[i] && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={photoUrls[i]!} alt="" className="w-full h-full object-cover" />
                  )}
                  <button
                    onClick={() => removePhotoAt(i)}
                    className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/70 border border-white/20 text-white/90 hover:bg-black/90 flex items-center justify-center"
                    aria-label="Remover foto"
                  >
                    <X size={10} />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-[11px] text-[color:var(--color-muted)]">
              Anexe fotos do dano (opcional). Fotos grandes são reduzidas automaticamente.
            </p>
          )}

          {photoError && (
            <p className="mt-2 flex items-start gap-1.5 text-[11px] text-[color:var(--color-danger)]">
              <AlertTriangle size={12} className="mt-0.5 shrink-0" />
              {photoError}
            </p>
          )}

          {photos.length > 0 && (
            <button
              onClick={analyzePhotos}
              disabled={analyzing}
              className="mt-2 w-full inline-flex items-center justify-center gap-1.5 rounded-xl bg-[color:var(--color-primary)]/10 hover:bg-[color:var(--color-primary)]/20 border border-[color:var(--color-primary)]/30 px-3 py-2 text-xs font-medium text-[color:var(--color-primary-glow)] transition disabled:opacity-60 disabled:cursor-wait"
            >
              {analyzing ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
              {analyzing ? "Analisando fotos…" : "Analisar fotos com IA"}
            </button>
          )}

          {analysisError && (
            <p className="mt-2 flex items-start gap-1.5 text-[11px] text-[color:var(--color-danger)]">
              <AlertTriangle size={12} className="mt-0.5 shrink-0" />
              {analysisError}
            </p>
          )}

          {analysis && (
            <div className="mt-2 rounded-xl bg-white/[0.02] border border-white/[0.06] p-3">
              <p className="text-[10px] uppercase tracking-wider text-[color:var(--color-muted)] mb-2">
                Leitura da IA — confira antes de aplicar
              </p>

              {analysis.detections.length === 0 ? (
                <p className="text-[11px] text-[color:var(--color-muted)]">
                  Nenhum dano identificável nas fotos.
                </p>
              ) : (
                <div className="flex flex-col gap-2">
                  {analysis.detections.map((d, i) => (
                    <div key={i} className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-xs font-medium">
                          {PART_LABELS[d.part]}{" "}
                          <span
                            className={cn(
                              "font-normal",
                              d.confidence < 50
                                ? "text-[color:var(--color-danger)]"
                                : "text-[color:var(--color-muted)]",
                            )}
                          >
                            · {Math.round(d.confidence)}% de confiança
                          </span>
                        </p>
                        <p className="text-[11px] text-[color:var(--color-muted)]">
                          {d.damages.map((t) => DAMAGE_LABELS[t]).join(", ") || "sem tipo"}
                        </p>
                        <p className="text-[11px] text-[color:var(--color-muted)] italic">
                          {d.rationale}
                        </p>
                      </div>
                      <button
                        onClick={() => applyDetection(d)}
                        disabled={!!editing && d.part !== part}
                        className="shrink-0 rounded-lg border border-white/[0.12] px-2 py-1 text-[11px] hover:bg-white/[0.06] transition disabled:opacity-40"
                        title={
                          !!editing && d.part !== part
                            ? "A peça está travada na edição"
                            : undefined
                        }
                      >
                        Aplicar
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {analysis.unusable.length > 0 && (
                <p className="mt-2 text-[11px] text-[color:var(--color-muted)]">
                  Fotos que não deram pra avaliar: {analysis.unusable.join("; ")}
                </p>
              )}
              {analysis.notes && (
                <p className="mt-2 text-[11px] text-[color:var(--color-muted)]">
                  {analysis.notes}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Local */}
        <div className="mb-4">
          <label className="text-[10px] uppercase tracking-wider text-[color:var(--color-muted)]">
            Local do acidente (opcional)
          </label>
          <input
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="Ex.: Av. Paulista, altura do 1500"
            className="mt-1 w-full h-10 rounded-xl bg-white/[0.04] border border-white/[0.06] px-3 text-body text-white outline-none focus:border-[color:var(--color-primary)]/50 transition-colors"
          />
        </div>

        {/* Notas */}
        <div className="mb-4">
          <label className="text-[10px] uppercase tracking-wider text-[color:var(--color-muted)]">
            Observações (opcional)
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            placeholder="Detalhes que ajudam a oficina a entender o dano"
            className="mt-1 w-full rounded-xl bg-white/[0.04] border border-white/[0.06] px-3 py-2 text-body text-white outline-none focus:border-[color:var(--color-primary)]/50 transition-colors resize-none"
          />
        </div>

        {/* Preview de custo */}
        {preview && (
          <div className="mb-4 rounded-2xl bg-[color:var(--color-primary)]/10 border border-[color:var(--color-primary)]/20 p-3">
            <div className="flex items-center justify-between">
              <p className="text-xs text-[color:var(--color-muted)]">Custo estimado</p>
              <p className="text-lg font-semibold">{formatBRL(preview.total)}</p>
            </div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-1 text-[10px] text-[color:var(--color-muted)]">
              <span>Pintura/Mão de obra {formatBRL(splitServiceParts(preview).service)}</span>
              <span>· Peças {formatBRL(splitServiceParts(preview).parts)}</span>
            </div>
            {preview.hasFallback && (
              <p className="mt-2 flex items-start gap-1.5 text-[10px] text-[color:var(--color-warning,#f59e0b)]">
                <AlertTriangle size={11} className="mt-px shrink-0" />
                Valor genérico: {preview.fallbackDamages.map((d) => DAMAGE_LABELS[d]).join(", ")}{" "}
                não está tabelado para esta peça. Confirme com a oficina.
              </p>
            )}
            <p className="mt-1 text-[10px] text-[color:var(--color-muted)]">
              {preview.vehicleFactorBasis === "fipe"
                ? `Ajuste de ${preview.vehicleFactor}× pelo valor de mercado. ${vehicle?.fipeLabel ?? ""}`
                : preview.vehicleFactorBasis === "heuristic"
                  ? `Ajuste de ${preview.vehicleFactor}× por categoria/marca. ${vehicle?.fipeLabel ?? "Sem valor FIPE."}`
                  : "Sem dados do veículo — preço de referência genérico."}
            </p>
          </div>
        )}

        <div className="flex items-center justify-between gap-2">
          {editing && onDelete ? (
            <button
              onClick={async () => {
                const ok = await confirmDialog({
                  message: "Remover este dano?",
                  confirmLabel: "Remover",
                  danger: true,
                });
                if (ok) onDelete();
              }}
              className="inline-flex items-center gap-1.5 rounded-xl bg-[color:var(--color-danger)]/10 hover:bg-[color:var(--color-danger)]/20 border border-[color:var(--color-danger)]/30 px-3 py-2 text-xs font-medium text-[color:var(--color-danger)] transition"
            >
              <Trash2 size={13} />
              Remover
            </button>
          ) : (
            <span />
          )}
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="rounded-xl bg-white/[0.04] hover:bg-white/[0.08] px-4 py-2 text-xs font-medium text-white transition"
            >
              Cancelar
            </button>
            <button
              onClick={handleSave}
              className="inline-flex items-center gap-1.5 rounded-xl bg-[color:var(--color-primary)] hover:brightness-110 px-4 py-2 text-xs font-semibold text-white transition"
            >
              <Save size={13} />
              Salvar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
