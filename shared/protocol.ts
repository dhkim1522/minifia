// 1·2페이즈 와이어 계약(대기실·역할 확인·낮 토론). 상수와 타입만 둔다 — zod 등 값 import 는 넣지 않는다.
// 클라이언트(src/)가 이 파일의 값을 import 해도 번들에 스키마 라이브러리가 들어가지 않게 하기 위해서다.
// 2페이즈 계약은 02-01 에서 한 번에 정한다 — 후속 계획이 같은 이름·모양을 그대로 쓴다.
// 방장 연장·넘기기는 결정 0017-5 로 없앴다(extend·skip 메시지, 연장 중복 오류 코드, DayView 의 연장 표시가 없다).
// 서버 전용 검증 스키마는 shared/schemas.ts 에 있고 Worker 만 import 한다.

// 타입 import·재수출이라 값 import 가 아니다 — 클라이언트 번들에는 아무것도 들어가지 않는다.
import type { RoleId } from "./game/roles";
export type { RoleId } from "./game/roles";

export const MIN_PLAYERS = 4;
export const MAX_PLAYERS = 8;
export const MAX_FRAME_BYTES = 1024; // WebSocket 프레임 상한
export const MAX_BODY_BYTES = 1024; // HTTP 본문 상한

// 낮 네 단계(dayAnnounce·claim·claimReveal·discussion)는 단계 표(shared/game/phases.ts)의 한 줄씩이다.
// claimReveal 은 공개 연출 2초짜리 별도 서버 단계다 — 모든 폰이 같은 마감으로 시작·종료한다(D-04).
export type PhaseId = "lobby" | "assigning" | "roleReveal" | "dayAnnounce" | "claim" | "claimReveal" | "discussion";

// ---- 낮 토론 계약(2페이즈) ----
/** 공개된 직업 주장. 그 사람의 실제 역할이 아니다. */
export type Claim = RoleId | "none";
export const TEMPLATE_IDS = ["suspect", "trust", "claimed", "innocent", "vote"] as const;
export type TemplateId = (typeof TEMPLATE_IDS)[number];
export const EMOJI_IDS = ["smile", "grin", "surprised", "suspicious", "angry", "sad", "heart", "exclaim"] as const;
export type EmojiId = (typeof EMOJI_IDS)[number];
/**
 * 서버가 방송만 하는 빠른 메시지 한 줄(저장하지 않는다, 결정 0017-7). 키 이름에 id·role 을 쓰지 않는다:
 * test/worker/leak.test.ts 의 FORBIDDEN_KEYS 에 id 가 있고, role 키는 view.me.role 에만 있다는 불변식이 있다.
 * 직업 이름이 필요하면 claimedRole 처럼 다른 이름을 쓴다.
 */
export interface ChatLine {
  seq: number;
  seat: number;
  template: TemplateId;
  target?: number;
  claimedRole?: RoleId;
  at: number;
}
/** 통과한 빠른 메시지 한 줄을 방에 앉은 모든 소켓에 보내는 이벤트 프레임(상태가 아니다). */
export type ChatEvent = { t: "chat" } & ChatLine;
export interface SeatClaim {
  seat: number;
  claim: Claim;
  changed: boolean;
}
export interface DayView {
  n: number; // 일차(1부터)
  roles: RoleId[]; // 이번 판 직업(구성표 순서, 공개 정보)
  claimDone?: number[]; // claim 단계에서만: 이번 낮 직접 고른 seat 오름차순
  claims?: SeatClaim[]; // claimReveal·discussion 에서만: 공개된 주장 seat 오름차순
  messages?: ChatLine[]; // discussion 에서만: 최근 20개
}

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
  | { t: "kick"; seat: number }
  | { t: "claim"; claim: Claim }
  | { t: "say"; template: TemplateId; target?: number; claimedRole?: RoleId }
  | { t: "emoji"; icon: EmojiId };

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
  claim?: Claim; // claim 단계에서만: 내가 이번 낮 고른 주장
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
  day?: DayView; // 낮 네 단계에서만
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
  | { t: "error"; code: WsErrorCode }
  | { t: "emoji"; seat: number; icon: EmojiId; at: number }
  | ChatEvent;
export const CLOSE_CODES = { REPLACED: 4001, REMOVED: 4003 } as const;
export type RemovedReason = "left" | "kicked" | "invalid_token" | "room_closed";
