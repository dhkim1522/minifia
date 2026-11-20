import { BufferAttribute, BufferGeometry, Color, Float32BufferAttribute, Mesh, MeshStandardMaterial, Vector3 } from "three";
import type { Group, Object3D } from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import type { AnimalId } from "../../../shared/game/animals";
import { FINISH } from "../animalFinish";
import type { KnownFaceId } from "../characterData";
import { makeElephantDetail } from "./elephant-detail";
import { makeFoxDetail } from "./fox-detail";
import { makeBatDetail, makeLionDetail, makePigDetail, makeRabbitDetail, makeRamDetail } from "./mammal-detail";
import { makeCrocodileDetail, makeFrogDetail, makeHedgehogDetail, makeParrotDetail, makePenguinDetail } from "./mixed-detail";
import type { ExpressionKind, HeadDensity, Point } from "./head-sculpt";

const factories: Record<AnimalId, (density: HeadDensity) => Group> = {
  rabbit: makeRabbitDetail, elephant: makeElephantDetail, crocodile: makeCrocodileDetail,
  penguin: makePenguinDetail, fox: makeFoxDetail, pig: makePigDetail,
  lion: makeLionDetail, ram: makeRamDetail, frog: makeFrogDetail,
  parrot: makeParrotDetail, hedgehog: makeHedgehogDetail, bat: makeBatDetail,
};
interface FacialSection {
  kind: ExpressionKind;
  x: number;
  y: number;
  start: number;
  end: number;
}
const cache = new Map<`${AnimalId}:${HeadDensity}`, { geometry: BufferGeometry; expressions: readonly FacialSection[] }>();

/** 조형 시안의 재질별 조각을 본편의 머리 관절/재질 배치 한 장으로 굽는다. */
export function detailedAnimalHead(animal: AnimalId, density: HeadDensity = "close"): BufferGeometry {
  const key = `${animal}:${density}` as const;
  const cached = cache.get(key);
  if (cached) return cached.geometry;
  const model = factories[animal](density);
  model.updateMatrixWorld(true);
  const parts: BufferGeometry[] = [];
  const expressions: FacialSection[] = [];
  const color = new Color();
  const pivot = new Vector3();
  let offset = 0;
  model.traverse(object => {
    if (!(object instanceof Mesh) || !(object.material instanceof MeshStandardMaterial)) return;
    const geometry = (object.geometry as BufferGeometry).clone();
    geometry.applyMatrix4(object.matrixWorld).translate(0, 0.431, 0);
    const position = geometry.getAttribute("position");
    let facialPart: Object3D | null = object;
    while (facialPart && facialPart !== model && facialPart.userData.expressionKind === undefined) facialPart = facialPart.parent;
    const kind = facialPart?.userData.expressionKind as ExpressionKind | undefined;
    if (facialPart && kind) {
      const localPivot = facialPart.userData.expressionPivot as Point | undefined;
      facialPart.localToWorld(localPivot ? pivot.set(...localPivot) : pivot.set(0, 0, 0));
      expressions.push({ kind, x: pivot.x, y: pivot.y + 0.431, start: offset, end: offset + position.count });
    }
    offset += position.count;
    const uv = geometry.getAttribute("uv");
    const colors = geometry.getAttribute("color");
    const rgb = new Float32Array(position.count * 3);
    const coordinates = new Float32Array(position.count * 2);
    const finish = object.material.roughness <= 0.50 ? FINISH.smooth : FINISH.felt;
    for (let i = 0; i < position.count; i++) {
      color.copy(object.material.color);
      if (colors) color.setRGB(color.r * colors.getX(i), color.g * colors.getY(i), color.b * colors.getZ(i));
      color.toArray(rgb, i * 3);
      coordinates[i * 2] = (uv ? uv.getX(i) : position.getX(i) + position.getZ(i) * 0.35) * 4;
      coordinates[i * 2 + 1] = (uv ? uv.getY(i) : position.getY(i)) * 4;
    }
    geometry.deleteAttribute("uv");
    geometry.setAttribute("color", new Float32BufferAttribute(rgb, 3));
    geometry.setAttribute("animalUv", new Float32BufferAttribute(coordinates, 2));
    geometry.setAttribute("animalFinish", new Float32BufferAttribute(new Float32Array(position.count).fill(finish), 1));
    if (!geometry.index) {
      const indices = new Uint32Array(position.count);
      for (let i = 0; i < indices.length; i++) indices[i] = i;
      geometry.setIndex(new BufferAttribute(indices, 1));
    }
    parts.push(geometry);
  });
  const geometry = mergeGeometries(parts, false);
  for (const part of parts) part.dispose();
  if (!geometry) throw new Error(`동물 머리 조형 병합 실패: ${animal}`);
  geometry.computeBoundingBox();
  cache.set(key, { geometry, expressions });
  return geometry;
}

type Deformation = readonly [width: number, height: number, roll: number, lift: number];
const neutral: Deformation = [1, 1, 0, 0];
const eyes: Readonly<Record<KnownFaceId, Deformation>> = {
  base: neutral,
  happy: [1.08, 0.30, -0.13, 0.012],
  angry: [1.07, 0.66, 0.27, -0.006],
  cry: [0.99, 0.40, -0.22, -0.006],
  surprise: [1.19, 1.22, 0, 0.006],
  sus: [1.1, 0.51, 0.16, 0.004],
  dead: [1.0, 0.18, 0.10, -0.005],
};
const mouth: Readonly<Record<KnownFaceId, Deformation>> = {
  base: neutral,
  happy: [1.18, 1.31, 0, 0.005],
  angry: [0.96, 0.46, 0, -0.005],
  cry: [0.83, 0.85, Math.PI, -0.004],
  surprise: [0.54, 2.13, 0, -0.008],
  sus: [0.79, 0.62, 0.08, 0],
  dead: [0.77, 0.52, 0, 0],
};

/** 한 머리 메시의 눈·입 부분만 바꾼다. 실루엣·무늬·의상 부품은 그대로다. */
export function applyDetailedFace(target: BufferGeometry, animal: AnimalId, density: HeadDensity, face: KnownFaceId): void {
  const base = cache.get(`${animal}:${density}`);
  if (!base) return;
  const positions = target.getAttribute("position");
  const normals = target.getAttribute("normal");
  const original = base.geometry.getAttribute("position");
  const originalNormals = base.geometry.getAttribute("normal");
  for (const { kind, x, y, start, end } of base.expressions) {
    if (face === "base") {
      for (let i = start; i < end; i++) {
        positions.setXYZ(i, original.getX(i), original.getY(i), original.getZ(i));
        normals.setXYZ(i, originalNormals.getX(i), originalNormals.getY(i), originalNormals.getZ(i));
      }
      continue;
    }
    const [width, height, roll, lift] = kind === "eye" ? eyes[face] : mouth[face];
    const angle = kind === "eye" ? roll * Math.sign(x) : roll;
    const sin = Math.sin(angle);
    const cos = Math.cos(angle);
    for (let i = start; i < end; i++) {
      const px = (original.getX(i) - x) * width;
      const py = (original.getY(i) - y) * height;
      positions.setXYZ(i, x + px * cos - py * sin, y + px * sin + py * cos + lift, original.getZ(i));
      const nx = originalNormals.getX(i) / width;
      const ny = originalNormals.getY(i) / height;
      const nz = originalNormals.getZ(i);
      const length = Math.hypot(nx, ny, nz) || 1;
      normals.setXYZ(i, (nx * cos - ny * sin) / length, (nx * sin + ny * cos) / length, nz / length);
    }
  }
  positions.needsUpdate = normals.needsUpdate = true;
}
