import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "../helpers/singleLineErrors";
import { installMemoryStorage } from "../helpers/memoryStorage";
import { loadLastNickname, saveLastNickname, saveSession } from "../../src/net/session";
import { Home } from "../../src/screens/Home";

// 화면 테스트마다 저장소를 새로 심어 닉네임·입장 정보가 다음 테스트로 새지 않게 한다.
beforeEach(() => {
  installMemoryStorage();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("Home", () => {
  it("첫 화면 구성: 입장 배경, 소개와 서비스 이름, 닉네임 입력칸, [방 만들기]", () => {
    const { container } = render(<Home onEnterRoom={vi.fn()} />);
    expect(screen.getByRole("heading", { name: "Minifia" })).toBeTruthy();
    expect(screen.getByText("친구들과 한 판, 점심시간 마피아")).toBeTruthy();
    expect(screen.getByLabelText("닉네임")).toBeTruthy();
    expect(screen.getByRole("button", { name: "방 만들기" })).toBeTruthy();
    const art = container.querySelector(".mf-backdrop__art") as HTMLElement | null;
    expect(art?.style.backgroundImage).toContain("/backgrounds/bg_entry_lobby.svg");
    expect(screen.queryByText(/^v/)).toBeNull();
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

describe("Home 코드 참가 (S-01)", () => {
  const TOKEN = "t".repeat(43);
  const nicknameInput = () => screen.getByLabelText("닉네임") as HTMLInputElement;
  const codeInput = () => screen.getByLabelText("방 코드") as HTMLInputElement;
  const joinButton = () => screen.getByRole("button", { name: "참가" }) as HTMLButtonElement;
  const createButton = () => screen.getByRole("button", { name: "방 만들기" }) as HTMLButtonElement;
  const type = (el: HTMLElement, value: string) => fireEvent.change(el, { target: { value } });
  const apiError = (error: string, status: number) =>
    vi.fn(async () => new Response(JSON.stringify({ error }), { status }));

  it("'또는' 구분선 아래에 '방 코드' 칸(4자리 숫자)과 [참가]가 있다", () => {
    render(<Home onEnterRoom={vi.fn()} />);
    expect(screen.getByText("또는")).toBeTruthy();
    expect(codeInput().getAttribute("placeholder")).toBe("4자리 숫자");
    expect(codeInput().getAttribute("inputmode")).toBe("numeric");
    expect(joinButton()).toBeTruthy();
  });

  it("코드가 4자리 미만이면 [참가]만 꺼지고 [방 만들기]는 닉네임만으로 켜진다", () => {
    render(<Home onEnterRoom={vi.fn()} />);
    type(nicknameInput(), "민수");
    type(codeInput(), "004");
    expect(joinButton().disabled).toBe(true);
    expect(createButton().disabled).toBe(false);
    type(codeInput(), "0042");
    expect(joinButton().disabled).toBe(false);
  });

  it("닉네임이 유효하지 않으면 [참가]도 꺼진다", () => {
    render(<Home onEnterRoom={vi.fn()} />);
    type(codeInput(), "0042");
    expect(joinButton().disabled).toBe(true);
    type(nicknameInput(), "민수");
    expect(joinButton().disabled).toBe(false);
  });

  it("4자리를 넘는 입력은 잘리고 숫자가 아닌 글자는 버려진다", () => {
    render(<Home onEnterRoom={vi.fn()} />);
    type(codeInput(), "00421");
    expect(codeInput().value).toBe("0042");
    type(codeInput(), "12ab");
    expect(codeInput().value).toBe("12");
  });

  it("코드로 참가하면 POST /api/rooms/{코드}/join 으로 들어가고 마지막 닉네임이 기억된다", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ token: TOKEN, seat: 2 }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const onEnter = vi.fn();
    render(<Home onEnterRoom={onEnter} />);
    type(nicknameInput(), " 민수 ");
    type(codeInput(), "0042");
    fireEvent.click(joinButton());
    await waitFor(() => expect(onEnter).toHaveBeenCalledWith("0042", TOKEN));
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("/api/rooms/0042/join");
    expect(init.method).toBe("POST");
    expect(init.body).toBe(JSON.stringify({ nickname: "민수" }));
    expect(loadLastNickname()).toBe("민수");
  });

  it("방 만들기에 성공해도 마지막 닉네임이 기억된다", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ code: "0042", token: TOKEN, seat: 0 }), { status: 201 })),
    );
    const onEnter = vi.fn();
    render(<Home onEnterRoom={onEnter} />);
    type(nicknameInput(), "서준");
    fireEvent.click(createButton());
    await waitFor(() => expect(onEnter).toHaveBeenCalled());
    expect(loadLastNickname()).toBe("서준");
  });

  it("없는 방(404)은 코드 칸 아래에 문장과 aria-invalid 로 알리고 입력값은 지우지 않으며, 칸을 고치면 사라진다", async () => {
    vi.stubGlobal("fetch", apiError("ROOM_NOT_FOUND", 404));
    const onEnter = vi.fn();
    render(<Home onEnterRoom={onEnter} />);
    type(nicknameInput(), "민수");
    type(codeInput(), "4827");
    fireEvent.click(joinButton());
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toBe("방을 찾을 수 없어요. 코드를 다시 확인해 주세요");
    expect(codeInput().getAttribute("aria-invalid")).toBe("true");
    expect(nicknameInput().getAttribute("aria-invalid")).toBeNull();
    expect(nicknameInput().value).toBe("민수");
    expect(codeInput().value).toBe("4827");
    expect(onEnter).not.toHaveBeenCalled();
    type(codeInput(), "4828");
    expect(screen.queryByRole("alert")).toBeNull();
    expect(codeInput().getAttribute("aria-invalid")).toBeNull();
  });

  it("같은 이름(409)은 닉네임 칸 아래에 알리고, 닉네임을 고치면 사라진다", async () => {
    vi.stubGlobal("fetch", apiError("NICKNAME_TAKEN", 409));
    render(<Home onEnterRoom={vi.fn()} />);
    type(nicknameInput(), "민수");
    type(codeInput(), "0042");
    fireEvent.click(joinButton());
    expect((await screen.findByRole("alert")).textContent).toBe("같은 이름이 이미 있어요");
    expect(nicknameInput().getAttribute("aria-invalid")).toBe("true");
    expect(codeInput().getAttribute("aria-invalid")).toBeNull();
    type(nicknameInput(), "민수야");
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it.each([
    ["ROOM_FULL", "이미 8명이 모였어요"],
    ["GAME_STARTED", "이미 게임이 시작된 방이에요"],
  ])("%s 는 코드 칸 아래에 '%s' 로 알린다", async (error, text) => {
    vi.stubGlobal("fetch", apiError(error, 409));
    render(<Home onEnterRoom={vi.fn()} />);
    type(nicknameInput(), "민수");
    type(codeInput(), "0042");
    fireEvent.click(joinButton());
    expect((await screen.findByRole("alert")).textContent).toBe(text);
    expect(codeInput().getAttribute("aria-invalid")).toBe("true");
  });

  it("네트워크 오류는 아래 토스트로 알리고 칸에는 오류 문장이 없다", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new TypeError("offline"); }));
    render(<Home onEnterRoom={vi.fn()} />);
    type(nicknameInput(), "민수");
    type(codeInput(), "0042");
    fireEvent.click(joinButton());
    expect((await screen.findByRole("status")).textContent).toBe("연결이 불안정해요. 다시 시도해 주세요");
    expect(screen.queryByRole("alert")).toBeNull();
    expect(codeInput().value).toBe("0042");
  });

  it("저장된 입장 정보의 코드와 같은 코드로 [참가]하면 요청 없이 바로 그 방으로 간다", () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    saveSession({ code: "0042", token: TOKEN });
    const onEnter = vi.fn();
    render(<Home onEnterRoom={onEnter} />);
    type(nicknameInput(), "민수");
    type(codeInput(), "0042");
    fireEvent.click(joinButton());
    expect(onEnter).toHaveBeenCalledWith("0042", TOKEN);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("요청 중에는 [방 만들기]와 [참가] 둘 다 꺼진다", async () => {
    vi.stubGlobal("fetch", vi.fn(() => new Promise<Response>(() => {})));
    render(<Home onEnterRoom={vi.fn()} />);
    type(nicknameInput(), "민수");
    type(codeInput(), "0042");
    fireEvent.click(joinButton());
    await waitFor(() => expect(joinButton().disabled).toBe(true));
    expect(createButton().disabled).toBe(true);
  });

  it("마지막으로 쓴 닉네임이 칸에 미리 채워지고 오류 문장은 없다", () => {
    saveLastNickname("민수");
    render(<Home onEnterRoom={vi.fn()} />);
    expect(nicknameInput().value).toBe("민수");
    expect(screen.queryByRole("alert")).toBeNull();
    expect(createButton().disabled).toBe(false);
  });

  it("코드 칸에서 Enter 를 눌러도 방이 만들어지지 않고 참가로 처리된다", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ token: TOKEN, seat: 1 }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const onEnter = vi.fn();
    render(<Home onEnterRoom={onEnter} />);
    type(nicknameInput(), "민수");
    type(codeInput(), "0042");
    fireEvent.submit(codeInput().closest("form") as HTMLFormElement);
    await waitFor(() => expect(onEnter).toHaveBeenCalledWith("0042", TOKEN));
    expect((fetchMock.mock.calls[0] as unknown as [string])[0]).toBe("/api/rooms/0042/join");
  });
});
