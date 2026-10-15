import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { GLTFLoader, MeshoptDecoder } from "three-stdlib";
import { createCarOpenings, setCarOpeningProgress } from "@/lib/car-openings";
import { measureCarBox } from "@/lib/car-bbox";
import { paintTargetFor } from "@/lib/car-paint";
import { VEHICLE_CATALOG } from "@/lib/vehicles";

// Load actual geometry and hierarchy, omitting textures which require browser APIs.
async function loadCar(file: string) {
  const bytes = readFileSync(`public/cars/${file}`);
  const jsonLength = bytes.readUInt32LE(12);
  const json = JSON.parse(bytes.subarray(20, 20 + jsonLength).toString());
  delete json.images;
  delete json.textures;
  delete json.materials;
  for (const mesh of json.meshes) for (const primitive of mesh.primitives) delete primitive.material;
  const encoded = Buffer.from(JSON.stringify(json));
  const padded = Buffer.alloc(Math.ceil(encoded.length / 4) * 4, 32);
  encoded.copy(padded);
  const binary = bytes.subarray(20 + jsonLength);
  const header = Buffer.alloc(20);
  header.writeUInt32LE(0x46546c67, 0);
  header.writeUInt32LE(2, 4);
  header.writeUInt32LE(20 + padded.length + binary.length, 8);
  header.writeUInt32LE(padded.length, 12);
  header.writeUInt32LE(0x4e4f534a, 16);
  const glb = Buffer.concat([header, padded, binary]);
  const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder());
  const loaded = await loader.parseAsync(glb.buffer.slice(glb.byteOffset, glb.byteOffset + glb.byteLength), "");
  const scene = loaded.scene;
  const paint = new Set(paintTargetFor(file)?.materials ?? []);
  const size = measureCarBox(scene, paint).getSize(new THREE.Vector3());
  scene.rotation.y = (size.z > size.x ? Math.PI / 2 : 0)
    + (VEHICLE_CATALOG.find((v) => v.glb === file)?.flipFront ? Math.PI : 0);
  scene.updateMatrixWorld(true);
  return scene;
}

function meshMatrices(root: THREE.Object3D) {
  root.updateMatrixWorld(true);
  const result = new Map<string, number[]>();
  root.traverse((o) => { if ((o as THREE.Mesh).isMesh) result.set(o.name, o.matrixWorld.toArray()); });
  return result;
}

describe("real car opening geometry", () => {
  for (const [file, count] of [["vw-polo.glb", 5], ["volkswagen-gol.glb", 3], ["toyota-supra-mk4.glb", 3]] as const) {
    it(`${file}: opens all panels together, preserves body and closes exactly`, async () => {
      const source = await loadCar(file);
      const before = meshMatrices(source);
      const rig = createCarOpenings(source, file);
      expect(rig.ready).toBe(true);
      expect(rig.openings).toHaveLength(count);
      const closed = meshMatrices(rig.root);
      for (const [name, matrix] of before) {
        closed.get(name)!.forEach((v, i) => expect(v).toBeCloseTo(matrix[i], 5));
      }
      const attached = new Set<string>();
      rig.openings.forEach(({ pivot }) => pivot.traverse((o) => attached.add(o.name)));
      setCarOpeningProgress(rig.openings, 1);
      const open = meshMatrices(rig.root);
      for (const { pivot } of rig.openings) {
        const meshes: THREE.Object3D[] = [];
        pivot.traverse((o) => { if ((o as THREE.Mesh).isMesh) meshes.push(o); });
        expect(meshes.length).toBeGreaterThan(0);
        expect(meshes.some((o) => open.get(o.name)!.some((v, i) => Math.abs(v - closed.get(o.name)![i]) > 0.001))).toBe(true);
      }
      for (const [name, matrix] of closed) {
        if (!attached.has(name)) expect(open.get(name)).toEqual(matrix);
      }
      for (let i = 0; i < 10; i++) {
        setCarOpeningProgress(rig.openings, 0);
        setCarOpeningProgress(rig.openings, 1);
      }
      setCarOpeningProgress(rig.openings, 0);
      expect(meshMatrices(rig.root)).toEqual(closed);
      expect(meshMatrices(source)).toEqual(before);
      expect(createCarOpenings(source, file).ready).toBe(true);
    });
  }
  it("does not animate unknown or incomplete assets", () => {
    expect(createCarOpenings(new THREE.Group(), "unknown.glb").ready).toBe(false);
    expect(createCarOpenings(new THREE.Group(), "vw-polo.glb").ready).toBe(false);
  });
});
