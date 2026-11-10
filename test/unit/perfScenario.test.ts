import { describe, expect, it } from "vitest";
import { createScenario, MIX_OUTFITS, mulberry32, parsePerfParams } from "../../src/debug/perf/scenario";
import type { ScenarioEvent } from "../../src/debug/perf/scenario";
import { BAR_MAP, BAR_SPAWNS, UNIT, isWalkable, lineWalkable } from "../../shared/game/map";
import { PLAZA_MAP, PLAZA_SPAWNS } from "../../shared/game/mapPlaza";
// @ts-expect-error -- 선언 없는 스크립트 모듈
import * as perfRun from "../../scripts/perf-run.mjs";
import { MOVE_V, positionAtFx, segmentEndsAt } from "../../shared/game/world";
import type { Segment } from "../../shared/game/world";
import { createHash } from "node:crypto";
import { EMOTE_IDS } from "../../shared/protocol";
import { OUTFITS } from "../../src/world/characterData";

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
    expect(parsePerfParams(new URLSearchParams("perf=1"))).toEqual({ scene: "talk", minutes: 5, dpr: null, budget: 0, seed: 1, chars: 8, shot: false, nav: false, outfits: "coat", burst: 1, map: "bar" });
  });
  it("쿼리를 읽는다", () => {
    const p = parsePerfParams(new URLSearchParams("perf=1&scene=vote&minutes=0.25&dpr=1.5&budget=2&seed=9&chars=5&shot=1&nav=1"));
    expect(p).toEqual({ scene: "vote", minutes: 0.25, dpr: 1.5, budget: 2, seed: 9, chars: 5, shot: true, nav: true, outfits: "coat", burst: 1, map: "bar" });
  });
  it("scene 은 talk·morning·vote·night 네 값만 받고 나머지는 talk 다(18-07)", () => {
    for (const sc of ["talk", "morning", "vote", "night"]) {
      expect(parsePerfParams(new URLSearchParams(`scene=${sc}`)).scene).toBe(sc);
    }
    for (const sc of ["trial", "xyz", ""]) expect(parsePerfParams(new URLSearchParams(`scene=${sc}`)).scene).toBe("talk");
    expect(parsePerfParams(new URLSearchParams("perf=1")).scene).toBe("talk");
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

// 10-06: outfits=mix·burst=N (D-15, O-10)
const sha = (ev: ScenarioEvent[]): string => createHash("sha256").update(JSON.stringify(ev)).digest("hex");

describe("burst=1(기본)은 10-06 이전과 비트 단위로 같다 (골든)", () => {
  it.each([
    [1, 8, 123, "a6469c86694d1e87d10caa8e4525ef04962486d85bf4c2d4a61bb2dfc604eae2"],
    [7, 8, 121, "c44932b8af1c6a5eac78b70f892597096f3fa359e5f973bcbc3dc0d7336abc8c"],
    [3, 4, 74, "0e5a5daa83b9ba27e5c4c32b8764dc8eed822249a90b43eec4927c6fad036548"],
  ])("seed %i chars %i 첫 60초: 이벤트 %i 개, 해시 일치", (seed, chars, n, hash) => {
    const ev = createScenario({ seed, chars, map: BAR_MAP }).advance(60000);
    expect(ev.length).toBe(n);
    expect(sha(ev)).toBe(hash);
  });
  it("burst: 1 을 명시해도 같다", () => {
    expect(sha(createScenario({ seed: 1, chars: 8, map: BAR_MAP, burst: 1 }).advance(60000))).toBe("a6469c86694d1e87d10caa8e4525ef04962486d85bf4c2d4a61bb2dfc604eae2");
  });
});

describe("burst=N>1 — 같은 시각 서로 다른 N개 좌석의 동작", () => {
  const emotes = (ev: ScenarioEvent[]) => ev.filter((e): e is Extract<ScenarioEvent, { kind: "emote" }> => e.kind === "emote");
  const runB = (seed: number, burst: number, ms = 60000) => createScenario({ seed, chars: 8, map: BAR_MAP, burst }).advance(ms);

  it("5초마다 N개가 같은 시각에, 좌석은 서로 다르다", () => {
    const em = emotes(runB(1, 4));
    expect(em.length).toBe(4 * 12);
    const bySlot = new Map<number, number[]>();
    for (const e of em) bySlot.set(e.at, [...(bySlot.get(e.at) ?? []), e.seat]);
    expect([...bySlot.keys()]).toEqual(Array.from({ length: 12 }, (_, i) => 5000 * (i + 1)));
    for (const seats of bySlot.values()) {
      expect(seats.length).toBe(4);
      expect(new Set(seats).size).toBe(4);
    }
  });
  it("동작 id 는 아홉 종을 돌아가며 쓴다(모두 EMOTE_IDS 안)", () => {
    const ids = emotes(runB(1, 4)).map((e) => e.id);
    expect(ids.every((id) => (EMOTE_IDS as readonly string[]).includes(id))).toBe(true);
    expect(new Set(ids).size).toBe(9);
  });
  it("걷던 사람은 동작 전에 한 점 구간으로 멈춘다(같은 시각 move 가 emote 앞에 있다)", () => {
    const ev = runB(1, 4);
    for (const e of emotes(ev)) {
      const i = ev.indexOf(e);
      const stop = ev.slice(0, i).reverse().find((m) => m.kind === "move" && m.seat === e.seat);
      if (stop && stop.at === e.at) expect(stop.kind).toBe("move");
    }
    // 동작 중인 사람에게 동작 길이 안에 새 걷기 구간이 오지 않는다(2초 최소 쉼)
    for (const e of emotes(ev)) {
      const next = ev.find((m) => m.kind === "move" && m.seat === e.seat && m.at > e.at);
      if (next) expect(next.at - e.at).toBeGreaterThanOrEqual(2000);
    }
  });
  it("같은 seed 면 결정적이고 seed 가 다르면 다르다", () => {
    expect(runB(1, 4)).toEqual(runB(1, 4));
    expect(sha(runB(2, 4))).not.toBe(sha(runB(1, 4)));
  });
  it("chars 보다 큰 burst 는 chars 로 자른다", () => {
    const em = emotes(createScenario({ seed: 1, chars: 3, map: BAR_MAP, burst: 4 }).advance(5000));
    expect(em.map((e) => e.seat).sort()).toEqual([0, 1, 2]);
  });
});

describe("parsePerfParams — outfits·burst", () => {
  it("outfits=mix, burst=1~4 를 읽는다", () => {
    const p = parsePerfParams(new URLSearchParams("outfits=mix&burst=4"));
    expect(p.outfits).toBe("mix");
    expect(p.burst).toBe(4);
  });
  it("잘못된 값은 기본값(coat, 1)이고 범위 밖 burst 는 기본값이다", () => {
    for (const q of ["outfits=zzz&burst=x", "outfits=&burst=0", "burst=5", "burst=2.5", "burst=-1"]) {
      const p = parsePerfParams(new URLSearchParams(q));
      expect(p.outfits).toBe("coat");
      expect(p.burst).toBe(1);
    }
  });
});

describe("MIX_OUTFITS — 8명 서로 다른 의상(탐정 포함)", () => {
  it("좌석 0 이 탐정이고 8개가 서로 다른 의상 id 다", () => {
    expect(MIX_OUTFITS.length).toBe(8);
    expect(MIX_OUTFITS[0]).toBe("detective");
    expect(new Set(MIX_OUTFITS).size).toBe(8);
    for (const o of MIX_OUTFITS) expect(Object.hasOwn(OUTFITS, o)).toBe(true);
  });
});

describe("광장 성능 측정 입구 (MAP-06, 11-10 Task 3)", () => {
  it("parsePerfParams: map=plaza|bar 를 읽고 기본·잘못된 값은 bar", () => {
    expect(parsePerfParams(new URLSearchParams("map=plaza")).map).toBe("plaza");
    expect(parsePerfParams(new URLSearchParams("map=bar")).map).toBe("bar");
    expect(parsePerfParams(new URLSearchParams("")).map).toBe("bar");
    expect(parsePerfParams(new URLSearchParams("map=moon")).map).toBe("bar");
  });

  it("광장 마스크로 만든 시나리오: 입장 지점에 서 있고 모든 이동 선분이 광장 마스크에서 걸을 수 있다", () => {
    const s = createScenario({ seed: 1, chars: 8, map: PLAZA_MAP });
    s.initial().forEach((e) => {
      const sp = PLAZA_SPAWNS[e.s]!;
      expect(e.p).toEqual([Math.round(sp.x * UNIT), Math.round(sp.z * UNIT)]);
    });
    const moves = s.advance(60000).filter((e): e is Extract<ScenarioEvent, { kind: "move" }> => e.kind === "move");
    expect(moves.length).toBeGreaterThan(16);
    for (const m of moves) {
      for (let i = 0; i + 3 < m.p.length; i += 2) {
        expect(lineWalkable(PLAZA_MAP, { x: m.p[i]!, z: m.p[i + 1]! }, { x: m.p[i + 2]!, z: m.p[i + 3]! })).toBe(true);
      }
    }
    // 광장에서만 막힌 칸(시계탑 쪽)을 목적지로 삼지 않는다: 모든 도착점은 광장 마스크의 걸을 수 있는 칸
    for (const m of moves) {
      const x = m.p[m.p.length - 2]!;
      const z = m.p[m.p.length - 1]!;
      expect(isWalkable(PLAZA_MAP, Math.floor((x / UNIT + 7) / 0.5), Math.floor((z / UNIT + 7) / 0.5))).toBe(true);
    }
  });

  it("perf-run --map: 기본 bar, plaza 를 받고 잘못된 값은 UsageError, ?perf=1 주소에 map 이 실린다", () => {
    expect(perfRun.parseArgs([]).map).toBe("bar");
    expect(perfRun.parseArgs(["--map", "plaza"]).map).toBe("plaza");
    expect(() => perfRun.parseArgs(["--map", "nope"])).toThrow(/--map/);
    expect(() => perfRun.parseArgs(["--map"])).toThrow();
    const o = perfRun.parseArgs(["--map", "plaza"]);
    expect(new URL(perfRun.targetUrl(o, "http://localhost:1")).searchParams.get("map")).toBe("plaza");
    expect(new URL(perfRun.targetUrl(perfRun.parseArgs([]), "http://localhost:1")).searchParams.has("map")).toBe(false);
    expect(perfRun.outputBase(o)).toContain("plaza");
    expect(perfRun.USAGE).toContain("--map");
  });

  it("perf-run --map nope 은 종료 코드 1 과 안내를 낸다", async () => {
    const { spawnSync } = await import("node:child_process");
    const r = spawnSync(process.execPath, ["scripts/perf-run.mjs", "--map", "nope"], { encoding: "utf8" });
    expect(r.status).toBe(1);
    expect(r.stderr).toContain("--map");
  });
});
