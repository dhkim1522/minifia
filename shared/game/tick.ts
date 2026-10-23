// 순수 단계 진행. 시각은 인자 now(호출자인 방 Durable Object 의 서버 시각) 하나뿐이다 —
// 이 파일은 현재 시각을 스스로 읽지 않고, 클라이언트가 보낸 값도 받지 않는다.
// 연결 여부·인원은 보지 않는다: 끊긴 사람을 기다리지 않고 서버 시각대로 진행한다(D-18).
import { PHASE_DEFS } from "./phases";
import type { RoomState } from "./room";

/**
 * 마감이 지난 단계를 다음 단계로 넘긴다. 새 마감은 now 가 아니라 "이전 마감 + 다음 단계 길이" 로 연쇄 계산해,
 * 알람이 늦게 와도 마감이 밀리지 않고 모든 폰이 같은 마감 시각을 받는다(GAME-01).
 * 늦게 불리면 여러 단계를 한 번에 따라잡는다. 바뀐 게 없으면 입력 객체를 그대로 돌려준다.
 */
export function tick(state: RoomState, now: number): RoomState {
  let phase = state.phase;
  let phaseEndsAt = state.phaseEndsAt;
  while (phaseEndsAt !== null && now >= phaseEndsAt) {
    const next = PHASE_DEFS[phase].next;
    if (next === null) break;
    const duration = PHASE_DEFS[next].durationMs;
    phase = next;
    phaseEndsAt = duration === null ? null : phaseEndsAt + duration;
  }
  if (phase === state.phase && phaseEndsAt === state.phaseEndsAt) return state;
  return { ...state, phase, phaseEndsAt };
}

/** DO 알람 하나로 단계 마감과 방 만료를 함께 다룬다. */
export function nextWakeAt(state: RoomState): number {
  return Math.min(state.phaseEndsAt ?? Number.POSITIVE_INFINITY, state.expiresAt);
}
