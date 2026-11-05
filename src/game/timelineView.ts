// 기록 타임라인 순수 모듈 (11-11, 결정 D-8·D-9, 0066-1·0067-3, UI-SPEC C).
// 결과 화면 기록 탭이 그릴 일차 카드와 하루 상세 줄을 끝난 뒤 공개된 값에서 만든다. React·DOM 을 모르고, 서버 모듈(shared/game/*)도 import 하지 않는다 — 클라이언트 번들 경계.
// 입력은 view.result(seats·summary)·view.day.voteLog 와 resultLog 부분(claim·ballots·whisper)뿐이다(T-11-36): 판 중 view·장면 경로에서는 직업·주장을 계산하지 않는다.
import type { GameResult, ResultLogBallotsLine, ResultLogClaimLine, ResultLogWhisperLine, RoleId, VoteLogEntry } from "../../shared/protocol";

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
export interface DayLines {
  n: number;
  /** 지목: voteLog 순서의 화살표와 받은 사람별 득표 수(많은 순, 같으면 좌석 순) */
  pointing: { arrows: PointArrow[]; counts: PointCount[] };
}

const jobOf = (view: TimelineViewInput, seat: number): RoleId | undefined => view.result.seats.find((s) => s.seat === seat)?.job;

/** 처형: 찬반을 통과했거나, 찬반이 0·0 인데 후보가 있는 날(마지막 3인 결전 — view 는 last 표시를 옮기지 않는다) */
function executedSeat(exec: { yes: number; no: number; passed: boolean; candidate?: number } | undefined): number | undefined {
  if (exec?.candidate === undefined) return undefined;
  return exec.passed || (exec.yes === 0 && exec.no === 0) ? exec.candidate : undefined;
}

/** 일차 카드 배열 — summary 행 순서(일차 오름차순) */
export function timelineOf(view: TimelineViewInput, _log: TimelineLog): DayCard[] {
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

/** 하루 상세 줄 */
export function dayLinesOf(view: TimelineViewInput, _log: TimelineLog, n: number): DayLines {
  const entry = (view.day?.voteLog ?? []).find((e) => e.n === n);
  const arrows: PointArrow[] = (entry?.cand?.votes ?? []).map((v) => ({ from: v.seat, to: v.target }));
  const tally = new Map<number, number>();
  for (const a of arrows) tally.set(a.to, (tally.get(a.to) ?? 0) + 1);
  const counts = [...tally].map(([seat, count]) => ({ seat, count })).sort((a, b) => b.count - a.count || a.seat - b.seat);
  return { n, pointing: { arrows, counts } };
}
