// 11-06: 맵 표와 선택 규칙(MAP-06, D-20·D-21·D-22) — 순수 규칙만. 광장 데이터 시험은 Task 2 에서 이 파일에 더한다.
import { describe, expect, it } from "vitest";
import { BAR_MAP } from "../../shared/game/map";
import { PLAZA_MAP } from "../../shared/game/mapPlaza";
import { MAPS, PLAYABLE_MAPS, decideMap, mapOf, pickMap, roomMapId } from "../../shared/game/maps";
import { assignRoles } from "../../shared/game/roles";
import { attachConnection, createRoomState, joinRoom, startGame } from "../../shared/game/room";
import type { RoomState } from "../../shared/game/room";
import type { MapChoice } from "../../shared/protocol";
import { seededRandInt } from "../helpers/seededRandom";

const HOST = "player-id-0000-aaaa";

function lobby(n = 4): RoomState {
  const created = createRoomState({ code: "0420", hostId: HOST, hostToken: "token-secret-0000-aaaa-0123456789", hostNickname: "이름0", now: 0 });
  if (!created.ok) throw new Error("createRoomState failed");
  let state = attachConnection(created.state, HOST, "conn-0");
  for (let i = 1; i < n; i += 1) {
    const id = `player-id-000${i}-aaaa`;
    const joined = joinRoom(state, { playerId: id, token: `token-secret-000${i}-aaaa-0123456789`, nickname: `이름${i}` });
    if (!joined.ok) throw new Error(`joinRoom failed: ${joined.error}`);
    state = attachConnection(joined.state, id, `conn-${i}`);
  }
  return state;
}

/** 호출 횟수와 인자를 남기는 난수. */
function spy(value: number): { fn: (n: number) => number; calls: number[] } {
  const calls: number[] = [];
  return { fn: (n) => (calls.push(n), value % n), calls };
}

describe("맵 표 (D-22)", () => {
  it("PLAYABLE_MAPS 는 이 계획에서 bar 뿐이다 — 광장은 11-13 이 연다(T-11-21)", () => {
    expect([...PLAYABLE_MAPS]).toEqual(["bar"]);
  });
  it("MAPS.bar 는 BAR_MAP 이고 mapOf(bar) 가 그것을 돌려준다", () => {
    expect(MAPS.bar).toBe(BAR_MAP);
    expect(mapOf("bar")).toBe(BAR_MAP);
    expect(mapOf("bar").id).toBe("bar");
  });
});

describe("광장 등록 (D-22)", () => {
  it("MAPS.plaza 는 PLAZA_MAP 이고 mapOf(plaza).id 는 plaza 다 — 표의 한 줄 등록", () => {
    expect(MAPS.plaza).toBe(PLAZA_MAP);
    expect(mapOf("plaza")).toBe(PLAZA_MAP);
    expect(mapOf("plaza").id).toBe("plaza");
  });
  it("roomMapId 가 plaza 인 방은 mapOf 가 광장 마스크를 돌려준다", () => {
    const started = startGame(lobby(), HOST, 1000, seededRandInt(1));
    if (!started.ok) throw new Error("start failed");
    expect(mapOf(roomMapId({ ...started.state, map: "plaza" }))).toBe(PLAZA_MAP);
  });
});

describe("decideMap (D-21)", () => {
  it("choice 가 bar 면 bar 다 — 난수를 부르지 않는다", () => {
    const r = spy(0);
    expect(decideMap("bar", r.fn)).toBe("bar");
    expect(r.calls).toEqual([]);
  });
  it("plaza 는 playable 에 없으면 bar, 있으면 plaza", () => {
    expect(decideMap("plaza", spy(0).fn)).toBe("bar");
    expect(decideMap("plaza", spy(0).fn, ["bar"])).toBe("bar");
    expect(decideMap("plaza", spy(0).fn, ["bar", "plaza"])).toBe("plaza");
  });
  it("random 은 playable 이 하나면 난수를 한 번도 부르지 않고 그 하나다", () => {
    const r = spy(1);
    expect(decideMap("random", r.fn, ["bar"])).toBe("bar");
    expect(decideMap("random", r.fn)).toBe("bar");
    expect(r.calls).toEqual([]);
  });
  it("random 은 playable 이 둘이면 randInt(2) 한 번으로 고른다", () => {
    const a = spy(0);
    expect(decideMap("random", a.fn, ["bar", "plaza"])).toBe("bar");
    expect(a.calls).toEqual([2]);
    const b = spy(1);
    expect(decideMap("random", b.fn, ["bar", "plaza"])).toBe("plaza");
    expect(b.calls).toEqual([2]);
  });
});

describe("roomMapId", () => {
  it("대기실은 늘 bar 다 (D-22) — state.map 이 있어도", () => {
    expect(roomMapId(lobby())).toBe("bar");
    expect(roomMapId({ ...lobby(), map: "plaza" })).toBe("bar");
  });
  it("시작한 뒤에는 state.map, 없으면 bar", () => {
    const started = startGame(lobby(), HOST, 1000, seededRandInt(1));
    if (!started.ok) throw new Error("start failed");
    expect(roomMapId(started.state)).toBe("bar");
    expect(roomMapId({ ...started.state, map: "plaza" })).toBe("plaza");
    const { map: _m, ...old } = started.state;
    expect(roomMapId(old)).toBe("bar");
  });
});

describe("pickMap (D-20, L40)", () => {
  const guest = "player-id-0001-aaaa";
  const outcome = (r: { ok: boolean }): string => (r.ok ? "ok" : "no");
  it("방장이 대기실에서 random·bar 를 고르면 받아들인다", () => {
    const s = lobby();
    expect(outcome(pickMap(s, HOST, "random"))).toBe("ok");
    const r = pickMap(s, HOST, "bar");
    expect(r.ok && r.state.mapChoice).toBe("bar");
  });
  it("방장이 아니면 거절", () => {
    expect(outcome(pickMap(lobby(), guest, "bar"))).toBe("no");
  });
  it("대기실·ended 가 아닌 단계는 거절 (assigning ~ morning)", () => {
    const started = startGame(lobby(), HOST, 1000, seededRandInt(1));
    if (!started.ok) throw new Error("start failed");
    for (const phase of ["assigning", "roleReveal", "dayAnnounce", "discussion", "nomination", "defense", "verdict", "execution", "night", "morning"] as const) {
      expect(`${phase}:${outcome(pickMap({ ...started.state, phase }, HOST, "bar"))}`).toBe(`${phase}:no`);
    }
    expect(outcome(pickMap({ ...started.state, phase: "ended" }, HOST, "bar"))).toBe("ok");
  });
  it("playable 밖의 값은 거절 — 이 계획의 PLAYABLE_MAPS=[bar] 에서 plaza 는 안 된다", () => {
    expect(outcome(pickMap(lobby(), HOST, "plaza"))).toBe("no");
  });
  it("주입한 playable [bar, plaza] 에서는 plaza 가 받아들여진다", () => {
    const r = pickMap(lobby(), HOST, "plaza", ["bar", "plaza"]);
    expect(r.ok && r.state.mapChoice).toBe("plaza");
  });
  it("같은 값(기본 random 포함)이면 입력 상태 그대로", () => {
    const s = lobby();
    const a = pickMap(s, HOST, "random");
    expect(a.ok && a.state).toBe(s);
    const b = pickMap({ ...s, mapChoice: "bar" }, HOST, "bar");
    expect(b.ok && b.state.mapChoice).toBe("bar");
    const c = pickMap(s, HOST, "bar");
    if (!c.ok) throw new Error("expected ok");
    const d = pickMap(c.state, HOST, "bar");
    expect(d.ok && d.state).toBe(c.state);
  });
  it("값이 바뀌어도 입력 상태는 건드리지 않는다", () => {
    const s = lobby();
    const before = JSON.stringify(s);
    pickMap(s, HOST, "bar");
    expect(JSON.stringify(s)).toBe(before);
  });
});

describe("startGame 의 맵 결정 (D-21)", () => {
  it("map 은 decideMap 결과이고 mapChoice 를 읽는다", () => {
    const a = startGame(lobby(), HOST, 1000, seededRandInt(5));
    expect(a.ok && a.state.map).toBe("bar");
    const choice: MapChoice = "bar";
    const b = startGame({ ...lobby(), mapChoice: choice }, HOST, 1000, seededRandInt(5));
    expect(b.ok && b.state.map).toBe("bar");
  });
  it("PLAYABLE_MAPS 가 하나라 난수 호출이 늘지 않는다 — 시작 뒤 난수 상태가 assignRoles 만 부른 것과 같다", () => {
    const state = lobby(5);
    const ids = [...state.players].sort((a, b) => a.seat - b.seat).map((p) => p.id);
    const callsOf = (run: (rnd: (n: number) => number) => void): number[] => {
      const calls: number[] = [];
      const base = seededRandInt(9);
      run((n) => (calls.push(n), base(n)));
      return calls;
    };
    const rolesOnly = callsOf((rnd) => void assignRoles(ids, rnd));
    const withStart = callsOf((rnd) => void startGame(state, HOST, 1000, rnd));
    expect(withStart).toEqual(rolesOnly);
  });
});
