// 저녁·아침 [건너뛰기](21페이즈 D-23) — 순수 모듈, 역할을 읽지 않는다. (자리 함수: 21-05 RED)
import type { PhaseId } from "../protocol";
import type { RoomState } from "./room";
import type { VoteError } from "./discussion";

export const SKIP_PHASES: readonly PhaseId[] = ["errand", "morning"];
export function toggleSkip(state: RoomState, _actorId: string, _on: boolean): { ok: true; state: RoomState } | { ok: false; error: VoteError } {
  return { ok: true, state };
}
export function skipCountOf(_state: RoomState): number {
  return 0;
}
export function skipReached(_state: RoomState): boolean {
  return false;
}
export function clearSkip(state: RoomState): RoomState {
  return state;
}
