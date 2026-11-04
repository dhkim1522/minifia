// 순차 지목 화면 순수 모델(결정 0063-1, UI-SPEC A-2·A-3·A-5). 서버 공개 정보(day.turn·day.points·players)만 읽는다. 시각은 인자 serverNow 로만.
// 차례 알약·막대·헤더 링·위 한 줄이 모두 이 모듈의 값 하나에서 나온다(서로 다른 색·초가 될 수 없다).
import { isAlive } from "../../shared/game/alive";
import { PICK_TURN_MS } from "../../shared/game/phases";
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

/** 위 한 줄 문장. 차례 중이거나 day.turn 이 없으면 null(진행은 알약이 말한다). */
export function turnTopLine(view: RoomView): string | null {
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
  // end: 최다 득표가 정확히 한 명일 때만 이름과 표 수
  const counts = new Map<number, number>();
  for (const line of points) counts.set(line.target, (counts.get(line.target) ?? 0) + 1);
  const top = Math.max(0, ...counts.values());
  const tops = [...counts].filter(([, k]) => k === top && top > 0);
  const leaderName = tops.length === 1 ? nameOf(view, tops[0]![0]) : undefined;
  return leaderName === undefined ? TURN_COPY.allPicked : TURN_COPY.allPickedTop(leaderName, top);
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
