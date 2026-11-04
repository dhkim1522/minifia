// 핀 조명 계획(결정 0066-6, UI-SPEC F): 공개 값(day.turn·day.points)에서 "무엇을 비출지"(pinOf)와 시각에 따른 위치(pinAt)를 순수하게 낸다.
import { describe, expect, it } from "vitest";
import { PICK_GAP_MS } from "../../shared/game/phases";
import type { DayView, PhaseId, PublicPlayer, RoomView } from "../../shared/protocol";
import { easeInOut, PIN_DIM, PIN_OFF_MS, PIN_ON_MS, PIN_STRENGTH, pinAt, pinLevel, pinLights, pinOf } from "../../src/world/pinPlan";

function viewOf(phase: PhaseId, day: Partial<DayView> = {}, count = 4): RoomView {
  const players: PublicPlayer[] = Array.from({ length: count }, (_, seat) => ({ seat, nickname: `p${seat}`, connected: true, isHost: seat === 0 }));
  return {
    code: "0042",
    phase,
    phaseEndsAt: null,
    phaseDurationMs: null,
    serverNow: 0,
    minPlayers: 4,
    maxPlayers: 8,
    players,
    me: { seat: 0, isHost: false },
    day: { n: 1, roles: [], ...day },
  };
}

const ORDER = [0, 1, 2, 3];

describe("상수", () => {
  it("O-14: 켜진 세기 0.9, 실내등 x0.6, 켜짐 180ms, 꺼짐 420ms, 이동은 서버 사이 시간과 같은 상수", () => {
    expect(PIN_STRENGTH).toBe(0.9);
    expect(PIN_DIM).toBe(0.6);
    expect(PIN_ON_MS).toBe(180);
    expect(PIN_OFF_MS).toBe(420);
    const done = pinOf(viewOf("nomination", { turn: { order: ORDER, i: 0, doneAt: 1000 }, points: [{ seat: 0, target: 2 }] }));
    expect(done).toMatchObject({ mode: "slide", durationMs: PICK_GAP_MS });
  });
});

describe("pinOf (공개 값만)", () => {
  it("모이는 중(i -1)은 핀 없음", () => {
    expect(pinOf(viewOf("nomination", { turn: { order: ORDER, i: -1 } }))).toBeNull();
  });

  it("차례 중(미확정)은 order[i] 에게 켜진다", () => {
    expect(pinOf(viewOf("nomination", { turn: { order: ORDER, i: 2, endsAt: 9000 } }))).toEqual({ mode: "turn", seat: 2 });
  });

  it("확정 뒤 사이: 지목받은 사람으로 PICK_GAP_MS 동안 미끄러진다", () => {
    const v = viewOf("nomination", { turn: { order: ORDER, i: 1, endsAt: 9000, doneAt: 5000 }, points: [{ seat: 0, target: 3 }, { seat: 1, target: 3 }] });
    expect(pinOf(v)).toEqual({ mode: "slide", from: 1, to: 3, startAt: 5000, durationMs: PICK_GAP_MS });
  });

  it("기권(skip)은 이동 없이 핀 없음", () => {
    const v = viewOf("nomination", { turn: { order: ORDER, i: 1, endsAt: 9000, doneAt: 9000, skip: true }, points: [] });
    expect(pinOf(v)).toBeNull();
  });

  it("끝 알림(i >= 길이)은 핀 없음 — 선두·과반을 비추지 않는다", () => {
    const v = viewOf("nomination", { turn: { order: ORDER, i: 4 }, points: [{ seat: 0, target: 2 }, { seat: 1, target: 2 }, { seat: 3, target: 2 }] });
    expect(pinOf(v)).toBeNull();
  });

  it("지목이 아닌 단계, 차례 정보가 없는 지목은 핀 없음", () => {
    expect(pinOf(viewOf("discussion"))).toBeNull();
    expect(pinOf(viewOf("verdict", { candidate: 2 }))).toBeNull();
    expect(pinOf(viewOf("nomination"))).toBeNull();
  });

  it("입력 방어: 확정인데 지목 줄이 없거나 i 가 범위 밖·정수가 아니면 null", () => {
    expect(pinOf(viewOf("nomination", { turn: { order: ORDER, i: 1, doneAt: 5000 }, points: [{ seat: 0, target: 3 }] }))).toBeNull();
    expect(pinOf(viewOf("nomination", { turn: { order: ORDER, i: 1, doneAt: 5000 } }))).toBeNull();
    expect(pinOf(viewOf("nomination", { turn: { order: ORDER, i: 9 } }))).toBeNull();
    expect(pinOf(viewOf("nomination", { turn: { order: ORDER, i: -5 } }))).toBeNull();
    expect(pinOf(viewOf("nomination", { turn: { order: ORDER, i: 0.5 } }))).toBeNull();
    expect(pinOf(viewOf("nomination", { turn: { order: [], i: 0 } }))).toBeNull();
  });
});

describe("easeInOut", () => {
  it("0→0, 0.5→0.5, 1→1, 단조, 양 끝에서 선형보다 느리다", () => {
    expect(easeInOut(0)).toBe(0);
    expect(easeInOut(0.5)).toBeCloseTo(0.5, 9);
    expect(easeInOut(1)).toBe(1);
    let prev = -1;
    for (let i = 0; i <= 100; i++) {
      const v = easeInOut(i / 100);
      expect(v).toBeGreaterThanOrEqual(prev);
      prev = v;
    }
    expect(easeInOut(0.1)).toBeLessThan(0.1);
    expect(easeInOut(0.9)).toBeGreaterThan(0.9);
  });
});

describe("pinAt", () => {
  it("null 은 꺼짐", () => {
    expect(pinAt(null, 1000, false)).toEqual({ on: false, t: 0, moving: false });
  });

  it("turn 은 켜짐과 좌석", () => {
    expect(pinAt({ mode: "turn", seat: 2 }, 1000, false)).toEqual({ on: true, seat: 2, t: 0, moving: false });
  });

  it("slide: 시작 전 t 0 · 중간 0.5 · 끝 1, 이동 중에만 moving, 좌석은 t 0.5 부터 to", () => {
    const d = { mode: "slide", from: 1, to: 3, startAt: 5000, durationMs: 900 } as const;
    const a = pinAt(d, 4000, false);
    expect(a).toMatchObject({ on: true, from: 1, to: 3, t: 0, seat: 1, moving: false });
    const b = pinAt(d, 5450, false);
    expect(b.t).toBeCloseTo(0.5, 9);
    expect(b).toMatchObject({ moving: true, seat: 3 });
    const early = pinAt(d, 5200, false);
    expect(early.t).toBeGreaterThan(0);
    expect(early.t).toBeLessThan(0.2);
    expect(early).toMatchObject({ moving: true, seat: 1 });
    const c = pinAt(d, 5900, false);
    expect(c).toMatchObject({ t: 1, moving: false, seat: 3 });
    expect(pinAt(d, 9999, false).t).toBe(1);
  });

  it("모션 줄이기: 이동 없이 곧바로 도착", () => {
    const d = { mode: "slide", from: 1, to: 3, startAt: 5000, durationMs: 900 } as const;
    expect(pinAt(d, 4000, true)).toMatchObject({ t: 1, moving: false, seat: 3 });
    expect(pinAt(d, 5100, true)).toMatchObject({ t: 1, moving: false, seat: 3 });
  });
});

describe("pinLevel / pinLights", () => {
  it("켜질 때 180ms, 꺼질 때 420ms 로 접근한다", () => {
    expect(pinLevel(0, true, 90, false)).toBeCloseTo(0.5, 9);
    expect(pinLevel(0, true, 180, false)).toBe(1);
    expect(pinLevel(0.9, true, 500, false)).toBe(1);
    expect(pinLevel(1, false, 210, false)).toBeCloseTo(0.5, 9);
    expect(pinLevel(1, false, 420, false)).toBe(0);
    expect(pinLevel(0.1, false, 900, false)).toBe(0);
  });

  it("모션 줄이기는 계단식", () => {
    expect(pinLevel(0.3, true, 1, true)).toBe(1);
    expect(pinLevel(0.7, false, 1, true)).toBe(0);
  });

  it("빛 값: 켜진 세기 0.9 · 실내등 0.6, 꺼지면 0 · 1", () => {
    expect(pinLights(1)).toEqual({ strength: 0.9, dim: 0.6 });
    expect(pinLights(0)).toEqual({ strength: 0, dim: 1 });
    const half = pinLights(0.5);
    expect(half.strength).toBeCloseTo(0.45, 9);
    expect(half.dim).toBeCloseTo(0.8, 9);
  });
});
