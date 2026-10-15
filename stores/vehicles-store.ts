"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { Vehicle } from "@/types";
import { uid } from "@/lib/ids";

interface VehiclesState {
  vehicles: Vehicle[];
  activeVehicleId: string | null;

  addVehicle: (
    userId: string,
    input: Omit<Vehicle, "id" | "userId" | "createdAt">,
  ) => Vehicle;
  updateVehicle: (id: string, patch: Partial<Vehicle>) => void;
  removeVehicle: (id: string) => void;
  setActive: (id: string | null) => void;
  vehiclesFor: (userId: string) => Vehicle[];
}

export const useVehiclesStore = create<VehiclesState>()(
  persist(
    (set, get) => ({
      vehicles: [],
      activeVehicleId: null,

      addVehicle: (userId, input) => {
        const vehicle: Vehicle = {
          ...input,
          id: uid("veh"),
          userId,
          createdAt: new Date().toISOString(),
        };
        set((s) => ({
          vehicles: [...s.vehicles, vehicle],
          activeVehicleId: vehicle.id,
        }));
        return vehicle;
      },

      updateVehicle: (id, patch) =>
        set((s) => ({
          vehicles: s.vehicles.map((v) => (v.id === id ? { ...v, ...patch } : v)),
        })),

      removeVehicle: (id) =>
        set((s) => ({
          vehicles: s.vehicles.filter((v) => v.id !== id),
          activeVehicleId: s.activeVehicleId === id ? null : s.activeVehicleId,
        })),

      setActive: (id) => set({ activeVehicleId: id }),

      vehiclesFor: (userId) => get().vehicles.filter((v) => v.userId === userId),
    }),
    {
      name: "reparo360:vehicles",
      storage: createJSONStorage(() => localStorage),
    },
  ),
);
