// 시민 편 밤 어둠 판정 (NIGHT-10, 12-09): 밤이고 내가 산 사람이며 마피아가 아니면 참.
// GameMap(어둠 표식·긴장 비네트)과 RoomScreen(소리의 시각 큐 갈래 불리언)이 같은 식을 쓴다 — 두 곳이 어긋나면 비네트가 없는데 소리가 비네트를 기다리게 된다.
// 역할은 서버가 이 사람에게만 보낸 view.me.role 이다. 이 함수의 결과(불리언 하나)만 소리 쪽으로 나가고 역할 값은 나가지 않는다.
import { isAlive } from "../../shared/game/alive";
import type { RoomView } from "../../shared/protocol";

export function nightDarkOf(view: RoomView): boolean {
  if (view.phase !== "night") return false;
  const me = view.players.find((p) => p.seat === view.me.seat);
  const meAlive = me === undefined || isAlive(me);
  return meAlive && view.me.role !== "mafia";
}
