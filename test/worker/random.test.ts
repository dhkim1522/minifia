import { describe, expect, it } from "vitest";
import { cryptoRandInt, randomToken } from "../../worker/random";

describe("cryptoRandInt", () => {
  it("[0, n) 범위의 정수만 돌려주고 모든 값이 나온다", () => {
    const seen = new Set<number>();
    for (let i = 0; i < 2000; i++) {
      const v = cryptoRandInt(10);
      expect(Number.isInteger(v)).toBe(true);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(10);
      seen.add(v);
    }
    expect(seen.size).toBe(10);
  });

  it("n 이 1 이면 항상 0", () => {
    expect(cryptoRandInt(1)).toBe(0);
  });

  it("정수가 아니거나 1 미만이면 던진다", () => {
    expect(() => cryptoRandInt(0)).toThrow(RangeError);
    expect(() => cryptoRandInt(1.5)).toThrow(RangeError);
  });
});

describe("randomToken", () => {
  it("base64url 43자(패딩 없음)이고 매번 다르다", () => {
    const a = randomToken();
    const b = randomToken();
    expect(a).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(a).not.toBe(b);
  });
});
