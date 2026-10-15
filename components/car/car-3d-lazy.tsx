"use client";

import dynamic from "next/dynamic";
import { Component, useEffect, useState, type ComponentProps, type ReactNode } from "react";
import { Box, Boxes } from "lucide-react";
import { CarSvg } from "./car-svg";
import type { CarPart } from "@/types";
import { probeWebGL, type WebGLProbe } from "@/lib/webgl";

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
 * cair pro SVG 2D — preferência persistida em localStorage. Sem WebGL, ou se
 * a cena 3D quebrar, também cai pro 2D, com um aviso dizendo o motivo.
 * O `Car3D` já cuida das otimizações mobile internamente (DPR 1, sem
 * spotLight, dispose de VRAM).
 */
export function Car3DLazy(props: ComponentProps<typeof Car3D>) {
  const [lightMode, setLightMode] = useState<boolean | null>(null);
  const [webgl, setWebgl] = useState<WebGLProbe | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") {
      setLightMode(false);
      setWebgl({ ok: true });
      return;
    }
    setLightMode(window.localStorage.getItem(LIGHT_MODE_KEY) === "1");
    setWebgl(probeWebGL());
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

  if (lightMode === null || webgl === null) return <LoadingPlaceholder />;

  // 2D: escolhido pelo usuário (modo leve) ou fallback quando o 3D não abre.
  function svgView(notice?: ReactNode) {
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
        {notice ?? <ModeToggle lightMode onClick={toggleLightMode} />}
      </div>
    );
  }

  if (lightMode) return svgView();

  if (!webgl.ok) {
    return svgView(
      <ViewerNotice
        title="O navegador bloqueou o 3D. Feche todas as janelas dele e abra de novo."
        detail={webgl.reason}
      />,
    );
  }

  return (
    <ViewerErrorBoundary
      key={props.modelUrl ?? "default"}
      fallback={(message) =>
        svgView(
          <ViewerNotice
            title="Não foi possível carregar o 3D. Você pode continuar no 2D."
            detail={message}
          />,
        )
      }
    >
      <div className="relative">
        <Car3D {...props} />
        <ModeToggle lightMode={lightMode} onClick={toggleLightMode} />
      </div>
    </ViewerErrorBoundary>
  );
}

// Falha de rede/asset/GPU dentro da cena 3D sobe pelo <Canvas> como erro de
// render — sem este boundary derrubava a página inteira ("Application error").
class ViewerErrorBoundary extends Component<
  { children: ReactNode; fallback: (message: string) => ReactNode },
  { message: string | null }
> {
  state: { message: string | null } = { message: null };

  static getDerivedStateFromError(error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return { message: message || "erro desconhecido" };
  }

  componentDidCatch(error: unknown) {
    console.error("[Car3D] falha no visualizador 3D:", error);
  }

  render() {
    return this.state.message === null
      ? this.props.children
      : this.props.fallback(this.state.message);
  }
}

// O motivo técnico fica visível (pequeno) pra que um print da tela já diga o
// que aconteceu, sem precisar abrir o console.
function ViewerNotice({ title, detail }: { title: string; detail: string }) {
  return (
    <div
      role="status"
      className="absolute inset-x-3 top-3 z-20 flex items-start gap-3 rounded-xl border border-white/[0.12] bg-black/75 px-3 py-2 backdrop-blur"
    >
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium text-white">{title}</p>
        <p className="truncate text-[10px] text-white/45" title={detail}>
          {detail}
        </p>
      </div>
      <button
        type="button"
        onClick={() => window.location.reload()}
        className="shrink-0 rounded-full bg-[color:var(--color-primary)] px-3 py-1 text-[11px] font-medium text-white hover:opacity-90"
      >
        Tentar de novo
      </button>
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
