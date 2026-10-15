import * as THREE from "three";

type OpeningSpec = { name: string; nodes: RegExp; kind: "door" | "trunk" };

// Explicit asset mappings: never guess from arbitrary mesh names or cut the body.
const OPENINGS: Record<string, OpeningSpec[]> = {
  "vw-polo.glb": [
    ...["lf", "rf", "lr", "rr"].map((side): OpeningSpec => ({
      name: side, nodes: new RegExp(`^door_${side}_ok(?:[._]|$)`), kind: "door",
    })),
    { name: "trunk", nodes: /^boot_ok(?:[._]|$)/, kind: "trunk" },
  ],
  "volkswagen-gol.glb": [
    ...["L", "R"].map((side): OpeningSpec => ({
      name: side,
      nodes: new RegExp(`^Golf_1_(?:door|doorglass|doorpanel|mirror|molding_door)_${side}(?:[._]|$)`),
      kind: "door",
    })),
    { name: "trunk", nodes: /^Golf_1_(?:tailgate|tailgateglass|molding_trunk)(?:[._]|$)/, kind: "trunk" },
  ],
  "toyota-supra-mk4.glb": [
    ...["L", "R"].map((side): OpeningSpec => ({
      name: side, nodes: new RegExp(`^esta80_(?:door|doorglass|mirror)_${side}(?:[._]|$)`), kind: "door",
    })),
    { name: "trunk", nodes: /^esta80_tailgate(?:[._]|$)/, kind: "trunk" },
  ],
};

export function supportsCarOpenings(file: string): boolean {
  return Object.hasOwn(OPENINGS, file);
}

export interface CarOpening {
  pivot: THREE.Group;
  axis: "y" | "z";
  angle: number;
}

/** Input is an instance-owned, closed model oriented with its front at +X. */
export function createCarOpenings(source: THREE.Object3D, file: string) {
  // Keep the measured source untouched (also safe under React Strict Mode).
  // Materials remain shared with this viewer's own material clones for repainting.
  const model = source.clone(true);
  const root = new THREE.Group();
  root.add(model);
  root.updateMatrixWorld(true);
  const openings: CarOpening[] = [];
  const specs = OPENINGS[file] ?? [];
  const selections = specs.map((spec) => {
    const objects: THREE.Object3D[] = [];
    model.traverse((object) => {
      if (!spec.nodes.test(object.name)) return;
      // Select the highest matching ancestor so child meshes move exactly once.
      for (let p = object.parent; p && p !== model; p = p.parent) {
        if (spec.nodes.test(p.name)) return;
      }
      objects.push(object);
    });
    const box = new THREE.Box3();
    objects.forEach((object) => box.union(new THREE.Box3().setFromObject(object)));
    return { spec, objects, box };
  });
  // Do not offer a partial opening if an asset no longer matches its mapping.
  const ready = specs.length > 0 && selections.every(({ box }) => !box.isEmpty());
  if (!ready) return { root, openings, ready };

  const bodyCenter = new THREE.Box3().setFromObject(model).getCenter(new THREE.Vector3());
  for (const { spec, objects, box } of selections) {
    const center = box.getCenter(new THREE.Vector3());
    const pivot = new THREE.Group();
    pivot.name = `opening-${spec.name}`;
    // Front edge is the hinge. Rear hatch rotates upward around its roof edge.
    pivot.position.set(box.max.x, spec.kind === "trunk" ? box.max.y : center.y, center.z);
    root.add(pivot);
    root.updateMatrixWorld(true);
    objects.forEach((object) => pivot.attach(object));
    openings.push({
      pivot,
      axis: spec.kind === "trunk" ? "z" : "y",
      angle: spec.kind === "trunk" ? -Math.PI * 0.42 : Math.sign(center.z - bodyCenter.z) * Math.PI * 0.36,
    });
  }
  return { root, openings, ready };
}

/** Absolute transforms avoid accumulating error when repeatedly opening/closing. */
export function setCarOpeningProgress(openings: CarOpening[], progress: number) {
  const t = THREE.MathUtils.clamp(progress, 0, 1);
  const eased = t * t * (3 - 2 * t);
  openings.forEach(({ pivot, axis, angle }) => { pivot.rotation[axis] = angle * eased; });
}
