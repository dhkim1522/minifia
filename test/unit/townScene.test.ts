// 마을 장면(maps/town.ts)을 WebGL 없이 node 에서 검사한다: 광장 가운데 재사용·방 넷·집 여덟·그리기 예산·조명 열·강등 (20페이즈 D-05~D-10·D-20·D-21).
// 모범은 plazaScene.test.ts. 좌표 원문은 shared/game/mapTown.ts(서버와 같은 표), 생김새의 기준은 design/v3.0/town-map/ 의 A 안.
import { Box3, BufferGeometry, DirectionalLight, HemisphereLight, Material, Mesh, MeshBasicMaterial, Object3D, PlaneGeometry, PointLight, Scene, Vector3 } from "three";
import { describe, expect, it } from "vitest";
import { TOWN_ROOM_OUTER } from "../../shared/game/mapTown";
import { ROOM_IDS } from "../../shared/protocol";
import { plateFarOf } from "../../src/world/camera";
import { createCharacter, figForSeat } from "../../src/world/character";
import { buildTownScene } from "../../src/world/maps/town";
import { TOWN_LIT } from "../../src/world/palette";
import { DRAW_CALL_BUDGET, LADDER } from "../../src/world/renderer";
import type { LightingPhase } from "../../src/world/renderer";

const PHASES: readonly LightingPhase[] = ["talk", "vote", "trial", "night", "nightCitizen", "nightGhost", "morning"];

function visibleMeshes(root: Object3D): Mesh[] {
  const out: Mesh[] = [];
  root.traverseVisible((o) => {
    if ((o as Mesh).isMesh) out.push(o as Mesh);
  });
  return out;
}
function allMeshes(root: Object3D): Mesh[] {
  const out: Mesh[] = [];
  root.traverse((o) => {
    if ((o as Mesh).isMesh) out.push(o as Mesh);
  });
  return out;
}
function lightsOf<T>(root: Object3D, ctor: new (...a: never[]) => T): T[] {
  const out: T[] = [];
  root.traverse((o) => {
    if (o instanceof (ctor as unknown as new () => object)) out.push(o as unknown as T);
  });
  return out;
}
function worldVertices(mesh: Mesh): Vector3[] {
  mesh.updateWorldMatrix(true, false);
  const pos = (mesh.geometry as BufferGeometry).getAttribute("position");
  const out: Vector3[] = [];
  for (let i = 0; i < pos.count; i++) out.push(new Vector3().fromBufferAttribute(pos, i).applyMatrix4(mesh.matrixWorld));
  return out;
}
const hasVertex = (mesh: Mesh, p: [number, number, number], tol = 0.02): boolean => worldVertices(mesh).some((v) => v.distanceTo(new Vector3(...p)) <= tol);
const mats = (m: Mesh): Material[] => (Array.isArray(m.material) ? m.material : [m.material]);
const boxOf = (m: Mesh): Box3 => new Box3().setFromPoints(worldVertices(m));
const scalar = (m: Mesh): number => (m.material as MeshBasicMaterial).color.r;

/** 20-04 가 더한 메시 이름: 방·집의 몸(그림자 받기만), 강등 4단계가 끄는 장식 */
const BODY = ["roomStatic", "roomProps", "houseBody", ...ROOM_IDS.map((id) => `cut-${id}`)];
const DECOR = ["roomProps", "houseMark", ...ROOM_IDS.map((id) => `sign-${id}`)];

describe("마을 장면 구조 (D-05·D-06·D-07·D-21)", () => {
  it("WebGL 없이 node 에서 만들어지고 MapScene 메서드 전부와 마을 훅 셋(setCutaway·setOwners·roofs)이 있다", () => {
    const t = buildTownScene(LADDER[0]!);
    expect(t.root).toBeInstanceOf(Scene);
    for (const k of ["setLighting", "setChalk", "setSelfLight", "setTension", "setPin", "applyBudget", "dispose", "update", "setCutaway", "setOwners", "roofs"] as const) expect(typeof t[k], k).toBe("function");
    expect(t.markers.ring.group.visible).toBe(false);
    expect(t.plate).toBeInstanceOf(Mesh);
    t.dispose();
  });

  it("점광원은 3 그대로(무대 위·가로등 하나·내 캐릭터), 반구광 1, 달빛 방향광 1 — 방·집은 점광원을 더하지 않는다 (P20-13)", () => {
    const t = buildTownScene(LADDER[0]!);
    expect(lightsOf(t.root, PointLight)).toHaveLength(3);
    expect(lightsOf(t.root, HemisphereLight)).toHaveLength(1);
    expect(lightsOf(t.root, DirectionalLight)).toHaveLength(1);
    t.dispose();
  });

  it("가운데는 광장 그대로다: 연단 윗면 0.46, 시계탑 기단 (−4.3, −4.3), 가로등 넷, 시계 바늘 (D-05)", () => {
    const t = buildTownScene(LADDER[0]!);
    const furniture = t.meshes.furniture!;
    expect(hasVertex(furniture, [0, 0.46, 0])).toBe(true);
    expect(hasVertex(furniture, [-4.3 - 1.3, 0, -4.3 - 1.3])).toBe(true);
    expect(hasVertex(furniture, [-4.3 + 1.3, 0.8, -4.3 + 1.3])).toBe(true);
    for (const [x, z] of [
      [3.8, -2.4],
      [-2.4, 3.8],
      [-3.6, 1.0],
      [1.0, -3.6],
    ] as const)
      expect(hasVertex(furniture, [x, 2.6, z]), `${x},${z}`).toBe(true);
    for (const n of ["brass", "emissiveRoom", "emissiveTower", "handHour0", "handMinute1"]) expect(t.meshes[n], n).toBeInstanceOf(Mesh);
    t.dispose();
  });

  it("광장 뒤 건물 앞면 넷은 만들지 않는다: 가운데 소품은 ±6.5 안에만 있고 불 켜진 건물 창 묶음이 없다 (D-05)", () => {
    const t = buildTownScene(LADDER[0]!);
    // 광장 장면의 건물 앞면은 z −7.4 · x −7.4 에 서는 높이 3.8 이상 상자다 — 마을에서는 그 자리가 방·집이다
    const far = worldVertices(t.meshes.furniture!).filter((v) => v.x < -6.5 || v.z < -6.5);
    expect(far).toHaveLength(0);
    expect(t.meshes.emissiveRoomFar).toBeUndefined();
    t.dispose();
  });

  it("바닥 판은 24×24(±12, 윗면 −0.01), 연장 판 반폭은 plateFarOf(\"town\") 이다 (치수표 A)", () => {
    const t = buildTownScene(LADDER[0]!);
    const shell = boxOf(t.meshes.shell!);
    expect(shell.min.x).toBeCloseTo(-12, 5);
    expect(shell.max.x).toBeCloseTo(12, 5);
    expect(shell.min.z).toBeCloseTo(-12, 5);
    expect(shell.max.z).toBeCloseTo(12, 5);
    expect(hasVertex(t.meshes.shell!, [12, -0.01, 12])).toBe(true);
    expect(plateFarOf("town")).toBe(22);
    const plate = (t.plate.geometry as PlaneGeometry).parameters;
    expect(plate.width).toBe(plateFarOf("town") * 2);
    expect(plate.height).toBe(plateFarOf("town") * 2);
    t.dispose();
  });

  it("방 넷의 컷 메시(지붕·앞벽)가 방 id 이름으로 있고 바깥 윤곽 안에 서며 꼭대기가 2.36 이다 (D-06, P20-1)", () => {
    const t = buildTownScene(LADDER[0]!);
    for (const id of ROOM_IDS) {
      const cut = t.meshes[`cut-${id}`];
      expect(cut, id).toBeInstanceOf(Mesh);
      const b = boxOf(cut!);
      const o = TOWN_ROOM_OUTER[id];
      expect(b.min.x, id).toBeGreaterThanOrEqual(o.x0 / 100 - 0.15);
      expect(b.max.x, id).toBeLessThanOrEqual(o.x1 / 100 + 0.15);
      expect(b.min.z, id).toBeGreaterThanOrEqual(o.z0 / 100 - 0.15);
      expect(b.max.z, id).toBeLessThanOrEqual(o.z1 / 100 + 0.15);
      // 지붕은 바깥 윤곽을 다 덮는다
      expect(b.min.x, id).toBeCloseTo(o.x0 / 100, 5);
      expect(b.max.z, id).toBeCloseTo(o.z1 / 100, 5);
      expect(b.max.y, id).toBeCloseTo(2.36, 5);
      expect(t.meshes[`sign-${id}`], id).toBeInstanceOf(Mesh);
    }
    // 뒷벽·실내 바닥은 컷 메시가 아니라 정적 묶음이다: 벽 꼭대기 2.2
    expect(boxOf(t.meshes.roomStatic!).max.y).toBeCloseTo(2.2, 5);
    t.dispose();
  });

  it("집 몸 묶음의 꼭대기는 1.96 이고(방보다 낮다) 문패·지붕 표식·창 묶음이 있다 (D-07, P20-1)", () => {
    const t = buildTownScene(LADDER[0]!);
    const body = boxOf(t.meshes.houseBody!);
    expect(body.max.y).toBeCloseTo(1.96, 5);
    // 집 여덟: 가운데 (±5.0, ±8.4)·(±8.4, ±5.0), 지붕판 2.6 → 바깥 끝 ±9.7
    expect(body.min.x).toBeCloseTo(-9.7, 5);
    expect(body.max.x).toBeCloseTo(9.7, 5);
    expect(body.min.z).toBeCloseTo(-9.7, 5);
    expect(body.max.z).toBeCloseTo(9.7, 5);
    for (const n of ["housePlate", "houseMark", "houseWinLit", "houseWinDark"]) expect(t.meshes[n], n).toBeInstanceOf(Mesh);
    t.dispose();
  });

  it("방·집 메시는 그림자를 받기만 하고 드리우지 않는다 (P20-14)", () => {
    const t = buildTownScene(LADDER[0]!);
    for (const n of BODY) {
      const m = t.meshes[n];
      expect(m, n).toBeInstanceOf(Mesh);
      expect(m!.castShadow, n).toBe(false);
      expect(m!.receiveShadow, n).toBe(true);
    }
    for (const n of ["housePlate", "houseMark", "houseWinLit", "houseWinDark", "emissiveIndoor", "glowIndoor", ...ROOM_IDS.map((id) => `sign-${id}`)]) expect(t.meshes[n]!.castShadow, n).toBe(false);
    t.dispose();
  });
});

describe("마을 그리기 예산 (D-21, P20-17, T-20-15)", () => {
  it("캐릭터 없이 보이는 메시 수(정적 그리기 호출 추정)는 36 이하다 — 집 주인이 없을 때도, 여덟일 때도", () => {
    const t = buildTownScene(LADDER[0]!);
    for (const owners of [[], [0, 2, 5], [0, 1, 2, 3, 4, 5, 6, 7]]) {
      t.setOwners!(owners);
      for (const ph of PHASES) {
        t.setLighting(ph);
        expect(visibleMeshes(t.root).length, `${owners.length}/${ph}`).toBeLessThanOrEqual(36);
      }
    }
    // 새로 느는 것은 광장 것 밖의 병합 묶음뿐이다: 방 넷이 메시 넷이 아니라 묶음 하나씩이다
    expect(allMeshes(t.root).filter((m) => m.name.startsWith("cut-"))).toHaveLength(4);
    expect(allMeshes(t.root).filter((m) => m.name.startsWith("sign-"))).toHaveLength(4);
    t.dispose();
  });

  it("캐릭터 8명(의상 섞음)이 서 있어도 보이는 메시 + 그림자 메시 합이 DRAW_CALL_BUDGET 이하다", () => {
    const t = buildTownScene(LADDER[0]!);
    t.setOwners!([0, 1, 2, 3, 4, 5, 6, 7]);
    const outfits = ["coat", "police", "doctor", "mafia"] as const;
    const chars = Array.from({ length: 8 }, (_, i) => createCharacter(figForSeat(i), outfits[i % outfits.length]!));
    for (const c of chars) t.root.add(c.root);
    for (const ph of PHASES) {
      t.setLighting(ph);
      const vis = visibleMeshes(t.root);
      expect(vis.length + vis.filter((m) => m.castShadow).length, ph).toBeLessThanOrEqual(DRAW_CALL_BUDGET);
    }
    for (const c of chars) c.dispose();
    t.dispose();
  });

  it("재질을 방·집마다 새로 만들지 않는다: 고유 재질 26 이하(광장 13 + 컷 4 + 간판 4 + 방 발광·집 창·빛 무리·아틀라스 4)", () => {
    const t = buildTownScene(LADDER[0]!);
    const set = new Set<Material>();
    for (const m of allMeshes(t.root)) for (const x of mats(m)) set.add(x);
    expect(set.size).toBeLessThanOrEqual(26);
    t.dispose();
  });
});

describe("마을 조명 열 TOWN_LIT (D-09, P20-13)", () => {
  it("setLighting 일곱 단계가 던지지 않고 점광원 수가 그대로다", () => {
    const t = buildTownScene(LADDER[0]!);
    const n = lightsOf(t.root, PointLight).length;
    for (const ph of PHASES) {
      expect(() => t.setLighting(ph), ph).not.toThrow();
      expect(lightsOf(t.root, PointLight)).toHaveLength(n);
    }
    t.dispose();
  });

  it("방 벽등·문턱 띠 발광 배율은 TOWN_LIT[단계].indoor, 주인 있는 집 창은 houseOwned 다. 시민 편 밤은 둘 다 0", () => {
    const t = buildTownScene(LADDER[0]!);
    t.setOwners!([0, 1]);
    for (const ph of PHASES) {
      t.setLighting(ph);
      expect(scalar(t.meshes.emissiveIndoor!), ph).toBeCloseTo(TOWN_LIT[ph].indoor, 6);
      expect(scalar(t.meshes.houseWinLit!), ph).toBeCloseTo(TOWN_LIT[ph].houseOwned, 6);
      expect((t.meshes.glowIndoor!.material as MeshBasicMaterial).opacity, ph).toBeCloseTo(TOWN_LIT[ph].indoor, 6);
      expect(t.meshes.glowIndoor!.visible, ph).toBe(TOWN_LIT[ph].indoor > 0);
    }
    t.setLighting("nightCitizen");
    expect(scalar(t.meshes.emissiveIndoor!)).toBe(0);
    expect(scalar(t.meshes.houseWinLit!)).toBe(0);
    t.dispose();
  });

  it("핀 조명이 켜지면 방 등·집 창도 광장 가로등과 같은 비율로 어두워지고 풀면 돌아온다", () => {
    const t = buildTownScene(LADDER[0]!);
    t.setOwners!([3]);
    t.setLighting("vote");
    t.setPin({ x: 0, z: 0, strength: 1 }, 0.4);
    expect(scalar(t.meshes.emissiveIndoor!)).toBeCloseTo(TOWN_LIT.vote.indoor * 0.4, 6);
    expect(scalar(t.meshes.houseWinLit!)).toBeCloseTo(TOWN_LIT.vote.houseOwned * 0.4, 6);
    t.setPin(null, 1);
    expect(scalar(t.meshes.emissiveIndoor!)).toBeCloseTo(TOWN_LIT.vote.indoor, 6);
    t.dispose();
  });
});

describe("마을 예산 사다리 (P20-17, 강등 4단계)", () => {
  it("LADDER 0 → 4 → 0: 4단계는 간판·지붕 표식·방 소품을 끄고(몸통·문패·창은 남는다) 0 으로 돌아오면 다시 보인다", () => {
    const t = buildTownScene(LADDER[0]!);
    t.setOwners!([0, 1, 2]);
    const n0 = visibleMeshes(t.root).length;
    for (const n of DECOR) expect(t.meshes[n]!.visible, n).toBe(true);
    t.applyBudget(LADDER[4]!);
    expect(LADDER[4]!.props).toBe("reduced");
    for (const n of DECOR) expect(t.meshes[n]!.visible, n).toBe(false);
    for (const n of ["roomStatic", "houseBody", "housePlate", "houseWinDark", ...ROOM_IDS.map((id) => `cut-${id}`)]) expect(t.meshes[n]!.visible, n).toBe(true);
    expect(visibleMeshes(t.root).length).toBeLessThan(n0);
    t.applyBudget(LADDER[0]!);
    for (const n of DECOR) expect(t.meshes[n]!.visible, n).toBe(true);
    expect(visibleMeshes(t.root).length).toBe(n0);
    t.dispose();
  });

  it("사다리 각 단계 × 일곱 단계에서 점광원은 3 이하이고 그리기 호출 추정이 상한 이하다(8명)", () => {
    const t = buildTownScene(LADDER[0]!);
    t.setOwners!([0, 1, 2, 3, 4, 5, 6, 7]);
    const chars = Array.from({ length: 8 }, (_, i) => createCharacter(figForSeat(i), (["coat", "police", "doctor", "mafia"] as const)[i % 4]!));
    for (const c of chars) t.root.add(c.root);
    LADDER.forEach((b, i) => {
      t.applyBudget(b);
      for (const ph of PHASES) {
        t.setLighting(ph);
        const vis = visibleMeshes(t.root);
        expect(vis.length + vis.filter((m) => m.castShadow).length, `${i}/${ph}`).toBeLessThanOrEqual(DRAW_CALL_BUDGET);
        let pl = 0;
        t.root.traverseVisible((o) => {
          if ((o as PointLight).isPointLight) pl++;
        });
        expect(pl, `${i}/${ph}`).toBeLessThanOrEqual(3);
      }
    });
    for (const c of chars) c.dispose();
    t.dispose();
  });

  it("dispose 가 지오메트리·재질·텍스처를 해제한다(두 번 불러도 안전)", () => {
    const t = buildTownScene(LADDER[0]!);
    let geo = 0;
    let atlas = 0;
    for (const m of allMeshes(t.root)) m.geometry.addEventListener("dispose", () => geo++);
    const map = (t.meshes.housePlate!.material as { map?: { addEventListener(type: "dispose", fn: () => void): void } | null }).map;
    expect(map).toBeTruthy();
    map!.addEventListener("dispose", () => atlas++);
    t.dispose();
    expect(() => t.dispose()).not.toThrow();
    expect(geo).toBeGreaterThan(0);
    expect(atlas).toBe(1);
  });
});
