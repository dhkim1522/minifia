// 서버 내부 방 상태와 순수 전이 함수. 이 타입은 클라이언트로 보내지 않는다 — 공개 모양은 view.ts 의 buildView 가 만든다.
// 모든 함수는 새 객체를 돌려주고 입력을 바꾸지 않는다. DOM·workerd 전용 API 를 쓰지 않는다(앱·워커 두 tsconfig 에 모두 들어감).
import { validateNickname } from "../nickname";
import { MAX_PLAYERS, MIN_PLAYERS } from "../protocol";
import type {
  AssassinationRecord,
  ExecutionView,
  GameWinner,
  InvestigationRecord,
  MorningView,
  PhaseId,
  TreatmentRecord,
  VoteLogEntry,
} from "../protocol";
import type { BotPlan } from "./bots";
import { ASSIGNING_MS, DAY_ANNOUNCE_MS, DISCUSSION_MS } from "./phases";
import { assignRoles, giveRoleTo, rolesInPlay } from "./roles";
import type { RoleId } from "./roles";

export const ROOM_TTL_MS = 3 * 60 * 60 * 1000;
/** 만든 뒤 아무도 접속(hello)하지 않은 방의 수명. 방 만들기 HTTP 를 쏟아부어 4자리 코드를 말리는 공격의 효과를 줄인다(WR-05). */
export const UNCONNECTED_ROOM_TTL_MS = 10 * 60 * 1000;

/** 밤 기록 한 줄(판 요약 재료, D-27): 그 밤 마피아 팀의 최종 지목 seat(없으면 키 없음)과 그 사람이 죽었는지. */
export interface NightLogEntry {
  n: number;
  target?: number;
  died: boolean;
}

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
  // ---- 3페이즈 밤 상태(타입만 — 쓰는 코드는 03-03·03-04). 모두 optional — 옛 방도 읽힌다. ----
  /** 이번 밤 고른 대상 seat — enterNight 가 비우고 enterMorning 이 쓰고 지운다. 뷰에는 본인(과 관전)에게만 실린다. */
  nightPick?: number;
  /** 경찰만 누적하는 수사 기록 — 뷰에는 경찰 본인에게만 실린다. */
  investigations?: InvestigationRecord[];
  /** 마피아 팀 암살일지의 사본 — 밤 시작 때 살아 있던 마피아 각자에게 같은 줄이 쌓인다. 뷰에는 그 마피아 본인에게만 실린다. */
  assassinations?: AssassinationRecord[];
  /** 의사 본인의 치료일지 — 뷰에는 그 의사 본인에게만 실린다. */
  treatments?: TreatmentRecord[];
  // 옛 처형 여부·후보 선택 개인 표 키(execVote·candidateVote)는 08-21 에 지웠다. 옛 저장 방의 잔재는 08-22 정규화가 지운다.
  // ---- 8페이즈 낮 처형 상태(결정 0060). 서버 전용이고 어떤 view 에도 이 키로 실리지 않는다. 모두 optional. ----
  /** 지목 단계에서 가리킨 seat. 마감 훅(resolveNomination)이 키째 지우고 enterDiscussion 이 한 번 더 지운다. 취소는 없다. */
  nominate?: number;
  /** 찬반 단계의 본인 찬반(찬성 true). 집계 직후 resolveVerdict 가 키째 지우고 enterDiscussion 이 한 번 더 지운다 — 익명을 데이터가 없다는 사실로 지킨다. */
  verdictVote?: boolean;
  /** 토론 끝내기를 누른 표시. 누르면 true, 취소하면 키째 지운다. 누가 눌렀는지는 서버 전용이고 enterDiscussion 이 다음 낮 시작에 지운다. */
  endVote?: true;
  /** 서버 전용(결정 0061-10). 본인이 남긴 유언 — saveWill(09-12)만 쓰고, 사후에도 바꿀 수 없다. 아침에 서버가 채팅 카드로 만들어 보내며 view 의 me.will 로 산 본인에게만 간다. */
  will?: string;
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
  /** 지난밤 결과 한 곳 — enterMorning 이 쓰고 enterNight 가 지운다. 없으면 아직 아침이 오지 않았다(3페이즈, 모두 optional). */
  morning?: MorningView;
  /** 서버 전용(결정 0061-9). 이번 밤 마피아가 남긴 쪽지 — saveNote(09-12)가 쓰고 enterMorning(탈락 없는 밤)·enterNight 가 키째 지운다. 구출·무효 밤의 쪽지는 폐기된다. */
  nightNote?: string;
  /** 서버 전용(결정 0061-14). 암살 현장 분필 자국(고정소수점) — 방 DO 가 채우고 enterNight 가 지운다(09-14). */
  chalk?: { x: number; z: number };
  // ---- 4페이즈 처형·승패 상태(결정 0034). 모두 optional 이고 서버 전용이다. 뷰에는 허용 목록으로만 실린다. ----
  /** 이번 낮 찬반 결과(분기 근거). resolveVerdict 가 쓰고 enterDiscussion 이 지운다. */
  verdict?: { passed: boolean; candidate?: number };
  /** 날짜별 공개 투표 기록(D-08). resolveNomination 이 줄을 더하고 resolveVerdict 가 채우며 판 내내 쌓인다. */
  voteLog?: VoteLogEntry[];
  /** 처형 발표(seat·문구). enterDiscussion 이 지운다. */
  execution?: ExecutionView;
  /** 밤별 지목·사망 기록(판 요약 재료). 서버 전용이고 종료 전에는 어디에도 싣지 않는다. */
  nightLog?: NightLogEntry[];
  /** 승리 팀 — 종료 진입 때 기록한다. */
  winner?: GameWinner;
  hostId: string;
  nextJoinSeq: number;
  players: Player[];
  /** 서버 전용(결정 0022). 방을 만들 때만 정해지는 테스트 방 표시 — true 일 때만 키가 있다. 테스트 방 방장 도구의 문이다. */
  testMode?: true;
  /** 서버 전용(결정 0022). 테스트 방 방장이 고른 다음 판 직업. 대기실 복귀 뒤에도 남아 새 판마다 다시 쓰인다. 없으면 무작위. */
  testRole?: RoleId;
  /** 서버 전용(결정 0022·0024 확장, P-13). 테스트 방 방장이 고른 봇 투표 규칙 — 무작위가 아닌 값만 저장한다. 대기실 복귀 뒤에도 남는다. 둘 다 무작위면 키가 없다. */
  testBotVote?: { exec?: "yes" | "no"; pick?: "host" | "other" };
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

/**
 * 지금의 PhaseId 에 없는 옛 단계 이름 — 이 함수 한 곳에서만 문자열로 비교한다.
 * "day": 1페이즈가 저장한 종착 낮 단계. "claimReveal": 결정 0027: 이 이름은 더는 단계가 아니다(공개 연출 2초 단계 삭제, 결정 0023).
 * "claim": 순차 주장 단계 — 7페이즈(CHAT-06)에서 없어졌다.
 * "execVote"·"candidateVote"·"candidateVoteReveal": 4페이즈 처형 여부 투표·후보 선택·후보 공개 — 8페이즈(결정 0060-12)에서 없어졌다.
 */
const LEGACY_PHASES = {
  day: "day",
  claimReveal: "claimReveal",
  claim: "claim",
  execVote: "execVote",
  candidateVote: "candidateVote",
  candidateVoteReveal: "candidateVoteReveal",
} as const;
/** 8페이즈에서 없어진 옛 투표 단계 셋(결정 0060-12). 이 단계로 저장된 방은 discussion 으로 옮기고 그날의 투표 흔적을 지운다. */
const LEGACY_VOTE_PHASES: readonly string[] = [LEGACY_PHASES.execVote, LEGACY_PHASES.candidateVote, LEGACY_PHASES.candidateVoteReveal];
/** 옛 4페이즈 개인 투표 키 둘(처형 여부·후보 선택) — Player 선언은 08-21 에 사라졌다. 어느 단계로 저장됐든 키째 뺀다. */
const LEGACY_VOTE_PLAYER_KEYS = ["execVote", "candidateVote"] as const;
/** 옛 투표 단계에서 옮길 때 같이 지우는 그날의 새 흐름 개인 키(지목·찬반·토론 끝내기 누름). 새 단계로 저장된 방에는 쓰지 않는다. */
const DAY_PERSONAL_KEYS = ["nominate", "verdictVote", "endVote"] as const;
/** 순차 주장 단계가 방 상태에 쥐던 키 다섯 — 정규화가 키째 뺀다. 필드 선언은 RoomState 에서 사라졌다. */
const LEGACY_CLAIM_STATE_KEYS = ["claimOrder", "claimIdx", "claimStart", "claimPick", "claimLog"] as const;
/** 결정 0023 이전 Player 의 주장 필드 — 지금은 방 상태의 claimLog 로 대신한다. */
const LEGACY_CLAIM_KEYS = ["claimChoice", "claimShown", "claimLast", "claimChanged"] as const;
/** 결정 0058 로 대체된 채팅 옛 번호 필드(방 키). 줄 번호는 이제 채널별로 DO 가 chat: 키 복원 때 다시 센다. */
const LEGACY_CHAT_ROOM_KEYS = ["nextMessageSeq", "nextNightSeq"] as const;

/**
 * 저장소에서 읽은 방 상태를 새 코드에 맞춘다. 순수 함수다 — 호출(DO 생성자)과 알람 재설정은 호출하는 쪽의 몫이다.
 * - 1페이즈에서 저장된 방은 phase 가 "day"(마감 없음)일 수 있는데, 이 값은 PhaseId 에 없어 buildView 가 PHASE_DEFS 를 조회하다 터진다.
 *   그런 방은 낮 시작 발표(dayAnnounce)로 옮기고 마감을 now + DAY_ANNOUNCE_MS, 일차를 1로 둔다.
 * - 옛 공개 연출 단계(claimReveal)로 저장된 방은 discussion 으로 옮기고 마감을 now + DISCUSSION_MS 로 둔다(주장 기록은 새 방에 없다).
 * - 순차 주장 단계(claim)로 저장된 방은 discussion 으로 옮기고 마감을 now + DISCUSSION_MS 로 둔다(그날 주장 기록은 사라진다, A1).
 * - 옛 투표 단계(execVote·candidateVote·candidateVoteReveal)로 저장된 방은 discussion 으로 옮기고 마감을 now + DISCUSSION_MS 로 둔다. 일차와 지난 날 투표 기록(voteLog)은 그대로이고,
 *   그날의 verdict·execution·오늘 일차 voteLog 줄(있으면)과 개인 키(execVote·candidateVote·nominate·verdictVote·endVote)를 키째 뺀다(결정 0060-12, RESEARCH A9 — 진행 중이던 판이 토론으로 되돌아가는 것은 배포 순간 한 번뿐인 수용 가능한 이전이다).
 *   호출하는 쪽(DO 생성자)은 마감이 바뀌면 알람을 다시 건다.
 * - 옛 투표 개인 키(execVote·candidateVote)와 방 키 lastExecPhrase(처형 문구 번호, 08-22 에 없어짐)는 어느 단계에 있든 키째 뺀다.
 * - 방 상태의 주장 키 다섯(claimOrder·claimIdx·claimStart·claimPick·claimLog)은 어느 단계에 있든 키째 뺀다.
 * - 모든 플레이어에서 옛 주장 필드 넷을 키째 뺀다.
 * 채팅은 서버에 저장하지 않는다(결정 0017-7) — 배포 전 저장된 messages 는 깨어날 때 지운다.
 * 채팅 옛 번호·쿨다운 필드(결정 0058 로 대체): 방 키 nextMessageSeq·nextNightSeq 와 Player 키 lastSendAt 도 키째 뺀다.
 * 아무것도 해당하지 않으면 같은 객체를 돌려준다(DO 생성자의 "바뀌었을 때만 저장·알람" 규칙이 이 동일성에 기댄다).
 * 새 optional 필드가 없는 옛 상태는 읽는 쪽 기본값이 받는다(RESEARCH Pattern 6).
 */
export function normalizeStoredRoom(stored: RoomState, now: number): RoomState {
  const phase = stored.phase as string;
  const isLegacyDay = phase === LEGACY_PHASES.day;
  const isLegacyReveal = phase === LEGACY_PHASES.claimReveal;
  const isLegacyClaim = phase === LEGACY_PHASES.claim;
  const isLegacyVote = LEGACY_VOTE_PHASES.includes(phase);
  const hasOldVoteRoomKey = Object.hasOwn(stored, "lastExecPhrase");
  const hasOldVotePlayerKeys = stored.players.some((p) => LEGACY_VOTE_PLAYER_KEYS.some((key) => Object.hasOwn(p, key)));
  const hasOldClaimState = LEGACY_CLAIM_STATE_KEYS.some((key) => Object.hasOwn(stored, key));
  const hasOldMessages = Object.hasOwn(stored, "messages");
  const hasOldChatRoomKeys = LEGACY_CHAT_ROOM_KEYS.some((key) => Object.hasOwn(stored, key));
  const hasOldPlayerFields = stored.players.some((p) => LEGACY_CLAIM_KEYS.some((key) => Object.hasOwn(p, key)) || Object.hasOwn(p, "lastSendAt"));
  if (!isLegacyDay && !isLegacyReveal && !isLegacyClaim && !isLegacyVote && !hasOldVoteRoomKey && !hasOldVotePlayerKeys && !hasOldClaimState && !hasOldMessages && !hasOldChatRoomKeys && !hasOldPlayerFields) return stored;
  // 옛 키는 구조 분해로만 뺀다. 필드 선언이 RoomState 에서 사라져도 컴파일되게 지역 교차 타입으로 받는다.
  const {
    messages: _dropped,
    claimOrder: _order,
    claimIdx: _idx,
    claimStart: _start,
    claimPick: _pick,
    claimLog: _log,
    nextMessageSeq: _msgSeq,
    nextNightSeq: _nightSeq,
    lastExecPhrase: _execPhrase,
    ...rest
  } = stored as RoomState & {
    lastExecPhrase?: unknown;
    messages?: unknown;
    claimOrder?: unknown;
    claimIdx?: unknown;
    claimStart?: unknown;
    claimPick?: unknown;
    claimLog?: unknown;
    nextMessageSeq?: unknown;
    nextNightSeq?: unknown;
  };
  let next: RoomState = rest;
  if (hasOldPlayerFields) {
    next = {
      ...next,
      players: next.players.map((p) => {
        const { claimChoice: _a, claimShown: _b, claimLast: _c, claimChanged: _d, lastSendAt: _e, ...kept } = p as typeof p & Record<string, unknown>;
        return kept as typeof p;
      }),
    };
  }
  if (hasOldVotePlayerKeys || isLegacyVote) {
    const dropKeys: readonly string[] = isLegacyVote ? [...LEGACY_VOTE_PLAYER_KEYS, ...DAY_PERSONAL_KEYS] : LEGACY_VOTE_PLAYER_KEYS;
    next = {
      ...next,
      players: next.players.map((p) => {
        if (!dropKeys.some((key) => Object.hasOwn(p, key))) return p;
        const kept: Record<string, unknown> = { ...p };
        for (const key of dropKeys) delete kept[key];
        return kept as unknown as typeof p;
      }),
    };
  }
  if (isLegacyVote) {
    // 그날의 찬반 결과·처형 발표는 새 토론에 새면 안 된다(RESEARCH Pitfall 1). voteLog 는 지난 날 기록이라 그대로 둔다.
    // 오늘 줄(candidateVote·candidateVoteReveal 로 저장된 방에는 여부 투표 마감이 이미 쌓았다)은 새 지목 마감이 같은 날 줄을 다시 쌓으므로 지운다 — 같은 일차 줄이 둘이 되지 않게.
    const { verdict: _verdict, execution: _execution, voteLog, ...cleared } = next;
    const today = next.day ?? 1;
    const kept = voteLog?.filter((entry) => entry.n !== today);
    return {
      ...cleared,
      ...(voteLog === undefined ? {} : { voteLog: kept!.length === voteLog.length ? voteLog : kept! }),
      phase: "discussion",
      phaseEndsAt: now + DISCUSSION_MS,
    };
  }
  if (isLegacyDay) return { ...next, phase: "dayAnnounce", phaseEndsAt: now + DAY_ANNOUNCE_MS, day: 1 };
  if (isLegacyReveal || isLegacyClaim) return { ...next, phase: "discussion", phaseEndsAt: now + DISCUSSION_MS };
  return next;
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
