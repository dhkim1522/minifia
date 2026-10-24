// 낮 화면 고정 테이블 배치(결정 0017-1). DOM·window 를 쓰지 않는 순수 함수라 unit 테스트가 직접 부른다.
//
// 공식은 승인 시안 9차(design/screens/day-v3/R9-*.dc.html 의 좌석 계산 스크립트, SPEC.md "테이블과 좌석")를 그대로 옮겼다.
// - 테이블 면과 좌석 원은 인원과 상관없이 하나로 고정이다. 장면 폭에 따라 가로 반지름만 줄인다(글자·캐릭터·장면은 배율로 줄이지 않는다).
// - 캐릭터 상자·이름표·이모티콘은 모두 같은 (x, y)(발 위치)에서 계산한다. 떠 있는 층을 따로 가두는(clamp) 계산은 없다.
// - 세로: 장면 높이가 시안보다 짧은 실제 폰(주소창·툴바)에서는 테이블 전체(면과 좌석 원)를 같은 만큼 올린다.
//   그러면 테이블과 좌석의 관계는 그대로이고, 맨 앞 이름표가 장면 안에 든다(높이 TABLE_FIT_MIN_H 이상).

/** 시안 기준 장면 크기: 폭 366(390 폭 폰), 높이 407(390×664 에서 헤더 100·하단 157 을 뺀 값). 재지 못할 때의 기본값. */
export const DAY_SCENE_W = 366;
export const DAY_SCENE_H = 407;
/** 이 폭보다 좁은 장면(360 폰의 352)에서는 가로 반지름과 테이블 면을 줄인다. */
export const NARROW_SCENE_BELOW = 366;

export const SEAT_RX = 132;
export const SEAT_RX_NARROW = 124;
export const SEAT_RY = 100;
/** 좌석 원 세로 중심의 최대(시안 크기). 장면이 충분히 높으면 늘 이 값이다. */
export const SEAT_CY = 210;
/** 세로 중심의 최소. 맨 뒤 캐릭터 머리 위(cy − ry − 96·0.8 = cy − 176.8)가 0 아래로 나가지 않는 값. */
export const SEAT_CY_MIN = 177;
/** 이 높이부터 맨 앞 이름표 아래 끝(cy + ry + 3 + 46 = cy + 149)이 장면 안이다: SEAT_CY_MIN + 149. */
export const TABLE_FIT_MIN_H = 326;
/** 맨 앞 이름표 아래 끝까지의 거리: ry 100 + 이름표 간격 3 + 이름표 높이 46. */
const FRONT_TAG_BELOW_CY = 149;

/** 테이블 면 위 = cy − 60 (cy 210 에서 150). */
export const FELT_CY_OFFSET = 60;
export const FELT_W = 280;
export const FELT_W_NARROW = 264;
export const FELT_H = 108;
export const FELT_TOP = 150;

export const FIG_W = 72;
export const FIG_H = 96;
/** 맨 뒤 자리의 배율 */
export const DEPTH_K0 = 0.8;
/** 이름표 위 = 발 y + 3 */
export const TAG_GAP_Y = 3;
/** 이름표 두 줄 높이: 22 + 간격 2 + 22 */
export const TAG_H = 46;
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

/** 장면 폭·높이에서 나오는 고정 테이블 기하. 인원과 무관하다. */
export function dayTableGeometry(sceneW: number, sceneH: number = DAY_SCENE_H): DayGeometry {
  const narrow = sceneW < NARROW_SCENE_BELOW;
  const feltW = narrow ? FELT_W_NARROW : FELT_W;
  const cy = Math.max(SEAT_CY_MIN, Math.min(SEAT_CY, sceneH - FRONT_TAG_BELOW_CY));
  return {
    cx: sceneW / 2,
    cy,
    rx: narrow ? SEAT_RX_NARROW : SEAT_RX,
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
): DaySeatPlace[] {
  const { cx, cy, rx, ry } = dayTableGeometry(sceneW, sceneH);
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
    const z = Math.round(depth * 10);
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
      tagZ: z + 20,
      emojiLeft: x - EMOJI_SIZE / 2,
      emojiTop: Math.max(0, y - FIG_H * scale - EMOJI_LIFT),
    };
  });
}

/** 인라인 style 용 길이: 소수 첫째 자리까지 반올림 + px */
export function px(n: number): string {
  return `${Math.round(n * 10) / 10}px`;
}
