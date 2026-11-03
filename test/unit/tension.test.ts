// 09-06: 시민 편 긴장 큐 스케줄러 (NIGHT-10, UI-SPEC A3 ①, L3).
// 큐 시각은 난수 함수만으로 정해지고, 타이머 함수는 주입한다 — 서버 프레임·시각과 이어지지 않는다.
import { describe, expect, it } from "vitest";
import {
  TENSION_BEAT_MS,
  TENSION_CUE_MAX,
  TENSION_CUE_MIN,
  TENSION_CUE_PEAK,
  TENSION_GAP_MAX_MS,
  TENSION_GAP_MIN_MS,
  TENSION_REDUCED_OPACITY,
  TENSION_WINDOW_MS,
  planTensionCues,
  startTension,
} from "../../src/world/tension";

/** 시드 고정 선형 합동 난수 [0,1) */
function lcg(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function gaps(cues: readonly number[]): number[] {
  return cues.slice(1).map((c, i) => c - cues[i]!);
}

describe("planTensionCues", () => {
  it("rng 가 늘 0 이면 첫 큐 5000, 간격 4000 의 2개를 만든다", () => {
    const cues = planTensionCues(() => 0);
    expect(cues).toEqual([5000, 9000]);
  });

  it("rng 가 늘 0.999 여도 개수 2~4, 간격 9000 이하, 모든 큐가 창 안이다", () => {
    const cues = planTensionCues(() => 0.999);
    expect(cues.length).toBeGreaterThanOrEqual(TENSION_CUE_MIN);
    expect(cues.length).toBeLessThanOrEqual(TENSION_CUE_MAX);
    expect(cues[0]!).toBeLessThan(9000);
    for (const g of gaps(cues)) expect(g).toBeLessThanOrEqual(TENSION_GAP_MAX_MS);
    for (const c of cues) expect(c).toBeLessThan(TENSION_WINDOW_MS);
  });

  it("시드 1000개에서 큐 규칙을 지킨다", () => {
    for (let seed = 1; seed <= 1000; seed += 1) {
      const cues = planTensionCues(lcg(seed));
      expect(cues.length).toBeGreaterThanOrEqual(TENSION_CUE_MIN);
      expect(cues.length).toBeLessThanOrEqual(TENSION_CUE_MAX);
      expect(cues[0]!).toBeGreaterThanOrEqual(5000);
      for (const g of gaps(cues)) {
        expect(g).toBeGreaterThanOrEqual(TENSION_GAP_MIN_MS);
        expect(g).toBeLessThanOrEqual(TENSION_GAP_MAX_MS);
      }
      for (const c of cues) expect(c).toBeLessThan(TENSION_WINDOW_MS);
    }
  });

  it("같은 난수 열이면 같은 결과다", () => {
    expect(planTensionCues(lcg(42))).toEqual(planTensionCues(lcg(42)));
  });

  it("상수: 맥박 박자 1300ms, 큐 최대 불투명도 0.95, 모션 줄이기 0.4", () => {
    expect(TENSION_BEAT_MS).toBe(1300);
    expect(TENSION_CUE_PEAK).toBe(0.95);
    expect(TENSION_REDUCED_OPACITY).toBe(0.4);
  });
});

describe("startTension", () => {
  function fakeTimers() {
    const pending = new Map<number, { fn: () => void; ms: number }>();
    let next = 1;
    const cleared: number[] = [];
    return {
      pending,
      cleared,
      setTimer: (fn: () => void, ms: number): unknown => {
        const h = next;
        next += 1;
        pending.set(h, { fn, ms });
        return h;
      },
      clearTimer: (h: unknown): void => {
        cleared.push(h as number);
        pending.delete(h as number);
      },
      fireAll: () => {
        for (const [h, t] of [...pending]) {
          pending.delete(h);
          t.fn();
        }
      },
    };
  }

  it("큐마다 타이머 하나를 예약하고 울리면 onCue(그 큐 ms) 를 부른다", () => {
    const t = fakeTimers();
    const got: number[] = [];
    const h = startTension({
      onCue: (ms) => got.push(ms),
      rng: lcg(7),
      setTimer: t.setTimer,
      clearTimer: t.clearTimer,
    });
    expect(t.pending.size).toBe(h.cues.length);
    expect([...t.pending.values()].map((p) => p.ms)).toEqual([...h.cues]);
    t.fireAll();
    expect(got).toEqual([...h.cues]);
  });

  it("stop() 은 남은 타이머를 모두 지우고 이후 onCue 가 없다", () => {
    const t = fakeTimers();
    const got: number[] = [];
    const h = startTension({
      onCue: (ms) => got.push(ms),
      rng: () => 0,
      setTimer: t.setTimer,
      clearTimer: t.clearTimer,
    });
    const n = t.pending.size;
    h.stop();
    expect(t.cleared.length).toBe(n);
    expect(t.pending.size).toBe(0);
    t.fireAll();
    expect(got).toEqual([]);
  });

  it("reducedMotion 이면 예약도 onCue 도 없다", () => {
    const t = fakeTimers();
    const got: number[] = [];
    const h = startTension({
      onCue: (ms) => got.push(ms),
      rng: () => 0,
      setTimer: t.setTimer,
      clearTimer: t.clearTimer,
      reducedMotion: true,
    });
    expect(t.pending.size).toBe(0);
    expect(h.cues).toEqual([]);
    t.fireAll();
    expect(got).toEqual([]);
    h.stop();
    expect(t.cleared.length).toBe(0);
  });
});
