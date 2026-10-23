// 낮 토론 방장 조작(DAY-01): 연장(낮마다 한 번)·넘기기(언제든)와 연장을 반영한 단계 길이 파생.
// 순수 모듈이다 — 시각은 인자 now 로만 받고, 입력 상태는 바꾸지 않는다.
//
// 알람 재설정은 호출자(DO)의 몫이다 — 마감이 바뀌는 두 함수(extendDiscussion·skipDiscussion) 뒤에 반드시 reschedule 한다(Pitfall 4).
// 방장 판정은 서버 상태의 hostId 와 인자 actorId 로만 한다 — 화면에서 버튼을 숨기는 것과 별개로 서버 규칙이 거부한다(T-02-10).
// 검사 순서가 계약이다: NOT_HOST → WRONG_PHASE → (연장만) ALREADY_EXTENDED. checkStart·kickPlayer 와 같은 순서다.
import { EXTEND_MS, PHASE_DEFS } from "./phases";
import type { RoomState } from "./room";
import { tick } from "./tick";

export type DiscussionError = "NOT_HOST" | "WRONG_PHASE" | "ALREADY_EXTENDED";

/** 방장이 낮 토론을 30초 늘린다. 이번 낮 이미 썼으면 ALREADY_EXTENDED(다음 낮 시작 발표 진입에서 다시 쓸 수 있다). */
export function extendDiscussion(
  state: RoomState,
  actorId: string,
): { ok: true; state: RoomState } | { ok: false; error: DiscussionError } {
  if (actorId !== state.hostId) return { ok: false, error: "NOT_HOST" };
  if (state.phase !== "discussion" || state.phaseEndsAt === null) return { ok: false, error: "WRONG_PHASE" };
  if (state.extendUsed === true) return { ok: false, error: "ALREADY_EXTENDED" };
  return { ok: true, state: { ...state, phaseEndsAt: state.phaseEndsAt + EXTEND_MS, extendUsed: true } };
}

/**
 * 방장이 토론을 바로 끝낸다. 마감을 now 로 놓고 tick 을 거쳐 일반 전이 경로(진입 훅 포함)를 그대로 쓴다 —
 * 별도 전이 코드를 만들지 않는다. 다음 마감(now + DAY_ANNOUNCE_MS)은 "이전 마감 + 다음 단계 길이" 연쇄 규칙으로 나온다. 확인 단계 없음(D-18).
 */
export function skipDiscussion(
  state: RoomState,
  actorId: string,
  now: number,
): { ok: true; state: RoomState } | { ok: false; error: "NOT_HOST" | "WRONG_PHASE" } {
  if (actorId !== state.hostId) return { ok: false, error: "NOT_HOST" };
  if (state.phase !== "discussion") return { ok: false, error: "WRONG_PHASE" };
  return { ok: true, state: tick({ ...state, phaseEndsAt: now }, now) };
}

/**
 * 지금 단계의 전체 길이(ms). 단계 표 길이에 discussion 이면서 연장했을 때만 EXTEND_MS 를 더한다. 길이가 없는 단계는 null.
 * 02-04 의 buildView 가 이 함수로 phaseDurationMs 를 만든다.
 */
export function phaseDurationOf(state: RoomState): number | null {
  const base = PHASE_DEFS[state.phase].durationMs;
  if (base === null) return null;
  return state.phase === "discussion" && state.extendUsed === true ? base + EXTEND_MS : base;
}
