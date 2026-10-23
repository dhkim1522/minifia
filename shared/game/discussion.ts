// 방장 연장·넘기기 뼈대 — RED 단계용. GREEN 에서 구현한다.
import type { RoomState } from "./room";

export type DiscussionError = "NOT_HOST" | "WRONG_PHASE" | "ALREADY_EXTENDED";

export function extendDiscussion(
  _state: RoomState,
  _actorId: string,
): { ok: true; state: RoomState } | { ok: false; error: DiscussionError } {
  return { ok: false, error: "NOT_HOST" };
}

export function skipDiscussion(
  _state: RoomState,
  _actorId: string,
  _now: number,
): { ok: true; state: RoomState } | { ok: false; error: "NOT_HOST" | "WRONG_PHASE" } {
  return { ok: false, error: "NOT_HOST" };
}

export function phaseDurationOf(_state: RoomState): number | null {
  return null;
}
