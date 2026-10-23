import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { RoomPreview } from "../../shared/protocol";
import { App } from "../../src/App";
import { JoinByLink } from "../../src/screens/JoinByLink";
import { loadLastNickname, saveLastNickname } from "../../src/net/session";
import "../helpers/singleLineErrors";
import { installMemoryStorage } from "../helpers/memoryStorage";

// RoomScreen 이 진짜 소켓을 열지 않도록 가짜 WebSocket 을 심는다.
class FakeWebSocket extends EventTarget {
  static OPEN = 1;
  readyState = 0;
  constructor(public url: string) {
    super();
  }
  send() {}
  close() {}
}

const TOKEN = "t".repeat(43);

function preview(overrides: Partial<RoomPreview> = {}): RoomPreview {
  return {
    code: "0042",
    hostNickname: "민수",
    playerCount: 2,
    maxPlayers: 8,
    phase: "lobby",
    players: [
      { seat: 0, nickname: "민수" },
      { seat: 1, nickname: "서준" },
    ],
    ...overrides,
  };
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status });
}

// 화면에 글자가 나타나길 기다린다. 못 찾으면 한 줄짜리 단언 메시지로 실패한다(화면 전체 덤프 없음).
// act 안에서 기다리면 갱신이 act 가 끝날 때까지 쌓여 화면이 바뀌지 않으므로, 짧게 act 로 흘려 보내며 다시 확인한다.
async function see(text: string): Promise<void> {
  for (let i = 0; i < 100 && screen.queryByText(text) === null; i += 1) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
    });
  }
  expect(screen.queryByText(text)).not.toBeNull();
}

beforeEach(() => {
  vi.stubGlobal("WebSocket", FakeWebSocket);
  installMemoryStorage();
  window.history.replaceState(null, "", "/r/0042");
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  window.history.replaceState(null, "", "/");
});

describe("링크 참가 화면 (S-02) 트레이서", () => {
  it("참가 링크를 열면 초대 문구·방 코드·먼저 앉은 사람·인원·닉네임 칸·[참가하기]가 보인다", async () => {
    const fetchMock = vi.fn(async () => json(preview()));
    vi.stubGlobal("fetch", fetchMock);
    render(<App />);

    await see("2 / 8명이 모였어요");
    expect(screen.getByText("Minifia에 초대받았어요")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "방 0042" })).toBeTruthy();
    expect(screen.getByText("민수")).toBeTruthy();
    expect(screen.getByText("서준")).toBeTruthy();
    expect(screen.getByText("2 / 8명이 모였어요")).toBeTruthy();
    expect(screen.getByLabelText("닉네임")).toBeTruthy();
    expect(screen.getByRole("button", { name: "참가하기" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "다른 방 코드로 참가" })).toBeTruthy();

    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit | undefined];
    expect(url).toBe("/api/rooms/0042");
    expect(init?.method ?? "GET").toBe("GET");
  });

  it("앉은 사람의 인물은 자리별 세트 C 그림(72×96)으로 그려진다", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => json(preview())));
    const { container } = render(<App />);
    await see("서준");
    const img = container.querySelector('img[src*="fig2_boy_black_default%402x.png"]') as HTMLImageElement | null;
    expect(img).not.toBeNull();
    expect(img?.getAttribute("width")).toBe("72");
    expect(img?.getAttribute("height")).toBe("96");
  });

  it("닉네임만 넣고 [참가하기]를 누르면 POST 로 들어가 입장 정보가 저장되고 방 화면으로 바뀐다(토큰은 주소에 없다)", async () => {
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      if (init?.method === "POST") return json({ token: TOKEN, seat: 2 });
      return json(preview());
    });
    vi.stubGlobal("fetch", fetchMock);
    render(<App />);

    await see("2 / 8명이 모였어요");
    fireEvent.change(screen.getByLabelText("닉네임"), { target: { value: "하윤" } });
    fireEvent.click(screen.getByRole("button", { name: "참가하기" }));

    await see("연결 중…");
    const post = fetchMock.mock.calls.find(([, init]) => (init as RequestInit | undefined)?.method === "POST") as unknown as [string, RequestInit];
    expect(post[0]).toBe("/api/rooms/0042/join");
    expect(post[1].body).toBe(JSON.stringify({ nickname: "하윤" }));

    expect(JSON.parse(localStorage.getItem("minifia:session") ?? "null")).toEqual({ code: "0042", token: TOKEN });
    expect(window.location.pathname).toBe("/r/0042");
    expect(window.location.search).toBe("");
    expect(window.location.href).not.toContain(TOKEN);
    expect(window.location.hash).toBe("");
  });

  it("참가 요청이 끝나기 전에는 [참가하기]가 꺼져 두 번 눌러도 요청은 한 번이다", async () => {
    let post = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init?: RequestInit) => {
        if (init?.method === "POST") {
          post += 1;
          return new Promise<Response>(() => {});
        }
        return json(preview());
      }),
    );
    render(<App />);
    await see("2 / 8명이 모였어요");
    fireEvent.change(screen.getByLabelText("닉네임"), { target: { value: "하윤" } });
    const button = screen.getByRole("button", { name: "참가하기" }) as HTMLButtonElement;
    fireEvent.click(button);
    await waitFor(() => expect(button.disabled).toBe(true));
    fireEvent.click(button);
    expect(post).toBe(1);
  });
});

describe("링크 참가 화면 닉네임 (D-06)", () => {
  it("마지막으로 쓴 닉네임이 미리 채워지고, 열리면 칸에 포커스가 가며 글자가 전체 선택된다", async () => {
    saveLastNickname("하윤");
    vi.stubGlobal("fetch", vi.fn(async () => json(preview())));
    render(<App />);
    await see("2 / 8명이 모였어요");
    const input = screen.getByLabelText("닉네임") as HTMLInputElement;
    expect(input.value).toBe("하윤");
    expect(document.activeElement).toBe(input);
    expect(input.selectionStart).toBe(0);
    expect(input.selectionEnd).toBe("하윤".length);
    expect(screen.queryByRole("alert")).toBeNull();
    expect((screen.getByRole("button", { name: "참가하기" }) as HTMLButtonElement).disabled).toBe(false);
  });

  it("닉네임이 비어 있으면 [참가하기]가 꺼지고, 한 번 입력한 뒤 비우면 칸 아래 오류 문장이 나온다", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => json(preview())));
    render(<App />);
    await see("2 / 8명이 모였어요");
    const input = screen.getByLabelText("닉네임");
    expect((screen.getByRole("button", { name: "참가하기" }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.queryByRole("alert")).toBeNull();
    fireEvent.change(input, { target: { value: "하" } });
    fireEvent.change(input, { target: { value: "" } });
    expect(screen.getByRole("alert").textContent).toBe("1~8자로 입력해 주세요");
  });

  it("참가에 성공하면 정규화한 닉네임이 마지막 닉네임으로 기억된다", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init?: RequestInit) => (init?.method === "POST" ? json({ token: TOKEN, seat: 2 }) : json(preview()))),
    );
    render(<App />);
    await see("2 / 8명이 모였어요");
    fireEvent.change(screen.getByLabelText("닉네임"), { target: { value: " 하윤 " } });
    fireEvent.click(screen.getByRole("button", { name: "참가하기" }));
    await see("연결 중…");
    expect(loadLastNickname()).toBe("하윤");
  });
});

// ---- Task 3: 상태 화면 · 미리보기 폴링 ----

const POLL_MS = 10_000;

type Responder = () => Response | Promise<Response>;

// 호출 순서대로 응답을 준다. 순서가 끝나면 마지막 응답을 반복한다. POST 는 postResponder 로 따로 준다.
function stubRoom(gets: Responder[], postResponder?: Responder) {
  let index = 0;
  const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
    if (init?.method === "POST") return (postResponder ?? (() => json({ token: TOKEN, seat: 2 })))();
    const responder = gets[Math.min(index, gets.length - 1)]!;
    index += 1;
    return responder();
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

const getCount = (fetchMock: ReturnType<typeof vi.fn>) =>
  fetchMock.mock.calls.filter(([, init]) => ((init as RequestInit | undefined)?.method ?? "GET") === "GET").length;

const settle = () =>
  act(async () => {
    await vi.advanceTimersByTimeAsync(0);
  });
const advance = (ms: number) =>
  act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });

function setVisibility(state: "visible" | "hidden") {
  Object.defineProperty(document, "visibilityState", { configurable: true, get: () => state });
  document.dispatchEvent(new Event("visibilitychange"));
}

function renderJoin(extra: { notice?: string | null; onHome?: () => void; onEnterRoom?: (c: string, t: string) => void } = {}) {
  return render(
    <JoinByLink code="0042" notice={extra.notice ?? null} onEnterRoom={extra.onEnterRoom ?? vi.fn()} onHome={extra.onHome ?? vi.fn()} />,
  );
}

const seatedRoom = (n: number) =>
  preview({
    playerCount: n,
    players: Array.from({ length: n }, (_, seat) => ({ seat, nickname: `이름${seat}` })),
  });

afterEach(() => {
  Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "visible" });
});

describe("링크 참가 화면 상태 (E2 loading·error·partial)", () => {
  it("미리보기 응답 전에는 '방 정보를 불러오는 중…' 만 있고 닉네임 칸·[참가하기]가 없다", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    stubRoom([() => new Promise<Response>(() => {})]);
    renderJoin();
    await settle();
    expect(screen.queryByText("방 정보를 불러오는 중…")).not.toBeNull();
    expect(screen.queryByLabelText("닉네임")).toBeNull();
    expect(screen.queryByRole("button", { name: "참가하기" })).toBeNull();
  });

  it("없는 방(404)은 입력 카드 대신 사유 문장(heading)과 [처음으로]가 보이고, [처음으로]는 onHome 을 부른다", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    stubRoom([() => json({ error: "ROOM_NOT_FOUND" }, 404)]);
    const onHome = vi.fn();
    renderJoin({ onHome });
    await settle();
    expect(screen.queryByRole("heading", { name: "방을 찾을 수 없어요" })).not.toBeNull();
    expect(screen.queryByLabelText("닉네임")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "처음으로" }));
    expect(onHome).toHaveBeenCalledTimes(1);
  });

  it("이미 시작된 방(phase 가 lobby 가 아님)은 '이미 게임이 시작된 방이에요' 를 보인다", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    stubRoom([() => json(preview({ phase: "assigning", players: [] }))]);
    renderJoin();
    await settle();
    expect(screen.queryByRole("heading", { name: "이미 게임이 시작된 방이에요" })).not.toBeNull();
    expect(screen.queryByRole("button", { name: "처음으로" })).not.toBeNull();
    expect(screen.queryByLabelText("닉네임")).toBeNull();
  });

  it("정원이 찬 방(8명)은 '이미 8명이 모였어요' 를 보이고, 자리가 나면 입력 카드가 돌아온다", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    stubRoom([() => json(seatedRoom(8)), () => json(seatedRoom(7))]);
    renderJoin();
    await settle();
    expect(screen.queryByRole("heading", { name: "이미 8명이 모였어요" })).not.toBeNull();
    expect(screen.queryByLabelText("닉네임")).toBeNull();
    await advance(POLL_MS);
    expect(screen.queryByRole("heading", { name: "이미 8명이 모였어요" })).toBeNull();
    expect(screen.queryByLabelText("닉네임")).not.toBeNull();
    expect(screen.queryByText("7 / 8명이 모였어요")).not.toBeNull();
  });

  it("참가 때 같은 이름(409 NICKNAME_TAKEN)은 닉네임 칸 아래 오류 문장이고 입력값은 남는다", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    stubRoom([() => json(seatedRoom(2))], () => json({ error: "NICKNAME_TAKEN" }, 409));
    renderJoin();
    await settle();
    const input = screen.getByLabelText("닉네임") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "민수" } });
    fireEvent.click(screen.getByRole("button", { name: "참가하기" }));
    await settle();
    expect(screen.getByRole("alert").textContent).toBe("같은 이름이 이미 있어요");
    expect(input.getAttribute("aria-invalid")).toBe("true");
    expect(input.value).toBe("민수");
    fireEvent.change(input, { target: { value: "민수야" } });
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it.each([
    ["ROOM_FULL", "이미 8명이 모였어요"],
    ["GAME_STARTED", "이미 게임이 시작된 방이에요"],
    ["ROOM_NOT_FOUND", "방을 찾을 수 없어요"],
  ])("참가 때 %s 는 입력 카드 대신 '%s' 로 바뀐다", async (error, text) => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    stubRoom([() => json(seatedRoom(2))], () => json({ error }, error === "ROOM_NOT_FOUND" ? 404 : 409));
    renderJoin();
    await settle();
    fireEvent.change(screen.getByLabelText("닉네임"), { target: { value: "민수" } });
    fireEvent.click(screen.getByRole("button", { name: "참가하기" }));
    await settle();
    expect(screen.queryByRole("heading", { name: text })).not.toBeNull();
    expect(screen.queryByLabelText("닉네임")).toBeNull();
  });

  it("참가 때 네트워크 오류는 아래 토스트로 알리고 입력값은 남는다", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    stubRoom([() => json(seatedRoom(2))], () => {
      throw new TypeError("offline");
    });
    renderJoin();
    await settle();
    const input = screen.getByLabelText("닉네임") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "민수" } });
    fireEvent.click(screen.getByRole("button", { name: "참가하기" }));
    await settle();
    expect(screen.getByRole("status").textContent).toBe("연결이 불안정해요. 다시 시도해 주세요");
    expect(input.value).toBe("민수");
  });

  it("notice 가 있으면 마운트 때 아래 토스트로 보인다", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    stubRoom([() => json(seatedRoom(2))]);
    renderJoin({ notice: "이 방의 입장 정보가 없어요. 다시 들어와 주세요" });
    await settle();
    expect(screen.getByRole("status").textContent).toBe("이 방의 입장 정보가 없어요. 다시 들어와 주세요");
  });
});

describe("링크 참가 화면 미리보기 폴링 (E2 populated, Pitfall 18)", () => {
  it("10초 뒤 GET 이 다시 불리고 화면 인원이 새 응답으로 바뀐다", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    const fetchMock = stubRoom([() => json(seatedRoom(2)), () => json(seatedRoom(3))]);
    renderJoin();
    await settle();
    expect(screen.queryByText("2 / 8명이 모였어요")).not.toBeNull();
    await advance(POLL_MS - 1);
    expect(getCount(fetchMock)).toBe(1);
    await advance(1);
    expect(getCount(fetchMock)).toBe(2);
    expect(screen.queryByText("3 / 8명이 모였어요")).not.toBeNull();
    expect(screen.queryByText("이름2")).not.toBeNull();
  });

  it("화면이 숨겨진 동안에는 받지 않고, 보이게 되면 곧바로 한 번 받은 뒤 다시 10초 간격이 된다", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    const fetchMock = stubRoom([() => json(seatedRoom(2))]);
    renderJoin();
    await settle();
    setVisibility("hidden");
    await advance(POLL_MS * 2);
    expect(getCount(fetchMock)).toBe(1);
    setVisibility("visible");
    await settle();
    expect(getCount(fetchMock)).toBe(2);
    await advance(POLL_MS);
    expect(getCount(fetchMock)).toBe(3);
  });

  it("이전 요청이 아직 끝나지 않았으면 10초가 지나도 새 요청을 겹쳐 보내지 않는다", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    let release!: (r: Response) => void;
    const fetchMock = stubRoom([
      () => json(seatedRoom(2)),
      () =>
        new Promise<Response>((resolve) => {
          release = resolve;
        }),
    ]);
    renderJoin();
    await settle();
    await advance(POLL_MS);
    expect(getCount(fetchMock)).toBe(2);
    await advance(POLL_MS * 3);
    expect(getCount(fetchMock)).toBe(2);
    setVisibility("hidden");
    setVisibility("visible");
    await settle();
    expect(getCount(fetchMock)).toBe(2);
    await act(async () => {
      release(json(seatedRoom(2)));
      await vi.advanceTimersByTimeAsync(0);
    });
    await advance(POLL_MS);
    expect(getCount(fetchMock)).toBe(3);
  });

  it("방이 사라지면(404) 더 받지 않는다", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    const fetchMock = stubRoom([() => json(seatedRoom(2)), () => json({ error: "ROOM_NOT_FOUND" }, 404)]);
    renderJoin();
    await settle();
    await advance(POLL_MS);
    expect(screen.queryByRole("heading", { name: "방을 찾을 수 없어요" })).not.toBeNull();
    await advance(POLL_MS * 6);
    expect(getCount(fetchMock)).toBe(2);
  });

  it("게임이 시작되면 더 받지 않는다", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    const fetchMock = stubRoom([() => json(seatedRoom(2)), () => json(preview({ phase: "roleReveal", players: [] }))]);
    renderJoin();
    await settle();
    await advance(POLL_MS);
    expect(screen.queryByRole("heading", { name: "이미 게임이 시작된 방이에요" })).not.toBeNull();
    await advance(POLL_MS * 6);
    expect(getCount(fetchMock)).toBe(2);
  });

  it("언마운트한 뒤에는 받지 않는다", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    const fetchMock = stubRoom([() => json(seatedRoom(2))]);
    const view = renderJoin();
    await settle();
    view.unmount();
    await advance(POLL_MS * 5);
    expect(getCount(fetchMock)).toBe(1);
  });

  it("첫 GET 이 네트워크 실패면 불러오는 중을 유지하고 아래 토스트를 보이며 다음 주기에 다시 시도한다", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    const fetchMock = stubRoom([
      () => {
        throw new TypeError("offline");
      },
      () => json(seatedRoom(2)),
    ]);
    renderJoin();
    await settle();
    expect(screen.queryByText("방 정보를 불러오는 중…")).not.toBeNull();
    expect(screen.getByRole("status").textContent).toBe("연결이 불안정해요. 다시 시도해 주세요");
    await advance(POLL_MS);
    expect(getCount(fetchMock)).toBe(2);
    expect(screen.queryByText("2 / 8명이 모였어요")).not.toBeNull();
  });

  it("이미 표시한 뒤의 실패는 마지막 표시를 유지하고 조용히 넘어간다", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    stubRoom([
      () => json(seatedRoom(2)),
      () => {
        throw new TypeError("offline");
      },
    ]);
    renderJoin();
    await settle();
    await advance(POLL_MS);
    expect(screen.queryByText("2 / 8명이 모였어요")).not.toBeNull();
    expect(screen.queryByRole("status")).toBeNull();
  });
});
