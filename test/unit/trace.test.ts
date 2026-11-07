// 15페이즈 D-06 아침 흔적(결정 0074): 순수 규칙(trace.ts)·enterMorning 의 trace·morningMsOf 가산·view 복사·판정 불변(T-15-12, T-15-14).
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { morningMsOf } from "../../shared/game/discussion";
import { DEFAULT_LOOK } from "../../shared/game/look";
import { enterMorning, pickTarget, resolveNight } from "../../shared/game/night";
import { MORNING_MAX_MS, MORNING_MS, MORNING_NOTE_MS, MORNING_TRACE_MS, MORNING_VICTIM_MS, MORNING_WILL_MS } from "../../shared/game/phases";
import { attachConnection, createRoomState, joinRoom, startGame } from "../../shared/game/room";
import type { Player, RoomState } from "../../shared/game/room";
import type { RoleId } from "../../shared/game/roles";
import { tick } from "../../shared/game/tick";
import { TRACE_OF_OUTFIT, pickTracePiece, traceCandidates } from "../../shared/game/trace";
import { buildView } from "../../shared/game/view";
import { OUTFIT_IDS, TRACE_PIECE_IDS } from "../../shared/protocol";
import type { OutfitId } from "../../shared/protocol";
import { seededRandInt } from "../helpers/seededRandom";

const START_AT = 10_000;

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

/** 실제 전이로 1일차 밤 상태를 만든다(6명 판). */
function nightOf(n = 6, seed = 11): RoomState {
  const lobby = lobbyOf(n);
  const started = startGame(lobby, lobby.hostId, START_AT, seededRandInt(seed));
  if (!started.ok) throw new Error(`startGame failed: ${started.error}`);
  let state = started.state;
  while (state.phase !== "night") {
    if (state.phaseEndsAt === null) throw new Error("phase has no deadline");
    state = tick(state, state.phaseEndsAt, seededRandInt(seed));
  }
  return state;
}

const withRole = (s: RoomState, role: RoleId): Player[] => s.players.filter((p) => p.role === role).sort((a, b) => a.seat - b.seat);
function pickAs(s: RoomState, actor: Player, target: Player): RoomState {
  const r = pickTarget(s, actor.id, target.seat);
  if (!r.ok) throw new Error(`pickTarget rejected: ${r.error}`);
  return r.state;
}
const picks = (s: RoomState, ...pairs: Array<[Player, Player]>): RoomState => pairs.reduce((acc, [a, t]) => pickAs(acc, a, t), s);
const withLook = (s: RoomState, p: Player, look: OutfitId): RoomState => ({ ...s, players: s.players.map((q) => (q.id === p.id ? { ...q, look } : q)) });

/** 6명 판 1일차 밤: 마피아 둘·시민 둘·경찰·의사. */
function cast(): { night: RoomState; m1: Player; m2: Player; c1: Player; c2: Player; police: Player; doctor: Player } {
  const night = nightOf();
  const [m1, m2] = withRole(night, "mafia") as [Player, Player];
  const [c1, c2] = withRole(night, "citizen") as [Player, Player];
  return { night, m1, m2, c1, c2, police: withRole(night, "police")[0]!, doctor: withRole(night, "doctor")[0]! };
}

describe("TRACE_OF_OUTFIT (D-06)", () => {
  it("모든 의상이 키이고 값은 TRACE_PIECE_IDS 안에서 서로 다르며 의상 id 와 이름이 겹치지 않는다", () => {
    expect(Object.keys(TRACE_OF_OUTFIT).sort().join(",")).toBe([...OUTFIT_IDS].sort().join(","));
    const values = Object.values(TRACE_OF_OUTFIT);
    expect(new Set(values).size).toBe(OUTFIT_IDS.length);
    expect(values.every((v) => (TRACE_PIECE_IDS as readonly string[]).includes(v))).toBe(true);
    expect(TRACE_PIECE_IDS.length).toBe(9);
    expect(values.some((v) => (OUTFIT_IDS as readonly string[]).includes(v))).toBe(false);
  });

  it("계획의 대응표 그대로다", () => {
    expect(JSON.stringify(TRACE_OF_OUTFIT)).toBe(
      JSON.stringify({
        coat: "button",
        police: "pin",
        doctor: "whiteCloth",
        mafia: "blackCloth",
        detective: "brownCloth",
        reporter: "pencil",
        elder: "grayThread",
        hood: "navyThread",
        noir: "redCloth",
      }),
    );
  });
});

describe("traceCandidates · pickTracePiece (순수)", () => {
  it("풀은 피해자를 고른 산 사람이고 피해자 본인은 뺀다, seat 오름차순이며 역할을 읽지 않는다", () => {
    const { night, m1, m2, c1, c2 } = cast();
    const s = picks(night, [c1, c1], [m2, c1], [m1, c1], [c2, m1]);
    expect(traceCandidates(s, c1.seat).map((p) => p.seat).join(",")).toBe([m1.seat, m2.seat].sort((a, b) => a - b).join(","));
    // 죽은 사람의 선택은 세지 않는다
    const dead: RoomState = { ...s, players: s.players.map((p) => (p.id === m2.id ? { ...p, alive: false } : p)) };
    expect(traceCandidates(dead, c1.seat).map((p) => p.seat).join(",")).toBe(String(m1.seat));
    expect(traceCandidates(night, c1.seat).length).toBe(0);
  });

  it("풀이 비면 undefined 이고 난수를 부르지 않는다", () => {
    const { night, c1 } = cast();
    const s = picks(night, [c1, c1]); // 피해자 본인만 자기를 골랐다
    expect(String(pickTracePiece(s, c1.seat, () => { throw new Error("randInt 호출"); }))).toBe("undefined");
  });

  it("풀이 한 명이면 randInt 가 무엇이든 그 사람 의상의 조각이다, 의상이 없으면 coat → button", () => {
    const { night, m1, c1 } = cast();
    const s = picks(night, [m1, c1]);
    expect(pickTracePiece(s, c1.seat, () => 0)).toBe(TRACE_OF_OUTFIT[DEFAULT_LOOK]);
    expect(pickTracePiece(s, c1.seat, () => 0)).toBe("button");
    expect(pickTracePiece(withLook(s, m1, "noir"), c1.seat, () => 0)).toBe("redCloth");
  });

  it("풀이 둘이면 randInt(2) 인덱스(seat 오름차순)의 의상이고 호출은 한 번이다", () => {
    const { night, m1, m2, c1 } = cast();
    const [first, second] = [m1, m2].sort((a, b) => a.seat - b.seat) as [Player, Player];
    let s = picks(night, [m1, c1], [m2, c1]);
    s = withLook(withLook(s, first, "hood"), second, "reporter");
    const calls: number[] = [];
    const piece = (idx: number): string | undefined =>
      pickTracePiece(s, c1.seat, (n) => {
        calls.push(n);
        return idx;
      });
    expect(`${piece(0)}/${piece(1)}`).toBe("navyThread/pencil");
    expect(calls.join(",")).toBe("2,2");
  });

  it("trace.ts 는 역할을 읽지 않는다(주석 뺀 본문에 .role 이 없다)", () => {
    const body = readFileSync("shared/game/trace.ts", "utf8")
      .split("\n")
      .filter((l) => !/^\s*\/\//.test(l))
      .join("\n");
    expect(body.includes(".role")).toBe(false);
  });
});

describe("enterMorning 의 흔적 (D-06)", () => {
  it("피해자가 있으면 morning.trace 가 풀에서 뽑은 조각이고 키는 eliminated·trace 둘이다", () => {
    const { night, m1, m2, c1 } = cast();
    const s = withLook(withLook(picks(night, [m1, c1], [m2, c1]), m1, "mafia"), m2, "mafia");
    const out = enterMorning(s, () => 1);
    expect(out.morning?.eliminated).toBe(c1.seat);
    expect(out.morning?.trace).toBe("blackCloth");
    expect(Object.keys(out.morning ?? {}).sort().join(",")).toBe("eliminated,trace");
  });

  it("다른 역할이 우연히 같은 사람을 골랐어도 풀에 든다(확정 증거 아님) — 의상의 함수이지 역할의 함수가 아니다", () => {
    const { night, m1, m2, c1, c2 } = cast();
    // 마피아 둘이 c1 을 고르고 시민 c2 도 c1 을 골랐다. c2 의 의상만 다르게 두면 randInt 로 c2 의 조각이 나온다.
    let s = picks(night, [m1, c1], [m2, c1], [c2, c1]);
    s = withLook(withLook(withLook(s, m1, "mafia"), m2, "mafia"), c2, "elder");
    const seats = traceCandidates(s, c1.seat).map((p) => p.id);
    const idx = seats.indexOf(c2.id);
    expect(enterMorning(s, () => idx).morning?.trace).toBe("grayThread");
  });

  it("구출(saved)·무효 밤·아무도 안 고름은 trace 키가 없다", () => {
    const { night, m1, m2, c1, c2, doctor } = cast();
    const saved = enterMorning(picks(night, [m1, c1], [m2, c1], [doctor, c1]), () => 0);
    expect(JSON.stringify(saved.morning)).toBe('{"saved":true}');
    const split = enterMorning(picks(night, [m1, c1], [m2, c2]), () => 0);
    expect(JSON.stringify(split.morning)).toBe("{}");
    expect(JSON.stringify(enterMorning(night, () => 0).morning)).toBe("{}");
  });

  it("난수는 탈락자가 있을 때만 한 번 부르고, 없으면 0번이며, randInt 를 안 주면 첫 후보로 결정적이다", () => {
    const { night, m1, m2, c1, c2, doctor } = cast();
    let calls = 0;
    const counter = (n: number): number => {
      calls += 1;
      return n - 1;
    };
    enterMorning(picks(night, [m1, c1], [m2, c1]), counter);
    expect(calls).toBe(1);
    calls = 0;
    enterMorning(picks(night, [m1, c1], [m2, c1], [doctor, c1]), counter);
    enterMorning(picks(night, [m1, c1], [m2, c2]), counter);
    enterMorning(night, counter);
    expect(calls).toBe(0);
    const killed = picks(night, [m1, c1], [m2, c1]);
    expect(enterMorning(killed).morning?.trace).toBe(enterMorning(killed, () => 0).morning?.trace);
  });

  it("nightPick 은 아침 상태에서 지워지고 흔적의 풀(누가 골랐는지)은 상태 어디에도 남지 않는다", () => {
    const { night, m1, m2, c1 } = cast();
    const out = enterMorning(picks(night, [m1, c1], [m2, c1]), () => 0);
    expect(out.players.some((p) => "nightPick" in p)).toBe(false);
    expect(JSON.stringify(out.morning).includes("pool")).toBe(false);
  });

  it("입력 상태를 바꾸지 않는다", () => {
    const { night, m1, m2, c1 } = cast();
    const s = picks(night, [m1, c1], [m2, c1]);
    const before = JSON.stringify(s);
    enterMorning(s, () => 0);
    expect(JSON.stringify(s) === before).toBe(true);
  });
});

describe("판정 불변 (T-15-14)", () => {
  it("시민의 선택을 넣고 뺀 resolveNight 가 같다", () => {
    const { night, m1, m2, c1, c2, police, doctor } = cast();
    const base = picks(night, [m1, c1], [m2, c1], [police, m1], [doctor, c2]);
    const withCitizens = picks(base, [c1, m1], [c2, c1]);
    expect(JSON.stringify(resolveNight(withCitizens))).toBe(JSON.stringify(resolveNight(base)));
    // 시민이 자기·마피아를 골라도 같다
    const odd = picks(base, [c1, c1], [c2, m2]);
    expect(JSON.stringify(resolveNight(odd))).toBe(JSON.stringify(resolveNight(base)));
  });

  it("마피아가 동료나 자신을 고른 값은 확정을 만들지 않는다(그 마피아가 다시 골라야 한다)", () => {
    const { night, m1, m2, c1 } = cast();
    const s = picks(night, [m1, c1], [m2, m1]);
    expect(resolveNight(s).target).toBeUndefined();
    expect(enterMorning(s, () => 0).morning).toEqual({});
    const selfPick = picks(night, [m1, c1], [m2, m2]);
    expect(resolveNight(selfPick).eliminated).toBeUndefined();
  });

  it("의사 자기 보호와 경찰 자기 조사는 그대로다", () => {
    const { night, m1, m2, police, doctor } = cast();
    const s = enterMorning(picks(night, [m1, doctor], [m2, doctor], [doctor, doctor], [police, police]), () => 0);
    expect(JSON.stringify(s.morning)).toBe('{"saved":true}');
    expect(JSON.stringify(s.players.find((p) => p.id === police.id)?.investigations)).toBe(JSON.stringify([{ n: 1, target: police.seat, isMafia: false }]));
  });
});

describe("morningMsOf 의 흔적 가산 (D-06)", () => {
  const morningWith = (night: RoomState, ...pairs: Array<[Player, Player]>): RoomState => ({
    ...enterMorning(picks(night, ...pairs), () => 0),
    phase: "morning",
  });

  it("흔적이 있으면 기본 + 탈락 + 3초이고 유언·쪽지가 더해지며 상한 15초 안이다", () => {
    const { night, m1, m2, c1 } = cast();
    const m = morningWith(night, [m1, c1], [m2, c1]);
    expect(m.morning?.trace).toBeDefined();
    const noWill = { ...m, players: m.players.map((p) => (p.id === c1.id ? { ...p, will: undefined } : p)) } as RoomState;
    expect(morningMsOf(noWill)).toBe(MORNING_MS + MORNING_VICTIM_MS + MORNING_TRACE_MS);
    const willed: RoomState = { ...m, players: m.players.map((p) => (p.id === c1.id ? { ...p, will: "유언" } : p)), nightNote: "쪽지" };
    const full = MORNING_MS + MORNING_VICTIM_MS + MORNING_WILL_MS + MORNING_NOTE_MS + MORNING_TRACE_MS;
    expect(morningMsOf(willed)).toBe(full);
    expect(full).toBe(14_000);
    expect(full <= MORNING_MAX_MS).toBe(true);
  });

  it("흔적이 없으면 기존 길이 그대로다(회귀)", () => {
    const { night, m1, m2, c1 } = cast();
    const m = morningWith(night, [m1, c1], [m2, c1]);
    const { trace: _trace, ...bare } = m.morning!;
    const without: RoomState = { ...m, morning: bare };
    expect(morningMsOf(without)).toBe(MORNING_MS + MORNING_VICTIM_MS);
    expect(morningMsOf({ ...m, morning: {} })).toBe(MORNING_MS);
    expect(morningMsOf({ ...m, morning: { saved: true } })).toBe(MORNING_MS);
  });
});

describe("view 의 흔적 (T-15-12)", () => {
  const toMorning = (s: RoomState): RoomState => tick(s, s.phaseEndsAt!, seededRandInt(3));

  it("아침 모든 view(유령 포함)의 day.morning.trace 가 같은 조각 id 이고 키가 eliminated·trace 뿐이다", () => {
    const { night, m1, m2, c1 } = cast();
    const m = toMorning(picks(night, [m1, c1], [m2, c1]));
    expect(m.phase).toBe("morning");
    const traces = new Set(m.players.map((p) => buildView(m, p.id, START_AT).day?.morning?.trace));
    expect(traces.size).toBe(1);
    const piece = [...traces][0];
    expect((TRACE_PIECE_IDS as readonly string[]).includes(String(piece))).toBe(true);
    for (const p of m.players) {
      const day = buildView(m, p.id, START_AT).day;
      expect(Object.keys(day?.morning ?? {}).sort().join(",")).toBe("eliminated,trace");
    }
    // 유령(피해자)에게도 같다
    expect(buildView(m, c1.id, START_AT).day?.morning?.trace).toBe(piece);
  });

  it("흔적 줄에 seat·look·role·풀이 없다: 값은 조각 id 문자열 하나다", () => {
    const { night, m1, m2, c1 } = cast();
    const m = toMorning(picks(night, [m1, c1], [m2, c1]));
    const v = buildView(m, m1.id, START_AT);
    expect(typeof v.day?.morning?.trace).toBe("string");
    const json = JSON.stringify(v.day?.morning);
    expect(json.includes("look")).toBe(false);
    expect(json.includes("role")).toBe(false);
    expect(json.includes("seat")).toBe(false);
  });

  it("탈락자 없는 아침(구출·무효)은 키가 없고, 아침 밖 단계의 day 에는 trace 가 없다", () => {
    const { night, m1, m2, c1, c2, doctor } = cast();
    const saved = toMorning(picks(night, [m1, c1], [m2, c1], [doctor, c1]));
    const split = toMorning(picks(night, [m1, c1], [m2, c2]));
    expect("trace" in (buildView(saved, m1.id, START_AT).day?.morning ?? {})).toBe(false);
    expect("trace" in (buildView(split, m1.id, START_AT).day?.morning ?? {})).toBe(false);
    const killed = toMorning(picks(night, [m1, c1], [m2, c1]));
    const dayAnnounce = tick(killed, killed.phaseEndsAt!, seededRandInt(3));
    expect(dayAnnounce.phase).toBe("dayAnnounce");
    expect(JSON.stringify(buildView(dayAnnounce, m1.id, START_AT).day).includes("trace")).toBe(false);
    expect(JSON.stringify(buildView(night, m1.id, START_AT).day).includes("trace")).toBe(false);
  });

  it("허용 목록 밖 키는 복사되지 않는다(필드별 복사)", () => {
    const { night, m1, m2, c1 } = cast();
    const m = toMorning(picks(night, [m1, c1], [m2, c1]));
    const polluted = { ...m, morning: { ...m.morning, pool: [1, 2], extra: "x" } } as unknown as RoomState;
    expect(Object.keys(buildView(polluted, m1.id, START_AT).day?.morning ?? {}).sort().join(",")).toBe("eliminated,trace");
  });
});
