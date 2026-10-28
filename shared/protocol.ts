// 1·2페이즈 와이어 계약(대기실·역할 확인·낮 토론). 상수와 타입만 둔다 — zod 등 값 import 는 넣지 않는다.
// 클라이언트(src/)가 이 파일의 값을 import 해도 번들에 스키마 라이브러리가 들어가지 않게 하기 위해서다.
// 2페이즈 계약은 02-01 에서 한 번에 정한다 — 후속 계획이 같은 이름·모양을 그대로 쓴다.
// 방장 연장·넘기기는 결정 0017-5 로 없앴다(extend·skip 메시지, 연장 중복 오류 코드, DayView 의 연장 표시가 없다).
// 서버 전용 검증 스키마는 shared/schemas.ts 에 있고 Worker 만 import 한다.
// 3페이즈 밤·아침 계약도 이 파일이다 — 밤 행동 메시지·아침 결과·수사 기록·탈락자 관전 타입을 03-01 에서 한 번에 정한다(채우는 일은 03-03·03-05).
// 4페이즈 처형·승패 계약(결정 0034·0036): 새 단계 여섯·투표 메시지·투표 기록·처형 발표·판 결과 타입을 04-01 에서 한 번에 정한다(채우는 일은 뒤 계획).

// 타입 import·재수출이라 값 import 가 아니다 — 클라이언트 번들에는 아무것도 들어가지 않는다.
import type { RoleId } from "./game/roles";
export type { RoleId } from "./game/roles";

export const MIN_PLAYERS = 4;
export const MAX_PLAYERS = 8;
/** 테스트 방 방장이 한 번에 요청할 수 있는 봇 수의 상한(결정 0024). 서버가 총 인원 MAX_PLAYERS 로 한 번 더 자른다. */
export const MAX_TEST_BOTS = 7;
export const MAX_FRAME_BYTES = 1024; // WebSocket 프레임 상한
export const MAX_BODY_BYTES = 1024; // HTTP 본문 상한

// 낮 세 단계(dayAnnounce·claim·discussion)와 밤·아침(night·morning)은 단계 표(shared/game/phases.ts)의 한 줄씩이다.
// discussion 다음에 처형 여부 투표(execVote) → 후보 선택(candidateVote) → 선택 공개(candidateVoteReveal) → 최후 변론(defense) → 처형(execution)이 이어지고,
// 여부 투표 마감에서 통과하지 못하면 바로 night 로 간다(분기는 shared/game/tick.ts). 종료 단계 ended 는 마감이 없다.
// claim 은 직업 주장을 한 명씩 차례로 하는 단계다(결정 0023). 한 차례(8초)의 마감이 곧 단계 마감이고, 남은 차례가 있으면
// 서버가 같은 단계에 머물며 마감만 한 차례 뒤로 옮긴다 — 모든 폰이 같은 마감을 받는다. 옛 공개 연출 단계는 없어졌다(결정 0027).
export type PhaseId =
  | "lobby" | "assigning" | "roleReveal" | "dayAnnounce" | "claim" | "discussion"
  | "execVote" | "candidateVote" | "candidateVoteReveal" | "defense" | "execution"
  | "night" | "morning" | "ended";

// ---- 밤·아침 계약(3페이즈) ----
/**
 * 아침 탈락 문구 번호는 1..MORNING_PHRASE_COUNT (D-18). 서버(문구 추첨)와 화면(문장 표)이 같은 값을 읽는다.
 * 결정 0036 9항: 첫 문구를 처형 묶음으로 옮겨 번호가 한 칸 당겨졌다(8 → 7).
 */
export const MORNING_PHRASE_COUNT = 7;
/** 경찰 본인에게만 보이는 수사 기록 한 줄: 그 밤의 일차·대상 seat·마피아인지 불리언 하나. 직업 이름은 싣지 않는다. */
export interface InvestigationRecord {
  n: number;
  target: number;
  isMafia: boolean;
}
/** 마피아 팀 암살일지 한 줄: 그 밤의 일차·마피아 팀의 최종 지목 seat·그 사람이 죽었는지 불리언 하나(의사가 막으면 false). 직업 이름은 싣지 않는다. */
export interface AssassinationRecord {
  n: number;
  target: number;
  died: boolean;
}
/** 의사 치료일지 한 줄: 그 밤의 일차·보호한 seat. 구출 성공 여부는 싣지 않는다. 직업 이름은 싣지 않는다. */
export interface TreatmentRecord {
  n: number;
  target: number;
}
/** 본인 역할의 일지 한 줄 — 줄 모양은 키로 구별되고 화면은 me.role 로 해석한다(결정 0027). */
export type RoleRecord = InvestigationRecord | AssassinationRecord | TreatmentRecord;
/** 아침 결과. 키 없는 객체는 지난밤 무사(D-12·D-13: 의사 구출도 무사로 보인다). */
export interface MorningView {
  eliminated?: number; // 탈락한 seat
  phrase?: number; // 탈락 문구 번호 1..MORNING_PHRASE_COUNT
}
/** 탈락자 전용 관전 정보(결정 0021): 한 사람의 실제 직업. 키 이름은 role 이 아니라 job 이다(누출 테스트 불변식). */
export interface SpectateSeat {
  seat: number;
  job: RoleId;
}
/** 그 밤에 각 역할이 고른 대상 seat — 오름차순·중복 없음. 누가 골랐는지는 seats 로 안다. */
export interface SpectatePicks {
  mafia: number[];
  police: number[];
  doctor: number[];
}
export interface SpectateView {
  seats: SpectateSeat[];
  picks?: SpectatePicks; // 밤에만
}

// ---- 처형·승패 계약(4페이즈) ----
/** 처형 문구 번호는 1..EXECUTION_PHRASE_COUNT (D-11). 서버(문구 추첨)와 화면(문장 표)이 같은 값을 읽는다. */
export const EXECUTION_PHRASE_COUNT = 4;
/** 여부 투표의 실시간 집계 — 던진 표만 센다(안 던진 사람은 어느 쪽도 아니다). 모든 viewer 에게 같은 값이다(D-02). */
export interface ExecTally {
  yes: number;
  no: number;
}
/** 후보 선택 한 줄: 누가 누구를 골랐는지. 던진 표만 있다(무효표는 줄이 없다). 공개 구간 이후에만 모두에게 실린다(D-07). */
export interface CandidateVoteLine {
  seat: number;
  target: number;
}
/**
 * 날짜별 공개 투표 기록 한 줄(D-08). exec 에는 집계 수뿐이다 — 여부 투표는 익명이라 개인 줄이 타입에도 없다.
 * cand 는 여부 투표를 통과한 날에만: votes 배열 순서가 서버가 정한 공개 순서(D-20)이고, candidate 가 없으면 동률·0표다.
 */
export interface VoteLogEntry {
  n: number;
  exec: { yes: number; no: number; passed: boolean };
  cand?: { votes: CandidateVoteLine[]; candidate?: number };
}
/** 처형 발표: 탈락한 seat 와 문구 번호. 직업은 싣지 않는다(D-09). */
export interface ExecutionView {
  seat: number;
  phrase: number;
}
/** 처형이 성립하지 않아 밤으로 온 이유 코드(D-34): 과반 못 채움 · 후보 동률 · 후보 선택 0표. */
export type NoExecutionReason = "notMajority" | "tie" | "noVotes";
/** 판 요약 한 줄(종료 뒤에만 모두에게, D-17·D-27). died false 는 지목했으나 죽지 않은 밤(의사가 지킴)이다. */
export interface SummaryRow {
  n: number;
  exec?: { yes: number; no: number; passed: boolean; candidate?: number };
  night?: { target?: number; died: boolean };
}
/** 승리 팀 — 역할 이름(mafia·citizen)과 겹치지 않는 단어를 쓴다(누출 검사의 직업 단어 목록, Pitfall 10). */
export type GameWinner = "citizenWin" | "mafiaWin";
/** 종료 단계(ended)에서만 모두에게 실리는 판 결과(D-17): 승리 팀·모든 사람의 직업·판 요약. */
export interface GameResult {
  winner: GameWinner;
  seats: SpectateSeat[];
  summary: SummaryRow[];
}

// ---- 낮 토론 계약(2페이즈) ----
/** 공개된 직업 주장. 그 사람의 실제 역할이 아니다. */
export type Claim = RoleId | "none";
// 낮 다섯 + 밤 전용 세 개(결정 0019-2) + 표시 전용 두 개(결정 0027-7) + 변론 여섯 개(결정 0036, D-13) — 쓸 수 있는 때는 shared/game/chat.ts QUICK_TEMPLATES.when
export const TEMPLATE_IDS = [
  "suspect", "trust", "claimed", "innocent", "vote",
  "nightTarget", "nightAgree", "nightOther",
  "claimRole", "claimNone",
  "defNotMe", "defCitizen", "defSuspect", "defTrust", "defRole", "defPlead",
] as const;
export type TemplateId = (typeof TEMPLATE_IDS)[number];
/**
 * 표시 전용(결정 0027-7): 화면이 claimLog 에서 만드는 주장 줄에만 쓰고 서버는 chat 프레임으로도 say 로도 쓰지 않는다.
 * 빠른 메시지 칩 순서 목록(TEMPLATE_ORDER·NIGHT_TEMPLATE_ORDER)에 넣지 않는다.
 */
export const DISPLAY_ONLY_TEMPLATE_IDS = ["claimRole", "claimNone"] as const;
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
/** 공개된 주장 한 줄: 그 일차에 그 자리가 한 말. 차례가 끝나는 순간 모두에게 같게 실린다(공개 정보, 결정 0023-5). */
export interface ClaimLogEntry {
  n: number; // 일차
  seat: number;
  claim: Claim;
}
/** claim 단계의 지금 차례. 끝나지 않은 차례의 선택은 어떤 키로도 싣지 않는다. */
export interface ClaimTurn {
  seat: number;
}
export interface DayView {
  n: number; // 일차(1부터)
  roles: RoleId[]; // 이번 판 직업(구성표 순서, 공개 정보)
  turn?: ClaimTurn; // claim 단계에서만: 지금 주장할 차례인 seat
  claimLog: ClaimLogEntry[]; // 낮 단계마다 항상: 지금까지 공개된 주장(일차 오름차순, 같은 일차는 차례 순서)
  morning?: MorningView; // morning 단계에서만
  // ---- 4페이즈 처형 필드 ----
  // 서버는 낮 단계마다(빈 배열 포함) 항상 싣는다. 타입을 optional 로 둔 이유: 필수로 하면 화면 테스트의 DayView 리터럴이 서버 웨이브에서 한꺼번에 바뀐다(화면 계획이 필요하면 필수로 올린다).
  voteLog?: VoteLogEntry[];
  execTally?: ExecTally; // execVote 단계에서만, 모든 viewer 에게 같은 값
  candidate?: number; // candidateVoteReveal·defense·execution 에서, 후보가 있을 때만
  execution?: ExecutionView; // execution 단계에서만
  noExecution?: { reason: NoExecutionReason }; // 처형이 성립하지 않아 밤으로 온 그 밤 단계에서만(D-34)
}

// ---- HTTP ----
export interface CreateRoomBody {
  nickname: string;
  /** true 일 때만 테스트 방이다(결정 0022). 방을 만들 때만 정해지고 바꿀 수 없다. */
  testMode?: boolean;
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
  | { t: "emoji"; icon: EmojiId }
  | { t: "pick"; target: number } // 밤 행동 — 행동 종류는 보내지 않는다(서버 저장 역할이 정한다)
  | { t: "execVote"; agree: boolean } // 처형 여부 투표 — 생존자의 찬성 true / 반대 false, 마지막 값이 유효(결정 0034)
  | { t: "candidateVote"; target: number } // 후보 선택 투표 — 자기 자신은 서버가 거부, 진행 중 값은 본인에게만(결정 0034·0036)
  // 테스트 방 방장 도구(결정 0022). 일반 방은 BAD_MESSAGE 로 거부한다. role null = 무작위.
  | { t: "testSkip" }
  | { t: "testReset" }
  | { t: "testRole"; role: RoleId | null }
  // 원하는 봇 수(절대값, 0..MAX_TEST_BOTS). 서버가 사람 + 봇 <= MAX_PLAYERS 로 잘라 정확히 그만큼 둔다(결정 0024).
  | { t: "testBots"; count: number };

// 테스트 방 봇 투표 선택(결정 0022·0024 확장, P-13). 무작위가 기본이고 고정 값은 방장이 대기실에서 정한다.
export type BotVoteExec = "random" | "yes" | "no";
export type BotVotePick = "random" | "host" | "other";

// ---- 서버 -> 클라이언트 ----
// 공개 식별자는 seat 뿐이다. 내부 id·토큰·역할 자리는 타입에도 없다.
export interface PublicPlayer {
  seat: number;
  nickname: string;
  connected: boolean;
  isHost: boolean;
  alive?: boolean; // 서버는 항상 싣는다(공개 정보, 03-05). 없으면 생존
}
export interface MyInfo {
  seat: number;
  isHost: boolean;
  role?: RoleId; // 내 역할 — 채우는 일은 01-07
  allies?: number[]; // 같은 마피아 동료의 seat — 채우는 일은 01-07
  pick?: number; // 밤에 본인이 고른 seat(본인에게만)
  voteAgree?: boolean; // execVote 단계에서 본인이 던진 여부 표(본인에게만, 남의 표는 어떤 키로도 싣지 않는다)
  voteTarget?: number; // candidateVote 단계에서 본인이 고른 후보 seat(본인에게만)
  allyPicks?: number[]; // 생존 마피아에게만: 동료들이 고른 대상 seat 오름차순·중복 없음(누가 골랐는지는 싣지 않는다)
  records?: RoleRecord[]; // 본인 역할의 일지 하나(경찰 수사·마피아 암살·의사 치료), 본인에게만
  testMode?: true; // 테스트 방 방장 본인만(결정 0022). 손님·일반 방·미리보기에는 키 자체가 없다
  testRole?: RoleId; // 그 방장의 대기실 view 에서만, 고른 직업이 있을 때(없으면 무작위, 결정 0022)
  testBots?: number; // 그 방장의 대기실 view 에서만, 서버 봇 수(0 포함, 결정 0024). 손님·일반 방·게임 중에는 키 자체가 없다
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
  day?: DayView; // 낮 세 단계(dayAnnounce·claim·discussion)·처형 다섯 단계·밤·아침·종료에서
  spectate?: SpectateView; // 탈락한 본인 view 에만(결정 0021). 살아 있는 사람 view 에는 키 자체가 없다
  result?: GameResult; // ended 단계에서만, 모두에게(D-17)
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
