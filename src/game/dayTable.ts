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
//   짧은 장면(P5-3, 05-04): 높이가 TABLE_FIT_MIN_H(299) 미만이면 좌석 원 세로 반지름·캐릭터 배율·테이블 면 높이를 같은 배율 f 로 줄인다
//   (f = (높이 − 이름표 22) / 276.8, 하한 TABLE_FIT_MIN_SCALE). 이름표 글자·높이와 가로 반지름·면 폭은 줄이지 않는다. 지원 하한은 방 높이 516
//   (장면 높이 240)이고, 그 아래에서는 배율이 하한에서 멈춰 맨 뒤 머리 위가 0 에 닿고(머리 우선) 맨 앞 이름표가 장면 아래로 넘칠 수 있다.
//   높이 299 이상의 기하는 한 값도 바뀌지 않는다(f = 1).

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

/**
 * 짧은 장면 압축의 분모(P5-3): 맨 뒤 머리 위에서 맨 앞 발까지의 세로 길이 = 2·SEAT_RY + FIG_H·DEPTH_K0 = 276.8.
 * 장면 높이 H 에 맨 앞 이름표(TAG_H)를 더해 맞추면 f = (H − TAG_H) / 276.8.
 */
export const TABLE_FIT_SPAN = 2 * SEAT_RY + FIG_H * DEPTH_K0;
/**
 * 압축 배율의 하한. 장면 240 = 방 516 − 헤더 119.2 − 패널 157 에서 맨 앞 이름표가 들어가는 배율 (240 − 22)/276.8 ≈ 0.7876 아래로 둔다.
 * UI-SPEC 권장 0.8 은 장면 240 에서 이름표가 3.4px 넘쳐 다르게 둔다(결정 0038). 장면 240 미만에서는 이 값에서 멈춘다.
 */
export const TABLE_FIT_MIN_SCALE = 0.78;

/**
 * 장면 높이에 맞춘 압축 배율. TABLE_FIT_MIN_H 이상이면 1(승인 기하 그대로), 아니면 (높이 − 이름표)/TABLE_FIT_SPAN 을
 * [TABLE_FIT_MIN_SCALE, 1] 로 자른다. 0·음수·NaN(첫 측정 전)도 하한으로 받는다(T-05-09).
 */
export function tableFitScale(sceneH: number): number {
  if (sceneH >= TABLE_FIT_MIN_H) return 1;
  const raw = (sceneH - TAG_H) / TABLE_FIT_SPAN;
  return raw > TABLE_FIT_MIN_SCALE ? Math.min(1, raw) : TABLE_FIT_MIN_SCALE;
}

// 후광·말풍선(결정 0030). 후광은 그림 img 하나의 filter drop-shadow 두 겹이다(안쪽 2px + 바깥 9px, 가우시안 σ = 반지름/2).
// 윤곽 바깥 알파는 4px 에서 0.14, 9px 에서 0.017 이라 보이는 번짐은 9px(배율 0.8~1 적용 7.2~9px)이고, 번짐을 더한 캐릭터 상자는 네 폰 × 1~8명 모두
// 폰 가장자리 안, 위쪽은 장면 높이 299.8 에서도 헤더 아래 안쪽 여백 16px 안이다. 필터는 한 화면 최대 3개(마피아 ≤ 2명 + 차례·선택 1개).
/** 후광 안쪽 층 번짐 반지름(px) */
export const HALO_CORE_BLUR_PX = 2;
/** 후광 바깥 층 번짐 반지름(px) = 보이는 번짐의 끝 */
export const HALO_BLUR_PX = 9;
/** 한 화면에 동시에 켜지는 후광 수의 상한 */
export const HALO_MAX_SIMULTANEOUS = 3;
/** '…' 말풍선: 폭 = 좌우 11×2 + 점 6×3 + 간격 4×2, 높이, 꼬리 높이 */
export const BUBBLE_W = 48;
export const BUBBLE_H = 26;
export const BUBBLE_TAIL = 5;
/** 말풍선이 자리 상자 위로 올라가는 거리(배율 적용). 승인 시안(f12.css)은 30 이지만 8명판 자리 1·7 의 말풍선이 이웃 얼굴을 4.1px 덮어 26 으로 정했다. */
export const BUBBLE_TOP = 26;

export const EMOJI_SIZE = 32;
/** 이모티콘은 머리 위에서 이만큼 더 위에 뜬다 */
export const EMOJI_LIFT = 36;

export interface DayGeometry {
  cx: number;
  cy: number;
  rx: number;
  ry: number;
  /** 짧은 장면 압축 배율(P5-3). 장면 높이 TABLE_FIT_MIN_H 이상이면 1 */
  fit: number;
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
  const left = (sceneW - feltW) / 2;
  if (sceneH >= TABLE_FIT_MIN_H) {
    // 승인 기하(f = 1): 한 값도 바뀌지 않는다.
    const cy = Math.max(SEAT_CY_MIN, Math.min(SEAT_CY, sceneH - FRONT_TAG_BELOW_CY));
    return { cx: sceneW / 2, cy, rx, ry: SEAT_RY, fit: 1, felt: { left, top: cy - FELT_CY_OFFSET, width: feltW, height: FELT_H } };
  }
  // 짧은 장면(P5-3): 세로만 같은 배율 f 로 줄인다. 맨 앞 이름표가 장면 아래끝에 닿게 cy 를 두되, 배율이 하한에서 멈추는 아주 짧은
  // 장면에서는 맨 뒤 머리가 0 에 닿는 값(머리 우선)에서 멈춘다. NaN 높이는 0 으로 본다.
  const h = Number.isFinite(sceneH) ? sceneH : 0;
  const f = tableFitScale(h);
  const ry = SEAT_RY * f;
  const cy = Math.max(ry + FIG_H * DEPTH_K0 * f, h - TAG_H - ry);
  return {
    cx: sceneW / 2,
    cy,
    rx,
    ry,
    fit: f,
    felt: { left, top: cy - FELT_CY_OFFSET * f, width: feltW, height: FELT_H * f },
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
  const { cx, cy, rx, ry, fit } = dayTableGeometry(sceneW, sceneH, pad);
  const ordered = seats.map((s) => s.seat).sort((a, b) => a - b);
  const n = ordered.length;
  const mine = Math.max(0, ordered.indexOf(mySeat));
  return ordered.map((seat, rank) => {
    const slot = (((rank - mine) % n) + n) % n;
    // 화면 좌표는 아래가 +y 라 90° 가 맨 아래다. slot 이 늘면 아래 → 왼쪽 → 위 → 오른쪽(시계 방향).
    const theta = Math.PI / 2 + (slot / n) * Math.PI * 2;
    const depth = (Math.sin(theta) + 1) / 2;
    const scale = (DEPTH_K0 + (1 - DEPTH_K0) * depth) * fit;
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
