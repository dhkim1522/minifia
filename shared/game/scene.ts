// 아침 현장 조사(21페이즈 D-12~D-17·D-21, 결정 0088) — RED 자리 함수. 구현은 GREEN 에서 채운다.
import type { RoomState, SceneState } from "./room";

type RandInt = (n: number) => number;

export function buildScene(_state: RoomState, _house: number | undefined, _randInt: RandInt): SceneState | undefined {
  return undefined;
}

export function inspectSpot(_state: RoomState, _actorId: string, _posFx: { x: number; z: number }): { ok: true; state: RoomState } | { ok: false } {
  return { ok: false };
}
