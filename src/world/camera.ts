// 정사영 카메라 수학(순수). three 를 import 하지 않는다 — 렌더러(06-10)가 같은 상수로 three 카메라를 만들고,
// 그쪽 Vector3.project 가 이 모듈의 groundToScreen 과 같은 값임을 테스트로 증명한다.
//
// 좌표: 월드 x·z 는 바닥, y 는 위. 화면 sx 는 오른쪽, sy 는 아래쪽(CSS 픽셀).
// 카메라 = 목표 + (sin(yaw)·17, 12.5, cos(yaw)·17), 주시점 = (목표.x, 0.6, 목표.z), 정사영, 배율 PX_PER_UNIT.
// 배율은 PX_PER_UNIT × zoom(zoom 은 지목 과반 연출의 확대 1.08, 생략하면 1 — 화면 가운데(오프셋 반영)에서 거리가 zoom 배가 된다).
// 클라이언트 전용이라 삼각함수를 써도 된다(shared 의 서버 판정 모듈 규칙은 여기 적용되지 않는다).

import { ringSlots, RING_RADIUS_FX } from "../../shared/game/gather";
import { BAR_SEAT_HEIGHT, BAR_SEATS_FX, HEAD_TOP_Y, STAGE_SPOT, UNIT } from "../../shared/game/map";
import { lobbyPanelHeight, LOG_H, TYPING_PILL_H } from "../game/chatUi";

export interface V3 {
  x: number;
  y: number;
  z: number;
}
export interface Canvas {
  w: number;
  h: number;
}

/** 화면 배율(px/월드 단위). 폰 크기와 무관한 고정값 = 844 ÷ view 14.5 (승인 보드 390×844). 프러스텀 높이 = 캔버스 높이 ÷ 58.2 */
export const PX_PER_UNIT = 58.2;
/** 카메라 방위(라디안) */
export const CAM_YAW = Math.PI / 4;
/** 카메라가 목표에서 수평으로 떨어진 거리 */
export const CAM_DIST = 17;
/** 카메라 높이 */
export const CAM_HEIGHT = 12.5;
/** 주시점 높이(캐릭터 몸 가운데쯤) */
export const LOOK_Y = 0.6;
/** 내 캐릭터가 아직 없을 때의 카메라 목표 */
export const DEFAULT_TARGET: Readonly<{ x: number; z: number }> = { x: -0.4, z: -0.4 };
/** 따라가기 감쇠 시간 상수(ms): 350ms 에 거리의 90% 를 줄인다 → τ = 350 / ln 10 ≈ 152 */
export const FOLLOW_TAU_MS = 350 / Math.LN10;
/** 크기 변화(주소창 접힘 등) 뒤 카메라 중심을 다시 맞추는 시간(ms) = dur-fast */
export const RESIZE_SETTLE_MS = 180;
/** 스테이지 사각형 위 끝 = 헤더 블록 아래 끝(px) */
export const HEADER_BOTTOM = 62;
/** DOM 을 재기 전의 기본 아래 패널 높이(px, 안전 영역 제외) = 로비 채팅 패널 LOG_H + 92 (LOG_H 68 → 160). 로비는 패널을 DOM 에서 재서 넘기므로 이 값은 측정 전·측정 불가 환경에서만 쓴다 */
export const PANEL_HEIGHT = lobbyPanelHeight(LOG_H);
/** 이름표 상자 최대 폭(가정 A1: 전각 8자 + " (나)" + 점·여백). 06-12 E2E 가 실제 폭을 재서 넘으면 고친다 */
export const NAMETAG_MAX_W = 180;
/** 이름표 상자 높이(px) */
export const NAMETAG_H = 24;
/** 이름표 상자 아래 끝과 머리 꼭대기 사이 간격(px) */
export const NAMETAG_GAP = 4;
/** 머리 위 쌓임 전체 높이(px) = 이름표 24 + 입력 중 칸 22(알약 18 + 이름표와 간격 4, 07-18). 가시성 검사는 늘 입력 중 칸이 있다고 보고 돈다(가장 불리한 경우) */
export const HEAD_STACK_H = NAMETAG_H + TYPING_PILL_H;
/**
 * 따라가기 카메라의 공통 이동 한계. 폰 6종의 걷는 영역을 0.25 간격으로 검사해 발과 이름표·입력 중 칸이 보이는 최소 반폭을 정한다.
 * 짧은 화면은 채팅 영역을 줄여 맵을 확보한다. 360×560에서 기록 116px일 때 필요한 반폭은 ±5.7이다.
 */
export const PAN_BOX: Readonly<{ minX: number; maxX: number; minZ: number; maxZ: number }> = { minX: -5.7, maxX: 5.7, minZ: -5.7, maxZ: 5.7 };
/**
 * 두 맵의 연장 바닥 판 반폭. 공통 이동 한계의 9개 카메라 목표에서 가장 넓은 대기실 스테이지(430×932, 패널 160px)의
 * 바닥 표본이 닿는 거리를 0.5 단위로 올린 16.5에 헤더 뒤쪽 여유 2를 더한다.
 */
export const PLATE_FAR = 18.5;

/** 모이는 자리 가운데(월드 단위) = 무대 자리. 지목·변론·찬반·처형 단계의 카메라 고정 목표다(08-08, UI-SPEC 카메라 표) */
export const GATHER_CENTER: Readonly<{ x: number; z: number }> = { x: STAGE_SPOT.x / UNIT, z: STAGE_SPOT.z / UNIT };
/** 지목 과반 연출의 확대 배율(8% 다가감, UI-SPEC 카메라 표) */
export const ZOOM_MAJORITY = 1.08;
/** 과반 확대는 스테이지 높이(px)가 이 값 이상일 때만 한다. 모자라면 확대 없이 실내등과 도장만(UI-SPEC 카메라 표) */
export const ZOOM_MIN_STAGE_H = 360;

/** UI-SPEC 의 폰 크기(폰 폭×높이). 스테이지 사각형은 stageRect 로 구한다 */
export const STAGE_SIZES: readonly { w: number; h: number; label: string }[] = [
  { w: 360, h: 640, label: "360x640" },
  { w: 390, h: 664, label: "390x664" },
  { w: 430, h: 932, label: "430x932" },
  { w: 360, h: 560, label: "360x560" },
  { w: 390, h: 844, label: "390x844" },
  { w: 402, h: 874, label: "402x874" },
];

export interface CameraRig {
  readonly yaw: number;
  readonly dist: number;
  readonly height: number;
  readonly lookY: number;
  readonly span?: number;
  readonly maxScale?: number;
}

export const DEFAULT_CAMERA: CameraRig = { yaw: CAM_YAW, dist: CAM_DIST, height: CAM_HEIGHT, lookY: LOOK_Y };
export const BAR_TABLE_CAMERA: CameraRig = {
  yaw: 0.34, dist: 13, height: 1.14 + Math.tan(26 * Math.PI / 180) * 13, lookY: 1.14, span: 4.52,
};
export const BAR_WALK_CAMERA: CameraRig = {
  yaw: BAR_TABLE_CAMERA.yaw, dist: 13, height: 1 + Math.tan(35 * Math.PI / 180) * 13, lookY: 1,
  span: 4.55, maxScale: PX_PER_UNIT * 1.27,
};
export const BAR_FOLLOW_SHARE = 0.73;

/** 같은 너비에서는 인원과 관계없이 같은 배율을 쓴다. */
export function cameraScale(c: Pick<Canvas, "w">, rig: CameraRig = DEFAULT_CAMERA): number {
  if (rig.span === undefined) return PX_PER_UNIT;
  return Math.min(c.w / rig.span, rig.maxScale ?? Infinity);
}

interface Basis {
  right: V3;
  up: V3;
  back: V3;
  /** 주시점에서 카메라까지의 거리 */
  len: number;
}

// 카메라 위치에서 주시점을 뺀 값으로 화면 좌우·상하의 단위 벡터를 계산한다.
function basisOf(rig: CameraRig): Basis {
  const offset: V3 = { x: Math.sin(rig.yaw) * rig.dist, y: rig.height - rig.lookY, z: Math.cos(rig.yaw) * rig.dist };
  const len = Math.sqrt(offset.x * offset.x + offset.y * offset.y + offset.z * offset.z);
  const back: V3 = { x: offset.x / len, y: offset.y / len, z: offset.z / len };
  // right = normalize(worldUp × back) = normalize((back.z, 0, −back.x))
  const rl = Math.sqrt(back.z * back.z + back.x * back.x);
  const right: V3 = { x: back.z / rl, y: 0, z: -back.x / rl };
  // up = back × right
  const up: V3 = {
    x: back.y * right.z - back.z * right.y,
    y: back.z * right.x - back.x * right.z,
    z: back.x * right.y - back.y * right.x,
  };
  return { right, up, back, len };
}
const BASES = new Map([DEFAULT_CAMERA, BAR_TABLE_CAMERA, BAR_WALK_CAMERA].map((rig) => [rig, basisOf(rig)] as const));
const BASIS = BASES.get(DEFAULT_CAMERA)!;

const frontBarSeats = new Set([0, 3, 6, 7]);
const barSeatYawOffsets = [0.68, 0.14, -0.15, -0.70, 0.56, -0.56, 0.38, -0.42];
const barSeatIndices = new Map<string, number>(BAR_SEATS_FX.map(([x, z], i) => [`${x}:${z}`, i]));
export function barSeatAt(pos: { x: number; z: number }): number | undefined {
  return barSeatIndices.get(`${Math.round(pos.x * UNIT)}:${Math.round(pos.z * UNIT)}`);
}

export function barSeatYaw(index: number): number {
  return BAR_TABLE_CAMERA.yaw + barSeatYawOffsets[index]!;
}

/** 앞쪽 좌석 이름표는 자기 의자 앞쪽 바닥에 표시해서 뒤쪽 얼굴을 가리지 않는다. */
export function barNameTagFoot(pos: { x: number; z: number }, index: number): V3 | undefined {
  if (!frontBarSeats.has(index)) return undefined;
  const shift = 0.36;
  return { x: pos.x + Math.sin(BAR_TABLE_CAMERA.yaw) * shift, y: -0.16, z: pos.z + Math.cos(BAR_TABLE_CAMERA.yaw) * shift };
}

/** 가장 작은 화면에서도 뒤쪽 이름과 앞쪽 이름이 들어오도록 8석을 기준으로만 맞춘다. */
const barTableExtents = (() => {
  const { up } = BASES.get(BAR_TABLE_CAMERA)!;
  let highest = 0;
  let lowest = 0;
  const height = (p: V3): number => up.x * p.x + up.y * (p.y - BAR_TABLE_CAMERA.lookY) + up.z * p.z;
  for (const [i, [x, z]] of BAR_SEATS_FX.entries()) {
    const pos = { x: x / UNIT, z: z / UNIT };
    const head = { ...pos, y: HEAD_TOP_Y + BAR_SEAT_HEIGHT };
    const foot = barNameTagFoot(pos, i) ?? { ...pos, y: 0 };
    highest = Math.max(highest, height(head));
    lowest = Math.max(lowest, -height(foot));
  }
  return { highest, lowest };
})();

export function barTableZoom(stage: { top: number; bottom: number }, size: Canvas, maxZoom: number): number {
  const scale = cameraScale(size, BAR_TABLE_CAMERA);
  const half = (stage.bottom - stage.top) / 2;
  const { highest, lowest } = barTableExtents;
  return Math.min(maxZoom, Math.max(0.48, Math.min((half - 40) / (highest * scale), (half - 15) / (lowest * scale))));
}

/** 화면 오른쪽·위쪽·카메라 쪽 단위벡터(서로 수직). 호출마다 새 객체를 돌려준다 */
export function cameraBasis(): { right: V3; up: V3; back: V3 } {
  const b = BASIS;
  return { right: { ...b.right }, up: { ...b.up }, back: { ...b.back } };
}

/** 스테이지 사각형(px): 위 62 ~ 아래 패널 위 끝, 폭 전체. 안전 영역은 뺀 값이다 */
export function stageRect(c: Canvas, panelHeight: number = PANEL_HEIGHT): { top: number; bottom: number; left: number; right: number } {
  return { top: HEADER_BOTTOM, bottom: c.h - panelHeight, left: 0, right: c.w };
}

/** setViewOffset 세로 이동: offsetY = H/2 − (스테이지 위 끝 + 스테이지 높이/2). 양수면 장면이 위로 올라간다 */
export function stageOffsetY(canvasH: number, stageTop: number, stageBottom: number): number {
  return canvasH / 2 - (stageTop + (stageBottom - stageTop) / 2);
}

/** 월드 점 → 화면 좌표(px). 목표가 주시점이고, 오프셋만큼 장면이 위로 올라간다. zoom 은 화면 가운데 기준 확대(기본 1) */
export function groundToScreen(p: V3, target: { x: number; z: number }, c: Canvas, offsetY: number, zoom = 1, rig = DEFAULT_CAMERA): { sx: number; sy: number } {
  const { right, up } = BASES.get(rig) ?? basisOf(rig);
  const scale = cameraScale(c, rig) * zoom;
  const d: V3 = { x: p.x - target.x, y: p.y - rig.lookY, z: p.z - target.z };
  const r = d.x * right.x + d.y * right.y + d.z * right.z;
  const u = d.x * up.x + d.y * up.y + d.z * up.z;
  return { sx: c.w / 2 + r * scale, sy: c.h / 2 - u * scale - offsetY };
}

/** 화면 점의 정사영 광선: 원점은 카메라 평면 위(주시점에서 카메라 쪽으로 기저의 거리), 방향은 −back */
export function screenRay(sx: number, sy: number, target: { x: number; z: number }, c: Canvas, offsetY: number, zoom = 1, rig = DEFAULT_CAMERA): { origin: V3; dir: V3 } {
  const { right, up, back, len } = BASES.get(rig) ?? basisOf(rig);
  const scale = cameraScale(c, rig) * zoom;
  const dx = (sx - c.w / 2) / scale;
  const dy = (c.h / 2 - sy - offsetY) / scale;
  return {
    origin: {
      x: target.x + right.x * dx + up.x * dy + back.x * len,
      y: rig.lookY + right.y * dx + up.y * dy + back.y * len,
      z: target.z + right.z * dx + up.z * dy + back.z * len,
    },
    dir: { x: -back.x, y: -back.y, z: -back.z },
  };
}

/** 화면 점 → 바닥(y = 0) 점. groundToScreen 의 역 */
export function screenToGround(sx: number, sy: number, target: { x: number; z: number }, c: Canvas, offsetY: number, zoom = 1, rig = DEFAULT_CAMERA): { x: number; z: number } {
  const { origin, dir } = screenRay(sx, sy, target, c, offsetY, zoom, rig);
  const t = origin.y / -dir.y;
  return { x: origin.x + dir.x * t, z: origin.z + dir.z * t };
}

/** 카메라 목표를 이동 한계 상자 안으로 자른다(축별) */
export function clampTarget(p: { x: number; z: number }, box: typeof PAN_BOX = PAN_BOX): { x: number; z: number } {
  return { x: Math.min(box.maxX, Math.max(box.minX, p.x)), z: Math.min(box.maxZ, Math.max(box.minZ, p.z)) };
}

const ARRIVE_EPS = 0.001;

/**
 * 따라가기 한 걸음. 프레임 독립 감쇠 k = 1 − exp(−dt/τ). 모션 줄이기면 즉시 목표에 붙는다.
 * 0.001 단위 안으로 들어오면 목표에 붙어 멈춘다(끝없이 가까워지며 다시 그리는 것을 막는다).
 */
export function followStep(cam: { x: number; z: number }, target: { x: number; z: number }, dtMs: number, reduced: boolean): { x: number; z: number } {
  if (reduced) return { x: target.x, z: target.z };
  const dx = target.x - cam.x;
  const dz = target.z - cam.z;
  if (dx === 0 && dz === 0) return { x: cam.x, z: cam.z };
  if (!(dtMs > 0)) return { x: cam.x, z: cam.z };
  if (Math.sqrt(dx * dx + dz * dz) < ARRIVE_EPS) return { x: target.x, z: target.z };
  const k = 1 - Math.exp(-dtMs / FOLLOW_TAU_MS);
  return { x: cam.x + dx * k, z: cam.z + dz * k };
}

/** 머리 위 쌓임 높이(px) 산 사람 최대: 입력 중 26 + 도장 32 + 배지 40 + 이름표 24 (UI-SPEC 카메라) */
export const GATHER_STACK_H = 122;
/** 유령 화면 최대: 산 사람 쌓임 + 직업 표시 32 (UI-SPEC 카메라) */
export const GATHER_STACK_H_GHOST = 154;

/** 첫 투표에서 머리부터 발까지 담을 수 있는 확대 배율. 같은 둘레의 8인 배치로 여유를 잡는다. */
export function gatherGroupZoom(stage: { top: number; bottom: number }, c: Canvas, maxZoom: number): number {
  const diameter = 2 * RING_RADIUS_FX / UNIT;
  const height = (diameter * Math.hypot(BASIS.up.x, BASIS.up.z) + (HEAD_TOP_Y + 0.15) * BASIS.up.y) * PX_PER_UNIT;
  const width = (diameter + 1) * PX_PER_UNIT;
  return Math.max(0.05, Math.min(maxZoom, (stage.bottom - stage.top - 16) / height, (c.w - 24) / width));
}

/**
 * 모이는 자리 고정 구도(지목·변론·찬반·처형). UI-SPEC 카메라 표: 이름표가 몸보다 우선이다 — 지목은 이름표를 눌러야 하기 때문이다.
 * 목표는 늘 모이는 자리 가운데이고, 8슬롯(최악의 8명) 이름표 상자 = 뒤 머리 꼭대기 − 쌓임 높이 ~ 앞 머리 꼭대기를 스테이지 사각형 세로 가운데에 두는 offsetY 를 정한다.
 * 몸까지 들어가는 스테이지(앞 발까지 포함한 상자가 들어갈 만큼, 약 380~395)면 앞 발까지 포함한 상자를 가운데에 둔다.
 * 상자가 스테이지보다 높으면(300 미만 — 알려진 한계 E8 #28) 앞 머리 꼭대기를 스테이지 아래 끝에 맞춘다(앞 사람 이름표가 우선, 뒤쪽 이름표가 위로 잘림).
 * zoom 은 과반 연출 확대(같은 확대로 투영해 구도를 잡는다).
 */
export function gatherView(stage: { top: number; bottom: number }, c: Canvas, opts: { ghost?: boolean; zoom?: number; frameGroup?: boolean } = {}): { target: { x: number; z: number }; offsetY: number } {
  const zoom = opts.zoom ?? 1;
  const stackH = opts.frameGroup ? 0 : opts.ghost ? GATHER_STACK_H_GHOST : GATHER_STACK_H;
  const target = { x: GATHER_CENTER.x, z: GATHER_CENTER.z };
  let headTop = Infinity;
  let headBottom = -Infinity;
  let footBottom = -Infinity;
  for (const [fx, fz] of ringSlots(8)) {
    const head = groundToScreen({ x: fx / UNIT, y: HEAD_TOP_Y, z: fz / UNIT }, target, c, 0, zoom).sy;
    const foot = groundToScreen({ x: fx / UNIT, y: 0, z: fz / UNIT }, target, c, 0, zoom).sy;
    headTop = Math.min(headTop, head);
    headBottom = Math.max(headBottom, head);
    footBottom = Math.max(footBottom, foot);
  }
  const boxTop = headTop - stackH;
  const stageH = stage.bottom - stage.top;
  const stageMid = stage.top + stageH / 2;
  const centered = (boxBottom: number): number => (boxTop + boxBottom) / 2 - stageMid;
  if (stageH >= footBottom - boxTop) return { target, offsetY: centered(footBottom) };
  if (stageH >= headBottom - boxTop) return { target, offsetY: centered(headBottom) };
  return { target, offsetY: headBottom - stage.bottom };
}
