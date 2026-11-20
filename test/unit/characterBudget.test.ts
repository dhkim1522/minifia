// 10-06: 인물 에셋 예산 — 인물 8명 × 의상 9종 72조합 (D-15, D-16). `npm run check:character` 의 본체다.
// WebGL 없이 node 에서 장면 그래프만 검사한다. 새 3D 부품은 만들지 않는다(O-4).
import { readFileSync } from "node:fs";
import { Box3, type BufferGeometry, Color, type Mesh, type Object3D, Triangle, Vector3 } from "three";
import { describe, expect, it, vi } from "vitest";
import { ANIMAL_IDS, type AnimalId } from "../../shared/game/animals";
import { EMOTE_MS } from "../../shared/game/emote";
import { EMOTE_IDS, MAX_PLAYERS } from "../../shared/protocol";
import { characterKit, createCharacter } from "../../src/world/character";
import { detailedAnimalHead } from "../../src/world/barAssets/animal-detail";
import { EMOTE_KEYS, EMOTES, type EmoteId, FACE_IDS, FIGS, OUTFITS, type OutfitId } from "../../src/world/characterData";

const OUTFIT_IDS = Object.keys(OUTFITS) as OutfitId[];
const COMBOS: [number, OutfitId][] = FIGS.flatMap((_, f) => OUTFIT_IDS.map((o): [number, OutfitId] => [f, o]));

const MAX_MESHES = 8;
const MAX_TRIANGLES = 15_000;
const HEIGHT_MIN = 1.5;
/** 높이 밴드 상한: 결정 0068 이 1.9 에서 1.92 로 올렸다(여자 머리 위 기자 모자 1.918). 하한·다른 문턱은 그대로. */
const HEIGHT_MAX = 1.92;
const MAX_OWNED_GEOMETRIES = 14;
const SEATS = MAX_PLAYERS;
const SCENE_TRIANGLES = 120_000;
const SCENE_DRAW_CALLS = 64;

function meshesOf(root: Object3D): Mesh[] {
  const out: Mesh[] = [];
  root.traverse((o) => {
    const m = o as Mesh;
    if (m.isMesh && m.visible) out.push(m);
  });
  return out;
}
function triangles(g: BufferGeometry): number {
  return (g.index?.count ?? g.getAttribute("position").count) / 3;
}
function finite(root: Object3D): boolean {
  let ok = true;
  root.traverse((o) => {
    for (const v of [o.position.x, o.position.y, o.position.z, o.rotation.x, o.rotation.y, o.rotation.z, o.scale.x, o.scale.y, o.scale.z]) {
      if (!Number.isFinite(v)) ok = false;
    }
  });
  return ok;
}

interface Measure {
  meshes: number;
  tris: number;
  height: number;
}
const measured = new Map<string, Measure>();

describe("인물 에셋 예산 — 72조합 (D-15, D-16)", () => {
  it("좌석마다 인물 한 명씩, 8 × 9 = 72 조합이다", () => {
    expect(FIGS.length).toBe(SEATS);
    expect(OUTFIT_IDS.length).toBe(9);
    expect(COMBOS.length).toBe(72);
  });

  it.each(COMBOS)("인물 %i × 의상 %s: 메시·삼각형·높이·유한성·지오메트리 수", (fig, outfit) => {
    const c = createCharacter(fig, outfit);
    c.update(0, 0, false);
    const ms = meshesOf(c.root);
    const tris = ms.reduce((s, m) => s + triangles(m.geometry), 0);
    const box = new Box3().setFromObject(c.root);
    const size = box.getSize(new Vector3());
    measured.set(`${fig}:${outfit}`, { meshes: c.meshCount(), tris, height: size.y });

    expect(c.meshCount()).toBeLessThanOrEqual(MAX_MESHES);
    expect(ms.length).toBeLessThanOrEqual(MAX_MESHES);
    expect(tris).toBeLessThanOrEqual(MAX_TRIANGLES);
    expect(size.y).toBeGreaterThanOrEqual(HEIGHT_MIN);
    expect(size.y).toBeLessThanOrEqual(HEIGHT_MAX);
    for (const m of ms) {
      const pos = m.geometry.getAttribute("position");
      for (let i = 0; i < pos.array.length; i++) {
        if (!Number.isFinite(pos.array[i])) throw new Error(`NaN/Infinity position: ${fig}/${outfit} #${i}`);
      }
    }
    c.prewarm();
    expect(c.ownedGeometryCount()).toBeLessThanOrEqual(MAX_OWNED_GEOMETRIES);
    c.dispose();
    expect(c.ownedGeometryCount()).toBe(0);
  });

  it("8명 전원 최악 조합 삼각형 합 ≤ 120,000, draw call 합 ≤ 64", () => {
    expect(measured.size).toBe(COMBOS.length);
    const worstTris = Math.max(...[...measured.values()].map((m) => m.tris));
    const worstMeshes = Math.max(...[...measured.values()].map((m) => m.meshes));
    expect(worstTris * SEATS).toBeLessThanOrEqual(SCENE_TRIANGLES);
    expect(worstMeshes * SEATS).toBeLessThanOrEqual(SCENE_DRAW_CALLS);
  });

  it("걷기 60프레임 + 동작 9종 재생 중 모든 그룹이 유한하고 메시 수가 변하지 않는다", () => {
    for (const outfit of OUTFIT_IDS) {
      const c = createCharacter(0, outfit);
      const base = c.meshCount();
      for (let i = 0; i < 60; i++) {
        c.update(1 / 60, i / 60, true);
        expect(finite(c.root)).toBe(true);
      }
      expect(c.meshCount()).toBe(base);
      for (const id of EMOTE_IDS) {
        c.playEmote(id);
        for (let i = 0; i < 150; i++) {
          c.update(1 / 60, i / 60, false);
          if (!finite(c.root)) throw new Error(`비유한 값: ${outfit}/${id} 프레임 ${i}`);
          if (c.meshCount() !== base) throw new Error(`메시 수 변동: ${outfit}/${id}`);
        }
      }
      c.dispose();
    }
  });
});

describe("동물 캐릭터의 외형과 렌더링 예산", () => {
  it("종을 바꿔도 병합 재질과 표면 속성이 일치하고 여섯 관절을 다시 쓴다", () => {
    const c = createCharacter(0, "coat", undefined, "rabbit");
    const head = c.root.getObjectByName("neck")!.children[0] as Mesh;
    const torso = c.root.getObjectByName("body")!.children.find((object) => (object as Mesh).isMesh)! as Mesh;
    const shared = head.material;
    for (const mesh of [head, torso]) {
      const positions = mesh.geometry.getAttribute("position");
      expect(mesh.geometry.getAttribute("animalUv").count).toBe(positions.count);
      expect(mesh.geometry.getAttribute("animalFinish").count).toBe(positions.count);
      expect(mesh.material).toBe(shared);
    }
    expect(new Set(torso.geometry.getAttribute("animalFinish").array).size).toBeGreaterThan(1);

    c.applyAnimal(undefined);
    expect(head.geometry.getAttribute("animalUv")).toBeUndefined();
    expect(head.material).not.toBe(shared);
    c.applyAnimal("parrot");
    c.applyOutfit("doctor");
    expect(head).toBe(c.root.getObjectByName("neck")!.children[0]);
    expect(head.geometry.getAttribute("animalUv")).toBeDefined();
    expect(head.material).toBe(shared);
    c.dispose();
  });

  it("동물 12종과 의상 모두 관절 여섯 개와 기존 삼각형 예산을 지킨다", () => {
    for (const animal of ANIMAL_IDS) {
      for (const outfit of OUTFIT_IDS) {
        const c = characterKit.create(0, outfit, animal);
        const ms = meshesOf(c.root);
        const size = new Box3().setFromObject(c.root).getSize(new Vector3());
        const label = `${animal}/${outfit}`;
        expect(ms.length, label).toBeLessThanOrEqual(MAX_MESHES);
        expect(ms.reduce((sum, m) => sum + triangles(m.geometry), 0), label).toBeLessThanOrEqual(MAX_TRIANGLES);
        expect(size.y, label).toBeGreaterThanOrEqual(HEIGHT_MIN);
        // 토끼 귀의 꼭대기는 기존 상단 이름표 위치(2.45 × 0.83) 안에 들어온다.
        expect(size.y, label).toBeLessThanOrEqual(2.04);
        c.prewarm();
        expect(c.ownedGeometryCount(), label).toBeLessThanOrEqual(MAX_OWNED_GEOMETRIES);
        c.dispose();
      }
    }
  });

  it("월드 거리에서 같은 12종 머리 실루엣을 낮은 밀도로 그린다", () => {
    for (const animal of ANIMAL_IDS) {
      const close = detailedAnimalHead(animal);
      const world = detailedAnimalHead(animal, "world");
      expect(triangles(world), animal).toBeLessThan(triangles(close));
      expect(world.boundingBox!.min.distanceTo(close.boundingBox!.min), animal).toBeLessThan(0.045);
      expect(world.boundingBox!.max.distanceTo(close.boundingBox!.max), animal).toBeLessThan(0.045);
    }
  });

  it("개구리 중절모의 몸통과 챙이 튀어나온 양쪽 눈을 관통하지 않는다", () => {
    const c = createCharacter(0, "mafia", undefined, "frog");
    const head = c.root.getObjectByName("neck")!.children[0] as Mesh;
    const { geometry } = head;
    const positions = geometry.getAttribute("position");
    const colors = geometry.getAttribute("color");
    const indices = geometry.index!;
    const hatColors = ["#1a1d24", "#8e0b21"].map((value) => new Color(value));
    const colorOf = new Color();
    const isHat = (index: number) => {
      colorOf.fromBufferAttribute(colors, index);
      return hatColors.some((color) => Math.abs(color.r - colorOf.r) < 0.0001 && Math.abs(color.g - colorOf.g) < 0.0001 && Math.abs(color.b - colorOf.b) < 0.0001);
    };
    const origin = new Vector3();
    const nearest = new Vector3();
    const triangle = new Triangle();
    const inverseEyeRadii = new Vector3(1 / 0.206, 1 / 0.21, 1 / 0.188);
    // 동물 머리 y 0.431에서 개구리 눈 중심 offset [±0.29, 0.24, 0.22].
    const eyeCenters = [new Vector3(-0.29, 0.671, 0.22), new Vector3(0.29, 0.671, 0.22)];
    let clearance = Number.POSITIVE_INFINITY;
    let tested = 0;
    for (let i = 0; i < indices.count; i += 3) {
      const a = indices.getX(i), b = indices.getX(i + 1), d = indices.getX(i + 2);
      if (!isHat(a) || !isHat(b) || !isHat(d)) continue;
      tested++;
      for (const center of eyeCenters) {
        triangle.a.fromBufferAttribute(positions, a).sub(center).multiply(inverseEyeRadii);
        triangle.b.fromBufferAttribute(positions, b).sub(center).multiply(inverseEyeRadii);
        triangle.c.fromBufferAttribute(positions, d).sub(center).multiply(inverseEyeRadii);
        triangle.closestPointToPoint(origin, nearest);
        clearance = Math.min(clearance, nearest.length());
      }
    }
    expect(tested).toBeGreaterThan(0);
    expect(clearance).toBeGreaterThan(1);
    c.dispose();
  });

  it("동물의 소매와 바짓단이 흔들리는 관절축 안쪽까지 들어온다", () => {
    const c = createCharacter(0, "coat", undefined, "fox");
    for (const joint of ["armA", "armB", "legA", "legB"]) {
      const mesh = c.root.getObjectByName(joint)!.children[0] as Mesh;
      mesh.geometry.computeBoundingBox();
      expect(mesh.geometry.boundingBox!.max.y, joint).toBeGreaterThan(0.08);
    }
    c.dispose();
  });

  it("역할 의상과 종 변경을 같은 움직이는 모델에 적용한다", () => {
    const c = createCharacter(0, "coat", undefined, "rabbit");
    const head = c.root.getObjectByName("neck")!.children[0] as Mesh;
    const torso = c.root.getObjectByName("body")!.children.find((obj) => (obj as Mesh).isMesh)! as Mesh;
    const hasSculpt = (animal: AnimalId): boolean => {
      const sculpt = detailedAnimalHead(animal);
      const positions = head.geometry.getAttribute("position").array;
      const colors = head.geometry.getAttribute("color").array;
      return sculpt.getAttribute("position").array.every((value, i) => positions[i] === value) &&
        sculpt.getAttribute("color").array.every((value, i) => colors[i] === value);
    };
    const hasColor = (mesh: Mesh, hex: string): boolean => {
      const rgb = new Color(hex);
      const attr = mesh.geometry.getAttribute("color");
      for (let i = 0; i < attr.count; i++) {
        if (Math.abs(attr.getX(i) - rgb.r) < 0.0001 && Math.abs(attr.getY(i) - rgb.g) < 0.0001 && Math.abs(attr.getZ(i) - rgb.b) < 0.0001) return true;
      }
      return false;
    };
    c.root.position.set(2, 0, -2);
    c.setYaw(0.7);
    c.prewarm();
    const before = head.geometry;
    const disposed = vi.fn();
    before.addEventListener("dispose", disposed);
    c.applyOutfit("mafia");
    expect(hasSculpt("rabbit")).toBe(true);
    expect(hasColor(head, "#14161c")).toBe(true); // 선글라스
    expect(hasColor(head, "#8e0b21")).toBe(true); // 붉은 모자띠
    expect(disposed).toHaveBeenCalledOnce();
    c.applyAnimal("elephant");
    expect(hasSculpt("elephant")).toBe(true);
    expect(hasColor(head, "#14161c")).toBe(true);
    c.applyOutfit("police");
    expect(hasSculpt("elephant")).toBe(true);
    expect(hasColor(head, "#2a4372")).toBe(true);
    expect(hasColor(torso, "#c9d3ea")).toBe(true);
    c.applyOutfit("doctor");
    expect(hasSculpt("elephant")).toBe(true);
    expect(hasColor(torso, "#2FA4A0")).toBe(true);
    expect(c.root.position.toArray()).toEqual([2, 0, -2]);
    expect(c.root.rotation.y).toBe(0.7);
    c.dispose();
  });
});

describe("동작 표 무결성 (D-15)", () => {
  it("EMOTE_IDS(프로토콜)와 EMOTES 키 집합이 같다", () => {
    expect(Object.keys(EMOTES).sort()).toEqual([...EMOTE_IDS].sort());
  });

  it.each(EMOTE_IDS)("%s: 프레임 키는 EMOTE_KEYS + face 안, face 값은 FACE_IDS 안", (id) => {
    const allowed = new Set<string>([...EMOTE_KEYS, "face"]);
    const faces = new Set<string>(FACE_IDS);
    for (const fr of EMOTES[id as EmoteId].frames) {
      for (const [k, v] of Object.entries(fr)) {
        expect(allowed.has(k), `${id}: 알 수 없는 키 ${k}`).toBe(true);
        if (k === "face") expect(faces.has(String(v)), `${id}: 알 수 없는 표정 ${String(v)}`).toBe(true);
      }
    }
  });

  it.each(EMOTE_IDS)("%s: EMOTE_MS 가 표에서 계산한 값과 같다", (id) => {
    const d = EMOTES[id as EmoteId];
    expect(EMOTE_MS[id]).toBe(Math.round((d.frames.length * d.seg * d.cycles + d.hold) * 1000));
  });
});

describe("에셋 출처 기록 (T-10-20)", () => {
  const manifest = JSON.parse(readFileSync(new URL("../../design/characters/manifest.json", import.meta.url), "utf8")) as {
    assets: { id: string; source?: string; external_dependency?: boolean; files?: string[] }[];
  };
  it("manifest 에 figure-3d 항목이 있고 외부 의존이 없다", () => {
    const a = manifest.assets.find((x) => x.id === "figure-3d");
    expect(a).toBeDefined();
    expect(a?.external_dependency).toBe(false);
    expect(a?.source).toContain("NP1XfUrYTTqQ5nAB1HKYT5");
    expect((a?.files ?? []).length).toBeGreaterThan(0);
  });
});
