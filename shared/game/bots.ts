// 테스트 방 서버 봇 규칙(결정 0024). 순수 모듈이다 — 현재 시각·전역 난수를 스스로 읽지 않고(시각 now 와 난수 randInt 는 인자로만 받는다),
// 입력 상태를 바꾸지 않으며, DOM·workerd API 를 쓰지 않는다.
//
// 이 파일은 "계획"만 만든다: 단계에 들어갈 때 어떤 봇이 언제 무엇을 할지(BotStep)를 정해 RoomState.botPlan 에 둔다.
// 행동의 실행과 검증은 방 DO 가 사람과 같은 처리기(applyChat·pickTarget·toggleEnd·castPoint·castVerdict)로 한다 — 봇은 특권이 없다.
// 단계가 바뀌면 계획 키(단계:마감)가 달라져 남은 행동은 저절로 버려지고 새 단계 계획이 선다.
//
// 07-08: 순차 직업 주장(claim) 단계와 그 봇 계획이 없어졌다. 08-07: 낮 처형 단계(결정 0060)가 더해져 nomination·verdict 에도 계획이 선다.
// 08-21: 옛 처형 여부·후보 선택 단계의 계획과 행동이 없어졌다. 봇 계획이 서는 단계는 discussion·nomination·verdict·night·defense 다.
//
// 구현됨(결정 0024, 0060-13): 토론(discussion)에는 채팅 두 줄과 토론 끝내기 한 번, 지목(nomination)에는 자기를 뺀 살아 있는 한 명(역할을 보지 않는다),
// 찬반(verdict)에는 변론자가 아닌 산 봇의 찬성·반대 하나, 최후 변론(defense)에서는 변론자인 봇만 고정 문구(BOT_DEFENSE_LINES) 하나를 자유 채팅으로 보낸다. 공개·처형·종료 단계에는 계획이 없다.
// 07-11: 봇은 고정 문구 목록에서 자유 채팅 줄(chat)을 보낸다 — 낮 토론 두 줄(BOT_CHAT_LINES), 밤 산 마피아 60% 한 줄(BOT_NIGHT_LINES), 후보 봇의 변론 한 줄.
// 이모티콘·빠른 메시지(say)는 더 이상 보내지 않는다. 로비에서는 말하지 않는다(계획이 서지 않는다). 줄은 사람과 같은 applyChat 본체를 지나 단계 키·채널·D5 제한을 그대로 받는다.
//
// 난수 호출 순서가 계약이다(시드 테스트가 고정한다). randInt(0) 호출은 어디에도 없다(cryptoRandInt(0) 은 RangeError).
// 새 단계의 난수는 새 분기 안에서만 늘어난다. 07-08 에서 claim 분기의 난수 호출이 빠져 시드 고정 값이 새 호출 순서로 다시 고정됐다(다른 단계의 호출 수는 그대로).
// 07-11: 봇 자유 채팅으로 discussion·night 의 호출 순서가 바뀌어 시드 고정 값을 다시 고정했다(옛 투표·defense 의 호출 수는 그대로였다).
// 봇 하나당 순서: discussion = (randInt(첫 지연 폭) → randInt(8)) → (randInt(둘째 지연 폭) → randInt(8)),
// night = (경찰·의사만, 대상이 있으면) randInt(대상 수) → randInt(pick 지연 폭), 마피아면 대상 난수 없이 randInt(pick 지연 폭) → randInt(10) → (< 6 이면) randInt(채팅 지연 폭) → randInt(3),
// 09-02: 마피아 봇 협응(결정 0061-18)으로 마피아의 대상 난수가 없어져 night 호출 순서가 바뀌었고 시드 고정 값을 다시 고정했다.
// defense(후보 봇만) = randInt(문구 수 3) → randInt(지연 폭).
// 테스트 방 방장이 봇 투표를 고정한 경우(RoomState.testBotVote, P-13): 고정 값이면 결정 난수(randInt(100)·randInt(후보 수))를 건너뛰고 지연 난수는 그대로 부른다.
// 고정 설정이 없거나 pick 조건이 안 맞아 무작위로 돌아가면 위 순서와 똑같다.
// 09-12: will(1일차 토론 시작 3초 뒤 유언 한 줄)·approach(마피아 봇이 pick 계획 200ms 뒤 대상 곁으로 걷기)는 난수를 부르지 않는다 — 위 호출 순서와 시드 고정 값은 그대로다(결정 0061-18, 가정 A3).
// 09-24: 채팅 줄마다 그 앞에 입력 중(typing) 단계가 붙는다(at = 줄 시각 − BOT_TYPING_LEAD_MS, 지금보다 앞서지 않음) — 난수를 부르지 않으므로 위 호출 순서와 시드 고정 값은 그대로다.
// 08-07 순서 추가: discussion 은 위 두 줄 뒤에 randInt(토론 끝내기 폭 30000) 한 번이 붙는다(봇당 5번: 폭·문구 수·폭·문구 수·끝내기 폭, 시드 고정 값을 다시 고정했다).
// nomination = (후보가 있으면) randInt(후보 수) → randInt(지목 지연 폭 6000) — 결정 함수(botPointTarget)는 자기를 뺀 산 사람 하나를 고르고 고정 pick(host·other)도 같다(결정 0060-13: pick 은 봇 지목 대상).
// 09.1: 차례가 있는 지목(결정 0063-1)은 차례인 봇 하나만 randInt(후보 수) 한 번(지연 난수 없음) — 차례가 아닌 봇·모이는 중·확정 뒤 사이·끝 알림에는 계획과 난수가 없다.
// verdict(변론자가 아닌 산 봇만) = randInt(100) → randInt(찬반 지연 폭 5000) — 결정 함수(botExecAgree)는 찬성 확률 EXEC_YES_PERCENT 이고 고정 exec(yes·no)도 같다(exec 는 봇 찬반).
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

/** 찬반: 찬성 확률(%). 테스트 방에서 처형 경로가 자주 열리게 높인 바뀔 수 있는 기본값(결정 0036). */
export const EXEC_YES_PERCENT = 70;
/** 토론 끝내기: now + 30000 + [0, 30000) ms 에 켜짐 한 번(결정 0060-2). 마감 − 500 보다 늦은 행동은 계획에서 버려지므로 토론이 길수록 더 많은 봇이 누른다. */
const END_DISCUSSION_BASE_MS = 30_000;
const END_DISCUSSION_SPAN_MS = 30_000;
/** 지목 지연: 2000 + [0, 6000) ms (단계 15초 안, 결정 0060-13). */
const POINT_BASE_MS = 2_000;
const POINT_SPAN_MS = 6_000;
/** 찬반 지연: 1000 + [0, 5000) ms (단계 10초 안, 결정 0060-13). */
const VERDICT_BASE_MS = 1_000;
const VERDICT_SPAN_MS = 5_000;
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

/** 1일차 토론에서 봇이 남기는 유언 문장(3개, 역할 단어 없음). 봇 seat % 길이 번째 줄을 쓴다 — 난수 없음. sanitizeChatText 를 그대로 통과하며 자소 100 이하다(결정 0061-18). */
export const BOT_WILL_LINES: readonly string[] = ["다들 끝까지 힘내요", "저는 믿어 주세요", "좋은 판이었어요"];
/** 1일차 토론 시작 이만큼 뒤에 산 봇이 유언을 쓴다(ms). */
export const BOT_WILL_AT_MS = 3_000;
/** 밤에 마피아 봇이 pick 계획 이만큼 뒤에 대상 곁으로 걷는다(ms). */
export const BOT_APPROACH_AFTER_MS = 200;
/** 봇은 채팅 한 줄을 보내기 이만큼 전에 입력 중 신호를 켠다(ms, 09-24). 서버 typingRelay 의 켜짐 간격(1500ms)과 같다 — 같은 봇의 두 줄 사이(8000ms 이상)에는 항상 새로 중계된다. */
export const BOT_TYPING_LEAD_MS = 1_500;

/** 봇 행동 한 가지 — 사람 ClientMessage 의 같은 칸 이름을 쓴다(chat 은 본문 text 만, 단계 키는 실행할 때 서버 상태에서 만든다). */
export type BotAct =
  | { t: "chat"; text: string }
  | { t: "pick"; target: number }
  // 8페이즈(결정 0060): 토론 끝내기(켜짐만)·지목·찬반. 사람과 같은 메시지 이름을 쓰고 방 DO 가 같은 apply* 본체로 처리한다.
  | { t: "endDiscussion" }
  | { t: "point"; target: number }
  | { t: "verdict"; agree: boolean }
  // 9페이즈(결정 0061-18): 유언 한 줄(방 DO 의 applyWill 본체)·마피아 다가가기(applyMove 본체, 대상 seat 은 계획 시점 값이고 실행 시점에 botMafiaTarget 으로 다시 구한다). 둘 다 난수 없음.
  | { t: "will"; text: string }
  | { t: "approach"; target: number }
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

/**
 * 마피아 봇이 밤에 고를 대상 seat(결정 0061-18). 산 마피아 봇이 아니면 undefined.
 * 후보는 산 비마피아 seat 오름차순이다. 다른 산 마피아가 이미 고른 후보가 있으면 그 중 가장 낮은 seat 을 따라가고,
 * 없으면 후보 중 가장 낮은 seat 이다 — 새 규칙(산 마피아 전원 일치만 확정)에서 봇끼리·봇과 사람이 같은 대상으로 모인다.
 * 난수를 부르지 않는다. 마피아 본인이 view 로도 받는 정보(동료 선택·생존·역할 구성)만 쓰고 경찰·의사의 선택은 읽지 않는다(결정 0024-6).
 */
export function botMafiaTarget(state: RoomState, bot: Player): number | undefined {
  if (!isAlive(bot) || bot.role !== "mafia") return undefined;
  const candidates = state.players.filter((p) => isAlive(p) && p.role !== "mafia").map((p) => p.seat);
  if (candidates.length === 0) return undefined;
  const followed = state.players
    .filter((p) => isAlive(p) && p.role === "mafia" && p.id !== bot.id && p.nightPick !== undefined && candidates.includes(p.nightPick))
    .map((p) => p.nightPick!);
  return followed.length > 0 ? Math.min(...followed) : Math.min(...candidates);
}

/**
 * 밤에 이 봇이 고를 대상 seat. 마피아는 botMafiaTarget(난수 없음, 결정 0061-18), 경찰은 살아 있는 다른 사람,
 * 의사는 자신 포함 살아 있는 모두(둘 다 seat 오름차순 후보에서 randInt). 그 밖 역할·탈락한 봇·후보 없음은 undefined(randInt 를 부르지 않는다).
 */
export function botNightTarget(state: RoomState, bot: Player, randInt: RandInt): number | undefined {
  if (!isAlive(bot)) return undefined;
  if (bot.role === "mafia") return botMafiaTarget(state, bot);
  const living = state.players.filter(isAlive).sort(bySeat);
  let candidates: Player[];
  if (bot.role === "police") candidates = living.filter((p) => p.id !== bot.id);
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

/** 봇 계획이 필요한 단계(discussion·nomination·verdict·night·defense)의 키 "단계:마감". 그 밖은 null. */
export function botPlanKey(state: RoomState): string | null {
  const planned: readonly string[] = ["discussion", "nomination", "verdict", "night", "defense"];
  if (!planned.includes(state.phase)) return null;
  return `${state.phase}:${state.phaseEndsAt}`;
}

/** 낮 토론의 한 줄: 고정 문구 목록에서 randInt(8) 번째 줄. */
function discussionText(randInt: RandInt): string {
  return BOT_CHAT_LINES[randInt(BOT_CHAT_LINES.length)]!;
}

/**
 * 순차 지목(09.1, 결정 0063-1): 지금 차례 주인이 이 봇이면 차례가 시작된 그 시각(now)에 지목 한 번.
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
  return [{ at: now, botId: bot.id, act: { t: "point", target } }];
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
  if (state.phase === "discussion") {
    const first = now + DISCUSSION_FIRST_BASE_MS + randInt(DISCUSSION_FIRST_SPAN_MS);
    addChat(first, discussionText(randInt));
    const second = first + DISCUSSION_GAP_BASE_MS + randInt(DISCUSSION_GAP_SPAN_MS);
    addChat(second, discussionText(randInt));
    // 토론 끝내기(08-07): 채팅 두 줄 다음 난수 한 번. 사람과 같은 toggleEnd 를 지난다.
    add(now + END_DISCUSSION_BASE_MS + randInt(END_DISCUSSION_SPAN_MS), { t: "endDiscussion" });
    // 유언(09-12): 1일차에만 한 번, 고정 문장, 난수 없음 — 위 난수 호출 순서가 그대로다.
    if ((state.day ?? 1) === 1) add(now + BOT_WILL_AT_MS, { t: "will", text: BOT_WILL_LINES[bot.seat % BOT_WILL_LINES.length]! });
  } else if (state.phase === "nomination" && state.pickTurn !== undefined) {
    // 차례가 있는 지목(09.1, 결정 0063-1): 자기 차례 시작 즉시 한 번.
    steps.push(...turnPointSteps(state, bot, now, randInt));
  } else if (state.phase === "nomination") {
    // 차례 없는 지목 — 09.1-05 가 지운다. 지목(08-07): 자기를 뺀 산 사람 하나, 고정 pick(host·other)도 같다(결정 0060-13).
    const target = botPointTarget(state, bot, randInt, state.testBotVote?.pick);
    if (target !== undefined) add(now + POINT_BASE_MS + randInt(POINT_SPAN_MS), { t: "point", target });
  } else if (state.phase === "verdict") {
    // 찬반(08-07): 변론자 봇은 던지지 않는다(castVerdict 가 거절한다). 고정 exec(yes·no)도 따른다(결정 0060-13).
    if (state.verdict?.candidate !== bot.seat) {
      const agree = botExecAgree(randInt, state.testBotVote?.exec);
      add(now + VERDICT_BASE_MS + randInt(VERDICT_SPAN_MS), { t: "verdict", agree });
    }
  } else if (state.phase === "night") {
    if (bot.role === "mafia" || bot.role === "police" || bot.role === "doctor") {
      const target = botNightTarget(state, bot, randInt);
      if (target !== undefined) {
        const pickAt = now + NIGHT_PICK_BASE_MS + randInt(NIGHT_PICK_SPAN_MS);
        add(pickAt, { t: "pick", target });
        // 다가가기(09-12): 마피아 봇만, 난수 없이 pick 시각 + 200ms. 대상은 실행 시점에 방 DO 가 botMafiaTarget 으로 다시 구한다.
        if (bot.role === "mafia") add(pickAt + BOT_APPROACH_AFTER_MS, { t: "approach", target });
      }
    }
    if (bot.role === "mafia" && randInt(10) < NIGHT_CHAT_TENTHS) {
      const at = now + NIGHT_CHAT_BASE_MS + randInt(NIGHT_CHAT_SPAN_MS);
      addChat(at, BOT_NIGHT_LINES[randInt(BOT_NIGHT_LINES.length)]!);
    }
  } else if (state.phase === "defense") {
    // 변론은 후보 봇만 한다(서버는 산 사람 누구의 변론 채팅도 받지만 봇은 후보만 말한다). 후보가 아닌 봇은 아무것도 하지 않는다.
    if (state.verdict?.candidate === bot.seat) {
      const text = BOT_DEFENSE_LINES[randInt(BOT_DEFENSE_LINES.length)]!;
      addChat(now + DEFENSE_SAY_BASE_MS + randInt(DEFENSE_SAY_SPAN_MS), text);
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
    const planned = planFor(state, bot, now, randInt);
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
