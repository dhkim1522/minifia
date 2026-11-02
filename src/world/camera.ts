// 정사영 카메라 수학(순수). three 를 import 하지 않는다 — 렌더러(06-10)가 같은 상수로 three 카메라를 만들고,
// 그쪽 Vector3.project 가 이 모듈의 groundToScreen 과 같은 값임을 테스트로 증명한다.
//
// 좌표: 월드 x·z 는 바닥, y 는 위. 화면 sx 는 오른쪽, sy 는 아래쪽(CSS 픽셀).
// 카메라 = 목표 + (sin(yaw)·17, 12.5, cos(yaw)·17), 주시점 = (목표.x, 0.6, 목표.z), 정사영, 배율 PX_PER_UNIT.
// 배율은 PX_PER_UNIT × zoom(zoom 은 지목 과반 연출의 확대 1.08, 생략하면 1 — 화면 가운데(오프셋 반영)에서 거리가 zoom 배가 된다).
// 클라이언트 전용이라 삼각함수를 써도 된다(shared 의 서버 판정 모듈 규칙은 여기 적용되지 않는다).

import { ringSlots } from "../../shared/game/gather";
import { HEAD_TOP_Y, STAGE_SPOT, UNIT } from "../../shared/game/map";
import { lobbyPanelHeight, LOG_H_SHORT, TYPING_PILL_H } from "../game/chatUi";

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
/** DOM 을 재기 전의 기본 아래 패널 높이(px, 안전 영역 제외) = 7페이즈 로비 패널 LOG_H + 154 (짧은 폰 LOG_H 96 → 250). 로비는 패널을 DOM 에서 재서 넘기므로 이 값은 측정 전·측정 불가 환경에서만 쓴다 */
export const PANEL_HEIGHT = lobbyPanelHeight(LOG_H_SHORT);
/** 이름표 상자 최대 폭(가정 A1: 전각 8자 + " (나)" + 점·여백). 06-12 E2E 가 실제 폭을 재서 넘으면 고친다 */
export const NAMETAG_MAX_W = 180;
/** 이름표 상자 높이(px) */
export const NAMETAG_H = 24;
/** 이름표 상자 아래 끝과 머리 꼭대기 사이 간격(px) */
export const NAMETAG_GAP = 4;
/** 머리 위 쌓임 전체 높이(px) = 이름표 24 + 입력 중 칸 22(알약 18 + 이름표와 간격 4, 07-18). 가시성 검사는 늘 입력 중 칸이 있다고 보고 돈다(가장 불리한 경우) */
export const HEAD_STACK_H = NAMETAG_H + TYPING_PILL_H;
/**
 * 카메라 목표 이동 한계(월드 단위, 축별 대칭 상자) = 가시성 검사(걷는 영역 0.25 간격 전 격자점 × 6개 폰 크기에서
 * 발과 이름표 180×24 + 입력 중 칸 22 = 머리 위 쌓임 HEAD_STACK_H 가 7페이즈 로비 스테이지 사각형 안, A1: 늘 입력 중 칸이 있다고 보는 최악)을
 * 통과하는 가장 좁은 0.1 단위 값이다. 7페이즈(07-18)에서 스테이지가 채팅 패널(LOG_H + 154)만큼 줄고 이름표 위로 22가 늘어 6페이즈 값 ±4.8 을 ±5.7 로 다시 정했다
 * (6페이즈 시작값 ±4.0 은 폭 360 폰에서 모서리 (5.8, −5.8) 의 이름표가 오른쪽으로 58px 넘쳤고, ±4.8 은 새 스테이지에서 360x640 이 1.5px · 360x560 이 41.5px 넘쳤다).
 * 크기별 최소 pan: 360x640 4.9 · 360x560 5.7 · 390x664 4.6 · 390x844 4.6 · 402x874 4.5 · 430x932 4.3.
 * 한계를 정한 것은 스테이지 높이가 가장 낮은 360x560(로비 스테이지 248 — 모서리 점의 이름표·입력 중 칸이 위로 넘침)이다. 5.7 은 걷는 영역 반폭 5.8 안쪽이다.
 * 스테이지 < 128 인 키보드 열림 상태는 이 검사 대상이 아니다(UI-SPEC 알려진 한계, A2).
 */
export const PAN_BOX: Readonly<{ minX: number; maxX: number; minZ: number; maxZ: number }> = { minX: -5.7, maxX: 5.7, minZ: -5.7, maxZ: 5.7 };
/**
 * 연장 바닥 판 반폭(월드 단위, 바닥 아래 y = −0.01 의 정사각형 한 장) = 빈 배경 검사(PAN_BOX 의 9개 목표 × 7페이즈 로비 스테이지
 * 사각형 7×7 표본 광선)가 통과하는 가장 작은 0.5 단위 값 15.0 + 여유 2. 가장 먼 점은 430x932 에서 목표 (−5.7, −5.7) 일 때
 * 스테이지 왼쪽 위 모서리 표본이 닿는 바닥 (−14.89, −9.67) 이다. 크기별 가장 먼 바닥: 360x640 12.0 · 360x560 11.1 · 390x664 12.4 · 390x844 13.7 · 402x874 14.1 · 430x932 14.9.
 * 스테이지 위(헤더 가림막 뒤)까지는 여유 2 가 덮는다.
 */
export const PLATE_FAR = 17;

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

// 카메라 위치 − 주시점 = (sin yaw·17, 12.5 − 0.6, cos yaw·17). 기저는 한 번만 계산한다.
const OFFSET: V3 = { x: Math.sin(CAM_YAW) * CAM_DIST, y: CAM_HEIGHT - LOOK_Y, z: Math.cos(CAM_YAW) * CAM_DIST };
const OFFSET_LEN = Math.sqrt(OFFSET.x * OFFSET.x + OFFSET.y * OFFSET.y + OFFSET.z * OFFSET.z);
const BACK: V3 = { x: OFFSET.x / OFFSET_LEN, y: OFFSET.y / OFFSET_LEN, z: OFFSET.z / OFFSET_LEN };
// right = normalize(worldUp × back) = normalize((back.z, 0, −back.x))
const RIGHT_LEN = Math.sqrt(BACK.z * BACK.z + BACK.x * BACK.x);
const RIGHT: V3 = { x: BACK.z / RIGHT_LEN, y: 0, z: -BACK.x / RIGHT_LEN };
// up = back × right
const UP: V3 = {
  x: BACK.y * RIGHT.z - BACK.z * RIGHT.y,
  y: BACK.z * RIGHT.x - BACK.x * RIGHT.z,
  z: BACK.x * RIGHT.y - BACK.y * RIGHT.x,
};

/** 화면 오른쪽·위쪽·카메라 쪽 단위벡터(서로 수직). 호출마다 새 객체를 돌려준다 */
export function cameraBasis(): { right: V3; up: V3; back: V3 } {
  return { right: { ...RIGHT }, up: { ...UP }, back: { ...BACK } };
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
export function groundToScreen(p: V3, target: { x: number; z: number }, c: Canvas, offsetY: number, zoom = 1): { sx: number; sy: number } {
  const scale = PX_PER_UNIT * zoom;
  const d: V3 = { x: p.x - target.x, y: p.y - LOOK_Y, z: p.z - target.z };
  const r = d.x * RIGHT.x + d.y * RIGHT.y + d.z * RIGHT.z;
  const u = d.x * UP.x + d.y * UP.y + d.z * UP.z;
  return { sx: c.w / 2 + r * scale, sy: c.h / 2 - u * scale - offsetY };
}

/** 화면 점의 정사영 광선: 원점은 카메라 평면 위(주시점에서 카메라 쪽으로 OFFSET_LEN), 방향은 −back */
export function screenRay(sx: number, sy: number, target: { x: number; z: number }, c: Canvas, offsetY: number, zoom = 1): { origin: V3; dir: V3 } {
  const scale = PX_PER_UNIT * zoom;
  const dx = (sx - c.w / 2) / scale;
  const dy = (c.h / 2 - sy - offsetY) / scale;
  return {
    origin: {
      x: target.x + RIGHT.x * dx + UP.x * dy + BACK.x * OFFSET_LEN,
      y: LOOK_Y + RIGHT.y * dx + UP.y * dy + BACK.y * OFFSET_LEN,
      z: target.z + RIGHT.z * dx + UP.z * dy + BACK.z * OFFSET_LEN,
    },
    dir: { x: -BACK.x, y: -BACK.y, z: -BACK.z },
  };
}

/** 화면 점 → 바닥(y = 0) 점. groundToScreen 의 역 */
export function screenToGround(sx: number, sy: number, target: { x: number; z: number }, c: Canvas, offsetY: number, zoom = 1): { x: number; z: number } {
  const { origin, dir } = screenRay(sx, sy, target, c, offsetY, zoom);
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

/**
 * 모이는 자리 고정 구도(지목·변론·찬반·처형). UI-SPEC 카메라 표: 이름표가 몸보다 우선이다 — 지목은 이름표를 눌러야 하기 때문이다.
 * 목표는 늘 모이는 자리 가운데이고, 8슬롯(최악의 8명) 이름표 상자 = 뒤 머리 꼭대기 − 쌓임 높이 ~ 앞 머리 꼭대기를 스테이지 사각형 세로 가운데에 두는 offsetY 를 정한다.
 * 몸까지 들어가는 스테이지(앞 발까지 포함한 상자가 들어갈 만큼, 약 380~395)면 앞 발까지 포함한 상자를 가운데에 둔다.
 * 상자가 스테이지보다 높으면(300 미만 — 알려진 한계 E8 #28) 앞 머리 꼭대기를 스테이지 아래 끝에 맞춘다(앞 사람 이름표가 우선, 뒤쪽 이름표가 위로 잘림).
 * zoom 은 과반 연출 확대(같은 확대로 투영해 구도를 잡는다).
 */
export function gatherView(stage: { top: number; bottom: number }, c: Canvas, opts: { ghost?: boolean; zoom?: number } = {}): { target: { x: number; z: number }; offsetY: number } {
  const zoom = opts.zoom ?? 1;
  const stackH = opts.ghost ? GATHER_STACK_H_GHOST : GATHER_STACK_H;
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
