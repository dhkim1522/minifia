// 로컬 첫날 실험방의 진행 규칙. 시각은 Worker가 주고 화면에는 허용된 값만 전달한다.
import type { FirstBallotResult, NoExecutionReason } from "../protocol";
import { isAlive } from "./alive";
import { afterDayOf, KEYWORD_READ_MS } from "./phases";
import type { Player, RoomState } from "./room";
import type { DeadlineResult } from "./tick";

export const PLAYTEST_ROLE_MS = 55_000;
export const PLAYTEST_KEYWORD_MS = KEYWORD_READ_MS + 30_000;
export const PLAYTEST_DISCUSSION_MS = 120_000;
export const PLAYTEST_DISCUSSION_MIN_MS = 45_000;
export const PLAYTEST_BALLOT_MS = 28_000;
export const PLAYTEST_RESULT_MS = 7_000;
export const PLAYTEST_MORNING_EXTRA_MS = 3_000;

export function firstPlaytestDay(state: Pick<RoomState, "playtest" | "day">): boolean {
  return state.playtest === true && (state.day ?? 1) === 1;
}

export function voteOpensAt(state: RoomState): number | undefined {
  if (!firstPlaytestDay(state) || state.phase !== "discussion" || state.phaseEndsAt === null) return undefined;
  return state.phaseEndsAt - PLAYTEST_DISCUSSION_MS + PLAYTEST_DISCUSSION_MIN_MS;
}

export function keywordReadUntil(state: RoomState): number | undefined {
  if (!firstPlaytestDay(state) || state.phase !== "keyword" || state.phaseEndsAt === null) return undefined;
  const from = state.earlyFrom;
  const originalEnd = from?.phase === "keyword" && from.day === (state.day ?? 0) ? from.endsAt : state.phaseEndsAt;
  return originalEnd - PLAYTEST_KEYWORD_MS + KEYWORD_READ_MS;
}

export function humanSeats(state: RoomState): Player[] {
  return state.players.filter((p) => isAlive(p) && p.isBot !== true && p.left !== true);
}

type ActionResult = { ok: true; state: RoomState } | { ok: false; error: "BAD_MESSAGE" | "WRONG_PHASE" };

export function confirmRole(state: RoomState, actorId: string): ActionResult {
  if (state.playtest !== true) return { ok: false, error: "BAD_MESSAGE" };
  if (state.phase !== "roleReveal") return { ok: false, error: "WRONG_PHASE" };
  const actor = humanSeats(state).find((p) => p.id === actorId);
  if (!actor?.role) return { ok: false, error: "BAD_MESSAGE" };
  if (actor.roleReady === true) return { ok: true, state };
  const players = state.players.map((p) => (p.id === actorId ? { ...p, roleReady: true as const } : p));
  return { ok: true, state: { ...state, players } };
}

export function allRolesReady(state: RoomState): boolean {
  const humans = humanSeats(state);
  return humans.length > 0 && humans.every((p) => p.roleReady === true);
}

export function castFirstBallot(state: RoomState, actorId: string, target: number | null): ActionResult {
  if (state.playtest !== true) return { ok: false, error: "BAD_MESSAGE" };
  if (!firstPlaytestDay(state) || state.phase !== "verdict" || state.firstBallotOutcome !== undefined) return { ok: false, error: "WRONG_PHASE" };
  const actor = state.players.find((p) => p.id === actorId);
  if (!actor || !isAlive(actor) || actor.left === true) return { ok: false, error: "BAD_MESSAGE" };
  if (target !== null && !state.players.some((p) => p.seat === target && p.id !== actorId && isAlive(p))) return { ok: false, error: "BAD_MESSAGE" };
  if (actor.firstBallot === target) return { ok: true, state };
  const players = state.players.map((p) => (p.id === actorId ? { ...p, firstBallot: target } : p));
  return { ok: true, state: { ...state, players } };
}

export function firstBallotCount(state: RoomState): number {
  return state.players.filter((p) => isAlive(p) && p.firstBallot !== undefined).length;
}

function firstBallotTally(state: RoomState): { count: number; result: FirstBallotResult } {
  const tally = new Map<number, number>();
  const alive = new Set(state.players.filter(isAlive).map((p) => p.seat));
  let holds = 0;
  for (const p of state.players) {
    if (!isAlive(p) || p.firstBallot === undefined) continue;
    if (p.firstBallot === null) holds += 1;
    else if (p.firstBallot !== p.seat && alive.has(p.firstBallot)) {
      tally.set(p.firstBallot, (tally.get(p.firstBallot) ?? 0) + 1);
    }
  }
  const votes = Math.max(0, ...tally.values());
  const leaders = [...tally].filter(([, n]) => n === votes).map(([seat]) => seat);
  const count = [...tally.values()].reduce((sum, n) => sum + n, holds);
  const target = leaders.length === 1 && votes > holds ? leaders[0]! : null;
  const reason = count === 0 ? "noVotes" : holds > votes ? "held" : "tie";
  return { count, result: { target, votes, holds, ...(target === null ? { reason } : {}) } };
}

/** 공개는 한 단계 안에서 유지하고, 다음 마감에 기존 유언 또는 정답 공개로 연결한다. */
export function stepFirstBallot(state: RoomState): DeadlineResult {
  if (state.firstBallotOutcome !== undefined) {
    return { state, stay: false, next: state.firstBallotOutcome.result.target === null ? afterDayOf(state) : "defense" };
  }
  const outcome = firstBallotTally(state);
  const { target, holds, reason } = outcome.result;
  const passed = target !== null;
  const noExecution: NoExecutionReason | undefined = reason === "held" ? "rejected" : reason;
  const players = state.players.map(({ firstBallot: _private, ...p }) => p);
  return {
    stay: true,
    state: {
      ...state,
      players,
      firstBallotOutcome: outcome,
      ...(passed ? { verdict: { passed, candidate: target } } : {}),
      voteLog: [...(state.voteLog ?? []), {
        n: state.day ?? 1,
        exec: { yes: outcome.count - holds, no: holds, passed },
        cand: passed ? { candidate: target } : {},
        ...(noExecution === undefined ? {} : { reason: noExecution }),
      }],
    },
  };
}
