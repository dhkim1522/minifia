import { describe, expect, it } from "vitest";
import { enterMorning, enterNight, pickRecipientIds, pickTarget } from "../../shared/game/night";
import { attachConnection, createRoomState, joinRoom, startGame } from "../../shared/game/room";
import type { Player, RoomState } from "../../shared/game/room";
import type { RoleId } from "../../shared/game/roles";
import { tick } from "../../shared/game/tick";
import { NIGHT_MS, NOMINATION_MS } from "../../shared/game/phases";
import { MORNING_PHRASE_COUNT } from "../../shared/protocol";
import type { PhaseId } from "../../shared/protocol";
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

  it("enterNight: 이전 아침 결과·남은 nightPick 키를 모두 지우고 다른 필드는 그대로 둔다", () => {
    const night = nightOf(5, 7);
    const dirty: RoomState = {
      ...night,
      morning: { eliminated: 1, phrase: 2 },
      lastPhrase: 2,
      players: night.players.map((p, i) => (i === 0 ? { ...p, nightPick: 3 } : p)),
    };
    const out = enterNight(dirty);
    expect("morning" in out).toBe(false);
    expect(out.players.some((p) => "nightPick" in p)).toBe(false);
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

// ---- Task 2: 검사 순서와 받는 사람 ----

/** 어떤 단계든 실제 전이로 만든다(lobby 는 대기실 그대로). */
function stateAtPhase(phase: PhaseId, n: number, seed: number): RoomState {
  const lobby = lobbyOf(n);
  if (phase === "lobby") return lobby;
  const started = startGame(lobby, lobby.hostId, START_AT, seededRandInt(seed));
  if (!started.ok) throw new Error(`startGame failed: ${started.error}`);
  let state = started.state;
  while (state.phase !== phase) {
    if (state.phaseEndsAt === null) throw new Error("phase has no deadline");
    state = tick(state, state.phaseEndsAt, seededRandInt(seed));
  }
  return state;
}

function outcome(r: { ok: true; state: RoomState } | { ok: false; error: string }): string {
  return r.ok ? "ok" : r.error;
}

/** 지정한 사람들을 탈락시킨 새 상태. */
function kill(state: RoomState, ...dead: Player[]): RoomState {
  const ids = new Set(dead.map((p) => p.id));
  return { ...state, players: state.players.map((p) => (ids.has(p.id) ? { ...p, alive: false } : p)) };
}

function seatsOf(state: RoomState, ids: Iterable<string>): string {
  const set = new Set(ids);
  return state.players
    .filter((p) => set.has(p.id))
    .map((p) => p.seat)
    .sort((a, b) => a - b)
    .join(",");
}

describe("pickTarget 검사 순서 (D-02, ELIM-01)", () => {
  const OTHER_PHASES: readonly PhaseId[] = [
    "lobby",
    "assigning",
    "roleReveal",
    "dayAnnounce",
    "discussion",
    "morning",
  ];

  it("night 가 아닌 여섯 단계에서는 WRONG_PHASE 다", () => {
    for (const phase of OTHER_PHASES) {
      const state = stateAtPhase(phase, 6, 11);
      const actor = state.players[0]!;
      const result = pickTarget(state, actor.id, state.players[1]!.seat);
      expect(`${phase}:${outcome(result)}`).toBe(`${phase}:WRONG_PHASE`);
    }
  });

  it("탈락한 행위자도 night 가 아니면 WRONG_PHASE 다(단계 검사가 먼저)", () => {
    const night = nightOf(6, 11);
    const mafia = withRole(night, "mafia")[0]!;
    const victim = withRole(night, "citizen")[0]!;
    const morning = tick(pickAs(night, mafia, victim), night.phaseEndsAt ?? 0, seededRandInt(2));
    expect(morning.phase).toBe("morning");
    expect(outcome(pickTarget(morning, victim.id, mafia.seat))).toBe("WRONG_PHASE");
  });

  it("night 에서 방에 없는 actorId 는 BAD_MESSAGE 다", () => {
    const night = nightOf(6, 11);
    expect(outcome(pickTarget(night, "nobody-in-this-room", 0))).toBe("BAD_MESSAGE");
  });

  it("night 에서 탈락한 마피아·경찰·의사와 살아 있는 시민은 BAD_MESSAGE 다", () => {
    const night = nightOf(6, 11);
    const target = withRole(night, "citizen")[0]!;
    const out: string[] = [];
    for (const role of ["mafia", "police", "doctor"] as const) {
      const actor = withRole(night, role)[0]!;
      const dead = kill(night, actor);
      out.push(`${role}:${outcome(pickTarget(dead, actor.id, target.seat))}`);
    }
    const citizen = withRole(night, "citizen")[1]!;
    out.push(`citizen:${outcome(pickTarget(night, citizen.id, target.seat))}`);
    expect(out.join(" ")).toBe("mafia:BAD_MESSAGE police:BAD_MESSAGE doctor:BAD_MESSAGE citizen:BAD_MESSAGE");
  });

  it("대상이 정수가 아니거나 앉지 않은 seat 이거나 탈락자면 BAD_MESSAGE 다", () => {
    const night = nightOf(6, 11);
    const police = withRole(night, "police")[0]!;
    const deadOne = withRole(night, "citizen")[0]!;
    const state = kill(night, deadOne);
    const out = [1.5, Number.NaN, 7, -1, deadOne.seat].map((t) => outcome(pickTarget(state, police.id, t)));
    expect(out.join(" ")).toBe("BAD_MESSAGE BAD_MESSAGE BAD_MESSAGE BAD_MESSAGE BAD_MESSAGE");
  });

  it("마피아가 자신 또는 동료를 고르면 BAD_MESSAGE 다(6명 판)", () => {
    const night = nightOf(6, 11);
    const [m1, m2] = withRole(night, "mafia") as [Player, Player];
    const out = [
      outcome(pickTarget(night, m1.id, m1.seat)),
      outcome(pickTarget(night, m1.id, m2.seat)),
      outcome(pickTarget(night, m2.id, m1.seat)),
    ];
    expect(out.join(" ")).toBe("BAD_MESSAGE BAD_MESSAGE BAD_MESSAGE");
  });

  it("경찰·의사는 자신을 고를 수 있다", () => {
    const night = nightOf(6, 11);
    const police = withRole(night, "police")[0]!;
    const doctor = withRole(night, "doctor")[0]!;
    const out = [outcome(pickTarget(night, police.id, police.seat)), outcome(pickTarget(night, doctor.id, doctor.seat))];
    expect(out.join(" ")).toBe("ok ok");
  });

  it("단계가 틀리면 다른 위반이 있어도 WRONG_PHASE, 탈락한 시민이 탈락자를 고르면 BAD_MESSAGE 다", () => {
    const day = stateAtPhase("dayAnnounce", 6, 11);
    expect(outcome(pickTarget(day, "nobody-in-this-room", Number.NaN))).toBe("WRONG_PHASE");
    const night = nightOf(6, 11);
    const [c1, c2] = withRole(night, "citizen") as [Player, Player];
    const state = kill(night, c1, c2);
    expect(outcome(pickTarget(state, c1.id, c2.seat))).toBe("BAD_MESSAGE");
  });

  it("같은 대상을 다시 고르면 결과 state 가 입력과 같은 객체다", () => {
    const night = nightOf(6, 11);
    const police = withRole(night, "police")[0]!;
    const victim = withRole(night, "citizen")[0]!;
    const first = pickAs(night, police, victim);
    const again = pickTarget(first, police.id, victim.seat);
    expect(again.ok && again.state === first).toBe(true);
  });

  it("다른 대상으로 바꾸면 그 사람의 nightPick 만 바뀌고 마감은 그대로이며 입력은 변하지 않는다", () => {
    const night = nightOf(6, 11);
    const doctor = withRole(night, "doctor")[0]!;
    const [c1, c2] = withRole(night, "citizen") as [Player, Player];
    const first = pickAs(night, doctor, c1);
    const before = JSON.stringify(first);
    const changed = pickTarget(first, doctor.id, c2.seat);
    expect(changed.ok).toBe(true);
    if (!changed.ok) return;
    expect(JSON.stringify(first) === before).toBe(true);
    expect(changed.state.players.find((p) => p.id === doctor.id)?.nightPick).toBe(c2.seat);
    expect(changed.state.phase).toBe("night");
    expect(changed.state.phaseEndsAt).toBe(first.phaseEndsAt);
    const others = (s: RoomState) => JSON.stringify(s.players.filter((p) => p.id !== doctor.id));
    expect(others(changed.state) === others(first)).toBe(true);
  });

  it("모두 골라도 phase 는 night 이고 마감은 그대로다(NIGHT-05)", () => {
    let state = nightOf(6, 11);
    const endsAt = state.phaseEndsAt;
    const target = withRole(state, "citizen")[0]!;
    for (const p of state.players) {
      if (p.role === "citizen") continue;
      const t = p.role === "mafia" ? target : p;
      state = pickAs(state, p, t);
    }
    expect(state.phase).toBe("night");
    expect(state.phaseEndsAt).toBe(endsAt);
  });

  it("거부는 입력 상태를 바꾸지 않는다", () => {
    const night = nightOf(6, 11);
    const mafia = withRole(night, "mafia")[0]!;
    const before = JSON.stringify(night);
    pickTarget(night, mafia.id, mafia.seat);
    pickTarget(night, "nobody-in-this-room", 0);
    expect(JSON.stringify(night) === before).toBe(true);
  });
});

describe("받는 사람 (D-17, 결정 0021)", () => {
  it("경찰·의사의 행동 뒤 state 는 본인만 받고, 탈락자가 있으면 탈락자도 받는다", () => {
    const night = nightOf(6, 11);
    const police = withRole(night, "police")[0]!;
    const doctor = withRole(night, "doctor")[0]!;
    const [c1, c2] = withRole(night, "citizen") as [Player, Player];
    expect(seatsOf(night, pickRecipientIds(night, police.id))).toBe(String(police.seat));
    expect(seatsOf(night, pickRecipientIds(night, doctor.id))).toBe(String(doctor.seat));
    const dead = kill(night, c1, c2);
    const want = [police.seat, c1.seat, c2.seat].sort((a, b) => a - b).join(",");
    expect(seatsOf(dead, pickRecipientIds(dead, police.id))).toBe(want);
  });

  it("마피아의 행동 뒤 state 는 생존 마피아 전원과 탈락자가 받는다(탈락한 마피아는 탈락자로 든다)", () => {
    const night = nightOf(6, 11);
    const [m1, m2] = withRole(night, "mafia") as [Player, Player];
    const mafiaSeats = [m1.seat, m2.seat].sort((a, b) => a - b).join(",");
    expect(seatsOf(night, pickRecipientIds(night, m1.id))).toBe(mafiaSeats);
    const citizen = withRole(night, "citizen")[0]!;
    const oneDead = kill(night, m2, citizen);
    const want = [m1.seat, m2.seat, citizen.seat].sort((a, b) => a - b).join(",");
    expect(seatsOf(oneDead, pickRecipientIds(oneDead, m1.id))).toBe(want);
  });

  it("받는 사람 목록에는 중복이 없고 seat 오름차순이다", () => {
    const night = nightOf(6, 11);
    const [m1, m2] = withRole(night, "mafia") as [Player, Player];
    const citizen = withRole(night, "citizen")[0]!;
    const state = kill(night, m2, citizen);
    const ids = pickRecipientIds(state, m1.id);
    expect(new Set(ids).size).toBe(ids.length);
    const seats = ids.map((id) => state.players.find((p) => p.id === id)?.seat ?? -1);
    expect(seats.join(",")).toBe([...seats].sort((a, b) => a - b).join(","));
    expect(seats.length).toBe(3);
  });
});

// ---- Task 3: 판정 규칙표와 난수 계약 ----

interface Cast {
  night: RoomState;
  m1: Player;
  m2: Player;
  police: Player;
  doctor: Player;
  c1: Player;
  c2: Player;
}

/** 6명 판 1일차 밤과 역할별 사람(마피아·시민은 seat 오름차순). */
function cast6(): Cast {
  const night = nightOf(6, 11);
  const [m1, m2] = withRole(night, "mafia").sort((a, b) => a.seat - b.seat) as [Player, Player];
  const [c1, c2] = withRole(night, "citizen").sort((a, b) => a.seat - b.seat) as [Player, Player];
  return { night, m1, m2, police: withRole(night, "police")[0]!, doctor: withRole(night, "doctor")[0]!, c1, c2 };
}

/** (행위자, 대상) 쌍을 pickTarget 으로 차례로 쌓는다. */
function picks(state: RoomState, ...pairs: Array<[Player, Player]>): RoomState {
  return pairs.reduce((s, [actor, target]) => pickAs(s, actor, target), state);
}

const alivePlayer = (s: RoomState, p: Player): boolean => s.players.find((q) => q.id === p.id)?.alive !== false;

describe("판정 규칙표 (NIGHT-01·02·03)", () => {
  it("6명 판 마피아 둘이 같은 대상이면 그 대상이 탈락하고 randInt 는 문구에만 한 번 불린다", () => {
    const { night, m1, m2, c1 } = cast6();
    const spy = spyRandInt();
    const out = enterMorning(picks(night, [m1, c1], [m2, c1]), spy.randInt);
    expect(alivePlayer(out, c1)).toBe(false);
    expect(out.morning?.eliminated).toBe(c1.seat);
    expect(`[${spy.calls.join(",")}]`).toBe(`[${String(MORNING_PHRASE_COUNT)}]`);
  });

  it("마피아 둘이 다른 대상(동률)이면 randInt 첫 호출 인자가 2 이고 (n)=>0 은 작은 seat, (n)=>n-1 은 큰 seat 를 고른다", () => {
    const { night, m1, m2, c1, c2 } = cast6();
    const tied = picks(night, [m1, c1], [m2, c2]);
    const spy = spyRandInt();
    const low = enterMorning(tied, spy.randInt);
    expect(spy.calls[0]).toBe(2);
    expect(low.morning?.eliminated).toBe(Math.min(c1.seat, c2.seat));
    const high = enterMorning(tied, (n) => n - 1);
    expect(high.morning?.eliminated).toBe(Math.max(c1.seat, c2.seat));
  });

  it("마피아 둘 중 하나만 고르면 그 대상이 탈락한다 (A2)", () => {
    const { night, m2, c2 } = cast6();
    const spy = spyRandInt();
    const out = enterMorning(picks(night, [m2, c2]), spy.randInt);
    expect(out.morning?.eliminated).toBe(c2.seat);
    expect(spy.calls.length).toBe(1);
  });

  it("저장된 지목이 동료나 탈락자를 가리키면 집계에서 빠지고 남은 표로 판정한다", () => {
    const { night, m1, m2, c1, c2 } = cast6();
    const withAlly: RoomState = {
      ...night,
      players: night.players.map((p) =>
        p.id === m1.id ? { ...p, nightPick: m2.seat } : p.id === m2.id ? { ...p, nightPick: c1.seat } : p,
      ),
    };
    const spy = spyRandInt();
    expect(enterMorning(withAlly, spy.randInt).morning?.eliminated).toBe(c1.seat);
    expect(`[${spy.calls.join(",")}]`).toBe(`[${String(MORNING_PHRASE_COUNT)}]`);
    const deadTarget: RoomState = {
      ...kill(night, c2),
      players: kill(night, c2).players.map((p) =>
        p.id === m1.id ? { ...p, nightPick: c2.seat } : p.id === m2.id ? { ...p, nightPick: c1.seat } : p,
      ),
    };
    const spy2 = spyRandInt();
    expect(enterMorning(deadTarget, spy2.randInt).morning?.eliminated).toBe(c1.seat);
    expect(`[${spy2.calls.join(",")}]`).toBe(`[${String(MORNING_PHRASE_COUNT)}]`);
  });

  it("의사가 지목 대상을 지키면 morning 은 키 없는 객체이고 탈락 없음, randInt 호출 0, lastPhrase 는 그대로다", () => {
    const { night, m1, m2, doctor, c1 } = cast6();
    const spy = spyRandInt();
    const saved = enterMorning(picks(night, [m1, c1], [m2, c1], [doctor, c1]), spy.randInt);
    expect(Object.keys(saved.morning ?? { x: 1 }).length).toBe(0);
    expect(saved.players.every((p) => p.alive !== false)).toBe(true);
    expect(spy.calls.length).toBe(0);
    expect("lastPhrase" in saved).toBe(false);
    const withLast = enterMorning({ ...picks(night, [m1, c1], [doctor, c1]), lastPhrase: 3 }, spy.randInt);
    expect(withLast.lastPhrase).toBe(3);
  });

  it("동률 뒤 의사가 뽑힌 쪽을 지키면 randInt 는 동률에만 한 번 불리고 morning 은 {} 다", () => {
    const { night, m1, m2, doctor, c1, c2 } = cast6();
    const spy = spyRandInt();
    const out = enterMorning(picks(night, [m1, c1], [m2, c2], [doctor, c1]), spy.randInt);
    expect(`[${spy.calls.join(",")}]`).toBe("[2]");
    expect(Object.keys(out.morning ?? { x: 1 }).length).toBe(0);
  });

  it("의사가 자신을 지키고 마피아가 의사를 지목하면 탈락 없음, 다른 사람을 지키면 의사가 탈락한다 (A1)", () => {
    const { night, m1, m2, doctor, c1 } = cast6();
    const selfSave = enterMorning(picks(night, [m1, doctor], [m2, doctor], [doctor, doctor]), spyRandInt().randInt);
    expect(alivePlayer(selfSave, doctor)).toBe(true);
    const otherSave = enterMorning(picks(night, [m1, doctor], [m2, doctor], [doctor, c1]), spyRandInt().randInt);
    expect(alivePlayer(otherSave, doctor)).toBe(false);
  });

  it("경찰 조사: 마피아는 true, 시민·자기 자신은 false 로 그 경찰의 investigations 에 쌓인다", () => {
    const { night, m1, police, c1 } = cast6();
    const rec = (state: RoomState): string =>
      String(JSON.stringify(state.players.find((p) => p.id === police.id)?.investigations));
    const spy = spyRandInt();
    expect(rec(enterMorning(picks(night, [police, m1]), spy.randInt))).toBe(
      JSON.stringify([{ n: 1, target: m1.seat, isMafia: true }]),
    );
    expect(rec(enterMorning(picks(night, [police, c1]), spy.randInt))).toBe(
      JSON.stringify([{ n: 1, target: c1.seat, isMafia: false }]),
    );
    expect(rec(enterMorning(picks(night, [police, police]), spy.randInt))).toBe(
      JSON.stringify([{ n: 1, target: police.seat, isMafia: false }]),
    );
    expect(rec(enterMorning(night, spy.randInt))).toBe("undefined");
  });

  it("2일차 밤 기록은 n 이 2 이고 1일차 기록 뒤에 붙는다", () => {
    const { night, m2, police, c1 } = cast6();
    const old = { n: 1, target: m2.seat, isMafia: true };
    const day2: RoomState = {
      ...night,
      day: 2,
      players: night.players.map((p) => (p.id === police.id ? { ...p, investigations: [old] } : p)),
    };
    const out = enterMorning(picks(day2, [police, c1]), spyRandInt().randInt);
    const got = out.players.find((p) => p.id === police.id)?.investigations ?? [];
    expect(JSON.stringify(got)).toBe(JSON.stringify([old, { n: 2, target: c1.seat, isMafia: false }]));
  });

  it("그 밤에 경찰이 지목되어 탈락해도 그 밤의 조사 기록은 남는다 (A1)", () => {
    const { night, m1, m2, police, c1 } = cast6();
    const out = enterMorning(picks(night, [m1, police], [m2, police], [police, c1]), spyRandInt().randInt);
    const p = out.players.find((q) => q.id === police.id);
    expect(p?.alive).toBe(false);
    expect(p?.investigations?.length).toBe(1);
  });

  it("경찰 아닌 사람의 investigations 는 생기지 않는다", () => {
    const { night, m1, doctor, police, c1 } = cast6();
    const out = enterMorning(picks(night, [m1, c1], [doctor, c1], [police, m1]), spyRandInt().randInt);
    expect(out.players.filter((p) => p.role !== "police").some((p) => "investigations" in p)).toBe(false);
  });

  it("4명 판(의사 없음, 마피아 하나)도 지목·조사가 돈다", () => {
    const night = nightOf(4, 5);
    const mafia = withRole(night, "mafia")[0]!;
    const police = withRole(night, "police")[0]!;
    const victim = withRole(night, "citizen")[0]!;
    const out = enterMorning(picks(night, [mafia, victim], [police, mafia]), spyRandInt().randInt);
    expect(out.morning?.eliminated).toBe(victim.seat);
    expect(out.players.find((p) => p.id === police.id)?.investigations?.[0]?.isMafia).toBe(true);
  });

  it("입력 상태를 바꾸지 않는다", () => {
    const { night, m1, m2, doctor, police, c1, c2 } = cast6();
    const full = picks(night, [m1, c1], [m2, c2], [doctor, c1], [police, m1]);
    const before = JSON.stringify(full);
    enterMorning(full, (n) => n - 1);
    expect(JSON.stringify(full) === before).toBe(true);
  });
});

describe("난수 계약 (T-03-09)", () => {
  it("동률 + 탈락이면 호출 인자가 [2, MORNING_PHRASE_COUNT], lastPhrase 가 있으면 [2, MORNING_PHRASE_COUNT - 1] 순서다", () => {
    const { night, m1, m2, c1, c2 } = cast6();
    const tied = picks(night, [m1, c1], [m2, c2]);
    const first = spyRandInt();
    enterMorning(tied, first.randInt);
    expect(`[${first.calls.join(",")}]`).toBe(`[2,${String(MORNING_PHRASE_COUNT)}]`);
    const second = spyRandInt();
    enterMorning({ ...tied, lastPhrase: 4 }, second.randInt);
    expect(`[${second.calls.join(",")}]`).toBe(`[2,${String(MORNING_PHRASE_COUNT - 1)}]`);
  });

  it("어떤 경로에서도 인자 0 호출이 없다", () => {
    const bad: string[] = [];
    for (const n of [4, 5, 6, 7, 8]) {
      const night = nightOf(n, 3);
      const mafias = withRole(night, "mafia");
      const others = night.players.filter((p) => p.role !== "mafia");
      const doctor = withRole(night, "doctor")[0];
      const scenarios: RoomState[] = [night];
      for (const t of others) {
        scenarios.push(picks(night, ...mafias.map((m): [Player, Player] => [m, t])));
        if (doctor) scenarios.push(picks(night, ...mafias.map((m): [Player, Player] => [m, t]), [doctor, t]));
      }
      if (mafias.length === 2 && others.length >= 2) {
        const tie = picks(night, [mafias[0]!, others[0]!], [mafias[1]!, others[1]!]);
        scenarios.push(tie, { ...tie, lastPhrase: 8 });
        if (doctor) scenarios.push(picks(tie, [doctor, others[0]!]), picks(tie, [doctor, others[1]!]));
      }
      for (const s of scenarios) {
        const spy = spyRandInt();
        enterMorning(s, spy.randInt);
        if (spy.calls.some((c) => c < 1)) bad.push(`n${n}`);
      }
    }
    expect(`[${bad.join(",")}]`).toBe("[]");
  });
});

describe("문구 번호 (D-18, NIGHT-06)", () => {
  it("첫 탈락은 후보 MORNING_PHRASE_COUNT(7)개, lastPhrase 가 있으면 하나 적고 그 번호가 없다", () => {
    const { night, m1, c1 } = cast6();
    const base = picks(night, [m1, c1]);
    const phrase = (s: RoomState, fn: (n: number) => number): number | undefined => enterMorning(s, fn).morning?.phrase;
    expect(phrase(base, () => 0)).toBe(1);
    expect(phrase(base, (n) => n - 1)).toBe(MORNING_PHRASE_COUNT);
    expect(phrase({ ...base, lastPhrase: 1 }, () => 0)).toBe(2);
    expect(phrase({ ...base, lastPhrase: MORNING_PHRASE_COUNT }, (n) => n - 1)).toBe(MORNING_PHRASE_COUNT - 1);
    const spy = spyRandInt();
    enterMorning({ ...base, lastPhrase: 5 }, spy.randInt);
    expect(`[${spy.calls.join(",")}]`).toBe(`[${String(MORNING_PHRASE_COUNT - 1)}]`);
  });

  /** 탈락 한 번을 치르고 다음 밤까지 넘긴다. 마피아가 살아 있는 비마피아 한 명을 고른다. */
  function nextKill(state: RoomState, rng: (n: number) => number, kill: boolean): RoomState {
    let s = state;
    if (kill) {
      const mafia = s.players.find((p) => p.role === "mafia" && p.alive !== false)!;
      const victim = s.players.find((p) => p.role !== "mafia" && p.alive !== false)!;
      s = pickAs(s, mafia, victim);
    }
    return tick(s, s.phaseEndsAt ?? 0, rng);
  }

  function toNight(state: RoomState, rng: (n: number) => number): RoomState {
    let s = state;
    while (s.phase !== "night") s = tick(s, s.phaseEndsAt ?? 0, rng);
    return s;
  }

  it("시드 1..200 에서 두 밤 연속 탈락의 문구 번호가 같지 않고, 첫 탈락 번호로 1 과 MORNING_PHRASE_COUNT 가 모두 나온다", () => {
    const first = new Set<number>();
    const repeats: number[] = [];
    for (let seed = 1; seed <= 200; seed += 1) {
      const rng = seededRandInt(seed);
      const m1 = nextKill(nightOf(6, 11), rng, true);
      const p1 = m1.morning?.phrase ?? 0;
      first.add(p1);
      const m2 = nextKill(toNight(m1, rng), rng, true);
      if (m2.morning?.phrase === p1) repeats.push(seed);
    }
    expect(`[${repeats.join(",")}]`).toBe("[]");
    expect(first.has(1) && first.has(MORNING_PHRASE_COUNT)).toBe(true);
  });

  it("탈락 없는 밤 사이에도 lastPhrase 는 유지되어 탈락 → 무사 → 탈락 의 두 번호가 같지 않다", () => {
    const repeats: number[] = [];
    for (let seed = 1; seed <= 100; seed += 1) {
      const rng = seededRandInt(seed);
      const a = nextKill(nightOf(6, 11), rng, true);
      const quiet = nextKill(toNight(a, rng), rng, false);
      expect(quiet.lastPhrase).toBe(a.lastPhrase);
      const b = nextKill(toNight(quiet, rng), rng, true);
      if (b.morning?.phrase === a.morning?.phrase) repeats.push(seed);
    }
    expect(`[${repeats.join(",")}]`).toBe("[]");
  });

  it("morning 에는 eliminated·phrase 말고 다른 키(역할 등)가 없다", () => {
    const { night, m1, c1 } = cast6();
    const out = enterMorning(picks(night, [m1, c1]), seededRandInt(4));
    expect(Object.keys(out.morning ?? {}).sort().join(",")).toBe("eliminated,phrase");
    expect(JSON.stringify(out.morning).includes("citizen")).toBe(false);
  });
});

describe("따라잡기", () => {
  it("discussion 에서 아무도 안 고른 채 tick 한 번으로 다음 낮 discussion 까지 가면 morning {} 이 남고 일차가 하나 오른다", () => {
    const discussion = stateAtPhase("discussion", 6, 11);
    const endsAt = discussion.phaseEndsAt ?? 0;
    const caught = tick(discussion, endsAt + NOMINATION_MS + NIGHT_MS + 5_000 + 2_000);
    expect(caught.phase).toBe("discussion");
    expect(caught.day).toBe((discussion.day ?? 0) + 1);
    expect(caught.morning === undefined).toBe(false);
    expect(Object.keys(caught.morning ?? { x: 1 }).length).toBe(0);
    expect(caught.players.some((p) => "nightPick" in p)).toBe(false);
  });
});

describe("역할별 일지 쌓기 (D-09·D-10)", () => {
  const recOf = (state: RoomState, p: Player, field: "assassinations" | "treatments" | "investigations"): string =>
    JSON.stringify(state.players.find((q) => q.id === p.id)?.[field]);
  const has = (state: RoomState, p: Player, field: "assassinations" | "treatments" | "investigations"): boolean =>
    state.players.find((q) => q.id === p.id) !== undefined && field in (state.players.find((q) => q.id === p.id) ?? {});

  it("마피아 둘이 시민을 지목하고 의사가 다른 사람을 보호하면 마피아 둘은 died true 암살일지를, 의사는 치료일지를 받고 시민은 세 필드 모두 없다", () => {
    const { night, m1, m2, police, doctor, c1, c2 } = cast6();
    const out = enterMorning(picks(night, [m1, c1], [m2, c1], [doctor, c2], [police, m1]), spyRandInt().randInt);
    const kill = JSON.stringify([{ n: 1, target: c1.seat, died: true }]);
    expect(recOf(out, m1, "assassinations")).toBe(kill);
    expect(recOf(out, m2, "assassinations")).toBe(kill);
    expect(recOf(out, doctor, "treatments")).toBe(JSON.stringify([{ n: 1, target: c2.seat }]));
    expect(recOf(out, police, "investigations")).toBe(JSON.stringify([{ n: 1, target: m1.seat, isMafia: true }]));
    for (const p of [c1, c2]) {
      for (const f of ["assassinations", "treatments", "investigations"] as const) expect(has(out, p, f)).toBe(false);
    }
    expect(has(out, doctor, "assassinations")).toBe(false);
    expect(has(out, m1, "treatments")).toBe(false);
  });

  it("의사가 최종 지목을 막으면 탈락 없음 morning {} 이고 마피아 둘은 died false, 의사 줄은 키가 정확히 n,target 이다", () => {
    const { night, m1, m2, doctor, c1 } = cast6();
    const out = enterMorning(picks(night, [m1, c1], [m2, c1], [doctor, c1]), spyRandInt().randInt);
    expect(Object.keys(out.morning ?? { x: 1 }).length).toBe(0);
    const miss = JSON.stringify([{ n: 1, target: c1.seat, died: false }]);
    expect(recOf(out, m1, "assassinations")).toBe(miss);
    expect(recOf(out, m2, "assassinations")).toBe(miss);
    expect(recOf(out, doctor, "treatments")).toBe(JSON.stringify([{ n: 1, target: c1.seat }]));
    const line = out.players.find((p) => p.id === doctor.id)?.treatments?.[0] ?? {};
    expect(Object.keys(line).sort().join(",")).toBe("n,target");
  });

  it("의사가 자기 자신을 보호하면 치료일지 target 이 자기 seat 이다", () => {
    const { night, doctor } = cast6();
    const out = enterMorning(picks(night, [doctor, doctor]), spyRandInt().randInt);
    expect(recOf(out, doctor, "treatments")).toBe(JSON.stringify([{ n: 1, target: doctor.seat }]));
  });

  it("마피아가 아무도 안 고르면 암살일지 줄이 없고, 의사가 안 고르면 치료일지 줄이 없고, 경찰만 골랐으면 경찰 줄만 쌓인다", () => {
    const { night, m1, m2, police, doctor, c1 } = cast6();
    const out = enterMorning(picks(night, [police, c1]), spyRandInt().randInt);
    expect(has(out, m1, "assassinations") || has(out, m2, "assassinations")).toBe(false);
    expect(has(out, doctor, "treatments")).toBe(false);
    expect(recOf(out, police, "investigations")).toBe(JSON.stringify([{ n: 1, target: c1.seat, isMafia: false }]));
    const mafiaOnly = enterMorning(picks(night, [m1, c1]), spyRandInt().randInt);
    expect(has(mafiaOnly, doctor, "treatments")).toBe(false);
    expect(has(mafiaOnly, police, "investigations")).toBe(false);
  });

  it("마피아 일부만 고르면(A2) 최종 대상 하나가 안 고른 동료에게도 같은 줄로 쌓인다", () => {
    const { night, m1, m2, c2 } = cast6();
    const out = enterMorning(picks(night, [m1, c2]), spyRandInt().randInt);
    const kill = JSON.stringify([{ n: 1, target: c2.seat, died: true }]);
    expect(recOf(out, m1, "assassinations")).toBe(kill);
    expect(recOf(out, m2, "assassinations")).toBe(kill);
  });

  it("동률이면 두 마피아의 줄이 같고 기존 규칙의 최종 대상이며 난수는 동률 한 번 + 문구 한 번뿐이다", () => {
    const { night, m1, m2, c1, c2 } = cast6();
    const tied = picks(night, [m1, c1], [m2, c2]);
    const spy = spyRandInt();
    const out = enterMorning(tied, spy.randInt);
    expect(`[${spy.calls.join(",")}]`).toBe(`[2,${String(MORNING_PHRASE_COUNT)}]`);
    const final = Math.min(c1.seat, c2.seat);
    const kill = JSON.stringify([{ n: 1, target: final, died: true }]);
    expect(recOf(out, m1, "assassinations")).toBe(kill);
    expect(recOf(out, m2, "assassinations")).toBe(kill);
    const high = enterMorning(tied, (n) => n - 1);
    expect(recOf(high, m1, "assassinations")).toBe(recOf(high, m2, "assassinations"));
    expect(recOf(high, m1, "assassinations")).toBe(JSON.stringify([{ n: 1, target: Math.max(c1.seat, c2.seat), died: true }]));
  });

  it("밤 시작 때 이미 탈락한 마피아에게는 새 줄이 쌓이지 않고 기존 줄은 그대로 남는다", () => {
    const { night, m1, m2, c1 } = cast6();
    const old = [{ n: 0, target: 99, died: false }];
    const seeded: RoomState = {
      ...night,
      players: night.players.map((p) => (p.id === m2.id ? { ...p, alive: false, assassinations: old } : p)),
    };
    const out = enterMorning(picks(seeded, [m1, c1]), spyRandInt().randInt);
    expect(recOf(out, m2, "assassinations")).toBe(JSON.stringify(old));
    expect(recOf(out, m1, "assassinations")).toBe(JSON.stringify([{ n: 1, target: c1.seat, died: true }]));
  });

  it("두 밤을 돌리면 줄이 n 1, 2 순서로 쌓이고 n 은 그 밤의 일차다", () => {
    const rng = seededRandInt(5);
    const first = cast6();
    const m1Morning = tick(picks(first.night, [first.m1, first.c1], [first.m2, first.c1], [first.doctor, first.c2]), first.night.phaseEndsAt ?? 0, rng);
    let s = m1Morning;
    while (s.phase !== "night") s = tick(s, s.phaseEndsAt ?? 0, rng);
    expect(s.day).toBe(2);
    const alive = (p: Player): boolean => s.players.find((q) => q.id === p.id)?.alive !== false;
    const victim = alive(first.c2) ? first.c2 : first.police;
    s = picks(s, [first.m1, victim], [first.m2, victim], [first.doctor, first.doctor]);
    s = tick(s, s.phaseEndsAt ?? 0, rng);
    const m1After = s.players.find((p) => p.id === first.m1.id)?.assassinations ?? [];
    expect(m1After.map((r) => r.n).join(",")).toBe("1,2");
    expect(m1After.map((r) => r.target).join(",")).toBe(`${String(first.c1.seat)},${String(victim.seat)}`);
    const doc = s.players.find((p) => p.id === first.doctor.id)?.treatments ?? [];
    expect(doc.map((r) => r.n).join(",")).toBe("1,2");
  });

  it("enterMorning 은 입력 상태를 바꾸지 않고 결과의 어느 줄에도 직업 문자열이 없다", () => {
    const { night, m1, m2, police, doctor, c1 } = cast6();
    const input = picks(night, [m1, c1], [m2, c1], [doctor, c1], [police, m1]);
    const before = JSON.stringify(input);
    const out = enterMorning(input, spyRandInt().randInt);
    expect(JSON.stringify(input)).toBe(before);
    for (const p of out.players) {
      const lines = JSON.stringify([p.assassinations ?? [], p.treatments ?? [], p.investigations ?? []]);
      expect(/mafia|police|doctor|citizen/.test(lines)).toBe(false);
    }
  });
});

describe("밤 기록 nightLog (04-06, D-27) — 서버 전용 판 요약 재료", () => {
  const logOf = (state: RoomState): string => JSON.stringify(state.nightLog);

  it("지목 없음: {n, died:false} 한 줄이고 target 키가 없다", () => {
    const { night } = cast6();
    const out = enterMorning(night, spyRandInt().randInt);
    expect(logOf(out)).toBe(JSON.stringify([{ n: 1, died: false }]));
    expect(out.nightLog?.[0] !== undefined && "target" in out.nightLog[0]).toBe(false);
  });

  it("지목·탈락: {n, target, died:true}", () => {
    const { night, m1, m2, c1 } = cast6();
    const out = enterMorning(picks(night, [m1, c1], [m2, c1]), spyRandInt().randInt);
    expect(logOf(out)).toBe(JSON.stringify([{ n: 1, target: c1.seat, died: true }]));
  });

  it("지목·의사 구출: {n, target, died:false} — 지목 없음과 달리 target 이 남는다", () => {
    const { night, m1, m2, doctor, c1 } = cast6();
    const out = enterMorning(picks(night, [m1, c1], [m2, c1], [doctor, c1]), spyRandInt().randInt);
    expect(logOf(out)).toBe(JSON.stringify([{ n: 1, target: c1.seat, died: false }]));
  });

  it("밤마다 끝에 쌓인다(일차는 state.day), 입력 상태는 바뀌지 않는다", () => {
    const { night, m1, m2, c1 } = cast6();
    const old = [{ n: 1, died: false }];
    const day2: RoomState = { ...night, day: 2, nightLog: old };
    const out = enterMorning(picks(day2, [m1, c1], [m2, c1]), spyRandInt().randInt);
    expect(logOf(out)).toBe(JSON.stringify([{ n: 1, died: false }, { n: 2, target: c1.seat, died: true }]));
    expect(JSON.stringify(old)).toBe(JSON.stringify([{ n: 1, died: false }]));
    expect(day2.nightLog === old).toBe(true);
  });

  it("난수 호출 순서는 그대로: 동률 한 번 뒤 문구 한 번", () => {
    const { night, m1, m2, c1, c2 } = cast6();
    const spy = spyRandInt();
    enterMorning(picks(night, [m1, c1], [m2, c2]), spy.randInt);
    expect(`[${spy.calls.join(",")}]`).toBe(`[2,${String(MORNING_PHRASE_COUNT)}]`);
  });
});
