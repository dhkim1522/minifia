// 테스트 방 방장 도구 규칙(결정 0022). 순수 모듈이다 — 현재 시각·전역 난수를 읽지 않고, 입력 상태를 바꾸지 않는다.
// 시각 now 와 난수 randInt 는 인자로만 받는다(방 DO 는 Date.now()·cryptoRandInt, 테스트는 고정 값·seededRandInt).
// 검사 순서가 계약이다: testMode 가 아니면 BAD_MESSAGE(일반 방에서는 이 메시지가 있다는 사실도 드러내지 않는다)
// → 방장이 아니면 NOT_HOST → 단계가 맞지 않으면 WRONG_PHASE → (testRole 만) 직업이 구성에 없으면 BAD_MESSAGE
// (testBots 는 대기실 다음에 개수 범위가 틀리면 BAD_MESSAGE, 결정 0024. testBotVote 는 대기실 다음에 값이 범위 밖이면 BAD_MESSAGE, P-13).
// 결정 0017-5(방장 연장·넘기기 제거)와 0020 은 일반 방에서 그대로다. 이 도구는 테스트 방 전용 예외다.
import { validateNickname } from "../nickname";
import { MAX_PLAYERS, MAX_TEST_BOTS } from "../protocol";
import type { BotVoteExec, BotVotePick } from "../protocol";
import { isAlive } from "./alive";
import { BOT_NAMES, botCandidateTarget, botCount, botExecAgree, botNightTarget, isBot } from "./bots";
import { testRoleOptions } from "./roles";
import type { RoleId } from "./roles";
import { pickTarget } from "./night";
import { lowestFreeSeat } from "./room";
import type { Player, RoomState } from "./room";
import { tick } from "./tick";
import type { RandInt } from "./tick";
import { castCandidateVote, castExecVote } from "./vote";

export type TestToolError = "BAD_MESSAGE" | "NOT_HOST" | "WRONG_PHASE";
export type TestToolResult = { ok: true; state: RoomState } | { ok: false; error: TestToolError };

/** 공통 검사: testMode 방이어야 하고 요청자가 방장이어야 한다. */
function checkTestHost(state: RoomState, actorId: string): TestToolError | null {
  if (state.testMode !== true) return "BAD_MESSAGE";
  if (actorId !== state.hostId) return "NOT_HOST";
  return null;
}

/**
 * 현재 단계 마감을 지금(now)으로 당긴 뒤 tick 을 돌려 다음 단계로 넘긴다. 진입 훅을 따로 부르지 않는다 —
 * 정상 마감과 같은 경로(tick 의 ON_ENTER, 결정 0016)라 밤 판정·아침 문구·일차 증가가 그대로 일어난다.
 * 새 마감은 "당긴 마감(now) + 다음 단계 길이" 라 정확히 한 단계만 넘어간다. 대기실·종료(마감 없음)는 WRONG_PHASE.
 * 밤과 두 투표 단계(execVote·candidateVote)는 넘기기 직전에 아직 안 던진 살아 있는 봇이 먼저 던진다 — 그렇지 않으면 봇 표 없이 마감되어
 * 테스트 방 한 판이 처형에 닿지 못한다. 그 뒤 단계는 마감 훅의 분기 결과(통과 여부·후보·승패)를 그대로 따른다(결정 0022).
 */
export function skipPhase(state: RoomState, actorId: string, now: number, randInt: RandInt): TestToolResult {
  const denied = checkTestHost(state, actorId);
  if (denied !== null) return { ok: false, error: denied };
  if (state.phase === "lobby" || state.phaseEndsAt === null) return { ok: false, error: "WRONG_PHASE" };
  const ready =
    state.phase === "night" ? botsPickNow(state, randInt) : state.phase === "execVote" || state.phase === "candidateVote" ? botsVoteNow(state, randInt) : state;
  return { ok: true, state: tick({ ...ready, phaseEndsAt: now }, now, randInt) };
}

/**
 * 밤을 당겨 끝내면 봇이 알람으로 지목하기 전에 판정이 나 마피아가 아무도 지목하지 않은 밤이 된다.
 * 그래서 아직 고르지 않은 살아 있는 봇(마피아·경찰·의사)이 지금 바로 한 번 고른다 — 사람의 선택은 건드리지 않는다.
 * 같은 순수 규칙(botNightTarget·pickTarget)이라 정상 마감과 같은 판정 경로를 탄다.
 */
function botsPickNow(state: RoomState, randInt: RandInt): RoomState {
  let next = state;
  for (const bot of state.players.filter((p) => isBot(p) && isAlive(p) && p.nightPick === undefined).sort((a, b) => a.seat - b.seat)) {
    const target = botNightTarget(next, bot, randInt);
    if (target === undefined) continue;
    const picked = pickTarget(next, bot.id, target);
    if (picked.ok) next = picked.state;
  }
  return next;
}

/**
 * 투표 단계를 당겨 끝내기 전에 아직 안 던진 살아 있는 봇이 지금 한 번 던진다 — 사람의 표는 건드리지 않고 이미 던진 봇도 다시 던지지 않는다.
 * 계획(planFor)과 같은 결정 함수(botExecAgree·botCandidateTarget)와 사람과 같은 본체(castExecVote·castCandidateVote)를 쓰되 지연 난수는 부르지 않는다.
 * 봇은 seat 오름차순으로 하나당 execVote = randInt(100), candidateVote = randInt(후보 수) 를 부른다. 후보 선택 대상이 없으면 건너뛴다.
 */
function botsVoteNow(state: RoomState, randInt: RandInt): RoomState {
  let next = state;
  const bots = state.players.filter((p) => isBot(p) && isAlive(p)).sort((a, b) => a.seat - b.seat);
  for (const bot of bots) {
    if (state.phase === "execVote") {
      if (bot.execVote !== undefined) continue;
      const cast = castExecVote(next, bot.id, botExecAgree(randInt, state.testBotVote?.exec));
      if (cast.ok) next = cast.state;
    } else {
      if (bot.candidateVote !== undefined) continue;
      const target = botCandidateTarget(next, bot, randInt, state.testBotVote?.pick);
      if (target === undefined) continue;
      const cast = castCandidateVote(next, bot.id, target);
      if (cast.ok) next = cast.state;
    }
  }
  return next;
}

/**
 * 같은 방을 대기실로 되돌린다: 허용 목록 리터럴로 방·플레이어를 다시 만든다 — 상태를 펼쳐 복사하지 않아
 * 역할·주장·밤 선택·수사 기록·탈락·일차·아침 결과·투표·처형·종료 필드(voteLog·verdict·execution·lastExecPhrase·nightLog·winner, execVote·candidateVote)와 앞으로 늘어날 게임 필드도 자동으로 빠진다.
 * 남기는 것: 방 식별·수명·방장·가입 순번·앉은 사람(자리·닉네임·연결)·testMode·testRole·testBotVote.
 */
export function resetToLobby(state: RoomState, actorId: string): TestToolResult {
  const denied = checkTestHost(state, actorId);
  if (denied !== null) return { ok: false, error: denied };
  if (state.phase === "lobby") return { ok: false, error: "WRONG_PHASE" };
  const players: Player[] = state.players.map((p) => ({
    id: p.id,
    token: p.token,
    seat: p.seat,
    nickname: p.nickname,
    nicknameKey: p.nicknameKey,
    joinSeq: p.joinSeq,
    connected: p.connected,
    connId: p.connId,
    // 서버 봇은 대기실로 되돌려도 남는다(결정 0024). 사람은 지금처럼 여덟 키 그대로다.
    ...(p.isBot === true ? { isBot: true as const } : {}),
  }));
  const next: RoomState = {
    code: state.code,
    createdAt: state.createdAt,
    expiresAt: state.expiresAt,
    ...(state.everConnected !== undefined ? { everConnected: state.everConnected } : {}),
    phase: "lobby",
    phaseEndsAt: null,
    hostId: state.hostId,
    nextJoinSeq: state.nextJoinSeq,
    players,
    testMode: true,
    ...(state.testRole !== undefined ? { testRole: state.testRole } : {}),
    // 봇 투표 설정도 testRole 처럼 남는다(P-13) — 같은 방의 다음 판에서도 봇이 같은 규칙으로 던진다.
    ...(state.testBotVote !== undefined ? { testBotVote: state.testBotVote } : {}),
  };
  return { ok: true, state: next };
}

/**
 * 다음 판의 방장 직업을 고른다(null = 무작위). 대기실에서만, 지금 앉은 인원 구성에 있는 직업만 받는다.
 * 같은 값이면 입력 상태를 그대로 돌려준다(저장·전송을 건너뛰는 근거).
 */
export function setTestRole(state: RoomState, actorId: string, role: RoleId | null): TestToolResult {
  const denied = checkTestHost(state, actorId);
  if (denied !== null) return { ok: false, error: denied };
  if (state.phase !== "lobby") return { ok: false, error: "WRONG_PHASE" };
  if (role !== null && !testRoleOptions(state.players.length).includes(role)) {
    return { ok: false, error: "BAD_MESSAGE" };
  }
  if ((role ?? undefined) === state.testRole) return { ok: true, state };
  if (role === null) {
    const { testRole: _cleared, ...rest } = state;
    return { ok: true, state: rest };
  }
  return { ok: true, state: { ...state, testRole: role } };
}

/**
 * 테스트 방 서버 봇 수를 count(원하는 봇 수, 절대값)로 맞춘다(결정 0024). 대기실에서만, 사람 + 봇 <= MAX_PLAYERS 로 잘라 정확히 그만큼 둔다.
 * 더할 때는 가장 낮은 빈 자리에 BOT_NAMES 중 방에 같은 비교 키가 없는 첫 이름으로 앉히고, 뺄 때는 가장 높은 자리 봇부터 뺀다. 사람은 손대지 않는다.
 * 사람이 봇 이름을 쓰고 있어 쓸 수 있는 이름이 모자라면 그 수까지만 둔다. 잘린 결과가 지금과 같으면 입력 상태를 그대로 돌려준다.
 * 봇은 토큰이 없고(빈 문자열) 소켓이 없으며 connected 가 항상 true 다 — makeId 는 호출하는 쪽(방 DO 는 crypto.randomUUID)이 준다.
 */
export function setBotCount(state: RoomState, actorId: string, count: number, makeId: () => string): TestToolResult {
  const denied = checkTestHost(state, actorId);
  if (denied !== null) return { ok: false, error: denied };
  if (state.phase !== "lobby") return { ok: false, error: "WRONG_PHASE" };
  if (!Number.isInteger(count) || count < 0 || count > MAX_TEST_BOTS) return { ok: false, error: "BAD_MESSAGE" };

  const humans = state.players.filter((p) => !isBot(p)).length;
  const current = botCount(state);
  const usedKeys = new Set(state.players.map((p) => p.nicknameKey));
  const freeNames = BOT_NAMES.filter((name) => {
    const checked = validateNickname(name);
    return checked.ok && !usedKeys.has(checked.key);
  }).length;
  const target = Math.min(count, MAX_PLAYERS - humans, current + freeNames);
  if (target === current) return { ok: true, state };

  if (target < current) {
    const removed = new Set(
      state.players
        .filter(isBot)
        .sort((a, b) => a.seat - b.seat)
        .slice(target)
        .map((p) => p.id),
    );
    return { ok: true, state: { ...state, players: state.players.filter((p) => !removed.has(p.id)) } };
  }

  let players = state.players;
  let nextJoinSeq = state.nextJoinSeq;
  for (let added = current; added < target; added += 1) {
    const keys = new Set(players.map((p) => p.nicknameKey));
    let nickname: { nickname: string; key: string } | null = null;
    for (const name of BOT_NAMES) {
      const checked = validateNickname(name);
      if (checked.ok && !keys.has(checked.key)) {
        nickname = { nickname: checked.nickname, key: checked.key };
        break;
      }
    }
    if (nickname === null) break;
    const bot: Player = {
      id: makeId(),
      token: "",
      seat: lowestFreeSeat(players),
      nickname: nickname.nickname,
      nicknameKey: nickname.key,
      joinSeq: nextJoinSeq,
      connected: true,
      connId: null,
      isBot: true,
    };
    nextJoinSeq += 1;
    players = [...players, bot];
  }
  return { ok: true, state: { ...state, nextJoinSeq, players } };
}

const BOT_VOTE_EXECS: readonly BotVoteExec[] = ["random", "yes", "no"];
const BOT_VOTE_PICKS: readonly BotVotePick[] = ["random", "host", "other"];

/**
 * 테스트 방 봇의 투표 규칙을 정한다(P-13, 결정 0022·0024 확장): exec 는 모든 봇의 처형 여부 표(random = 기존 70% 찬성), pick 은 모든 봇의 후보 선택
 * (host = 방장, other = 방장도 자기도 아닌 살아 있는 사람 중 가장 낮은 seat, 조건이 안 맞으면 무작위). 두 값을 함께 절대값으로 받는다 — 연타해도 같은 요청이다.
 * 대기실에서만. 무작위가 아닌 값만 저장하고(둘 다 random 이면 키를 지운다), 지금과 같으면 입력 상태를 그대로 돌려준다.
 */
export function setBotVote(state: RoomState, actorId: string, exec: BotVoteExec, pick: BotVotePick): TestToolResult {
  const denied = checkTestHost(state, actorId);
  if (denied !== null) return { ok: false, error: denied };
  if (state.phase !== "lobby") return { ok: false, error: "WRONG_PHASE" };
  if (!BOT_VOTE_EXECS.includes(exec) || !BOT_VOTE_PICKS.includes(pick)) return { ok: false, error: "BAD_MESSAGE" };
  const wantExec = exec === "random" ? undefined : exec;
  const wantPick = pick === "random" ? undefined : pick;
  if (wantExec === state.testBotVote?.exec && wantPick === state.testBotVote?.pick) return { ok: true, state };
  if (wantExec === undefined && wantPick === undefined) {
    const { testBotVote: _cleared, ...rest } = state;
    return { ok: true, state: rest };
  }
  return {
    ok: true,
    state: {
      ...state,
      testBotVote: { ...(wantExec !== undefined ? { exec: wantExec } : {}), ...(wantPick !== undefined ? { pick: wantPick } : {}) },
    },
  };
}
