import { describe, it, expect } from "vitest";
import * as THREE from "three";
import { measureCarBox } from "@/lib/car-bbox";

/**
 * Os números dos cenários vêm dos GLBs de verdade em public/cars — lidos do
 * chunk JSON de cada arquivo (accessor min/max + transform dos nós).
 */
function mesh(
  name: string,
  size: [number, number, number],
  center: [number, number, number],
  material: string,
) {
  const m = new THREE.Mesh(
    new THREE.BoxGeometry(...size),
    new THREE.MeshStandardMaterial({ name }),
  );
  (m.material as THREE.Material).name = material;
  m.name = name;
  m.position.set(...center);
  return m;
}

function scene(...meshes: THREE.Mesh[]) {
  const root = new THREE.Group();
  for (const m of meshes) root.add(m);
  root.updateMatrixWorld(true);
  return root;
}

const dims = (b: THREE.Box3) => b.getSize(new THREE.Vector3()).toArray().map((v) => +v.toFixed(2));

describe("measureCarBox", () => {
  it("ignora os pneus de outro carro esquecidos na cena (hyundai-hb20.glb)", () => {
    const root = scene(
      mesh("lataria", [1.85, 1.31, 3.94], [0.07, 0.67, 1.05], "00_-_HB20_-_2015_-_Pintura"),
      mesh("roda1", [0.12, 0.62, 0.62], [0.83, 0.13, 2.24], "00_-_HB20_-_2015_-_Roda"),
      mesh("roda2", [0.12, 0.62, 0.62], [-0.71, 0.13, -0.32], "00_-_HB20_-_2015_-_Roda"),
      mesh("retrovisor", [0.24, 0.06, 0.01], [0.07, 1.1, 1.42], "00_-_HB20_-_2015_-Espelhos"),
      // lixo: 4 dos 23 pneus de Honda Civic, escala 6,4 a 16,5
      mesh("pneu-junk1", [4.61, 0.59, 13.1], [1.73, 0.13, 5.93], "00_-_Honda_Civic_-_Pneu"),
      mesh("pneu-junk2", [24.3, 3.11, 29.63], [11.59, 1.38, 0.18], "00_-_Honda_Civic_-_Pneu"),
      mesh("pneu-junk3", [7.5, 2.61, 16.59], [3.17, 1.15, 4.22], "00_-_Honda_Civic_-_Pneu"),
      // lascas minúsculas mas distantes — o filtro por tamanho não pegava
      mesh("lasca1", [0.02, 0.01, 0.02], [9.94, 3.53, -2.54], "visionarq.mx_car_acryl_black"),
      mesh("lasca2", [0.02, 0.03, 0.17], [14.05, 0.65, 8.52], "visionarq.mx_car_plastic_black"),
    );

    const box = measureCarBox(root, new Set(["00_-_HB20_-_2015_-_Pintura"]));

    // antes da âncora a união dava 14,92 × 3,72 × 11,15 e o carro saía a 26%.
    // A altura passa de 1,31 (só a lataria) porque as rodas descem abaixo dela.
    expect(dims(box)).toEqual([1.85, 1.5, 3.94]);
    expect(4.2 / box.getSize(new THREE.Vector3()).z).toBeCloseTo(1.07, 2);
  });

  it("esconde o lixo do render, mas só ele", () => {
    const root = scene(
      mesh("lataria", [1.85, 1.31, 3.94], [0.07, 0.67, 1.05], "pintura"),
      mesh("roda", [0.12, 0.62, 0.62], [0.83, 0.13, 2.24], "roda"),
      mesh("pneu-junk", [24.3, 3.11, 29.63], [11.59, 1.38, 0.18], "00_-_Honda_Civic_-_Pneu"),
    );
    measureCarBox(root, new Set(["pintura"]));

    const visivel = (n: string) => root.getObjectByName(n)!.visible;
    expect(visivel("lataria")).toBe(true);
    expect(visivel("roda")).toBe(true);
    expect(visivel("pneu-junk")).toBe(false);
  });

  it("não corta a carroceria quando a pintura cobre só uma faixa (renault-clio.glb)", () => {
    // a "pintura" da clio tem 0,40 de altura contra 1,15 do carro: um envelope
    // por eixo jogaria fora a Carroserie inteira
    const root = scene(
      mesh("pintura", [1.57, 0.4, 2.82], [0, 0.72, 0], "Carroserie_paint"),
      mesh("carroceria", [1.8, 1.15, 3.62], [0, 0.24, 0.06], "Carroserie"),
      mesh("plastico", [1.79, 1.35, 3.62], [0, 0.15, 0.06], "Plastic_Noir"),
      mesh("vidros", [1.47, 0.49, 2.57], [0, -0.05, 0.34], "Vitres"),
    );

    const box = measureCarBox(root, new Set(["Carroserie_paint"]));

    expect(dims(box)).toEqual([1.8, 1.45, 3.62]);
    expect(root.children.every((c) => c.visible)).toBe(true);
  });

  it("o corte pra esconder é mais frouxo que o corte pra medir", () => {
    // peça a 0,8 comprimento do centro: fora da medição (0,6), longe de esconder (1,0)
    const root = scene(
      mesh("pintura", [1.8, 1.3, 4], [0, 0, 0], "paint"),
      mesh("duvidosa", [0.3, 0.3, 0.3], [3.2, 0, 0], "sei_la"),
    );

    const box = measureCarBox(root, new Set(["paint"]));

    expect(dims(box)).toEqual([1.8, 1.3, 4]);
    expect(root.getObjectByName("duvidosa")!.visible).toBe(true);
  });

  it("sem material de pintura mapeado, cai no filtro por mediana", () => {
    const root = scene(
      mesh("carroceria", [1.8, 1.3, 4], [0, 0, 0], "Material.001"),
      mesh("porta-esq", [1.5, 1, 1.5], [-0.2, 0, 0.6], "Material.002"),
      mesh("porta-dir", [1.5, 1, 1.5], [0.2, 0, 0.6], "Material.003"),
      mesh("capo", [1.5, 0.9, 1.4], [0, 0.1, -1], "Material.004"),
      mesh("chao", [60, 0.1, 60], [0, -0.65, 0], "Shadow"),
    );

    const box = measureCarBox(root, new Set());

    // o plano de sombra sai pela mediana do raio (a largura passa de 1,8 porque
    // as portas ficam encostadas por fora da carroceria)
    expect(dims(box)).toEqual([1.9, 1.3, 4]);
    // mas sem âncora nada é escondido: não há como saber com segurança o que é lixo
    expect(root.getObjectByName("chao")!.visible).toBe(true);
  });

  it("o filtro por mediana ainda descarta carroceria legítima — por isso a âncora existe", () => {
    // mesmo cenário do HB20, só que sem entrada em car-paint.ts: as peças
    // pequenas puxam a mediana pra baixo e a lataria inteira cai fora do corte.
    const semAncora = scene(
      mesh("lataria", [1.8, 1.3, 4], [0, 0, 0], "Material.001"),
      mesh("roda1", [0.6, 0.6, 0.6], [0.8, 0, 1.5], "Material.002"),
      mesh("roda2", [0.6, 0.6, 0.6], [-0.8, 0, 1.5], "Material.003"),
      mesh("roda3", [0.6, 0.6, 0.6], [0.8, 0, -1.5], "Material.004"),
      mesh("roda4", [0.6, 0.6, 0.6], [-0.8, 0, -1.5], "Material.005"),
    );
    expect(dims(measureCarBox(semAncora, new Set()))).toEqual([2.2, 0.6, 3.6]);

    // com a âncora, o mesmo arquivo mede o carro inteiro
    const comAncora = scene(
      mesh("lataria", [1.8, 1.3, 4], [0, 0, 0], "carpaint"),
      mesh("roda1", [0.6, 0.6, 0.6], [0.8, 0, 1.5], "Material.002"),
      mesh("roda2", [0.6, 0.6, 0.6], [-0.8, 0, 1.5], "Material.003"),
      mesh("roda3", [0.6, 0.6, 0.6], [0.8, 0, -1.5], "Material.004"),
      mesh("roda4", [0.6, 0.6, 0.6], [-0.8, 0, -1.5], "Material.005"),
    );
    expect(dims(measureCarBox(comAncora, new Set(["carpaint"])))).toEqual([2.2, 1.3, 4]);
  });
});
