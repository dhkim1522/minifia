// 결정 0059 의 예측·섞기·방향·응답 판정 순수 계산(src/world/motion.ts). 시각은 모두 인자다.
import { describe, expect, it } from "vitest";
import { BAR_MAP } from "../../shared/game/map";
import { type WorldState, emptyWorld, requestMove, spawnPlayer } from "../../shared/game/world";
import {
  BLEND_SNAP_DIST,
  SEG_BLEND_MS,
  YAW_TURN_RATE,
  blendRemaining,
  createOwnMoves,
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

describe("createOwnMoves — 내 이동의 응답 판정 (결정 0059-2)", () => {
  const seg = (...p: number[]) => ({ p, t0: 0, v: 180 });
  // 첫 탭은 (100,0) 으로, 둘째 탭은 (0,100) 으로 간다. 끝점이 다르니 어느 응답인지 가려진다.
  const predA = seg(0, 0, 100, 0);
  const predB = seg(0, 0, 0, 100);
  const respA = seg(0, 0, 100, 0);
  const respB = seg(0, 0, 0, 100);

  it("보낸 뒤에는 예측을 그리고, 응답이 오면 answered 와 함께 서버 구간으로 돌아온다", () => {
    const own = createOwnMoves(0);
    own.sent(predA);
    expect(own.effective(respA)).toBe(predA);
    expect(own.pending()).toBe(1);
    expect(own.observe(1, respA)).toBe("answered");
    expect(own.effective(respA)).toBe(respA);
    expect(own.pending()).toBe(0);
  });

  it("탭 두 번 뒤 첫 응답만 오면 마지막 탭의 예측을 끊지 않는다(RTT > 탭 간격), 둘째 응답에서 answered", () => {
    const own = createOwnMoves(0);
    own.sent(predA);
    own.sent(predB);
    expect(own.observe(1, respA)).toBeNull();
    expect(own.effective(respA)).toBe(predB);
    expect(own.pending()).toBe(1);
    expect(own.observe(2, respB)).toBe("answered");
    expect(own.effective(respB)).toBe(respB);
    expect(own.pending()).toBe(0);
  });

  it("첫 탭이 서버에서 버려지고 둘째 응답만 오면(seq 1 증가, 끝점 = 둘째 예측 끝점) answered", () => {
    const own = createOwnMoves(0);
    own.sent(predA);
    own.sent(predB);
    expect(own.observe(1, respB)).toBe("answered");
    expect(own.pending()).toBe(0);
    expect(own.effective(respB)).toBe(respB);
  });

  it("같은 목적지로 두 번 탭하면 첫 응답에서 answered 이고, 이어 오는 둘째 응답은 null", () => {
    const own = createOwnMoves(0);
    own.sent(predA);
    own.sent(predA);
    expect(own.observe(1, respA)).toBe("answered");
    expect(own.observe(2, respA)).toBeNull();
    expect(own.pending()).toBe(0);
  });

  it("보낸 것이 없을 때 seq 가 늘면 null 이고 예측이 생기지 않는다", () => {
    const own = createOwnMoves(0);
    expect(own.observe(1, respA)).toBeNull();
    expect(own.pending()).toBe(0);
    expect(own.effective(respA)).toBe(respA);
  });

  it("예측 없이 보낸 것(sent(null))은 서버 구간을 그리고 응답에서 answered", () => {
    const own = createOwnMoves(0);
    own.sent(null);
    expect(own.pending()).toBe(1);
    expect(own.effective(respA)).toBe(respA);
    expect(own.observe(1, respA)).toBe("answered");
    expect(own.pending()).toBe(0);
  });

  it("seq 가 같으면 아무 일도 없다", () => {
    const own = createOwnMoves(4);
    own.sent(predA);
    expect(own.observe(4, respA)).toBeNull();
    expect(own.pending()).toBe(1);
    expect(own.effective(respA)).toBe(predA);
  });

  it("expire: 대기가 있으면 true 와 함께 예측·대기를 비운다, 없으면 false", () => {
    const own = createOwnMoves(0);
    expect(own.expire()).toBe(false);
    own.sent(predA);
    expect(own.expire()).toBe(true);
    expect(own.pending()).toBe(0);
    expect(own.effective(respB)).toBe(respB);
    expect(own.expire()).toBe(false);
  });

  it("기준보다 작은 seq 가 오면 reset: 예측·대기가 비고 기준이 그 seq 가 된다", () => {
    const own = createOwnMoves(3);
    own.sent(predA);
    expect(own.observe(0, respA)).toBe("reset");
    expect(own.pending()).toBe(0);
    expect(own.effective(respA)).toBe(respA);
    expect(own.observe(0, respA)).toBeNull();
    expect(own.observe(1, respA)).toBeNull();
  });

  it("reset(seq): 새 연결에서 대기·예측을 비우고 기준을 다시 잡는다", () => {
    const own = createOwnMoves(0);
    own.sent(predA);
    own.reset(5);
    expect(own.pending()).toBe(0);
    expect(own.effective(respA)).toBe(respA);
    expect(own.observe(5, respA)).toBeNull();
    own.sent(predB);
    expect(own.observe(6, respB)).toBe("answered");
  });
});
