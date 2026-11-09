// 시계탑 광장 장면(maps/plaza.ts)을 WebGL 없이 node 에서 검사한다: 병합 구조·좌표·예산·조명 (MAP-06, D-22).
// 모범은 barScene.test.ts. 좌표 원문은 design/v2.0/blockout/plaza.js.
import { BufferGeometry, Color, DirectionalLight, HemisphereLight, Material, Mesh, Object3D, PointLight, Scene, Texture, Vector3 } from "three";
import { describe, expect, it } from "vitest";
import { createCharacter, figForSeat } from "../../src/world/character";
import { buildPlazaScene, PLAZA_CLOCK_HOURS, PLAZA_LIGHT_TUNE } from "../../src/world/maps/plaza";
import { PLAZA_PALETTE } from "../../src/world/palette";
import { DRAW_CALL_BUDGET, LADDER } from "../../src/world/renderer";
import { buildBarScene, LIGHT_TUNE } from "../../src/world/maps/bar";
import { MeshBasicMaterial } from "three";
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

// ---------- Task 2: 단계 조명 표·시계·예산 사다리 ----------

const lum = (hex: string): number => {
  const c = new Color(hex);
  return 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;
};
const emissiveRoomScalar = (p: ReturnType<typeof buildPlazaScene>): number => ((p.meshes.emissiveRoom!.material as MeshBasicMaterial).color.r);
const hourRot = (p: ReturnType<typeof buildPlazaScene>): number[] => [0, 1].map((i) => p.meshes[`handHour${i}`]!.rotation.z);
const minuteRot = (p: ReturnType<typeof buildPlazaScene>): number[] => [0, 1].map((i) => p.meshes[`handMinute${i}`]!.rotation.z);

describe("광장 단계 조명 표 PLAZA_LIGHT_TUNE (D-22, O-9)", () => {
  it("일곱 단계 행이 PhaseTune 구조(반구·달빛·노출·하늘 셋·안개·무대·가로등 점광·emissive·빛 무리·내 빛)로 모두 있다", () => {
    for (const ph of PHASES) {
      const t = PLAZA_LIGHT_TUNE[ph];
      expect(Object.keys(t).sort(), ph).toEqual(Object.keys(LIGHT_TUNE[ph]).sort());
      expect(t.sky).toHaveLength(3);
    }
  });

  it("talk 는 흐린 낮: 하늘·땅·배경 모두 파랑 지배 아님(b − max(r,g) < 0.12). 채도·휘도 허용 범위는 lighting.test.ts 가 잰다", () => {
    for (const ph of ["talk"] as const) {
      for (const hex of PLAZA_LIGHT_TUNE[ph].sky) {
        const c = new Color(hex);
        expect(c.b - Math.max(c.r, c.g), `${ph}/${hex}`).toBeLessThan(0.12);
      }
    }
  });

  it("방향광 색이 단계 표를 따른다: 만든 직후 talk 색, night 에서 달빛 남색, 다시 talk 에서 원래 색, 방향광은 하나뿐(D-03)", () => {
    const p = buildPlazaScene(LADDER[0]!);
    const hex = (): string => "#" + lightsOf(p.root, DirectionalLight)[0]!.color.getHexString();
    expect(lightsOf(p.root, DirectionalLight)).toHaveLength(1);
    expect(hex()).toBe("#eadfd0");
    p.setLighting("night");
    expect(hex()).toBe("#c9d4ff");
    p.setLighting("talk");
    expect(hex()).toBe("#eadfd0");
    expect(lightsOf(p.root, DirectionalLight)).toHaveLength(1);
    p.dispose();
  });

  it("모든 단계의 하늘·땅·배경은 talk 의 같은 칸보다 밝지 않다", () => {
    for (const ph of PHASES) for (let i = 0; i < 3; i++) expect(lum(PLAZA_LIGHT_TUNE[ph].sky[i]!), `${ph}/${i}`).toBeLessThanOrEqual(lum(PLAZA_LIGHT_TUNE.talk.sky[i]!) + 1e-6);
  });

  it("진홍은 장면 색에 없다: 팔레트·하늘·메시 정점 색 모두 (붉은 쪽이 지배적인 색 없음)", () => {
    const crimsonish = (c: Color): boolean => c.r >= 0.35 && c.r > 1.8 * c.g && c.r > 1.5 * c.b;
    const hexes: string[] = [];
    for (const v of Object.values(PLAZA_PALETTE)) hexes.push(...(Array.isArray(v) ? (v as string[]) : [v as string]));
    for (const ph of PHASES) hexes.push(...PLAZA_LIGHT_TUNE[ph].sky);
    for (const h of hexes) expect(crimsonish(new Color(h)), h).toBe(false);
    const p = buildPlazaScene(LADDER[0]!);
    for (const m of allMeshes(p.root)) {
      const col = m.geometry.getAttribute("color");
      if (!col) continue;
      for (let i = 0; i < col.count; i += 7) {
        const c = new Color(col.getX(i), col.getY(i), col.getZ(i));
        expect(crimsonish(c)).toBe(false);
      }
    }
    p.dispose();
  });

  it("가로등 발광 배율: talk 0 · vote 1 · night 0.7 · trial 0.06, 가로등 점광원은 talk 에 꺼지고 vote 부터 켜진다", () => {
    const p = buildPlazaScene(LADDER[0]!);
    const lamp = p.lights.pendantA;
    const want: [LightingPhase, number][] = [
      ["talk", 0],
      ["vote", 1],
      ["trial", 0.06],
      ["night", 0.7],
    ];
    for (const [ph, k] of want) {
      p.setLighting(ph);
      expect(emissiveRoomScalar(p), ph).toBeCloseTo(k, 6);
    }
    p.setLighting("talk");
    expect(lamp.intensity).toBe(0);
    p.setLighting("vote");
    expect(lamp.intensity).toBeGreaterThan(0);
    p.dispose();
  });

  it("setLighting 순서(talk → vote → trial → night → nightCitizen → nightGhost → morning)에서 노출·반구·무대·내 빛이 표 값으로 바뀐다", () => {
    const p = buildPlazaScene(LADDER[0]!);
    for (const ph of PHASES) {
      p.setLighting(ph);
      const t = PLAZA_LIGHT_TUNE[ph];
      expect(p.exposure, ph).toBe(t.exposure);
      expect(p.lights.hemi.intensity, ph).toBeCloseTo(t.hemi, 6);
      expect(p.lights.stage.intensity, ph).toBeCloseTo(t.stage, 6);
      expect(p.lights.self.intensity, ph).toBeCloseTo(t.self, 6);
    }
    // vote·trial 은 무대 점광원이 켜지고 talk·night 는 꺼진다(시계탑 조명은 trial 의 무대 점광)
    p.setLighting("trial");
    expect(p.lights.stage.intensity).toBeGreaterThan(0);
    p.setLighting("night");
    expect(p.lights.stage.intensity).toBe(0);
    p.dispose();
  });

  it("핀·긴장·분필은 bar 와 같은 규칙으로 돈다: 핀이 무대 점광원을 옮기고 긴장 1 은 선두 세기, null 이면 복귀", () => {
    const p = buildPlazaScene(LADDER[0]!);
    p.setLighting("vote");
    const base = p.lights.stage.intensity;
    p.setPin({ x: 2, z: -1, strength: 1 }, 0.5);
    expect(p.lights.stage.position.x).toBe(2);
    expect(p.lights.stage.position.z).toBe(-1);
    expect(p.lights.stage.intensity).toBeCloseTo(PLAZA_LIGHT_TUNE.tension.lead, 6);
    p.setPin(null, 1);
    expect(p.lights.stage.intensity).toBeCloseTo(base, 6);
    p.setTension(1, { x: 1, z: 1 });
    expect(p.lights.stage.intensity).toBeCloseTo(PLAZA_LIGHT_TUNE.tension.lead, 6);
    expect(p.lights.stage.position.x).toBe(1);
    p.setTension(0);
    expect(p.lights.stage.intensity).toBeCloseTo(base, 6);
    p.setSelfLight({ x: 3, z: 2 });
    expect(p.lights.self.position.x).toBe(3);
    p.setSelfLight(null);
    expect(p.lights.self.position.x).toBe(0);
    p.setChalk({ x: 1, z: -3.4 }, 0.5);
    expect(p.meshes.chalk!.visible).toBe(true);
    p.setChalk(null, 0);
    expect(p.meshes.chalk!.visible).toBe(false);
    p.dispose();
  });
});

describe("광장 시계 (게임 시계 = 시계탑 바늘)", () => {
  it("목표 시각 표: talk 13 · vote 18 · trial 18.75 · night 0 · morning 6", () => {
    expect(PLAZA_CLOCK_HOURS.talk).toBe(13);
    expect(PLAZA_CLOCK_HOURS.vote).toBe(18);
    expect(PLAZA_CLOCK_HOURS.trial).toBe(18.75);
    expect(PLAZA_CLOCK_HOURS.night).toBe(0);
    expect(PLAZA_CLOCK_HOURS.morning).toBe(6);
  });

  it("바늘은 두 면(시침·분침 4개)이고 처음엔 talk 시각(13시)이다", () => {
    const p = buildPlazaScene(LADDER[0]!);
    expect(hourRot(p)).toEqual([-(1 / 12) * Math.PI * 2, -(1 / 12) * Math.PI * 2]);
    expect(minuteRot(p)).toEqual([-0, -0]);
    p.dispose();
  });

  it("setLighting 이 목표를 정하고 update(dt) 가 감쇠 3/초로 따라간다", () => {
    const p = buildPlazaScene(LADDER[0]!);
    p.setLighting("vote"); // 목표 18시
    const before = hourRot(p)[0]!;
    p.update!(0.1, 0); // 한 걸음 = 30% (13 → 14.5)
    const h1 = -((14.5 % 12) / 12) * Math.PI * 2;
    expect(hourRot(p)[0]!).toBeCloseTo(h1, 6);
    expect(hourRot(p)[0]!).not.toBeCloseTo(before, 3);
    p.update!(10, 0.1); // 충분히 오래 → 목표에 닿는다
    expect(hourRot(p)[0]!).toBeCloseTo(-((18 % 12) / 12) * Math.PI * 2, 6);
    expect(minuteRot(p)[1]!).toBeCloseTo(0, 6);
    p.setLighting("morning");
    p.update!(10, 0.2);
    expect(hourRot(p)[0]!).toBeCloseTo(-(6 / 12) * Math.PI * 2, 6);
    p.dispose();
  });

  it("trial 에서는 분침이 벽시계 30초 주기로 18.5~19 사이를 돈다", () => {
    const p = buildPlazaScene(LADDER[0]!);
    p.setLighting("trial");
    p.update!(10, 0); // 시각 18.5
    expect(-minuteRot(p)[0]! / (Math.PI * 2)).toBeCloseTo(0.5, 6);
    p.update!(10, 15); // 30초 주기의 절반: 18.75
    expect(-minuteRot(p)[0]! / (Math.PI * 2)).toBeCloseTo(0.75, 6);
    p.update!(10, 30); // 한 바퀴 뒤 처음으로
    expect(-minuteRot(p)[0]! / (Math.PI * 2)).toBeCloseTo(0.5, 6);
    p.dispose();
  });

  it("update 를 한 번도 부르지 않는 환경에서도 setLighting 이 던지지 않는다", () => {
    const p = buildPlazaScene(LADDER[0]!);
    expect(() => PHASES.forEach((ph) => p.setLighting(ph))).not.toThrow();
    p.dispose();
  });
});

describe("광장 예산 사다리 (T-11-34)", () => {
  it("LADDER 0 → 5 → 0 을 되돌릴 수 있다: 5단계는 소품 reduced 로 보이는 메시가 줄거나 같고, 0 으로 돌아오면 원래 수", () => {
    const p = buildPlazaScene(LADDER[0]!);
    const n0 = visibleMeshes(p.root).length;
    for (let i = 1; i < LADDER.length; i++) p.applyBudget(LADDER[i]!);
    const n5 = visibleMeshes(p.root).length;
    expect(n5).toBeLessThanOrEqual(n0);
    expect(p.meshes.furnitureFar!.visible).toBe(false);
    expect(p.lights.pendantA.visible).toBe(false);
    expect(p.root.fog).toBeNull();
    p.applyBudget(LADDER[0]!);
    expect(visibleMeshes(p.root).length).toBe(n0);
    expect(p.lights.pendantA.visible).toBe(true);
    expect(p.root.fog).not.toBeNull();
    expect(p.lights.moon.shadow.mapSize.x).toBe(1024);
    p.dispose();
  });

  it("사다리 각 단계에서 점광원은 3 이하이고 단계마다 draw call 추정이 상한 이하다(8명)", () => {
    const p = buildPlazaScene(LADDER[0]!);
    const chars = Array.from({ length: 8 }, (_, i) => createCharacter(figForSeat(i), (["coat", "police", "doctor", "mafia"] as const)[i % 4]!));
    for (const c of chars) p.root.add(c.root);
    LADDER.forEach((b, i) => {
      p.applyBudget(b);
      for (const ph of PHASES) {
        p.setLighting(ph);
        const vis = visibleMeshes(p.root);
        expect(vis.length + vis.filter((m) => m.castShadow).length, `${i}/${ph}`).toBeLessThanOrEqual(DRAW_CALL_BUDGET);
        let pl = 0;
        p.root.traverseVisible((o) => {
          if ((o as PointLight).isPointLight) pl++;
        });
        expect(pl, `${i}/${ph}`).toBeLessThanOrEqual(3);
      }
    });
    for (const c of chars) c.dispose();
    p.dispose();
  });
});

describe("광장 정적 예산: 8명 서로 다른 의상 + 동시 동작 4개 (T-11-34)", () => {
  const MIX = ["detective", "noir", "mafia", "reporter", "hood", "elder", "police", "doctor"] as const;
  const EMOTES = ["clap", "deny", "dance", "surprise"] as const;
  const triangles = (meshes: Mesh[]): number => meshes.reduce((n, m) => n + (m.geometry.index ? m.geometry.index.count / 3 : m.geometry.getAttribute("position").count / 3), 0);
  const measure = (root: Object3D): { calls: number; tris: number; textures: number } => {
    const vis = visibleMeshes(root);
    const tex = new Set<Texture>();
    for (const m of vis) for (const x of mats(m)) {
      const map = (x as { map?: Texture | null }).map;
      if (map) tex.add(map);
    }
    return { calls: vis.length + vis.filter((m) => m.castShadow).length, tris: triangles(vis), textures: tex.size };
  };

  it("보이는 메시 + 그림자 메시 합이 120 이하이고, 재즈 바 같은 구성보다 크게 늘지 않는다(허용 +16 호출, 삼각형 1.6배, 텍스처 같음)", () => {
    const plaza = buildPlazaScene(LADDER[0]!);
    const bar = buildBarScene(LADDER[0]!);
    const chars = (scene: Object3D) =>
      Array.from({ length: 8 }, (_, i) => {
        const c = createCharacter(figForSeat(i), MIX[i]!);
        if (i < 4) c.playEmote(EMOTES[i]!);
        scene.add(c.root);
        return c;
      });
    const pc = chars(plaza.root);
    const bc = chars(bar.root);
    for (const ph of PHASES) {
      plaza.setLighting(ph);
      bar.setLighting(ph);
      const a = measure(plaza.root);
      const b = measure(bar.root);
      expect(a.calls, `calls ${ph}`).toBeLessThanOrEqual(DRAW_CALL_BUDGET);
      expect(a.calls, `vs bar ${ph}`).toBeLessThanOrEqual(b.calls + 16);
      expect(a.tris, `tris ${ph}`).toBeLessThanOrEqual(b.tris * 1.6);
      expect(a.textures, `textures ${ph}`).toBeLessThanOrEqual(b.textures);
    }
    for (const c of [...pc, ...bc]) c.dispose();
    plaza.dispose();
    bar.dispose();
  });
});
