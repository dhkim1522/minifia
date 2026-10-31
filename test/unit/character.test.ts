// 06-11 3D 캐릭터 — 원본 design/v2.0/blockout/character.js(결정 0048)를 관절 병합으로 옮긴 모듈 (MAP-01, MAP-02).
// WebGL 없이 node 에서 장면 그래프로 검사한다.
import { CircleGeometry, type Group, type Material, type Mesh, type Object3D } from "three";
import { describe, expect, it } from "vitest";
import { MOVE_SPEED } from "../../shared/game/world";
import { CHAR_SCALE, characterKit, createCharacter, figForSeat, WALK_PHASE_RATE } from "../../src/world/character";

function meshes(root: Object3D, visibleOnly = true): Mesh[] {
  const out: Mesh[] = [];
  root.traverse((o) => {
    const m = o as Mesh;
    if (m.isMesh && (!visibleOnly || m.visible)) out.push(m);
  });
  return out;
}
function discOf(root: Object3D): Mesh | undefined {
  return meshes(root).find((m) => m.geometry instanceof CircleGeometry && (m.geometry as CircleGeometry).parameters.radius === 0.42);
}
function joint(root: Object3D, name: string): Object3D {
  const o = root.getObjectByName(name);
  if (!o) throw new Error(`관절 ${name} 없음`);
  return o;
}

describe("기본 코트 인물 하나 (트레이서)", () => {
  it("node 에서 만들어지고 맵 위 크기는 0.83 이다", () => {
    const c = createCharacter(0, "coat");
    expect(c.root.scale.x).toBeCloseTo(0.83, 6);
    expect(CHAR_SCALE).toBe(0.83);
  });

  it("보이는 메시는 관절 6 + 발밑 원판 1 이다(8 이하)", () => {
    const c = createCharacter(0, "coat");
    const ms = meshes(c.root);
    expect(ms.length).toBeLessThanOrEqual(8);
    expect(c.meshCount()).toBe(ms.length);
    const joints = ms.filter((m) => m !== discOf(c.root));
    expect(joints.length).toBe(6);
    expect(discOf(c.root)).toBeDefined();
  });

  it("고유 재질은 3개 이하이고 인물끼리 병합 재질을 공유한다", () => {
    const a = createCharacter(0, "coat");
    const b = createCharacter(2, "coat");
    const mats = (r: Object3D) => new Set(meshes(r).map((m) => m.material as Material));
    expect(mats(a.root).size).toBeLessThanOrEqual(3);
    const shared = [...mats(a.root)].filter((m) => mats(b.root).has(m));
    expect(shared.length).toBeGreaterThanOrEqual(1);
  });

  it("서 있을 때 머리 꼭대기 높이는 (2.45 + 숨쉬기 y) × 0.83 이다", () => {
    const c = createCharacter(0, "coat");
    const { headY } = c.update(0.016, 0, false);
    expect(Math.abs(headY - 2.45 * 0.83)).toBeLessThanOrEqual(0.02);
  });

  it("걸음 주기는 이동 속도에 비례한다(11 rad/s × MOVE_SPEED / 1.245)", () => {
    expect(WALK_PHASE_RATE).toBeCloseTo((11 * MOVE_SPEED) / 1.245, 9);
  });

  it("걷는 동안 다리가 걸음 위상을 따라 돈다", () => {
    const c = createCharacter(1, "coat");
    const legA = joint(c.root, "legA");
    const dt = 0.016;
    let phase = 0;
    for (let i = 0; i < 5; i++) {
      c.update(dt, i * dt, true);
      phase += dt * WALK_PHASE_RATE;
    }
    expect(legA.rotation.x).toBeCloseTo(-Math.sin(phase) * 0.6, 6);
    expect(joint(c.root, "legB").rotation.x).toBeCloseTo(Math.sin(phase) * 0.6, 6);
  });

  it("멈추면 걷기 자세를 풀고 서 있는 자세로 돌아온다", () => {
    const c = createCharacter(1, "coat");
    for (let i = 0; i < 5; i++) c.update(0.016, i * 0.016, true);
    c.update(0.016, 0.1, false);
    expect(joint(c.root, "legA").rotation.x).toBe(0);
  });

  it("setYaw 는 root 를 돌린다", () => {
    const c = createCharacter(0, "coat");
    c.setYaw(1.2);
    expect(c.root.rotation.y).toBe(1.2);
  });

  it("자리 번호 → 인물은 seat % 5 이다(5~7 은 0~2 재사용)", () => {
    expect([0, 1, 2, 3, 4, 5, 6, 7].map(figForSeat).join(",")).toBe("0,1,2,3,4,0,1,2");
  });

  it("characterKit.create 가 렌더러가 쓰는 모양을 준다", () => {
    const h = characterKit.create(3, "coat");
    expect(typeof h.update).toBe("function");
    expect(typeof h.setYaw).toBe("function");
    expect(h.root.scale.x).toBeCloseTo(0.83, 6);
  });

  it("5명 모두 어느 쪽 메시도 그림자를 던지지 않는다", () => {
    for (let i = 0; i < 5; i++) {
      const c = createCharacter(i, "coat");
      for (const m of meshes(c.root, false)) expect(m.castShadow).toBe(false);
    }
  });

  it("발밑 원판은 반지름 0.42, 검정 불투명도 0.3 이고 그림자를 던지지 않는다", () => {
    const c = createCharacter(0, "coat");
    const d = discOf(c.root) as Mesh;
    const mat = d.material as Material & { color: { getHex(): number }; opacity: number; transparent: boolean; depthWrite: boolean };
    expect(mat.color.getHex()).toBe(0x000000);
    expect(mat.opacity).toBe(0.3);
    expect(mat.transparent).toBe(true);
    expect(mat.depthWrite).toBe(false);
    expect(d.castShadow).toBe(false);
    expect((c.root as Group).children.includes(d)).toBe(true);
  });
});
