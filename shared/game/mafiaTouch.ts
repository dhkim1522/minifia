// 저녁·아침에서 역할을 읽는 유일한 모듈(21페이즈 D-06·D-22). 다른 저녁·아침 모듈(errand.ts·lamps.ts·skip.ts 등)은 역할을 읽지 않는다 —
// 역할 판정이 필요한 새 규칙은 이 파일에 둔다(21-06 이 단서 흐리기를 더한다). 반환에 역할 값을 싣지 않는다: 돌려주는 것은 새 방 상태뿐이다.

import type { PlaceId } from "../protocol";
import { isAlive } from "./alive";
import type { RoomState } from "./room";

/**
 * 심지 자르기(D-06): 행위자가 방에 있는 산 마피아이고 hold 로 처리한 장소면 lampCut 끝에 place 를 더한 새 상태.
 * 그 밖(시민의 hold · 마피아의 hold 없음 · 죽은 마피아 · 방에 없는 사람 · 이미 자른 장소)은 입력 그대로(같은 객체) — 호출하는 쪽은 결과가 같은 객체인지로 역할을 알 수 없다
 * (방송 여부는 역할을 모르는 lampsShownOf 의 변화로만 정한다, D-21). 입력 상태는 바꾸지 않는다.
 */
export function markCut(state: RoomState, actorId: string, place: PlaceId, hold: boolean): RoomState {
  if (!hold) return state;
  const actor = state.players.find((p) => p.id === actorId);
  if (actor === undefined || !isAlive(actor) || actor.role !== "mafia") return state;
  const cut = state.lampCut ?? [];
  if (cut.includes(place)) return state;
  return { ...state, lampCut: [...cut, place] };
}
