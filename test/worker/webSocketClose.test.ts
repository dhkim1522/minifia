import { env } from "cloudflare:workers";
import { runInDurableObject } from "cloudflare:test";
import { describe, expect, it, vi } from "vitest";
import { createRoom } from "./helpers";

// 06-23 (G-06-6 선택 위생): 클라이언트가 보낸 close 에 서버가 맞받아치는 close 를 보낸다.
// 배포에서의 효과는 배포 없이 검증할 수 없다(진단 문서) — 여기서는 호출 규칙만 고정한다.

interface FakeSocket {
  deserializeAttachment: () => null;
  close: ReturnType<typeof vi.fn>;
}

const fakeSocket = (close: FakeSocket["close"] = vi.fn()): FakeSocket => ({ deserializeAttachment: () => null, close });

async function closeWith(code: string, ws: FakeSocket, closeCode: number, reason: string): Promise<void> {
  await runInDurableObject(env.ROOM.getByName(code), async (instance) => {
    await instance.webSocketClose(ws as unknown as WebSocket, closeCode, reason, true);
  });
}

describe("webSocketClose 맞받아치기", () => {
  it("연결 끊김 처리를 먼저 하고, 예약 코드가 아니면 받은 code·reason 으로 ws.close 를 한 번 부른다", async () => {
    const { code } = await createRoom("방장");
    const order: string[] = [];
    const ws = fakeSocket(vi.fn(() => order.push("close")));
    await runInDurableObject(env.ROOM.getByName(code), async (instance) => {
      const target = instance as unknown as { handleDisconnect: (s: WebSocket) => Promise<void> };
      const original = target.handleDisconnect.bind(target);
      target.handleDisconnect = async (s) => {
        order.push("disconnect");
        await original(s);
      };
      await instance.webSocketClose(ws as unknown as WebSocket, 1000, "bye", true);
    });
    expect(ws.close).toHaveBeenCalledTimes(1);
    expect(ws.close).toHaveBeenCalledWith(1000, "bye");
    expect(order).toEqual(["disconnect", "close"]);

    const ws4001 = fakeSocket();
    await closeWith(code, ws4001, 4001, "replaced");
    expect(ws4001.close).toHaveBeenCalledTimes(1);
    expect(ws4001.close).toHaveBeenCalledWith(4001, "replaced");
  });

  it("예약 코드 1005·1006 이면 ws.close 를 부르지 않는다", async () => {
    const { code } = await createRoom("방장");
    for (const reserved of [1005, 1006]) {
      const ws = fakeSocket();
      await closeWith(code, ws, reserved, "");
      expect(ws.close).not.toHaveBeenCalled();
    }
  });

  it("ws.close 가 던져도 webSocketClose 는 던지지 않는다", async () => {
    const { code } = await createRoom("방장");
    const ws = fakeSocket(
      vi.fn(() => {
        throw new Error("already closed");
      }),
    );
    await expect(closeWith(code, ws, 1000, "bye")).resolves.toBeUndefined();
    expect(ws.close).toHaveBeenCalledTimes(1);
  });
});
