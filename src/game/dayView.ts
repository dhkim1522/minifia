// 낮 처형 화면 연출 순수 모듈 (자리표시자 — 구현은 다음 커밋).
import type { RoomView } from "../../shared/protocol";

export interface DayLine {
  kind: "system" | "vote" | "hot";
  text: string;
  at?: number;
}
export interface PointToast {
  to: number;
  from: number[];
  toName: string;
  fromNames: string[];
  changed?: boolean;
}
export interface DayAnnounce {
  text: string;
  at: number;
  ms: number;
}
export interface DayFx {
  kind: "ghostRise";
  seat: number;
  at: number;
}
export interface PointsTally {
  counts: Record<number, number>;
  leader?: number;
  majority: number;
  sure?: number;
}
export interface DayEvents {
  lines: DayLine[];
  toasts: PointToast[];
  announces: DayAnnounce[];
  fx: DayFx[];
  state: PointsTally;
}

export function pointsTally(_view: RoomView): PointsTally {
  return { counts: {}, majority: 0 };
}

export function dayEvents(_prev: RoomView | null, cur: RoomView, _opts?: { reset?: boolean }): DayEvents {
  return { lines: [], toasts: [], announces: [], fx: [], state: pointsTally(cur) };
}
