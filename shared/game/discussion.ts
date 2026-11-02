// 단계 길이 파생 한 곳 — 공개 단계는 공개 표 수로 정한다(결정 0039). 방장 연장·넘기기는 결정 0017-5 로 없앴다.
// 순수 모듈이다 — 입력 상태는 바꾸지 않는다.
import { PHASE_DEFS, candidateRevealMs } from "./phases";
import type { RoomState } from "./room";

/**
 * 지금 단계의 전체 길이(ms). 단계 표 길이 그대로이고, 길이가 없는 단계는 null. buildView 가 이 함수로 phaseDurationMs 를 만든다.
 * 예외 하나: 후보 선택 공개(candidateVoteReveal)는 그날 공개 투표 기록(voteLog 그날 줄의 cand.votes)의 길이로 candidateRevealMs 를 돌려준다 —
 * 이미 모두에게 공개된 정보에서만 파생하므로 길이로 표가 새지 않는다. 진행 중 후보 선택(candidateVote)은 표 수와 무관하게 표 값이다.
 */
export function phaseDurationOf(state: RoomState): number | null {
  if (state.phase === "candidateVoteReveal") {
    const day = state.day ?? 1;
    const log = state.voteLog ?? [];
    const at = log.map((entry) => entry.n).lastIndexOf(day);
    return candidateRevealMs(at < 0 ? 0 : (log[at]?.cand?.votes.length ?? 0));
  }
  return PHASE_DEFS[state.phase].durationMs;
}

// RED 단계 자리표시자 — 시험이 불러올 수 있게 이름만 둔다. GREEN 커밋이 구현으로 바꾼다.
export function toggleEnd(_state: RoomState, _actorId: string, _on: boolean): { ok: false; error: "WRONG_PHASE" | "BAD_MESSAGE" } {
  return { ok: false, error: "BAD_MESSAGE" };
}
export function endCountOf(_state: RoomState): number {
  return -1;
}
export function endReached(_state: RoomState): boolean {
  return false;
}
export function enterDiscussion(state: RoomState): RoomState {
  return state;
}
