// "의심" 포스트잇 3D 에셋 (결정 0089-11, 24페이즈 D-11·D-12·D-28, UI-SPEC P24-10~18).
// 캐릭터 몸(body 그룹)의 자식인 평면 메시 한 장 — 가슴 옆에 몸통 원통을 따라 휘어 붙고, 붙인 사람 좌석별 고정 각도로 살짝 기울며 우하단 모서리가 들려 있다.
// 이 파일은 three 를 값으로 쓰므로 동적으로 불러오는 캐릭터 모듈(character.ts)만 import 한다 — runtime.ts 는 three 를 값으로 부르지 않는다(결정 0090-14).
// 상수(크기·자리)는 이 파일 한 곳에만 둔다. 24-10 이 390×844 스크린샷으로 NOTE_SIZE 0.34~0.36·NOTE_CENTER.y 0.52~0.56 중 최종값을 정한다(D-28).
import { BufferGeometry, CanvasTexture, Color, DataTexture, Float32BufferAttribute, Mesh, MeshStandardMaterial, type Object3D, RGBAFormat, SRGBColorSpace, type Texture, UnsignedByteType } from "three";
import { NOTE_MAX_VISIBLE } from "../../shared/game/postit";
import { NOTE_COLORS, SEAT_COLORS } from "./palette";

// ---------- 상수 ----------

/** 안쪽 종이 한 변(월드 단위, 몸 좌표). UI-SPEC 의 0.32 는 CHAR_SCALE 0.83 을 빠뜨려 과대라 0.36 으로 시작한다(14px 규칙: 0.36 × 0.83 × 58.2 × 0.81 ≈ 14.1px) */
export const NOTE_SIZE = 0.36;
/**
 * 종이 중심의 몸 좌표(코트 표면 위, 가슴 왼쪽 아래). 계획의 시작값 (−0.15, 0.54)는 기울기 ±9° 일 때 윗 모서리가 넥타이·옷깃 아랫끝(y 0.72~0.746)과 겹쳐(0.36 크기 기준 단위 시험이 잡았다)
 * 좌우로 0.03, 아래로 0.03 옮겼다. 24-10 이 스크린샷으로 x −0.19~−0.17·y 0.50~0.52 안에서 확정한다(그 밖은 noteBoxes 시험이 막는다).
 */
export const NOTE_CENTER = { x: -0.18, y: 0.51 } as const;
/** 붙인 사람 좌석(0~7)별 고정 기울기(도, 시계 반대 +). 같은 사람이 매번 같은 각도라 읽는 눈에 일관 */
export const NOTE_ROLL_DEG = [-8, 6, -3, 9, -5, 4, -9, 7] as const;
/** 우하단 안쪽 모서리 한 점이 표면에서 떠 있는 높이 */
export const NOTE_LIFT = 0.025;
/** 쌓기 한 층의 어긋남: x 는 몸통 표면을 따라 잰 호 길이, y 는 몸 좌표 높이, z 는 표면에서 앞으로 더 뜨는 높이(겹침 깜빡임 방지) */
export const NOTE_STACK_STEP = { x: 0.03, y: -0.035, z: 0.004 } as const;
/** 몸통 표면에서 종이를 띄우는 높이(코트 원통 반지름 r(y) 에 더한다) */
export const NOTE_STANDOFF = 0.012;
/** 텍스처 한 변(px)과 그 안쪽 종이 한 변(px) — 바깥 여백이 그림자 자리다 */
export const NOTE_TEX = 128;
export const NOTE_INNER_PX = 100;
/** 그리는 판 한 변: 안쪽 종이(NOTE_SIZE)가 텍스처의 NOTE_INNER_PX/NOTE_TEX 가 되도록 키운다 */
export const NOTE_QUAD = (NOTE_SIZE * NOTE_TEX) / NOTE_INNER_PX;
/** 접힌 모서리 크기(텍스처 px, 안쪽 종이의 18%) */
const FOLD_PX = 18;
/** 붙음: 위 0.25·크기 1.4배에서 280ms ease-out. 떨어짐: 600ms ease-in, 마지막 150ms 에 크기 0, 여러 장은 80ms 간격(P24-15) */
export const NOTE_STICK_MS = 280;
export const NOTE_STICK_FROM = { rise: 0.25, scale: 1.4 } as const;
export const NOTE_FALL_MS = 600;
export const NOTE_FALL_SHRINK_MS = 150;
export const NOTE_FALL_GAP_MS = 80;
/** 떨어지는 동안 종이가 몸통 밖으로 밀려나는 거리(바닥에서 발치에 눕는다) */
const NOTE_FALL_OUT = 0.25;
/** 바닥 높이 기본값 — 월드 y 0.02 를 CHAR_SCALE 0.83 으로 나눈 몸 좌표. 캐릭터가 CHAR_SCALE 로 환산해 넘긴다 */
const DEFAULT_FLOOR_Y = 0.02 / 0.83;

/**
 * 몸통 코트 원통의 반지름 — character.ts 의 `CylinderGeometry(0.29, 0.39, 0.6)` 가 y 0.36~0.96 에 있다.
 * y < 0.36 은 아래 반구(실제 중심 y 0.38)를 이음새 없이 중심 y 0.36 의 반지름 0.39 원호로 근사한다(차이 0.004 이하, 띄움 0.012 안쪽).
 */
export function coatRadius(y: number): number {
  if (y >= 0.36) return 0.39 - (0.1 * (y - 0.36)) / 0.6;
  return Math.sqrt(Math.max(0.39 * 0.39 - (y - 0.36) * (y - 0.36), 0.04));
}

const wrapSeat = (seat: number): number => ((Math.trunc(seat) % 8) + 8) % 8;
const rollRad = (seat: number): number => (NOTE_ROLL_DEG[wrapSeat(seat)] * Math.PI) / 180;

// ---------- 색 ----------

const hexByte = (n: number): string => Math.round(n).toString(16).padStart(2, "0");
const chan = (hex: string, i: number): number => Number.parseInt(hex.slice(1 + 2 * i, 3 + 2 * i), 16);
/** a 와 b 를 sRGB 채널별로 t(0~1)만큼 섞는다(t = b 의 몫). 결과는 실행 중에 만든 #rrggbb 이다 */
function mixHex(a: string, b: string, t: number): string {
  const c = (i: number): string => hexByte(chan(a, i) * (1 - t) + chan(b, i) * t);
  return `#${c(0)}${c(1)}${c(2)}`;
}
const rgba = (hex: string, a: number): string => `rgba(${chan(hex, 0)},${chan(hex, 1)},${chan(hex, 2)},${a})`;

/** 붉은 종이를 기본으로 하고 붙인 사람의 좌석색을 조금 남긴다. */
export function noteTint(seat: number): string {
  return mixHex(SEAT_COLORS[wrapSeat(seat)], NOTE_COLORS.tint, 0.82);
}

// ---------- 몸통 원통에 감기 ----------

/**
 * 종이 평면의 점 (u, v) — 종이 중심에서 잰 호 길이 u 와 높이 v — 를 코트 표면 반지름 r(y)+NOTE_STANDOFF 에 감아 종이 중심을 원점으로 한 국소 좌표로 돌려준다.
 * 국소 z 축 = 중심의 바깥 방향. lifted 면 그 점만 표면에서 NOTE_LIFT 띄운다.
 */
function wrapPoint(u: number, v: number, lifted: boolean): [number, number, number] {
  const r0 = coatRadius(NOTE_CENTER.y) + NOTE_STANDOFF;
  const rv = coatRadius(NOTE_CENTER.y + v) + NOTE_STANDOFF + (lifted ? NOTE_LIFT : 0);
  const phi = u / (coatRadius(NOTE_CENTER.y + v) + NOTE_STANDOFF);
  return [rv * Math.sin(phi), v, rv * Math.cos(phi) - r0];
}

/** 격자선(종이 중심 기준): 바깥 여백 | 안쪽 종이 가장자리 | 안쪽 4등분 */
function gridLines(): number[] {
  const h = NOTE_SIZE / 2;
  const q = NOTE_QUAD / 2;
  return [-q, -h, -h / 2, 0, h / 2, h, q];
}

/** 모든 종이가 공유하는 지오메트리 하나: 7×7 정점, 안쪽 종이 우하단 모서리 정점 하나가 들려 있다 */
function buildNoteGeometry(): BufferGeometry {
  const lines = gridLines();
  const n = lines.length;
  const q = NOTE_QUAD;
  const pos: number[] = [];
  const uv: number[] = [];
  for (let j = 0; j < n; j++) {
    const v = lines[n - 1 - j]; // 위(+)에서 아래(−)로
    for (let i = 0; i < n; i++) {
      const u = lines[i];
      const lifted = i === 5 && j === 5; // (u = +NOTE_SIZE/2, v = −NOTE_SIZE/2)
      pos.push(...wrapPoint(u, v, lifted));
      uv.push((u + q / 2) / q, (v + q / 2) / q);
    }
  }
  const index: number[] = [];
  for (let j = 0; j < n - 1; j++) {
    for (let i = 0; i < n - 1; i++) {
      const a = j * n + i;
      const b = (j + 1) * n + i;
      const c = (j + 1) * n + i + 1;
      const d = j * n + i + 1;
      index.push(a, b, d, b, c, d);
    }
  }
  const g = new BufferGeometry();
  g.setAttribute("position", new Float32BufferAttribute(pos, 3));
  g.setAttribute("uv", new Float32BufferAttribute(uv, 2));
  g.setIndex(index);
  g.computeVertexNormals();
  g.computeBoundingSphere();
  return g;
}

// ---------- 놓는 자리 ----------

export interface NotePlacement {
  /** 종이 중심 점(국소 원점)의 몸 좌표 */
  position: { x: number; y: number; z: number };
  /** 몸 y 축 둘레 방향(라디안, 0 = 정면 +z) */
  yaw: number;
  /** 종이 면 안 기울기(라디안) */
  roll: number;
  /** 중심 점의 축에서 거리 */
  radius: number;
}

/**
 * 층 layer(0 = 맨 아래 장)·붙인 좌석의 종이 자리. 층마다 몸통 표면을 따라 오른쪽(+x 호 길이)·아래(+y)로 어긋나고 표면에서 앞으로 더 뜬다.
 * 몸통이 아래로 갈수록 굵어지므로 표면 따라 어긋나면 층의 반지름이 늘고, 거기에 NOTE_STACK_STEP.z 가 더해진다.
 */
export function notePlacement(layer: number, seat: number): NotePlacement {
  const y = NOTE_CENTER.y + NOTE_STACK_STEP.y * layer;
  const radius = coatRadius(y) + NOTE_STANDOFF + NOTE_STACK_STEP.z * layer;
  const yaw0 = Math.asin(NOTE_CENTER.x / (coatRadius(NOTE_CENTER.y) + NOTE_STANDOFF));
  const yaw = yaw0 + (NOTE_STACK_STEP.x * layer) / radius;
  return { position: { x: radius * Math.sin(yaw), y, z: radius * Math.cos(yaw) }, yaw, roll: rollRad(seat), radius };
}

export interface NoteBox {
  /** 안쪽 종이 네 모서리의 몸 좌표 xy 투영(왼아래·오른아래·오른위·왼위, 시계 반대) */
  polygon: [number, number][];
  min: [number, number];
  max: [number, number];
  center: [number, number];
  angle: number;
  radius: number;
}

/** 시험·24-10 크기 판단용: 층 layer·붙인 좌석 종이의 몸 좌표 상자(앞에서 본 투영) */
export function noteBoxes(layer: number, fromSeat: number): NoteBox {
  const pl = notePlacement(layer, fromSeat);
  const h = NOTE_SIZE / 2;
  const cosR = Math.cos(pl.roll);
  const sinR = Math.sin(pl.roll);
  const cosY = Math.cos(pl.yaw);
  const sinY = Math.sin(pl.yaw);
  const corner = (u: number, v: number, lifted: boolean): [number, number] => {
    const [lx, ly, lz] = wrapPoint(u, v, lifted);
    const rx = lx * cosR - ly * sinR;
    const ry = lx * sinR + ly * cosR;
    return [pl.position.x + rx * cosY + lz * sinY, pl.position.y + ry];
  };
  const polygon: [number, number][] = [corner(-h, -h, false), corner(h, -h, true), corner(h, h, false), corner(-h, h, false)];
  const xs = polygon.map((p) => p[0]);
  const ys = polygon.map((p) => p[1]);
  return { polygon, min: [Math.min(...xs), Math.min(...ys)], max: [Math.max(...xs), Math.max(...ys)], center: [pl.position.x, pl.position.y], angle: pl.yaw, radius: pl.radius };
}

// ---------- 텍스처 굽기(주입식) ----------

/** 굽기에 쓰는 2D 컨텍스트의 일부(CanvasRenderingContext2D 가 구조적으로 맞는다). 시험은 가짜 기록기를 넣는다 */
export interface Note2D {
  fillStyle: unknown;
  strokeStyle: unknown;
  lineWidth: number;
  lineCap: string;
  font: string;
  textAlign: string;
  textBaseline: string;
  shadowColor: string;
  shadowBlur: number;
  shadowOffsetX: number;
  shadowOffsetY: number;
  save(): void;
  restore(): void;
  translate(x: number, y: number): void;
  rotate(angle: number): void;
  clearRect(x: number, y: number, w: number, h: number): void;
  beginPath(): void;
  moveTo(x: number, y: number): void;
  lineTo(x: number, y: number): void;
  quadraticCurveTo(cx: number, cy: number, x: number, y: number): void;
  closePath(): void;
  fill(): void;
  stroke(): void;
  createLinearGradient(x0: number, y0: number, x1: number, y1: number): { addColorStop(offset: number, color: string): void };
  fillText(text: string, x: number, y: number): void;
}

/**
 * happy-dom·node 에는 canvas 2D 가 없다 — 굽기는 환경을 주입받는다.
 * makeCanvas 가 null 이면 1×1 종이색 텍스처로 대신한다. loadFont 는 손글씨 글꼴이 준비됐는지(true) 알린다.
 * fontLate(선택)는 loadFont 가 거짓이었을 때 글꼴이 나중에 오는지 알려, 오면 한 번 다시 굽게 한다.
 */
export interface NoteBakeEnv {
  makeCanvas(w: number, h: number): { canvas: unknown; ctx: Note2D | null } | null;
  loadFont(): Promise<boolean>;
  fontLate?(): Promise<boolean>;
}

const PEN_FONT = '44px "Nanum Pen Script", cursive';
const FALLBACK_FONT = "700 40px system-ui, sans-serif";

function bakePaper(ctx: Note2D, penFont: boolean): void {
  const { paper, ink } = NOTE_COLORS;
  const o = (NOTE_TEX - NOTE_INNER_PX) / 2;
  const p = NOTE_INNER_PX;
  const shape = (): void => {
    ctx.beginPath();
    ctx.moveTo(o, o);
    ctx.lineTo(o + p, o);
    ctx.lineTo(o + p, o + p - FOLD_PX);
    ctx.lineTo(o + p - FOLD_PX, o + p);
    ctx.lineTo(o, o + p);
    ctx.closePath();
  };
  ctx.clearRect(0, 0, NOTE_TEX, NOTE_TEX);
  // 옅은 그림자: 종이 모양을 (2,3) 밀어 번지게 — 투명 여백 안
  ctx.save();
  ctx.shadowColor = rgba(ink, 0.3);
  ctx.shadowBlur = 6;
  ctx.shadowOffsetX = 2;
  ctx.shadowOffsetY = 3;
  ctx.fillStyle = paper;
  shape();
  ctx.fill();
  ctx.restore();
  // 종이: 위에서 아래로 연한 밝기차
  const grad = ctx.createLinearGradient(0, o, 0, o + p);
  grad.addColorStop(0, paper);
  grad.addColorStop(1, mixHex(paper, ink, 0.08));
  ctx.fillStyle = grad;
  shape();
  ctx.fill();
  // 접힌 모서리: 조금 어두운 면 + 밝은 가장자리
  ctx.fillStyle = mixHex(paper, ink, 0.22);
  ctx.beginPath();
  ctx.moveTo(o + p, o + p - FOLD_PX);
  ctx.lineTo(o + p - FOLD_PX, o + p);
  ctx.lineTo(o + p - FOLD_PX, o + p - FOLD_PX);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = rgba(paper, 0.9);
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(o + p, o + p - FOLD_PX);
  ctx.lineTo(o + p - FOLD_PX, o + p);
  ctx.stroke();
  // 손글씨 "의심"(−3° 기울임)
  ctx.save();
  ctx.translate(NOTE_TEX / 2, NOTE_TEX / 2 - 4);
  ctx.rotate((-3 * Math.PI) / 180);
  ctx.font = penFont ? PEN_FONT : FALLBACK_FONT;
  ctx.fillStyle = ink;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("의심", 0, 0);
  ctx.restore();
  // 글 아래 짧은 밑줄 한 획
  ctx.save();
  ctx.strokeStyle = ink;
  ctx.lineWidth = 3;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(40, 90);
  ctx.quadraticCurveTo(64, 86, 88, 91);
  ctx.stroke();
  ctx.restore();
}

// ---------- 종이 키트 ----------

export interface NoteKit {
  /** 모든 종이가 공유하는 지오메트리 하나 */
  readonly geometry: BufferGeometry;
  /** 모든 종이가 공유하는 텍스처 한 장(굽기가 안 되면 1×1 종이색) */
  readonly texture: Texture;
  /** 좌석 0~7 의 재질(캐시, 최대 8개) — 조명을 받는 재질이라 밤에 혼자 빛나지 않는다 */
  materialFor(seat: number): MeshStandardMaterial;
  materialCount(): number;
  /** 글꼴 시도와 첫 굽기가 끝나면 이행한다 */
  readonly ready: Promise<void>;
  /** 캔버스에 실제로 구웠나(거짓 = 1×1 종이색 대체) */
  readonly baked: boolean;
  /** 손글씨 글꼴이 나중에 왔을 때 같은 텍스처 객체를 한 번만 다시 굽는다(이미 글꼴로 구웠으면 아무 일 없음) */
  rebake(): void;
  /** 공유 지오메트리·텍스처·재질을 해제한다(캐릭터 dispose 는 부르지 않는다 — 키트는 모든 캐릭터가 공유한다) */
  dispose(): void;
}

export function createNoteKit(env: NoteBakeEnv): NoteKit {
  const geometry = buildNoteGeometry();
  const made = env.makeCanvas(NOTE_TEX, NOTE_TEX);
  const ctx = made?.ctx ?? null;
  let texture: Texture;
  if (made && ctx) {
    texture = new CanvasTexture(made.canvas as HTMLCanvasElement);
  } else {
    const data = new Uint8Array([chan(NOTE_COLORS.paper, 0), chan(NOTE_COLORS.paper, 1), chan(NOTE_COLORS.paper, 2), 255]);
    texture = new DataTexture(data, 1, 1, RGBAFormat, UnsignedByteType);
    texture.needsUpdate = true;
  }
  texture.colorSpace = SRGBColorSpace;

  let baked = false;
  let penFont = false;
  const bake = (): void => {
    if (!ctx) return;
    bakePaper(ctx, penFont);
    texture.needsUpdate = true;
    baked = true;
  };
  const rebake = (): void => {
    if (!ctx || penFont) return;
    penFont = true;
    if (baked) bake();
  };
  const run = async (): Promise<void> => {
    let ok = false;
    try {
      ok = await env.loadFont();
    } catch {
      ok = false;
    }
    if (ok) penFont = true;
    bake();
    if (!penFont && env.fontLate) {
      env.fontLate().then(
        (late) => {
          if (late) rebake();
        },
        () => {},
      );
    }
  };
  const ready = ctx ? run() : Promise.resolve();

  const materials: (MeshStandardMaterial | undefined)[] = [];
  return {
    geometry,
    texture,
    materialFor(seat) {
      const s = wrapSeat(seat);
      let m = materials[s];
      if (!m) {
        m = new MeshStandardMaterial({ map: texture, color: new Color(noteTint(s)), roughness: 0.9, metalness: 0, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 });
        m.name = `note-${s}`;
        materials[s] = m;
      }
      return m;
    },
    materialCount() {
      return materials.filter(Boolean).length;
    },
    ready,
    get baked() {
      return baked;
    },
    rebake,
    dispose() {
      geometry.dispose();
      texture.dispose();
      for (const m of materials) m?.dispose();
      materials.length = 0;
    },
  };
}

// ---------- 제품용 키트 ----------

const FONT_LOAD_SPEC = '44px "Nanum Pen Script"';
/** 글꼴을 기다리는 가장 긴 시간(ms) — 넘으면 기본 글꼴로 먼저 굽고 글꼴이 오면 한 번 다시 굽는다 */
const FONT_WAIT_MS = 1500;

function browserEnv(): NoteBakeEnv {
  const load = (): Promise<boolean> => {
    const fonts = typeof document === "undefined" ? undefined : document.fonts;
    if (!fonts) return Promise.resolve(false);
    // 글자를 넘겨야 unicode-range 조각(한글)을 받는다
    return fonts.load(FONT_LOAD_SPEC, "의심").then(
      (faces) => faces.length > 0,
      () => false,
    );
  };
  return {
    makeCanvas(w, h) {
      if (typeof document === "undefined") return null;
      try {
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        return ctx ? { canvas, ctx: ctx as unknown as Note2D } : null;
      } catch {
        return null;
      }
    },
    loadFont() {
      return Promise.race([load(), new Promise<boolean>((resolve) => setTimeout(() => resolve(false), FONT_WAIT_MS))]);
    },
    fontLate: load,
  };
}

let shared: NoteKit | null = null;
/** 모든 캐릭터가 함께 쓰는 종이 키트(처음 부를 때 만든다) */
export function noteKit(): NoteKit {
  if (!shared) shared = createNoteKit(browserEnv());
  return shared;
}
/** 장면을 통째로 걷을 때만 부른다(키트를 해제하고 다음 noteKit() 이 새로 만든다) */
export function disposeNoteKit(): void {
  shared?.dispose();
  shared = null;
}

// ---------- 리그: 쌓기·붙음·떨어짐 ----------

export interface NoteRig {
  /**
   * 이 사람이 받은 종이(붙인 좌석 목록, 오래된 것부터)를 맞춘다. 맨 위 NOTE_MAX_VISIBLE 장만 메시로 보인다(P24-14).
   * animate 가 참이면 새 장은 붙음 모션, 목록이 비면 떨어짐(80ms 간격)이고 한 장씩 사라지거나 옮겨 가는 것은 옛 종이가 즉시 사라진다.
   * animate 거짓(처음 받은 프레임·모션 줄이기)이면 모션 없이 최종 상태다.
   */
  set(fromSeats: readonly number[], opts: { animate: boolean }): void;
  /** 모션을 dtMs 만큼 진행한다 — 시각을 직접 읽지 않고 받은 값으로만 */
  update(dtMs: number): void;
  /** 모션 없이 종이를 모두 뗀다(유령이 되는 순간, P24-17) */
  clear(): void;
  /** 메시만 뗀다. 공유 지오메트리·텍스처·재질은 모든 캐릭터가 함께 쓰므로 해제하지 않는다. 이후 set 은 무시된다 */
  detach(): void;
  /** total = 받은 종이 수, visible = 지금 붙어 있는(떨어지는 중 포함) 메시 수 */
  counts(): { total: number; visible: number };
}

interface NoteEntry {
  seat: number;
  layer: number;
  mesh: Mesh;
  phase: "in" | "rest" | "out";
  /** 모션 경과(ms). 음수 = 떨어짐 시작 전 대기 */
  t: number;
}

const clamp01 = (x: number): number => Math.min(1, Math.max(0, x));

export function createNoteRig(kit: NoteKit, parent: Object3D, opts?: { floorY?: number }): NoteRig {
  const floorY = opts?.floorY ?? DEFAULT_FLOOR_Y;
  let stack: NoteEntry[] = [];
  let falling: NoteEntry[] = [];
  let total = 0;
  let detached = false;

  /** 지금 단계·경과에 맞는 자세를 메시에 쓴다 */
  function place(e: NoteEntry): void {
    const pl = notePlacement(e.layer, e.seat);
    const m = e.mesh;
    m.rotation.order = "YXZ";
    let y = pl.position.y;
    let radius = pl.radius;
    let tilt = 0;
    let scale = 1;
    if (e.phase === "in") {
      const k = 1 - (1 - clamp01(e.t / NOTE_STICK_MS)) ** 3; // ease-out
      y += NOTE_STICK_FROM.rise * (1 - k);
      scale = 1 + (NOTE_STICK_FROM.scale - 1) * (1 - k);
    } else if (e.phase === "out" && e.t > 0) {
      const u = clamp01(e.t / NOTE_FALL_MS);
      const k = u * u; // ease-in
      y = pl.position.y + (floorY - pl.position.y) * k;
      radius += NOTE_FALL_OUT * k;
      tilt = -(Math.PI / 2) * k; // 위를 보고 눕는다
      const shrinkFrom = NOTE_FALL_MS - NOTE_FALL_SHRINK_MS;
      if (e.t > shrinkFrom) scale = Math.max(0, 1 - (e.t - shrinkFrom) / NOTE_FALL_SHRINK_MS);
    }
    m.position.set(radius * Math.sin(pl.yaw), y, radius * Math.cos(pl.yaw));
    m.rotation.set(tilt, pl.yaw, pl.roll);
    m.scale.setScalar(scale);
  }
  function spawn(seat: number, layer: number, phase: NoteEntry["phase"]): NoteEntry {
    const mesh = new Mesh(kit.geometry, kit.materialFor(seat));
    mesh.name = "note";
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    mesh.raycast = () => {}; // 종이는 눌리지 않는다(이름표·땅 탭이 이긴다)
    parent.add(mesh);
    const e: NoteEntry = { seat, layer, mesh, phase, t: 0 };
    place(e);
    return e;
  }
  function drop(list: NoteEntry[]): void {
    for (const e of list) parent.remove(e.mesh);
    list.length = 0;
  }

  return {
    set(fromSeats, opts2) {
      if (detached) return;
      total = fromSeats.length;
      const vis = fromSeats.slice(-NOTE_MAX_VISIBLE);
      if (!opts2.animate) {
        drop(stack);
        drop(falling);
        stack = vis.map((seat, layer) => spawn(seat, layer, "rest"));
        return;
      }
      // 같은 좌석의 종이는 그대로 두고(층만 다시 맞춘다), 새 좌석은 붙음, 사라진 좌석은 즉시 없어지거나(떨어짐은 목록이 빌 때만)
      const pool = new Map<number, NoteEntry[]>();
      for (const e of stack) pool.set(e.seat, [...(pool.get(e.seat) ?? []), e]);
      const next: NoteEntry[] = [];
      vis.forEach((seat, layer) => {
        const e = pool.get(seat)?.shift();
        if (e) {
          e.layer = layer;
          place(e);
          next.push(e);
        } else next.push(spawn(seat, layer, "in"));
      });
      const gone = stack.filter((e) => !next.includes(e));
      if (vis.length === 0 && gone.length > 0) {
        gone.forEach((e, i) => {
          e.phase = "out";
          e.t = -NOTE_FALL_GAP_MS * i;
          place(e);
          falling.push(e);
        });
      } else drop(gone);
      stack = next;
    },
    update(dtMs) {
      if (stack.length === 0 && falling.length === 0) return;
      for (const e of stack) {
        if (e.phase !== "in") continue;
        e.t += dtMs;
        if (e.t >= NOTE_STICK_MS) e.phase = "rest";
        place(e);
      }
      const done: NoteEntry[] = [];
      for (const e of falling) {
        e.t += dtMs;
        if (e.t >= NOTE_FALL_MS) done.push(e);
        else place(e);
      }
      if (done.length > 0) {
        for (const e of done) parent.remove(e.mesh);
        falling = falling.filter((e) => !done.includes(e));
      }
    },
    clear() {
      drop(stack);
      drop(falling);
      total = 0;
    },
    detach() {
      drop(stack);
      drop(falling);
      total = 0;
      detached = true;
    },
    counts() {
      return { total, visible: stack.length + falling.length };
    },
  };
}
