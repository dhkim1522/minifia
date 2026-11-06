// 12-08: 컴포넌트 → 소리 감독의 닫힌 로컬 신호 (D-3, LS-7).
// 컴포넌트는 소리를 고르지 않는다: 신호 종류만 보내고 어떤 소리를·낼지 말지는 감독이 정한다.
// 신호 인자에는 선택값·역할·좌석이 없다. 새 종류(12-09·12-10: card · deny · vote · emote)는 SIGNAL_KINDS 와 LocalSignal 에 더한다.

/** 닫힌 신호 종류 */
export const SIGNAL_KINDS = ["tap"] as const;
export type SignalKind = (typeof SIGNAL_KINDS)[number];

/** 주요 버튼이 눌렸다 — 인자 없음 */
export interface TapSignal {
  kind: "tap";
}
export type LocalSignal = TapSignal;

type Handler = (signal: LocalSignal) => void;

let bound: Handler | null = null;

/** 방 화면이 마운트된 동안 신호를 받을 처리기를 건다. 돌려주는 함수는 자기가 건 처리기만 푼다 */
export function bindSignals(handler: Handler): () => void {
  bound = handler;
  return () => {
    if (bound === handler) bound = null;
  };
}

/** 신호를 보낸다. 바인딩이 없으면(홈 화면 등) 아무 일도 없다. 처리기가 던져도 눌림을 막지 않는다 */
export function emitSignal(signal: LocalSignal): void {
  if (bound === null) return;
  try {
    bound(signal);
  } catch {
    // 소리 쪽 실패가 버튼 동작을 막지 않는다.
  }
}
