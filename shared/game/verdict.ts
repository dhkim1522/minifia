// RED 단계 자리표시자 — 시험이 불러올 수 있게 이름만 둔다. GREEN 커밋이 구현으로 바꾼다.
import type { Player, RoomState } from "./room";
import type { DeadlineResult } from "./tick";

export function verdictVotersOf(_state: RoomState): Player[] {
  return [];
}
export function castVerdict(_state: RoomState, _actorId: string, _agree: boolean): { ok: false; error: "WRONG_PHASE" | "BAD_MESSAGE" } {
  return { ok: false, error: "BAD_MESSAGE" };
}
export function verdictTallyOf(_state: RoomState): { yes: number; no: number; voters: number } {
  return { yes: -1, no: -1, voters: -1 };
}
export function votedSeatsOf(_state: RoomState): number[] {
  return [-1];
}
export function resolveVerdict(state: RoomState): DeadlineResult {
  return { state, stay: true };
}
