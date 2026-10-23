// 순수 단계 진행. 시각은 인자 now(호출자인 방 Durable Object 의 서버 시각) 하나뿐이다 —
// 이 파일은 현재 시각을 스스로 읽지 않고, 클라이언트가 보낸 값도 받지 않는다.
// 연결 여부·인원은 보지 않는다: 끊긴 사람을 기다리지 않고 서버 시각대로 진행한다(D-05, D-18).
//
// 진입 훅 표(ON_ENTER)의 규칙: 어떤 단계에 들어갈 때 일어나야 하는 상태 변화는 이 표에 한 줄로 둔다.
// 훅은 tick 루프 안에서만 부른다 — 알람이 늦어 여러 단계를 한 번에 따라잡아도 중간 단계 훅이 순서대로 모두 돈다.
// 알람 핸들러나 DO 에서 훅을 직접 부르지 않는다. 3·4페이즈도 같은 표에 행을 더한다.
import type { PhaseId } from "../protocol";
import { enterClaim, enterClaimReveal } from "./claim";
import { PHASE_DEFS } from "./phases";
import type { RoomState } from "./room";

/** 낮 시작 발표 진입: 일차 +1, 이번 낮 메시지 비움, 연장 사용 여부 초기화(D-15, D-18, D-19). nextMessageSeq 는 건드리지 않는다. */
export function enterDayAnnounce(state: RoomState): RoomState {
  return { ...state, day: (state.day ?? 0) + 1, messages: [], extendUsed: false };
}

const ON_ENTER: Partial<Record<PhaseId, (s: RoomState) => RoomState>> = {
  dayAnnounce: enterDayAnnounce,
  claim: enterClaim,
  claimReveal: enterClaimReveal,
};

/**
 * 마감이 지난 단계를 다음 단계로 넘긴다. 새 마감은 now 가 아니라 "이전 마감 + 다음 단계 길이" 로 연쇄 계산해,
 * 알람이 늦게 와도 마감이 밀리지 않고 모든 폰이 같은 마감 시각을 받는다(GAME-01).
 * 늦게 불리면 여러 단계를 한 번에 따라잡는다. 바뀐 게 없으면 입력 객체를 그대로 돌려준다.
 */
export function tick(state: RoomState, now: number): RoomState {
  let current = state;
  while (current.phaseEndsAt !== null && now >= current.phaseEndsAt) {
    const next = PHASE_DEFS[current.phase].next;
    if (next === null) break;
    const duration = PHASE_DEFS[next].durationMs;
    const entered: RoomState = {
      ...current,
      phase: next,
      phaseEndsAt: duration === null ? null : current.phaseEndsAt + duration,
    };
    const hook = ON_ENTER[next];
    current = hook ? hook(entered) : entered;
  }
  return current;
}

/** DO 알람 하나로 단계 마감과 방 만료를 함께 다룬다. */
export function nextWakeAt(state: RoomState): number {
  return Math.min(state.phaseEndsAt ?? Number.POSITIVE_INFINITY, state.expiresAt);
}
