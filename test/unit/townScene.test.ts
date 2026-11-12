// 마을 장면(maps/town.ts)을 WebGL 없이 node 에서 검사한다: 광장 가운데 재사용·방 넷·집 여덟·그리기 예산·조명 열·강등 (20페이즈 D-05~D-10·D-20·D-21).
// 모범은 plazaScene.test.ts. 좌표 원문은 shared/game/mapTown.ts(서버와 같은 표), 생김새의 기준은 design/v3.0/town-map/ 의 A 안.
import { Box3, BufferGeometry, DataTexture, DirectionalLight, HemisphereLight, Material, Mesh, MeshBasicMaterial, MeshStandardMaterial, Object3D, PlaneGeometry, PointLight, Scene, Vector3 } from "three";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TOWN_HOUSES, TOWN_ROOM_OUTER } from "../../shared/game/mapTown";
import { ROOM_IDS } from "../../shared/protocol";
import { plateFarOf } from "../../src/world/camera";
import { createCharacter, figForSeat } from "../../src/world/character";
import { atlasCellAt, buildTownScene, CUTAWAY_MS, drawSeatCell, drawSignCell, TOWN_ATLAS } from "../../src/world/maps/town";
import type { AtlasCtx } from "../../src/world/maps/town";
import type { MapScene } from "../../src/world/maps/types";
import { SEAT_COLORS, TOWN_LIT, TOWN_PALETTE } from "../../src/world/palette";
import { DRAW_CALL_BUDGET, LADDER } from "../../src/world/renderer";
import type { LightingPhase } from "../../src/world/renderer";
import type { RoomId } from "../../shared/protocol";

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

// ---------- Task 2: 컷어웨이 재질 따라가기와 집 주인 ----------

const cutMat = (t: MapScene, id: RoomId): MeshStandardMaterial => t.meshes[`cut-${id}`]!.material as MeshStandardMaterial;
const signMat = (t: MapScene, id: RoomId): MeshStandardMaterial => t.meshes[`sign-${id}`]!.material as MeshStandardMaterial;
const ALL_ROOMS: ReadonlySet<RoomId> = new Set(ROOM_IDS);
const NO_ROOMS: ReadonlySet<RoomId> = new Set();
/** 덮인 방: 불투명 재질·깊이 쓰기 켬·메시와 간판이 보인다 */
function expectClosed(t: MapScene, id: RoomId): void {
  expect(t.roofs!()[id], id).toBe(1);
  for (const m of [cutMat(t, id), signMat(t, id)]) {
    expect(m.transparent, id).toBe(false);
    expect(m.depthWrite, id).toBe(true);
    expect(m.opacity, id).toBe(1);
  }
  expect(t.meshes[`cut-${id}`]!.visible, id).toBe(true);
  expect(t.meshes[`sign-${id}`]!.visible, id).toBe(true);
}
/** 걷힌 방: 메시와 간판을 끈다 */
function expectOpen(t: MapScene, id: RoomId): void {
  expect(t.roofs!()[id], id).toBe(0);
  expect(t.meshes[`cut-${id}`]!.visible, id).toBe(false);
  expect(t.meshes[`sign-${id}`]!.visible, id).toBe(false);
}

describe("컷어웨이 재질 따라가기 setCutaway (D-10, P20-7)", () => {
  it("처음에는 넷 모두 덮여 있다. 한 방을 열면 0.25초에 따라간다: 0.1초 뒤 0 과 1 사이(투명·깊이 쓰기 끔), 0.3초 뒤 0 이고 메시·간판이 꺼진다. 나머지 셋은 그대로다", () => {
    const t = buildTownScene(LADDER[0]!);
    expect(t.roofs!()).toEqual({ post: 1, pub: 1, clinic: 1, police: 1 });
    for (const id of ROOM_IDS) expectClosed(t, id);
    t.setCutaway!(new Set<RoomId>(["post"]), false);
    // 틱이 오기 전에는 그대로다(목표만 바뀐다)
    expect(t.roofs!().post).toBe(1);
    t.update!(0.1, 0.1);
    const a = t.roofs!().post;
    expect(a).toBeCloseTo(0.6, 6);
    for (const m of [cutMat(t, "post"), signMat(t, "post")]) {
      expect(m.transparent).toBe(true);
      expect(m.depthWrite).toBe(false);
      expect(m.opacity).toBeCloseTo(a, 6);
    }
    expect(t.meshes["cut-post"]!.visible).toBe(true);
    t.update!(0.2, 0.3);
    expectOpen(t, "post");
    for (const id of ["pub", "clinic", "police"] as const) expectClosed(t, id);
    t.dispose();
  });

  it("연출 시간 상수 CUTAWAY_MS 는 250 이다(런타임·모션 줄이기가 읽는다)", () => {
    expect(CUTAWAY_MS).toBe(250);
  });

  it("걷히는 도중에 닫으라고 하면 지금 값에서 이어 올라간다 — 0 이나 1 로 건너뛰지 않는다. 다 덮이면 불투명 재질로 돌아온다", () => {
    const t = buildTownScene(LADDER[0]!);
    t.setCutaway!(new Set<RoomId>(["pub"]), false);
    t.update!(0.125, 0.125);
    expect(t.roofs!().pub).toBeCloseTo(0.5, 6);
    t.setCutaway!(NO_ROOMS, false);
    expect(t.roofs!().pub).toBeCloseTo(0.5, 6);
    t.update!(0.05, 0.175);
    expect(t.roofs!().pub).toBeCloseTo(0.7, 6);
    expect(cutMat(t, "pub").transparent).toBe(true);
    // 덮이는 도중에 다시 열어도 지금 값에서 내려간다
    t.setCutaway!(new Set<RoomId>(["pub"]), false);
    t.update!(0.05, 0.225);
    expect(t.roofs!().pub).toBeCloseTo(0.5, 6);
    t.setCutaway!(NO_ROOMS, false);
    t.update!(1, 1.225);
    expectClosed(t, "pub");
    t.dispose();
  });

  it("instant 는 틱 없이 바로 놓는다: 넷 모두 열면 0, 모두 닫으면 1 이고 불투명 재질·깊이 쓰기 켬. 그 뒤의 틱은 값을 바꾸지 않는다", () => {
    const t = buildTownScene(LADDER[0]!);
    t.setCutaway!(ALL_ROOMS, true);
    for (const id of ROOM_IDS) expectOpen(t, id);
    t.update!(0.1, 0.1);
    for (const id of ROOM_IDS) expectOpen(t, id);
    t.setCutaway!(NO_ROOMS, true);
    for (const id of ROOM_IDS) expectClosed(t, id);
    t.update!(0.1, 0.2);
    for (const id of ROOM_IDS) expectClosed(t, id);
    // 도중 값에서도 instant 는 바로 목표로 간다
    t.setCutaway!(new Set<RoomId>(["clinic"]), false);
    t.update!(0.1, 0.3);
    t.setCutaway!(new Set<RoomId>(["clinic"]), true);
    expectOpen(t, "clinic");
    t.dispose();
  });

  it("dt 가 0 이거나 음수면 움직이지 않는다", () => {
    const t = buildTownScene(LADDER[0]!);
    t.setCutaway!(new Set<RoomId>(["police"]), false);
    t.update!(0, 0);
    t.update!(-1, 0);
    expect(t.roofs!().police).toBe(1);
    t.dispose();
  });

  it("뒷벽·실내 바닥·소품·벽등·문턱 띠는 걷힘과 무관하게 늘 보인다. 집은 걷히지 않는다", () => {
    const t = buildTownScene(LADDER[0]!);
    const keep = ["roomStatic", "roomProps", "emissiveIndoor", "glowIndoor", "houseBody", "housePlate", "houseMark"];
    t.setCutaway!(ALL_ROOMS, true);
    for (const n of keep) expect(t.meshes[n]!.visible, n).toBe(true);
    t.setCutaway!(new Set<RoomId>(["post"]), false);
    t.update!(0.1, 0.1);
    for (const n of keep) expect(t.meshes[n]!.visible, n).toBe(true);
    // 걷힌 방은 그리기 호출이 둘씩 준다(컷 메시·간판)
    const t2 = buildTownScene(LADDER[0]!);
    const n0 = visibleMeshes(t2.root).length;
    t2.setCutaway!(ALL_ROOMS, true);
    expect(visibleMeshes(t2.root).length).toBe(n0 - 8);
    t.dispose();
    t2.dispose();
  });

  it("강등 4단계와 함께: 덮인 방의 간판은 4단계에서 꺼지고 0 으로 돌아오면 켜진다. 걷힌 방의 간판은 어느 단계에서도 꺼져 있다", () => {
    const t = buildTownScene(LADDER[0]!);
    t.setCutaway!(new Set<RoomId>(["post"]), true);
    t.applyBudget(LADDER[4]!);
    expect(t.meshes["sign-post"]!.visible).toBe(false);
    expect(t.meshes["sign-pub"]!.visible).toBe(false);
    expect(t.meshes["cut-pub"]!.visible).toBe(true);
    t.applyBudget(LADDER[0]!);
    expect(t.meshes["sign-post"]!.visible).toBe(false);
    expect(t.meshes["cut-post"]!.visible).toBe(false);
    expect(t.meshes["sign-pub"]!.visible).toBe(true);
    t.dispose();
  });
});

/** 병합 묶음의 판 수(판 하나 = 정점 4) */
const quads = (m: Mesh): number => (m.geometry.getAttribute("position")?.count ?? 0) / 4;
/** quad 번째 판의 UV 가운데가 가리키는 아틀라스 칸 */
function cellOfQuad(m: Mesh, quad: number): number {
  const uv = m.geometry.getAttribute("uv");
  let u = 0;
  let v = 0;
  for (let k = 0; k < 4; k++) {
    u += uv.getX(quad * 4 + k) / 4;
    v += uv.getY(quad * 4 + k) / 4;
  }
  return atlasCellAt(u, v);
}
/** 집 한 채의 창 수: 면마다 둘 */
const PANES = 8;

describe("집 주인 setOwners (D-07, P20-6)", () => {
  it("처음에는 모든 집이 주인 없는 집이다: 창 64칸이 모두 꺼진 묶음이고 문패·지붕 표식은 빈 판 칸을 가리킨다", () => {
    const t = buildTownScene(LADDER[0]!);
    expect(quads(t.meshes.houseWinDark!)).toBe(8 * PANES);
    expect(quads(t.meshes.houseWinLit!)).toBe(0);
    expect(t.meshes.houseWinLit!.visible).toBe(false);
    for (let i = 0; i < 8; i++) {
      expect(cellOfQuad(t.meshes.housePlate!, i), `plate ${i}`).toBe(TOWN_ATLAS.blank);
      expect(cellOfQuad(t.meshes.houseMark!, i), `mark ${i}`).toBe(TOWN_ATLAS.blank);
    }
    t.dispose();
  });

  it("setOwners([0, 2, 5]): 켜진 창 = 3채 × 8, 꺼진 창 = 5채 × 8. 문패·지붕 표식의 UV 가 0·2·5 는 좌석 칸, 나머지는 빈 판 칸이다", () => {
    const t = buildTownScene(LADDER[0]!);
    t.setOwners!([0, 2, 5]);
    expect(quads(t.meshes.houseWinLit!)).toBe(3 * PANES);
    expect(quads(t.meshes.houseWinDark!)).toBe(5 * PANES);
    expect(t.meshes.houseWinLit!.visible).toBe(true);
    expect(t.meshes.houseWinDark!.visible).toBe(true);
    TOWN_HOUSES.forEach((h, i) => {
      const want = [0, 2, 5].includes(h.seat) ? TOWN_ATLAS.seat0 + h.seat : TOWN_ATLAS.blank;
      expect(cellOfQuad(t.meshes.housePlate!, i), `plate ${h.seat}`).toBe(want);
      expect(cellOfQuad(t.meshes.houseMark!, i), `mark ${h.seat}`).toBe(want);
    });
    // 켜진 창은 주인 있는 집 둘레에만 있다
    const lit = boxOf(t.meshes.houseWinLit!);
    expect(lit.min.x).toBeLessThan(-5.0);
    expect(lit.max.x).toBeGreaterThan(8.4);
    expect(lit.min.z).toBeLessThan(-8.4);
    expect(lit.max.z).toBeGreaterThan(8.4);
    // 강등 4단계에서도 창과 문패는 남는다(지붕 표식만 꺼진다)
    t.applyBudget(LADDER[4]!);
    expect(t.meshes.houseWinLit!.visible).toBe(true);
    expect(t.meshes.housePlate!.visible).toBe(true);
    expect(t.meshes.houseMark!.visible).toBe(false);
    t.dispose();
  });

  it("다시 부르면 그 값으로 바뀐다: 여덟 모두 주인이면 꺼진 창 묶음이 비고, setOwners([]) 면 모든 집이 빈 판·꺼진 창이다. 범위 밖 좌석은 무시한다", () => {
    const t = buildTownScene(LADDER[0]!);
    t.setOwners!([0, 1, 2, 3, 4, 5, 6, 7]);
    expect(quads(t.meshes.houseWinLit!)).toBe(8 * PANES);
    expect(quads(t.meshes.houseWinDark!)).toBe(0);
    expect(t.meshes.houseWinDark!.visible).toBe(false);
    for (let i = 0; i < 8; i++) expect(cellOfQuad(t.meshes.houseMark!, i)).toBe(TOWN_ATLAS.seat0 + TOWN_HOUSES[i]!.seat);
    t.setOwners!([]);
    expect(quads(t.meshes.houseWinLit!)).toBe(0);
    expect(quads(t.meshes.houseWinDark!)).toBe(8 * PANES);
    for (let i = 0; i < 8; i++) {
      expect(cellOfQuad(t.meshes.housePlate!, i)).toBe(TOWN_ATLAS.blank);
      expect(cellOfQuad(t.meshes.houseMark!, i)).toBe(TOWN_ATLAS.blank);
    }
    expect(() => t.setOwners!([-1, 8, 1.5, 3])).not.toThrow();
    expect(quads(t.meshes.houseWinLit!)).toBe(1 * PANES);
    expect(cellOfQuad(t.meshes.housePlate!, 3)).toBe(TOWN_ATLAS.seat0 + 3);
    t.dispose();
  });

  it("아틀라스 칸: 간판 넷·좌석 여덟·빈 판 하나가 서로 다른 칸이고 방 간판은 자기 방의 칸을 가리킨다", () => {
    const cells = [...ROOM_IDS.map((id) => TOWN_ATLAS.sign[id]), ...Array.from({ length: 8 }, (_, n) => TOWN_ATLAS.seat0 + n), TOWN_ATLAS.blank];
    expect(new Set(cells).size).toBe(13);
    for (const c of cells) expect(c).toBeLessThan(TOWN_ATLAS.cols * TOWN_ATLAS.rows);
    const t = buildTownScene(LADDER[0]!);
    for (const id of ROOM_IDS) expect(cellOfQuad(t.meshes[`sign-${id}`]!, 0), id).toBe(TOWN_ATLAS.sign[id]);
    t.dispose();
  });

  it("node(document 없음)에서 아틀라스는 1×1 DataTexture 이고 간판·문패·표식이 같은 텍스처를 나눠 쓴다. setOwners 가 던지지 않는다", () => {
    const t = buildTownScene(LADDER[0]!);
    const map = (t.meshes.housePlate!.material as MeshStandardMaterial).map;
    expect(map).toBeInstanceOf(DataTexture);
    expect((map!.image as { width: number; height: number }).width).toBe(1);
    expect((t.meshes.houseMark!.material as MeshStandardMaterial).map).toBe(map);
    for (const id of ROOM_IDS) expect(signMat(t, id).map, id).toBe(map);
    expect(() => t.setOwners!([0, 1, 2, 3, 4, 5, 6, 7])).not.toThrow();
    t.dispose();
  });
});

/** 캔버스 2D 문맥을 흉내 낸 객체: 부른 메서드와 인자를 적는다. 글자 그리기(fillText)는 없다 — 부르면 던진다(결정 0051) */
function fakeCtx(): { ctx: AtlasCtx; calls: Record<string, unknown[][]>; styles: { fill: string[]; stroke: string[] } } {
  const calls: Record<string, unknown[][]> = {};
  const styles = { fill: [] as string[], stroke: [] as string[] };
  const raw: Record<string, unknown> = { lineWidth: 0, lineCap: "", lineJoin: "" };
  for (const n of ["save", "restore", "beginPath", "closePath", "moveTo", "arcTo", "arc", "fill", "stroke", "clip", "clearRect", "fillRect", "drawImage", "translate", "scale"])
    raw[n] = (...a: unknown[]): void => {
      (calls[n] ??= []).push(a);
    };
  Object.defineProperty(raw, "fillStyle", { set: (v: string) => styles.fill.push(v), get: () => styles.fill.at(-1) ?? "" });
  Object.defineProperty(raw, "strokeStyle", { set: (v: string) => styles.stroke.push(v), get: () => styles.stroke.at(-1) ?? "" });
  return { ctx: raw as unknown as AtlasCtx, calls, styles };
}

describe("아틀라스 그리기 함수 (UI Considerations partial, D-20)", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("얼굴 그림이 오기 전에는 좌석 색 원만 그린다(drawImage 없음). 얼굴이 오면 그 칸 안에 drawImage 한 번", () => {
    const cell = TOWN_ATLAS.seat0 + 2;
    const px = TOWN_ATLAS.cellPx;
    const x0 = (cell % TOWN_ATLAS.cols) * px;
    const y0 = Math.floor(cell / TOWN_ATLAS.cols) * px;
    const before = fakeCtx();
    drawSeatCell(before.ctx, cell, 2, null);
    expect(before.calls.arc).toHaveLength(1);
    expect(before.calls.fill).toHaveLength(1);
    expect(before.styles.fill).toEqual([SEAT_COLORS[2]]);
    expect(before.calls.drawImage).toBeUndefined();
    // 원은 그 칸 가운데에 있고 칸을 넘지 않는다
    const [cx, cy, r] = before.calls.arc![0] as [number, number, number];
    expect(cx).toBe(x0 + px / 2);
    expect(cy).toBe(y0 + px / 2);
    expect(r).toBeLessThanOrEqual(px / 2);
    expect(r).toBeGreaterThan(px * 0.4);

    const after = fakeCtx();
    const face = { tag: "face" } as unknown as CanvasImageSource;
    drawSeatCell(after.ctx, cell, 2, face);
    expect(after.styles.fill).toEqual([SEAT_COLORS[2]]);
    expect(after.calls.clip).toHaveLength(1);
    expect(after.calls.drawImage).toHaveLength(1);
    const [img, dx, dy, dw, dh] = after.calls.drawImage![0] as [unknown, number, number, number, number];
    expect(img).toBe(face);
    expect(dx).toBeGreaterThanOrEqual(x0);
    expect(dy).toBeGreaterThanOrEqual(y0);
    expect(dx + dw).toBeLessThanOrEqual(x0 + px);
    expect(dy + dh).toBeLessThanOrEqual(y0 + px);
    // 그리기 상태를 남기지 않는다(잘라 내기가 다음 칸에 새지 않게)
    expect(after.calls.save).toHaveLength(after.calls.restore!.length);
  });

  it("좌석 8 이상·음수도 face-0~7 과 같은 규칙으로 좌석 색을 고른다", () => {
    const a = fakeCtx();
    drawSeatCell(a.ctx, TOWN_ATLAS.seat0, 9, null);
    drawSeatCell(a.ctx, TOWN_ATLAS.seat0, -1, null);
    expect(a.styles.fill).toEqual([SEAT_COLORS[1], SEAT_COLORS[7]]);
  });

  it("간판 그림 넷은 어두운 판 위에 램프 금빛 선(굵기 1.8·둥근 끝)으로만 그린다: 봉투 2 · 잔 3 · 십자 1 · 방패 3 경로, 글자 없음", () => {
    const seen: string[] = [];
    vi.stubGlobal(
      "Path2D",
      class {
        constructor(d: string) {
          seen.push(d);
        }
      },
    );
    const want: Record<RoomId, number> = { post: 2, pub: 3, clinic: 1, police: 3 };
    for (const id of ROOM_IDS) {
      seen.length = 0;
      const c = fakeCtx();
      drawSignCell(c.ctx, TOWN_ATLAS.sign[id], id);
      expect(seen, id).toHaveLength(want[id]);
      expect(c.calls.stroke, id).toHaveLength(want[id]);
      expect(c.calls.fillRect, id).toHaveLength(1);
      expect(c.styles.fill, id).toEqual([TOWN_PALETTE.plate]);
      expect(c.styles.stroke, id).toEqual([TOWN_PALETTE.sign]);
      expect((c.ctx as unknown as { lineWidth: number }).lineWidth, id).toBe(1.8);
      expect((c.ctx as unknown as { lineCap: string }).lineCap, id).toBe("round");
      // 24 격자를 칸에 맞춰 줄인다(선 굵기가 같이 줄어 비율이 1.8/24 로 남는다)
      const [k] = c.calls.scale![0] as [number, number];
      expect(k * 24).toBeLessThanOrEqual(TOWN_ATLAS.cellPx);
      expect(k * 24).toBeGreaterThan(TOWN_ATLAS.cellPx * 0.6);
    }
    // 봉투는 승인 시안(Cutaway)의 경로 그대로다
    seen.length = 0;
    drawSignCell(fakeCtx().ctx, TOWN_ATLAS.sign.post, "post");
    expect(seen).toContain("M5 9l7 5 7-5");
  });

  it("캔버스가 있는 환경: 처음에는 간판 넷·좌석 색 원 여덟·빈 판만 그리고 얼굴을 부르지 않는다. setOwners 가 주인 좌석의 얼굴만 같은 출처 경로로 한 번씩 부르고, 도착하면 그 칸만 다시 그려 텍스처를 올린다. dispose 뒤에 온 얼굴은 버린다 (T-20-16)", () => {
    const c = fakeCtx();
    const canvas = { width: 0, height: 0, getContext: (kind: string) => (kind === "2d" ? c.ctx : null) };
    const images: { src: string; onload: (() => void) | null }[] = [];
    vi.stubGlobal("document", { createElement: (tag: string) => (tag === "canvas" ? canvas : null) });
    vi.stubGlobal("Path2D", class {});
    vi.stubGlobal(
      "Image",
      class {
        onload: (() => void) | null = null;
        private at = "";
        get src(): string {
          return this.at;
        }
        set src(v: string) {
          this.at = v;
          images.push(this);
        }
      },
    );
    const t = buildTownScene(LADDER[0]!);
    const map = (t.meshes.housePlate!.material as MeshStandardMaterial).map!;
    expect(map).not.toBeInstanceOf(DataTexture);
    expect(map.image).toBe(canvas);
    expect(canvas.width).toBe(TOWN_ATLAS.cols * TOWN_ATLAS.cellPx);
    expect(canvas.height).toBe(TOWN_ATLAS.rows * TOWN_ATLAS.cellPx);
    // 간판 넷의 선(2 + 3 + 1 + 3)과 빈 판 윤곽 하나, 좌석 색 원 여덟
    expect(c.calls.stroke).toHaveLength(10);
    expect(c.calls.arc).toHaveLength(8);
    expect(c.styles.fill.filter((x) => (SEAT_COLORS as readonly string[]).includes(x))).toEqual([...SEAT_COLORS]);
    expect(c.calls.drawImage).toBeUndefined();
    expect(images).toHaveLength(0);

    t.setOwners!([2, 5]);
    expect(images.map((i) => i.src)).toEqual(["/characters/faces/face-2.png", "/characters/faces/face-5.png"]);
    // 아직 안 왔다: 원만 있는 채로 그려진다
    expect(c.calls.drawImage).toBeUndefined();
    const v0 = map.version;
    images[0]!.onload!();
    expect(c.calls.drawImage).toHaveLength(1);
    expect(c.calls.drawImage![0]![0]).toBe(images[0]);
    const px = TOWN_ATLAS.cellPx;
    const cell = TOWN_ATLAS.seat0 + 2;
    const dx = c.calls.drawImage![0]![1] as number;
    const dy = c.calls.drawImage![0]![2] as number;
    expect(Math.floor(dx / px)).toBe(cell % TOWN_ATLAS.cols);
    expect(Math.floor(dy / px)).toBe(Math.floor(cell / TOWN_ATLAS.cols));
    expect(map.version).toBe(v0 + 1);
    // 같은 좌석을 다시 주인으로 불러도 얼굴을 또 부르지 않는다
    t.setOwners!([2, 5, 7]);
    expect(images.map((i) => i.src)).toEqual(["/characters/faces/face-2.png", "/characters/faces/face-5.png", "/characters/faces/face-7.png"]);
    t.dispose();
    images[1]!.onload!();
    expect(c.calls.drawImage).toHaveLength(1);
  });
});
