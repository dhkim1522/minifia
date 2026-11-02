// 결정 0059 의 예측·섞기·방향·응답 판정 순수 계산(src/world/motion.ts). 시각은 모두 인자다.
import { describe, expect, it } from "vitest";
import { BAR_MAP } from "../../shared/game/map";
import { type WorldState, emptyWorld, requestMove, spawnPlayer } from "../../shared/game/world";
import {
  BLEND_SNAP_DIST,
  SEG_BLEND_MS,
  YAW_TURN_RATE,
  blendRemaining,
  predictSegment,
  stepYaw,
  travelYaw,
} from "../../src/world/motion";

function oneWalker(now = 1000): WorldState {
  return spawnPlayer(emptyWorld(), "p0", 0, now, BAR_MAP);
}

function must<T extends { ok: boolean }>(r: T): Extract<T, { ok: true }> {
  if (!r.ok) throw new Error(`expected ok, got ${JSON.stringify(r)}`);
  return r as Extract<T, { ok: true }>;
}

describe("predictSegment — 서버가 같은 시각에 같은 목적지를 받았을 때 만드는 구간과 같다 (결정 0059-1)", () => {
  it("서 있다 출발", () => {
    const w = oneWalker(1000);
    const dest = { x: 40, z: 360 };
    expect(predictSegment(w.segs.p0, dest, 2000)).toEqual(must(requestMove(w, "p0", dest, 2000, BAR_MAP)).seg);
  });

  it("걷는 중 새 목적지", () => {
    const walking = must(requestMove(oneWalker(1000), "p0", { x: -420, z: -120 }, 2000, BAR_MAP)).world;
    const dest = { x: 40, z: 360 };
    expect(predictSegment(walking.segs.p0, dest, 3000)).toEqual(must(requestMove(walking, "p0", dest, 3000, BAR_MAP)).seg);
  });

  it("기준 구간이 없으면 null", () => {
    expect(predictSegment(undefined, { x: 40, z: 360 }, 2000)).toBeNull();
  });
});

describe("상수 (결정 0059-3)", () => {
  it("섞는 시간은 100~150ms, 순간이동 기준은 응답 없음 되돌림 최대(1.5초 × 1.8)보다 크고, 반 바퀴는 120ms 다", () => {
    expect(SEG_BLEND_MS).toBeGreaterThanOrEqual(100);
    expect(SEG_BLEND_MS).toBeLessThanOrEqual(150);
    expect(BLEND_SNAP_DIST).toBeGreaterThan(1.5 * 1.8);
    expect(Math.abs(YAW_TURN_RATE * 0.12 - Math.PI)).toBeLessThan(1e-9);
  });
});

describe("blendRemaining — 구간 교체 때 남은 화면 위치 차이 비율", () => {
  it("0ms 이하는 1, SEG_BLEND_MS 이상은 정확히 0, 절반은 0.5", () => {
    expect(blendRemaining(0)).toBe(1);
    expect(blendRemaining(-5)).toBe(1);
    expect(blendRemaining(SEG_BLEND_MS)).toBe(0);
    expect(blendRemaining(SEG_BLEND_MS + 1000)).toBe(0);
    expect(blendRemaining(SEG_BLEND_MS / 2)).toBe(0.5);
  });

  it("0~SEG_BLEND_MS 에서 단조 감소하고 1ms 사이 감소량이 smoothstep 최대 기울기(평균의 1.5배)를 넘지 않는다", () => {
    let prev = blendRemaining(0);
    for (let ms = 1; ms <= SEG_BLEND_MS; ms++) {
      const cur = blendRemaining(ms);
      expect(cur).toBeLessThanOrEqual(prev);
      expect(prev - cur).toBeLessThanOrEqual(1.5 / SEG_BLEND_MS + 1e-12);
      prev = cur;
    }
  });
});

const wrapDist = (a: number, b: number): number => {
  let d = (a - b) % (2 * Math.PI);
  if (d > Math.PI) d -= 2 * Math.PI;
  if (d < -Math.PI) d += 2 * Math.PI;
  return Math.abs(d);
};

describe("stepYaw — 짧은 쪽으로 한 프레임에 YAW_TURN_RATE × dt 까지만", () => {
  it("충분한 시간이면 정확히 목표", () => {
    expect(stepYaw(0, Math.PI / 2, 1)).toBe(Math.PI / 2);
  });

  it("짧은 프레임이면 YAW_TURN_RATE × dt 만큼만 돈다", () => {
    const r = stepYaw(0, Math.PI / 2, 0.016);
    expect(r).toBeGreaterThan(0);
    expect(Math.abs(r - YAW_TURN_RATE * 0.016)).toBeLessThan(1e-12);
  });

  it("π 를 넘어가는 쪽이 더 짧으면 그쪽으로 돈다", () => {
    const before = wrapDist(3, -3);
    const r = stepYaw(3, -3, 0.001);
    expect(r).toBeGreaterThan(3);
    expect(wrapDist(r, -3)).toBeLessThan(before);
  });

  it("결과는 언제나 (−π, π] 안이다", () => {
    for (const [cur, target, dt] of [
      [3.1, -3.1, 0.016],
      [3.1, -3.1, 1],
      [-3.1, 3.1, 0.016],
      [0, Math.PI, 1],
      [Math.PI, -Math.PI, 0.5],
      [7, -7, 0.05],
      [0, 0, 0],
    ] as const) {
      const r = stepYaw(cur, target, dt);
      expect(r).toBeGreaterThan(-Math.PI);
      expect(r).toBeLessThanOrEqual(Math.PI);
    }
  });
});

describe("travelYaw — 서버 시각 t 에 걷는 선분의 방향 atan2(dx, dz)", () => {
  const one = { p: [0, 0, 100, 0], t0: 0, v: 100 };

  it("x 증가 = π/2, t < t0 이면 첫 선분, 끝난 뒤는 null", () => {
    expect(travelYaw(one, 500)).toBe(Math.PI / 2);
    expect(travelYaw(one, -100)).toBe(Math.PI / 2);
    expect(travelYaw(one, 2000)).toBeNull();
  });

  it("둘째 선분에서는 둘째 선분 방향", () => {
    expect(travelYaw({ p: [0, 0, 100, 0, 100, 100], t0: 0, v: 100 }, 1500)).toBe(0);
  });

  it("한 점 구간·길이 0 선분만 있는 구간은 null, 길이 0 선분은 건너뛴다", () => {
    expect(travelYaw({ p: [50, 50], t0: 0, v: 180 }, 0)).toBeNull();
    expect(travelYaw({ p: [50, 50, 50, 50], t0: 0, v: 180 }, 100)).toBeNull();
    expect(travelYaw({ p: [0, 0, 0, 0, 100, 0], t0: 0, v: 100 }, 500)).toBe(Math.PI / 2);
  });
});
