// 1·2페이즈 와이어 계약(대기실·역할 확인·낮 토론). 상수와 타입만 둔다 — zod 등 값 import 는 넣지 않는다.
// 클라이언트(src/)가 이 파일의 값을 import 해도 번들에 스키마 라이브러리가 들어가지 않게 하기 위해서다.
// 2페이즈 계약은 02-01 에서 한 번에 정한다 — 후속 계획이 같은 이름·모양을 그대로 쓴다.
// 방장 연장·넘기기는 결정 0017-5 로 없앴다(extend·skip 메시지, 연장 중복 오류 코드, DayView 의 연장 표시가 없다).
// 서버 전용 검증 스키마는 shared/schemas.ts 에 있고 Worker 만 import 한다.
// 3페이즈 밤·아침 계약도 이 파일이다 — 밤 행동 메시지·아침 결과·수사 기록·탈락자 관전 타입을 03-01 에서 한 번에 정한다(채우는 일은 03-03·03-05).
// 4페이즈 처형·승패 계약(결정 0034·0036): 새 단계 여섯·투표 메시지·투표 기록·처형 발표·판 결과 타입을 04-01 에서 한 번에 정한다(채우는 일은 뒤 계획).
// 8페이즈 낮 처형 계약(결정 0060): 단계 nomination(지목)·verdict(찬반), 지목 줄·토론 끝내기 수·찬반 마친 좌석·결과 수·본인 찬반 타입을 08-02 에서 정한다(채우는 일은 08-07 이후).
// 09.1 순차 지목 계약(결정 0063-1): DayView.turn·PickTurnView 를 09.1-01 에서 정한다. 새 메시지 종류는 없다(point 그대로).
// 9페이즈 밤·아침 계약(결정 0061): MorningView.saved·DayView.chalk·MyInfo.nightTally/nightSure/will/note·ChatLineWire.k 를 09-07 에서 한 번에 정한다(채우는 일은 09-07 view, 09-12 유언·쪽지, 09-14 분필).

// 타입 import·재수출이라 값 import 가 아니다 — 클라이언트 번들에는 아무것도 들어가지 않는다.
import type { RoleId } from "./game/roles";
export type { RoleId } from "./game/roles";

/** 직업 주장 값(결정 0066-1): 이번 판 직업 하나 또는 none(주장 안 함). 참·거짓은 서버가 판정하지 않는다. */
export type BadgeId = RoleId | "none";

export const MIN_PLAYERS = 4;
export const MAX_PLAYERS = 8;
/** 테스트 방 방장이 한 번에 요청할 수 있는 봇 수의 상한(결정 0024). 서버가 총 인원 MAX_PLAYERS 로 한 번 더 자른다. */
export const MAX_TEST_BOTS = 7;
export const MAX_FRAME_BYTES = 1024; // WebSocket 프레임 상한
export const MAX_BODY_BYTES = 1024; // HTTP 본문 상한

// 낮 두 단계(dayAnnounce·discussion)와 밤·아침(night·morning)은 단계 표(shared/game/phases.ts)의 한 줄씩이다.
// discussion 다음에 지목(nomination) → 최후 변론(defense) → 찬반(verdict) → 처형(execution)이 이어지고(결정 0060),
// 지목이 동률·0표면 바로 night 로 가고, 최다가 정확히 둘 동점이면 동점 결선 runoff 를 거친다(결정 0066-4, 분기는 shared/game/tick.ts). 종료 단계 ended 는 마감이 없다.
// 순차 직업 주장 단계(claim)는 7페이즈에서 없어졌다 — 낮 시작 발표 다음이 바로 자유 채팅 토론이다(CHAT-06). 옛 공개 연출 단계도 없다(결정 0027).
export type PhaseId =
  | "lobby" | "assigning" | "roleReveal" | "dayAnnounce" | "discussion"
  | "nomination" | "runoff" | "defense" | "verdict" | "execution"
  | "night" | "morning" | "ended"; // 8페이즈(결정 0060): 지목 15초 → 변론 20초 → 찬반 10초 → 처형 5.6초(결정 0066-7). 옛 처형 여부·후보 선택·후보 공개 단계는 08-22 에 지웠다

// ---- 밤·아침 계약(3페이즈) ----
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
/** 아침 결과. 키 없는 객체는 지난밤 무사. 결정 0061-12·17: eliminated·saved 둘뿐이고 문장은 화면이 만든다(문구 번호 없음). */
export interface MorningView {
  eliminated?: number; // 탈락한 seat
  saved?: true; // 의사가 확정 대상을 지킨 아침. 누구인지는 싣지 않는다(결정 0061-12, 0044-22)
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
/** 지목 한 줄(결정 0060-3): 누가 누구를 가리키는지. 지목 단계 동안 모두에게 공개된다(마감까지 바꿀 수 있다). */
export interface PointLine {
  seat: number;
  target: number;
}
/** 처형 발표: 탈락한 seat 뿐이다(결정 0060-5 — 문구 번호 없음). 직업은 싣지 않는다(D-09). */
export interface ExecutionView {
  seat: number;
}
/** 처형이 성립하지 않아 밤으로 온 이유 코드(D-34): 지목 동률 · 지목 0표. 찬반 부결은 처형 단계가 알린다(결정 0060-4). */
export type NoExecutionReason = "tie" | "noVotes";
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
// 07-11·07-12: 빠른 메시지(문구 표·say 메시지·옛 줄 타입)와 텍스트 이모티콘(emoji)은 자유 채팅(아래 7페이즈 구역)으로 대체돼 없어졌다. 동작(몸짓)은 10페이즈.
export interface DayView {
  n: number; // 일차(1부터)
  roles: RoleId[]; // 이번 판 직업(구성표 순서, 공개 정보)
  morning?: MorningView; // morning 단계에서만
  chalk?: { x: number; z: number }; // 암살 현장 분필 자국 위치(고정소수점, 결정 0061-14). 채우는 일은 09-14
  // ---- 4페이즈 처형 필드 ----
  // 서버는 낮 단계마다(빈 배열 포함) 항상 싣는다. 타입을 optional 로 둔 이유: 필수로 하면 화면 테스트의 DayView 리터럴이 서버 웨이브에서 한꺼번에 바뀐다(화면 계획이 필요하면 필수로 올린다).
  voteLog?: VoteLogEntry[];
  candidate?: number; // defense·verdict·execution 에서, 변론자가 있을 때만
  execution?: ExecutionView; // execution 단계에서만
  noExecution?: { reason: NoExecutionReason }; // 처형이 성립하지 않아 밤으로 온 그 밤 단계에서만(D-34)
  // ---- 8페이즈 낮 처형 필드(결정 0060). 서버가 채우는 일은 08-07 이후 — 지금은 타입만이다. ----
  points?: PointLine[]; // nomination 단계에서, 지금 지목 줄(공개)
  endCount?: number; // discussion 단계에서, 토론 끝내기를 누른 산 사람 수(누가 눌렀는지는 싣지 않는다)
  voted?: number[]; // verdict 단계에서, 찬반을 던진 좌석(오름차순, 값은 싣지 않는다 — 익명)
  verdict?: { yes: number; no: number; passed: boolean }; // execution 단계에서, 찬반 결과 수(개인 값 없음)
  ballots?: { yes: number[]; no: number[] }; // execution 단계에서만, 찬성·반대한 좌석(오름차순, 변론자·미투표자 제외 — 결정 0066-3). 찬반 진행 중에는 없다
  turn?: PickTurnView; // nomination 단계에서만, 모두에게 같은 차례 정보(결정 0063-1, L14)
  runoff?: RunoffView; // runoff 단계에서만, 모두에게 같은 동점 결선 정보(결정 0066-4, L20)
}

/**
 * 공개 동점 결선(결정 0066-4). cand 는 후보 좌석 둘(낮은 좌석부터), step 0 앞머리 · 1 투표 · 2 결과.
 * 마감 전(step 0·1)에는 던진 유권자 좌석(voted)만, 마감 뒤(step 2)에는 후보 순서 득표 수(tally)만 싣는다. 개인 선택은 어떤 키로도 없다(본인은 me.ballot).
 */
export interface RunoffView {
  cand: [number, number];
  step: 0 | 1 | 2;
  voted?: number[]; // step 1 에서만, 던진 유권자 좌석(오름차순, 값 없음)
  tally?: [number, number]; // step 2 에서만, 후보 순서 득표 수
}

/** 공개 지목 차례(결정 0063-1). 서버 전용 PickTurn 과 같은 모양이지만 view 가 필드별로 복사한 값이고 역할·연결과 무관하다. */
export interface PickTurnView {
  order: number[]; // 차례 순서 — 지목 시작 때 산 사람 좌석 오름차순
  i: number; // -1 모이는 중 · 0..order.length-1 차례 · order.length 끝 알림
  endsAt?: number; // 이번 차례 마감(차례 중에만)
  doneAt?: number; // 이번 차례가 확정된 시각
  skip?: true; // 시간 안에 못 골라 기권으로 확정됨
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
  | { t: "pick"; target: number } // 밤 행동 — 행동 종류는 보내지 않는다(서버 저장 역할이 정한다)
  // 8페이즈 낮 처형(결정 0060). 옛 투표 메시지(처형 여부·후보 선택)는 08-21 에 지웠다 — 옛 번들이 보내면 스키마가 거부해 BAD_MESSAGE 다. 행위자는 모두 소켓 첨부 playerId 뿐이다.
  | { t: "endDiscussion"; on: boolean } // 토론 끝내기 — 누름(true)/취소(false), 산 사람만. 공개 값은 누른 수뿐이다(DAY-03)
  | { t: "point"; target: number } // 지목 — 대상 seat 하나, 취소 없음, 마감까지 바꿀 수 있다(DAY-04)
  | { t: "whisper"; to: number; text: string } // 귓속말(결정 0066-2) — 낮 토론, 하루 1번, 산 다른 사람 한 명에게 30자소 이하. 본문은 보낸·받은 사람 소켓에만 간다
  | { t: "badge"; role: BadgeId } // 직업 주장(결정 0066-1) — 서버가 정하는 것은 값의 형식뿐 참·거짓은 판정하지 않는다. 낮 시작 발표·토론·지목 단계에서만
  | { t: "verdict"; agree: boolean } // 찬반 — 찬성 true / 반대 false, 변론자·유령은 거부, 마지막 값이 유효(DAY-06)
  // 테스트 방 방장 도구(결정 0022). 일반 방은 BAD_MESSAGE 로 거부한다. role null = 무작위.
  | { t: "testSkip" }
  | { t: "testReset" }
  | { t: "testRole"; role: RoleId | null }
  // 원하는 봇 수(절대값, 0..MAX_TEST_BOTS). 서버가 사람 + 봇 <= MAX_PLAYERS 로 잘라 정확히 그만큼 둔다(결정 0024).
  | { t: "testBots"; count: number }
  // 봇 투표 규칙(절대값, 대기실에서만, 테스트 방 방장 도구 — 결정 0022·0024 확장, P-13). exec = 모든 봇의 처형 여부 표, pick = 모든 봇의 후보 선택.
  | { t: "testBotVote"; exec: BotVoteExec; pick: BotVotePick }
  // 로비 이동 — 목적지 두 정수뿐, 신원·속도·시각 없음(결정 0044-17)
  | MoveMessage
  // 입력 중 — 채널 필드 없음, 서버가 보낸 사람 상태로 채널을 정한다(결정 0002). 받는 사람은 audience(07-10)
  | TypingSendMessage
  // 자유 채팅 한 줄 — 본문과 단계 키뿐, 채널 필드 없음(결정 0002). 정리·제한·채널은 서버가 정한다(07-11)
  | ChatSendMessage
  // 유언·쪽지 저장(9페이즈 결정 0061-9·10) — 본문 text 하나뿐이다. 행위자는 소켓 첨부 playerId 뿐이고 seat·id·채널은 없다.
  // 응답은 저장한 본인(유언)·산 마피아(쪽지)에게만 간다 — 전원 방송이 없다(L7). 빈 값(공백뿐)은 지움이다.
  | WillSendMessage
  | NoteSendMessage;

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
  badge?: BadgeId; // 공개 직업 주장(결정 0066-1). 산 사람이 건 값이 있을 때만 — 실제 역할의 함수가 아니다
  badgeSwapped?: true; // 직업을 건 뒤 다른 값으로 바꾼 적이 있다(결정 0066-1). 이전 값은 어디에도 없다
}
export interface MyInfo {
  seat: number;
  isHost: boolean;
  role?: RoleId; // 내 역할 — 채우는 일은 01-07
  allies?: number[]; // 같은 마피아 동료의 seat — 채우는 일은 01-07
  pick?: number; // 밤에 본인이 고른 seat(본인에게만)
  allyPicks?: number[]; // 생존 마피아에게만: 동료들이 고른 대상 seat 오름차순·중복 없음(누가 골랐는지는 싣지 않는다)
  records?: RoleRecord[]; // 본인 역할의 일지 하나(경찰 수사·마피아 암살·의사 치료), 본인에게만
  testMode?: true; // 테스트 방 방장 본인만(결정 0022). 손님·일반 방·미리보기에는 키 자체가 없다
  testRole?: RoleId; // 그 방장의 대기실 view 에서만, 고른 직업이 있을 때(없으면 무작위, 결정 0022)
  testBots?: number; // 그 방장의 대기실 view 에서만, 서버 봇 수(0 포함, 결정 0024). 손님·일반 방·게임 중에는 키 자체가 없다
  testBotVote?: { exec: BotVoteExec; pick: BotVotePick }; // 그 방장의 대기실 view 에서만, 무작위가 아닌 값이 있을 때만(P-13). 손님·일반 방·게임 중에는 키 자체가 없다
  chat?: ChatChannel; // 서버가 정한 내 채널(channelOf), 본인에게만. 말할 수 없으면 키가 없다
  whisperUsed?: true; // 오늘 귓속말을 이미 보냈다(결정 0066-2) — discussion 단계의 산 본인에게만, 다른 소켓·다른 단계·다음 일차에는 키가 없다
  endDiscussion?: true; // discussion 단계에서 본인이 토론 끝내기를 누른 상태(본인에게만, 8페이즈 결정 0060)
  nightTally?: Array<{ seat: number; n: number }>; // 밤, 산 마피아 본인에게만: 대상 seat 별 산 마피아 선택 수(seat 오름차순, 본인 포함, 누가 골랐는지는 없다, 결정 0061-7)
  nightSure?: number; // 밤, 산 마피아 본인에게만: 전원 일치로 확정된 대상 seat(결정 0061-7). 채우는 일은 09-07 view
  will?: string; // 산 본인에게만: 본인이 남긴 유언(결정 0061-10). 지도 단계에서 저장된 값이 있을 때만(09-12)
  note?: string; // 밤, 산 마피아에게만: 남긴 쪽지(결정 0061-9). 산 마피아끼리 같은 글(09-12)
  ballot?: number; // runoff step 1·2 에서 산 유권자 본인이 고른 후보 좌석(본인에게만, 결정 0066-4). 후보·유령·미투표자에는 키가 없다
  verdictVote?: boolean; // verdict 단계에서 본인이 던진 찬반(본인에게만, 남의 값은 어떤 키로도 싣지 않는다, 8페이즈 결정 0060)
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
  day?: DayView; // 낮 두 단계(dayAnnounce·discussion)·처형 다섯 단계·밤·아침·종료에서
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

// ---- 6페이즈 로비 이동 계약(결정 0044-17) ----
// 좌표는 1/100 단위 정수(고정소수점, UNIT = 100), 시각은 서버 ms, 속도 v 는 단위/초 × 100 이다.
// 공개 식별자는 seat 뿐이다 — world 프레임에는 playerId·토큰·역할 자리가 없다(누설 표면 0).
/** 이동 목적지 좌표 한계: 방 [−7, 7] × UNIT. 입력 스키마와 저장값 복원이 같은 값을 쓴다. */
export const MOVE_COORD_LIMIT = 700;
/** 클라이언트 → 서버: 목적지 두 정수뿐이다. 속도·경로·시각·신원은 서버가 정한다. ClientMessage 의 멤버다(06-08). */
export interface MoveMessage {
  t: "move";
  x: number;
  z: number;
}
/** 한 사람의 이동 구간: p = 꼭짓점 [x0,z0,x1,z1,…], t0 = 서버 ms, v = 단위/초 × 100. */
export interface WorldSeg {
  s: number;
  p: number[];
  t0: number;
  v: number;
}
/** 서버 → 클라이언트 world 프레임(상태가 아니라 이벤트). move = 한 사람의 새 구간, snap = 접속 때 모두의 지금 구간. */
export type WorldFrame =
  | { t: "world"; k: "move"; s: number; p: number[]; t0: number; v: number }
  | { t: "world"; k: "snap"; at: number; ents: WorldSeg[] };

// ---- 7페이즈 자유 채팅 계약(결정 0058, 07-02) ----
// 키 이름은 ch·seat·seq·text·at·on·why·lines·pk 만 쓴다 — test/worker/leak.test.ts 의 FORBIDDEN_KEYS 에 id·playerId 가 있다.
// 채널 필드는 클라이언트 → 서버 메시지에 없다(결정 0002): 채널은 서버가 보낸 사람의 상태로만 정한다(shared/game/audience.ts).
// 이 구역의 타입 가운데 TypingSendMessage·TypingFrame 은 07-10 이, ChatSendMessage·ChatLineFrame·ChatRejectFrame·ChatLogFrame 은 07-11 이 유니온에 넣었다.
/** 채팅 채널: all = 로비·낮의 공개, mafia = 밤의 마피아(와 탈락자 관전), ghost = 탈락자끼리. */
export type ChatChannel = "all" | "mafia" | "ghost";
/** 서버 → 클라이언트로 나가는 채팅 한 줄. 채널마다 따로 센 seq 와 보낸 사람 seat 뿐이다 — id·역할·수신자 마스크는 싣지 않는다. */
export interface ChatLineWire {
  ch: ChatChannel;
  seat: number;
  seq: number;
  text: string;
  at: number;
  k?: "will" | "note" | "whisper" | "whispered" | "ballots"; // 서버가 만든 카드 줄(유언·쪽지, 결정 0061-11)·귓속말 줄(결정 0066-2: whisper = 당사자에게 본문, whispered = 나머지에게 본문 없는 사실). 일반 대화 줄에는 키가 없다. ballots = 찬반 기록 카드(결정 0066-3, 본문은 shared/game/ballots.ts 형식)
  to?: number; // 귓속말 상대 좌석(결정 0066-2). 누가 누구에게 보냈는지는 공개 사실이다 — 귓속말 줄(whisper·whispered)에만 있다
}
/** 막힌 이유: 도배 간격·같은 문장 반복·길이·단계/채널 불일치·그 밖(보이는 글자 없음). 보낸 사람에게만 알린다. */
export type ChatRejectWhy = "rate" | "repeat" | "length" | "phase" | "other";
export type ChatLineFrame = { t: "chat" } & ChatLineWire;
export interface TypingFrame {
  t: "typing";
  seat: number;
  on: boolean;
}
/** 접속 직후 한 번(비어 있어도 보낸다) — 이 좌석이 받았던 줄의 채널별 최근 30줄. */
export interface ChatLogFrame {
  t: "chatLog";
  lines: ChatLineWire[];
}
export interface ChatRejectFrame {
  t: "chatReject";
  why: ChatRejectWhy;
}
/** 유언 저장(지도 단계의 산 사람, 결정 0061-10). 본문 정리·50 자소 제한(WILL_MAX_GRAPHEMES)은 서버(saveWill)가 정한다. */
export interface WillSendMessage {
  t: "will";
  text: string;
}
/** 쪽지 저장(밤의 산 마피아, 확정 대상이 있을 때만, 결정 0061-9). 작성자를 싣지 않는다 — 익명이다. */
export interface NoteSendMessage {
  t: "note";
  text: string;
}
/** pk = phaseKey(단계 한 번을 가리키는 '일차:단계'). 어긋나면 서버가 더 넓은 채널로 돌리지 않고 폐기한다. */
export interface ChatSendMessage {
  t: "chat";
  text: string;
  pk: string;
}
export interface TypingSendMessage {
  t: "typing";
  on: boolean;
  pk: string;
}
/** 스키마 상한(UTF-16). 제품 규칙은 자소 100 이고 정확한 판정은 sanitizeChatText 가 한다. 1024B 프레임 안에 든다. */
export const CHAT_TEXT_MAX_UTF16 = 300;
export const PHASE_KEY_MAX = 32;
/** 동작(몸짓) 종류 아홉 개(UI-SPEC 동작 종류 표). 10페이즈가 재사용한다 — 7페이즈는 표만 둔다. */
export const EMOTE_IDS = ["throat", "deny", "clap", "cry", "handshake", "point", "praise", "surprise", "dance"] as const;
export type EmoteId = (typeof EMOTE_IDS)[number];

export type ServerMessage =
  | { t: "state"; view: RoomView }
  | { t: "pong"; c: number; serverNow: number }
  | { t: "error"; code: WsErrorCode }
  | ChatLineFrame // 자유 채팅 한 줄 — audience 가 정한 소켓에만, 보낸 사람 포함(07-11)
  | ChatRejectFrame // 거절 — 보낸 소켓에만(07-11)
  | ChatLogFrame // 접속 직후 복원 — 타입과 연결 훅만 07-11, 보내기는 07-14
  | WorldFrame
  | TypingFrame; // 입력 중 — 같은 채널의 다른 소켓에만 간다(audience, 07-10)
export const CLOSE_CODES = { REPLACED: 4001, REMOVED: 4003 } as const;
export type RemovedReason = "left" | "kicked" | "invalid_token" | "room_closed";
