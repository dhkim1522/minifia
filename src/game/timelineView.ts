// 기록 타임라인 순수 모듈 (11-11, 결정 D-8·D-9, 0066-1·0067-3, UI-SPEC C).
// 결과 화면 기록 탭이 그릴 일차 카드와 하루 상세 줄을 끝난 뒤 공개된 값에서 만든다. React·DOM 을 모르고, 서버 모듈(shared/game/*)도 import 하지 않는다 — 클라이언트 번들 경계.
// 입력은 view.result(seats·summary)·view.day.voteLog 와 resultLog 부분(claim·ballots·whisper)뿐이다(T-11-36): 판 중 view·장면 경로에서는 직업·주장을 계산하지 않는다.
import type { BadgeId, GameResult, ResultLogBallotsLine, ResultLogClaimLine, ResultLogWhisperLine, RoleId, VoteLogEntry } from "../../shared/protocol";

/** 기록 탭이 읽는 view 의 일부. RoomView 는 이 모양을 구조적으로 만족한다 */
export interface TimelineViewInput {
  result: GameResult;
  day?: { voteLog?: readonly VoteLogEntry[] | undefined } | undefined;
}

interface PartOf<L> {
  readonly lines: readonly L[];
}
/** 기록 탭이 읽는 resultLog 부분(ResultLogSnapshot 의 일부) */
export interface TimelineLog {
  claim: PartOf<ResultLogClaimLine>;
  ballots: PartOf<ResultLogBallotsLine>;
  whisper: PartOf<ResultLogWhisperLine>;
}

export type DayCell = { kind: "executed"; seat: number; job: RoleId } | { kind: "none" };
/** null = 밤 행이 없음(마지막 일차가 낮에 끝났다) */
export type NightCell = null | { kind: "none" } | { kind: "died"; seat: number } | { kind: "saved"; seat: number };

export interface DayCard {
  n: number;
  day: DayCell;
  night: NightCell;
}

export interface PointArrow {
  from: number;
  to: number;
}
export interface PointCount {
  seat: number;
  count: number;
}
/** 그날 유효한 직업 주장. lie = 주장이 진짜 직업과 다르고 그 사람이 마피아일 때만(진홍 점선) */
export interface ClaimRow {
  seat: number;
  claimed: RoleId;
  job: RoleId;
  lie: boolean;
}
export type NightResult = "died" | "saved" | "none";
export interface DayLines {
  n: number;
  /** 지목: voteLog 순서의 화살표와 받은 사람별 득표 수(많은 순, 같으면 좌석 순) */
  pointing: { arrows: PointArrow[]; counts: PointCount[] };
  /** 찬반: 그날 ballots 줄(없으면 null — 마지막 3인 결전 날 등) */
  ballots: { yes: number[]; no: number[] } | null;
  /** 주장: 그날 산 사람의 유효 주장(그 일차 이하 최신, none 제외), 좌석 순 */
  claims: ClaimRow[];
  /** 말 바꿈: 그날 주장을 직전 값(none 아님)에서 바꾼 좌석(좌석 순, 한 번씩) */
  swaps: number[];
  /** 귓속말: 그날 오간 건수만큼, 기록 순서 */
  whispers: Array<{ from: number; to: number }>;
  /** 밤: 그 밤 산 마피아 → 대상, 결과. 밤 행이 없으면 null */
  night: { mafias: number[]; target?: number; result: NightResult } | null;
}

const jobOf = (view: TimelineViewInput, seat: number): RoleId | undefined => view.result.seats.find((s) => s.seat === seat)?.job;

/** 처형: 찬반을 통과했거나, 찬반이 0·0 인데 후보가 있는 날(마지막 3인 결전 — view 는 last 표시를 옮기지 않는다) */
function executedSeat(exec: { yes: number; no: number; passed: boolean; candidate?: number } | undefined): number | undefined {
  if (exec?.candidate === undefined) return undefined;
  return exec.passed || (exec.yes === 0 && exec.no === 0) ? exec.candidate : undefined;
}

/** 일차 카드 배열 — summary 행 순서(일차 오름차순) */
export function timelineOf(view: TimelineViewInput, _log?: TimelineLog): DayCard[] {
  return view.result.summary.map((row): DayCard => {
    const seat = executedSeat(row.exec);
    const job = seat === undefined ? undefined : jobOf(view, seat);
    const day: DayCell = seat !== undefined && job !== undefined ? { kind: "executed", seat, job } : { kind: "none" };
    let night: NightCell = null;
    if (row.night !== undefined) {
      const target = row.night.target;
      night = target === undefined ? { kind: "none" } : row.night.died ? { kind: "died", seat: target } : { kind: "saved", seat: target };
    }
    return { n: row.n, day, night };
  });
}

interface Eliminations {
  /** 처형된 일차(낮) */
  exec: Map<number, number>;
  /** 밤에 죽은 일차 */
  night: Map<number, number>;
}

/** 탈락 일차 표(shared/game/awards 의 eliminationOf 와 같은 규칙을 공개 값으로 다시 쓴다 — 서버 모듈을 import 하지 않는다) */
function eliminationsOf(view: TimelineViewInput): Eliminations {
  const out: Eliminations = { exec: new Map(), night: new Map() };
  for (const row of view.result.summary) {
    const seat = executedSeat(row.exec);
    if (seat !== undefined && !out.exec.has(seat)) out.exec.set(seat, row.n);
    const night = row.night;
    if (night?.died === true && night.target !== undefined && !out.night.has(night.target)) out.night.set(night.target, row.n);
  }
  return out;
}

/** 그 일차 낮에 산 채인가: 처형된 날·밤에 죽은 날의 낮까지는 산 채다 */
const aliveOnDay = (e: Eliminations, seat: number, n: number): boolean => {
  const at = e.exec.get(seat) ?? e.night.get(seat);
  return at === undefined || at >= n;
};
/** 그 밤 산 채인가: 처형된 일차의 밤부터 없고, 밤에 죽은 사람은 그 밤까지 산 채다 */
const aliveOnNight = (e: Eliminations, seat: number, n: number): boolean => {
  const x = e.exec.get(seat);
  const d = e.night.get(seat);
  return (x === undefined || x > n) && (d === undefined || d >= n);
};

/** 하루 상세 줄 */
export function dayLinesOf(view: TimelineViewInput, log: TimelineLog, n: number): DayLines {
  const entry = (view.day?.voteLog ?? []).find((e) => e.n === n);
  const arrows: PointArrow[] = (entry?.cand?.votes ?? []).map((v) => ({ from: v.seat, to: v.target }));
  const tally = new Map<number, number>();
  for (const a of arrows) tally.set(a.to, (tally.get(a.to) ?? 0) + 1);
  const counts = [...tally].map(([seat, count]) => ({ seat, count })).sort((a, b) => b.count - a.count || a.seat - b.seat);

  const ballotLine = log.ballots.lines.find((l) => l.n === n);
  const ballots = ballotLine === undefined ? null : { yes: [...ballotLine.yes], no: [...ballotLine.no] };

  const elim = eliminationsOf(view);
  // 주장: 좌석마다 기록 순서대로 걸으며 그 일차 이하의 최신 값을 쥐고, 그날 줄이 직전 값(none 아님)과 달라지면 말 바꿈
  const current = new Map<number, BadgeId>();
  const swapped = new Set<number>();
  for (const line of log.claim.lines) {
    if (line.n > n) continue;
    const prev = current.get(line.seat) ?? "none";
    if (line.n === n && prev !== "none" && line.v !== prev) swapped.add(line.seat);
    current.set(line.seat, line.v);
  }
  const claims: ClaimRow[] = [];
  for (const [seat, claimed] of [...current].sort((a, b) => a[0] - b[0])) {
    const job = jobOf(view, seat);
    if (claimed === "none" || job === undefined || !aliveOnDay(elim, seat, n)) continue;
    claims.push({ seat, claimed, job, lie: job === "mafia" && claimed !== job });
  }
  const swaps = [...swapped].filter((seat) => aliveOnDay(elim, seat, n)).sort((a, b) => a - b);

  const whispers = log.whisper.lines.filter((l) => l.n === n).map((l) => ({ from: l.seat, to: l.to }));

  const row = view.result.summary.find((r) => r.n === n);
  let night: DayLines["night"] = null;
  if (row?.night !== undefined) {
    const mafias = view.result.seats.filter((s) => s.job === "mafia" && aliveOnNight(elim, s.seat, n)).map((s) => s.seat).sort((a, b) => a - b);
    const target = row.night.target;
    night = target === undefined ? { mafias, result: "none" } : { mafias, target, result: row.night.died ? "died" : "saved" };
  }
  return { n, pointing: { arrows, counts }, ballots, claims, swaps, whispers, night };
}
