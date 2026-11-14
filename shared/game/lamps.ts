// 자리 함수(RED 단계) — 구현은 GREEN 에서 채운다.
import type { RoomState } from "./room";

export function withCut(state: RoomState, _actorId: string, _id: string, _hold: boolean): RoomState {
  return state;
}

export function houseLitOf(_players: readonly unknown[], lampIds: readonly string[]): boolean[] {
  return lampIds.map(() => false);
}
