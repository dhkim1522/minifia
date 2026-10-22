// 서버 내부 방 상태와 순수 전이 함수. 이 타입은 클라이언트로 보내지 않는다 — 공개 모양은 view.ts 의 buildView 가 만든다.
// 모든 함수는 새 객체를 돌려주고 입력을 바꾸지 않는다. DOM·workerd 전용 API 를 쓰지 않는다(앱·워커 두 tsconfig 에 모두 들어감).
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

const NICKNAME_MAX_CODE_POINTS = 8;
// 제어 문자(줄바꿈 포함)가 들어간 이름은 받지 않는다.
const CONTROL_CHARS = /\p{Cc}/u;

// 정식 검증은 01-04 가 shared/nickname.ts 로 교체한다. 시그니처는 그대로 둔다.
function normalizeNickname(raw: string): string | null {
  const nickname = raw.trim();
  if (CONTROL_CHARS.test(nickname)) return null;
  const length = [...nickname].length;
  if (length < 1 || length > NICKNAME_MAX_CODE_POINTS) return null;
  return nickname;
}

export function createRoomState(input: {
  code: string;
  hostId: string;
  hostToken: string;
  hostNickname: string;
  now: number;
}): CreateRoomStateResult {
  const nickname = normalizeNickname(input.hostNickname);
  if (nickname === null) return { ok: false, error: "NICKNAME_INVALID" };
  const host: Player = {
    id: input.hostId,
    token: input.hostToken,
    seat: 0,
    nickname,
    nicknameKey: nickname.toLowerCase(),
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
