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
  CatmullRomCurve3,
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
  TubeGeometry,
  Vector3,
} from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { cameraBasis, PLATE_FAR } from "../camera";
import { CHAR_SCALE } from "../character";
import { PALETTE, TOKEN_COLORS } from "../palette";
import type { Budget, LightingPhase } from "../renderer";

// ---------- 조명 시작값 (가정 A1) ----------
// 반구·방향광 = 시안 세기 × π(r155 조명 단위 변경), 점광원 = 시안 세기 × 4 로 시작한다. 승인 보드와 나란히 놓고 맞추는 일은 06-14 가 한다.
export interface PhaseTune {
  /** 반구광 세기 */
  hemi: number;
  /** 달빛 방향광 세기 */
  moon: number;
  /** 방향광 색(단계별, D-03 — 낮은 따뜻한 회색, 밤은 달빛 남색) */
  moonColor?: string;
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
  /** 내 캐릭터 위 작은 점광원 세기(밤·시민 편 nightCitizen 에서만 0 보다 크다) */
  self: number;
}

const PENDANT_TALK = 0.9 * 4;
export const LIGHT_TUNE: Readonly<Record<LightingPhase, PhaseTune>> & {
  point: { stage: { x: number; y: number; z: number; distance: number }; pendantA: { x: number; y: number; z: number; distance: number }; pendantB: { x: number; y: number; z: number; distance: number }; self: { x: number; y: number; z: number; distance: number }; decay: number };
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
    self: 0,
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
    self: 0,
  },
  // 08-10 단계 조명 셋. 정확한 값은 기존 talk·vote 에서 파생한 시작값이고 읽힘의 최종 확인은 실기기 몫이다(가정 A2).
  // 하늘·안개 색은 모두 talk 의 같은 칸보다 밝지 않다 — 낮도 마피아 분위기(새 밝은 색면 없음).
  /** 변론·처형: vote 기반으로 실내 5%, 무대 전구는 그대로, 한 줄기 원뿔 빛(원뿔 메시는 trial 에서만 보인다) */
  trial: {
    hemi: 0.35 * Math.PI,
    moon: 0.2 * Math.PI,
    exposure: 1.25,
    sky: ["#3a3464", "#1c1428", "#100d19"],
    fog: { near: 20, far: 44 },
    stage: 2.0 * 4,
    pendant: PENDANT_TALK * 0.05,
    emissive: { room: 0.05, vote: 1 },
    glow: { room: 0.05, vote: 1 },
    self: 0,
  },
  /** 밤: 달빛이 반구보다 세고 무대 점광원은 꺼진다 */
  night: {
    hemi: 0.45 * Math.PI,
    moon: 0.7 * Math.PI,
    exposure: 1.25,
    sky: ["#2c2c58", "#15122a", "#0a0b16"],
    fog: { near: 20, far: 44 },
    stage: 0,
    pendant: PENDANT_TALK * 0.15,
    emissive: { room: 0.15, vote: 0.1 },
    glow: { room: 0.15, vote: 0 },
    self: 0,
  },
  /**
   * 밤·산 시민 편(NIGHT-07·10, 가정 A1): 블록아웃 값 반구 0.05·달빛 0.08·노출 0.75·내 캐릭터 빛 1.4 를 단위 변환(반구·달빛 × π, 점광원 × 4)한 거의 깜깜한 방.
   * "밤 전용 빛 0.15" 는 night 행의 펜던트·실내 emissive 0.15 배와 같은 뜻이라 여기서는 0(내 캐릭터 외 아무도 안 그린다).
   * 하늘·안개 색은 night 보다 어둡다. 읽힘의 최종 확인은 실기기 몫이다.
   */
  nightCitizen: {
    hemi: 0.05 * Math.PI,
    moon: 0.08 * Math.PI,
    exposure: 0.75,
    sky: ["#1a1a36", "#0c0a1a", "#05060c"],
    fog: { near: 20, far: 44 },
    stage: 0,
    pendant: 0,
    emissive: { room: 0, vote: 0 },
    glow: { room: 0, vote: 0 },
    self: 1.4 * 4,
  },
  /** 밤·유령(가정 A3): 마피아 화면(night)과 같은 달빛·반구, 무대 쪽 기운(vote 그룹 emissive·빛 무리)만 night 의 0.4 배. 모두 보인다 */
  nightGhost: {
    hemi: 0.45 * Math.PI,
    moon: 0.7 * Math.PI,
    exposure: 1.25,
    sky: ["#2c2c58", "#15122a", "#0a0b16"],
    fog: { near: 20, far: 44 },
    stage: 0,
    pendant: PENDANT_TALK * 0.15,
    emissive: { room: 0.15, vote: 0.1 * 0.4 },
    glow: { room: 0.15, vote: 0 }, // night 의 vote 빛 무리는 0 이라 0.4 배도 0
    self: 0,
  },
  /** 아침: talk 보다 약간 낮은 반구, 채도 낮은 하늘 */
  morning: {
    hemi: 0.85 * Math.PI,
    moon: 0.4 * Math.PI,
    exposure: 1.25,
    sky: ["#4d4a6e", "#26202c", "#14111b"],
    fog: { near: 20, far: 44 },
    stage: 0,
    pendant: PENDANT_TALK * 0.6,
    emissive: { room: 0.7, vote: 0.2 },
    glow: { room: 0.6, vote: 0 },
    self: 0,
  },
  /** 긴장 단계(결정 0049): lead = 1·2 단계에서 초점 위로 옮긴 무대 점광원 세기(vote 의 1.5 배), halfRoom = 2 단계에서 실내 emissive 에 곱하는 값 */
  tension: { lead: 2.0 * 4 * 1.5, halfRoom: 0.5 },
  point: {
    stage: { x: 0, y: 3.0, z: 0, distance: 6 },
    pendantA: { x: -2.4, y: 2.6, z: -4.6, distance: 5 },
    pendantB: { x: 4.4, y: 2.6, z: -3.2, distance: 5 },
    /** 내 캐릭터 위(높이 2.0)에서 비추는 작은 빛. 자리는 setSelfLight 가 따라간다 */
    self: { x: 0, y: 2.0, z: 0, distance: 4 },
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
export function tf(x: number, y: number, z: number, rx = 0, ry = 0, rz = 0): M4 {
  return new Matrix4().compose(new Vector3(x, y, z), new Quaternion().setFromEuler(new Euler(rx, ry, rz, "XYZ")), new Vector3(1, 1, 1));
}
/** 부모 변환 × 자식 변환 */
export const under = (parent: M4, child: M4): M4 => parent.clone().multiply(child);

/** 같은 재질로 그릴 지오메트리 묶음: 정점마다 색(3 또는 4 성분)을 굽고 한 장으로 병합한다 */
export class Bundle {
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
export function makeGlowTexture(): DataTexture {
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

/**
 * 분필 윤곽(MORN-01, 결정 0061-14) — design/v2.0/screens/blockout.js 276~284행을 그대로 옮긴다.
 * 점 21개(× K, K = 캐릭터 배율 0.83) 닫힌 CatmullRom(0.2) → TubeGeometry(120, 0.022, 6, 닫힘), 크림 #e8e6dc 투명 0.85, rotation.y 0.7.
 */
export const CHALK_RADIUS = 0.022;
export const CHALK_OPACITY = 0.85;
export const CHALK_POINTS: readonly (readonly [number, number])[] = [
  [0.12, 1.15], [0.35, 1.3], [0.3, 1.62], [0, 1.76], [-0.3, 1.62], [-0.35, 1.3], [-0.12, 1.15], [-0.7, 1.0], [-0.76, 0.88], [-0.2, 0.9], [-0.26, 0.35],
  [-0.56, -0.05], [-0.4, -0.13], [-0.05, 0.25], [0.05, 0.25], [0.4, -0.13], [0.56, -0.05], [0.26, 0.35], [0.2, 0.9], [0.76, 0.96], [0.72, 1.08],
];

export interface BarScene {
  /** 맵 전체(조명·배경·안개 포함). 캐릭터 그룹은 렌더러가 여기에 붙인다 */
  root: Scene;
  lights: { hemi: HemisphereLight; moon: DirectionalLight; stage: PointLight; pendantA: PointLight; pendantB: PointLight; self: PointLight };
  /** 병합된 그리기 단위(이름은 파일 머리 주석의 번호) */
  meshes: Record<string, Mesh>;
  /** 목적지 링(ring)과 첫 방문 손짓 링(cue) — 같은 모양의 두 겹 */
  markers: { ring: MarkerRing; cue: MarkerRing };
  /** 바닥 아래 연장 판 */
  plate: Mesh;
  /** 마지막으로 적용한 조명 단계의 톤매핑 노출 */
  readonly exposure: number;
  setLighting(phase: LightingPhase): void;
  /** 분필 윤곽을 그 자리(월드 단위, 바닥 y 0.015)에 보인다. null 이면 숨긴다. 메시는 처음부터 만들어 두고 보이기·불투명도만 바꾼다 */
  setChalk(at: { x: number; z: number } | null, opacity: number): void;
  /** 내 캐릭터 빛을 그 자리(월드 단위) 위 높이 2.0 으로 옮긴다. null 이면 기본 자리. 광원은 처음부터 있고 세기만 조명 단계가 바꾼다(광원 수 불변, Pitfall 7) */
  setSelfLight(at: { x: number; z: number } | null): void;
  /**
   * 긴장 단계(결정 0049 선두·과반 연출). 1 = 무대 점광원이 초점 위(높이 3.0)로 옮겨 선두 세기, 2 = 그에 더해 실내 emissive 절반,
   * 0 = 그 단계 값으로 복귀. 조명 단계가 바뀌어도 유지되고 단계 값 위에서 다시 계산된다
   */
  setTension(level: 0 | 1 | 2, focus?: { x: number; z: number }): void;
  /**
   * 핀 조명(결정 0066-6). pin 이 있으면 무대 점광원이 그 자리(x·z) 위로 옮겨 세기가 (단계 값 → 선두 세기) 사이 strength 만큼 올라가고,
   * 방·투표 발광은 단계 값 × dim 이 된다. null 이면 효과가 없다(단계·긴장 값). 긴장과 함께면 핀이 점광원 위치·세기를 이긴다.
   * 새 광원·메시를 만들지 않고 값 몇 개만 대입한다(가벼운 경로). 조명 단계가 바뀌어도 핀 상태는 유지된다
   */
  setPin(pin: { x: number; z: number; strength: number } | null, dim: number): void;
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
  // 변론 원뿔 빛: 광원이 아니라 투명 메시 하나(새 광원을 더하지 않는다 — 결정 0057 예산)
  const matCone = new MeshBasicMaterial({ color: P.stageGlow, transparent: true, opacity: 0.12, depthWrite: false, blending: AdditiveBlending, side: DoubleSide, fog: false });

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
  // 변론(trial) 무대 위 한 줄기 빛: 꼭짓점이 위인 속 빈 원뿔. 무대 윗면(0.29)에서 높이 3.1
  const trialCone = new Mesh(new ConeGeometry(1.2, 3.1, 32, 1, true), matCone);
  trialCone.name = "trialCone";
  trialCone.position.set(0, 0.29 + 3.1 / 2, 0);
  trialCone.castShadow = false;
  trialCone.receiveShadow = false;
  trialCone.visible = false;
  trialCone.renderOrder = 2;
  meshes.trialCone = trialCone;
  // 빛 무리는 투명 합성이라 불투명 메시 뒤에 그린다
  meshes.glowRoom!.renderOrder = 2;
  meshes.glowVote!.renderOrder = 2;
  for (const m of Object.values(meshes)) root.add(m);

  // 분필 윤곽: 처음부터 만들어 두고 숨긴다(보이기만 바꾼다). 바닥에 눕는 선이라 이동을 막지 않는다
  const chalk = new Mesh(
    new TubeGeometry(
      new CatmullRomCurve3(
        CHALK_POINTS.map(([px, pz]) => new Vector3(px * CHAR_SCALE, 0, -pz * CHAR_SCALE + 0.75 * CHAR_SCALE)),
        true,
        "catmullrom",
        0.2,
      ),
      120,
      CHALK_RADIUS,
      6,
      true,
    ),
    new MeshBasicMaterial({ color: "#e8e6dc", transparent: true, opacity: CHALK_OPACITY }),
  );
  chalk.name = "chalk";
  chalk.rotation.y = 0.7;
  chalk.visible = false;
  chalk.castShadow = false;
  chalk.receiveShadow = false;
  meshes.chalk = chalk;
  root.add(chalk);

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
  // 내 캐릭터 빛: 세기 0 으로 처음부터 만든다 — 조명 단계가 바뀌어도 점광원 개수가 변하지 않아 셰이더를 다시 컴파일하지 않는다(연구 Pitfall 7).
  // 예산 core 에서도 visible 을 끄지 않는다(끄면 개수가 변한다)
  const self = point(T.point.self);
  root.add(hemi, moon, moon.target, stage, pendantA, pendantB, self);

  const background = new Color(T.talk.sky[2]);
  const fog = new Fog(T.talk.sky[2], T.talk.fog.near, T.talk.fog.far);
  root.background = background;
  root.fog = fog;

  let exposure = T.talk.exposure;
  let disposed = false;
  let current = budget;
  let phase: LightingPhase = "talk";
  let tensionLevel: 0 | 1 | 2 = 0;
  let tensionFocus: { x: number; z: number } | null = null;
  // 핀 조명(결정 0066-6): applyLook 이 정한 단계·긴장 값 위에 얹는다. 기본 값은 applyLook 이 매번 채운다
  let pinState: { x: number; z: number; strength: number } | null = null;
  let pinDim = 1;
  const base = { stage: 0, x: T.point.stage.x, z: T.point.stage.z, room: 0, vote: 0 };

  /** 핀 상태를 점광원 위치·세기와 두 발광 색에 반영한다 — 값 몇 개 대입뿐이다(프레임마다 불려도 비용이 없다) */
  const applyPin = (): void => {
    if (pinState === null) {
      stage.intensity = base.stage;
      stage.position.set(base.x, T.point.stage.y, base.z);
      matEmRoom.color.setScalar(base.room);
      matEmVote.color.setScalar(base.vote);
      return;
    }
    const k = Math.min(1, Math.max(0, pinState.strength));
    stage.intensity = base.stage + (T.tension.lead - base.stage) * k;
    stage.position.set(pinState.x, T.point.stage.y, pinState.z);
    matEmRoom.color.setScalar(base.room * pinDim);
    matEmVote.color.setScalar(base.vote * pinDim);
  };

  /** 단계·긴장·예산을 모두 합쳐 장면에 반영한다(셋 중 무엇이 바뀌어도 같은 곳에서 다시 계산) */
  const applyLook = (): void => {
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
    self.intensity = t.self;
    // 긴장 1·2: 무대 점광원이 초점 위로 옮겨 선두 세기(초점이 없으면 무대 중앙). 0: 단계 값과 무대 중앙
    const lead = tensionLevel >= 1;
    base.stage = lead ? T.tension.lead : t.stage;
    if (lead && tensionFocus) {
      base.x = tensionFocus.x;
      base.z = tensionFocus.z;
    } else {
      base.x = T.point.stage.x;
      base.z = T.point.stage.z;
    }
    // 점광원 core: 펜던트 둘은 세기 0 + 장면 광원 목록에서 뺀다(셰이더 광원 수가 줄어든다). 벽·촛불 빛은 emissive 와 빛 무리가 이미 낸다
    const pendant = b.lights === "full" ? t.pendant : 0;
    pendantA.intensity = pendant;
    pendantB.intensity = pendant;
    pendantA.visible = b.lights === "full";
    pendantB.visible = b.lights === "full";
    base.room = t.emissive.room * (tensionLevel === 2 ? T.tension.halfRoom : 1);
    base.vote = t.emissive.vote;
    applyPin();
    matGlowRoom.opacity = t.glow.room;
    matGlowVote.opacity = t.glow.vote;
    meshes.glowRoom!.visible = b.glows && t.glow.room > 0;
    meshes.glowVote!.visible = b.glows && t.glow.vote > 0;
    trialCone.visible = phase === "trial" && b.glows; // 원뿔 빛은 trial 에서만(빛 무리를 끄는 5단계에선 같이 끈다)
    root.fog = b.fog ? fog : null;
    exposure = t.exposure;
  };
  const setLighting = (next: LightingPhase): void => {
    phase = next;
    applyLook();
  };
  const setSelfLight = (at: { x: number; z: number } | null): void => {
    if (at === null) self.position.set(T.point.self.x, T.point.self.y, T.point.self.z);
    else self.position.set(at.x, T.point.self.y, at.z);
  };
  const setChalk = (at: { x: number; z: number } | null, opacity: number): void => {
    if (at === null) {
      chalk.visible = false;
      return;
    }
    chalk.visible = true;
    chalk.position.set(at.x, 0.015, at.z);
    (chalk.material as MeshBasicMaterial).opacity = opacity;
  };
  const setTension = (level: 0 | 1 | 2, focus?: { x: number; z: number }): void => {
    tensionLevel = level;
    tensionFocus = level >= 1 && focus ? { x: focus.x, z: focus.z } : null;
    applyLook();
  };

  const setPin = (pin: { x: number; z: number; strength: number } | null, dim: number): void => {
    pinState = pin === null ? null : { x: pin.x, z: pin.z, strength: pin.strength };
    pinDim = Number.isFinite(dim) ? Math.min(1, Math.max(0, dim)) : 1;
    applyPin();
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
    lights: { hemi, moon, stage, pendantA, pendantB, self },
    meshes,
    markers,
    plate,
    get exposure(): number {
      return exposure;
    },
    setLighting,
    setChalk,
    setSelfLight,
    setTension,
    setPin,
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
