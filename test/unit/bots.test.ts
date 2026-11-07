// 테스트 방 서버 봇 규칙(quick 261025-fx1, 결정 0024): setBotCount·bots.ts 순수 규칙을 확인한다.
// 실패 출력은 한 줄이어야 해서(TAP) 상태 비교는 키 순서를 맞춘 문자열로, 목록 비교는 요약 문자열로 한다.
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { countGraphemes, nicknameKey, validateNickname } from "../../shared/nickname";
import {
  BOT_CHAT_LINES,
  BOT_DEFENSE_LINES,
  BOT_NAMES,
  BOT_NIGHT_LINES,
  BOT_TYPING_LEAD_MS,
  BOT_WILL_LINES,
  EXEC_YES_PERCENT,
  RUNOFF_BOT_BASE_MS,
  RUNOFF_BOT_SPAN_MS,
  SHOWDOWN_BOT_POINT_BASE_MS,
  SHOWDOWN_BOT_POINT_SPAN_MS,
  botCount,
  botMafiaTarget,
  botPointTarget,
  botNightTarget,
  botPlanKey,
  botWakeAt,
  isBot,
  planBotSteps,
  syncBotPlan,
  takeDueBotSteps,
} from "../../shared/game/bots";
import type { BotStep } from "../../shared/game/bots";
import { channelOf, phaseKey } from "../../shared/game/audience";
import { checkChatSend, sanitizeChatText } from "../../shared/game/chatRules";
import type { ChatSenderRate } from "../../shared/game/chatRules";
import { pickTarget } from "../../shared/game/night";
import { WILL_MAX_GRAPHEMES } from "../../shared/game/will";
import { ERRAND_MS, PHASE_DEFS } from "../../shared/game/phases";
import { rolesInPlay } from "../../shared/game/roles";
import {
  attachConnection,
  createRoomState,
  findPlayerByToken,
  joinRoom,
  leaveRoom,
  startGame,
} from "../../shared/game/room";
import type { Player, RoomState } from "../../shared/game/room";
import { resetToLobby, setBotCount } from "../../shared/game/testTools";
import { tick } from "../../shared/game/tick";
import { buildPreview, buildView } from "../../shared/game/view";
import { MAX_PLAYERS, MAX_TEST_BOTS } from "../../shared/protocol";
import type { PhaseId } from "../../shared/protocol";
import { seededRandInt } from "../helpers/seededRandom";
import { castPoints, startedFrom, stateWithVerdict } from "../helpers/voteState";
import { toggleEnd } from "../../shared/game/discussion";
import { castPoint, castTurnPoint, enterNomination, nominationStepMs, stepNomination } from "../../shared/game/nomination";
import { RULESET } from "../../shared/game/ruleset";
import { castVerdict } from "../../shared/game/verdict";
import { castRunoffVote, runoffStepMs, stepRunoff } from "../../shared/game/runoff";
import { RUNOFF_VOTE_MS, SHOWDOWN_POINT_MS, SHOWDOWN_TURN_MS } from "../../shared/game/phases";
import { LAST_WORD_CHIPS, acceptLastWord, castShowdownPoint, showdownStepMs, stepShowdown } from "../../shared/game/showdown";

const START_AT = 10_000;
const HOST_ID = "player-id-0000-aaaa";

/** n 명이 모두 연결된 대기실. testMode 가 true 면 테스트 방이다. */
function lobbyOf(n: number, testMode = true): RoomState {
  const created = createRoomState({
    code: "0420",
    hostId: HOST_ID,
    hostToken: "token-secret-0000-aaaa-0123456789",
    hostNickname: "이름0",
    now: 0,
    ...(testMode ? { testMode: true } : {}),
  });
  if (!created.ok) throw new Error("createRoomState failed");
  let state = attachConnection(created.state, HOST_ID, "conn-0");
  for (let i = 1; i < n; i += 1) {
    const id = `player-id-000${i}-aaaa`;
    const joined = joinRoom(state, { playerId: id, token: `token-secret-000${i}-aaaa-0123456789`, nickname: `이름${i}` });
    if (!joined.ok) throw new Error(`joinRoom failed: ${joined.error}`);
    state = attachConnection(joined.state, id, `conn-${i}`);
  }
  return state;
}

/** 봇 id 를 차례로 만드는 makeId. */
function idMaker(): () => string {
  let n = 0;
  return () => {
    n += 1;
    return `bot-id-${n}-bbbbbbbb`;
  };
}

function withBots(state: RoomState, count: number): RoomState {
  const result = setBotCount(state, state.hostId, count, idMaker(), seededRandInt(1));
  if (!result.ok) throw new Error(`setBotCount failed: ${result.error}`);
  return result.state;
}

/** 사람 humans 명 + 봇 bots 명으로 시작해 tick 으로 phase 에 닿은 상태. */
function stateAt(humans: number, bots: number, seed: number, phase: PhaseId): RoomState {
  const lobby = withBots(lobbyOf(humans), bots);
  const started = startGame(lobby, lobby.hostId, START_AT, seededRandInt(seed));
  if (!started.ok) throw new Error(`startGame failed: ${started.error}`);
  let state = started.state;
  while (state.phase !== phase) {
    if (state.phaseEndsAt === null) throw new Error("phase has no deadline");
    state = tick(state, state.phaseEndsAt, seededRandInt(seed + 1));
  }
  return state;
}

function canon(value: unknown): string {
  return JSON.stringify(value, (_key, v: unknown) =>
    v !== null && typeof v === "object" && !Array.isArray(v)
      ? Object.fromEntries(Object.entries(v as Record<string, unknown>).sort(([a], [b]) => (a < b ? -1 : 1)))
      : v,
  );
}

const THROWING = (): number => {
  throw new Error("randInt must not be called");
};
const sortedKeys = (o: object): string => Object.keys(o).sort().join(",");
const botsOf = (s: RoomState): Player[] => s.players.filter(isBot).sort((a, b) => a.seat - b.seat);
const humansOf = (s: RoomState): Player[] => s.players.filter((p) => !isBot(p));
const seatsOf = (ps: readonly Player[]): string => ps.map((p) => p.seat).join(",");
const markDead = (s: RoomState, ...seats: number[]): RoomState => ({
  ...s,
  players: s.players.map((p) => (seats.includes(p.seat) ? { ...p, alive: false } : p)),
});
/** 봇 계획 키: 단계:마감. */
const planKeyOf = (st: RoomState): string => `${st.phase}:${st.phaseEndsAt}`;

describe("BOT_NAMES", () => {
  it("일곱 이름이 모두 닉네임 규칙을 통과하고 정확히 8 그래핌이며 비교 키가 서로 다르다 (결정 0052-3)", () => {
    expect(BOT_NAMES.length).toBe(7);
    const keys = new Set<string>();
    for (const name of BOT_NAMES) {
      const checked = validateNickname(name);
      expect(`${name}:${checked.ok}`).toBe(`${name}:true`);
      expect(`${name}:${countGraphemes(name)}`).toBe(`${name}:8`);
      keys.add(nicknameKey(name));
    }
    expect(keys.size).toBe(7);
  });

  it("scripts/bots.mjs 의 NAMES 가 BOT_NAMES 와 같은 순서·같은 값이다", () => {
    const literalOf = (file: string, constName: string): string[] => {
      const text = readFileSync(resolve(__dirname, "../../scripts", file), "utf8");
      const m = text.match(new RegExp(`const ${constName} = (\\[[^\\]]*\\]);`));
      expect(`${file}:${m !== null}`).toBe(`${file}:true`);
      return JSON.parse(m![1]) as string[];
    };
    expect(literalOf("bots.mjs", "NAMES")).toEqual([...BOT_NAMES]);
  });
});

describe("setBotCount 거부", () => {
  it("일반 방은 방장이어도 BAD_MESSAGE 다", () => {
    const state = lobbyOf(2, false);
    const result = setBotCount(state, HOST_ID, 3, idMaker(), seededRandInt(1));
    expect(result.ok ? "ok" : result.error).toBe("BAD_MESSAGE");
  });
  it("테스트 방 손님은 NOT_HOST 다", () => {
    const state = lobbyOf(2);
    const result = setBotCount(state, "player-id-0001-aaaa", 3, idMaker(), seededRandInt(1));
    expect(result.ok ? "ok" : result.error).toBe("NOT_HOST");
  });
  it("대기실 밖은 WRONG_PHASE 다", () => {
    const state = stateAt(4, 0, 1, "roleReveal");
    const result = setBotCount(state, HOST_ID, 1, idMaker(), seededRandInt(1));
    expect(result.ok ? "ok" : result.error).toBe("WRONG_PHASE");
  });
  it("count -1·8·1.5 는 BAD_MESSAGE 다", () => {
    for (const count of [-1, MAX_TEST_BOTS + 1, 1.5, Number.NaN]) {
      const result = setBotCount(lobbyOf(1), HOST_ID, count, idMaker(), seededRandInt(1));
      expect(`${count}:${result.ok ? "ok" : result.error}`).toBe(`${count}:BAD_MESSAGE`);
    }
  });
  it("검사 순서는 testMode → 방장 → 대기실 → 개수다", () => {
    const normal = lobbyOf(2, false);
    expect(canon(setBotCount(normal, "player-id-0001-aaaa", -1, idMaker(), seededRandInt(1)))).toBe('{"error":"BAD_MESSAGE","ok":false}');
    const started = stateAt(4, 0, 1, "roleReveal");
    const guestId = "player-id-0001-aaaa";
    expect(canon(setBotCount(started, guestId, -1, idMaker(), seededRandInt(1)))).toBe('{"error":"NOT_HOST","ok":false}');
    expect(canon(setBotCount(started, HOST_ID, -1, idMaker(), seededRandInt(1)))).toBe('{"error":"WRONG_PHASE","ok":false}');
  });
  it("거부는 입력 상태를 바꾸지 않는다", () => {
    const state = withBots(lobbyOf(2), 2);
    const before = canon(state);
    setBotCount(state, "player-id-0001-aaaa", 3, idMaker(), seededRandInt(1));
    setBotCount(state, HOST_ID, 8, idMaker(), seededRandInt(1));
    setBotCount(lobbyOf(2, false), HOST_ID, 3, idMaker(), seededRandInt(1));
    expect(canon(state)).toBe(before);
  });
});

describe("setBotCount 추가·제거", () => {
  it("방장 혼자 count 4 면 인원 5, 봇 넷이 seat 1~4·고정 이름·고정 모양으로 앉고 사람은 그대로다", () => {
    const lobby = lobbyOf(1);
    const before = canon(lobby.players[0]);
    const next = withBots(lobby, 4);
    expect(next.players.length).toBe(5);
    const bots = botsOf(next);
    expect(seatsOf(bots)).toBe("1,2,3,4");
    // 09-24: 첫 봇은 8자 그대로, 나머지는 쓸 수 있는 기본 이름의 앞부분(1~8자, feedback-10)
    expect(bots[0]!.nickname).toBe(BOT_NAMES[0]);
    expect(bots.slice(1).every((b) => BOT_NAMES.some((name) => name.startsWith(b.nickname)))).toBe(true);
    expect(bots.every((b) => b.isBot === true && b.connected && b.connId === null && b.token === "")).toBe(true);
    expect(bots.map((b) => b.id).join(",")).toBe([1, 2, 3, 4].map((n) => `bot-id-${n}-bbbbbbbb`).join(","));
    expect(bots.map((b) => b.joinSeq).join(",")).toBe(
      [0, 1, 2, 3].map((i) => lobby.nextJoinSeq + i).join(","),
    );
    expect(next.nextJoinSeq).toBe(lobby.nextJoinSeq + 4);
    expect(canon(next.players.find((p) => p.id === HOST_ID))).toBe(before);
  });

  it("봇 이름 길이는 1~8 그래핌 무작위다: 모두 닉네임 규칙을 통과하고 비교 키가 겹치지 않으며 첫 봇만 8자 고정이다 (09-24, feedback-10)", () => {
    for (let seed = 1; seed <= 30; seed += 1) {
      const result = setBotCount(lobbyOf(1), HOST_ID, 7, idMaker(), seededRandInt(seed));
      if (!result.ok) throw new Error(`seed ${seed}: ${result.error}`);
      const bots = botsOf(result.state);
      expect(`${seed}:${bots.length}`).toBe(`${seed}:7`);
      expect(`${seed}:${countGraphemes(bots[0]!.nickname)}`).toBe(`${seed}:8`);
      for (const b of bots) {
        const checked = validateNickname(b.nickname);
        expect(`${seed}:${b.nickname}:${checked.ok}`).toBe(`${seed}:${b.nickname}:true`);
        const len = countGraphemes(b.nickname);
        expect(`${seed}:${b.nickname}:${len >= 1 && len <= 8}`).toBe(`${seed}:${b.nickname}:true`);
        expect(`${seed}:${b.nickname}:${b.nicknameKey}`).toBe(`${seed}:${b.nickname}:${nicknameKey(b.nickname)}`);
      }
      const keys = result.state.players.map((p) => p.nicknameKey);
      expect(`${seed}:${new Set(keys).size}`).toBe(`${seed}:${keys.length}`);
    }
  });

  it("같은 시드는 같은 이름 목록을 만들고(고정 값) 일곱 봇에서 길이가 세 가지 이상 나온다", () => {
    const names = (seed: number): string[] => {
      const r = setBotCount(lobbyOf(1), HOST_ID, 7, idMaker(), seededRandInt(seed));
      if (!r.ok) throw new Error(r.error);
      return botsOf(r.state).map((b) => b.nickname);
    };
    expect(names(42).join(",")).toBe(names(42).join(","));
    expect(names(42).join(",")).toBe("봇가나다라마바사,봇아자차카,봇아자차,봇아자차카타파,봇아자차카타,봇아,봇아자차카타파하");
    expect(new Set(names(42).map((n) => countGraphemes(n))).size >= 3).toBe(true);
  });

  it("앞부분 이름이 이미 방에 있으면 길이를 늘려 겹치지 않는 가장 짧은 이름을 쓴다 (길이 1 '봇' 이 있으면 '봇' + 한 글자)", () => {
    const created = createRoomState({
      code: "0420", hostId: HOST_ID, hostToken: "token-secret-0000-aaaa-0123456789", hostNickname: "봇", now: 0, testMode: true,
    });
    if (!created.ok) throw new Error("createRoomState failed");
    // randInt 가 항상 0 이면 둘째 봇부터 길이 1 을 원한다. 첫 봇은 8자 그대로다.
    const r = setBotCount(created.state, HOST_ID, 3, idMaker(), () => 0);
    if (!r.ok) throw new Error(r.error);
    const names = botsOf(r.state).map((b) => b.nickname);
    expect(names[0]).toBe(BOT_NAMES[0]);
    // 길이 1 "봇" 은 방장이 쓰고 있어 둘째 봇은 2자, 그 2자도 둘째 봇이 쓰니 셋째 봇은 3자가 된다
    expect(names.slice(1).map((n) => countGraphemes(n)).join(",")).toBe("2,3");
    const keys = r.state.players.map((p) => p.nicknameKey);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("사람 2명 + count 7 이면 봇 6(총 8)이다", () => {
    const next = withBots(lobbyOf(2), 7);
    expect(next.players.length).toBe(8);
    expect(botCount(next)).toBe(6);
  });

  it("사람 1~8명 × count 0~7 전부 총원 8 이하·seat 중복 없음·사람 수 그대로다", () => {
    for (let humans = 1; humans <= 8; humans += 1) {
      for (let count = 0; count <= MAX_TEST_BOTS; count += 1) {
        const next = withBots(lobbyOf(humans), count);
        const seats = next.players.map((p) => p.seat);
        const label = `${humans}x${count}`;
        expect(`${label}:${next.players.length <= MAX_PLAYERS}`).toBe(`${label}:true`);
        expect(`${label}:${new Set(seats).size === seats.length}`).toBe(`${label}:true`);
        expect(`${label}:${seats.every((s) => s >= 0 && s < MAX_PLAYERS)}`).toBe(`${label}:true`);
        expect(`${label}:${humansOf(next).length}`).toBe(`${label}:${humans}`);
        expect(`${label}:${botCount(next)}`).toBe(`${label}:${Math.min(count, MAX_PLAYERS - humans)}`);
      }
    }
  });

  it("봇 4 에서 count 2 면 seat 가 낮은 둘만 남는다", () => {
    const four = withBots(lobbyOf(1), 4);
    const two = withBots(four, 2);
    expect(seatsOf(botsOf(two))).toBe("1,2");
    expect(humansOf(two).length).toBe(1);
  });

  it("같은 count 재요청은 입력 객체 그대로다", () => {
    const three = withBots(lobbyOf(1), 3);
    const again = setBotCount(three, HOST_ID, 3, idMaker(), seededRandInt(1));
    expect(again.ok && again.state === three).toBe(true);
    const zero = setBotCount(lobbyOf(1), HOST_ID, 0, idMaker(), seededRandInt(1));
    expect(zero.ok && zero.state.players.length === 1).toBe(true);
  });

  it("사람 닉네임이 첫 봇 이름이면 봇은 둘째 이름부터 쓰고 비교 키가 겹치지 않는다", () => {
    const created = createRoomState({
      code: "0420", hostId: HOST_ID, hostToken: "token-secret-0000-aaaa-0123456789", hostNickname: BOT_NAMES[0]!, now: 0, testMode: true,
    });
    if (!created.ok) throw new Error("createRoomState failed");
    const next = withBots(created.state, 2);
    const names = botsOf(next).map((b) => b.nickname);
    expect(names[0]).toBe(BOT_NAMES[1]);
    expect(BOT_NAMES[1]!.startsWith(names[1]!) || BOT_NAMES[2]!.startsWith(names[1]!)).toBe(true);
    const keys = next.players.map((p) => p.nicknameKey);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("사람이 봇 이름을 여럿 쓰면 남은 이름 수까지만 둔다", () => {
    let state = lobbyOf(1);
    state = { ...state, players: state.players.map((p) => ({ ...p, nickname: BOT_NAMES[0]!, nicknameKey: nicknameKey(BOT_NAMES[0]!) })) };
    for (let i = 1; i <= 3; i += 1) {
      const joined = joinRoom(state, { playerId: `player-id-000${i}-aaaa`, token: `token-secret-000${i}-aaaa-0123456789`, nickname: BOT_NAMES[i]! });
      if (!joined.ok) throw new Error("join failed");
      state = joined.state;
    }
    const next = withBots(state, 7);
    expect(botCount(next)).toBe(3);
    const keys = next.players.map((p) => p.nicknameKey);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("사람이 seat 2 에 있고 1 이 비어 있으면 첫 봇은 seat 1 이다", () => {
    const three = lobbyOf(3);
    const left = leaveRoom(three, "player-id-0001-aaaa");
    if (!left.ok || left.state === null) throw new Error("leaveRoom failed");
    expect(seatsOf(left.state.players)).toBe("0,2");
    const next = withBots(left.state, 1);
    expect(botsOf(next)[0]!.seat).toBe(1);
  });
});

describe("방 규칙과 봇", () => {
  it("findPlayerByToken 은 빈 문자열로 봇을 찾지 못한다", () => {
    const state = withBots(lobbyOf(1), 3);
    expect(String(findPlayerByToken(state, ""))).toBe("undefined");
  });

  it("방장이 나가면 봇 joinSeq 가 더 작아도 사람 손님이 방장이 된다", () => {
    const state = withBots(lobbyOf(2), 2);
    // 봇 joinSeq 를 사람 손님보다 작게 만든다.
    const tweaked: RoomState = { ...state, players: state.players.map((p) => (isBot(p) ? { ...p, joinSeq: -1 - p.seat } : p)) };
    const left = leaveRoom(tweaked, HOST_ID);
    if (!left.ok || left.state === null) throw new Error("leaveRoom failed");
    expect(left.state.hostId).toBe("player-id-0001-aaaa");
  });

  it("방장이 나가고 봇만 남으면 방이 지워진다(state null)", () => {
    const state = withBots(lobbyOf(1), 3);
    const left = leaveRoom(state, HOST_ID);
    expect(left.ok && left.state === null).toBe(true);
  });

  it("방장 혼자 + 봇 3 으로 시작할 수 있고 봇도 역할을 받는다", () => {
    const state = withBots(lobbyOf(1), 3);
    const started = startGame(state, state.hostId, START_AT, seededRandInt(3));
    expect(started.ok ? "ok" : started.error).toBe("ok");
    if (!started.ok) return;
    expect(started.state.players.every((p) => p.role !== undefined)).toBe(true);
  });

  it("resetToLobby 는 봇을 남기고(키 아홉 개) 사람은 여덟 키 그대로며 botPlan 이 없다", () => {
    const game = stateAt(2, 3, 5, "discussion");
    const planned = syncBotPlan(game, 1000, seededRandInt(1));
    expect(Object.hasOwn(planned, "botPlan")).toBe(true);
    const result = resetToLobby(planned, HOST_ID);
    if (!result.ok) throw new Error(`resetToLobby failed: ${result.error}`);
    expect(Object.hasOwn(result.state, "botPlan")).toBe(false);
    expect(botCount(result.state)).toBe(3);
    for (const p of result.state.players) {
      expect(`${p.seat}:${sortedKeys(p)}`).toBe(
        `${p.seat}:${isBot(p) ? "connId,connected,id,isBot,joinSeq,nickname,nicknameKey,seat,token" : "connId,connected,id,joinSeq,nickname,nicknameKey,seat,token"}`,
      );
    }
  });
});

describe("buildView 와 봇", () => {
  const guestId = "player-id-0001-aaaa";

  it("테스트 방 방장 대기실 view 의 me.testBots 는 봇 수(0 포함)다", () => {
    expect(String(buildView(lobbyOf(2), HOST_ID, 0).me.testBots)).toBe("0");
    expect(String(buildView(withBots(lobbyOf(2), 3), HOST_ID, 0).me.testBots)).toBe("3");
  });

  it("roleReveal 방장 view·손님 view·일반 방 방장 view 에는 testBots 키가 없다", () => {
    const game = stateAt(2, 3, 2, "roleReveal");
    expect(Object.hasOwn(buildView(game, HOST_ID, 0).me, "testBots")).toBe(false);
    const lobby = withBots(lobbyOf(2), 3);
    expect(Object.hasOwn(buildView(lobby, guestId, 0).me, "testBots")).toBe(false);
    const normal = lobbyOf(2, false);
    expect(Object.hasOwn(buildView(normal, HOST_ID, 0).me, "testBots")).toBe(false);
  });

  it("손님 view JSON 에 isBot·botPlan·봇 id·token 이 없고 players 항목 키는 다섯이며 봇 자리는 connected true 다", () => {
    const game = syncBotPlan(stateAt(2, 3, 7, "discussion"), 1000, seededRandInt(1));
    const text = JSON.stringify(buildView(game, guestId, 0));
    expect(text.includes("isBot") || text.includes("botPlan") || text.includes("token")).toBe(false);
    for (const bot of botsOf(game)) expect(text.includes(bot.id)).toBe(false);
    const view = buildView(game, guestId, 0);
    for (const p of view.players) expect(sortedKeys(p)).toBe("alive,connected,isHost,nickname,seat");
    for (const bot of botsOf(game)) expect(view.players.find((p) => p.seat === bot.seat)!.connected).toBe(true);
  });

  it("buildPreview 에도 isBot 이 없다", () => {
    const text = JSON.stringify(buildPreview(withBots(lobbyOf(2), 3)));
    expect(text.includes("isBot") || text.includes("botPlan")).toBe(false);
  });
});

describe("botNightTarget", () => {
  it("마피아 봇 대상은 살아 있고 마피아가 아니다(6·8명판 seed 1~50)", () => {
    for (const total of [6, 8]) {
      for (let seed = 1; seed <= 50; seed += 1) {
        const state = markDead(stateAt(1, total - 1, seed, "night"), 3);
        for (const bot of botsOf(state).filter((b) => b.role === "mafia" && b.alive !== false)) {
          const seat = botNightTarget(state, bot, seededRandInt(seed));
          const target = state.players.find((p) => p.seat === seat);
          const label = `${total}/${seed}`;
          expect(`${label}:${target !== undefined && target.alive !== false && target.role !== "mafia"}`).toBe(`${label}:true`);
        }
      }
    }
  });

  it("경찰 봇 대상은 자신이 아니고 살아 있다", () => {
    for (let seed = 1; seed <= 50; seed += 1) {
      const state = markDead(stateAt(1, 5, seed, "night"), 2);
      for (const bot of botsOf(state).filter((b) => b.role === "police" && b.alive !== false)) {
        const seat = botNightTarget(state, bot, seededRandInt(seed));
        const target = state.players.find((p) => p.seat === seat);
        expect(`${seed}:${target !== undefined && target.seat !== bot.seat && target.alive !== false}`).toBe(`${seed}:true`);
      }
    }
  });

  it("의사 봇은 자신을 고르는 시드가 하나 이상 있고 탈락자는 대상이 아니다", () => {
    let self = 0;
    for (let seed = 1; seed <= 50; seed += 1) {
      const state = markDead(stateAt(1, 5, seed, "night"), 1);
      for (const bot of botsOf(state).filter((b) => b.role === "doctor" && b.alive !== false)) {
        const seat = botNightTarget(state, bot, seededRandInt(seed));
        const target = state.players.find((p) => p.seat === seat);
        expect(`${seed}:${target !== undefined && target.alive !== false}`).toBe(`${seed}:true`);
        if (seat === bot.seat) self += 1;
      }
    }
    expect(self >= 1).toBe(true);
  });

  it("시민 봇은 undefined 이고 후보가 없으면 randInt 를 부르지 않는다", () => {
    const state = stateAt(1, 5, 4, "night");
    const citizen = botsOf(state).find((b) => b.role === "citizen");
    if (citizen === undefined) throw new Error("no citizen bot for this seed");
    expect(String(botNightTarget(state, citizen, THROWING))).toBe("undefined");
    // 마피아 후보가 없는 판(모든 비마피아 탈락)
    const mafia = state.players.find((p) => p.role === "mafia")!;
    const alone: RoomState = { ...state, players: state.players.map((p) => (p.role === "mafia" ? p : { ...p, alive: false })) };
    expect(String(botNightTarget(alone, { ...mafia }, THROWING))).toBe("undefined");
  });
});

describe("마피아 봇 협응(결정 0061-18)", () => {
  /** 밤 상태에서 seat 별 역할을 직접 정하고(나머지는 시민) 선택·생존을 덮어쓴다. */
  const arranged = (
    roles: Record<number, "mafia" | "police" | "doctor">,
    over: Record<number, { nightPick?: number; alive?: false }> = {},
  ): RoomState => {
    const base = stateAt(1, 5, 3, "night");
    return {
      ...base,
      players: base.players.map((p) => {
        const { nightPick: _drop, ...rest } = p;
        return { ...rest, role: roles[p.seat] ?? "citizen", ...(over[p.seat] ?? {}) };
      }),
    };
  };
  const bot = (s: RoomState, seat: number): Player => s.players.find((p) => p.seat === seat)!;

  it("아무도 안 골랐으면 가장 낮은 산 비마피아다(마피아 둘 seat 2·4)", () => {
    const s = arranged({ 2: "mafia", 4: "mafia" });
    expect(`${botMafiaTarget(s, bot(s, 2))}/${botMafiaTarget(s, bot(s, 4))}`).toBe("0/0");
  });

  it("동료가 고른 산 비마피아가 있으면 그것을 따라간다", () => {
    const s = arranged({ 2: "mafia", 4: "mafia" }, { 4: { nightPick: 3 } });
    expect(String(botMafiaTarget(s, bot(s, 2)))).toBe("3");
  });

  it("동료 선택이 여럿이면 가장 낮은 seat 이다(마피아 셋)", () => {
    const s = arranged({ 2: "mafia", 3: "mafia", 4: "mafia" }, { 3: { nightPick: 5 }, 4: { nightPick: 1 } });
    expect(String(botMafiaTarget(s, bot(s, 2)))).toBe("1");
  });

  it("동료가 고른 대상이 이미 탈락이면 무시하고 가장 낮은 산 비마피아다", () => {
    const s = arranged({ 2: "mafia", 4: "mafia" }, { 4: { nightPick: 3 }, 3: { alive: false } });
    expect(String(botMafiaTarget(s, bot(s, 2)))).toBe("0");
  });

  it("탈락한 동료의 선택은 따라가지 않는다", () => {
    const s = arranged({ 2: "mafia", 4: "mafia" }, { 4: { nightPick: 3, alive: false } });
    expect(String(botMafiaTarget(s, bot(s, 2)))).toBe("0");
  });

  it("시민·경찰·탈락한 마피아·후보 없음은 undefined 다", () => {
    const s = arranged({ 2: "mafia", 4: "police" });
    const dead = arranged({ 2: "mafia" }, { 2: { alive: false } });
    const alone: RoomState = { ...s, players: s.players.map((p) => (p.role === "mafia" ? p : { ...p, alive: false })) };
    expect(`${botMafiaTarget(s, bot(s, 0))}/${botMafiaTarget(s, bot(s, 4))}/${botMafiaTarget(dead, bot(dead, 2))}/${botMafiaTarget(alone, bot(alone, 2))}`).toBe(
      "undefined/undefined/undefined/undefined",
    );
  });

  it("경찰·의사가 고른 대상은 읽지 않는다 (T-09-03)", () => {
    const base = { 2: "mafia", 3: "police", 4: "doctor" } as const;
    const a = arranged(base, { 3: { nightPick: 0 }, 4: { nightPick: 1 } });
    const b = arranged(base, { 3: { nightPick: 5 }, 4: { nightPick: 5 } });
    expect(`${botMafiaTarget(a, bot(a, 2))}/${botMafiaTarget(b, bot(b, 2))}`).toBe("0/0");
  });

  it("botNightTarget 마피아 분기는 난수를 부르지 않고 경찰 분기는 randInt(후보 수) 한 번이다", () => {
    const s = arranged({ 2: "mafia", 3: "police", 4: "mafia" }, { 4: { nightPick: 5 } });
    expect(String(botNightTarget(s, bot(s, 2), THROWING))).toBe("5");
    const calls: number[] = [];
    botNightTarget(s, bot(s, 3), (n) => {
      calls.push(n);
      return 0;
    });
    expect(calls.join(",")).toBe("5");
  });

  it("planFor night: 마피아 봇이 둘이면 pick 대상이 같다(대상 난수 없음)", () => {
    const s = arranged({ 2: "mafia", 4: "mafia" });
    const picks = planBotSteps(s, nowOf(s), seededRandInt(9))
      .filter((st) => st.act.t === "pick")
      .map((st) => (st.act.t === "pick" ? `${st.botId === bot(s, 2).id ? 2 : 4}:${st.act.target}` : ""));
    expect(picks.sort().join(",")).toBe("2:0,4:0");
  });
});

const stepsOf = (s: RoomState): BotStep[] => s.botPlan?.steps ?? [];
/** 단계가 막 시작한 시각(마감 - 단계 길이). 대기실처럼 마감이 없으면 0. */
const nowOf = (s: RoomState): number => (s.phaseEndsAt === null ? 0 : s.phaseEndsAt - (PHASE_DEFS[s.phase].durationMs ?? 0));

describe("botPlanKey·syncBotPlan·planBotSteps", () => {
  it("discussion·night 는 단계 이름과 마감을 이은 키를 낸다 (07-08: claim 키는 없다)", () => {
    for (const phase of ["discussion", "night"] as const) {
      const state = stateAt(1, 4, 3, phase);
      expect(String(botPlanKey(state))).toBe(`${phase}:${state.phaseEndsAt}`);
    }
    for (const phase of ["lobby", "assigning", "roleReveal", "dayAnnounce", "morning"] as const) {
      const state = phase === "lobby" ? withBots(lobbyOf(1), 4) : stateAt(1, 4, 3, phase);
      expect(`${phase}:${String(botPlanKey(state))}`).toBe(`${phase}:null`);
    }
  });

  it("봇 없는 방은 모든 단계에서 입력 그대로이고 randInt 를 부르지 않는다", () => {
    for (const phase of ["discussion", "night", "morning"] as const) {
      const state = stateAt(4, 0, 3, phase);
      expect(syncBotPlan(state, nowOf(state), THROWING) === state).toBe(true);
    }
    const lobby = lobbyOf(3);
    expect(syncBotPlan(lobby, nowOf(lobby), THROWING) === lobby).toBe(true);
  });

  it("봇이 없는데 botPlan 이 남아 있으면 키를 뺀다", () => {
    const state = { ...stateAt(4, 0, 3, "discussion"), botPlan: { key: "x", steps: [] } };
    expect(Object.hasOwn(syncBotPlan(state, nowOf(state), THROWING), "botPlan")).toBe(false);
  });

  it("봇 계획이 필요 없는 단계에서는 botPlan 키가 없다", () => {
    for (const phase of ["lobby", "assigning", "roleReveal", "dayAnnounce", "morning"] as const) {
      const base = phase === "lobby" ? withBots(lobbyOf(1), 4) : stateAt(1, 4, 3, phase);
      const result = syncBotPlan({ ...base, botPlan: { key: "old", steps: [] } }, nowOf(base), seededRandInt(1));
      expect(`${phase}:${Object.hasOwn(result, "botPlan")}`).toBe(`${phase}:false`);
    }
  });

  /** 봇 줄 하나가 사람과 같은 규칙(정리 그대로·채널·D5 제한)을 지나는지 — 지나면 null, 아니면 이유. */
  const chatVerdict = (state: RoomState, step: BotStep, rates: Map<string, ChatSenderRate>): string | null => {
    if (step.act.t !== "chat") return `act:${step.act.t}`;
    const clean = sanitizeChatText(step.act.text);
    if (!clean.ok || clean.text !== step.act.text) return "sanitize";
    if (channelOf(state, step.botId) === null) return "channel";
    const sent = checkChatSend(rates.get(step.botId), step.act.text, step.at);
    if (!sent.ok) return sent.why;
    rates.set(step.botId, sent.next);
    return null;
  };

  it("discussion 은 살아 있는 봇마다 정확히 chat 2개(BOT_CHAT_LINES 안, 토론 40초 안, 결정 0039)이고 같은 봇 간격이 8000 이상이며 사람과 같은 규칙을 모두 통과한다", () => {
    for (let seed = 1; seed <= 20; seed += 1) {
      const state = markDead(stateAt(1, 5, seed, "discussion"), 3);
      const steps = planBotSteps(state, nowOf(state), seededRandInt(seed));
      // 08-07: 토론 계획은 채팅 두 줄 뒤에 토론 끝내기 한 번이 더 선다 — 채팅만 걸러 본다.
      const chats = steps.filter((s) => s.act.t === "chat");
      for (const bot of botsOf(state)) {
        const mine = chats.filter((s) => s.botId === bot.id);
        expect(`${seed}:${bot.seat}:${mine.length}`).toBe(`${seed}:${bot.seat}:${bot.alive === false ? 0 : 2}`);
        if (mine.length === 2) expect(mine[1]!.at - mine[0]!.at >= 8000).toBe(true);
      }
      expect(steps.every((s) => s.at < state.phaseEndsAt! - 500 && s.at > nowOf(state))).toBe(true);
      expect(chats.every((s) => s.act.t === "chat" && BOT_CHAT_LINES.includes(s.act.text))).toBe(true);
      expect(steps.every((s) => s.act.t === "chat" || s.act.t === "typing" || s.act.t === "endDiscussion" || s.act.t === "will")).toBe(true);
      const rates = new Map<string, ChatSenderRate>();
      for (const s of chats) expect(`${seed}:${chatVerdict(state, s, rates)}`).toBe(`${seed}:null`);
    }
  });

  it("night 는 살아 있는 마피아·경찰·의사 봇마다 pick 하나이고 pickTarget 에 통과하며, chat 은 마피아 봇만 최대 하나(BOT_NIGHT_LINES 안)이고 사람과 같은 규칙을 통과한다", () => {
    for (let seed = 1; seed <= 30; seed += 1) {
      let state = markDead(stateAt(1, 5, seed, "night"), 4);
      const steps = planBotSteps(state, nowOf(state), seededRandInt(seed));
      for (const bot of botsOf(state)) {
        const picks = steps.filter((s) => s.botId === bot.id && s.act.t === "pick");
        const acting = bot.alive !== false && bot.role !== "citizen";
        expect(`${seed}:${bot.seat}:${picks.length}`).toBe(`${seed}:${bot.seat}:${acting ? 1 : 0}`);
        const chats = steps.filter((s) => s.botId === bot.id && s.act.t === "chat");
        expect(`${seed}:${bot.seat}:${bot.role === "mafia" && bot.alive !== false ? chats.length <= 1 : chats.length === 0}`).toBe(`${seed}:${bot.seat}:true`);
        if (bot.role !== "mafia") {
          expect(`${seed}:${bot.seat}:${steps.filter((s) => s.botId === bot.id).length}`).toBe(`${seed}:${bot.seat}:${acting ? 1 : 0}`);
        }
      }
      expect(steps.every((s) => s.at < state.phaseEndsAt! - 500 && s.at > nowOf(state))).toBe(true);
      expect(steps.every((s) => s.act.t === "pick" || s.act.t === "approach" || s.act.t === "typing" || (s.act.t === "chat" && BOT_NIGHT_LINES.includes(s.act.text)))).toBe(true);
      const rates = new Map<string, ChatSenderRate>();
      for (const s of steps) {
        if (s.act.t === "approach" || s.act.t === "typing") continue; // 09-12: 다가가기·09-24: 입력 중은 아래 전용 시험이 본다
        if (s.act.t === "pick") {
          const r = pickTarget(state, s.botId, s.act.target);
          expect(`${seed}:${r.ok ? "ok" : r.error}`).toBe(`${seed}:ok`);
          if (r.ok) state = r.state;
        } else {
          expect(`${seed}:${channelOf(state, s.botId)}:${chatVerdict(state, s, rates)}`).toBe(`${seed}:mafia:null`);
        }
      }
    }
  });

  it("night 마피아 봇의 chat 은 randInt(10) < 6 일 때만 서고 난수 순서는 [5000, 10, 6000, 3] 이다 (09-02 재고정: 마피아 대상 난수 없음)", () => {
    let found: { state: RoomState; botId: string } | null = null;
    for (let seed = 1; seed <= 60 && found === null; seed += 1) {
      const base = stateAt(1, 5, seed, "night");
      const bot = botsOf(base).find((b) => b.role === "mafia");
      const human = humansOf(base)[0]!;
      if (bot !== undefined && human.role !== "mafia") found = { state: markDead(base, ...botsOf(base).filter((b) => b.id !== bot.id).map((b) => b.seat)), botId: bot.id };
    }
    if (found === null) throw new Error("no seed with a mafia bot and a non-mafia human");
    const { state, botId } = found;
    const run = (tenths: number): { calls: number[]; texts: string[] } => {
      const calls: number[] = [];
      const steps = planBotSteps(state, nowOf(state), (n) => {
        calls.push(n);
        return n === 10 ? tenths : 0;
      });
      return { calls, texts: steps.filter((s) => s.botId === botId && s.act.t === "chat").map((s) => (s.act.t === "chat" ? s.act.text : "")) };
    };
    const talk = run(5);
    expect(`${talk.calls.join(",")}|${talk.texts.join("/")}`).toBe(`5000,10,6000,3|${BOT_NIGHT_LINES[0]}`);
    const quiet = run(6);
    expect(`${quiet.calls.join(",")}|${quiet.texts.length}`).toBe("5000,10|0");
  });

  it("어떤 단계의 봇 계획에도 say·emoji 행동이 없다", () => {
    const states = [
      ...(["discussion", "night"] as const).map((phase) => stateAt(1, 5, 8, phase)),
      verdictAt(2, "defense", 3),
    ];
    for (const state of states) {
      const kinds = [...new Set(planBotSteps(state, nowOf(state), seededRandInt(5)).map((s) => s.act.t as string))].sort();
      expect(`${state.phase}:${kinds.every((k) => ["chat", "pick", "endDiscussion", "point", "verdict", "will", "approach", "typing"].includes(k))}`).toBe(`${state.phase}:true`);
    }
  });

  it("로비·역할 확인 단계의 봇은 말하지 않는다(계획이 서지 않는다)", () => {
    const lobby = withBots(lobbyOf(1), 4);
    expect(`${String(botPlanKey(lobby))}:${planBotSteps(lobby, 0, THROWING).length}`).toBe("null:0");
    expect(Object.hasOwn(syncBotPlan(lobby, 0, THROWING), "botPlan")).toBe(false);
  });

  it("탈락한 봇은 어느 단계에도 행동이 없다", () => {
    for (const phase of ["discussion", "night"] as const) {
      const base = stateAt(1, 5, 11, phase);
      const state = markDead(base, ...botsOf(base).map((b) => b.seat));
      expect(`${phase}:${planBotSteps(state, nowOf(state), seededRandInt(1)).length}`).toBe(`${phase}:0`);
    }
  });

  it("사람이 모두 끊긴 상태면 steps 가 비어 있고 randInt 를 부르지 않는다", () => {
    for (const phase of ["discussion", "night"] as const) {
      const base = stateAt(2, 4, 6, phase);
      const state: RoomState = { ...base, players: base.players.map((p) => (isBot(p) ? p : { ...p, connected: false })) };
      expect(`${phase}:${planBotSteps(state, nowOf(state), THROWING).length}`).toBe(`${phase}:0`);
    }
  });

  it("같은 시드·같은 now 는 같은 계획이다", () => {
    for (const phase of ["discussion", "night"] as const) {
      const state = stateAt(1, 5, 8, phase);
      expect(canon(planBotSteps(state, nowOf(state), seededRandInt(42)))).toBe(canon(planBotSteps(state, nowOf(state), seededRandInt(42))));
    }
  });

  it("같은 단계 키로 다시 부르면 입력 그대로이고 tick 으로 다음 단계에 가면 새 키의 계획이다", () => {
    const discussion0 = stateAt(1, 4, 3, "discussion");
    const discussion = syncBotPlan(discussion0, nowOf(discussion0), seededRandInt(1));
    expect(Object.hasOwn(discussion, "botPlan")).toBe(true);
    expect(syncBotPlan(discussion, nowOf(discussion) + 5, THROWING) === discussion).toBe(true);
    const nomination = tick(discussion, discussion.phaseEndsAt!, seededRandInt(2));
    expect(nomination.phase).toBe("nomination");
    const next = syncBotPlan(nomination, nowOf(nomination), seededRandInt(5));
    expect(String(next.botPlan?.key)).toBe(`nomination:${nomination.phaseEndsAt}`);
    // 기본판(결정 0072) 투표는 동시라 진입 직후 산 봇(4명)마다 point 한 행이 선다 — 순차 차례 계획은 "봇 차례 지목" describe 가 본다(RULESET.pickTurn).
    expect(stepsOf(next).map((s) => s.act.t).join(",")).toBe("point,point,point,point");
  });

  it("행동은 at 오름차순이다", () => {
    const state = stateAt(1, 7, 8, "discussion");
    const ats = planBotSteps(state, nowOf(state), seededRandInt(3)).map((s) => s.at);
    expect(ats.join(",")).toBe([...ats].sort((a, b) => a - b).join(","));
  });

});

describe("takeDueBotSteps·botWakeAt", () => {
  const plan = (key: string): RoomState => {
    const state = stateAt(1, 4, 3, "discussion");
    const bot = botsOf(state)[0]!;
    const step = (at: number): BotStep => ({ at, botId: bot.id, act: { t: "chat", text: "저 아니에요" } });
    return { ...state, botPlan: { key, steps: [step(10), step(20), step(30)] } };
  };

  it("at 이하인 행동만 순서대로 꺼내고 나머지를 남긴다", () => {
    const state = plan(planKeyOf(stateAt(1, 4, 3, "discussion")));
    const { state: rest, due } = takeDueBotSteps(state, 20);
    expect(due.map((s) => s.at).join(",")).toBe("10,20");
    expect(stepsOf(rest).map((s) => s.at).join(",")).toBe("30");
    expect(String(botWakeAt(rest))).toBe("30");
  });

  it("꺼낼 것이 없으면 입력 그대로다", () => {
    const state = plan(planKeyOf(stateAt(1, 4, 3, "discussion")));
    const { state: rest, due } = takeDueBotSteps(state, 5);
    expect(due.length === 0 && rest === state).toBe(true);
  });

  it("키가 다른(낡은) 계획이면 due 가 비고 입력 그대로며 botWakeAt 도 null 이다", () => {
    const state = plan("discussion:1");
    const { state: rest, due } = takeDueBotSteps(state, 1_000_000);
    expect(due.length === 0 && rest === state).toBe(true);
    expect(String(botWakeAt(state))).toBe("null");
  });

  it("남은 행동이 없으면 botWakeAt 은 null 이다", () => {
    const state = plan(planKeyOf(stateAt(1, 4, 3, "discussion")));
    const { state: rest } = takeDueBotSteps(state, 1_000_000);
    expect(String(botWakeAt(rest))).toBe("null");
  });
});

// ---- 후보 봇 변론과 지목 대상 고르기 (결정 0024, 0036) — 옛 처형 여부·후보 선택 봇 계획 시험은 08-28 이 지웠다 ----
/** 사람 1 + 봇 4 테스트 방의 후보가 정해진 뒤 단계(지목 마감 직후의 변론 — 새 흐름, 08-11). 모두 산 채로 있다. */
const verdictAt = (
  seed: number,
  phase: "defense" | "verdict",
  candidate: "citizen" | number = "citizen",
): RoomState => stateWithVerdict(5, seed, phase, { lobby: withBots(lobbyOf(1), 4), candidate });
/** randInt 호출 인자를 기록하고 값은 시드 난수로 준다. */
function recording(seed: number): { calls: number[]; randInt: (n: number) => number } {
  const inner = seededRandInt(seed);
  const calls: number[] = [];
  return {
    calls,
    randInt: (n: number) => {
      calls.push(n);
      return inner(n);
    },
  };
}
const rowsOf = (steps: BotStep[], botId: string): BotStep[] => steps.filter((s) => s.botId === botId);

describe("봇 투표·변론 계획: 키", () => {
  it("defense 는 `${phase}:${phaseEndsAt}` 이고 처형·종료는 null 이다", () => {
    const def = verdictAt(3, "defense");
    expect(String(botPlanKey(def))).toBe(`defense:${def.phaseEndsAt}`);
    for (const phase of ["execution", "ended"] as const) {
      expect(`${phase}:${String(botPlanKey({ ...def, phase }))}`).toBe(`${phase}:null`);
    }
  });

  it("처형·종료 단계에서 syncBotPlan 은 낡은 botPlan 키를 뺀다", () => {
    const def = verdictAt(4, "defense");
    for (const phase of ["execution", "ended"] as const) {
      const result = syncBotPlan({ ...def, phase, botPlan: { key: "old", steps: [] } }, nowOf(def), THROWING);
      expect(`${phase}:${Object.hasOwn(result, "botPlan")}`).toBe(`${phase}:false`);
    }
  });
});

describe("봇 투표·변론 계획: 지목 대상 고르기 (botPointTarget)", () => {
  it("botPointTarget 은 seat 오름차순 후보에서 randInt(길이) 번째를 고르고 역할을 보지 않는다", () => {
    const state = verdictAt(8, "defense");
    const bot = botsOf(state)[1]!; // seat 2
    const seen: number[] = [];
    const target = botPointTarget(state, bot, (n) => {
      seen.push(n);
      return n - 1;
    });
    expect(`${seen.join(",")}:${target}`).toBe("4:4");
    expect(String(botPointTarget(state, bot, () => 0))).toBe("0");
  });

  it("살아 있는 다른 사람이 없으면 행이 없고 randInt 를 부르지 않는다", () => {
    const base = verdictAt(5, "defense");
    const lastBot = botsOf(base)[0]!;
    const state = markDead(base, ...base.players.filter((p) => p.id !== lastBot.id).map((p) => p.seat));
    expect(planBotSteps(state, nowOf(state), THROWING).length).toBe(0);
    expect(String(botPointTarget(state, lastBot, THROWING))).toBe("undefined");
  });
});

describe("봇 투표·변론 계획: defense", () => {
  it("후보가 봇이면 그 봇만 chat 한 행(BOT_DEFENSE_LINES 안)이고 사람과 같은 규칙을 통과한다", () => {
    for (let seed = 1; seed <= 20; seed += 1) {
      const state = verdictAt(seed, "defense", 3);
      expect(`${seed}:${state.verdict?.candidate}`).toBe(`${seed}:3`);
      const steps = planBotSteps(state, nowOf(state), seededRandInt(seed));
      expect(`${seed}:${steps.map((s) => s.act.t).join(",")}`).toBe(`${seed}:typing,chat`);
      const step = steps[1]!;
      const bot = state.players.find((p) => p.seat === 3)!;
      expect(`${seed}:${step.botId === bot.id}`).toBe(`${seed}:true`);
      expect(step.at >= nowOf(state) + 1000 && step.at < state.phaseEndsAt! - 500).toBe(true);
      if (step.act.t !== "chat") throw new Error(`expected chat, got ${step.act.t}`);
      expect(`${seed}:${BOT_DEFENSE_LINES.includes(step.act.text)}`).toBe(`${seed}:true`);
      const clean = sanitizeChatText(step.act.text);
      expect(`${seed}:${clean.ok && clean.text === step.act.text}:${channelOf(state, step.botId)}`).toBe(`${seed}:true:all`);
      expect(phaseKey(state)).toBe(`1:${state.day ?? 0}:defense`);
    }
  });

  it("난수 순서는 [3, 4000] 이고 문구는 randInt(3) 번째다", () => {
    const state = verdictAt(5, "defense", 3);
    const rec = recording(9);
    planBotSteps(state, nowOf(state), rec.randInt);
    expect(rec.calls.join(",")).toBe("3,4000");
    for (const [i, name] of BOT_DEFENSE_LINES.entries()) {
      const steps = planBotSteps(state, nowOf(state), (n) => (n === 3 ? i : 0));
      const chat = steps.find((s) => s.act.t === "chat")!;
      expect(chat.act.t === "chat" && chat.act.text).toBe(name);
    }
  });

  it("후보가 사람이면 빈 계획이고 randInt 를 부르지 않는다", () => {
    const state = verdictAt(5, "defense", 0);
    expect(String(state.verdict?.candidate)).toBe("0");
    expect(planBotSteps(state, nowOf(state), THROWING).length).toBe(0);
  });
});

describe("봇 투표·변론 계획: 회귀", () => {
  it("탈락한 봇·사람이 모두 끊긴 방은 변론 단계에서도 행동이 없다", () => {
    const cases: [string, RoomState][] = [
      ["defense", verdictAt(2, "defense", 3)],
    ];
    for (const [label, state] of cases) {
      const dead = markDead(state, ...botsOf(state).map((b) => b.seat));
      expect(`${label}:dead:${planBotSteps(dead, nowOf(dead), seededRandInt(1)).length}`).toBe(`${label}:dead:0`);
      const gone: RoomState = { ...state, players: state.players.map((p) => (isBot(p) ? p : { ...p, connected: false })) };
      expect(`${label}:gone:${planBotSteps(gone, nowOf(gone), THROWING).length}`).toBe(`${label}:gone:0`);
    }
  });

  it("discussion·night 계획 고정값 (09-02 재고정: night 962657041 → 554531902, 마피아 대상 난수 없음; 08-11: 흐름 전환으로 둘 다 다시 고정 — 08-07 값 856098986·997718148; 07-11 이전 622180622·76649671, 07-08 이전 289874952·760964938)", () => {
    const digest = (text: string): number => [...text].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) % 1_000_000_007, 7);
    const got = (["discussion", "night"] as const).map((phase) => {
      const state = stateAt(1, 5, 8, phase);
      // 09-12: will·approach(09-24: typing 도)는 난수 없는 덧붙임 행동이다 — 걸러내면 기존 시드 고정 값이 그대로여야 한다(난수 호출 순서 불변 증명).
      const steps = planBotSteps(state, nowOf(state), seededRandInt(42)).filter((st) => st.act.t !== "will" && st.act.t !== "approach" && st.act.t !== "typing")
        // 15-01(결정 0074): 낮 시작과 토론 사이에 심부름 40초가 끼어 모든 시각(at)이 ERRAND_MS 만큼 뒤로 밀린다. 난수 호출 순서는 그대로이므로(errand 계획은 난수 없음)
        // 시각만 되돌려 옛 고정 값을 그대로 지킨다 — 값이 어긋나면 난수 순서가 바뀐 것이다.
        .map((st) => ({ ...st, at: st.at - ERRAND_MS }));
      return digest(canon(steps));
    });
    // 08-11: 토론이 90초가 되고 밤이 지목 마감 뒤에 닿아 두 계획의 시각(at)이 모두 달라졌다 — 새 흐름 값으로 다시 고정한다.
    // 09.1-04: 지목이 순차(전원 기권 기준 모이기 + 인원 × 8.9초 + 끝 알림)가 되어 밤 시작 시각이 달라졌다 — night 값만 다시 고정한다(discussion 은 그대로).
    // 13-02(결정 0072): 기본판 투표는 15초 동시 투표(순차 아님)라 밤 시작 시각이 되돌아가 night 값을 다시 고정한다(125073089 → 554531902, discussion 은 그대로).
    expect(got.join(",")).toBe("34804349,554531902");
  });

  it("discussion 계획의 난수 호출 수는 claim 제거 뒤에도 그대로다 (07-08, 리서치 Pitfall 13)", () => {
    const countCalls = (state: RoomState): number => {
      let calls = 0;
      const inner = seededRandInt(42);
      planBotSteps(state, nowOf(state), (n) => {
        calls += 1;
        return inner(n);
      });
      return calls;
    };
    // discussion = 봇당 randInt(폭) + randInt(문구 수) 를 두 번 + 토론 끝내기 간격 한 번(08-07) — 봇당 5번, 봇 5명이면 25번(07-11: 자유 채팅 문구 하나, 이모티콘·종류 난수 없음).
    expect(countCalls(stateAt(1, 5, 8, "discussion"))).toBe(25);
  });
});

// ---- P-13: 테스트 방 방장이 고른 봇 투표 설정(결정 0022·0024 확장, 04-15) ----
describe("봇 투표 고정 설정: botPointTarget", () => {
  it("botPointTarget host: 방장이 살아 있고 이 봇이 아니면 방장 seat 이며 randInt 를 부르지 않는다", () => {
    const state = verdictAt(8, "defense");
    const hostSeat = state.players.find((p) => p.id === state.hostId)!.seat;
    for (const bot of botsOf(state)) {
      expect(`${bot.seat}:${botPointTarget(state, bot, THROWING, "host")}`).toBe(`${bot.seat}:${hostSeat}`);
    }
  });

  it("botPointTarget other: 방장도 자기도 아닌 살아 있는 사람 중 가장 낮은 seat 이며 randInt 를 부르지 않는다", () => {
    const state = verdictAt(8, "defense");
    const [b1, b2, b3] = botsOf(state); // seat 1, 2, 3
    expect(String(botPointTarget(state, b1!, THROWING, "other"))).toBe("2");
    expect(String(botPointTarget(state, b2!, THROWING, "other"))).toBe("1");
    expect(String(botPointTarget(state, b3!, THROWING, "other"))).toBe("1");
    // 가장 낮은 seat 이 탈락했으면 그다음.
    const dead = markDead(state, 1);
    expect(String(botPointTarget(dead, b2!, THROWING, "other"))).toBe("3");
  });

  it("조건이 안 맞으면 무작위로 돌아가 기존과 같이 randInt(길이) 한 번 부른다", () => {
    const base = verdictAt(8, "defense");
    const hostSeat = base.players.find((p) => p.id === base.hostId)!.seat;
    const bot = botsOf(base)[1]!; // seat 2
    // host: 방장 탈락 → 살아 있는 다른 사람 3명 중 무작위
    const hostDead = markDead(base, hostSeat);
    const rec1 = recording(2);
    const t1 = botPointTarget(hostDead, bot, rec1.randInt, "host");
    expect(`${rec1.calls.join(",")}:${t1 !== undefined && t1 !== hostSeat && t1 !== bot.seat}`).toBe("3:true");
    // other: 방장·자기 말고 아무도 없음 → 후보는 방장 하나뿐이라 randInt(1) 한 번
    const alone = markDead(base, ...base.players.filter((p) => p.id !== base.hostId && p.id !== bot.id).map((p) => p.seat));
    const rec2 = recording(2);
    const t2 = botPointTarget(alone, bot, rec2.randInt, "other");
    expect(`${rec2.calls.join(",")}:${t2}`).toBe(`1:${hostSeat}`);
    // 후보가 아예 없으면 undefined, 난수 없음
    const none = markDead(alone, hostSeat);
    expect(String(botPointTarget(none, bot, THROWING, "host"))).toBe("undefined");
    expect(String(botPointTarget(none, bot, THROWING, "other"))).toBe("undefined");
  });

  it("고정 설정이 없으면 기존 시그니처 호출과 같다(같은 난수 기록·같은 결과)", () => {
    const state = verdictAt(8, "defense");
    const bot = botsOf(state)[1]!;
    const a = recording(5);
    const b = recording(5);
    expect(String(botPointTarget(state, bot, a.randInt))).toBe(String(botPointTarget(state, bot, b.randInt, undefined)));
    expect(a.calls.join(",")).toBe(b.calls.join(","));
  });
});

describe("BOT_*_LINES: 고정 문구 (07-11, 가정 A2)", () => {
  it("낮 8개·밤 3개·변론 3개이고 서로 겹치지 않는 문구다", () => {
    expect(`${BOT_CHAT_LINES.length}/${BOT_NIGHT_LINES.length}/${BOT_DEFENSE_LINES.length}`).toBe("8/3/3");
    for (const lines of [BOT_CHAT_LINES, BOT_NIGHT_LINES, BOT_DEFENSE_LINES]) expect(new Set(lines).size).toBe(lines.length);
  });

  it("모든 문구가 sanitizeChatText 를 그대로 통과하고 자소 100 이하다", () => {
    for (const text of [...BOT_CHAT_LINES, ...BOT_NIGHT_LINES, ...BOT_DEFENSE_LINES]) {
      const clean = sanitizeChatText(text);
      expect(`${text}:${clean.ok && clean.text === text}:${countGraphemes(text) <= 100}`).toBe(`${text}:true:true`);
    }
  });
});

// ---- 8페이즈: 토론 끝내기·지목·찬반 봇 계획 (08-07, 결정 0024·0060-13) ----
describe("봇 계획: 토론 끝내기 (DAY-03)", () => {
  /** 마감을 넉넉히 늘린 토론 상태 — 30~60초 간격의 행동이 마감 − 500 에 잘리지 않게. */
  const wideDiscussion = (seed: number): { state: RoomState; now: number } => {
    const base = stateAt(1, 4, seed, "discussion");
    const now = nowOf(base);
    return { state: { ...base, phaseEndsAt: now + 100_000 }, now };
  };

  it("살아 있는 봇마다 endDiscussion 한 번이 now + 30000 이상 now + 60000 미만에 서고 toggleEnd 에 통과한다; 탈락한 봇은 없다", () => {
    for (let seed = 1; seed <= 20; seed += 1) {
      const { state: whole, now } = wideDiscussion(seed);
      const state = markDead(whole, 3);
      const steps = planBotSteps(state, now, seededRandInt(seed));
      for (const bot of botsOf(state)) {
        const ends = steps.filter((s) => s.botId === bot.id && s.act.t === "endDiscussion");
        expect(`${seed}:${bot.seat}:${ends.length}`).toBe(`${seed}:${bot.seat}:${bot.alive === false ? 0 : 1}`);
        for (const s of ends) {
          expect(`${seed}:${s.at >= now + 30_000 && s.at < now + 60_000}`).toBe(`${seed}:true`);
          const r = toggleEnd(state, s.botId, true);
          expect(`${seed}:${r.ok ? "ok" : r.error}`).toBe(`${seed}:ok`);
        }
      }
    }
  });

  it("난수 호출 순서는 봇마다 [10000, 8, 18000, 8, 30000](채팅 → 채팅 → 끝내기 간격)이다", () => {
    const { state, now } = wideDiscussion(5);
    const rec = recording(7);
    planBotSteps(state, now, rec.randInt);
    const per = [10000, 8, 18000, 8, 30000];
    expect(rec.calls.join(",")).toBe(Array(botsOf(state).length).fill(per).flat().join(","));
  });
});

describe("봇 차례 지목 (결정 0063-1)", () => {
  const T0 = 100_000;
  /** 사람(방장 seat 0) 1 + 봇 4 의 순차 지목 진입 직후(모이는 중). 마감은 호출한 쪽이 건다(09.1-01). */
  const gathering = (seed: number): RoomState => {
    const base = startedFrom(withBots(lobbyOf(1), 4), seed, "discussion");
    const entered = enterNomination({ ...base, phase: "nomination" });
    return { ...entered, phaseEndsAt: T0 + nominationStepMs(entered) };
  };
  /** 마감 한 걸음: 지난 마감 시각을 at 으로 stepNomination 을 걸고 다음 마감을 건다. */
  const advance = (s: RoomState): RoomState => {
    const at = s.phaseEndsAt!;
    const r = stepNomination(s, at);
    return { ...r.state, phaseEndsAt: at + nominationStepMs(r.state) };
  };
  /** 방장(사람) 차례를 기권으로 넘겨 봇 seat1 차례(i 1)까지. */
  const botOneTurn = (seed: number): RoomState => advance(advance(advance(gathering(seed))));
  const pointsOf = (steps: BotStep[]): BotStep[] => steps.filter((x) => x.act.t === "point");

  it("모이는 중·방장 차례에는 point 가 없고 난수를 부르지 않는다", () => {
    const g = gathering(3);
    const first = recording(7);
    const a = planBotSteps(g, T0, first.randInt);
    const host = advance(g);
    const second = recording(7);
    const b = planBotSteps(host, host.phaseEndsAt! - 8000, second.randInt);
    expect(`${g.pickTurn?.i}:${host.pickTurn?.i}`).toBe("-1:0");
    expect(`${a.length}|${first.calls.length}|${b.length}|${second.calls.length}`).toBe("0|0|0|0");
  });

  it("봇 seat1 차례에는 그 봇 point 한 개가 now 에 서고 castTurnPoint 를 통과하며 난수는 [후보 수] 한 번뿐이다", () => {
    for (let seed = 1; seed <= 10; seed += 1) {
      const state = botOneTurn(seed);
      const now = state.phaseEndsAt! - 8000;
      const rec = recording(seed);
      const steps = planBotSteps(state, now, rec.randInt);
      const points = pointsOf(steps);
      const bot = state.players.find((p) => p.seat === 1)!;
      expect(`${seed}:${state.pickTurn?.i}:${points.length}:${steps.length}`).toBe(`${seed}:1:1:1`);
      const step = points[0]!;
      expect(`${step.botId === bot.id}:${step.at === now}`).toBe("true:true");
      expect(rec.calls.join(",")).toBe("4");
      const target = step.act.t === "point" ? step.act.target : -1;
      expect(`${target !== 1 && state.players.find((p) => p.seat === target)?.alive !== false}`).toBe("true");
      const r = castTurnPoint(state, step.botId, target, step.at);
      expect(`${seed}:${r.ok ? "ok" : r.error}`).toBe(`${seed}:ok`);
      expect(r.ok ? String(r.state.pickTurn?.doneAt) : "-").toBe(String(now));
    }
  });

  it("고정 pick host 면 대상은 방장이고 난수를 부르지 않으며, other 면 방장도 자기도 아닌 가장 낮은 seat 이다", () => {
    const state = botOneTurn(4);
    const now = state.phaseEndsAt! - 8000;
    const host = recording(7);
    const hostSteps = planBotSteps({ ...state, testBotVote: { pick: "host" } }, now, host.randInt);
    expect(`${hostSteps.map((x) => (x.act.t === "point" ? x.act.target : -1)).join(",")}|${host.calls.length}`).toBe("0|0");
    const other = recording(7);
    const otherSteps = planBotSteps({ ...state, testBotVote: { pick: "other" } }, now, other.randInt);
    expect(`${otherSteps.map((x) => (x.act.t === "point" ? x.act.target : -1)).join(",")}|${other.calls.length}`).toBe("2|0");
  });

  it("같은 시드는 같은 대상이다(값 고정)", () => {
    const state = botOneTurn(4);
    const now = state.phaseEndsAt! - 8000;
    const run = (seed: number): string => planBotSteps(state, now, seededRandInt(seed)).map((x) => (x.act.t === "point" ? x.act.target : -1)).join(",");
    expect(`${run(11)}|${run(11)}`).toBe("3|3");
  });

  it("확정 뒤 사이·끝 알림·탈락한 봇 차례에는 point 가 없다", () => {
    const state = botOneTurn(5);
    const now = state.phaseEndsAt! - 8000;
    const bot = state.players.find((p) => p.seat === 1)!;
    const cast = castTurnPoint(state, bot.id, 0, now);
    if (!cast.ok) throw new Error(cast.error);
    const gap = planBotSteps(cast.state, now, seededRandInt(1));
    let end = cast.state;
    for (let guard = 0; guard < 20 && (end.pickTurn?.i ?? 0) < end.pickTurn!.order.length; guard += 1) end = advance(end);
    const endSteps = planBotSteps(end, end.phaseEndsAt! - 2000, seededRandInt(1));
    const dead = markDead(state, 1);
    const deadSteps = planBotSteps(dead, now, seededRandInt(1));
    expect(`${pointsOf(gap).length}|${end.pickTurn?.i}|${endSteps.length}|${pointsOf(deadSteps).length}`).toBe("0|5|0|0");
  });

  it("차례 있는 계획은 차례마다 키가 달라진다", () => {
    const a = botOneTurn(2);
    const b = advance(advance(a));
    expect(`${planKeyOf(a) === planKeyOf(b)}`).toBe("false");
  });
});

describe("봇 계획: 찬반 (DAY-06, 결정 0060-13)", () => {
  /** 사람 1 + 봇 4 의 찬반 단계. candidate 좌석이 변론자다. */
  const verdictState = (seed: number, candidate: number): RoomState => {
    const base = startedFrom(withBots(lobbyOf(1), 4), seed, "discussion");
    return { ...base, phase: "verdict", phaseEndsAt: 100_000 + PHASE_DEFS.verdict.durationMs!, verdict: { passed: false, candidate } };
  };

  it("계획 키는 `${phase}:${phaseEndsAt}` 이다", () => {
    const state = verdictState(3, 0);
    expect(String(botPlanKey(state))).toBe(`verdict:${state.phaseEndsAt}`);
  });

  it("변론자가 아닌 산 봇마다 verdict 한 번이 now + 1000 이상 now + 6000 미만에 서고 castVerdict 에 통과한다; 변론자 봇은 없다", () => {
    for (let seed = 1; seed <= 20; seed += 1) {
      const state = verdictState(seed, 2);
      const steps = planBotSteps(state, nowOf(state), seededRandInt(seed));
      for (const bot of botsOf(state)) {
        const mine = rowsOf(steps, bot.id);
        expect(`${seed}:${bot.seat}:${mine.length}`).toBe(`${seed}:${bot.seat}:${bot.seat === 2 ? 0 : 1}`);
        for (const s of mine) {
          expect(`${seed}:${s.at >= nowOf(state) + 1000 && s.at < nowOf(state) + 6000}`).toBe(`${seed}:true`);
          const r = s.act.t === "verdict" ? castVerdict(state, s.botId, s.act.agree) : null;
          expect(`${seed}:${r?.ok === true ? "ok" : String(r)}`).toBe(`${seed}:ok`);
        }
      }
    }
  });

  it("난수 호출 순서는 봇마다 [100, 5000] 이고 찬성은 randInt(100) < EXEC_YES_PERCENT 이다", () => {
    const state = verdictState(5, 0);
    const rec = recording(7);
    planBotSteps(state, nowOf(state), rec.randInt);
    expect(rec.calls.join(",")).toBe([100, 5000, 100, 5000, 100, 5000, 100, 5000].join(","));
    const yes = planBotSteps(state, nowOf(state), (n) => (n === 100 ? EXEC_YES_PERCENT - 1 : 0));
    const no = planBotSteps(state, nowOf(state), (n) => (n === 100 ? EXEC_YES_PERCENT : 0));
    const agrees = (steps: BotStep[]): string => steps.map((s) => (s.act.t === "verdict" ? String(s.act.agree) : "?")).join(",");
    expect(`${agrees(yes)}|${agrees(no)}`).toBe("true,true,true,true|false,false,false,false");
  });

  it("고정 yes·no 면 randInt(100) 을 부르지 않고 지연 난수만 부른다", () => {
    const state = verdictState(5, 0);
    for (const [exec, want] of [["yes", "true"], ["no", "false"]] as const) {
      const rec = recording(7);
      const steps = planBotSteps({ ...state, testBotVote: { exec } }, nowOf(state), rec.randInt);
      expect(`${exec}:${rec.calls.join(",")}`).toBe(`${exec}:5000,5000,5000,5000`);
      expect(`${exec}:${steps.map((s) => (s.act.t === "verdict" ? String(s.act.agree) : "?")).join(",")}`).toBe(`${exec}:${Array(4).fill(want).join(",")}`);
    }
  });
});

describe("봇 유언·다가가기 계획 (09-12, 결정 0061-18, 가정 A3)", () => {
  it("BOT_WILL_LINES 는 짧은 중립 문장 3개이고 sanitizeChatText 를 그대로 통과하며 역할 단어가 없다", () => {
    expect(BOT_WILL_LINES.length).toBe(3);
    for (const line of BOT_WILL_LINES) {
      expect(countGraphemes(line)).toBeLessThanOrEqual(WILL_MAX_GRAPHEMES);
      const clean = sanitizeChatText(line);
      expect(clean.ok && clean.text === line).toBe(true);
      expect(/마피아|경찰|의사|시민/.test(line)).toBe(false);
    }
  });

  it("1일차 discussion: 산 봇마다 now+3000 에 will 한 줄(BOT_WILL_LINES[seat % 길이])이 더해지고 죽은 봇에는 없다", () => {
    for (let seed = 1; seed <= 10; seed += 1) {
      const state = markDead(stateAt(1, 5, seed, "discussion"), 3);
      const steps = planBotSteps(state, nowOf(state), seededRandInt(seed));
      for (const bot of botsOf(state)) {
        const mine = steps.filter((s) => s.botId === bot.id && s.act.t === "will");
        expect(`${seed}:${bot.seat}:${mine.length}`).toBe(`${seed}:${bot.seat}:${bot.alive === false ? 0 : 1}`);
        const one = mine[0];
        if (one !== undefined && one.act.t === "will") {
          expect(one.at).toBe(nowOf(state) + 3000);
          expect(one.act.text).toBe(BOT_WILL_LINES[bot.seat % BOT_WILL_LINES.length]);
        }
      }
    }
  });

  it("2일차 discussion 에는 will 이 없다", () => {
    const state = { ...stateAt(1, 5, 4, "discussion"), day: 2 };
    expect(planBotSteps(state, nowOf(state), seededRandInt(4)).filter((s) => s.act.t === "will").length).toBe(0);
  });

  it("will 을 더해도 난수 호출 순서가 같다: 호출 기록이 봇당 5번(폭·문구·폭·문구·끝내기 폭) 그대로다", () => {
    const state = stateAt(1, 5, 8, "discussion");
    const calls: number[] = [];
    planBotSteps(state, nowOf(state), (n) => {
      calls.push(n);
      return 0;
    });
    expect(calls.length).toBe(botsOf(state).length * 5);
  });

  it("night: 산 마피아 봇마다 pick 계획 시각 + 200 에 같은 대상으로 approach 한 줄, 경찰·의사·시민 봇에는 없다", () => {
    for (let seed = 1; seed <= 20; seed += 1) {
      const state = markDead(stateAt(1, 5, seed, "night"), 4);
      const steps = planBotSteps(state, nowOf(state), seededRandInt(seed));
      for (const bot of botsOf(state)) {
        const mine = steps.filter((s) => s.botId === bot.id);
        const approach = mine.filter((s) => s.act.t === "approach");
        const pick = mine.find((s) => s.act.t === "pick");
        const wants = bot.alive !== false && bot.role === "mafia" && pick !== undefined;
        expect(`${seed}:${bot.seat}:${approach.length}`).toBe(`${seed}:${bot.seat}:${wants ? 1 : 0}`);
        const a = approach[0];
        if (a !== undefined && a.act.t === "approach" && pick !== undefined && pick.act.t === "pick") {
          expect(a.at).toBe(pick.at + 200);
          expect(a.act.target).toBe(pick.act.target);
        }
      }
    }
  });
});

// 09-24 (feedback-1): 채팅 줄 앞 입력 중 단계. 난수는 부르지 않고, 짝 chat 이 버려지면 typing 도 남지 않는다.
describe("봇 채팅 앞 입력 중 단계 (09-24)", () => {
  /** steps 에서 chat 마다 같은 봇의 바로 앞 단계가 typing 이고 시각이 max(now, chat.at − LEAD) 인지 한 줄로. */
  const pairing = (steps: BotStep[], now: number): string => {
    const rows: string[] = [];
    steps.forEach((s) => {
      if (s.act.t !== "chat") return;
      const typing = steps.filter((t) => t.botId === s.botId && t.act.t === "typing" && t.at <= s.at).at(-1);
      rows.push(`${s.botId}:${typing !== undefined && typing.at === Math.max(now, s.at - BOT_TYPING_LEAD_MS)}`);
    });
    return rows.every((r) => r.endsWith(":true")) ? `ok:${rows.length}` : rows.join(",");
  };

  it("discussion: 봇의 채팅 두 줄마다 typing 이 한 번씩 바로 앞에 선다 (typing 수 = chat 수)", () => {
    for (let seed = 1; seed <= 10; seed += 1) {
      const state = stateAt(1, 5, seed, "discussion");
      const now = nowOf(state);
      const steps = planBotSteps(state, now, seededRandInt(seed));
      const chats = steps.filter((s) => s.act.t === "chat");
      expect(`${seed}:${steps.filter((s) => s.act.t === "typing").length}`).toBe(`${seed}:${chats.length}`);
      expect(`${seed}:${pairing(steps, now)}`).toBe(`${seed}:ok:${chats.length}`);
    }
  });

  it("night 마피아 채팅·defense 후보 채팅에도 같은 규칙이 선다", () => {
    for (let seed = 1; seed <= 20; seed += 1) {
      const night = stateAt(1, 5, seed, "night");
      const nSteps = planBotSteps(night, nowOf(night), seededRandInt(seed));
      expect(`${seed}:${pairing(nSteps, nowOf(night))}`).toBe(`${seed}:ok:${nSteps.filter((s) => s.act.t === "chat").length}`);
      const defense = verdictAt(seed, "defense", 3);
      const dSteps = planBotSteps(defense, nowOf(defense), seededRandInt(seed));
      expect(`${seed}:${dSteps.map((s) => s.act.t).join(",")}`).toBe(`${seed}:typing,chat`);
      expect(`${seed}:${pairing(dSteps, nowOf(defense))}`).toBe(`${seed}:ok:1`);
    }
  });

  it("will·pick·point·verdict·endDiscussion·approach 앞에는 typing 이 없다 (typing 수 = chat 수)", () => {
    const phases: RoomState[] = [stateAt(1, 5, 8, "discussion"), stateAt(1, 5, 8, "night"), stateAt(1, 5, 8, "nomination"), verdictAt(3, "verdict", 3)];
    for (const state of phases) {
      const steps = planBotSteps(state, nowOf(state), seededRandInt(7));
      expect(`${state.phase}:${steps.filter((s) => s.act.t === "typing").length}`).toBe(`${state.phase}:${steps.filter((s) => s.act.t === "chat").length}`);
    }
  });

  it("짝 chat 이 마감 여유로 버려지면 그 typing 도 남지 않는다", () => {
    const full = stateAt(1, 5, 1, "discussion");
    // 봇 한 명만 살린다(나머지 봇은 탈락) — 둘째 줄만 마감 여유에 걸리는 것을 한 봇으로 본다.
    const state = markDead(full, ...botsOf(full).slice(1).map((b) => b.seat));
    const now = nowOf(state);
    // randInt 가 항상 0 이면 둘째 줄은 now + 10000. 마감 − 500 이 그 직전이 되게 마감을 당긴다.
    const cut = { ...state, phaseEndsAt: now + 10_300 };
    const steps = planBotSteps(cut, now, () => 0);
    const kinds = steps.filter((s) => s.act.t === "chat" || s.act.t === "typing").map((s) => `${s.act.t}@${s.at - now}`);
    expect(kinds.join(",")).toBe("typing@500,chat@2000");
  });
});

// ---- 결선 투표 계획(09.1.1-05, 결정 0066-4) ----
/** 사람 1(좌석 0) + 봇 5(좌석 1~5) 테스트 방의 결선 투표 창(step 1) 첫 순간. 후보는 좌석 0(방장)·1(봇), 투표자는 봇 2~5. */
function runoffVoteAt(seed: number, step: 0 | 1 | 2 = 1): RoomState {
  const started = startedFrom(withBots(lobbyOf(1), 5), seed, "nomination");
  const nominated = castPoints(started, { 0: 1, 1: 0 });
  let s = tick(nominated, nominated.phaseEndsAt!, seededRandInt(seed + 5));
  if (s.phase !== "runoff") throw new Error(`expected runoff, got ${s.phase}`);
  for (let guard = 0; guard < 4 && (s.runoff?.step ?? 0) < step; guard += 1) {
    const at = s.phaseEndsAt!;
    const r = stepRunoff(s, at);
    s = { ...r.state, phaseEndsAt: at + runoffStepMs(r.state) };
  }
  return s;
}
const runoffNow = (s: RoomState): number => s.phaseEndsAt! - RUNOFF_VOTE_MS;

// 기본판(결정 0072)에서 꺼짐 — RULESET.runoff 을 켜면 다시 돈다
describe.skipIf(!RULESET.runoff)("봇 결선 투표 계획 (09.1.1-05)", () => {
  it("상수: 500 + [0, 2500) ms — 투표 창 5초에서 마감 − 500 안에 든다", () => {
    expect(RUNOFF_BOT_BASE_MS).toBe(500);
    expect(RUNOFF_BOT_SPAN_MS).toBe(2_500);
    expect(RUNOFF_BOT_BASE_MS + RUNOFF_BOT_SPAN_MS).toBeLessThan(RUNOFF_VOTE_MS - 500);
  });

  it("계획 키는 'runoff:{마감}' 이고 단계(step)가 바뀌어 마감이 달라지면 새 계획이 선다", () => {
    const open = runoffVoteAt(3);
    expect(String(botPlanKey(open))).toBe(`runoff:${open.phaseEndsAt}`);
    const synced = syncBotPlan(open, runoffNow(open), seededRandInt(3));
    expect(synced.botPlan?.key).toBe(`runoff:${open.phaseEndsAt}`);
    expect(syncBotPlan(synced, runoffNow(open), THROWING) === synced).toBe(true);
    const result = runoffVoteAt(3, 2);
    expect(String(botPlanKey(result))).not.toBe(String(botPlanKey(open)));
  });

  it("step 1: 후보가 아닌 산 봇마다 point 한 행(후보 둘 중 하나, 500~3000ms, 마감 − 500 안), 입력 중 신호는 없다", () => {
    for (let seed = 1; seed <= 20; seed += 1) {
      const state = runoffVoteAt(seed);
      expect(`${seed}:${state.runoff?.cand.join(",")}:${state.runoff?.step}`).toBe(`${seed}:0,1:1`);
      const now = runoffNow(state);
      const steps = planBotSteps(state, now, seededRandInt(seed));
      expect(`${seed}:${steps.map((st) => st.act.t).join(",")}`).toBe(`${seed}:point,point,point,point`);
      expect(`${seed}:${[...steps].map((st) => state.players.find((p) => p.id === st.botId)!.seat).sort().join(",")}`).toBe(`${seed}:2,3,4,5`);
      for (const st of steps) {
        if (st.act.t !== "point") throw new Error("expected point");
        expect([0, 1].includes(st.act.target)).toBe(true);
        expect(st.at >= now + RUNOFF_BOT_BASE_MS && st.at < now + RUNOFF_BOT_BASE_MS + RUNOFF_BOT_SPAN_MS).toBe(true);
        expect(st.at < state.phaseEndsAt! - 500).toBe(true);
      }
    }
  });

  it("봇 표는 사람과 같은 규칙(castRunoffVote)을 모두 통과한다", () => {
    for (let seed = 1; seed <= 10; seed += 1) {
      const state = runoffVoteAt(seed);
      for (const st of planBotSteps(state, runoffNow(state), seededRandInt(seed))) {
        if (st.act.t !== "point") throw new Error("expected point");
        const r = castRunoffVote(state, st.botId, st.act.target, st.at);
        expect(`${seed}:${r.ok}`).toBe(`${seed}:true`);
      }
    }
  });

  it("후보 봇(좌석 1)·탈락한 봇·앞머리(step 0)·결과(step 2)에는 행동이 없고 randInt 를 부르지 않는다", () => {
    const open = runoffVoteAt(4);
    const dead = markDead(open, 2, 3, 4, 5);
    expect(planBotSteps(dead, runoffNow(open), THROWING).length).toBe(0);
    for (const step of [0, 2] as const) {
      const state = runoffVoteAt(4, step);
      expect(`${step}:${planBotSteps(state, runoffNow(state), THROWING).length}`).toBe(`${step}:0`);
    }
    const onlyOne = markDead(open, 3, 4, 5);
    expect(planBotSteps(onlyOne, runoffNow(open), seededRandInt(1)).map((st) => st.botId).join(",")).toBe(open.players.find((p) => p.seat === 2)!.id);
  });

  it("난수 순서는 봇마다 [2, 2500] 이고 좌석 오름차순이다; 후보 선택은 randInt(2) 번째 후보다", () => {
    const state = runoffVoteAt(6);
    const rec = recording(9);
    planBotSteps(state, runoffNow(state), rec.randInt);
    expect(rec.calls.join(",")).toBe("2,2500,2,2500,2,2500,2,2500");
    for (const pick of [0, 1]) {
      const steps = planBotSteps(state, runoffNow(state), (n) => (n === 2 ? pick : 0));
      expect(steps.map((st) => (st.act.t === "point" ? st.act.target : -1)).join(",")).toBe([pick, pick, pick, pick].join(","));
    }
  });

  it("고정 pick: host 는 방장 후보에게, other 는 방장이 아닌 후보에게 던지고 결정 난수는 건너뛴다(지연 난수는 그대로)", () => {
    const state = runoffVoteAt(6);
    for (const [pick, want] of [["host", 0], ["other", 1]] as const) {
      const rec = recording(9);
      const steps = planBotSteps({ ...state, testBotVote: { pick } }, runoffNow(state), rec.randInt);
      expect(`${pick}:${rec.calls.join(",")}`).toBe(`${pick}:2500,2500,2500,2500`);
      expect(`${pick}:${steps.map((st) => (st.act.t === "point" ? st.act.target : -1)).join(",")}`).toBe(`${pick}:${[want, want, want, want].join(",")}`);
    }
    // 방장이 후보가 아니면 host 고정은 적용되지 않고 무작위로 돌아간다
    const hostOut = { ...state, hostId: state.players.find((p) => p.seat === 3)!.id, testBotVote: { pick: "host" as const } };
    const rec = recording(9);
    planBotSteps(hostOut, runoffNow(state), rec.randInt);
    expect(rec.calls.filter((n) => n === 2).length).toBe(4);
  });

  it("사람이 모두 끊기면 계획이 비어 있다", () => {
    const state = runoffVoteAt(2);
    const gone: RoomState = { ...state, players: state.players.map((p) => (isBot(p) ? p : { ...p, connected: false })) };
    expect(planBotSteps(gone, runoffNow(state), THROWING).length).toBe(0);
  });
});

// ---- 마지막 3인 결전 봇 계획(09.1.1-07, 결정 0066-5) ----
/** 사람 1(좌석 0, 방장) + 봇 4(좌석 1~4) 중 봇 3·4 가 죽은 낮 — 산 사람 0·1·2 의 마지막 3인 모이기(i -1). 차례 순서 [0, 1, 2], 봇은 1·2. */
function showdownGatherOf(seed: number): RoomState {
  const day = startedFrom(withBots(lobbyOf(1), 4), seed, "dayAnnounce");
  const arranged = markDead(day, 3, 4);
  const s = tick(arranged, arranged.phaseEndsAt!, seededRandInt(seed + 1));
  if (s.phase !== "showdown") throw new Error(`expected showdown, got ${s.phase}`);
  return s;
}
/** 마감 시각에 한 걸음(시간 초과로 넘김). 새 마감은 지난 마감 + 새 단계 길이. */
function showdownStep(s: RoomState): RoomState {
  const at = s.phaseEndsAt!;
  const r = stepShowdown(s, at);
  if (!r.stay) throw new Error("showdown resolved early");
  return { ...r.state, phaseEndsAt: at + showdownStepMs(r.state) };
}
/** 차례 i(0..2) 시작 순간 / 동시 지목 창(i 3) 시작 순간. 앞 차례는 시간 초과로 넘긴다. */
function showdownTurnAt(seed: number, i: number): RoomState {
  let s = showdownGatherOf(seed);
  for (let guard = 0; guard < 20 && !(s.showdown!.i === i && s.showdown!.doneAt === undefined); guard += 1) s = showdownStep(s);
  return s;
}
const turnNow = (s: RoomState): number => s.phaseEndsAt! - SHOWDOWN_TURN_MS;
const pointNow = (s: RoomState): number => s.phaseEndsAt! - SHOWDOWN_POINT_MS;
const idAt = (s: RoomState, seat: number): string => s.players.find((p) => p.seat === seat)!.id;

// 기본판(결정 0072)에서 꺼짐 — RULESET.showdown 을 켜면 다시 돈다
describe.skipIf(!RULESET.showdown)("봇 마지막 3인 계획 (09.1.1-07)", () => {
  it("상수: 지목 지연 500 + [0, 2500) ms — 지목 창 8초에서 마감 − 500 안에 든다", () => {
    expect(SHOWDOWN_BOT_POINT_BASE_MS).toBe(500);
    expect(SHOWDOWN_BOT_POINT_SPAN_MS).toBe(2_500);
    expect(SHOWDOWN_BOT_POINT_BASE_MS + SHOWDOWN_BOT_POINT_SPAN_MS).toBeLessThan(SHOWDOWN_POINT_MS - 500);
  });

  it("계획 키는 'showdown:{마감}' 이고 세부 단계가 넘어가 마감이 달라질 때마다 새 계획이 선다", () => {
    let s = showdownGatherOf(3);
    const keys: string[] = [];
    for (let k = 0; k < 8 && s.phase === "showdown"; k += 1) {
      expect(String(botPlanKey(s))).toBe(`showdown:${s.phaseEndsAt}`);
      keys.push(String(botPlanKey(s)));
      s = showdownStep(s);
    }
    expect(new Set(keys).size).toBe(keys.length);
    const synced = syncBotPlan(showdownTurnAt(3, 1), turnNow(showdownTurnAt(3, 1)), seededRandInt(3));
    expect(synced.botPlan?.key).toBe(`showdown:${synced.phaseEndsAt}`);
  });

  it("모이는 중·사람 차례·확정 뒤 사이·공개에는 봇 행동이 없고 randInt 를 부르지 않는다", () => {
    const gather = showdownGatherOf(4);
    expect(`gather:${planBotSteps(gather, gather.phaseEndsAt! - 2000, THROWING).length}`).toBe("gather:0");
    const human = showdownTurnAt(4, 0); // 차례 주인은 사람(좌석 0)
    expect(`human:${planBotSteps(human, turnNow(human), THROWING).length}`).toBe("human:0");
    const gap = showdownStep(showdownTurnAt(4, 1)); // 봇 차례가 시간 초과로 확정된 뒤 사이
    expect(`gap:${gap.showdown!.doneAt !== undefined}:${planBotSteps(gap, gap.phaseEndsAt!, THROWING).length}`).toBe("gap:true:0");
    let reveal = showdownTurnAt(4, 3);
    reveal = showdownStep(reveal);
    expect(`reveal:${reveal.showdown!.i}:${planBotSteps(reveal, reveal.phaseEndsAt!, THROWING).length}`).toBe("reveal:4:0");
  });

  it("봇 차례: 차례 시작 시각에 LAST_WORD_CHIPS 중 하나를 chat 한 줄로 — 그 봇만, 입력 중 단계 없이, randInt(4) 한 번뿐", () => {
    for (const [i, seat] of [[1, 1], [2, 2]] as const) {
      const s = showdownTurnAt(5, i);
      expect(`${i}:${s.showdown!.order[i]}`).toBe(`${i}:${seat}`);
      const rec = recording(7);
      const steps = planBotSteps(s, turnNow(s), rec.randInt);
      expect(`${i}:${rec.calls.join(",")}`).toBe(`${i}:4`);
      expect(`${i}:${steps.map((st) => `${st.act.t}:${st.botId === idAt(s, seat)}:${st.at - turnNow(s)}`).join("|")}`).toBe(`${i}:chat:true:0`);
      const text = (steps[0]!.act as { text: string }).text;
      expect(LAST_WORD_CHIPS.includes(text)).toBe(true);
      // 사람과 같은 규칙(정리 → 30자소)을 지나 그 차례의 한마디가 된다
      expect(sanitizeChatText(text)).toEqual({ ok: true, text });
      expect(acceptLastWord(s, idAt(s, seat), text, steps[0]!.at).kind).toBe("ok");
    }
    const s = showdownTurnAt(5, 1);
    for (let k = 0; k < LAST_WORD_CHIPS.length; k += 1) {
      const steps = planBotSteps(s, turnNow(s), (n) => (n === 4 ? k : 0));
      expect((steps[0]!.act as { text: string }).text).toBe(LAST_WORD_CHIPS[k]);
    }
  });

  it("동시 지목: 산 봇마다 좌석 오름차순으로 [2, 2500] — 자기를 뺀 산 사람 하나, 500~3000ms, 마감 − 500 안, 사람과 같은 규칙을 통과한다", () => {
    for (let seed = 1; seed <= 20; seed += 1) {
      const s = showdownTurnAt(seed, 3);
      expect(`${seed}:${s.showdown!.i}`).toBe(`${seed}:3`);
      const now = pointNow(s);
      const rec = recording(seed);
      const steps = planBotSteps(s, now, rec.randInt);
      expect(`${seed}:${rec.calls.join(",")}`).toBe(`${seed}:2,2500,2,2500`);
      expect(`${seed}:${steps.map((st) => st.act.t).join(",")}`).toBe(`${seed}:point,point`);
      expect(`${seed}:${steps.map((st) => s.players.find((p) => p.id === st.botId)!.seat).sort().join(",")}`).toBe(`${seed}:1,2`);
      for (const st of steps) {
        if (st.act.t !== "point") throw new Error("expected point");
        const seat = s.players.find((p) => p.id === st.botId)!.seat;
        expect(`${seed}:${seat}:${st.act.target !== seat && [0, 1, 2].includes(st.act.target)}`).toBe(`${seed}:${seat}:true`);
        expect(st.at >= now + SHOWDOWN_BOT_POINT_BASE_MS && st.at < now + SHOWDOWN_BOT_POINT_BASE_MS + SHOWDOWN_BOT_POINT_SPAN_MS).toBe(true);
        expect(st.at < s.phaseEndsAt! - 500).toBe(true);
        expect(`${seed}:${seat}:${castShowdownPoint(s, st.botId, st.act.target, st.at).ok}`).toBe(`${seed}:${seat}:true`);
      }
    }
  });

  it("지목 대상은 randInt(2) 번째 후보다(자기를 뺀 산 사람 좌석 오름차순): 봇 1 은 [0, 2], 봇 2 는 [0, 1]", () => {
    const s = showdownTurnAt(6, 3);
    for (const pick of [0, 1]) {
      const steps = planBotSteps(s, pointNow(s), (n) => (n === 2 ? pick : 0));
      const bySeatTarget = steps.map((st) => `${s.players.find((p) => p.id === st.botId)!.seat}>${st.act.t === "point" ? st.act.target : "-"}`).join(",");
      expect(`${pick}:${bySeatTarget}`).toBe(pick === 0 ? "0:1>0,2>0" : "1:1>2,2>1");
    }
  });

  it("고정 pick: host 는 방장에게, other 는 방장이 아닌 사람에게 — 결정 난수는 건너뛰고 지연 난수만 부른다", () => {
    const s = showdownTurnAt(6, 3);
    for (const [pick, want] of [["host", "1>0,2>0"], ["other", "1>2,2>1"]] as const) {
      const rec = recording(9);
      const steps = planBotSteps({ ...s, testBotVote: { pick } }, pointNow(s), rec.randInt);
      expect(`${pick}:${rec.calls.join(",")}`).toBe(`${pick}:2500,2500`);
      expect(`${pick}:${steps.map((st) => `${s.players.find((p) => p.id === st.botId)!.seat}>${st.act.t === "point" ? st.act.target : "-"}`).join(",")}`).toBe(`${pick}:${want}`);
    }
  });

  it("탈락한 봇·사람이 모두 끊긴 방에는 계획이 없다", () => {
    const s = showdownTurnAt(2, 3);
    const gone: RoomState = { ...s, players: s.players.map((p) => (isBot(p) ? p : { ...p, connected: false })) };
    expect(planBotSteps(gone, pointNow(s), THROWING).length).toBe(0);
    const oneDead = markDead(s, 2);
    expect(planBotSteps(oneDead, pointNow(s), seededRandInt(1)).map((st) => st.botId).join(",")).toBe(idAt(s, 1));
  });
});

// ---- 13-02: 기본판 동시 투표 봇 계획 (결정 0072, D-03, FLOW-05) ----
describe("기본판 투표 봇 계획 (결정 0072)", () => {
  /** 사람 1(방장) + 봇 3 이 tick 으로 투표(nomination)에 닿은 상태 — 기본판이라 pickTurn 이 없다. */
  const voteAt = (seed: number): RoomState => stateAt(1, 3, seed, "nomination");
  const pointsOf = (steps: BotStep[]): BotStep[] => steps.filter((x) => x.act.t === "point");

  it("투표 진입에는 pickTurn 이 없고, 산 봇마다 point 한 행이 2000~8000ms 안에 선다", () => {
    for (let seed = 1; seed <= 10; seed += 1) {
      const state = voteAt(seed);
      expect(String(state.pickTurn)).toBe("undefined");
      const now = nowOf(state);
      const steps = planBotSteps(state, now, seededRandInt(seed));
      const points = pointsOf(steps);
      expect(botsOf(state).map((b) => `${b.seat}:${rowsOf(points, b.id).length}`).join(",")).toBe("1:1,2:1,3:1");
      for (const row of points) {
        expect(row.at >= now + 2_000 && row.at < now + 8_000).toBe(true);
        expect(row.at <= state.phaseEndsAt! - 500).toBe(true);
      }
    }
  });

  it("대상은 자기를 뺀 산 사람이고 사람과 같은 castPoint 를 통과한다", () => {
    const state = voteAt(4);
    const points = pointsOf(planBotSteps(state, nowOf(state), seededRandInt(9)));
    let next = state;
    for (const row of points) {
      const bot = state.players.find((p) => p.id === row.botId)!;
      const target = (row.act as { t: "point"; target: number }).target;
      expect(target === bot.seat).toBe(false);
      const cast = castPoint(next, bot.id, target);
      expect(cast.ok).toBe(true);
      if (cast.ok) next = cast.state;
    }
    expect(botsOf(next).every((b) => b.nominate !== undefined)).toBe(true);
  });

  it("난수 순서는 봇마다 [후보 수 3, 6000] 이고 좌석 오름차순이다; 같은 시드면 같은 계획이다", () => {
    const state = voteAt(5);
    const rec = recording(11);
    const a = planBotSteps(state, nowOf(state), rec.randInt);
    const pointCalls = rec.calls;
    expect(pointCalls.join(",")).toBe("3,6000,3,6000,3,6000");
    const b = planBotSteps(state, nowOf(state), seededRandInt(11));
    expect(canon(a)).toBe(canon(b));
  });

  it("탈락한 봇에는 계획이 없고, 사람이 모두 끊기면 계획이 비어 있다", () => {
    const state = voteAt(6);
    const dead = markDead(state, 2);
    const points = pointsOf(planBotSteps(dead, nowOf(dead), seededRandInt(3)));
    expect(points.map((r) => r.botId === botsOf(dead)[1]!.id).includes(true)).toBe(false);
    expect(points.length).toBe(2);
    const gone: RoomState = { ...state, players: state.players.map((p) => (isBot(p) ? p : { ...p, connected: false })) };
    expect(planBotSteps(gone, nowOf(gone), THROWING).length).toBe(0);
  });

  it("고정 pick: host 는 모든 봇이 방장에게, other 는 방장이 아닌 고정 좌석에게 던지고 결정 난수는 건너뛴다", () => {
    const state = voteAt(7);
    const hostSeat = state.players.find((p) => p.id === state.hostId)!.seat;
    const host = recording(5);
    const hostPoints = pointsOf(planBotSteps({ ...state, testBotVote: { pick: "host" } }, nowOf(state), host.randInt));
    expect(hostPoints.map((r) => (r.act as { target: number }).target).join(",")).toBe(`${hostSeat},${hostSeat},${hostSeat}`);
    expect(host.calls.join(",")).toBe("6000,6000,6000");
    const other = pointsOf(planBotSteps({ ...state, testBotVote: { pick: "other" } }, nowOf(state), seededRandInt(5)));
    expect(other.length).toBe(3);
    expect(other.every((r) => (r.act as { target: number }).target !== hostSeat)).toBe(true);
  });

  it("계획 키는 'nomination:{마감}' 이다", () => {
    const state = voteAt(8);
    expect(String(botPlanKey(state))).toBe(`nomination:${state.phaseEndsAt}`);
    const synced = syncBotPlan(state, nowOf(state), seededRandInt(2));
    expect(synced.botPlan?.key).toBe(`nomination:${state.phaseEndsAt}`);
    expect(synced.botPlan?.steps.length).toBe(3);
  });

  it.skipIf(RULESET.pickTurn)("RULESET.pickTurn 이 꺼져 있으면 turnPointSteps 의 순차 계획은 쓰이지 않는다", () => {
    const state = voteAt(9);
    const steps = planBotSteps(state, nowOf(state), seededRandInt(1));
    expect(steps.every((x) => x.act.t === "point")).toBe(true);
  });
});
