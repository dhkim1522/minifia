// 목격 기록 줄과 아침 흔적 구간(15페이즈, D-04·D-06). 순수 함수 — DOM·window·시각을 읽지 않는다(시각은 인자로 받는다).
// 기록 유무는 서버가 준 view.me.record 하나로만 정한다: 화면이 기록을 만들지 않는다(T-15-30).
import { MORNING_TRACE_MS, RECORD_MAX } from "../../shared/game/phases";
import type { PlaceId, RoomView, TracePiece } from "../../shared/protocol";

export interface RecordRow {
  /** 시간순 번호(1부터) */
  n: number;
  seat: number;
  place: PlaceId;
  /** players[] 의 닉네임(없으면 빈 문자열) */
  name: string;
}

/** me.record 가 없으면 null(못 마친 사람·유령·다른 단계), 있으면 줄 목록(빈 배열 가능). 최대 RECORD_MAX 줄 */
export function recordRowsOf(view: RoomView): RecordRow[] | null {
  const record = view.me.record;
  if (record === undefined) return null;
  return record.slice(0, RECORD_MAX).map((line, i) => ({
    n: i + 1,
    seat: line.seat,
    place: line.place,
    name: view.players.find((p) => p.seat === line.seat)?.nickname ?? "",
  }));
}

export interface TraceWindow {
  piece: TracePiece;
  /** 흔적 구간이 시작되기까지 남은 ms(이미 시작했으면 0) */
  startsInMs: number;
  /** 지금이 흔적 구간 안인가 */
  on: boolean;
}

/**
 * 흔적 구간 = 아침 단계의 마지막 MORNING_TRACE_MS. 서버가 흔적이 있는 아침에만 단계 길이에 그 값을 더해 뒤에 붙이므로
 * 피해자 알림·유언·쪽지의 시각을 따로 계산하지 않는다. serverNow 는 서버 시계 기준 시각.
 */
export function traceWindowOf(view: RoomView, serverNow: number): TraceWindow | null {
  if (view.phase !== "morning") return null;
  const piece = view.day?.morning?.trace;
  if (piece === undefined || view.phaseEndsAt === null) return null;
  const startAt = view.phaseEndsAt - MORNING_TRACE_MS;
  return { piece, startsInMs: Math.max(0, startAt - serverNow), on: serverNow >= startAt };
}
