// 서버 전용 입력 검증 스키마(zod 값 import). Worker 만 이 파일을 import 한다 — src/ 가 import 하면 클라이언트 번들에 zod 가 들어간다.
import { z } from "zod";
import { NICKNAME_MAX_UTF16 } from "./nickname";
import { CHAT_TEXT_MAX_UTF16, EMOTE_IDS, MAP_CHOICES, MAX_TEST_BOTS, MOVE_COORD_LIMIT, OUTFIT_IDS, PHASE_KEY_MAX } from "./protocol";
import type { ChatSendMessage, ClientMessage, CreateRoomBody, EmoteSendMessage, JoinRoomBody, MoveMessage, NoteSendMessage, TypingSendMessage, WillSendMessage } from "./protocol";

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

// 동작(10-01, 결정 D-12·D-19): 종류 id(enum)와 단계 키뿐이다. 좌석·채널·수신자·시각이 덧붙으면 거부한다 — 채널은 서버가 보낸 사람 상태로 정한다(결정 0002).
// ClientMessageSchema 의 멤버다 — 이 값이 먼저 선언되어야 유니온이 쓸 수 있다(TDZ).
export const EmoteMessageSchema = z.strictObject({
  t: z.literal("emote"),
  id: z.enum(EMOTE_IDS),
  pk: z.string().min(1).max(PHASE_KEY_MAX),
}) satisfies z.ZodType<EmoteSendMessage>;

// 자유 채팅 한 줄(07-11, CHAT-01): 본문과 단계 키뿐이다. 채널·좌석·신원(ch·seat·id)이 덧붙으면 거부한다 — 채널은 서버가 보낸 사람 상태로 정한다(결정 0002, T-07-23).
// 본문 상한은 UTF-16 300 — 프레임 1024B 안. 제품 규칙(자소 100)은 sanitizeChatText 가 판정한다(Pitfall 12).
// ClientMessageSchema 의 멤버다 — 이 값이 먼저 선언되어야 유니온이 쓸 수 있다(TDZ).
export const ChatMessageSchema = z.strictObject({
  t: z.literal("chat"),
  text: z.string().max(CHAT_TEXT_MAX_UTF16),
  pk: z.string().min(1).max(PHASE_KEY_MAX),
}) satisfies z.ZodType<ChatSendMessage>;

// 유언·쪽지(09-12, 결정 0061-9·10): 본문뿐이다. 행위자는 소켓 첨부 playerId 로만 정해지므로 seat·id·ch·pk 가 덧붙으면 거부한다(T-09-28, ASVS V5).
// 상한은 UTF-16 300(프레임 1024B 안). 제품 규칙(유언 자소 50·쪽지 자소 100, 정리는 sanitizeChatText)은 saveWill·saveNote 안에서 판정한다.
// ClientMessageSchema 의 멤버다 — 이 값이 먼저 선언되어야 유니온이 쓸 수 있다(TDZ).
export const WillMessageSchema = z.strictObject({
  t: z.literal("will"),
  text: z.string().max(CHAT_TEXT_MAX_UTF16),
}) satisfies z.ZodType<WillSendMessage>;
export const NoteMessageSchema = z.strictObject({
  t: z.literal("note"),
  text: z.string().max(CHAT_TEXT_MAX_UTF16),
}) satisfies z.ZodType<NoteSendMessage>;

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
  // 8페이즈 낮 처형(결정 0060, 08-07): 모두 strictObject — 행위자는 소켓 첨부 playerId 로만 정해지므로 seat·id·ch 가 덧붙으면 거부한다(T-08-04, T-08-24).
  // 토론 끝내기 on / 지목 target(0..7, 취소 없음 — null 거부) / 찬반 agree. 단계·산 사람·자기 자신·변론자 검사는 서버 규칙(shared/game/{discussion,nomination,verdict}.ts)이 한다.
  z.strictObject({ t: z.literal("endDiscussion"), on: z.boolean() }),
  z.strictObject({ t: z.literal("point"), target: z.number().int().min(0).max(7) }),
  z.strictObject({ t: z.literal("verdict"), agree: z.boolean() }),
  // 귓속말(결정 0066-2): 대상 좌석과 본문뿐 — 행위자는 소켓 첨부 playerId 로만 정해진다. UTF-16 상한 200 은 프레임 크기 방어이고 정확한 판정(30자소·산 사람·하루 1번)은 shared/game/whisper.ts 가 한다.
  z.strictObject({ t: z.literal("whisper"), to: z.number().int().min(0).max(7), text: z.string().min(1).max(200) }),
  // 직업 주장(결정 0066-1): 값은 enum 뿐 — 이번 판 구성에 있는 직업인지·단계·산 사람은 서버 규칙(shared/game/badge.ts)이 본다. 참·거짓은 판정하지 않는다.
  z.strictObject({ t: z.literal("badge"), role: z.enum(["mafia", "police", "doctor", "citizen", "none"]) }),
  // 로비 의상(결정 D-6): 값은 의상 id enum 뿐 — 단계(대기실)·간격은 서버 규칙(shared/game/look.ts)이 본다. 역할과는 비교하지 않는다.
  z.strictObject({ t: z.literal("dress"), look: z.enum(OUTFIT_IDS) }),
  // 맵 선택(결정 D-20, 11-06): 값은 enum 뿐 — 방장·단계·허용 맵은 서버 규칙(shared/game/maps.ts pickMap)이 본다. 신원은 소켓 첨부 playerId.
  z.strictObject({ t: z.literal("mapPick"), map: z.enum(MAP_CHOICES) }),
  // 다시 하기(결정 D-12, 11-08): 준비 토글과 시작. round 는 1 이상 정수 — 신원은 소켓 첨부 playerId 뿐이고 방장·단계·판 번호·인원은 서버 규칙(shared/game/rematch.ts)이 본다.
  z.strictObject({ t: z.literal("ready"), on: z.boolean(), round: z.number().int().min(1) }),
  z.strictObject({ t: z.literal("rematch"), round: z.number().int().min(1) }),
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
  EmoteMessageSchema,
  ChatMessageSchema,
  WillMessageSchema,
  NoteMessageSchema,
]) satisfies z.ZodType<ClientMessage>;
