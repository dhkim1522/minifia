// RED 자리표시자 — 같은 작업의 GREEN 커밋이 구현으로 바꾼다.
import type { PhaseId } from "../protocol";
import type { Player, RoomState } from "./room";

export const MAP_PHASES: ReadonlySet<PhaseId> = new Set<PhaseId>();
export function canMoveIn(_phase: PhaseId, _alive: boolean): boolean {
  return false;
}
export function canMove(_state: RoomState, _p: Player): boolean {
  return false;
}
