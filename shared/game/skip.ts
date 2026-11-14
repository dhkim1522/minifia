// 건너뛰기(21페이즈 D-23, 결정 0088) — RED 단계의 자리 함수. 구현은 GREEN 커밋에서 채운다.
import type { VoteError } from "./discussion";
import type { RoomState } from "./room";

export function toggleSkip(_state: RoomState, _actorId: string, _on: boolean): { ok: true; state: RoomState } | { ok: false; error: VoteError } {
  return { ok: false, error: "WRONG_PHASE" };
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
