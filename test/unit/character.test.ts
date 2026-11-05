// 06-11 3D 캐릭터 — 원본 design/v2.0/blockout/character.js(결정 0048)를 관절 병합으로 옮긴 모듈 (MAP-01, MAP-02).
// WebGL 없이 node 에서 장면 그래프로 검사한다.
import { BufferGeometry, CircleGeometry, Color, type Group, type Material, type Mesh, MeshBasicMaterial, MeshStandardMaterial, type Object3D } from "three";
import { describe, expect, it, vi } from "vitest";
import { MOVE_SPEED } from "../../shared/game/world";
import { emoteDurationMs } from "../../src/world/emoteCap";
import { CHAR_SCALE, characterKit, createCharacter, figForSeat, POSE_BLEND_MS, WALK_PHASE_RATE, type WorldCharacter } from "../../src/world/character";
import { EMOTE_KEYS, EMOTES, type EmoteId, FACE_IDS, FIGS, OUTFITS, type OutfitId } from "../../src/world/characterData";

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

  it("걷는 동안 다리가 걸음 위상을 따라 돈다(POSE_BLEND_MS 이상 걸은 뒤 정확한 값)", () => {
    const c = createCharacter(1, "coat");
    const legA = joint(c.root, "legA");
    const dt = 0.016;
    let phase = 0;
    for (let i = 0; i < 10; i++) {
      c.update(dt, i * dt, true);
      phase += dt * WALK_PHASE_RATE;
    }
    expect(10 * dt * 1000).toBeGreaterThanOrEqual(POSE_BLEND_MS);
    expect(legA.rotation.x).toBeCloseTo(-Math.sin(phase) * 0.6, 6);
    expect(joint(c.root, "legB").rotation.x).toBeCloseTo(Math.sin(phase) * 0.6, 6);
  });

  it("멈추면 걷기 자세를 풀고 서 있는 자세로 돌아온다(POSE_BLEND_MS 이상 지난 뒤 정확히 0)", () => {
    const c = createCharacter(1, "coat");
    for (let i = 0; i < 10; i++) c.update(0.016, i * 0.016, true);
    for (let i = 0; i < 10; i++) c.update(0.016, 0.2 + i * 0.016, false);
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

// ---------- Task 2: 의상 9종·모자/잘린 머리카락·귀·장신구·소품·표정 병합 캐시·어둡게·해제 ----------

const OUTFIT_IDS = Object.keys(OUTFITS) as OutfitId[];
/** 병합 재질을 쓰는 관절 메시(투명 조각·원판 제외) */
function jointMeshes(root: Object3D): Mesh[] {
  return meshes(root).filter((m) => (m.material as MeshStandardMaterial).vertexColors === true);
}
function headMesh(c: WorldCharacter): Mesh {
  const m = joint(c.root, "neck").children.find((x) => (x as Mesh).isMesh);
  if (!m) throw new Error("머리 메시 없음");
  return m as Mesh;
}
function armMesh(c: WorldCharacter, name: "armA" | "armB"): Mesh {
  const m = joint(c.root, name).children.find((x) => (x as Mesh).isMesh);
  if (!m) throw new Error(`${name} 메시 없음`);
  return m as Mesh;
}
function vcount(g: BufferGeometry): number {
  return g.getAttribute("position").count;
}
/** 정점 색이 hex 와 같은 정점 수 */
function countColor(g: BufferGeometry, hex: string): number {
  const c = new Color(hex);
  const a = g.getAttribute("color");
  let n = 0;
  for (let i = 0; i < a.count; i++) {
    if (Math.abs(a.getX(i) - c.r) < 1e-4 && Math.abs(a.getY(i) - c.g) < 1e-4 && Math.abs(a.getZ(i) - c.b) < 1e-4) n++;
  }
  return n;
}
const HAIR_PIECE = 33 * 17; // SphereGeometry(32, 16) 한 조각의 정점 수
const SKULL = 33 * 25;
const EAR_PAIR = 2 * 15 * 11;

describe("의상 9종", () => {
  it("의상을 9종 각각으로 바꿔도 관절 메시는 6 그대로이고 전체 메시는 8 이하이다", () => {
    const c = createCharacter(0, "coat");
    for (const id of OUTFIT_IDS) {
      c.applyOutfit(id);
      expect(jointMeshes(c.root).length).toBe(6);
      expect(c.meshCount()).toBeLessThanOrEqual(8);
    }
  });

  it("모자 의상이면 머리카락 정수리를 빼고 잘린 벌(hatHair)로 바꾼다", () => {
    const c = createCharacter(0, "coat");
    const hair = FIGS[0].hair;
    expect(countColor(headMesh(c).geometry, hair)).toBe(3 * HAIR_PIECE);
    c.applyOutfit("police");
    expect(countColor(headMesh(c).geometry, hair)).toBe(2 * HAIR_PIECE);
    expect(countColor(headMesh(c).geometry, "#2a4372")).toBeGreaterThan(0);
  });

  it("후드는 머리카락 그대로이고 귀는 빠진다", () => {
    const c = createCharacter(0, "coat");
    expect(countColor(headMesh(c).geometry, "#f7c9a6")).toBe(SKULL + EAR_PAIR);
    c.applyOutfit("hood");
    expect(countColor(headMesh(c).geometry, FIGS[0].hair)).toBe(3 * HAIR_PIECE);
    expect(countColor(headMesh(c).geometry, "#f7c9a6")).toBe(SKULL);
    expect(countColor(headMesh(c).geometry, "#5a5f6c")).toBeGreaterThan(0);
  });

  it("단발(girl) 인물은 어떤 의상에서도 귀가 없다", () => {
    const c = createCharacter(2, "coat");
    for (const id of OUTFIT_IDS) {
      c.applyOutfit(id);
      expect(countColor(headMesh(c).geometry, "#f7c9a6")).toBe(SKULL);
    }
  });

  it("인물 기본 모자(도윤·하은)는 기본 코트에서도 쓴다", () => {
    const dark = createCharacter(3, "coat");
    expect(countColor(headMesh(dark).geometry, "#3d4357")).toBeGreaterThan(0);
    const plain = createCharacter(0, "coat");
    expect(countColor(headMesh(plain).geometry, "#3d4357")).toBe(0);
  });

  it("마피아는 선글라스, 어르신은 수염·흰 머리 색, 후드는 장갑 손 색이다", () => {
    const c = createCharacter(0, "coat");
    expect(countColor(headMesh(c).geometry, "#14161c")).toBe(0);
    c.applyOutfit("mafia");
    expect(countColor(headMesh(c).geometry, "#14161c")).toBeGreaterThan(0);
    c.applyOutfit("elder");
    expect(countColor(headMesh(c).geometry, "#e6e8ee")).toBeGreaterThan(0);
    expect(countColor(headMesh(c).geometry, "#d8dbe3")).toBe(3 * HAIR_PIECE);
    c.applyOutfit("hood");
    expect(countColor(armMesh(c, "armA").geometry, "#7a5236")).toBeGreaterThan(0);
    c.applyOutfit("coat");
    expect(countColor(armMesh(c, "armA").geometry, "#7a5236")).toBe(0);
  });

  it("소품은 오른팔 메시에 병합되고, 돋보기 유리만 투명 조각으로 따로 둔다", () => {
    const c = createCharacter(0, "coat");
    const plain = vcount(armMesh(c, "armB").geometry);
    c.applyOutfit("reporter");
    expect(vcount(armMesh(c, "armB").geometry)).toBeGreaterThan(plain);
    expect(c.meshCount()).toBe(7);
    c.applyOutfit("detective");
    expect(vcount(armMesh(c, "armB").geometry)).toBeGreaterThan(plain);
    expect(c.meshCount()).toBe(8);
    const glass = meshes(c.root).filter((m) => (m.material as Material).transparent && (m.material as MeshStandardMaterial).vertexColors !== true && !(m.geometry instanceof CircleGeometry && (m.geometry as CircleGeometry).parameters.radius === 0.42));
    expect(glass.length).toBe(1);
    c.applyOutfit("coat");
    expect(c.meshCount()).toBe(7);
  });

  it("넥타이가 없는 의상(의사)은 인물 넥타이 색이 몸통에 없다", () => {
    const c = createCharacter(0, "coat");
    const torso = joint(c.root, "body").children.find((x) => (x as Mesh).isMesh) as Mesh;
    expect(countColor(torso.geometry, FIGS[0].tie)).toBeGreaterThan(0);
    c.applyOutfit("doctor");
    expect(countColor(torso.geometry, FIGS[0].tie)).toBe(0);
  });
});

describe("표정 병합 캐시", () => {
  it("표정을 바꾸면 머리 병합 지오메트리가 바뀌고 같은 (의상, 표정)으로 돌아오면 같은 객체를 다시 쓴다", () => {
    const c = createCharacter(0, "coat");
    const mesh = headMesh(c);
    const base = mesh.geometry;
    const seen = new Set<BufferGeometry>([base]);
    for (const f of FACE_IDS.filter((x) => x !== "base")) {
      c.setFace(f);
      expect(mesh.geometry === base).toBe(false);
      seen.add(mesh.geometry);
    }
    expect(seen.size).toBe(FACE_IDS.length);
    c.setFace("base");
    expect(mesh.geometry === base).toBe(true);
    c.setFace("happy");
    expect(seen.has(mesh.geometry)).toBe(true);
  });

  it("표정을 바꿔도 다른 관절 지오메트리는 그대로이고 메시 수는 늘지 않는다", () => {
    const c = createCharacter(1, "coat");
    const arm = armMesh(c, "armA").geometry;
    const before = c.meshCount();
    c.setFace("angry");
    expect(armMesh(c, "armA").geometry === arm).toBe(true);
    expect(c.meshCount()).toBe(before);
  });

  it("의상을 바꿨다 돌아오면 같은 지오메트리를 다시 쓴다", () => {
    const c = createCharacter(1, "coat");
    const torso = joint(c.root, "body").children.find((x) => (x as Mesh).isMesh) as Mesh;
    const g0 = torso.geometry;
    const h0 = headMesh(c).geometry;
    c.applyOutfit("police");
    expect(torso.geometry === g0).toBe(false);
    c.applyOutfit("coat");
    expect(torso.geometry === g0).toBe(true);
    expect(headMesh(c).geometry === h0).toBe(true);
  });

  it("모르는 표정 이름은 기본 표정으로 받는다", () => {
    const c = createCharacter(1, "coat");
    const base = headMesh(c).geometry;
    c.setFace("nope");
    expect(headMesh(c).geometry === base).toBe(true);
  });
});

describe("끊긴 사람 표시 setDim", () => {
  function snapshot(c: WorldCharacter): Float32Array[] {
    return jointMeshes(c.root).map((m) => Float32Array.from(m.geometry.getAttribute("color").array as Float32Array));
  }
  function lum(r: number, g: number, b: number): number {
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  }

  it("켜면 모든 관절 정점이 회색조이고 밝기는 원래 휘도 × 0.6 이다", () => {
    const c = createCharacter(0, "coat");
    const before = snapshot(c);
    c.setDim(true);
    const ms = jointMeshes(c.root);
    let grayBad = 0;
    let lumBad = 0;
    ms.forEach((m, k) => {
      const a = m.geometry.getAttribute("color").array as Float32Array;
      for (let i = 0; i < a.length; i += 3) {
        if (Math.abs(a[i] - a[i + 1]) > 1e-6 || Math.abs(a[i + 1] - a[i + 2]) > 1e-6) grayBad++;
        if (Math.abs(a[i] - lum(before[k][i], before[k][i + 1], before[k][i + 2]) * 0.6) > 0.01) lumBad++;
      }
    });
    expect(grayBad).toBe(0);
    expect(lumBad).toBe(0);
  });

  it("투명하게 만들지 않고 공유 재질과 다른 캐릭터의 색을 바꾸지 않는다", () => {
    const a = createCharacter(0, "coat");
    const b = createCharacter(1, "coat");
    const bBefore = snapshot(b);
    a.setDim(true);
    const mat = jointMeshes(a.root)[0].material as MeshStandardMaterial;
    expect(mat.transparent).toBe(false);
    expect(mat.opacity).toBe(1);
    expect(jointMeshes(b.root)[0].material === mat).toBe(true);
    const bAfter = snapshot(b);
    let diff = 0;
    bBefore.forEach((arr, k) => arr.forEach((v, i) => (v === bAfter[k][i] ? 0 : diff++)));
    expect(diff).toBe(0);
  });

  it("켜고 끄기를 왕복해도 원래 색이 그대로 돌아온다", () => {
    const c = createCharacter(2, "coat");
    const before = snapshot(c);
    for (let n = 0; n < 5; n++) {
      c.setDim(true);
      c.setDim(false);
    }
    const after = snapshot(c);
    let diff = 0;
    before.forEach((arr, k) => arr.forEach((v, i) => (v === after[k][i] ? 0 : diff++)));
    expect(diff).toBe(0);
  });

  it("어두운 채로 의상을 바꿔도 새 병합이 어둡고, 끄면 새 의상 원래 색이 된다", () => {
    const c = createCharacter(0, "coat");
    c.setDim(true);
    c.applyOutfit("police");
    const a = headMesh(c).geometry.getAttribute("color").array as Float32Array;
    let grayBad = 0;
    for (let i = 0; i < a.length; i += 3) if (Math.abs(a[i] - a[i + 1]) > 1e-6 || Math.abs(a[i + 1] - a[i + 2]) > 1e-6) grayBad++;
    expect(grayBad).toBe(0);
    c.setDim(false);
    expect(countColor(headMesh(c).geometry, "#2a4372")).toBeGreaterThan(0);
  });
});

describe("해제 dispose", () => {
  it("만든 지오메트리를 모두 해제하고 공유 재질·원판은 해제하지 않는다", () => {
    const geoSpy = vi.spyOn(BufferGeometry.prototype, "dispose");
    const matSpy = vi.spyOn(MeshStandardMaterial.prototype, "dispose");
    try {
      const c = createCharacter(0, "coat");
      const seen = new Set<BufferGeometry>();
      const collect = () => {
        for (const m of meshes(c.root, false)) if (m !== discOf(c.root)) seen.add(m.geometry);
      };
      collect();
      for (const id of ["police", "detective", "hood", "coat"] as OutfitId[]) {
        c.applyOutfit(id);
        collect();
      }
      for (const f of ["happy", "dead"]) {
        c.setFace(f);
        collect();
      }
      c.setDim(true);
      geoSpy.mockClear();
      c.dispose();
      const disposed = new Set(geoSpy.mock.contexts as BufferGeometry[]);
      let missing = 0;
      for (const g of seen) if (!disposed.has(g)) missing++;
      expect(missing).toBe(0);
      expect(geoSpy.mock.calls.length).toBe(seen.size);
      expect(matSpy.mock.calls.length).toBe(0);
    } finally {
      geoSpy.mockRestore();
      matSpy.mockRestore();
    }
  });
});

// ---------- Task 3: 동작 9종 키프레임·걷기 시작이 동작을 끊음·표정 연동 ----------

/** 원문 emotePose 를 그대로 옮긴 기준 구현(smoothstep k = l²(3 − 2l)). t 는 동작 시작 뒤 경과 시간 */
function refEmote(id: EmoteId, t0: number, base: Record<string, number>): Record<string, number> | null {
  const d = EMOTES[id];
  const n = d.frames.length;
  const last = n * d.cycles - 1;
  const total = n * d.seg * d.cycles;
  if (t0 > total + d.hold) return null;
  const t = Math.min(t0, total);
  const idx = Math.min(Math.floor(t / d.seg), last);
  const local = Math.min(1, (t - idx * d.seg) / d.seg);
  const fa = d.frames[idx % n];
  const fb = idx >= last ? fa : d.frames[(idx + 1) % n];
  const k = local * local * (3 - 2 * local);
  const out: Record<string, number> = {};
  for (const key of EMOTE_KEYS) {
    const a = typeof fa[key] === "number" ? (fa[key] as number) : base[key];
    const b = typeof fb[key] === "number" ? (fb[key] as number) : base[key];
    out[key] = a + (b - a) * k;
  }
  return out;
}
function idleBase(figIndex: number): Record<string, number> {
  return { aAx: 0, aAz: 0.12, aBx: 0, aBz: -0.12, fA: 0, fB: 0, lA: 0, lB: 0, hx: 0, hy: 0, hz: 0, y: Math.sin(FIGS[figIndex].name.length) * 0.012, s: 1, ry: 0 };
}
/** 관절에 적용된 자세를 원문 applyPose 의 대응으로 읽는다 */
function readPose(c: WorldCharacter): Record<string, number> {
  const armA = joint(c.root, "armA");
  const armB = joint(c.root, "armB");
  const neck = joint(c.root, "neck");
  const body = joint(c.root, "body");
  return {
    aAx: armA.rotation.x,
    aAz: armA.rotation.z,
    aBx: armB.rotation.x,
    aBz: armB.rotation.z,
    fA: armA.position.z,
    fB: armB.position.z,
    lA: joint(c.root, "legA").rotation.x,
    lB: joint(c.root, "legB").rotation.x,
    hx: neck.rotation.x,
    hy: neck.rotation.y,
    hz: neck.rotation.z,
    y: body.position.y,
    s: body.scale.y,
    ry: body.rotation.y,
  };
}

describe("동작 9종", () => {
  it("동작 이름 9개와 키프레임 키는 EMOTE_KEYS 안이다", () => {
    expect(Object.keys(EMOTES).join(",")).toBe("throat,deny,clap,cry,handshake,point,praise,surprise,dance");
    let bad = 0;
    for (const d of Object.values(EMOTES)) for (const f of d.frames) for (const [k, v] of Object.entries(f)) if (typeof v === "number" && !(EMOTE_KEYS as readonly string[]).includes(k)) bad++;
    expect(bad).toBe(0);
  });

  it("박수는 팔을 앞으로 들고(−1.2 ~ −1.25) 웃는 얼굴이 되며 총 길이 뒤 기본 자세로 돌아간다", () => {
    const c = createCharacter(0, "coat");
    const ref = createCharacter(0, "coat");
    ref.setFace("happy");
    const baseFace = vcount(headMesh(c).geometry);
    c.playEmote("clap");
    c.update(0.016, 0, false);
    expect(readPose(c).aAx).toBeLessThan(-1.19);
    expect(readPose(c).aAx).toBeGreaterThan(-1.26);
    expect(vcount(headMesh(c).geometry)).toBe(vcount(headMesh(ref).geometry));
    expect(vcount(headMesh(c).geometry)).not.toBe(baseFace);
    const total = 2 * 0.16 * 4 + 0;
    let t = 0.016;
    while (t <= total + 0.05) {
      t += 0.016;
      c.update(0.016, t, false);
    }
    expect(readPose(c).aAx).toBe(0);
    expect(vcount(headMesh(c).geometry)).toBe(baseFace);
  });

  it("나 아니야 중 걷기 시작하면 동작이 끊기고 다음 프레임부터 걷기·서기 자세이다", () => {
    const c = createCharacter(0, "coat");
    c.playEmote("deny");
    c.update(0.016, 0, false);
    expect(readPose(c).aAx).toBeCloseTo(-1.5, 1);
    c.update(0.016, 0.016, true);
    expect(Math.abs(readPose(c).aAx)).toBeLessThan(0.5);
    // 걷기→서기도 POSE_BLEND_MS 에 걸쳐 섞이므로(결정 0059) 멈춘 바로 다음 프레임이 아니라 섞기가 끝난 뒤 서 있는 자세를 기대한다
    for (let i = 0; i < 10; i++) c.update(0.016, 0.032 + i * 0.016, false);
    expect(readPose(c).aAx).toBe(0);
    expect(readPose(c).hy).toBe(0);
  });

  it("보간은 원문 smoothstep 과 1e-9 안에서 같다(9종 × 여러 시각, 홀드·끝 포함)", () => {
    const ids = Object.keys(EMOTES) as EmoteId[];
    let worst = 0;
    let nulls = 0;
    for (const id of ids) {
      const d = EMOTES[id];
      const total = d.frames.length * d.seg * d.cycles;
      for (const t of [0.04, 0.09, 0.13, d.seg * 0.5, d.seg * 1.25, d.seg * 1.9, total * 0.5, total - 0.01, total + d.hold * 0.5, total + d.hold + 0.2]) {
        const c = createCharacter(0, "coat");
        c.playEmote(id);
        c.update(t, 0, false);
        const want = refEmote(id, t, idleBase(0));
        const got = readPose(c);
        if (!want) {
          nulls++;
          for (const k of Object.keys(got)) worst = Math.max(worst, Math.abs(got[k] - idleBase(0)[k]));
          continue;
        }
        for (const k of EMOTE_KEYS) worst = Math.max(worst, Math.abs(got[k] - want[k]));
      }
    }
    expect(nulls).toBeGreaterThan(0);
    expect(worst).toBeLessThan(1e-9);
  });

  it("동작이 끝난 뒤에는 표정도 기본으로 돌아가고, 몸 비틀기·찌그러짐도 풀린다", () => {
    const c = createCharacter(0, "coat");
    const base = vcount(headMesh(c).geometry);
    c.playEmote("surprise");
    c.update(0.1, 0, false);
    expect(vcount(headMesh(c).geometry)).not.toBe(base);
    c.update(3, 3, false);
    expect(vcount(headMesh(c).geometry)).toBe(base);
    expect(readPose(c).s).toBe(1);
    expect(readPose(c).ry).toBe(0);
  });

  it("모르는 동작 이름은 무시하고 서 있는 자세를 유지한다", () => {
    const c = createCharacter(0, "coat");
    c.playEmote("nope" as EmoteId);
    c.update(0.1, 0, false);
    expect(readPose(c).aAx).toBe(0);
  });

  it("서 있는 동안 바깥에서 정한 표정은 자세가 바뀌지 않는 한 유지된다", () => {
    const c = createCharacter(0, "coat");
    c.setFace("angry");
    const angry = headMesh(c).geometry;
    for (let i = 0; i < 5; i++) c.update(0.016, i * 0.016, false);
    expect(headMesh(c).geometry === angry).toBe(true);
  });
});

describe("자세 섞기 (결정 0059)", () => {
  const walkLegA = (phase: number): number => -Math.sin(phase) * 0.6;

  it("POSE_BLEND_MS 는 100 이상 150 이하다", () => {
    expect(POSE_BLEND_MS).toBeGreaterThanOrEqual(100);
    expect(POSE_BLEND_MS).toBeLessThanOrEqual(150);
  });

  it("서 있던 캐릭터가 한 프레임 움직이면 걷기 자세의 0 초과 1 미만 비율이다(한 번에 걷기 자세가 되지 않는다)", () => {
    const c = createCharacter(1, "coat");
    const dt = 0.016;
    c.update(dt, 0, true);
    const full = walkLegA(dt * WALK_PHASE_RATE);
    const ratio = joint(c.root, "legA").rotation.x / full;
    expect(ratio).toBeGreaterThan(0);
    expect(ratio).toBeLessThan(1);
  });

  it("걷다가 멈춘 첫 프레임에는 다리가 아직 0 이 아니고, POSE_BLEND_MS 이상 지나면 정확히 0 이다", () => {
    const c = createCharacter(1, "coat");
    for (let i = 0; i < 10; i++) c.update(0.016, i * 0.016, true);
    c.update(0.016, 0.2, false);
    expect(joint(c.root, "legA").rotation.x).not.toBe(0);
    for (let i = 1; i <= 10; i++) c.update(0.016, 0.2 + i * 0.016, false);
    expect(joint(c.root, "legA").rotation.x).toBe(0);
  });

  it("섞기 비율 0 은 서 있는 자세, 1 은 걷기 자세 그대로다(보간 반올림 오차 없음)", () => {
    const idle = createCharacter(1, "coat");
    const never = createCharacter(1, "coat");
    idle.update(0.016, 0.5, false);
    never.update(0.016, 0.5, false);
    expect(readPose(idle)).toEqual(readPose(never)); // 한 번도 걷지 않은 캐릭터는 서 있는 자세 그대로
    expect(readPose(idle).aAx).toBe(0);
    const c = createCharacter(1, "coat");
    let phase = 0;
    for (let i = 0; i < 12; i++) {
      c.update(0.016, i * 0.016, true);
      phase += 0.016 * WALK_PHASE_RATE;
    }
    expect(joint(c.root, "legA").rotation.x).toBe(walkLegA(phase));
    expect(readPose(c).aAx).toBe(Math.sin(phase) * 0.5);
  });

  it("머리 꼭대기 높이는 섞인 자세의 y 로 계산된다", () => {
    const c = createCharacter(1, "coat");
    const dt = 0.016;
    const r = c.update(dt, 0, true);
    const walkY = Math.abs(Math.cos(dt * WALK_PHASE_RATE)) * 0.06;
    const idleY = Math.sin(0 * 2 + FIGS[1]!.name.length) * 0.012;
    const k = (dt * 1000) / POSE_BLEND_MS;
    expect(r.headY).toBeCloseTo((2.45 + idleY + (walkY - idleY) * k) * CHAR_SCALE, 9);
  });
});

// ---------- 08-10 Task 1: 유령 setGhost (GHOST-01) ----------

describe("유령 setGhost (GHOST-01)", () => {
  /** 관절 메시(병합 재질 또는 유령 복제 재질)만 — 원판·고리는 vertexColors 가 없다 */
  function bodyMeshes(root: Object3D): Mesh[] {
    return meshes(root).filter((m) => (m.material as MeshStandardMaterial).vertexColors === true);
  }
  const matOf = (m: Mesh): MeshStandardMaterial => m.material as MeshStandardMaterial;

  it("켜면 그 캐릭터 관절 메시만 복제 재질(transparent, opacity 0.6, depthWrite false)을 쓰고 다른 캐릭터와 공유 재질은 그대로다", () => {
    const a = createCharacter(0, "coat");
    const b = createCharacter(1, "coat");
    const shared = matOf(bodyMeshes(a.root)[0]);
    a.setGhost(true);
    const aMeshes = bodyMeshes(a.root);
    expect(aMeshes).toHaveLength(6);
    for (const m of aMeshes) {
      expect(matOf(m)).not.toBe(shared);
      expect(matOf(m).transparent).toBe(true);
      expect(matOf(m).opacity).toBeCloseTo(0.6, 9);
      expect(matOf(m).depthWrite).toBe(false);
      expect(matOf(m).vertexColors).toBe(true);
    }
    // 여섯 관절이 복제 재질 하나를 함께 쓴다
    expect(new Set(aMeshes.map((m) => matOf(m))).size).toBe(1);
    // B 는 그대로, 공유 재질도 그대로
    for (const m of bodyMeshes(b.root)) expect(matOf(m)).toBe(shared);
    expect(shared.transparent).toBe(false);
    expect(shared.opacity).toBe(1);
    expect(shared.depthWrite).toBe(true);
  });

  it("안개(09.1-09): setGhost(true, 0.26, 발광) — 불투명도 0.26, 발광 #d8e4ff 세기 0.85, 투명·깊이쓰기 끔, 원판 숨김", () => {
    const c = createCharacter(0, "coat");
    c.setGhost(true, 0.26, { color: "#d8e4ff", intensity: 0.85 });
    const list = bodyMeshes(c.root);
    expect(list).toHaveLength(6);
    for (const m of list) {
      expect(matOf(m).opacity).toBeCloseTo(0.26, 9);
      expect(matOf(m).emissive.getHexString()).toBe("d8e4ff");
      expect(matOf(m).emissiveIntensity).toBeCloseTo(0.85, 9);
      expect(matOf(m).transparent).toBe(true);
      expect(matOf(m).depthWrite).toBe(false);
    }
    expect(discOf(c.root)).toBeUndefined();
  });

  it("glow 없이 부르면 발광 0 이고 공유 재질은 발광이 없다(처형 연출 경로 그대로)", () => {
    const c = createCharacter(0, "coat");
    const shared = matOf(bodyMeshes(c.root)[0]);
    c.setGhost(true, 0.6, { color: "#d8e4ff", intensity: 0.85 });
    c.setGhost(true, 0.6); // 안개 → 발광 없음으로 되돌린다
    expect(matOf(bodyMeshes(c.root)[0]).emissive.getHex()).toBe(0);
    c.setGhost(false);
    expect(matOf(bodyMeshes(c.root)[0])).toBe(shared);
    expect(shared.emissive.getHex()).toBe(0);
    expect(shared.emissiveIntensity).toBe(1);
  });

  it("꾸민 의상(detective)에 직업 의상(mafia)을 입힌 뒤 안개를 켜면 의상이 바뀌고 재질은 복제 하나다", () => {
    const c = createCharacter(0, "detective");
    c.applyOutfit("mafia");
    c.setGhost(true, 0.26, { color: "#d8e4ff", intensity: 0.85 });
    expect(new Set(bodyMeshes(c.root).map((m) => matOf(m))).size).toBe(1);
    // 의상이 바뀌어도(병합 지오메트리 교체) 복제 재질이 유지된다
    c.applyOutfit("police");
    for (const m of bodyMeshes(c.root)) expect(matOf(m).opacity).toBeCloseTo(0.26, 9);
  });

  it("켜면 발밑 그림자 원판이 숨고, 끄면 다시 보인다", () => {
    const c = createCharacter(0, "coat");
    c.setGhost(true);
    expect(discOf(c.root)).toBeUndefined();
    c.setGhost(false);
    expect(discOf(c.root)).toBeDefined();
  });

  it("setOpacity 는 유령일 때만 복제 재질의 불투명도를 바꾼다", () => {
    const c = createCharacter(0, "coat");
    const shared = matOf(bodyMeshes(c.root)[0]);
    c.setOpacity(0.3); // 유령이 아니면 효과 없음
    expect(shared.opacity).toBe(1);
    expect(matOf(bodyMeshes(c.root)[0])).toBe(shared);
    c.setGhost(true, 0.5);
    expect(matOf(bodyMeshes(c.root)[0]).opacity).toBeCloseTo(0.5, 9);
    c.setOpacity(0.3);
    for (const m of bodyMeshes(c.root)) expect(matOf(m).opacity).toBeCloseTo(0.3, 9);
    expect(shared.opacity).toBe(1);
  });

  it("끄면 관절이 공유 재질로 돌아오고 복제 재질은 정확히 한 번 dispose 된다", () => {
    const spy = vi.spyOn(MeshStandardMaterial.prototype, "dispose");
    try {
      const other = createCharacter(1, "coat");
      const shared = matOf(bodyMeshes(other.root)[0]);
      const c = createCharacter(0, "coat");
      c.setGhost(true);
      const clone = matOf(bodyMeshes(c.root)[0]);
      spy.mockClear();
      c.setGhost(false);
      for (const m of bodyMeshes(c.root)) expect(matOf(m)).toBe(shared);
      expect(spy.mock.contexts).toEqual([clone]);
      expect(shared.transparent).toBe(false);
    } finally {
      spy.mockRestore();
    }
  });

  it("켜기를 두 번 해도 복제 재질은 하나(누수 없음)이고, 왕복 반복 뒤에도 dispose 횟수가 켠 횟수와 같다", () => {
    const spy = vi.spyOn(MeshStandardMaterial.prototype, "dispose");
    try {
      const c = createCharacter(0, "coat");
      c.setGhost(true);
      const first = matOf(bodyMeshes(c.root)[0]);
      c.setGhost(true);
      expect(matOf(bodyMeshes(c.root)[0])).toBe(first);
      expect(spy).not.toHaveBeenCalled();
      c.setGhost(false);
      for (let n = 0; n < 4; n++) {
        c.setGhost(true);
        c.setGhost(false);
      }
      expect(spy).toHaveBeenCalledTimes(5);
      c.setGhost(false); // 이미 꺼져 있으면 아무것도 하지 않는다
      expect(spy).toHaveBeenCalledTimes(5);
    } finally {
      spy.mockRestore();
    }
  });

  it("유령인 채 dispose 하면 복제 재질도 해제하고, 이후 setGhost 는 무시한다", () => {
    const spy = vi.spyOn(MeshStandardMaterial.prototype, "dispose");
    try {
      const c = createCharacter(0, "coat");
      c.setGhost(true);
      const clone = matOf(bodyMeshes(c.root)[0]);
      spy.mockClear();
      c.dispose();
      expect(spy.mock.contexts).toEqual([clone]);
      c.setGhost(true); // 해제 뒤에는 무시
      c.setGhost(false);
      expect(spy).toHaveBeenCalledTimes(1);
    } finally {
      spy.mockRestore();
    }
  });

  it("유령이어도 setDim 의 색 칠하기(paint)는 그대로 동작하고, 의상을 바꿔도 복제 재질을 유지한다", () => {
    const c = createCharacter(0, "coat");
    c.setGhost(true);
    c.setDim(true);
    const a = bodyMeshes(c.root)[0].geometry.getAttribute("color").array as Float32Array;
    for (let i = 0; i < a.length; i += 3) {
      expect(Math.abs(a[i] - a[i + 1])).toBeLessThan(1e-6);
      expect(Math.abs(a[i + 1] - a[i + 2])).toBeLessThan(1e-6);
    }
    const clone = matOf(bodyMeshes(c.root)[0]);
    c.applyOutfit("police");
    c.setFace("happy");
    for (const m of bodyMeshes(c.root)) expect(matOf(m)).toBe(clone);
    c.setDim(false);
  });
});

// ---------- 08-10 Task 2: 손가락 유지 자세 holdPose · 발밑 고리 setRing (DAY-04) ----------

describe("손가락 유지 자세 holdPose (DAY-04)", () => {
  const last = EMOTES.point.frames[1] as Record<string, number | string>;
  const DT = 0.016;
  function run(c: WorldCharacter, seconds: number, t0 = 0): number {
    const n = Math.round(seconds / DT);
    for (let i = 0; i < n; i++) c.update(DT, t0 + i * DT, false);
    return t0 + n * DT;
  }
  function expectPoint(c: WorldCharacter): void {
    const p = readPose(c);
    expect(p.aBx).toBeCloseTo(last.aBx as number, 9);
    expect(p.aBz).toBeCloseTo(last.aBz as number, 9);
    expect(p.aAx).toBeCloseTo(last.aAx as number, 9);
    expect(p.aAz).toBeCloseTo(last.aAz as number, 9);
    expect(p.hy).toBeCloseTo(last.hy as number, 9);
  }

  it("holdPose('point') 뒤 update 를 3초 돌려도 팔 자세가 point 의 마지막 프레임 값이다(동작 길이 1.4초에 끝나지 않음)", () => {
    const c = createCharacter(0, "coat");
    c.holdPose("point");
    run(c, 3);
    expectPoint(c);
    run(c, 3, 3);
    expectPoint(c);
  });

  it("같은 시간 동안 playEmote('point') 만 한 캐릭터는 평소 자세로 끝난다(대조)", () => {
    const c = createCharacter(0, "coat");
    c.playEmote("point");
    run(c, 3);
    expect(readPose(c).aBx).toBeCloseTo(0, 9);
  });

  it("holdPose('point') 는 POSE_BLEND_MS 에 걸쳐 섞여 들어간다(한 프레임에 튀지 않는다)", () => {
    const c = createCharacter(0, "coat");
    c.holdPose("point");
    c.update(DT, 0, false);
    const x = readPose(c).aBx;
    expect(x).toBeLessThan(0);
    expect(x).toBeGreaterThan(last.aBx as number);
  });

  it("holdPose(null) 뒤 POSE_BLEND_MS 이상 지나면 평소 자세(팔 내림)로 돌아온다", () => {
    const c = createCharacter(0, "coat");
    c.holdPose("point");
    const t = run(c, 1);
    c.holdPose(null);
    c.update(DT, t, false);
    expect(readPose(c).aBx).toBeLessThan(0); // 첫 프레임엔 아직 point 쪽에 남아 있다
    run(c, (POSE_BLEND_MS + 40) / 1000, t + DT);
    const p = readPose(c);
    expect(p.aBx).toBe(0);
    expect(p.aAx).toBe(0);
    expect(p.aAz).toBeCloseTo(0.12, 9);
    expect(p.aBz).toBeCloseTo(-0.12, 9);
    expect(p.hy).toBe(0);
  });

  it("holdPose 중 playEmote('deny') 는 deny 를 한 번 재생한 뒤 point 유지로 돌아온다", () => {
    const c = createCharacter(0, "coat");
    c.holdPose("point");
    const t = run(c, 1);
    c.playEmote("deny");
    // deny 는 머리를 +0.35 쪽으로도 돌린다(point 의 hy 는 −0.25)
    let maxHy = -Infinity;
    const total = EMOTES.deny.frames.length * EMOTES.deny.seg * EMOTES.deny.cycles;
    const n = Math.round(total / DT) + 5;
    for (let i = 0; i < n; i++) {
      c.update(DT, t + i * DT, false);
      maxHy = Math.max(maxHy, readPose(c).hy);
    }
    expect(maxHy).toBeGreaterThan(0.2);
    run(c, 0.2, t + n * DT);
    expectPoint(c);
  });

  it("holdPose 를 걸어도 걷기 시작하면 걷기 동작은 걷기 자세 위에 그대로 이어진다(다리는 걷기 값)", () => {
    const c = createCharacter(0, "coat");
    c.holdPose("point");
    for (let i = 0; i < 20; i++) c.update(DT, i * DT, true);
    expect(readPose(c).lA).not.toBe(0);
    expect(readPose(c).aBx).toBeCloseTo(last.aBx as number, 9); // 팔은 유지 자세
  });
});

describe("발밑 고리 setRing (DAY-04, 밤 임시 틀)", () => {
  const ringOf = (c: WorldCharacter): Mesh | undefined => c.root.getObjectByName("ring") as Mesh | undefined;

  it("setRing(색) 은 root 자식에 이름 'ring' 고리 메시 하나를 붙이고, 같은 메시의 색만 바꾼다", () => {
    const c = createCharacter(0, "coat");
    expect(ringOf(c)).toBeUndefined();
    c.setRing("#cc3333");
    const r = ringOf(c)!;
    expect(r).toBeDefined();
    expect(r.parent).toBe(c.root);
    expect((r.material as MeshBasicMaterial).color.getHexString()).toBe("cc3333");
    expect(c.root.children.filter((x) => x.name === "ring")).toHaveLength(1);
    c.setRing("#3333cc");
    expect(ringOf(c)).toBe(r);
    expect((r.material as MeshBasicMaterial).color.getHexString()).toBe("3333cc");
    expect(c.root.children.filter((x) => x.name === "ring")).toHaveLength(1);
  });

  it("고리는 투명 0.85·depthWrite false·바닥에 눕고 그림자 원판과 같은 높이대다", () => {
    const c = createCharacter(0, "coat");
    c.setRing("#cc3333");
    const r = ringOf(c)!;
    const m = r.material as MeshBasicMaterial;
    expect(m).toBeInstanceOf(MeshBasicMaterial);
    expect(m.transparent).toBe(true);
    expect(m.opacity).toBeCloseTo(0.85, 9);
    expect(m.depthWrite).toBe(false);
    expect(r.rotation.x).toBeCloseTo(-Math.PI / 2, 9);
    expect(Math.abs(r.position.y - discOf(c.root)!.position.y)).toBeLessThan(0.02);
  });

  it("setRing(null) 은 고리를 떼고 지오메트리·재질을 해제한다. 이미 없으면 아무 일도 없다", () => {
    const geoSpy = vi.spyOn(BufferGeometry.prototype, "dispose");
    const matSpy = vi.spyOn(MeshBasicMaterial.prototype, "dispose");
    try {
      const c = createCharacter(0, "coat");
      c.setRing("#cc3333");
      const r = ringOf(c)!;
      geoSpy.mockClear();
      matSpy.mockClear();
      c.setRing(null);
      expect(ringOf(c)).toBeUndefined();
      expect(geoSpy.mock.contexts).toEqual([r.geometry]);
      expect(matSpy.mock.contexts).toEqual([r.material]);
      c.setRing(null);
      expect(geoSpy).toHaveBeenCalledTimes(1);
    } finally {
      geoSpy.mockRestore();
      matSpy.mockRestore();
    }
  });

  it("붙인 채 dispose 하면 고리 지오메트리와 재질도 해제한다(공유 재질·원판은 그대로)", () => {
    const geoSpy = vi.spyOn(BufferGeometry.prototype, "dispose");
    const matSpy = vi.spyOn(MeshBasicMaterial.prototype, "dispose");
    try {
      const c = createCharacter(0, "coat");
      c.setRing("#cc3333");
      const r = ringOf(c)!;
      geoSpy.mockClear();
      matSpy.mockClear();
      c.dispose();
      expect(geoSpy.mock.contexts).toContain(r.geometry);
      expect(matSpy.mock.contexts).toEqual([r.material]);
      c.setRing("#33cc33"); // 해제 뒤에는 무시
      expect(ringOf(c)).toBeUndefined();
    } finally {
      geoSpy.mockRestore();
      matSpy.mockRestore();
    }
  });

  it("meshCount 는 고리가 있으면 +1 이다", () => {
    const c = createCharacter(0, "coat");
    const before = c.meshCount();
    c.setRing("#cc3333");
    expect(c.meshCount()).toBe(before + 1);
    c.setRing(null);
    expect(c.meshCount()).toBe(before);
  });
});

// ---------- 09.1-q2: 마피아 밤 선택 효과 setPickMark (결정 0065) ----------
describe("밤 선택 표시 setPickMark (결정 0065)", () => {
  const shells = (c: WorldCharacter): Mesh[] => meshes(c.root).filter((m) => m.userData.isOutline === true);
  const ringOf = (c: WorldCharacter): Mesh | undefined => c.root.getObjectByName("ring") as Mesh | undefined;
  const run = (c: WorldCharacter, seconds: number, t0 = 0): number => {
    const n = Math.round(seconds / 0.016);
    for (let i = 0; i < n; i++) c.update(0.016, t0 + i * 0.016, false);
    return t0 + n * 0.016;
  };

  it("켜면 관절 메시 여섯 개마다 붉은 뒷면 껍질(배율 1.14)이 붙고, 끄면 모두 떼고 재질·껍질을 해제한다", () => {
    const matSpy = vi.spyOn(MeshBasicMaterial.prototype, "dispose");
    try {
      const c = createCharacter(0, "coat");
      expect(shells(c)).toHaveLength(0);
      c.setPickMark(true, { color: "#e0344b", animate: true });
      const list = shells(c);
      expect(list).toHaveLength(6);
      for (const h of list) {
        expect(h.scale.x).toBeCloseTo(1.14, 9);
        const m = h.material as MeshBasicMaterial;
        expect(m).toBeInstanceOf(MeshBasicMaterial);
        expect(m.side).toBe(1); // BackSide
        expect(m.color.getHexString()).toBe("e0344b");
      }
      c.setPickMark(true, { color: "#e0344b", animate: true }); // 다시 켜도 늘지 않는다
      expect(shells(c)).toHaveLength(6);
      matSpy.mockClear();
      c.setPickMark(false);
      expect(shells(c)).toHaveLength(0);
      expect(matSpy).toHaveBeenCalledTimes(1);
      c.setPickMark(false); // 이미 없으면 아무 일도 없다
      expect(matSpy).toHaveBeenCalledTimes(1);
    } finally {
      matSpy.mockRestore();
    }
  });

  it("껍질은 의상·표정이 바뀌어도 그 관절의 새 지오메트리를 따라간다", () => {
    const c = createCharacter(0, "coat");
    c.setPickMark(true, { color: "#e0344b", animate: true });
    c.applyOutfit("police");
    const bodyGeo = (c.root.getObjectByName("body") as Group).children.find((x) => (x as Mesh).isMesh && !x.userData.isOutline) as Mesh;
    const shell = bodyGeo.children.find((x) => x.userData.isOutline) as Mesh;
    expect(shell.geometry).toBe(bodyGeo.geometry);
  });

  it("고리는 2.4 배에서 420ms 에 걸쳐 1 배로 조여지고, 그 뒤 1 근처에서 가볍게 맥박친다", () => {
    const c = createCharacter(0, "coat");
    c.setRing("#c8102e");
    c.setPickMark(true, { color: "#e0344b", animate: true });
    c.update(0.001, 0, false);
    expect(ringOf(c)!.scale.x).toBeGreaterThan(2.3);
    let t = run(c, 0.2);
    const mid = ringOf(c)!.scale.x;
    expect(mid).toBeLessThan(2.4);
    expect(mid).toBeGreaterThan(1.0);
    t = run(c, 0.3, t);
    // 420ms 가 지난 뒤: 1 ± 0.07 안
    const after: number[] = [];
    for (let i = 0; i < 60; i++) {
      c.update(0.016, t + i * 0.016, false);
      after.push(ringOf(c)!.scale.x);
    }
    expect(Math.min(...after)).toBeGreaterThanOrEqual(0.92);
    expect(Math.max(...after)).toBeLessThanOrEqual(1.08);
    expect(Math.max(...after) - Math.min(...after)).toBeGreaterThan(0.01); // 맥박이 있다
  });

  it("animate 가 거짓이면(움직임 줄이기) 윤곽만 붙고 고리는 늘 1 배다", () => {
    const c = createCharacter(0, "coat");
    c.setRing("#c8102e");
    c.setPickMark(true, { color: "#e0344b", animate: false });
    expect(shells(c)).toHaveLength(6);
    for (let i = 0; i < 40; i++) {
      c.update(0.016, i * 0.016, false);
      expect(ringOf(c)!.scale.x).toBe(1);
    }
  });

  it("끄면 고리 배율이 1 로 돌아온다. 고리가 나중에 붙어도 조임이 적용된다", () => {
    const c = createCharacter(0, "coat");
    c.setPickMark(true, { color: "#e0344b", animate: true });
    c.setRing("#c8102e"); // 고리가 뒤에 생겼다
    c.update(0.001, 0, false);
    expect(ringOf(c)!.scale.x).toBeGreaterThan(2.3);
    c.setPickMark(false);
    c.update(0.016, 1, false);
    expect(ringOf(c)!.scale.x).toBe(1);
  });

  it("dispose 는 껍질 재질도 해제한다", () => {
    const matSpy = vi.spyOn(MeshBasicMaterial.prototype, "dispose");
    try {
      const c = createCharacter(0, "coat");
      c.setPickMark(true, { color: "#e0344b", animate: true });
      matSpy.mockClear();
      c.dispose();
      expect(matSpy).toHaveBeenCalled();
      expect(shells(c)).toHaveLength(0);
    } finally {
      matSpy.mockRestore();
    }
  });
});

describe("stopEmote (10-03, D-13)", () => {
  const settle = (c: WorldCharacter, ms: number, from = 1): void => {
    for (let t = 0; t < ms; t += 16) c.update(0.016, from + t / 1000, false);
  };

  it("동작 중 호출하면 POSE_BLEND_MS 안에 동작 자세 기여가 0 이 되어 서 있는 자세로 돌아온다", () => {
    const c = createCharacter(0, "coat");
    const ref = createCharacter(0, "coat");
    c.playEmote("dance");
    for (let i = 0; i < 10; i++) {
      c.update(0.016, i * 0.016, false);
      ref.update(0.016, i * 0.016, false);
    }
    expect(readPose(c).aAz).not.toBeCloseTo(readPose(ref).aAz, 2);
    c.stopEmote();
    // 호출 직후 한 프레임: 아직 완전히 돌아오지 않았다(한 번에 튀지 않는다)
    c.update(0.016, 0.2, false);
    ref.update(0.016, 0.2, false);
    expect(readPose(c).aAz).not.toBe(readPose(ref).aAz);
    for (let i = 1; i <= Math.ceil(POSE_BLEND_MS / 16); i++) {
      c.update(0.016, 0.2 + i * 0.016, false);
      ref.update(0.016, 0.2 + i * 0.016, false);
    }
    expect(readPose(c)).toEqual(readPose(ref));
  });

  it("방향(yaw)을 바꾸지 않는다", () => {
    const c = createCharacter(2, "coat");
    c.setYaw(1.234);
    c.playEmote("dance");
    c.update(0.016, 0, false);
    const before = c.root.rotation.y;
    c.stopEmote();
    settle(c, 300);
    expect(c.root.rotation.y).toBe(before);
    expect(before).toBe(1.234);
  });

  it("동작이 없으면 아무 일도 없다", () => {
    const c = createCharacter(0, "coat");
    const ref = createCharacter(0, "coat");
    c.update(0.016, 0, false);
    ref.update(0.016, 0, false);
    c.stopEmote();
    c.update(0.016, 0.1, false);
    ref.update(0.016, 0.1, false);
    expect(readPose(c)).toEqual(readPose(ref));
  });

  it("유지 자세(지목)가 있으면 서 있는 자세가 아니라 유지 자세로 돌아온다", () => {
    const c = createCharacter(0, "coat");
    const ref = createCharacter(0, "coat");
    c.holdPose("point");
    ref.holdPose("point");
    settle(c, 200, 0);
    settle(ref, 200, 0);
    c.playEmote("clap");
    c.update(0.016, 1, false);
    ref.update(0.016, 1, false);
    c.stopEmote();
    settle(c, 200, 1.1);
    settle(ref, 200, 1.1);
    expect(readPose(c)).toEqual(readPose(ref));
  });

  it("끝난 뒤 새 동작을 다시 재생할 수 있고, 멈추는 중 새 동작은 처음부터 시작한다", () => {
    const c = createCharacter(0, "coat");
    c.playEmote("clap");
    c.update(0.016, 0, false);
    c.stopEmote();
    c.update(0.016, 0.1, false);
    c.playEmote("clap");
    c.update(0.016, 0.2, false);
    expect(readPose(c).aAx).toBeLessThan(-1.19);
    settle(c, 70, 0.3);
    expect(readPose(c).aAx).toBeLessThan(-1.19); // 이전 stop 의 타이머가 새 동작을 지우지 않는다
  });

  it("아홉 동작을 재생하는 동안 메시 수와 병합 지오메트리는 늘지 않는다(D-17, 효과 없음)", () => {
    const c = createCharacter(0, "coat");
    c.update(0.016, 0, false);
    const meshesBefore = c.meshCount();
    for (const id of Object.keys(EMOTES) as EmoteId[]) {
      c.playEmote(id);
      for (let i = 0; i < 140; i++) c.update(0.016, i * 0.016, false);
      expect(c.meshCount()).toBe(meshesBefore);
      c.stopEmote();
    }
    const count = meshes(c.root).length;
    expect(count).toBe(meshesBefore);
  });
});

describe("모션 줄이기 변형 (10-03, O-5)", () => {
  const ids = Object.keys(EMOTES) as EmoteId[];
  /** 한 동작을 프레임마다 읽은 자세 열 */
  function run(id: EmoteId, opts: { reduced?: boolean } | undefined, seconds: number): Record<string, number>[] {
    const c = createCharacter(0, "coat");
    if (opts === undefined) c.playEmote(id);
    else c.playEmote(id, opts);
    const out: Record<string, number>[] = [];
    for (let i = 0; i * 0.016 < seconds; i++) {
      c.update(0.016, i * 0.016, false);
      out.push(readPose(c));
    }
    return out;
  }

  it("reduced 가 아니면 옵션이 없을 때와 비트 단위로 같은 자세 열이다(회귀 없음)", () => {
    for (const id of ids) {
      const plain = run(id, undefined, 2.5);
      expect(run(id, { reduced: false }, 2.5)).toEqual(plain);
      expect(run(id, {}, 2.5)).toEqual(plain);
    }
  });

  it("반복이 2 이하이고 y 진폭을 쓰지 않는 동작은 reduced 여도 같다", () => {
    for (const id of ids.filter((x) => EMOTES[x].cycles <= 2 && x !== "surprise" && x !== "dance")) {
      expect(run(id, { reduced: true }, 2.5)).toEqual(run(id, undefined, 2.5));
    }
  });

  it("반복이 3 이상인 동작은 reduced 에서 2 번만 돌고 emoteDurationMs(id, true) 가 끝나는 때와 맞는다", () => {
    for (const id of ids.filter((x) => EMOTES[x].cycles > 2)) {
      const ms = emoteDurationMs(id, true);
      const frames = run(id, { reduced: true }, 4);
      const full = run(id, undefined, 4);
      // 끝난 뒤(길이 + 두 프레임)에는 서 있는 자세, 그때 보통 재생은 아직 도는 중이다
      const endIdx = Math.ceil(ms / 16) + 2;
      expect(frames[endIdx]!.aAz).toBeCloseTo(0.12, 6);
      expect(frames[endIdx]!.aAx).toBe(0);
      expect(Math.abs(full[endIdx]!.aAx) + Math.abs(full[endIdx]!.aAz - 0.12)).toBeGreaterThan(0.05);
      // 끝나기 전 프레임은 동작 중
      const midIdx = Math.floor(ms / 16) - 3;
      expect(Math.abs(frames[midIdx]!.aAx) + Math.abs(frames[midIdx]!.aAz - 0.12) + Math.abs(frames[midIdx]!.hz)).toBeGreaterThan(0.02);
    }
  });

  it("surprise 뛰어오름과 dance 몸 위아래(y) 진폭이 절반이다", () => {
    for (const id of ["surprise", "dance"] as const) {
      const full = run(id, undefined, 1.2).map((p) => p.y);
      const half = run(id, { reduced: true }, 1.2).map((p) => p.y);
      const peakFull = Math.max(...full);
      const peakHalf = Math.max(...half);
      expect(peakFull).toBeGreaterThan(0.06);
      expect(Math.abs(peakHalf - peakFull / 2)).toBeLessThan(0.01);
    }
  });

  it("다른 키(팔·머리)는 y 절반의 영향을 받지 않는다", () => {
    const full = run("surprise", undefined, 1);
    const half = run("surprise", { reduced: true }, 1);
    expect(half.map((p) => p.aAz)).toEqual(full.map((p) => p.aAz));
  });
});

describe("표정 병합 선행 prewarm·ownedGeometryCount (10-03, O-10, D-17)", () => {
  const EMOTE_FACES = ["angry", "sus", "surprise", "happy", "cry"];

  it("prewarm() 은 동작이 쓰는 표정 다섯 개의 머리 병합을 미리 만들고 보이는 표정은 바꾸지 않는다", () => {
    const c = createCharacter(0, "coat");
    const shown = headMesh(c).geometry;
    const before = c.ownedGeometryCount();
    c.prewarm();
    expect(c.ownedGeometryCount()).toBe(before + EMOTE_FACES.length);
    expect(headMesh(c).geometry === shown).toBe(true);
  });

  it("두 번 불러도 병합은 한 번뿐이다", () => {
    const c = createCharacter(1, "coat");
    c.prewarm();
    const n = c.ownedGeometryCount();
    c.prewarm();
    c.prewarm("happy");
    expect(c.ownedGeometryCount()).toBe(n);
  });

  it("표정 하나만 지정해 미리 만들 수 있고, 동작이 쓰지 않는 이름은 무시한다", () => {
    const c = createCharacter(1, "coat");
    const before = c.ownedGeometryCount();
    c.prewarm("angry");
    expect(c.ownedGeometryCount()).toBe(before + 1);
    c.prewarm("nonsense");
    c.prewarm("dead");
    expect(c.ownedGeometryCount()).toBe(before + 1);
  });

  it("prewarm 뒤 아홉 동작을 끝까지 재생해도 새 병합이 생기지 않고 14 이하다", () => {
    const c = createCharacter(2, "coat");
    c.prewarm();
    const n = c.ownedGeometryCount();
    expect(n).toBeLessThanOrEqual(14);
    for (const id of Object.keys(EMOTES) as EmoteId[]) {
      c.playEmote(id);
      for (let i = 0; i < 150; i++) c.update(0.016, i * 0.016, false);
      expect(c.ownedGeometryCount()).toBe(n);
    }
  });

  it("동작을 재생하는 동안 메시·조명 수는 변하지 않는다(효과 없음)", () => {
    const c = createCharacter(3, "coat");
    c.prewarm();
    const lights = (): number => {
      let n = 0;
      c.root.traverse((o) => {
        if ((o as { isLight?: boolean }).isLight) n++;
      });
      return n;
    };
    const m0 = c.meshCount();
    expect(lights()).toBe(0);
    for (const id of Object.keys(EMOTES) as EmoteId[]) {
      c.playEmote(id, { reduced: false });
      for (let i = 0; i < 60; i++) c.update(0.016, i * 0.016, false);
      expect(c.meshCount()).toBe(m0);
      expect(lights()).toBe(0);
    }
  });

  it("dispose 뒤 ownedGeometryCount 는 0 이고 prewarm 은 아무것도 만들지 않는다", () => {
    const c = createCharacter(0, "coat");
    c.prewarm();
    c.dispose();
    expect(c.ownedGeometryCount()).toBe(0);
    c.prewarm();
    expect(c.ownedGeometryCount()).toBe(0);
  });
});
