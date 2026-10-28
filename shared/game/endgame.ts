// 종료 분기·종단 단계 진입. (RED 단계 껍데기 — GREEN 에서 채운다)
import type { RoomState } from "./room";
import type { DeadlineResult, RandInt } from "./tick";

export const ENDED_ROOM_TTL_MS = 30 * 60 * 1000;

export function routeAfterExecution(_state: RoomState): DeadlineResult {
  throw new Error("not implemented");
}

export function routeAfterMorning(_state: RoomState): DeadlineResult {
  throw new Error("not implemented");
}

export function enterEnded(_state: RoomState, _randInt: RandInt, _at: number): RoomState {
  throw new Error("not implemented");
}
