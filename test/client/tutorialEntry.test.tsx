import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
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
