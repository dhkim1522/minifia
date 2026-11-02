// 찬반 규칙. 순수 모듈이다 — 현재 시각·난수를 읽지 않고, 입력 상태는 바꾸지 않는다(결정 0053·0060-4, DAY-06).
// 분모 규칙: 유권자 E = 변론자를 뺀 산 사람 수, 찬성 × 2 > E 면 통과한다. v1.0 resolveExecVote 의 '던진 표 분모' 와 다르다 —
// 못 던진 사람은 기권이고 분모에는 들어 있다(8명이면 E 7, 찬성 4 는 통과, 3 은 부결).
// 결정 0053: 찬반은 익명이다. 개인 표(Player.verdictVote)는 서버 전용이고 뷰 허용 목록에 없으며,
// 마감 훅(resolveVerdict)이 집계 직후 키째 지운다 — 익명을 뷰 코드가 아니라 "데이터가 없다" 는 사실로 지킨다.
// 마감 시각은 건드리지 않는다: 모두가 일찍 던져도 10초를 다 채운다(조기 종료 없음, 사용자 확정 2026-11-02).
import { isAlive } from "./alive";
import type { Player, RoomState } from "./room";
import type { DeadlineResult } from "./tick";
import type { VoteError } from "./discussion";

/** 유권자: 산 사람 중 변론자(state.verdict.candidate)를 뺀 사람. 변론자가 없으면 산 사람 전원이다. */
export function verdictVotersOf(state: RoomState): Player[] {
  const defender = state.verdict?.candidate;
  return state.players.filter((p) => isAlive(p) && p.seat !== defender);
}

/**
 * 찬반 한 표(찬성 true / 반대 false). 마지막 값이 유효하다(번복 가능).
 * 검사 순서가 계약이다: 단계(verdict 아니면 누구든 WRONG_PHASE) → 행위자(방에 있고 산 사람, 아니면 BAD_MESSAGE)
 * → 변론자 본인이면 BAD_MESSAGE → 값(불리언, 아니면 BAD_MESSAGE) → 같은 값이면 입력 상태 그대로 ok
 * → 그 사람의 verdictVote 만 바뀐 새 상태.
 */
export function castVerdict(
  state: RoomState,
  actorId: string,
  agree: boolean,
): { ok: true; state: RoomState } | { ok: false; error: VoteError } {
  if (state.phase !== "verdict") return { ok: false, error: "WRONG_PHASE" };
  const actor = state.players.find((p) => p.id === actorId);
  if (!actor || !isAlive(actor)) return { ok: false, error: "BAD_MESSAGE" };
  if (actor.seat === state.verdict?.candidate) return { ok: false, error: "BAD_MESSAGE" };
  if (typeof agree !== "boolean") return { ok: false, error: "BAD_MESSAGE" };
  if (actor.verdictVote === agree) return { ok: true, state };
  return {
    ok: true,
    state: { ...state, players: state.players.map((p) => (p.id === actorId ? { ...p, verdictVote: agree } : p)) },
  };
}

/** 유권자 안의 찬성·반대 수와 유권자 수. 유령·변론자의 남은 값과 못 던진 사람(undefined)은 어느 쪽에도 세지 않는다. */
export function verdictTallyOf(state: RoomState): { yes: number; no: number; voters: number } {
  const voters = verdictVotersOf(state);
  let yes = 0;
  let no = 0;
  for (const p of voters) {
    if (p.verdictVote === true) yes += 1;
    else if (p.verdictVote === false) no += 1;
  }
  return { yes, no, voters: voters.length };
}

/** 찬반을 던진 유권자 좌석(오름차순). 값은 싣지 않는다 — 화면이 '투표 마침' 만 보여 주는 재료다. */
export function votedSeatsOf(state: RoomState): number[] {
  return verdictVotersOf(state)
    .filter((p) => p.verdictVote !== undefined)
    .map((p) => p.seat)
    .sort((a, b) => a - b);
}

/**
 * verdict 마감 훅(결정 0053-3·0060-4). 판정: 찬성 × 2 > E 면 통과, 아니면 부결(0표·E 0 도 부결).
 * 그날 voteLog 줄의 exec 를 {yes, no, passed} 로 채운다(지목 마감이 줄을 만들었다 — 줄이 없으면 voteLog 는 그대로 둔다).
 * verdict 상태는 후보를 유지하고 passed 를 정한다. 집계 직후 모든 플레이어의 verdictVote 키를 구조 분해로 지운다.
 * 다음 단계는 표의 기본(execution) — 부결이어도 처형 단계가 결과 발표를 맡는다(결정 0060).
 */
export function resolveVerdict(state: RoomState): DeadlineResult {
  const { yes, no, voters } = verdictTallyOf(state);
  const passed = yes * 2 > voters;
  const players = state.players.map((p) => {
    const { verdictVote: _verdictVote, ...kept } = p;
    return kept;
  });
  const day = state.day ?? 1;
  const log = state.voteLog ?? [];
  const at = log.map((entry) => entry.n).lastIndexOf(day);
  const voteLog =
    at < 0 ? state.voteLog : log.map((entry, i) => (i === at ? { ...entry, exec: { yes, no, passed } } : entry));
  const candidate = state.verdict?.candidate;
  const next: RoomState = {
    ...state,
    players,
    ...(voteLog === undefined ? {} : { voteLog }),
    verdict: candidate === undefined ? { passed } : { passed, candidate },
  };
  return { state: next, stay: false };
}
