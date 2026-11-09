import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "../helpers/singleLineErrors";
import { installMemoryStorage } from "../helpers/memoryStorage";
import { makeRig } from "../helpers/soundRig";
import { setEngineForTest } from "../../src/audio/unlock";
import { Home } from "../../src/screens/Home";

// 17-06: 첫 화면 튜토리얼 진입로(TUT-01, T-1·T-2·T-3·T-22).
// TutorialScreen 은 [data-tutorial-screen] 과 "끝"·"건너뛰기" 두 단추만 가진 가짜로 바꾼다(실제 화면은 17-04 시험이 맡는다).
// unlockAudio 는 호출 순서를 재려고 스파이로 바꾸고, 신호(emitSignal)도 스파이로 센다.

const { order, unlockSpy, signalSpy, sceneProps } = vi.hoisted(() => ({
  order: [] as string[],
  unlockSpy: vi.fn(),
  signalSpy: vi.fn(),
  sceneProps: [] as { mode: string; initialScene?: number }[],
}));

vi.mock("../../src/audio/unlock", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../src/audio/unlock")>()),
  unlockAudio: () => {
    order.push("unlock");
    unlockSpy();
  },
}));

vi.mock("../../src/audio/signals", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../src/audio/signals")>()),
  emitSignal: (signal: unknown) => signalSpy(signal),
}));

vi.mock("../../src/screens/TutorialScreen", () => ({
  TutorialScreen: (props: { mode: "solo" | "together"; onEnd(reason: "done" | "skipped"): void; initialScene?: number }) => {
    order.push("tutorial-mounted");
    sceneProps.push({ mode: props.mode, initialScene: props.initialScene });
    return (
      <div data-tutorial-screen="">
        <button type="button" onClick={() => props.onEnd("done")}>
          끝
        </button>
        <button type="button" onClick={() => props.onEnd("skipped")}>
          건너뛰기
        </button>
      </div>
    );
  },
}));

const SEEN = "minifia.tutorial.seen";
const codeInput = () => screen.getByLabelText("방 코드") as HTMLInputElement;
const entry = (container: HTMLElement, kind: "card" | "button") => container.querySelectorAll(`[data-tutorial-entry="${kind}"]`);

let engine: ReturnType<typeof makeRig>["engine"];

beforeEach(() => {
  installMemoryStorage();
  order.length = 0;
  sceneProps.length = 0;
  unlockSpy.mockClear();
  signalSpy.mockClear();
  const rig = makeRig();
  engine = rig.engine;
  setEngineForTest(engine);
  window.history.replaceState(null, "", "/");
});

afterEach(() => {
  cleanup();
  setEngineForTest(null);
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  window.history.replaceState(null, "", "/");
});

describe("첫 화면 큰 카드 (Task 1)", () => {
  it("처음 오면 .mf-entry__actions 의 첫 자식이 큰 카드 하나다: 글 세 줄과 접근성 이름", () => {
    const { container } = render(<Home onEnterRoom={vi.fn()} />);
    const cards = entry(container, "card");
    expect(cards.length).toBe(1);
    expect(entry(container, "button").length).toBe(0);
    const card = cards[0] as HTMLButtonElement;
    expect(card.tagName).toBe("BUTTON");
    expect(card.getAttribute("aria-label")).toBe("튜토리얼 진행");
    expect(card.textContent).toContain("처음이에요?");
    expect(card.textContent).toContain("튜토리얼 진행");
    expect(card.textContent).toContain("1분");
    expect(screen.getByRole("button", { name: "튜토리얼 진행" })).toBe(card);
    const actions = container.querySelector(".mf-entry__actions") as HTMLElement;
    expect(actions.firstElementChild).toBe(card);
    // 인물 그림은 장식이다
    expect((card.querySelector("img") as HTMLImageElement).getAttribute("alt")).toBe("");
  });

  it("Tab 순서는 카드 → 방 코드 칸 → [참가] → [방 만들기] (DOM 순서)", () => {
    const { container } = render(<Home onEnterRoom={vi.fn()} />);
    const actions = container.querySelector(".mf-entry__actions") as HTMLElement;
    const names = Array.from(actions.querySelectorAll("button, input")).map((el) => {
      if (el instanceof HTMLInputElement) return "방 코드";
      return el.getAttribute("aria-label") ?? el.textContent;
    });
    expect(names).toEqual(["튜토리얼 진행", "방 코드", "참가", "방 만들기"]);
  });

  it("카드를 누르면 같은 클릭에서 unlockAudio 가 먼저, 본 표시 저장, 혼자 하기가 열린다. 서버 요청은 0", () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const { container } = render(<Home onEnterRoom={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "방 만들기" }));
    fireEvent.change(screen.getByLabelText("닉네임"), { target: { value: "하윤" } });
    fireEvent.click(screen.getByRole("button", { name: "닫기" }));
    fireEvent.change(codeInput(), { target: { value: "1234" } });
    expect(window.localStorage.getItem(SEEN)).toBeNull();

    fireEvent.click(entry(container, "card")[0] as HTMLElement);

    expect(unlockSpy).toHaveBeenCalledTimes(1);
    expect(order.indexOf("unlock")).toBeLessThan(order.indexOf("tutorial-mounted"));
    expect(window.localStorage.getItem(SEEN)).toBe("1");
    expect(container.querySelector("[data-tutorial-screen]")).not.toBeNull();
    expect(sceneProps[0]).toEqual({ mode: "solo", initialScene: undefined });
    expect(screen.queryByRole("button", { name: "방 만들기" })).toBeNull();
    expect(screen.queryByLabelText("방 코드")).toBeNull();
    expect(entry(container, "card").length).toBe(0);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("[건너뛰기]하면 닉네임·방 코드가 그대로인 첫 화면에 작은 단추가 보이고 마무리 카드는 없다", () => {
    const { container, unmount } = render(<Home onEnterRoom={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "방 만들기" }));
    fireEvent.change(screen.getByLabelText("닉네임"), { target: { value: "하윤" } });
    fireEvent.click(screen.getByRole("button", { name: "닫기" }));
    fireEvent.change(codeInput(), { target: { value: "1234" } });
    fireEvent.click(entry(container, "card")[0] as HTMLElement);

    fireEvent.click(screen.getByRole("button", { name: "건너뛰기" }));

    expect(container.querySelector("[data-tutorial-screen]")).toBeNull();
    expect(container.querySelector("[data-tutorial-end]")).toBeNull();
    expect(codeInput().value).toBe("1234");
    fireEvent.click(screen.getByRole("button", { name: "방 만들기" }));
    expect((screen.getByLabelText("닉네임") as HTMLInputElement).value).toBe("하윤");
    fireEvent.click(screen.getByRole("button", { name: "닫기" }));
    expect(entry(container, "card").length).toBe(0);
    const small = entry(container, "button");
    expect(small.length).toBe(1);
    expect(small[0]!.classList.contains("tut-entry--button")).toBe(true);
    expect(small[0]!.getAttribute("aria-label")).toBe("튜토리얼 진행");
    expect((screen.getByRole("button", { name: "방 만들기" }) as HTMLButtonElement).disabled).toBe(false);
    expect((screen.getByRole("button", { name: "참가" }) as HTMLButtonElement).disabled).toBe(false);

    // 다시 마운트해도 작은 단추
    unmount();
    const again = render(<Home onEnterRoom={vi.fn()} />);
    expect(entry(again.container, "card").length).toBe(0);
    expect(entry(again.container, "button").length).toBe(1);
  });

  it("작은 단추를 눌러도 같은 규칙(unlockAudio → 혼자 하기)이다", () => {
    window.localStorage.setItem(SEEN, "1");
    const { container } = render(<Home onEnterRoom={vi.fn()} />);
    fireEvent.click(entry(container, "button")[0] as HTMLElement);
    expect(unlockSpy).toHaveBeenCalledTimes(1);
    expect(container.querySelector("[data-tutorial-screen]")).not.toBeNull();
  });

  it("?test=1 첫 화면에는 카드도 작은 단추도 없다", () => {
    window.history.replaceState(null, "", "/?test=1");
    const { container } = render(<Home onEnterRoom={vi.fn()} />);
    expect(container.querySelectorAll("[data-tutorial-entry]").length).toBe(0);
    expect(screen.getByRole("button", { name: "방 만들기" })).toBeTruthy();
  });
});

// ---- Task 2: 마무리 카드(장면 8)·[다시 보기]·방 입장 때 본 표시 ----

const TOKEN = "t".repeat(43);

describe("마무리 카드 (Task 2, T-1)", () => {
  function finishTutorial(container: HTMLElement) {
    fireEvent.click(entry(container, "card")[0] as HTMLElement);
    fireEvent.click(screen.getByRole("button", { name: "끝" }));
  }

  it("끝까지 보면 큰 카드 자리에 마무리 카드가 하나 뜨고 tut.warm 이 한 번 나며 입력은 남는다", () => {
    const play = vi.spyOn(engine, "play");
    const { container } = render(<Home onEnterRoom={vi.fn()} />);
    fireEvent.change(codeInput(), { target: { value: "1234" } });
    finishTutorial(container);

    expect(container.querySelector("[data-tutorial-screen]")).toBeNull();
    const ends = container.querySelectorAll("[data-tutorial-end]");
    expect(ends.length).toBe(1);
    expect(ends[0]!.textContent).toContain("이제 진짜 사건으로");
    expect(ends[0]!.textContent).toContain("목격과 흔적으로 거짓말을 잡아요");
    expect(screen.getByRole("button", { name: "다시 보기" }).hasAttribute("data-tutorial-replay")).toBe(true);
    expect(play.mock.calls.filter(([id]) => id === "tut.warm").length).toBe(1);
    // 큰 카드 자리에 대신 놓인다(진입 카드·작은 단추는 같은 때에 없다)
    expect(container.querySelectorAll("[data-tutorial-entry]").length).toBe(0);
    const actions = container.querySelector(".mf-entry__actions") as HTMLElement;
    expect(actions.firstElementChild).toBe(ends[0]);
    expect(codeInput().value).toBe("1234");
    expect((screen.getByRole("button", { name: "방 만들기" }) as HTMLButtonElement).disabled).toBe(false);
    expect((screen.getByRole("button", { name: "참가" }) as HTMLButtonElement).disabled).toBe(false);
  });

  it("[다시 보기]는 장면 1 부터 다시(initialScene 없음) 열고 ui.tap 신호를 낸다", () => {
    const { container } = render(<Home onEnterRoom={vi.fn()} />);
    finishTutorial(container);
    sceneProps.length = 0;
    signalSpy.mockClear();
    fireEvent.click(screen.getByRole("button", { name: "다시 보기" }));
    expect(signalSpy).toHaveBeenCalledWith({ kind: "tap" });
    expect(container.querySelector("[data-tutorial-screen]")).not.toBeNull();
    expect(container.querySelector("[data-tutorial-end]")).toBeNull();
    expect(sceneProps).toEqual([{ mode: "solo", initialScene: undefined }]);
  });

  it("마무리 카드는 첫 화면을 다시 마운트하면 사라지고 작은 단추가 된다", () => {
    const { container, unmount } = render(<Home onEnterRoom={vi.fn()} />);
    finishTutorial(container);
    unmount();
    const again = render(<Home onEnterRoom={vi.fn()} />);
    expect(again.container.querySelector("[data-tutorial-end]")).toBeNull();
    expect(entry(again.container, "button").length).toBe(1);
  });

  it("[건너뛰기]는 TUTORIAL_END_CARD_ON_SKIP 이 거짓이라 마무리 카드가 없다", () => {
    const { container } = render(<Home onEnterRoom={vi.fn()} />);
    fireEvent.click(entry(container, "card")[0] as HTMLElement);
    fireEvent.click(screen.getByRole("button", { name: "건너뛰기" }));
    expect(container.querySelector("[data-tutorial-end]")).toBeNull();
  });
});

describe("방 입장 때 본 표시 (Task 2, T-2)", () => {
  const type = (el: HTMLElement, value: string) => fireEvent.change(el, { target: { value } });

  it("방 만들기가 성공하면 onEnterRoom 직전에 본 표시가 저장된다", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ code: "0042", token: TOKEN, seat: 0 }), { status: 201 })));
    let seenAtEnter: string | null = "unset";
    const onEnter = vi.fn(() => {
      seenAtEnter = window.localStorage.getItem(SEEN);
    });
    render(<Home onEnterRoom={onEnter} />);
    expect(window.localStorage.getItem(SEEN)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "방 만들기" }));
    type(screen.getByLabelText("닉네임"), "민수");
    fireEvent.click(screen.getByRole("button", { name: "만들기" }));
    await waitFor(() => expect(onEnter).toHaveBeenCalledWith("0042", TOKEN));
    expect(seenAtEnter).toBe("1");
  });

  it("참가가 성공하면 onEnterRoom 직전에 본 표시가 저장된다", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ token: TOKEN, seat: 1 }), { status: 200 })));
    let seenAtEnter: string | null = "unset";
    const onEnter = vi.fn(() => {
      seenAtEnter = window.localStorage.getItem(SEEN);
    });
    render(<Home onEnterRoom={onEnter} />);
    type(codeInput(), "0042");
    fireEvent.click(screen.getByRole("button", { name: "참가" }));
    type(screen.getByLabelText("닉네임"), "민수");
    fireEvent.click(screen.getByRole("button", { name: "참가하기" }));
    await waitFor(() => expect(onEnter).toHaveBeenCalledWith("0042", TOKEN));
    expect(seenAtEnter).toBe("1");
  });

  it("저장된 입장 정보로 바로 돌아가는 분기도 본 표시를 남긴다", () => {
    window.localStorage.setItem("minifia:session", JSON.stringify({ code: "0042", token: TOKEN }));
    const onEnter = vi.fn();
    render(<Home onEnterRoom={onEnter} />);
    type(codeInput(), "0042");
    fireEvent.click(screen.getByRole("button", { name: "참가" }));
    expect(onEnter).toHaveBeenCalledWith("0042", TOKEN);
    expect(window.localStorage.getItem(SEEN)).toBe("1");
  });

  it("실패(닉네임 오류)에는 본 표시를 저장하지 않는다", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ error: "NICKNAME_TAKEN" }), { status: 409 })));
    const onEnter = vi.fn();
    render(<Home onEnterRoom={onEnter} />);
    fireEvent.click(screen.getByRole("button", { name: "방 만들기" }));
    type(screen.getByLabelText("닉네임"), "민수");
    fireEvent.click(screen.getByRole("button", { name: "만들기" }));
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20));
    });
    expect(onEnter).not.toHaveBeenCalled();
    expect(window.localStorage.getItem(SEEN)).toBeNull();
  });
});
