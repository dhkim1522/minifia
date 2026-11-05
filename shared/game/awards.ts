// 시상 칭호(END-04, 결정 D-4·D-5·D-7): 서버 기록만으로 결정적으로 정하는 순수 모듈.
// 시각·난수·DOM 이 없고 입력을 바꾸지 않는다(앱·워커 두 tsconfig 에 모두 들어간다).
// 읽는 필드는 공개 사실뿐이다(L37): players[].{seat,role,alive,stats,badgeLog}, voteLog[].{n,exec.passed,cand.votes[].{seat,target},cand.candidate,last},
// nightLog[].{n,target,died}, whispers[].{from,n}, winner. 경찰 수사·의사 치료·마피아 개인 밤 선택·찬반 개인 표(verdict.ballots)는 읽지 않는다.
// 칭호 표(SPECS)는 데이터다 — 훑는 순서가 우선순위(큰 → 중간 → 작은)이고, 배정 루프와 정렬 비교는 한 곳에서 돈다.
import type { AwardId, AwardLine } from "../protocol";
import { isAlive } from "./alive";
import type { RoomState } from "./room";

/** 탈락 시점: 처형이면 {n, at:"day"}, 밤 사망이면 {n, at:"night"}. */
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

/** 그 사람의 탈락 시점. 처형이 먼저 찾아지고, 없으면 밤 사망(died true 이고 target 이 그 사람). 기록이 없으면 undefined. */
export function eliminationOf(state: RoomState, seat: number): Elimination | undefined {
  const executed = executedOf(state).find((e) => e.seat === seat);
  if (executed !== undefined) return { n: executed.n, at: "day" };
  const night = (state.nightLog ?? []).find((e) => e.died && e.target === seat);
  if (night !== undefined) return { n: night.n, at: "night" };
  return undefined;
}

/** 칭호 단계: 패 순서 키(D-7). 대체 0 → 작은 1 → 중간 2 → 큰 3. */
export type AwardTier = 0 | 1 | 2 | 3;
/** 점수로 받는 열 개 칭호(대체 칭호 survivor·spectator 는 점수가 없다). */
export type ScoredAwardId = Exclude<AwardId, "survivor" | "spectator">;

/** 칭호별 최소 점수(O-1): 플레이 뒤 조정은 이 한 곳만 고친다. 미달이면 그 칭호는 받을 수 없다. */
export const AWARD_MIN: Readonly<Record<ScoredAwardId, number>> = Object.freeze({
  actor: 1,
  detective: 2,
  angel: 1,
  whiff: 1,
  target: 3,
  firstVictim: 1,
  talker: 5,
  swapper: 2,
  whisperer: 2,
  mood: 3,
});

/** 한 사람의 판 기록(공개 사실만). */
interface Who {
  seat: number;
  mafia: boolean;
  role: string | undefined;
  alive: boolean;
  say: number;
  emote: number;
  badges: ReadonlyArray<{ n: number; v: string }>;
  elimination: Elimination | undefined;
}

/** 지목 한 줄과 그날 처형된 좌석(없으면 undefined). */
interface PointLine {
  seat: number;
  target: number;
  executed: number | undefined;
}

/** 판 전체 기록의 읽기 전용 요약. 칭호 규칙은 이것만 본다. */
interface Ctx {
  lastDay: number;
  who: ReadonlyMap<number, Who>;
  points: readonly PointLine[];
  nights: ReadonlyArray<{ n: number; target: number | undefined; died: boolean }>;
  whispersFrom: ReadonlyMap<number, number>;
  firstVictim: { seat: number; n: number } | undefined;
}

/** 마지막 일차: voteLog·nightLog 의 최대 n(없으면 1). */
function lastDayOf(state: RoomState): number {
  let last = 1;
  for (const line of state.voteLog ?? []) if (line.n > last) last = line.n;
  for (const line of state.nightLog ?? []) if (line.n > last) last = line.n;
  return last;
}

function buildCtx(state: RoomState): Ctx {
  const lastDay = lastDayOf(state);
  const who = new Map<number, Who>();
  for (const p of state.players) {
    if (p.role === undefined) continue;
    who.set(p.seat, {
      seat: p.seat,
      mafia: p.role === "mafia",
      role: p.role,
      alive: isAlive(p),
      say: p.stats?.say ?? 0,
      emote: p.stats?.emote ?? 0,
      badges: (p.badgeLog ?? []).map((b) => ({ n: b.n, v: b.v })),
      elimination: eliminationOf(state, p.seat),
    });
  }
  const points: PointLine[] = [];
  for (const line of state.voteLog ?? []) {
    const candidate = line.cand?.candidate;
    const executed = candidate !== undefined && (line.exec.passed || line.last === true) ? candidate : undefined;
    for (const vote of line.cand?.votes ?? []) points.push({ seat: vote.seat, target: vote.target, executed });
  }
  const nights = (state.nightLog ?? []).map((e) => ({ n: e.n, target: e.target, died: e.died }));
  const whispersFrom = new Map<number, number>();
  for (const w of state.whispers ?? []) whispersFrom.set(w.from, (whispersFrom.get(w.from) ?? 0) + 1);
  let firstVictim: Ctx["firstVictim"];
  for (const e of nights) {
    if (e.died && e.target !== undefined && (firstVictim === undefined || e.n < firstVictim.n)) firstVictim = { seat: e.target, n: e.n };
  }
  return { lastDay, who, points, nights, whispersFrom, firstVictim };
}

const roleOf = (ctx: Ctx, seat: number): string | undefined => ctx.who.get(seat)?.role;

/** 산 채로 지낸 마지막 일차(탈락 일차까지 — 낮·밤 탈락 모두 그날 낮은 산 채로 보냈다). */
const livedDays = (ctx: Ctx, w: Who): number => w.elimination?.n ?? ctx.lastDay;

/** 마피아가 산 채로 지낸 날 가운데 그날의 유효 주장(그 일차 이하 최신 값)이 시민 편 직업이었던 날의 수. */
function falseClaimDays(ctx: Ctx, w: Who): number {
  let days = 0;
  for (let d = 1; d <= livedDays(ctx, w); d += 1) {
    let claim = "none";
    for (const b of w.badges) if (b.n <= d) claim = b.v;
    if (claim === "citizen" || claim === "police" || claim === "doctor") days += 1;
  }
  return days;
}

/** 말 바꿈 수(O-1, setBadge 와 같은 정의): 직전 값이 none 이 아니고 새 값과 다른 변경. 첫 걸기는 바뀐 것이 아니다. */
function swapCount(w: Who): number {
  let swaps = 0;
  let previous = "none";
  for (const b of w.badges) {
    if (previous !== "none" && b.v !== previous) swaps += 1;
    previous = b.v;
  }
  return swaps;
}

/** 칭호 하나의 데이터 행: 단계·대상 조건·점수. 최소 점수는 AWARD_MIN. */
interface AwardSpec {
  id: ScoredAwardId;
  tier: AwardTier;
  eligible: (ctx: Ctx, w: Who) => boolean;
  score: (ctx: Ctx, w: Who) => number;
}

/** 훑는 순서가 곧 우선순위다: 큰 칭호 → 중간 → 작은. 한 사람이 여러 조건을 채우면 앞선 칭호 하나만 받는다. */
const SPECS: readonly AwardSpec[] = [
  { id: "actor", tier: 3, eligible: (_c, w) => w.mafia, score: falseClaimDays },
  {
    id: "detective",
    tier: 3,
    eligible: (_c, w) => !w.mafia,
    score: (c, w) => c.points.filter((p) => p.seat === w.seat && roleOf(c, p.target) === "mafia").length,
  },
  {
    id: "angel",
    tier: 3,
    eligible: (_c, w) => w.role === "doctor",
    score: (c) => c.nights.filter((e) => e.target !== undefined && !e.died).length,
  },
  {
    id: "whiff",
    tier: 2,
    eligible: (_c, w) => !w.mafia,
    score: (c, w) => c.points.filter((p) => p.seat === w.seat && p.executed === p.target && roleOf(c, p.target) !== "mafia").length,
  },
  { id: "target", tier: 2, eligible: () => true, score: (c, w) => c.points.filter((p) => p.target === w.seat).length },
  { id: "firstVictim", tier: 2, eligible: (c, w) => c.firstVictim?.seat === w.seat, score: (c) => c.firstVictim?.n ?? 0 },
  { id: "talker", tier: 1, eligible: () => true, score: (_c, w) => w.say },
  { id: "swapper", tier: 1, eligible: () => true, score: (_c, w) => swapCount(w) },
  { id: "whisperer", tier: 1, eligible: () => true, score: (c, w) => c.whispersFrom.get(w.seat) ?? 0 },
  { id: "mood", tier: 1, eligible: () => true, score: (_c, w) => w.emote },
];

/** 후보 정렬 ②③ 의 키: 생존자가 가장 크고, 탈락자는 더 늦게 탈락할수록 크다(같은 일차면 밤이 낮보다 늦다). 기록 없는 탈락은 마지막 날 낮으로 본다. */
function survivalKey(ctx: Ctx, w: Who): number {
  if (w.alive) return Number.MAX_SAFE_INTEGER;
  const out = w.elimination;
  return out === undefined ? ctx.lastDay * 2 : out.n * 2 + (out.at === "night" ? 1 : 0);
}

/** 후보 정렬 비교 하나가 ①점수 큰 쪽 ②생존자 우선·더 늦은 탈락 ③낮은 좌석을 모두 맡는다. */
function byCandidate(ctx: Ctx): (a: { w: Who; score: number }, b: { w: Who; score: number }) => number {
  return (a, b) => b.score - a.score || survivalKey(ctx, b.w) - survivalKey(ctx, a.w) || a.w.seat - b.w.seat;
}

/** 패 순서(D-7): 팀(진 0 → 이김 1) → 단계 → 낮은 좌석. 이긴 팀 = winner 가 mafiaWin 이면 마피아 편, 아니면 그 밖의 직업. */
function sortCards(ctx: Ctx, winner: RoomState["winner"], cards: Array<AwardLine & { tier: AwardTier }>): AwardLine[] {
  const mafiaWon = winner === "mafiaWin";
  const teamKey = (seat: number): number => (ctx.who.get(seat)?.mafia === mafiaWon ? 1 : 0);
  return [...cards]
    .sort((a, b) => teamKey(a.seat) - teamKey(b.seat) || a.tier - b.tier || a.seat - b.seat)
    .map(({ tier: _tier, ...line }) => line);
}

/** 참가자(역할이 있는 사람) 한 명에 정확히 한 장. 같은 기록은 늘 같은 목록이다(난수·시각 없음). */
export function computeAwards(state: RoomState): AwardLine[] {
  const ctx = buildCtx(state);
  const seats = [...ctx.who.keys()].sort((a, b) => a - b);
  const cards: Array<AwardLine & { tier: AwardTier }> = [];
  const taken = new Set<number>();
  for (const spec of SPECS) {
    const candidates = seats
      .filter((seat) => !taken.has(seat))
      .map((seat) => ctx.who.get(seat)!)
      .filter((w) => spec.eligible(ctx, w))
      .map((w) => ({ w, score: spec.score(ctx, w) }))
      .filter((c) => c.score >= AWARD_MIN[spec.id])
      .sort(byCandidate(ctx));
    const winner = candidates[0];
    if (winner === undefined) continue;
    taken.add(winner.w.seat);
    cards.push({ seat: winner.w.seat, award: spec.id, k: winner.score, tier: spec.tier });
  }
  for (const seat of seats) {
    if (taken.has(seat)) continue;
    const w = ctx.who.get(seat)!;
    if (w.alive) {
      cards.push({ seat, award: "survivor", tier: 0 });
    } else {
      const out = w.elimination ?? { n: ctx.lastDay, at: "day" as const };
      cards.push({ seat, award: "spectator", k: out.n, at: out.at, tier: 0 });
    }
  }
  return sortCards(ctx, state.winner, cards);
}
