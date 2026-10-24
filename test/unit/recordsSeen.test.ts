import { describe, expect, it } from "vitest";
import { RECORDS_SEEN_PREFIX, loadSeenCount, saveSeenCount, unseenCount } from "../../src/net/recordsSeen";
import { MemoryStorage } from "../helpers/memoryStorage";

// 본 기록 개수 폰 메모리(03-11, 가정 A4). 개수 하나만 다루고, 저장된 값은 믿지 않는다(T-03-33).

describe("loadSeenCount / saveSeenCount", () => {
  it("저장이 없으면 0, 저장한 값을 읽는다", () => {
    const s = new MemoryStorage();
    expect(loadSeenCount("0042", s)).toBe(0);
    saveSeenCount("0042", 3, s);
    expect(loadSeenCount("0042", s)).toBe(3);
    expect(s.getItem(`${RECORDS_SEEN_PREFIX}0042`)).toBe("3");
  });

  it("방 코드마다 따로다", () => {
    const s = new MemoryStorage();
    saveSeenCount("0042", 2, s);
    saveSeenCount("0043", 5, s);
    expect([loadSeenCount("0042", s), loadSeenCount("0043", s), loadSeenCount("0044", s)]).toEqual([2, 5, 0]);
  });

  it("음수·소수·숫자가 아닌 값·빈 문자열은 0 으로 읽는다", () => {
    const s = new MemoryStorage();
    const read = (raw: string) => {
      s.setItem(`${RECORDS_SEEN_PREFIX}0042`, raw);
      return loadSeenCount("0042", s);
    };
    expect(["-1", "1.5", "abc", "", " 2", "1e3", "NaN", "99999999999999999999"].map(read)).toEqual([0, 0, 0, 0, 0, 0, 0, 0]);
  });

  it("음수·소수를 저장하려 해도 0 이상 정수로만 남는다", () => {
    const s = new MemoryStorage();
    saveSeenCount("0042", -4, s);
    expect(s.getItem(`${RECORDS_SEEN_PREFIX}0042`)).toBe("0");
    saveSeenCount("0042", 1.5, s);
    expect(s.getItem(`${RECORDS_SEEN_PREFIX}0042`)).toBe("0");
  });

  it("저장소가 예외를 던지면 메모리로 대신해 같은 세션 안에서는 읽힌다", () => {
    const broken = {
      getItem: () => {
        throw new Error("denied");
      },
      setItem: () => {
        throw new Error("denied");
      },
      removeItem: () => {
        throw new Error("denied");
      },
    };
    expect(loadSeenCount("9001", broken)).toBe(0);
    saveSeenCount("9001", 4, broken);
    expect(loadSeenCount("9001", broken)).toBe(4);
  });
});

describe("unseenCount", () => {
  it("(3, 1) = 2, (1, 3) = 0, (0, 0) = 0", () => {
    expect([unseenCount(3, 1), unseenCount(1, 3), unseenCount(0, 0)]).toEqual([2, 0, 0]);
  });
});
