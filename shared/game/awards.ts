// 시상 칭호(END-04, 결정 D-4·D-5·D-7): 서버 기록만으로 결정적으로 정하는 순수 모듈.
// 시각·난수·DOM 이 없고 입력을 바꾸지 않는다(앱·워커 두 tsconfig 에 모두 들어간다).
// 읽는 필드는 공개 사실뿐이다(L37): players[].{seat,role,alive,stats,badgeLog}, voteLog[].{n,exec.passed,cand.votes[].{seat,target},cand.candidate,last},
// nightLog[].{n,target,died}, whispers[].{from,n}, winner. 경찰 수사·의사 치료·마피아 개인 밤 선택·찬반 개인 표(verdict.ballots)는 읽지 않는다.
import type { AwardId, AwardLine } from "../protocol";
import { isAlive } from "./alive";
import type { RoomState } from "./room";

/** 탈락 시점: 처형이면 {n, at:"day"}, 밤 사망이면 {n, at:"night"}. 탈락한 기록이 없으면 undefined. */
export interface Elimination {
  n: number;
  at: "day" | "night";
}

/** 그날 처형된 사람 한 줄(찬반 통과 또는 마지막 3인 결전). */
function executedOf(state: RoomState): Array<{ n: number; seat: number }> {
  const out: Array<{ n: number; seat: number }> = [];
  for (const line of state.voteLog ?? []) {
    const candidate = line.cand?.candidate;
    if (candidate !== undefined && (line.exec.passed || line.last === true)) out.push({ n: line.n, seat: candidate });
  }
  return out;
}

/** 그 사람의 탈락 시점. 처형이 먼저 찾아지고, 없으면 밤 사망(died true 이고 target 이 그 사람). */
export function eliminationOf(state: RoomState, seat: number): Elimination | undefined {
  const executed = executedOf(state).find((e) => e.seat === seat);
  if (executed !== undefined) return { n: executed.n, at: "day" };
  const night = (state.nightLog ?? []).find((e) => e.died && e.target === seat);
  if (night !== undefined) return { n: night.n, at: "night" };
  return undefined;
}

/** 칭호 단계: 패 순서 키(D-7). 대체 0 → 작은 1 → 중간 2 → 큰 3. */
export type AwardTier = 0 | 1 | 2 | 3;

/** 판 전체 기록의 요약(읽기 전용). 칭호 규칙은 이것만 본다. */
interface Ctx {
  state: RoomState;
}

/** 칭호 하나의 데이터 행: 단계·최소 점수·대상 조건·점수. 배정 루프는 이 표를 훑는다. */
interface AwardSpec {
  id: AwardId;
  tier: AwardTier;
  eligible: (ctx: Ctx, seat: number) => boolean;
  score: (ctx: Ctx, seat: number) => number;
}

/** 훑는 순서가 곧 우선순위다(큰 → 중간 → 작은). 칭호 규칙은 Task 2 에서 이 표에 더한다. */
const SPECS: readonly AwardSpec[] = [];

/** 대체 칭호 단계. */
const SUBSTITUTE_TIER: AwardTier = 0;

/** 패 순서(D-7): 팀(진 0 → 이김 1) → 단계 → 낮은 좌석. 서버가 한 번 정렬해 싣는다. */
function sortCards(state: RoomState, cards: Array<AwardLine & { tier: AwardTier }>): AwardLine[] {
  const mafiaWon = state.winner === "mafiaWin";
  const roleOf = new Map(state.players.map((p) => [p.seat, p.role]));
  const teamKey = (seat: number): number => ((roleOf.get(seat) === "mafia") === mafiaWon ? 1 : 0);
  return [...cards]
    .sort((a, b) => teamKey(a.seat) - teamKey(b.seat) || a.tier - b.tier || a.seat - b.seat)
    .map(({ tier: _tier, ...line }) => line);
}

/** 참가자(역할이 있는 사람) 한 명에 정확히 한 장. 같은 기록은 늘 같은 목록이다. */
export function computeAwards(state: RoomState): AwardLine[] {
  const ctx: Ctx = { state };
  const seats = state.players.filter((p) => p.role !== undefined).map((p) => p.seat).sort((a, b) => a - b);
  const cards: Array<AwardLine & { tier: AwardTier }> = [];
  const taken = new Set<number>();
  void ctx;
  void SPECS;
  for (const seat of seats) {
    if (taken.has(seat)) continue;
    const player = state.players.find((p) => p.seat === seat)!;
    if (isAlive(player)) {
      cards.push({ seat, award: "survivor", tier: SUBSTITUTE_TIER });
    } else {
      const out = eliminationOf(state, seat) ?? { n: lastDayOf(state), at: "day" as const };
      cards.push({ seat, award: "spectator", k: out.n, at: out.at, tier: SUBSTITUTE_TIER });
    }
  }
  return sortCards(state, cards);
}

/** 마지막 일차: voteLog·nightLog 의 최대 n(없으면 1). */
function lastDayOf(state: RoomState): number {
  let last = 1;
  for (const line of state.voteLog ?? []) if (line.n > last) last = line.n;
  for (const line of state.nightLog ?? []) if (line.n > last) last = line.n;
  return last;
}
