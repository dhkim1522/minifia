import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { StrictMode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import "../helpers/singleLineErrors";
import { ConfirmSheet } from "../../src/components/ConfirmSheet";
import { Sheet } from "../../src/components/Sheet";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const advance = (ms: number) =>
  act(() => {
    vi.advanceTimersByTime(ms);
  });

const dialogOf = (container: HTMLElement) => container.querySelector("dialog") as HTMLDialogElement;

// Esc 는 cancel 이벤트로 온다. 기본 동작(즉시 닫힘)을 막았는지 보려고 취소 가능한 이벤트를 직접 만든다.
const pressEsc = (dlg: HTMLDialogElement) => {
  const ev = new Event("cancel", { cancelable: true });
  fireEvent(dlg, ev);
  return ev;
};

describe("Sheet — <dialog> 하단 시트 틀 (C-01·C-03 공통, 리서치 Pattern 9)", () => {
  it("마운트하면 dialog 가 열려 있고 aria-label 이 label 이다", () => {
    const { container } = render(
      <Sheet label="내 역할" onClose={() => {}}>
        <p>내용</p>
      </Sheet>,
    );
    const dlg = dialogOf(container);
    expect(dlg.open).toBe(true);
    expect(dlg.getAttribute("aria-label")).toBe("내 역할");
    expect(screen.getByText("내용")).toBeTruthy();
  });

  it("showClose 면 aria-label '닫기' 버튼이 있고 아니면 없다", () => {
    const { rerender } = render(
      <Sheet label="a" onClose={() => {}} showClose>
        <p>x</p>
      </Sheet>,
    );
    expect(screen.queryByRole("button", { name: "닫기" })).not.toBeNull();
    rerender(
      <Sheet label="a" onClose={() => {}}>
        <p>x</p>
      </Sheet>,
    );
    expect(screen.queryByRole("button", { name: "닫기" })).toBeNull();
  });

  it("Esc(cancel) 는 기본 닫힘을 막고 260ms 뒤 onClose 를 한 번 부른다", () => {
    vi.useFakeTimers();
    const onClose = vi.fn();
    const { container } = render(
      <Sheet label="a" onClose={onClose}>
        <p>x</p>
      </Sheet>,
    );
    const ev = pressEsc(dialogOf(container));
    expect(ev.defaultPrevented).toBe(true);
    expect(onClose).not.toHaveBeenCalled();
    expect(container.querySelector(".mf-sheet--closing") !== null).toBe(true);
    advance(259);
    expect(onClose).not.toHaveBeenCalled();
    advance(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("막(.mf-sheet-scrim) 누르기·[닫기] 도 같은 닫기이고, 닫히는 중에 또 눌러도 onClose 는 한 번이다", () => {
    vi.useFakeTimers();
    const onClose = vi.fn();
    const { container } = render(
      <Sheet label="a" onClose={onClose} showClose>
        <p>x</p>
      </Sheet>,
    );
    fireEvent.click(container.querySelector(".mf-sheet-scrim")!);
    fireEvent.click(screen.getByRole("button", { name: "닫기" }));
    pressEsc(dialogOf(container));
    advance(260);
    expect(onClose).toHaveBeenCalledTimes(1);
    advance(1000);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("animationend 가 오지 않아도(시간 폴백) 닫힌다 — 닫기 버튼", () => {
    vi.useFakeTimers();
    const onClose = vi.fn();
    render(
      <Sheet label="a" onClose={onClose} showClose>
        <p>x</p>
      </Sheet>,
    );
    fireEvent.click(screen.getByRole("button", { name: "닫기" }));
    advance(260);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("StrictMode 로 감싸도 예외 없이 열려 있다(showModal 을 두 번 부르지 않는다)", () => {
    const { container } = render(
      <StrictMode>
        <Sheet label="a" onClose={() => {}}>
          <p>x</p>
        </Sheet>
      </StrictMode>,
    );
    expect(dialogOf(container).open).toBe(true);
  });

  it("children 이 함수면 requestClose 를 받아 부르면 닫힌다", () => {
    vi.useFakeTimers();
    const onClose = vi.fn();
    render(
      <Sheet label="a" onClose={onClose}>
        {(requestClose) => (
          <button type="button" onClick={requestClose}>
            끝
          </button>
        )}
      </Sheet>,
    );
    fireEvent.click(screen.getByRole("button", { name: "끝" }));
    advance(260);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("initialFocusRef 가 있으면 열린 뒤 그 요소에 포커스가 간다", () => {
    const Probe = () => {
      const ref = { current: null as HTMLButtonElement | null };
      return (
        <Sheet label="a" onClose={() => {}} initialFocusRef={ref}>
          <button type="button">첫째</button>
          <button
            type="button"
            ref={(el) => {
              ref.current = el;
            }}
          >
            둘째
          </button>
        </Sheet>
      );
    };
    render(<Probe />);
    expect(document.activeElement?.textContent).toBe("둘째");
  });

  it("손잡이를 96px 넘게 끌어 놓으면 닫히고, 조금만 끌면 닫히지 않는다", () => {
    vi.useFakeTimers();
    const onClose = vi.fn();
    const { container } = render(
      <Sheet label="a" onClose={onClose}>
        <p>x</p>
      </Sheet>,
    );
    const handle = container.querySelector(".mf-sheet__handle") as HTMLElement;

    fireEvent.pointerDown(handle, { pointerId: 1, clientY: 400 });
    advance(300);
    fireEvent.pointerMove(handle, { pointerId: 1, clientY: 430 });
    advance(300);
    fireEvent.pointerUp(handle, { pointerId: 1, clientY: 430 });
    advance(500);
    expect(onClose).not.toHaveBeenCalled();

    fireEvent.pointerDown(handle, { pointerId: 2, clientY: 400 });
    advance(300);
    fireEvent.pointerMove(handle, { pointerId: 2, clientY: 520 });
    fireEvent.pointerUp(handle, { pointerId: 2, clientY: 520 });
    advance(260);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe("ConfirmSheet — 파괴 동작 확인 시트 (R17)", () => {
  const setup = (over: Partial<Parameters<typeof ConfirmSheet>[0]> = {}) => {
    const onConfirm = vi.fn();
    const onClose = vi.fn();
    const utils = render(<ConfirmSheet title="방에서 나갈까요?" confirmLabel="나가기" onConfirm={onConfirm} onClose={onClose} {...over} />);
    return { onConfirm, onClose, ...utils };
  };

  it("제목은 heading 이고 버튼은 [취소] 다음 [확인 문구] 순서이며 열리면 포커스가 [취소] 에 있다", () => {
    const { container } = setup();
    expect(screen.getByRole("heading", { name: "방에서 나갈까요?" })).toBeTruthy();
    const buttons = within(dialogOf(container)).getAllByRole("button");
    expect(buttons.map((b) => b.textContent)).toEqual(["취소", "나가기"]);
    expect(document.activeElement).toBe(buttons[0]);
  });

  it("[확인 문구] 를 누르면 onConfirm 한 번, 닫히는 동안 두 버튼이 꺼지고 260ms 뒤 onClose", () => {
    vi.useFakeTimers();
    const { onConfirm, onClose } = setup();
    fireEvent.click(screen.getByRole("button", { name: "나가기" }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect((screen.getByRole("button", { name: "취소" }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: "나가기" }) as HTMLButtonElement).disabled).toBe(true);
    advance(259);
    expect(onClose).not.toHaveBeenCalled();
    advance(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("[취소] 는 onConfirm 없이 닫고, cancelLabel 로 문구를 바꿀 수 있다", () => {
    vi.useFakeTimers();
    const { onConfirm, onClose } = setup({ cancelLabel: "아니요" });
    fireEvent.click(screen.getByRole("button", { name: "아니요" }));
    advance(260);
    expect(onConfirm).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("Esc 로 닫히는 동안에도 두 버튼이 꺼진다(그 사이 확인을 눌러도 onConfirm 이 가지 않는다)", () => {
    vi.useFakeTimers();
    const { onConfirm, container } = setup();
    pressEsc(dialogOf(container));
    fireEvent.click(screen.getByRole("button", { name: "나가기" }));
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("진홍을 쓰지 않는다: 파괴 동작 버튼은 보조(--gray-800) 면, [취소] 는 주 버튼", () => {
    setup();
    expect(screen.getByRole("button", { name: "나가기" }).className).toContain("mf-btn--secondary");
    expect(screen.getByRole("button", { name: "취소" }).className).toContain("mf-btn--primary");
  });
});
