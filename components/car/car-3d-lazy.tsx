"use client";

import dynamic from "next/dynamic";
import { useEffect, useState, type ComponentProps } from "react";
import { Box, Boxes } from "lucide-react";
import { CarSvg } from "./car-svg";
import type { CarPart } from "@/types";

const Car3D = dynamic(() => import("./car-3d").then((m) => m.Car3D), {
  ssr: false,
  loading: () => <LoadingPlaceholder />,
});

const LIGHT_MODE_KEY = "reparo360.viewer.lightMode";

function LoadingPlaceholder() {
  return (
    <div className="w-full aspect-[16/8] min-h-[220px] max-h-[38vh] rounded-2xl bg-gradient-to-b from-[#0F1523] to-[#0B0F17] flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="w-10 h-10 rounded-full border-2 border-[color:var(--color-primary)]/30 border-t-[color:var(--color-primary)] animate-spin" />
        <p className="text-xs text-text-secondary">Carregando visualização…</p>
      </div>
    </div>
  );
}

/**
 * Default 3D em todo mundo (mobile e desktop). Toggle no canto permite
 * cair pro SVG 2D — preferência persistida em localStorage.
 * O `Car3D` já cuida das otimizações mobile internamente (DPR 1,
 * frameloop="demand", autoRotate off, dispose de VRAM).
 */
export function Car3DLazy(props: ComponentProps<typeof Car3D>) {
  const [lightMode, setLightMode] = useState<boolean | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") {
      setLightMode(false);
      return;
    }
    setLightMode(window.localStorage.getItem(LIGHT_MODE_KEY) === "1");
  }, []);

  function toggleLightMode() {
    setLightMode((prev) => {
      const next = !prev;
      if (typeof window !== "undefined") {
        window.localStorage.setItem(LIGHT_MODE_KEY, next ? "1" : "0");
      }
      return next;
    });
  }

  if (lightMode === null) return <LoadingPlaceholder />;

  if (lightMode) {
    const highlighted: CarPart[] = Array.from(
      new Set<CarPart>([
        ...(props.selectedParts ?? []),
        ...(props.damagedParts ?? []),
        ...(props.activePart ? [props.activePart] : []),
      ]),
    );
    return (
      <div className="w-full aspect-[16/8] min-h-[220px] max-h-[38vh] rounded-2xl overflow-hidden bg-gradient-to-b from-[#0F1523] to-[#0B0F17] flex items-center justify-center relative">
        <CarSvg
          selectedParts={highlighted}
          onSelectPart={props.onSelectPart}
          interactive={props.interactive ?? true}
        />
        <ModeToggle lightMode={lightMode} onClick={toggleLightMode} />
      </div>
    );
  }

  return (
    <div className="relative">
      <Car3D key={props.modelUrl ?? "default"} {...props} />
      <ModeToggle lightMode={lightMode} onClick={toggleLightMode} />
    </div>
  );
}

function ModeToggle({
  lightMode,
  onClick,
}: {
  lightMode: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={lightMode ? "Voltar para 3D" : "Modo leve (2D)"}
      title={lightMode ? "Voltar para 3D" : "Modo leve (2D)"}
      className="hidden lg:flex absolute top-3 right-3 z-20 w-8 h-8 rounded-full bg-black/50 backdrop-blur border border-white/[0.12] text-white/80 hover:text-white hover:bg-black/70 transition-colors items-center justify-center"
    >
      {lightMode ? <Boxes size={14} /> : <Box size={14} />}
    </button>
  );
}
