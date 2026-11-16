// 24-07: TutorialFrame — 아래쪽 묶음(진행 점 10개 + 한 줄 알약)과 [그만두기] (UI-SPEC P24-23~25·28).
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TutorialFrame } from "../../src/components/tutorial/TutorialFrame";
import "../helpers/singleLineErrors";

afterEach(cleanup);

const base = { step: 3, pill: "답 없는 사람이 수상해요", place: "bottom" as const, onExit: () => {} };

describe("진행 점(P24-24)", () => {
  it("점 10개, role progressbar, aria-valuemin 1·max 10·valuenow = 장면 번호, 이름 '10단계 중 n단계'", () => {
    const { container } = render(<TutorialFrame {...base} />);
    const bar = screen.getByRole("progressbar");
    expect(bar.getAttribute("aria-valuemin")).toBe("1");
    expect(bar.getAttribute("aria-valuemax")).toBe("10");
    expect(bar.getAttribute("aria-valuenow")).toBe("3");
    expect(bar.getAttribute("aria-label")).toBe("10단계 중 3단계");
    expect(bar.hasAttribute("data-tutorial-dots")).toBe(true);
    expect(container.querySelectorAll("[data-tutorial-dots] > i")).toHaveLength(10);
  });

  it("지난 장면·지금 점만 켜진다(is-on), 장면 10 에서도 보인다", () => {
    const { container, rerender } = render(<TutorialFrame {...base} step={4} />);
    const on = () => [...container.querySelectorAll("[data-tutorial-dots] > i")].map((d) => d.classList.contains("is-on"));
    expect(on()).toEqual([true, true, true, true, false, false, false, false, false, false]);
    rerender(<TutorialFrame {...base} step={10} pill={null} />);
    expect(on().every(Boolean)).toBe(true);
    expect(screen.getByRole("progressbar").getAttribute("aria-valuenow")).toBe("10");
  });
});

describe("알약(P24-25)", () => {
  it("role status·aria-live polite·data-tutorial-pill, 글이 문구 그대로", () => {
    render(<TutorialFrame {...base} />);
    const pill = screen.getByRole("status");
    expect(pill.hasAttribute("data-tutorial-pill")).toBe(true);
    expect(pill.getAttribute("aria-live")).toBe("polite");
    expect(pill.textContent).toBe("답 없는 사람이 수상해요");
  });

  it("pill 이 null 이면 알약이 없다(장면 10) — 진행 점은 남는다", () => {
    const { container } = render(<TutorialFrame {...base} step={10} pill={null} />);
    expect(container.querySelector("[data-tutorial-pill]")).toBeNull();
    expect(screen.queryByRole("status")).toBeNull();
    expect(screen.getByRole("progressbar")).toBeTruthy();
  });
});

describe("[그만두기](P24-28)", () => {
  it("이름 '그만두기'·data-tutorial-exit·누르면 onExit", () => {
    const onExit = vi.fn();
    render(<TutorialFrame {...base} onExit={onExit} />);
    const btn = screen.getByRole("button", { name: "그만두기" });
    expect(btn.hasAttribute("data-tutorial-exit")).toBe(true);
    expect(btn.querySelector("svg")).not.toBeNull();
    fireEvent.click(btn);
    expect(onExit).toHaveBeenCalledTimes(1);
  });

  it("hideExit 면 단추가 없다(장면 10)", () => {
    render(<TutorialFrame {...base} hideExit />);
    expect(screen.queryByRole("button", { name: "그만두기" })).toBeNull();
  });
});

describe("묶음 위치 모드(P24-23)", () => {
  const stack = (c: ParentNode) => c.querySelector<HTMLElement>("[data-tutorial-stack]")!;

  it("aboveBottom: 패널 윗변 − 8 → bottom = bottomEdge + 8", () => {
    const { container } = render(<TutorialFrame {...base} place="aboveBottom" bottomEdge={222} />);
    expect(stack(container).style.bottom).toBe("230px");
    expect(stack(container).getAttribute("data-place")).toBe("aboveBottom");
  });

  it("bottom: 화면 아랫변 − 24(안전 영역 포함)", () => {
    const { container } = render(<TutorialFrame {...base} place="bottom" />);
    expect(stack(container).style.bottom).toContain("24px");
    expect(stack(container).style.bottom).toContain("safe-area-inset-bottom");
  });

  it("top: 띠 아랫변 B(123) + 8 = 131 에서 시작한다", () => {
    const { container } = render(<TutorialFrame {...base} place="top" />);
    expect(stack(container).style.top).toBe("131px");
    expect(stack(container).style.bottom).toBe("");
  });
});
