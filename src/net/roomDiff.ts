// 서버가 보낸 대기실 스냅샷 두 개의 차이. 서버는 입장·방장 변경 이벤트를 따로 보내지 않는다 —
// 재접속 때 지난 일을 다시 보여 주지 않도록 토스트와 자리 전이는 모두 이 차이에서만 만든다.
import type { RoomView } from "../../shared/protocol";

export interface RoomDiff {
  joined: { seat: number; nickname: string }[];
  left: number[];
  newHost: { seat: number; nickname: string } | null;
}

const EMPTY: RoomDiff = { joined: [], left: [], newHost: null };

// 자리 재사용을 다른 사람으로 구분하려고 seat 와 닉네임을 함께 키로 쓴다.
const keyOf = (p: { seat: number; nickname: string }): string => `${p.seat}:${p.nickname}`;

/** prev 가 null 이면(첫 스냅샷·재접속 직후) 빈 결과. */
export function diffRoomViews(prev: RoomView | null, next: RoomView): RoomDiff {
  if (!prev) return { ...EMPTY };
  const before = new Set(prev.players.map(keyOf));
  const after = new Set(next.players.map(keyOf));
  // 나에 대한 입장은 알리지 않는다.
  const joined = next.players
    .filter((p) => !before.has(keyOf(p)) && p.seat !== next.me.seat)
    .map((p) => ({ seat: p.seat, nickname: p.nickname }));
  const left = prev.players.filter((p) => !after.has(keyOf(p))).map((p) => p.seat);
  const prevHost = prev.players.find((p) => p.isHost);
  const nextHost = next.players.find((p) => p.isHost);
  const newHost =
    prevHost && nextHost && prevHost.seat !== nextHost.seat ? { seat: nextHost.seat, nickname: nextHost.nickname } : null;
  return { joined, left, newHost };
}

/** 한 번에 하나: 방장 변경이 우선, 없으면 마지막 입장자. */
export function toastForDiff(diff: RoomDiff): string | null {
  if (diff.newHost) return `${diff.newHost.nickname}님이 새 방장이 되었어요`;
  const last = diff.joined[diff.joined.length - 1];
  return last ? `${last.nickname}님이 들어왔어요` : null;
}
