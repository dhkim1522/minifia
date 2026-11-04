// 지목 규칙. 순수 모듈이다 — 현재 시각·난수를 읽지 않고, 입력 상태는 바꾸지 않는다(결정 0060-3, DAY-04·05).
// v1.0 vote.ts 의 후보 선택(castCandidateVote·tallyCandidateVote)과 같은 계약이다: 검사 순서 = 계약, 같은 값이면 같은 객체.
// 다른 점: 취소(null)가 없고, 득표 순서를 섞지 않는다(지목 줄은 지목 중에도 공개라 좌석 오름차순 그대로다).
// 마감(phaseEndsAt)은 읽거나 쓰지 않는다 — 과반이어도 15초를 다 채운다(결정 0060-3).
// 순차 지목(결정 0063-1·0063-4): 시각은 인자로만 받고 연결·역할·난수를 읽지 않는다(M-3).
// 모이기 → 산 사람 좌석 순서로 한 명씩 차례 → 확정 뒤 사이 → 끝 알림 → 기존 집계(resolveNomination). 과반이어도 끝까지 돈다.
import type { PickTurnView, PointLine } from "../protocol";
import { isAlive } from "./alive";
import { NOMINATION_END_MS, NOMINATION_GATHER_MS, PHASE_DEFS, PICK_GAP_MS, PICK_TURN_MS } from "./phases";
import type { PickTurn, RoomState } from "./room";
import type { DeadlineResult } from "./tick";
import type { VoteError } from "./discussion";

/**
 * 산 사람 수의 과반 수 = ⌊n ÷ 2⌋ + 1 (2명 → 2, 5명 → 3, 8명 → 5). 지목 과반 표시와 토론 끝내기 과반이 이 한 곳을 쓴다.
 */
export function majorityOf(aliveCount: number): number {
  return Math.floor(aliveCount / 2) + 1;
}

/**
 * 지목 한 번(고른 seat). 마지막 값이 유효하다(마감까지 바꿀 수 있다). 취소(null)는 없다(DAY-04).
 * 검사 순서가 계약이다: 단계(nomination 아니면 누구든 WRONG_PHASE) → 행위자(방에 있고 산 사람, 아니면 BAD_MESSAGE)
 * → 대상(정수·앉은 산 사람, 아니면 BAD_MESSAGE) → 자기 자신이면 BAD_MESSAGE(화면이 막아도 서버가 방어선)
 * → 같은 값이면 입력 상태 그대로 ok → 그 사람의 nominate 만 바뀐 새 상태.
 */
export function castPoint(
  state: RoomState,
  actorId: string,
  target: number,
): { ok: true; state: RoomState } | { ok: false; error: VoteError } {
  if (state.phase !== "nomination") return { ok: false, error: "WRONG_PHASE" };
  const actor = state.players.find((p) => p.id === actorId);
  if (!actor || !isAlive(actor)) return { ok: false, error: "BAD_MESSAGE" };
  const chosen = Number.isInteger(target) ? state.players.find((p) => p.seat === target) : undefined;
  if (!chosen || !isAlive(chosen)) return { ok: false, error: "BAD_MESSAGE" };
  if (chosen.seat === actor.seat) return { ok: false, error: "BAD_MESSAGE" };
  if (actor.nominate === target) return { ok: true, state };
  return {
    ok: true,
    state: { ...state, players: state.players.map((p) => (p.id === actorId ? { ...p, nominate: target } : p)) },
  };
}

/** 지금 지목 줄: 산 행위자가 산 대상을 가리킨 것만, 좌석 오름차순. 탈락한 사람의 남은 표와 죽은 대상을 가리킨 표는 줄이 없다. */
export function pointLinesOf(state: RoomState): PointLine[] {
  const seated = new Map(state.players.map((p) => [p.seat, p]));
  const lines: PointLine[] = [];
  for (const p of [...state.players].sort((a, b) => a.seat - b.seat)) {
    if (!isAlive(p) || p.nominate === undefined) continue;
    const target = seated.get(p.nominate);
    if (!target || !isAlive(target)) continue;
    lines.push({ seat: p.seat, target: target.seat });
  }
  return lines;
}

/**
 * 지목 집계(결정 0060-3, DAY-04·05). 실시간 표시와 마감 집계가 같은 함수다.
 *   0표                    → votes [] · leader 없음
 *   최다 득표가 한 명      → 그 사람이 leader
 *   최다 동률              → leader 없음 (난수로 고르지 않는다)
 * majority 는 지금 산 사람 수의 과반 수(majorityOf)다 — 화면 표시용이고 판정(변론자 결정)은 최다 한 명이면 과반이 아니어도 난다.
 */
export function tallyPoints(state: RoomState): {
  votes: PointLine[];
  counts: Record<number, number>;
  leader?: number;
  majority: number;
} {
  const votes = pointLinesOf(state);
  const counts: Record<number, number> = {};
  for (const v of votes) counts[v.target] = (counts[v.target] ?? 0) + 1;
  const top = Math.max(0, ...Object.values(counts));
  const leaders = Object.entries(counts)
    .filter(([, count]) => count === top && top > 0)
    .map(([seat]) => Number(seat));
  const majority = majorityOf(state.players.filter(isAlive).length);
  return leaders.length === 1 ? { votes, counts, leader: leaders[0]!, majority } : { votes, counts, majority };
}

/**
 * nomination 마감 훅(결정 0060-3, DAY-05). 그날 voteLog 줄 {n, exec:{0,0,false}, cand:{votes, candidate?}} 을 항상 쌓는다 —
 * 찬반 마감(resolveVerdict)이 같은 줄의 exec 를 채운다. 최다 한 명이면 verdict {passed:false, candidate} 로 표의 기본 다음 단계(defense),
 * 동률·0표면 next "night" 다. 집계 직후 모든 플레이어의 nominate 키를 구조 분해로 지운다.
 */
export function resolveNomination(state: RoomState): DeadlineResult {
  const { votes, leader } = tallyPoints(state);
  const players = state.players.map((p) => {
    const { nominate: _nominate, ...kept } = p;
    return kept;
  });
  const { pickTurn: _pickTurn, ...rest } = state;
  const line = {
    n: state.day ?? 1,
    exec: { yes: 0, no: 0, passed: false },
    cand: leader === undefined ? { votes } : { votes, candidate: leader },
  };
  const next: RoomState = {
    ...rest,
    players,
    voteLog: [...(state.voteLog ?? []), line],
    verdict: leader === undefined ? { passed: false } : { passed: false, candidate: leader },
  };
  return leader === undefined ? { state: next, stay: false, next: "night" } : { state: next, stay: false };
}

// ---- 순차 지목(09.1-01, 결정 0063-1·0063-4, M-5) ----
// tick 표(ON_ENTER·ON_DEADLINE)에는 아직 걸지 않는다 — 09.1-04 가 건다.

/** 지목 진입: 산 사람 좌석 오름차순을 차례 순서로 고정하고(i -1 = 모이는 중) 남은 지목 값을 모두 지운다. 마감은 호출한 쪽이 건다(nominationStepMs). */
export function enterNomination(state: RoomState): RoomState {
  const order = state.players
    .filter(isAlive)
    .map((p) => p.seat)
    .sort((a, b) => a - b);
  return {
    ...state,
    players: state.players.map((p) => {
      const { nominate: _nominate, ...kept } = p;
      return kept;
    }),
    pickTurn: { order, i: -1 },
  };
}

/** 지금 지목 세부 단계의 길이(ms): 모이기 · 차례 · 확정 뒤 사이 · 끝 알림. pickTurn 이 없으면 단계 표 값(옛 규칙). */
export function nominationStepMs(state: RoomState): number {
  const turn = state.pickTurn;
  if (turn === undefined) return PHASE_DEFS.nomination.durationMs ?? 0;
  if (turn.i < 0) return NOMINATION_GATHER_MS;
  if (turn.i >= turn.order.length) return NOMINATION_END_MS;
  return turn.doneAt === undefined ? PICK_TURN_MS : PICK_GAP_MS;
}

/**
 * 마감이 지났을 때의 한 걸음(at = 지난 마감 시각). 새 마감은 호출한 쪽이 at + nominationStepMs(새 상태)로 건다.
 *   모이기 끝 → 첫 차례 · 미확정 차례 → 기권 확정(skip) · 확정 뒤 → 다음 차례, 마지막이면 끝 알림 · 끝 알림 뒤 → 집계(stay false).
 * pickTurn 이 없으면 안전장치로 바로 집계한다.
 */
export function stepNomination(state: RoomState, at: number): DeadlineResult {
  const turn = state.pickTurn;
  if (turn === undefined || turn.i >= turn.order.length) return resolveNomination(state);
  const withTurn = (next: PickTurn): DeadlineResult => ({ state: { ...state, pickTurn: next }, stay: true });
  const startTurn = (i: number): DeadlineResult =>
    i >= turn.order.length ? withTurn({ order: turn.order, i: turn.order.length }) : withTurn({ order: turn.order, i, endsAt: at + PICK_TURN_MS });
  if (turn.i < 0) return startTurn(0);
  if (turn.doneAt === undefined) return withTurn({ ...turn, doneAt: at, skip: true });
  return startTurn(turn.i + 1);
}

/**
 * 차례 주인의 지목: 대상을 정하고 그 차례를 즉시 확정한다(doneAt = now, 마감 = now + 사이). 바꾸기·취소는 없다.
 * 검사 순서가 계약이다: 단계(nomination 아니면 WRONG_PHASE) → 행위자(방에 있고 산 사람, 아니면 BAD_MESSAGE — 유령은 차례와 무관)
 * → 차례(pickTurn 이 있고 차례 중이며 행위자 좌석이 order[i], 아직 미확정, now < endsAt — 아니면 WRONG_PHASE)
 * → 대상(정수·앉은 산 사람·자기 자신 아님, 아니면 BAD_MESSAGE). 거절이면 입력 상태는 그대로다.
 * 연결 상태는 읽지 않는다(M-3) — 끊긴 사람도 마감 전에 돌아오면 고를 수 있다.
 */
export function castTurnPoint(
  state: RoomState,
  actorId: string,
  target: number,
  now: number,
): { ok: true; state: RoomState } | { ok: false; error: VoteError } {
  if (state.phase !== "nomination") return { ok: false, error: "WRONG_PHASE" };
  const actor = state.players.find((p) => p.id === actorId);
  if (!actor || !isAlive(actor)) return { ok: false, error: "BAD_MESSAGE" };
  const turn = state.pickTurn;
  if (
    turn === undefined ||
    turn.i < 0 ||
    turn.i >= turn.order.length ||
    turn.order[turn.i] !== actor.seat ||
    turn.doneAt !== undefined ||
    turn.endsAt === undefined ||
    now >= turn.endsAt
  ) {
    return { ok: false, error: "WRONG_PHASE" };
  }
  const chosen = Number.isInteger(target) ? state.players.find((p) => p.seat === target) : undefined;
  if (!chosen || !isAlive(chosen) || chosen.seat === actor.seat) return { ok: false, error: "BAD_MESSAGE" };
  return {
    ok: true,
    state: {
      ...state,
      players: state.players.map((p) => (p.id === actorId ? { ...p, nominate: target } : p)),
      pickTurn: { ...turn, doneAt: now },
      phaseEndsAt: now + PICK_GAP_MS,
    },
  };
}

/** 공개 차례 정보(day.turn). 좌석 순서·마감·확정만 필드별로 복사하고 없는 키는 만들지 않는다 — 역할·연결을 읽지 않는다(L14). pickTurn 이 없으면 undefined. */
export function turnViewOf(state: RoomState): PickTurnView | undefined {
  const turn = state.pickTurn;
  if (turn === undefined) return undefined;
  const view: PickTurnView = { order: [...turn.order], i: turn.i };
  if (turn.endsAt !== undefined) view.endsAt = turn.endsAt;
  if (turn.doneAt !== undefined) view.doneAt = turn.doneAt;
  if (turn.skip === true) view.skip = true;
  return view;
}
