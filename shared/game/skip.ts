// 건너뛰기(21페이즈 D-21·D-23, 결정 0088): 원인 흐름 확장판의 저녁(errand)·아침(morning)에서 산 사람이 [건너뛰기]를 누르고, 산 사람 과반이 누르면 서버가 그 단계를 곧바로 마감한다.
// 토론 끝내기(discussion.ts 의 toggleEnd·endCountOf·endReached)와 같은 모양이다 — 과반 기준도 같은 majorityOf 한 곳이다(전원 기준으로 바꾸려면 skipReached 한 줄).
// 공개 값은 누른 수(day.skipCount)뿐이고 누가 눌렀는지는 서버 전용(Player.skipVote)이다 — 본인 값만 me.skip 으로 간다.
// 표는 저녁·아침 진입(tick.ts 훅 표)에서 clearSkip 이 모든 사람에게서 키째 지운다 — 저녁 표가 아침으로 새지 않는다.
// 순수 모듈이다 — 입력 상태는 바꾸지 않고, 시각·난수를 읽지 않는다.
import { isAlive } from "./alive";
import type { VoteError } from "./discussion";
import { majorityOf } from "./nomination";
import type { RoomState } from "./room";
import { modeOf, rulesetOf } from "./ruleset";

/**
 * 건너뛰기 누르기(on true) / 취소(on false). 마지막 값이 유효하다.
 * 검사 순서가 계약이다(toggleEnd 와 같다): 단계(원인 흐름의 errand·morning 이 아니면 누구든 WRONG_PHASE) → 행위자(방에 있고 산 사람, 아니면 BAD_MESSAGE)
 * → 값(불리언, 아니면 BAD_MESSAGE) → 이미 그 상태면 입력 상태 그대로 ok → 그 사람의 skipVote 만 바뀐 새 상태(취소는 키째 지움).
 */
export function toggleSkip(
  state: RoomState,
  actorId: string,
  on: boolean,
): { ok: true; state: RoomState } | { ok: false; error: VoteError } {
  if (!rulesetOf(modeOf(state)).cause || (state.phase !== "errand" && state.phase !== "morning")) return { ok: false, error: "WRONG_PHASE" };
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

/** 건너뛰기를 누른 산 사람 수. 죽은 사람의 남은 표는 세지 않는다. */
export function skipCountOf(state: RoomState): number {
  return state.players.filter((p) => isAlive(p) && p.skipVote === true).length;
}

/** 누른 수가 산 사람 수의 과반(majorityOf)에 닿았는가 — 토론 끝내기와 같은 기준이다(결정 0088). */
export function skipReached(state: RoomState): boolean {
  return skipCountOf(state) >= majorityOf(state.players.filter(isAlive).length);
}

/** 모든 사람의 skipVote 를 키째 지운다(저녁·아침 진입 훅). 지울 것이 없으면 입력 그대로다. */
export function clearSkip(state: RoomState): RoomState {
  if (!state.players.some((p) => Object.hasOwn(p, "skipVote"))) return state;
  return {
    ...state,
    players: state.players.map((p) => {
      if (!Object.hasOwn(p, "skipVote")) return p;
      const { skipVote: _skipVote, ...kept } = p;
      return kept;
    }),
  };
}
