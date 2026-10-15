/**
 * Catálogo de cenários 3D do viewer. Cada cenário é um `.glb` completo
 * (paredes, teto, piso, iluminação embutida) do Sketchfab, servido de
 * `public/scenery/`. Substitui a abordagem anterior de HDRI-como-fundo
 * (que dava aspecto de "carro flutuando sobre foto"). Reflexos no metal
 * do carro continuam vindo de um HDRI em `public/hdri/skylit_garage_2k.hdr`
 * — usado só como environment map, não visível como fundo.
 *
 * Pra adicionar um novo cenário:
 *   1. baixar o GLB (Sketchfab, licença CC BY ou Free Standard)
 *   2. processar com `carros/scripts/prep-garage.mjs` (dedup + meshopt)
 *   3. salvar em `public/scenery/<id>.glb`
 *   4. registrar aqui com um id kebab-case
 *   5. calibrar `floorY` e `scale` se necessário (default: escala pra ~24m
 *      de largura e assenta em y=0). O único jeito de saber é abrir o
 *      viewer e ver se o carro tá enterrado / flutuando / muito grande.
 *   6. adicionar crédito em `carros/CREDITS.md`
 */
export interface Scenery {
  id: string;
  label: string;
  /** Caminho absoluto (a partir de /public) do .glb */
  file: string;
  /**
   * Y de assentamento — carro, sombra e plano-de-fundo compartilham esta
   * altura. Ajustar se a base do modelo (piso do cenário) não estiver em
   * y=0 no arquivo (comum em modelos que têm subterreno).
   */
  floorY: number;
  /**
   * Escala uniforme aplicada ao modelo. `null` = autoescala pra ~24m de
   * largura no eixo maior (função de fit em `car-3d.tsx`).
   */
  scale?: number | null;
}

export const SCENERY_CATALOG: Scenery[] = [
  {
    id: "garage-desert",
    label: "Garagem no deserto",
    file: "/scenery/garage-desert.glb",
    floorY: 0.1,
    scale: null,
  },
  {
    id: "parking-basement",
    label: "Garagem subterrânea",
    file: "/scenery/parking-basement.glb",
    floorY: 0,
    scale: null,
  },
  {
    id: "brutalist-interior",
    label: "Interior brutalista",
    file: "/scenery/brutalist-interior.glb",
    floorY: 0,
    scale: null,
  },
];

export const DEFAULT_SCENERY_ID = "brutalist-interior";

export function getScenery(id: string | null | undefined): Scenery {
  if (!id) return SCENERY_CATALOG[0];
  return SCENERY_CATALOG.find((s) => s.id === id) ?? SCENERY_CATALOG[0];
}
