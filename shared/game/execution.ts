// RED 껍데기: GREEN 에서 구현으로 바꾼다.
import type { NoExecutionReason } from "../protocol";
import type { RoomState } from "./room";
import type { DeadlineResult, RandInt } from "./tick";

export function enterCandidateVoteReveal(_state: RoomState, _randInt: RandInt): RoomState {
  throw new Error("not implemented");
}

export function routeAfterCandidateVote(_state: RoomState): DeadlineResult {
  throw new Error("not implemented");
}

export function enterExecution(_state: RoomState, _randInt: RandInt): RoomState {
  throw new Error("not implemented");
}

export function noExecutionOf(_state: RoomState): { reason: NoExecutionReason } | undefined {
  throw new Error("not implemented");
}
