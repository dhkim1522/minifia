import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { RoomView } from "../../shared/protocol";
import { Home } from "../../src/screens/Home";
import { Lobby } from "../../src/screens/Lobby";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("Home", () => {
  it("첫 화면 구성: 입장 배경, 소개와 서비스 이름, 닉네임 입력칸, [방 만들기], 버전", () => {
    const { container } = render(<Home onEnterRoom={vi.fn()} />);
    expect(screen.getByRole("heading", { name: "미니피아" })).toBeTruthy();
    expect(screen.getByText("친구들과 한 판, 점심시간 마피아")).toBeTruthy();
    expect(screen.getByLabelText("닉네임")).toBeTruthy();
    expect(screen.getByRole("button", { name: "방 만들기" })).toBeTruthy();
    const art = container.querySelector(".mf-backdrop__art") as HTMLElement | null;
    expect(art?.style.backgroundImage).toContain("/backgrounds/bg_entry_lobby.svg");
    expect(screen.getByText(/^v/)).toBeTruthy();
  });

  it("닉네임을 넣고 [방 만들기]를 누르면 POST /api/rooms 결과로 방에 들어간다", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ code: "0042", token: "t".repeat(43), seat: 0 }), { status: 201 }));
    vi.stubGlobal("fetch", fetchMock);
    const onEnter = vi.fn();
    render(<Home onEnterRoom={onEnter} />);
    fireEvent.change(screen.getByLabelText("닉네임"), { target: { value: "민수" } });
    fireEvent.click(screen.getByRole("button", { name: "방 만들기" }));
    await waitFor(() => expect(onEnter).toHaveBeenCalledWith("0042", "t".repeat(43)));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("/api/rooms");
    expect(init.body).toBe(JSON.stringify({ nickname: "민수" }));
  });
});

describe("Lobby", () => {
  const view: RoomView = {
    code: "0042",
    phase: "lobby",
    phaseEndsAt: null,
    phaseDurationMs: null,
    serverNow: 0,
    minPlayers: 4,
    maxPlayers: 8,
    players: [
      { seat: 0, nickname: "민수", connected: true, isHost: true },
      { seat: 1, nickname: "<b>영희</b>", connected: false, isHost: false },
    ],
    me: { seat: 0, isHost: true },
  };

  it("방 코드, 인원, 방장 표시, 끊긴 사람을 보여 주고 닉네임은 텍스트로만 그린다", () => {
    const { container } = render(<Lobby view={view} send={() => {}} />);
    expect(screen.getByText("0042")).toBeTruthy();
    expect(screen.getByText("2/8명")).toBeTruthy();
    expect(screen.getByText("민수")).toBeTruthy();
    expect(screen.getByText("방장")).toBeTruthy();
    expect(screen.getByText("(연결 끊김)")).toBeTruthy();
    expect(screen.getByText("<b>영희</b>")).toBeTruthy();
    expect(container.querySelector("b")).toBeNull();
  });
});
