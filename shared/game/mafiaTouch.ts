// 저녁·아침에서 역할을 읽는 유일한 모듈(21페이즈 D-06·D-22). (자리 함수: 21-05 RED)
import type { PlaceId } from "../protocol";
import type { RoomState } from "./room";

export function markCut(state: RoomState, _actorId: string, _place: PlaceId, _hold: boolean): RoomState {
  return state;
}
