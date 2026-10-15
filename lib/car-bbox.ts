import * as THREE from "three";

/**
 * Mede a caixa que representa **o carro** dentro de um GLB do catálogo.
 *
 * Vários arquivos trazem geometria que não é o carro: o hyundai-hb20.glb tem 23
 * pneus de um Honda Civic esquecidos na cena (até 33 unidades, contra 3,9 do
 * carro), o porsche-court-test.glb tem uma quadra de basquete inteira, outros
 * trazem planos de sombra falsos. Como o visualizador normaliza o modelo com
 * `4.2 / size.x`, esse lixo estica a bbox e o carro renderiza em miniatura —
 * 26% do tamanho no HB20, com os hotspots orbitando um volume fantasma.
 *
 * Filtrar mesh por tamanho não resolve: lixo numeroso sobe a própria mediana, e
 * o corte ainda descarta carroceria legítima em modelos feitos de muitas peças
 * pequenas (30 dos 530 renderizavam grandes demais por isso). A âncora confiável
 * é a lataria — os materiais de pintura de `lib/car-paint.ts`.
 */

/** Distância máxima do centro da lataria, em comprimentos de carro, pra entrar na medição. */
const MEASURE_DIST = 0.6;
/** Tamanho máximo de uma mesh, em comprimentos de carro, pra entrar na medição. */
const MEASURE_SIZE = 1.5;
/**
 * Cortes pra ESCONDER do render, propositalmente mais frouxos que os de medição:
 * tirar uma peça duvidosa da conta é barato, apagá-la da tela não. Dos 317
 * modelos com pintura mapeada, só 14 escondem alguma coisa — e são casos
 * inequívocos (pneus de outro carro, quadra de basquete, plano de sombra).
 */
const HIDE_DIST = 1;
const HIDE_SIZE = 2;

interface Part {
  mesh: THREE.Mesh;
  box: THREE.Box3;
  paint: boolean;
}

function collect(root: THREE.Object3D, paintNames: Set<string>): Part[] {
  const out: Part[] = [];
  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh || !mesh.geometry) return;
    const box = new THREE.Box3().setFromObject(mesh);
    if (box.isEmpty()) return;
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    const paint = mats.some((m) => m?.name && paintNames.has(m.name));
    out.push({ mesh, box, paint });
  });
  return out;
}

function union(boxes: THREE.Box3[]): THREE.Box3 {
  const out = new THREE.Box3();
  for (const b of boxes) out.union(b);
  return out;
}

/** Fallback pros 213 arquivos sem material de pintura mapeado: mediana do raio. */
function medianBox(root: THREE.Object3D, parts: Part[]): THREE.Box3 {
  if (parts.length === 0) return new THREE.Box3().setFromObject(root);
  const radii = parts.map((p) => p.box.getSize(new THREE.Vector3()).length());
  const sorted = [...radii].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)] || 1;
  const kept = parts.filter((_, i) => radii[i] <= median * 4);
  return union((kept.length ? kept : parts).map((p) => p.box));
}

function anchoredBox(parts: Part[]): THREE.Box3 | null {
  const paint = parts.filter((p) => p.paint);
  if (paint.length === 0) return null;

  const body = union(paint.map((p) => p.box));
  const bodySize = body.getSize(new THREE.Vector3());
  const bodyCenter = body.getCenter(new THREE.Vector3());
  // O envelope é múltiplo do COMPRIMENTO, não da bbox por eixo: a pintura
  // costuma cobrir só uma faixa do carro (0,40 de altura na renault-clio contra
  // 1,15 do carro inteiro), e por eixo o filtro cortaria a carroceria real.
  const length = Math.max(bodySize.x, bodySize.z);
  if (!(length > 0)) return null;

  const size = new THREE.Vector3();
  const center = new THREE.Vector3();
  const near = (box: THREE.Box3, dist: number, span: number) => {
    box.getSize(size);
    box.getCenter(center);
    return (
      Math.max(size.x, size.y, size.z) <= length * span &&
      Math.abs(center.x - bodyCenter.x) <= length * dist &&
      Math.abs(center.y - bodyCenter.y) <= length * dist &&
      Math.abs(center.z - bodyCenter.z) <= length * dist
    );
  };

  // Lixo evidente sai do render junto: medir certo sem esconder faria os pneus
  // do HB20, agora na escala correta, aparecerem gigantes em volta do carro.
  for (const p of parts) {
    if (near(p.box, HIDE_DIST, HIDE_SIZE)) continue;
    p.mesh.visible = false;
    p.mesh.raycast = () => null;
  }

  const kept = parts.filter((p) => near(p.box, MEASURE_DIST, MEASURE_SIZE));
  return kept.length ? union(kept.map((p) => p.box)) : body;
}

/**
 * Caixa do carro em coordenadas de mundo, na orientação atual de `root`.
 * Efeito colateral deliberado: meshes reconhecidas como lixo têm `visible` e
 * `raycast` desligados. Só acontece quando há âncora de pintura.
 */
export function measureCarBox(root: THREE.Object3D, paintNames: Set<string>): THREE.Box3 {
  const parts = collect(root, paintNames);
  return anchoredBox(parts) ?? medianBox(root, parts);
}
