import { describe, expect, it } from "vitest";
import { MAX_CODE_ATTEMPTS, allocateRoom } from "../../worker/allocate";
import type { RoomCreator } from "../../worker/allocate";

function sequence(values: number[]): (n: number) => number {
  let i = 0;
  return () => values[i++ % values.length]!;
}

describe("allocateRoom", () => {
  it("코드가 이미 쓰이면 다른 코드로 다시 시도해 만든다", async () => {
    const taken = new Set(["1111"]);
    const tried: string[] = [];
    const getRoom = (code: string): RoomCreator => ({
      async createRoom() {
        tried.push(code);
        return taken.has(code) ? { ok: false, error: "CODE_TAKEN" } : { ok: true, token: "t".repeat(43), seat: 0 };
      },
    });
    // 첫 시도 1111(사용 중), 둘째 시도 2222
    const result = await allocateRoom(getRoom, "민수", sequence([1, 1, 1, 1, 2, 2, 2, 2]), 0);
    expect(tried.join(",")).toBe("1111,2222");
    expect(result.kind).toBe("created");
    if (result.kind === "created") expect(result.code).toBe("2222");
  });

  it("8번 모두 코드가 사용 중이면 exhausted 이고 정확히 8번만 시도한다", async () => {
    let calls = 0;
    const getRoom = (): RoomCreator => ({
      async createRoom() {
        calls += 1;
        return { ok: false, error: "CODE_TAKEN" };
      },
    });
    const result = await allocateRoom(getRoom, "민수", sequence([3]), 0);
    expect(result.kind).toBe("exhausted");
    expect(calls).toBe(MAX_CODE_ATTEMPTS);
    expect(MAX_CODE_ATTEMPTS).toBe(8);
  });

  it("닉네임이 잘못되면 재시도하지 않고 nickname_invalid", async () => {
    let calls = 0;
    const getRoom = (): RoomCreator => ({
      async createRoom() {
        calls += 1;
        return { ok: false, error: "NICKNAME_INVALID" };
      },
    });
    const result = await allocateRoom(getRoom, "", sequence([5]), 0);
    expect(result.kind).toBe("nickname_invalid");
    expect(calls).toBe(1);
  });
});
