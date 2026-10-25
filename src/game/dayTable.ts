// 고정 테이블 배치(결정 0017-1, 0028). DOM·window 를 쓰지 않는 순수 함수라 unit 테스트가 직접 부른다.
//
// 기하는 사용자가 승인한 시안 P2(design/screens/table-v1/SPEC.md)로 모든 상황(대기실·역할 배정·낮·밤·아침)에서 고정이다.
// 390폭 폰(장면 폭 366, 여백 12)에서: 테이블 면 216×108(위 150), 좌석 원 cy 210·rx 146·ry 100, 캐릭터 72×96·k0 0.8.
// 다른 폭은 같은 규칙으로 계산한다(SPEC 의 「장면 폭/2 − 36.4」 대신 아래 식 — 390폭에서 승인값을 그대로 재현한다):
//   rx = clamp(floor(장면 폭/2 + 장면 여백 − 49), 124, 150),  면 폭 = 2·(rx − 38)
//   | 폰 | 장면 폭×높이 | 여백 | rx | 면 폭 | 면 left |
//   | 360 | 352×363.8 | 4 | 131 | 186 | 83 |    | 375 | 367×390.8 | 4 | 138 | 200 | 83.5 |
//   | 390 | 366×387.8 | 12 | 146 | 216 | 75 |    | 430 | 406×655.8 | 12 | 150 | 224 | 91 |
//   4~8명 모두 캐릭터 상자가 장면 안(최소 여백 4.6)이고 양옆 캐릭터는 발 줄에서 테이블 면과 6.2px 이상 떨어진다.
// - 이름표 여유 49(RX_TAG_HALF)는 칼날 경계다: 99px(5글자) 이름표의 반폭 49.5 − E2E 허용 0.5. 4·8명판 양옆 자리의 5글자 이름표는
//   장면 상자 밖으로 나가고 폰 가장자리에 정확히 −0.5 로 닿는다(E2E 봇 이름은 3글자라 시험되지 않는다). 걸리면 49 → 50 (390폭 rx 145·면 214).
// - 캐릭터 상자·이름표·이모티콘은 모두 같은 (x, y)(발 위치)에서 계산한다. 떠 있는 층을 따로 가두는(clamp) 계산은 없다.
// - 이름표는 이름 한 줄(높이 22)이고 발 y 에 바로 붙는다(간격 0). 이름표 층(z 1~11)은 항상 캐릭터 층(z 12~22) 아래다:
//   이름표는 어떤 캐릭터의 얼굴도 덮지 못하고, 가까운 캐릭터가 먼 사람의 이름표를 덮을 수는 있다
//   (가려질 수 있는 쪽은 이름표다 — 사용자 결정 F2, 3.1 UI-SPEC).
// - 세로: 장면 높이가 시안보다 짧은 실제 폰(주소창·툴바)에서는 테이블 전체(면과 좌석 원)를 같은 만큼 올린다.
//   그러면 테이블과 좌석의 관계는 그대로이고, 맨 앞 이름표가 장면 안에 든다(높이 TABLE_FIT_MIN_H 이상).

/** 시안 기준 장면 크기: 폭 366(390 폭 폰), 높이 407(390×664 에서 헤더 100·하단 157 을 뺀 값). 재지 못할 때의 기본값. */
export const DAY_SCENE_W = 366;
export const DAY_SCENE_H = 407;
/** 장면 상자 좌우 여백(CSS 한 곳: daytable.css 의 --mf-scene-pad). 폰 폭 389 이하는 4, 그 위는 12. */
export const SCENE_PAD_DEFAULT = 12;
export const SCENE_PAD_NARROW = 4;

/** 좌석 원 가로 반지름의 범위 */
export const SEAT_RX_MIN = 124;
export const SEAT_RX_MAX = 150;
/** 99px 이름표 반폭 49.5 − E2E 허용 0.5. 양옆 자리의 이름표가 폰 가장자리에 정확히 −0.5 로 닿는 값(칼날 경계). */
export const RX_TAG_HALF = 49;
/** 양옆 캐릭터와 테이블 면 사이 가로 여유: 면 반폭 = rx − FELT_SIDE */
export const FELT_SIDE = 38;
export const SEAT_RY = 100;
/** 좌석 원 세로 중심의 최대(시안 크기). 장면이 충분히 높으면 늘 이 값이다. */
export const SEAT_CY = 210;
/** 세로 중심의 최소. 맨 뒤 캐릭터 머리 위(cy − ry − 96·0.8 = cy − 176.8)가 0 아래로 나가지 않는 값. */
export const SEAT_CY_MIN = 177;
/** 이 높이부터 맨 앞 이름표 아래 끝(cy + ry + 0 + 22 = cy + 122)이 장면 안이다: SEAT_CY_MIN + 122. */
export const TABLE_FIT_MIN_H = SEAT_CY_MIN + 122;
/** 맨 앞 이름표 아래 끝까지의 거리: ry 100 + 이름표 간격 0 + 이름표 높이 22. */
const FRONT_TAG_BELOW_CY = 122;

/** 테이블 면 위 = cy − 60 (cy 210 에서 150). */
export const FELT_CY_OFFSET = 60;
export const FELT_H = 108;
export const FELT_TOP = 150;

export const FIG_W = 72;
export const FIG_H = 96;
/** 맨 뒤 자리의 배율 */
export const DEPTH_K0 = 0.8;
/** 이름표 위 = 발 y + 0 (이름표 상자의 윗면이 발 y) */
export const TAG_GAP_Y = 0;
/** 이름표 한 줄 높이(테두리 포함) */
export const TAG_H = 22;
/**
 * 이름표 상자 폭 상한(배치 검사의 기준). 5글자 닉네임 윗줄의 설계 값이다:
 * 테두리 1 + 여백 7 + 점 8 + 간격 4 + 글자 70(14px × 5) + 여백 8 + 테두리 1 = 99.
 * 닉네임은 말줄임하지 않는다(게임 정보). 실기기 글꼴의 몇 px 차이는 장면 바깥 여백이 받는다.
 */
export const NAME_TAG_MAX_W = 100;

export const EMOJI_SIZE = 32;
/** 이모티콘은 머리 위에서 이만큼 더 위에 뜬다 */
export const EMOJI_LIFT = 36;

export interface DayGeometry {
  cx: number;
  cy: number;
  rx: number;
  ry: number;
  felt: { left: number; top: number; width: number; height: number };
}

/** 좌석 원 가로 반지름: 폰 가장자리 안에 99px 이름표가 들어오는 최대 정수(RX_TAG_HALF), [124, 150] 로 자른다. */
export function seatRx(sceneW: number, pad: number = SCENE_PAD_DEFAULT): number {
  return Math.min(SEAT_RX_MAX, Math.max(SEAT_RX_MIN, Math.floor(sceneW / 2 + pad - RX_TAG_HALF)));
}

/** 테이블 면 폭 = 2·(rx − 38) */
export function feltWidthOf(rx: number): number {
  return 2 * (rx - FELT_SIDE);
}

/** 장면 폭·높이·여백에서 나오는 고정 테이블 기하. 인원과 무관하다. pad 는 장면 상자의 좌우 여백(기본 12). */
export function dayTableGeometry(sceneW: number, sceneH: number = DAY_SCENE_H, pad: number = SCENE_PAD_DEFAULT): DayGeometry {
  const rx = seatRx(sceneW, pad);
  const feltW = feltWidthOf(rx);
  const cy = Math.max(SEAT_CY_MIN, Math.min(SEAT_CY, sceneH - FRONT_TAG_BELOW_CY));
  return {
    cx: sceneW / 2,
    cy,
    rx,
    ry: SEAT_RY,
    felt: { left: (sceneW - feltW) / 2, top: cy - FELT_CY_OFFSET, width: feltW, height: FELT_H },
  };
}

export interface DaySeatPlace {
  seat: number;
  /** 0 = 나, 이후 시계 방향 */
  slot: number;
  /** 발 위치 */
  x: number;
  y: number;
  /** 0(맨 뒤) ~ 1(맨 앞) */
  depth: number;
  scale: number;
  z: number;
  figLeft: number;
  figTop: number;
  tagLeft: number;
  tagTop: number;
  tagZ: number;
  emojiLeft: number;
  emojiTop: number;
}

/**
 * 자리 번호 오름차순으로 둘러앉은 순서에서 내 순위를 0 으로 돌린다. 시작 전에 나간 사람 때문에 자리 번호에 빈칸이 있어도
 * n 명이 원을 고르게 채우고, 모든 폰에서 시계 방향 자리 번호 순서가 같은 회전이다. mySeat 이 목록에 없으면 첫 자리가 0.
 * 결과는 자리 번호 오름차순.
 */
export function daySeatLayout(
  seats: readonly { seat: number }[],
  mySeat: number,
  sceneW: number,
  sceneH: number = DAY_SCENE_H,
  pad: number = SCENE_PAD_DEFAULT,
): DaySeatPlace[] {
  const { cx, cy, rx, ry } = dayTableGeometry(sceneW, sceneH, pad);
  const ordered = seats.map((s) => s.seat).sort((a, b) => a - b);
  const n = ordered.length;
  const mine = Math.max(0, ordered.indexOf(mySeat));
  return ordered.map((seat, rank) => {
    const slot = (((rank - mine) % n) + n) % n;
    // 화면 좌표는 아래가 +y 라 90° 가 맨 아래다. slot 이 늘면 아래 → 왼쪽 → 위 → 오른쪽(시계 방향).
    const theta = Math.PI / 2 + (slot / n) * Math.PI * 2;
    const depth = (Math.sin(theta) + 1) / 2;
    const scale = DEPTH_K0 + (1 - DEPTH_K0) * depth;
    const x = cx + rx * Math.cos(theta);
    const y = cy + ry * Math.sin(theta);
    // 캐릭터 12~22, 이름표 1~11: 최소 캐릭터 12 > 최대 이름표 11 이라 이름표는 항상 캐릭터 아래다.
    const z = 12 + Math.round(depth * 10);
    const tagZ = 1 + Math.round(depth * 10);
    return {
      seat,
      slot,
      x,
      y,
      depth,
      scale,
      z,
      figLeft: x - FIG_W / 2,
      figTop: y - FIG_H,
      tagLeft: x,
      tagTop: y + TAG_GAP_Y,
      tagZ,
      emojiLeft: x - EMOJI_SIZE / 2,
      emojiTop: Math.max(0, y - FIG_H * scale - EMOJI_LIFT),
    };
  });
}

/** 인라인 style 용 길이: 소수 첫째 자리까지 반올림 + px */
export function px(n: number): string {
  return `${Math.round(n * 10) / 10}px`;
}
