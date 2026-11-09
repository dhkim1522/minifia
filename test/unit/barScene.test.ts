// 재즈 바 장면(maps/bar.ts)을 WebGL 없이 node 에서 검사한다: 병합 구조·예산·조명·연장 판·링.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { BufferGeometry, Color, DataTexture, DirectionalLight, HemisphereLight, type Light, Material, Mesh, MeshBasicMaterial, Object3D, PlaneGeometry, PointLight, Scene, TorusGeometry, TubeGeometry, Vector3 } from "three";
import { describe, expect, it } from "vitest";
import { PLATE_FAR } from "../../src/world/camera";
import { buildBarScene, LIGHT_TUNE } from "../../src/world/maps/bar";
import { TOKEN_COLORS } from "../../src/world/palette";
import { createCharacter, figForSeat } from "../../src/world/character";
import { DRAW_CALL_BUDGET, LADDER, type LightingPhase } from "../../src/world/renderer";

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

  it("점광원 4(무대·펜던트 둘·내 캐릭터) · 반구광 1 · 달빛 방향광 1(그림자 1024)", () => {
    const bar = buildBarScene(LADDER[0]!);
    expect(lightsOf(bar.root, PointLight)).toHaveLength(4);
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
    expect("#" + moon.color.getHexString()).toBe(LIGHT_TUNE.talk.moonColor);
    bar.dispose();
  });

  it("방향광 색이 단계 표를 따른다: 만든 직후 talk 색, night 에서 달빛 남색, 다시 talk 에서 원래 색, 방향광은 하나뿐(D-03)", () => {
    const bar = buildBarScene(LADDER[0]!);
    const hex = (): string => "#" + lightsOf(bar.root, DirectionalLight)[0]!.color.getHexString();
    expect(lightsOf(bar.root, DirectionalLight)).toHaveLength(1);
    expect(hex()).toBe("#eadfd0");
    bar.setLighting("night");
    expect(hex()).toBe(TOKEN_COLORS.moon);
    bar.setLighting("talk");
    expect(hex()).toBe("#eadfd0");
    expect(lightsOf(bar.root, DirectionalLight)).toHaveLength(1);
    bar.dispose();
  });

  it("고유 재질 수는 14 이하다 — 시안처럼 박스마다 새 재질이 아니다", () => {
    const bar = buildBarScene(LADDER[0]!);
    const set = new Set<Material>();
    for (const m of allMeshes(bar.root)) for (const x of mats(m)) set.add(x);
    expect(set.size).toBeGreaterThan(3);
    expect(set.size).toBeLessThanOrEqual(14); // 08-10: 변론 원뿔 빛 재질 하나가 늘었다(12 → 13), 09-10: 분필 윤곽 재질 하나(13 → 14)
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
    expect(LIGHT_TUNE.talk.sky).toEqual(["#908aa4", "#4a4058", "#38324a"]);
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

// ---------- 08-10 Task 3: 조명 단계 다섯 · 긴장 단계 (UI-SPEC 단계 조명, 결정 0049) ----------

const STAGES: readonly LightingPhase[] = ["talk", "vote", "trial", "night", "nightCitizen", "nightGhost", "morning"];
const lightCount = (root: Object3D): number => {
  let n = 0;
  root.traverse((o) => {
    if ((o as Light).isLight) n++;
  });
  return n;
};
/** 선형 작업 공간 상대 휘도 */
const lum = (hex: string): number => {
  const c = new Color(hex);
  return 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;
};
const room = (bar: ReturnType<typeof buildBarScene>): number => (bar.meshes.emissiveRoom!.material as MeshBasicMaterial).color.r;

describe("조명 단계 다섯 (trial · night · morning, 08-10)", () => {
  it("LIGHT_TUNE 에 다섯 단계 행이 모두 있다", () => {
    for (const s of STAGES) {
      expect(LIGHT_TUNE[s], s).toBeDefined();
      expect(LIGHT_TUNE[s].sky).toHaveLength(3);
    }
  });

  it("단계를 모두 바꿔도 광원 개수는 처음과 같다(새 광원 없음) — 반구 1 · 방향 1 · 점광원 4", () => {
    const bar = buildBarScene(LADDER[0]!);
    const first = lightCount(bar.root);
    expect(first).toBe(6);
    for (const s of [...STAGES, "talk"] as const) {
      bar.setLighting(s);
      expect(lightCount(bar.root), s).toBe(first);
    }
    bar.setTension(2, { x: 2.65, z: 0 });
    expect(lightCount(bar.root)).toBe(first);
    bar.dispose();
  });

  it("원뿔 빛 메시는 trial 에서만 보이고 투명 메시 하나다(광원 아님)", () => {
    const bar = buildBarScene(LADDER[0]!);
    const cone = bar.meshes.trialCone;
    expect(cone).toBeDefined();
    expect((cone!.material as MeshBasicMaterial).transparent).toBe(true);
    expect((cone!.material as MeshBasicMaterial).depthWrite).toBe(false);
    for (const s of STAGES) {
      bar.setLighting(s);
      expect(cone!.visible, s).toBe(s === "trial");
    }
    bar.dispose();
  });

  it("유령 8명(발밑 고리 포함)이 서 있어도 단계마다 그리기 호출 추정이 DRAW_CALL_BUDGET 이내다(보이는 메시 + 그림자를 드리우는 메시)", () => {
    const bar = buildBarScene(LADDER[0]!);
    const chars = Array.from({ length: 8 }, (_, i) => createCharacter(figForSeat(i), "coat"));
    for (const c of chars) {
      c.setGhost(true);
      c.setRing("#cc3333");
      bar.root.add(c.root);
    }
    for (const s of STAGES) {
      for (const tension of [0, 1, 2] as const) {
        bar.setLighting(s);
        bar.setTension(tension, { x: 2.65, z: 0 });
        const vis = visibleMeshes(bar.root);
        const calls = vis.length + vis.filter((m) => m.castShadow).length;
        expect(calls, `${s}/${tension}`).toBeLessThanOrEqual(DRAW_CALL_BUDGET);
      }
    }
    for (const c of chars) c.dispose();
    bar.dispose();
  });

  it("새 단계의 하늘·땅·배경 색은 talk 의 같은 칸보다 밝지 않다(아침 포함, 새 밝은 색면 없음)", () => {
    for (const s of ["trial", "night", "morning"] as const)
      for (let i = 0; i < 3; i++) expect(lum(LIGHT_TUNE[s].sky[i]!), `${s} sky[${i}]`).toBeLessThanOrEqual(lum(LIGHT_TUNE.talk.sky[i]!));
  });

  it("단계 값: trial 은 실내 5% · 무대 전구 유지, night 는 무대 점광원 0 · 실내 15%, morning 은 talk 보다 낮은 반구", () => {
    expect(LIGHT_TUNE.trial.emissive.room).toBeCloseTo(0.05, 9);
    expect(LIGHT_TUNE.trial.glow.room).toBeCloseTo(0.05, 9);
    expect(LIGHT_TUNE.trial.stage).toBe(LIGHT_TUNE.vote.stage);
    expect(LIGHT_TUNE.trial.emissive.vote).toBe(LIGHT_TUNE.vote.emissive.vote);
    expect(LIGHT_TUNE.night.stage).toBe(0);
    expect(LIGHT_TUNE.night.emissive.room).toBeCloseTo(0.15, 9);
    expect(LIGHT_TUNE.night.hemi).toBeLessThan(LIGHT_TUNE.vote.hemi);
    expect(LIGHT_TUNE.morning.hemi).toBeLessThan(LIGHT_TUNE.talk.hemi);
    expect(LIGHT_TUNE.morning.stage).toBe(0);
  });

  it("setLighting 이 단계 값을 장면에 반영한다(반구 세기·무대 점광원·실내 emissive)", () => {
    const bar = buildBarScene(LADDER[0]!);
    for (const s of STAGES) {
      bar.setLighting(s);
      expect(bar.lights.hemi.intensity, s).toBeCloseTo(LIGHT_TUNE[s].hemi, 9);
      expect(bar.lights.stage.intensity, s).toBeCloseTo(LIGHT_TUNE[s].stage, 9);
      expect(room(bar), s).toBeCloseTo(LIGHT_TUNE[s].emissive.room, 9);
    }
    bar.dispose();
  });
});

describe("핀 조명 setPin (결정 0066-6, 09.1.1-11)", () => {
  const voteEm = (bar: ReturnType<typeof buildBarScene>): number => (bar.meshes.emissiveVote!.material as MeshBasicMaterial).color.r;
  const lightCount = (bar: ReturnType<typeof buildBarScene>): number => {
    let n = 0;
    bar.root.traverse((o) => {
      if ((o as Light).isLight) n += 1;
    });
    return n;
  };

  it("핀이 있으면 무대 점광이 그 자리 위로 가고 세기는 단계 값과 선두 세기 사이, 실내·투표 발광은 dim 배", () => {
    const bar = buildBarScene(LADDER[0]!);
    bar.setLighting("vote");
    bar.setPin({ x: 2.65, z: -1.5, strength: 0.9 }, 0.6);
    const stage = bar.lights.stage;
    expect(stage.position.x).toBeCloseTo(2.65, 9);
    expect(stage.position.z).toBeCloseTo(-1.5, 9);
    expect(stage.position.y).toBeCloseTo(LIGHT_TUNE.point.stage.y, 9);
    const want = LIGHT_TUNE.vote.stage + (LIGHT_TUNE.tension.lead - LIGHT_TUNE.vote.stage) * 0.9;
    expect(stage.intensity).toBeCloseTo(want, 9);
    expect(room(bar)).toBeCloseTo(LIGHT_TUNE.vote.emissive.room * 0.6, 9);
    expect(voteEm(bar)).toBeCloseTo(LIGHT_TUNE.vote.emissive.vote * 0.6, 9);
    bar.dispose();
  });

  it("strength 0 이면 단계 값 그대로이고(위치만 따라간다) null 이면 무대 중앙·단계 값으로 돌아간다", () => {
    const bar = buildBarScene(LADDER[0]!);
    bar.setLighting("vote");
    bar.setPin({ x: 1, z: 1, strength: 0 }, 1);
    expect(bar.lights.stage.intensity).toBeCloseTo(LIGHT_TUNE.vote.stage, 9);
    expect(room(bar)).toBeCloseTo(LIGHT_TUNE.vote.emissive.room, 9);
    bar.setPin({ x: 1, z: 1, strength: 0.9 }, 0.6);
    bar.setPin(null, 1);
    expect(bar.lights.stage.position.x).toBeCloseTo(LIGHT_TUNE.point.stage.x, 9);
    expect(bar.lights.stage.position.z).toBeCloseTo(LIGHT_TUNE.point.stage.z, 9);
    expect(bar.lights.stage.intensity).toBeCloseTo(LIGHT_TUNE.vote.stage, 9);
    expect(room(bar)).toBeCloseTo(LIGHT_TUNE.vote.emissive.room, 9);
    expect(voteEm(bar)).toBeCloseTo(LIGHT_TUNE.vote.emissive.vote, 9);
    bar.dispose();
  });

  it("조명 단계가 바뀌어도 핀 상태가 살아 있고 새 단계 값 위에서 다시 계산된다", () => {
    const bar = buildBarScene(LADDER[0]!);
    bar.setLighting("vote");
    bar.setPin({ x: 2, z: 3, strength: 0.9 }, 0.6);
    bar.setLighting("trial");
    expect(bar.lights.stage.position.x).toBeCloseTo(2, 9);
    expect(bar.lights.stage.position.z).toBeCloseTo(3, 9);
    expect(bar.lights.stage.intensity).toBeCloseTo(LIGHT_TUNE.trial.stage + (LIGHT_TUNE.tension.lead - LIGHT_TUNE.trial.stage) * 0.9, 9);
    expect(room(bar)).toBeCloseTo(LIGHT_TUNE.trial.emissive.room * 0.6, 9);
    bar.dispose();
  });

  it("setTension 과 동시에 켜지면 핀이 위치·세기를 이기고, 긴장 2 의 방 절반 위에 dim 이 곱해진다", () => {
    const bar = buildBarScene(LADDER[0]!);
    bar.setLighting("vote");
    bar.setTension(2, { x: 5, z: 5 });
    bar.setPin({ x: -2, z: 1, strength: 0.5 }, 0.8);
    expect(bar.lights.stage.position.x).toBeCloseTo(-2, 9);
    expect(bar.lights.stage.position.z).toBeCloseTo(1, 9);
    expect(bar.lights.stage.intensity).toBeCloseTo(LIGHT_TUNE.tension.lead, 9); // 이미 선두 세기라 lerp 결과도 같다
    expect(room(bar)).toBeCloseTo(LIGHT_TUNE.vote.emissive.room * 0.5 * 0.8, 9);
    bar.setPin(null, 1);
    expect(bar.lights.stage.position.x).toBeCloseTo(5, 9);
    expect(room(bar)).toBeCloseTo(LIGHT_TUNE.vote.emissive.room * 0.5, 9);
    bar.dispose();
  });

  it("새 광원·새 메시를 만들지 않는다 (광원 수·메시 수 불변)", () => {
    const bar = buildBarScene(LADDER[0]!);
    const lights = lightCount(bar);
    const meshes = allMeshes(bar.root).length;
    const pointLights = lightsOf(bar.root, PointLight).length;
    bar.setPin({ x: 1, z: 1, strength: 0.9 }, 0.6);
    bar.setLighting("trial");
    bar.setPin(null, 1);
    expect(lightCount(bar)).toBe(lights);
    expect(allMeshes(bar.root).length).toBe(meshes);
    expect(lightsOf(bar.root, PointLight).length).toBe(pointLights);
    bar.dispose();
  });
});

describe("긴장 단계 setTension (결정 0049 선두·과반 연출, 08-10)", () => {
  it("1: 무대 점광원이 초점 위(높이 3.0)로 옮겨 선두 세기가 된다", () => {
    const bar = buildBarScene(LADDER[0]!);
    bar.setLighting("vote");
    bar.setTension(1, { x: 2.65, z: 0 });
    expect(bar.lights.stage.position.x).toBeCloseTo(2.65, 9);
    expect(bar.lights.stage.position.y).toBeCloseTo(3.0, 9);
    expect(bar.lights.stage.position.z).toBeCloseTo(0, 9);
    expect(bar.lights.stage.intensity).toBeCloseTo(LIGHT_TUNE.tension.lead, 9);
    expect(LIGHT_TUNE.tension.lead).toBeGreaterThan(LIGHT_TUNE.vote.stage);
    expect(room(bar)).toBeCloseTo(LIGHT_TUNE.vote.emissive.room, 9); // 1 단계는 실내 그대로
    bar.dispose();
  });

  it("2: 1 에 더해 실내 emissive 가 그 단계 값의 절반이다", () => {
    const bar = buildBarScene(LADDER[0]!);
    bar.setLighting("vote");
    bar.setTension(2, { x: 0, z: 2.65 });
    expect(bar.lights.stage.position.z).toBeCloseTo(2.65, 9);
    expect(bar.lights.stage.intensity).toBeCloseTo(LIGHT_TUNE.tension.lead, 9);
    expect(LIGHT_TUNE.tension.halfRoom).toBeCloseTo(0.5, 9);
    expect(room(bar)).toBeCloseTo(LIGHT_TUNE.vote.emissive.room * 0.5, 9);
    bar.dispose();
  });

  it("0: 그 단계 값과 무대 중앙으로 복귀한다", () => {
    const bar = buildBarScene(LADDER[0]!);
    bar.setLighting("vote");
    bar.setTension(2, { x: 2.65, z: 0 });
    bar.setTension(0);
    expect(bar.lights.stage.position.x).toBeCloseTo(LIGHT_TUNE.point.stage.x, 9);
    expect(bar.lights.stage.position.y).toBeCloseTo(LIGHT_TUNE.point.stage.y, 9);
    expect(bar.lights.stage.position.z).toBeCloseTo(LIGHT_TUNE.point.stage.z, 9);
    expect(bar.lights.stage.intensity).toBeCloseTo(LIGHT_TUNE.vote.stage, 9);
    expect(room(bar)).toBeCloseTo(LIGHT_TUNE.vote.emissive.room, 9);
    bar.dispose();
  });

  it("긴장은 조명 단계가 바뀌어도 유지되고, 단계 값 위에서 다시 계산된다", () => {
    const bar = buildBarScene(LADDER[0]!);
    bar.setLighting("vote");
    bar.setTension(2, { x: 2.65, z: 0 });
    bar.setLighting("trial");
    expect(bar.lights.stage.intensity).toBeCloseTo(LIGHT_TUNE.tension.lead, 9);
    expect(room(bar)).toBeCloseTo(LIGHT_TUNE.trial.emissive.room * 0.5, 9);
    bar.setTension(0);
    expect(room(bar)).toBeCloseTo(LIGHT_TUNE.trial.emissive.room, 9);
    bar.dispose();
  });

  it("초점을 주지 않으면 무대 중앙에서 세기만 바뀐다", () => {
    const bar = buildBarScene(LADDER[0]!);
    bar.setLighting("vote");
    bar.setTension(1);
    expect(bar.lights.stage.position.x).toBeCloseTo(LIGHT_TUNE.point.stage.x, 9);
    expect(bar.lights.stage.intensity).toBeCloseTo(LIGHT_TUNE.tension.lead, 9);
    bar.dispose();
  });
});

describe("분필 윤곽 (MORN-01, 결정 0061-14, 블록아웃 blockout.js 276~284행)", () => {
  const chalkOf = (bar: ReturnType<typeof buildBarScene>): Mesh => bar.meshes.chalk!;

  it("처음부터 만들어 두고 숨겨 둔다(그리기 +1, 예산 안)", () => {
    const bar = buildBarScene(LADDER[0]!);
    const chalk = chalkOf(bar);
    expect(chalk).toBeDefined();
    expect(chalk.visible).toBe(false);
    expect(visibleMeshCount(bar.root)).toBeLessThanOrEqual(DRAW_CALL_BUDGET);
    bar.dispose();
  });

  it("튜브 반지름 0.022, 투명 재질, 크림색 불투명 0.85, 닫힌 한 메시", () => {
    const bar = buildBarScene(LADDER[0]!);
    const chalk = chalkOf(bar);
    const params = (chalk.geometry as TubeGeometry).parameters;
    expect(params.radius).toBeCloseTo(0.022, 9);
    expect(params.closed).toBe(true);
    const m = chalk.material as MeshBasicMaterial;
    expect(m.transparent).toBe(true);
    expect(m.opacity).toBeCloseTo(0.85, 9);
    expect(m.color.getHexString()).toBe("e8e6dc");
    expect(chalk.rotation.y).toBeCloseTo(0.7, 9);
    bar.dispose();
  });

  it("setChalk({1.2,-3.4}, 0.85) → 보이고 바닥 y 0.015 에 놓이고 불투명도가 반영된다. null 이면 숨는다", () => {
    const bar = buildBarScene(LADDER[0]!);
    const chalk = chalkOf(bar);
    bar.setChalk({ x: 1.2, z: -3.4 }, 0.85);
    expect(chalk.visible).toBe(true);
    expect(chalk.position.x).toBeCloseTo(1.2, 9);
    expect(chalk.position.y).toBeCloseTo(0.015, 9);
    expect(chalk.position.z).toBeCloseTo(-3.4, 9);
    expect((chalk.material as MeshBasicMaterial).opacity).toBeCloseTo(0.85, 9);
    bar.setChalk({ x: 1.2, z: -3.4 }, 0.3);
    expect((chalk.material as MeshBasicMaterial).opacity).toBeCloseTo(0.3, 9);
    bar.setChalk(null, 0.85);
    expect(chalk.visible).toBe(false);
    bar.dispose();
  });
});

describe("시민 편 어둠·유령 밤 조명·내 캐릭터 빛 (NIGHT-07, NIGHT-10, UI-SPEC 단계 조명, Pitfall 7)", () => {
  const ALL_PHASES: LightingPhase[] = ["talk", "vote", "trial", "night", "nightCitizen", "nightGhost", "morning"];
  const room = (bar: ReturnType<typeof buildBarScene>): number => (bar.meshes.emissiveRoom!.material as MeshBasicMaterial).color.r;
  const vote = (bar: ReturnType<typeof buildBarScene>): number => (bar.meshes.emissiveVote!.material as MeshBasicMaterial).color.r;
  const lum = (hex: string): number => {
    const c = new Color(hex);
    return c.r + c.g + c.b;
  };

  it("nightCitizen 행: 반구 0.05π · 달빛 0.08π · 노출 0.75 · 무대·펜던트·실내 emissive 0 · 내 빛 1.4×4", () => {
    const t = LIGHT_TUNE.nightCitizen;
    expect(t.hemi).toBeCloseTo(0.05 * Math.PI, 9);
    expect(t.moon).toBeCloseTo(0.08 * Math.PI, 9);
    expect(t.exposure).toBeCloseTo(0.75, 9);
    expect([t.stage, t.pendant, t.emissive.room, t.emissive.vote, t.glow.room, t.glow.vote]).toEqual([0, 0, 0, 0, 0, 0]);
    expect(t.self).toBeCloseTo(1.4 * 4, 9);
  });

  it("nightGhost 행: night 달빛·반구와 같고 무대 쪽 기운(vote 그룹)은 night 의 0.4 배", () => {
    const g = LIGHT_TUNE.nightGhost;
    const n = LIGHT_TUNE.night;
    expect([g.hemi, g.moon, g.exposure, g.stage, g.pendant]).toEqual([n.hemi, n.moon, n.exposure, n.stage, n.pendant]);
    expect(g.emissive.vote).toBeCloseTo(n.emissive.vote * 0.4, 9);
    expect(g.glow.vote).toBeCloseTo(n.glow.vote * 0.4, 9);
    expect(g.self).toBe(0);
  });

  it("두 새 행의 하늘·안개 색은 night 보다 밝지 않다(낮도 마피아 분위기)", () => {
    for (const k of ["nightCitizen", "nightGhost"] as const) {
      for (let i = 0; i < 3; i++) expect(lum(LIGHT_TUNE[k].sky[i]!), `${k}[${i}]`).toBeLessThanOrEqual(lum(LIGHT_TUNE.night.sky[i]!) + 1e-9);
    }
  });

  it("내 캐릭터 빛은 처음부터 있고 nightCitizen 외 모든 단계에서 세기 0 이다", () => {
    const bar = buildBarScene(LADDER[0]!);
    expect(bar.lights.self).toBeInstanceOf(PointLight);
    expect(bar.lights.self.intensity).toBe(0);
    for (const phase of ALL_PHASES) {
      bar.setLighting(phase);
      if (phase === "nightCitizen") expect(bar.lights.self.intensity).toBeCloseTo(LIGHT_TUNE.nightCitizen.self, 9);
      else expect(bar.lights.self.intensity, phase).toBe(0);
    }
    bar.dispose();
  });

  it("조명 단계가 어떻게 바뀌어도 장면의 점광원 수·보이는 점광원 수가 변하지 않는다(셰이더 재컴파일 방지)", () => {
    for (const step of [0, 3]) {
      const bar = buildBarScene(LADDER[step]!);
      const total = lightsOf(bar.root, PointLight).length;
      let visible = 0;
      bar.root.traverseVisible((o) => {
        if (o instanceof PointLight) visible++;
      });
      for (const phase of ALL_PHASES) {
        bar.setLighting(phase);
        let v = 0;
        bar.root.traverseVisible((o) => {
          if (o instanceof PointLight) v++;
        });
        expect(lightsOf(bar.root, PointLight), `${step}/${phase} total`).toHaveLength(total);
        expect(v, `${step}/${phase} visible`).toBe(visible);
      }
      bar.dispose();
    }
  });

  it("nightCitizen 에서 실내 emissive 가 0, nightGhost 에서 vote 그룹 emissive 가 night 의 0.4 배로 장면에 반영된다", () => {
    const bar = buildBarScene(LADDER[0]!);
    bar.setLighting("nightCitizen");
    expect(room(bar)).toBe(0);
    expect(vote(bar)).toBe(0);
    expect(bar.lights.stage.intensity).toBe(0);
    expect(bar.lights.pendantA.intensity).toBe(0);
    expect(bar.exposure).toBeCloseTo(0.75, 9);
    bar.setLighting("nightGhost");
    expect(vote(bar)).toBeCloseTo(LIGHT_TUNE.night.emissive.vote * 0.4, 9);
    expect(room(bar)).toBeCloseTo(LIGHT_TUNE.night.emissive.room, 9);
    bar.dispose();
  });

  it("setSelfLight({x,z}) → 빛 위치 (x, 2.0, z), null 이면 기본 자리로 돌아간다", () => {
    const bar = buildBarScene(LADDER[0]!);
    bar.setSelfLight({ x: 1.5, z: -2.5 });
    expect(bar.lights.self.position.x).toBeCloseTo(1.5, 9);
    expect(bar.lights.self.position.y).toBeCloseTo(2.0, 9);
    expect(bar.lights.self.position.z).toBeCloseTo(-2.5, 9);
    bar.setSelfLight(null);
    expect(bar.lights.self.position.y).toBeCloseTo(2.0, 9);
    expect(bar.lights.self.position.x).toBe(0);
    bar.dispose();
  });
});
