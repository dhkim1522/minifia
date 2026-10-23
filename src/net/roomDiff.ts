// RED 단계 자리표시자: 테스트가 불러올 수 있게 모양만 둔다. 계산은 GREEN 에서 채운다.
import type { RoomView } from "../../shared/protocol";

export interface RoomDiff {
  joined: { seat: number; nickname: string }[];
  left: number[];
  newHost: { seat: number; nickname: string } | null;
}

export function diffRoomViews(_prev: RoomView | null, _next: RoomView): RoomDiff {
  return { joined: [], left: [], newHost: null };
}

export function toastForDiff(_diff: RoomDiff): string | null {
  return null;
}
