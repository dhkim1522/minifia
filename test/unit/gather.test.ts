// 모이는 자리 규칙(DAY-04·05, 결정 0060-7, UI-SPEC E8 #31): 지목 때 둘레 자리(ringSlots), 변론·찬반 때 변론자 무대(STAGE_SPOT),
// 처형 때 통과면 무대 유지·부결이면 자기 자리 복귀. 서버만 계산하고 클라이언트는 받은 구간을 그린다.
// 비교는 한 줄 문자열로 한다 — Set·배열·객체의 여러 줄 diff 는 TAP 보고서를 깨뜨린다.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  RING_RADIUS_FX,
  RING_SLOTS,
  RUNOFF_SPOTS,
  assignSlots,
  layoutFor,
  layoutKey,
  ringSlots,
} from "../../shared/game/gather";
import { BAR_MAP, BAR_SPAWNS, STAGE_SPOT, UNIT, lineWalkable } from "../../shared/game/map";
import { PX_PER_UNIT, groundToScreen } from "../../src/world/camera";
import { attachConnection, createRoomState, joinRoom } from "../../shared/game/room";
import type { Player, RoomState } from "../../shared/game/room";
import {
  type Segment,
  type WorldState,
  emptyWorld,
  forceSegment,
  planMoveSegment,
  restSegment,
  spawnPlayer,
} from "../../shared/game/world";
import type { PhaseId } from "../../shared/protocol";

type Slot = readonly [number, number];
const S = { x: STAGE_SPOT.x, z: STAGE_SPOT.z };
const idOf = (seat: number): string => `player-id-000${seat}-aaaa`;
const str = (p: Slot | { x: number; z: number }): string => (Array.isArray(p) ? `${p[0]},${p[1]}` : `${(p as { x: number }).x},${(p as { z: number }).z}`);
const sortedStr = (list: readonly string[]): string => [...list].sort().join(" ");

/** n 명이 모두 연결된 대기실. */
function lobbyOf(n: number): RoomState {
  const created = createRoomState({
    code: "0420",
    hostId: idOf(0),
    hostToken: "token-secret-0000-aaaa-0123456789",
    hostNickname: "이름0",
    now: 0,
  });
  if (!created.ok) throw new Error("createRoomState failed");
  let state = attachConnection(created.state, idOf(0), "conn-0");
  for (let i = 1; i < n; i += 1) {
    const joined = joinRoom(state, { playerId: idOf(i), token: `token-secret-000${i}-aaaa-0123456789`, nickname: `이름${i}` });
    if (!joined.ok) throw new Error(`joinRoom failed: ${joined.error}`);
    state = attachConnection(joined.state, idOf(i), `conn-${i}`);
  }
  return state;
}

interface Opts {
  day?: number;
  dead?: number[];
  candidate?: number;
  passed?: boolean;
  /** 결선 후보 좌석 둘(낮은 좌석 먼저). 주면 runoff 상태 step 0 을 싣는다. */
  runoff?: [number, number];
}

/** n 명 판의 단계 상태. dead 좌석은 유령, candidate 는 변론자 seat, passed 는 그날 찬반 결과(voteLog 와 verdict 에 같이 싣는다). */
function stateAt(phase: PhaseId, n: number, o: Opts = {}): RoomState {
  const base = lobbyOf(n);
  const dead = new Set(o.dead ?? []);
  const day = o.day ?? 2;
  const withVerdict: Partial<RoomState> =
    o.candidate === undefined
      ? {}
      : {
          verdict: o.passed === undefined ? { passed: false, candidate: o.candidate } : { passed: o.passed, candidate: o.candidate },
          ...(o.passed === undefined ? {} : { voteLog: [{ n: day, exec: { yes: 0, no: 0, passed: o.passed } }] }),
        };
  return {
    ...base,
    phase,
    day,
    players: base.players.map((p): Player => ({ ...p, alive: dead.has(p.seat) ? false : undefined })),
    ...withVerdict,
    ...(o.runoff === undefined ? {} : { runoff: { cand: o.runoff, step: 0 as const } }),
  };
}

/** n 명 모두 입장 지점에 선 월드(t = 0). */
function worldOf(n: number): WorldState {
  let w = emptyWorld();
  for (let i = 0; i < n; i += 1) w = spawnPlayer(w, idOf(i), i, 0, BAR_MAP);
  return w;
}

/** layoutFor 의 이동 목록을 그대로 적용한다(서버 DO 가 할 일): planMoveSegment 경로 + forceSegment, 배치 기억 lay 저장. */
function applyLayout(state: RoomState, w: WorldState, now: number): WorldState {
  const lay = layoutFor(state, w, now);
  if (lay === null) throw new Error("layoutFor returned null");
  let out = w;
  for (const m of lay.moves) out = forceSegment(out, m.playerId, planMoveSegment(out.segs[m.playerId]!, m.dest, now, BAR_MAP));
  return { ...out, lay: { key: lay.key, slots: lay.slots } };
}

/** 사람이 서 있는(또는 걸어가고 있는) 끝점. */
const endOf = (seg: Segment): string => `${seg.p[seg.p.length - 2]},${seg.p[seg.p.length - 1]}`;

function deepFreeze<T>(o: T): T {
  if (o !== null && typeof o === "object" && !Object.isFrozen(o)) {
    Object.freeze(o);
    for (const v of Object.values(o as Record<string, unknown>)) deepFreeze(v);
  }
  return o;
}

const SLOTS8: Slot[] = [
  [0, 265],
  [-187, 187],
  [-265, 0],
  [-187, -187],
  [0, -265],
  [187, -187],
  [265, 0],
  [187, 187],
];

describe("ringSlots — 둘레 자리 표 (RING_RADIUS_FX 265)", () => {
  it("반지름은 265(2.65) 다 — 8곳이 서로 2.0 이상 떨어지는 최소 근처 값", () => {
    expect(RING_RADIUS_FX).toBe(265);
  });

  it("ringSlots(8) 은 정해진 8좌표다", () => {
    expect(ringSlots(8).map(str).join(" ")).toBe(SLOTS8.map(str).join(" "));
  });

  it.each([2, 3, 4, 5, 6, 7, 8])("n=%i: 길이 n, 각 슬롯이 걸을 수 있고, 서로 2.0(200) 이상 떨어지고, 무대 자리와 예외 선분으로 이어진다", (n) => {
    const slots = ringSlots(n);
    expect(slots.length).toBe(n);
    const notWalkable: string[] = [];
    const tooClose: string[] = [];
    const noStageLine: string[] = [];
    for (const [i, a] of slots.entries()) {
      const pa = { x: a[0], z: a[1] };
      if (!lineWalkable({ ...BAR_MAP, stage: undefined }, pa, pa)) notWalkable.push(str(a));
      if (!lineWalkable(BAR_MAP, pa, S) || !lineWalkable(BAR_MAP, S, pa)) noStageLine.push(str(a));
      for (const b of slots.slice(i + 1)) {
        if ((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 < 200 * 200) tooClose.push(`${str(a)}~${str(b)}`);
      }
    }
    expect(notWalkable.join(" ")).toBe("");
    expect(tooClose.join(" ")).toBe("");
    expect(noStageLine.join(" ")).toBe("");
  });

  it("슬롯은 모두 서로 다른 점이고 정수다", () => {
    for (let n = 2; n <= 8; n += 1) {
      const slots = ringSlots(n);
      expect(new Set(slots.map(str)).size).toBe(n);
      expect(slots.every((s) => Number.isInteger(s[0]) && Number.isInteger(s[1]))).toBe(true);
    }
  });

  it("n<2·n>8·정수가 아닌 n 은 빈 배열", () => {
    for (const n of [-1, 0, 1, 9, 100, 2.5, Number.NaN]) expect(ringSlots(n).length).toBe(0);
  });

  it("표(RING_SLOTS)는 n=2..8 일곱 줄이다", () => {
    expect(Object.keys(RING_SLOTS).join(",")).toBe("2,3,4,5,6,7,8");
  });

  it("backstop: 입장 지점 8곳 어디서든 planMoveSegment 가 그 슬롯에서 끝난다 (n = 2..8 전부)", () => {
    const bad: string[] = [];
    for (let n = 2; n <= 8; n += 1) {
      for (const [si, sp] of BAR_SPAWNS.entries()) {
        const from = restSegment(Math.round(sp.x * UNIT), Math.round(sp.z * UNIT), 0);
        for (const slot of ringSlots(n)) {
          const seg = planMoveSegment(from, { x: slot[0], z: slot[1] }, 0, BAR_MAP);
          if (endOf(seg) !== str(slot)) bad.push(`n${n} 입장${si} -> ${str(slot)} 끝 ${endOf(seg)}`);
        }
      }
    }
    expect(bad.join(" | ")).toBe("");
  });

  it("backstop: 슬롯 → 무대 자리 → 슬롯 길도 그 점에서 끝난다", () => {
    const bad: string[] = [];
    for (const slot of ringSlots(8)) {
      const to = planMoveSegment(restSegment(slot[0], slot[1], 0), S, 0, BAR_MAP);
      if (endOf(to) !== "0,0") bad.push(`${str(slot)} -> 무대 끝 ${endOf(to)}`);
      const back = planMoveSegment(restSegment(0, 0, 0), { x: slot[0], z: slot[1] }, 0, BAR_MAP);
      if (endOf(back) !== str(slot)) bad.push(`무대 -> ${str(slot)} 끝 ${endOf(back)}`);
    }
    expect(bad.join(" | ")).toBe("");
  });
});

describe("assignSlots — 현재 위치 각도 순 sweep (A2)", () => {
  const SPAWN_PEOPLE = BAR_SPAWNS.slice(0, 5).map((sp, i) => ({ id: idOf(i), x: Math.round(sp.x * UNIT), z: Math.round(sp.z * UNIT) }));
  const mapped = (r: Record<string, Slot>): string =>
    Object.keys(r)
      .sort()
      .map((id) => `${id}=${str(r[id]!)}`)
      .join(" ");

  it("결정적이다: 같은 입력은 같은 출력", () => {
    expect(mapped(assignSlots(SPAWN_PEOPLE, ringSlots(5)))).toBe(mapped(assignSlots(SPAWN_PEOPLE, ringSlots(5))));
  });

  it("전단사: 사람마다 슬롯 하나, 슬롯마다 사람 하나", () => {
    const out = assignSlots(SPAWN_PEOPLE, ringSlots(5));
    expect(Object.keys(out).length).toBe(5);
    expect(sortedStr(Object.values(out).map(str))).toBe(sortedStr(ringSlots(5).map(str)));
  });

  it("좌석 순서(입력 순서)가 바뀌어도 사람 → 슬롯 대응이 같다", () => {
    const a = mapped(assignSlots(SPAWN_PEOPLE, ringSlots(5)));
    const reversed = mapped(assignSlots([...SPAWN_PEOPLE].reverse(), ringSlots(5)));
    const rotated = mapped(assignSlots([...SPAWN_PEOPLE.slice(2), ...SPAWN_PEOPLE.slice(0, 2)], [...ringSlots(5)].reverse()));
    expect(reversed).toBe(a);
    expect(rotated).toBe(a);
  });

  it("이미 슬롯에 서 있으면 자기 슬롯이 그대로 배정된다(이동 0)", () => {
    const slots = ringSlots(6);
    const people = slots.map((s, i) => ({ id: idOf(i), x: s[0], z: s[1] }));
    const out = assignSlots(people, slots);
    expect(people.map((p) => `${p.id}=${str(out[p.id]!)}`).join(" ")).toBe(people.map((p) => `${p.id}=${p.x},${p.z}`).join(" "));
  });

  it("사람 수와 슬롯 수가 다르면 빈 결과, 입력은 바꾸지 않는다", () => {
    expect(Object.keys(assignSlots(SPAWN_PEOPLE, ringSlots(4))).length).toBe(0);
    const frozen = deepFreeze(SPAWN_PEOPLE.map((p) => ({ ...p })));
    expect(() => assignSlots(frozen, deepFreeze(ringSlots(5).map((s) => [...s] as [number, number])))).not.toThrow();
  });

  it("무대 자리에 선 사람이 섞여도 던지지 않고 전단사다", () => {
    const people = [{ id: idOf(0), x: 0, z: 0 }, ...SPAWN_PEOPLE.slice(1, 4)];
    const out = assignSlots(people, ringSlots(4));
    expect(Object.keys(out).length).toBe(4);
  });
});

describe("layoutKey", () => {
  it("지목 {일차}:ring · 변론·찬반 {일차}:stage · 처형 {일차}:exec · 그 밖은 null", () => {
    const keys = (["nomination", "defense", "verdict", "execution", "discussion", "night", "dayAnnounce", "morning", "lobby", "assigning", "roleReveal", "ended"] as PhaseId[])
      .map((ph) => `${ph}:${layoutKey(stateAt(ph, 5, { day: 3 }))}`)
      .join(" ");
    expect(keys).toBe(
      "nomination:3:ring defense:3:stage verdict:3:stage execution:3:exec discussion:null night:null dayAnnounce:null morning:null lobby:null assigning:null roleReveal:null ended:null",
    );
  });
});

describe("layoutFor — 지목: 산 사람이 둘레 자리로 (DAY-04, E8 #31)", () => {
  it("산 5·유령 1: 산 사람 5명의 목적지가 ringSlots(5) 의 서로 다른 점, 유령은 없다, key '2:ring'", () => {
    const state = stateAt("nomination", 6, { dead: [5] });
    const lay = layoutFor(state, worldOf(6), 1000)!;
    expect(lay.key).toBe("2:ring");
    expect(lay.moves.map((m) => m.playerId).join(",")).toBe([0, 1, 2, 3, 4].map(idOf).join(","));
    expect(sortedStr(lay.moves.map((m) => str(m.dest)))).toBe(sortedStr(ringSlots(5).map(str)));
    expect(Object.keys(lay.slots).sort().join(",")).toBe([0, 1, 2, 3, 4].map(idOf).sort().join(","));
    expect(lay.moves.some((m) => m.playerId === idOf(5))).toBe(false);
  });

  it.each([2, 3, 4, 5, 6, 7, 8])("산 사람 %i명: 모두 서로 다른 둘레 자리로 간다", (n) => {
    const lay = layoutFor(stateAt("nomination", n), worldOf(n), 1000)!;
    expect(lay.moves.length).toBeGreaterThan(0);
    expect(sortedStr(Object.values(lay.slots).map(str))).toBe(sortedStr(ringSlots(n).map(str)));
  });

  it("모두 이미 슬롯에 서 있으면 이동 목록이 비어 있다", () => {
    const state = stateAt("nomination", 5);
    const slots = ringSlots(5);
    let w = emptyWorld();
    for (let i = 0; i < 5; i += 1) w = { ...w, segs: { ...w.segs, [idOf(i)]: restSegment(slots[i]![0], slots[i]![1], 0) } };
    const lay = layoutFor(state, w, 1000)!;
    expect(lay.moves.length).toBe(0);
    expect(Object.keys(lay.slots).length).toBe(5);
  });

  it("멱등: 이동을 적용하고 lay 를 저장한 뒤 다시 부르면 이동이 없고 자리가 같다 — 걷는 도중에도", () => {
    const state = stateAt("nomination", 7, { dead: [6] });
    const first = layoutFor(state, worldOf(7), 1000)!;
    const applied = applyLayout(state, worldOf(7), 1000);
    for (const now of [1000, 1400, 2500, 60_000]) {
      const again = layoutFor(state, applied, now)!;
      expect(again.moves.length).toBe(0);
      expect(Object.keys(again.slots).sort().map((id) => `${id}=${str(again.slots[id]!)}`).join(" ")).toBe(
        Object.keys(first.slots).sort().map((id) => `${id}=${str(first.slots[id]!)}`).join(" "),
      );
    }
  });

  it("lay 가 없어도(퇴거 뒤 복원 등) 이미 목적지에 선 사람은 이동 목록에 없다", () => {
    const state = stateAt("nomination", 4);
    const applied = applyLayout(state, worldOf(4), 1000);
    const noLay: WorldState = { segs: applied.segs, lastMoveAt: applied.lastMoveAt, wanderAt: applied.wanderAt };
    const again = layoutFor(state, noLay, 90_000)!; // 모두 도착한 뒤
    expect(again.moves.length).toBe(0);
  });

  it("방 월드에 없는 산 사람은 건너뛴다", () => {
    const state = stateAt("nomination", 5);
    let w = worldOf(5);
    w = { ...w, segs: { ...w.segs } };
    delete (w.segs as Record<string, Segment>)[idOf(4)];
    const lay = layoutFor(state, w, 1000)!;
    expect(lay.moves.some((m) => m.playerId === idOf(4))).toBe(false);
    expect(Object.keys(lay.slots).length).toBe(4);
  });

  it("다른 날의 lay 는 쓰지 않는다: 새 날 지목은 지금 위치로 새로 배정한다", () => {
    const state = stateAt("nomination", 4, { day: 3 });
    const stale: WorldState = { ...worldOf(4), lay: { key: "2:exec", slots: { [idOf(0)]: [0, -265], [idOf(1)]: [0, 265], [idOf(2)]: [265, 0], [idOf(3)]: [-265, 0] } } };
    const lay = layoutFor(state, stale, 1000)!;
    expect(lay.key).toBe("3:ring");
    const fresh = layoutFor(state, worldOf(4), 1000)!;
    expect(Object.keys(lay.slots).sort().map((id) => `${id}=${str(lay.slots[id]!)}`).join(" ")).toBe(
      Object.keys(fresh.slots).sort().map((id) => `${id}=${str(fresh.slots[id]!)}`).join(" "),
    );
  });
});

describe("layoutFor — 결선: 두 후보가 가운데 마주 선다 (결정 0066-4, O-19)", () => {
  const RO: [number, number] = [1, 4];

  it("layoutKey: runoff → '{일차}:runoff'", () => {
    expect(layoutKey(stateAt("runoff", 6, { day: 3, runoff: RO }))).toBe("3:runoff");
  });

  it("RUNOFF_SPOTS: 정수 두 점, 서로 180 이상 떨어지고, 화면에서 가로로 나란하다(왼쪽 = 낮은 좌석 쪽)", () => {
    const [a, b] = RUNOFF_SPOTS;
    expect([a, b].every((s) => s.every(Number.isInteger))).toBe(true);
    expect((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2).toBeGreaterThanOrEqual(180 * 180);
    const canvas = { w: 390, h: 844 };
    const at = (s: Slot) => groundToScreen({ x: s[0] / 100, y: 0, z: s[1] / 100 }, { x: 0, z: 0 }, canvas, 0);
    const sa = at(a);
    const sb = at(b);
    expect(Math.abs(sa.sy - sb.sy)).toBeLessThan(1);
    expect(sb.sx - sa.sx).toBeGreaterThan(PX_PER_UNIT);
  });

  it("두 후보 모두 무대 원기둥(반지름 118)과 캐릭터(35) 밖, 걸을 수 있는 점에 서고 서로 마주 볼 만큼 가깝다(≤ 250)", () => {
    for (const s of RUNOFF_SPOTS) {
      expect(s[0] ** 2 + s[1] ** 2).toBeGreaterThanOrEqual(153 * 153);
      expect(lineWalkable(BAR_MAP, { x: s[0], z: s[1] }, { x: s[0], z: s[1] })).toBe(true);
    }
    const [a, b] = RUNOFF_SPOTS;
    expect((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2).toBeLessThanOrEqual(250 * 250);
  });

  it("후보 둘은 RUNOFF_SPOTS(낮은 좌석이 [0])로, 나머지 산 사람은 둘레 자리로 간다 (key '2:runoff')", () => {
    const state = stateAt("runoff", 6, { runoff: RO });
    const lay = layoutFor(state, worldOf(6), 1000)!;
    expect(lay.key).toBe("2:runoff");
    const dest = (seat: number) => lay.moves.find((m) => m.playerId === idOf(seat))?.dest;
    expect(str(dest(1)!)).toBe(str(RUNOFF_SPOTS[0]));
    expect(str(dest(4)!)).toBe(str(RUNOFF_SPOTS[1]));
    const others = lay.moves.filter((m) => ![1, 4].map(idOf).includes(m.playerId));
    expect(others.length).toBe(4);
    expect(others.every((m) => ringSlots(6).some((s) => str(s) === str(m.dest)))).toBe(true);
  });

  it("지목에서 걸은 둘레 자리를 그대로 쓴다: 후보를 뺀 사람은 이동 없음, 후보 슬롯은 기억에 남는다", () => {
    const laid = applyLayout(stateAt("nomination", 6), worldOf(6), 1000);
    const state = stateAt("runoff", 6, { runoff: RO });
    const lay = layoutFor(state, laid, 60_000)!;
    expect(lay.moves.map((m) => m.playerId).join(",")).toBe([1, 4].map(idOf).join(","));
    expect(str(lay.slots[idOf(1)]!)).toBe(str(laid.lay!.slots[idOf(1)]!));
    expect(str(lay.slots[idOf(4)]!)).toBe(str(laid.lay!.slots[idOf(4)]!));
  });

  it("멱등: 적용하고 lay 를 저장한 뒤 다시 부르면 이동이 없다 — 걷는 도중에도", () => {
    const state = stateAt("runoff", 7, { runoff: [0, 6], dead: [3] });
    const applied = applyLayout(state, applyLayout(stateAt("nomination", 7, { dead: [3] }), worldOf(7), 1000), 5000);
    for (const now of [5000, 5400, 9000, 90_000]) expect(layoutFor(state, applied, now)!.moves.length).toBe(0);
    expect(endOf(applied.segs[idOf(0)]!)).toBe(str(RUNOFF_SPOTS[0]));
    expect(endOf(applied.segs[idOf(6)]!)).toBe(str(RUNOFF_SPOTS[1]));
  });

  it("지목 기억이 없어도(퇴거 뒤 복원) 나머지는 새로 배정되고 후보는 마주 선다", () => {
    const lay = layoutFor(stateAt("runoff", 5, { runoff: [2, 3] }), worldOf(5), 1000)!;
    expect(lay.moves.length).toBe(5);
    expect(sortedStr(Object.values(lay.slots).map(str))).toBe(sortedStr(ringSlots(5).map(str)));
    expect(str(lay.moves.find((m) => m.playerId === idOf(2))!.dest)).toBe(str(RUNOFF_SPOTS[0]));
  });

  it("둘레 자리 어디서든 RUNOFF_SPOTS 두 점으로 걸어 정확히 도착한다 (8곳 × 2점)", () => {
    for (const from of ringSlots(8)) {
      for (const spot of RUNOFF_SPOTS) {
        const seg = planMoveSegment(restSegment(from[0], from[1], 0), { x: spot[0], z: spot[1] }, 0, BAR_MAP);
        expect(`${from}>${seg.p[seg.p.length - 2]},${seg.p[seg.p.length - 1]}`).toBe(`${from}>${str(spot)}`);
      }
    }
  });

  it("결선 → 변론: 승자는 무대로, 진 후보는 자기 둘레 자리로 돌아간다", () => {
    const nom = applyLayout(stateAt("nomination", 6), worldOf(6), 1000);
    const atRunoff = applyLayout(stateAt("runoff", 6, { runoff: RO }), nom, 60_000);
    const state = stateAt("defense", 6, { candidate: 4 });
    const lay = layoutFor(state, atRunoff, 90_000)!;
    expect(lay.key).toBe("2:stage");
    const dest = (seat: number) => lay.moves.find((m) => m.playerId === idOf(seat))?.dest;
    expect(str(dest(4)!)).toBe("0,0");
    expect(str(dest(1)!)).toBe(str(nom.lay!.slots[idOf(1)]!));
    expect(lay.moves.length).toBe(2);
  });
});

describe("layoutFor — 마지막 3인: 산 세 사람이 삼각형 자리로 (결정 0066-5)", () => {
  // 5명 판 2일차: 좌석 3·4 가 유령이라 산 사람은 0·1·2.
  const DEAD = [3, 4];
  const showdownState = (day = 2): RoomState => stateAt("showdown", 5, { day, dead: DEAD });

  it("layoutKey: showdown → '{일차}:showdown'", () => {
    expect(layoutKey(showdownState(3))).toBe("3:showdown");
  });

  it("산 세 사람이 ringSlots(3) 의 서로 다른 세 점으로 간다(유령은 움직이지 않는다)", () => {
    const lay = layoutFor(showdownState(), worldOf(5), 1000)!;
    expect(lay.key).toBe("2:showdown");
    expect(lay.moves.map((m) => m.playerId).join(",")).toBe([0, 1, 2].map(idOf).join(","));
    expect(sortedStr(lay.moves.map((m) => str(m.dest)))).toBe(sortedStr(ringSlots(3).map(str)));
    expect(sortedStr(Object.values(lay.slots).map(str))).toBe(sortedStr(ringSlots(3).map(str)));
    expect(Object.keys(lay.slots).sort().join(",")).toBe([0, 1, 2].map(idOf).join(","));
  });

  it("멱등: 적용하고 lay 를 저장한 뒤 다시 부르면 이동이 없다 — 걷는 도중에도", () => {
    const applied = applyLayout(showdownState(), worldOf(5), 1000);
    for (const now of [1000, 1400, 3000, 90_000]) expect(layoutFor(showdownState(), applied, now)!.moves.length).toBe(0);
    expect(sortedStr([0, 1, 2].map((i) => endOf(applied.segs[idOf(i)]!)))).toBe(sortedStr(ringSlots(3).map(str)));
  });

  it("지난 일차의 둘레 자리 기억은 쓰지 않는다 — 새로 배정받는다", () => {
    const yesterday = applyLayout(stateAt("nomination", 5, { day: 1, dead: [4] }), worldOf(5), 1000);
    expect(yesterday.lay!.key).toBe("1:ring");
    const lay = layoutFor(showdownState(2), yesterday, 90_000)!;
    expect(sortedStr(Object.values(lay.slots).map(str))).toBe(sortedStr(ringSlots(3).map(str)));
    expect(lay.moves.length).toBeGreaterThanOrEqual(2); // 둘레 자리 (0, 265) 는 4인 표와 3인 표가 같아 그 자리에 선 사람은 이동이 없다
  });

  it("처형 단계는 결전 때 기억한 자리를 이어 쓴다: 이동 없음, 자리 기억 그대로 (key '2:exec')", () => {
    const atShowdown = applyLayout(showdownState(), worldOf(5), 1000);
    const exec = stateAt("execution", 5, { day: 2, dead: DEAD, candidate: 1, passed: true });
    const lay = layoutFor(exec, atShowdown, 60_000)!;
    expect(lay.key).toBe("2:exec");
    expect(lay.moves.length).toBe(0);
    for (const i of [0, 1, 2]) expect(str(lay.slots[idOf(i)]!)).toBe(str(atShowdown.lay!.slots[idOf(i)]!));
  });

  it("처형 단계에서 처형된 사람(이미 유령)도 결전 자리를 잃지 않는다", () => {
    const atShowdown = applyLayout(showdownState(), worldOf(5), 1000);
    const exec = stateAt("execution", 5, { day: 2, dead: [1, 3, 4], candidate: 1, passed: true });
    const lay = layoutFor(exec, atShowdown, 60_000)!;
    expect(lay.moves.length).toBe(0);
  });

  it("무대 원기둥이 막혀 있어도 ringSlots(3) 어느 자리에서든, 입장 지점·결선 자리·다른 둘레 자리에서 정확히 도착한다", () => {
    const froms: Slot[] = [
      ...ringSlots(3),
      ...ringSlots(8),
      ...ringSlots(5),
      ...RUNOFF_SPOTS,
      ...BAR_SPAWNS.map((sp): Slot => [Math.round(sp.x * UNIT), Math.round(sp.z * UNIT)]),
    ];
    for (const from of froms) {
      for (const spot of ringSlots(3)) {
        const seg = planMoveSegment(restSegment(from[0], from[1], 0), { x: spot[0], z: spot[1] }, 0, BAR_MAP);
        expect(`${from}>${seg.p[seg.p.length - 2]},${seg.p[seg.p.length - 1]}`).toBe(`${from}>${str(spot)}`);
      }
    }
  });
});

describe("layoutFor — 변론·찬반: 변론자는 무대, 나머지는 자기 자리 (DAY-05)", () => {
  it.each(["defense", "verdict"] as PhaseId[])("%s: 지목 때의 lay 가 있으면 변론자만 무대(0,0)로 가고 나머지는 이동 없음, key '2:stage'", (phase) => {
    const nom = stateAt("nomination", 6);
    const laid = applyLayout(nom, worldOf(6), 1000);
    const state = stateAt(phase, 6, { candidate: 3 });
    const lay = layoutFor(state, { ...laid, lay: laid.lay }, 60_000)!;
    expect(lay.key).toBe("2:stage");
    expect(lay.moves.map((m) => `${m.playerId}>${str(m.dest)}`).join(" ")).toBe(`${idOf(3)}>0,0`);
    // 변론자의 둘레 자리는 돌아올 자리로 기억에 남는다
    expect(str(lay.slots[idOf(3)]!)).toBe(str(laid.lay!.slots[idOf(3)]!));
  });

  it("lay 가 없으면(지목을 건너뜀) 나머지를 새로 배정해 걷게 하고, 변론자의 돌아올 자리도 슬롯에 담는다", () => {
    const state = stateAt("defense", 5, { candidate: 0 });
    const lay = layoutFor(state, worldOf(5), 1000)!;
    expect(lay.moves.find((m) => m.playerId === idOf(0))?.dest).toEqual({ x: 0, z: 0 });
    expect(lay.moves.length).toBe(5);
    expect(Object.keys(lay.slots).length).toBe(5);
    expect(sortedStr(Object.values(lay.slots).map(str))).toBe(sortedStr(ringSlots(5).map(str)));
  });

  it("변론자가 이미 무대에 있으면 이동 목록이 비어 있다(멱등)", () => {
    const nom = stateAt("nomination", 6);
    const laid = applyLayout(nom, worldOf(6), 1000);
    const state = stateAt("defense", 6, { candidate: 2 });
    const atStage = applyLayout(state, laid, 60_000);
    expect(endOf(atStage.segs[idOf(2)]!)).toBe("0,0");
    const again = layoutFor(state, atStage, 60_500)!;
    expect(again.moves.length).toBe(0);
    const verdict = layoutFor(stateAt("verdict", 6, { candidate: 2 }), atStage, 70_000)!;
    expect(verdict.moves.length).toBe(0);
  });

  it("변론자 없음(verdict.candidate 없음)이면 아무도 무대로 보내지 않는다", () => {
    const lay = layoutFor(stateAt("defense", 5), applyLayout(stateAt("nomination", 5), worldOf(5), 1000), 60_000)!;
    expect(lay.moves.length).toBe(0);
  });
});

describe("layoutFor — 처형: 통과면 무대 유지, 부결이면 자기 자리 복귀", () => {
  function atStageWorld(n: number, candidate: number): WorldState {
    const laid = applyLayout(stateAt("nomination", n), worldOf(n), 1000);
    return applyLayout(stateAt("defense", n, { candidate }), laid, 60_000);
  }

  it("통과(변론자는 이미 유령): 변론자 목적지 없음 — 이동 목록이 비고 key '2:exec'", () => {
    const w = atStageWorld(6, 3);
    const state = stateAt("execution", 6, { candidate: 3, passed: true, dead: [3] });
    const lay = layoutFor(state, w, 90_000)!;
    expect(lay.key).toBe("2:exec");
    expect(lay.moves.length).toBe(0);
    expect(endOf(w.segs[idOf(3)]!)).toBe("0,0");
  });

  it("통과(변론자가 아직 산 사람으로 보여도): 무대에 남는다", () => {
    const lay = layoutFor(stateAt("execution", 6, { candidate: 3, passed: true }), atStageWorld(6, 3), 90_000)!;
    expect(lay.moves.length).toBe(0);
  });

  it("부결: 변론자가 기억해 둔 자기 둘레 자리로 돌아간다", () => {
    const w = atStageWorld(6, 3);
    const state = stateAt("execution", 6, { candidate: 3, passed: false });
    const lay = layoutFor(state, w, 90_000)!;
    expect(lay.moves.map((m) => `${m.playerId}>${str(m.dest)}`).join(" ")).toBe(`${idOf(3)}>${str(w.lay!.slots[idOf(3)]!)}`);
  });

  it("부결 처형을 적용하고 다시 부르면 이동이 없다(멱등)", () => {
    const state = stateAt("execution", 6, { candidate: 3, passed: false });
    const applied = applyLayout(state, atStageWorld(6, 3), 90_000);
    expect(layoutFor(state, applied, 91_000)!.moves.length).toBe(0);
    expect(layoutFor(state, applied, 200_000)!.moves.length).toBe(0);
  });

  it("그날 voteLog 줄이 없으면 verdict.passed 를 따른다", () => {
    const base = stateAt("execution", 6, { candidate: 3 });
    const passedState: RoomState = { ...base, verdict: { passed: true, candidate: 3 } };
    expect(layoutFor(passedState, atStageWorld(6, 3), 90_000)!.moves.length).toBe(0);
    const failedState: RoomState = { ...base, verdict: { passed: false, candidate: 3 } };
    expect(layoutFor(failedState, atStageWorld(6, 3), 90_000)!.moves.length).toBe(1);
  });
});

describe("layoutFor — 그 밖 단계와 순수성", () => {
  it("discussion·dayAnnounce·night·morning·lobby·assigning·roleReveal·ended 는 null", () => {
    const out = (["discussion", "dayAnnounce", "night", "morning", "lobby", "assigning", "roleReveal", "ended"] as PhaseId[])
      .map((ph) => `${ph}:${layoutFor(stateAt(ph, 5), worldOf(5), 1000)}`)
      .join(" ");
    expect(out).toBe("discussion:null dayAnnounce:null night:null morning:null lobby:null assigning:null roleReveal:null ended:null");
  });

  it("입력 상태와 월드를 바꾸지 않는다(얼린 입력으로 호출해도 던지지 않는다)", () => {
    const state = deepFreeze(stateAt("defense", 6, { candidate: 1 }));
    const w = deepFreeze(applyLayout(stateAt("nomination", 6), worldOf(6), 1000));
    expect(() => layoutFor(state, w, 60_000)).not.toThrow();
    expect(() => layoutFor(deepFreeze(stateAt("nomination", 6)), deepFreeze(worldOf(6)), 1000)).not.toThrow();
  });
});

describe("gather.ts 소스 규약", () => {
  const source = readFileSync(new URL("../../shared/game/gather.ts", import.meta.url), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/.*$/gm, "");

  it("삼각함수·난수·현재 시각을 쓰지 않는다(슬롯은 상수 표, 각도 정렬은 정수 사분면·외적 비교로)", () => {
    expect(source).not.toMatch(/Math\.(hypot|sin|cos|tan|asin|acos|atan|atan2|random)\b/);
    expect(source).not.toMatch(/Date\.now|new Date|performance\.now/);
  });

  it("DOM·workerd API 를 쓰지 않는다(순수 모듈)", () => {
    expect(source).not.toMatch(/\b(document|window|crypto|fetch)\b/);
  });
});
