// 판 종류 고르기(결정 0081-6, 19페이즈 D-05·D-06) — 순수 모듈. 자리 함수(19-01 RED): 판정은 다음 커밋이 채운다.
import type { GameMode } from "../protocol";
import type { RoomState } from "./room";

/** 방장의 판 종류 고르기(자리 함수). */
export function pickMode(_state: RoomState, _actorId: string, _mode: GameMode): { ok: true; state: RoomState } | { ok: false } {
  return { ok: false };
}
