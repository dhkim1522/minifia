// 서버가 보낸 대기실 스냅샷 두 개의 차이. 서버는 입장·퇴장·방장 변경 이벤트를 따로 보내지 않는다 —
// 재접속 때 지난 일을 다시 보여 주지 않도록 알림은 모두 이 차이에서만 만든다.
// 알림 문구는 결정 0051 · 06-UI-SPEC Copywriting "입장·퇴장·방장 알림": "방장 · {닉네임}"(왕관), "{닉네임} 님 입장", "{닉네임} 님 퇴장".
import type { RoomView } from "../../shared/protocol";

export interface RoomDiff {
  joined: { seat: number; nickname: string }[];
  /** 이전 view 의 닉네임을 들고 있다(떠난 사람은 새 view 에 없다) */
  left: { seat: number; nickname: string }[];
  newHost: { seat: number; nickname: string } | null;
}

/** 로비 위 알림 한 줄. icon 이 있으면 TopToast 앞에 붙는다 */
export interface LobbyToast {
  text: string;
  icon?: "crown";
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
  const left = prev.players.filter((p) => !after.has(keyOf(p))).map((p) => ({ seat: p.seat, nickname: p.nickname }));
  const prevHost = prev.players.find((p) => p.isHost);
  const nextHost = next.players.find((p) => p.isHost);
  const newHost =
    prevHost && nextHost && prevHost.seat !== nextHost.seat ? { seat: nextHost.seat, nickname: nextHost.nickname } : null;
  return { joined, left, newHost };
}

/** 한 번에 하나: 방장 변경 > 마지막 입장자 > 마지막 퇴장자. */
export function toastForDiff(diff: RoomDiff): LobbyToast | null {
  if (diff.newHost) return { text: `방장 · ${diff.newHost.nickname}`, icon: "crown" };
  const joined = diff.joined[diff.joined.length - 1];
  if (joined) return { text: `${joined.nickname} 님 입장` };
  const left = diff.left[diff.left.length - 1];
  if (left) return { text: `${left.nickname} 님 퇴장` };
  return null;
}

/** 19페이즈 자리: 판 종류 바뀜 알림(다음 커밋이 채운다). */
export function modeToastOf(_prev: RoomView | null, _next: RoomView): string | null {
  return null;
}
