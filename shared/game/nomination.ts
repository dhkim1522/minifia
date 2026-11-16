// 지목 규칙. 순수 모듈이다 — 현재 시각·난수를 읽지 않고, 입력 상태는 바꾸지 않는다(결정 0060-3, DAY-04·05).
// v1.0 vote.ts 의 후보 선택(castCandidateVote·tallyCandidateVote)과 같은 계약이다: 검사 순서 = 계약, 같은 값이면 같은 객체.
// 다른 점: 취소(null)가 없고, 득표 순서를 섞지 않는다(지목 줄은 지목 중에도 공개라 좌석 오름차순 그대로다).
// 마감(phaseEndsAt)은 차례가 확정될 때(castTurnPoint)만 쓴다 — 확정 뒤 다음 차례까지의 사이(now + PICK_GAP_MS)다. 과반이어도 끝까지 돈다(결정 0060-3).
// 지목은 순차 지목(결정 0063-1·0063-4, 22-09 D-12)이 유일하다 — 동시 투표(castPoint·enterVote)는 지웠다. 낮 순서는 토론 → 찬반 → 지목 → 유언 → 처형이다(결정 0089-18).
// 시각은 인자로만 받고 연결·역할·난수를 읽지 않는다(M-3).
// 모이기 → 산 사람 좌석 순서로 한 명씩 차례 → 확정 뒤 사이 → 끝 알림 → 집계(resolveNomination). 과반이어도 끝까지 돈다.
import type { PickTurnView, PointLine } from "../protocol";
import { isAlive } from "./alive";
import { afterDayOf, NOMINATION_END_MS, NOMINATION_GATHER_MS, PHASE_DEFS, PICK_GAP_MS, PICK_TURN_MS } from "./phases";
import type { PickTurn, RoomState } from "./room";
import type { DeadlineResult } from "./tick";
import type { VoteError } from "./discussion";
import { RULES } from "./ruleset";
import { startRunoff } from "./runoff";

/**
 * 산 사람 수의 과반 수 = ⌊n ÷ 2⌋ + 1 (2명 → 2, 5명 → 3, 8명 → 5). 지목 과반 표시와 토론 끝내기 과반이 이 한 곳을 쓴다.
 */
export function majorityOf(aliveCount: number): number {
  return Math.floor(aliveCount / 2) + 1;
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
 * leaders 는 최다 득표자 전원 좌석 오름차순이다(0표면 빈 배열) — 정확히 둘이면 동점 결선(결정 0066-4)이다.
 * majority 는 지금 산 사람 수의 과반 수(majorityOf)다 — 화면 표시용이고 판정(변론자 결정)은 최다 한 명이면 과반이 아니어도 난다.
 */
export function tallyPoints(state: RoomState): {
  votes: PointLine[];
  counts: Record<number, number>;
  leader?: number;
  leaders: number[];
  majority: number;
} {
  const votes = pointLinesOf(state);
  const counts: Record<number, number> = {};
  for (const v of votes) counts[v.target] = (counts[v.target] ?? 0) + 1;
  const top = Math.max(0, ...Object.values(counts));
  const leaders = Object.entries(counts)
    .filter(([, count]) => count === top && top > 0)
    .map(([seat]) => Number(seat))
    .sort((a, b) => a - b);
  const majority = majorityOf(state.players.filter(isAlive).length);
  return leaders.length === 1 ? { votes, counts, leader: leaders[0]!, leaders, majority } : { votes, counts, leaders, majority };
}

/**
 * nomination 마감 훅(결정 0060-3·0089-18, DAY-05, D-13). 찬반(resolveVerdict)이 이미 통과를 정하고 그날 voteLog 줄을 만들었다 — 이 마감은 그 줄에 cand 를 더한다.
 * 최다 한 명이면 기존 verdict(passed:true)를 보존한 채 candidate 만 더해 표의 기본 다음 단계(defense = 유언)로 간다 —
 * passed 를 다시 false 로 덮으면 enterExecution 이 아무도 탈락시키지 않는다(Pitfall 1).
 * 동률·0표면 처형 없이 night 이고(결선 없음) verdict 키를 지우며 줄에 reason(tie | noVotes)을 남긴다(Pitfall 7). 단 판 규칙(RULES)의 runoff 가 켜져 있고 최다 득표자가
 * 정확히 둘이면 동점 결선 runoff 로 간다(결정 0066-4, 그날 줄은 candidate 없이 쌓고 결선이 채운다) — 꺼져 있어(결정 0072) 동점도 night 다.
 * 그날 줄이 없으면(찬반을 거치지 않은 단위 시험 등) 새로 만든다. 집계 직후 모든 플레이어의 nominate 키를 구조 분해로 지운다.
 */
export function resolveNomination(state: RoomState): DeadlineResult {
  const { votes, leader, leaders } = tallyPoints(state);
  const players = state.players.map((p) => {
    const { nominate: _nominate, ...kept } = p;
    return kept;
  });
  const { pickTurn: _pickTurn, verdict: kept, ...rest } = state;
  const day = state.day ?? 1;
  // 누가 누구를 골랐는지(votes)는 저장하지 않는다(22-12 D-25) — 그날 처형자(candidate)와 처형 없음 이유(reason)만 남긴다.
  const cand = leader === undefined ? {} : { candidate: leader };
  const reason = leader !== undefined || (RULES.runoff && leaders.length === 2) ? {} : { reason: (votes.length === 0 ? "noVotes" : "tie") as "noVotes" | "tie" };
  const log = state.voteLog ?? [];
  const at = log.map((entry) => entry.n).lastIndexOf(day);
  const voteLog =
    at < 0
      ? [...log, { n: day, exec: { yes: 0, no: 0, passed: kept?.passed === true }, cand, ...reason }]
      : log.map((entry, i) => (i === at ? { ...entry, cand, ...reason } : entry));
  const next: RoomState = {
    ...rest,
    players,
    voteLog,
    ...(leader === undefined ? {} : { verdict: { ...kept, passed: true, candidate: leader } }),
  };
  if (RULES.runoff && leaders.length === 2) return { state: startRunoff(next, [leaders[0]!, leaders[1]!]), stay: false, next: "runoff" };
  // 처형 없는 낮의 다음 단계는 afterDayOf(state) 한 곳이다(밤, 첫날 키워드 판은 정답 공개).
  return leader === undefined ? { state: next, stay: false, next: afterDayOf(state) } : { state: next, stay: false };
}

// ---- 순차 지목(09.1-01, 결정 0063-1·0063-4, M-5) ----
// tick 표에 걸려 있다: HOOKS.enter.nomination = enterNomination, HOOKS.deadline.nomination = stepNomination. 동시 투표(누구나·마감까지 바꾸기)는 22-09 가 지웠다 — 지목 규칙은 이 순차 지목 하나뿐이다.

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

/**
 * 지금 미확정 차례가 시작된 시각(= 차례 마감 − 차례 길이). 차례 중이 아니면(모이기·확정 뒤 사이·끝 알림·차례 없음) undefined.
 * 방 DO 가 봇 계획을 세울 때 now 로 쓴다 — 계획은 차례가 시작된 시각에 한 번 지목하므로, 알람이 조금 늦어도 계획이 마감 여유(500ms) 밖으로 밀리지 않는다.
 */
export function turnStartOf(state: RoomState): number | undefined {
  const turn = state.pickTurn;
  if (state.phase !== "nomination" || turn === undefined || turn.endsAt === undefined || turn.doneAt !== undefined) return undefined;
  return turn.endsAt - PICK_TURN_MS;
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
