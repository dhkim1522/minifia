// 연결별 공개 뷰. 공개 항목은 허용 목록(네 키 객체 리터럴)으로만 만든다 — Player 를 펼쳐 복사하지 않는다.
import type { MyInfo, PreviewPlayer, PublicPlayer, RoomPreview, RoomView } from "../protocol";
import { MAX_PLAYERS, MIN_PLAYERS } from "../protocol";
import { PHASE_DEFS } from "./phases";
import { hostOf } from "./room";
import type { RoomState } from "./room";

/**
 * 비인증 미리보기(4자리 코드만 알면 받는 응답). 객체 리터럴 허용 목록으로만 만든다 — Player 를 펼쳐 복사하지 않는다.
 * 앉은 사람 목록은 대기실에서만 채우고, 그 밖의 단계에서는 빈 배열이다. 역할·토큰·내부 id·연결 상태는 어디에도 싣지 않는다.
 */
export function buildPreview(state: RoomState): RoomPreview {
  const players: PreviewPlayer[] =
    state.phase === "lobby"
      ? [...state.players].sort((a, b) => a.seat - b.seat).map((p) => ({ seat: p.seat, nickname: p.nickname }))
      : [];
  return {
    code: state.code,
    hostNickname: hostOf(state).nickname,
    playerCount: state.players.length,
    maxPlayers: MAX_PLAYERS,
    phase: state.phase,
    players,
  };
}

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

  // 내 정보도 허용 목록으로만 만든다. role·allies 는 조건을 채울 때만 키 자체를 만든다(undefined 로 남기지 않는다).
  const myInfo: MyInfo = { seat: me.seat, isHost: me.id === state.hostId };
  const def = PHASE_DEFS[state.phase];
  if (def.revealsOwnRole && me.role !== undefined) {
    myInfo.role = me.role;
    if (me.role === "mafia") {
      // 마피아에게만 동료의 seat(오름차순)를 알려 준다. 혼자면 빈 배열 — 화면이 "혼자예요" 를 고른다(D-14).
      myInfo.allies = state.players
        .filter((p) => p.role === "mafia" && p.id !== me.id)
        .map((p) => p.seat)
        .sort((a, b) => a - b);
    }
  }

  return {
    code: state.code,
    phase: state.phase,
    phaseEndsAt: state.phaseEndsAt,
    phaseDurationMs: def.durationMs,
    serverNow: now,
    minPlayers: MIN_PLAYERS,
    maxPlayers: MAX_PLAYERS,
    players,
    me: myInfo,
  };
}
