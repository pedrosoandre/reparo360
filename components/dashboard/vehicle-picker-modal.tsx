"use client";

import { useMemo, useState } from "react";
import { ChevronDown, X } from "lucide-react";
import {
  VEHICLE_CATALOG,
  VEHICLE_BRANDS,
  modelsForBrand,
  type SelectedVehicle,
} from "@/lib/vehicles";

interface Props {
  onPick: (v: SelectedVehicle) => void;
  onClose?: () => void;
}

/**
 * Modal enxuto de escolha do veículo no dashboard.
 * Dois selects nativos: Marca → Modelo. Botão "Confirmar" habilita ao ter os dois.
 * Nada mais — dashboard só monta depois que este modal fecha.
 */
export function VehiclePickerModal({ onPick, onClose }: Props) {
  const [brand, setBrand] = useState<string>("");
  const [model, setModel] = useState<string>("");

  const models = useMemo(() => (brand ? modelsForBrand(brand) : []), [brand]);
  const ready = brand && model;

  function confirm() {
    const entry = VEHICLE_CATALOG.find((v) => v.brand === brand && v.model === model);
    if (!entry) return;
    onPick({
      brand: entry.brand,
      model: entry.model,
      year: entry.years[0],
      glb: entry.glb,
      category: entry.category,
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="w-full max-w-sm premium-card border border-white/[0.08] p-5 relative">
        {onClose && (
          <button
            onClick={onClose}
            aria-label="Fechar"
            className="absolute top-3 right-3 w-7 h-7 rounded-full bg-white/[0.04] hover:bg-white/[0.1] text-[color:var(--color-muted)] hover:text-white flex items-center justify-center transition-colors"
          >
            <X size={14} />
          </button>
        )}
        <h2 className="text-base font-semibold mb-1">Escolha o seu veículo</h2>
        <p className="text-xs text-[color:var(--color-muted)] mb-4">
          {VEHICLE_CATALOG.length} modelos disponíveis.
        </p>

        <div className="space-y-3">
          <Field label="Marca">
            <select
              value={brand}
              onChange={(e) => {
                setBrand(e.target.value);
                setModel("");
              }}
              className="w-full appearance-none rounded-lg bg-white/[0.06] border border-white/[0.08] px-3 py-2 text-sm text-white outline-none focus:border-white/25 pr-9"
            >
              <option value="" className="bg-[#111318]">Selecione…</option>
              {VEHICLE_BRANDS.map((b) => (
                <option key={b} value={b} className="bg-[#111318]">
                  {b}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Modelo">
            <select
              value={model}
              onChange={(e) => setModel(e.target.value)}
              disabled={!brand}
              className="w-full appearance-none rounded-lg bg-white/[0.06] border border-white/[0.08] px-3 py-2 text-sm text-white outline-none focus:border-white/25 pr-9 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <option value="" className="bg-[#111318]">
                {brand ? "Selecione…" : "Escolha a marca primeiro"}
              </option>
              {models.map((m) => (
                <option key={m.model} value={m.model} className="bg-[#111318]">
                  {m.model}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <button
          onClick={confirm}
          disabled={!ready}
          className="mt-5 w-full h-10 rounded-full bg-[color:var(--color-primary)] text-white text-sm font-medium hover:brightness-110 transition disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Confirmar
        </button>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-[10px] uppercase tracking-wider text-[color:var(--color-muted)]">
        {label}
      </span>
      <div className="relative mt-1">
        {children}
        <ChevronDown
          size={14}
          className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[color:var(--color-muted)]"
        />
      </div>
    </label>
  );
}
