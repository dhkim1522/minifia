// 동점 결선 규칙(09.1.1-04, POL-04, 결정 0066-4). 순수 모듈이다 — 현재 시각·난수를 읽지 않고, 입력 상태는 바꾸지 않는다.
// 지목 집계에서 최다 득표자가 정확히 둘이면 resolveNomination 이 startRunoff 로 이 단계를 세운다.
// 흐름: 앞머리(step 0) → 투표(step 1) → 결과(step 2, 득표 수 확정) → 집계(resolveRunoff). 모두 서버 시각 사슬(tick 의 stay)이다.
// 투표자는 후보가 아닌 산 사람이고, 마감 전까지 바꿀 수 있다. 기권한 표는 세지 않는다.
// 이 파일은 역할·연결 여부를 읽지 않는다 — 결선 규칙에 역할 분기가 없다(L20·L21 성격).
import { isAlive } from "./alive";
import type { VoteError } from "./discussion";
import { PHASE_DEFS, RUNOFF_END_MS, RUNOFF_INTRO_MS, RUNOFF_VOTE_MS } from "./phases";
import type { Player, RoomState, RunoffState } from "./room";
import type { DeadlineResult } from "./tick";
import type { RunoffView } from "../protocol";

/** 결선 진입: 후보 둘로 runoff 를 세우고 이전 결선 표가 남아 있으면 모두 지운다. 마감은 호출한 쪽(tick)이 건다. */
export function startRunoff(state: RoomState, cand: [number, number]): RoomState {
  return {
    ...state,
    players: state.players.map((p) => {
      const { runoffVote: _runoffVote, ...kept } = p;
      return kept;
    }),
    runoff: { cand, step: 0 },
  };
}

/** 유권자: 산 사람 중 후보 둘을 뺀 사람. runoff 가 없으면 빈 목록이다. */
export function runoffVotersOf(state: RoomState): Player[] {
  const cand = state.runoff?.cand;
  if (cand === undefined) return [];
  return state.players.filter((p) => isAlive(p) && !cand.includes(p.seat));
}

/** 지금 결선 세부 단계의 길이(ms): 앞머리 · 투표 · 결과. runoff 상태가 없으면 단계 표 값이다. */
export function runoffStepMs(state: RoomState): number {
  const step = state.runoff?.step;
  if (step === undefined) return PHASE_DEFS.runoff.durationMs ?? RUNOFF_INTRO_MS;
  if (step === 0) return RUNOFF_INTRO_MS;
  return step === 1 ? RUNOFF_VOTE_MS : RUNOFF_END_MS;
}

/** 후보 순서 득표 수 — 산 유권자가 후보에게 던진 표만 센다(탈락한 사람·후보 밖 값·기권은 세지 않는다). */
function tallyOf(state: RoomState, runoff: RunoffState): [number, number] {
  const counts: [number, number] = [0, 0];
  for (const p of runoffVotersOf({ ...state, runoff })) {
    if (p.runoffVote === runoff.cand[0]) counts[0] += 1;
    else if (p.runoffVote === runoff.cand[1]) counts[1] += 1;
  }
  return counts;
}

/**
 * 마감이 지났을 때의 한 걸음(at 은 지난 마감 시각). 0 → 1 → 2 는 같은 단계에 머물고(stay), 2 가 끝나면 집계한다.
 * 1 → 2 전환에서 득표 수를 후보 순서대로 확정한다. runoff 상태가 없으면 안전장치로 그대로 집계 없이 다음으로 보낸다.
 */
export function stepRunoff(state: RoomState, _at: number): DeadlineResult {
  const runoff = state.runoff;
  if (runoff === undefined) return { state, stay: false, next: "night" };
  if (runoff.step === 0) return { state: { ...state, runoff: { cand: runoff.cand, step: 1 } }, stay: true };
  if (runoff.step === 1) return { state: { ...state, runoff: { cand: runoff.cand, step: 2, tally: tallyOf(state, runoff) } }, stay: true };
  return resolveRunoff(state);
}

/**
 * 결선 한 표(후보 둘 중 하나). 마지막 값이 유효하다(마감 전 번복 가능).
 * 검사 순서가 계약이다: 단계(runoff 아니면 WRONG_PHASE) → 행위자(방에 있고 산 사람, 아니면 BAD_MESSAGE) → 후보 본인이면 BAD_MESSAGE
 * → 투표 창(runoff.step === 1 이고 now < state.phaseEndsAt, 아니면 WRONG_PHASE) → 대상(후보 둘 중 하나, 아니면 BAD_MESSAGE)
 * → 같은 값이면 입력 상태 그대로 ok → 그 사람의 runoffVote 만 바뀐 새 상태. 거절이면 입력 상태는 그대로다.
 */
export function castRunoffVote(
  state: RoomState,
  actorId: string,
  target: number,
  now: number,
): { ok: true; state: RoomState } | { ok: false; error: VoteError } {
  const runoff = state.runoff;
  if (state.phase !== "runoff" || runoff === undefined) return { ok: false, error: "WRONG_PHASE" };
  const actor = state.players.find((p) => p.id === actorId);
  if (!actor || !isAlive(actor)) return { ok: false, error: "BAD_MESSAGE" };
  if (runoff.cand.includes(actor.seat)) return { ok: false, error: "BAD_MESSAGE" };
  if (runoff.step !== 1 || state.phaseEndsAt === null || now >= state.phaseEndsAt) return { ok: false, error: "WRONG_PHASE" };
  if (!Number.isInteger(target) || !runoff.cand.includes(target)) return { ok: false, error: "BAD_MESSAGE" };
  if (actor.runoffVote === target) return { ok: true, state };
  return {
    ok: true,
    state: { ...state, players: state.players.map((p) => (p.id === actorId ? { ...p, runoffVote: target } : p)) },
  };
}

/**
 * 결선 집계(결정 0066-4). 득표가 다르면 많이 받은 후보가 승자 — 그날 voteLog 줄의 cand.candidate 를 채우고(줄이 없으면 voteLog 는 그대로)
 * verdict {passed:false, candidate} 로 표의 기본 다음 단계(defense)로 간다. 같으면(0-0 포함) 처형 없음 — next "night" 이고
 * 그날 voteLog 줄에 candidate 가 없으니 기존 noExecutionOf 가 이유 tie 를 파생한다. runoff·runoffVote 는 키째 지운다.
 */
export function resolveRunoff(state: RoomState): DeadlineResult {
  const runoff = state.runoff;
  const { runoff: _runoff, ...rest } = state;
  const players = state.players.map((p) => {
    const { runoffVote: _runoffVote, ...kept } = p;
    return kept;
  });
  if (runoff === undefined) return { state: { ...rest, players }, stay: false, next: "night" };
  const tally = runoff.tally ?? tallyOf(state, runoff);
  if (tally[0] === tally[1]) return { state: { ...rest, players }, stay: false, next: "night" };
  const winner = tally[0] > tally[1] ? runoff.cand[0] : runoff.cand[1];
  const today = state.day ?? 1;
  const log = state.voteLog ?? [];
  let at = -1;
  for (let i = log.length - 1; i >= 0; i -= 1) {
    if (log[i]!.n === today) {
      at = i;
      break;
    }
  }
  const voteLog =
    at < 0 || log[at]!.cand === undefined
      ? state.voteLog
      : log.map((entry, i) => (i === at ? { ...entry, cand: { ...entry.cand!, candidate: winner } } : entry));
  const next: RoomState = { ...rest, players, verdict: { passed: false, candidate: winner } };
  if (voteLog !== undefined) next.voteLog = voteLog;
  return { state: next, stay: false };
}

/**
 * 공개 결선 정보(day.runoff). 필드별로 복사하고 없는 키는 만들지 않는다 — 역할·연결·개인 선택을 읽지 않는다(L20).
 * step 0 은 후보와 단계뿐, step 1 은 던진 유권자 좌석(오름차순, 값 없음), step 2 는 후보 순서 득표 수. runoff 가 없으면 undefined.
 */
export function runoffViewOf(state: RoomState): RunoffView | undefined {
  const runoff = state.runoff;
  if (runoff === undefined) return undefined;
  const view: RunoffView = { cand: [runoff.cand[0], runoff.cand[1]], step: runoff.step };
  if (runoff.step === 1) {
    view.voted = runoffVotersOf(state)
      .filter((p) => p.runoffVote !== undefined)
      .map((p) => p.seat)
      .sort((a, b) => a - b);
  }
  if (runoff.step === 2 && runoff.tally !== undefined) view.tally = [runoff.tally[0], runoff.tally[1]];
  return view;
}
