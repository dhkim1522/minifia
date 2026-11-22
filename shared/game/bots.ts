// 서버 봇의 단계별 행동을 계획한다. 시각과 난수는 인자로 받고 입력 상태를 바꾸지 않는다.
// 방 DO는 예약된 행동을 사람과 같은 처리기로 실행한다. 단계가 바뀌면 지난 계획을 버리고
// 연결된 사람이 없으면 봇 전용 알람을 사용하지 않는다.
// 고정 봇 투표가 설정된 방은 예전 문구·대상·간격을 유지해 테스트 시나리오를 재현한다.
// 일반 봇은 공개 정보나 그 역할의 의사결정에 허용된 동료 정보만 읽는다.
import { isAlive } from "./alive";
import { KEYWORD_MS, SHOWDOWN_TURN_MS } from "./phases";
import type { Player, RoomState } from "./room";
import { firstPlaytestDay } from "./playtest";
import { NOTE_FIRST_DAY } from "./postit";
import { LAST_WORD_CHIPS } from "./showdown";
import type { RandInt } from "./tick";

/** 봇 닉네임(8자 고정 목록, scripts/bots.mjs 의 NAMES 와 같다). */
// 봇 이름은 모두 닉네임 최대 길이(8자)로 채운다 — 가장 넓은 이름표를 E2E·실기기가 늘 시험한다(결정 0052-3, 0028 칼날 경계).
export const BOT_NAMES: readonly string[] = ["봇가나다라마바사", "봇아자차카타파하", "봇갸냐댜랴먀뱌샤", "봇야쟈챠캬탸퍄햐", "봇거너더러머버서", "봇어저처커터퍼허", "봇고노도로모보소"];

/** 단계 마감 이만큼 전보다 늦은 행동은 계획에서 버린다(마감 직전에 실행되어 거부되는 일을 줄인다). */
export const BOT_END_MARGIN_MS = 500;
/** 낮 토론: 첫 행동 2000 + [0, 10000) ms, 둘째는 그 뒤 8000 + [0, 18000) ms — 토론 40초(결정 0039)에서 둘째 행동 최대 37998ms 가 마감 − 500 안에 든다. 서버 채팅 제한(최소 간격 600ms·같은 문장 3초, D5)보다 넉넉하다. */
const DISCUSSION_FIRST_BASE_MS = 2_000;
const DISCUSSION_FIRST_SPAN_MS = 10_000;
const DISCUSSION_GAP_BASE_MS = 8_000;
const DISCUSSION_GAP_SPAN_MS = 18_000;
/** 밤 pick: 1000 + [0, 5000) ms. */
const NIGHT_PICK_BASE_MS = 1_000;
const NIGHT_PICK_SPAN_MS = 5_000;
/** 마피아 밤 채팅: randInt(10) < 6 (60%) 이면 8000 + [0, 6000) ms 에 한 번. */
const NIGHT_CHAT_TENTHS = 6;
const NIGHT_CHAT_BASE_MS = 8_000;
const NIGHT_CHAT_SPAN_MS = 6_000;

/** 찬반: 찬성 확률(%). 테스트 방에서 처형 경로가 자주 열리게 높인 바뀔 수 있는 기본값(결정 0036). */
export const EXEC_YES_PERCENT = 70;
/** 찬반 지연: 1000 + [0, 5000) ms (단계 10초 안, 결정 0060-13). */
const VERDICT_BASE_MS = 1_000;
const VERDICT_SPAN_MS = 5_000;
/** 결선 투표 지연: 500 + [0, 2500) ms (투표 창 5초에서 마감 − 500 안, 결정 0066-4). */
export const RUNOFF_BOT_BASE_MS = 500;
export const RUNOFF_BOT_SPAN_MS = 2_500;
/** 마지막 3인 동시 지목 지연: 500 + [0, 2500) ms (지목 창 8초에서 마감 − 500 안, 결정 0066-5). */
export const SHOWDOWN_BOT_POINT_BASE_MS = 500;
export const SHOWDOWN_BOT_POINT_SPAN_MS = 2_500;
/** 유언 지연(처형자 봇): 1000 + [0, 4000) ms (단계 10초 안). */
const DEFENSE_SAY_BASE_MS = 1_000;
const DEFENSE_SAY_SPAN_MS = 4_000;

// ---- 봇 고정 문구(07-11, 가정 A2). 닉네임 8자 규칙과 무관하고, 모두 sanitizeChatText 를 그대로 통과하며 자소 100 이하다. ----
/** 낮 토론의 문구. 재현용 고정 투표는 이전 목록인 처음 여덟 줄을 쓴다. */
export const BOT_CHAT_LINES: readonly string[] = [
  "저 아니에요",
  "누가 수상해요?",
  "조용한 사람이 수상해요",
  "어제 그 말 이상했어요",
  "믿어 주세요",
  "투표 신중하게 해요",
  "다들 뭐 했어요?",
  "저는 시민 같아요",
  "처음에 했던 말부터 다시 생각해 봐요",
  "두 사람 말이 조금 다른 것 같아요",
  "아직 단서가 부족해요",
  "지금 나온 얘기부터 정리해요",
  "먼저 말한 사람한테 다시 물어봐요",
  "어떤 이유로 그렇게 봤어요?",
  "발언이 계속 바뀌는 게 신경 쓰여요",
  "한 사람씩 짧게 얘기해요",
];
const REPLAY_CHAT_COUNT = 8;

/** 공개된 장르만으로 고르는 답. 역할·정답·금지어 판정 결과는 참조하지 않는다. */
export const BOT_KEYWORD_CLUES: Readonly<Record<string, readonly string[]>> = {
  movie: ["기억에 남는 장면", "작품 속 이야기", "한 편 보고 싶어요", "배우 표정이 인상적", "끝까지 보고 싶어요", "추천 받은 작품", "몰입해서 보게 돼요", "친구랑 같이 봐요"],
  food: ["한 입 먹고 싶어요", "향부터 떠올라요", "입맛에 잘 맞아요", "같이 나눠 먹어요", "맛이 궁금하네요", "생각하면 배고파요", "한 접시 주문해요", "메뉴에 있어요"],
  animal: ["움직임이 눈에 띄어요", "사진으로 본 적 있어요", "생김새가 특이해요", "마주치면 멈춰 봐요", "관찰하다 보면 재밌죠", "몸짓이 떠올라요", "어디서 사는지 궁금해요", "가까이서 보고 싶어요"],
  place: ["지도에서 찾아봤어요", "길을 물어봐요", "다시 들르고 싶어요", "사진 남기고 싶어요", "둘러볼 곳이 있어요", "약속 잡아서 가요", "사람들이 오가는 곳", "가는 길을 찾아요"],
  sport: ["경기 장면이 떠올라요", "응원할 맛이 나요", "끝날 때까지 몰라요", "집중력이 중요해요", "직접 해 보고 싶어요", "관람하면 긴장돼요", "연습부터 해야 해요", "호흡을 맞춰야 해요"],
  object: ["손에 쥐고 써요", "필요할 때 찾게 돼요", "용도가 떠올라요", "어디 뒀는지 찾아요", "가끔 꺼내 써요", "쓰는 법이 있어요", "하나 갖고 싶어요", "제자리에 두는 편"],
  country: ["여행하는 상상을 해요", "지도로 찾아봐요", "직접 가 보고 싶어요", "생활 풍경이 궁금해요", "어떤 언어를 쓸까요", "소개 글이 떠올라요", "여행 계획에 넣어요", "현지 사람과 얘기해요"],
};
/** 밤에 산 마피아 봇이 고르는 문구(3개). */
export const BOT_NIGHT_LINES: readonly string[] = ["동의해요", "그 사람으로 가요", "다른 사람으로 해요"];
/** 유언 단계에서 처형자인 봇이 남기는 문구(3개). 길이를 옛 템플릿 목록과 같은 3 으로 두어 defense 의 시드 호출 수가 그대로다. */
export const BOT_DEFENSE_LINES: readonly string[] = ["저 아니에요", "저는 시민이에요", "한 번만 믿어 주세요"];

/** 1일차 토론에서 봇이 남기는 유언 문장(3개, 역할 단어 없음). 봇 seat % 길이 번째 줄을 쓴다 — 난수 없음. sanitizeChatText 를 그대로 통과하며 유언 상한 WILL_MAX_GRAPHEMES(50) 자소 이하다(결정 0061-18, 사용자 결정 2026-11-05). */
export const BOT_WILL_LINES: readonly string[] = ["다들 끝까지 힘내요", "저는 믿어 주세요", "좋은 판이었어요"];
/** 1일차 토론 시작 이만큼 뒤에 산 봇이 유언을 쓴다(ms). */
export const BOT_WILL_AT_MS = 3_000;
/** 봇은 채팅 한 줄을 보내기 이만큼 전에 입력 중 신호를 켠다(ms, 09-24). 서버 typingRelay 의 켜짐 간격(1500ms)과 같다 — 같은 봇의 두 줄 사이(8000ms 이상)에는 항상 새로 중계된다. */
export const BOT_TYPING_LEAD_MS = 1_500;

/** 봇 행동 한 가지 — 사람 ClientMessage 의 같은 칸 이름을 쓴다(chat 은 본문 text 만, 단계 키는 실행할 때 서버 상태에서 만든다). */
export type BotAct =
  | { t: "chat"; text: string }
  | { t: "pick"; target: number }
  // 이전에 저장된 계획 호환용. 현재 봇은 건너뛰기 동의에서 제외한다.
  | { t: "endDiscussion" }
  | { t: "point"; target: number }
  | { t: "verdict"; agree: boolean }
  | { t: "firstBallot"; target: number | null }
  | { t: "answer"; text: string }
  | { t: "suspect"; target: number }
  // 9페이즈(결정 0061-18): 유언 한 줄(방 DO 의 applyWill 본체). 난수 없음. final: 유언 단계의 처형자 봇 — 사람의 [남기기]와 같은 길로 단계를 끝낸다(22-11 D-18).
  | { t: "will"; text: string; final?: true }
  // 9페이즈 보완(09-24, feedback-1): 채팅 줄 직전에 서버 안에서 입력 중 켜짐을 중계한다(방 DO 의 relayTyping 본체, 사람의 typing 메시지와 같은 길). 난수 없음, 꺼짐은 보내지 않는다.
  | { t: "typing" };
export interface BotStep {
  at: number;
  botId: string;
  act: BotAct;
}
/** key = 계획을 세운 단계("단계:마감"). 지금 단계 키와 다르면 낡은 계획이다. */
export interface BotPlan {
  key: string;
  steps: BotStep[];
}

export const isBot = (p: { isBot?: true }): boolean => p.isBot === true;
export const botCount = (state: RoomState): number => state.players.filter(isBot).length;

const bySeat = (a: Player, b: Player): number => a.seat - b.seat;
const hasConnectedHuman = (state: RoomState): boolean => state.players.some((p) => !isBot(p) && p.connected);
const replayVotes = (state: RoomState): boolean => state.testBotVote?.exec !== undefined || state.testBotVote?.pick !== undefined;

function activitySeed(state: RoomState): number {
  let hash = 2166136261;
  for (const digit of `${state.code}:${state.startedAt ?? state.createdAt}:${state.round ?? 1}:${state.day ?? 1}`) {
    hash = Math.imul(hash ^ digit.charCodeAt(0), 16777619);
  }
  return hash >>> 0;
}

/**
 * 마피아 봇이 밤에 고를 대상 seat(결정 0061-18). 산 마피아 봇이 아니면 undefined.
 * 후보는 산 비마피아 seat 오름차순이다. 이미 고른 마피아 동료가 있으면 그 선택을 따른다.
 * 먼저 고를 때는 방·판·일차마다 같은 후보를 고른다. 고정 봇 투표가 설정된 재현용 방은 첫 후보를 유지한다.
 * 난수를 부르지 않는다. 마피아 본인이 view 로도 받는 정보(동료 선택·생존·역할 구성)만 쓰고 경찰·의사의 선택은 읽지 않는다(결정 0024-6).
 */
export function botMafiaTarget(state: RoomState, bot: Player): number | undefined {
  if (!isAlive(bot) || bot.role !== "mafia") return undefined;
  const candidates = state.players.filter((p) => isAlive(p) && p.role !== "mafia").sort(bySeat).map((p) => p.seat);
  if (candidates.length === 0) return undefined;
  const followed = state.players
    .filter((p) => isAlive(p) && p.role === "mafia" && p.id !== bot.id && p.nightPick !== undefined && candidates.includes(p.nightPick))
    .map((p) => p.nightPick!);
  if (followed.length > 0) return Math.min(...followed);
  return candidates[replayVotes(state) ? 0 : activitySeed(state) % candidates.length];
}

/**
 * 밤에 이 봇이 고를 대상 seat. 마피아는 botMafiaTarget(난수 없음, 결정 0061-18), 의사는 자신 포함 살아 있는 모두,
 * 경찰·시민은 살아 있는 다른 사람(셋 다 seat 오름차순 후보에서 randInt 한 번). 탈락한 봇·후보 없음은 undefined(randInt 를 부르지 않는다).
 */
export function botNightTarget(state: RoomState, bot: Player, randInt: RandInt): number | undefined {
  if (!isAlive(bot)) return undefined;
  if (bot.role === "mafia") return botMafiaTarget(state, bot);
  const living = state.players.filter(isAlive).sort(bySeat);
  let candidates: Player[];
  if (bot.role === "doctor") candidates = living;
  else candidates = living.filter((p) => p.id !== bot.id);
  if (candidates.length === 0) return undefined;
  return candidates[randInt(candidates.length)]!.seat;
}

/**
 * 처형 여부 투표에서 이 봇이 던질 값: 고정(fixed) yes 면 true, no 면 false 이고 randInt 를 부르지 않는다.
 * 고정이 없으면 randInt(100) < EXEC_YES_PERCENT 이면 찬성. 계획과 넘기기(botsVoteNow)가 같은 결정을 쓴다.
 */
export function botExecAgree(randInt: RandInt, fixed?: "yes" | "no"): boolean {
  if (fixed === "yes") return true;
  if (fixed === "no") return false;
  return randInt(100) < EXEC_YES_PERCENT;
}

/**
 * 지목에서 이 봇이 고를 대상 seat. 후보는 자기 자신을 뺀 살아 있는 사람 seat 오름차순이고 역할을 보지 않는다(봇이 마피아를 아는 척하지 않는다).
 * 탈락한 봇·후보 없음은 undefined(randInt 를 부르지 않는다).
 * 고정(pick, P-13): host 는 방장이 살아 있고 이 봇이 아니면 방장 seat, other 는 방장도 자기도 아닌 살아 있는 사람 중 가장 낮은 seat 이며 randInt 를 부르지 않는다.
 * 조건이 안 맞으면(방장 탈락·후보 없음) 위 무작위로 돌아가 기존과 같이 한 번 부른다.
 */
export function botPointTarget(
  state: RoomState,
  bot: Player,
  randInt: RandInt,
  pick?: "host" | "other",
): number | undefined {
  if (!isAlive(bot)) return undefined;
  const candidates = state.players.filter((p) => isAlive(p) && p.id !== bot.id).sort(bySeat);
  if (candidates.length === 0) return undefined;
  if (pick === "host") {
    const host = candidates.find((p) => p.id === state.hostId);
    if (host !== undefined) return host.seat;
  } else if (pick === "other") {
    const other = candidates.find((p) => p.id !== state.hostId);
    if (other !== undefined) return other.seat;
  }
  return candidates[randInt(candidates.length)]!.seat;
}

/** 봇 계획이 필요한 단계(discussion·nomination·runoff·showdown·verdict·night·defense)의 키 "단계:마감". 그 밖은 null. */
export function botPlanKey(state: RoomState): string | null {
  if (state.phase === "keyword" && state.keyword !== undefined && !replayVotes(state)) return `keyword:${state.phaseEndsAt}`;
  const planned: readonly string[] = ["discussion", "nomination", "runoff", "showdown", "verdict", "night", "defense"];
  if (!planned.includes(state.phase)) return null;
  return `${state.phase}:${state.phaseEndsAt}`;
}

/**
 * 순차 지목의 자기 차례에 지목한다. 일반 봇은 0.6~1.8초 차등 간격을 쓰고 재현용 방은 즉시 지목한다.
 * 차례 주인이 아닌 봇·모이는 중(i -1)·확정 뒤 사이·끝 알림(i = order.length)·탈락한 봇은 빈 배열이고 randInt 를 부르지 않는다.
 * 대상은 지금 지목과 같은 결정 함수(botPointTarget — 역할을 보지 않고 고정 pick host·other 를 따른다) — 난수는 [후보 수] 한 번뿐이다.
 */
export function turnPointSteps(state: RoomState, bot: Player, now: number, randInt: RandInt): BotStep[] {
  const turn = state.pickTurn;
  if (state.phase !== "nomination" || turn === undefined) return [];
  if (turn.i < 0 || turn.i >= turn.order.length || turn.doneAt !== undefined) return [];
  if (turn.order[turn.i] !== bot.seat || !isAlive(bot)) return [];
  const target = botPointTarget(state, bot, randInt, state.testBotVote?.pick);
  if (target === undefined) return [];
  const at = replayVotes(state) ? now : now + 600 + (activitySeed(state) + bot.seat * 137) % 1_200;
  return [{ at, botId: bot.id, act: { t: "point", target } }];
}

/**
 * 결선에서 이 봇이 던질 후보 seat(09.1.1-05, 결정 0066-4). 계획(runoffPointSteps)과 넘기기(finishRunoff)가 같은 결정을 쓴다.
 * 고정 pick(P-13)이 host 면 방장인 후보, other 면 방장이 아닌 후보 중 낮은 좌석 — 해당하는 후보가 없으면 무작위로 돌아간다(randInt(2) 번째 후보, 역할을 보지 않는다).
 * 결선이 아니거나 후보인 봇·탈락한 봇은 undefined(randInt 를 부르지 않는다). 고정 값이 있으면 randInt 를 부르지 않는다.
 */
export function botRunoffTarget(state: RoomState, bot: Player, randInt: RandInt): number | undefined {
  const runoff = state.runoff;
  if (state.phase !== "runoff" || runoff === undefined) return undefined;
  if (!isAlive(bot) || runoff.cand.includes(bot.seat)) return undefined;
  const pick = state.testBotVote?.pick;
  const hostSeat = state.players.find((p) => p.id === state.hostId)?.seat;
  let target: number | undefined;
  if (pick === "host") target = runoff.cand.find((seat) => seat === hostSeat);
  else if (pick === "other") target = runoff.cand.find((seat) => seat !== hostSeat);
  return target ?? runoff.cand[randInt(2)]!;
}

/**
 * 결선 투표 계획(09.1.1-05, 결정 0066-4): 투표 창(step 1)에서 후보가 아닌 산 봇 하나가 후보 둘 중 하나에게 point 한 번.
 * 대상은 botRunoffTarget, 지연은 RUNOFF_BOT_BASE_MS + randInt(RUNOFF_BOT_SPAN_MS). 실행은 사람과 같은 applyPoint → 결선 투표 본체를 지난다.
 */
function runoffPointSteps(state: RoomState, bot: Player, now: number, randInt: RandInt): BotStep[] {
  if (state.runoff?.step !== 1) return [];
  const target = botRunoffTarget(state, bot, randInt);
  if (target === undefined) return [];
  return [{ at: now + RUNOFF_BOT_BASE_MS + randInt(RUNOFF_BOT_SPAN_MS), botId: bot.id, act: { t: "point", target } }];
}

/**
 * 마지막 3인 결전 계획(09.1.1-07, 결정 0066-5).
 *   한마디 차례(i 0..2): 차례 주인이 이 봇이고 미확정이면 차례 시작 시각에 chat 한 줄(LAST_WORD_CHIPS[randInt(4)]). 사람 차례·확정 뒤 사이·모이는 중은 빈 배열.
 *   동시 지목(i 3): 자기를 뺀 산 사람 하나(botPointTarget — 고정 pick 포함)에게 SHOWDOWN_BOT_POINT_BASE_MS + randInt(SPAN) 뒤 point 한 번. 공개(i 4)는 빈 배열.
 * 탈락한 봇은 빈 배열이고 randInt 를 부르지 않는다. 연결 상태·역할은 읽지 않는다.
 */
function showdownSteps(state: RoomState, bot: Player, now: number, randInt: RandInt): BotStep[] {
  const sd = state.showdown;
  if (state.phase !== "showdown" || sd === undefined || !isAlive(bot)) return [];
  if (sd.i >= 0 && sd.i <= 2) {
    if (sd.doneAt !== undefined || sd.endsAt === undefined || sd.order[sd.i] !== bot.seat) return [];
    return [{ at: sd.endsAt - SHOWDOWN_TURN_MS, botId: bot.id, act: { t: "chat", text: LAST_WORD_CHIPS[randInt(LAST_WORD_CHIPS.length)]! } }];
  }
  if (sd.i === 3) {
    const target = botPointTarget(state, bot, randInt, state.testBotVote?.pick);
    if (target === undefined) return [];
    return [{ at: now + SHOWDOWN_BOT_POINT_BASE_MS + randInt(SHOWDOWN_BOT_POINT_SPAN_MS), botId: bot.id, act: { t: "point", target } }];
  }
  return [];
}

function planFor(state: RoomState, bot: Player, now: number, randInt: RandInt): BotStep[] {
  const steps: BotStep[] = [];
  const add = (at: number, act: BotAct): void => {
    steps.push({ at, botId: bot.id, act });
  };
  // 채팅 한 줄: 바로 앞에 같은 봇의 typing 단계를 둔다(09-24). planBotSteps 가 짝(typing 바로 다음 chat)이 버려지면 typing 도 버린다.
  const addChat = (at: number, text: string): void => {
    add(Math.max(now, at - BOT_TYPING_LEAD_MS), { t: "typing" });
    add(at, { t: "chat", text });
  };
  if (state.phase === "keyword" && state.keyword !== undefined && state.phaseEndsAt !== null && !replayVotes(state)) {
    const lines = BOT_KEYWORD_CLUES[state.keyword.genre];
    if (Array.isArray(lines) && lines.length > 0 && !state.answerSubmits?.some((row) => row.seat === bot.seat)) {
      const early = state.earlyFrom;
      const end = early?.phase === "keyword" && early.day === (state.day ?? 0) ? early.endsAt : state.phaseEndsAt;
      const text = lines[(activitySeed(state) + bot.seat) % lines.length]!;
      // 사람이 바로 제출해도 같은 1.5초 유예 안에서 봇 답을 받을 수 있다.
      add(Math.max(now, end - KEYWORD_MS) + 150 + randInt(750) + bot.seat * 45, { t: "answer", text });
    }
  } else if (state.phase === "discussion") {
    const replay = replayVotes(state);
    const size = replay ? REPLAY_CHAT_COUNT : BOT_CHAT_LINES.length;
    const first = now + DISCUSSION_FIRST_BASE_MS + randInt(DISCUSSION_FIRST_SPAN_MS);
    const firstLine = randInt(size);
    addChat(first, BOT_CHAT_LINES[firstLine]!);
    const second = first + DISCUSSION_GAP_BASE_MS + randInt(DISCUSSION_GAP_SPAN_MS);
    const nextLine = randInt(replay ? size : size - 1);
    addChat(second, BOT_CHAT_LINES[!replay && nextLine >= firstLine ? nextLine + 1 : nextLine]!);
    if (!replay && (state.map ?? "bar") === "bar" && (state.day ?? 1) >= NOTE_FIRST_DAY) {
      const day = state.day ?? 1;
      if (!state.notes?.some((note) => note.n === day && note.from === bot.seat) && (activitySeed(state) + bot.seat) % 3 !== 0) {
        const target = botPointTarget(state, bot, randInt);
        if (target !== undefined) add(first + 1_500 + randInt(5_000), { t: "suspect", target });
      }
    }
    // 유언(09-12): 1일차에만 한 번, 고정 문장.
    if ((state.day ?? 1) === 1) add(now + BOT_WILL_AT_MS, { t: "will", text: BOT_WILL_LINES[bot.seat % BOT_WILL_LINES.length]! });
  } else if (state.phase === "nomination") {
    // 순차 지목(09.1, 결정 0063-1): 자기 차례에 한 번.
    steps.push(...turnPointSteps(state, bot, now, randInt));
  } else if (state.phase === "runoff") {
    steps.push(...runoffPointSteps(state, bot, now, randInt));
  } else if (state.phase === "showdown") {
    steps.push(...showdownSteps(state, bot, now, randInt));
  } else if (state.phase === "verdict") {
    if (firstPlaytestDay(state)) {
      if (state.firstBallotOutcome === undefined && bot.firstBallot === undefined) {
        const target = botFirstBallotTarget(state, bot, randInt);
        add(now + VERDICT_BASE_MS + randInt(VERDICT_SPAN_MS), { t: "firstBallot", target });
      }
      return steps;
    }
    // 찬반(08-07, 22-09 D-11): 후보가 없어 산 봇 모두가 던진다. 고정 exec(yes·no)도 따른다(결정 0060-13).
    const agree = botExecAgree(randInt, state.testBotVote?.exec);
    add(now + VERDICT_BASE_MS + randInt(VERDICT_SPAN_MS), { t: "verdict", agree });
  } else if (state.phase === "night") {
    // 모든 역할의 산 봇이 한 명을 고른다(D-05) — 시민 봇의 고르기도 같은 pickTarget 을 지나 효과 없이 저장된다.
    const target = state.playtest === true && bot.role === "citizen" ? undefined : botNightTarget(state, bot, randInt);
    if (target !== undefined) add(now + NIGHT_PICK_BASE_MS + randInt(NIGHT_PICK_SPAN_MS), { t: "pick", target });
    if (bot.role === "mafia" && randInt(10) < NIGHT_CHAT_TENTHS) {
      const at = now + NIGHT_CHAT_BASE_MS + randInt(NIGHT_CHAT_SPAN_MS);
      addChat(at, BOT_NIGHT_LINES[randInt(BOT_NIGHT_LINES.length)]!);
    }
  } else if (state.phase === "defense") {
    // 유언 단계(22-11 D-18): 처형자인 봇만 고정 문구 하나를 유언으로 남긴다(final — 사람의 [남기기]와 같다). 채팅은 이 단계에서 잠겼고 typing 은 붙이지 않는다.
    // 난수 호출 수·순서는 옛 변론과 같다(randInt(3) → randInt(4000)). 후보가 아닌 봇은 아무것도 하지 않는다.
    if (state.verdict?.candidate === bot.seat) {
      const text = BOT_DEFENSE_LINES[randInt(BOT_DEFENSE_LINES.length)]!;
      add(now + DEFENSE_SAY_BASE_MS + randInt(DEFENSE_SAY_SPAN_MS), { t: "will", text, final: true });
    }
  }
  return steps;
}

export function botFirstBallotTarget(state: RoomState, bot: Player, randInt: RandInt): number | null {
  if (!botExecAgree(randInt, state.testBotVote?.exec)) return null;
  return botPointTarget(state, bot, randInt, state.testBotVote?.pick) ?? null;
}

/**
 * 지금 단계에서 살아 있는 봇들의 행동 계획(at 오름차순, 같으면 원래 순서). 사람이 한 명도 연결되어 있지 않으면 빈 배열 —
 * 버려진 테스트 방이 봇 알람으로 계속 깨지 않게 한다. 봇은 seat 오름차순으로, 봇마다 위 순서로 randInt 를 부른다.
 */
export function planBotSteps(state: RoomState, now: number, randInt: RandInt): BotStep[] {
  if (!hasConnectedHuman(state)) return [];
  if (state.phaseEndsAt === null) return [];
  const limit = state.phaseEndsAt - BOT_END_MARGIN_MS;
  const startsAt = Math.max(now, state.phaseStartsAt ?? now);
  const all: BotStep[] = [];
  for (const bot of state.players.filter((p) => isBot(p) && isAlive(p)).sort(bySeat)) {
    const planned = planFor(state, bot, startsAt, randInt);
    planned.forEach((step, i) => {
      if (step.at >= limit) return;
      // typing 은 바로 다음 단계(짝 chat)가 마감 여유 안일 때만 남긴다(09-24).
      if (step.act.t === "typing" && !(planned[i + 1] !== undefined && planned[i + 1]!.act.t === "chat" && planned[i + 1]!.at < limit)) return;
      all.push(step);
    });
  }
  return all
    .map((step, index) => ({ step, index }))
    .sort((a, b) => a.step.at - b.step.at || a.index - b.index)
    .map((entry) => entry.step);
}

/** botPlan 키만 뺀 상태. 키가 없으면 입력 그대로. */
function withoutPlan(state: RoomState): RoomState {
  if (!Object.hasOwn(state, "botPlan")) return state;
  const { botPlan: _dropped, ...rest } = state;
  return rest;
}

/**
 * 봇·연결된 사람이 없거나 계획이 필요 없는 단계면 botPlan 을 뺀다.
 * 저장된 키가 지금 키와 같으면 입력 그대로, 다르면 새 계획을 세운 새 상태.
 */
export function syncBotPlan(state: RoomState, now: number, randInt: RandInt): RoomState {
  if (botCount(state) === 0 || !hasConnectedHuman(state)) return withoutPlan(state);
  const key = botPlanKey(state);
  if (key === null) return withoutPlan(state);
  if (state.botPlan?.key === key) return state;
  return { ...state, botPlan: { key, steps: planBotSteps(state, now, randInt) } };
}

/** 때가 된(at ≤ now) 행동을 순서대로 꺼내고 나머지만 남긴 새 상태. 낡은 계획이거나 꺼낼 것이 없으면 입력 그대로. */
export function takeDueBotSteps(state: RoomState, now: number): { state: RoomState; due: BotStep[] } {
  if (!hasConnectedHuman(state)) return { state, due: [] };
  const plan = state.botPlan;
  const key = botPlanKey(state);
  if (!plan || key === null || plan.key !== key) return { state, due: [] };
  const due = plan.steps.filter((s) => s.at <= now);
  if (due.length === 0) return { state, due: [] };
  return { state: { ...state, botPlan: { key, steps: plan.steps.filter((s) => s.at > now) } }, due };
}

/** 남은 첫 봇 행동 시각. 계획이 없거나 낡았거나 비었으면 null. */
export function botWakeAt(state: RoomState): number | null {
  if (!hasConnectedHuman(state)) return null;
  const plan = state.botPlan;
  if (!plan || plan.key !== botPlanKey(state)) return null;
  return plan.steps[0]?.at ?? null;
}
