// 결정 0059 의 예측·섞기·방향·응답 판정 순수 계산(src/world/motion.ts). 시각은 모두 인자다.
import { describe, expect, it } from "vitest";
import { BAR_MAP } from "../../shared/game/map";
import { MOVE_SPEED, type WorldState, emptyWorld, positionAt, requestMove, segmentEndsAt, spawnPlayer } from "../../shared/game/world";
import {
  BLEND_SNAP_DIST,
  OWN_LEAD_MAX_MS,
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

describe("움직임 밀림의 원인과 시각 앞섬 (18.1 실기기 재확인 2026-11-12)", () => {
  // 서 있다가 (0,0) → (600,0) 으로 걷는다. 클라이언트는 탭 시각 1000 에 예측을 만들고, 서버는 업링크 u 뒤에 받아 같은 길을 u 늦게 출발시킨다.
  const TAP = 1000;
  const predOf = (lead = 0) => ({ p: [0, 0, 600, 0], t0: TAP + lead, v: 180 });
  const serverOf = (uplink: number) => ({ p: [0, 0, 600, 0], t0: TAP + uplink, v: 180 });
  /** 옛 방식: 응답 순간의 위치 차이(예측 − 서버)를 SEG_BLEND_MS 에 걸쳐 0 으로 줄일 때 1ms 동안 +x 로 나아간 거리의 최솟값 */
  const minStepWhenPulled = (uplink: number, answerAt: number): number => {
    const server = serverOf(uplink);
    const off = positionAt(predOf(), answerAt).x - positionAt(server, answerAt).x;
    let min = Infinity;
    for (let ms = 0; ms < SEG_BLEND_MS; ms++) {
      const at = (e: number): number => positionAt(server, answerAt + e).x + off * blendRemaining(e);
      min = Math.min(min, at(ms + 1) - at(ms));
    }
    return min;
  };

  it("원인: 예측은 서버 구간보다 업링크 × 속도만큼 앞서 있고, 그 차이를 150ms 에 당기면 업링크 100ms 초과부터 뒤로 걷는다", () => {
    const answerAt = TAP + 150 + 58; // 업링크 150 + 다운링크 58
    expect(positionAt(predOf(), answerAt).x - positionAt(serverOf(150), answerAt).x).toBeCloseTo(MOVE_SPEED * 0.15, 9); // 0.27 단위 앞
    expect(minStepWhenPulled(150, answerAt)).toBeLessThan(0); // 뒤로 간다
    expect(minStepWhenPulled(78, TAP + 156)).toBeGreaterThan(0); // 결정 0059 가 잰 왕복 155ms(업링크 78ms): 뒤로 가지는 않지만
    expect(minStepWhenPulled(78, TAP + 156)).toBeLessThan((MOVE_SPEED / 1000) * 0.25); // 걷는 속도의 4분의 1 아래로 멈칫한다
  });

  it("고침: 응답이 오면 출발 시각 차이를 앞섬으로 넘겨 서버 구간을 (서버 시각 + 앞섬)으로 그린다 — 그리던 예측 위치와 정확히 이어진다", () => {
    const own = createOwnMoves(0);
    expect(own.lead()).toBe(0);
    const pred = predOf(own.lead());
    own.sent(pred);
    const server = serverOf(150);
    const answerAt = TAP + 208;
    const before = positionAt(own.effective(undefined)!, answerAt + own.lead());
    expect(own.observe(1, server)).toBe("answered");
    expect(own.lead()).toBe(150);
    const after = positionAt(own.effective(server)!, answerAt + own.lead());
    expect(after.x).toBeCloseTo(before.x, 9);
    expect(after.z).toBeCloseTo(before.z, 9);
    // 서버 위치의 진실은 그대로다: 서버 시각의 위치는 150ms 뒤처져 있고 끝점은 같다
    expect(positionAt(server, answerAt).x).toBeCloseTo(before.x - MOVE_SPEED * 0.15, 9);
    expect(positionAt(server, segmentEndsAt(server))).toEqual({ x: 6, z: 0 });
  });

  it("걷는 중 다시 탭: 예측이 (탭 시각 + 앞섬)에 출발하므로 다음 응답의 앞섬은 그 탭의 업링크가 된다(쌓이지 않는다)", () => {
    const own = createOwnMoves(0);
    own.sent(predOf(0));
    own.observe(1, serverOf(150));
    expect(own.lead()).toBe(150);
    own.sent({ p: [100, 0, 600, 0], t0: 2000 + own.lead(), v: 180 }); // 둘째 탭(서버 시각 2000)의 예측
    expect(own.observe(2, { p: [95, 0, 600, 0], t0: 2000 + 120, v: 180 })).toBe("answered"); // 이번에는 120ms 걸렸다
    expect(own.lead()).toBe(120);
  });

  it("앞섬은 0 ~ OWN_LEAD_MAX_MS 로 자른다", () => {
    const slow = createOwnMoves(0);
    slow.sent(predOf(0));
    slow.observe(1, serverOf(OWN_LEAD_MAX_MS + 400));
    expect(slow.lead()).toBe(OWN_LEAD_MAX_MS);
    const early = createOwnMoves(0);
    early.sent(predOf(0));
    early.observe(1, serverOf(-40)); // 시계 추정이 서버보다 앞선 경우
    expect(early.lead()).toBe(0);
  });

  it("끝점이 다른 서버 구간·내가 보내지 않은 이동·응답 없음(expire)은 앞섬을 바꾸지 않는다", () => {
    const own = createOwnMoves(0);
    own.sent(predOf(0));
    own.observe(1, serverOf(150));
    expect(own.observe(2, { p: [0, 0, 0, 300], t0: 5000, v: 180 })).toBeNull(); // 서버가 걷게 한 이동
    expect(own.lead()).toBe(150);
    own.sent({ p: [0, 0, 300, 0], t0: 6000 + 150, v: 180 });
    expect(own.observe(3, { p: [0, 0, 0, 500], t0: 6100, v: 180 })).toBe("answered"); // 대기는 끝났지만 끝점이 다르다
    expect(own.lead()).toBe(150);
    own.sent({ p: [0, 0, 300, 0], t0: 7000 + 150, v: 180 });
    expect(own.expire().cleared).toBe(true);
    expect(own.lead()).toBe(150);
  });

  it("settle: 예측 중이 아니고 서버 구간이 서버 시각으로도 끝났을 때만 앞섬을 0 으로 되돌린다, reset 은 바로 0", () => {
    const own = createOwnMoves(0);
    own.sent(predOf(0));
    const server = serverOf(150);
    own.observe(1, server);
    const end = segmentEndsAt(server);
    own.settle(end - 1, server); // 서버 시각으로는 아직 걷는 중
    expect(own.lead()).toBe(150);
    own.sent({ p: [600, 0, 0, 0], t0: end + 150, v: 180 });
    own.settle(end + 5000, server); // 예측 중에는 건드리지 않는다
    expect(own.lead()).toBe(150);
    expect(own.expire().cleared).toBe(true);
    own.settle(end, server);
    expect(own.lead()).toBe(0);

    const again = createOwnMoves(0);
    again.sent(predOf(0));
    again.observe(1, server);
    again.settle(end - 1, undefined); // 서버 구간이 없으면 0
    expect(again.lead()).toBe(0);
    again.sent(predOf(0));
    again.observe(2, server);
    expect(again.lead()).toBe(150);
    again.reset(2);
    expect(again.lead()).toBe(0);
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

  it("expire: 대기가 있으면 cleared 와 함께 예측·대기를 비운다, 없으면 cleared 거짓", () => {
    const own = createOwnMoves(0);
    expect(own.expire()).toEqual({ cleared: false, silent: false });
    own.sent(predA);
    expect(own.expire()).toEqual({ cleared: true, silent: false });
    expect(own.pending()).toBe(0);
    expect(own.effective(respB)).toBe(respB);
    expect(own.expire()).toEqual({ cleared: false, silent: false });
  });

  it("GR-WR-01: 둘째 탭이 서버에서 버려지고 목적지가 다르면 응답을 들었으므로 expire 는 silent 이고 예측이 비워진다", () => {
    const own = createOwnMoves(0);
    own.sent(predA);
    own.sent(predB);
    // 서버는 첫 탭만 적용: seq +1, 구간은 첫 목적지
    expect(own.observe(1, respA)).toBeNull();
    expect(own.effective(respA)).toBe(predB); // 유령 예측이 남아 있다
    expect(own.expire()).toEqual({ cleared: true, silent: true });
    expect(own.pending()).toBe(0);
    expect(own.effective(respA)).toBe(respA);
  });

  it("GR-WR-01: 응답이 하나도 없으면 expire 는 silent 가 아니다(진짜 네트워크 문제)", () => {
    const own = createOwnMoves(0);
    own.sent(predA);
    own.sent(predB);
    expect(own.observe(0, respA)).toBeNull();
    expect(own.expire()).toEqual({ cleared: true, silent: false });
  });

  it("GR-WR-01: 새 탭을 보내면 응답을 들었다는 기억이 지워진다", () => {
    const own = createOwnMoves(0);
    own.sent(predA);
    own.sent(predB);
    own.observe(1, respA);
    own.sent(predB);
    expect(own.expire()).toEqual({ cleared: true, silent: false });
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
