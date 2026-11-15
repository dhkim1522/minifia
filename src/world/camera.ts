// 정사영 카메라 수학(순수). three 를 import 하지 않는다 — 렌더러(06-10)가 같은 상수로 three 카메라를 만들고,
// 그쪽 Vector3.project 가 이 모듈의 groundToScreen 과 같은 값임을 테스트로 증명한다.
//
// 좌표: 월드 x·z 는 바닥, y 는 위. 화면 sx 는 오른쪽, sy 는 아래쪽(CSS 픽셀).
// 카메라 = 목표 + (sin(yaw)·17, 12.5, cos(yaw)·17), 주시점 = (목표.x, 0.6, 목표.z), 정사영, 배율 PX_PER_UNIT.
// 배율은 PX_PER_UNIT × zoom(zoom 은 지목 과반 연출의 확대 1.08, 생략하면 1 — 화면 가운데(오프셋 반영)에서 거리가 zoom 배가 된다).
// 클라이언트 전용이라 삼각함수를 써도 된다(shared 의 서버 판정 모듈 규칙은 여기 적용되지 않는다).

import { ringSlots } from "../../shared/game/gather";
import { HEAD_TOP_Y, STAGE_SPOT, UNIT } from "../../shared/game/map";
import { TOWN_HOUSES } from "../../shared/game/mapTown";
import type { MapId } from "../../shared/protocol";
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
/** DOM 을 재기 전의 기본 아래 패널 높이(px, 안전 영역 제외) = 7페이즈 로비 패널 LOG_H + 154 (LOG_H 68 → 222). 로비는 패널을 DOM 에서 재서 넘기므로 이 값은 측정 전·측정 불가 환경에서만 쓴다 */
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
 * 카메라 목표 이동 한계(월드 단위, 축별 대칭 상자) = 가시성 검사(걷는 영역 0.25 간격 전 격자점 × 6개 폰 크기에서
 * 발과 이름표 180×24 + 입력 중 칸 22 = 머리 위 쌓임 HEAD_STACK_H 가 7페이즈 로비 스테이지 사각형 안, A1: 늘 입력 중 칸이 있다고 보는 최악)을
 * 통과하는 가장 좁은 0.1 단위 값이다. 7페이즈(07-18)에서 스테이지가 채팅 패널(LOG_H + 154)만큼 줄고 이름표 위로 22가 늘어 6페이즈 값 ±4.8 을 ±5.7 로 다시 정했다.
 * 18.1-06 에서 기록 칸이 68 한 값이 되어 로비 패널이 222 로 줄고 스테이지가 커져 ±5.4 로 다시 정했다.
 * 크기별 최소 pan: 360x640 4.8 · 360x560 5.4 · 390x664 4.6 · 390x844 4.6 · 402x874 4.5 · 430x932 4.3.
 * 한계를 정한 것은 스테이지 높이가 가장 낮은 360x560(로비 스테이지 276 — 모서리 점의 이름표·입력 중 칸이 위로 넘침)이다. 5.4 는 걷는 영역 반폭 5.8 안쪽이다.
 * 스테이지 < 128 인 키보드 열림 상태는 이 검사 대상이 아니다(UI-SPEC 알려진 한계, A2).
 */
export const PAN_BOX: Readonly<{ minX: number; maxX: number; minZ: number; maxZ: number }> = { minX: -5.4, maxX: 5.4, minZ: -5.4, maxZ: 5.4 };
/**
 * 연장 바닥 판 반폭(월드 단위, 바닥 아래 y = −0.01 의 정사각형 한 장) = 빈 배경 검사(PAN_BOX 의 9개 목표 × 로비 스테이지
 * 사각형 7×7 표본 광선)가 통과하는 가장 작은 0.5 단위 값 15.5 + 여유 2. 스테이지가 커지면(18.1-06 패널 222) 위쪽 광선이 더 먼 바닥에 닿아 17 에서 17.5 로 다시 정했다.
 * 크기별 가장 먼 바닥: 360x640 12.0 · 360x560 11.1 · 390x664 12.4 · 390x844 14.3 · 402x874 14.7 · 430x932 15.5.
 * 스테이지 위(헤더 가림막 뒤)까지는 여유 2 가 덮는다.
 */
export const PLATE_FAR = 17.5;

/**
 * 맵별 카메라 목표 이동 한계. 재즈 바·광장은 PAN_BOX 그대로다. 마을은 걷기 한계 ±10 에서 광장과 같은 여유 0.4 를 뺀 ±9.6 이다(UI-SPEC P20-15).
 * 20-05 가 가시성 검사(6종 폰 × 0.25 간격 81×81 격자점)를 마을 격자로 돌려 확정했다: 크기별 최소 pan 360x640 9.0 · 390x664 8.8 · 430x932 8.5 · 360x560 9.6 · 390x844 8.8 · 402x874 8.7.
 * 한계를 정한 것은 이번에도 스테이지가 가장 낮은 360x560 이고, 가장 좁은 0.1 단위 값이 시작값 ±9.6 과 같다(걷는 영역 ±10 안쪽).
 */
const TOWN_PAN_BOX: typeof PAN_BOX = { minX: -9.6, maxX: 9.6, minZ: -9.6, maxZ: 9.6 };
export function panBoxOf(mapId: MapId): typeof PAN_BOX {
  return mapId === "town" ? TOWN_PAN_BOX : PAN_BOX;
}
/**
 * 맵별 연장 바닥 판 반폭. 재즈 바·광장은 PLATE_FAR 그대로. 마을은 한계 ±9.6 의 9개 목표 × 스테이지 7×7 표본 광선이 닿는 가장 먼 바닥 19.68(430x932, 목표 (−9.6,−9.6))
 * → 0.5 단위로 올림 20 + 여유 2 = 22 로 확정했다(P20-15, 20-05 빈 배경 검사).
 * 크기별 가장 먼 바닥: 360x640 16.2 · 390x664 16.6 · 430x932 19.7 · 360x560 15.3 · 390x844 18.5 · 402x874 18.9.
 */
const TOWN_PLATE_FAR = 22;
export function plateFarOf(mapId: MapId): number {
  return mapId === "town" ? TOWN_PLATE_FAR : PLATE_FAR;
}

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

// 시점(CameraView): "iso" 는 지금까지의 경사 시점, "overview" 는 확장판 밤 전용 개관 시점(21-09, D-11·UI-SPEC P21-2).
// 개관은 방위 고정(yaw 0 = 카메라가 남쪽 +z 쪽에서 북쪽을 봄, 위쪽 = 북 −z, 오른쪽 = 동 +x)·거의 정사(위에서 내려 봄)이고, 마을 한계 ±9.6 정사각이 화면 축에 정렬돼 스테이지를 꽉 채운다.
// 시점(기저)은 맵·단계 상수이고 배율만 폰마다 다르다 — 개관 배율은 overviewFraming 이 정하고 zoom(= 배율 ÷ PX_PER_UNIT)으로 건넨다.
export type CameraView = "iso" | "overview";

/** 개관 방위(라디안): 0 = 정남쪽에서 북쪽을 본다(마을 정사각이 화면 축에 정렬) */
export const OVERVIEW_YAW = 0;
/**
 * 개관 카메라가 목표에서 수평으로 떨어진 거리. 높이 20.6 과 함께 기울기를 정한다 — 위에서 거의 곧게(약 80°) 내려 봐 세로 압축(sin 80° ≈ 0.98)과
 * 지붕 높이만큼의 위로 뜸(문패 위치)이 작다. 21-09 계산 시험(폰 6종 × 띠 두 가지)이 이 값에서 문패 간격·안쪽 inset 을 고정한다.
 */
export const OVERVIEW_DIST = 3.5;
/** 개관 카메라 높이(고정 시점: 높이 − 주시점 = 20) */
export const OVERVIEW_HEIGHT = 20.6;
/** 개관이 스테이지에 채우는 마을 한 변(월드 단위) = 이동 한계 ±9.6 */
export const OVERVIEW_SPAN = 19.2;
/** 스테이지 안쪽 여백(px). 배율 = min(스테이지 폭 − 2·inset, 스테이지 높이 − 2·inset) ÷ OVERVIEW_SPAN */
export const OVERVIEW_INSET = 8;
/** 밤 고정 아래 패널 높이(px, 안전 영역 제외) = 위 14 + 행 52 + 아래 22. 모든 역할이 같다(GamePanel 의 원인 흐름 밤, UI-SPEC C 표) */
export const NIGHT_PANEL_HEIGHT = 88;
/** 집 문패 단추: 보이는 원 40(얼굴 32 + 자리색 테두리 2), 누르기 영역 44 */
export const HOUSE_TAG_CIRCLE = 40;
export const HOUSE_TAG_BOX = 44;
/** 문패가 걸리는 높이: 집 지붕 윗면(몸통 1.8 + 지붕판 0.16, 맵 town.ts 의 HOUSE_TOP) */
export const HOUSE_TAG_Y = 1.96;
/** 개관의 카메라 목표 = 마을 가운데 */
const OVERVIEW_TARGET: Readonly<{ x: number; z: number }> = { x: 0, z: 0 };

/** 시점별 카메라 리그(방위·수평 거리·높이). threeCamera 도 이 표로 카메라를 세운다 */
export const CAMERA_RIGS: Readonly<Record<CameraView, { yaw: number; dist: number; height: number }>> = {
  iso: { yaw: CAM_YAW, dist: CAM_DIST, height: CAM_HEIGHT },
  overview: { yaw: OVERVIEW_YAW, dist: OVERVIEW_DIST, height: OVERVIEW_HEIGHT },
};

interface Basis {
  right: V3;
  up: V3;
  back: V3;
  /** 주시점에서 카메라까지의 거리 */
  len: number;
}

// 카메라 위치 − 주시점 = (sin yaw·거리, 높이 − 0.6, cos yaw·거리). 기저는 시점마다 한 번만 계산한다.
function basisOf(rig: { yaw: number; dist: number; height: number }): Basis {
  const offset: V3 = { x: Math.sin(rig.yaw) * rig.dist, y: rig.height - LOOK_Y, z: Math.cos(rig.yaw) * rig.dist };
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
const BASES: Readonly<Record<CameraView, Basis>> = { iso: basisOf(CAMERA_RIGS.iso), overview: basisOf(CAMERA_RIGS.overview) };

/** 화면 오른쪽·위쪽·카메라 쪽 단위벡터(서로 수직). 호출마다 새 객체를 돌려준다. 시점을 생략하면 경사 시점 */
export function cameraBasis(view: CameraView = "iso"): { right: V3; up: V3; back: V3 } {
  const b = BASES[view];
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

/** 월드 점 → 화면 좌표(px). 목표가 주시점이고, 오프셋만큼 장면이 위로 올라간다. zoom 은 화면 가운데 기준 확대(기본 1), view 는 시점(기본 경사) */
export function groundToScreen(p: V3, target: { x: number; z: number }, c: Canvas, offsetY: number, zoom = 1, view: CameraView = "iso"): { sx: number; sy: number } {
  const { right, up } = BASES[view];
  const scale = PX_PER_UNIT * zoom;
  const d: V3 = { x: p.x - target.x, y: p.y - LOOK_Y, z: p.z - target.z };
  const r = d.x * right.x + d.y * right.y + d.z * right.z;
  const u = d.x * up.x + d.y * up.y + d.z * up.z;
  return { sx: c.w / 2 + r * scale, sy: c.h / 2 - u * scale - offsetY };
}

/** 화면 점의 정사영 광선: 원점은 카메라 평면 위(주시점에서 카메라 쪽으로 기저의 거리), 방향은 −back */
export function screenRay(sx: number, sy: number, target: { x: number; z: number }, c: Canvas, offsetY: number, zoom = 1, view: CameraView = "iso"): { origin: V3; dir: V3 } {
  const { right, up, back, len } = BASES[view];
  const scale = PX_PER_UNIT * zoom;
  const dx = (sx - c.w / 2) / scale;
  const dy = (c.h / 2 - sy - offsetY) / scale;
  return {
    origin: {
      x: target.x + right.x * dx + up.x * dy + back.x * len,
      y: LOOK_Y + right.y * dx + up.y * dy + back.y * len,
      z: target.z + right.z * dx + up.z * dy + back.z * len,
    },
    dir: { x: -back.x, y: -back.y, z: -back.z },
  };
}

/** 화면 점 → 바닥(y = 0) 점. groundToScreen 의 역 */
export function screenToGround(sx: number, sy: number, target: { x: number; z: number }, c: Canvas, offsetY: number, zoom = 1, view: CameraView = "iso"): { x: number; z: number } {
  const { origin, dir } = screenRay(sx, sy, target, c, offsetY, zoom, view);
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

/**
 * 개관 구도(21-09, D-11·P21-2): 마을 한 변 ±9.6(OVERVIEW_SPAN)을 스테이지 사각형 안쪽 inset 8 에 꽉 채운다.
 * 배율(px/단위) = min(캔버스 폭 − 16, 스테이지 높이 − 16) ÷ 19.2, 목표 = 마을 가운데. zoom 은 PX_PER_UNIT 에 대한 비 — 기존 setZoom 길로 건넨다.
 * 세로 위치는 집 문패가 걸리는 지붕 높이 면(HOUSE_TAG_Y)의 가운데를 스테이지 사각형 세로 가운데에 둔다 — 문패가 바닥 점보다 지붕 높이만큼 위로 떠 보이므로
 * 바닥 가운데를 기준으로 하면 윗줄 문패만 위쪽 안쪽 여백(8)에 먼저 닿는다(21-09 계산 시험, 360×560 띠 한 줄). 역할·단계 값을 읽지 않는 순수 식이다.
 */
export function overviewFraming(stage: { top: number; bottom: number }, c: Canvas): { target: { x: number; z: number }; offsetY: number; zoom: number; scale: number } {
  const room = Math.min(c.w - 2 * OVERVIEW_INSET, stage.bottom - stage.top - 2 * OVERVIEW_INSET);
  const scale = Math.max(1, room) / OVERVIEW_SPAN;
  const zoom = scale / PX_PER_UNIT;
  const base = stageOffsetY(c.h, stage.top, stage.bottom);
  const lift = groundToScreen({ ...OVERVIEW_TARGET, y: HOUSE_TAG_Y }, OVERVIEW_TARGET, c, base, zoom, "overview").sy - (stage.top + stage.bottom) / 2;
  return { target: { ...OVERVIEW_TARGET }, offsetY: base + lift, zoom, scale };
}

/** 개관 시점에서 집 문패(좌석 0~7)의 화면 가운데(px, 지붕 윗면 투영). 문패 DOM 위치와 겹침·안쪽 검사가 같은 식을 쓴다 */
export function houseTagCenters(stage: { top: number; bottom: number }, c: Canvas): { seat: number; sx: number; sy: number }[] {
  const f = overviewFraming(stage, c);
  return TOWN_HOUSES.map((h) => {
    const p = groundToScreen({ x: h.x, y: HOUSE_TAG_Y, z: h.z }, f.target, c, f.offsetY, f.zoom, "overview");
    return { seat: h.seat, sx: p.sx, sy: p.sy };
  });
}
