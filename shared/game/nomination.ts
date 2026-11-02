// RED 단계 자리표시자 — 시험이 불러올 수 있게 이름만 둔다. GREEN 커밋이 구현으로 바꾼다.
import type { RoomState } from "./room";
import type { DeadlineResult } from "./tick";

export function majorityOf(_aliveCount: number): number {
  return 0;
}
export function castPoint(_state: RoomState, _actorId: string, _target: number): { ok: false; error: "WRONG_PHASE" | "BAD_MESSAGE" } {
  return { ok: false, error: "BAD_MESSAGE" };
}
export function pointLinesOf(_state: RoomState): { seat: number; target: number }[] {
  return [{ seat: -1, target: -1 }];
}
export function tallyPoints(_state: RoomState): { votes: { seat: number; target: number }[]; counts: Record<number, number>; leader?: number; majority: number } {
  return { votes: [{ seat: -1, target: -1 }], counts: {}, leader: -1, majority: 0 };
}
export function resolveNomination(state: RoomState): DeadlineResult {
  return { state, stay: true };
}
