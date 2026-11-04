import { describe, expect, it } from "vitest";
import { URGENT_MS, WARN_MS, countdown, formatMmSs, timerTone } from "../../src/net/countdown";

// 역할 확인 15초: 서버 마감 20000, 시작 5000. 서버 시각 = 로컬 시각 + 오프셋.
const ENDS = 20_000;
const DUR = 15_000;

describe("countdown", () => {
  it("시작 시점에는 15초 남고 막대가 가득 찬다", () => {
    expect(countdown(ENDS, DUR, 0, 5_000)).toEqual({ remainingMs: 15_000, seconds: 15, urgent: false, ratio: 1 });
  });

  it("초는 올림이다: 14.001초 남았으면 15초", () => {
    expect(countdown(ENDS, DUR, 0, 5_999)).toMatchObject({ remainingMs: 14_001, seconds: 15 });
  });

  it("5초 이하로 남으면 urgent 다(4999ms → 5초, urgent)", () => {
    expect(countdown(ENDS, DUR, 0, 15_001)).toMatchObject({ remainingMs: 4_999, seconds: 5, urgent: true });
  });

  it("정확히 5000ms 남았을 때도 urgent 다(경계 포함)", () => {
    expect(countdown(ENDS, DUR, 0, 15_000)).toMatchObject({ remainingMs: URGENT_MS, seconds: 5, urgent: true });
  });

  it("5001ms 남았으면 아직 urgent 가 아니다", () => {
    expect(countdown(ENDS, DUR, 0, 14_999)).toMatchObject({ remainingMs: 5_001, urgent: false });
  });

  it("마감 정각에는 0초, 빈 막대, urgent 아님", () => {
    expect(countdown(ENDS, DUR, 0, 20_000)).toEqual({ remainingMs: 0, seconds: 0, urgent: false, ratio: 0 });
  });

  it("마감이 지나도 음수가 되지 않는다", () => {
    expect(countdown(ENDS, DUR, 0, 25_000)).toEqual({ remainingMs: 0, seconds: 0, urgent: false, ratio: 0 });
  });

  it("양수 오프셋: 서버 시각이 로컬보다 1초 앞서면 1초 덜 남는다", () => {
    expect(countdown(ENDS, DUR, 1_000, 5_000)).toMatchObject({ remainingMs: 14_000, seconds: 14 });
  });

  it("음수 오프셋: 서버 시각이 로컬보다 느리면 더 남는다", () => {
    expect(countdown(ENDS, DUR, -1_000, 5_000)).toMatchObject({ remainingMs: 16_000 });
  });

  it("남은 시간이 단계 길이보다 크면 ratio 는 1 로 자른다(시계 어긋남 방어)", () => {
    expect(countdown(ENDS, DUR, 0, 0).ratio).toBe(1);
  });

  it("durationMs 가 0 이하이면 ratio 는 0 이다(0 으로 나누지 않는다)", () => {
    expect(countdown(ENDS, 0, 0, 10_000).ratio).toBe(0);
  });

  it("막대 비율은 남은 시간 ÷ 단계 길이다", () => {
    expect(countdown(ENDS, DUR, 0, 12_500).ratio).toBeCloseTo(0.5, 5);
  });
});

describe("formatMmSs", () => {
  it.each([
    [15, "0:15"],
    [5, "0:05"],
    [0, "0:00"],
    [59, "0:59"],
    [60, "1:00"],
    [75, "1:15"],
  ])("%i초 → %s", (seconds, text) => {
    expect(formatMmSs(seconds)).toBe(text);
  });
});

describe("timerTone (feedback-4, 모든 단계 타이머가 함께 쓰는 색 규칙)", () => {
  it("문턱 값: 경고 10초, 임박 5초", () => {
    expect(WARN_MS).toBe(10_000);
    expect(URGENT_MS).toBe(5_000);
  });

  it.each([
    [11_000, "calm"],
    [10_001, "calm"],
    [10_000, "warn"],
    [5_001, "warn"],
    [5_000, "urgent"],
    [1, "urgent"],
    [0, "calm"],
  ])("60초 단계에서 남은 %i ms → %s", (remaining, tone) => {
    expect(timerTone(remaining, 60_000)).toBe(tone);
  });

  it("8초 단계(전체가 10초 이하)는 경고 없이 바로 임박: 6000 → calm, 5000 → urgent", () => {
    expect(timerTone(6_000, 8_000)).toBe("calm");
    expect(timerTone(5_000, 8_000)).toBe("urgent");
  });

  it("10초 단계는 정확히 문턱 길이라 경고를 건너뛴다", () => {
    expect(timerTone(10_000, 10_000)).toBe("calm");
    expect(timerTone(5_000, 10_000)).toBe("urgent");
  });

  it("5초 단계(전체가 5초 이하)는 어느 색도 없다(v1.0 아침 calm 규칙 일반화)", () => {
    expect(timerTone(5_000, 5_000)).toBe("calm");
    expect(timerTone(3_000, 5_000)).toBe("calm");
  });

  it("12초 아침: 10000 → warn, 4000 → urgent", () => {
    expect(timerTone(10_000, 12_000)).toBe("warn");
    expect(timerTone(4_000, 12_000)).toBe("urgent");
  });

  it("countdown().urgent 는 기존 규칙 그대로다", () => {
    expect(countdown(ENDS, DUR, 0, 15_000).urgent).toBe(true);
    expect(countdown(ENDS, DUR, 0, 14_999).urgent).toBe(false);
  });
});
