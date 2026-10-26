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
import { Plus, Minus, RotateCcw, Eye, EyeOff, Images, Palette, Pause, Play, Wrench } from "lucide-react";
import type { CarPart } from "@/types";
import { PART_LABELS } from "@/lib/car-parts";
import { VEHICLE_CATALOG } from "@/lib/vehicles";
import { paintTargetFor, PAINT_COLORS } from "@/lib/car-paint";
import {
  SCENERY_CATALOG,
  DEFAULT_SCENERY_ID,
  getScenery,
} from "@/lib/scenery";
import { assetUrl } from "@/lib/assets";
import { VIEWER_BOX } from "./viewer-box";

/* Cores da identidade "Pit Lane" — os mesmos valores do arquivo de marca.
   Amarelo de bandeira marca a área selecionada, vermelho de largada marca o
   dano, e o neutro é a areia do asfalto, não um cinza-azulado. */
const GOLD = "#F2C230";
const GOLD_GLOW = "#F2C230";
const DANGER = "#C9241B";
const NEUTRAL = "#8C8A85";
const PRIMARY = "#141414";
const CAR_URL = assetUrl(`/cars/${VEHICLE_CATALOG[0].glb}`);

const CAMERA_START: [number, number, number] = [3.6, 1.9, 4.4];
/**
 * FOV vertical calibrado no card largo do desktop (16:8). Em cards mais
 * estreitos o FOV abre pra manter a mesma largura enquadrada — com FOV fixo,
 * o carro estourava as bordas no celular. Ver <ResponsiveFov>.
 */
const BASE_FOV = 30;
const BASE_ASPECT = 2;
/**
 * No card 4:3 do celular as colunas de botões das laterais cobrem ~30% da
 * largura (contra ~15% no desktop); lá o enquadramento fica 15% mais largo pro
 * carro não passar embaixo delas ao girar. Entre 16:8 e 4:3 a folga cresce aos
 * poucos, sem salto.
 */
const NARROW_ASPECT = 4 / 3;
const NARROW_EXTRA_WIDTH = 1.15;
const ORBIT_TARGET: [number, number, number] = [0, 0.7, 0];
const ORBIT_CENTER = new THREE.Vector3(...ORBIT_TARGET);
/** Segundos por volta do giro automático (~15°/s — dá pra ver girando). */
const TURNTABLE_SECONDS = 24;
/**
 * Capô que abre: o .glb traz o capô num nó "capo_abre" com a origem na
 * dobradiça (preparado por carros/scratch/capo-prototipo/abrir-capo.mjs).
 * Girar em X negativo levanta a frente do capô.
 */
const HOOD_NODE = "capo_abre";
const HOOD_OPEN_ANGLE = THREE.MathUtils.degToRad(58);
/** Câmera ao abrir: um pouco à frente e acima do cofre, olhando pro motor. */
const HOOD_CAMERA_OFFSET = new THREE.Vector3(2.8, 2.3, 1.5);

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
  /**
   * Abre com os marcadores das peças escondidos (carro limpo); o botão de olho
   * mostra. Só faz sentido com `showHotspots`.
   */
  hotspotsStartHidden?: boolean;
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
  hotspotsStartHidden = false,
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
  // Ponte pra chamar `invalidate()` a partir de handlers fora do Canvas
  // (botões +/- e reset). Necessária no frameloop="demand" do mobile —
  // sem isso, mexer no zoom não repinta.
  const invalidateRef = useRef<() => void>(() => {});
  const [userActive, setUserActive] = useState(false);
  // Botão de pausar o giro. Quem pediu "menos movimento" no sistema
  // (prefers-reduced-motion) já começa parado e liga se quiser.
  const [spinPaused, setSpinPaused] = useState(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  const [focusing, setFocusing] = useState(false);
  const [markersHidden, setMarkersHidden] = useState(hotspotsStartHidden);
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
  const showMarkers = showHotspots && !markersHidden;

  // Orientação: catálogo define flipFront; a tecla F alterna em runtime
  // pra facilitar a calibração de modelos novos.
  const glbFile = modelUrl.split("/").pop() ?? "";
  const catalogEntry = useMemo(
    () => VEHICLE_CATALOG.find((v) => v.glb === glbFile),
    [glbFile],
  );
  const paintTarget = useMemo(() => paintTargetFor(glbFile), [glbFile]);
  const catalogFlip = catalogEntry?.flipFront ?? false;
  const [runtimeFlip, setRuntimeFlip] = useState(false);
  useEffect(() => setRuntimeFlip(false), [glbFile]);
  const effectiveFlip = catalogFlip !== runtimeFlip;

  // Capô: o botão só aparece quando o modelo carregado tem o nó "capo_abre".
  // `hoodNonce` dispara o movimento de câmera do <HoodRig> a cada clique.
  const [hoodAvailable, setHoodAvailable] = useState(false);
  const [hoodOpen, setHoodOpen] = useState(false);
  const [hoodNonce, setHoodNonce] = useState(0);
  useEffect(() => {
    setHoodOpen(false);
    setHoodAvailable(false);
  }, [glbFile]);
  function toggleHood() {
    setHoodOpen((v) => !v);
    setHoodNonce((n) => n + 1);
  }

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

  // Pausa o giro enquanto o usuário arrasta/dá zoom e retoma 2,5s depois.
  // Vai pelas props onStart/onEnd do OrbitControls: o controlsRef ainda é null
  // no mount (o r3f monta os filhos do Canvas depois), então pendurar listeners
  // num useEffect([]) nunca funcionava.
  const handleControlsStart = useCallback(() => {
    setUserActive(true);
    if (resumeTimer.current) clearTimeout(resumeTimer.current);
  }, []);
  const handleControlsEnd = useCallback(() => {
    resumeTimer.current = setTimeout(() => setUserActive(false), 2500);
  }, []);
  useEffect(
    () => () => {
      if (resumeTimer.current) clearTimeout(resumeTimer.current);
    },
    [],
  );

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
    if (!controls) return;
    controls.object.position.set(...CAMERA_START);
    controls.target.copy(ORBIT_CENTER);
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
  // Para enquanto há peça selecionada (o FocusRig mira a câmera na peça e o
  // giro tiraria ela de vista) e enquanto o capô está aberto.
  const spinning =
    effectiveAutoRotate && !userActive && !spinPaused && !activePart && !hoodOpen;

  // Objetos/arrays passados pro Canvas precisam ser referência ESTÁVEL — se
  // mudarem a cada render, o r3f pode re-instanciar internals (camera, GL,
  // frameloop) e a UI thread trava. Congelar em useMemo no mount.
  const canvasDpr = useMemo<[number, number]>(
    () => (isLightDevice ? [1, 1] : [1, 1.5]),
    [isLightDevice],
  );
  const canvasCamera = useMemo(() => ({ position: CAMERA_START, fov: BASE_FOV }), []);
  const canvasGl = useMemo(
    () => ({ antialias: true, toneMapping: THREE.ACESFilmicToneMapping }),
    [],
  );
  const groupPosition = useMemo<[number, number, number]>(
    () => [0, scenery.floorY, 0],
    [scenery.floorY],
  );
  const shadowsPosition = useMemo<[number, number, number]>(
    () => [0, scenery.floorY + 0.002, 0],
    [scenery.floorY],
  );

  return (
    <div className={`${VIEWER_BOX} relative`}>
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
          {/* Papel do viewer na identidade clara (--r360-viewer-bg). */}
          <color attach="background" args={["#E4E1D9"]} />

          <SceneryScene id={scenery.id} />

          <group position={groupPosition}>
            <CarModel
              url={modelUrl}
              bodyColor={bodyColor}
              flipFront={effectiveFlip}
              onMeasured={handleMeasured}
              hoodOpen={hoodOpen}
              onHoodAvailable={setHoodAvailable}
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
          <HoodRig open={hoodOpen} nonce={hoodNonce} dims={dims} controlsRef={controlsRef} />
          <InvalidateBridge invalidateRef={invalidateRef} />
        </Suspense>

        <Turntable controlsRef={controlsRef} spinning={spinning} />
        <ResponsiveFov />
        <OrbitControls
          ref={controlsRef}
          enablePan={false}
          enableZoom={interactive}
          enableRotate={interactive}
          // Gira sozinho quando ninguém está mexendo (velocidade no
          // <Turntable>). Custa um frameloop "always" nas instâncias com
          // autoRotate.
          autoRotate={spinning}
          onStart={handleControlsStart}
          onEnd={handleControlsEnd}
          minPolarAngle={Math.PI / 4}
          maxPolarAngle={Math.PI / 2.1}
          minDistance={4}
          maxDistance={6.5}
          target={ORBIT_TARGET}
        />
      </Canvas>

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
              className="mb-1 max-h-64 overflow-y-auto rounded-lg bg-[color:var(--color-surface)]/95 backdrop-blur border border-[color:var(--color-border-strong)] p-1.5 flex flex-col gap-0.5 min-w-[170px]"
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
                        ? "bg-blue-500/25 text-[color:var(--color-text)]"
                        : "text-[color:var(--color-text)]/75 hover:bg-[color:var(--color-surface-3)] hover:text-[color:var(--color-text)]")
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
              className="mb-1 rounded-lg bg-[color:var(--color-surface)]/95 backdrop-blur border border-[color:var(--color-border-strong)] p-1.5 min-w-[170px]"
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
                        <RotateCcw size={11} className="text-[color:var(--color-muted)]" />
                      )}
                    </button>
                  );
                })}
              </div>
              {paintTarget?.textured && bodyColor && (
                <p className="mt-1.5 text-[10px] text-[color:var(--color-muted)] leading-tight">
                  este modelo tem textura própria — a cor tinge o original
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Estado do giro, no canto de cima. No mockup é "• GIRANDO · 24s/volta":
          diz o que está acontecendo e a que ritmo, em vez de deixar o
          movimento sem explicação. */}
      {interactive && (
        <span
          className="absolute top-3 left-3 z-10 inline-flex items-center gap-2 bg-[color:var(--color-text)] px-2.5 py-1 text-meta uppercase tracking-[0.08em] text-[color:var(--color-bg)]"
          style={{ fontFamily: "var(--font-mono)" }}
        >
          <span
            aria-hidden
            className="inline-block h-1.5 w-1.5"
            style={{ background: spinning ? "var(--color-primary)" : "var(--color-muted)" }}
          />
          {spinning ? `Girando · ${TURNTABLE_SECONDS}s/volta` : "Parado"}
        </span>
      )}

      {interactive && hoodAvailable && (
        <button
          onClick={toggleHood}
          aria-pressed={hoodOpen}
          className="absolute bottom-3 left-1/2 -translate-x-1/2 z-10 h-9 px-4 bg-[color:var(--color-text)] text-[color:var(--color-bg)] hover:bg-black transition-colors text-label font-semibold uppercase tracking-[0.04em] flex items-center gap-1.5"
          style={{ fontFamily: "var(--font-display)", fontStyle: "italic" }}
        >
          <Wrench size={14} />
          {hoodOpen ? "Fechar capô" : "Abrir capô"}
        </button>
      )}

      {interactive && (
        <div className="absolute bottom-3 right-3 z-10 flex flex-col gap-1.5">
          {effectiveAutoRotate && (
            <ZoomBtn
              onClick={() => setSpinPaused((v) => !v)}
              label={spinPaused ? "Girar o carro" : "Pausar o giro"}
            >
              {spinPaused ? <Play size={13} /> : <Pause size={13} />}
            </ZoomBtn>
          )}
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
      className="w-8 h-8 rounded-full bg-[color:var(--color-surface)]/85 backdrop-blur border border-[color:var(--color-border-strong)] text-[color:var(--color-muted)] hover:text-[color:var(--color-text)] hover:bg-[color:var(--color-surface)]/95 transition-colors flex items-center justify-center"
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
  hoodOpen = false,
  onHoodAvailable,
}: {
  url: string;
  bodyColor: string | null;
  flipFront: boolean;
  onMeasured?: (dims: CarDims) => void;
  hoodOpen?: boolean;
  onHoodAvailable?: (available: boolean) => void;
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
  // BBox robusta: alguns GLBs do Sketchfab (ex.: hyundai-hb20.glb) trazem meshes
  // com escala local disparada (0.01 ao lado de 16.0) — Box3.setFromObject inclui
  // os outliers e a bbox estoura, o que faz `4.2 / size.x` encolher o carro
  // visível pra caber num volume fantasma. Coletamos as bboxes por mesh, achamos
  // a mediana do raio e descartamos meshes com raio > 4× mediana antes da união.
  const { size, center, boxMinY, scale } = useMemo(() => {
    const collect = (): THREE.Box3[] => {
      const out: THREE.Box3[] = [];
      cloned.traverse((obj) => {
        const mesh = obj as THREE.Mesh;
        if (!mesh.isMesh || !mesh.geometry) return;
        const b = new THREE.Box3().setFromObject(mesh);
        if (!b.isEmpty()) out.push(b);
      });
      return out;
    };
    const robustBox = (boxes: THREE.Box3[]): THREE.Box3 => {
      if (boxes.length === 0) return new THREE.Box3().setFromObject(cloned);
      const radii = boxes.map((b) => b.getSize(new THREE.Vector3()).length());
      const sorted = [...radii].sort((a, b) => a - b);
      const median = sorted[Math.floor(sorted.length / 2)] || 1;
      const cutoff = median * 4;
      const kept = boxes.filter((_, i) => radii[i] <= cutoff);
      const use = kept.length ? kept : boxes;
      const out = new THREE.Box3();
      for (const b of use) out.union(b);
      return out;
    };

    cloned.rotation.set(0, 0, 0);
    cloned.updateMatrixWorld(true);
    const raw = robustBox(collect());
    const rawSize = raw.getSize(new THREE.Vector3());
    const auto = rawSize.z > rawSize.x ? Math.PI / 2 : 0;
    cloned.rotation.y = auto + (flipFront ? Math.PI : 0);
    cloned.updateMatrixWorld(true);
    const box = robustBox(collect());
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    return { size, center, boxMinY: box.min.y, scale: 4.2 / size.x };
  }, [cloned, flipFront]);

  useEffect(() => {
    onMeasured?.({
      length: size.x * scale,
      height: size.y * scale,
      width: size.z * scale,
    });
  }, [size.x, size.y, size.z, scale, onMeasured]);

  // Capô: o nó vem pronto no .glb (ver HOOD_NODE). Como ele fica dentro do
  // `cloned`, o giro de 90°/180° da orientação acima não muda o eixo da dobradiça.
  const hood = useMemo(() => cloned.getObjectByName(HOOD_NODE) ?? null, [cloned]);
  useEffect(() => {
    onHoodAvailable?.(!!hood);
  }, [hood, onHoodAvailable]);
  useFrame((_, delta) => {
    if (!hood) return;
    const target = hoodOpen ? -HOOD_OPEN_ANGLE : 0;
    const diff = target - hood.rotation.x;
    if (Math.abs(diff) < 1e-4) return;
    // Amortecido: ~0,7 s até parar, sem depender da taxa de quadros.
    hood.rotation.x += diff * (1 - Math.exp(-Math.min(delta, 0.1) * 7));
    if (Math.abs(target - hood.rotation.x) < 1e-3) hood.rotation.x = target;
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
      <primitive object={cloned} />
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
            className="pointer-events-none whitespace-nowrap rounded bg-[color:var(--color-surface)]/95 backdrop-blur-sm border border-[color:var(--color-border)] text-[color:var(--color-text)] font-medium tracking-tight"
            style={{ fontSize: "11px", padding: "3px 7px", lineHeight: 1.2 }}
          >
            {PART_LABELS[hotspot.id]}
          </div>
        </Html>
      )}
    </group>
  );
}

/**
 * Velocidade do giro automático. O OrbitControls do drei chama update() sem
 * delta, então o three gira um ângulo fixo POR FRAME — em tela de 120/144 Hz
 * o carro girava 2x mais rápido que em 60 Hz. Aqui a velocidade é recalculada
 * pelo delta a cada frame (prioridade -2: roda antes do update do drei, que é
 * -1) pra manter TURNTABLE_SECONDS por volta em qualquer tela.
 *
 * Enquanto gira, também puxa o alvo de volta pro centro do carro: depois de
 * focar uma peça (FocusRig move o alvo pra ela), o giro voltava orbitando a
 * peça e o carro "varria" a tela.
 */
function Turntable({
  controlsRef,
  spinning,
}: {
  controlsRef: React.RefObject<any>;
  spinning: boolean;
}) {
  useFrame((_, delta) => {
    const controls = controlsRef.current;
    if (!controls) return;
    // Teto no delta: ao voltar de outra aba o primeiro frame vem com segundos
    // acumulados e o carro "pularia" meia volta.
    const dt = Math.min(delta, 0.1);
    // three: ângulo por frame = 2π/3600 · speed → speed = 3600 · Δt / período
    controls.autoRotateSpeed = (3600 * dt) / TURNTABLE_SECONDS;
    if (spinning) controls.target.lerp(ORBIT_CENTER, 1 - Math.exp(-dt * 1.5));
  }, -2);
  return null;
}

/**
 * Abre o FOV vertical quando o card é mais estreito que o 16:8 do desktop,
 * mantendo a largura enquadrada constante: o carro cabe igual no celular, e o
 * card mais alto ganha espaço em cima e embaixo em vez de cortar as pontas.
 */
function ResponsiveFov() {
  const camera = useThree((s) => s.camera);
  const width = useThree((s) => s.size.width);
  const height = useThree((s) => s.size.height);
  const invalidate = useThree((s) => s.invalidate);

  useEffect(() => {
    if (!(camera instanceof THREE.PerspectiveCamera) || !width || !height) return;
    const aspect = width / height;
    const narrowness = THREE.MathUtils.clamp(
      (BASE_ASPECT - aspect) / (BASE_ASPECT - NARROW_ASPECT),
      0,
      1,
    );
    const halfWidth =
      Math.tan(THREE.MathUtils.degToRad(BASE_FOV / 2)) *
      BASE_ASPECT *
      THREE.MathUtils.lerp(1, NARROW_EXTRA_WIDTH, narrowness);
    const fov =
      aspect >= BASE_ASPECT
        ? BASE_FOV
        : THREE.MathUtils.radToDeg(2 * Math.atan(halfWidth / aspect));
    if (Math.abs(camera.fov - fov) < 0.01) return;
    camera.fov = fov;
    camera.updateProjectionMatrix();
    invalidate();
  }, [camera, width, height, invalidate]);

  return null;
}

/**
 * Câmera do capô: ao abrir, desce pra frente e acima do cofre olhando o motor;
 * ao fechar, volta pra posição inicial. Cada clique no botão muda `nonce`.
 */
function HoodRig({
  open,
  nonce,
  dims,
  controlsRef,
}: {
  open: boolean;
  nonce: number;
  dims: CarDims;
  controlsRef: React.RefObject<any>;
}) {
  const active = useRef(false);
  const t0 = useRef(0);
  const fromPos = useRef(new THREE.Vector3());
  const fromTarget = useRef(new THREE.Vector3());
  const toPos = useRef(new THREE.Vector3());
  const toTarget = useRef(new THREE.Vector3());
  const invalidate = useThree((s) => s.invalidate);

  useEffect(() => {
    if (!nonce || !controlsRef.current) return;
    const controls = controlsRef.current;
    fromPos.current.copy(controls.object.position);
    fromTarget.current.copy(controls.target);
    if (open) {
      // Motor fica no terço da frente do carro, um pouco abaixo da metade da altura.
      toTarget.current.set(dims.length * 0.28, dims.height * 0.42, 0);
      toPos.current.copy(toTarget.current).add(HOOD_CAMERA_OFFSET);
    } else {
      toTarget.current.copy(ORBIT_CENTER);
      toPos.current.set(...CAMERA_START);
    }
    t0.current = performance.now();
    active.current = true;
    invalidate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nonce]);

  useFrame(() => {
    if (!active.current || !controlsRef.current) return;
    invalidate();
    const controls = controlsRef.current;
    const t = Math.min(1, (performance.now() - t0.current) / 900);
    const ease = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    controls.object.position.lerpVectors(fromPos.current, toPos.current, ease);
    controls.target.lerpVectors(fromTarget.current, toTarget.current, ease);
    controls.update();
    if (t >= 1) active.current = false;
  });

  return null;
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

