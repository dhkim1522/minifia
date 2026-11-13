// 저녁·아침 [건너뛰기](21페이즈 D-23) — 순수 모듈. 이 파일은 역할을 읽지 않는다(D-22): 누른 사람이 누구인지(Player.skipVote)는 서버 전용이고
// 공개되는 것은 누른 산 사람 수뿐이다. 토론 끝내기(discussion.ts toggleEnd·endReached)와 같은 모양이되 마감 조건이 과반이 아니라 산 사람 중 접속 중인 사람(봇 제외) 모두다.
import type { PhaseId } from "../protocol";
import { isAlive } from "./alive";
import type { VoteError } from "./discussion";
import type { RoomState } from "./room";
import { modeOf, rulesetOf } from "./ruleset";

/** 건너뛰기를 누를 수 있는 단계. 심부름이 있는 판(확장판)에서만 쓰인다. */
export const SKIP_PHASES: readonly PhaseId[] = ["errand", "morning"];

/**
 * 건너뛰기 누르기(on true) / 취소(on false). 마지막 값이 유효하다.
 * 검사 순서가 계약이다(toggleEnd 와 같다): 단계(errand·morning 이 아니거나 심부름이 없는 판이면 누구든 WRONG_PHASE) → 행위자(방에 있고 산 사람, 아니면 BAD_MESSAGE)
 * → 값(불리언, 아니면 BAD_MESSAGE) → 이미 그 상태면 입력 상태 그대로 ok → 그 사람의 skipVote 만 바뀐 새 상태(취소는 키째 지움).
 */
export function toggleSkip(
  state: RoomState,
  actorId: string,
  on: boolean,
): { ok: true; state: RoomState } | { ok: false; error: VoteError } {
  if (!SKIP_PHASES.includes(state.phase) || !rulesetOf(modeOf(state)).errand) return { ok: false, error: "WRONG_PHASE" };
  const actor = state.players.find((p) => p.id === actorId);
  if (!actor || !isAlive(actor)) return { ok: false, error: "BAD_MESSAGE" };
  if (typeof on !== "boolean") return { ok: false, error: "BAD_MESSAGE" };
  if ((actor.skipVote === true) === on) return { ok: true, state };
  return {
    ok: true,
    state: {
      ...state,
      players: state.players.map((p) => {
        if (p.id !== actorId) return p;
        if (on) return { ...p, skipVote: true as const };
        const { skipVote: _skipVote, ...kept } = p;
        return kept;
      }),
    },
  };
}

/** 건너뛰기를 누른 산 사람 수. 죽은 사람의 남은 눌림은 세지 않는다. */
export function skipCountOf(state: RoomState): number {
  return state.players.filter((p) => isAlive(p) && p.skipVote === true).length;
}

/**
 * 막는 사람 = 산 사람 중 봇이 아니고 접속 중인 사람(21-06 이탈 1). 봇은 누르지 않고 접속이 끊긴 사람은 누를 수 없어, 분모에 두면 단계가 끝나지 않는다.
 * 이 사람들이 모두 눌렀을 때(한 명 이상이어야) true. 누른 수 공개 값(skipCountOf)은 그대로 산 사람 전체의 눌림이다.
 */
export function skipReached(state: RoomState): boolean {
  const blockers = state.players.filter((p) => isAlive(p) && p.isBot !== true && p.connected);
  return blockers.length > 0 && blockers.every((p) => p.skipVote === true);
}

/** 모든 skipVote 키를 지운다(새 저녁·새 아침). 지울 것이 없으면 같은 객체. */
export function clearSkip(state: RoomState): RoomState {
  if (!state.players.some((p) => "skipVote" in p)) return state;
  return {
    ...state,
    players: state.players.map((p) => {
      const { skipVote: _skipVote, ...kept } = p;
      return kept;
    }),
  };
}
