"use client";

import { VEHICLE_BRANDS, modelsForBrand, findVehicle } from "@/lib/vehicles";
import { useBudgetDraft } from "@/stores/budget-store";
import { GlassCard } from "@/components/ui/glass-card";
import { Car } from "lucide-react";
import { useMemo } from "react";

export function VehicleStep() {
  const { vehicle, setVehicle } = useBudgetDraft();

  const modelsAvailable = useMemo(
    () => (vehicle.brand ? modelsForBrand(vehicle.brand) : []),
    [vehicle.brand],
  );

  const yearsAvailable = useMemo(() => {
    const v = findVehicle(vehicle.brand, vehicle.model);
    return v?.years ?? [];
  }, [vehicle.brand, vehicle.model]);

  return (
    <GlassCard className="p-8">
      <div className="flex items-center gap-3 mb-2">
        <div className="w-11 h-11 rounded-2xl bg-[color:var(--color-primary)]/15 text-[color:var(--color-primary-glow)] flex items-center justify-center">
          <Car size={22} />
        </div>
        <div>
          <h2 className="text-xl font-semibold">Dados do veículo</h2>
          <p className="text-sm text-[color:var(--color-muted)]">
            Escolha o veículo — a lista mostra apenas modelos com visualização 3D disponível.
          </p>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4 mt-6">
        <Field label="Marca">
          <select
            value={vehicle.brand ?? ""}
            onChange={(e) =>
              setVehicle({
                brand: e.target.value,
                model: "",
                year: undefined,
                category: undefined,
                glb: undefined,
              })
            }
            className="input"
          >
            <option value="">Selecione…</option>
            {VEHICLE_BRANDS.map((b) => (
              <option key={b} value={b}>{b}</option>
            ))}
          </select>
        </Field>

        <Field label="Modelo">
          <select
            value={vehicle.model ?? ""}
            onChange={(e) => {
              // Categoria e glb vêm do catálogo: o resumo calcula o preço com
              // a categoria, e o orçamento salvo também (via findVehicle).
              const entry = findVehicle(vehicle.brand, e.target.value);
              setVehicle({
                model: e.target.value,
                year: undefined,
                category: entry?.category,
                glb: entry?.glb,
              });
            }}
            disabled={!vehicle.brand}
            className="input"
          >
            <option value="">
              {vehicle.brand ? "Selecione o modelo…" : "Escolha a marca primeiro"}
            </option>
            {modelsAvailable.map((m) => (
              <option key={m.model} value={m.model}>{m.model}</option>
            ))}
          </select>
        </Field>

        <Field label="Ano">
          <select
            value={vehicle.year ?? ""}
            onChange={(e) => setVehicle({ year: Number(e.target.value) })}
            disabled={!vehicle.model}
            className="input"
          >
            <option value="">
              {vehicle.model ? "Selecione o ano…" : "Escolha o modelo primeiro"}
            </option>
            {yearsAvailable.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </Field>

        <Field label="Cor">
          <input
            type="text"
            value={vehicle.color ?? ""}
            onChange={(e) => setVehicle({ color: e.target.value })}
            placeholder="Prata metálico"
            className="input"
          />
        </Field>

        <Field label="Placa (opcional)">
          <input
            type="text"
            value={vehicle.plate ?? ""}
            onChange={(e) => setVehicle({ plate: e.target.value.toUpperCase() })}
            placeholder="ABC-1D23"
            className="input"
          />
        </Field>

        <Field label="Quilometragem (opcional)">
          <input
            type="number"
            value={vehicle.mileage ?? ""}
            onChange={(e) => setVehicle({ mileage: Number(e.target.value) })}
            placeholder="65000"
            className="input"
          />
        </Field>
      </div>

      <style>{`
        .input {
          width: 100%;
          height: 48px;
          padding: 0 16px;
          border-radius: 16px;
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.08);
          color: #F5F7FB;
          font-size: 14px;
          transition: all 0.2s;
        }
        .input:focus {
          outline: none;
          border-color: #4F6BFF;
          box-shadow: 0 0 0 3px rgba(79,107,255,0.15);
        }
        .input:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        select.input option { background: #111318; color: #F5F7FB; }
      `}</style>
    </GlassCard>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-2">
      <span className="text-xs uppercase tracking-wider text-[color:var(--color-muted)]">{label}</span>
      {children}
    </label>
  );
}
