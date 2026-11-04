// 순차 지목 화면 순수 모델(결정 0063-1, UI-SPEC A-2·A-3·A-5). 서버 공개 정보(day.turn·day.points·players)만 읽는다. 시각은 인자 serverNow 로만.
// 차례 알약·막대·헤더 링·위 한 줄이 모두 이 모듈의 값 하나에서 나온다(서로 다른 색·초가 될 수 없다).
import { isAlive } from "../../shared/game/alive";
import { PICK_TURN_MS, RUNOFF_VOTE_MS } from "../../shared/game/phases";
import type { RoomView } from "../../shared/protocol";
import { timerTone, type TimerTone } from "../net/countdown";

/** 차례 알약·위 한 줄 문구 표. UI-SPEC "Copywriting Contract" 원문 — 해요체, 마침표·느낌표 없음. */
export const TURN_COPY = {
  count: (no: number, total: number): string => `${no} / ${total}`,
  turnOf: (name: string): string => `${name} 님 차례`,
  seconds: (n: number): string => `${n}초`,
  gather: "가운데로 모여요",
  pointed: (name: string, target: string): string => `${name} 님이 ${target} 님을 가리켜요`,
  abstained: (name: string): string => `${name} 님이 고르지 못했어요`,
  allPicked: "모두 골랐어요",
  allPickedTop: (name: string, votes: number): string => `모두 골랐어요 · ${name} 님 ${votes}표`,
  // ---- 동점 결선(09.1.1-14, UI-SPEC D) ----
  /** 지목 끝 알림에서 최다가 정확히 둘 동점일 때, 그리고 결선 앞머리의 위 한 줄 */
  tie: "동점이에요",
  /** 결선 알약의 단계 이름 */
  runoffPill: "결선",
  /** 후보 본인의 헤더 안내 */
  runoffWait: "결과를 기다려요",
  /** 후보가 아닌 산 사람의 헤더 안내 */
  runoffPick: "둘 중 한 명을 눌러요",
  runoffVotes: (name: string, votes: number): string => `${name} 님 ${votes}표`,
  runoffTie: "또 동점이에요",
} as const;

/** gather 모이는 중 · turn 차례 중 · done 확정 뒤 사이(0.9초) · end 끝 알림 */
export type TurnStage = "gather" | "turn" | "done" | "end";

export interface TurnLook {
  stage: TurnStage;
  /** 몇 번째 차례(1부터). 모이는 중은 0, 끝 알림은 N */
  no: number;
  /** 전체 차례 수 N(지목 시작 때 산 사람 수) */
  total: number;
  /** 지금(또는 방금) 차례인 좌석. 모이는 중·끝 알림에는 없다 */
  seat?: number;
  name?: string;
  remainingMs: number;
  /** 올림한 남은 초 */
  seconds: number;
  /** 남은 시간 ÷ 차례 길이, 0~1 */
  ratio: number;
  tone: TimerTone;
  myTurn: boolean;
}

const nameOf = (view: RoomView, seat: number): string | undefined => view.players.find((p) => p.seat === seat)?.nickname;

/** 지금 지목의 단계. 지목이 아니거나 day.turn 이 없으면 null. 시각이 필요 없다. */
export function turnStageOf(view: RoomView): TurnStage | null {
  const turn = view.phase === "nomination" ? view.day?.turn : undefined;
  if (turn === undefined) return null;
  if (turn.i < 0) return "gather";
  if (turn.i >= turn.order.length) return "end";
  return turn.doneAt === undefined ? "turn" : "done";
}

/** 지금 내 차례인가: 차례 중(미확정)이고 order[i] 가 내 좌석이며 내가 탈락하지 않았다. 유령은 언제나 false. */
export function isMyTurn(view: RoomView): boolean {
  const turn = view.day?.turn;
  if (turnStageOf(view) !== "turn" || turn === undefined) return false;
  const me = view.players.find((p) => p.seat === view.me.seat);
  if (me !== undefined && !isAlive(me)) return false;
  return turn.order[turn.i] === view.me.seat;
}

/** 차례 표시 값. 지목이 아니거나 day.turn 이 없으면 null. */
export function turnLook(view: RoomView, serverNow: number): TurnLook | null {
  const stage = turnStageOf(view);
  const turn = view.day?.turn;
  if (stage === null || turn === undefined) return null;
  const total = turn.order.length;
  const base = { stage, total, myTurn: isMyTurn(view) };
  if (stage === "gather") return { ...base, no: 0, remainingMs: 0, seconds: 0, ratio: 0, tone: "calm" };
  if (stage === "end") return { ...base, no: total, remainingMs: 0, seconds: 0, ratio: 0, tone: "calm" };

  const seat = turn.order[turn.i]!;
  const name = nameOf(view, seat);
  const endsAt = turn.endsAt ?? 0;
  // 확정되면 그 순간 값에서 멈춘다(기권은 마감 시각에 확정돼 0). 아니면 서버 시각 기준 남은 시간.
  const remaining =
    stage === "done"
      ? turn.skip === true || turn.doneAt === undefined
        ? 0
        : Math.max(0, endsAt - turn.doneAt)
      : Math.max(0, endsAt - serverNow);
  const seconds = Math.ceil(remaining / 1000);
  return {
    ...base,
    no: turn.i + 1,
    seat,
    ...(name !== undefined ? { name } : {}),
    remainingMs: remaining,
    seconds,
    ratio: Math.min(1, Math.max(0, remaining / PICK_TURN_MS)),
    // 헤더 링(PhaseHeader)과 같은 입력: 올림 초 × 1000. 차례 길이 8초는 10초 이하라 놋쇠 단계는 자동으로 없다.
    tone: timerTone(seconds * 1000, PICK_TURN_MS),
  };
}

/** 득표 줄에서 최다 득표 좌석과 그 표 수(0표면 빈 배열) */
function topSeatsOf(points: readonly { target: number }[]): { top: number; seats: number[] } {
  const counts = new Map<number, number>();
  for (const line of points) counts.set(line.target, (counts.get(line.target) ?? 0) + 1);
  const top = Math.max(0, ...counts.values());
  return { top, seats: top > 0 ? [...counts].filter(([, k]) => k === top).map(([seat]) => seat) : [] };
}

/** 지목 끝 알림 시점에 최다 득표가 정확히 둘로 동점인가(결선이 열린다). 지목이 아니거나 끝 알림이 아니면 false */
export function isRunoffTie(view: RoomView): boolean {
  return turnStageOf(view) === "end" && topSeatsOf(view.day?.points ?? []).seats.length === 2;
}

/** 위 한 줄 문장. 차례 중이거나 day.turn 이 없으면 null(진행은 알약이 말한다). 결선은 앞머리 '동점이에요'·결과 '{이름} 님 {k}표'/'또 동점이에요'. */
export function turnTopLine(view: RoomView): string | null {
  if (blockModeOf(view) === "runoff") return runoffTopLine(view);
  const stage = turnStageOf(view);
  const turn = view.day?.turn;
  if (stage === null || turn === undefined) return null;
  const points = view.day?.points ?? [];
  if (stage === "gather") return TURN_COPY.gather;
  if (stage === "turn") return null;
  if (stage === "done") {
    const seat = turn.order[turn.i]!;
    const name = nameOf(view, seat);
    if (name === undefined) return null;
    if (turn.skip === true) return TURN_COPY.abstained(name);
    const line = points.find((p) => p.seat === seat);
    const target = line === undefined ? undefined : nameOf(view, line.target);
    return target === undefined ? null : TURN_COPY.pointed(name, target);
  }
  // end: 최다가 정확히 둘 동점이면 '동점이에요', 정확히 한 명이면 이름과 표 수, 그 밖은 '모두 골랐어요'
  const { top, seats } = topSeatsOf(points);
  if (seats.length === 2) return TURN_COPY.tie;
  const leaderName = seats.length === 1 ? nameOf(view, seats[0]!) : undefined;
  return leaderName === undefined ? TURN_COPY.allPicked : TURN_COPY.allPickedTop(leaderName, top);
}

// ---- 동점 결선: 지목과 같은 알약·막대·링·위 한 줄을 한 계산에서 낸다(09.1.1-14, UI-SPEC D-1·D-3) ----

/** 알약 부품이 그리는 모드. 마지막 3인(09.1.1-15)이 "speak"|"point" 를 더한다 */
export type BlockMode = "pick" | "runoff";

/** 알약 부품의 값: 지목 TurnLook 에 모드와 그 단계 길이를 더한 것. 막대 비율·계단은 totalMs 로 계산한다 */
export interface BlockLook extends TurnLook {
  mode: BlockMode;
  /** 그 단계(차례·투표 창)의 길이 ms — pick = PICK_TURN_MS, runoff = RUNOFF_VOTE_MS */
  totalMs: number;
}

/** 지금 알약 부품이 그릴 모드. 지목(day.turn 있음)이면 pick, 결선(day.runoff 있음)이면 runoff, 그 밖은 null. 시각이 필요 없다 */
export function blockModeOf(view: RoomView): BlockMode | null {
  if (view.phase === "nomination" && view.day?.turn !== undefined) return "pick";
  if (view.phase === "runoff" && view.day?.runoff !== undefined) return "runoff";
  return null;
}

/** 결선 단계: step 0 앞머리 → gather(알약 없음) · 1 투표 → turn · 2 결과 → end */
function runoffStageOf(step: 0 | 1 | 2): TurnStage {
  return step === 0 ? "gather" : step === 1 ? "turn" : "end";
}

function runoffLook(view: RoomView, serverNow: number): BlockLook | null {
  const runoff = view.day?.runoff;
  if (runoff === undefined) return null;
  const stage = runoffStageOf(runoff.step);
  const base = { mode: "runoff" as const, totalMs: RUNOFF_VOTE_MS, stage, no: 0, total: 0, myTurn: false };
  if (stage !== "turn") return { ...base, remainingMs: 0, seconds: 0, ratio: 0, tone: "calm" };
  // 서버 단계 마감(view.phaseEndsAt) 기준. 5초 단계라 색은 항상 calm 이다(timerTone 한 호출, UI-SPEC D-3)
  const remaining = Math.max(0, (view.phaseEndsAt ?? serverNow) - serverNow);
  const seconds = Math.ceil(remaining / 1000);
  return {
    ...base,
    remainingMs: remaining,
    seconds,
    ratio: Math.min(1, Math.max(0, remaining / RUNOFF_VOTE_MS)),
    tone: timerTone(seconds * 1000, RUNOFF_VOTE_MS),
  };
}

function runoffTopLine(view: RoomView): string | null {
  const runoff = view.day?.runoff;
  if (runoff === undefined) return null;
  if (runoff.step === 0) return TURN_COPY.tie;
  if (runoff.step === 1 || runoff.tally === undefined) return null;
  const [a, b] = runoff.tally;
  if (a === b) return TURN_COPY.runoffTie;
  const winner = nameOf(view, a > b ? runoff.cand[0] : runoff.cand[1]);
  return winner === undefined ? null : TURN_COPY.runoffVotes(winner, Math.max(a, b));
}

/** 알약 부품의 표시 값: 지목이면 turnLook 값 그대로(mode·totalMs 만 더함), 결선이면 결선 값. 둘 다 아니면 null */
export function blockLook(view: RoomView, serverNow: number): BlockLook | null {
  const mode = blockModeOf(view);
  if (mode === "runoff") return runoffLook(view, serverNow);
  if (mode === null) return null;
  const look = turnLook(view, serverNow);
  return look === null ? null : { ...look, mode: "pick", totalMs: PICK_TURN_MS };
}

/** 알약·막대 아랫변 기본값(UI-SPEC A-1 표): 위 100 + 알약 48 + 간격 8 + 막대 4 = 160, 압축형은 위 72 + 40 + 8 + 4 = 124. 막대를 아직 못 쟀을 때(모이는 중·측정 전)만 쓴다. */
export const TURN_BOTTOM_DEFAULT = 160;
export const TURN_BOTTOM_COMPACT = 124;

/** 지목 스테이지 윗변(UI-SPEC A-1): 알약·막대 아랫변 + 4. 알약이 없으면(null) 헤더 아래, 헤더보다 위로는 올라가지 않는다. */
export function mapStageTop(headerBottom: number, turnBottom: number | null): number {
  return turnBottom === null ? headerBottom : Math.max(headerBottom, turnBottom + 4);
}

/** 압축형 알약인가: 8페이즈 기준 스테이지(헤더 아래 62 ~ 패널 위) 높이가 360 미만이면 true. 지금은 360×560 하나. */
export function turnCompact(viewportH: number, panelH: number): boolean {
  return viewportH - panelH - 62 < 360;
}
