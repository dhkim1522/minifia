// 테스트 방 서버 봇 규칙(결정 0024). 순수 모듈이다 — 현재 시각·전역 난수를 스스로 읽지 않고(시각 now 와 난수 randInt 는 인자로만 받는다),
// 입력 상태를 바꾸지 않으며, DOM·workerd API 를 쓰지 않는다.
//
// 이 파일은 "계획"만 만든다: 단계에 들어갈 때 어떤 봇이 언제 무엇을 할지(BotStep)를 정해 RoomState.botPlan 에 둔다.
// 행동의 실행과 검증은 방 DO 가 사람과 같은 처리기(applyChat·pickTarget·castExecVote·castCandidateVote)로 한다 — 봇은 특권이 없다.
// 단계가 바뀌면 계획 키(단계:마감)가 달라져 남은 행동은 저절로 버려지고 새 단계 계획이 선다.
//
// 07-08: 순차 직업 주장(claim) 단계와 그 봇 계획이 없어졌다. 봇 계획이 서는 단계는 discussion·night·execVote·candidateVote·defense 다.
//
// 구현됨(결정 0024, 0036): 처형 여부 투표(execVote)에는 찬성·반대 하나, 후보 선택(candidateVote)에는 자기를 뺀 살아 있는 한 명(역할을 보지 않는다),
// 최후 변론(defense)에서는 후보인 봇만 고정 문구(BOT_DEFENSE_LINES) 하나를 자유 채팅으로 보낸다. 공개·처형·종료 단계에는 계획이 없다.
// 07-11: 봇은 고정 문구 목록에서 자유 채팅 줄(chat)을 보낸다 — 낮 토론 두 줄(BOT_CHAT_LINES), 밤 산 마피아 60% 한 줄(BOT_NIGHT_LINES), 후보 봇의 변론 한 줄.
// 이모티콘·빠른 메시지(say)는 더 이상 보내지 않는다. 로비에서는 말하지 않는다(계획이 서지 않는다). 줄은 사람과 같은 applyChat 본체를 지나 단계 키·채널·D5 제한을 그대로 받는다.
//
// 난수 호출 순서가 계약이다(시드 테스트가 고정한다). randInt(0) 호출은 어디에도 없다(cryptoRandInt(0) 은 RangeError).
// 새 단계의 난수는 새 분기 안에서만 늘어난다. 07-08 에서 claim 분기의 난수 호출이 빠져 시드 고정 값이 새 호출 순서로 다시 고정됐다(다른 단계의 호출 수는 그대로).
// 07-11: 봇 자유 채팅으로 discussion·night 의 호출 순서가 바뀌어 시드 고정 값을 다시 고정했다(execVote·candidateVote·defense 의 호출 수는 그대로).
// 봇 하나당 순서: discussion = (randInt(첫 지연 폭) → randInt(8)) → (randInt(둘째 지연 폭) → randInt(8)),
// night = (대상이 있으면) randInt(대상 수) → randInt(pick 지연 폭), 마피아면 이어서 randInt(10) → (< 6 이면) randInt(채팅 지연 폭) → randInt(3),
// execVote = randInt(100) → randInt(지연 폭), candidateVote = (후보가 있으면) randInt(후보 수) → randInt(지연 폭),
// defense(후보 봇만) = randInt(문구 수 3) → randInt(지연 폭).
// 테스트 방 방장이 봇 투표를 고정한 경우(RoomState.testBotVote, P-13): 고정 값이면 결정 난수(randInt(100)·randInt(후보 수))를 건너뛰고 지연 난수는 그대로 부른다.
// 고정 설정이 없거나 pick 조건이 안 맞아 무작위로 돌아가면 위 순서와 똑같다.
import { isAlive } from "./alive";
import type { Player, RoomState } from "./room";
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

/** 처형 여부 투표: 찬성 확률(%). 테스트 방에서 처형 경로가 자주 열리게 높인 바뀔 수 있는 기본값(결정 0036). */
export const EXEC_YES_PERCENT = 70;
/** 여부 투표 지연: 1000 + [0, 6000) ms (단계 13초 − 마감 여유 안). */
const EXEC_VOTE_BASE_MS = 1_000;
const EXEC_VOTE_SPAN_MS = 6_000;
/** 후보 선택 지연: 1000 + [0, 9000) ms (단계 15초 안). */
const CANDIDATE_VOTE_BASE_MS = 1_000;
const CANDIDATE_VOTE_SPAN_MS = 9_000;
/** 최후 변론 지연: 1000 + [0, 4000) ms (단계 10초 안). */
const DEFENSE_SAY_BASE_MS = 1_000;
const DEFENSE_SAY_SPAN_MS = 4_000;

// ---- 봇 고정 문구(07-11, 가정 A2). 닉네임 8자 규칙과 무관하고, 모두 sanitizeChatText 를 그대로 통과하며 자소 100 이하다. ----
/** 낮 토론에서 봇이 두 번 고르는 문구(8개). */
export const BOT_CHAT_LINES: readonly string[] = [
  "저 아니에요",
  "누가 수상해요?",
  "조용한 사람이 수상해요",
  "어제 그 말 이상했어요",
  "믿어 주세요",
  "투표 신중하게 해요",
  "다들 뭐 했어요?",
  "저는 시민 같아요",
];
/** 밤에 산 마피아 봇이 고르는 문구(3개). */
export const BOT_NIGHT_LINES: readonly string[] = ["동의해요", "그 사람으로 가요", "다른 사람으로 해요"];
/** 최후 변론에서 후보인 봇이 고르는 문구(3개). 길이를 옛 템플릿 목록과 같은 3 으로 두어 defense 의 시드 호출 수가 그대로다. */
export const BOT_DEFENSE_LINES: readonly string[] = ["저 아니에요", "저는 시민이에요", "한 번만 믿어 주세요"];

/** 봇 행동 한 가지 — 사람 ClientMessage 의 같은 칸 이름을 쓴다(chat 은 본문 text 만, 단계 키는 실행할 때 서버 상태에서 만든다). */
export type BotAct =
  | { t: "chat"; text: string }
  | { t: "pick"; target: number }
  | { t: "execVote"; agree: boolean }
  | { t: "candidateVote"; target: number };
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

/**
 * 밤에 이 봇이 고를 대상 seat. 후보는 seat 오름차순 — 마피아는 살아 있는 비마피아, 경찰은 살아 있는 다른 사람,
 * 의사는 자신 포함 살아 있는 모두. 그 밖 역할·탈락한 봇·후보 없음은 undefined(randInt 를 부르지 않는다).
 */
export function botNightTarget(state: RoomState, bot: Player, randInt: RandInt): number | undefined {
  if (!isAlive(bot)) return undefined;
  const living = state.players.filter(isAlive).sort(bySeat);
  let candidates: Player[];
  if (bot.role === "mafia") candidates = living.filter((p) => p.role !== "mafia");
  else if (bot.role === "police") candidates = living.filter((p) => p.id !== bot.id);
  else if (bot.role === "doctor") candidates = living;
  else return undefined;
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
 * 후보 선택에서 이 봇이 고를 대상 seat. 후보는 자기 자신을 뺀 살아 있는 사람 seat 오름차순이고 역할을 보지 않는다(봇이 마피아를 아는 척하지 않는다).
 * 탈락한 봇·후보 없음은 undefined(randInt 를 부르지 않는다).
 * 고정(pick, P-13): host 는 방장이 살아 있고 이 봇이 아니면 방장 seat, other 는 방장도 자기도 아닌 살아 있는 사람 중 가장 낮은 seat 이며 randInt 를 부르지 않는다.
 * 조건이 안 맞으면(방장 탈락·후보 없음) 위 무작위로 돌아가 기존과 같이 한 번 부른다.
 */
export function botCandidateTarget(
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

/** 봇 계획이 필요한 단계(discussion·night·execVote·candidateVote·defense)의 키 "단계:마감". 그 밖은 null. */
export function botPlanKey(state: RoomState): string | null {
  const planned: readonly string[] = ["discussion", "night", "execVote", "candidateVote", "defense"];
  if (!planned.includes(state.phase)) return null;
  return `${state.phase}:${state.phaseEndsAt}`;
}

/** 낮 토론의 한 행동: 고정 문구 목록에서 randInt(8) 번째 줄. */
function discussionAct(randInt: RandInt): BotAct {
  return { t: "chat", text: BOT_CHAT_LINES[randInt(BOT_CHAT_LINES.length)]! };
}

function planFor(state: RoomState, bot: Player, now: number, randInt: RandInt): BotStep[] {
  const steps: BotStep[] = [];
  const add = (at: number, act: BotAct): void => {
    steps.push({ at, botId: bot.id, act });
  };
  if (state.phase === "discussion") {
    const first = now + DISCUSSION_FIRST_BASE_MS + randInt(DISCUSSION_FIRST_SPAN_MS);
    add(first, discussionAct(randInt));
    const second = first + DISCUSSION_GAP_BASE_MS + randInt(DISCUSSION_GAP_SPAN_MS);
    add(second, discussionAct(randInt));
  } else if (state.phase === "night") {
    if (bot.role === "mafia" || bot.role === "police" || bot.role === "doctor") {
      const target = botNightTarget(state, bot, randInt);
      if (target !== undefined) add(now + NIGHT_PICK_BASE_MS + randInt(NIGHT_PICK_SPAN_MS), { t: "pick", target });
    }
    if (bot.role === "mafia" && randInt(10) < NIGHT_CHAT_TENTHS) {
      const at = now + NIGHT_CHAT_BASE_MS + randInt(NIGHT_CHAT_SPAN_MS);
      add(at, { t: "chat", text: BOT_NIGHT_LINES[randInt(BOT_NIGHT_LINES.length)]! });
    }
  } else if (state.phase === "execVote") {
    const agree = botExecAgree(randInt, state.testBotVote?.exec);
    add(now + EXEC_VOTE_BASE_MS + randInt(EXEC_VOTE_SPAN_MS), { t: "execVote", agree });
  } else if (state.phase === "candidateVote") {
    const target = botCandidateTarget(state, bot, randInt, state.testBotVote?.pick);
    if (target !== undefined) add(now + CANDIDATE_VOTE_BASE_MS + randInt(CANDIDATE_VOTE_SPAN_MS), { t: "candidateVote", target });
  } else if (state.phase === "defense") {
    // 변론은 후보 봇만 한다(서버는 산 사람 누구의 변론 채팅도 받지만 봇은 후보만 말한다). 후보가 아닌 봇은 아무것도 하지 않는다.
    if (state.verdict?.candidate === bot.seat) {
      const text = BOT_DEFENSE_LINES[randInt(BOT_DEFENSE_LINES.length)]!;
      add(now + DEFENSE_SAY_BASE_MS + randInt(DEFENSE_SAY_SPAN_MS), { t: "chat", text });
    }
  }
  return steps;
}

/**
 * 지금 단계에서 살아 있는 봇들의 행동 계획(at 오름차순, 같으면 원래 순서). 사람이 한 명도 연결되어 있지 않으면 빈 배열 —
 * 버려진 테스트 방이 봇 알람으로 계속 깨지 않게 한다. 봇은 seat 오름차순으로, 봇마다 위 순서로 randInt 를 부른다.
 */
export function planBotSteps(state: RoomState, now: number, randInt: RandInt): BotStep[] {
  if (!state.players.some((p) => !isBot(p) && p.connected)) return [];
  if (state.phaseEndsAt === null) return [];
  const limit = state.phaseEndsAt - BOT_END_MARGIN_MS;
  const all: BotStep[] = [];
  for (const bot of state.players.filter((p) => isBot(p) && isAlive(p)).sort(bySeat)) {
    for (const step of planFor(state, bot, now, randInt)) if (step.at < limit) all.push(step);
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
 * 봇 계획을 지금 단계에 맞춘다. 봇이 없거나 계획이 필요 없는 단계면 botPlan 을 뺀다(없으면 입력 그대로, randInt 를 부르지 않는다).
 * 저장된 키가 지금 키와 같으면 입력 그대로, 다르면 새 계획을 세운 새 상태.
 */
export function syncBotPlan(state: RoomState, now: number, randInt: RandInt): RoomState {
  if (botCount(state) === 0) return withoutPlan(state);
  const key = botPlanKey(state);
  if (key === null) return withoutPlan(state);
  if (state.botPlan?.key === key) return state;
  return { ...state, botPlan: { key, steps: planBotSteps(state, now, randInt) } };
}

/** 때가 된(at ≤ now) 행동을 순서대로 꺼내고 나머지만 남긴 새 상태. 낡은 계획이거나 꺼낼 것이 없으면 입력 그대로. */
export function takeDueBotSteps(state: RoomState, now: number): { state: RoomState; due: BotStep[] } {
  const plan = state.botPlan;
  const key = botPlanKey(state);
  if (!plan || key === null || plan.key !== key) return { state, due: [] };
  const due = plan.steps.filter((s) => s.at <= now);
  if (due.length === 0) return { state, due: [] };
  return { state: { ...state, botPlan: { key, steps: plan.steps.filter((s) => s.at > now) } }, due };
}

/** 남은 첫 봇 행동 시각. 계획이 없거나 낡았거나 비었으면 null. */
export function botWakeAt(state: RoomState): number | null {
  const plan = state.botPlan;
  if (!plan || plan.key !== botPlanKey(state)) return null;
  return plan.steps[0]?.at ?? null;
}
