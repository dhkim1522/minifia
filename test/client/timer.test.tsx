import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Timer } from "../../src/components/Timer";

// 서버 마감 20000, 단계 길이 15000. 시스템 시각 5000 에서 시작하면 15초가 남는다.
const ENDS = 20_000;
const DUR = 15_000;

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(5_000);
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

function bar(): HTMLElement {
  return document.querySelector(".mf-timer__fill") as HTMLElement;
}

describe("Timer", () => {
  it("남은 15초를 0:15 로 보여 주고 role=timer·aria-label 을 갖는다. aria-live 는 없다", () => {
    const { container } = render(<Timer endsAt={ENDS} durationMs={DUR} offset={0} />);
    const root = screen.getByRole("timer");
    expect(root.getAttribute("aria-label")).toBe("남은 시간 15초");
    expect(root.textContent).toBe("0:15");
    expect(root.hasAttribute("aria-live")).toBe(false);
    expect(container.querySelector("[aria-live]")).toBeNull();
    expect(root.className).not.toContain("mf-timer--urgent");
    expect(bar().style.transform).toBe("scaleX(1)");
  });

  it("10초가 흐르면 0:05 와 mf-timer--urgent(마지막 5초)가 된다", () => {
    render(<Timer endsAt={ENDS} durationMs={DUR} offset={0} />);
    act(() => {
      vi.advanceTimersByTime(10_000);
    });
    const root = screen.getByRole("timer");
    expect(root.textContent).toBe("0:05");
    expect(root.getAttribute("aria-label")).toBe("남은 시간 5초");
    expect(root.className).toContain("mf-timer--urgent");
  });

  it("calm 이면 남은 4초여도 mf-timer--urgent 가 없다. calm 이 없으면 지금처럼 urgent", () => {
    vi.setSystemTime(ENDS - 4_000);
    const calm = render(<Timer endsAt={ENDS} durationMs={DUR} offset={0} calm />);
    expect(screen.getByRole("timer").className.includes("mf-timer--urgent")).toBe(false);
    expect(screen.getByRole("timer").textContent).toBe("0:04");
    calm.unmount();
    render(<Timer endsAt={ENDS} durationMs={DUR} offset={0} />);
    expect(screen.getByRole("timer").className.includes("mf-timer--urgent")).toBe(true);
  });

  it("마감 뒤에는 0:00 과 빈 막대(scaleX(0))로 머물고 urgent 가 아니다", () => {
    render(<Timer endsAt={ENDS} durationMs={DUR} offset={0} />);
    act(() => {
      vi.advanceTimersByTime(20_000);
    });
    const root = screen.getByRole("timer");
    expect(root.textContent).toBe("0:00");
    expect(bar().style.transform).toBe("scaleX(0)");
    expect(root.className).not.toContain("mf-timer--urgent");
    // 더 흘러도 그대로다
    act(() => {
      vi.advanceTimersByTime(30_000);
    });
    expect(screen.getByRole("timer").textContent).toBe("0:00");
  });

  it("마감이 지나면 간격 타이머를 멈춘다", () => {
    render(<Timer endsAt={ENDS} durationMs={DUR} offset={0} />);
    expect(vi.getTimerCount()).toBeGreaterThan(0); // 마감 전에는 다시 그리는 간격 타이머가 돈다
    act(() => {
      vi.advanceTimersByTime(20_000);
    });
    expect(vi.getTimerCount()).toBe(0);
  });

  it("offset 이 0 → 2000 으로 바뀌면 그 값으로 다시 그린다(숫자가 2초 줄어든다)", () => {
    const { rerender } = render(<Timer endsAt={ENDS} durationMs={DUR} offset={0} />);
    expect(screen.getByRole("timer").textContent).toBe("0:15");
    rerender(<Timer endsAt={ENDS} durationMs={DUR} offset={2_000} />);
    expect(screen.getByRole("timer").textContent).toBe("0:13");
  });

  it("초가 바뀔 때마다 숫자 요소가 새로 만들어진다(timer-pop 이 다시 돈다)", () => {
    render(<Timer endsAt={ENDS} durationMs={DUR} offset={0} />);
    act(() => {
      vi.advanceTimersByTime(10_250);
    });
    const before = document.querySelector(".mf-timer__num");
    act(() => {
      vi.advanceTimersByTime(1_000);
    });
    const after = document.querySelector(".mf-timer__num");
    expect(after).not.toBe(before);
  });

  it("언마운트하면 간격 타이머와 visibilitychange 리스너를 정리한다", () => {
    const remove = vi.spyOn(document, "removeEventListener");
    const { unmount } = render(<Timer endsAt={ENDS} durationMs={DUR} offset={0} />);
    expect(vi.getTimerCount()).toBeGreaterThan(0);
    unmount();
    expect(vi.getTimerCount()).toBe(0);
    expect(remove.mock.calls.some(([type]) => type === "visibilitychange")).toBe(true);
  });

  it("탭이 다시 보이면(visibilitychange) 바로 다시 계산한다", () => {
    render(<Timer endsAt={ENDS} durationMs={DUR} offset={0} />);
    // 간격 타이머를 거치지 않고 시계만 앞으로 보낸다(화면이 꺼져 있던 동안과 같다)
    vi.setSystemTime(17_000);
    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });
    expect(screen.getByRole("timer").textContent).toBe("0:03");
  });
});
