// 채팅 패널 치수와 클라이언트 시각 상수 한 곳 (07-UI-SPEC "구조" 표 · "머리 위 입력 중" · "보내기·제한·막힘").
// DOM 을 읽지 않는 상수와 순수 함수뿐이다 — 카메라 시험과 E2E 사본이 이 파일을 가져온다.
//
// 부르는 쪽 규칙: 접힌 기록 칸 높이는 LOG_H 한 값이다 — 화면이 방 높이·키보드로 고르지 않는다. 지난 기록은 눌러서
// 제자리에서 위로 늘린다(0083-4): 늘어난 높이는 openLogHeight 한 식이고, 화면은 같은 식을 CSS clamp 로 그린다
// (scripts/e2e/polish.mjs 의 사본과 test/unit/e2eContract.test.ts 가 같은 값임을 고정한다). 키보드 열림 판정은
// 부르는 쪽이 한다(행동 줄 숨김·패널 올림).

/** 채팅 기록 칸의 기본 높이. 로비와 이전 지도 단계는 눌러서 기록 칸을 늘린다(0083-4). */
export const LOG_H = 68;
/** 이름·아바타·한 줄 말풍선을 세 건 읽을 수 있는 공용 방 채팅 기록 높이 */
export const DISCUSSION_LOG_H = 144;
/** 짧은 화면의 기록 기본 높이와 헤더·도구·맵 여유를 포함한 예약 높이. */
export const DISCUSSION_SHORT_LOG_H = 116;
export const DISCUSSION_VIEWPORT_ALLOWANCE = 480;
/** 토론에서 키보드 위에 고정하는 기록 칸 높이 */
export const DISCUSSION_KB_LOG_H = 42;
/** 토론 패널의 기록 칸 밖 높이 = 도구 66, 입력 간격 8 + 입력 44 + 패널 안쪽 8 + 바깥 여백 4 */
export const DISCUSSION_PANEL_EXTRA = 130;

/** 채팅 패널의 기록 칸 밖 높이 = 위 여백 14 + 입력 간격 8 + 입력줄 48 + 아래 여백 22 */
export const CHAT_PANEL_EXTRA = 92;
/** 대기실의 기록·입력줄은 모든 참가자에게 같은 높이로 고정한다. */
export const LOBBY_PANEL_EXTRA = CHAT_PANEL_EXTRA;
/** 키보드 열림 패널에서 기록 칸 밖의 높이 = 14 + 8 + 48 + 8(아래 여백, 안전 영역 없음) */
export const KB_PANEL_REST = 78;
/** 키보드 열림 패널 = LOG_H + KB_PANEL_REST. 기록 칸이 늘어날 자리가 없을 때의 값이다(늘어나면 KB_PANEL_REST + openLogHeight) */
export const KB_PANEL_H = LOG_H + KB_PANEL_REST;
/** 늘어난 기록 칸 높이의 상한(승인 시안 n3 의 300) */
export const LOG_OPEN_MAX = 300;
/** 늘어난 기록 칸 위, 띠 아래에 남기는 스테이지 최소 높이. 이 한 줄이 늘어남과 스테이지의 비율이다 */
export const OPEN_STAGE_MIN = 120;
/** 키보드 열림 판정: 입력칸에 포커스가 있고 lift 가 이 값을 넘을 때 */
export const KB_OPEN_MIN_LIFT = 80;
/** 머리 위 입력 중 알약이 스택을 늘리는 높이(알약 약 18 + 이름표와 간격 4) */
export const TYPING_PILL_H = 22;

/** 보낸 직후 보내기가 흐려지는 시간 */
export const SEND_DIM_MS = 600;
/** 막힘 알림이 떠 있는 시간 */
export const NOTICE_MS = 2500;
/** 마지막 입력 중 신호 뒤 이 시간이 지나면 꺼진다(다른 사람 머리 위) */
export const TYPING_EXPIRE_MS = 4500;
/** 마지막 입력 변화 뒤 이 시간이 지나면 내 입력 중을 끈다 */
export const TYPING_IDLE_OFF_MS = 4000;
/** 입력이 계속되면 켜짐을 이 간격 이상으로 다시 보낸다 */
export const TYPING_REFRESH_MS = 2000;
/** 조합 중 보내기를 누르면 compositionend 를 기다리는 최대 시간 */
export const IME_WAIT_MS = 100;
/** 같은 문장이 이 시간 안에 다시 제출되면 무시한다 */
export const DUP_SUBMIT_MS = 300;
/** 보낸 직후 이 시간 안에 끝난 조합이 보낸 문장의 끝부분이면 되살아난 꼬리 글자로 보고 비운다(가정 A2) */
export const TAIL_WINDOW_MS = 500;
/** 늘어난 기록 칸 바닥에서 이 거리 안이면 맨 아래에 있다고 보고 새 줄을 따라간다 */
export const AUTO_SCROLL_SLOP_PX = 24;
/** 기록 칸 위쪽 사라지는 그라데이션 높이(18.1 UI-SPEC Spacing 예외 12). 두 줄 창에서 잘린 줄이 어색하지 않게 */
export const LOG_FADE_H = 12;
/** 화면이 들고 있는 기록 줄 수 상한 */
export const CHAT_KEEP_LINES = 100;

/** 대기실 패널 높이. 방장·참가자가 같다(기록 칸 68 일 때 160). E2E 사본(scripts/e2e/lib.mjs)이 같은 식이다 */
export function lobbyPanelHeight(logH: number): number {
  return logH + LOBBY_PANEL_EXTRA;
}

/** 화면 높이가 줄 때 기록을 먼저 줄여 이동 스테이지의 안전 공간을 확보한다. */
export function discussionLogHeight(roomH: number): number {
  return Math.min(DISCUSSION_LOG_H, Math.max(DISCUSSION_SHORT_LOG_H, roomH - DISCUSSION_VIEWPORT_ALLOWANCE));
}

/**
 * 늘어난 기록 칸 높이(0083-4) = clamp(LOG_H, 방 높이 − 키보드 올림 − 띠 아랫변 − OPEN_STAGE_MIN − 패널의 기록 칸 밖 높이, LOG_OPEN_MAX).
 * 자리가 없는 폰은 LOG_H 그대로다. 결과는 정수.
 */
export function openLogHeight(input: { roomH: number; lift: number; hostBottom: number; panelRest: number }): number {
  const room = input.roomH - input.lift - input.hostBottom - OPEN_STAGE_MIN - input.panelRest;
  return Math.round(Math.min(LOG_OPEN_MAX, Math.max(LOG_H, room)));
}
