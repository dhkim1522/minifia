import { describe, expect, it } from "vitest";
import { enterMorning, enterNight, pickTarget } from "../../shared/game/night";
import { attachConnection, createRoomState, joinRoom, startGame } from "../../shared/game/room";
import type { Player, RoomState } from "../../shared/game/room";
import type { RoleId } from "../../shared/game/roles";
import { tick } from "../../shared/game/tick";
import { MORNING_PHRASE_COUNT } from "../../shared/protocol";
import { seededRandInt } from "../helpers/seededRandom";

const START_AT = 10_000;

/** n 명이 모두 연결된 대기실. */
function lobbyOf(n: number): RoomState {
  const created = createRoomState({
    code: "0420",
    hostId: "player-id-0000-aaaa",
    hostToken: "token-secret-0000-aaaa-0123456789",
    hostNickname: "이름0",
    now: 0,
  });
  if (!created.ok) throw new Error("createRoomState failed");
  let state = attachConnection(created.state, "player-id-0000-aaaa", "conn-0");
  for (let i = 1; i < n; i += 1) {
    const id = `player-id-000${i}-aaaa`;
    const joined = joinRoom(state, { playerId: id, token: `token-secret-000${i}-aaaa-0123456789`, nickname: `이름${i}` });
    if (!joined.ok) throw new Error(`joinRoom failed: ${joined.error}`);
    state = attachConnection(joined.state, id, `conn-${i}`);
  }
  return state;
}

/** 실제 전이(startGame, tick)로 1일차 밤 상태를 만든다. */
function nightOf(n: number, seed: number): RoomState {
  const lobby = lobbyOf(n);
  const started = startGame(lobby, lobby.hostId, START_AT, seededRandInt(seed));
  if (!started.ok) throw new Error(`startGame failed: ${started.error}`);
  let state = started.state;
  while (state.phase !== "night") {
    if (state.phaseEndsAt === null) throw new Error("phase has no deadline");
    state = tick(state, state.phaseEndsAt);
  }
  return state;
}

function withRole(state: RoomState, role: RoleId): Player[] {
  return state.players.filter((p) => p.role === role);
}

/** 고른 결과를 상태에 쌓는다. 거부되면 테스트 준비가 틀린 것이다. */
function pickAs(state: RoomState, actor: Player, target: Player): RoomState {
  const result = pickTarget(state, actor.id, target.seat);
  if (!result.ok) throw new Error(`pickTarget rejected: ${result.error}`);
  return result.state;
}

/** 호출을 기록하는 randInt. 항상 0 을 돌려준다. */
function spyRandInt(): { randInt: (n: number) => number; calls: number[] } {
  const calls: number[] = [];
  return {
    calls,
    randInt: (n: number): number => {
      calls.push(n);
      return 0;
    },
  };
}

describe("밤 → 아침 한 줄 (NIGHT-01, NIGHT-06, D-08)", () => {
  it("5명 판: 마피아가 시민을 지목하면 마감에 아침으로 넘어가 그 사람이 탈락하고 결과·문구 번호가 남는다", () => {
    const night = nightOf(5, 7);
    const mafia = withRole(night, "mafia")[0]!;
    const victim = withRole(night, "citizen")[0]!;
    const picked = pickTarget(night, mafia.id, victim.seat);
    expect(picked.ok).toBe(true);
    if (!picked.ok) return;
    expect(picked.state.players.find((p) => p.id === mafia.id)?.nightPick).toBe(victim.seat);

    const morning = tick(picked.state, picked.state.phaseEndsAt ?? 0, seededRandInt(1));
    expect(morning.phase).toBe("morning");
    expect(morning.players.find((p) => p.id === victim.id)?.alive).toBe(false);
    expect(Object.keys(morning.morning ?? {}).sort().join(",")).toBe("eliminated,phrase");
    expect(morning.morning?.eliminated).toBe(victim.seat);
    const phrase = morning.morning?.phrase ?? 0;
    expect(Number.isInteger(phrase) && phrase >= 1 && phrase <= MORNING_PHRASE_COUNT).toBe(true);
    expect(morning.lastPhrase).toBe(phrase);
    expect(morning.players.some((p) => "nightPick" in p)).toBe(false);
  });

  it("아무도 고르지 않으면 아침의 morning 은 키 없는 객체이고 아무도 탈락하지 않으며 randInt 를 부르지 않는다", () => {
    const night = nightOf(5, 7);
    const spy = spyRandInt();
    const morning = tick(night, night.phaseEndsAt ?? 0, spy.randInt);
    expect(morning.phase).toBe("morning");
    expect(morning.morning === undefined).toBe(false);
    expect(Object.keys(morning.morning ?? { x: 1 }).length).toBe(0);
    expect(morning.players.every((p) => p.alive !== false)).toBe(true);
    expect(spy.calls.length).toBe(0);
  });

  it("enterNight: 이전 아침 결과·남은 nightPick·nextNightSeq 키를 모두 지우고 다른 필드는 그대로 둔다", () => {
    const night = nightOf(5, 7);
    const dirty: RoomState = {
      ...night,
      morning: { eliminated: 1, phrase: 2 },
      nextNightSeq: 5,
      nextMessageSeq: 7,
      lastPhrase: 2,
      players: night.players.map((p, i) => (i === 0 ? { ...p, nightPick: 3 } : p)),
    };
    const out = enterNight(dirty);
    expect("morning" in out).toBe(false);
    expect("nextNightSeq" in out).toBe(false);
    expect(out.players.some((p) => "nightPick" in p)).toBe(false);
    expect(out.nextMessageSeq).toBe(7);
    expect(out.lastPhrase).toBe(2);
    expect(out.day).toBe(night.day);
    expect(out.players.length).toBe(night.players.length);
  });

  it("randInt 없이(tick 두 인자) 탈락이 생기는 밤의 마감을 넘기면 예외를 던진다", () => {
    const night = nightOf(5, 7);
    const mafia = withRole(night, "mafia")[0]!;
    const victim = withRole(night, "citizen")[0]!;
    const picked = pickAs(night, mafia, victim);
    expect(() => tick(picked, picked.phaseEndsAt ?? 0)).toThrow();
  });

  it("enterMorning 은 입력 상태를 바꾸지 않는다", () => {
    const night = nightOf(5, 7);
    const mafia = withRole(night, "mafia")[0]!;
    const victim = withRole(night, "citizen")[0]!;
    const picked = pickAs(night, mafia, victim);
    const before = JSON.stringify(picked);
    enterMorning(picked, seededRandInt(3));
    expect(JSON.stringify(picked) === before).toBe(true);
  });
});
