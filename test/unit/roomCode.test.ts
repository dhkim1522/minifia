import { describe, expect, it } from "vitest";
import { generateRoomCode, isRoomCode } from "../../shared/roomCode";

describe("generateRoomCode", () => {
  it("앞자리 0 을 허용하는 4자리 숫자 코드를 만든다", () => {
    const seq = [0, 0, 0, 7];
    let i = 0;
    expect(generateRoomCode(() => seq[i++]!)).toBe("0007");
  });

  it("randInt 는 항상 인자 10 으로 네 번 불린다", () => {
    const args: number[] = [];
    generateRoomCode((n) => {
      args.push(n);
      return 3;
    });
    expect(args.join(",")).toBe("10,10,10,10");
  });
});

describe("isRoomCode", () => {
  it("4자리 숫자(앞자리 0 포함)만 참이다", () => {
    expect(isRoomCode("0123")).toBe(true);
    expect(isRoomCode("9999")).toBe(true);
  });

  it("3자리·문자 섞임·5자리·빈 문자열은 거짓이다", () => {
    expect(isRoomCode("123")).toBe(false);
    expect(isRoomCode("12a4")).toBe(false);
    expect(isRoomCode("12345")).toBe(false);
    expect(isRoomCode("")).toBe(false);
  });
});
