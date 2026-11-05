import type { MapId } from "../../shared/protocol";
import { PLAYABLE_MAPS } from "../../shared/game/maps";

/**
 * 시험 동안 허용 맵에 광장이 들어 있게 한다(11-13). 이미 열려 있으면 아무것도 하지 않는다.
 * PLAYABLE_MAPS 가 [bar] 이든 [bar, plaza] 이든 같은 시험이 돌게 하는 도우미다. 돌려준 함수를 부르면 원래대로 되돌린다.
 */
export function openPlaza(): () => void {
  const list = PLAYABLE_MAPS as MapId[];
  const had = list.includes("plaza");
  if (!had) list.push("plaza");
  return () => {
    if (!had) list.splice(list.indexOf("plaza"), 1);
  };
}
