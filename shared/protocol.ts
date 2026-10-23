// 1페이즈 전체 와이어 계약. 상수와 타입만 둔다 — zod 등 값 import 는 넣지 않는다.
// 클라이언트(src/)가 이 파일의 값을 import 해도 번들에 스키마 라이브러리가 들어가지 않게 하기 위해서다.
// 서버 전용 검증 스키마는 shared/schemas.ts 에 있고 Worker 만 import 한다.

// 타입 import·재수출이라 값 import 가 아니다 — 클라이언트 번들에는 아무것도 들어가지 않는다.
import type { RoleId } from "./game/roles";
export type { RoleId } from "./game/roles";

export const MIN_PLAYERS = 4;
export const MAX_PLAYERS = 8;
export const MAX_FRAME_BYTES = 1024; // WebSocket 프레임 상한
export const MAX_BODY_BYTES = 1024; // HTTP 본문 상한

// D-02, D-03: 직업 공개 단계는 넣지 않는다.
export type PhaseId = "lobby" | "assigning" | "roleReveal" | "day";

// ---- HTTP ----
export interface CreateRoomBody {
  nickname: string;
}
export interface JoinRoomBody {
  nickname: string;
}
export interface CreateRoomResponse {
  code: string;
  token: string;
  seat: number;
}
export interface JoinRoomResponse {
  token: string;
  seat: number;
}
// 비인증 미리보기의 앉은 사람. seat·nickname 두 키뿐이다 — 연결 상태·내부 id·토큰·역할은 싣지 않는다.
export interface PreviewPlayer {
  seat: number;
  nickname: string;
}
export interface RoomPreview {
  code: string;
  hostNickname: string;
  playerCount: number;
  maxPlayers: number;
  phase: PhaseId;
  players: PreviewPlayer[]; // 대기실에서만 채운다. 그 밖의 단계는 빈 배열
}
export type ApiErrorCode =
  | "BAD_REQUEST"
  | "NOT_FOUND"
  | "ROOM_NOT_FOUND"
  | "ROOM_FULL"
  | "GAME_STARTED"
  | "NICKNAME_INVALID"
  | "NICKNAME_TAKEN"
  | "CODE_EXHAUSTED";
export interface ApiError {
  error: ApiErrorCode;
}

// ---- WebSocket 클라이언트 -> 서버 ----
export type ClientMessage =
  | { t: "hello"; token: string }
  | { t: "ping"; c: number }
  | { t: "start" }
  | { t: "leave" }
  | { t: "kick"; seat: number };

// ---- 서버 -> 클라이언트 ----
// 공개 식별자는 seat 뿐이다. 내부 id·토큰·역할 자리는 타입에도 없다.
export interface PublicPlayer {
  seat: number;
  nickname: string;
  connected: boolean;
  isHost: boolean;
}
export interface MyInfo {
  seat: number;
  isHost: boolean;
  role?: RoleId; // 내 역할 — 채우는 일은 01-07
  allies?: number[]; // 같은 마피아 동료의 seat — 채우는 일은 01-07
}
export interface RoomView {
  code: string;
  phase: PhaseId;
  phaseEndsAt: number | null;
  phaseDurationMs: number | null;
  serverNow: number;
  minPlayers: number;
  maxPlayers: number;
  players: PublicPlayer[];
  me: MyInfo;
}
export type WsErrorCode =
  | "BAD_MESSAGE"
  | "NOT_HOST"
  | "NOT_ENOUGH_PLAYERS"
  | "WRONG_PHASE"
  | "CANNOT_KICK"
  | "RATE_LIMITED";
export type ServerMessage =
  | { t: "state"; view: RoomView }
  | { t: "pong"; c: number; serverNow: number }
  | { t: "error"; code: WsErrorCode };
export const CLOSE_CODES = { REPLACED: 4001, REMOVED: 4003 } as const;
export type RemovedReason = "left" | "kicked" | "invalid_token" | "room_closed";
