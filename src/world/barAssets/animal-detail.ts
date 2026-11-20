import { BufferAttribute, BufferGeometry, Color, Float32BufferAttribute, Mesh, MeshStandardMaterial } from "three";
import type { Group } from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import type { AnimalId } from "../../../shared/game/animals";
import { FINISH } from "../animalFinish";
import { makeElephantDetail } from "./elephant-detail";
import { makeFoxDetail } from "./fox-detail";
import { makeBatDetail, makeLionDetail, makePigDetail, makeRabbitDetail, makeRamDetail } from "./mammal-detail";
import { makeCrocodileDetail, makeFrogDetail, makeHedgehogDetail, makeParrotDetail, makePenguinDetail } from "./mixed-detail";

const factories: Record<AnimalId, () => Group> = {
  rabbit: makeRabbitDetail, elephant: makeElephantDetail, crocodile: makeCrocodileDetail,
  penguin: makePenguinDetail, fox: makeFoxDetail, pig: makePigDetail,
  lion: makeLionDetail, ram: makeRamDetail, frog: makeFrogDetail,
  parrot: makeParrotDetail, hedgehog: makeHedgehogDetail, bat: makeBatDetail,
};
const cache = new Map<AnimalId, BufferGeometry>();

/** 조형 시안의 재질별 조각을 본편의 머리 관절/재질 배치 한 장으로 굽는다. */
export function seatedAnimalHead(animal: AnimalId): BufferGeometry {
  const cached = cache.get(animal);
  if (cached) return cached;
  const model = factories[animal]();
  model.updateMatrixWorld(true);
  const parts: BufferGeometry[] = [];
  const color = new Color();
  model.traverse(object => {
    if (!(object instanceof Mesh) || !(object.material instanceof MeshStandardMaterial)) return;
    const geometry = (object.geometry as BufferGeometry).clone();
    geometry.applyMatrix4(object.matrixWorld).translate(0, 0.431, 0);
    const position = geometry.getAttribute("position");
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
  if (!geometry) throw new Error(`착석 캐릭터 머리 병합 실패: ${animal}`);
  geometry.computeBoundingBox();
  cache.set(animal, geometry);
  return geometry;
}
