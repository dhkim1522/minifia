// 10-06: 인물 에셋 예산 — 인물 5명 × 의상 9종 45조합 (D-15, D-16). `npm run check:character` 의 본체다.
// WebGL 없이 node 에서 장면 그래프만 검사한다. 새 3D 부품은 만들지 않는다(O-4).
import { readFileSync } from "node:fs";
import { Box3, type BufferGeometry, type Mesh, type Object3D, Vector3 } from "three";
import { describe, expect, it } from "vitest";
import { EMOTE_MS } from "../../shared/game/emote";
import { EMOTE_IDS } from "../../shared/protocol";
import { createCharacter } from "../../src/world/character";
import { EMOTE_KEYS, EMOTES, type EmoteId, FACE_IDS, FIGS, OUTFITS, type OutfitId } from "../../src/world/characterData";

const OUTFIT_IDS = Object.keys(OUTFITS) as OutfitId[];
const COMBOS: [number, OutfitId][] = FIGS.flatMap((_, f) => OUTFIT_IDS.map((o): [number, OutfitId] => [f, o]));

const MAX_MESHES = 8;
const MAX_TRIANGLES = 15_000;
const HEIGHT_MIN = 1.5;
/** 높이 밴드 상한: 결정 0068 이 1.9 에서 1.92 로 올렸다(여자 머리 위 기자 모자 1.918). 하한·다른 문턱은 그대로. */
const HEIGHT_MAX = 1.92;
const MAX_OWNED_GEOMETRIES = 14;
const SEATS = 8;
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

describe("인물 에셋 예산 — 45조합 (D-15, D-16)", () => {
  it("조합은 5 × 9 = 45 개다", () => {
    expect(FIGS.length).toBe(5);
    expect(OUTFIT_IDS.length).toBe(9);
    expect(COMBOS.length).toBe(45);
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
    expect(measured.size).toBe(45);
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
