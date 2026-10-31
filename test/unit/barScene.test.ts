// 재즈 바 장면(maps/bar.ts)을 WebGL 없이 node 에서 검사한다: 병합 구조·예산·조명·연장 판·링.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { BufferGeometry, DataTexture, DirectionalLight, HemisphereLight, Material, Mesh, MeshBasicMaterial, Object3D, PlaneGeometry, PointLight, Scene, TorusGeometry, Vector3 } from "three";
import { describe, expect, it } from "vitest";
import { PLATE_FAR } from "../../src/world/camera";
import { buildBarScene, LIGHT_TUNE } from "../../src/world/maps/bar";
import { TOKEN_COLORS } from "../../src/world/palette";
import { LADDER } from "../../src/world/renderer";

/** 보이는 메시(visible 이고 조상도 visible) 목록. Task 3 의 사다리 테스트가 같은 이름을 쓴다 */
export function visibleMeshes(root: Object3D): Mesh[] {
  const out: Mesh[] = [];
  root.traverseVisible((o) => {
    if ((o as Mesh).isMesh) out.push(o as Mesh);
  });
  return out;
}
export const visibleMeshCount = (root: Object3D): number => visibleMeshes(root).length;

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
/** 메시의 모든 정점을 세계 좌표로 */
function worldVertices(mesh: Mesh): Vector3[] {
  mesh.updateWorldMatrix(true, false);
  const pos = (mesh.geometry as BufferGeometry).getAttribute("position");
  const out: Vector3[] = [];
  for (let i = 0; i < pos.count; i++) out.push(new Vector3().fromBufferAttribute(pos, i).applyMatrix4(mesh.matrixWorld));
  return out;
}
const hasVertex = (mesh: Mesh, p: [number, number, number], tol = 0.02): boolean => worldVertices(mesh).some((v) => v.distanceTo(new Vector3(...p)) <= tol);
const mats = (m: Mesh): Material[] => (Array.isArray(m.material) ? m.material : [m.material]);

describe("재즈 바 장면 구조 (MAP-01, 렌더 예산)", () => {
  it("WebGL 없이 node 에서 만들어지고 장면(Scene)을 root 로 가진다", () => {
    const bar = buildBarScene(LADDER[0]!);
    expect(bar.root).toBeInstanceOf(Scene);
    bar.dispose();
  });

  it("보이는 메시 수는 talk·vote 각각 40 이하이고, 두 단계 모두 맵이 비어 있지 않다", () => {
    const bar = buildBarScene(LADDER[0]!);
    for (const phase of ["talk", "vote"] as const) {
      bar.setLighting(phase);
      const n = visibleMeshCount(bar.root);
      expect(n).toBeGreaterThan(5);
      expect(n).toBeLessThanOrEqual(40);
    }
    bar.dispose();
  });

  it("점광원 3 · 반구광 1 · 달빛 방향광 1(그림자 1024)", () => {
    const bar = buildBarScene(LADDER[0]!);
    expect(lightsOf(bar.root, PointLight)).toHaveLength(3);
    expect(lightsOf(bar.root, HemisphereLight)).toHaveLength(1);
    const dirs = lightsOf(bar.root, DirectionalLight);
    expect(dirs).toHaveLength(1);
    expect(dirs[0]!.castShadow).toBe(true);
    expect(dirs[0]!.shadow.mapSize.x).toBe(1024);
    expect(dirs[0]!.shadow.mapSize.y).toBe(1024);
    bar.dispose();
  });

  it("달빛은 시안과 같은 그림자 설정(bias −0.0015, 카메라 ±12)과 토큰 색을 쓴다", () => {
    const bar = buildBarScene(LADDER[0]!);
    const moon = lightsOf(bar.root, DirectionalLight)[0]!;
    expect(moon.shadow.bias).toBeCloseTo(-0.0015, 6);
    const cam = moon.shadow.camera;
    expect([cam.left, cam.right, cam.top, cam.bottom]).toEqual([-12, 12, 12, -12]);
    expect("#" + moon.color.getHexString()).toBe(TOKEN_COLORS.moon);
    bar.dispose();
  });

  it("고유 재질 수는 12 이하다 — 시안처럼 박스마다 새 재질이 아니다", () => {
    const bar = buildBarScene(LADDER[0]!);
    const set = new Set<Material>();
    for (const m of allMeshes(bar.root)) for (const x of mats(m)) set.add(x);
    expect(set.size).toBeGreaterThan(3);
    expect(set.size).toBeLessThanOrEqual(12);
    bar.dispose();
  });

  it("연장 판: 바닥 아래(y < 0) 정사각형 메시 하나, 반폭 ≥ PLATE_FAR, 판 위 그림자를 받지 않는다", () => {
    const bar = buildBarScene(LADDER[0]!);
    const plate = bar.plate;
    expect(plate.position.y).toBeLessThan(0);
    const g = plate.geometry as PlaneGeometry;
    expect(g.parameters.width).toBe(g.parameters.height);
    expect(g.parameters.width / 2).toBeGreaterThanOrEqual(PLATE_FAR);
    expect(bar.root.children.includes(plate) || allMeshes(bar.root).includes(plate)).toBe(true);
    // 바닥 아래의 정사각형 메시는 이것 하나뿐이다
    const under = allMeshes(bar.root).filter((m) => m.position.y < 0 && (m.geometry as PlaneGeometry).type === "PlaneGeometry");
    expect(under).toHaveLength(1);
    bar.dispose();
  });

  it("앞쪽(x + z > 4)에는 높이 1.2 를 넘는 정점이 없다 (결정 0050·UI-SPEC)", () => {
    const bar = buildBarScene(LADDER[0]!);
    const bad: string[] = [];
    for (const m of allMeshes(bar.root)) for (const v of worldVertices(m)) if (v.x + v.z > 4 && v.y > 1.2) bad.push(`${v.x.toFixed(2)},${v.y.toFixed(2)},${v.z.toFixed(2)}`);
    expect(bad.slice(0, 5)).toEqual([]);
    bar.dispose();
  });

  it("bar.js 원문 좌표: 벽·창·바 카운터·탁자·무대·펜던트 전구·서는 자리 8개 놋쇠", () => {
    const bar = buildBarScene(LADDER[0]!);
    const m = bar.meshes;
    expect(hasVertex(m.shell!, [-7.3, 3.6, 7.15])).toBe(true); // 왼쪽 벽 끝 위
    expect(hasVertex(m.emissiveRoom!, [3.4, 2.65, -6.97])).toBe(true); // 블라인드 창 유리 모서리
    expect(hasVertex(m.furniture!, [-5.1, 1.13, 1.0])).toBe(true); // 바 카운터 윗판 모서리
    expect(hasVertex(m.furniture!, [4.6, 0.765, 1.7])).toBe(true); // 탁자 (4.6, 1.2) 윗판
    expect(hasVertex(m.furniture!, [0, 0.28, 1.12])).toBe(true); // 무대 몸통 위
    expect(hasVertex(m.emissiveRoomFar!, [-2.4, 2.79, -4.6])).toBe(true); // 펜던트 전구
    for (let i = 0; i < 8; i++) {
      const a = Math.PI / 4 + (i / 8) * Math.PI * 2;
      const x = Math.sin(a) * 2.4;
      const z = Math.cos(a) * 2.4;
      const near = worldVertices(m.brass!).some((v) => v.y < 0.03 && Math.hypot(v.x - x, v.z - z) <= 0.37);
      expect(near, `서는 자리 ${i}`).toBe(true);
    }
    bar.dispose();
  });
});

describe("조명 단계 (talk · vote)", () => {
  it("vote: 무대 위 점광원이 켜지고 펜던트는 talk 의 0.45 배. talk: 무대 위 점광원 0", () => {
    const bar = buildBarScene(LADDER[0]!);
    bar.setLighting("talk");
    expect(bar.lights.stage.intensity).toBe(0);
    const talkPendant = bar.lights.pendantA.intensity;
    expect(talkPendant).toBeGreaterThan(0);
    bar.setLighting("vote");
    expect(bar.lights.stage.intensity).toBeGreaterThan(0);
    expect(bar.lights.pendantA.intensity).toBeCloseTo(talkPendant * 0.45, 6);
    expect(bar.lights.pendantB.intensity).toBeCloseTo(talkPendant * 0.45, 6);
    bar.setLighting("talk");
    expect(bar.lights.stage.intensity).toBe(0);
    bar.dispose();
  });

  it("조명 단계 데이터는 승인 맵 그림(map-bar.png)과 나란히 놓고 맞춘 값이다 (06-14): talk 반구 1.1π·달빛 0.85π, vote 0.7π·0.55π, 노출 1.25, vote 무대 점광원 8", () => {
    // 출발값은 시안 세기 × π(talk 0.42·0.35, vote 0.3·0.25)였고, 390×844 에서 바닥 판자·캐릭터·무대 둘레가 어둠에 묻혀 talk 는 약 2.6배, vote 는 약 2.3배 올렸다
    expect(LIGHT_TUNE.talk.hemi).toBeCloseTo(1.1 * Math.PI, 6);
    expect(LIGHT_TUNE.talk.moon).toBeCloseTo(0.85 * Math.PI, 6);
    expect(LIGHT_TUNE.vote.hemi).toBeCloseTo(0.7 * Math.PI, 6);
    expect(LIGHT_TUNE.vote.moon).toBeCloseTo(0.55 * Math.PI, 6);
    expect(LIGHT_TUNE.talk.exposure).toBe(1.25);
    expect(LIGHT_TUNE.vote.exposure).toBe(1.25);
    expect(LIGHT_TUNE.vote.stage).toBeCloseTo(2.0 * 4, 6);
    expect(LIGHT_TUNE.talk.sky).toEqual(["#524b84", "#2a2034", "#15111f"]);
    expect(LIGHT_TUNE.vote.sky).toEqual(["#3a3464", "#1c1428", "#100d19"]);
  });

  it("vote 는 talk 보다 어둡고(반구·달빛·배경) 무대에만 점광원이 있다 — 화면 전체를 밝게 덮지 않는다", () => {
    expect(LIGHT_TUNE.vote.hemi).toBeLessThan(LIGHT_TUNE.talk.hemi);
    expect(LIGHT_TUNE.vote.moon).toBeLessThan(LIGHT_TUNE.talk.moon);
    expect(LIGHT_TUNE.talk.stage).toBe(0);
    expect(LIGHT_TUNE.vote.stage).toBeGreaterThan(0);
  });

  it("장면 배경과 안개 색은 같은 색이고 단계에 따라 바뀐다", () => {
    const bar = buildBarScene(LADDER[0]!);
    bar.setLighting("talk");
    const fog = bar.root.fog!;
    const bg = bar.root.background as { getHexString(): string };
    expect("#" + bg.getHexString()).toBe("#15111f");
    expect("#" + (fog.color as { getHexString(): string }).getHexString()).toBe("#15111f");
    bar.setLighting("vote");
    expect("#" + bg.getHexString()).toBe("#100d19");
    bar.dispose();
  });
});

describe("목적지 링·손짓 링", () => {
  it("두 겹: 반지름 0.45·굵기 0.04(gray-50) + 윤곽 반지름 0.5·굵기 0.05(night-950, 불투명도 0.6), MeshBasicMaterial, 처음엔 숨김", () => {
    const bar = buildBarScene(LADDER[0]!);
    for (const kind of ["ring", "cue"] as const) {
      const mk = bar.markers[kind];
      expect(mk.group.visible).toBe(false);
      const g1 = mk.ring.geometry as TorusGeometry;
      const g2 = mk.outline.geometry as TorusGeometry;
      expect([g1.parameters.radius, g1.parameters.tube]).toEqual([0.45, 0.04]);
      expect([g2.parameters.radius, g2.parameters.tube]).toEqual([0.5, 0.05]);
      expect(mk.ring.material).toBeInstanceOf(MeshBasicMaterial);
      expect(mk.outline.material).toBeInstanceOf(MeshBasicMaterial);
      expect("#" + (mk.ring.material as MeshBasicMaterial).color.getHexString()).toBe(TOKEN_COLORS.ring);
      expect("#" + (mk.outline.material as MeshBasicMaterial).color.getHexString()).toBe(TOKEN_COLORS.ringOutline);
      expect((mk.outline.material as MeshBasicMaterial).opacity).toBeCloseTo(0.6, 6);
      // 바닥에 눕힘: x 축 −π/2
      expect(mk.ring.rotation.x).toBeCloseTo(-Math.PI / 2, 6);
      expect(mk.outline.rotation.x).toBeCloseTo(-Math.PI / 2, 6);
    }
    bar.dispose();
  });
});

describe("원격 에셋 없음 (T-06-24)", () => {
  it("장면의 모든 텍스처는 코드로 만든 DataTexture 다", () => {
    const bar = buildBarScene(LADDER[0]!);
    let withMap = 0;
    for (const m of allMeshes(bar.root))
      for (const x of mats(m)) {
        const map = (x as { map?: unknown }).map;
        if (map) {
          withMap++;
          expect(map).toBeInstanceOf(DataTexture);
        }
      }
    expect(withMap).toBeGreaterThan(0); // 빛 무리 쿼드
    bar.dispose();
  });

  it("bar.ts·palette.ts 소스에 URL·로더·캔버스·fetch 가 없다", () => {
    for (const f of ["src/world/maps/bar.ts", "src/world/palette.ts"]) {
      const src = readFileSync(resolve(process.cwd(), f), "utf8");
      expect(src, f).not.toMatch(/https?:\/\//);
      expect(src, f).not.toMatch(/TextureLoader|new Image\b|fetch\(|createElement\(|ImageBitmap/);
    }
  });
});
