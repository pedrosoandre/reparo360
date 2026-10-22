"use client";

import { useEffect, useMemo, useState } from "react";
import { Sidebar } from "@/components/dashboard/sidebar";
import { MobileProfileHeader } from "@/components/dashboard/mobile-profile-header";
import { PartsOverview } from "@/components/dashboard/parts-overview";
import { VehiclePickerCard, DamagesActionsCard } from "@/components/dashboard/general-info";
import { VehiclePickerModal } from "@/components/dashboard/vehicle-picker-modal";
import { useAuthStore, useAuthHydrated, useCurrentUser } from "@/stores/auth-store";
import { useVehiclesStore } from "@/stores/vehicles-store";
import type { Vehicle } from "@/types";
import type { SelectedVehicle } from "@/lib/vehicles";
import { assetUrl } from "@/lib/assets";

export default function DashboardPage() {
  const hydrated = useAuthHydrated();
  const ensureLocalUser = useAuthStore((s) => s.ensureLocalUser);
  const user = useCurrentUser();
  const allVehicles = useVehiclesStore((s) => s.vehicles);
  const vehicles = useMemo(
    () => (user ? allVehicles.filter((v) => v.userId === user.id) : []),
    [allVehicles, user],
  );
  const activeVehicleId = useVehiclesStore((s) => s.activeVehicleId);
  const addVehicle = useVehiclesStore((s) => s.addVehicle);
  const setActive = useVehiclesStore((s) => s.setActive);
  const [bodyColor, setBodyColor] = useState<string | null>(null);

  useEffect(() => {
    if (hydrated && !user) ensureLocalUser();
  }, [hydrated, user, ensureLocalUser]);

  const activeVehicle: Vehicle | undefined = useMemo(() => {
    if (!activeVehicleId) return vehicles[0];
    return vehicles.find((v) => v.id === activeVehicleId) ?? vehicles[0];
  }, [vehicles, activeVehicleId]);

  useEffect(() => {
    // Se o veículo ativo não pertence mais ao usuário (ex.: removido), fixa outro
    if (activeVehicle && activeVehicle.id !== activeVehicleId) {
      setActive(activeVehicle.id);
    }
  }, [activeVehicle, activeVehicleId, setActive]);

  function handlePickNew(v: SelectedVehicle) {
    if (!user) return;
    addVehicle(user.id, {
      brand: v.brand,
      model: v.model,
      year: v.year,
      glb: v.glb,
      category: v.category,
    });
  }

  function handleSelectExisting(v: SelectedVehicle) {
    if (!user) return;
    // Se já existe veículo com essa marca+modelo, ativa; senão, cria
    const existing = vehicles.find(
      (x) => x.brand === v.brand && x.model === v.model && x.year === v.year,
    );
    if (existing) {
      setActive(existing.id);
    } else {
      addVehicle(user.id, {
        brand: v.brand,
        model: v.model,
        year: v.year,
        glb: v.glb,
        category: v.category,
      });
    }
  }

  if (!hydrated) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#111318] to-[#0F1116] flex items-center justify-center">
        <div className="w-10 h-10 rounded-full border-2 border-white/20 border-t-white animate-spin" />
      </div>
    );
  }

  if (!activeVehicle) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#111318] to-[#0F1116]">
        <VehiclePickerModal onPick={handlePickNew} />
      </div>
    );
  }

  return (
    <div className="lg:h-screen lg:overflow-hidden flex flex-col">
      <MobileProfileHeader />
      <div className="flex-1 min-h-0 w-full p-2 sm:p-3 md:p-4 bg-gradient-to-b from-[#111318] to-[#0F1116]">
        <div className="grid grid-cols-1 lg:grid-cols-[240px_1fr_320px] xl:grid-cols-[260px_1fr_340px] lg:grid-rows-[auto_1fr] gap-3 sm:gap-4 lg:h-full lg:min-h-0">
          <div className="order-1 lg:order-none lg:col-start-3 lg:row-start-1">
            <VehiclePickerCard
              vehicle={activeVehicle}
              onSelectVehicle={handleSelectExisting}
            />
          </div>
          <div className="order-2 lg:order-none lg:col-start-2 lg:row-span-2 min-w-0 lg:min-h-0">
            <PartsOverview
              vehicleId={activeVehicle.id}
              glbUrl={assetUrl(`/cars/${activeVehicle.glb}`)}
              bodyColor={bodyColor}
              onBodyColorChange={setBodyColor}
            />
          </div>
          <div className="order-3 lg:order-none lg:col-start-3 lg:row-start-2 lg:min-h-0">
            <DamagesActionsCard
              vehicle={activeVehicle}
              bodyColor={bodyColor}
              onResetPaint={() => setBodyColor(null)}
            />
          </div>
          <div className="hidden lg:block lg:order-none lg:col-start-1 lg:row-start-1 lg:row-span-2 lg:min-h-0">
            <Sidebar />
          </div>
        </div>
      </div>

      <footer className="w-full border-t border-white/[0.06] bg-[#0F1116] shrink-0">
        <div className="px-3 sm:px-4 md:px-5 py-2 flex flex-wrap items-center justify-center md:justify-between gap-3 text-xs text-[color:var(--color-muted)]">
          <span className="opacity-60">© {new Date().getFullYear()} Reparo360</span>
          <nav className="flex flex-wrap items-center gap-4 sm:gap-6">
            <a className="hover:text-white transition-colors cursor-pointer">Sobre</a>
            <a className="hover:text-white transition-colors cursor-pointer">Política de privacidade</a>
            <a className="hover:text-white transition-colors cursor-pointer">Informações legais</a>
          </nav>
        </div>
      </footer>
    </div>
  );
}
