// 가로등 공개 값(21페이즈 D-06·D-07·D-08) — 순수 모듈, 역할을 읽지 않는다. (자리 함수: 21-05 RED)
import type { RoomState } from "./room";

export function lampNumberOf(_place: string): number | undefined {
  return undefined;
}
export function lampsShownOf(_state: RoomState): number[] {
  return [];
}
export function lampsLitOf(_state: RoomState): number[] {
  return [];
}
