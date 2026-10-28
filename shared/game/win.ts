// 승패 판정. (RED 단계 껍데기 — GREEN 에서 채운다)
import type { RoomState } from "./room";

export type Winner = "citizen" | "mafia";

export function checkWinner(_state: RoomState): Winner | null {
  throw new Error("not implemented");
}
