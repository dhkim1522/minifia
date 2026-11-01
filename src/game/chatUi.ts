// 채팅 패널 치수와 클라이언트 시각 상수 한 곳 (07-UI-SPEC "구조" 표 · "머리 위 입력 중" · "보내기·제한·막힘").
// DOM 을 읽지 않는 상수와 순수 함수뿐이다 — 카메라 시험과 E2E 사본이 이 파일을 가져온다.
//
// 부르는 쪽 규칙: LOG_H 는 화면을 처음 그릴 때와 방향이 바뀔 때만 정한다. 키보드나 주소창으로 높이가 바뀌어도
// 다시 정하지 않는다(포커스 중 값 동결, UI-SPEC 기록 칸 고정). 키보드 열림 판정과 72 줄이기도 부르는 쪽이 한다.

/** 기록 칸 고정 높이: 방 높이 < 780 */
export const LOG_H_SHORT = 96;
/** 기록 칸 고정 높이: 방 높이 ≥ 780 */
export const LOG_H_TALL = 152;
/** 키보드가 열렸을 때 기록 칸 높이 */
export const LOG_H_KB = 72;
/** 이 높이 이상인 방은 긴 기록 칸을 쓴다 */
export const TALL_ROOM_MIN_H = 780;

/** 로비 패널 = LOG_H + 154 = 14 + LOG_H + 8 + 48(입력줄) + 10 + 52(행동 줄) + 22 */
export const LOBBY_PANEL_EXTRA = 154;
/** 테이블 패널 = LOG_H + 92 = 14 + LOG_H + 8 + 48 + 22 */
export const TABLE_PANEL_EXTRA = 92;
/** 키보드 열림 패널 = 14 + 72 + 8 + 48 + 8(아래 여백, 안전 영역 없음) */
export const KB_PANEL_H = 150;
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
/** 기록 칸 바닥에서 이 거리 안이면 맨 아래에 있다고 보고 새 줄을 따라간다 */
export const AUTO_SCROLL_SLOP_PX = 24;
/** 화면이 들고 있는 기록 줄 수 상한 */
export const CHAT_KEEP_LINES = 100;

/** 기록 칸 고정 높이 — 방 높이로 한 번 정한다 */
export function logHeightFor(roomH: number): number {
  return roomH >= TALL_ROOM_MIN_H ? LOG_H_TALL : LOG_H_SHORT;
}

export function lobbyPanelHeight(logH: number): number {
  return logH + LOBBY_PANEL_EXTRA;
}

export function tablePanelHeight(logH: number): number {
  return logH + TABLE_PANEL_EXTRA;
}
