// 24-01: 의심 포스트잇의 순수 화면 선택기(UI-SPEC P24-6 교정). 서버와 같은 상수·함수를 쓰고 시각·난수를 읽지 않는다.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { PhaseId, PublicPlayer, RoomView } from "../../shared/protocol";
import { NOTE_REACH_FX, stickNote } from "../../shared/game/postit";
import { ROOM_TTL_MS } from "../../shared/game/room";
import type { Player, RoomState } from "../../shared/game/room";
import { restSegment } from "../../shared/game/world";
import type { Segment } from "../../shared/game/world";
import { suspectCountOf, suspectLogByDay, suspectStacks, suspectTargets, suspectUsed, suspectVisible } from "../../src/game/suspectView";

const NOW = 1_700_000_000_000;

interface Opt {
  phase?: PhaseId;
  day?: number;
  count?: number;
  mySeat?: number;
  dead?: number[];
  suspectTo?: number;
  suspects?: { to: number; from: number }[];
  log?: { n: number; from: number; to: number }[];
}

function makeView(o: Opt = {}): RoomView {
  const count = o.count ?? 6;
  const players: PublicPlayer[] = Array.from({ length: count }, (_, seat) => ({
    seat,
    nickname: `p${seat}`,
    connected: true,
    isHost: seat === 0,
    ...(o.dead?.includes(seat) ? { alive: false } : {}),
  }));
  return {
    code: "0042",
    phase: o.phase ?? "discussion",
    phaseEndsAt: NOW + 90_000,
    phaseDurationMs: 90_000,
    serverNow: NOW,
    minPlayers: 4,
    maxPlayers: 8,
    players,
    me: { seat: o.mySeat ?? 0, isHost: true, ...(o.suspectTo !== undefined ? { suspectTo: o.suspectTo } : {}) },
    day: {
      n: o.day ?? 2,
      roles: [],
      ...(o.suspects !== undefined ? { suspects: o.suspects } : {}),
      ...(o.log !== undefined ? { suspectLog: o.log } : {}),
    },
  } as RoomView;
}

const at = (x: number, z = 0): Segment => restSegment(x, z, NOW);
/** 좌석 → 구간 조회(WorldStore.segOf 모양). */
const segOfMap =
  (m: Record<number, Segment>) =>
  (seat: number): Segment | undefined =>
    m[seat];

describe("suspectVisible (D-22: 서버 noteAllowedNow 와 같은 조건)", () => {
  it("토론 · 둘째 날 · 내가 산 사람 · 나 말고 산 사람 ≥ 1 이면 참", () => {
    expect(suspectVisible(makeView())).toBe(true);
    expect(suspectVisible(makeView({ day: 5 }))).toBe(true);
  });
  it("첫날 토론에도 참", () => expect(suspectVisible(makeView({ day: 1 }))).toBe(true));
  it.each(["roleReveal", "verdict", "night", "morning"] as const)("%s에도 참", (phase) => {
    expect(suspectVisible(makeView({ phase }))).toBe(true);
  });
  it.each(["lobby", "assigning", "ended"] as const)("%s에서는 거짓", (phase) => {
    expect(suspectVisible(makeView({ phase }))).toBe(false);
  });
  it("내가 죽었으면 거짓", () => expect(suspectVisible(makeView({ dead: [0] }))).toBe(false));
  it("산 사람이 나뿐이면 거짓", () => expect(suspectVisible(makeView({ dead: [1, 2, 3, 4, 5] }))).toBe(false));
});

describe("suspectUsed", () => {
  it("me.suspectTo 가 있으면 참, 없으면 거짓(0 도 참)", () => {
    expect(suspectUsed(makeView({ suspectTo: 3 }))).toBe(true);
    expect(suspectUsed(makeView({ suspectTo: 0 }))).toBe(true);
    expect(suspectUsed(makeView())).toBe(false);
  });
});

describe("suspectTargets (D-25: 서버 구간 · 켜는 문턱 92% · 끄는 문턱 100%)", () => {
  const view = makeView();
  const sorted = (s: ReadonlySet<number>): string => [...s].sort((a, b) => a - b).join(",");

  it("거리 230 은 prev 가 없으면 빠지고 prev 에 있으면 들며 241 은 언제나 빠진다", () => {
    const segs = { 0: at(0), 1: at(230), 2: at(241), 3: at(100) };
    expect(sorted(suspectTargets(view, segOfMap(segs), NOW))).toBe("3");
    expect(sorted(suspectTargets(view, segOfMap(segs), NOW, new Set([1, 2])))).toBe("1,3");
  });
  it("220 은 들고 221 은 prev 없이는 빠진다", () => {
    const segs = { 0: at(0), 1: at(220), 2: at(221) };
    expect(sorted(suspectTargets(view, segOfMap(segs), NOW))).toBe("1");
  });
  it("죽은 사람은 가까워도 빠진다", () => {
    const v = makeView({ dead: [1] });
    const segs = { 0: at(0), 1: at(10), 2: at(10) };
    expect(sorted(suspectTargets(v, segOfMap(segs), NOW))).toBe("2");
  });
  it("내 구간이 없으면 빈 집합이고 구간이 없는 상대는 빠진다", () => {
    expect(suspectTargets(view, segOfMap({ 1: at(0) }), NOW).size).toBe(0);
    expect(sorted(suspectTargets(view, segOfMap({ 0: at(0), 2: at(5) }), NOW))).toBe("2");
  });
  it("바에서는 월드 구간이 아직 준비되지 않아도 산 상대를 고른다", () => {
    const bar: RoomView = { ...makeView({ phase: "roleReveal", count: 4, dead: [2] }), map: "bar" };
    expect(sorted(suspectTargets(bar, segOfMap({}), NOW))).toBe("1,3");
  });
  it("입력 prev 를 바꾸지 않는다", () => {
    const prev = new Set([1]);
    suspectTargets(view, segOfMap({ 0: at(0), 1: at(300), 2: at(5) }), NOW, prev);
    expect([...prev]).toEqual([1]);
  });

  it("성질: 선택기가 넣은 좌석은 같은 시각의 서버 stickNote 가 언제나 받아 준다(시드 고정 200쌍)", () => {
    let seed = 20_240_611;
    const rnd = (n: number): number => {
      seed = (Math.imul(seed, 1_664_525) + 1_013_904_223) >>> 0;
      return seed % n;
    };
    const players: Player[] = Array.from({ length: 6 }, (_, i) => ({
      id: `p${i}`,
      token: `token-p${i}-0123456789`,
      seat: i,
      nickname: `n${i}`,
      nicknameKey: `n${i}`,
      joinSeq: i,
      connected: true,
      connId: `c${i}`,
    }));
    const state = { code: "0420", createdAt: 0, expiresAt: ROOM_TTL_MS, phase: "discussion", phaseEndsAt: NOW + 1000, day: 2, hostId: "p0", nextJoinSeq: 6, players, map: "plaza" } as RoomState;
    let included = 0;
    for (let k = 0; k < 200; k++) {
      const segBySeat: Record<number, Segment> = {};
      for (let s = 0; s < 2; s++) {
        const x = rnd(600) - 100;
        const z = rnd(300) - 100;
        segBySeat[s] =
          rnd(2) === 0 ? restSegment(x, z, NOW) : { p: [x, z, x + rnd(500) - 250, z + rnd(500) - 250], t0: NOW - rnd(2000), v: 180 };
      }
      const prev = rnd(2) === 0 ? new Set([1]) : undefined;
      const picked = suspectTargets(view, segOfMap(segBySeat), NOW, prev);
      const world = { segs: { p0: segBySeat[0]!, p1: segBySeat[1]! } };
      if (picked.has(1)) {
        included++;
        expect(stickNote(state, world, "p0", 1, NOW).ok).toBe(true);
      }
    }
    expect(included).toBeGreaterThan(10); // 시험이 비어 있지 않다
    expect(NOTE_REACH_FX).toBe(240);
  });
});

describe("suspectStacks · suspectCountOf", () => {
  const suspects = [
    { to: 2, from: 0 },
    { to: 1, from: 3 },
    { to: 2, from: 4 },
    { to: 5, from: 1 },
  ];
  it("받은 좌석 → 붙인 좌석 배열(day.suspects 순서)", () => {
    const m = suspectStacks(makeView({ suspects }));
    expect([...m.entries()]).toEqual([
      [2, [0, 4]],
      [1, [3]],
      [5, [1]],
    ]);
  });
  it("죽은 받은 좌석은 뺀다", () => {
    const m = suspectStacks(makeView({ suspects, dead: [2] }));
    expect([...m.keys()].sort()).toEqual([1, 5]);
  });
  it("suspectCountOf 는 그 길이(없으면 0)", () => {
    const v = makeView({ suspects });
    expect(suspectCountOf(v, 2)).toBe(2);
    expect(suspectCountOf(v, 1)).toBe(1);
    expect(suspectCountOf(v, 4)).toBe(0);
    expect(suspectCountOf(makeView(), 2)).toBe(0);
  });
  it("입력 view 를 바꾸지 않는다", () => {
    const v = makeView({ suspects });
    const before = JSON.stringify(v);
    suspectStacks(v);
    suspectCountOf(v, 2);
    expect(JSON.stringify(v)).toBe(before);
  });
});

describe("suspectLogByDay", () => {
  it("최신 일차 먼저, 일차 안은 붙인 좌석 오름차순, 줄 없는 일차는 없다", () => {
    const log = [
      { n: 2, from: 3, to: 1 },
      { n: 2, from: 0, to: 4 },
      { n: 4, from: 2, to: 0 },
      { n: 4, from: 1, to: 5 },
    ];
    const out = suspectLogByDay(makeView({ log }));
    expect(out).toEqual([
      {
        n: 4,
        rows: [
          { n: 4, from: 1, to: 5 },
          { n: 4, from: 2, to: 0 },
        ],
      },
      {
        n: 2,
        rows: [
          { n: 2, from: 0, to: 4 },
          { n: 2, from: 3, to: 1 },
        ],
      },
    ]);
  });
  it("기록이 없으면 빈 배열", () => {
    expect(suspectLogByDay(makeView())).toEqual([]);
  });
});

describe("규칙: 선택기 소스는 시각·난수를 읽지 않는다", () => {
  it("Date.now · Math.random 이 본문에 없다", () => {
    const text = readFileSync(new URL("../../src/game/suspectView.ts", import.meta.url), "utf8");
    const code = text.split("\n").filter((l) => !/^\s*(\/\/|\*)/.test(l)).join("\n");
    expect(code).not.toMatch(/Date\.now|Math\.random/);
  });
});
