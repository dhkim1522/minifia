import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "../helpers/singleLineErrors";
import { installMemoryStorage } from "../helpers/memoryStorage";
import { loadLastNickname, saveLastNickname, saveSession } from "../../src/net/session";
import { Home } from "../../src/screens/Home";

// 월드 청크 미리 받기는 감시만 한다 — 진짜 호출은 three 청크를 끌어오기 때문이다. 나머지 runtime 은 그대로 둔다.
const { preloadWorldMock } = vi.hoisted(() => ({ preloadWorldMock: vi.fn() }));
vi.mock("../../src/world/runtime", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../src/world/runtime")>()),
  preloadWorld: preloadWorldMock,
}));

// 화면 테스트마다 저장소를 새로 심어 닉네임·입장 정보가 다음 테스트로 새지 않게 한다.
beforeEach(() => {
  installMemoryStorage();
  preloadWorldMock.mockClear();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const TOKEN = "t".repeat(43);
const type = (el: HTMLElement, value: string) => fireEvent.change(el, { target: { value } });
const apiError = (error: string, status: number) => vi.fn(async () => new Response(JSON.stringify({ error }), { status }));
const createRoomButton = () => screen.getByRole("button", { name: "방 만들기" }) as HTMLButtonElement;
const joinCodeButton = () => screen.getByRole("button", { name: "참가" }) as HTMLButtonElement;
const codeInput = () => screen.getByLabelText("방 코드") as HTMLInputElement;
const nicknameInput = () => screen.getByLabelText("닉네임") as HTMLInputElement;
// 시트 안의 제출 버튼: 방 만들기 후에는 [만들기], 코드 참가 후에는 [참가하기]
const submitCreate = () => screen.getByRole("button", { name: "만들기" }) as HTMLButtonElement;
const submitJoin = () => screen.getByRole("button", { name: "참가하기" }) as HTMLButtonElement;

describe("Home 첫 화면 (S-01, 결정 0014)", () => {
  it("구성: 입장 배경, 소개와 서비스 이름, [방 만들기], 방 코드 칸과 [참가]. 닉네임 칸과 카드는 없다", () => {
    const { container } = render(<Home onEnterRoom={vi.fn()} />);
    expect(screen.getByRole("heading", { name: "Minifia" })).toBeTruthy();
    expect(screen.getByText("친구들과 한 판, 점심시간 마피아")).toBeTruthy();
    expect(createRoomButton()).toBeTruthy();
    expect(codeInput().getAttribute("placeholder")).toBe("4자리 숫자");
    expect(codeInput().getAttribute("inputmode")).toBe("numeric");
    expect(joinCodeButton()).toBeTruthy();
    expect(screen.queryByLabelText("닉네임")).toBeNull();
    expect(screen.queryByText("또는")).toBeNull();
    expect(container.querySelector(".mf-entry__card")).toBeNull();
    const art = container.querySelector(".mf-backdrop__art") as HTMLElement | null;
    expect(art?.style.backgroundImage).toContain("/backgrounds/bg_entry_lobby.webp");
    expect(screen.queryByText(/^v/)).toBeNull();
  });

  it("[방 만들기]는 닉네임 없이도 눌려 시트를 연다. 처음 열었을 때 오류 문장은 없다", () => {
    render(<Home onEnterRoom={vi.fn()} />);
    expect(createRoomButton().disabled).toBe(false);
    fireEvent.click(createRoomButton());
    expect(nicknameInput()).toBeTruthy();
    expect(screen.queryByRole("alert")).toBeNull();
    expect(submitCreate().disabled).toBe(true);
  });

  it("코드가 4자리가 되어야 [참가]가 켜진다. 닉네임은 묻지 않고 켜진다", () => {
    render(<Home onEnterRoom={vi.fn()} />);
    expect(joinCodeButton().disabled).toBe(true);
    type(codeInput(), "004");
    expect(joinCodeButton().disabled).toBe(true);
    type(codeInput(), "0042");
    expect(joinCodeButton().disabled).toBe(false);
  });

  it("4자리를 넘는 입력은 잘리고 숫자가 아닌 글자는 버려진다", () => {
    render(<Home onEnterRoom={vi.fn()} />);
    type(codeInput(), "00421");
    expect(codeInput().value).toBe("0042");
    type(codeInput(), "12ab");
    expect(codeInput().value).toBe("12");
  });

  it("마지막으로 쓴 닉네임이 시트 칸에 미리 채워지고 오류 문장은 없으며 바로 만들 수 있다", () => {
    saveLastNickname("민수");
    render(<Home onEnterRoom={vi.fn()} />);
    fireEvent.click(createRoomButton());
    expect(nicknameInput().value).toBe("민수");
    expect(screen.queryByRole("alert")).toBeNull();
    expect(submitCreate().disabled).toBe(false);
  });
});

describe("Home 방 만들기 시트", () => {
  it("닉네임을 넣고 [만들기]를 누르면 POST /api/rooms 결과로 방에 들어가고 닉네임이 기억된다", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ code: "0042", token: TOKEN, seat: 0 }), { status: 201 }));
    vi.stubGlobal("fetch", fetchMock);
    const onEnter = vi.fn();
    render(<Home onEnterRoom={onEnter} />);
    fireEvent.click(createRoomButton());
    type(nicknameInput(), "민수");
    fireEvent.click(submitCreate());
    await waitFor(() => expect(onEnter).toHaveBeenCalledWith("0042", TOKEN));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("/api/rooms");
    expect(init.body).toBe(JSON.stringify({ nickname: "민수" }));
    expect(loadLastNickname()).toBe("민수");
  });

  it("9글자 닉네임은 요청 없이 칸 아래 오류 문장과 aria-invalid, 꺼진 버튼을 보여 준다", () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    render(<Home onEnterRoom={vi.fn()} />);
    fireEvent.click(createRoomButton());
    type(nicknameInput(), "가나다라마바사아자");
    expect(screen.getByRole("alert").textContent).toBe("1~8자로 입력해 주세요");
    expect(nicknameInput().getAttribute("aria-invalid")).toBe("true");
    expect(submitCreate().disabled).toBe(true);
    fireEvent.click(submitCreate());
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("한 번 입력했다가 비우면 오류 문장이 나온다", () => {
    render(<Home onEnterRoom={vi.fn()} />);
    fireEvent.click(createRoomButton());
    type(nicknameInput(), "민");
    expect(screen.queryByRole("alert")).toBeNull();
    type(nicknameInput(), "");
    expect(screen.getByRole("alert").textContent).toBe("1~8자로 입력해 주세요");
  });

  it("쓸 수 없는 글자가 들어가면 그 문장을 보여 준다", () => {
    render(<Home onEnterRoom={vi.fn()} />);
    fireEvent.click(createRoomButton());
    type(nicknameInput(), "민\t수");
    expect(screen.getByRole("alert").textContent).toBe("쓸 수 없는 글자가 있어요");
  });

  it("네트워크 오류는 시트를 닫고 아래 토스트로 알리며 닉네임을 지우지 않고 2초 뒤 사라진다", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.stubGlobal("fetch", vi.fn(async () => { throw new TypeError("offline"); }));
    const onEnter = vi.fn();
    render(<Home onEnterRoom={onEnter} />);
    fireEvent.click(createRoomButton());
    type(nicknameInput(), "민수");
    fireEvent.click(submitCreate());
    expect((await screen.findByRole("status")).textContent).toBe("연결이 불안정해요. 다시 시도해 주세요");
    expect(screen.queryByLabelText("닉네임")).toBeNull();
    expect(onEnter).not.toHaveBeenCalled();
    fireEvent.click(createRoomButton());
    expect(nicknameInput().value).toBe("민수");
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("방 만들기 한도(CODE_EXHAUSTED)는 토스트로 알린다", async () => {
    vi.stubGlobal("fetch", apiError("CODE_EXHAUSTED", 503));
    render(<Home onEnterRoom={vi.fn()} />);
    fireEvent.click(createRoomButton());
    type(nicknameInput(), "민수");
    fireEvent.click(submitCreate());
    expect((await screen.findByRole("status")).textContent).toBe("지금은 방을 만들 수 없어요. 잠시 후 다시 해 주세요");
  });

  it("서버가 닉네임을 거부(NICKNAME_INVALID)하면 시트의 칸 아래에 알리고, 칸을 고치면 사라진다", async () => {
    vi.stubGlobal("fetch", apiError("NICKNAME_INVALID", 400));
    render(<Home onEnterRoom={vi.fn()} />);
    fireEvent.click(createRoomButton());
    type(nicknameInput(), "민수");
    fireEvent.click(submitCreate());
    expect((await screen.findByRole("alert")).textContent).toBe("1~8자로 입력해 주세요");
    expect(screen.queryByRole("status")).toBeNull();
    type(nicknameInput(), "민수야");
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("응답을 기다리는 동안 버튼이 꺼지고 두 번 눌러도 요청은 한 번이다", async () => {
    let resolve!: (r: Response) => void;
    const fetchMock = vi.fn(() => new Promise<Response>((r) => { resolve = r; }));
    vi.stubGlobal("fetch", fetchMock);
    render(<Home onEnterRoom={vi.fn()} />);
    fireEvent.click(createRoomButton());
    type(nicknameInput(), "민수");
    const button = submitCreate();
    fireEvent.click(button);
    await waitFor(() => expect(button.disabled).toBe(true));
    fireEvent.click(button);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    resolve(new Response(JSON.stringify({ code: "0042", token: TOKEN, seat: 0 }), { status: 201 }));
    await waitFor(() => expect(button.disabled).toBe(false));
  });

  it("닉네임은 HTML 로 해석되지 않고 입력값으로만 남는다", () => {
    const { container } = render(<Home onEnterRoom={vi.fn()} />);
    fireEvent.click(createRoomButton());
    type(nicknameInput(), "<b>가</b>");
    expect(nicknameInput().value).toBe("<b>가</b>");
    expect(container.querySelector("b")).toBeNull();
    expect(document.querySelector("dialog b")).toBeNull();
  });
});

describe("Home 코드 참가 시트", () => {
  const openJoinSheet = (nickname = "민수", code = "0042") => {
    type(codeInput(), code);
    fireEvent.click(joinCodeButton());
    type(nicknameInput(), nickname);
  };

  it("[참가]를 누르면 닉네임 시트가 [참가하기] 버튼으로 열린다", () => {
    render(<Home onEnterRoom={vi.fn()} />);
    type(codeInput(), "0042");
    fireEvent.click(joinCodeButton());
    expect(nicknameInput()).toBeTruthy();
    expect(submitJoin()).toBeTruthy();
    expect(screen.queryByRole("button", { name: "만들기" })).toBeNull();
  });

  it("[참가하기]를 누르면 POST /api/rooms/{코드}/join 으로 들어가고 마지막 닉네임이 기억된다", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ token: TOKEN, seat: 2 }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const onEnter = vi.fn();
    render(<Home onEnterRoom={onEnter} />);
    openJoinSheet(" 민수 ");
    fireEvent.click(submitJoin());
    await waitFor(() => expect(onEnter).toHaveBeenCalledWith("0042", TOKEN));
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("/api/rooms/0042/join");
    expect(init.method).toBe("POST");
    expect(init.body).toBe(JSON.stringify({ nickname: "민수" }));
    expect(loadLastNickname()).toBe("민수");
  });

  it("닉네임이 유효하지 않으면 [참가하기]가 꺼진다", () => {
    render(<Home onEnterRoom={vi.fn()} />);
    type(codeInput(), "0042");
    fireEvent.click(joinCodeButton());
    expect(submitJoin().disabled).toBe(true);
    type(nicknameInput(), "민수");
    expect(submitJoin().disabled).toBe(false);
  });

  it("없는 방(404)은 시트를 닫고 코드 칸 아래에 문장과 aria-invalid 로 알리며 입력값은 지우지 않고, 칸을 고치면 사라진다", async () => {
    vi.stubGlobal("fetch", apiError("ROOM_NOT_FOUND", 404));
    const onEnter = vi.fn();
    render(<Home onEnterRoom={onEnter} />);
    openJoinSheet("민수", "4827");
    fireEvent.click(submitJoin());
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toBe("방을 찾을 수 없어요. 코드를 다시 확인해 주세요");
    expect(screen.queryByLabelText("닉네임")).toBeNull();
    expect(codeInput().getAttribute("aria-invalid")).toBe("true");
    expect(codeInput().value).toBe("4827");
    expect(onEnter).not.toHaveBeenCalled();
    type(codeInput(), "4828");
    expect(screen.queryByRole("alert")).toBeNull();
    expect(codeInput().getAttribute("aria-invalid")).toBeNull();
  });

  it("같은 이름(409)은 열려 있는 시트의 닉네임 칸 아래에 알리고, 닉네임을 고치면 사라진다", async () => {
    vi.stubGlobal("fetch", apiError("NICKNAME_TAKEN", 409));
    render(<Home onEnterRoom={vi.fn()} />);
    openJoinSheet();
    fireEvent.click(submitJoin());
    expect((await screen.findByRole("alert")).textContent).toBe("같은 이름이 이미 있어요");
    expect(nicknameInput().getAttribute("aria-invalid")).toBe("true");
    expect(codeInput().getAttribute("aria-invalid")).toBeNull();
    type(nicknameInput(), "민수야");
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it.each([
    ["ROOM_FULL", "이미 8명이 모였어요"],
    ["GAME_STARTED", "이미 게임이 시작된 방이에요"],
  ])("%s 는 시트를 닫고 코드 칸 아래에 '%s' 로 알린다", async (error, text) => {
    vi.stubGlobal("fetch", apiError(error, 409));
    render(<Home onEnterRoom={vi.fn()} />);
    openJoinSheet();
    fireEvent.click(submitJoin());
    expect((await screen.findByRole("alert")).textContent).toBe(text);
    expect(codeInput().getAttribute("aria-invalid")).toBe("true");
  });

  it("네트워크 오류는 시트를 닫고 아래 토스트로 알리며 칸에는 오류 문장이 없다", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new TypeError("offline"); }));
    render(<Home onEnterRoom={vi.fn()} />);
    openJoinSheet();
    fireEvent.click(submitJoin());
    expect((await screen.findByRole("status")).textContent).toBe("연결이 불안정해요. 다시 시도해 주세요");
    expect(screen.queryByRole("alert")).toBeNull();
    expect(codeInput().value).toBe("0042");
  });

  it("저장된 입장 정보의 코드와 같은 코드로 [참가]하면 시트도 요청도 없이 바로 그 방으로 간다", () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    saveSession({ code: "0042", token: TOKEN });
    const onEnter = vi.fn();
    render(<Home onEnterRoom={onEnter} />);
    type(codeInput(), "0042");
    fireEvent.click(joinCodeButton());
    expect(onEnter).toHaveBeenCalledWith("0042", TOKEN);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.queryByLabelText("닉네임")).toBeNull();
  });

  it("요청 중에는 [방 만들기]와 [참가]와 시트 버튼이 꺼진다", async () => {
    vi.stubGlobal("fetch", vi.fn(() => new Promise<Response>(() => {})));
    render(<Home onEnterRoom={vi.fn()} />);
    openJoinSheet();
    fireEvent.click(submitJoin());
    await waitFor(() => expect(submitJoin().disabled).toBe(true));
    expect(createRoomButton().disabled).toBe(true);
    expect(joinCodeButton().disabled).toBe(true);
  });

  it("코드 칸에서 Enter 를 눌러도 방이 만들어지지 않고 참가 시트가 열린다", () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    render(<Home onEnterRoom={vi.fn()} />);
    type(codeInput(), "0042");
    fireEvent.submit(codeInput().closest("form") as HTMLFormElement);
    expect(submitJoin()).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("Home 닉네임 시트 키패드 대응 (폰)", () => {
  it("첫 화면은 방 코드 칸이 위, [방 만들기]가 아래(엄지가 닿는 쪽)에 있다", () => {
    render(<Home onEnterRoom={vi.fn()} />);
    const order = codeInput().compareDocumentPosition(createRoomButton());
    expect(order & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("쓸 수 있는 닉네임이 미리 채워져 있으면 포커스가 제출 버튼에 가서 키패드가 저절로 뜨지 않는다", async () => {
    saveLastNickname("민수");
    render(<Home onEnterRoom={vi.fn()} />);
    fireEvent.click(createRoomButton());
    await waitFor(() => expect(document.activeElement).toBe(submitCreate()));
  });

  it("닉네임이 비어 있으면 포커스가 입력칸에 간다", async () => {
    render(<Home onEnterRoom={vi.fn()} />);
    fireEvent.click(createRoomButton());
    await waitFor(() => expect(document.activeElement).toBe(nicknameInput()));
  });

  it("입력칸에 포커스가 있을 때 배경을 누르면 키패드만 내리고 시트는 닫히지 않는다", async () => {
    render(<Home onEnterRoom={vi.fn()} />);
    fireEvent.click(createRoomButton());
    await waitFor(() => expect(document.activeElement).toBe(nicknameInput()));
    type(nicknameInput(), "민수");
    fireEvent.click(document.querySelector(".mf-sheet-scrim") as HTMLElement);
    expect(document.activeElement).not.toBe(nicknameInput());
    expect(nicknameInput().value).toBe("민수");
    expect(document.querySelector("dialog")).not.toBeNull();
    // 포커스가 입력칸에 없으면 배경 누르기는 시트를 닫는다.
    vi.useFakeTimers();
    fireEvent.click(document.querySelector(".mf-sheet-scrim") as HTMLElement);
    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(document.querySelector("dialog")).toBeNull();
  });

  it("키패드가 올라오면(visualViewport 가 줄면) 대화상자 아래 여백 --mf-kb 가 그 높이가 되고, 내려가면 0 이 된다", async () => {
    const listeners: Record<string, Array<() => void>> = {};
    const vv = {
      height: 800,
      offsetTop: 0,
      addEventListener: (t: string, f: () => void) => ((listeners[t] ??= []).push(f)),
      removeEventListener: () => {},
    };
    vi.stubGlobal("visualViewport", vv);
    Object.defineProperty(window, "visualViewport", { value: vv, configurable: true });
    const clientHeight = vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockReturnValue(800);
    try {
      render(<Home onEnterRoom={vi.fn()} />);
      fireEvent.click(createRoomButton());
      await waitFor(() => expect(document.activeElement).toBe(nicknameInput()));
      const dlg = document.querySelector("dialog") as HTMLDialogElement;
      vv.height = 480; // 키패드 320px
      act(() => listeners["resize"]?.forEach((f) => f()));
      expect(dlg.style.getPropertyValue("--mf-kb")).toBe("320px");
      vv.height = 800;
      act(() => listeners["resize"]?.forEach((f) => f()));
      expect(dlg.style.getPropertyValue("--mf-kb")).toBe("0px");
      // 주소창 정도의 작은 변화는 키패드로 보지 않는다.
      vv.height = 740;
      act(() => listeners["resize"]?.forEach((f) => f()));
      expect(dlg.style.getPropertyValue("--mf-kb")).toBe("0px");
    } finally {
      clientHeight.mockRestore();
      Object.defineProperty(window, "visualViewport", { value: undefined, configurable: true });
    }
  });
});

describe("Home 월드 청크 미리 받기·room-enter 표식 (06-21, 3초 측정 시작점)", () => {
  const roomEnterMarks = (spy: { mock: { calls: unknown[][] } }) => spy.mock.calls.filter(([name]) => name === "room-enter");

  it("처음 그려질 때 월드 청크를 한 번 미리 받는다", () => {
    render(<Home onEnterRoom={vi.fn()} />);
    expect(preloadWorldMock).toHaveBeenCalledTimes(1);
  });

  it("방 만들기가 성공하면 onEnterRoom 바로 앞에서 room-enter 표식을 한 번 찍는다", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ code: "0042", token: TOKEN, seat: 0 }), { status: 201 })));
    const mark = vi.spyOn(performance, "mark");
    const onEnter = vi.fn();
    render(<Home onEnterRoom={onEnter} />);
    fireEvent.click(createRoomButton());
    type(nicknameInput(), "민수");
    fireEvent.click(submitCreate());
    await waitFor(() => expect(onEnter).toHaveBeenCalledTimes(1));
    expect(roomEnterMarks(mark).length).toBe(1);
    const markOrder = mark.mock.invocationCallOrder[mark.mock.calls.findIndex(([name]) => name === "room-enter")];
    expect(markOrder).toBeLessThan(onEnter.mock.invocationCallOrder[0]);
    mark.mockRestore();
  });

  it("코드 참가가 성공하면 room-enter 표식을 onEnterRoom 앞에 한 번 찍는다", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ token: TOKEN, seat: 2 }), { status: 200 })));
    const mark = vi.spyOn(performance, "mark");
    const onEnter = vi.fn();
    render(<Home onEnterRoom={onEnter} />);
    type(codeInput(), "0042");
    fireEvent.click(joinCodeButton());
    type(nicknameInput(), "민수");
    fireEvent.click(submitJoin());
    await waitFor(() => expect(onEnter).toHaveBeenCalledTimes(1));
    expect(roomEnterMarks(mark).length).toBe(1);
    const markOrder = mark.mock.invocationCallOrder[mark.mock.calls.findIndex(([name]) => name === "room-enter")];
    expect(markOrder).toBeLessThan(onEnter.mock.invocationCallOrder[0]);
    mark.mockRestore();
  });

  it("만들기·참가가 실패하면 room-enter 표식이 없다", async () => {
    const mark = vi.spyOn(performance, "mark");
    vi.stubGlobal("fetch", apiError("CODE_EXHAUSTED", 503));
    const onEnter = vi.fn();
    const { unmount } = render(<Home onEnterRoom={onEnter} />);
    fireEvent.click(createRoomButton());
    type(nicknameInput(), "민수");
    fireEvent.click(submitCreate());
    await screen.findByRole("status");
    unmount();
    vi.stubGlobal("fetch", apiError("ROOM_NOT_FOUND", 404));
    render(<Home onEnterRoom={onEnter} />);
    type(codeInput(), "4827");
    fireEvent.click(joinCodeButton());
    type(nicknameInput(), "민수");
    fireEvent.click(submitJoin());
    await screen.findByRole("alert");
    expect(onEnter).not.toHaveBeenCalled();
    expect(roomEnterMarks(mark).length).toBe(0);
    mark.mockRestore();
  });

  it("저장된 토큰으로 바로 들어가는 길은 표식을 찍지 않는다(응답을 기다리지 않아 3초 측정 대상이 아니다)", () => {
    saveSession({ code: "0042", token: TOKEN });
    const mark = vi.spyOn(performance, "mark");
    const onEnter = vi.fn();
    render(<Home onEnterRoom={onEnter} />);
    type(codeInput(), "0042");
    fireEvent.click(joinCodeButton());
    expect(onEnter).toHaveBeenCalledWith("0042", TOKEN);
    expect(roomEnterMarks(mark).length).toBe(0);
    mark.mockRestore();
  });
});
