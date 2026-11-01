// 서버 전용 입력 검증 스키마(zod 값 import). Worker 만 이 파일을 import 한다 — src/ 가 import 하면 클라이언트 번들에 zod 가 들어간다.
import { z } from "zod";
import { NICKNAME_MAX_UTF16 } from "./nickname";
import { CHAT_TEXT_MAX_UTF16, MAX_TEST_BOTS, MOVE_COORD_LIMIT, PHASE_KEY_MAX } from "./protocol";
import type { ChatSendMessage, ClientMessage, CreateRoomBody, JoinRoomBody, MoveMessage, TypingSendMessage } from "./protocol";

// 상한은 UTF-16 길이다. 제품 규칙(8 자소)은 validateNickname 이 판정한다 — 여기서 64 처럼 낮게 잡으면
// 자소 8 개짜리 유효 이름(가족 이모지 88 단위)이 스키마에서 먼저 400 으로 막힌다(06 리뷰 WR-03).
const nickname = z.string().max(NICKNAME_MAX_UTF16);

export const CreateRoomBodySchema = z.object({ nickname, testMode: z.boolean().optional() }) satisfies z.ZodType<CreateRoomBody>;
export const JoinRoomBodySchema = z.object({ nickname }) satisfies z.ZodType<JoinRoomBody>;

// 로비 이동 입력(결정 0044-17): 목적지 두 정수뿐이다. 속도·경로·시각·신원(seat·v·t0 등)이 덧붙으면 거부한다(T-06-09).
// ClientMessageSchema 의 멤버다(06-08) — 이 값이 먼저 선언되어야 유니온이 쓸 수 있다.
export const MoveMessageSchema = z.strictObject({
  t: z.literal("move"),
  x: z.number().int().min(-MOVE_COORD_LIMIT).max(MOVE_COORD_LIMIT),
  z: z.number().int().min(-MOVE_COORD_LIMIT).max(MOVE_COORD_LIMIT),
}) satisfies z.ZodType<MoveMessage>;

// 입력 중(07-10, CHAT-04): 켜짐/꺼짐과 단계 키뿐이다. 채널·좌석·신원(ch·seat·id)이 덧붙으면 거부한다 — 채널은 서버가 보낸 사람 상태로 정한다(결정 0002, T-07-19).
// ClientMessageSchema 의 멤버다 — 이 값이 먼저 선언되어야 유니온이 쓸 수 있다(TDZ).
export const TypingMessageSchema = z.strictObject({
  t: z.literal("typing"),
  on: z.boolean(),
  pk: z.string().min(1).max(PHASE_KEY_MAX),
}) satisfies z.ZodType<TypingSendMessage>;

// 자유 채팅 한 줄(07-11, CHAT-01): 본문과 단계 키뿐이다. 채널·좌석·신원(ch·seat·id)이 덧붙으면 거부한다 — 채널은 서버가 보낸 사람 상태로 정한다(결정 0002, T-07-23).
// 본문 상한은 UTF-16 300 — 프레임 1024B 안. 제품 규칙(자소 100)은 sanitizeChatText 가 판정한다(Pitfall 12).
// ClientMessageSchema 의 멤버다 — 이 값이 먼저 선언되어야 유니온이 쓸 수 있다(TDZ).
export const ChatMessageSchema = z.strictObject({
  t: z.literal("chat"),
  text: z.string().max(CHAT_TEXT_MAX_UTF16),
  pk: z.string().min(1).max(PHASE_KEY_MAX),
}) satisfies z.ZodType<ChatSendMessage>;

export const ClientMessageSchema = z.discriminatedUnion("t", [
  z.object({ t: z.literal("hello"), token: z.string().min(16).max(128) }),
  z.object({ t: z.literal("ping"), c: z.number() }),
  z.object({ t: z.literal("start") }),
  z.object({ t: z.literal("leave") }),
  z.object({ t: z.literal("kick"), seat: z.number().int().min(0).max(7) }),
  // 빠른 메시지(say)는 07-11, 텍스트 이모티콘(emoji)은 07-12 에 없어졌다 — 옛 번들이 보내도 유니온에 없어 BAD_MESSAGE 다(CHAT-06). 자유 채팅은 아래 ChatMessageSchema.
  // 2페이즈 변형은 strictObject 다: 알 수 없는 키가 있으면 거부한다(T-02-15, D-16).
  // 밤 행동은 대상 seat 하나뿐이다. 행동 종류는 보내지 않는다 — 서버 저장 역할이 정한다(T-03-06).
  z.strictObject({ t: z.literal("pick"), target: z.number().int().min(0).max(7) }),
  // 처형 여부 투표(결정 0034): 불리언 하나뿐이다. 덧붙은 키(seat·id 등)는 거부한다 — 행위자는 소켓 첨부 playerId 로만 정해진다(T-04-03).
  z.strictObject({ t: z.literal("execVote"), agree: z.boolean() }),
  // 후보 선택 투표(결정 0034·0036): 대상 seat 하나뿐이다. 자기 자신·탈락자·빈 자리는 서버 규칙(castCandidateVote)이 거부한다. 덧붙은 키는 스키마가 거부한다(T-04-23).
  // null = 선택 취소(결정 0040). 빠진 target·문자열·범위 밖·덧붙은 키는 그대로 거부한다. nullable 은 이 한 곳뿐이다(pick 의 target 은 null 을 거부).
  z.strictObject({ t: z.literal("candidateVote"), target: z.number().int().min(0).max(7).nullable() }),
  // 테스트 방 방장 도구(결정 0022). 덧붙은 키는 거부한다. 방장·testMode·단계 검사는 서버 규칙(shared/game/testTools.ts)이 한다.
  z.strictObject({ t: z.literal("testSkip") }),
  z.strictObject({ t: z.literal("testReset") }),
  z.strictObject({ t: z.literal("testRole"), role: z.enum(["mafia", "police", "doctor", "citizen"]).nullable() }),
  // 서버 봇 수(결정 0024): 정수 0..MAX_TEST_BOTS. 총 인원 8명 제한은 서버 규칙(setBotCount)이 한 번 더 자른다.
  z.strictObject({ t: z.literal("testBots"), count: z.number().int().min(0).max(MAX_TEST_BOTS) }),
  // 봇 투표 규칙(P-13): 두 값 모두 필수인 절대값. 모르는 값·빠진 키·덧붙은 키는 거부한다(T-04-46). 방장·testMode·대기실 검사는 서버 규칙(setBotVote)이 한다.
  z.strictObject({ t: z.literal("testBotVote"), exec: z.enum(["random", "yes", "no"]), pick: z.enum(["random", "host", "other"]) }),
  // 로비 이동(결정 0044-17, 06-08): 목적지 두 정수뿐. 행위자는 소켓 첨부 playerId 로만 정해진다(T-06-17).
  MoveMessageSchema,
  TypingMessageSchema,
  ChatMessageSchema,
]) satisfies z.ZodType<ClientMessage>;
