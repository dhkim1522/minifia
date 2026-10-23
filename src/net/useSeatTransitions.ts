// RED 단계 자리표시자: 전이를 표시하지 않는다. 등장·퇴장 계산은 GREEN 에서 채운다.
import type { PublicPlayer } from "../../shared/protocol";

export type SeatTransition = "entering" | "leaving" | null;

export function useSeatTransitions(
  players: PublicPlayer[],
  _epoch: number,
): (PublicPlayer & { transition: SeatTransition })[] {
  return players.map((p) => ({ ...p, transition: null }));
}
