// 연결별 공개 뷰. 공개 항목은 허용 목록(네 키 객체 리터럴)으로만 만든다 — Player 를 펼쳐 복사하지 않는다.
import type { PublicPlayer, RoomView } from "../protocol";
import { MAX_PLAYERS, MIN_PLAYERS } from "../protocol";
import type { RoomState } from "./room";

export function buildView(state: RoomState, playerId: string, now: number): RoomView {
  const me = state.players.find((p) => p.id === playerId);
  if (!me) throw new Error("buildView: player is not in this room");

  const players: PublicPlayer[] = [...state.players]
    .sort((a, b) => a.seat - b.seat)
    .map((p) => ({
      seat: p.seat,
      nickname: p.nickname,
      connected: p.connected,
      isHost: p.id === state.hostId,
    }));

  return {
    code: state.code,
    phase: state.phase,
    phaseEndsAt: state.phaseEndsAt,
    phaseDurationMs: null, // 01-07 이 단계 표로 채운다
    serverNow: now,
    minPlayers: MIN_PLAYERS,
    maxPlayers: MAX_PLAYERS,
    players,
    me: { seat: me.seat, isHost: me.id === state.hostId },
  };
}
