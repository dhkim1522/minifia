// 테스트 방 서버 봇 규칙(결정 0024). 순수 모듈이다 — 현재 시각·전역 난수를 스스로 읽지 않고(시각 now 와 난수 randInt 는 인자로만 받는다),
// 입력 상태를 바꾸지 않으며, DOM·workerd API 를 쓰지 않는다.
//
// 이 파일은 "계획"만 만든다: 단계에 들어갈 때 어떤 봇이 언제 무엇을 할지(BotStep)를 정해 RoomState.botPlan 에 둔다.
// 행동의 실행과 검증은 방 DO 가 사람과 같은 처리기(selectClaim·say·emote·pickTarget)로 한다 — 봇은 특권이 없다.
// 단계가 바뀌면 계획 키(단계:마감)가 달라져 남은 행동은 저절로 버려지고 새 단계 계획이 선다.
//
// 구현됨(결정 0023, 0027-10): 봇은 자기 차례에만 주장한다. botClaimChoice 는 그 봇 차례가 아니면 난수 없이 null 을 돌려주고,
// 차례마다 새 계획이 서도록 botPlanKey 에 차례 번호가 들어 있다. 나머지 규칙은 그대로다.
//
// 난수 호출 순서가 계약이다(시드 테스트가 고정한다). randInt(0) 호출은 어디에도 없다(cryptoRandInt(0) 은 RangeError).
import { EMOJI_IDS } from "../protocol";
import type { Claim, EmojiId, TemplateId } from "../protocol";
import { isAlive } from "./alive";
import { currentClaimSeat } from "./claim";
import { rolesInPlay } from "./roles";
import type { RoleId } from "./roles";
import type { Player, RoomState } from "./room";
import type { RandInt } from "./tick";

/** 봇 닉네임(5자 이하 고정 목록, scripts/bots.mjs 의 NAMES 와 같다). */
// 봇 이름은 모두 닉네임 최대 길이(5자)로 채운다 — 이름표가 가장 넓은 최악 경우를 E2E·실기기 테스트가 늘 시험하게 한다(결정 0028 칼날 경계).
export const BOT_NAMES: readonly string[] = ["봇가나다라", "봇마바사아", "봇자차카타", "봇파하갸냐", "봇더러머버", "봇서어저처", "봇커터퍼허"];

/** 단계 마감 이만큼 전보다 늦은 행동은 계획에서 버린다(마감 직전에 실행되어 거부되는 일을 줄인다). */
export const BOT_END_MARGIN_MS = 500;
/** 직업 공개에서 말 안 함을 고를 확률(%). */
const NONE_PERCENT = 15;
/** 직업 공개 첫 행동 지연: 500 + [0, 3000) ms. */
const CLAIM_DELAY_BASE_MS = 500;
const CLAIM_DELAY_SPAN_MS = 3_000;
/** 낮 토론: 첫 행동 2000 + [0, 10000) ms, 둘째는 그 뒤 8000 + [0, 30000) ms. 서버 전송 한도(1800ms)보다 넉넉하다. */
const DISCUSSION_FIRST_BASE_MS = 2_000;
const DISCUSSION_FIRST_SPAN_MS = 10_000;
const DISCUSSION_GAP_BASE_MS = 8_000;
const DISCUSSION_GAP_SPAN_MS = 30_000;
/** 밤 pick: 1000 + [0, 5000) ms. */
const NIGHT_PICK_BASE_MS = 1_000;
const NIGHT_PICK_SPAN_MS = 5_000;
/** 마피아 밤 채팅: randInt(10) < 6 (60%) 이면 8000 + [0, 6000) ms 에 한 번. */
const NIGHT_CHAT_TENTHS = 6;
const NIGHT_CHAT_BASE_MS = 8_000;
const NIGHT_CHAT_SPAN_MS = 6_000;

/** 봇 행동 한 가지 — 사람 ClientMessage 의 같은 칸 이름을 쓴다. */
export type BotAct =
  | { t: "claim"; claim: Claim }
  | { t: "say"; template: TemplateId; target?: number; claimedRole?: RoleId }
  | { t: "emoji"; icon: EmojiId }
  | { t: "pick"; target: number };
export interface BotStep {
  at: number;
  botId: string;
  act: BotAct;
}
/** key = 계획을 세운 단계("단계:마감", claim 은 "claim:마감:차례 번호"). 지금 단계 키와 다르면 낡은 계획이다. */
export interface BotPlan {
  key: string;
  steps: BotStep[];
}

export const isBot = (p: { isBot?: true }): boolean => p.isBot === true;
export const botCount = (state: RoomState): number => state.players.filter(isBot).length;

const bySeat = (a: Player, b: Player): number => a.seat - b.seat;

/**
 * 직업 주장에서 이 봇이 낼 주장과 지연. claim 단계가 아니거나, 탈락했거나, 지금 차례(currentClaimSeat)가 이 봇이 아니면 null —
 * 이 검사가 맨 앞이라 난수를 한 번도 부르지 않는다. 차례이면 randInt(100) < 15 이면 말 안 함, 아니면 이번 판 직업 중
 * randInt(길이)번째, 그다음 delayMs = 500 + randInt(3000).
 */
export function botClaimChoice(
  state: RoomState,
  bot: Player,
  randInt: RandInt,
): { claim: Claim; delayMs: number } | null {
  if (state.phase !== "claim" || !isAlive(bot) || currentClaimSeat(state) !== bot.seat) return null;
  let claim: Claim = "none";
  if (randInt(100) >= NONE_PERCENT) {
    const roles = rolesInPlay(state.players.length);
    if (roles.length > 0) claim = roles[randInt(roles.length)]!;
  }
  return { claim, delayMs: CLAIM_DELAY_BASE_MS + randInt(CLAIM_DELAY_SPAN_MS) };
}

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
 * 봇 계획이 필요한 단계(claim·discussion·night)의 키. 그 밖은 null. claim 은 차례마다 계획이 새로 서야 하므로
 * "claim:마감:차례 번호" 다 — 마감이 우연히 같아져도(테스트 넘기기 연타) 차례 번호가 달라 낡은 계획이 살아남지 않는다(D-20).
 */
export function botPlanKey(state: RoomState): string | null {
  if (state.phase === "claim") return `claim:${state.phaseEndsAt}:${state.claimIdx ?? 0}`;
  if (state.phase !== "discussion" && state.phase !== "night") return null;
  return `${state.phase}:${state.phaseEndsAt}`;
}

/** 낮 토론의 한 행동: 0 이면 이모티콘(randInt(8)), 1 이면 "저 아니에요". */
function discussionAct(randInt: RandInt): BotAct {
  const kind = randInt(2);
  if (kind === 0) return { t: "emoji", icon: EMOJI_IDS[randInt(EMOJI_IDS.length)] as EmojiId };
  return { t: "say", template: "innocent" };
}

function planFor(state: RoomState, bot: Player, now: number, randInt: RandInt): BotStep[] {
  const steps: BotStep[] = [];
  const add = (at: number, act: BotAct): void => {
    steps.push({ at, botId: bot.id, act });
  };
  if (state.phase === "claim") {
    const choice = botClaimChoice(state, bot, randInt);
    if (choice !== null) add(now + choice.delayMs, { t: "claim", claim: choice.claim });
  } else if (state.phase === "discussion") {
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
      if (randInt(2) === 0) add(at, { t: "say", template: "nightAgree" });
      else add(at, { t: "emoji", icon: EMOJI_IDS[randInt(EMOJI_IDS.length)] as EmojiId });
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
