// 테스트 방 서버 봇 규칙(quick 261025-fx1, 결정 0024): setBotCount·bots.ts 순수 규칙을 확인한다.
// 실패 출력은 한 줄이어야 해서(TAP) 상태 비교는 키 순서를 맞춘 문자열로, 목록 비교는 요약 문자열로 한다.
import { describe, expect, it } from "vitest";
import { nicknameKey, validateNickname } from "../../shared/nickname";
import {
  BOT_NAMES,
  botClaimChoice,
  botCount,
  botCandidateTarget,
  botExecAgree,
  botNightTarget,
  botPlanKey,
  botWakeAt,
  isBot,
  planBotSteps,
  syncBotPlan,
  takeDueBotSteps,
} from "../../shared/game/bots";
import type { BotStep } from "../../shared/game/bots";
import { claimOptions, currentClaimSeat, selectClaim } from "../../shared/game/claim";
import { emote, say } from "../../shared/game/chat";
import { pickTarget } from "../../shared/game/night";
import { PHASE_DEFS } from "../../shared/game/phases";
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
import { startedFrom, stateWithVerdict } from "../helpers/voteState";
import { castCandidateVote, castExecVote } from "../../shared/game/vote";

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
  const result = setBotCount(state, state.hostId, count, idMaker());
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
/** claim 단계에서 지금 차례를 seat 의 사람으로 옮긴 상태(차례 순서에 그 seat 가 있어야 한다). */
const atTurnOf = (st: RoomState, seat: number): RoomState => ({ ...st, claimIdx: st.claimOrder!.indexOf(seat) });
/** claim 계획 키: 단계:마감:차례 번호(결정 0027-10). */
const claimKey = (st: RoomState): string => `claim:${st.phaseEndsAt}:${st.claimIdx ?? 0}`;

describe("BOT_NAMES", () => {
  it("일곱 이름이 모두 닉네임 규칙을 통과하고 5자 이하이며 비교 키가 서로 다르다", () => {
    expect(BOT_NAMES.length).toBe(7);
    const keys = new Set<string>();
    for (const name of BOT_NAMES) {
      const checked = validateNickname(name);
      expect(`${name}:${checked.ok}`).toBe(`${name}:true`);
      expect(`${name}:${[...name].length <= 5}`).toBe(`${name}:true`);
      keys.add(nicknameKey(name));
    }
    expect(keys.size).toBe(7);
  });
});

describe("setBotCount 거부", () => {
  it("일반 방은 방장이어도 BAD_MESSAGE 다", () => {
    const state = lobbyOf(2, false);
    const result = setBotCount(state, HOST_ID, 3, idMaker());
    expect(result.ok ? "ok" : result.error).toBe("BAD_MESSAGE");
  });
  it("테스트 방 손님은 NOT_HOST 다", () => {
    const state = lobbyOf(2);
    const result = setBotCount(state, "player-id-0001-aaaa", 3, idMaker());
    expect(result.ok ? "ok" : result.error).toBe("NOT_HOST");
  });
  it("대기실 밖은 WRONG_PHASE 다", () => {
    const state = stateAt(4, 0, 1, "roleReveal");
    const result = setBotCount(state, HOST_ID, 1, idMaker());
    expect(result.ok ? "ok" : result.error).toBe("WRONG_PHASE");
  });
  it("count -1·8·1.5 는 BAD_MESSAGE 다", () => {
    for (const count of [-1, MAX_TEST_BOTS + 1, 1.5, Number.NaN]) {
      const result = setBotCount(lobbyOf(1), HOST_ID, count, idMaker());
      expect(`${count}:${result.ok ? "ok" : result.error}`).toBe(`${count}:BAD_MESSAGE`);
    }
  });
  it("검사 순서는 testMode → 방장 → 대기실 → 개수다", () => {
    const normal = lobbyOf(2, false);
    expect(canon(setBotCount(normal, "player-id-0001-aaaa", -1, idMaker()))).toBe('{"error":"BAD_MESSAGE","ok":false}');
    const started = stateAt(4, 0, 1, "roleReveal");
    const guestId = "player-id-0001-aaaa";
    expect(canon(setBotCount(started, guestId, -1, idMaker()))).toBe('{"error":"NOT_HOST","ok":false}');
    expect(canon(setBotCount(started, HOST_ID, -1, idMaker()))).toBe('{"error":"WRONG_PHASE","ok":false}');
  });
  it("거부는 입력 상태를 바꾸지 않는다", () => {
    const state = withBots(lobbyOf(2), 2);
    const before = canon(state);
    setBotCount(state, "player-id-0001-aaaa", 3, idMaker());
    setBotCount(state, HOST_ID, 8, idMaker());
    setBotCount(lobbyOf(2, false), HOST_ID, 3, idMaker());
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
    expect(bots.map((b) => b.nickname).join(",")).toBe(BOT_NAMES.slice(0, 4).join(","));
    expect(bots.every((b) => b.isBot === true && b.connected && b.connId === null && b.token === "")).toBe(true);
    expect(bots.map((b) => b.id).join(",")).toBe([1, 2, 3, 4].map((n) => `bot-id-${n}-bbbbbbbb`).join(","));
    expect(bots.map((b) => b.joinSeq).join(",")).toBe(
      [0, 1, 2, 3].map((i) => lobby.nextJoinSeq + i).join(","),
    );
    expect(next.nextJoinSeq).toBe(lobby.nextJoinSeq + 4);
    expect(canon(next.players.find((p) => p.id === HOST_ID))).toBe(before);
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
    const again = setBotCount(three, HOST_ID, 3, idMaker());
    expect(again.ok && again.state === three).toBe(true);
    const zero = setBotCount(lobbyOf(1), HOST_ID, 0, idMaker());
    expect(zero.ok && zero.state.players.length === 1).toBe(true);
  });

  it("사람 닉네임이 첫 봇 이름이면 봇은 둘째 이름부터 쓰고 비교 키가 겹치지 않는다", () => {
    const created = createRoomState({
      code: "0420", hostId: HOST_ID, hostToken: "token-secret-0000-aaaa-0123456789", hostNickname: BOT_NAMES[0]!, now: 0, testMode: true,
    });
    if (!created.ok) throw new Error("createRoomState failed");
    const next = withBots(created.state, 2);
    expect(botsOf(next).map((b) => b.nickname).join(",")).toBe(`${BOT_NAMES[1]},${BOT_NAMES[2]}`);
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
    const game = stateAt(2, 3, 5, "claim");
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
    const game = syncBotPlan(stateAt(2, 3, 7, "claim"), 1000, seededRandInt(1));
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

describe("botClaimChoice", () => {
  /** 지금 차례가 그 봇인 claim 상태. stateAt 의 첫 차례는 방장(사람)이다. */
  const botTurn = (humans: number, bots: number, seed: number): { state: RoomState; bot: Player } => {
    const base = stateAt(humans, bots, seed, "claim");
    const bot = botsOf(base)[0]!;
    return { state: atTurnOf(base, bot.seat), bot };
  };

  it("차례인 봇: seed 1~1000 의 값은 모두 claimOptions 안이고 none 비율이 8~22% 이며 delayMs 는 500 이상 3500 미만이다", () => {
    const { state, bot } = botTurn(1, 4, 9);
    expect(currentClaimSeat(state)).toBe(bot.seat);
    const options = claimOptions(state.players.length);
    let none = 0;
    let bad = 0;
    for (let seed = 1; seed <= 1000; seed += 1) {
      const choice = botClaimChoice(state, bot, seededRandInt(seed));
      if (choice === null) {
        bad += 1;
        continue;
      }
      if (!options.includes(choice.claim)) bad += 1;
      if (choice.delayMs < 500 || choice.delayMs >= 3500) bad += 1;
      if (choice.claim === "none") none += 1;
    }
    expect(bad).toBe(0);
    expect(none >= 80 && none <= 220).toBe(true);
  });

  it("그 봇 차례가 아니면 null 이고 난수 함수를 한 번도 부르지 않는다(호출 횟수 0)", () => {
    const base = stateAt(1, 4, 9, "claim"); // 지금 차례는 방장
    for (const bot of botsOf(base)) {
      let calls = 0;
      const counting = (): number => {
        calls += 1;
        return 0;
      };
      expect(`${bot.seat}:${String(botClaimChoice(base, bot, counting))}`).toBe(`${bot.seat}:null`);
      expect(`${bot.seat}:${calls}`).toBe(`${bot.seat}:0`);
    }
    const second = botsOf(base)[1]!;
    const firstBotTurn = atTurnOf(base, botsOf(base)[0]!.seat); // 다른 봇의 차례
    expect(String(botClaimChoice(firstBotTurn, second, THROWING))).toBe("null");
  });

  it("claim 단계가 아니면 차례인 봇이어도 null 이고 난수 함수를 부르지 않는다", () => {
    const base = stateAt(1, 4, 9, "discussion");
    for (const bot of botsOf(base)) expect(`${bot.seat}:${String(botClaimChoice(base, bot, THROWING))}`).toBe(`${bot.seat}:null`);
  });

  it("탈락한 봇은 null 이다", () => {
    const { state, bot } = botTurn(1, 4, 9);
    const dead = markDead(state, bot.seat);
    expect(String(botClaimChoice(dead, dead.players.find((p) => p.id === bot.id)!, THROWING))).toBe("null");
  });

  it("차례인 봇의 난수 호출 순서는 예전과 같다(randInt(100) → randInt(직업 수) → randInt(3000))", () => {
    const { state, bot } = botTurn(1, 3, 3);
    const calls: number[] = [];
    botClaimChoice(state, bot, (n) => {
      calls.push(n);
      return n === 100 ? 99 : 0; // 말 안 함 15% 를 피해 직업 추첨까지 가게 한다
    });
    expect(calls.join(",")).toBe([100, rolesInPlay(state.players.length).length, 3000].join(","));
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

const stepsOf = (s: RoomState): BotStep[] => s.botPlan?.steps ?? [];
/** 단계가 막 시작한 시각(마감 - 단계 길이). 대기실처럼 마감이 없으면 0. */
const nowOf = (s: RoomState): number => (s.phaseEndsAt === null ? 0 : s.phaseEndsAt - (PHASE_DEFS[s.phase].durationMs ?? 0));

describe("botPlanKey·syncBotPlan·planBotSteps", () => {
  it("discussion·night 는 단계 이름과 마감을 이은 키를, claim 은 거기에 차례 번호를 더한 키를 낸다", () => {
    for (const phase of ["discussion", "night"] as const) {
      const state = stateAt(1, 4, 3, phase);
      expect(String(botPlanKey(state))).toBe(`${phase}:${state.phaseEndsAt}`);
    }
    const claim = stateAt(1, 4, 3, "claim");
    expect(String(botPlanKey(claim))).toBe(`claim:${claim.phaseEndsAt}:0`);
    const second = atTurnOf(claim, botsOf(claim)[1]!.seat);
    expect(String(botPlanKey(second))).toBe(`claim:${claim.phaseEndsAt}:2`);
    const { claimIdx: _idx, ...noIdx } = claim;
    expect(String(botPlanKey(noIdx))).toBe(`claim:${claim.phaseEndsAt}:0`);
    for (const phase of ["lobby", "assigning", "roleReveal", "dayAnnounce", "morning"] as const) {
      const state = phase === "lobby" ? withBots(lobbyOf(1), 4) : stateAt(1, 4, 3, phase);
      expect(`${phase}:${String(botPlanKey(state))}`).toBe(`${phase}:null`);
    }
  });

  it("봇 없는 방은 모든 단계에서 입력 그대로이고 randInt 를 부르지 않는다", () => {
    for (const phase of ["claim", "discussion", "night", "morning"] as const) {
      const state = stateAt(4, 0, 3, phase);
      expect(syncBotPlan(state, nowOf(state), THROWING) === state).toBe(true);
    }
    const lobby = lobbyOf(3);
    expect(syncBotPlan(lobby, nowOf(lobby), THROWING) === lobby).toBe(true);
  });

  it("봇이 없는데 botPlan 이 남아 있으면 키를 뺀다", () => {
    const state = { ...stateAt(4, 0, 3, "claim"), botPlan: { key: "x", steps: [] } };
    expect(Object.hasOwn(syncBotPlan(state, nowOf(state), THROWING), "botPlan")).toBe(false);
  });

  it("봇 계획이 필요 없는 단계에서는 botPlan 키가 없다", () => {
    for (const phase of ["lobby", "assigning", "roleReveal", "dayAnnounce", "morning"] as const) {
      const base = phase === "lobby" ? withBots(lobbyOf(1), 4) : stateAt(1, 4, 3, phase);
      const result = syncBotPlan({ ...base, botPlan: { key: "old", steps: [] } }, nowOf(base), seededRandInt(1));
      expect(`${phase}:${Object.hasOwn(result, "botPlan")}`).toBe(`${phase}:false`);
    }
  });

  it("claim: 지금 차례가 봇이면 그 봇 한 명의 claim 행 하나뿐이고 시각이 범위 안이며 selectClaim 에 통과한다", () => {
    for (let seed = 1; seed <= 20; seed += 1) {
      const base = markDead(stateAt(1, 5, seed, "claim"), 2);
      const order = base.claimOrder!;
      for (const bot of botsOf(base).filter((b) => b.alive !== false)) {
        if (!order.includes(bot.seat)) continue;
        const state = atTurnOf(base, bot.seat);
        const steps = planBotSteps(state, nowOf(state), seededRandInt(seed));
        const label = `${seed}:${bot.seat}`;
        expect(`${label}:${steps.length}`).toBe(`${label}:1`);
        const step = steps[0]!;
        expect(`${label}:${step.botId === bot.id && step.act.t === "claim"}`).toBe(`${label}:true`);
        expect(`${label}:${step.at > nowOf(state) && step.at < state.phaseEndsAt! - 500}`).toBe(`${label}:true`);
        if (step.act.t !== "claim") continue;
        const r = selectClaim(state, step.botId, step.act.claim, step.at);
        expect(`${label}:${r.ok ? "ok" : r.error}`).toBe(`${label}:ok`);
      }
    }
  });

  it("claim: 지금 차례가 사람이면 빈 배열이고 다른 봇의 난수도 쓰지 않는다", () => {
    for (let seed = 1; seed <= 20; seed += 1) {
      const state = stateAt(1, 5, seed, "claim"); // 첫 차례는 방장(사람)
      expect(`${seed}:${planBotSteps(state, nowOf(state), THROWING).length}`).toBe(`${seed}:0`);
    }
  });

  it("claim: 차례인 봇이 아닌 봇의 난수는 쓰지 않는다 — 호출 횟수는 차례인 봇 한 명 몫(3)뿐이다", () => {
    const base = stateAt(1, 4, 5, "claim");
    const state = atTurnOf(base, botsOf(base)[2]!.seat);
    let calls = 0;
    planBotSteps(state, nowOf(state), (n) => {
      calls += 1;
      return n === 100 ? 99 : 0;
    });
    expect(calls).toBe(3);
  });

  it("discussion 은 살아 있는 봇마다 정확히 2개(토론 40초 안, 결정 0039)이고 같은 봇 간격이 2000 이상이며 say·emote 에 모두 통과한다", () => {
    for (let seed = 1; seed <= 20; seed += 1) {
      let state = markDead(stateAt(1, 5, seed, "discussion"), 3);
      const steps = planBotSteps(state, nowOf(state), seededRandInt(seed));
      for (const bot of botsOf(state)) {
        const mine = steps.filter((s) => s.botId === bot.id);
        const expected = bot.alive === false ? 0 : -1;
        if (expected === 0) expect(`${seed}:${mine.length}`).toBe(`${seed}:0`);
        else expect(`${seed}:${mine.length}`).toBe(`${seed}:2`);
        if (mine.length === 2) expect(mine[1]!.at - mine[0]!.at >= 2000).toBe(true);
      }
      expect(steps.every((s) => s.at < state.phaseEndsAt! - 500 && s.at > nowOf(state))).toBe(true);
      for (const s of steps) {
        const r =
          s.act.t === "say"
            ? say(state, s.botId, { template: s.act.template, target: s.act.target, claimedRole: s.act.claimedRole }, s.at)
            : s.act.t === "emoji"
              ? emote(state, s.botId, s.act.icon, s.at)
              : ({ ok: false, error: "BAD_ACT" } as const);
        expect(`${seed}:${r.ok ? "ok" : r.error}`).toBe(`${seed}:ok`);
        if (r.ok) state = r.state;
      }
    }
  });

  it("night 는 살아 있는 마피아·경찰·의사 봇마다 pick 하나이고 pickTarget 에 통과하며 시민은 pick 이 없다", () => {
    for (let seed = 1; seed <= 30; seed += 1) {
      let state = markDead(stateAt(1, 5, seed, "night"), 4);
      const steps = planBotSteps(state, nowOf(state), seededRandInt(seed));
      for (const bot of botsOf(state)) {
        const picks = steps.filter((s) => s.botId === bot.id && s.act.t === "pick");
        const acting = bot.alive !== false && bot.role !== "citizen";
        expect(`${seed}:${bot.seat}:${picks.length}`).toBe(`${seed}:${bot.seat}:${acting ? 1 : 0}`);
        if (bot.role !== "mafia") {
          expect(`${seed}:${bot.seat}:${steps.filter((s) => s.botId === bot.id).length}`).toBe(`${seed}:${bot.seat}:${acting ? 1 : 0}`);
        }
      }
      expect(steps.every((s) => s.at < state.phaseEndsAt! - 500 && s.at > nowOf(state))).toBe(true);
      for (const s of steps) {
        const r =
          s.act.t === "pick"
            ? pickTarget(state, s.botId, s.act.target)
            : s.act.t === "say"
              ? say(state, s.botId, { template: s.act.template }, s.at)
              : s.act.t === "emoji"
                ? emote(state, s.botId, s.act.icon, s.at)
                : ({ ok: false, error: "BAD_ACT" } as const);
        expect(`${seed}:${r.ok ? "ok" : r.error}`).toBe(`${seed}:ok`);
        if (r.ok) state = r.state;
      }
    }
  });

  it("탈락한 봇은 어느 단계에도 행동이 없다", () => {
    for (const phase of ["claim", "discussion", "night"] as const) {
      const base = stateAt(1, 5, 11, phase);
      const state = markDead(base, ...botsOf(base).map((b) => b.seat));
      expect(`${phase}:${planBotSteps(state, nowOf(state), seededRandInt(1)).length}`).toBe(`${phase}:0`);
    }
  });

  it("사람이 모두 끊긴 상태면 steps 가 비어 있고 randInt 를 부르지 않는다", () => {
    for (const phase of ["claim", "discussion", "night"] as const) {
      const base = stateAt(2, 4, 6, phase);
      const state: RoomState = { ...base, players: base.players.map((p) => (isBot(p) ? p : { ...p, connected: false })) };
      expect(`${phase}:${planBotSteps(state, nowOf(state), THROWING).length}`).toBe(`${phase}:0`);
    }
  });

  it("같은 시드·같은 now 는 같은 계획이다", () => {
    for (const phase of ["claim", "discussion", "night"] as const) {
      const state = stateAt(1, 5, 8, phase);
      expect(canon(planBotSteps(state, nowOf(state), seededRandInt(42)))).toBe(canon(planBotSteps(state, nowOf(state), seededRandInt(42))));
    }
  });

  it("차례가 넘어가 claimIdx 가 바뀌면 키가 달라져 새 계획이 서고, 같은 차례에서는 입력 그대로다", () => {
    const first = stateAt(1, 4, 3, "claim"); // 방장 차례
    const hostPlan = syncBotPlan(first, nowOf(first), seededRandInt(1));
    expect(`${hostPlan.botPlan?.key}:${stepsOf(hostPlan).length}`).toBe(`${claimKey(first)}:0`);
    // 방장이 고르면 다음 차례는 봇 seat 1 이다(selectClaim 이 마감을 당기고 tick 이 넘긴다).
    const picked = selectClaim(hostPlan, HOST_ID, "police", hostPlan.phaseEndsAt! - 4000);
    if (!picked.ok) throw new Error(`selectClaim failed: ${picked.error}`);
    const botTurn = tick(picked.state, picked.state.phaseEndsAt!, seededRandInt(2));
    expect(`${botTurn.phase}:${botTurn.claimIdx}:${currentClaimSeat(botTurn)}`).toBe("claim:1:1");
    expect(String(botPlanKey(botTurn))).toBe(claimKey(botTurn));
    expect(String(botWakeAt(botTurn))).toBe("null"); // 이월된 낡은 계획의 시각이 새 차례를 깨우지 않는다
    const synced = syncBotPlan(botTurn, nowOf(botTurn), seededRandInt(3));
    expect(`${synced.botPlan?.key}:${stepsOf(synced).length}:${stepsOf(synced)[0]?.botId}`).toBe(`${claimKey(botTurn)}:1:${botsOf(botTurn)[0]!.id}`);
    expect(syncBotPlan(synced, nowOf(botTurn) + 5, THROWING) === synced).toBe(true);
    // 마감이 우연히 같아도 차례 번호가 다르면 키가 다르다(테스트 넘기기 연타).
    const sameDeadline = { ...synced, claimIdx: 2 };
    expect(botPlanKey(sameDeadline) === synced.botPlan?.key).toBe(false);
  });

  it("같은 단계 키로 다시 부르면 입력 그대로이고 tick 으로 다음 단계에 가면 새 키의 계획이다", () => {
    const claim0 = stateAt(1, 4, 3, "claim");
    const claim = syncBotPlan(claim0, nowOf(claim0), seededRandInt(1));
    expect(Object.hasOwn(claim, "botPlan")).toBe(true);
    expect(syncBotPlan(claim, nowOf(claim) + 5, THROWING) === claim).toBe(true);
    let discussion = claim; // 차례제(결정 0023): claim 은 차례마다 마감이 오므로 낮 토론까지 마감마다 한 번씩 tick 한다
    while (discussion.phase === "claim") discussion = tick(discussion, discussion.phaseEndsAt!, seededRandInt(2));
    expect(discussion.phase).toBe("discussion");
    const next = syncBotPlan(discussion, nowOf(discussion), seededRandInt(5));
    expect(String(next.botPlan?.key)).toBe(`discussion:${discussion.phaseEndsAt}`);
    expect(stepsOf(next).length > 0).toBe(true);
  });

  it("행동은 at 오름차순이다", () => {
    const state = stateAt(1, 7, 8, "discussion");
    const ats = planBotSteps(state, nowOf(state), seededRandInt(3)).map((s) => s.at);
    expect(ats.join(",")).toBe([...ats].sort((a, b) => a - b).join(","));
  });

  it("claim 계획의 호출 순서가 시드 계약과 같다(15% 말 안 함 → 직업 → 지연) — 차례인 봇 한 명 몫만", () => {
    const base = stateAt(1, 3, 3, "claim");
    const state = atTurnOf(base, botsOf(base)[1]!.seat);
    const calls: number[] = [];
    const recorder = (n: number): number => {
      calls.push(n);
      return n === 100 ? 99 : 0; // 말 안 함 15% 를 피해 직업 추첨까지 가게 한다
    };
    planBotSteps(state, nowOf(state), recorder);
    expect(calls.join(",")).toBe([100, rolesInPlay(state.players.length).length, 3000].join(","));
  });
});

describe("takeDueBotSteps·botWakeAt", () => {
  const plan = (key: string): RoomState => {
    const state = stateAt(1, 4, 3, "claim");
    const bot = botsOf(state)[0]!;
    const step = (at: number): BotStep => ({ at, botId: bot.id, act: { t: "claim", claim: "none" } });
    return { ...state, botPlan: { key, steps: [step(10), step(20), step(30)] } };
  };

  it("at 이하인 행동만 순서대로 꺼내고 나머지를 남긴다", () => {
    const state = plan(claimKey(stateAt(1, 4, 3, "claim")));
    const { state: rest, due } = takeDueBotSteps(state, 20);
    expect(due.map((s) => s.at).join(",")).toBe("10,20");
    expect(stepsOf(rest).map((s) => s.at).join(",")).toBe("30");
    expect(String(botWakeAt(rest))).toBe("30");
  });

  it("꺼낼 것이 없으면 입력 그대로다", () => {
    const state = plan(claimKey(stateAt(1, 4, 3, "claim")));
    const { state: rest, due } = takeDueBotSteps(state, 5);
    expect(due.length === 0 && rest === state).toBe(true);
  });

  it("키가 다른(낡은) 계획이면 due 가 비고 입력 그대로며 botWakeAt 도 null 이다", () => {
    const state = plan("claim:1");
    const { state: rest, due } = takeDueBotSteps(state, 1_000_000);
    expect(due.length === 0 && rest === state).toBe(true);
    expect(String(botWakeAt(state))).toBe("null");
  });

  it("남은 행동이 없으면 botWakeAt 은 null 이다", () => {
    const state = plan(claimKey(stateAt(1, 4, 3, "claim")));
    const { state: rest } = takeDueBotSteps(state, 1_000_000);
    expect(String(botWakeAt(rest))).toBe("null");
  });
});

// ---- 4페이즈: 여부 투표·후보 선택·후보 봇 변론 (결정 0024, 0036) ----
/** 사람 1 + 봇 4 테스트 방이 투표 단계에 닿은 상태(표는 아직 없음). */
const voteStateAt = (seed: number, phase: "execVote"): RoomState => startedFrom(withBots(lobbyOf(1), 4), seed, phase);
/** 사람 1 + 봇 4 테스트 방의 후보 선택 이후 단계. 여부 투표는 전원 찬성으로 통과시켰다. */
const verdictAt = (
  seed: number,
  phase: "candidateVote" | "defense",
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
  it("execVote·candidateVote·defense 는 `${phase}:${phaseEndsAt}` 이고 공개·처형·종료는 null 이다", () => {
    const exec = voteStateAt(3, "execVote");
    expect(String(botPlanKey(exec))).toBe(`execVote:${exec.phaseEndsAt}`);
    const cand = verdictAt(3, "candidateVote");
    expect(String(botPlanKey(cand))).toBe(`candidateVote:${cand.phaseEndsAt}`);
    const def = verdictAt(3, "defense");
    expect(String(botPlanKey(def))).toBe(`defense:${def.phaseEndsAt}`);
    for (const phase of ["candidateVoteReveal", "execution", "ended"] as const) {
      expect(`${phase}:${String(botPlanKey({ ...def, phase }))}`).toBe(`${phase}:null`);
    }
  });

  it("공개·처형·종료 단계에서 syncBotPlan 은 낡은 botPlan 키를 뺀다", () => {
    const def = verdictAt(4, "defense");
    for (const phase of ["candidateVoteReveal", "execution", "ended"] as const) {
      const result = syncBotPlan({ ...def, phase, botPlan: { key: "old", steps: [] } }, nowOf(def), THROWING);
      expect(`${phase}:${Object.hasOwn(result, "botPlan")}`).toBe(`${phase}:false`);
    }
  });
});

describe("봇 투표·변론 계획: execVote", () => {
  it("살아 있는 봇마다 execVote 한 행이고 시각이 1000 이상 ~ 마감 - 500 미만이며 castExecVote 에 통과한다", () => {
    for (let seed = 1; seed <= 20; seed += 1) {
      let state = voteStateAt(seed, "execVote");
      const steps = planBotSteps(state, nowOf(state), seededRandInt(seed));
      expect(`${seed}:${steps.length}`).toBe(`${seed}:4`);
      for (const bot of botsOf(state)) {
        const mine = rowsOf(steps, bot.id);
        expect(`${seed}:${bot.seat}:${mine.length}`).toBe(`${seed}:${bot.seat}:1`);
        expect(`${seed}:${bot.seat}:${mine[0]!.act.t}`).toBe(`${seed}:${bot.seat}:execVote`);
      }
      expect(steps.every((s) => s.at >= nowOf(state) + 1000 && s.at < state.phaseEndsAt! - 500)).toBe(true);
      for (const s of steps) {
        if (s.act.t !== "execVote") continue;
        const r = castExecVote(state, s.botId, s.act.agree);
        expect(`${seed}:${r.ok ? "ok" : r.error}`).toBe(`${seed}:ok`);
        if (r.ok) state = r.state;
      }
    }
  });

  it("같은 시드·같은 now 는 같은 계획이고 randInt 기록 순서는 봇마다 [100, 6000] 이다", () => {
    const state = voteStateAt(5, "execVote");
    expect(canon(planBotSteps(state, nowOf(state), seededRandInt(42)))).toBe(canon(planBotSteps(state, nowOf(state), seededRandInt(42))));
    const rec = recording(7);
    planBotSteps(state, nowOf(state), rec.randInt);
    expect(rec.calls.join(",")).toBe([100, 6000, 100, 6000, 100, 6000, 100, 6000].join(","));
  });

  it("찬성은 randInt(100) < 70 이고 지연은 1000 + randInt(6000) 이다", () => {
    expect(String(botExecAgree(() => 69))).toBe("true");
    expect(String(botExecAgree(() => 70))).toBe("false");
    const state = voteStateAt(6, "execVote");
    const yes = planBotSteps(state, nowOf(state), (n) => (n === 100 ? 0 : 123));
    expect(yes.every((s) => s.act.t === "execVote" && s.act.agree && s.at === nowOf(state) + 1123)).toBe(true);
    const no = planBotSteps(state, nowOf(state), (n) => (n === 100 ? 99 : 0));
    expect(no.every((s) => s.act.t === "execVote" && !s.act.agree && s.at === nowOf(state) + 1000)).toBe(true);
  });
});

describe("봇 투표·변론 계획: candidateVote", () => {
  it("살아 있는 봇마다 자기 자신이 아닌 살아 있는 seat 하나를 고르고 castCandidateVote 에 통과한다", () => {
    for (let seed = 1; seed <= 20; seed += 1) {
      let state = markDead(verdictAt(seed, "candidateVote"), 4);
      const steps = planBotSteps(state, nowOf(state), seededRandInt(seed));
      const liveBots = botsOf(state).filter((b) => b.alive !== false);
      expect(`${seed}:${steps.length}`).toBe(`${seed}:${liveBots.length}`);
      expect(steps.every((s) => s.at >= nowOf(state) + 1000 && s.at < state.phaseEndsAt! - 500)).toBe(true);
      for (const s of steps) {
        const bot = state.players.find((p) => p.id === s.botId)!;
        expect(`${seed}:${bot.seat}:${s.act.t}`).toBe(`${seed}:${bot.seat}:candidateVote`);
        if (s.act.t !== "candidateVote") continue;
        expect(`${seed}:${bot.seat}:${s.act.target !== bot.seat && s.act.target !== 4}`).toBe(`${seed}:${bot.seat}:true`);
        const r = castCandidateVote(state, s.botId, s.act.target);
        expect(`${seed}:${bot.seat}:${r.ok ? "ok" : r.error}`).toBe(`${seed}:${bot.seat}:ok`);
        if (r.ok) state = r.state;
      }
    }
  });

  it("난수 순서는 봇마다 [후보 수, 9000] 이다(살아 있는 다른 사람 수)", () => {
    const state = markDead(verdictAt(5, "candidateVote"), 4);
    const rec = recording(3);
    planBotSteps(state, nowOf(state), rec.randInt);
    const liveBots = botsOf(state).filter((b) => b.alive !== false).length;
    expect(rec.calls.join(",")).toBe(Array.from({ length: liveBots }, () => "3,9000").join(","));
  });

  it("botCandidateTarget 은 seat 오름차순 후보에서 randInt(길이) 번째를 고르고 역할을 보지 않는다", () => {
    const state = verdictAt(8, "candidateVote");
    const bot = botsOf(state)[1]!; // seat 2
    const seen: number[] = [];
    const target = botCandidateTarget(state, bot, (n) => {
      seen.push(n);
      return n - 1;
    });
    expect(`${seen.join(",")}:${target}`).toBe("4:4");
    expect(String(botCandidateTarget(state, bot, () => 0))).toBe("0");
  });

  it("살아 있는 다른 사람이 없으면 행이 없고 randInt 를 부르지 않는다", () => {
    const base = verdictAt(5, "candidateVote");
    const lastBot = botsOf(base)[0]!;
    const state = markDead(base, ...base.players.filter((p) => p.id !== lastBot.id).map((p) => p.seat));
    expect(planBotSteps(state, nowOf(state), THROWING).length).toBe(0);
    expect(String(botCandidateTarget(state, lastBot, THROWING))).toBe("undefined");
  });
});

describe("봇 투표·변론 계획: defense", () => {
  const DEFENSE_TEMPLATES = ["defNotMe", "defCitizen", "defPlead"];
  it("후보가 봇이면 그 봇만 변론 템플릿 한 행이고 say 에 통과한다", () => {
    for (let seed = 1; seed <= 20; seed += 1) {
      const state = verdictAt(seed, "defense", 3);
      expect(`${seed}:${state.verdict?.candidate}`).toBe(`${seed}:3`);
      const steps = planBotSteps(state, nowOf(state), seededRandInt(seed));
      expect(`${seed}:${steps.length}`).toBe(`${seed}:1`);
      const step = steps[0]!;
      const bot = state.players.find((p) => p.seat === 3)!;
      expect(`${seed}:${step.botId === bot.id}`).toBe(`${seed}:true`);
      expect(step.at >= nowOf(state) + 1000 && step.at < state.phaseEndsAt! - 500).toBe(true);
      if (step.act.t !== "say") throw new Error(`expected say, got ${step.act.t}`);
      expect(`${seed}:${DEFENSE_TEMPLATES.includes(step.act.template)}`).toBe(`${seed}:true`);
      const r = say(state, step.botId, { template: step.act.template }, step.at);
      expect(`${seed}:${r.ok ? "ok" : r.error}`).toBe(`${seed}:ok`);
    }
  });

  it("난수 순서는 [3, 4000] 이고 템플릿은 randInt(3) 번째다", () => {
    const state = verdictAt(5, "defense", 3);
    const rec = recording(9);
    planBotSteps(state, nowOf(state), rec.randInt);
    expect(rec.calls.join(",")).toBe("3,4000");
    for (const [i, name] of DEFENSE_TEMPLATES.entries()) {
      const steps = planBotSteps(state, nowOf(state), (n) => (n === 3 ? i : 0));
      expect(steps[0]!.act.t === "say" && steps[0]!.act.template).toBe(name);
    }
  });

  it("후보가 사람이면 빈 계획이고 randInt 를 부르지 않는다", () => {
    const state = verdictAt(5, "defense", 0);
    expect(String(state.verdict?.candidate)).toBe("0");
    expect(planBotSteps(state, nowOf(state), THROWING).length).toBe(0);
  });
});

describe("봇 투표·변론 계획: 회귀", () => {
  it("탈락한 봇·사람이 모두 끊긴 방은 새 세 단계에서도 행동이 없다", () => {
    const cases: [string, RoomState][] = [
      ["execVote", voteStateAt(2, "execVote")],
      ["candidateVote", verdictAt(2, "candidateVote")],
      ["defense", verdictAt(2, "defense", 3)],
    ];
    for (const [label, state] of cases) {
      const dead = markDead(state, ...botsOf(state).map((b) => b.seat));
      expect(`${label}:dead:${planBotSteps(dead, nowOf(dead), seededRandInt(1)).length}`).toBe(`${label}:dead:0`);
      const gone: RoomState = { ...state, players: state.players.map((p) => (isBot(p) ? p : { ...p, connected: false })) };
      expect(`${label}:gone:${planBotSteps(gone, nowOf(gone), THROWING).length}`).toBe(`${label}:gone:0`);
    }
  });

  it("claim·discussion·night 계획 고정값(결정 0039: 토론 간격 폭 18초, 토론 40초로 discussion·night 의 값이 바뀌었다 — 옛 값 802530989·431118882)", () => {
    const digest = (text: string): number => [...text].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) % 1_000_000_007, 7);
    const got = (["claim", "discussion", "night"] as const).map((phase) => {
      const base = stateAt(1, 5, 8, phase);
      const state = phase === "claim" ? atTurnOf(base, botsOf(base)[0]!.seat) : base;
      return digest(canon(planBotSteps(state, nowOf(state), seededRandInt(42))));
    });
    expect(got.join(",")).toBe("251347194,289874952,760964938");
  });
});

// ---- P-13: 테스트 방 방장이 고른 봇 투표 설정(결정 0022·0024 확장, 04-15) ----
describe("봇 투표 고정 설정: botExecAgree·botCandidateTarget", () => {
  it("botExecAgree: 고정 yes 는 true, no 는 false 이고 randInt 를 한 번도 부르지 않는다", () => {
    expect(String(botExecAgree(THROWING, "yes"))).toBe("true");
    expect(String(botExecAgree(THROWING, "no"))).toBe("false");
  });

  it("botExecAgree: 고정이 없으면 기존과 같이 randInt(100) 한 번이다", () => {
    const rec = recording(1);
    botExecAgree(rec.randInt);
    botExecAgree(rec.randInt, undefined);
    expect(rec.calls.join(",")).toBe("100,100");
    expect(String(botExecAgree(() => 69))).toBe("true");
    expect(String(botExecAgree(() => 70))).toBe("false");
  });

  it("botCandidateTarget host: 방장이 살아 있고 이 봇이 아니면 방장 seat 이며 randInt 를 부르지 않는다", () => {
    const state = verdictAt(8, "candidateVote");
    const hostSeat = state.players.find((p) => p.id === state.hostId)!.seat;
    for (const bot of botsOf(state)) {
      expect(`${bot.seat}:${botCandidateTarget(state, bot, THROWING, "host")}`).toBe(`${bot.seat}:${hostSeat}`);
    }
  });

  it("botCandidateTarget other: 방장도 자기도 아닌 살아 있는 사람 중 가장 낮은 seat 이며 randInt 를 부르지 않는다", () => {
    const state = verdictAt(8, "candidateVote");
    const [b1, b2, b3] = botsOf(state); // seat 1, 2, 3
    expect(String(botCandidateTarget(state, b1!, THROWING, "other"))).toBe("2");
    expect(String(botCandidateTarget(state, b2!, THROWING, "other"))).toBe("1");
    expect(String(botCandidateTarget(state, b3!, THROWING, "other"))).toBe("1");
    // 가장 낮은 seat 이 탈락했으면 그다음.
    const dead = markDead(state, 1);
    expect(String(botCandidateTarget(dead, b2!, THROWING, "other"))).toBe("3");
  });

  it("조건이 안 맞으면 무작위로 돌아가 기존과 같이 randInt(길이) 한 번 부른다", () => {
    const base = verdictAt(8, "candidateVote");
    const hostSeat = base.players.find((p) => p.id === base.hostId)!.seat;
    const bot = botsOf(base)[1]!; // seat 2
    // host: 방장 탈락 → 살아 있는 다른 사람 3명 중 무작위
    const hostDead = markDead(base, hostSeat);
    const rec1 = recording(2);
    const t1 = botCandidateTarget(hostDead, bot, rec1.randInt, "host");
    expect(`${rec1.calls.join(",")}:${t1 !== undefined && t1 !== hostSeat && t1 !== bot.seat}`).toBe("3:true");
    // other: 방장·자기 말고 아무도 없음 → 후보는 방장 하나뿐이라 randInt(1) 한 번
    const alone = markDead(base, ...base.players.filter((p) => p.id !== base.hostId && p.id !== bot.id).map((p) => p.seat));
    const rec2 = recording(2);
    const t2 = botCandidateTarget(alone, bot, rec2.randInt, "other");
    expect(`${rec2.calls.join(",")}:${t2}`).toBe(`1:${hostSeat}`);
    // 후보가 아예 없으면 undefined, 난수 없음
    const none = markDead(alone, hostSeat);
    expect(String(botCandidateTarget(none, bot, THROWING, "host"))).toBe("undefined");
    expect(String(botCandidateTarget(none, bot, THROWING, "other"))).toBe("undefined");
  });

  it("고정 설정이 없으면 기존 시그니처 호출과 같다(같은 난수 기록·같은 결과)", () => {
    const state = verdictAt(8, "candidateVote");
    const bot = botsOf(state)[1]!;
    const a = recording(5);
    const b = recording(5);
    expect(String(botCandidateTarget(state, bot, a.randInt))).toBe(String(botCandidateTarget(state, bot, b.randInt, undefined)));
    expect(a.calls.join(",")).toBe(b.calls.join(","));
  });
});

describe("봇 투표 고정 설정: planBotSteps", () => {
  it("execVote: 설정 yes 는 모두 찬성, no 는 모두 반대이고 결정 난수 없이 지연 난수만 부른다", () => {
    const state = voteStateAt(5, "execVote");
    for (const exec of ["yes", "no"] as const) {
      const fixed: RoomState = { ...state, testBotVote: { exec } };
      const rec = recording(7);
      const steps = planBotSteps(fixed, nowOf(fixed), rec.randInt);
      expect(`${exec}:${rec.calls.join(",")}`).toBe(`${exec}:6000,6000,6000,6000`);
      expect(steps.length).toBe(4);
      expect(steps.every((s) => s.act.t === "execVote" && s.act.agree === (exec === "yes"))).toBe(true);
    }
  });

  it("candidateVote: 설정 pick host 는 모두 방장에게 던지고 지연 난수만 부른다", () => {
    const state = { ...verdictAt(5, "candidateVote"), testBotVote: { pick: "host" as const } };
    const hostSeat = state.players.find((p) => p.id === state.hostId)!.seat;
    const rec = recording(3);
    const steps = planBotSteps(state, nowOf(state), rec.randInt);
    expect(rec.calls.join(",")).toBe("9000,9000,9000,9000");
    expect(steps.length).toBe(4);
    expect(steps.every((s) => s.act.t === "candidateVote" && s.act.target === hostSeat)).toBe(true);
  });

  it("설정의 다른 쪽 값은 서로 영향이 없다(exec 만 고정이면 pick 은 무작위 그대로)", () => {
    const state = { ...verdictAt(5, "candidateVote"), testBotVote: { exec: "yes" as const } };
    const rec = recording(3);
    planBotSteps(state, nowOf(state), rec.randInt);
    expect(rec.calls.join(",")).toBe(Array.from({ length: 4 }, () => "4,9000").join(","));
  });

  it("설정이 없으면 같은 시드의 계획이 설정 키를 가진 빈 객체와도 같다", () => {
    const state = voteStateAt(5, "execVote");
    const plain = canon(planBotSteps(state, nowOf(state), seededRandInt(42)));
    expect(canon(planBotSteps({ ...state, testBotVote: {} }, nowOf(state), seededRandInt(42)))).toBe(plain);
  });
});
