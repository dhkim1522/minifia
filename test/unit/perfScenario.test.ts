import { describe, expect, it } from "vitest";
import { createScenario, mulberry32, parsePerfParams } from "../../src/debug/perf/scenario";
import type { ScenarioEvent } from "../../src/debug/perf/scenario";
import { BAR_MAP, BAR_SPAWNS, UNIT, lineWalkable } from "../../shared/game/map";
import { MOVE_V, positionAtFx, segmentEndsAt } from "../../shared/game/world";
import type { Segment } from "../../shared/game/world";

const run = (seed: number, ms: number, chars = 8): ScenarioEvent[] => createScenario({ seed, chars, map: BAR_MAP }).advance(ms);

describe("mulberry32", () => {
  it("같은 시드면 같은 수열, 0 이상 1 미만이다", () => {
    const a = mulberry32(7);
    const b = mulberry32(7);
    const xs = Array.from({ length: 50 }, () => a());
    expect(xs).toEqual(Array.from({ length: 50 }, () => b()));
    expect(xs.every((x) => x >= 0 && x < 1)).toBe(true);
    expect(new Set(xs).size).toBeGreaterThan(40);
  });
  it("시드가 다르면 수열이 다르다", () => {
    expect(mulberry32(1)()).not.toBe(mulberry32(2)());
  });
});

describe("createScenario: 결정성", () => {
  it("같은 seed 로 두 번 만든 첫 30초 이벤트 목록이 같다", () => {
    const a = run(1, 30000);
    const b = run(1, 30000);
    expect(a.length).toBeGreaterThan(8);
    expect(a).toEqual(b);
  });
  it("seed 2 는 seed 1 과 다르다", () => {
    expect(run(2, 30000)).not.toEqual(run(1, 30000));
  });
  it("advance 를 잘게 나눠 불러도 한 번에 부른 것과 같다", () => {
    const s = createScenario({ seed: 1, chars: 8, map: BAR_MAP });
    const pieces: ScenarioEvent[] = [];
    for (let t = 1000; t <= 30000; t += 1000) pieces.push(...s.advance(t));
    expect(pieces).toEqual(run(1, 30000));
  });
  it("이벤트는 시간순이고 at 이 요청한 시각 이하다", () => {
    const ev = run(1, 30000);
    for (let i = 1; i < ev.length; i++) expect(ev[i]!.at).toBeGreaterThanOrEqual(ev[i - 1]!.at);
    expect(ev.every((e) => e.at <= 30000)).toBe(true);
  });
});

describe("createScenario: 구간", () => {
  it("처음 구간은 모두 입장 지점에 서 있다 (v = MOVE_V, t0 = 0)", () => {
    const init = createScenario({ seed: 1, chars: 8, map: BAR_MAP }).initial();
    expect(init.map((e) => e.s)).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
    init.forEach((e) => {
      const sp = BAR_SPAWNS[e.s]!;
      expect(e.p).toEqual([Math.round(sp.x * UNIT), Math.round(sp.z * UNIT)]);
      expect(e.t0).toBe(0);
      expect(e.v).toBe(MOVE_V);
    });
  });
  it("chars 만큼만 만든다 (1~8)", () => {
    expect(createScenario({ seed: 1, chars: 3, map: BAR_MAP }).initial().map((e) => e.s)).toEqual([0, 1, 2]);
    const seats = new Set(run(1, 30000, 3).map((e) => e.seat));
    expect([...seats].every((s) => s < 3)).toBe(true);
  });
  it("모든 이동 구간은 선분마다 걸을 수 있고 v = MOVE_V, 출발 시각 = 이벤트 시각이다", () => {
    const moves = run(1, 60000).filter((e): e is Extract<ScenarioEvent, { kind: "move" }> => e.kind === "move");
    expect(moves.length).toBeGreaterThan(16);
    for (const m of moves) {
      expect(m.v).toBe(MOVE_V);
      expect(m.t0).toBe(m.at);
      expect(m.p.length).toBeGreaterThanOrEqual(2);
      for (let i = 0; i + 3 < m.p.length; i += 2) {
        expect(lineWalkable(BAR_MAP, { x: m.p[i]!, z: m.p[i + 1]! }, { x: m.p[i + 2]!, z: m.p[i + 3]! })).toBe(true);
      }
    }
  });
  it("새 구간은 바로 앞 구간의 그 시각 위치에서 이어진다", () => {
    const s = createScenario({ seed: 1, chars: 8, map: BAR_MAP });
    const cur = new Map<number, Segment>(s.initial().map((e) => [e.s, { p: e.p, t0: e.t0, v: e.v }]));
    for (const e of s.advance(60000)) {
      if (e.kind !== "move") continue;
      const here = positionAtFx(cur.get(e.seat)!, e.t0);
      expect(Math.abs(e.p[0]! - here.x)).toBeLessThanOrEqual(UNIT);
      expect(Math.abs(e.p[1]! - here.z)).toBeLessThanOrEqual(UNIT);
      cur.set(e.seat, { p: e.p, t0: e.t0, v: e.v });
    }
  });
  it("한 사람은 3~6초(+ 처음 한 번은 0~3.5초 안)마다 새 목적지로 간다", () => {
    // 멈춤(동작 하려고 선 한 점 구간)은 목적지가 아니다
    const moves = run(1, 60000).filter((e) => e.kind === "move" && e.seat === 0 && e.p.length >= 4);
    expect(moves.length).toBeGreaterThanOrEqual(9);
    expect(moves[0]!.at).toBeLessThanOrEqual(3500);
    for (let i = 1; i < moves.length; i++) {
      const gap = moves[i]!.at - moves[i - 1]!.at;
      expect(gap).toBeGreaterThanOrEqual(3000);
      expect(gap).toBeLessThan(8000); // 6초 간격 + 동작 때문에 늦춰진 만큼
    }
  });
});

describe("createScenario: 동작", () => {
  const emotes = (ev: ScenarioEvent[]) => ev.filter((e): e is Extract<ScenarioEvent, { kind: "emote" }> => e.kind === "emote");
  it("5초마다 하나, clap·deny 번갈아", () => {
    const em = emotes(run(1, 60000));
    expect(em.map((e) => e.at)).toEqual(Array.from({ length: 12 }, (_, i) => 5000 * (i + 1)));
    expect(em.map((e) => e.id)).toEqual(Array.from({ length: 12 }, (_, i) => (i % 2 === 0 ? "clap" : "deny")));
  });
  it("걷고 있지 않은 캐릭터에게만 한다 — 걷던 사람은 먼저 그 자리에 선다 (한 점 구간)", () => {
    const s = createScenario({ seed: 1, chars: 8, map: BAR_MAP });
    const cur = new Map<number, Segment>(s.initial().map((e) => [e.s, { p: e.p, t0: e.t0, v: e.v }]));
    const seen = new Set<number>();
    for (const e of s.advance(120000)) {
      if (e.kind === "move") cur.set(e.seat, { p: e.p, t0: e.t0, v: e.v });
      else {
        expect(segmentEndsAt(cur.get(e.seat)!)).toBeLessThanOrEqual(e.at);
        seen.add(e.seat);
      }
    }
    expect([...seen].sort()).toEqual([0, 1, 2, 3, 4, 5, 6, 7]); // 사람이 돌아가며 받는다
  });
});

describe("parsePerfParams", () => {
  it("쿼리가 없으면 기본값", () => {
    expect(parsePerfParams(new URLSearchParams("perf=1"))).toEqual({ scene: "talk", minutes: 5, dpr: null, budget: 0, seed: 1, chars: 8, shot: false, nav: false });
  });
  it("쿼리를 읽는다", () => {
    const p = parsePerfParams(new URLSearchParams("perf=1&scene=vote&minutes=0.25&dpr=1.5&budget=2&seed=9&chars=5&shot=1&nav=1"));
    expect(p).toEqual({ scene: "vote", minutes: 0.25, dpr: 1.5, budget: 2, seed: 9, chars: 5, shot: true, nav: true });
  });
  it("범위 밖·잘못된 값은 기본값 또는 안쪽으로 자른다", () => {
    const p = parsePerfParams(new URLSearchParams("scene=day&minutes=-3&dpr=abc&budget=99&seed=x&chars=40"));
    expect(p.scene).toBe("talk");
    expect(p.minutes).toBe(5);
    expect(p.dpr).toBeNull();
    expect(p.budget).toBe(5);
    expect(p.seed).toBe(1);
    expect(p.chars).toBe(8);
  });
});

describe("createScenario: 사람이 눌러 retarget", () => {
  it("다른 사람의 경로는 그대로이고, 눌린 사람은 걸음이 끝나기 전에 시나리오가 끼어들지 않는다", () => {
    const base = run(1, 40000);
    const s = createScenario({ seed: 1, chars: 8, map: BAR_MAP });
    s.advance(10000);
    const seg = { p: [100, 100, 400, 100], t0: 10000, v: MOVE_V }; // 300 단위 = 약 1.67초
    s.retarget(0, seg);
    const after = [...base.filter((e) => e.at <= 10000), ...s.advance(40000)];
    const others = (ev: ScenarioEvent[]) => ev.filter((e) => e.seat !== 0 && e.kind === "move");
    expect(others(after)).toEqual(others(base));
    const mine = after.filter((e) => e.seat === 0 && e.kind === "move" && e.p.length >= 4 && e.at > 10000);
    expect(mine[0]!.at).toBeGreaterThanOrEqual(segmentEndsAt(seg));
  });
});
