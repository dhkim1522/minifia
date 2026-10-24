// 밤 규칙(순수 모듈) — 뼈대. 구현은 다음 커밋이 채운다.
import type { InvestigationRecord } from "../protocol";
import type { RoomState } from "./room";
import type { RandInt } from "./tick";

export type NightError = "WRONG_PHASE" | "BAD_MESSAGE";

export function pickTarget(
  _state: RoomState,
  _actorId: string,
  _target: number,
): { ok: true; state: RoomState } | { ok: false; error: NightError } {
  return { ok: false, error: "BAD_MESSAGE" };
}

export function enterNight(state: RoomState): RoomState {
  return state;
}

export function resolveNight(
  _state: RoomState,
  _randInt: RandInt,
): { eliminated?: number; phrase?: number; records: Array<{ playerId: string; record: InvestigationRecord }> } {
  return { records: [] };
}

export function enterMorning(state: RoomState, _randInt: RandInt): RoomState {
  return state;
}
