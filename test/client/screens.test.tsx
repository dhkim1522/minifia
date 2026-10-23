import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { RoomView } from "../../shared/protocol";
import { Home } from "../../src/screens/Home";
import { Lobby } from "../../src/screens/Lobby";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
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

  it("처음 열었을 때는 오류 문장이 없고 [방 만들기]는 꺼져 있다", () => {
    render(<Home onEnterRoom={vi.fn()} />);
    expect(screen.queryByRole("alert")).toBeNull();
    expect((screen.getByRole("button", { name: "방 만들기" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("9글자 닉네임은 요청 없이 칸 아래 오류 문장과 aria-invalid, 꺼진 버튼을 보여 준다", () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    render(<Home onEnterRoom={vi.fn()} />);
    const input = screen.getByLabelText("닉네임");
    fireEvent.change(input, { target: { value: "가나다라마바사아자" } });
    expect(screen.getByRole("alert").textContent).toBe("1~8자로 입력해 주세요");
    expect(input.getAttribute("aria-invalid")).toBe("true");
    const button = screen.getByRole("button", { name: "방 만들기" }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    fireEvent.click(button);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("한 번 입력했다가 비우면 오류 문장이 나온다", () => {
    render(<Home onEnterRoom={vi.fn()} />);
    const input = screen.getByLabelText("닉네임");
    fireEvent.change(input, { target: { value: "민" } });
    expect(screen.queryByRole("alert")).toBeNull();
    fireEvent.change(input, { target: { value: "" } });
    expect(screen.getByRole("alert").textContent).toBe("1~8자로 입력해 주세요");
  });

  it("쓸 수 없는 글자가 들어가면 그 문장을 보여 준다", () => {
    render(<Home onEnterRoom={vi.fn()} />);
    fireEvent.change(screen.getByLabelText("닉네임"), { target: { value: "민\t수" } });
    expect(screen.getByRole("alert").textContent).toBe("쓸 수 없는 글자가 있어요");
  });

  it("네트워크 오류는 아래 토스트로 알리고 입력값을 지우지 않으며 2초 뒤 사라진다", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.stubGlobal("fetch", vi.fn(async () => { throw new TypeError("offline"); }));
    const onEnter = vi.fn();
    render(<Home onEnterRoom={onEnter} />);
    const input = screen.getByLabelText("닉네임") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "민수" } });
    fireEvent.click(screen.getByRole("button", { name: "방 만들기" }));
    expect((await screen.findByRole("status")).textContent).toBe("연결이 불안정해요. 다시 시도해 주세요");
    expect(input.value).toBe("민수");
    expect(onEnter).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("방 만들기 한도(CODE_EXHAUSTED)는 토스트로 알린다", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ error: "CODE_EXHAUSTED" }), { status: 503 })));
    render(<Home onEnterRoom={vi.fn()} />);
    fireEvent.change(screen.getByLabelText("닉네임"), { target: { value: "민수" } });
    fireEvent.click(screen.getByRole("button", { name: "방 만들기" }));
    expect((await screen.findByRole("status")).textContent).toBe("지금은 방을 만들 수 없어요. 잠시 후 다시 해 주세요");
  });

  it("서버가 닉네임을 거부(NICKNAME_INVALID)하면 칸 아래에 알리고, 칸을 고치면 사라진다", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ error: "NICKNAME_INVALID" }), { status: 400 })));
    render(<Home onEnterRoom={vi.fn()} />);
    const input = screen.getByLabelText("닉네임");
    fireEvent.change(input, { target: { value: "민수" } });
    fireEvent.click(screen.getByRole("button", { name: "방 만들기" }));
    expect((await screen.findByRole("alert")).textContent).toBe("1~8자로 입력해 주세요");
    expect(screen.queryByRole("status")).toBeNull();
    fireEvent.change(input, { target: { value: "민수야" } });
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("응답을 기다리는 동안 버튼이 꺼지고 두 번 눌러도 요청은 한 번이다", async () => {
    let resolve!: (r: Response) => void;
    const fetchMock = vi.fn(() => new Promise<Response>((r) => { resolve = r; }));
    vi.stubGlobal("fetch", fetchMock);
    render(<Home onEnterRoom={vi.fn()} />);
    fireEvent.change(screen.getByLabelText("닉네임"), { target: { value: "민수" } });
    const button = screen.getByRole("button", { name: "방 만들기" }) as HTMLButtonElement;
    fireEvent.click(button);
    await waitFor(() => expect(button.disabled).toBe(true));
    fireEvent.click(button);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    resolve(new Response(JSON.stringify({ code: "0042", token: "t".repeat(43), seat: 0 }), { status: 201 }));
    await waitFor(() => expect(button.disabled).toBe(false));
  });

  it("닉네임은 HTML 로 해석되지 않고 입력값으로만 남는다", () => {
    const { container } = render(<Home onEnterRoom={vi.fn()} />);
    const input = screen.getByLabelText("닉네임") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "<b>가</b>" } });
    expect(input.value).toBe("<b>가</b>");
    expect(container.querySelector("b")).toBeNull();
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
