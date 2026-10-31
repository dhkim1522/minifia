import { describe, expect, it, vi } from "vitest";
import { FRAME_CAPACITY, FrameRecorder, avgFps, heartbeatVerdict, jankCount, percentile, rafHzGuess, summarizeFrames, thermalRatio } from "../../src/debug/perf/metrics";
import { AUTO_WINDOW_MS, createAutoDegrade } from "../../src/world/runtime";

const frames = (n: number, ms: number): number[] => Array.from({ length: n }, () => ms);

describe("FrameRecorder", () => {
  it("5분 × 60fps 에 여유를 둔 60 × 330 칸 Float32Array 이다", () => {
    const r = new FrameRecorder();
    expect(FRAME_CAPACITY).toBe(60 * 330);
    expect(r.capacity).toBe(19800);
    expect(r.values()).toBeInstanceOf(Float32Array);
    expect(r.length).toBe(0);
  });
  it("push 가 쌓이고 values() 는 쌓인 만큼만 돌려준다", () => {
    const r = new FrameRecorder(8);
    expect(r.push(16.5)).toBe(true);
    expect(r.push(17)).toBe(true);
    expect(r.length).toBe(2);
    expect(Array.from(r.values())).toEqual([16.5, 17]);
  });
  it("넘치면 기록을 멈춘다 — 덮어쓰지 않고 false 를 돌려준다", () => {
    const r = new FrameRecorder(3);
    [1, 2, 3].forEach((v) => expect(r.push(v)).toBe(true));
    expect(r.push(4)).toBe(false);
    expect(r.push(5)).toBe(false);
    expect(r.length).toBe(3);
    expect(Array.from(r.values())).toEqual([1, 2, 3]);
    expect(r.full).toBe(true);
  });
  it("rAF 시각을 넣으면 앞 시각과의 차를 기록한다 (첫 시각은 기준일 뿐)", () => {
    const r = new FrameRecorder(8);
    r.frame(1000);
    r.frame(1016.5);
    r.frame(1033);
    expect(Array.from(r.values())).toEqual([16.5, 16.5]);
  });
  it("clear 는 처음으로 돌린다", () => {
    const r = new FrameRecorder(4);
    r.frame(1);
    r.frame(18);
    r.clear();
    expect(r.length).toBe(0);
    r.frame(100);
    expect(r.length).toBe(0);
  });
});

describe("avgFps·jankCount·percentile", () => {
  it("평균 fps 는 프레임 수 ÷ 경과 초 (순간 fps 의 평균이 아니다)", () => {
    expect(avgFps(frames(60, 1000 / 60))).toBeCloseTo(60, 1);
    // 순간 fps 평균이면 (1000 + 1000/1000·…) 처럼 부풀지만, 프레임 수 ÷ 시간은 한 번 길게 멈춘 것을 그대로 반영한다
    expect(avgFps([10, 10, 980])).toBeCloseTo(3, 5);
    expect(avgFps([])).toBe(0);
  });
  it("끊김은 50ms 를 넘는 델타만 센다 (50 은 아니다)", () => {
    expect(jankCount([10, 51, 50, 80])).toBe(2);
    expect(jankCount([])).toBe(0);
  });
  it("백분위는 정렬된 복사본에서 가까운 순위로 읽는다", () => {
    const sorted = Array.from({ length: 100 }, (_, i) => i + 1);
    expect(percentile(sorted, 0.5)).toBe(50);
    expect(percentile(sorted, 0.95)).toBe(95);
    expect(percentile(sorted, 0.99)).toBe(99);
    expect(percentile(sorted, 1)).toBe(100);
    expect(percentile([], 0.95)).toBe(0);
    expect(percentile([7], 0.95)).toBe(7);
  });
});

describe("rafHzGuess", () => {
  it("중앙값 8.4ms → 120, 16.6 → 60, 33.4 → 30", () => {
    expect(rafHzGuess(8.4)).toEqual({ hz: 120, lowPower: false });
    expect(rafHzGuess(16.6)).toEqual({ hz: 60, lowPower: false });
    expect(rafHzGuess(33.4)).toEqual({ hz: 30, lowPower: true });
  });
  it("90Hz·144Hz 도 가장 가까운 값으로", () => {
    expect(rafHzGuess(11.1).hz).toBe(90);
    expect(rafHzGuess(6.9).hz).toBe(144);
  });
  it("재지 못했으면(0·NaN) 0", () => {
    expect(rafHzGuess(0)).toEqual({ hz: 0, lowPower: false });
    expect(rafHzGuess(Number.NaN)).toEqual({ hz: 0, lowPower: false });
  });
});

describe("thermalRatio", () => {
  it("첫 1분 60fps, 마지막 1분 50fps 면 0.833 이고 열 스로틀을 의심한다", () => {
    const r = thermalRatio(60, 50);
    expect(r.ratio).toBeCloseTo(0.833, 3);
    expect(r.suspect).toBe(true);
  });
  it("0.85 이상이면 의심하지 않는다", () => {
    expect(thermalRatio(60, 51).suspect).toBe(false);
    expect(thermalRatio(60, 60).suspect).toBe(false);
  });
  it("첫 1분 값이 없거나 0 이면 비율을 구하지 않는다", () => {
    expect(thermalRatio(0, 50)).toEqual({ ratio: null, suspect: false });
  });
});

describe("heartbeatVerdict", () => {
  it("running 이 남아 있으면 이전 실행이 도중에 죽었다", () => {
    expect(heartbeatVerdict({ state: "running", at: 1000 })).toBe("crashed");
  });
  it("finished 면 깨끗하게 끝났다", () => {
    expect(heartbeatVerdict({ state: "finished", at: 1000 })).toBe("clean");
  });
  it("저장값이 없으면 처음이다", () => {
    expect(heartbeatVerdict(null)).toBe("first");
  });
});

describe("summarizeFrames", () => {
  it("60fps 120초: 평균·끊김 0·백분위·rAF 60Hz, 열 비율 1", () => {
    const s = summarizeFrames(frames(7200, 1000 / 60));
    expect(s.count).toBe(7200);
    expect(s.seconds).toBeCloseTo(120, 3);
    expect(s.avgFps).toBeCloseTo(60, 1);
    expect(s.jank).toBe(0);
    expect(s.p50).toBeCloseTo(16.67, 1);
    expect(s.p95).toBeCloseTo(16.67, 1);
    expect(s.max).toBeCloseTo(16.67, 1);
    expect(s.rafHz).toBe(60);
    expect(s.lowPowerSuspect).toBe(false);
    expect(s.thermalSuspect).toBe(false);
  });
  it("첫 1분 60fps·마지막 1분 50fps 면 열 스로틀 의심", () => {
    const d = [...frames(3600, 1000 / 60), ...frames(600, 1000 / 55), ...frames(3000, 1000 / 50)];
    const s = summarizeFrames(d);
    expect(s.firstMinuteFps).toBeCloseTo(60, 0);
    expect(s.lastMinuteFps).toBeCloseTo(50, 0);
    expect(s.thermalRatio).toBeCloseTo(0.833, 2);
    expect(s.thermalSuspect).toBe(true);
  });
  it("2분이 안 되면 열 비율을 구하지 않는다", () => {
    const s = summarizeFrames(frames(600, 1000 / 60));
    expect(s.firstMinuteFps).toBeNull();
    expect(s.lastMinuteFps).toBeNull();
    expect(s.thermalRatio).toBeNull();
    expect(s.thermalSuspect).toBe(false);
  });
  it("빈 기록은 0 으로 채운다", () => {
    const s = summarizeFrames([]);
    expect(s.count).toBe(0);
    expect(s.avgFps).toBe(0);
    expect(s.p95).toBe(0);
    expect(s.max).toBe(0);
  });
  it("33ms 주기는 저전력 모드 의심", () => {
    const s = summarizeFrames(frames(300, 33.4));
    expect(s.rafHz).toBe(30);
    expect(s.lowPowerSuspect).toBe(true);
  });
});

describe("createAutoDegrade (제품 런타임의 자동 강등)", () => {
  /** ms 간격 프레임을 totalMs 동안 흘린다 */
  const feed = (g: ReturnType<typeof createAutoDegrade>, perFrameMs: number, totalMs: number): void => {
    for (let t = 0; t < totalMs; t += perFrameMs) g.frame(perFrameMs);
  };
  it("창은 10초다", () => {
    expect(AUTO_WINDOW_MS).toBe(10_000);
  });
  it("10초 평균 44fps 면 한 단계씩 1 → 2 → 3 으로 내리고 그 뒤로는 그대로다", () => {
    const setBudget = vi.fn();
    const g = createAutoDegrade({ enabled: true, step: 0, setBudget });
    feed(g, 1000 / 44, AUTO_WINDOW_MS + 100);
    expect(setBudget.mock.calls).toEqual([[1]]);
    feed(g, 1000 / 44, AUTO_WINDOW_MS + 100);
    expect(setBudget.mock.calls).toEqual([[1], [2]]);
    feed(g, 1000 / 44, AUTO_WINDOW_MS + 100);
    expect(setBudget.mock.calls).toEqual([[1], [2], [3]]);
    feed(g, 1000 / 44, 3 * AUTO_WINDOW_MS);
    expect(setBudget).toHaveBeenCalledTimes(3);
    expect(g.step()).toBe(3);
  });
  it("10초가 차기 전에는 내리지 않는다", () => {
    const setBudget = vi.fn();
    const g = createAutoDegrade({ enabled: true, step: 0, setBudget });
    feed(g, 1000 / 30, AUTO_WINDOW_MS - 500);
    expect(setBudget).not.toHaveBeenCalled();
  });
  it("50fps 면 바뀌지 않는다", () => {
    const setBudget = vi.fn();
    const g = createAutoDegrade({ enabled: true, step: 0, setBudget });
    feed(g, 1000 / 50, 5 * AUTO_WINDOW_MS);
    expect(setBudget).not.toHaveBeenCalled();
  });
  it("꺼져 있으면(스파이크) 느려도 바뀌지 않는다", () => {
    const setBudget = vi.fn();
    const g = createAutoDegrade({ enabled: false, step: 0, setBudget });
    feed(g, 1000 / 20, 5 * AUTO_WINDOW_MS);
    expect(setBudget).not.toHaveBeenCalled();
  });
  it("한 번 내린 뒤 빨라져도 되돌리지 않는다", () => {
    const setBudget = vi.fn();
    const g = createAutoDegrade({ enabled: true, step: 0, setBudget });
    feed(g, 1000 / 40, AUTO_WINDOW_MS + 100);
    feed(g, 1000 / 60, 5 * AUTO_WINDOW_MS);
    expect(setBudget.mock.calls).toEqual([[1]]);
  });
  it("4단계 이상에서 시작하면 자동으로 올리지도 내리지도 않는다 (사람 결정)", () => {
    const setBudget = vi.fn();
    const g = createAutoDegrade({ enabled: true, step: 4, setBudget });
    feed(g, 1000 / 20, 3 * AUTO_WINDOW_MS);
    expect(setBudget).not.toHaveBeenCalled();
  });
  it("탭이 숨었다 돌아온 큰 델타(0.5초 초과)는 평균에 넣지 않는다", () => {
    const setBudget = vi.fn();
    const g = createAutoDegrade({ enabled: true, step: 0, setBudget });
    feed(g, 1000 / 60, 4000);
    g.frame(60_000);
    feed(g, 1000 / 60, 7000);
    expect(setBudget).not.toHaveBeenCalled();
  });
});
