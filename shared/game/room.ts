// 서버 내부 방 상태와 순수 전이 함수. 이 타입은 클라이언트로 보내지 않는다 — 공개 모양은 view.ts 의 buildView 가 만든다.
// 모든 함수는 새 객체를 돌려주고 입력을 바꾸지 않는다. DOM·workerd 전용 API 를 쓰지 않는다(앱·워커 두 tsconfig 에 모두 들어감).
import { validateNickname } from "../nickname";
import { MAX_PLAYERS, MIN_PLAYERS } from "../protocol";
import type { Claim, ClaimLogEntry, InvestigationRecord, MorningView, PhaseId } from "../protocol";
import type { BotPlan } from "./bots";
import { ASSIGNING_MS, DAY_ANNOUNCE_MS } from "./phases";
import { assignRoles, giveRoleTo, rolesInPlay } from "./roles";
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
  /** 마지막으로 메시지·이모티콘을 보낸 서버 시각 — 합산 2초 쿨다운 기준(D-14). 없으면 보낸 적 없다. */
  lastSendAt?: number;
  // ---- 3페이즈 밤 상태(타입만 — 쓰는 코드는 03-03·03-04). 모두 optional — 옛 방도 읽힌다. ----
  /** 이번 밤 고른 대상 seat — enterNight 가 비우고 enterMorning 이 쓰고 지운다. 뷰에는 본인(과 관전)에게만 실린다. */
  nightPick?: number;
  /** 경찰만 누적하는 수사 기록 — 뷰에는 경찰 본인에게만 실린다. */
  investigations?: InvestigationRecord[];
  /**
   * 서버 전용(결정 0024). 테스트 방 서버 봇 표시 — 토큰은 빈 문자열, connId 는 null, connected 는 true 로 고정이고
   * 소켓이 없다. view·미리보기·어떤 프레임에도 싣지 않는다(허용 목록 리터럴이라 저절로 빠진다).
   */
  isBot?: true;
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
  /** 방 수명 동안 줄지 않는 다음 메시지 번호 — 날이 바뀌어도 줄지 않아 클라이언트가 새 줄을 번호로 가린다. 없으면 1. */
  nextMessageSeq?: number;
  /** 지난밤 결과 한 곳 — enterMorning 이 쓰고 enterNight 가 지운다. 없으면 아직 아침이 오지 않았다(3페이즈, 모두 optional). */
  morning?: MorningView;
  /** 마지막 탈락 문구 번호 — 판 내내 유지해 같은 문구가 연달아 나오지 않게 한다(3페이즈). */
  lastPhrase?: number;
  /**
   * 밤 마피아 채팅 줄 번호 — 낮 채팅의 nextMessageSeq 와 따로 센다. 낮 번호를 밤에 쓰면 살아 있는 사람이
   * 낮 chat 프레임 seq 간격으로 밤 메시지 수를 알 수 있다. 밤마다 1부터, enterNight 가 지운다(3페이즈).
   */
  nextNightSeq?: number;
  // ---- 순차 주장 상태(결정 0023). 모두 optional — 옛 저장 방도 읽힌다. 서버 전용이고 view 에는 허용 목록으로만 실린다. ----
  /** 이번 낮 주장 차례 순서(seat). claim 진입 훅(enterClaim)이 만든다. 탈락자는 들지 않는다. */
  claimOrder?: number[];
  /** 지금 차례 위치(claimOrder 의 인덱스). 차례가 끝날 때마다 resolveClaimTurn 이 올린다. */
  claimIdx?: number;
  /** 직전(이번) 낮 시작 seat — 다음 낮 시작 자리를 한 칸 옮기는 기억. */
  claimStart?: number;
  /** 지금 차례인 사람이 일찍 고른 값. 차례가 끝나면 지운다. 어떤 view 에도 싣지 않는다. */
  claimPick?: Claim;
  /** 공개 주장 기록. 차례가 끝나는 순간 한 줄씩 쌓이고 판 내내 남는다(공개 정보). */
  claimLog?: ClaimLogEntry[];
  hostId: string;
  nextJoinSeq: number;
  players: Player[];
  /** 서버 전용(결정 0022). 방을 만들 때만 정해지는 테스트 방 표시 — true 일 때만 키가 있다. 테스트 방 방장 도구의 문이다. */
  testMode?: true;
  /** 서버 전용(결정 0022). 테스트 방 방장이 고른 다음 판 직업. 대기실 복귀 뒤에도 남아 새 판마다 다시 쓰인다. 없으면 무작위. */
  testRole?: RoleId;
  /** 서버 전용(결정 0024). 지금 단계의 봇 행동 계획(단계:마감 키 + 행동 시각 목록). 단계가 바뀌면 낡아 버려진다. 어떤 view 에도 싣지 않는다. */
  botPlan?: BotPlan;
}

export type CreateRoomStateResult = { ok: true; state: RoomState } | { ok: false; error: "NICKNAME_INVALID" };

export function createRoomState(input: {
  code: string;
  hostId: string;
  hostToken: string;
  hostNickname: string;
  now: number;
  testMode?: boolean;
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
      ...(input.testMode === true ? { testMode: true as const } : {}),
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
export function lowestFreeSeat(players: readonly Player[]): number {
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
 * 이어받는 후보는 봇이 아닌 사람뿐이고(결정 0024), 사람이 아무도 남지 않으면(봇만 남으면) 방을 지운다(state null).
 * 방장이 끊긴 것만으로는 바뀌지 않는다(자동 이양은 v2).
 */
export function leaveRoom(
  state: RoomState,
  playerId: string,
): { ok: true; state: RoomState | null } | { ok: false; error: LeaveError } {
  if (state.phase !== "lobby") return { ok: false, error: "WRONG_PHASE" };
  if (!state.players.some((p) => p.id === playerId)) return { ok: false, error: "NOT_IN_ROOM" };
  const remaining = state.players.filter((p) => p.id !== playerId);
  const humans = remaining.filter((p) => p.isBot !== true);
  if (remaining.length === 0 || humans.length === 0) return { ok: true, state: null };
  if (playerId !== state.hostId) return { ok: true, state: { ...state, players: remaining } };
  const connected = humans.filter((p) => p.connected);
  const successor = earliestJoined(connected.length > 0 ? connected : humans);
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
  const orderedIds = seated.map((p) => p.id);
  const shuffled = assignRoles(orderedIds, randInt);
  // 테스트 방(결정 0022): 방장이 고른 직업이 지금 인원 구성에 있을 때만 방장과 그 직업 보유자를 맞바꾼다. 없으면 무작위 그대로.
  const roles =
    state.testMode === true && state.testRole !== undefined && rolesInPlay(seated.length).includes(state.testRole)
      ? giveRoleTo(shuffled, orderedIds, state.hostId, state.testRole)
      : shuffled;
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

/** 1페이즈가 저장한 종착 낮 단계 이름. 지금의 PhaseId 에는 없다. */
const LEGACY_DAY_PHASE = "day";

/**
 * 저장소에서 읽은 방 상태를 새 코드에 맞춘다. 1페이즈에서 저장된 방은 phase 가 "day"(마감 없음)일 수 있는데,
 * 이 값은 PhaseId 에 없어 buildView 가 PHASE_DEFS 를 조회하다 터진다. 방 수명이 3시간이라 배포 뒤에도 살아 있을 수 있으므로,
 * 그런 방은 낮 시작 발표(dayAnnounce)로 옮기고 마감을 now + DAY_ANNOUNCE_MS, 일차를 1로 둔다.
 * 채팅은 서버에 저장하지 않는다(결정 0017-7) — 배포 전 저장된 messages 는 깨어날 때 지운다.
 * 둘 다 해당하지 않으면 같은 객체를 돌려준다(DO 생성자의 "바뀌었을 때만 저장·알람" 규칙이 이 동일성에 기댄다).
 * 새 optional 필드가 없는 옛 상태는 읽는 쪽 기본값이 받는다(RESEARCH Pattern 6). 순수 함수다 — 호출(DO 생성자)과 알람 재설정은 호출하는 쪽의 몫이다.
 */
export function normalizeStoredRoom(stored: RoomState, now: number): RoomState {
  const isLegacyDay = (stored.phase as string) === LEGACY_DAY_PHASE;
  const hasOldMessages = Object.hasOwn(stored, "messages");
  if (!isLegacyDay && !hasOldMessages) return stored;
  // 옛 키는 구조 분해로만 뺀다. 필드 선언이 RoomState 에서 사라져도 컴파일되게 지역 교차 타입으로 받는다.
  const { messages: _dropped, ...rest } = stored as RoomState & { messages?: unknown };
  return isLegacyDay ? { ...rest, phase: "dayAnnounce", phaseEndsAt: now + DAY_ANNOUNCE_MS, day: 1 } : rest;
}

export function findPlayerByToken(state: RoomState, token: string): Player | undefined {
  // 봇은 토큰이 없어(빈 문자열) 어떤 hello 로도 붙을 수 없다(결정 0024).
  return state.players.find((p) => p.isBot !== true && p.token === token);
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
