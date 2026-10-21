"use client";

import { Car3DLazy } from "@/components/car/car-3d-lazy";
import { cn } from "@/lib/utils";
import { formatBRL, splitBRLCents } from "@/lib/utils";
import { PART_LABELS } from "@/lib/car-parts";
import {
  MapPin,
  Camera,
  SlidersHorizontal,
  BarChart2,
  RefreshCw,
  CircleCheck,
  X,
  RotateCcw,
  Plus,
  MessageSquare,
  ImagePlus,
} from "lucide-react";
import { forwardRef, useEffect, useMemo, useRef, useState } from "react";
import type { CarPart, DamageRecord } from "@/types";
import { useDamagesStore, withCost, summarize } from "@/stores/damages-store";
import { useVehiclesStore } from "@/stores/vehicles-store";
import { useFipe } from "@/lib/use-fipe";
import { VehicleEconomicsPanel } from "./vehicle-economics-panel";
import { DamageEditorModal } from "./damage-editor-modal";
import { Lightbox } from "@/components/ui/lightbox";
import { filesToPhotos } from "@/lib/photos";
import { usePhotoUrl } from "@/lib/use-photo-urls";
import { toast } from "@/stores/toast-store";
import { confirmDialog } from "@/stores/confirm-store";

const MAX_PHOTOS_PER_DAMAGE = 6;

interface PartRow {
  key: string;
  label: string;
  parts: CarPart[];
}

const PART_LIST: PartRow[] = [
  { key: "front", label: "Frente", parts: ["front_bumper", "grille", "headlight_left", "headlight_right"] },
  { key: "roof", label: "Teto", parts: ["roof"] },
  { key: "left_side", label: "Lateral esquerda", parts: ["door_front_left", "door_rear_left", "fender_left"] },
  { key: "hood", label: "Capô", parts: ["hood"] },
  { key: "trunk", label: "Porta-malas", parts: ["trunk"] },
  { key: "doors", label: "Portas", parts: ["door_front_left", "door_front_right", "door_rear_left", "door_rear_right"] },
  { key: "windows", label: "Janelas", parts: [] },
  { key: "back", label: "Traseira", parts: ["rear_bumper", "taillight_left", "taillight_right"] },
  { key: "headlights", label: "Faróis", parts: ["headlight_left", "headlight_right"] },
  { key: "right_side", label: "Lateral direita", parts: ["door_front_right", "door_rear_right", "fender_right"] },
  { key: "bumpers", label: "Para-choques", parts: ["front_bumper", "rear_bumper"] },
  { key: "mirrors", label: "Retrovisores", parts: ["mirror_left", "mirror_right"] },
  { key: "wheels", label: "Rodas", parts: ["wheel_fl", "wheel_fr", "wheel_rl", "wheel_rr"] },
];

const ROW_ICONS = [
  { Icon: BarChart2, key: "history", label: "Histórico" },
  { Icon: RefreshCw, key: "recalc", label: "Recalcular" },
  { Icon: CircleCheck, key: "resolve", label: "Resolvido" },
];

interface Props {
  vehicleId: string;
  glbUrl?: string;
  bodyColor: string | null;
  onBodyColorChange: (hex: string | null) => void;
  onLocationClick?: () => void;
}

export function PartsOverview({
  vehicleId,
  glbUrl,
  bodyColor,
  onBodyColorChange,
  onLocationClick,
}: Props) {
  const [selectedGroup, setSelectedGroup] = useState("parts_overview");
  const [activePart, setActivePart] = useState<CarPart | null>(null);
  const [focusNonce, setFocusNonce] = useState(0);
  const [editorState, setEditorState] = useState<
    | { mode: "create"; initialPart?: CarPart | null }
    | { mode: "edit"; record: DamageRecord }
    | null
  >(null);

  const vehicle = useVehiclesStore((s) => s.vehicles.find((v) => v.id === vehicleId));
  const fipe = useFipe(vehicle);
  const pricingContext = useMemo(
    () => ({
      category: vehicle?.category,
      brand: vehicle?.brand,
      marketValue: fipe.status === "found" ? fipe.marketValue : undefined,
    }),
    [vehicle?.category, vehicle?.brand, fipe.status, fipe.marketValue],
  );

  const allDamages = useDamagesStore((s) => s.damages);
  const damages = useMemo(
    () => allDamages.filter((d) => d.vehicleId === vehicleId),
    [allDamages, vehicleId],
  );
  const addDamage = useDamagesStore((s) => s.addDamage);
  const updateDamage = useDamagesStore((s) => s.updateDamage);
  const removeDamage = useDamagesStore((s) => s.removeDamage);
  const toggleResolved = useDamagesStore((s) => s.toggleResolved);
  const addPhotosToDamage = useDamagesStore((s) => s.addPhotos);
  const setDamageNotes = useDamagesStore((s) => s.setNotes);
  const [lightbox, setLightbox] = useState<{ photos: string[]; index: number } | null>(null);
  const rowRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  const summary = useMemo(
    () => summarize(damages, pricingContext),
    [damages, pricingContext],
  );
  const damageByPart = useMemo(() => {
    const m = new Map<CarPart, DamageRecord>();
    for (const d of damages) m.set(d.part, d);
    return m;
  }, [damages]);

  const damagedParts = useMemo(
    () => damages.filter((d) => !d.resolved).map((d) => d.part),
    [damages],
  );

  function groupKeyForPart(part: CarPart): string {
    const row = PART_LIST.find((r) => r.parts.includes(part));
    return row?.key ?? "parts_overview";
  }

  const activeRow = PART_LIST.find((p) => p.key === selectedGroup);
  const highlighted: CarPart[] =
    selectedGroup === "parts_overview" ? damagedParts : activeRow?.parts ?? [];

  function selectPart(part: CarPart) {
    const existing = damageByPart.get(part);
    if (!existing) {
      // Peça sem dano ainda — abre modal em modo criação
      setEditorState({ mode: "create", initialPart: part });
      return;
    }
    setActivePart(part);
    setSelectedGroup(groupKeyForPart(part));
    setFocusNonce((n) => n + 1);
  }

  // Ao ativar uma peça, rola a lista de detalhes até a linha correspondente
  useEffect(() => {
    if (!activePart) return;
    const record = damageByPart.get(activePart);
    if (!record) return;
    const el = rowRefs.current.get(record.id);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [activePart, damageByPart]);

  function handleReset() {
    // Só limpa a seleção atual (peça ativa, categoria, cor) — não apaga danos
    setActivePart(null);
    setSelectedGroup("parts_overview");
    onBodyColorChange(null);
  }

  const [totalMain, totalCents] = splitBRLCents(formatBRL(summary.total));

  function handleSave(data: {
    part: CarPart;
    damages: DamageRecord["damages"];
    photos: string[];
    notes?: string;
    location?: string;
  }) {
    if (!editorState) return;
    if (editorState.mode === "edit") {
      updateDamage(editorState.record.id, data);
    } else {
      addDamage(vehicleId, data);
    }
    setEditorState(null);
    setActivePart(data.part);
    setSelectedGroup(groupKeyForPart(data.part));
    setFocusNonce((n) => n + 1);
  }

  function handleEditorDelete() {
    if (editorState?.mode !== "edit") return;
    removeDamage(editorState.record.id);
    setEditorState(null);
    setActivePart(null);
  }

  return (
    <div className="premium-card p-3 sm:p-4 min-w-0 lg:h-full lg:flex lg:flex-col lg:min-h-0">
      {/* Toolbar do topo só no desktop. No mobile o "Iniciar orçamento" vive
         abaixo do 3D — ver bloco `lg:hidden` mais adiante. */}
      <div className="hidden lg:flex items-center justify-between mb-2 gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setEditorState({ mode: "create" })}
            className="inline-flex items-center gap-2 rounded-full bg-[color:var(--color-primary)]/15 border border-[color:var(--color-primary)]/40 hover:bg-[color:var(--color-primary)]/25 px-4 py-2 text-sm font-semibold text-white transition"
          >
            <Plus size={16} /> Iniciar orçamento
          </button>
          <button
            onClick={handleReset}
            title="Limpa seleção (peça ativa, categoria, cor) — mantém os danos"
            className="inline-flex items-center gap-1 rounded-full bg-white/[0.04] hover:bg-white/[0.10] border border-white/[0.08] px-2.5 py-1 text-[11px] font-medium text-[color:var(--color-muted)] hover:text-white transition"
          >
            <RotateCcw size={11} /> Reiniciar orçamento
          </button>
        </div>
        <h2 className="text-sm font-semibold text-[color:var(--color-muted)]">Informações do dano</h2>
      </div>

      {/* Visualizador + lista de peças abaixo */}
      <div className="min-w-0 lg:flex lg:flex-col lg:flex-1 lg:min-h-0">
        {/* Visualizador do carro */}
        <div className="relative rounded-2xl overflow-hidden border border-white/[0.06] mb-2 shrink-0 bg-[#05060A]">
          <Car3DLazy
            modelUrl={glbUrl}
            bodyColor={bodyColor}
            onBodyColorChange={onBodyColorChange}
            selectedParts={highlighted}
            damagedParts={damagedParts}
            activePart={activePart}
            focusSignal={activePart ? { part: activePart, nonce: focusNonce } : null}
            onSelectPart={selectPart}
            interactive
            autoRotate
            showHotspots
            hotspotsStartHidden
          />

          {/* Só um "toast" mínimo mostrando a peça selecionada — detalhes cheios ficam na lista abaixo */}
          {activePart && (
            <div className="absolute top-3 left-3 z-20 rounded-full bg-black/70 backdrop-blur border border-white/[0.1] pl-3 pr-1 py-1 flex items-center gap-2">
              <span className="text-[10px] font-medium text-white truncate max-w-[180px]">
                {PART_LABELS[activePart]}
              </span>
              <button
                onClick={() => setActivePart(null)}
                aria-label="Limpar seleção"
                className="w-5 h-5 rounded-full hover:bg-white/[0.1] text-[color:var(--color-muted)] hover:text-white flex items-center justify-center transition-colors"
              >
                <X size={11} />
              </button>
            </div>
          )}

        </div>

        {/* CTA "Iniciar orçamento" só no mobile — logo abaixo do 3D pra fluxo
           natural: escolhe carro → vê modelo → toca no botão. */}
        <div className="lg:hidden mb-3 shrink-0 flex items-center gap-2">
          <button
            onClick={() => setEditorState({ mode: "create" })}
            className="flex-1 inline-flex items-center justify-center gap-2 rounded-full bg-[color:var(--color-primary)]/15 border border-[color:var(--color-primary)]/40 hover:bg-[color:var(--color-primary)]/25 px-4 py-2.5 text-sm font-semibold text-white transition"
          >
            <Plus size={16} /> Iniciar orçamento
          </button>
          <button
            onClick={handleReset}
            title="Reiniciar orçamento — mantém os danos"
            aria-label="Reiniciar orçamento"
            className="inline-flex items-center justify-center rounded-full bg-white/[0.04] hover:bg-white/[0.10] border border-white/[0.08] w-10 h-10 text-[color:var(--color-muted)] hover:text-white transition shrink-0"
          >
            <RotateCcw size={14} />
          </button>
        </div>

        {/* Métricas + Detalhes dos danos */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-3 mb-3 shrink-0">
          <button
            onClick={onLocationClick}
            className="relative rounded-2xl border border-white/[0.06] overflow-hidden group text-left min-h-[68px]"
          >
            <MapTexture />
            <div className="absolute inset-0 bg-gradient-to-t from-[#0A0B0F]/80 via-transparent to-transparent" />
            <div className="absolute inset-0 flex items-end p-3">
              <span className="flex items-center gap-2 text-xs text-white/90 group-hover:text-white transition-colors">
                Adicionar local do acidente <MapPin size={14} />
              </span>
            </div>
          </button>

          <MetricCard title="Em análise" value={summary.activeCount > 0 ? "Aberto" : "—"} />
          <MetricCard
            title="Danificadas"
            value={`${summary.activeCount} peça${summary.activeCount === 1 ? "" : "s"}`}
          />

          <div className="rounded-2xl p-3 bg-[color:var(--color-primary)] shadow-[0_10px_30px_-10px_rgba(79,107,255,0.6)]">
            <p className="text-xl font-semibold tracking-tight text-white">
              {totalMain}
              <span className="text-white/50">,{totalCents}</span>
            </p>
            <p className="text-[11px] mt-0.5 text-white/80">Valor estimado</p>
          </div>
        </div>

        {vehicle && summary.total > 0 && (
          <div className="mb-4">
            <VehicleEconomicsPanel
              vehicleId={vehicle.id}
              fipe={fipe}
              repairTotal={summary.total}
              deductible={vehicle.deductible}
            />
          </div>
        )}

        <h3 className="text-sm font-semibold mb-2 shrink-0">Detalhes dos danos</h3>
        {summary.items.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/[0.08] p-6 text-center">
            <p className="text-xs text-[color:var(--color-muted)]">
              Clique num ponto do carro pra adicionar o primeiro dano.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-2 lg:flex-1 lg:min-h-0 lg:overflow-y-auto pr-1 [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-thumb]:bg-white/10 [&::-webkit-scrollbar-thumb]:rounded-full">
            {summary.items.map((d) => (
              <DamageRow
                key={d.id}
                ref={(el) => {
                  if (el) rowRefs.current.set(d.id, el);
                  else rowRefs.current.delete(d.id);
                }}
                detail={d}
                active={activePart === d.part}
                onSelect={() => selectPart(d.part)}
                onEdit={() => {
                  const record = damageByPart.get(d.part);
                  if (record) setEditorState({ mode: "edit", record });
                }}
                onRemove={async () => {
                  const ok = await confirmDialog({
                    message: "Remover este dano?",
                    confirmLabel: "Remover",
                    danger: true,
                  });
                  if (ok) {
                    removeDamage(d.id);
                    if (activePart === d.part) setActivePart(null);
                  }
                }}
                onToggleResolved={() => toggleResolved(d.id)}
                onOpenPhotos={(index) =>
                  setLightbox({ photos: d.photos, index })
                }
                onAddPhotos={async (files) => {
                  const next = await filesToPhotos(
                    files,
                    MAX_PHOTOS_PER_DAMAGE - d.photos.length,
                  );
                  if (next.refs.length) addPhotosToDamage(d.id, next.refs);
                  if (next.rejected.length) {
                    toast(
                      next.rejected.map((r) => `"${r.name}": ${r.reason}`).join(" · "),
                      "error",
                    );
                  }
                }}
                onNotesChange={(text) => setDamageNotes(d.id, text)}
                slotsLeft={MAX_PHOTOS_PER_DAMAGE - d.photos.length}
              />
            ))}
          </div>
        )}
      </div>

      {lightbox && (
        <Lightbox
          photos={lightbox.photos}
          initialIndex={lightbox.index}
          onClose={() => setLightbox(null)}
        />
      )}

      {editorState && (
        <DamageEditorModal
          editing={editorState.mode === "edit" ? editorState.record : null}
          initialPart={editorState.mode === "create" ? editorState.initialPart : null}
          disabledParts={damages.map((d) => d.part)}
          vehicle={
            vehicle
              ? {
                  brand: vehicle.brand,
                  model: vehicle.model,
                  year: vehicle.year,
                  category: vehicle.category,
                  marketValue: fipe.status === "found" ? fipe.marketValue : undefined,
                  fipeLabel:
                    fipe.status === "found"
                      ? `FIPE ${formatBRL(fipe.marketValue!)} · ${fipe.matched?.model ?? ""} (${fipe.reference})`
                      : fipe.status === "absent"
                        ? "Sem valor FIPE para este modelo — usando estimativa por categoria."
                        : undefined,
                }
              : undefined
          }
          onSave={handleSave}
          onDelete={editorState.mode === "edit" ? handleEditorDelete : undefined}
          onClose={() => setEditorState(null)}
        />
      )}
    </div>
  );
}

function MetricCard({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-2xl p-3 bg-[#171A21] border border-white/[0.06]">
      <p className="text-xl font-semibold tracking-tight text-white">{value}</p>
      <p className="text-[11px] mt-0.5 text-[color:var(--color-muted)]">{title}</p>
    </div>
  );
}

const DamageRow = forwardRef<HTMLDivElement, {
  detail: ReturnType<typeof withCost>;
  active?: boolean;
  onSelect: () => void;
  onEdit: () => void;
  onRemove: () => void;
  onToggleResolved: () => void;
  onOpenPhotos: (index: number) => void;
  onAddPhotos: (files: FileList | null) => void;
  onNotesChange: (text: string) => void;
  slotsLeft: number;
}>(function DamageRow({
  detail,
  active,
  onSelect,
  onEdit,
  onRemove,
  onToggleResolved,
  onOpenPhotos,
  onAddPhotos,
  onNotesChange,
  slotsLeft,
}, ref) {
  const [editingNote, setEditingNote] = useState(false);
  const [noteDraft, setNoteDraft] = useState(detail.notes ?? "");
  const fileRef = useRef<HTMLInputElement>(null);
  const thumbUrl = usePhotoUrl(detail.photos[0]);

  return (
    <div
      ref={ref}
      onClick={onSelect}
      className={cn(
        "flex flex-col gap-2 rounded-2xl border p-3 cursor-pointer transition-colors",
        active
          ? "bg-[color:var(--color-primary)]/10 border-[color:var(--color-primary)]/40"
          : "bg-[#171A21] border-white/[0.06] hover:border-white/[0.12]",
        detail.resolved && "opacity-60",
      )}
    >
      <div className="flex gap-4">
        <div
          onClick={(e) => {
            e.stopPropagation();
            if (detail.photos.length > 0) onOpenPhotos(0);
            else fileRef.current?.click();
          }}
          className="relative w-20 h-16 shrink-0 rounded-xl overflow-hidden border border-white/[0.08] bg-white/[0.04] flex items-center justify-center hover:border-white/[0.20] transition-colors"
        >
          {thumbUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={thumbUrl}
              alt={detail.label}
              className="w-full h-full object-cover"
            />
          ) : detail.photos.length > 0 ? (
            <div className="w-full h-full animate-pulse bg-white/[0.06]" />
          ) : (
            <div className="flex flex-col items-center gap-0.5 text-[color:var(--color-muted)]">
              <ImagePlus size={16} />
              <span className="text-[8px] uppercase tracking-wider">+ foto</span>
            </div>
          )}
          {detail.photos.length > 0 && (
            <span className="absolute top-1 left-1 flex items-center gap-1 rounded-md bg-black/60 backdrop-blur px-1.5 py-0.5 text-[9px] text-white">
              <Camera size={9} /> {detail.photos.length}
            </span>
          )}
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => {
              onAddPhotos(e.target.files);
              if (fileRef.current) fileRef.current.value = "";
            }}
          />
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold truncate">{detail.label}</p>
          <p className="text-xs text-[color:var(--color-muted)] truncate mt-0.5">
            {detail.damagesLabel}
          </p>
          <p className="text-sm mt-1.5">
            <span className={cn("font-semibold", detail.resolved && "line-through")}>
              {formatBRL(detail.cost)}
            </span>{" "}
            <span className="text-[11px] text-[color:var(--color-muted)]">
              {detail.resolved ? "resolvido" : "custo aproximado"}
            </span>
          </p>
        </div>

        <div className="flex flex-col items-end justify-between shrink-0">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onEdit();
            }}
            className="flex items-center gap-1.5 text-xs text-white/90 hover:text-white transition-colors"
          >
            Personalizar <SlidersHorizontal size={12} />
          </button>
          <div className="flex items-center gap-2 text-[color:var(--color-muted)]">
            {slotsLeft > 0 && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  fileRef.current?.click();
                }}
                title="Adicionar foto"
                className="hover:text-white transition-colors"
              >
                <ImagePlus size={13} />
              </button>
            )}
            {ROW_ICONS.map(({ Icon, key, label }) => (
              <button
                key={key}
                onClick={(e) => {
                  e.stopPropagation();
                  if (key === "resolve") onToggleResolved();
                  else if (key === "recalc") onSelect();
                  else if (key === "history")
                    toast("Histórico de preço da peça — em breve.");
                }}
                title={label}
                className="hover:text-white transition-colors"
              >
                <Icon size={13} />
              </button>
            ))}
            <button
              onClick={(e) => {
                e.stopPropagation();
                onRemove();
              }}
              title="Remover dano"
              className="hover:text-[color:var(--color-danger)] transition-colors"
            >
              <X size={13} />
            </button>
          </div>
        </div>
      </div>

      {/* Comentário fixado */}
      {editingNote ? (
        <div
          onClick={(e) => e.stopPropagation()}
          className="mt-1 rounded-xl border border-white/[0.08] bg-black/20 p-2"
        >
          <textarea
            autoFocus
            value={noteDraft}
            onChange={(e) => setNoteDraft(e.target.value)}
            rows={2}
            placeholder="Descreva o dano pra oficina…"
            className="w-full bg-transparent text-xs text-white placeholder:text-[color:var(--color-muted)] outline-none resize-none"
          />
          <div className="flex items-center justify-end gap-1.5 mt-1">
            <button
              onClick={() => {
                setNoteDraft(detail.notes ?? "");
                setEditingNote(false);
              }}
              className="rounded-md px-2 py-1 text-[10px] text-[color:var(--color-muted)] hover:text-white"
            >
              Cancelar
            </button>
            <button
              onClick={() => {
                onNotesChange(noteDraft.trim());
                setEditingNote(false);
              }}
              className="rounded-md bg-[color:var(--color-primary)] hover:brightness-110 px-2 py-1 text-[10px] font-semibold text-white"
            >
              Salvar
            </button>
          </div>
        </div>
      ) : detail.notes ? (
        <div
          onClick={(e) => {
            e.stopPropagation();
            setNoteDraft(detail.notes ?? "");
            setEditingNote(true);
          }}
          className="mt-1 rounded-xl bg-black/20 border border-white/[0.05] px-2.5 py-2 flex items-start gap-2 hover:border-white/[0.12] transition-colors"
        >
          <MessageSquare size={11} className="text-[color:var(--color-muted)] mt-0.5 shrink-0" />
          <p className="text-[11px] text-white/80 italic flex-1">"{detail.notes}"</p>
        </div>
      ) : (
        <button
          onClick={(e) => {
            e.stopPropagation();
            setNoteDraft("");
            setEditingNote(true);
          }}
          className="mt-1 self-start inline-flex items-center gap-1 text-[10px] text-[color:var(--color-muted)] hover:text-white transition-colors"
        >
          <MessageSquare size={10} />
          + Adicionar comentário
        </button>
      )}
    </div>
  );
});

function MapTexture() {
  return (
    <svg viewBox="0 0 200 100" className="w-full h-full absolute inset-0" preserveAspectRatio="xMidYMid slice">
      <rect width="200" height="100" fill="#14161C" />
      <g stroke="#232733" strokeWidth="2" fill="none">
        <path d="M -10 30 Q 60 22 110 35 T 220 28" />
        <path d="M -10 65 Q 50 75 120 62 T 220 70" />
        <path d="M 40 -10 Q 48 40 36 110" />
        <path d="M 100 -10 Q 95 50 108 110" />
        <path d="M 160 -10 Q 168 45 156 110" />
      </g>
      <g stroke="#1B1F29" strokeWidth="1" fill="none">
        <path d="M -10 15 L 220 10" />
        <path d="M -10 48 L 220 50" />
        <path d="M -10 88 L 220 85" />
        <path d="M 70 -10 L 66 110" />
        <path d="M 130 -10 L 136 110" />
      </g>
      <circle cx="108" cy="50" r="3" fill="#4F6BFF" />
      <circle cx="108" cy="50" r="7" fill="#4F6BFF" opacity="0.25" />
    </svg>
  );
}
