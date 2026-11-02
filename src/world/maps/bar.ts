// 지하 재즈 바 장면(maps/bar.ts). design/v2.0/screens/bar.js 의 좌표·치수·색을 그대로 옮기되, 시안의 구조는 옮기지 않는다:
//   시안: 박스마다 새 재질 · 매 프레임 2048 그림자 · 점광원 12개  →  여기: 재질별·버텍스 컬러 병합 · 그림자 한 번 · 점광원 3개.
// three 를 값으로 쓰므로 정적 import 경로에 두지 않는다(06-13 이 threeRenderer 와 함께 import() 로만 연다). WebGL 없이 node 에서 만들어지고 검사된다.
//
// 그리기 단위(보이는 메시, 모두 병합):  1 shell(바닥·벽·창틀, 그림자 받기만)  2 furniture(카운터·스툴·피아노 몸·무대·탁자·의자)
//   2b furnitureFar(피아노 뚜껑·술병 선반 널)  3 brass(놋쇠 테두리·서는 자리 8·마이크 대)  4 emissiveRoom(창유리·촛불·벽등)
//   4b emissiveRoomFar(술병·펜던트 전구·선반 등)  5 emissiveVote(무대 가장자리 전구 20)  6 glowRoom·glowVote(빛 무리 쿼드)
//   7 plate(연장 판)  8 pendants(펜던트 갓·줄).  강등 사다리 4단계(props reduced)는 2b·4b·8 을 끈다.
// emissive 는 조명을 받지 않는 MeshBasicMaterial + 버텍스 컬러(색 × 밝기를 정점에 굽는다)로 만든다 — MeshStandardMaterial 의 emissive 는
// 정점 색을 곱하지 않아 병합하면 색을 하나밖에 못 쓰기 때문이다. 단계별 밝기는 재질 color 배율로 바꾼다.
import {
  AdditiveBlending,
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  DataTexture,
  DirectionalLight,
  DoubleSide,
  Euler,
  Fog,
  Group,
  HemisphereLight,
  LinearFilter,
  Material,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
  PointLight,
  Quaternion,
  RGBAFormat,
  Scene,
  SphereGeometry,
  TorusGeometry,
  Vector3,
} from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { cameraBasis, PLATE_FAR } from "../camera";
import { PALETTE, TOKEN_COLORS } from "../palette";
import type { Budget, LightingPhase } from "../renderer";

// ---------- 조명 시작값 (가정 A1) ----------
// 반구·방향광 = 시안 세기 × π(r155 조명 단위 변경), 점광원 = 시안 세기 × 4 로 시작한다. 승인 보드와 나란히 놓고 맞추는 일은 06-14 가 한다.
export interface PhaseTune {
  /** 반구광 세기 */
  hemi: number;
  /** 달빛 방향광 세기 */
  moon: number;
  /** 톤매핑 노출 */
  exposure: number;
  /** [반구 하늘색, 반구 땅색, 배경·안개색] */
  sky: [string, string, string];
  fog: { near: number; far: number };
  /** 무대 위 점광원 세기(talk 는 0) */
  stage: number;
  /** 펜던트 점광원 세기(둘 다 같다) */
  pendant: number;
  /** emissive 재질 배율(그룹 room: 실내등, vote: 무대 가장자리 전구) */
  emissive: { room: number; vote: number };
  /** 빛 무리 쿼드 불투명도 배율 */
  glow: { room: number; vote: number };
}

const PENDANT_TALK = 0.9 * 4;
function talkRow(): PhaseTune {
  return { hemi: 1.1 * Math.PI, moon: 0.85 * Math.PI, exposure: 1.25, sky: ["#524b84", "#2a2034", "#15111f"], fog: { near: 20, far: 44 }, stage: 0, pendant: PENDANT_TALK, emissive: { room: 1, vote: 0.2 }, glow: { room: 1, vote: 0 } };
}
export const LIGHT_TUNE: Readonly<Record<LightingPhase, PhaseTune>> & {
  point: { stage: { x: number; y: number; z: number; distance: number }; pendantA: { x: number; y: number; z: number; distance: number }; pendantB: { x: number; y: number; z: number; distance: number }; decay: number };
  tension: { lead: number; halfRoom: number };
  moonPos: { x: number; y: number; z: number };
  moonTarget: { x: number; y: number; z: number };
} = {
  talk: {
    hemi: 1.1 * Math.PI,
    moon: 0.85 * Math.PI,
    exposure: 1.25,
    sky: ["#524b84", "#2a2034", "#15111f"],
    fog: { near: 20, far: 44 },
    stage: 0,
    pendant: PENDANT_TALK,
    // 시안은 vote 그룹이 talk 에서 0 이지만, 무대 가장자리 전구가 꺼진 구슬로 보이게 0.2 로 둔다(map-bar.png 에 점선 구슬이 보인다)
    emissive: { room: 1, vote: 0.2 },
    glow: { room: 1, vote: 0 },
  },
  vote: {
    hemi: 0.7 * Math.PI,
    moon: 0.55 * Math.PI,
    exposure: 1.25,
    sky: ["#3a3464", "#1c1428", "#100d19"],
    fog: { near: 20, far: 44 },
    stage: 2.0 * 4,
    pendant: PENDANT_TALK * 0.45,
    emissive: { room: 0.45, vote: 1 },
    glow: { room: 0.45, vote: 1 },
  },
  trial: { ...talkRow() },
  night: { ...talkRow() },
  morning: { ...talkRow() },
  tension: { lead: 0, halfRoom: 1 },
  point: {
    stage: { x: 0, y: 3.0, z: 0, distance: 6 },
    pendantA: { x: -2.4, y: 2.6, z: -4.6, distance: 5 },
    pendantB: { x: 4.4, y: 2.6, z: -3.2, distance: 5 },
    decay: 2,
  },
  // 시안 blockout.js: moon.position = (t0.x − 5, 12, t0.z + 7), target = t0 = (−0.4, −0.4)
  moonPos: { x: -5.4, y: 12, z: 6.6 },
  moonTarget: { x: -0.4, y: 0, z: -0.4 },
};

// ---------- 병합 도구 ----------
type M4 = Matrix4;
const IDENTITY = new Matrix4();
/** 위치 + XYZ 오일러 회전(Object3D 기본 순서) */
function tf(x: number, y: number, z: number, rx = 0, ry = 0, rz = 0): M4 {
  return new Matrix4().compose(new Vector3(x, y, z), new Quaternion().setFromEuler(new Euler(rx, ry, rz, "XYZ")), new Vector3(1, 1, 1));
}
/** 부모 변환 × 자식 변환 */
const under = (parent: M4, child: M4): M4 => parent.clone().multiply(child);

/** 같은 재질로 그릴 지오메트리 묶음: 정점마다 색(3 또는 4 성분)을 굽고 한 장으로 병합한다 */
class Bundle {
  private readonly parts: BufferGeometry[] = [];
  constructor(private readonly alpha = false) {}
  add(geo: BufferGeometry, hex: string, m: M4, k = 1, a = 1): void {
    geo.applyMatrix4(m);
    const c = new Color(hex).multiplyScalar(k);
    const n = geo.getAttribute("position").count;
    const size = this.alpha ? 4 : 3;
    const arr = new Float32Array(n * size);
    for (let i = 0; i < n; i++) {
      arr[i * size] = c.r;
      arr[i * size + 1] = c.g;
      arr[i * size + 2] = c.b;
      if (this.alpha) arr[i * size + 3] = a;
    }
    geo.setAttribute("color", new BufferAttribute(arr, size));
    this.parts.push(geo);
  }
  box(w: number, h: number, d: number, hex: string, m: M4, k = 1): void {
    this.add(new BoxGeometry(w, h, d), hex, m, k);
  }
  cyl(rt: number, rb: number, h: number, seg: number, hex: string, m: M4, k = 1): void {
    this.add(new CylinderGeometry(rt, rb, h, seg), hex, m, k);
  }
  sph(r: number, hex: string, m: M4, k = 1): void {
    this.add(new SphereGeometry(r, 10, 8), hex, m, k);
  }
  get size(): number {
    return this.parts.length;
  }
  build(material: Material, name: string): Mesh {
    const geo = mergeGeometries(this.parts, false);
    for (const p of this.parts) p.dispose();
    this.parts.length = 0;
    if (!geo) throw new Error(`병합 실패: ${name}`);
    const mesh = new Mesh(geo, material);
    mesh.name = name;
    return mesh;
  }
}

/** 코드로 만든 방사 그라데이션(Uint8Array DataTexture): 시안 getGlowTex 와 같은 정지점 0→1, 0.35→0.35, 1→0. 캔버스·이미지 로드 없음 */
function makeGlowTexture(): DataTexture {
  const N = 64;
  const data = new Uint8Array(N * N * 4);
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      const d = Math.hypot(x + 0.5 - N / 2, y + 0.5 - N / 2) / (N / 2);
      const a = d >= 1 ? 0 : d <= 0.35 ? 1 - 0.65 * (d / 0.35) : 0.35 * (1 - (d - 0.35) / 0.65);
      const i = (y * N + x) * 4;
      data[i] = 255;
      data[i + 1] = 255;
      data[i + 2] = 255;
      data[i + 3] = Math.round(a * 255);
    }
  }
  const t = new DataTexture(data, N, N, RGBAFormat);
  t.magFilter = LinearFilter;
  t.minFilter = LinearFilter;
  t.generateMipmaps = false;
  t.needsUpdate = true;
  return t;
}

export interface MarkerRing {
  group: Group;
  /** 안쪽 밝은 원(반지름 0.45·굵기 0.04·gray-50) */
  ring: Mesh;
  /** 바깥 윤곽 원(반지름 0.5·굵기 0.05·night-950, 불투명도 0.6) */
  outline: Mesh;
}

export interface BarScene {
  /** 맵 전체(조명·배경·안개 포함). 캐릭터 그룹은 렌더러가 여기에 붙인다 */
  root: Scene;
  lights: { hemi: HemisphereLight; moon: DirectionalLight; stage: PointLight; pendantA: PointLight; pendantB: PointLight };
  /** 병합된 그리기 단위(이름은 파일 머리 주석의 번호) */
  meshes: Record<string, Mesh>;
  /** 목적지 링(ring)과 첫 방문 손짓 링(cue) — 같은 모양의 두 겹 */
  markers: { ring: MarkerRing; cue: MarkerRing };
  /** 바닥 아래 연장 판 */
  plate: Mesh;
  /** 마지막으로 적용한 조명 단계의 톤매핑 노출 */
  readonly exposure: number;
  setLighting(phase: LightingPhase): void;
  /** 긴장 단계(RED 뼈대) */
  setTension(level: 0 | 1 | 2, focus?: { x: number; z: number }): void;
  /** 예산 단계를 재생성 없이 반영한다(되돌릴 수 있다): 그림자 맵 크기·점광원 core·소품 reduced·안개·빛 무리 */
  applyBudget(budget: Budget): void;
  readonly budget: Budget;
  dispose(): void;
}

/** 방 안 좌표 그대로(bar.js). 서는 자리: 반지름 2.4 원 위 8곳, 첫 자리는 카메라 쪽(+x+z) */
const SEAT_RADIUS = 2.4;
const TABLES: readonly (readonly [number, number])[] = [
  [4.6, 1.2],
  [1.2, 4.6],
  [4.4, -3.2],
  [-3.2, 4.4],
  [-2.4, -4.6],
];
const SHELF_YS = [0.9, 1.6, 2.3] as const;

export function buildBarScene(budget: Budget): BarScene {
  const root = new Scene();
  const P = PALETTE;

  // ----- 재질 -----
  const matProp = new MeshStandardMaterial({ vertexColors: true, roughness: 0.85, metalness: 0 });
  const matBrass = new MeshStandardMaterial({ vertexColors: true, roughness: 0.4, metalness: 0.5 });
  const matPendant = new MeshStandardMaterial({ vertexColors: true, roughness: 0.85, metalness: 0, side: DoubleSide });
  const matEmRoom = new MeshBasicMaterial({ vertexColors: true });
  const matEmVote = new MeshBasicMaterial({ vertexColors: true });
  const glowMap = makeGlowTexture();
  const glowMat = (): MeshBasicMaterial =>
    new MeshBasicMaterial({ vertexColors: true, map: glowMap, transparent: true, blending: AdditiveBlending, depthWrite: false, fog: false });
  const matGlowRoom = glowMat();
  const matGlowVote = glowMat();
  const matPlate = new MeshStandardMaterial({ color: P.plate, roughness: 0.85, metalness: 0 });

  // ----- 묶음 -----
  const shell = new Bundle();
  const furniture = new Bundle();
  const furnitureFar = new Bundle();
  const brass = new Bundle();
  const emRoom = new Bundle();
  const emRoomFar = new Bundle();
  const emVote = new Bundle();
  const glowRoom = new Bundle(true);
  const glowVote = new Bundle(true);
  const pendants = new Bundle();

  // 빛 무리: 카메라 yaw 가 고정이라 카메라를 향해 미리 돌린 쿼드를 합친다(Sprite 대신). 색 = hex, 알파 = k
  const basis = cameraBasis();
  const facing = new Matrix4().makeBasis(new Vector3(basis.right.x, basis.right.y, basis.right.z), new Vector3(basis.up.x, basis.up.y, basis.up.z), new Vector3(basis.back.x, basis.back.y, basis.back.z));
  const glow = (b: Bundle, hex: string, size: number, x: number, y: number, z: number, k: number): void => {
    const m = facing.clone().setPosition(x, y, z);
    b.add(new PlaneGeometry(size, size), hex, m, 1, k);
  };

  // 바닥: 널 28장(0.5 × 14), 두 색 번갈아
  for (let i = 0; i < 28; i++) shell.box(0.5, 0.1, 14, i % 2 ? P.floorA : P.floorB, tf(-6.75 + i * 0.5, -0.05, 0));
  // 벽(뒤 두 면) + 허리판
  shell.box(0.3, 3.6, 14.3, P.wall, tf(-7.15, 1.8, 0));
  shell.box(14.3, 3.6, 0.3, P.wall, tf(0, 1.8, -7.15));
  shell.box(0.06, 1.0, 14, P.wainscot, tf(-6.98, 0.5, 0));
  shell.box(14, 1.0, 0.06, P.wainscot, tf(0, 0.5, -6.98));

  // 블라인드 창(뒷벽)
  const win = tf(2.2, 1.9, -6.97);
  emRoom.add(new PlaneGeometry(2.4, 1.5), P.windowGlass, win, 0.5);
  for (let s = 0; s < 9; s++) shell.box(2.4, 0.06, 0.04, P.blind, under(win, tf(0, -0.68 + s * 0.17, 0.03)));
  shell.box(2.6, 0.1, 0.12, P.sill, under(win, tf(0, -0.8, 0.04)));

  // 바 카운터와 술병 선반(왼쪽 벽)
  furniture.box(1.0, 1.05, 6.2, P.counter, tf(-5.7, 0.525, -2.2));
  furniture.box(1.2, 0.08, 6.4, P.counterTop, tf(-5.7, 1.09, -2.2));
  for (const y of SHELF_YS) furnitureFar.box(0.35, 0.05, 6.0, P.shelf, tf(-6.8, y, -2.2));
  for (let b = 0; b < 33; b++) {
    const bz = -5.0 + (b % 11) * 0.55;
    const by = SHELF_YS[Math.floor(b / 11)]!;
    emRoomFar.cyl(0.06, 0.07, 0.3, 8, P.bottles[b % 4]!, tf(-6.8, by + 0.18, bz), 0.35);
  }
  // 선반 아래 따뜻한 띠: 시안의 카운터 위 점광원(0.8)을 점광원 예산 밖으로 빼면서 emissive 로 옮겼다
  emRoomFar.box(0.04, 0.03, 5.6, P.lamp, tf(-6.65, 2.25, -2.2), 1.0);
  glow(glowRoom, P.lamp, 2.4, -5.6, 2.4, -2.2, 0.3);
  for (let st = 0; st < 4; st++) {
    furniture.cyl(0.24, 0.24, 0.07, 14, P.stoolSeat, tf(-4.8, 0.72, -4.4 + st * 1.4));
    furniture.cyl(0.04, 0.06, 0.7, 8, P.darkMetal, tf(-4.8, 0.35, -4.4 + st * 1.4));
  }

  // 피아노(뒤 구석)
  const pi = tf(-4.6, 0, -5.0, 0, 0.6, 0);
  furniture.box(1.6, 0.35, 1.2, P.darkMetal, under(pi, tf(0, 0.8, 0)));
  furnitureFar.box(1.6, 0.04, 1.2, P.darkMetal, under(pi, tf(0, 1.2, -0.3, -0.55, 0, 0)));
  furniture.box(1.5, 0.06, 0.25, P.pianoKeys, under(pi, tf(0, 0.83, 0.62)));
  for (const [lx, lz] of [
    [-0.7, -0.5],
    [0.7, -0.5],
    [0, 0.5],
  ] as const)
    furniture.cyl(0.05, 0.05, 0.62, 8, P.darkMetal, under(pi, tf(lx, 0.31, lz)));

  // 무대: 지름 2.2, 높이 0.28. 가장자리 전구는 지목·변론 때 켜진다
  furniture.cyl(1.12, 1.18, 0.28, 48, P.stageBody, tf(0, 0.14, 0));
  brass.cyl(1.13, 1.13, 0.03, 48, P.brass, tf(0, 0.29, 0));
  for (let r = 0; r < 20; r++) {
    const ra = (r / 20) * Math.PI * 2;
    emVote.sph(0.04, P.rimBulb, tf(Math.sin(ra) * 1.17, 0.2, Math.cos(ra) * 1.17), 1.4);
  }
  glow(glowVote, P.stageGlow, 3.2, 0, 0.4, 0, 0.35);
  const mic = tf(-0.45, 0.28, -0.45);
  brass.cyl(0.015, 0.015, 1.1, 6, P.micStand, under(mic, tf(0, 0.55, 0)));
  furniture.sph(0.06, P.micHead, under(mic, tf(0, 1.12, 0)));
  furniture.cyl(0.16, 0.16, 0.02, 12, P.micHead, under(mic, tf(0, 0.01, 0)));

  // 서는 자리 8개: 놋쇠 표시만 둔다(표는 화면 겹침 층이 보여 준다)
  for (let i = 0; i < 8; i++) {
    const a = Math.PI / 4 + (i / 8) * Math.PI * 2;
    brass.cyl(0.36, 0.36, 0.02, 24, P.brass, tf(Math.sin(a) * SEAT_RADIUS, 0.011, Math.cos(a) * SEAT_RADIUS));
  }

  // 탁자와 의자(낮 배치만. 밤에 의자를 탁자 위로 올리는 일은 이 페이즈 범위 밖)
  for (const [x, z] of TABLES) {
    furniture.cyl(0.5, 0.5, 0.05, 20, P.tableTop, tf(x, 0.74, z));
    furniture.cyl(0.05, 0.05, 0.72, 8, P.darkMetal, tf(x, 0.36, z));
    furniture.cyl(0.25, 0.25, 0.03, 12, P.darkMetal, tf(x, 0.015, z));
    emRoom.sph(0.04, P.lamp, tf(x, 0.86, z), 1.2);
    glow(glowRoom, P.lamp, 0.5, x, 0.88, z, 0.6);
    for (let j = 0; j < 2; j++) {
      const a = Math.atan2(x, z) + (j ? Math.PI / 2 : -Math.PI / 2);
      const ch = tf(x + Math.sin(a) * 0.8, 0, z + Math.cos(a) * 0.8, 0, a + Math.PI, 0);
      furniture.box(0.62, 0.07, 0.6, P.chairSeat, under(ch, tf(0, 0.42, 0)));
      furniture.box(0.62, 0.55, 0.06, P.chairBack, under(ch, tf(0, 0.72, -0.28)));
      for (const [lx, lz] of [
        [-0.26, -0.24],
        [0.26, -0.24],
        [-0.26, 0.24],
        [0.26, 0.24],
      ] as const)
        furniture.box(0.05, 0.42, 0.05, P.chairBack, under(ch, tf(lx, 0.21, lz)));
    }
  }

  // 펜던트 등: 뒤쪽 탁자에만 단다(앞쪽은 캐릭터를 가린다). 줄·갓은 pendants, 전구는 emissive
  for (const [x, z] of [
    [-2.4, -4.6],
    [4.4, -3.2],
  ] as const) {
    pendants.cyl(0.01, 0.01, 1.0, 4, P.darkMetal, tf(x, 3.4, z));
    pendants.add(new ConeGeometry(0.3, 0.26, 16, 1, true), P.shade, tf(x, 2.8, z));
    emRoomFar.sph(0.07, P.lamp, tf(x, 2.72, z), 1.6);
  }

  // 벽등
  [
    [-6.95, 3.5],
    [-6.95, -0.5],
    [-0.5, -6.95],
    [4.5, -6.95],
  ].forEach(([px, pz], j) => {
    const onX = j < 2;
    const x = onX ? px! + 0.1 : px!;
    const z = onX ? pz! : pz! + 0.1;
    emRoom.sph(0.09, P.lamp, tf(x, 2.2, z), 1.2);
    glow(glowRoom, P.lamp, 1.0, x, 2.2, z, 0.5);
  });

  // ----- 메시 만들기 -----
  const meshes: Record<string, Mesh> = {
    shell: shell.build(matProp, "shell"),
    furniture: furniture.build(matProp, "furniture"),
    furnitureFar: furnitureFar.build(matProp, "furnitureFar"),
    brass: brass.build(matBrass, "brass"),
    emissiveRoom: emRoom.build(matEmRoom, "emissiveRoom"),
    emissiveRoomFar: emRoomFar.build(matEmRoom, "emissiveRoomFar"),
    emissiveVote: emVote.build(matEmVote, "emissiveVote"),
    glowRoom: glowRoom.build(matGlowRoom, "glowRoom"),
    glowVote: glowVote.build(matGlowVote, "glowVote"),
    pendants: pendants.build(matPendant, "pendants"),
  };
  meshes.shell!.receiveShadow = true;
  for (const n of ["furniture", "furnitureFar"] as const) {
    meshes[n]!.castShadow = true;
    meshes[n]!.receiveShadow = true;
  }
  meshes.brass!.castShadow = true;
  meshes.brass!.receiveShadow = true;
  meshes.pendants!.castShadow = false;
  // 빛 무리는 투명 합성이라 불투명 메시 뒤에 그린다
  meshes.glowRoom!.renderOrder = 2;
  meshes.glowVote!.renderOrder = 2;
  for (const m of Object.values(meshes)) root.add(m);

  // 연장 판: 바닥 색과 같은 어두운 정사각형 한 장(걸을 수 없는 영역). 안개가 먼 가장자리를 어둠에 녹인다
  const plate = new Mesh(new PlaneGeometry(PLATE_FAR * 2, PLATE_FAR * 2), matPlate);
  plate.name = "plate";
  plate.rotation.x = -Math.PI / 2;
  plate.position.y = -0.01;
  plate.receiveShadow = false;
  meshes.plate = plate;
  root.add(plate);

  // 링·손짓 링: 바닥에 눕힌 두 겹 MeshBasicMaterial. 윤곽을 살짝 낮춰 안쪽 밝은 원이 위에 보이게 한다
  const makeMarker = (): MarkerRing => {
    const group = new Group();
    group.position.y = 0.02;
    group.visible = false;
    const ring = new Mesh(new TorusGeometry(0.45, 0.04, 8, 40), new MeshBasicMaterial({ color: TOKEN_COLORS.ring, transparent: true, depthWrite: false }));
    const outline = new Mesh(new TorusGeometry(0.5, 0.05, 8, 40), new MeshBasicMaterial({ color: TOKEN_COLORS.ringOutline, transparent: true, opacity: 0.6, depthWrite: false }));
    ring.rotation.x = -Math.PI / 2;
    outline.rotation.x = -Math.PI / 2;
    ring.position.y = 0.012;
    outline.position.y = -0.008;
    ring.renderOrder = 4;
    outline.renderOrder = 3;
    group.add(outline, ring);
    root.add(group);
    return { group, ring, outline };
  };
  const markers = { ring: makeMarker(), cue: makeMarker() };

  // ----- 조명 -----
  const T = LIGHT_TUNE;
  const hemi = new HemisphereLight(T.talk.sky[0], T.talk.sky[1], T.talk.hemi);
  const moon = new DirectionalLight(TOKEN_COLORS.moon, T.talk.moon);
  moon.position.set(T.moonPos.x, T.moonPos.y, T.moonPos.z);
  moon.target.position.set(T.moonTarget.x, T.moonTarget.y, T.moonTarget.z);
  moon.castShadow = budget.shadowMap !== 0;
  const shadowSize = budget.shadowMap === 0 ? 1024 : budget.shadowMap;
  moon.shadow.mapSize.set(shadowSize, shadowSize);
  moon.shadow.bias = -0.0015;
  const sc = moon.shadow.camera;
  sc.left = -12;
  sc.right = 12;
  sc.top = 12;
  sc.bottom = -12;
  sc.near = 1;
  sc.far = 60;
  const point = (c: { x: number; y: number; z: number; distance: number }): PointLight => {
    const l = new PointLight(TOKEN_COLORS.lamp, 0, c.distance, T.point.decay);
    l.position.set(c.x, c.y, c.z);
    return l;
  };
  const stage = point(T.point.stage);
  stage.color.set(P.stageGlow);
  const pendantA = point(T.point.pendantA);
  const pendantB = point(T.point.pendantB);
  root.add(hemi, moon, moon.target, stage, pendantA, pendantB);

  const background = new Color(T.talk.sky[2]);
  const fog = new Fog(T.talk.sky[2], T.talk.fog.near, T.talk.fog.far);
  root.background = background;
  root.fog = fog;

  let exposure = T.talk.exposure;
  let disposed = false;
  let current = budget;
  let phase: LightingPhase = "talk";

  const setLighting = (next: LightingPhase): void => {
    phase = next;
    const t = T[phase];
    const b = current;
    hemi.color.set(t.sky[0]);
    hemi.groundColor.set(t.sky[1]);
    hemi.intensity = t.hemi;
    background.set(t.sky[2]);
    fog.color.set(t.sky[2]);
    fog.near = t.fog.near;
    fog.far = t.fog.far;
    moon.intensity = t.moon;
    stage.intensity = t.stage;
    // 점광원 core: 펜던트 둘은 세기 0 + 장면 광원 목록에서 뺀다(셰이더 광원 수가 줄어든다). 벽·촛불 빛은 emissive 와 빛 무리가 이미 낸다
    const pendant = b.lights === "full" ? t.pendant : 0;
    pendantA.intensity = pendant;
    pendantB.intensity = pendant;
    pendantA.visible = b.lights === "full";
    pendantB.visible = b.lights === "full";
    matEmRoom.color.setScalar(t.emissive.room);
    matEmVote.color.setScalar(t.emissive.vote);
    matGlowRoom.opacity = t.glow.room;
    matGlowVote.opacity = t.glow.vote;
    meshes.glowRoom!.visible = b.glows && t.glow.room > 0;
    meshes.glowVote!.visible = b.glows && t.glow.vote > 0;
    root.fog = b.fog ? fog : null;
    exposure = t.exposure;
  };

  const applyBudget = (b: Budget): void => {
    const prevSize = moon.shadow.mapSize.x;
    const prevCast = moon.castShadow;
    current = b;
    if (b.shadowMap === 0) {
      moon.castShadow = false;
    } else {
      moon.castShadow = true;
      if (prevSize !== b.shadowMap) moon.shadow.mapSize.set(b.shadowMap, b.shadowMap);
    }
    // 크기가 바뀌면 옛 그림자 맵을 버린다: three 는 map 이 있으면 크기를 다시 맞추지 않는다
    if (moon.shadow.mapSize.x !== prevSize || prevCast !== moon.castShadow) {
      moon.shadow.map?.dispose();
      moon.shadow.map = null;
    }
    // 소품 reduced: 먼 소품(피아노 뚜껑·술병 선반 세부·펜던트)을 뺀다
    const far = b.props === "full";
    meshes.furnitureFar!.visible = far;
    meshes.emissiveRoomFar!.visible = far;
    meshes.pendants!.visible = far;
    setLighting(phase); // 점광원 core·빛 무리·안개를 현재 조명 단계 위에 다시 반영
  };
  applyBudget(budget);

  return {
    root,
    lights: { hemi, moon, stage, pendantA, pendantB },
    meshes,
    markers,
    plate,
    get exposure(): number {
      return exposure;
    },
    setLighting,
    setTension() {},
    applyBudget,
    get budget(): Budget {
      return current;
    },
    dispose(): void {
      if (disposed) return;
      disposed = true;
      const mats = new Set<Material>();
      root.traverse((o) => {
        const m = o as Mesh;
        if (!m.isMesh) return;
        m.geometry.dispose();
        for (const x of Array.isArray(m.material) ? m.material : [m.material]) mats.add(x);
      });
      for (const x of mats) x.dispose();
      glowMap.dispose();
      moon.shadow.map?.dispose();
    },
  };
}
