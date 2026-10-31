// 06-11 3D 캐릭터 — 원본 design/v2.0/blockout/character.js(결정 0048)를 관절 병합으로 옮긴 모듈 (MAP-01, MAP-02).
// WebGL 없이 node 에서 장면 그래프로 검사한다.
import { BufferGeometry, CircleGeometry, Color, type Group, type Material, type Mesh, MeshStandardMaterial, type Object3D } from "three";
import { describe, expect, it, vi } from "vitest";
import { MOVE_SPEED } from "../../shared/game/world";
import { CHAR_SCALE, characterKit, createCharacter, figForSeat, WALK_PHASE_RATE, type WorldCharacter } from "../../src/world/character";
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
    c.update(0.016, 0.032, false);
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
