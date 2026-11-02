// 지목 규칙. 순수 모듈이다 — 현재 시각·난수를 읽지 않고, 입력 상태는 바꾸지 않는다(결정 0060-3, DAY-04·05).
// v1.0 vote.ts 의 후보 선택(castCandidateVote·tallyCandidateVote)과 같은 계약이다: 검사 순서 = 계약, 같은 값이면 같은 객체.
// 다른 점: 취소(null)가 없고, 득표 순서를 섞지 않는다(지목 줄은 지목 중에도 공개라 좌석 오름차순 그대로다).
// 마감(phaseEndsAt)은 읽거나 쓰지 않는다 — 과반이어도 15초를 다 채운다(결정 0060-3).
import type { PointLine } from "../protocol";
import { isAlive } from "./alive";
import type { RoomState } from "./room";
import type { DeadlineResult } from "./tick";
import type { VoteError } from "./vote";

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
  const line = {
    n: state.day ?? 1,
    exec: { yes: 0, no: 0, passed: false },
    cand: leader === undefined ? { votes } : { votes, candidate: leader },
  };
  const next: RoomState = {
    ...state,
    players,
    voteLog: [...(state.voteLog ?? []), line],
    verdict: leader === undefined ? { passed: false } : { passed: false, candidate: leader },
  };
  return leader === undefined ? { state: next, stay: false, next: "night" } : { state: next, stay: false };
}
