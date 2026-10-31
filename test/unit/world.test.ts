// 로비 이동 규칙(shared/game/world.ts) — 구간 보간·이동 요청·프레임 모양. 시각과 난수는 모두 인자로 주입한다.
import { describe, expect, it } from "vitest";
import {
  BAR_MAP,
  cellOfFx,
  isWalkable,
  lineWalkable,
} from "../../shared/game/map";
import {
  MOVE_MIN_GAP_MS,
  MOVE_SPEED,
  MOVE_V,
  type Segment,
  type WorldState,
  emptyWorld,
  moveFrame,
  positionAt,
  positionAtFx,
  requestMove,
  restSegment,
  segmentEndsAt,
  spawnPlayer,
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

  it("무대 중심(0,0)처럼 막힌 목적지는 보정된 걸을 수 있는 점이 끝점이 된다", () => {
    const r = must(requestMove(oneWalker(), "p0", { x: 0, z: 0 }, 2000, BAR_MAP));
    const end = { x: r.seg.p.at(-2)!, z: r.seg.p.at(-1)! };
    expect(end).not.toEqual({ x: 0, z: 0 });
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
