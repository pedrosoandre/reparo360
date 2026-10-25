"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Car, Plus, Trash2, Check } from "lucide-react";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { EmptyState } from "@/components/ui/empty-state";
import { Plate } from "@/components/ui/plate";
import { VehiclePickerModal } from "@/components/dashboard/vehicle-picker-modal";
import { useCurrentUser } from "@/stores/auth-store";
import { useVehiclesStore } from "@/stores/vehicles-store";
import { useDamagesStore } from "@/stores/damages-store";
import { formatDate } from "@/lib/utils";
import { CATEGORY_LABELS, type VehicleCategory } from "@/lib/vehicles";
import { confirmDialog } from "@/stores/confirm-store";

export default function VeiculosPage() {
  const user = useCurrentUser();
  const router = useRouter();
  const [picking, setPicking] = useState(false);
  const allVehicles = useVehiclesStore((s) => s.vehicles);
  const vehicles = useMemo(
    () => (user ? allVehicles.filter((v) => v.userId === user.id) : []),
    [allVehicles, user],
  );
  const addVehicle = useVehiclesStore((s) => s.addVehicle);
  const removeVehicle = useVehiclesStore((s) => s.removeVehicle);
  const setActive = useVehiclesStore((s) => s.setActive);
  const activeId = useVehiclesStore((s) => s.activeVehicleId);
  const clearDamages = useDamagesStore((s) => s.clearForVehicle);
  const damages = useDamagesStore((s) => s.damages);

  function goDashboard(id: string) {
    setActive(id);
    router.push("/dashboard");
  }

  async function handleRemove(id: string) {
    const ok = await confirmDialog({
      title: "Remover veículo",
      message: "Todos os danos cadastrados neste veículo serão apagados junto.",
      confirmLabel: "Remover",
      danger: true,
    });
    if (!ok) return;
    clearDamages(id);
    removeVehicle(id);
  }

  return (
    <DashboardShell>
      <div className="premium-card p-4 sm:p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-lg font-semibold">Meus veículos</h1>
            <p className="text-xs text-[color:var(--color-muted)]">
              {vehicles.length} {vehicles.length === 1 ? "veículo cadastrado" : "veículos cadastrados"}
            </p>
          </div>
          <button
            onClick={() => setPicking(true)}
            className="inline-flex items-center gap-1.5 rounded-full bg-[color:var(--color-primary)] px-3.5 py-2 text-xs font-semibold text-[color:var(--color-text)] hover:brightness-110 transition"
          >
            <Plus size={14} /> Novo veículo
          </button>
        </div>

        {vehicles.length === 0 ? (
          <EmptyState
            icon={Car}
            title="Nenhum veículo cadastrado"
            description="Adicione seu primeiro veículo pra começar a montar orçamentos."
            action={
              <button
                onClick={() => setPicking(true)}
                className="inline-flex items-center gap-1.5 rounded-full bg-[color:var(--color-primary)] px-4 py-2 text-xs font-semibold text-[color:var(--color-text)] hover:brightness-110 transition"
              >
                <Plus size={14} /> Cadastrar veículo
              </button>
            }
          />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {vehicles.map((v) => {
              const dmgCount = damages.filter((d) => d.vehicleId === v.id).length;
              const active = v.id === activeId;
              return (
                <div
                  key={v.id}
                  className="premium-card-flat p-4 flex flex-col gap-3 group"
                >
                  <div className="flex items-start justify-between">
                    <div className="min-w-0">
                      <p className="font-semibold text-body truncate">
                        {v.brand} {v.model}
                      </p>
                      <p className="text-meta text-[color:var(--color-muted)] uppercase tracking-[0.08em] mt-0.5" style={{ fontFamily: "var(--font-mono)" }}>
                        {v.year} · {CATEGORY_LABELS[v.category as VehicleCategory] ?? v.category}
                      </p>
                      {/* A placa é o que identifica o carro para quem trabalha
                          com ele — aparece como placa de verdade, não texto. */}
                      {v.plate && <Plate value={v.plate} className="mt-2" />}
                    </div>
                    {active && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-[color:var(--color-primary-glow)]">
                        <Check size={12} /> Ativo
                      </span>
                    )}
                  </div>

                  <div className="text-[11px] text-[color:var(--color-muted)] flex items-center gap-3">
                    <span>
                      {dmgCount} {dmgCount === 1 ? "dano" : "danos"} cadastrados
                    </span>
                    <span>· desde {formatDate(v.createdAt)}</span>
                  </div>

                  <div className="flex items-center gap-2 mt-auto">
                    <button
                      onClick={() => goDashboard(v.id)}
                      className="flex-1 h-9 rounded-xl bg-[color:var(--color-primary)]/15 hover:bg-[color:var(--color-primary)]/25 border border-[color:var(--color-primary)]/30 text-xs font-semibold text-[color:var(--color-text)] transition-colors"
                    >
                      Abrir
                    </button>
                    <button
                      onClick={() => handleRemove(v.id)}
                      className="h-9 w-9 rounded-xl bg-[color:var(--color-surface)] hover:bg-[color:var(--color-danger)]/15 hover:text-[color:var(--color-danger)] border border-[color:var(--color-border)] text-[color:var(--color-muted)] transition-colors flex items-center justify-center"
                      aria-label="Remover"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {picking && user && (
        <VehiclePickerModal
          onPick={(v) => {
            const vehicle = addVehicle(user.id, {
              brand: v.brand,
              model: v.model,
              year: v.year,
              glb: v.glb,
              category: v.category,
            });
            setPicking(false);
            router.push("/dashboard");
          }}
          onClose={() => setPicking(false)}
        />
      )}
    </DashboardShell>
  );
}
