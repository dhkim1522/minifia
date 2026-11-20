// 달빛 누아르의 지하 재즈 바. 기존 이동 범위에 새 아르데코 가구를 넣고 재질별 병합과 점광원 3개를 유지한다.
// three 를 값으로 쓰므로 정적 import 경로에 두지 않는다(06-13 이 threeRenderer 와 함께 import() 로만 연다). WebGL 없이 node 에서 만들어지고 검사된다.
//
// 그리기 단위(보이는 메시, 모두 병합):  1 shell(바닥·벽·창틀, 그림자 받기만)  2 furniture(카운터·스툴·피아노 몸·무대·탁자·의자)
//   2b furnitureFar(피아노 뚜껑·술병 선반 널)  3 brass(놋쇠 테두리·서는 자리 8·마이크 대)  4 emissiveRoom(창유리·촛불·벽등)
//   4b emissiveRoomFar(술병·펜던트 전구·선반 등)  5 emissiveVote(무대 가장자리 전구)  6 glowRoom·glowVote(빛 무리 쿼드)
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
  RepeatWrapping,
  RGBAFormat,
  Scene,
  SphereGeometry,
  SRGBColorSpace,
  Texture,
  TextureLoader,
  TorusGeometry,
  TubeGeometry,
  Vector3,
} from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { BAR_COUNTER, BAR_PIANO, BAR_ROOM_HALF, BAR_SEATS_FX, BAR_SEAT_HEIGHT, BAR_SEAT_RADIUS, BAR_STAGE_HEIGHT, BAR_STAGE_RADIUS, UNIT } from "../../../shared/game/map";
import { cameraBasis, PLATE_FAR } from "../camera";
import { CHAR_SCALE } from "../character";
import { PALETTE, TOKEN_COLORS } from "../palette";
import type { Budget, LightingPhase } from "../renderer";
import { phaseLighting } from "./phaseLighting";

// ---------- 조명 시작값 (가정 A1) ----------
// B안 재즈 바: 낮은 창빛과 따뜻한 무대, 밤은 낮은 채광과 남색 창빛. 재질 색은 albedo 로 단계마다 섞는다(18-12, G-18-1).
// 반구·방향광 = 시안 세기 × π(r155 조명 단위 변경), 점광원 = 시안 세기 × 4 로 시작한다. 승인 보드와 나란히 놓고 맞추는 일은 06-14 가 한다.
export interface PhaseTune {
  /** 반구광 세기 */
  hemi: number;
  /** 달빛 방향광 세기 */
  moon: number;
  /** 방향광 색(단계별, D-03) */
  moonColor: string;
  /** 톤매핑 노출 */
  exposure: number;
  /** [반구 하늘색, 반구 땅색, 배경·안개색] */
  sky: [string, string, string];
  fog: { near: number; far: number };
  /** 무대 위 점광원 세기 */
  stage: number;
  /** 무대 밖 조명(바의 펜던트, 광장의 가로등) 점광원 세기 */
  pendant: number;
  /** emissive 재질 배율(그룹 room: 실내등, vote: 무대 가장자리 전구) */
  emissive: { room: number; vote: number };
  /** 빛 무리 쿼드 불투명도 배율 */
  glow: { room: number; vote: number };
  /** 내 캐릭터 위 작은 점광원 세기(밤·시민 편 nightCitizen 에서만 0 보다 크다) */
  self: number;
  /** 맵 고유의 재질 보정. 색을 시간대별로 다시 쓰지 않는다. */
  albedo: AlbedoGrade;
}

/** 재질 보정 값: 선형 작업 공간에서 out = base × (1 − mix) + tint × mix */
export interface AlbedoGrade {
  tint: string;
  mix: number;
}
/** 보정 없음(원래 색 그대로) */
export const ALBEDO_NONE: AlbedoGrade = { tint: "#808080", mix: 0 };

/**
 * 재질 보정기(18-12, G-18-1): 메시들의 정점 색("color" 속성)과 재질 color 의 원래 값을 복사해 두고,
 * 돌려주는 함수가 불릴 때마다 원래 값 × (1 − mix) + tint × mix 를 다시 쓴다(선형 작업 공간). 언제나 복사본에서 계산하므로 누적되지 않고,
 * mix 0 이면 복사본을 그대로 돌려놓아 원래 값과 정확히 같다. 단계가 바뀔 때만 불러야 한다(정점 수만큼 쓰는 일이다).
 */
export function albedoGrader(meshes: readonly Mesh[], mats: readonly MeshStandardMaterial[]): (g: AlbedoGrade) => void {
  const verts = meshes.map((m) => {
    const attr = m.geometry.getAttribute("color") as BufferAttribute;
    return { attr, base: Float32Array.from(attr.array as Float32Array) };
  });
  const matBase = mats.map((m) => m.color.clone());
  return (g: AlbedoGrade): void => {
    const tint = new Color(g.tint);
    const keep = 1 - g.mix;
    for (const { attr, base } of verts) {
      const arr = attr.array as Float32Array;
      if (g.mix === 0) arr.set(base);
      else {
        const size = attr.itemSize;
        for (let i = 0; i < arr.length; i += size) {
          arr[i] = base[i]! * keep + tint.r * g.mix;
          arr[i + 1] = base[i + 1]! * keep + tint.g * g.mix;
          arr[i + 2] = base[i + 2]! * keep + tint.b * g.mix;
          if (size > 3) arr[i + 3] = base[i + 3]!;
        }
      }
      attr.needsUpdate = true;
    }
    mats.forEach((m, k) => {
      if (g.mix === 0) m.color.copy(matBase[k]!);
      else m.color.copy(matBase[k]!).lerp(tint, g.mix);
    });
  };
}

const PENDANT_TALK = 0.9 * 4;
// 벽·바닥의 색과 주 조명의 방향을 밤에도 공유한다. 창가의 빛과 무대 전구가 시간대를 나타낸다.
const BAR_TALK: PhaseTune = {
  hemi: 1.04 * Math.PI,
  moon: 0.95 * Math.PI,
  moonColor: "#dce8ff",
  exposure: 1.45,
  sky: ["#aeb5c8", "#464c59", "#454953"],
  fog: { near: 20, far: 44 },
  stage: 4.8,
  pendant: PENDANT_TALK,
  emissive: { room: 1, vote: 0.65 },
  glow: { room: 1, vote: 0.45 },
  self: 0,
  albedo: { tint: "#737a87", mix: 0.38 },
};
const BAR_NIGHT: PhaseTune = {
  ...BAR_TALK,
  hemi: 0.74 * Math.PI,
  moon: 0.66 * Math.PI,
  moonColor: "#adc4ee",
  sky: ["#99a5c1", "#3e4559", "#394051"],
  stage: 3.2,
  pendant: PENDANT_TALK * 0.88,
  emissive: { room: 0.88, vote: 0.55 },
  glow: { room: 0.88, vote: 0.37 },
};
export const LIGHT_TUNE: Readonly<Record<LightingPhase, PhaseTune>> & {
  point: { stage: { x: number; y: number; z: number; distance: number }; pendantA: { x: number; y: number; z: number; distance: number }; self: { x: number; y: number; z: number; distance: number }; decay: number };
  tension: { lead: number; halfRoom: number };
  moonTarget: { x: number; y: number; z: number };
} = {
  talk: BAR_TALK,
  vote: { ...BAR_TALK, stage: 8, emissive: { ...BAR_TALK.emissive, vote: 1 }, glow: { ...BAR_TALK.glow, vote: 1 } },
  trial: { ...BAR_TALK, stage: 8, emissive: { ...BAR_TALK.emissive, vote: 1 }, glow: { ...BAR_TALK.glow, vote: 1 } },
  night: BAR_NIGHT,
  nightCitizen: { ...BAR_NIGHT, self: 1.2 },
  nightGhost: {
    ...BAR_NIGHT,
    emissive: { ...BAR_NIGHT.emissive, vote: BAR_NIGHT.emissive.vote * 0.4 },
    glow: { ...BAR_NIGHT.glow, vote: BAR_NIGHT.glow.vote * 0.4 },
  },
  morning: {
    ...BAR_TALK,
    hemi: 0.93 * Math.PI,
    moon: 0.82 * Math.PI,
    moonColor: "#d7e0f0",
    sky: ["#a8b0c2", "#424858", "#404651"],
    stage: 3.8,
  },
  /** 긴장 단계(결정 0049): lead = 1·2 단계에서 초점 위로 옮긴 무대 점광원 세기(vote 의 1.5 배), halfRoom = 2 단계에서 실내 emissive 에 곱하는 값 */
  tension: { lead: 2.0 * 4 * 1.5, halfRoom: 0.5 },
  point: {
    stage: { x: 0, y: 3.0, z: 0, distance: 6 },
    pendantA: { x: -2.4, y: 2.6, z: -4.6, distance: 5 },
    /** 내 캐릭터 위(높이 2.0)에서 비추는 작은 빛. 자리는 setSelfLight 가 따라간다 */
    self: { x: 0, y: 2.0, z: 0, distance: 4 },
    decay: 2,
  },
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
  lights: { hemi: HemisphereLight; moon: DirectionalLight; stage: PointLight; pendantA: PointLight; self: PointLight };
  /** 병합된 그리기 단위(이름은 파일 머리 주석의 번호) */
  meshes: Record<string, Mesh>;
  /** 목적지 링(ring)과 첫 방문 손짓 링(cue) — 같은 모양의 두 겹 */
  markers: { ring: MarkerRing; cue: MarkerRing };
  /** 바닥 아래 연장 판 */
  plate: Mesh;
  /** 마지막으로 적용한 조명 단계의 톤매핑 노출 */
  readonly exposure: number;
  /** 월넛 바닥 재질을 읽어 붙였거나 기본 월넛 색으로 대체한 뒤 완료된다. */
  readonly woodReady?: Promise<void>;
  setLighting(phase: LightingPhase, seconds?: number): void;
  setCenterTable?(on: boolean): void;
  /** 프레임 사이 경과 초와 단조 증가 시각. */
  update(dt: number, t: number): void;
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
const BAR_WINDOW = { x: 2.2, y: 1.9, z: -6.97, width: 2.4, height: 1.5, divisions: 3, mullion: 0.08 };
const COMPACT_WINDOW = { x: 0.42, y: 1.96, z: -BAR_ROOM_HALF + 0.13, width: 1.52, height: 1.24, divisions: 3, mullion: 0.045 };
const WINDOW_LIGHT = { x: 6.6, y: 7, z: -22.45 };
const WINDOW_BEAM_DAY = { beam: 0.36 };
const WINDOW_BEAM_NIGHT = { beam: 0.18 };
const WINDOW_LIGHT_ACCENTS = {
  talk: WINDOW_BEAM_DAY,
  vote: WINDOW_BEAM_DAY,
  trial: { ...WINDOW_BEAM_DAY, cone: 0.12 },
  night: WINDOW_BEAM_NIGHT,
  nightCitizen: WINDOW_BEAM_NIGHT,
  nightGhost: WINDOW_BEAM_NIGHT,
  morning: { beam: 0.28 },
} satisfies Partial<Record<LightingPhase, { beam: number; cone?: number }>>;

/** 창살 사이 유리의 실루엣을 방향광을 따라 바닥에 투영한다. 한 번 만든 메시의 불투명도만 단계별로 바꾼다. */
function windowBeamGeometry(window = BAR_WINDOW): BufferGeometry {
  const { x, y, z, width, height, divisions, mullion } = window;
  const target = LIGHT_TUNE.moonTarget;
  const rayX = (target.x - WINDOW_LIGHT.x) / WINDOW_LIGHT.y;
  const rayZ = (target.z - WINDOW_LIGHT.z) / WINDOW_LIGHT.y;
  const positions: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];
  const addCorner = (px: number, py: number): void => {
    positions.push(x + px + py * rayX, 0.002, z + py * rayZ);
    const distance = (py - (y - height / 2)) / height;
    colors.push(1, 1, 1, 1 - distance * 0.6);
  };
  for (let row = 0; row < divisions; row++) {
    const bottom = y - height / 2 + height * row / divisions + mullion / 2;
    const top = bottom + height / divisions - mullion;
    for (let col = 0; col < divisions; col++) {
      const left = -width / 2 + width * col / divisions + mullion / 2;
      const right = left + width / divisions - mullion;
      const i = positions.length / 3;
      addCorner(left, bottom);
      addCorner(right, bottom);
      addCorner(left, top);
      addCorner(right, top);
      indices.push(i, i + 2, i + 1, i + 1, i + 2, i + 3);
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(new Float32Array(positions), 3));
  geometry.setAttribute("color", new BufferAttribute(new Float32Array(colors), 4));
  geometry.setIndex(indices);
  return geometry;
}

/** 판재 사이를 뚫지 않고 정점 음영으로 이음새를 표현한다. 좁은 폰에서 얇은 틈이 픽셀 단위로 끊기지 않는다. */
function addCompactPlank(floor: Bundle, width: number, depth: number, x: number, z: number, tint: string): void {
  const geometry = new PlaneGeometry(width, depth, 3, 3);
  const points = geometry.getAttribute("position");
  const w = width / 2;
  const d = depth / 2;
  const edgeX = Math.min(w / 2, 0.037);
  const edgeZ = Math.min(d / 2, 0.029);
  const xs = [-w, -w + edgeX, w - edgeX, w];
  const ys = [d, d - edgeZ, -d + edgeZ, -d];
  for (let row = 0; row < 4; row++) {
    for (let col = 0; col < 4; col++) points.setXY(row * 4 + col, xs[col]!, ys[row]!);
  }
  floor.add(geometry, tint, tf(x, 0, z, -Math.PI / 2));
  const colors = geometry.getAttribute("color");
  for (let row = 0; row < 4; row++) {
    for (let col = 0; col < 4; col++) {
      if (row !== 0 && row !== 3 && col !== 0 && col !== 3) continue;
      const i = row * 4 + col;
      colors.setXYZ(i, colors.getX(i) * 0.70, colors.getY(i) * 0.70, colors.getZ(i) * 0.70);
    }
  }
}

function compactProps(
  shell: Bundle,
  floor: Bundle,
  furniture: Bundle,
  far: Bundle,
  brass: Bundle,
  lamps: Bundle,
  farLamps: Bundle,
  rim: Bundle,
  pendants: Bundle,
  stand: Bundle,
  bulb: Bundle,
  platform: Bundle,
  platformTrim: Bundle,
  omitSeats: boolean,
): void {
  const P = PALETTE;
  const half = BAR_ROOM_HALF;
  const side = half * 2;
  shell.box(side + 0.08, 0.15, side + 0.08, "#3c2f2d", tf(0, -0.091, 0));
  const planks = ["#765847", "#6b5041", "#725544"] as const;
  const depth = side / 31;
  for (let row = 0; row < 31; row++) {
    const z = -half + (row + 0.5) * depth;
    let start = -half;
    let end = start + (row % 3 + 2) * 0.47;
    let i = 0;
    while (start < half - 0.014) {
      const right = Math.min(end, half);
      addCompactPlank(floor, right - start, depth, (start + right) / 2, z, planks[(row + i * 2) % planks.length]!);
      start = right;
      end += 1.95;
      i++;
    }
  }
  for (const frame of [tf(0, 0, -half), tf(-half, 0, 0, 0, Math.PI / 2, 0)]) {
    shell.box(side, 3.45, 0.14, P.wall, under(frame, tf(0, 1.725, 0)));
    shell.box(side, 0.87, 0.045, P.wainscot, under(frame, tf(0, 0.435, 0.085)));
    for (const y of [0.09, 0.86, 3.19]) shell.box(side, 0.055, 0.07, P.wallTrim, under(frame, tf(0, y, 0.107)));
    for (let i = -4; i <= 4; i++) shell.box(0.045, 0.69, 0.04, P.wallTrim, under(frame, tf(i * 1.02, 0.48, 0.115)));
  }
  brass.box(side, 0.017, 0.036, P.brass, tf(0, 0.004, half - 0.04));
  brass.box(0.036, 0.017, side, P.brass, tf(half - 0.04, 0.004, 0));

  const { x, y, z, width, height, divisions, mullion } = COMPACT_WINDOW;
  const win = tf(x, y, z);
  shell.box(width + 0.16, height + 0.14, 0.06, P.sill, win);
  lamps.add(new PlaneGeometry(width, height), "#638ac8", under(win, tf(0, 0, 0.034)), 0.72);
  for (let i = 0; i <= divisions; i++) {
    shell.box(width, mullion, 0.044, P.blind, under(win, tf(0, height * (i / divisions - 0.5), 0.063)));
    shell.box(mullion, height, 0.044, P.blind, under(win, tf(width * (i / divisions - 0.5), 0, 0.063)));
  }
  shell.box(width + 0.18, 0.066, 0.18, P.sill, under(win, tf(0, -height / 2 - 0.06, 0.060)));
  for (const panel of [-3.2, 2.4]) {
    const wallFan = tf(panel, 1.12, -half + 0.105);
    for (const side of [-1, 1]) {
      for (let i = 0; i < 4; i++) {
        const span = 0.12 + i * 0.14;
        const rise = 1.25 - i * 0.17;
        shell.box(0.022, Math.hypot(span, rise), 0.014, P.inlay, under(wallFan, tf(side * span / 2, rise / 2, 0, 0, 0, -Math.atan2(side * span, rise))));
      }
    }
    shell.box(1.12, 0.022, 0.021, P.inlay, wallFan);
  }

  const piano = BAR_PIANO;
  const pi = tf(piano.x, 0, piano.z);
  furniture.box(piano.width, 0.69, piano.depth, P.pianoBody, under(pi, tf(0, 0.94, 0)));
  far.box(piano.width + 0.06, 0.052, piano.depth + 0.05, P.counterTop, under(pi, tf(0, 1.30, 0)));
  furniture.box(piano.width, 0.11, 0.20, P.pianoBody, under(pi, tf(0, 0.63, 0.37)));
  brass.box(piano.width - 0.13, 0.015, 0.020, P.brass, under(pi, tf(0, 1.145, 0.337)));
  const keyWidth = (piano.width - 0.12) / 24;
  for (let i = 0; i < 24; i++) {
    const keyX = (i - 11.5) * keyWidth;
    furniture.box(keyWidth - 0.003, 0.028, 0.15, P.pianoKeys, under(pi, tf(keyX, 0.696, 0.389)));
    if (i % 7 !== 2 && i % 7 !== 6 && i < 23) furniture.box(keyWidth * 0.53, 0.024, 0.083, P.pianoBody, under(pi, tf(keyX + keyWidth / 2, 0.719, 0.366)));
  }
  for (const x of [-0.69, 0.69]) furniture.box(0.086, 0.62, 0.089, P.pianoBody, under(pi, tf(x, 0.31, 0.42)));
  const bar = BAR_COUNTER;
  furniture.box(bar.width, 0.78, bar.depth, P.counter, tf(bar.x, 0.39, bar.z));
  furniture.box(bar.width + 0.1, 0.075, bar.depth + 0.12, P.counterTop, tf(bar.x, 0.81, bar.z));
  brass.box(0.027, 0.027, bar.depth - 0.07, P.brass, tf(bar.x - bar.width / 2, 0.14, bar.z));
  for (const height of [1.27, 1.85]) {
    far.box(0.27, 0.065, bar.depth, P.shelf, tf(half - 0.20, height, bar.z));
    for (let i = 0; i < 7; i++) {
      const z = bar.z + (i - 3) * 0.265;
      farLamps.cyl(0.064, 0.074, 0.17, 8, P.bottles[i % P.bottles.length]!, tf(half - 0.21, height + 0.12, z), 0.58);
      farLamps.cyl(0.024, 0.053, 0.07, 8, P.bottles[i % P.bottles.length]!, tf(half - 0.21, height + 0.239, z), 0.72);
    }
  }
  for (const [x, z] of [[-2.75, -4.22], [1.95, -4.22]] as const) {
    pendants.cyl(0.016, 0.016, 0.63, 8, P.darkMetal, tf(x, 3.02, z));
    pendants.add(new SphereGeometry(0.24, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 0.62, 1), P.shade, tf(x, 2.69, z));
    pendants.add(new TorusGeometry(0.23, 0.012, 6, 24), P.brass, tf(x, 2.692, z, -Math.PI / 2));
    farLamps.sph(0.075, P.lamp, tf(x, 2.678, z), 1.25);
  }

  const radius = BAR_STAGE_RADIUS;
  platform.cyl(radius, radius, 0.087, 48, P.stageBody, tf(0, 0.0435, 0));
  platform.cyl(radius - 0.018, radius, BAR_STAGE_HEIGHT - 0.087, 48, "#8d5d42", tf(0, (BAR_STAGE_HEIGHT + 0.087) / 2, 0));
  platformTrim.add(new TorusGeometry(radius - 0.016, 0.013, 6, 48), P.brass, tf(0, BAR_STAGE_HEIGHT - 0.011, 0, -Math.PI / 2));
  for (let i = 0; i < 18; i++) {
    const a = i * Math.PI * 2 / 18;
    rim.sph(0.017, P.rimBulb, tf(Math.sin(a) * radius, 0.064, Math.cos(a) * radius), 1.25);
  }
  stand.cyl(0.22, 0.24, 0.052, 24, P.brass, tf(0, 0.144, 0));
  stand.cyl(0.032, 0.049, 0.46, 16, P.brass, tf(0, 0.398, 0));
  stand.cyl(0.13, 0.276, 0.14, 32, "#aa774d", tf(0, 0.70, 0));
  stand.add(new TorusGeometry(0.271, 0.013, 6, 32), P.brass, tf(0, 0.635, 0, -Math.PI / 2));
  bulb.cyl(0.246, 0.246, 0.025, 32, "#ffe0af", tf(0, 0.636, 0), 1.5);
  bulb.sph(0.037, P.lamp, tf(0, 0.786, 0), 1.25);
  if (!omitSeats) {
    for (const [sx, sz] of BAR_SEATS_FX) {
      const chair = tf(sx / UNIT, 0, sz / UNIT, 0, Math.atan2(-sx, -sz));
      furniture.cyl(BAR_SEAT_RADIUS, 0.326, 0.075, 32, P.chairSeat, under(chair, tf(0, BAR_SEAT_HEIGHT - 0.0375, 0)));
      furniture.cyl(0.23, 0.27, 0.103, 24, P.chairBack, under(chair, tf(0, 0.070, 0)));
      brass.add(new TorusGeometry(BAR_SEAT_RADIUS - 0.012, 0.012, 6, 32), P.brass, under(chair, tf(0, BAR_SEAT_HEIGHT - 0.037, 0, -Math.PI / 2)));
      furniture.add(new SphereGeometry(0.29, 18, 12).scale(1.11, 0.58, 0.20), P.chairSeat, under(chair, tf(0, 0.37, -0.29, -0.11)));
      for (const x of [-0.17, 0.17]) brass.cyl(0.017, 0.02, 0.265, 8, P.brass, under(chair, tf(x, 0.22, -0.26, -0.13)));
    }
  }
}

interface BarOptions {
  compact?: boolean;
  omitCenterSeats?: boolean;
  omitTableChairsAt?: readonly [number, number];
}

export function buildBarScene(budget: Budget, { compact = false, omitCenterSeats = false, omitTableChairsAt }: BarOptions = {}): BarScene {
  const root = new Scene();
  const P = PALETTE;

  // ----- 재질 -----
  const matProp = new MeshStandardMaterial({ vertexColors: true, roughness: 0.72, metalness: 0 });
  const matFloor = compact ? new MeshStandardMaterial({ vertexColors: true, roughness: 0.65 }) : null;
  const matBrass = new MeshStandardMaterial({ vertexColors: true, roughness: 0.4, metalness: 0.5 });
  const matPendant = new MeshStandardMaterial({ vertexColors: true, roughness: 0.85, metalness: 0, side: DoubleSide });
  const matEmRoom = new MeshBasicMaterial({ vertexColors: true });
  const matEmVote = new MeshBasicMaterial({ vertexColors: true });
  const glowMap = makeGlowTexture();
  const glowMat = (): MeshBasicMaterial =>
    new MeshBasicMaterial({ vertexColors: true, map: glowMap, transparent: true, blending: AdditiveBlending, depthWrite: false, fog: false });
  const matGlowRoom = glowMat();
  const matGlowVote = glowMat();
  const matPlate = new MeshStandardMaterial({ color: compact ? "#171d2a" : P.plate, roughness: 0.85, metalness: 0 });
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
  const floor = new Bundle();
  const stand = new Bundle();
  const bulb = new Bundle();
  const platform = new Bundle();
  const platformTrim = new Bundle();

  // 빛 무리: 카메라 yaw 가 고정이라 카메라를 향해 미리 돌린 쿼드를 합친다(Sprite 대신). 색 = hex, 알파 = k
  const basis = cameraBasis();
  const facing = new Matrix4().makeBasis(new Vector3(basis.right.x, basis.right.y, basis.right.z), new Vector3(basis.up.x, basis.up.y, basis.up.z), new Vector3(basis.back.x, basis.back.y, basis.back.z));
  const glow = (b: Bundle, hex: string, size: number, x: number, y: number, z: number, k: number): void => {
    const m = facing.clone().setPosition(x, y, z);
    b.add(new PlaneGeometry(size, size), hex, m, 1, k);
  };

  if (compact) {
    compactProps(shell, floor, furniture, furnitureFar, brass, emRoom, emRoomFar, emVote, pendants, stand, bulb, platform, platformTrim, omitCenterSeats);
    glow(glowRoom, P.lamp, 1.3, -2.75, 2.68, -4.22, 0.42);
    glow(glowRoom, P.lamp, 1.3, 1.95, 2.68, -4.22, 0.42);
    glow(glowVote, P.stageGlow, 2.1, 0, 0.24, 0, 0.27);
  } else {
  // 짙은 월넛을 폭 좁은 널로 엮고 줄마다 이음새를 엇갈리게 배치한다.
  const wood = [P.floorA, P.floorB, P.floorC] as const;
  const boardWidth = 14 / 36;
  shell.box(14, 0.07, 14, P.floorB, tf(0, -0.057, 0));
  for (let column = 0; column < 36; column++) {
    const boardX = -7 + boardWidth * (column + 0.5);
    const offset = (column % 4) * 0.65;
    for (let board = 0; board < 5; board++) {
      const start = Math.max(-7, -7 - offset + board * 3.5);
      const end = Math.min(7, -7 - offset + (board + 1) * 3.5);
      if (end > start) shell.box(boardWidth - 0.011, 0.03, end - start - 0.012, wood[(column * 5 + board * 7) % wood.length]!, tf(boardX, -0.015, (start + end) / 2));
    }
  }
  // 벽(뒤 두 면) + 허리판
  shell.box(0.3, 3.6, 14.3, P.wall, tf(-7.15, 1.8, 0));
  shell.box(14.3, 3.6, 0.3, P.wall, tf(0, 1.8, -7.15));
  shell.box(0.06, 1.0, 14, P.wainscot, tf(-6.98, 0.5, 0));
  shell.box(14, 1.0, 0.06, P.wainscot, tf(0, 0.5, -6.98));
  const decorateWall = (center: Matrix4): void => {
    for (const height of [0.17, 0.96, 3.39]) shell.box(14, 0.065, 0.055, P.wallTrim, under(center, tf(0, height, 0)));
    for (let panel = -5; panel <= 5; panel++) shell.box(0.037, 0.74, 0.04, P.wallTrim, under(center, tf(panel * 1.19, 0.56, 0.026)));
  };
  decorateWall(tf(0, 0, -6.94));
  decorateWall(tf(-6.94, 0, 0, 0, Math.PI / 2, 0));

  // 황동 부채 문양: 벽에 붙인 선과 같은 두께의 색면을 한 묶음으로 그린다.
  const wallFan = tf(-2.2, 0, -6.895);
  for (const side of [-1, 1]) {
    for (let ray = 0; ray < 4; ray++) {
      const span = 0.16 + ray * 0.23;
      const rise = 1.64 - ray * 0.23;
      shell.box(0.026, Math.hypot(span, rise), 0.017, P.inlay, under(wallFan, tf(side * span / 2, 1.18 + rise / 2, 0, 0, 0, -Math.atan2(side * span, rise))));
    }
  }
  shell.box(1.9, 0.025, 0.025, P.inlay, under(wallFan, tf(0, 1.18, 0)));

  // 창과 창살(뒷벽). 투영과 같은 치수를 쓴다
  const { x, y, z, width, height, divisions, mullion } = BAR_WINDOW;
  const win = tf(x, y, z);
  emRoom.add(new PlaneGeometry(width, height), P.windowGlass, win, 0.5);
  for (let line = 0; line <= divisions; line++) {
    shell.box(width, mullion, 0.04, P.blind, under(win, tf(0, height * (line / divisions - 0.5), 0.03)));
    shell.box(mullion, height, 0.04, P.blind, under(win, tf(width * (line / divisions - 0.5), 0, 0.03)));
  }
  shell.box(width + 0.2, 0.1, 0.12, P.sill, under(win, tf(0, -height / 2 - 0.05, 0.04)));
  for (const side of [-1, 1]) {
    shell.box(0.1, height + 0.13, 0.07, P.sill, under(win, tf(side * (width / 2 + 0.075), 0, 0.035)));
    shell.box(width + 0.19, 0.08, 0.07, P.sill, under(win, tf(0, side * (height / 2 + 0.065), 0.035)));
  }

  // 바 카운터와 술병 선반(왼쪽 벽)
  furniture.box(0.97, 0.93, 6.17, P.counter, tf(-5.71, 0.49, -2.2));
  furniture.box(1.0, 0.075, 6.2, P.shelf, tf(-5.7, 0.9925, -2.2));
  furniture.box(1.0, 0.065, 6.2, P.counterTop, tf(-5.7, 1.0975, -2.2));
  furniture.box(1.0, 0.12, 6.2, P.darkMetal, tf(-5.7, 0.06, -2.2));
  brass.box(0.024, 0.023, 6.03, P.brass, tf(-5.214, 0.19, -2.2));
  for (let panel = 0; panel < 18; panel++) furniture.box(0.025, 0.7, 0.047, P.wallTrim, tf(-5.216, 0.58, -5.02 + panel * 0.33));
  for (const height of SHELF_YS) furnitureFar.box(0.35, 0.065, 6.0, P.shelf, tf(-6.8, height, -2.2));
  for (let b = 0; b < 27; b++) {
    const bz = -5.02 + (b % 9) * 0.66;
    const by = SHELF_YS[Math.floor(b / 9)]!;
    const bottle = P.bottles[b % 4]!;
    const tall = 0.16 + (b % 3) * 0.032;
    emRoomFar.cyl(0.073, 0.082, tall, 7, bottle, tf(-6.78, by + 0.035 + tall / 2, bz), 0.45);
    emRoomFar.cyl(0.029, 0.066, 0.055, 7, bottle, tf(-6.78, by + 0.062 + tall, bz), 0.55);
    emRoomFar.cyl(0.033, 0.028, 0.049, 7, P.lamp, tf(-6.78, by + 0.113 + tall, bz), 0.62);
  }
  // 선반 아래 따뜻한 띠: 시안의 카운터 위 점광원(0.8)을 점광원 예산 밖으로 빼면서 emissive 로 옮겼다
  emRoomFar.box(0.04, 0.03, 5.6, P.lamp, tf(-6.65, 2.25, -2.2), 1.0);
  glow(glowRoom, P.lamp, 2.4, -5.6, 2.4, -2.2, 0.3);
  for (let st = 0; st < 4; st++) {
    const stool = tf(-4.8, 0, -4.4 + st * 1.4);
    furniture.cyl(0.219, 0.238, 0.067, 16, P.stoolSeat, under(stool, tf(0, 0.721, 0)));
    furniture.cyl(0.236, 0.202, 0.05, 16, P.shelf, under(stool, tf(0, 0.662, 0)));
    for (const side of [-1, 1]) {
      for (const across of [-1, 1]) furniture.box(0.043, 0.65, 0.043, P.darkMetal, under(stool, tf(side * 0.134, 0.325, across * 0.133, -across * 0.09, 0, side * 0.09)));
    }
    brass.add(new TorusGeometry(0.165, 0.012, 4, 16), P.brass, under(stool, tf(0, 0.248, 0, -Math.PI / 2)));
  }

  // 피아노(뒤 구석)
  const pi = tf(-4.6, 0, -5.0, 0, 0.6, 0);
  furniture.box(1.56, 0.19, 0.97, P.pianoBody, under(pi, tf(0, 0.77, 0.01)));
  furniture.box(1.56, 0.47, 0.56, P.pianoBody, under(pi, tf(0, 1.047, -0.28)));
  furnitureFar.box(1.6, 0.059, 0.585, P.counterTop, under(pi, tf(0, 1.296, -0.28)));
  furniture.box(1.56, 0.057, 0.18, P.darkMetal, under(pi, tf(0, 0.855, 0.5)));
  const keyWidth = 1.42 / 24;
  for (let i = 0; i < 24; i++) {
    const keyX = -0.71 + (i + 0.5) * keyWidth;
    furniture.box(keyWidth - 0.004, 0.032, 0.145, P.pianoKeys, under(pi, tf(keyX, 0.893, 0.49)));
    if (i % 7 !== 2 && i % 7 !== 6 && i < 23) furniture.box(keyWidth * 0.53, 0.034, 0.081, P.darkMetal, under(pi, tf(keyX + keyWidth / 2, 0.917, 0.452)));
  }
  brass.box(1.43, 0.017, 0.012, P.brass, under(pi, tf(0, 1.179, 0.007)));
  for (const [lx, lz] of [
    [-0.7, -0.5],
    [0.7, -0.5],
    [0, 0.5],
  ] as const)
    furniture.cyl(0.055, 0.03, 0.69, 8, P.pianoBody, under(pi, tf(lx, 0.345, lz)));

  // 무대: 높이 약 0.28. 가장자리 전구는 지목·변론 때 켜진다.
  furniture.cyl(1.14, 1.17, 0.21, 48, P.stageBody, tf(0, 0.105, 0));
  furniture.cyl(1.17, 1.14, 0.066, 48, P.stageWood, tf(0, 0.243, 0));
  for (const y of [0.055, 0.22]) brass.add(new TorusGeometry(1.147, 0.014, 5, 48), P.brass, tf(0, y, 0, -Math.PI / 2));
  for (const x of [-0.79, -0.53, -0.26, 0, 0.27, 0.54, 0.81]) {
    const length = Math.sqrt(1.14 ** 2 - x ** 2) * 2;
    furniture.add(new PlaneGeometry(0.012, length), P.stageSeam, tf(x, 0.278, 0, -Math.PI / 2));
  }
  for (let r = 0; r < 26; r++) {
    const ra = (r / 26) * Math.PI * 2;
    emVote.add(new SphereGeometry(0.028, 7, 5), P.rimBulb, tf(Math.sin(ra) * 1.15, 0.155, Math.cos(ra) * 1.15), 1.4);
  }
  glow(glowVote, P.stageGlow, 3.2, 0, 0.4, 0, 0.35);
  const mic = tf(-0.45, 0.28, -0.45);
  brass.cyl(0.019, 0.019, 0.99, 8, P.brass, under(mic, tf(0, 0.51, 0)));
  brass.cyl(0.026, 0.026, 0.24, 8, P.brass, under(mic, tf(0, 1.012, 0.064, Math.PI * 0.44)));
  const grille = new SphereGeometry(0.058, 10, 8).scale(1, 1.52, 0.89);
  furniture.add(grille, P.micStand, under(mic, tf(0, 1.041, 0.166, Math.PI * 0.44)));
  furniture.cyl(0.115, 0.152, 0.041, 18, P.micHead, under(mic, tf(0, 0.023, 0)));

  // 서는 자리 8개: 놋쇠 표시만 둔다(표는 화면 겹침 층이 보여 준다)
  for (let i = 0; i < 8; i++) {
    const a = Math.PI / 4 + (i / 8) * Math.PI * 2;
    brass.cyl(0.36, 0.36, 0.02, 24, P.brass, tf(Math.sin(a) * SEAT_RADIUS, 0.011, Math.cos(a) * SEAT_RADIUS));
  }

  // 월넛 원탁과 곡면 등받이 의자. 탁상등은 발광 표면만 써 실제 광원을 늘리지 않는다.
  for (const [x, z] of TABLES) {
    furniture.cyl(0.47, 0.5, 0.075, 24, P.tableTop, tf(x, 0.752, z));
    furniture.cyl(0.46, 0.37, 0.04, 24, P.shelf, tf(x, 0.697, z));
    furniture.cyl(0.064, 0.046, 0.66, 10, P.darkMetal, tf(x, 0.355, z));
    furniture.cyl(0.155, 0.22, 0.068, 16, P.darkMetal, tf(x, 0.038, z));
    brass.add(new TorusGeometry(0.479, 0.007, 4, 24), P.brass, tf(x, 0.761, z, -Math.PI / 2));
    brass.cyl(0.051, 0.07, 0.024, 12, P.brass, tf(x, 0.806, z));
    brass.cyl(0.012, 0.02, 0.151, 8, P.brass, tf(x, 0.892, z));
    emRoom.add(new SphereGeometry(0.146, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), P.lamp, tf(x, 0.968, z), 0.88);
    brass.add(new TorusGeometry(0.142, 0.008, 5, 15), P.brass, tf(x, 0.969, z, -Math.PI / 2));
    // 앞쪽 탁상등의 빛 무리도 높이 1.2 시야 제한 안에 둔다.
    glow(glowRoom, P.lamp, x + z > 4 ? 0.54 : 0.66, x, 0.971, z, 0.46);
    if (omitTableChairsAt?.[0] === x && omitTableChairsAt[1] === z) continue;
    for (let j = 0; j < 2; j++) {
      const a = Math.atan2(x, z) + (j ? Math.PI / 2 : -Math.PI / 2);
      const ch = tf(x + Math.sin(a) * 0.8, 0, z + Math.cos(a) * 0.8, 0, a + Math.PI, 0);
      furniture.add(new CylinderGeometry(0.295, 0.279, 0.075, 16).scale(1, 1, 0.91), P.chairSeat, under(ch, tf(0, 0.425, 0)));
      furniture.add(new SphereGeometry(0.3, 14, 8).scale(1, 0.56, 0.14), P.chairBack, under(ch, tf(0, 0.795, -0.255, -0.17, 0, 0)));
      for (const [lx, lz] of [
        [-0.19, -0.184],
        [0.19, -0.184],
        [-0.19, 0.184],
        [0.19, 0.184],
      ] as const)
        furniture.cyl(0.029, 0.021, 0.42, 6, P.chairBack, under(ch, tf(lx, 0.21, lz, -lz * 0.49, 0, lx * 0.49)));
      for (const side of [-1, 1]) furniture.cyl(0.026, 0.036, 0.44, 8, P.chairBack, under(ch, tf(side * 0.2, 0.62, -0.242, -0.11, 0, 0)));
    }
  }

  // 펜던트 등: 뒤쪽 탁자에만 단다(앞쪽은 캐릭터를 가린다). 줄·갓은 pendants, 전구는 emissive
  for (const [x, z] of [
    [-2.4, -4.6],
    [4.4, -3.2],
  ] as const) {
    pendants.cyl(0.016, 0.016, 0.97, 6, P.darkMetal, tf(x, 3.4, z));
    pendants.add(new SphereGeometry(0.306, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 0.63, 1), P.shade, tf(x, 2.729, z));
    pendants.add(new TorusGeometry(0.292, 0.015, 5, 18), P.brass, tf(x, 2.729, z, -Math.PI / 2));
    emRoomFar.sph(0.08, P.lamp, tf(x, 2.68, z), 1.36);
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
    const backplate = tf(x, 2.2, z, 0, onX ? Math.PI / 2 : 0, 0);
    brass.box(0.22, 0.39, 0.04, P.brass, backplate);
    brass.cyl(0.07, 0.115, 0.075, 10, P.brass, under(backplate, tf(0, -0.114, 0.054)));
    emRoom.add(new SphereGeometry(0.079, 10, 8).scale(1, 1.42, 0.78), P.lamp, under(backplate, tf(0, 0.032, 0.066)), 1.2);
    glow(glowRoom, P.lamp, 1.0, x, 2.2, z, 0.5);
  });
  }

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
  if (matFloor !== null) {
    const wood = floor.build(matFloor, "woodFloor");
    const positions = wood.geometry.getAttribute("position");
    const uv = wood.geometry.getAttribute("uv");
    // 타일 이음새와 무관하게 섬유 방향을 한 축으로 두고, 월드 크기로 반복한다.
    for (let i = 0; i < positions.count; i++) uv.setXY(i, positions.getX(i) / 3.6, positions.getZ(i) / 1.8);
    wood.receiveShadow = true;
    meshes.woodFloor = wood;
    meshes.centerStand = stand.build(matBrass, "centerStand");
    meshes.centerStand.castShadow = meshes.centerStand.receiveShadow = true;
    meshes.centerBulb = bulb.build(matEmRoom, "centerBulb");
    meshes.centerPlatform = platform.build(matProp, "centerPlatform");
    meshes.centerPlatform.castShadow = meshes.centerPlatform.receiveShadow = true;
    meshes.centerPlatformTrim = platformTrim.build(matBrass, "centerPlatformTrim");
  }
  let disposed = false;
  let woodTexture: Texture | null = null;
  const woodReady = matFloor !== null && typeof Image !== "undefined"
    ? new TextureLoader().loadAsync("/maps/noir-oak.webp").then((texture) => {
        if (disposed) {
          texture.dispose();
          return;
        }
        texture.colorSpace = SRGBColorSpace;
        texture.wrapS = texture.wrapT = RepeatWrapping;
        texture.anisotropy = 8;
        matFloor.map = woodTexture = texture;
        matFloor.needsUpdate = true;
      }, () => { /* 기본 월넛 색에서 계속 렌더한다. */ })
    : Promise.resolve();
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
  trialCone.position.set(0, (compact ? BAR_STAGE_HEIGHT : 0.29) + 3.1 / 2, 0);
  trialCone.castShadow = false;
  trialCone.receiveShadow = false;
  trialCone.visible = false;
  trialCone.renderOrder = 2;
  meshes.trialCone = trialCone;
  const matWindowBeam = new MeshBasicMaterial({ color: P.windowBeam, vertexColors: true, transparent: true, blending: AdditiveBlending, depthWrite: false });
  const windowBeam = new Mesh(windowBeamGeometry(compact ? COMPACT_WINDOW : BAR_WINDOW), matWindowBeam);
  windowBeam.name = "windowBeam";
  windowBeam.renderOrder = -1; // 발밑 그림자와 링보다 먼저 합성한다
  meshes.windowBeam = windowBeam;
  // 빛 무리는 투명 합성이라 불투명 메시 뒤에 그린다
  meshes.glowRoom!.renderOrder = 2;
  meshes.glowVote!.renderOrder = 2;
  for (const m of Object.values(meshes)) root.add(m);
  // 색 보정은 맵을 만들 때 한 번 한다. 시간대 변경에는 정점 색 버퍼를 다시 올리지 않는다.
  albedoGrader([meshes.shell!, meshes.furniture!, meshes.furnitureFar!, meshes.pendants!], compact ? [] : [matPlate])(LIGHT_TUNE.talk.albedo);

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
  plate.position.y = compact ? -0.19 : -0.01;
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
  const moon = new DirectionalLight(T.talk.moonColor, T.talk.moon);
  moon.target.position.set(T.moonTarget.x, T.moonTarget.y, T.moonTarget.z);
  moon.position.set(WINDOW_LIGHT.x, WINDOW_LIGHT.y, WINDOW_LIGHT.z);
  moon.castShadow = budget.shadowMap !== 0;
  const shadowSize = budget.shadowMap === 0 ? 1024 : budget.shadowMap;
  moon.shadow.mapSize.set(shadowSize, shadowSize);
  moon.shadow.bias = compact ? -0.00025 : -0.0015;
  if (compact) moon.shadow.normalBias = 0.025;
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
  const stageY = compact ? 1.48 : T.point.stage.y;
  if (compact) pendantA.position.set(-2.75, 2.65, -4.22);
  // 내 캐릭터 빛: 세기 0 으로 처음부터 만든다 — 조명 단계가 바뀌어도 점광원 개수가 변하지 않아 셰이더를 다시 컴파일하지 않는다(연구 Pitfall 7).
  // 예산 core 에서도 visible 을 끄지 않는다(끄면 개수가 변한다)
  const self = point(T.point.self);
  root.add(hemi, moon, moon.target, stage, pendantA, self);

  const background = new Color(T.talk.sky[2]);
  const fog = new Fog(T.talk.sky[2], T.talk.fog.near, T.talk.fog.far);
  root.background = background;
  root.fog = fog;

  let exposure = T.talk.exposure;
  let current = budget;
  const lighting = phaseLighting(T, WINDOW_LIGHT_ACCENTS);
  let tensionLevel: 0 | 1 | 2 = 0;
  let tensionFocus: { x: number; z: number } | null = null;
  // 핀 조명(결정 0066-6): applyLook 이 정한 단계·긴장 값 위에 얹는다. 기본 값은 applyLook 이 매번 채운다
  let pinState: { x: number; z: number; strength: number } | null = null;
  let pinDim = 1;
  let stagePhase = false;
  let centerTable = false;
  const base = { stage: 0, x: T.point.stage.x, z: T.point.stage.z, room: 0, vote: 0 };

  /** 핀 상태를 점광원 위치·세기와 두 발광 색에 반영한다 — 값 몇 개 대입뿐이다(프레임마다 불려도 비용이 없다) */
  const applyPin = (): void => {
    if (pinState === null) {
      stage.intensity = base.stage;
      stage.position.set(base.x, stagePhase ? T.point.stage.y : stageY, base.z);
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
    const t = lighting.current;
    const b = current;
    hemi.color.copy(t.sky[0]);
    hemi.groundColor.copy(t.sky[1]);
    hemi.intensity = t.hemi;
    background.copy(t.sky[2]);
    fog.color.copy(t.sky[2]);
    fog.near = t.fog.near;
    fog.far = t.fog.far;
    moon.intensity = t.moon;
    moon.color.copy(t.moonColor);
    self.intensity = t.self;
    // 긴장 1·2: 무대 점광원이 초점 위로 옮겨 선두 세기(초점이 없으면 무대 중앙). 0: 단계 값과 무대 중앙
    const lead = tensionLevel >= 1;
    base.stage = lead ? T.tension.lead : t.stage * (compact && !stagePhase ? 1.72 : 1);
    if (lead && tensionFocus) {
      base.x = tensionFocus.x;
      base.z = tensionFocus.z;
    } else {
      base.x = T.point.stage.x;
      base.z = T.point.stage.z;
    }
    // 점광원 core: 대표 펜던트만 끈다. 무대등과 플레이어 조명은 재사용한다.
    const pendant = b.lights === "full" ? t.pendant : 0;
    pendantA.intensity = pendant;
    pendantA.visible = b.lights === "full";
    base.room = t.emissive.room * (tensionLevel === 2 ? T.tension.halfRoom : 1);
    base.vote = t.emissive.vote;
    applyPin();
    matGlowRoom.opacity = t.glow.room;
    matGlowVote.opacity = t.glow.vote;
    meshes.glowRoom!.visible = b.glows && t.glow.room > 0;
    meshes.glowVote!.visible = !centerTable && b.glows && t.glow.vote > 0;
    matCone.opacity = t.cone;
    trialCone.visible = b.glows && t.cone > 0;
    matWindowBeam.opacity = t.beam;
    windowBeam.visible = b.glows && t.beam > 0;
    root.fog = b.fog ? fog : null;
    exposure = t.exposure;
  };
  const syncCenter = (): void => {
    if (meshes.centerStand && meshes.centerBulb) {
      meshes.centerStand.visible = !centerTable && !stagePhase;
      meshes.centerBulb.visible = !centerTable && !stagePhase;
      meshes.centerPlatform!.visible = !centerTable;
      meshes.centerPlatformTrim!.visible = !centerTable;
      meshes.emissiveVote!.visible = !centerTable;
    }
  };
  const setLighting = (next: LightingPhase, seconds = 0): void => {
    stagePhase = next === "trial";
    syncCenter();
    lighting.set(next, seconds);
    applyLook();
  };
  const update = (dt: number): void => {
    if (!disposed && lighting.advance(dt)) applyLook();
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
    applyLook();
  };
  applyBudget(budget);

  return {
    root,
    lights: { hemi, moon, stage, pendantA, self },
    meshes,
    markers,
    plate,
    woodReady,
    setCenterTable(on) {
      if (centerTable === on) return;
      centerTable = on;
      syncCenter();
      applyLook();
    },
    get exposure(): number {
      return exposure;
    },
    setLighting,
    update,
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
      woodTexture?.dispose();
      moon.shadow.map?.dispose();
    },
  };
}
