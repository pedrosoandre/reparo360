"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import {
  Html,
  OrbitControls,
  ContactShadows,
  useGLTF,
} from "@react-three/drei";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { Plus, Minus, RotateCcw, Eye, EyeOff, Images, Palette } from "lucide-react";
import type { CarPart } from "@/types";
import { PART_LABELS } from "@/lib/car-parts";
import { VEHICLE_CATALOG } from "@/lib/vehicles";
import { paintTargetFor, PAINT_COLORS } from "@/lib/car-paint";
import { measureCarBox } from "@/lib/car-bbox";
import { createCarOpenings, setCarOpeningProgress, supportsCarOpenings } from "@/lib/car-openings";
import {
  SCENERY_CATALOG,
  DEFAULT_SCENERY_ID,
  getScenery,
} from "@/lib/scenery";
import { assetUrl } from "@/lib/assets";

const GOLD = "#F5A524";
const GOLD_GLOW = "#FBBF24";
const DANGER = "#EF4444";
const NEUTRAL = "#64748B";
const PRIMARY = "#4F6BFF";
const CAR_URL = assetUrl(`/cars/${VEHICLE_CATALOG[0].glb}`);

interface Hotspot3D {
  id: CarPart;
  /**
   * Posição em ratios da bounding box do modelo:
   *   x: -1 = traseira, +1 = frente
   *   y: 0 = chão, 1 = teto (altura total)
   *   z: -1 = lateral esquerda, +1 = lateral direita
   * Ratios funcionam pra qualquer GLB do catálogo sem re-tunar.
   */
  ratio: [number, number, number];
}

const HOTSPOTS: Hotspot3D[] = [
  { id: "front_bumper", ratio: [0.98, 0.25, 0] },
  { id: "hood", ratio: [0.64, 0.51, 0] },
  { id: "grille", ratio: [0.98, 0.36, 0.15] },
  { id: "headlight_left", ratio: [0.90, 0.43, -0.75] },
  { id: "headlight_right", ratio: [0.90, 0.43, 0.75] },
  { id: "fender_left", ratio: [0.67, 0.39, -0.95] },
  { id: "fender_right", ratio: [0.67, 0.39, 0.95] },
  { id: "mirror_left", ratio: [0.26, 0.71, -1.0] },
  { id: "mirror_right", ratio: [0.26, 0.71, 1.0] },
  { id: "door_front_left", ratio: [0.07, 0.50, -1.0] },
  { id: "door_front_right", ratio: [0.07, 0.50, 1.0] },
  { id: "door_rear_left", ratio: [-0.35, 0.50, -1.0] },
  { id: "door_rear_right", ratio: [-0.35, 0.50, 1.0] },
  { id: "roof", ratio: [-0.10, 0.89, 0] },
  { id: "trunk", ratio: [-0.74, 0.64, 0] },
  { id: "rear_bumper", ratio: [-0.95, 0.29, 0] },
  { id: "taillight_left", ratio: [-0.93, 0.50, -0.7] },
  { id: "taillight_right", ratio: [-0.93, 0.50, 0.7] },
  { id: "wheel_fl", ratio: [0.62, 0.25, -1.0] },
  { id: "wheel_fr", ratio: [0.62, 0.25, 1.0] },
  { id: "wheel_rl", ratio: [-0.62, 0.25, -1.0] },
  { id: "wheel_rr", ratio: [-0.62, 0.25, 1.0] },
];

interface CarDims {
  length: number;
  height: number;
  width: number;
}

const DEFAULT_DIMS: CarDims = { length: 4.2, height: 1.4, width: 2.0 };


function hotspotWorldPosition(h: Hotspot3D, dims: CarDims): [number, number, number] {
  return [
    h.ratio[0] * (dims.length / 2),
    h.ratio[1] * dims.height,
    h.ratio[2] * (dims.width / 2),
  ];
}

interface FocusSignal {
  part: CarPart;
  nonce: number;
}

interface Car3DProps {
  selectedParts?: CarPart[];
  damagedParts?: CarPart[];
  activePart?: CarPart | null;
  focusSignal?: FocusSignal | null;
  onSelectPart?: (part: CarPart) => void;
  interactive?: boolean;
  autoRotate?: boolean;
  showHotspots?: boolean;
  /** null = mantém a cor original do modelo */
  bodyColor?: string | null;
  /**
   * Se passado, o viewer renderiza um botão de paleta (canto inferior esquerdo,
   * ao lado do botão de cenário) que abre a lista de PAINT_COLORS. Sem esse
   * callback o botão some — usado em telas read-only (apresentação, resumo).
   */
  onBodyColorChange?: (hex: string | null) => void;
  modelUrl?: string;
  /**
   * Id do cenário do catálogo `lib/scenery.ts`. Se passado, o viewer usa esse
   * HDRI e o seletor interno fica sincronizado com este valor (modo controlado
   * se `onSceneryChange` for fornecido).
   */
  sceneryId?: string;
  onSceneryChange?: (id: string) => void;
}

export function Car3D({
  selectedParts = [],
  damagedParts = [],
  activePart = null,
  focusSignal = null,
  onSelectPart,
  interactive = true,
  autoRotate = true,
  showHotspots = true,
  bodyColor = null,
  onBodyColorChange,
  modelUrl = CAR_URL,
  sceneryId,
  onSceneryChange,
}: Car3DProps) {
  const [dims, setDims] = useState<CarDims>(DEFAULT_DIMS);
  // Idempotente: se as dims medidas são iguais às atuais, NÃO cria state novo.
  // Sem isso, o CarModel passa um objeto novo a cada medida e o React re-renderiza
  // em loop (setDims sempre acha que state mudou), o que trava a UI thread quando
  // combinado com outras mudanças (troca de cor). Ver [[car3d-onmeasured-loop]].
  const handleMeasured = useCallback((d: CarDims) => {
    setDims((prev) =>
      prev.length === d.length && prev.height === d.height && prev.width === d.width
        ? prev
        : d,
    );
  }, []);
  const controlsRef = useRef<any>(null);
  const initialCamPos = useRef<THREE.Vector3 | null>(null);
  const initialTarget = useRef<THREE.Vector3 | null>(null);
  // Ponte pra chamar `invalidate()` a partir de handlers fora do Canvas
  // (botões +/- e reset). Necessária no frameloop="demand" do mobile —
  // sem isso, mexer no zoom não repinta.
  const invalidateRef = useRef<() => void>(() => {});
  const [userActive, setUserActive] = useState(false);
  const [focusing, setFocusing] = useState(false);
  const [markersHidden, setMarkersHidden] = useState(false);
  const [openingsOpen, setOpeningsOpen] = useState(false);
  const [openingsReady, setOpeningsReady] = useState(false);
  const [sceneryState, setSceneryState] = useState<string>(
    sceneryId ?? DEFAULT_SCENERY_ID,
  );
  const [openPicker, setOpenPicker] = useState<"scenery" | "color" | null>(null);
  useEffect(() => {
    if (sceneryId) setSceneryState(sceneryId);
  }, [sceneryId]);
  const scenery = useMemo(() => getScenery(sceneryState), [sceneryState]);
  function selectScenery(id: string) {
    setSceneryState(id);
    onSceneryChange?.(id);
  }
  const resumeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Marcadores efetivos: prop `showHotspots` respeita, mas o botão do
  // usuário sobrescreve pra "modo cliente" (carro limpo, sem bolinhas).
  const showMarkers = showHotspots && !markersHidden && !openingsOpen;

  // Orientação: catálogo define flipFront; a tecla F alterna em runtime
  // pra facilitar a calibração de modelos novos.
  const glbFile = modelUrl.split("/").pop() ?? "";
  useEffect(() => {
    setOpeningsOpen(false);
    setOpeningsReady(false);
  }, [modelUrl]);
  const catalogEntry = useMemo(
    () => VEHICLE_CATALOG.find((v) => v.glb === glbFile),
    [glbFile],
  );
  const paintTarget = useMemo(() => paintTargetFor(glbFile), [glbFile]);
  const catalogFlip = catalogEntry?.flipFront ?? false;
  const [runtimeFlip, setRuntimeFlip] = useState(false);
  useEffect(() => setRuntimeFlip(false), [glbFile]);
  const effectiveFlip = catalogFlip !== runtimeFlip;

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== "f" && e.key !== "F") return;
      const target = e.target as HTMLElement | null;
      if (target && /INPUT|TEXTAREA/.test(target.tagName)) return;
      setRuntimeFlip((prev) => {
        const next = !prev;
        const finalFlip = catalogFlip !== next;
        // eslint-disable-next-line no-console
        console.log(
          `[hotspot-calibration] "${glbFile}" — cole no VEHICLE_CATALOG: flipFront: ${finalFlip}`,
        );
        return next;
      });
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [glbFile, catalogFlip]);

  useEffect(() => {
    const controls = controlsRef.current;
    if (!controls) return;

    if (!initialCamPos.current) {
      initialCamPos.current = controls.object.position.clone();
      initialTarget.current = controls.target.clone();
    }

    const onStart = () => {
      setUserActive(true);
      if (resumeTimer.current) clearTimeout(resumeTimer.current);
    };
    const onEnd = () => {
      resumeTimer.current = setTimeout(() => setUserActive(false), 2500);
    };
    controls.addEventListener("start", onStart);
    controls.addEventListener("end", onEnd);
    return () => {
      controls.removeEventListener("start", onStart);
      controls.removeEventListener("end", onEnd);
      if (resumeTimer.current) clearTimeout(resumeTimer.current);
    };
  }, []);

  useEffect(() => {
    if (!focusSignal) return;
    setFocusing(true);
    const id = setTimeout(() => setFocusing(false), 700);
    return () => clearTimeout(id);
  }, [focusSignal?.nonce]);

  function zoomBy(factor: number) {
    const controls = controlsRef.current;
    if (!controls) return;
    const camera = controls.object as THREE.PerspectiveCamera;
    const target = controls.target as THREE.Vector3;
    const dir = camera.position.clone().sub(target).multiplyScalar(factor);
    camera.position.copy(target).add(dir);
    controls.update();
    invalidateRef.current();
  }

  function resetView() {
    const controls = controlsRef.current;
    if (!controls || !initialCamPos.current || !initialTarget.current) return;
    controls.object.position.copy(initialCamPos.current);
    controls.target.copy(initialTarget.current);
    controls.update();
    invalidateRef.current();
  }

  // Detecta dispositivo "leve" pra baixar o custo de render. Antes checava só
  // `max-width: 767px`, o que deixava iPhone Plus e iPad em landscape rodando
  // no mesmo modo pesado do desktop. `pointer: coarse` pega qualquer touch
  // primário, e `hardwareConcurrency <= 4` cobre laptops fracos.
  //
  // CRÍTICO: calcular UMA VEZ no mount e congelar. Se reavaliar a cada render,
  // abrir o DevTools (que encolhe a viewport <900px) muda `isLightDevice` de
  // false pra true, o que altera `frameloop` do Canvas em runtime — cenário
  // que o r3f não suporta e trava a UI thread inteira.
  const [isLightDevice] = useState(() => {
    if (typeof window === "undefined") return false;
    return (
      window.matchMedia("(pointer: coarse)").matches ||
      window.matchMedia("(max-width: 900px)").matches ||
      (typeof navigator !== "undefined" && (navigator.hardwareConcurrency ?? 8) <= 4)
    );
  });

  // Rotação sempre ligada (inclusive mobile). O frameloop="always" resultante
  // custa CPU/GPU no celular — se voltar a travar cliques (troca de cor,
  // seleção de peça), reintroduzir o gate `&& !isLightDevice` aqui.
  const effectiveAutoRotate = autoRotate;

  // Objetos/arrays passados pro Canvas precisam ser referência ESTÁVEL — se
  // mudarem a cada render, o r3f pode re-instanciar internals (camera, GL,
  // frameloop) e a UI thread trava. Congelar em useMemo no mount.
  const canvasDpr = useMemo<[number, number]>(
    () => (isLightDevice ? [1, 1] : [1, 1.5]),
    [isLightDevice],
  );
  const canvasCamera = useMemo(
    () => ({ position: [3.6, 1.9, 4.4] as [number, number, number], fov: 30 }),
    [],
  );
  const canvasGl = useMemo(
    () => ({ antialias: true, toneMapping: THREE.ACESFilmicToneMapping }),
    [],
  );
  const orbitTarget = useMemo<[number, number, number]>(() => [0, 0.7, 0], []);
  const groupPosition = useMemo<[number, number, number]>(
    () => [0, scenery.floorY, 0],
    [scenery.floorY],
  );
  const shadowsPosition = useMemo<[number, number, number]>(
    () => [0, scenery.floorY + 0.002, 0],
    [scenery.floorY],
  );

  return (
    <div className="w-full aspect-[16/8] max-h-[38vh] min-h-[220px] relative">
      <Canvas
        // Sombras dinâmicas dropadas em tudo — a `ContactShadows` bakada dá o
        // "chão" visual e não custa por frame. Real-time shadow map do
        // directionalLight era o maior custo de fragment shader.
        shadows={false}
        // DPR 1 no mobile — o [1, 1.5] com devicePixelRatio=3 do iPhone
        // renderizava a até 4.5x pixels e sozinho já saturava GPU.
        dpr={canvasDpr}
        // "always" quando esta instância pediu autoRotate (senão o
        // OrbitControls autoRotate não tica). Trocar `frameloop` em runtime
        // não reinicia o loop do drei — precisa ser estático por instância.
        frameloop={effectiveAutoRotate ? "always" : "demand"}
        camera={canvasCamera}
        gl={canvasGl}
      >
        {/*
          Cenário = modelo 3D (.glb) do Sketchfab servido de `public/scenery/`.
          Já tem paredes/teto/piso/iluminação embutida. Substitui o HDRI-como-
          fundo (que dava sensação de "carro flutuando na foto") e o env-map
          HDRI (6.5MB + ~16MB de VRAM) — luzes diretas com intensidade maior
          compensam o reflexo sem baixar o arquivo pesado.
          Catálogo em `lib/scenery.ts`.
        */}

        <ambientLight intensity={0.55} />
        <directionalLight position={[5, 8, 5]} intensity={1.4} />
        <directionalLight position={[-5, 4, -3]} intensity={0.55} color="#60A5FA" />
        {!isLightDevice && (
          <spotLight position={[0, 6, 0]} angle={0.5} penumbra={1} intensity={0.7} color="#93C5FD" />
        )}

        <Suspense fallback={<LoadingBox />}>
          <color attach="background" args={["#05060A"]} />

          <SceneryScene id={scenery.id} />

          <group position={groupPosition}>
            <CarModel
              key={`${modelUrl}-${effectiveFlip}`}
              url={modelUrl}
              bodyColor={bodyColor}
              flipFront={effectiveFlip}
              onMeasured={handleMeasured}
              openingsOpen={openingsOpen}
              onOpeningsReady={setOpeningsReady}
            />

            {showMarkers &&
              selectedParts.map((p) => (
                <DamagePatch key={p} part={p} dims={dims} />
              ))}

            {showMarkers && (
              <Hotspots
                dims={dims}
                damagedParts={damagedParts}
                activePart={activePart}
                onSelect={onSelectPart}
                interactive={interactive}
              />
            )}
          </group>

          <ContactShadows
            position={shadowsPosition}
            opacity={0.55}
            scale={14}
            blur={3}
            far={4}
            color="#000000"
            // Bake da sombra em 1 frame só — o carro não se move, então
            // recalcular a cada frame é desperdício, ainda mais no mobile.
            frames={1}
          />

          <FocusRig signal={focusSignal} dims={dims} controlsRef={controlsRef} />
          <InvalidateBridge invalidateRef={invalidateRef} />
        </Suspense>

        <OrbitControls
          ref={controlsRef}
          enablePan={false}
          enableZoom={interactive}
          enableRotate={interactive}
          // Gira devagar quando o usuário não está mexendo; pausa enquanto
          // interage. Custa um frameloop "always" enquanto girando — desligado
          // no mobile pra não travar a UI thread.
          autoRotate={effectiveAutoRotate && !userActive && !openingsOpen}
          autoRotateSpeed={0.6}
          minPolarAngle={Math.PI / 4}
          maxPolarAngle={Math.PI / 2.1}
          minDistance={4}
          maxDistance={6.5}
          target={orbitTarget}
        />
      </Canvas>

      {interactive && (
        <div className="absolute top-3 left-3 right-14 z-10 flex flex-col items-start gap-1">
          <button
            type="button"
            disabled={!openingsReady}
            aria-pressed={openingsOpen}
            onClick={() => setOpeningsOpen((value) => !value)}
            className="min-h-10 rounded-xl border border-white/20 bg-black/70 px-3 py-2 text-xs font-medium text-white backdrop-blur hover:bg-black/90 disabled:cursor-not-allowed disabled:text-white/50"
          >
            {openingsOpen ? "Fechar portas e porta-malas" : "Abrir portas e porta-malas"}
          </button>
          {!supportsCarOpenings(glbFile) && (
            <span className="max-w-64 rounded bg-black/70 px-2 py-1 text-[10px] text-white/70">
              Modelo sem articulação configurada. Disponível no Polo, Gol e Supra MK4.
            </span>
          )}
        </div>
      )}

      {interactive && (
        <div className="absolute bottom-3 left-3 z-10 flex flex-col-reverse items-start gap-1.5">
          <div className="flex flex-col gap-1.5">
            <ZoomBtn
              onClick={() =>
                setOpenPicker((v) => (v === "scenery" ? null : "scenery"))
              }
              label="Alterar cenário"
            >
              <Images size={13} />
            </ZoomBtn>
            {onBodyColorChange && paintTarget && (
              <ZoomBtn
                onClick={() =>
                  setOpenPicker((v) => (v === "color" ? null : "color"))
                }
                label="Alterar cor do veículo"
              >
                <Palette size={13} />
              </ZoomBtn>
            )}
          </div>
          {openPicker === "scenery" && (
            <div
              className="mb-1 max-h-64 overflow-y-auto rounded-lg bg-black/70 backdrop-blur border border-white/[0.12] p-1.5 flex flex-col gap-0.5 min-w-[170px]"
              role="listbox"
              aria-label="Cenário"
            >
              {SCENERY_CATALOG.map((s) => {
                const active = s.id === sceneryState;
                return (
                  <button
                    key={s.id}
                    role="option"
                    aria-selected={active}
                    onClick={() => {
                      selectScenery(s.id);
                      setOpenPicker(null);
                    }}
                    className={
                      "text-left px-2 py-1 rounded text-xs transition-colors " +
                      (active
                        ? "bg-blue-500/25 text-white"
                        : "text-white/75 hover:bg-white/10 hover:text-white")
                    }
                  >
                    {s.label}
                  </button>
                );
              })}
            </div>
          )}
          {openPicker === "color" && onBodyColorChange && paintTarget && (
            <div
              className="mb-1 rounded-lg bg-black/70 backdrop-blur border border-white/[0.12] p-1.5 min-w-[170px]"
              role="listbox"
              aria-label="Cor do veículo"
            >
              <div className="grid grid-cols-5 gap-1.5">
                {PAINT_COLORS.map((c) => {
                  const active = bodyColor === c.hex;
                  return (
                    <button
                      key={c.name}
                      role="option"
                      aria-selected={active}
                      onClick={() => {
                        onBodyColorChange(c.hex);
                        setOpenPicker(null);
                      }}
                      title={c.name}
                      aria-label={c.name}
                      className={
                        "w-7 h-7 rounded-full border transition-all flex items-center justify-center " +
                        (active
                          ? "border-white ring-2 ring-white/60 scale-110"
                          : "border-white/25 hover:border-white/60")
                      }
                      style={c.hex ? { backgroundColor: c.hex } : undefined}
                    >
                      {!c.hex && (
                        <RotateCcw size={11} className="text-white/70" />
                      )}
                    </button>
                  );
                })}
              </div>
              {paintTarget?.textured && bodyColor && (
                <p className="mt-1.5 text-[10px] text-white/50 leading-tight">
                  este modelo tem textura própria — a cor tinge o original
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {interactive && (
        <div className="absolute bottom-3 right-3 z-10 flex flex-col gap-1.5">
          {showHotspots && (
            <ZoomBtn
              onClick={() => setMarkersHidden((v) => !v)}
              label={markersHidden ? "Mostrar marcadores das peças" : "Ocultar marcadores das peças"}
            >
              {markersHidden ? <EyeOff size={13} /> : <Eye size={13} />}
            </ZoomBtn>
          )}
          <ZoomBtn onClick={() => zoomBy(0.82)} label="Aproximar">
            <Plus size={14} />
          </ZoomBtn>
          <ZoomBtn onClick={() => zoomBy(1.22)} label="Afastar">
            <Minus size={14} />
          </ZoomBtn>
          <ZoomBtn onClick={resetView} label="Recentralizar">
            <RotateCcw size={13} />
          </ZoomBtn>
        </div>
      )}
    </div>
  );
}

function ZoomBtn({
  children,
  onClick,
  label,
}: {
  children: React.ReactNode;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      className="w-8 h-8 rounded-full bg-black/50 backdrop-blur border border-white/[0.12] text-white/80 hover:text-white hover:bg-black/70 transition-colors flex items-center justify-center"
    >
      {children}
    </button>
  );
}

function CarModel({
  url,
  bodyColor,
  flipFront,
  onMeasured,
  openingsOpen,
  onOpeningsReady,
}: {
  url: string;
  bodyColor: string | null;
  flipFront: boolean;
  onMeasured?: (dims: CarDims) => void;
  openingsOpen: boolean;
  onOpeningsReady: (ready: boolean) => void;
}) {
  const { scene } = useGLTF(url);
  const invalidate = useThree((s) => s.invalidate);

  // Quais materiais deste arquivo são a pintura da lataria (ver lib/car-paint.ts)
  const paintNames = useMemo(() => {
    const glb = url.split("/").pop() ?? "";
    return new Set(paintTargetFor(glb)?.materials ?? []);
  }, [url]);

  // scene.clone() compartilha materiais com o cache do useGLTF; clonamos os
  // materiais para que recolorir não contamine outros modelos.
  const cloned = useMemo(() => {
    const copy = scene.clone(true);
    copy.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (!mesh.isMesh) return;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      const clone = (m: THREE.Material) => {
        const c = m.clone();
        const std = c as THREE.MeshStandardMaterial;
        if (std.color) c.userData.originalColor = std.color.clone();
        return c;
      };
      mesh.material = Array.isArray(mesh.material)
        ? mesh.material.map(clone)
        : clone(mesh.material);
    });
    return copy;
  }, [scene]);

  // Setup one-shot: vidro + PBR da pintura. Aplicar metalness/roughness/
  // envMapIntensity nas materials de pintura na PRIMEIRA vez força o three.js
  // a recompilar o shader daquela material (700ms+ no desktop, 5s no mobile).
  // Fazer aqui, no clone, move esse custo pro loading — depois a troca de cor
  // só muda o uniform `color` e é instantânea.
  useEffect(() => {
    cloned.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (!mesh.isMesh) return;
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      for (const m of mats) {
        const std = m as THREE.MeshStandardMaterial;
        if (!std.name) continue;
        if (/glass|vidro|window/i.test(std.name)) {
          std.transparent = true;
          std.opacity = 0.25;
          std.metalness = 0.5;
          std.roughness = 0.05;
        }
        if (paintNames.has(std.name)) {
          std.metalness = 0.7;
          std.roughness = 0.35;
          std.envMapIntensity = 1.3;
        }
      }
    });
  }, [cloned, paintNames]);

  // Troca de cor: SOMENTE atualiza o uniform .color. metalness/roughness já
  // estão setados desde o clone (acima), então esse effect não força
  // recompile do shader e roda em <5ms mesmo no mobile.
  useEffect(() => {
    cloned.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (!mesh.isMesh) return;
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      for (const m of mats) {
        const std = m as THREE.MeshStandardMaterial;
        if (!std.name || !paintNames.has(std.name)) continue;
        if (bodyColor) {
          std.color.set(bodyColor);
        } else if (m.userData.originalColor) {
          std.color.copy(m.userData.originalColor);
        }
      }
    });
    // Força um redraw depois de aplicar cor — no frameloop="demand" do mobile,
    // sem isso a nova cor só aparece na próxima interação.
    invalidate();
  }, [cloned, bodyColor, paintNames, invalidate]);

  // Orientação normalizada: gira 90° se o carro estiver deitado no eixo Z, e
  // 180° adicionais quando o catálogo marcar `flipFront` (frente virada pra -X).
  // Ambas rotações são aplicadas direto no `cloned` antes de medir a bbox — assim
  // as dims reportadas e o centro já refletem a orientação final.
  //
  // BBox ancorada na lataria (ver lib/car-bbox.ts): vários GLBs trazem
  // geometria que não é o carro — 23 pneus de um Honda Civic no hyundai-hb20,
  // uma quadra de basquete no porsche-court-test — e como `scale` é 4.2/size.x
  // esse lixo encolhia o carro visível pra caber num volume fantasma.
  const { size, center, boxMinY, scale } = useMemo(() => {
    cloned.rotation.set(0, 0, 0);
    cloned.updateMatrixWorld(true);
    const rawSize = measureCarBox(cloned, paintNames).getSize(new THREE.Vector3());
    const auto = rawSize.z > rawSize.x ? Math.PI / 2 : 0;
    cloned.rotation.y = auto + (flipFront ? Math.PI : 0);
    cloned.updateMatrixWorld(true);
    const box = measureCarBox(cloned, paintNames);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    return { size, center, boxMinY: box.min.y, scale: 4.2 / size.x };
  }, [cloned, flipFront, paintNames]);

  useEffect(() => {
    onMeasured?.({
      length: size.x * scale,
      height: size.y * scale,
      width: size.z * scale,
    });
  }, [size.x, size.y, size.z, scale, onMeasured]);

  const rig = useMemo(() => createCarOpenings(cloned, url.split("/").pop() ?? ""), [cloned, url]);
  const openingProgress = useRef(0);
  useEffect(() => { onOpeningsReady(rig.ready); }, [rig, onOpeningsReady]);
  useEffect(() => { invalidate(); }, [openingsOpen, invalidate]);
  useFrame((_, delta) => {
    const target = openingsOpen ? 1 : 0;
    const previous = openingProgress.current;
    if (previous === target) return;
    const step = delta / 0.8;
    openingProgress.current = target > previous
      ? Math.min(target, previous + step)
      : Math.max(target, previous - step);
    setCarOpeningProgress(rig.openings, openingProgress.current);
    invalidate();
  });

  // Ao trocar de carro, libera a VRAM do modelo anterior. useGLTF mantém um
  // cache global (module-level) que nunca esvazia — sem isso, cada swap
  // acumula texturas/geometrias na GPU até o navegador travar. useGLTF.clear
  // roda dispose() nos recursos do glTF original; nossos clones de material
  // já são descartados quando o React desmonta o cloned via useMemo.
  useEffect(() => {
    const oldUrl = url;
    return () => {
      (useGLTF as unknown as { clear: (u: string) => void }).clear(oldUrl);
    };
  }, [url]);

  return (
    <group
      position={[-center.x * scale, -boxMinY * scale, -center.z * scale]}
      scale={scale}
    >
      <primitive object={rig.root} />
    </group>
  );
}

/**
 * Carrega o modelo 3D do cenário (garagem/interior) escolhido no catálogo.
 * O modelo é assumido como já centralizado horizontalmente e com piso em
 * y=0 no arquivo — se não estiver, ajustar `floorY` da entrada em
 * `SCENERY_CATALOG` compensa em runtime (o CarModel sobe pra igualar).
 * Os meshes do cenário não bloqueiam raycast — só o carro é clicável.
 */
function SceneryScene({ id }: { id: string }) {
  const scenery = getScenery(id);
  const url = assetUrl(scenery.file);
  const { scene } = useGLTF(url);
  const prepared = useMemo(() => {
    const copy = scene.clone(true);
    if (scenery.scale && scenery.scale !== 1) {
      copy.scale.setScalar(scenery.scale);
    }
    copy.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (!mesh.isMesh) return;
      mesh.castShadow = false;
      mesh.receiveShadow = true;
      mesh.raycast = () => null;
    });
    return copy;
  }, [scene, scenery.scale]);
  // Mesma lógica do CarModel: libera VRAM do cenário anterior. Sem isso,
  // alternar cenários (brutalist 3MB → parking 10MB → garage 6MB) acumula
  // texturas/geometrias e o Safari iOS recarrega a aba após ~3-4 trocas.
  useEffect(() => {
    const oldUrl = url;
    return () => {
      (useGLTF as unknown as { clear: (u: string) => void }).clear(oldUrl);
    };
  }, [url]);
  return <primitive object={prepared} />;
}
// Não preloadamos todos os cenários — os 3 juntos são ~19MB. useGLTF carrega
// on-demand quando o usuário trocar via o seletor. Só o cenário default sobe
// no primeiro render (via <SceneryScene id={default}>).

/**
 * Expõe `invalidate` do r3f pra callers fora do Canvas via ref. Só existe
 * pra suportar frameloop="demand" (mobile) sem quebrar handlers de UI.
 */
function InvalidateBridge({
  invalidateRef,
}: {
  invalidateRef: React.MutableRefObject<() => void>;
}) {
  const invalidate = useThree((s) => s.invalidate);
  useEffect(() => {
    invalidateRef.current = invalidate;
  }, [invalidate, invalidateRef]);
  return null;
}

function LoadingBox() {
  return (
    <Html center>
      <div className="flex flex-col items-center gap-2 pointer-events-none">
        <div className="w-8 h-8 rounded-full border-2 border-blue-500/40 border-t-blue-500 animate-spin" />
        <p className="text-xs text-slate-400">Carregando modelo…</p>
      </div>
    </Html>
  );
}

function DamagePatch({ part, dims }: { part: CarPart; dims: CarDims }) {
  // Pulsação removida: forçava invalidate() por frame e anulava o
  // frameloop="demand". O emissive da esfera dourada já chama atenção
  // suficiente sem animar.
  const hotspot = HOTSPOTS.find((h) => h.id === part);
  if (!hotspot) return null;
  return (
    <mesh position={hotspotWorldPosition(hotspot, dims)}>
      <sphereGeometry args={[0.32, 24, 24]} />
      <meshStandardMaterial
        color={GOLD}
        emissive={GOLD_GLOW}
        emissiveIntensity={1.1}
        transparent
        opacity={0.4}
        metalness={0.2}
        roughness={0.4}
      />
    </mesh>
  );
}

function Hotspots({
  dims,
  damagedParts,
  activePart,
  onSelect,
  interactive,
}: {
  dims: CarDims;
  damagedParts: CarPart[];
  activePart: CarPart | null;
  onSelect?: (p: CarPart) => void;
  interactive: boolean;
}) {
  return (
    <>
      {HOTSPOTS.map((h) => (
        <Hotspot
          key={h.id}
          hotspot={h}
          dims={dims}
          isDamaged={damagedParts.includes(h.id)}
          isActive={activePart === h.id}
          interactive={interactive}
          onClick={() => onSelect?.(h.id)}
        />
      ))}
    </>
  );
}

function Hotspot({
  hotspot,
  dims,
  isDamaged,
  isActive,
  interactive,
  onClick,
}: {
  hotspot: Hotspot3D;
  dims: CarDims;
  isDamaged: boolean;
  isActive: boolean;
  interactive: boolean;
  onClick: () => void;
}) {
  const [hover, setHover] = useState(false);
  const baseColor = isDamaged ? DANGER : NEUTRAL;
  const ringColor = isActive ? PRIMARY : baseColor;
  const scale = isActive ? 1.4 : hover ? 1.15 : 1;
  const pos = hotspotWorldPosition(hotspot, dims);

  return (
    <group position={pos}>
      {/* Alvo de clique maior, opticamente invisível (opacity 0 não afeta raycast) */}
      <mesh
        onClick={(e) => {
          e.stopPropagation();
          if (interactive) onClick();
        }}
        onPointerOver={(e) => {
          e.stopPropagation();
          if (interactive) {
            setHover(true);
            document.body.style.cursor = "pointer";
          }
        }}
        onPointerOut={() => {
          setHover(false);
          document.body.style.cursor = "auto";
        }}
      >
        <sphereGeometry args={[0.26, 12, 12]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>

      <mesh scale={scale}>
        <sphereGeometry args={[0.075, 16, 16]} />
        <meshBasicMaterial color={baseColor} />
      </mesh>
      <mesh scale={scale}>
        <ringGeometry args={[0.12, 0.16, 24]} />
        <meshBasicMaterial color={ringColor} transparent opacity={isActive ? 0.9 : 0.45} side={THREE.DoubleSide} />
      </mesh>
      {isDamaged && !isActive && (
        <mesh>
          <sphereGeometry args={[0.1, 16, 16]} />
          <meshBasicMaterial color={baseColor} transparent opacity={0.3} />
        </mesh>
      )}

      {(hover || isActive) && (
        <Html position={[0, 0.18, 0]} center>
          <div
            className="pointer-events-none whitespace-nowrap rounded bg-black/70 backdrop-blur-sm border border-white/[0.08] text-white/90 font-medium tracking-tight"
            style={{ fontSize: "11px", padding: "3px 7px", lineHeight: 1.2 }}
          >
            {PART_LABELS[hotspot.id]}
          </div>
        </Html>
      )}
    </group>
  );
}

function FocusRig({
  signal,
  dims,
  controlsRef,
}: {
  signal: FocusSignal | null | undefined;
  dims: CarDims;
  controlsRef: React.RefObject<any>;
}) {
  const active = useRef(false);
  const t0 = useRef(0);
  const from = useRef(new THREE.Vector3());
  const fromTarget = useRef(new THREE.Vector3());
  const to = useRef(new THREE.Vector3());
  const invalidate = useThree((s) => s.invalidate);

  useEffect(() => {
    if (!signal || !controlsRef.current) return;
    const hotspot = HOTSPOTS.find((h) => h.id === signal.part);
    if (!hotspot) return;
    const controls = controlsRef.current;
    from.current.copy(controls.object.position);
    fromTarget.current.copy(controls.target);
    to.current.set(...hotspotWorldPosition(hotspot, dims));
    t0.current = performance.now();
    active.current = true;
    invalidate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signal?.nonce]);

  useFrame(() => {
    if (!active.current || !controlsRef.current) return;
    invalidate();
    const controls = controlsRef.current;
    const camera = controls.object as THREE.PerspectiveCamera;
    const t = Math.min(1, (performance.now() - t0.current) / 650);
    const ease = 1 - Math.pow(1 - t, 3);

    const dir = from.current.clone().sub(fromTarget.current);
    const distance = THREE.MathUtils.clamp(dir.length(), 5, 9);
    dir.normalize().multiplyScalar(distance);
    const desiredCamPos = to.current.clone().add(dir);

    camera.position.lerpVectors(from.current, desiredCamPos, ease);
    controls.target.lerpVectors(fromTarget.current, to.current, ease);
    controls.update();

    if (t >= 1) active.current = false;
  });

  return null;
}

