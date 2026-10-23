// RED 단계용 임시 뼈대 — GREEN 에서 구현한다.
import type { RoomState } from "./room";

export function tick(state: RoomState, _now: number): RoomState {
  return state;
}

export function nextWakeAt(_state: RoomState): number {
  return Number.POSITIVE_INFINITY;
}
