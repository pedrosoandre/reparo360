"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { usePhotoUrls } from "@/lib/use-photo-urls";
import { useFipe } from "@/lib/use-fipe";
import {
  ChevronRight,
  ChevronDown,
  ChevronLeft,
  Car,
  X,
  Check,
  Search,
  Send,
  FileEdit,
  Eraser,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  VEHICLE_CATALOG,
  VEHICLE_BRANDS,
  MODELS_PER_BRAND,
  CATEGORY_LABELS,
  modelsForBrand,
  type SelectedVehicle,
  type VehicleCategory,
} from "@/lib/vehicles";
import type { Vehicle } from "@/types";
import { useCurrentUser } from "@/stores/auth-store";
import { useDamagesStore, summarize } from "@/stores/damages-store";
import { useBudgetsStore } from "@/stores/budgets-store";
import { useNotificationsStore } from "@/stores/notifications-store";
import { Lightbox } from "@/components/ui/lightbox";
import { toast } from "@/stores/toast-store";
import { confirmDialog } from "@/stores/confirm-store";

const SPECS: Record<string, string> = {
  hatchback: "1.6 (120 CV), HATCH",
  sedan: "1.8 (140 CV), SEDÃ",
  suv: "2.0 TURBO (245 CV), SUV",
  pickup: "2.8 DIESEL (200 CV), PICAPE",
  wagon: "2.0 (150 CV), PERUA",
  minivan: "1.5 (110 CV), MINIVAN",
  van: "2.2 DIESEL (140 CV), VAN",
  coupe: "2.0 TURBO (230 CV), CUPÊ",
  sports: "3.0 V8 (420 CV), ESPORTIVO",
  utility: "2.0 (150 CV), UTILITÁRIO",
};

interface VehiclePickerCardProps {
  vehicle: Vehicle;
  onSelectVehicle: (v: SelectedVehicle) => void;
}

export function VehiclePickerCard({ vehicle, onSelectVehicle }: VehiclePickerCardProps) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [openBrand, setOpenBrand] = useState<string | null>(null);

  const spec = SPECS[vehicle.category] ?? SPECS.sedan;
  const term = query.trim().toLowerCase();
  const searching = term.length > 0;

  const brandModels = openBrand ? modelsForBrand(openBrand) : [];
  // Busca é sempre relativa ao escopo aberto: com marca selecionada, filtra só
  // dentro dela; sem marca, filtra o catálogo inteiro.
  const searchPool = openBrand ? brandModels : VEHICLE_CATALOG;
  const searchResults = searching
    ? searchPool.filter((v) => `${v.brand} ${v.model}`.toLowerCase().includes(term))
    : [];

  function pick(v: (typeof VEHICLE_CATALOG)[number], keepYear: boolean) {
    onSelectVehicle({
      brand: v.brand,
      model: v.model,
      year: keepYear ? vehicle.year : v.years[0],
      glb: v.glb,
      category: v.category,
    });
    setPickerOpen(false);
    setQuery("");
    setOpenBrand(null);
  }

  function closePicker() {
    setPickerOpen(false);
    setQuery("");
    setOpenBrand(null);
  }

  return (
    <aside className="premium-card p-4 sm:p-5 flex flex-col gap-4">
      {/* Cabeçalho — pill azul só no mobile pra bater com o CTA "Iniciar orçamento" */}
      <div className="flex items-center justify-between">
        <h3 className="font-semibold lg:p-0 lg:bg-transparent lg:border-0 lg:rounded-none lg:text-base inline-flex items-center gap-2 rounded-full bg-[color:var(--color-primary)]/15 border border-[color:var(--color-primary)]/40 px-4 py-2 text-sm text-white">
          Escolha seu carro
        </h3>
      </div>

      {/* Info + troca de veículo */}
      <div className="relative">
        <button
          onClick={() => {
            const opening = !pickerOpen;
            setPickerOpen(opening);
            setOpenBrand(opening ? vehicle.brand : null);
            if (!opening) setQuery("");
          }}
          className="w-full flex items-center gap-2 text-left group"
        >
          <span className="flex items-baseline gap-1.5 min-w-0">
            <span className="text-lg lg:text-xl font-bold text-[color:var(--color-primary-glow)] truncate">
              {vehicle.brand}
            </span>
            <span className="text-sm font-medium text-white truncate">
              {vehicle.model}, {vehicle.year}
            </span>
          </span>
          <span className="inline-block w-2.5 h-2.5 rounded-full bg-slate-300 border border-white/30 shrink-0" />
          <ChevronDown
            size={16}
            className={cn(
              "ml-auto text-[color:var(--color-muted)] group-hover:text-white transition-transform shrink-0",
              pickerOpen && "rotate-180",
            )}
          />
        </button>
        <p className="text-[10px] tracking-wide text-[color:var(--color-muted)] mt-1 uppercase">
          {spec}
        </p>

        {pickerOpen && (
          <div className="absolute left-0 right-0 top-full mt-2 z-20 premium-card-flat shadow-[0_20px_60px_rgba(0,0,0,0.6)] overflow-hidden">
            <div className="flex items-center gap-2 px-2 pt-2">
              {openBrand && !searching ? (
                <button
                  onClick={() => setOpenBrand(null)}
                  className="flex items-center gap-1.5 text-[color:var(--color-primary-glow)] hover:opacity-80 transition-opacity"
                >
                  <ChevronLeft size={16} />
                  <span className="font-bold text-lg lg:text-xl">{openBrand}</span>
                </button>
              ) : (
                <span className="text-[10px] uppercase tracking-wider text-[color:var(--color-muted)] px-1">
                  {searching ? "Resultados" : "Escolha a marca"}
                </span>
              )}
              <button
                onClick={closePicker}
                aria-label="Fechar seletor"
                className="ml-auto text-[color:var(--color-muted)] hover:text-white transition-colors"
              >
                <X size={13} />
              </button>
            </div>

            <div className="p-2">
              <div className="flex items-center gap-2 rounded-xl bg-white/[0.04] px-2.5 py-1.5">
                <Search size={13} className="text-[color:var(--color-muted)] shrink-0" />
                {/* text-[16px] evita o auto-zoom do iOS Safari em input focado (<16px zooma). No desktop volta pro text-xs. */}
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={
                    openBrand
                      ? `Buscar entre ${brandModels.length} modelo${brandModels.length === 1 ? "" : "s"} ${openBrand}…`
                      : `Buscar entre ${VEHICLE_CATALOG.length} veículos…`
                  }
                  className="w-full bg-transparent text-[16px] lg:text-xs text-white placeholder:text-[color:var(--color-muted)] outline-none"
                />
              </div>
            </div>

            <div className="max-h-72 overflow-y-auto p-1.5 border-t border-white/[0.06]">
              {searching && (
                <>
                  {searchResults.length === 0 && (
                    <p className="px-3 py-4 text-xs text-[color:var(--color-muted)] text-center">
                      Nenhum veículo encontrado.
                    </p>
                  )}
                  {searchResults.map((v) => (
                    <ModelRow
                      key={`${v.brand}-${v.model}`}
                      label={openBrand ? v.model : `${v.brand} ${v.model}`}
                      year={v.years[0]}
                      category={v.category}
                      active={v.brand === vehicle.brand && v.model === vehicle.model}
                      onClick={() =>
                        pick(v, v.brand === vehicle.brand && v.model === vehicle.model)
                      }
                    />
                  ))}
                </>
              )}

              {!searching &&
                !openBrand &&
                VEHICLE_BRANDS.map((brand) => {
                  const isCurrent = brand === vehicle.brand;
                  return (
                    <button
                      key={brand}
                      onClick={() => setOpenBrand(brand)}
                      className={cn(
                        "w-full flex items-center gap-2.5 px-3 py-3 lg:py-2.5 rounded-xl transition-colors text-left",
                        isCurrent
                          ? "bg-[color:var(--color-primary)]/15 text-white"
                          : "text-[color:var(--color-muted)] hover:text-white hover:bg-white/[0.04]",
                      )}
                    >
                      <BrandBadge brand={brand} />
                      {/* Mobile: nome da marca grande e branco pra ficar fácil de ler; desktop mantém text-sm/font-medium */}
                      <span className="truncate text-lg lg:text-sm font-bold lg:font-medium text-white lg:text-inherit">
                        {brand}
                      </span>
                      <span className="ml-auto text-[10px] opacity-60">
                        {MODELS_PER_BRAND[brand]}
                      </span>
                      <ChevronRight size={13} className="opacity-50 shrink-0" />
                    </button>
                  );
                })}

              {!searching &&
                openBrand &&
                brandModels.map((v) => (
                  <ModelRow
                    key={v.model}
                    label={v.model}
                    year={v.years[0]}
                    category={v.category}
                    active={v.brand === vehicle.brand && v.model === vehicle.model}
                    onClick={() =>
                      pick(v, v.brand === vehicle.brand && v.model === vehicle.model)
                    }
                  />
                ))}
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}

interface DamagesActionsCardProps {
  vehicle: Vehicle;
  bodyColor?: string | null;
  onResetPaint?: () => void;
}

export function DamagesActionsCard({ vehicle, bodyColor, onResetPaint }: DamagesActionsCardProps) {
  const router = useRouter();
  const user = useCurrentUser();
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const allDamages = useDamagesStore((s) => s.damages);
  const damages = useMemo(
    () => allDamages.filter((d) => d.vehicleId === vehicle.id),
    [allDamages, vehicle.id],
  );
  const summary = useMemo(() => summarize(damages), [damages]);
  // Mesma consulta do PartsOverview (o /api/fipe guarda em cache): o orçamento
  // salvo precisa usar o valor FIPE que deu o preço mostrado na tela.
  const fipe = useFipe(vehicle);
  const marketValue = fipe.status === "found" ? fipe.marketValue : undefined;
  const clearDamagesForVehicle = useDamagesStore((s) => s.clearForVehicle);
  const createFromDashboard = useBudgetsStore((s) => s.createFromDashboard);
  const saveDraft = useBudgetsStore((s) => s.saveDraft);
  const pushNotification = useNotificationsStore((s) => s.push);

  const damagePhotos = damages.flatMap((d) => d.photos);
  const photoUrls = usePhotoUrls(damagePhotos.slice(0, 8));

  function handleFinalize() {
    if (!user) return;
    if (summary.activeCount === 0) {
      toast("Adicione ao menos um dano antes de finalizar.", "error");
      return;
    }
    const budget = createFromDashboard({
      userId: user.id,
      vehicle,
      damages,
      photos: damagePhotos,
      customerName: user.name,
      customerPhone: user.phone,
      source: "dashboard",
      color: bodyColor ?? undefined,
      marketValue,
    });
    pushNotification(user.id, {
      title: `Orçamento ${budget.code} enviado`,
      body: `${budget.items.length} peça(s) · Total estimado ${formatBRLShort(budget.total)}`,
      href: `/orcamentos/${budget.id}`,
    });
    // Fecha e limpa: dano do carro atual apagados, cor da pintura resetada,
    // veículo permanece selecionado. Os danos foram "congelados" dentro do
    // orçamento gerado — o dashboard fica pronto pro próximo.
    clearDamagesForVehicle(vehicle.id);
    onResetPaint?.();
    router.push(`/orcamentos/${budget.id}`);
  }

  function handleSaveDraft() {
    if (!user) return;
    if (summary.activeCount === 0) {
      toast("Adicione ao menos um dano antes de salvar.", "error");
      return;
    }
    const draft = saveDraft({
      userId: user.id,
      vehicle,
      damages,
      photos: damagePhotos,
      customerName: user.name,
      customerPhone: user.phone,
      source: "dashboard",
      color: bodyColor ?? undefined,
      marketValue,
    });
    toast(`Rascunho salvo (${draft.code}).`, "success");
  }

  async function handleClearAll() {
    if (damages.length === 0 && !bodyColor) {
      toast("Nada pra apagar — o dashboard já está limpo.");
      return;
    }
    const ok = await confirmDialog({
      message:
        damages.length > 0
          ? `Apagar todos os ${damages.length} dano(s) deste veículo e resetar a cor?`
          : "Resetar a cor da pintura?",
      confirmLabel: damages.length > 0 ? "Apagar" : "Resetar",
      danger: damages.length > 0,
    });
    if (!ok) return;
    clearDamagesForVehicle(vehicle.id);
    onResetPaint?.();
  }

  return (
    <aside className="premium-card p-4 sm:p-5 flex flex-col gap-4 lg:h-full lg:min-h-0 lg:overflow-y-auto">
      {/* Fotos */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm font-semibold">
            Fotos dos danos{" "}
            <span className="text-[color:var(--color-muted)] text-xs font-normal">
              ({damagePhotos.length})
            </span>
          </h4>
        </div>
        {damagePhotos.length === 0 ? (
          <p className="text-xs text-[color:var(--color-muted)]">
            Envie fotos ao cadastrar um dano.
          </p>
        ) : (
          <div className="grid grid-cols-4 gap-2">
            {damagePhotos.slice(0, 8).map((ref, i) => (
              <button
                key={ref}
                onClick={() => setLightboxIndex(i)}
                className="relative aspect-square group"
                aria-label={`Abrir foto ${i + 1} do dano`}
              >
                {photoUrls[i] ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={photoUrls[i]!}
                    alt="Foto do dano"
                    className="w-full h-full object-cover rounded-lg border border-white/[0.06] group-hover:border-white/[0.2] transition-colors"
                    loading="lazy"
                  />
                ) : (
                  <div className="w-full h-full rounded-lg border border-white/[0.06] bg-white/[0.04] animate-pulse" />
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="flex-1" />

      <div className="flex flex-col gap-2">
        <button
          onClick={handleClearAll}
          className="w-full h-9 rounded-xl bg-transparent hover:bg-[color:var(--color-danger)]/10 border border-white/[0.06] hover:border-[color:var(--color-danger)]/30 text-[color:var(--color-muted)] hover:text-[color:var(--color-danger)] font-medium text-[11px] transition-colors flex items-center justify-center gap-1.5"
        >
          <Eraser size={12} />
          Apagar tudo (mantém o veículo)
        </button>
        <button
          onClick={handleSaveDraft}
          className="w-full h-10 rounded-2xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] text-white font-medium text-xs transition-colors flex items-center justify-center gap-1.5"
        >
          <FileEdit size={13} />
          Salvar rascunho
        </button>
        <button
          onClick={handleFinalize}
          className="w-full h-12 rounded-2xl bg-[color:var(--color-primary)] hover:bg-[color:var(--color-primary-hover)] text-white font-semibold text-sm shadow-[0_10px_30px_-10px_rgba(79,107,255,0.6)] transition-colors flex items-center justify-center gap-2"
        >
          <Send size={14} />
          Finalizar orçamento
        </button>
      </div>

      {lightboxIndex !== null && (
        <Lightbox
          photos={damagePhotos}
          initialIndex={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
        />
      )}
    </aside>
  );
}

function formatBRLShort(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  }).format(value);
}

function ModelRow({
  label,
  year,
  category,
  active,
  onClick,
}: {
  label: string;
  year: number;
  category: VehicleCategory;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm transition-colors text-left",
        active
          ? "bg-[color:var(--color-primary)]/15 text-white"
          : "text-[color:var(--color-muted)] hover:text-white hover:bg-white/[0.04]",
      )}
    >
      <Car size={14} className="shrink-0" />
      <span className="truncate">{label}</span>
      <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded-md bg-white/[0.06] shrink-0">
        {CATEGORY_LABELS[category]}
      </span>
      <span className="text-[10px] opacity-60 shrink-0">{year}</span>
      {active && <Check size={13} className="text-[color:var(--color-primary-glow)] shrink-0" />}
    </button>
  );
}

function BrandBadge({ brand }: { brand: string }) {
  const initials = brand
    .split(/[\s-]+/)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  return (
    <span className="w-6 h-6 rounded-full bg-white/[0.08] border border-white/[0.08] flex items-center justify-center text-[9px] font-bold shrink-0">
      {initials}
    </span>
  );
}
