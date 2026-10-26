// RED 단계의 자리표시자 — 구현은 GREEN 커밋에서 채운다. 테스트가 import 로 죽지 않고 단언에서 실패하게 하려는 껍데기다.
import type { ExecTally, PhaseId } from "../protocol";
import type { RoomState } from "./room";

export type VoteError = "WRONG_PHASE" | "BAD_MESSAGE";

const NOT_IMPLEMENTED = (): never => {
  throw new Error("vote.ts: not implemented (RED)");
};

export function castExecVote(
  _state: RoomState,
  _actorId: string,
  _agree: boolean,
): { ok: true; state: RoomState } | { ok: false; error: VoteError } {
  return NOT_IMPLEMENTED();
}
export function execTallyOf(_state: RoomState): ExecTally {
  return NOT_IMPLEMENTED();
}
export function resolveExecVote(_state: RoomState): { state: RoomState; stay: boolean; next?: PhaseId } {
  return NOT_IMPLEMENTED();
}
export function enterExecVote(_state: RoomState): RoomState {
  return NOT_IMPLEMENTED();
}
