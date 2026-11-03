// 로비 이동 규칙(shared/game/world.ts) — 구간 보간·이동 요청·프레임 모양. 시각과 난수는 모두 인자로 주입한다.
import { describe, expect, it } from "vitest";
import { seededRandInt } from "../helpers/seededRandom";
import {
  BAR_MAP,
  cellCenterFx,
  cellOfFx,
  isWalkable,
  lineWalkable,
  walkableCells,
} from "../../shared/game/map";
import {
  WANDER_MIN_MS,
  WANDER_SPAN_MS,
  MOVE_MIN_GAP_MS,
  MOVE_SPEED,
  MOVE_V,
  type Segment,
  type WorldState,
  captureHome,
  compactWorld,
  despawnPlayer,
  emptyWorld,
  forceSegment,
  moveFrame,
  nextWanderAt,
  planMoveSegment,
  planWander,
  positionAt,
  positionAtFx,
  requestMove,
  respawnAll,
  restSegment,
  restoreWorld,
  segmentEndsAt,
  snapFrame,
  spawnPlayer,
  teleportHome,
} from "../../shared/game/world";

/** 재귀적으로 얼려서 입력 변형 시 던지게 한다(ES 모듈은 strict). */
function deepFreeze<T>(o: T): T {
  if (o !== null && typeof o === "object" && !Object.isFrozen(o)) {
    Object.freeze(o);
    for (const v of Object.values(o as Record<string, unknown>)) deepFreeze(v);
  }
  return o;
}

/** p0 를 seat 0 입장 지점(360, 40)에 세운 월드. */
function oneWalker(now = 1000): WorldState {
  return spawnPlayer(emptyWorld(), "p0", 0, now, BAR_MAP);
}

function must<T extends { ok: boolean }>(r: T): Extract<T, { ok: true }> {
  if (!r.ok) throw new Error(`expected ok, got ${JSON.stringify(r)}`);
  return r as Extract<T, { ok: true }>;
}

describe("상수", () => {
  it("걷는 속도는 서버 상수 1.8 단위/초(180)이고 요청 간격은 150ms 다", () => {
    expect(MOVE_SPEED).toBe(1.8);
    expect(MOVE_V).toBe(180);
    expect(MOVE_V).toBe(Math.round(MOVE_SPEED * 100));
    expect(MOVE_MIN_GAP_MS).toBe(150);
  });
});

describe("positionAt — 누적 길이 선형 보간 (MAP-02)", () => {
  const seg: Segment = { p: [0, 0, 180, 0], t0: 1000, v: 180 };

  it("출발 전(t < t0)은 시작점", () => {
    expect(positionAt(seg, 500)).toEqual({ x: 0, z: 0 });
    expect(positionAt(seg, 1000)).toEqual({ x: 0, z: 0 });
  });

  it("1초 뒤에는 1.8 단위, 절반 시각에는 0.9 단위", () => {
    expect(positionAt(seg, 2000)).toEqual({ x: 1.8, z: 0 });
    expect(positionAt(seg, 1500)).toEqual({ x: 0.9, z: 0 });
  });

  it("끝 이후는 끝점에 머문다", () => {
    expect(positionAt(seg, 9999)).toEqual({ x: 1.8, z: 0 });
  });

  it("꺾인 구간은 누적 길이로 보간한다", () => {
    const bent: Segment = { p: [0, 0, 100, 0, 100, 100], t0: 0, v: 100 };
    expect(positionAt(bent, 1500)).toEqual({ x: 1, z: 0.5 });
    expect(positionAt(bent, 1000)).toEqual({ x: 1, z: 0 });
    expect(positionAt(bent, 2000)).toEqual({ x: 1, z: 1 });
  });

  it("한 점 구간은 언제나 그 점이다", () => {
    const rest: Segment = { p: [360, 40], t0: 0, v: 180 };
    expect(positionAt(rest, -5)).toEqual({ x: 3.6, z: 0.4 });
    expect(positionAt(rest, 123456)).toEqual({ x: 3.6, z: 0.4 });
  });

  it("길이 0 선분이 섞여도 NaN 이 없고 다음 선분으로 이어진다", () => {
    const dup: Segment = { p: [0, 0, 0, 0, 100, 0], t0: 0, v: 100 };
    const a = positionAt(dup, 500);
    expect(Number.isNaN(a.x) || Number.isNaN(a.z)).toBe(false);
    expect(a).toEqual({ x: 0.5, z: 0 });
    expect(positionAt({ p: [50, 50, 50, 50], t0: 0, v: 100 }, 800)).toEqual({ x: 0.5, z: 0.5 });
  });

  it("음수 좌표에서도 -0 을 내지 않는다", () => {
    const r = positionAtFx({ p: [0, 0, -100, 0], t0: 0, v: 100 }, 0);
    expect(Object.is(r.x, 0)).toBe(true);
    expect(Object.is(r.z, 0)).toBe(true);
  });

  it("v ≤ 0 이면 움직이지 않고 시작점에 있다", () => {
    expect(positionAt({ p: [0, 0, 100, 0], t0: 0, v: 0 }, 5000)).toEqual({ x: 0, z: 0 });
  });
});

describe("positionAtFx — 정수(반올림)", () => {
  it("보간 값을 가장 가까운 정수로 반올림한다", () => {
    const seg: Segment = { p: [0, 0, 100, 0], t0: 0, v: 100 };
    expect(positionAtFx(seg, 333)).toEqual({ x: 33, z: 0 }); // 33.3
    expect(positionAtFx(seg, 336)).toEqual({ x: 34, z: 0 }); // 33.6
    expect(positionAtFx(seg, 0)).toEqual({ x: 0, z: 0 });
    expect(positionAtFx(seg, 9999)).toEqual({ x: 100, z: 0 });
  });
});

describe("segmentEndsAt", () => {
  it("t0 + 길이 / v 초 (ms 올림)", () => {
    expect(segmentEndsAt({ p: [0, 0, 180, 0], t0: 1000, v: 180 })).toBe(2000);
    expect(segmentEndsAt({ p: [0, 0, 100, 0, 100, 100], t0: 0, v: 100 })).toBe(2000);
  });
  it("한 점 구간은 t0 에 끝난다", () => {
    expect(segmentEndsAt({ p: [10, 10], t0: 777, v: 180 })).toBe(777);
  });
  it("끝나는 시각에 positionAt 은 끝점이다", () => {
    const s: Segment = { p: [0, 0, 123, 456, 700, 700], t0: 4321, v: 180 };
    const end = positionAtFx(s, segmentEndsAt(s));
    expect(end).toEqual({ x: 700, z: 700 });
  });
});

describe("restSegment", () => {
  it("한 점 구간이다", () => {
    expect(restSegment(360, 40, 5)).toEqual({ p: [360, 40], t0: 5, v: MOVE_V });
  });
});

describe("spawnPlayer (Task 1 범위: 입장 지점)", () => {
  it("seat 0 은 (360, 40) 한 점, t0 = now, v = 180", () => {
    const w = oneWalker(5000);
    expect(w.segs.p0).toEqual({ p: [360, 40], t0: 5000, v: 180 });
  });
  it("입력 월드를 바꾸지 않는다", () => {
    const base = deepFreeze(emptyWorld());
    const w = spawnPlayer(base, "p0", 3, 1, BAR_MAP);
    expect(base.segs).toEqual({});
    expect(w).not.toBe(base);
  });
});

describe("requestMove — 목적지 하나가 지금 위치에서 서버 구간이 된다 (MAP-02, T-06-10)", () => {
  it("모르는 playerId 는 UNKNOWN_PLAYER", () => {
    const r = requestMove(oneWalker(), "nobody", { x: 40, z: 360 }, 2000, BAR_MAP);
    expect(r).toEqual({ ok: false, reason: "UNKNOWN_PLAYER" });
  });

  it("첫 이동: t0 = now, v = 180, 첫 점 = 지금 위치, 끝 점 = 목적지", () => {
    const w = deepFreeze(oneWalker(1000));
    const r = must(requestMove(w, "p0", { x: 40, z: 360 }, 2000, BAR_MAP));
    expect(r.seg.t0).toBe(2000);
    expect(r.seg.v).toBe(180);
    expect(r.seg.p.slice(0, 2)).toEqual([360, 40]);
    expect(r.seg.p.slice(-2)).toEqual([40, 360]);
    expect(r.world.segs.p0).toEqual(r.seg);
    expect(r.world).not.toBe(w);
  });

  it("경로의 모든 선분은 걸을 수 있고 정수 꼭짓점이다", () => {
    const r = must(requestMove(oneWalker(), "p0", { x: -420, z: -120 }, 2000, BAR_MAP));
    expect(r.seg.p.length % 2).toBe(0);
    expect(r.seg.p.every(Number.isInteger)).toBe(true);
    for (let i = 0; i + 3 < r.seg.p.length; i += 2) {
      const a = { x: r.seg.p[i]!, z: r.seg.p[i + 1]! };
      const b = { x: r.seg.p[i + 2]!, z: r.seg.p[i + 3]! };
      expect(lineWalkable(BAR_MAP, a, b)).toBe(true);
    }
  });

  it("이전 성공 뒤 149ms 는 TOO_SOON 이고 상태를 바꾸지 않는다, 150ms 는 통과", () => {
    const w0 = oneWalker(1000);
    const first = must(requestMove(w0, "p0", { x: 40, z: 360 }, 2000, BAR_MAP));
    const frozen = deepFreeze(first.world);
    const before = JSON.stringify(frozen);
    expect(requestMove(frozen, "p0", { x: -420, z: -120 }, 2149, BAR_MAP)).toEqual({ ok: false, reason: "TOO_SOON" });
    expect(JSON.stringify(frozen)).toBe(before);
    const again = requestMove(frozen, "p0", { x: -420, z: -120 }, 2150, BAR_MAP);
    expect(again.ok).toBe(true);
  });

  it("거절된 요청은 간격 시계를 늘리지 않는다", () => {
    const first = must(requestMove(oneWalker(1000), "p0", { x: 40, z: 360 }, 2000, BAR_MAP));
    requestMove(first.world, "p0", { x: 0, z: 300 }, 2100, BAR_MAP);
    expect(requestMove(first.world, "p0", { x: 0, z: 300 }, 2150, BAR_MAP).ok).toBe(true);
  });

  it("걷는 중 새 목적지를 받으면 지금 위치에서 새 경로를 만든다 (UI-SPEC E3)", () => {
    const first = must(requestMove(oneWalker(1000), "p0", { x: 40, z: 360 }, 2000, BAR_MAP));
    const midTime = 3000; // 1초 = 180 단위 걸음, 전체 길이는 그보다 길다
    expect(segmentEndsAt(first.seg)).toBeGreaterThan(midTime);
    const here = positionAtFx(first.seg, midTime);
    expect(here).not.toEqual({ x: 360, z: 40 });
    const second = must(requestMove(first.world, "p0", { x: -420, z: -120 }, midTime, BAR_MAP));
    expect(second.seg.p.slice(0, 2)).toEqual([here.x, here.z]);
    expect(second.seg.t0).toBe(midTime);
  });

  it("무대 근처(10,0)처럼 막힌 목적지는 보정된 걸을 수 있는 점이 끝점이 된다(무대 자리 0,0 은 08-04 의 단일 예외)", () => {
    const r = must(requestMove(oneWalker(), "p0", { x: 10, z: 0 }, 2000, BAR_MAP));
    const end = { x: r.seg.p.at(-2)!, z: r.seg.p.at(-1)! };
    expect(end).not.toEqual({ x: 10, z: 0 });
    const cell = cellOfFx(end.x, end.z);
    expect(isWalkable(BAR_MAP, cell.c, cell.r)).toBe(true);
  });

  it("맵 밖 목적지도 맵 안의 걸을 수 있는 점으로 보정된다", () => {
    const r = must(requestMove(oneWalker(), "p0", { x: 9999, z: -9999 }, 2000, BAR_MAP));
    const end = { x: r.seg.p.at(-2)!, z: r.seg.p.at(-1)! };
    expect(Math.abs(end.x)).toBeLessThanOrEqual(580);
    expect(Math.abs(end.z)).toBeLessThanOrEqual(580);
    expect(lineWalkable(BAR_MAP, end, end)).toBe(true);
  });

  it("제자리 목적지는 한 점 구간이다", () => {
    const r = must(requestMove(oneWalker(), "p0", { x: 360, z: 40 }, 2000, BAR_MAP));
    expect(r.seg.p).toEqual([360, 40]);
    expect(segmentEndsAt(r.seg)).toBe(2000);
  });

  it("입력 월드는 얼려 있어도 던지지 않는다(새 객체만 만든다)", () => {
    const w = deepFreeze(oneWalker());
    expect(() => requestMove(w, "p0", { x: 40, z: 360 }, 2000, BAR_MAP)).not.toThrow();
  });
});

describe("planMoveSegment — requestMove 본체와 같다(결정 0059)", () => {
  /** 같은 월드·같은 시각에 requestMove 가 만든 구간과 planMoveSegment 의 구간이 깊은 비교로 같다. */
  function sameAsRequestMove(w: WorldState, dest: { x: number; z: number }, now: number): Segment {
    const cur = w.segs.p0!;
    const planned = planMoveSegment(cur, dest, now, BAR_MAP);
    const served = must(requestMove(w, "p0", dest, now, BAR_MAP)).seg;
    expect(planned).toEqual(served);
    return planned;
  }

  it("서 있다 출발: 같은 목적지·시각이면 requestMove 의 구간과 같다", () => {
    sameAsRequestMove(oneWalker(1000), { x: 40, z: 360 }, 2000);
  });

  it("걷는 중 새 목적지: 구간이 같고 첫 점이 지금 위치(positionAtFx)다", () => {
    const walking = must(requestMove(oneWalker(1000), "p0", { x: -420, z: -120 }, 2000, BAR_MAP)).world;
    const seg = sameAsRequestMove(walking, { x: 40, z: 360 }, 3000);
    const at = positionAtFx(walking.segs.p0!, 3000);
    expect(seg.p.slice(0, 2)).toEqual([at.x, at.z]);
  });

  it("막힌 목적지(10,0)·무대 자리(0,0)·맵 밖(9999,-9999)·비유한(NaN) 좌표도 같다", () => {
    for (const dest of [{ x: 10, z: 0 }, { x: 0, z: 0 }, { x: 9999, z: -9999 }, { x: Number.NaN, z: Number.NaN }]) {
      sameAsRequestMove(oneWalker(1000), dest, 2000);
    }
  });

  it("제자리 목적지(지금 위치)는 한 점 구간으로 같다", () => {
    const seg = sameAsRequestMove(oneWalker(1000), { x: 360, z: 40 }, 2000);
    expect(seg.p).toEqual([360, 40]);
  });

  it("입력 구간을 바꾸지 않는다(얼린 입력으로 호출해도 던지지 않는다)", () => {
    const cur = deepFreeze({ p: [360, 40, 360, 220], t0: 1000, v: MOVE_V });
    expect(() => planMoveSegment(cur, { x: 40, z: 360 }, 1500, BAR_MAP)).not.toThrow();
  });
});

describe("moveFrame — 누설 표면 0 (T-06-09 와 짝)", () => {
  const seg: Segment = { p: [360, 40, 40, 360], t0: 2000, v: 180 };

  it("키 집합은 {t,k,s,p,t0,v} 뿐이고 t='world', k='move'", () => {
    const f = moveFrame(3, seg);
    expect(Object.keys(f).sort()).toEqual(["k", "p", "s", "t", "t0", "v"]);
    expect(f.t).toBe("world");
    expect(f.k).toBe("move");
    expect(f.s).toBe(3);
    expect(f.p).toEqual([360, 40, 40, 360]);
    expect(f.t0).toBe(2000);
    expect(f.v).toBe(180);
  });

  it("프레임에 playerId 가 새지 않는다 (이동 결과를 프레임으로 만들어 본다)", () => {
    const id = "secret-player-id-0123456789";
    const w = spawnPlayer(emptyWorld(), id, 2, 1000, BAR_MAP);
    const r = must(requestMove(w, id, { x: 40, z: 360 }, 2000, BAR_MAP));
    expect(JSON.stringify(moveFrame(2, r.seg))).not.toContain(id);
  });

  it("p 는 구간과 배열을 공유하지 않는다(복사)", () => {
    const f = moveFrame(0, seg);
    f.p.push(1);
    expect(seg.p).toEqual([360, 40, 40, 360]);
  });
});

// ---- Task 2: 입장·퇴장·대기실 복귀와 저장/복원·스냅샷 (MAP-05, MAP-01) ----

const SPAWNS_FX = [
  [360, 40],
  [40, 360],
  [540, 220],
  [-420, -120],
  [340, -260],
  [-260, 340],
  [-420, 20],
  [220, 540],
];
const ID = (i: number): string => `00000000-0000-4000-8000-00000000000${i}`;
const PLAYERS = Array.from({ length: 8 }, (_, i) => ({ id: ID(i), seat: i }));

/** 8명 입장 후 p0..p3 이 서로 다른 곳으로 걷는 중인 월드(첫 이동 now=2000). */
function busyWorld(): WorldState {
  let w = emptyWorld();
  for (const pl of PLAYERS) w = spawnPlayer(w, pl.id, pl.seat, 1000, BAR_MAP);
  const dests = [
    { x: 40, z: 360 },
    { x: -420, z: -120 },
    { x: 340, z: -260 },
    { x: -260, z: 340 },
  ];
  dests.forEach((d, i) => {
    w = must(requestMove(w, ID(i), d, 2000, BAR_MAP)).world;
  });
  return w;
}

describe("spawnPlayer / despawnPlayer — 입장 지점", () => {
  it("8개 seat 모두 BAR_SPAWNS 를 UNIT 배한 정수 한 점에 선다", () => {
    for (let seat = 0; seat < 8; seat++) {
      const w = spawnPlayer(emptyWorld(), "p", seat, 5000, BAR_MAP);
      expect(w.segs.p).toEqual({ p: SPAWNS_FX[seat], t0: 5000, v: 180 });
    }
  });

  it("despawnPlayer 는 구간·간격·배회 기록을 모두 지운다(입력 불변)", () => {
    const moved = must(requestMove(spawnPlayer(emptyWorld(), "p0", 0, 1000, BAR_MAP), "p0", { x: 40, z: 360 }, 2000, BAR_MAP)).world;
    const base = deepFreeze({ ...moved, wanderAt: { p0: 7000, other: 8000 } });
    const w = despawnPlayer(base, "p0");
    expect(w.segs).toEqual({});
    expect(w.lastMoveAt).toEqual({});
    expect(w.wanderAt).toEqual({ other: 8000 });
    expect(Object.keys(base.segs)).toEqual(["p0"]);
  });

  it("없는 사람을 지워도 던지지 않는다", () => {
    expect(() => despawnPlayer(emptyWorld(), "ghost")).not.toThrow();
  });
});

describe("respawnAll — 대기실 복귀", () => {
  it("걷던 사람도 서 있던 사람도 모두 자기 seat 입장 지점 한 점으로 돌아간다", () => {
    const w = busyWorld();
    const r = respawnAll(deepFreeze(w), PLAYERS, 9000, BAR_MAP);
    for (const pl of PLAYERS) expect(r.segs[pl.id]).toEqual({ p: SPAWNS_FX[pl.seat], t0: 9000, v: 180 });
  });

  it("방에 없는 사람은 버리고 간격 기록을 비워 바로 걸을 수 있다", () => {
    const w = busyWorld();
    const r = respawnAll(w, PLAYERS.slice(0, 2), 9000, BAR_MAP);
    expect(Object.keys(r.segs).sort()).toEqual([ID(0), ID(1)]);
    expect(r.lastMoveAt).toEqual({});
    expect(requestMove(r, ID(0), { x: 40, z: 360 }, 9000, BAR_MAP).ok).toBe(true);
  });
});

describe("compactWorld — 저장 모양 (MAP-05, RESEARCH R6)", () => {
  it("{ v: 1, segs } 뿐이고 lastMoveAt·wanderAt 은 없다", () => {
    const stored = compactWorld({ ...busyWorld(), wanderAt: { bot: 99999 } }, 3000);
    expect(Object.keys(stored).sort()).toEqual(["segs", "v"]);
    expect(stored.v).toBe(1);
    expect(JSON.stringify(stored)).not.toContain("99999");
    expect(JSON.stringify(stored)).not.toContain("lastMoveAt");
  });

  it("끝난 구간은 [끝x, 끝z] 한 점으로 접히고 진행 중 구간은 그대로다", () => {
    const w = busyWorld();
    const seg0 = w.segs[ID(0)]!;
    const end0 = { x: seg0.p.at(-2)!, z: seg0.p.at(-1)! };
    const ends = segmentEndsAt(seg0);
    const afterEnd = compactWorld(w, ends + 1);
    expect(afterEnd.segs[ID(0)]!.p).toEqual([end0.x, end0.z]);
    const mid = compactWorld(w, 2500);
    expect(segmentEndsAt(seg0)).toBeGreaterThan(2500);
    expect(mid.segs[ID(0)]).toEqual(seg0);
    expect(mid.segs[ID(7)]!.p).toEqual(SPAWNS_FX[7]); // 서 있던 사람은 한 점 그대로
  });

  it("입력 월드를 바꾸지 않고, 저장 구간은 입력과 배열을 공유하지 않는다", () => {
    const w = deepFreeze(busyWorld());
    const stored = compactWorld(w, 2500);
    stored.segs[ID(0)]!.p.push(1, 2);
    expect(w.segs[ID(0)]!.p.length).toBeLessThan(stored.segs[ID(0)]!.p.length);
    expect(w.segs[ID(0)]!.p).not.toContain(1);
  });

  it("8명 저장 JSON 은 4096 바이트보다 짧다(진행 중 구간 포함)", () => {
    expect(JSON.stringify(compactWorld(busyWorld(), 2500)).length).toBeLessThan(4096);
  });
});

describe("restoreWorld — 하이버네이션·배포 뒤 복원 (MAP-05, T-06-11)", () => {
  it("compactWorld 를 되살리면 진행 중 구간까지 같은 위치를 준다", () => {
    const w = busyWorld();
    const restored = restoreWorld(JSON.parse(JSON.stringify(compactWorld(w, 2500))), PLAYERS, 2600, BAR_MAP);
    for (const pl of PLAYERS) {
      for (const t of [2000, 2600, 3500, 6000, 20000]) {
        expect(positionAt(restored.segs[pl.id]!, t)).toEqual(positionAt(w.segs[pl.id]!, t));
      }
    }
  });

  it("되살린 월드는 간격 기록·배회 기록이 비어 바로 걸을 수 있다", () => {
    const r = restoreWorld(compactWorld(busyWorld(), 2500), PLAYERS, 2600, BAR_MAP);
    expect(r.lastMoveAt).toEqual({});
    expect(r.wanderAt).toEqual({});
    expect(requestMove(r, ID(0), { x: 40, z: 360 }, 2600, BAR_MAP).ok).toBe(true);
  });

  it.each([
    ["null", null],
    ["문자열", "text"],
    ["숫자", 42],
    ["배열", []],
    ["v 2", { v: 2, segs: {} }],
    ["v 없음", { segs: {} }],
    ["segs 가 배열", { v: 1, segs: [] }],
    ["segs 가 null", { v: 1, segs: null }],
    ["segs 가 문자열", { v: 1, segs: "x" }],
  ])("모르는 모양(%s)이면 모든 플레이어를 입장 지점에 세운다", (_name, stored) => {
    const r = restoreWorld(stored, PLAYERS, 4000, BAR_MAP);
    for (const pl of PLAYERS) expect(r.segs[pl.id]).toEqual({ p: SPAWNS_FX[pl.seat], t0: 4000, v: 180 });
  });

  it("방에 없는 id 는 버리고, 방에 있는데 저장에 없는 사람은 입장 지점에 세운다", () => {
    const stored = compactWorld(busyWorld(), 2500);
    stored.segs.ghost = restSegment(100, 100, 0);
    delete stored.segs[ID(7)];
    const r = restoreWorld(stored, PLAYERS, 4000, BAR_MAP);
    expect(r.segs.ghost).toBeUndefined();
    expect(Object.keys(r.segs).sort()).toEqual(PLAYERS.map((p) => p.id).sort());
    expect(r.segs[ID(7)]).toEqual({ p: SPAWNS_FX[7], t0: 4000, v: 180 });
    expect(r.segs[ID(0)]!.t0).toBe(2000); // 멀쩡한 저장값은 그대로
  });

  const base = { p: [360, 40], t0: 1000, v: 180 };
  it.each<[string, unknown]>([
    ["p 길이 홀수", { ...base, p: [360, 40, 100] }],
    ["p 소수", { ...base, p: [360.5, 40] }],
    ["p 범위 밖 +", { ...base, p: [9999, 40] }],
    ["p 범위 밖 −", { ...base, p: [360, 40, -701, 40] }],
    ["p 비어 있음", { ...base, p: [] }],
    ["p 가 배열이 아님", { ...base, p: "360,40" }],
    ["p 에 문자열", { ...base, p: ["360", 40] }],
    ["p 에 NaN", { ...base, p: [Number.NaN, 40] }],
    ["끝점이 무대 자리지만 닿는 거리(300) 밖에서 이은 선분", { ...base, p: [360, 40, 0, 0] }],
    ["한 점이 막힌 셀(무대 근처 10,0 — 무대 자리 0,0 은 단일 예외)", { ...base, p: [10, 0] }],
    ["v 0", { ...base, v: 0 }],
    ["v 음수", { ...base, v: -5 }],
    ["v 1001", { ...base, v: 1001 }],
    ["v 문자열", { ...base, v: "180" }],
    ["v 없음", { p: base.p, t0: base.t0 }],
    ["t0 없음", { p: base.p, v: base.v }],
    ["t0 NaN", { ...base, t0: Number.NaN }],
    ["구간이 null", null],
    ["구간이 배열", []],
  ])("손상된 구간(%s)은 그 사람만 입장 지점으로 되돌린다", (_name, bad) => {
    const stored = compactWorld(busyWorld(), 2500);
    stored.segs[ID(5)] = bad as Segment;
    const r = restoreWorld(stored, PLAYERS, 4000, BAR_MAP);
    expect(r.segs[ID(5)]).toEqual({ p: SPAWNS_FX[5], t0: 4000, v: 180 });
    expect(r.segs[ID(1)]!.p.length).toBeGreaterThan(2); // 이웃은 건드리지 않는다
  });

  it("저장 구간에 덧붙은 키는 버린다(p·t0·v 만 되살린다)", () => {
    const stored = compactWorld(busyWorld(), 2500);
    (stored.segs[ID(0)] as unknown as Record<string, unknown>).evil = "x";
    const r = restoreWorld(stored, PLAYERS, 4000, BAR_MAP);
    expect(Object.keys(r.segs[ID(0)]!).sort()).toEqual(["p", "t0", "v"]);
  });

  it("입력 저장값을 바꾸지 않는다", () => {
    const stored = deepFreeze(compactWorld(busyWorld(), 2500));
    expect(() => restoreWorld(stored, PLAYERS, 4000, BAR_MAP)).not.toThrow();
  });
});

describe("snapFrame — 접속 때 모두의 지금 구간 (MAP-01)", () => {
  it("{t:'world', k:'snap', at, ents} 이고 at 은 now 다", () => {
    const f = snapFrame(busyWorld(), PLAYERS, 12345);
    expect(f.at).toBe(12345);
    expect(f.t).toBe("world");
    expect(f.k).toBe("snap");
    expect(Object.keys(f).sort()).toEqual(["at", "ents", "k", "t"]);
  });

  it("ents 는 seat 오름차순이고 각 키 집합은 {s,p,t0,v} 뿐이다(playerId 없음)", () => {
    const shuffled = [PLAYERS[5]!, PLAYERS[0]!, PLAYERS[7]!, PLAYERS[2]!, PLAYERS[1]!, PLAYERS[6]!, PLAYERS[3]!, PLAYERS[4]!];
    const f = snapFrame(busyWorld(), shuffled, 2500);
    expect(f.ents.map((e) => e.s)).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
    for (const e of f.ents) expect(Object.keys(e).sort()).toEqual(["p", "s", "t0", "v"]);
    expect(JSON.stringify(f)).not.toContain("00000000-0000-4000");
  });

  it("끝난 구간은 한 점으로 접혀 있고 진행 중 구간은 그대로다", () => {
    const w = busyWorld();
    const seg0 = w.segs[ID(0)]!;
    const done = snapFrame(w, PLAYERS, segmentEndsAt(seg0) + 1);
    expect(done.ents[0]!.p).toEqual([seg0.p.at(-2), seg0.p.at(-1)]);
    const mid = snapFrame(w, PLAYERS, 2500);
    expect(mid.ents[0]!.p).toEqual(seg0.p);
  });

  it("players 에 없는 world 항목은 싣지 않고, world 에 없는 사람도 싣지 않는다", () => {
    const w = busyWorld();
    const f = snapFrame(w, [PLAYERS[3]!, { id: "nobody", seat: 6 }], 2500);
    expect(f.ents.map((e) => e.s)).toEqual([3]);
  });

  it("p 는 월드와 배열을 공유하지 않는다", () => {
    const w = busyWorld();
    const f = snapFrame(w, PLAYERS, 2500);
    f.ents[0]!.p.push(1);
    expect(w.segs[ID(0)]!.p).not.toContain(1);
  });
});

// ---- Task 3: 테스트 방 봇 로비 배회 계획(결정적) ----

const BOTS = [
  { id: "bot-a", seat: 3 },
  { id: "bot-b", seat: 1 },
  { id: "bot-c", seat: 5 },
];
const BOTS_BY_SEAT = [...BOTS].sort((a, b) => a.seat - b.seat); // b(1) → a(3) → c(5)

describe("planWander — 첫 호출은 계획만 세운다", () => {
  it("상수: 3~6초 간격", () => {
    expect(WANDER_MIN_MS).toBe(3000);
    expect(WANDER_SPAN_MS).toBe(3000);
  });

  it("처음 planWander(now 0): moves 없음, 봇마다 wanderAt = 0 + 3000 + randInt(3000) (seat 오름차순으로 난수 호출)", () => {
    const ref = seededRandInt(11);
    const expected: Record<string, number> = {};
    for (const b of BOTS_BY_SEAT) expected[b.id] = 3000 + ref(3000);
    const r = planWander(emptyWorld(), BOTS, 0, seededRandInt(11), BAR_MAP);
    expect(r.moves).toEqual([]);
    expect(r.world.wanderAt).toEqual(expected);
  });

  it("각 wanderAt 은 now + [3000, 6000) 안이다", () => {
    const r = planWander(emptyWorld(), BOTS, 10_000, seededRandInt(5), BAR_MAP);
    for (const b of BOTS) {
      expect(r.world.wanderAt[b.id]!).toBeGreaterThanOrEqual(13_000);
      expect(r.world.wanderAt[b.id]!).toBeLessThan(16_000);
    }
  });
});

describe("planWander — 때가 된 봇만 걷는다", () => {
  it("now ≥ wanderAt 인 봇만 moves 에 들고(seat 오름차순) 다음 wanderAt = now + 3000 + randInt(3000)", () => {
    const w0 = { ...emptyWorld(), wanderAt: { "bot-b": 4000, "bot-a": 4000, "bot-c": 9000 } };
    const cells = walkableCells(BAR_MAP);
    const ref = seededRandInt(21);
    const expectMoves: { playerId: string; dest: { x: number; z: number } }[] = [];
    const expectAt: Record<string, number> = { "bot-c": 9000 };
    for (const b of [BOTS_BY_SEAT[0]!, BOTS_BY_SEAT[1]!]) {
      const cell = cells[ref(cells.length)]!;
      expectMoves.push({ playerId: b.id, dest: cellCenterFx(cell.c, cell.r) });
      expectAt[b.id] = 5000 + 3000 + ref(3000);
    }
    const r = planWander(deepFreeze(w0), BOTS, 5000, seededRandInt(21), BAR_MAP);
    expect(r.moves).toEqual(expectMoves);
    expect(r.moves.map((m) => m.playerId)).toEqual(["bot-b", "bot-a"]);
    expect(r.world.wanderAt).toEqual(expectAt);
  });

  it("목적지는 걸을 수 있는 셀 중심이다", () => {
    const w0 = { ...emptyWorld(), wanderAt: { "bot-a": 0, "bot-b": 0, "bot-c": 0 } };
    for (let seed = 1; seed <= 20; seed++) {
      const r = planWander(w0, BOTS, 1000, seededRandInt(seed), BAR_MAP);
      expect(r.moves).toHaveLength(3);
      for (const m of r.moves) {
        const cell = cellOfFx(m.dest.x, m.dest.z);
        expect(isWalkable(BAR_MAP, cell.c, cell.r)).toBe(true);
        expect(m.dest).toEqual(cellCenterFx(cell.c, cell.r));
      }
    }
  });

  it("처음 보는 봇이 섞이면 호출 순서는 seat 오름차순 [목적지 셀, 다음 간격] / [간격]", () => {
    const w0 = { ...emptyWorld(), wanderAt: { "bot-b": 0 } }; // seat 1 은 때가 됨, seat 3·5 는 처음
    const cells = walkableCells(BAR_MAP);
    const ref = seededRandInt(33);
    const cell = cells[ref(cells.length)]!;
    const bAt = 2000 + 3000 + ref(3000);
    const aAt = 2000 + 3000 + ref(3000);
    const cAt = 2000 + 3000 + ref(3000);
    const r = planWander(w0, BOTS, 2000, seededRandInt(33), BAR_MAP);
    expect(r.moves).toEqual([{ playerId: "bot-b", dest: cellCenterFx(cell.c, cell.r) }]);
    expect(r.world.wanderAt).toEqual({ "bot-b": bAt, "bot-a": aAt, "bot-c": cAt });
  });

  it("아직 때가 안 된 봇은 난수도 쓰지 않는다", () => {
    const w0 = { ...emptyWorld(), wanderAt: { "bot-a": 9000, "bot-b": 9000, "bot-c": 9000 } };
    let calls = 0;
    const r = planWander(w0, BOTS, 5000, () => { calls++; return 0; }, BAR_MAP);
    expect(calls).toBe(0);
    expect(r.moves).toEqual([]);
    expect(r.world.wanderAt).toEqual(w0.wanderAt);
  });

  it("같은 시드·같은 입력 → 같은 moves·wanderAt", () => {
    const w0 = { ...emptyWorld(), wanderAt: { "bot-a": 0, "bot-b": 0, "bot-c": 0 } };
    const a = planWander(w0, BOTS, 7000, seededRandInt(99), BAR_MAP);
    const b = planWander(w0, BOTS, 7000, seededRandInt(99), BAR_MAP);
    expect(b).toEqual(a);
    const c = planWander(w0, BOTS, 7000, seededRandInt(100), BAR_MAP);
    expect(c).not.toEqual(a);
  });

  it("목적지만 내고 이동을 직접 적용하지 않는다(구간·간격 기록 불변)", () => {
    const w = busyWorld();
    const w0 = { ...w, wanderAt: { [ID(6)]: 0 } };
    const r = planWander(deepFreeze(w0), [{ id: ID(6), seat: 6 }], 5000, seededRandInt(1), BAR_MAP);
    expect(r.moves).toHaveLength(1);
    expect(r.world.segs).toBe(w0.segs);
    expect(r.world.lastMoveAt).toBe(w0.lastMoveAt);
  });

  it("bots 목록에 없는 id 의 wanderAt 은 지워진다(봇이 빠지면 계획도 사라짐)", () => {
    const w0 = { ...emptyWorld(), wanderAt: { "bot-a": 9000, "gone-bot": 100 } };
    const r = planWander(w0, [BOTS[0]!], 5000, seededRandInt(1), BAR_MAP);
    expect(r.world.wanderAt).toEqual({ "bot-a": 9000 });
  });

  it("봇이 없으면 아무 일도 없고 난수도 쓰지 않는다", () => {
    const w0 = { ...emptyWorld(), wanderAt: { x: 1 } };
    const r = planWander(w0, [], 5000, () => { throw new Error("no rng"); }, BAR_MAP);
    expect(r).toEqual({ world: { ...w0, wanderAt: {} }, moves: [] });
  });

  it("randInt(0) 을 부르지 않는다(걸을 수 있는 셀이 없는 맵은 이동 없이 간격만 정한다)", () => {
    const walled = { id: "bar" as const, size: 2, mask: new Uint8Array(4), spawns: [] };
    const w0 = { ...emptyWorld(), wanderAt: { "bot-a": 0 } };
    const seen: number[] = [];
    const r = planWander(w0, [BOTS[0]!], 1000, (n) => { seen.push(n); return 0; }, walled);
    expect(seen).not.toContain(0);
    expect(r.moves).toEqual([]);
    expect(r.world.wanderAt["bot-a"]).toBe(4000);
  });
});

describe("nextWanderAt", () => {
  it("주어진 봇들의 wanderAt 최솟값", () => {
    const w = { ...emptyWorld(), wanderAt: { a: 9000, b: 4000, c: 6000 } };
    expect(nextWanderAt(w, ["a", "b", "c"])).toBe(4000);
    expect(nextWanderAt(w, ["a", "c"])).toBe(6000);
  });
  it("계획이 있는 봇이 없으면 null", () => {
    const w = { ...emptyWorld(), wanderAt: { a: 9000 } };
    expect(nextWanderAt(w, [])).toBeNull();
    expect(nextWanderAt(w, ["zzz"])).toBeNull();
    expect(nextWanderAt(emptyWorld(), ["a"])).toBeNull();
  });
});

// ---- 08-04: 무대 한 점 복원·forceSegment·배치 기억 lay (사용자 확정 2026-11-02, Pitfall 5·6, T-08-19) ----
describe("restoreWorld — 무대 한 점 구간 (Pitfall 6)", () => {
  it("한 점 [0,0] 구간은 그대로 복원한다(입장 지점으로 보내지 않는다)", () => {
    const r = restoreWorld({ v: 1, segs: { [ID(0)]: { p: [0, 0], t0: 1, v: 180 } } }, PLAYERS, 5000, BAR_MAP);
    expect(r.segs[ID(0)]).toEqual({ p: [0, 0], t0: 1, v: 180 });
  });

  it("무대에서 걸어 나오는 구간 [0,0, 265,0] 도 복원한다", () => {
    const stored = { v: 1, segs: { [ID(0)]: { p: [0, 0, 265, 0], t0: 1, v: 180 } } };
    expect(restoreWorld(stored, PLAYERS, 5000, BAR_MAP).segs[ID(0)]!.p).toEqual([0, 0, 265, 0]);
  });

  it("무대 근처 막힌 점 [10,0] 은 입장 지점으로 보낸다(예외는 정확히 한 점)", () => {
    const r = restoreWorld({ v: 1, segs: { [ID(0)]: { p: [10, 0], t0: 1, v: 180 } } }, PLAYERS, 5000, BAR_MAP);
    expect(r.segs[ID(0)]).toEqual({ p: SPAWNS_FX[0], t0: 5000, v: 180 });
  });

  it("무대를 가로지르는 구간 [-265,0, 265,0] 은 여전히 입장 지점으로 보낸다", () => {
    const r = restoreWorld({ v: 1, segs: { [ID(0)]: { p: [-265, 0, 265, 0], t0: 1, v: 180 } } }, PLAYERS, 5000, BAR_MAP);
    expect(r.segs[ID(0)]).toEqual({ p: SPAWNS_FX[0], t0: 5000, v: 180 });
  });

  it("무대에 선 사람의 구간은 compactWorld → JSON → restoreWorld 를 거쳐도 [0,0] 이다", () => {
    const w = forceSegment(spawnPlayer(emptyWorld(), ID(0), 0, 1000, BAR_MAP), ID(0), restSegment(0, 0, 2000));
    const restored = restoreWorld(JSON.parse(JSON.stringify(compactWorld(w, 3000))), PLAYERS, 3100, BAR_MAP);
    expect(restored.segs[ID(0)]!.p).toEqual([0, 0]);
  });

  it("planMoveSegment: 무대 자리에서 출발하는 길은 [0,0, …] 으로 시작해 목적지에서 끝난다", () => {
    const seg = planMoveSegment(restSegment(0, 0, 1000), { x: 360, z: 40 }, 2000, BAR_MAP);
    expect(`${seg.p[0]},${seg.p[1]}`).toBe("0,0");
    expect(`${seg.p.at(-2)},${seg.p.at(-1)}`).toBe("360,40");
    for (let i = 0; i + 3 < seg.p.length; i += 2) {
      expect(lineWalkable(BAR_MAP, { x: seg.p[i]!, z: seg.p[i + 1]! }, { x: seg.p[i + 2]!, z: seg.p[i + 3]! })).toBe(true);
    }
  });
});

describe("forceSegment — 서버 주도 이동 (Pitfall 5)", () => {
  const seg: Segment = { p: [0, 265, 187, 187], t0: 5000, v: 180 };

  it("그 사람 구간만 바꾸고 lastMoveAt·wanderAt 은 같은 객체 그대로다(간격 검사를 건드리지 않는다)", () => {
    const base = requestMove(busyWorld(), ID(7), { x: 40, z: 360 }, 3000, BAR_MAP);
    const w = must(base).world;
    const out = forceSegment(w, ID(7), seg);
    expect(out.segs[ID(7)]).toEqual(seg);
    for (const pl of PLAYERS) if (pl.id !== ID(7)) expect(out.segs[pl.id]).toBe(w.segs[pl.id]);
    expect(out.lastMoveAt).toBe(w.lastMoveAt);
    expect(out.wanderAt).toBe(w.wanderAt);
    expect(out.lastMoveAt[ID(7)]).toBe(3000);
  });

  it("간격(150ms) 안이어도 적용된다 — 사람이 바로 탭해도 막히지 않는다", () => {
    const w = must(requestMove(busyWorld(), ID(7), { x: 40, z: 360 }, 3000, BAR_MAP)).world;
    expect(forceSegment(w, ID(7), seg).segs[ID(7)]).toEqual(seg);
  });

  it("방에 없는 사람이면 입력 그대로(toBe)", () => {
    const w = busyWorld();
    expect(forceSegment(w, "nobody", seg)).toBe(w);
  });

  it("입력 월드를 바꾸지 않는다", () => {
    const w = deepFreeze(busyWorld());
    expect(() => forceSegment(w, ID(1), seg)).not.toThrow();
    expect(w.segs[ID(1)]).not.toEqual(seg);
  });
});

describe("배치 기억 lay — 저장·복원 (T-08-19)", () => {
  const LAY = { key: "2:ring", slots: { [ID(0)]: [0, 265], [ID(1)]: [-187, 187] } } as const;
  const withLay = (): WorldState => ({ ...busyWorld(), lay: { key: LAY.key, slots: { [ID(0)]: [0, 265], [ID(1)]: [-187, 187] } } });

  it("lay 가 없는 월드의 저장값에는 lay 키가 없다(옛 모양 그대로)", () => {
    expect(Object.keys(compactWorld(busyWorld(), 3000)).sort()).toEqual(["segs", "v"]);
  });

  it("compactWorld 가 lay 를 싣고 JSON 을 거친 restoreWorld 가 되살린다", () => {
    const stored = JSON.parse(JSON.stringify(compactWorld(withLay(), 3000)));
    expect(stored.lay).toEqual(LAY);
    const r = restoreWorld(stored, PLAYERS, 3100, BAR_MAP);
    expect(r.lay).toEqual(LAY);
  });

  it("lay 없는 옛 저장값({v:1, segs})도 그대로 읽힌다 — lay 는 없다", () => {
    const r = restoreWorld(compactWorld(busyWorld(), 3000), PLAYERS, 3100, BAR_MAP);
    expect(r.lay).toBeUndefined();
    expect(Object.keys(r).sort()).toEqual(["lastMoveAt", "segs", "wanderAt"]);
  });

  it.each([
    ["문자열", "x"],
    ["배열", []],
    ["key 가 숫자", { key: 3, slots: {} }],
    ["key 없음", { slots: {} }],
    ["slots 가 배열", { key: "2:ring", slots: [] }],
    ["slots 없음", { key: "2:ring" }],
  ])("lay 모양이 틀리면(%s) lay 만 버리고 나머지는 복원한다", (_name, lay) => {
    const stored = { ...JSON.parse(JSON.stringify(compactWorld(busyWorld(), 3000))), lay };
    const r = restoreWorld(stored, PLAYERS, 3100, BAR_MAP);
    expect(r.lay).toBeUndefined();
    for (const pl of PLAYERS) expect(r.segs[pl.id]).toEqual(compactWorld(busyWorld(), 3000).segs[pl.id]);
  });

  it.each([
    ["좌표가 정수가 아님", [1.5, 2]],
    ["좌표가 700 밖", [701, 0]],
    ["좌표가 -700 밖", [0, -701]],
    ["길이가 2가 아님", [1, 2, 3]],
    ["숫자가 아님", ["a", "b"]],
  ])("슬롯 좌표가 틀리면(%s) 그 슬롯만 버린다", (_name, bad) => {
    const stored = {
      ...JSON.parse(JSON.stringify(compactWorld(busyWorld(), 3000))),
      lay: { key: "2:ring", slots: { [ID(0)]: [0, 265], [ID(1)]: bad } },
    };
    const r = restoreWorld(stored, PLAYERS, 3100, BAR_MAP);
    expect(r.lay).toEqual({ key: "2:ring", slots: { [ID(0)]: [0, 265] } });
  });

  it("방에 없는 id 의 슬롯은 버린다", () => {
    const stored = {
      ...JSON.parse(JSON.stringify(compactWorld(busyWorld(), 3000))),
      lay: { key: "2:ring", slots: { [ID(0)]: [0, 265], stranger: [-187, 187] } },
    };
    const r = restoreWorld(stored, PLAYERS, 3100, BAR_MAP);
    expect(Object.keys(r.lay!.slots)).toEqual([ID(0)]);
  });

  it("compactWorld 의 lay 는 입력과 객체를 공유하지 않는다", () => {
    const w = withLay();
    const stored = compactWorld(w, 3000);
    (stored.lay!.slots as Record<string, readonly [number, number]>)[ID(0)] = [1, 1];
    expect(w.lay!.slots[ID(0)]).toEqual([0, 265]);
  });

  it("requestMove·spawnPlayer 는 lay 를 지우지 않고, despawnPlayer 는 그 사람 슬롯만 지운다, respawnAll 은 lay 가 없다", () => {
    const w = withLay();
    expect(must(requestMove(w, ID(3), { x: 40, z: 360 }, 9000, BAR_MAP)).world.lay).toEqual(w.lay);
    expect(spawnPlayer(w, ID(5), 5, 9000, BAR_MAP).lay).toEqual(w.lay);
    expect(despawnPlayer(w, ID(1)).lay).toEqual({ key: "2:ring", slots: { [ID(0)]: [0, 265] } });
    expect(respawnAll(w, PLAYERS, 9000, BAR_MAP).lay).toBeUndefined();
    expect(emptyWorld().lay).toBeUndefined();
  });
});

// ---- 09-04: home 기억 — 토론이 끝난 자리 (결정 0061-5, 연구 A1, T-09-06) ----
describe("home 기억 (결정 0061-5)", () => {
  const A = "A";
  const B = "B";
  const C = "C";
  /** A 는 [0,0]→[300,0] 을 걷는 중, B 는 [100,100] 한 점, C 는 구간 없음 */
  const threeWorld = (): WorldState => ({
    segs: {
      [A]: { p: [0, 0, 300, 0], t0: 1000, v: MOVE_V },
      [B]: { p: [100, 100], t0: 1000, v: MOVE_V },
    },
    lastMoveAt: { [A]: 1000, [B]: 1500 },
    wanderAt: {},
  });

  it("captureHome: 구간이 있는 사람마다 구간의 끝점을 적는다(걷던 사람은 가던 곳)", () => {
    const h = captureHome(threeWorld(), [A, B, C], 2).home;
    expect(h).toEqual({ day: 2, pos: { [A]: [300, 0], [B]: [100, 100] } });
  });

  it("captureHome: 같은 일차는 같은 객체(멱등), 다른 일차는 새로 기록한다", () => {
    const once = captureHome(threeWorld(), [A, B, C], 2);
    expect(captureHome(once, [A, B, C], 2)).toBe(once);
    const moved: WorldState = { ...once, segs: { ...once.segs, [B]: { p: [200, 200], t0: 1, v: MOVE_V } } };
    expect(captureHome(moved, [A, B, C], 2)).toBe(moved);
    expect(captureHome(moved, [A, B, C], 3).home).toEqual({ day: 3, pos: { [A]: [300, 0], [B]: [200, 200] } });
  });

  it("새 함수는 입력을 바꾸지 않는다(깊이 얼려도 던지지 않는다)", () => {
    const w = deepFreeze(captureHome(threeWorld(), [A, B], 1));
    expect(() => captureHome(w, [A, B], 2)).not.toThrow();
    expect(() => teleportHome(w, [A, B], 5000)).not.toThrow();
  });

  it("compactWorld → JSON → restoreWorld 왕복에서 home 이 보존된다", () => {
    const w = captureHome(busyWorld(), PLAYERS.map((p) => p.id), 2);
    const stored = JSON.parse(JSON.stringify(compactWorld(w, 3000)));
    expect(stored.home.day).toBe(2);
    const r = restoreWorld(stored, PLAYERS, 3100, BAR_MAP);
    expect(r.home).toEqual(w.home);
  });

  it("home 이 없는 월드의 저장값에는 home 키가 없고, 옛 저장값은 home 없이 구간 그대로 읽힌다", () => {
    expect("home" in compactWorld(busyWorld(), 3000)).toBe(false);
    const stored = JSON.parse(JSON.stringify(compactWorld(busyWorld(), 3000)));
    const r = restoreWorld(stored, PLAYERS, 3100, BAR_MAP);
    expect(r.home).toBeUndefined();
    expect(r.segs[ID(0)]).toEqual(compactWorld(busyWorld(), 3000).segs[ID(0)]);
  });

  it.each([
    ["day 음수", { day: -1, pos: {} }],
    ["day 소수", { day: 1.5, pos: {} }],
    ["day 문자열", { day: "2", pos: {} }],
    ["pos 가 배열", { day: 2, pos: [] }],
    ["pos 없음", { day: 2 }],
    ["문자열 통째", "home"],
  ])("home 모양이 틀리면(%s) home 만 버리고 나머지는 복원한다", (_n, home) => {
    const stored = { ...JSON.parse(JSON.stringify(compactWorld(busyWorld(), 3000))), home };
    const r = restoreWorld(stored, PLAYERS, 3100, BAR_MAP);
    expect(r.home).toBeUndefined();
    expect(Object.keys(r.segs)).toHaveLength(8);
  });

  it("pos 의 틀린 항목([1]·소수·범위 밖·방에 없는 id)만 버린다", () => {
    const home = {
      day: 2,
      pos: { [ID(0)]: [10, 20], [ID(1)]: [1], [ID(2)]: [1.5, 2], [ID(3)]: [999999999, 0], stranger: [5, 5] },
    };
    const stored = { ...JSON.parse(JSON.stringify(compactWorld(busyWorld(), 3000))), home };
    expect(restoreWorld(stored, PLAYERS, 3100, BAR_MAP).home).toEqual({ day: 2, pos: { [ID(0)]: [10, 20] } });
  });

  it("compactWorld 의 home 은 입력과 객체를 공유하지 않는다", () => {
    const w = captureHome(threeWorld(), [A, B], 2);
    const stored = compactWorld(w, 3000);
    (stored.home!.pos as Record<string, readonly [number, number]>)[A] = [1, 1];
    expect(w.home!.pos[A]).toEqual([300, 0]);
  });

  it("teleportHome: home 점과 구간이 모두 있는 사람만 서 있는 한 점으로 바꾸고 lastMoveAt 은 그대로", () => {
    const base = captureHome(threeWorld(), [A, B], 2);
    // A 는 home 뒤에 다른 곳으로 갔고, C 는 home 이 없고, D 는 구간이 없다
    const moved: WorldState = {
      ...base,
      segs: { ...base.segs, [A]: { p: [0, 0, 50, 50], t0: 3000, v: MOVE_V }, [C]: { p: [9, 9], t0: 1, v: MOVE_V } },
      home: { day: 2, pos: { ...base.home!.pos, D: [7, 7] } },
    };
    const r = teleportHome(moved, [A, B, C, "D"], 5000);
    expect(r.segs[A]).toEqual({ p: [300, 0], t0: 5000, v: MOVE_V });
    expect(r.segs[B]).toEqual({ p: [100, 100], t0: 5000, v: MOVE_V });
    expect(r.segs[C]).toEqual(moved.segs[C]);
    expect(r.segs).not.toHaveProperty("D");
    expect(r.lastMoveAt).toEqual(moved.lastMoveAt);
    expect(r.home).toBe(moved.home);
  });

  it("teleportHome: home 이 없으면 입력 객체 그대로(fail-safe)", () => {
    const w = threeWorld();
    expect(teleportHome(w, [A, B], 5000)).toBe(w);
  });
});
