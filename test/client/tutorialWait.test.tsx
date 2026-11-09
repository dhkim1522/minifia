import { act, cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "../helpers/singleLineErrors";
import type { PublicPlayer, RoomView } from "../../shared/protocol";
import { TutorialWait } from "../../src/components/v2/TutorialWait";

// 17-07: 함께 진행 기다림 화면 — 사람 원·n / N·시간 막대·팁. 값은 서버 공개 값 view.tutorial 뿐이다(UI Considerations #18·#19·#20).
const NOW = 1_700_000_000_000;

function makeView(done: number, total: number, endsAt = NOW + 60_000): RoomView {
  const players: PublicPlayer[] = Array.from({ length: total }, (_, seat) => ({ seat, nickname: `사람${seat}`, connected: true, isHost: seat === 0 }));
  return {
    code: "0042",
    round: 1,
    phase: "tutorial",
    phaseEndsAt: endsAt,
    phaseDurationMs: 150_000,
    serverNow: NOW,
    minPlayers: 4,
    maxPlayers: 8,
    players,
    me: { seat: 0, isHost: true, tutorialDone: true },
    tutorial: { done, total, endsAt },
  };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const q = (c: ParentNode, sel: string) => c.querySelector<HTMLElement>(sel);

describe("TutorialWait — 기다림 화면 (17-07, TUT-02)", () => {
  it("제목·문구·사람 원 5개(끝 2개는 체크 표시)·aria-label·n / N", () => {
    const { container } = render(<TutorialWait view={makeView(2, 5)} offset={0} />);
    expect(container.textContent).toContain("곧 진짜 사건이 시작돼요");
    expect(container.textContent).toContain("다른 사람을 기다리는 중…");
    const people = q(container, "[data-tutorial-people]")!;
    expect(people.getAttribute("role")).toBe("img");
    expect(people.getAttribute("aria-label")).toBe("5명 중 2명 끝냄");
    const dots = people.querySelectorAll(".tut-wait__dot");
    expect(dots).toHaveLength(5);
    expect(people.querySelectorAll(".tut-wait__dot.is-done")).toHaveLength(2);
    expect(people.querySelectorAll(".tut-wait__dot.is-done svg")).toHaveLength(2);
    expect(q(container, "[data-tutorial-count]")?.getAttribute("data-tutorial-count")).toBe("2/5");
    expect(q(container, "[data-tutorial-count]")?.textContent).toBe("2 / 5");
  });

  it("시간: role=timer 안 '60초', 막대 채움 비율 60000/150000, 시간이 지나면 줄어든다", () => {
    const { container } = render(<TutorialWait view={makeView(2, 5)} offset={0} />);
    const timer = q(container, "[role=timer]")!;
    expect(timer.textContent).toContain("60초");
    expect(q(container, "[data-tutorial-bar]")!.style.width).toBe("40%");
    act(() => {
      vi.advanceTimersByTime(30_000);
    });
    expect(q(container, "[role=timer]")!.textContent).toContain("30초");
    expect(q(container, "[data-tutorial-bar]")!.style.width).toBe("20%");
  });

  it("마감이 지나면 0초·빈 막대에 머문다(화면이 먼저 넘기지 않는다)", () => {
    const { container } = render(<TutorialWait view={makeView(1, 3, NOW - 1000)} offset={0} />);
    expect(q(container, "[role=timer]")!.textContent).toContain("0초");
    expect(q(container, "[data-tutorial-bar]")!.style.width).toBe("0%");
    expect(q(container, "[data-tutorial-wait]")).not.toBeNull();
  });

  it("6명 이상이면 두 줄 모양(최대 8), 5명 이하는 한 줄", () => {
    const six = render(<TutorialWait view={makeView(0, 6)} offset={0} />);
    expect(q(six.container, "[data-tutorial-people]")!.classList.contains("is-two-rows")).toBe(true);
    expect(six.container.querySelectorAll(".tut-wait__dot")).toHaveLength(6);
    six.unmount();
    const nine = render(<TutorialWait view={makeView(0, 9)} offset={0} />);
    expect(nine.container.querySelectorAll(".tut-wait__dot")).toHaveLength(8);
    expect(q(nine.container, "[data-tutorial-count]")?.textContent).toBe("0 / 9");
    nine.unmount();
    const one = render(<TutorialWait view={makeView(0, 1)} offset={0} />);
    expect(q(one.container, "[data-tutorial-people]")!.classList.contains("is-two-rows")).toBe(false);
    expect(one.container.querySelectorAll(".tut-wait__dot")).toHaveLength(1);
  });

  describe("팁 두 장 — 남는 높이가 모자라면 통째로 숨긴다 (T-17)", () => {
    const stubLayout = (roomH: number, cardTop: number, cardH: number) => {
      vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockImplementation(function (this: HTMLElement) {
        return this.hasAttribute("data-tutorial-wait") ? roomH : 0;
      });
      vi.spyOn(HTMLElement.prototype, "offsetTop", "get").mockImplementation(function (this: HTMLElement) {
        return this.hasAttribute("data-tutorial-card") ? cardTop : 0;
      });
      vi.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockImplementation(function (this: HTMLElement) {
        return this.hasAttribute("data-tutorial-card") ? cardH : 0;
      });
    };

    it("남는 높이가 넉넉하면 팁 두 장(고정 문구)이 있다", () => {
      stubLayout(800, 100, 300);
      const { container } = render(<TutorialWait view={makeView(1, 4)} offset={0} />);
      const tips = container.querySelectorAll("[data-tutorial-tip]");
      expect(tips).toHaveLength(2);
      expect(container.textContent).toContain("심부름 때 누구를 봤는지 기억해요");
      expect(container.textContent).toContain("아침 흔적은 옷과 이어져요");
    });

    it("작게 모킹하면 팁 묶음이 통째로 없다(한 장만 남지 않는다)", () => {
      stubLayout(480, 100, 300);
      const { container } = render(<TutorialWait view={makeView(1, 4)} offset={0} />);
      expect(container.querySelectorAll("[data-tutorial-tip]")).toHaveLength(0);
      expect(container.textContent).not.toContain("아침 흔적은 옷과 이어져요");
    });

    it("경계: 남는 높이가 정확히 96 + 24 + 아래 여백 24 면 보이고 1 모자라면 숨는다", () => {
      stubLayout(100 + 300 + 24 + 120, 100, 300);
      const on = render(<TutorialWait view={makeView(1, 4)} offset={0} />);
      expect(on.container.querySelectorAll("[data-tutorial-tip]")).toHaveLength(2);
      on.unmount();
      cleanup();
      vi.restoreAllMocks();
      stubLayout(100 + 300 + 24 + 119, 100, 300);
      const off = render(<TutorialWait view={makeView(1, 4)} offset={0} />);
      expect(off.container.querySelectorAll("[data-tutorial-tip]")).toHaveLength(0);
    });
  });
});
