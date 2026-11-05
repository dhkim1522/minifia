// 시계탑 광장 장면(maps/plaza.ts)을 WebGL 없이 node 에서 검사한다: 병합 구조·좌표·예산·조명 (MAP-06, D-22).
// 모범은 barScene.test.ts. 좌표 원문은 design/v2.0/blockout/plaza.js.
import { BufferGeometry, DirectionalLight, HemisphereLight, Material, Mesh, Object3D, PointLight, Scene, Texture, Vector3 } from "three";
import { describe, expect, it } from "vitest";
import { createCharacter, figForSeat } from "../../src/world/character";
import { buildPlazaScene, PLAZA_LIGHT_TUNE } from "../../src/world/maps/plaza";
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

describe("광장 장면 구조 (MAP-06, D-22)", () => {
  it("WebGL 없이 node 에서 만들어지고 장면(Scene)을 root 로 가진다. 인터페이스 메서드가 모두 있다", () => {
    const p = buildPlazaScene(LADDER[0]!);
    expect(p.root).toBeInstanceOf(Scene);
    for (const k of ["setLighting", "setChalk", "setSelfLight", "setTension", "setPin", "applyBudget", "dispose"] as const) expect(typeof p[k]).toBe("function");
    expect(p.markers.ring.group.visible).toBe(false);
    expect(p.markers.cue.group.visible).toBe(false);
    expect(p.plate).toBeInstanceOf(Mesh);
    p.dispose();
  });

  it("병합 단위가 있다: shell·furniture·brass·emissiveRoom·plate, 고유 재질은 14 이하(박스마다 새 재질이 아니다)", () => {
    const p = buildPlazaScene(LADDER[0]!);
    for (const n of ["shell", "furniture", "brass", "emissiveRoom", "plate"]) expect(p.meshes[n], n).toBeInstanceOf(Mesh);
    const set = new Set<Material>();
    for (const m of allMeshes(p.root)) for (const x of mats(m)) set.add(x);
    expect(set.size).toBeLessThanOrEqual(14);
    p.dispose();
  });

  it("점광원은 3 이하(무대 위·가로등 하나·내 캐릭터), 반구광 1, 달빛 방향광 1", () => {
    const p = buildPlazaScene(LADDER[0]!);
    expect(lightsOf(p.root, PointLight).length).toBeLessThanOrEqual(3);
    expect(lightsOf(p.root, PointLight).length).toBeGreaterThanOrEqual(3);
    expect(lightsOf(p.root, HemisphereLight)).toHaveLength(1);
    expect(lightsOf(p.root, DirectionalLight)).toHaveLength(1);
    p.dispose();
  });

  it("plaza.js 원문 좌표: 연단 윗면 0.46, 놋쇠 표시 8개(반지름 2.6), 시계탑 기단 (−4.3, −4.3), 가로등 4개", () => {
    const p = buildPlazaScene(LADDER[0]!);
    const furniture = p.meshes.furniture!;
    const brass = p.meshes.brass!;
    // 연단: 위 단 윗면 중심(높이 0.36 + 0.1), 아래 단 윗면(0.17 + 0.09)
    expect(hasVertex(furniture, [0, 0.46, 0])).toBe(true);
    expect(hasVertex(furniture, [0, 0.26, 0])).toBe(true);
    // 놋쇠 표시 8개: 반지름 2.6 원 위 8등분, 윗면 중심 y 0.10
    let found = 0;
    for (let i = 0; i < 8; i++) {
      const a = Math.PI / 4 + (i / 8) * Math.PI * 2;
      if (hasVertex(brass, [Math.sin(a) * 2.6, 0.1, Math.cos(a) * 2.6])) found++;
    }
    expect(found).toBe(8);
    // 시계탑: 아래 상자 2.6 × 0.8 × 2.6 중심 (−4.3, 0.4, −4.3)
    expect(hasVertex(furniture, [-4.3 - 1.3, 0, -4.3 - 1.3])).toBe(true);
    expect(hasVertex(furniture, [-4.3 + 1.3, 0.8, -4.3 + 1.3])).toBe(true);
    // 가로등 4: 기둥 윗면 중심(높이 2.6)
    for (const [x, z] of [
      [3.8, -2.4],
      [-2.4, 3.8],
      [-3.6, 1.0],
      [1.0, -3.6],
    ] as const)
      expect(hasVertex(furniture, [x, 2.6, z]), `${x},${z}`).toBe(true);
    p.dispose();
  });

  it("바닥 판 40×40, y −0.06 아래에 자갈 칸이 깔린다 (shell 의 가장자리 정점)", () => {
    const p = buildPlazaScene(LADDER[0]!);
    const shell = p.meshes.shell!;
    expect(hasVertex(shell, [20, -0.01, 20])).toBe(true);
    expect(hasVertex(shell, [-20, -0.11, -20])).toBe(true);
    p.dispose();
  });

  it("단계 일곱 가지 모두 setLighting 이 던지지 않고 점광원 수가 변하지 않는다", () => {
    const p = buildPlazaScene(LADDER[0]!);
    const n = lightsOf(p.root, PointLight).length;
    for (const ph of PHASES) {
      expect(() => p.setLighting(ph), ph).not.toThrow();
      expect(lightsOf(p.root, PointLight)).toHaveLength(n);
    }
    p.dispose();
  });

  it("dispose 가 지오메트리·재질·텍스처를 해제한다(두 번 불러도 안전)", () => {
    const p = buildPlazaScene(LADDER[0]!);
    let geo = 0;
    let mat = 0;
    let tex = 0;
    for (const m of allMeshes(p.root)) {
      m.geometry.addEventListener("dispose", () => geo++);
      for (const x of mats(m)) {
        x.addEventListener("dispose", () => mat++);
        const map = (x as { map?: Texture | null }).map;
        if (map) map.addEventListener("dispose", () => tex++);
      }
    }
    p.dispose();
    p.dispose();
    expect(geo).toBeGreaterThan(0);
    expect(mat).toBeGreaterThan(0);
    expect(tex).toBeGreaterThan(0);
  });

  it("PLAZA_LIGHT_TUNE 은 일곱 단계 행을 모두 가진다", () => {
    for (const ph of PHASES) expect(PLAZA_LIGHT_TUNE[ph], ph).toBeDefined();
  });

  it("캐릭터 8명(의상 섞음)이 서 있어도 보이는 메시 + 그림자 메시 합이 DRAW_CALL_BUDGET 이하다", () => {
    const p = buildPlazaScene(LADDER[0]!);
    const outfits = ["coat", "police", "doctor", "mafia"] as const;
    const chars = Array.from({ length: 8 }, (_, i) => createCharacter(figForSeat(i), outfits[i % outfits.length]!));
    for (const c of chars) p.root.add(c.root);
    for (const ph of PHASES) {
      p.setLighting(ph);
      const vis = visibleMeshes(p.root);
      expect(vis.length + vis.filter((m) => m.castShadow).length, ph).toBeLessThanOrEqual(DRAW_CALL_BUDGET);
    }
    for (const c of chars) c.dispose();
    p.dispose();
  });
});
