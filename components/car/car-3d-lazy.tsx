"use client";

import dynamic from "next/dynamic";
import { Component, useEffect, useState, type ComponentProps, type ReactNode } from "react";
import { CarSvg } from "./car-svg";
import type { CarPart } from "@/types";
import { probeWebGL, type WebGLProbe } from "@/lib/webgl";
import { VIEWER_BOX } from "./viewer-box";

const Car3D = dynamic(() => import("./car-3d").then((m) => m.Car3D), {
  ssr: false,
  loading: () => <LoadingPlaceholder />,
});

function LoadingPlaceholder() {
  return (
    <div className={`${VIEWER_BOX} rounded-2xl bg-gradient-to-b from-[color:var(--color-surface)] to-[color:var(--color-surface-3)] flex items-center justify-center`}>
      <div className="flex flex-col items-center gap-3">
        <div className="w-10 h-10 rounded-full border-2 border-[color:var(--color-primary)]/30 border-t-[color:var(--color-primary)] animate-spin" />
        <p className="text-xs text-text-secondary">Carregando visualização…</p>
      </div>
    </div>
  );
}

/**
 * Sempre 3D. Cai pro SVG 2D só quando o 3D não abre (sem WebGL, ou se a cena
 * quebrar), com um aviso dizendo o motivo. O `Car3D` já cuida das otimizações
 * mobile internamente (DPR 1, sem spotLight, dispose de VRAM).
 */
export function Car3DLazy(props: ComponentProps<typeof Car3D>) {
  const [webgl, setWebgl] = useState<WebGLProbe | null>(null);

  useEffect(() => {
    setWebgl(probeWebGL());
  }, []);

  if (webgl === null) return <LoadingPlaceholder />;

  // 2D: só como fallback quando o 3D não abre.
  function svgView(notice: ReactNode) {
    const highlighted: CarPart[] = Array.from(
      new Set<CarPart>([
        ...(props.selectedParts ?? []),
        ...(props.damagedParts ?? []),
        ...(props.activePart ? [props.activePart] : []),
      ]),
    );
    return (
      <div className={`${VIEWER_BOX} rounded-2xl overflow-hidden bg-gradient-to-b from-[color:var(--color-surface)] to-[color:var(--color-surface-3)] flex items-center justify-center relative`}>
        <CarSvg
          selectedParts={highlighted}
          onSelectPart={props.onSelectPart}
          interactive={props.interactive ?? true}
        />
        {notice}
      </div>
    );
  }

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
            title="Não foi possível carregar o 3D. Mostrando a versão 2D."
            detail={message}
          />,
        )
      }
    >
      <Car3D {...props} />
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
      className="absolute inset-x-3 top-3 z-20 flex items-start gap-3 rounded-xl border border-[color:var(--color-border-strong)] bg-[color:var(--color-surface)]/95 px-3 py-2 backdrop-blur"
    >
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium text-[color:var(--color-text)]">{title}</p>
        <p className="truncate text-[10px] text-[color:var(--color-text)]/45" title={detail}>
          {detail}
        </p>
      </div>
      <button
        type="button"
        onClick={() => window.location.reload()}
        className="shrink-0 rounded-full bg-[color:var(--color-primary)] px-3 py-1 text-[11px] font-medium text-[color:var(--color-text)] hover:opacity-90"
      >
        Tentar de novo
      </button>
    </div>
  );
}
