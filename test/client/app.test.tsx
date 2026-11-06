import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "../helpers/singleLineErrors";
import { installMemoryStorage } from "../helpers/memoryStorage";
import type { RoomPreview } from "../../shared/protocol";
import { App } from "../../src/App";
import { loadSession, saveSession } from "../../src/net/session";
import { setEngineForTest } from "../../src/audio/unlock";
import { makeRig } from "../helpers/soundRig";

const TOKEN = "t".repeat(43);

// RoomScreen 이 진짜 소켓을 열지 않도록 가짜 WebSocket 을 심는다.
class FakeWebSocket extends EventTarget {
  static OPEN = 1;
  static instances: FakeWebSocket[] = [];
  readyState = 0;
  constructor(public url: string) {
    super();
    FakeWebSocket.instances.push(this);
  }
  send() {}
  close() {}
  serverClose(code: number, reason = "") {
    this.readyState = 3;
    const e = new Event("close") as Event & { code: number; reason: string };
    e.code = code;
    e.reason = reason;
    this.dispatchEvent(e);
  }
}

function preview(): RoomPreview {
  return {
    code: "0042",
    hostNickname: "민수",
    playerCount: 1,
    maxPlayers: 8,
    phase: "lobby",
    players: [{ seat: 0, nickname: "민수" }],
  };
}

const ok = () => new Response(JSON.stringify(preview()), { status: 200 });
const notFound = () => new Response(JSON.stringify({ error: "ROOM_NOT_FOUND" }), { status: 404 });

// 저장된 입장 정보는 문자열로 견준다(실패 보고서가 한 줄이 되도록).
const stored = () => JSON.stringify(loadSession());
const storedAs = (code: string) => JSON.stringify({ code, token: TOKEN });

// 화면이 나타나길 짧게 act 로 흘려 보내며 기다린다(act 안에서 기다리면 갱신이 쌓이기만 한다).
async function see(text: string): Promise<void> {
  for (let i = 0; i < 100 && screen.queryByText(text) === null; i += 1) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
    });
  }
  expect(screen.queryByText(text)).not.toBeNull();
}

beforeEach(() => {
  FakeWebSocket.instances = [];
  vi.stubGlobal("WebSocket", FakeWebSocket);
  installMemoryStorage();
});

afterEach(() => {
  cleanup();
  setEngineForTest(null);
  vi.useRealTimers();
  vi.unstubAllGlobals();
  window.history.replaceState(null, "", "/");
});

describe("App 첫 화면", () => {
  it("서비스 이름 제목을 보여 주고 빌드 버전은 화면에 보이지 않는다", () => {
    render(<App />);
    expect(screen.getByRole("heading", { name: "Minifia" })).toBeTruthy();
    expect(screen.queryByText("vdev")).toBeNull();
  });
});

describe("App 입장 정보 이어받기 (E1 resume, Pitfall 22)", () => {
  it("'/' 에서 저장된 입장 정보가 있으면 방이 살아 있는지 확인하는 동안 불러오는 중을 보이고, 살아 있으면 그 방으로 간다", async () => {
    saveSession({ code: "0042", token: TOKEN });
    window.history.replaceState(null, "", "/");
    const fetchMock = vi.fn(async () => ok());
    vi.stubGlobal("fetch", fetchMock);
    render(<App />);
    expect(screen.getByText("방 정보를 불러오는 중…")).toBeTruthy();
    await see("연결 중…");
    expect((fetchMock.mock.calls[0] as unknown as [string])[0]).toBe("/api/rooms/0042");
    expect(window.location.pathname).toBe("/r/0042");
    expect(stored()).toBe(storedAs("0042"));
  });

  it("'/?test=1' 이면 저장된 입장 정보가 있어도 이전 방에 들어가지 않고 첫 화면을 보이며 입장 정보는 그대로 둔다", () => {
    saveSession({ code: "0042", token: TOKEN });
    window.history.replaceState(null, "", "/?test=1");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    render(<App />);
    expect(screen.getByRole("button", { name: "방 만들기" })).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(stored()).toBe(storedAs("0042"));
  });

  it("방이 없어졌으면(404) 입장 정보를 지우고 첫 화면을 보여 준다", async () => {
    saveSession({ code: "0042", token: TOKEN });
    window.history.replaceState(null, "", "/");
    vi.stubGlobal("fetch", vi.fn(async () => notFound()));
    render(<App />);
    await see("친구들과 한 판, 점심시간 마피아");
    expect(stored()).toBe("null");
    expect(screen.getByRole("heading", { name: "Minifia" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "방 만들기" })).toBeTruthy();
    expect(window.location.pathname).toBe("/");
  });

  it("네트워크가 실패하면 방 화면으로 가서 연결 계층이 판단하게 하고 입장 정보는 그대로 둔다", async () => {
    saveSession({ code: "0042", token: TOKEN });
    window.history.replaceState(null, "", "/");
    vi.stubGlobal("fetch", vi.fn(async () => { throw new TypeError("offline"); }));
    render(<App />);
    await see("연결 중…");
    expect(stored()).toBe(storedAs("0042"));
  });

  it("입장 정보가 없으면 미리보기를 부르지 않고 바로 첫 화면이다", () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    render(<App />);
    expect(screen.getByRole("button", { name: "방 만들기" })).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("'/r/0042' 에 저장된 입장 정보의 코드가 같으면 미리보기 없이 바로 방 화면이다", async () => {
    saveSession({ code: "0042", token: TOKEN });
    window.history.replaceState(null, "", "/r/0042");
    const fetchMock = vi.fn(async () => ok());
    vi.stubGlobal("fetch", fetchMock);
    render(<App />);
    await see("연결 중…");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("'/r/0042' 인데 저장된 입장 정보의 코드가 다르면 이어받지 않고 링크 참가 화면을 보인다(저장된 정보는 그대로)", async () => {
    saveSession({ code: "1111", token: TOKEN });
    window.history.replaceState(null, "", "/r/0042");
    const fetchMock = vi.fn(async () => ok());
    vi.stubGlobal("fetch", fetchMock);
    render(<App />);
    await see("Minifia에 초대받았어요");
    expect(screen.getByRole("heading", { name: "방 0042" })).toBeTruthy();
    expect((fetchMock.mock.calls[0] as unknown as [string])[0]).toBe("/api/rooms/0042");
    expect(stored()).toBe(storedAs("1111"));
  });
});

describe("방에서 나온 이유별 화면 (E3, D-07)", () => {
  // 저장된 입장 정보로 방에 들어간 뒤, 서버가 소켓을 닫는 상황을 만든다.
  async function enterRoomAndClose(code: number, reason: string) {
    saveSession({ code: "0042", token: TOKEN });
    window.history.replaceState(null, "", "/r/0042");
    const fetchMock = vi.fn(async () => ok());
    vi.stubGlobal("fetch", fetchMock);
    render(<App />);
    await see("연결 중…");
    const socket = FakeWebSocket.instances[0]!;
    await act(async () => {
      socket.serverClose(code, reason);
    });
    return fetchMock;
  }

  it("내보내짐(kicked)은 오류 화면 '방장이 방에서 내보냈어요' + [처음으로]이고 입장 정보가 지워지며, [처음으로]로 첫 화면에 간다", async () => {
    await enterRoomAndClose(4003, "kicked");
    expect(screen.queryByRole("heading", { name: "방장이 방에서 내보냈어요" })).not.toBeNull();
    expect(stored()).toBe("null");
    act(() => screen.getByRole("button", { name: "처음으로" }).click());
    expect(screen.queryByRole("button", { name: "방 만들기" })).not.toBeNull();
    expect(window.location.pathname).toBe("/");
  });

  it("방 닫힘(room_closed)은 오류 화면 '방이 닫혔어요' + [처음으로]이고 입장 정보가 지워진다", async () => {
    await enterRoomAndClose(4003, "room_closed");
    expect(screen.queryByRole("heading", { name: "방이 닫혔어요" })).not.toBeNull();
    expect(screen.queryByRole("button", { name: "처음으로" })).not.toBeNull();
    expect(stored()).toBe("null");
  });

  it("입장 정보 무효(invalid_token)는 입장 정보를 지우고 같은 코드의 링크 참가 화면 + 토스트로 간다", async () => {
    await enterRoomAndClose(4003, "invalid_token");
    expect(screen.queryByRole("heading", { name: "방 0042" })).not.toBeNull();
    expect(screen.getByRole("status").textContent).toBe("이 방의 입장 정보가 없어요. 다시 들어와 주세요");
    expect(stored()).toBe("null");
  });

  it("스스로 나감(left)은 입장 정보를 지우고 첫 화면(\"/\")으로 간다", async () => {
    await enterRoomAndClose(4003, "left");
    expect(screen.queryByRole("button", { name: "방 만들기" })).not.toBeNull();
    expect(stored()).toBe("null");
    expect(window.location.pathname).toBe("/");
  });

  it("다른 창에서 접속(replaced)한 뒤 [처음으로]를 누르면 입장 정보는 그대로 두고 첫 화면으로 간다", async () => {
    await enterRoomAndClose(4001, "");
    act(() => screen.getByRole("button", { name: "처음으로" }).click());
    expect(screen.queryByRole("button", { name: "방 만들기" })).not.toBeNull();
    expect(stored()).toBe(storedAs("0042"));
  });
});

// 12-07 (D-7, B-3): 참가 버튼이 곧 소리를 켜는 사용자 제스처다. 처리기 맨 앞에서, await 보다 먼저, 동기로 오디오를 깨운다.
describe("참가 경로는 동기로 오디오를 깨운다 (SOUND-03, D-7)", () => {
  const typeNickname = (value: string) => fireEvent.change(screen.getByLabelText("닉네임"), { target: { value } });

  function spyOrder() {
    const rig = makeRig();
    setEngineForTest(rig.engine);
    const calls: string[] = [];
    vi.spyOn(rig.engine, "unlock").mockImplementation(() => {
      calls.push("unlock");
    });
    return { rig, calls };
  }

  it("홈 [방 만들기] 시트의 [만들기]: createRoom(fetch) 보다 먼저, 같은 동기 구간에서 unlockAudio", () => {
    const { calls } = spyOrder();
    const fetchMock = vi.fn((_url: string) => {
      calls.push("fetch");
      return new Promise<Response>(() => {}); // 끝내 풀리지 않는 지연 promise
    });
    vi.stubGlobal("fetch", fetchMock);
    render(<App />);
    expect(calls).toEqual([]);
    fireEvent.click(screen.getByRole("button", { name: "방 만들기" }));
    typeNickname("민수");
    expect(calls).toEqual([]);
    fireEvent.click(screen.getByRole("button", { name: "만들기" }));
    expect(calls).toEqual(["unlock", "fetch"]);
  });

  it("홈 [참가] 시트의 [참가하기]: joinRoom 보다 먼저 unlockAudio", () => {
    const { calls } = spyOrder();
    vi.stubGlobal("fetch", vi.fn(() => {
      calls.push("fetch");
      return new Promise<Response>(() => {});
    }));
    render(<App />);
    fireEvent.change(screen.getByLabelText("방 코드"), { target: { value: "0042" } });
    fireEvent.click(screen.getByRole("button", { name: "참가" }));
    expect(calls).toEqual([]);
    typeNickname("민수");
    fireEvent.click(screen.getByRole("button", { name: "참가하기" }));
    expect(calls).toEqual(["unlock", "fetch"]);
  });

  it("홈 [참가] 에서 저장된 입장 정보로 바로 들어가는 분기도 제스처 안에서 unlockAudio", () => {
    const { calls } = spyOrder();
    saveSession({ code: "0042", token: TOKEN });
    window.history.replaceState(null, "", "/?test=1");
    vi.stubGlobal("fetch", vi.fn());
    render(<App />);
    fireEvent.change(screen.getByLabelText("방 코드"), { target: { value: "0042" } });
    fireEvent.click(screen.getByRole("button", { name: "참가" }));
    expect(calls).toEqual(["unlock"]);
  });

  it("링크 참가 [참가하기]: joinRoom 보다 먼저 unlockAudio", async () => {
    const { calls } = spyOrder();
    window.history.replaceState(null, "", "/r/0042");
    vi.stubGlobal("fetch", vi.fn((_url: string, init?: RequestInit) => {
      if (init?.method === "POST") {
        calls.push("fetch");
        return new Promise<Response>(() => {});
      }
      return Promise.resolve(ok());
    }));
    render(<App />);
    await see("1 / 8명이 모였어요");
    expect(calls).toEqual([]);
    typeNickname("민수");
    fireEvent.click(screen.getByRole("button", { name: "참가하기" }));
    expect(calls).toEqual(["unlock", "fetch"]);
  });

  it("홈·링크 참가 화면에는 소리 단추가 없다", async () => {
    const rig = makeRig();
    setEngineForTest(rig.engine);
    vi.stubGlobal("fetch", vi.fn(async () => ok()));
    const home = render(<App />);
    expect(document.querySelector("[data-sound-button]")).toBeNull();
    home.unmount();
    window.history.replaceState(null, "", "/r/0042");
    render(<App />);
    await see("1 / 8명이 모였어요");
    expect(document.querySelector("[data-sound-button]")).toBeNull();
  });
});
