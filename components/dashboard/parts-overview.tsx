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
  Trash2,
} from "lucide-react";
import { forwardRef, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
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
  const clearForVehicle = useDamagesStore((s) => s.clearForVehicle);
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

  // Recomeça o orçamento deste carro: apaga os danos (com confirmação), tira a
  // seleção e volta a cor original. Antes só limpava a seleção, e quem apagava
  // de verdade era um "Apagar tudo" separado na coluna da direita.
  async function handleReset() {
    if (damages.length > 0) {
      const ok = await confirmDialog({
        message: `Apagar ${damages.length === 1 ? "o dano" : `os ${damages.length} danos`} deste carro e começar o orçamento de novo?`,
        confirmLabel: "Apagar e recomeçar",
        danger: true,
      });
      if (!ok) return;
      clearForVehicle(vehicleId);
      toast("Orçamento reiniciado.", "success");
    }
    setActivePart(null);
    setSelectedGroup("parts_overview");
    onBodyColorChange(null);
  }
  // Sem dano ainda o botão começa o orçamento; depois disso, cada clique é mais um dano.
  const addLabel = damages.length === 0 ? "Iniciar orçamento" : "Adicionar dano";

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
      {/* Cabeçalho da página. A tela não tinha título nenhum — o mockup abre
          com o caminho em mono, o nome em condensada itálica e uma régua
          grossa por baixo, que é o que separa cabeçalho de conteúdo nesta
          identidade (não há sombra nem card para fazer isso). */}
      <div className="hidden lg:block mb-3">
        <p className="text-meta uppercase tracking-[0.1em] text-[color:var(--color-muted)]" style={{ fontFamily: "var(--font-mono)" }}>
          Orçamento {vehicle ? `· ${vehicle.brand} ${vehicle.model}` : ""} · Rascunho
        </p>
        <div className="mt-1 flex items-end justify-between gap-3 flex-wrap border-b-[3px] border-[color:var(--color-text)] pb-2.5">
          <h1 className="text-[34px] leading-none">Avaliação de danos</h1>
          <div className="flex items-center gap-2 pb-0.5">
            <button
              onClick={handleReset}
              title="Apaga os danos deste carro e volta a cor original"
              className="inline-flex items-center gap-1.5 border border-[color:var(--color-text)] bg-transparent hover:bg-[color:var(--color-text)] hover:text-[color:var(--color-bg)] px-3 py-2 text-label font-medium text-[color:var(--color-text)] transition-colors"
            >
              <RotateCcw size={13} /> Reiniciar orçamento
            </button>
            <button
              onClick={() => setEditorState({ mode: "create" })}
              className="inline-flex items-center gap-2 bg-[color:var(--color-text)] hover:bg-black px-4 py-2 text-label font-semibold text-[color:var(--color-bg)] transition-colors"
            >
              <Plus size={15} /> {addLabel}
            </button>
          </div>
        </div>
      </div>

      {/* Visualizador + lista de peças abaixo */}
      <div className="min-w-0 lg:flex lg:flex-col lg:flex-1 lg:min-h-0">
        {/* Visualizador do carro */}
        {/* `--r360-viewer-bg` da identidade. O #05060A era do mundo escuro e
            aparecia como retângulo preto enquanto o modelo carrega. */}
        <div className="relative overflow-hidden border border-[color:var(--color-border)] mb-3 shrink-0 bg-[#E4E1D9]">
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
            <div className="absolute top-3 left-3 z-20 rounded-full bg-[color:var(--color-surface)]/95 backdrop-blur border border-[color:var(--color-border)] pl-3 pr-1 py-1 flex items-center gap-2">
              <span className="text-[10px] font-medium text-[color:var(--color-text)] truncate max-w-[180px]">
                {PART_LABELS[activePart]}
              </span>
              <button
                onClick={() => setActivePart(null)}
                aria-label="Limpar seleção"
                className="w-5 h-5 rounded-full hover:bg-[color:var(--color-surface-3)] text-[color:var(--color-muted)] hover:text-[color:var(--color-text)] flex items-center justify-center transition-colors"
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
            className="flex-1 inline-flex items-center justify-center gap-2 rounded-full bg-[color:var(--color-primary)]/15 border border-[color:var(--color-primary)]/40 hover:bg-[color:var(--color-primary)]/25 px-4 py-2.5 text-sm font-semibold text-[color:var(--color-text)] transition"
          >
            <Plus size={16} /> {addLabel}
          </button>
          <button
            onClick={handleReset}
            title="Reiniciar orçamento — apaga os danos deste carro"
            aria-label="Reiniciar orçamento"
            className="inline-flex items-center justify-center rounded-full bg-[color:var(--color-surface)] hover:bg-[color:var(--color-surface-3)] border border-[color:var(--color-border)] w-10 h-10 text-[color:var(--color-muted)] hover:text-[color:var(--color-text)] transition shrink-0"
          >
            <RotateCcw size={14} />
          </button>
        </div>

        {/* Métricas + Detalhes dos danos */}
        {/* Régua de métricas: no mockup as quatro células são coladas, com
            divisória de 1,5px, e não cards soltos. O contorno é o que agrupa. */}
        <div className="grid grid-cols-2 md:grid-cols-4 mb-4 shrink-0 border-[1.5px] border-[color:var(--color-text)] divide-x-[1.5px] divide-y-[1.5px] md:divide-y-0 divide-[color:var(--color-text)]">
          <MetricCard
            title="Local do acidente"
            icon={<MapPin size={22} />}
            onClick={onLocationClick}
            backdrop={
              <>
                <MapTexture />
                {/* Escurece a textura sob o texto: sem isto o rótulo cai em
                    cima das linhas claras do mapa e perde contraste. */}
                <div className="absolute inset-0 bg-gradient-to-t from-[#0A0B0F]/85 via-[#0A0B0F]/45 to-transparent" />
              </>
            }
          />

          <MetricCard title="Em análise" value={summary.activeCount > 0 ? "Aberto" : "—"} />
          <MetricCard
            title={`Peça${summary.activeCount === 1 ? "" : "s"} danificada${summary.activeCount === 1 ? "" : "s"}`}
            value={summary.activeCount}
          />

          <MetricCard
            tone="accent"
            title="Valor estimado"
            value={
              <>
                {totalMain}
                <span className="text-[color:var(--color-text)]/55">,{totalCents}</span>
              </>
            }
          />
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

        {/* Mais respiro acima do que abaixo: o título pertence ao que vem
            depois dele, não ao bloco que acabou. */}
        <h3 className="text-title font-semibold mt-5 mb-2.5 shrink-0">Detalhes dos danos</h3>
        {summary.items.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[color:var(--color-border)] p-6 text-center">
            <p className="text-xs text-[color:var(--color-muted)]">
              Clique num ponto do carro pra adicionar o primeiro dano.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-2 lg:flex-1 lg:min-h-0 lg:overflow-y-auto pr-1 [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-thumb]:bg-[color:var(--color-surface-3)] [&::-webkit-scrollbar-thumb]:rounded-full">
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

/**
 * Card da grade de resumo.
 *
 * Os quatro cards eram três implementações: dois deste componente, um `<div>`
 * com a cor primária copiada à mão e um `<button>` com textura e o rótulo
 * ancorado embaixo. Resultado na mesma grade: três alturas, dois tamanhos de
 * rótulo e dois pontos de ancoragem — o olho não conseguia ler os quatro como
 * um conjunto.
 *
 * Agora a geometria (altura, respiro, papéis tipográficos, ordem valor→rótulo)
 * mora aqui, e a variante decide só a superfície. Somar um quinto card é
 * escolher um `tone`, não copiar markup.
 */
function MetricCard({
  title,
  value,
  icon,
  tone = "default",
  onClick,
  backdrop,
}: {
  title: string;
  /** O que responde a pergunta. Ausente em card de ação, que mostra `icon`. */
  value?: ReactNode;
  icon?: ReactNode;
  tone?: "default" | "accent";
  onClick?: () => void;
  /** Camada decorativa atrás do conteúdo (ex.: textura de mapa). */
  backdrop?: ReactNode;
}) {
  const interactive = typeof onClick === "function";
  const Tag = interactive ? "button" : "div";

  // Texto claro sobre o vermelho de largada, via `--color-on-accent`. Com o
  // vermelho fechado em #C9241B a conta virou: claro dá 5,4:1 e passa na AA,
  // preto dá 3,8:1 e reprova no rótulo de 14px — era o contrário no #E23B2E.
  const surface =
    tone === "accent"
      ? "bg-[color:var(--color-primary)]"
      : "bg-[color:var(--color-surface)]";

  return (
    <Tag
      {...(interactive ? { onClick, type: "button" as const } : {})}
      className={[
        "relative isolate overflow-hidden p-3 text-left",
        // Altura mínima igual nos quatro: é o que faz a grade ler como grade.
        // `justify-between` ancora o rótulo embaixo mesmo quando o valor quebra.
        "flex min-h-[76px] flex-col justify-between",
        surface,
        interactive
          ? "transition-colors hover:bg-[color:var(--color-surface-3)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--color-primary-glow)]"
          : "",
      ].join(" ")}
    >
      {backdrop}
      <div className="relative">
        {value !== undefined ? (
          // `.r360-stat strong` da identidade: condensada itálica, caixa alta,
          // 26px. Estava em monoespaçada — é o que mais destoava do mockup,
          // porque o número é o que o olho pega primeiro na régua.
          <p
            className={
              "tabular text-[26px] leading-none uppercase " +
              (tone === "accent" ? "text-[color:var(--color-on-accent)]" : "text-[color:var(--color-text)]")
            }
            style={{ fontFamily: "var(--font-display)", fontStyle: "italic", fontWeight: 800 }}
          >
            {value}
          </p>
        ) : (
          <span className="flex h-[26px] items-center text-[color:var(--color-muted)]">{icon}</span>
        )}
      </div>
      <p
        className={
          // `.r360-stat span`: 12px, peso médio, apagado. O rótulo é legenda
          // do número, não concorre com ele.
          "relative text-meta font-medium " +
          (tone === "accent" ? "text-[color:var(--color-on-accent)]" : "text-[color:var(--color-muted)]")
        }
      >
        {title}
      </p>
    </Tag>
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
          : "bg-[color:var(--color-surface)] border-[color:var(--color-border)] hover:border-[color:var(--color-border-strong)]",
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
          className="relative w-20 h-16 shrink-0 rounded-xl overflow-hidden border border-[color:var(--color-border)] bg-[color:var(--color-surface)] flex items-center justify-center hover:border-[color:var(--color-border-strong)] transition-colors"
        >
          {thumbUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={thumbUrl}
              alt={detail.label}
              className="w-full h-full object-cover"
            />
          ) : detail.photos.length > 0 ? (
            <div className="w-full h-full animate-pulse bg-[color:var(--color-surface-3)]" />
          ) : (
            <div className="flex flex-col items-center gap-0.5 text-[color:var(--color-muted)]">
              <ImagePlus size={16} />
              <span className="text-[8px] uppercase tracking-wider">+ foto</span>
            </div>
          )}
          {detail.photos.length > 0 && (
            <span className="absolute top-1 left-1 flex items-center gap-1 rounded-md bg-[color:var(--color-surface)]/90 backdrop-blur px-1.5 py-0.5 text-[9px] text-[color:var(--color-text)]">
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

        {/* Desktop: ícones pequenos ao lado do texto (mouse acerta 13px).
            No celular essa coluna sai e as mesmas ações vão pra a faixa de
            botões de 44px logo abaixo. */}
        <div className="hidden lg:flex flex-col items-end justify-between shrink-0">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onEdit();
            }}
            className="flex items-center gap-1.5 text-xs text-[color:var(--color-text)] hover:text-[color:var(--color-text)] transition-colors"
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
                className="hover:text-[color:var(--color-text)] transition-colors"
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
                className="hover:text-[color:var(--color-text)] transition-colors"
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

      {/* Celular: faixa de ações com alvo de 44px. "Remover" fica no fim e
          separado dos outros (e já pede confirmação). Histórico e Recalcular
          ficam só no desktop: um mostra "em breve" e o outro só seleciona a
          peça, então não merecem um alvo de toque aqui. */}
      <div className="flex items-center gap-2 lg:hidden">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onEdit();
          }}
          className="flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] text-label font-medium text-[color:var(--color-text)]"
        >
          Personalizar <SlidersHorizontal size={14} />
        </button>
        {slotsLeft > 0 && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              fileRef.current?.click();
            }}
            aria-label="Adicionar foto"
            className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] text-[color:var(--color-muted)]"
          >
            <ImagePlus size={18} />
          </button>
        )}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleResolved();
          }}
          aria-label={detail.resolved ? "Reabrir dano" : "Marcar como resolvido"}
          aria-pressed={detail.resolved}
          className={cn(
            "flex size-11 shrink-0 items-center justify-center rounded-xl border",
            detail.resolved
              ? "border-[color:var(--color-success)]/30 bg-[color:var(--color-success)]/15 text-[color:var(--color-success)]"
              : "border-[color:var(--color-border)] bg-[color:var(--color-surface)] text-[color:var(--color-muted)]",
          )}
        >
          <CircleCheck size={18} />
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          aria-label="Remover dano"
          className="ml-2 flex size-11 shrink-0 items-center justify-center rounded-xl border border-[color:var(--color-danger)]/30 bg-[color:var(--color-danger)]/10 text-[color:var(--color-danger)]"
        >
          <Trash2 size={18} />
        </button>
      </div>

      {/* Comentário fixado */}
      {editingNote ? (
        <div
          onClick={(e) => e.stopPropagation()}
          className="mt-1 rounded-xl border border-[color:var(--color-border)] bg-black/20 p-2"
        >
          <textarea
            autoFocus
            value={noteDraft}
            onChange={(e) => setNoteDraft(e.target.value)}
            rows={2}
            placeholder="Descreva o dano pra oficina…"
            className="w-full bg-transparent text-body text-[color:var(--color-text)] placeholder:text-[color:var(--color-muted)] outline-none resize-none"
          />
          <div className="flex items-center justify-end gap-1.5 mt-1">
            <button
              onClick={() => {
                setNoteDraft(detail.notes ?? "");
                setEditingNote(false);
              }}
              className="rounded-md px-4 min-h-11 text-meta text-[color:var(--color-muted)] hover:text-[color:var(--color-text)] lg:min-h-0 lg:px-2 lg:py-1 lg:text-[10px]"
            >
              Cancelar
            </button>
            <button
              onClick={() => {
                onNotesChange(noteDraft.trim());
                setEditingNote(false);
              }}
              className="rounded-md bg-[color:var(--color-primary)] hover:brightness-110 px-4 min-h-11 text-meta font-semibold text-[color:var(--color-text)] lg:min-h-0 lg:px-2 lg:py-1 lg:text-[10px]"
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
          className="mt-1 rounded-xl bg-black/20 border border-[color:var(--color-border)] px-2.5 py-2 flex items-start gap-2 hover:border-[color:var(--color-border-strong)] transition-colors"
        >
          <MessageSquare size={11} className="text-[color:var(--color-muted)] mt-0.5 shrink-0" />
          <p className="text-[11px] text-[color:var(--color-muted)] italic flex-1">"{detail.notes}"</p>
        </div>
      ) : (
        <button
          onClick={(e) => {
            e.stopPropagation();
            setNoteDraft("");
            setEditingNote(true);
          }}
          className="mt-1 self-start inline-flex min-h-11 items-center gap-1.5 text-meta text-[color:var(--color-muted)] hover:text-[color:var(--color-text)] transition-colors lg:min-h-0 lg:gap-1 lg:text-[10px]"
        >
          <MessageSquare size={12} />
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
      <circle cx="108" cy="50" r="3" fill="#C9241B" />
      <circle cx="108" cy="50" r="7" fill="#C9241B" opacity="0.25" />
    </svg>
  );
}
