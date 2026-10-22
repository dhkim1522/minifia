import { describe, expect, it } from "vitest";
import { estimateOffset, remainingMs } from "../../src/net/clock";

describe("estimateOffset", () => {
  it("표본 하나로 serverNow + rtt/2 - t1 을 계산한다", () => {
    expect(estimateOffset([{ t0: 1000, t1: 1100, serverNow: 5050 }])).toBe(4000);
  });

  it("왕복 시간이 가장 짧은 표본을 고른다", () => {
    const offset = estimateOffset([
      { t0: 1000, t1: 1300, serverNow: 9999 },
      { t0: 2000, t1: 2020, serverNow: 6010 },
      { t0: 3000, t1: 3100, serverNow: 1 },
    ]);
    // rtt 20 표본: 6010 + 10 - 2020
    expect(offset).toBe(4000);
  });

  it("표본이 없으면 0 이다", () => {
    expect(estimateOffset([])).toBe(0);
  });
});

describe("remainingMs", () => {
  it("마감까지 남은 시간을 서버 시각 기준으로 계산한다", () => {
    expect(remainingMs(10_000, 500, 9_000)).toBe(500);
  });

  it("마감이 지났으면 0 아래로 내려가지 않는다", () => {
    expect(remainingMs(10_000, 0, 12_000)).toBe(0);
  });

  it("localNow 를 생략하면 현재 시각을 쓴다", () => {
    const deadline = Date.now() + 60_000;
    const left = remainingMs(deadline, 0);
    expect(left).toBeGreaterThan(59_000);
    expect(left).toBeLessThanOrEqual(60_000);
  });
});
