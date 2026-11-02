// 단계 길이 파생 한 곳 — 공개 단계는 공개 표 수로 정한다(결정 0039). 방장 연장·넘기기는 결정 0017-5 로 없앴다.
// 8페이즈(결정 0060-2): 토론 끝내기(toggleEnd·endCountOf·endReached)와 낮 시작 청소(enterDiscussion)도 여기다.
// 청소는 discussion 진입 한 곳 — 지난 낮의 verdict·execution 과 개인 키(nominate·verdictVote·endVote)가 다음 낮에 새지 않게 한다(RESEARCH Pitfall 1).
// 이 계획은 tick 표에 걸지 않는다(흐름 전환은 08-11).
// 순수 모듈이다 — 입력 상태는 바꾸지 않는다.
import { isAlive } from "./alive";
import { majorityOf } from "./nomination";
import { PHASE_DEFS, candidateRevealMs } from "./phases";
import type { RoomState } from "./room";

/** 낮 투표류 규칙 함수(토론 끝내기·지목·찬반)의 거부 코드. 단계가 아니면 WRONG_PHASE, 그 밖의 잘못된 입력은 BAD_MESSAGE. */
export type VoteError = "WRONG_PHASE" | "BAD_MESSAGE";

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

/**
 * 토론 끝내기 누르기(on true) / 취소(on false). 마지막 값이 유효하다.
 * 검사 순서가 계약이다: 단계(discussion 아니면 누구든 WRONG_PHASE) → 행위자(방에 있고 산 사람, 아니면 BAD_MESSAGE)
 * → 값(불리언, 아니면 BAD_MESSAGE) → 이미 그 상태면 입력 상태 그대로 ok → 그 사람의 endVote 만 바뀐 새 상태(취소는 키째 지움).
 */
export function toggleEnd(
  state: RoomState,
  actorId: string,
  on: boolean,
): { ok: true; state: RoomState } | { ok: false; error: VoteError } {
  if (state.phase !== "discussion") return { ok: false, error: "WRONG_PHASE" };
  const actor = state.players.find((p) => p.id === actorId);
  if (!actor || !isAlive(actor)) return { ok: false, error: "BAD_MESSAGE" };
  if (typeof on !== "boolean") return { ok: false, error: "BAD_MESSAGE" };
  if ((actor.endVote === true) === on) return { ok: true, state };
  return {
    ok: true,
    state: {
      ...state,
      players: state.players.map((p) => {
        if (p.id !== actorId) return p;
        if (on) return { ...p, endVote: true as const };
        const { endVote: _endVote, ...kept } = p;
        return kept;
      }),
    },
  };
}

/** 토론 끝내기를 누른 산 사람 수. 누가 눌렀는지는 서버 전용이고 공개 값은 이 개수뿐이다. 죽은 사람의 남은 표는 세지 않는다. */
export function endCountOf(state: RoomState): number {
  return state.players.filter((p) => isAlive(p) && p.endVote === true).length;
}

/** 누른 수가 산 사람 수의 과반(majorityOf)에 닿았는가. */
export function endReached(state: RoomState): boolean {
  return endCountOf(state) >= majorityOf(state.players.filter(isAlive).length);
}

/**
 * discussion 진입 훅: 지난 낮의 verdict·execution 과 모든 플레이어의 nominate·verdictVote·endVote 를 키째 지운다.
 * 날짜별 기록(voteLog)과 그 밖의 키는 그대로 둔다.
 */
export function enterDiscussion(state: RoomState): RoomState {
  const { verdict: _verdict, execution: _execution, ...rest } = state;
  return {
    ...rest,
    players: state.players.map((p) => {
      const { nominate: _nominate, verdictVote: _verdictVote, endVote: _endVote, ...kept } = p;
      return kept;
    }),
  };
}
