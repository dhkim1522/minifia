// 서버 내부 방 상태와 순수 전이 함수. 이 타입은 클라이언트로 보내지 않는다 — 공개 모양은 view.ts 의 buildView 가 만든다.
// 모든 함수는 새 객체를 돌려주고 입력을 바꾸지 않는다. DOM·workerd 전용 API 를 쓰지 않는다(앱·워커 두 tsconfig 에 모두 들어감).
import { validateNickname } from "../nickname";
import { MAX_PLAYERS, MIN_PLAYERS } from "../protocol";
import type { ChatLine, Claim, PhaseId } from "../protocol";
import { ASSIGNING_MS } from "./phases";
import { assignRoles } from "./roles";
import type { RoleId } from "./roles";

export const ROOM_TTL_MS = 3 * 60 * 60 * 1000;
/** 만든 뒤 아무도 접속(hello)하지 않은 방의 수명. 방 만들기 HTTP 를 쏟아부어 4자리 코드를 말리는 공격의 효과를 줄인다(WR-05). */
export const UNCONNECTED_ROOM_TTL_MS = 10 * 60 * 1000;

export interface Player {
  id: string;
  token: string;
  seat: number;
  nickname: string;
  nicknameKey: string;
  joinSeq: number;
  connected: boolean;
  connId: string | null;
  /** 시작할 때 서버가 나눠 준 역할. 대기실에서는 없다. 뷰에는 본인에게만, 정해진 단계에서만 실린다(view.ts). */
  role?: RoleId;
  // ---- 2페이즈 낮 토론 상태. 모두 optional — 저장된 옛 방도 읽히고(everConnected? 선례), 읽는 쪽이 기본값을 쥔다. ----
  /** 3페이즈가 탈락 때 false 로 만든다. 없으면 생존으로 본다. */
  alive?: boolean;
  /** 이번 낮 직접 고른 값 — 마감 전 다른 사람 뷰에 실리지 않는다(D-01). 없으면 고르지 않은 것이다. */
  claimChoice?: Claim;
  /** 이번 낮 공개된 값(claimReveal 에서 확정) — claimReveal·discussion 뷰에 실린다. 없으면 공개 전이다. */
  claimShown?: Claim;
  /** 직전 낮 공개 값 — 어떤 뷰에도 직접 싣지 않는다(바뀜 여부 계산용). */
  claimLast?: Claim;
  /** 직전 낮과 다르게 공개했는지 — claimReveal·discussion 뷰의 SeatClaim.changed 로 실린다. 없으면 false. */
  claimChanged?: boolean;
  /** 마지막으로 메시지·이모티콘을 보낸 서버 시각 — 합산 2초 쿨다운 기준(D-14). 없으면 보낸 적 없다. */
  lastSendAt?: number;
}

export interface RoomState {
  code: string;
  createdAt: number;
  expiresAt: number;
  /**
   * false 면 아직 아무도 접속한 적이 없다 — 만료가 UNCONNECTED_ROOM_TTL_MS 로 짧고 첫 attachConnection 이 늘린다.
   * 이 필드가 없는 옛 상태(이미 살아 있던 방)는 접속한 것으로 본다.
   */
  everConnected?: boolean;
  phase: PhaseId;
  phaseEndsAt: number | null;
  /** 일차(1부터). dayAnnounce 진입 때 tick 의 진입 훅이 올린다. 없으면 아직 낮이 시작되지 않았다. 뷰에는 DayView.n 으로 실린다. */
  day?: number;
  /** 이번 낮 연장(D-18)을 이미 썼는지. 낮 시작 발표에서 false 로 돌아간다. 없으면 false. */
  extendUsed?: boolean;
  /** 이번 낮 토론 메시지, 최근 20개(D-15). 낮 시작 발표에서 비운다. 없으면 빈 목록. discussion 뷰에만 실린다. */
  messages?: ChatLine[];
  /** 방 수명 동안 줄지 않는 다음 메시지 번호 — 날이 바뀌어도 줄지 않아 클라이언트가 새 줄을 번호로 가린다. 없으면 1. */
  nextMessageSeq?: number;
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
      expiresAt: input.now + UNCONNECTED_ROOM_TTL_MS,
      everConnected: false,
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
  // 검사 순서가 계약이다: 시작됨 → 정원(끊긴 사람 포함, 결정 0012) → 닉네임 형식 → 닉네임 중복.
  if (state.phase !== "lobby") return { ok: false, error: "GAME_STARTED" };
  if (state.players.length >= MAX_PLAYERS) return { ok: false, error: "ROOM_FULL" };
  const checked = validateNickname(input.nickname);
  if (!checked.ok) return { ok: false, error: "NICKNAME_INVALID" };
  if (state.players.some((p) => p.nicknameKey === checked.key)) return { ok: false, error: "NICKNAME_TAKEN" };
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

function earliestJoined(players: readonly Player[]): Player {
  return players.reduce((best, p) => (p.joinSeq < best.joinSeq ? p : best));
}

export type LeaveError = "WRONG_PHASE" | "NOT_IN_ROOM"; // NOT_IN_ROOM 은 내부 전용 — 방 Durable Object 가 BAD_MESSAGE 로 바꾼다

/**
 * 대기실에서만 나갈 수 있다(게임 중 나가기는 1페이즈 범위 밖). 마지막 사람이 나가면 state 는 null 이다.
 * 방장이 나가면 연결된 사람 가운데 joinSeq 가 가장 작은 사람이 이어받는다 — 연결된 사람이 없으면 전체에서 가장 작은 사람.
 * 방장이 끊긴 것만으로는 바뀌지 않는다(자동 이양은 v2).
 */
export function leaveRoom(
  state: RoomState,
  playerId: string,
): { ok: true; state: RoomState | null } | { ok: false; error: LeaveError } {
  if (state.phase !== "lobby") return { ok: false, error: "WRONG_PHASE" };
  if (!state.players.some((p) => p.id === playerId)) return { ok: false, error: "NOT_IN_ROOM" };
  const remaining = state.players.filter((p) => p.id !== playerId);
  if (remaining.length === 0) return { ok: true, state: null };
  if (playerId !== state.hostId) return { ok: true, state: { ...state, players: remaining } };
  const connected = remaining.filter((p) => p.connected);
  const successor = earliestJoined(connected.length > 0 ? connected : remaining);
  return { ok: true, state: { ...state, hostId: successor.id, players: remaining } };
}

export type KickError = "NOT_HOST" | "CANNOT_KICK";

/** 방장만, 대기실에서, 연결이 끊긴 다른 사람에게만 통한다. 연결 중인 사람·방장 자신·빈 자리·시작 뒤는 CANNOT_KICK. */
export function kickPlayer(
  state: RoomState,
  actorId: string,
  targetSeat: number,
): { ok: true; state: RoomState; removedId: string } | { ok: false; error: KickError } {
  if (actorId !== state.hostId) return { ok: false, error: "NOT_HOST" };
  if (state.phase !== "lobby") return { ok: false, error: "CANNOT_KICK" };
  const target = state.players.find((p) => p.seat === targetSeat);
  if (!target || target.id === state.hostId || target.connected) return { ok: false, error: "CANNOT_KICK" };
  return {
    ok: true,
    state: { ...state, players: state.players.filter((p) => p.id !== target.id) },
    removedId: target.id,
  };
}

/** 연결 중인 사람 수. 서버(시작 판정)와 화면(인원·버튼)이 같은 함수를 쓴다 — 입력은 connected 만 있으면 된다. */
export const connectedCount = (players: readonly { connected: boolean }[]): number =>
  players.filter((p) => p.connected).length;

export type StartError = "NOT_HOST" | "WRONG_PHASE" | "NOT_ENOUGH_PLAYERS";

/**
 * 시작할 수 있으면 null. 검사 순서는 NOT_HOST → WRONG_PHASE → NOT_ENOUGH_PLAYERS.
 * 인원은 연결된 사람 기준이다(결정 0012): 끊긴 사람은 자리를 지키지만 세지 않는다.
 * 입력은 서버 상태와 요청자 id 뿐이다 — 클라이언트가 보낸 방장 여부·인원·연결 상태는 쓰지 않는다.
 */
export function checkStart(state: RoomState, actorId: string): StartError | null {
  if (actorId !== state.hostId) return "NOT_HOST";
  if (state.phase !== "lobby") return "WRONG_PHASE";
  if (connectedCount(state.players) < MIN_PLAYERS) return "NOT_ENOUGH_PLAYERS";
  return null;
}

/**
 * 게임을 시작한다: checkStart 를 통과해야 하고(연결된 사람 4명 이상), 역할은 끊긴 사람을 포함해 앉아 있는 모두에게 준다
 * (결정 0012, D-16 "돌아오면 자기 역할로 이어서"). 자리 수 ≥ 연결자 수 ≥ 4 이므로 assignRoles 의 4~8명 범위 안이다.
 * 난수는 인자 randInt 로만 받는다(방 Durable Object 는 cryptoRandInt 를 넘긴다) — 이 파일에서 전역 난수나 시각 시드를 쓰지 않는다.
 * 배정 입력은 seat 오름차순 id 라 같은 시드·같은 상태는 같은 배정을 낸다. now 는 서버 시각이다.
 */
export function startGame(
  state: RoomState,
  actorId: string,
  now: number,
  randInt: (n: number) => number,
): { ok: true; state: RoomState } | { ok: false; error: StartError } {
  const error = checkStart(state, actorId);
  if (error !== null) return { ok: false, error };
  const seated = [...state.players].sort((a, b) => a.seat - b.seat);
  const roles = assignRoles(
    seated.map((p) => p.id),
    randInt,
  );
  return {
    ok: true,
    state: {
      ...state,
      phase: "assigning",
      phaseEndsAt: now + ASSIGNING_MS,
      expiresAt: now + ROOM_TTL_MS,
      players: state.players.map((p) => ({ ...p, role: roles.get(p.id) })),
    },
  };
}

export function findPlayerByToken(state: RoomState, token: string): Player | undefined {
  return state.players.find((p) => p.token === token);
}

export function attachConnection(state: RoomState, playerId: string, connId: string): RoomState {
  // 첫 접속: 짧던 만료를 정상 수명(생성 시각 기준)으로 늘린다. 이미 더 늦은 만료는 줄이지 않는다.
  const first = state.everConnected === false;
  return {
    ...state,
    ...(first ? { everConnected: true, expiresAt: Math.max(state.expiresAt, state.createdAt + ROOM_TTL_MS) } : {}),
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
