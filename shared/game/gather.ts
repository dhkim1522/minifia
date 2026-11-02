// RED 자리표시자 — 같은 작업의 GREEN 커밋이 구현으로 바꾼다.
import type { RoomState } from "./room";
import type { WorldState } from "./world";

export const RING_RADIUS_FX = 0;
export const RING_SLOTS: Readonly<Record<number, readonly (readonly [number, number])[]>> = {};
export function ringSlots(_n: number): readonly (readonly [number, number])[] {
  return [];
}
export function assignSlots(
  _people: readonly { id: string; x: number; z: number }[],
  _slots: readonly (readonly [number, number])[],
): Record<string, readonly [number, number]> {
  return {};
}
export function layoutKey(_state: RoomState): string | null {
  return null;
}
export interface GatherLayout {
  key: string;
  slots: Record<string, readonly [number, number]>;
  moves: { playerId: string; dest: { x: number; z: number } }[];
}
export function layoutFor(_state: RoomState, _w: WorldState, _now: number): GatherLayout | null {
  return null;
}
