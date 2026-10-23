import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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
  /** 보낸 프레임 중 ping 의 c 값들 */
  pings(): number[] {
    return this.sent.map((f) => JSON.parse(f) as { t: string; c: number }).filter((m) => m.t === "ping").map((m) => m.c);
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

function setup(checkRoomImpl?: () => Promise<"alive" | "gone" | "unknown">) {
  const sockets: FakeSocket[] = [];
  const createSocket = (url: string) => {
    const s = new FakeSocket(url);
    sockets.push(s);
    return s as unknown as WebSocket;
  };
  const checkRoom = vi.fn(checkRoomImpl ?? (async () => "alive" as const));
  const hook = renderHook(() =>
    useRoomConnection("0042", "t".repeat(43), { createSocket, random: () => 0, checkRoom }),
  );
  return { sockets, hook, checkRoom };
}

function advance(ms: number) {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
}

function setVisibility(state: "visible" | "hidden") {
  Object.defineProperty(document, "visibilityState", { configurable: true, get: () => state });
  act(() => {
    document.dispatchEvent(new Event("visibilitychange"));
  });
}

/** 열고 첫 state 까지 받은 소켓 */
function openWithState(s: FakeSocket) {
  act(() => s.open());
  act(() => s.message({ t: "state", view }));
}

beforeEach(() => {
  vi.useFakeTimers();
  setVisibility("visible");
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "visible" });
});

describe("useRoomConnection: 연결·핸드셰이크", () => {
  it("열리면 hello{token} 을 보내고, 토큰은 주소에 없다", () => {
    const { sockets } = setup();
    const s = sockets[0]!;
    expect(s.url).toMatch(/\/api\/rooms\/0042\/ws$/);
    expect(s.url).not.toContain("t".repeat(43));
    act(() => s.open());
    expect(JSON.parse(s.sent[0]!)).toEqual({ t: "hello", token: "t".repeat(43) });
  });

  it("열린 직후 hello 다음에 서로 다른 c 의 ping 3개를 보낸다", () => {
    const { sockets } = setup();
    act(() => sockets[0]!.open());
    const frames = sockets[0]!.sent.map((f) => JSON.parse(f) as { t: string; c?: number });
    expect(frames.map((f) => f.t)).toEqual(["hello", "ping", "ping", "ping"]);
    expect(new Set(sockets[0]!.pings()).size).toBe(3);
  });

  it("첫 pong 전에는 offset 0, pong 이 서버시각+5000 을 돌려주면 약 5000", () => {
    const { sockets, hook } = setup();
    act(() => sockets[0]!.open());
    act(() => sockets[0]!.message({ t: "state", view }));
    expect(hook.result.current.view?.code).toBe("0042");
    expect(hook.result.current.status).toBe("open");
    expect(hook.result.current.offset).toBe(0);
    for (const c of sockets[0]!.pings()) {
      act(() => sockets[0]!.message({ t: "pong", c, serverNow: Date.now() + 5000 }));
    }
    expect(Math.abs(hook.result.current.offset - 5000)).toBeLessThan(50);
  });

  it("소켓이 열릴 때마다 epoch 가 1씩 늘어난다", () => {
    const { sockets, hook } = setup();
    expect(hook.result.current.epoch).toBe(0);
    openWithState(sockets[0]!);
    expect(hook.result.current.epoch).toBe(1);
    act(() => sockets[0]!.serverClose(1006));
    advance(500);
    openWithState(sockets[1]!);
    expect(hook.result.current.epoch).toBe(2);
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

  it("끊긴 동안(canSend 거짓)에는 입력을 보내지 않는다", () => {
    const { sockets, hook } = setup();
    openWithState(sockets[0]!);
    const before = sockets[0]!.sent.length;
    act(() => hook.result.current.send({ t: "ping", c: 99 }));
    expect(sockets[0]!.sent.length).toBe(before + 1);
    act(() => sockets[0]!.serverClose(1006));
    expect(hook.result.current.canSend).toBe(false);
    act(() => hook.result.current.send({ t: "ping", c: 100 }));
    expect(sockets[0]!.sent.length).toBe(before + 1);
  });

  it("정리 때 소켓을 닫는다", () => {
    const { sockets, hook } = setup();
    act(() => sockets[0]!.open());
    act(() => sockets[0]!.serverClose(1006));
    expect(hook.result.current.status).toBe("reconnecting");
    hook.unmount();
    expect(sockets[0]!.closed).toBe(true);
  });
});

describe("useRoomConnection: 재연결 (CONN-01)", () => {
  it("state 를 받은 뒤 닫히면 0.5초, 1초, 2초 뒤 새 소켓(지수 백오프)", () => {
    const { sockets } = setup();
    openWithState(sockets[0]!);
    act(() => sockets[0]!.serverClose(1006));
    advance(499);
    expect(sockets.length).toBe(1);
    advance(1);
    expect(sockets.length).toBe(2);

    act(() => sockets[1]!.serverClose(1006));
    advance(999);
    expect(sockets.length).toBe(2);
    advance(1);
    expect(sockets.length).toBe(3);

    act(() => sockets[2]!.serverClose(1006));
    advance(1999);
    expect(sockets.length).toBe(3);
    advance(1);
    expect(sockets.length).toBe(4);
  });

  it("화면이 숨겨진 동안 닫히면 새 소켓을 만들지 않다가, 다시 보이면 곧바로 만든다", () => {
    const { sockets } = setup();
    openWithState(sockets[0]!);
    setVisibility("hidden");
    act(() => sockets[0]!.serverClose(1006));
    advance(20_000);
    expect(sockets.length).toBe(1);
    setVisibility("visible");
    expect(sockets.length).toBe(2);
  });

  it("열린 소켓에서 화면이 돌아오면 ping 을 보내고, 2.5초 안에 pong 이 없으면 닫고 새 소켓", () => {
    const { sockets } = setup();
    openWithState(sockets[0]!);
    const pingsBefore = sockets[0]!.pings().length;
    setVisibility("hidden");
    setVisibility("visible");
    expect(sockets[0]!.pings().length).toBe(pingsBefore + 1);
    advance(2499);
    expect(sockets[0]!.closed).toBe(false);
    expect(sockets.length).toBe(1);
    advance(1);
    expect(sockets[0]!.closed).toBe(true);
    expect(sockets.length).toBe(2);
  });

  it("복귀 ping 에 pong 이 오면 소켓을 그대로 둔다", () => {
    const { sockets } = setup();
    openWithState(sockets[0]!);
    setVisibility("hidden");
    setVisibility("visible");
    const c = sockets[0]!.pings().at(-1)!;
    act(() => sockets[0]!.message({ t: "pong", c, serverNow: Date.now() }));
    advance(5000);
    expect(sockets[0]!.closed).toBe(false);
    expect(sockets.length).toBe(1);
  });

  it("online 이벤트에 기다리지 않고 다시 시도한다", () => {
    const { sockets } = setup();
    openWithState(sockets[0]!);
    act(() => sockets[0]!.serverClose(1006));
    expect(sockets.length).toBe(1);
    act(() => {
      window.dispatchEvent(new Event("online"));
    });
    expect(sockets.length).toBe(2);
  });

  it("보이는 상태로 30초 연속 실패하면 failed 가 되고 더는 시도하지 않으며, retry() 로 다시 시작한다", () => {
    const { sockets, hook } = setup();
    openWithState(sockets[0]!);
    act(() => sockets[0]!.serverClose(1006));
    advance(29_000);
    expect(hook.result.current.status).toBe("reconnecting");
    advance(1_000);
    expect(hook.result.current.status).toBe("failed");
    const count = sockets.length;
    advance(60_000);
    expect(sockets.length).toBe(count);
    act(() => hook.result.current.retry());
    expect(sockets.length).toBe(count + 1);
    expect(hook.result.current.status).toBe("connecting");
  });

  it("꺼져 있던 시간은 세지 않는다: 200초 숨겼다 켜도 곧바로 failed 가 되지 않는다", () => {
    const { sockets, hook } = setup();
    openWithState(sockets[0]!);
    act(() => sockets[0]!.serverClose(1006));
    setVisibility("hidden");
    advance(200_000);
    setVisibility("visible");
    expect(hook.result.current.status).toBe("reconnecting");
    advance(29_000);
    expect(hook.result.current.status).toBe("reconnecting");
    advance(1_000);
    expect(hook.result.current.status).toBe("failed");
  });
});

// 3번 연달아 닫혀 state 를 못 받은 채 한 묶음의 실패가 쌓인 상태까지 진행한다.
function failThrice(sockets: FakeSocket[]) {
  openWithState(sockets[0]!);
  act(() => sockets[0]!.serverClose(1006)); // attempts 1
  advance(500);
  act(() => sockets[1]!.serverClose(1006)); // attempts 2
  advance(1000);
  act(() => sockets[2]!.serverClose(1006)); // attempts 3
}

async function flush() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe("useRoomConnection: 낡은 세션 확인 (Pitfall 22)", () => {
  it("3번 연달아 닫히면 checkRoom 이 한 번 불리고, gone 이면 removed·room_closed", async () => {
    const { sockets, hook, checkRoom } = setup(async () => "gone");
    failThrice(sockets);
    expect(checkRoom).toHaveBeenCalledTimes(1);
    expect(checkRoom).toHaveBeenCalledWith("0042");
    await flush();
    expect(hook.result.current.status).toBe("removed");
    expect(hook.result.current.removedReason).toBe("room_closed");
  });

  it("alive 면 계속 재시도하고, 같은 묶음에서 다시 묻지 않는다", async () => {
    const { sockets, hook, checkRoom } = setup();
    failThrice(sockets);
    await flush();
    expect(hook.result.current.status).toBe("reconnecting");
    advance(2000);
    expect(sockets.length).toBe(4);
    act(() => sockets[3]!.serverClose(1006)); // attempts 4
    await flush();
    expect(checkRoom).toHaveBeenCalledTimes(1);
  });

  it("unknown 이어도 계속 재시도한다", async () => {
    const { sockets, hook } = setup(async () => "unknown");
    failThrice(sockets);
    await flush();
    expect(hook.result.current.status).toBe("reconnecting");
    advance(2000);
    expect(sockets.length).toBe(4);
  });

  it("2번만 닫히면 묻지 않는다", () => {
    const { sockets, checkRoom } = setup();
    openWithState(sockets[0]!);
    act(() => sockets[0]!.serverClose(1006));
    advance(500);
    act(() => sockets[1]!.serverClose(1006));
    expect(checkRoom).not.toHaveBeenCalled();
  });

  it("기본 checkRoom 은 미리보기가 ROOM_NOT_FOUND 면 gone 으로 본다", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ error: "ROOM_NOT_FOUND" }), { status: 404 }));
    vi.stubGlobal("fetch", fetchMock);
    const sockets: FakeSocket[] = [];
    const hook = renderHook(() =>
      useRoomConnection("0042", "t".repeat(43), {
        createSocket: (url) => {
          const s = new FakeSocket(url);
          sockets.push(s);
          return s as unknown as WebSocket;
        },
        random: () => 0,
      }),
    );
    failThrice(sockets);
    await flush();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect((fetchMock.mock.calls[0] as unknown as [string])[0]).toBe("/api/rooms/0042");
    expect(hook.result.current.status).toBe("removed");
    expect(hook.result.current.removedReason).toBe("room_closed");
    vi.unstubAllGlobals();
  });

  it("기본 checkRoom: 네트워크 실패는 unknown 이라 계속 재시도한다", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new TypeError("offline"); }));
    const sockets: FakeSocket[] = [];
    const hook = renderHook(() =>
      useRoomConnection("0042", "t".repeat(43), {
        createSocket: (url) => {
          const s = new FakeSocket(url);
          sockets.push(s);
          return s as unknown as WebSocket;
        },
        random: () => 0,
      }),
    );
    failThrice(sockets);
    await flush();
    expect(hook.result.current.status).toBe("reconnecting");
    vi.unstubAllGlobals();
  });
});
