import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { RoomView } from "../../shared/protocol";
import { useRoomConnection } from "../../src/net/useRoomConnection";

class FakeSocket extends EventTarget {
  readyState = 0;
  sent: string[] = [];
  closed = false;
  constructor(public url: string) {
    super();
  }
  send(data: string) {
    this.sent.push(data);
  }
  close() {
    this.closed = true;
  }
  open() {
    this.readyState = 1;
    this.dispatchEvent(new Event("open"));
  }
  message(data: unknown) {
    this.dispatchEvent(new MessageEvent("message", { data: JSON.stringify(data) }));
  }
  serverClose(code: number, reason = "") {
    this.readyState = 3;
    const e = new Event("close") as Event & { code: number; reason: string };
    e.code = code;
    e.reason = reason;
    this.dispatchEvent(e);
  }
}

const view: RoomView = {
  code: "0042",
  phase: "lobby",
  phaseEndsAt: null,
  phaseDurationMs: null,
  serverNow: Date.now() + 5000,
  minPlayers: 4,
  maxPlayers: 8,
  players: [{ seat: 0, nickname: "민수", connected: true, isHost: true }],
  me: { seat: 0, isHost: true },
};

function setup() {
  const sockets: FakeSocket[] = [];
  const createSocket = (url: string) => {
    const s = new FakeSocket(url);
    sockets.push(s);
    return s as unknown as WebSocket;
  };
  const hook = renderHook(() => useRoomConnection("0042", "t".repeat(43), { createSocket }));
  return { sockets, hook };
}

afterEach(cleanup);

describe("useRoomConnection", () => {
  it("열리면 hello{token} 을 보내고, 토큰은 주소에 없다", () => {
    const { sockets } = setup();
    const s = sockets[0]!;
    expect(s.url).toMatch(/\/api\/rooms\/0042\/ws$/);
    expect(s.url).not.toContain("t".repeat(43));
    act(() => s.open());
    expect(JSON.parse(s.sent[0]!)).toEqual({ t: "hello", token: "t".repeat(43) });
  });

  it("state 를 받으면 view 와 서버-로컬 시각 차이(offset)를 갱신한다", () => {
    const { sockets, hook } = setup();
    act(() => sockets[0]!.open());
    act(() => sockets[0]!.message({ t: "state", view }));
    expect(hook.result.current.view?.code).toBe("0042");
    expect(hook.result.current.status).toBe("open");
    expect(hook.result.current.offset).toBeGreaterThan(4000);
  });

  it("4003 닫힘은 removed 와 이유, 4001 은 replaced", () => {
    const a = setup();
    act(() => a.sockets[0]!.open());
    act(() => a.sockets[0]!.serverClose(4003, "kicked"));
    expect(a.hook.result.current.status).toBe("removed");
    expect(a.hook.result.current.removedReason).toBe("kicked");
    cleanup();

    const b = setup();
    act(() => b.sockets[0]!.open());
    act(() => b.sockets[0]!.serverClose(4001, "replaced"));
    expect(b.hook.result.current.status).toBe("replaced");
  });

  it("그 밖의 닫힘은 reconnecting 이고, 정리 때 소켓을 닫는다", () => {
    const { sockets, hook } = setup();
    act(() => sockets[0]!.open());
    act(() => sockets[0]!.serverClose(1006));
    expect(hook.result.current.status).toBe("reconnecting");
    hook.unmount();
    expect(sockets[0]!.closed).toBe(true);
  });
});
