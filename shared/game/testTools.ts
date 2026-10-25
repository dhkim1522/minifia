// 테스트 방 방장 도구 규칙(결정 0022). 순수 모듈이다 — 현재 시각·전역 난수를 읽지 않고, 입력 상태를 바꾸지 않는다.
// 시각 now 와 난수 randInt 는 인자로만 받는다(방 DO 는 Date.now()·cryptoRandInt, 테스트는 고정 값·seededRandInt).
// 검사 순서가 계약이다: testMode 가 아니면 BAD_MESSAGE(일반 방에서는 이 메시지가 있다는 사실도 드러내지 않는다)
// → 방장이 아니면 NOT_HOST → 단계가 맞지 않으면 WRONG_PHASE → (testRole 만) 직업이 구성에 없으면 BAD_MESSAGE
// (testBots 는 대기실 다음에 개수 범위가 틀리면 BAD_MESSAGE, 결정 0024).
// 결정 0017-5(방장 연장·넘기기 제거)와 0020 은 일반 방에서 그대로다. 이 도구는 테스트 방 전용 예외다.
import { validateNickname } from "../nickname";
import { MAX_PLAYERS, MAX_TEST_BOTS } from "../protocol";
import { BOT_NAMES, botCount, isBot } from "./bots";
import { testRoleOptions } from "./roles";
import type { RoleId } from "./roles";
import { lowestFreeSeat } from "./room";
import type { Player, RoomState } from "./room";
import { tick } from "./tick";
import type { RandInt } from "./tick";

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
 * 새 마감은 "당긴 마감(now) + 다음 단계 길이" 라 정확히 한 단계만 넘어간다. 대기실(마감 없음)은 WRONG_PHASE.
 */
export function skipPhase(state: RoomState, actorId: string, now: number, randInt: RandInt): TestToolResult {
  const denied = checkTestHost(state, actorId);
  if (denied !== null) return { ok: false, error: denied };
  if (state.phase === "lobby" || state.phaseEndsAt === null) return { ok: false, error: "WRONG_PHASE" };
  return { ok: true, state: tick({ ...state, phaseEndsAt: now }, now, randInt) };
}

/**
 * 같은 방을 대기실로 되돌린다: 허용 목록 리터럴로 방·플레이어를 다시 만든다 — 상태를 펼쳐 복사하지 않아
 * 역할·주장·밤 선택·수사 기록·탈락·일차·아침 결과와 앞으로 늘어날 게임 필드도 자동으로 빠진다.
 * 남기는 것: 방 식별·수명·방장·가입 순번·앉은 사람(자리·닉네임·연결)·testMode·testRole·방 수명 동안 줄지 않는 nextMessageSeq.
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
    ...(state.nextMessageSeq !== undefined ? { nextMessageSeq: state.nextMessageSeq } : {}),
    hostId: state.hostId,
    nextJoinSeq: state.nextJoinSeq,
    players,
    testMode: true,
    ...(state.testRole !== undefined ? { testRole: state.testRole } : {}),
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
