// 찬반 규칙. 순수 모듈이다 — 현재 시각·난수를 읽지 않고, 입력 상태는 바꾸지 않는다(결정 0089-18 D-10·D-11, 옛 DAY-06·결정 0053·0060-4).
// 찬반은 낮 토론 바로 뒤에 오고 후보가 없다("오늘 처형할까?" — 지목은 통과한 뒤에 한다). 유권자는 산 사람 전원이다.
// 분모 규칙(D-11): 던진 표의 과반이 찬성이면 통과한다(찬성 × 2 > 찬성 + 반대 ⟺ 찬성 > 반대). 못 던진 사람은 분모에 없고, 0표·동수는 부결이다
// (옛 규칙은 "변론자를 뺀 유권자 수가 분모, 못 던진 사람도 분모" 였다).
// 찬반 진행 중에는 집계 수(찬성·반대)만 모두에게 공개하고(day.verdictCount, 번복도 방송) 던진 좌석은 싣지 않는다(D-26). 개인 표(Player.verdictVote)는
// 서버 전용이고 뷰 허용 목록에 없다(본인 me.verdictVote 만 예외). 마감 훅(resolveVerdict)이 집계 직후 키째 지운다 — 진행 중 비공개를 뷰 코드가 아니라 "데이터가 없다" 는 사실로 지킨다.
// 마감 뒤에는 누가 찬성·반대했는지 어디에도 남지 않는다(22-12 D-14) — 판정 결과(passed)와 집계 수(voteLog exec)뿐이다.
// 마감 시각은 건드리지 않는다: 모두가 일찍 던져도 10초를 다 채운다(조기 종료 없음, 사용자 확정 2026-11-02).
import { isAlive } from "./alive";
import { afterDayOf } from "./phases";
import type { Player, RoomState } from "./room";
import type { DeadlineResult } from "./tick";
import type { VoteError } from "./discussion";

/** 유권자: 산 사람 전원이다(후보가 없다, D-11). */
export function verdictVotersOf(state: RoomState): Player[] {
  return state.players.filter(isAlive);
}

/**
 * 찬반 한 표(찬성 true / 반대 false). 마지막 값이 유효하다(번복 가능).
 * 검사 순서가 계약이다: 단계(verdict 아니면 누구든 WRONG_PHASE) → 행위자(방에 있고 산 사람, 아니면 BAD_MESSAGE)
 * → 값(불리언, 아니면 BAD_MESSAGE) → 같은 값이면 입력 상태 그대로 ok
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
  if (typeof agree !== "boolean") return { ok: false, error: "BAD_MESSAGE" };
  if (actor.verdictVote === agree) return { ok: true, state };
  return {
    ok: true,
    state: { ...state, players: state.players.map((p) => (p.id === actorId ? { ...p, verdictVote: agree } : p)) },
  };
}

/** 산 사람 안의 찬성·반대 수. 유령의 남은 값과 못 던진 사람(undefined)은 어느 쪽에도 세지 않는다 — 분모는 던진 표(찬성 + 반대)다. */
export function verdictTallyOf(state: RoomState): { yes: number; no: number } {
  let yes = 0;
  let no = 0;
  for (const p of verdictVotersOf(state)) {
    if (p.verdictVote === true) yes += 1;
    else if (p.verdictVote === false) no += 1;
  }
  return { yes, no };
}

/**
 * verdict 마감 훅(결정 0089-18, D-11). 판정: 던진 표의 과반이 찬성이면 통과, 아니면 부결(0표·동수 포함).
 * 이 마감이 그날 voteLog 줄 {n, exec:{yes, no, passed}} 을 만든다(같은 날 줄이 이미 있으면 exec 만 채운다). 부결이면 줄에 reason "rejected" 를 남긴다 —
 * 밤에 도착했을 때 noExecutionOf 가 이 줄에서 이유를 읽는다. 지목 마감(resolveNomination)이 같은 줄에 cand 를 더한다.
 * verdict 상태는 {passed} 다 — 후보는 지목 마감이 더한다. 집계 직후 모든 플레이어의 verdictVote 키를 구조 분해로 지운다.
 * 다음 단계: 통과는 표의 기본(nomination), 부결은 처형 없는 낮이라 afterDayOf()(night).
 */
export function resolveVerdict(state: RoomState): DeadlineResult {
  const { yes, no } = verdictTallyOf(state);
  // 던진 표의 과반 찬성(= yes > no). 0표·동수는 부결 — D-11
  const passed = yes * 2 > yes + no;
  const players = state.players.map((p) => {
    const { verdictVote: _verdictVote, ...kept } = p;
    return kept;
  });
  const day = state.day ?? 1;
  const log = state.voteLog ?? [];
  const at = log.map((entry) => entry.n).lastIndexOf(day);
  const exec = { yes, no, passed };
  const reason = passed ? {} : { reason: "rejected" as const };
  const voteLog =
    at < 0 ? [...log, { n: day, exec, ...reason }] : log.map((entry, i) => (i === at ? { ...entry, exec, ...reason } : entry));
  const next: RoomState = {
    ...state,
    players,
    voteLog,
    verdict: { passed },
  };
  return passed ? { state: next, stay: false } : { state: next, stay: false, next: afterDayOf() };
}
