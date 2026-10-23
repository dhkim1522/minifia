// 서버 내부 방 상태와 순수 전이 함수. 이 타입은 클라이언트로 보내지 않는다 — 공개 모양은 view.ts 의 buildView 가 만든다.
// 모든 함수는 새 객체를 돌려주고 입력을 바꾸지 않는다. DOM·workerd 전용 API 를 쓰지 않는다(앱·워커 두 tsconfig 에 모두 들어감).
import { validateNickname } from "../nickname";
import type { PhaseId } from "../protocol";

export const ROOM_TTL_MS = 3 * 60 * 60 * 1000;

export interface Player {
  id: string;
  token: string;
  seat: number;
  nickname: string;
  nicknameKey: string;
  joinSeq: number;
  connected: boolean;
  connId: string | null;
}

export interface RoomState {
  code: string;
  createdAt: number;
  expiresAt: number;
  phase: PhaseId;
  phaseEndsAt: number | null;
  hostId: string;
  nextJoinSeq: number;
  players: Player[];
}

export type CreateRoomStateResult = { ok: true; state: RoomState } | { ok: false; error: "NICKNAME_INVALID" };

export function createRoomState(input: {
  code: string;
  hostId: string;
  hostToken: string;
  hostNickname: string;
  now: number;
}): CreateRoomStateResult {
  const checked = validateNickname(input.hostNickname);
  if (!checked.ok) return { ok: false, error: "NICKNAME_INVALID" };
  const host: Player = {
    id: input.hostId,
    token: input.hostToken,
    seat: 0,
    nickname: checked.nickname,
    nicknameKey: checked.key,
    joinSeq: 0,
    connected: false,
    connId: null,
  };
  return {
    ok: true,
    state: {
      code: input.code,
      createdAt: input.now,
      expiresAt: input.now + ROOM_TTL_MS,
      phase: "lobby",
      phaseEndsAt: null,
      hostId: input.hostId,
      nextJoinSeq: 1,
      players: [host],
    },
  };
}

export function hostOf(state: RoomState): Player {
  const host = state.players.find((p) => p.id === state.hostId);
  if (!host) throw new Error("hostOf: host is not in this room");
  return host;
}

export type JoinError = "GAME_STARTED" | "ROOM_FULL" | "NICKNAME_INVALID" | "NICKNAME_TAKEN";

/** 비어 있는 가장 낮은 자리 번호(0~MAX_PLAYERS-1). 앉은 자리는 나갈 때까지 바뀌지 않는다(D-09). */
function lowestFreeSeat(players: readonly Player[]): number {
  const taken = new Set(players.map((p) => p.seat));
  let seat = 0;
  while (taken.has(seat)) seat += 1;
  return seat;
}

/** id·token 은 인자로만 받는다 — 난수는 호출하는 쪽(방 Durable Object)의 몫이다. */
export function joinRoom(
  state: RoomState,
  input: { playerId: string; token: string; nickname: string },
): { ok: true; state: RoomState; player: Player } | { ok: false; error: JoinError } {
  const checked = validateNickname(input.nickname);
  if (!checked.ok) return { ok: false, error: "NICKNAME_INVALID" };
  const player: Player = {
    id: input.playerId,
    token: input.token,
    seat: lowestFreeSeat(state.players),
    nickname: checked.nickname,
    nicknameKey: checked.key,
    joinSeq: state.nextJoinSeq,
    connected: false,
    connId: null,
  };
  return {
    ok: true,
    state: { ...state, nextJoinSeq: state.nextJoinSeq + 1, players: [...state.players, player] },
    player,
  };
}

export function findPlayerByToken(state: RoomState, token: string): Player | undefined {
  return state.players.find((p) => p.token === token);
}

export function attachConnection(state: RoomState, playerId: string, connId: string): RoomState {
  return {
    ...state,
    players: state.players.map((p) => (p.id === playerId ? { ...p, connected: true, connId } : p)),
  };
}

/** 닫힌 소켓의 connId 가 그 플레이어의 최신 connId 일 때만 연결을 끊는다 — 낡은 소켓의 닫힘이 새 연결을 덮지 않게 한다. */
export function detachConnection(state: RoomState, playerId: string, connId: string): RoomState {
  return {
    ...state,
    players: state.players.map((p) =>
      p.id === playerId && p.connId === connId ? { ...p, connected: false, connId: null } : p,
    ),
  };
}
