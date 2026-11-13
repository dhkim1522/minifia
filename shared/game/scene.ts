// 아침 현장 판정(21페이즈 D-12~D-16·D-22) — 자리 값(RED 단계). 실제 규칙은 GREEN 에서 채운다.
import type { PhaseId } from "../protocol";
import type { RoomState } from "./room";

export const CLUE_PHASES: readonly PhaseId[] = [];

export function neighborsOf(_house: number): [number, number] {
  return [0, 0];
}

export function buildScene(_state: RoomState, _house: number, _randInt: (n: number) => number, _lit: readonly number[], _alive: readonly number[]): RoomState["scene"] {
  return undefined;
}

export function actInspect(_state: RoomState, _actorId: string, _posFx: { x: number; z: number }): { ok: true; state: RoomState; spot: 1 | 2 | 3 } | { ok: false } {
  return { ok: false };
}

export function clearScene(state: RoomState): RoomState {
  return state;
}
