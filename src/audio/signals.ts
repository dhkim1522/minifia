// 12-08: 컴포넌트 → 소리 감독의 닫힌 로컬 신호 (D-3, LS-7).
// 컴포넌트는 소리를 고르지 않는다: 신호 종류만 보내고 어떤 소리를·낼지 말지는 감독이 정한다.
// 신호 인자에는 선택값·역할·좌석이 없다. 새 종류는 SIGNAL_KINDS 와 LocalSignal 에 더한다.

import type { EmoteId } from "../../shared/protocol";

/** 닫힌 신호 종류 */
export const SIGNAL_KINDS = ["tap", "card", "tensionCue", "vote", "deny", "emote", "result"] as const;
export type SignalKind = (typeof SIGNAL_KINDS)[number];

/** 주요 버튼이 눌렸다 — 인자 없음 */
export interface TapSignal {
  kind: "tap";
}
/** 카드(유언·쪽지)가 화면에 보일 시각까지 남은 ms(숫자만 — 카드의 종류·글은 싣지 않는다, LS-5) */
export interface CardSignal {
  kind: "card";
  delayMs: number;
}
/** 시민 편 긴장 맥박의 큐 한 번(TensionVignette onCue) — 인자 없음. 시각과 소리의 박자를 맞춘다 (D-11) */
export interface TensionCueSignal {
  kind: "tensionCue";
}
/** 찬반을 골랐거나 바꿨다 — 값이 없다: 찬성·반대가 같은 신호이고 같은 소리다 (12-10, LS-7) */
export interface VoteSignal {
  kind: "vote";
}
/** 거절 알림(토스트)이 떴다 — 인자 없음 (12-10) */
export interface DenySignal {
  kind: "deny";
}
/**
 * 받은 동작 프레임 하나(12-10, LS-4). 방 화면의 emote 프레임 처리에서만 나간다 — 받지 못한 프레임은 신호도 없다.
 * id 는 공개 동작 이름이고 mine 은 내 동작인가(불리언). 좌석·시각·채널은 싣지 않는다.
 */
export interface EmoteSignal {
  kind: "emote";
  id: EmoteId;
  mine: boolean;
}
/**
 * 결과 화면 시계가 낸 사건 하나(12-11, D-15). ResultScreen 이 단계·뒤집힘 수·패 index 를 바꾸는 바로 그 자리에서 한 번 나간다 —
 * 건너뛴 사건은 신호도 없고 재접속·처음 마운트(연출 없는 마운트)는 신호가 없다. 인자는 정수·불리언뿐이다(좌석·직업·닉네임·칭호 id 없음, LS-6).
 *   flip: i 번째 뒤집기(0 기준) · light: 이긴 팀 조명(win = 내 팀이 이겼나) · plate: k 번째 패(총 total 개)
 */
export type ResultSignal =
  | { kind: "result"; step: "flip"; i: number }
  | { kind: "result"; step: "light"; win: boolean }
  | { kind: "result"; step: "plate"; k: number; total: number };
export type LocalSignal = TapSignal | CardSignal | TensionCueSignal | VoteSignal | DenySignal | EmoteSignal | ResultSignal;

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
