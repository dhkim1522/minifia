import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { RoomPreview } from "../../shared/protocol";
import { App } from "../../src/App";
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
async function see(text: string): Promise<void> {
  await act(async () => {
    await vi.waitFor(() => expect(screen.queryByText(text)).not.toBeNull());
  });
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

    await see("미니피아에 초대받았어요");
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

    await see("미니피아에 초대받았어요");
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
    await see("미니피아에 초대받았어요");
    fireEvent.change(screen.getByLabelText("닉네임"), { target: { value: "하윤" } });
    const button = screen.getByRole("button", { name: "참가하기" }) as HTMLButtonElement;
    fireEvent.click(button);
    await waitFor(() => expect(button.disabled).toBe(true));
    fireEvent.click(button);
    expect(post).toBe(1);
  });
});
