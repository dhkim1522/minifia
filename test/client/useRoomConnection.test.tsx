import { act, cleanup, render, renderHook, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { RoomView } from "../../shared/protocol";
import { RESTORED_MS } from "../../src/net/linkReducer";
import { useRoomConnection } from "../../src/net/useRoomConnection";
import { Lobby } from "../../src/screens/Lobby";
import { WorldStore } from "../../src/world/store";

// 06-15: 대기실은 맵(WorldStage) 위에 그려진다. 캔버스·런타임은 worldStage.test 가 보므로 여기서는 가짜로 바꾼다(lobby.test.tsx 와 같은 모양).
vi.mock("../../src/components/WorldStage", async () => ({ WorldStage: (await import("../helpers/fakeWorldStage")).FakeWorldStage }));

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

  it("첫 pong 전에도 첫 state 의 serverNow 로 거친 offset 을 정하고, pong 이 오면 그 값으로 다듬는다 (WR-04)", () => {
    const { sockets, hook } = setup();
    act(() => sockets[0]!.open());
    expect(hook.result.current.offset).toBe(0);
    act(() => sockets[0]!.message({ t: "state", view: { ...view, serverNow: Date.now() + 5000 } }));
    expect(hook.result.current.view?.code).toBe("0042");
    expect(hook.result.current.status).toBe("open");
    // pong 이 하나도 오기 전: 0 이 아니라 view.serverNow - 로컬시각 으로 추정한다
    expect(Math.abs(hook.result.current.offset - 5000)).toBeLessThan(50);
    for (const c of sockets[0]!.pings()) {
      act(() => sockets[0]!.message({ t: "pong", c, serverNow: Date.now() + 7000 }));
    }
    expect(Math.abs(hook.result.current.offset - 7000)).toBeLessThan(50);
  });

  it("표본이 생긴 뒤의 state 는 offset 을 덮어쓰지 않는다 (WR-04)", () => {
    const { sockets, hook } = setup();
    act(() => sockets[0]!.open());
    for (const c of sockets[0]!.pings()) {
      act(() => sockets[0]!.message({ t: "pong", c, serverNow: Date.now() + 7000 }));
    }
    act(() => sockets[0]!.message({ t: "state", view: { ...view, serverNow: Date.now() + 1 } }));
    expect(Math.abs(hook.result.current.offset - 7000)).toBeLessThan(50);
  });

  it("새 연결의 첫 state 가 올 때마다 epoch 가 1씩 늘어난다 (소켓이 열린 시점이 아니다, WR-03)", () => {
    const { sockets, hook } = setup();
    expect(hook.result.current.epoch).toBe(0);
    openWithState(sockets[0]!);
    expect(hook.result.current.epoch).toBe(1);
    act(() => sockets[0]!.serverClose(1006));
    advance(500);
    act(() => sockets[1]!.open());
    // 열렸지만 새 state 는 아직: view 는 끊기기 전 값이라 epoch 를 올리면 낡은 view 가 기준선이 된다
    expect(hook.result.current.epoch).toBe(1);
    act(() => sockets[1]!.message({ t: "state", view }));
    expect(hook.result.current.epoch).toBe(2);
    act(() => sockets[1]!.message({ t: "state", view }));
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

  it("send 는 보냈으면 true, 끊겨서 버렸으면 false 를 돌려준다 (WR-01)", () => {
    const { sockets, hook } = setup();
    openWithState(sockets[0]!);
    let sent: boolean | undefined;
    act(() => {
      sent = hook.result.current.send({ t: "leave" });
    });
    expect(sent).toBe(true);
    act(() => sockets[0]!.serverClose(1006));
    act(() => {
      sent = hook.result.current.send({ t: "leave" });
    });
    expect(sent).toBe(false);
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

  it.each([
    [4001, "replaced"],
    [4003, "kicked"],
  ])("pong 을 기다리는 중 %i 로 닫히면(종료 상태) 기다림이 끝나도 새 소켓을 만들지 않는다 (WR-02)", (code, reason) => {
    const { sockets, hook } = setup();
    openWithState(sockets[0]!);
    setVisibility("hidden");
    setVisibility("visible"); // checkAlive: pong 대기 시작
    act(() => sockets[0]!.serverClose(code, reason));
    expect(["replaced", "removed"]).toContain(hook.result.current.status);
    const status = hook.result.current.status;
    advance(10_000);
    expect(sockets.length).toBe(1);
    expect(hook.result.current.status).toBe(status);
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

describe("useRoomConnection + Lobby: 재연결 직후 토스트 (WR-03)", () => {
  it("끊긴 동안 들어온 사람은 재연결 뒤 첫 state 에서 토스트 없이 보이고, 그다음 입장에는 토스트가 난다", () => {
    const sockets: FakeSocket[] = [];
    const createSocket = (url: string) => {
      const s = new FakeSocket(url);
      sockets.push(s);
      return s as unknown as WebSocket;
    };
    const store = new WorldStore();
    function Harness() {
      const c = useRoomConnection("0042", "t".repeat(43), { createSocket, random: () => 0, checkRoom: async () => "alive" });
      return c.view ? <Lobby view={c.view} store={store} send={c.send} canSend={c.canSend} epoch={c.epoch} /> : null;
    }
    const withPlayers = (names: string[]): RoomView => ({
      ...view,
      players: names.map((nickname, seat) => ({ seat, nickname, connected: true, isHost: seat === 0 })),
    });
    render(<Harness />);
    act(() => sockets[0]!.open());
    act(() => sockets[0]!.message({ t: "state", view: withPlayers(["민수", "서준"]) }));
    act(() => sockets[0]!.serverClose(1006));
    advance(500);
    act(() => sockets[1]!.open());
    act(() => sockets[1]!.message({ t: "state", view: withPlayers(["민수", "서준", "하윤"]) }));
    expect(screen.queryByText("하윤님이 들어왔어요")).toBeNull();
    act(() => sockets[1]!.message({ t: "state", view: withPlayers(["민수", "서준", "하윤", "지아"]) }));
    expect(screen.getByText("지아님이 들어왔어요")).toBeTruthy();
  });

  it("재접속 띠가 떠 있는 동안(restored 2초)에는 알림이 없고, 띠가 사라진 뒤의 변화부터 다시 알린다 (CONN-04)", () => {
    const sockets: FakeSocket[] = [];
    const createSocket = (url: string) => {
      const s = new FakeSocket(url);
      sockets.push(s);
      return s as unknown as WebSocket;
    };
    const store = new WorldStore();
    function Harness() {
      const c = useRoomConnection("0042", "t".repeat(43), { createSocket, random: () => 0, checkRoom: async () => "alive" });
      return c.view ? <Lobby view={c.view} store={store} send={c.send} canSend={c.canSend} epoch={c.epoch} bannerVisible={c.banner !== "hidden"} /> : null;
    }
    const withPlayers = (names: string[]): RoomView => ({
      ...view,
      players: names.map((nickname, seat) => ({ seat, nickname, connected: true, isHost: seat === 0 })),
    });
    render(<Harness />);
    act(() => sockets[0]!.open());
    act(() => sockets[0]!.message({ t: "state", view: withPlayers(["민수", "서준"]) }));
    act(() => sockets[0]!.serverClose(1006));
    advance(500);
    act(() => sockets[1]!.open());
    act(() => sockets[1]!.message({ t: "state", view: withPlayers(["민수", "서준", "하윤"]) }));
    // 띠("다시 연결됐어요")가 떠 있는 동안 들어온 사람은 알리지 않는다
    act(() => sockets[1]!.message({ t: "state", view: withPlayers(["민수", "서준", "하윤", "지아"]) }));
    expect(screen.queryByText("지아님이 들어왔어요")).toBeNull();
    advance(RESTORED_MS);
    act(() => sockets[1]!.message({ t: "state", view: withPlayers(["민수", "서준", "하윤", "지아", "도현"]) }));
    expect(screen.getByText("도현님이 들어왔어요")).toBeTruthy();
  });
});

describe("useRoomConnection: 이벤트 구독 (emoji·chat·error 프레임, Pitfall 6)", () => {
  it("emoji 프레임을 onEvent 리스너가 한 번 받는다", () => {
    const { sockets, hook } = setup();
    openWithState(sockets[0]!);
    const listener = vi.fn();
    act(() => {
      hook.result.current.onEvent(listener);
    });
    const frame = { t: "emoji", seat: 2, icon: "smile", at: 1 };
    act(() => sockets[0]!.message(frame));
    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith(frame, { epoch: 1 });
  });

  it("chat 프레임을 onEvent 리스너가 한 번 받고 view 는 바뀌지 않는다 (결정 0017-7)", () => {
    const { sockets, hook } = setup();
    openWithState(sockets[0]!);
    const listener = vi.fn();
    act(() => {
      hook.result.current.onEvent(listener);
    });
    const before = hook.result.current.view;
    const frame = { t: "chat", seq: 3, seat: 1, template: "suspect", target: 2, at: 5 };
    act(() => sockets[0]!.message(frame));
    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith(frame, { epoch: 1 });
    expect(hook.result.current.view).toBe(before);
  });

  it("t 가 chatx 같은 알 수 없는 프레임은 리스너에 가지 않는다", () => {
    const { sockets, hook } = setup();
    openWithState(sockets[0]!);
    const listener = vi.fn();
    act(() => {
      hook.result.current.onEvent(listener);
    });
    act(() => sockets[0]!.message({ t: "chatx", seq: 3, seat: 1, template: "suspect", at: 5 }));
    expect(listener).not.toHaveBeenCalled();
  });

  it("error 프레임도 리스너가 받는다", () => {
    const { sockets, hook } = setup();
    openWithState(sockets[0]!);
    const listener = vi.fn();
    act(() => {
      hook.result.current.onEvent(listener);
    });
    act(() => sockets[0]!.message({ t: "error", code: "RATE_LIMITED" }));
    expect(listener).toHaveBeenCalledWith({ t: "error", code: "RATE_LIMITED" }, { epoch: 1 });
  });

  it("해제 함수를 부른 뒤에는 받지 않는다", () => {
    const { sockets, hook } = setup();
    openWithState(sockets[0]!);
    const listener = vi.fn();
    let off = () => {};
    act(() => {
      off = hook.result.current.onEvent(listener);
    });
    act(() => off());
    act(() => sockets[0]!.message({ t: "emoji", seat: 2, icon: "smile", at: 1 }));
    expect(listener).not.toHaveBeenCalled();
  });

  it("리스너 둘을 등록하면 둘 다 받는다", () => {
    const { sockets, hook } = setup();
    openWithState(sockets[0]!);
    const a = vi.fn();
    const b = vi.fn();
    act(() => {
      hook.result.current.onEvent(a);
      hook.result.current.onEvent(b);
    });
    act(() => sockets[0]!.message({ t: "emoji", seat: 1, icon: "heart", at: 5 }));
    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(1);
  });

  it("emoji 프레임은 view 를 바꾸지 않고 onEvent 참조도 안정적이다", () => {
    const { sockets, hook } = setup();
    openWithState(sockets[0]!);
    const before = hook.result.current;
    act(() => sockets[0]!.message({ t: "emoji", seat: 2, icon: "smile", at: 1 }));
    expect(hook.result.current.view).toBe(before.view);
    expect(hook.result.current.onEvent).toBe(before.onEvent);
  });

  it("알 수 없는 t 값은 리스너도 view 도 건드리지 않는다", () => {
    const { sockets, hook } = setup();
    openWithState(sockets[0]!);
    const listener = vi.fn();
    act(() => {
      hook.result.current.onEvent(listener);
    });
    const before = hook.result.current.view;
    act(() => sockets[0]!.message({ t: "unknown", text: "hi" }));
    expect(listener).not.toHaveBeenCalled();
    expect(hook.result.current.view).toBe(before);
  });
});

describe("useRoomConnection: world 프레임 비간섭 (CONN-04)", () => {
  const snapFrame = { t: "world", k: "snap", at: 1000, ents: [{ s: 0, p: [360, 40], t0: 0, v: 180 }] };

  it("world 프레임은 구독자에게 { epoch } 메타와 함께 가고, 재연결하면 epoch 가 바뀐다", () => {
    const { sockets, hook } = setup();
    openWithState(sockets[0]!);
    const listener = vi.fn();
    act(() => {
      hook.result.current.onEvent(listener);
    });
    act(() => sockets[0]!.message(snapFrame));
    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenLastCalledWith(snapFrame, { epoch: 1 });
    act(() => sockets[0]!.serverClose(1006));
    advance(500);
    openWithState(sockets[1]!);
    const mv = { t: "world", k: "move", s: 0, p: [360, 40, 360, 220], t0: 2000, v: 180 };
    act(() => sockets[1]!.message(mv));
    expect(listener).toHaveBeenLastCalledWith(mv, { epoch: 2 });
  });

  it("알 수 없는 t 는 world 가 화이트리스트에 들어와도 여전히 구독자에게 가지 않는다", () => {
    const { sockets, hook } = setup();
    openWithState(sockets[0]!);
    const listener = vi.fn();
    act(() => {
      hook.result.current.onEvent(listener);
    });
    act(() => sockets[0]!.message({ t: "worldx", k: "snap", at: 1, ents: [] }));
    act(() => sockets[0]!.message({ t: "bogus" }));
    expect(listener).not.toHaveBeenCalled();
  });

  it("world 프레임은 링크 상태·배너·epoch·offset·view 를 바꾸지 않는다", () => {
    const { sockets, hook } = setup();
    openWithState(sockets[0]!);
    const before = hook.result.current;
    act(() => sockets[0]!.message(snapFrame));
    act(() => sockets[0]!.message({ t: "world", k: "move", s: 0, p: [360, 40, 360, 220], t0: 2000, v: 180 }));
    const after = hook.result.current;
    expect(after.view).toBe(before.view);
    expect(after.status).toBe(before.status);
    expect(after.banner).toBe(before.banner);
    expect(after.epoch).toBe(before.epoch);
    expect(after.offset).toBe(before.offset);
    expect(after.canSend).toBe(before.canSend);
  });

  it("종료 상태(replaced)가 된 뒤 같은 소켓으로 world 프레임이 와도 새 소켓을 열지 않고 구독자도 부르지 않는다 (WR-02 회귀)", () => {
    const { sockets, hook } = setup();
    openWithState(sockets[0]!);
    const listener = vi.fn();
    act(() => {
      hook.result.current.onEvent(listener);
    });
    act(() => sockets[0]!.serverClose(4001, "replaced"));
    expect(hook.result.current.status).toBe("replaced");
    act(() => sockets[0]!.message(snapFrame));
    advance(10_000);
    expect(listener).not.toHaveBeenCalled();
    expect(sockets).toHaveLength(1);
    expect(hook.result.current.status).toBe("replaced");
  });
});
