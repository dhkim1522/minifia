/// <reference types="node" />
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { StrictMode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import "../helpers/singleLineErrors";
import { ConfirmSheet } from "../../src/components/ConfirmSheet";
import { Sheet } from "../../src/components/Sheet";
import { ShareSheet } from "../../src/components/ShareSheet";
import { buildShareText } from "../../src/net/share";
import type { ShareNavigator } from "../../src/net/share";
import sheetCss from "../../src/styles/sheet.css?raw";
import confirmSource from "../../src/components/ConfirmSheet.tsx?raw";
import shareSource from "../../src/components/ShareSheet.tsx?raw";

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

describe("ShareSheet — C-03 친구 초대하기 (ROOM-01, R10)", () => {
  const flush = () =>
    act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
  const setup = (nav: ShareNavigator, over: Partial<Parameters<typeof ShareSheet>[0]> = {}) => {
    const onClose = vi.fn();
    const utils = render(<ShareSheet code="0042" hostNickname="민수" full={false} onClose={onClose} origin="https://x" nav={nav} {...over} />);
    return { onClose, ...utils };
  };
  const linkInput = () => screen.getByLabelText("초대 링크") as HTMLInputElement;

  it("제목 '친구 초대하기', 방 코드 0042, 읽기 전용 링크 칸에 https://x/r/0042 (토큰·쿼리 없음)", () => {
    setup({});
    expect(screen.getByRole("heading", { name: "친구 초대하기" })).toBeTruthy();
    expect(screen.getByText("0042")).toBeTruthy();
    expect(linkInput().readOnly).toBe(true);
    expect(linkInput().value).toBe("https://x/r/0042");
    expect(linkInput().value).not.toMatch(/[?#]|token/i);
  });

  it("[닫기] 가 있다(showClose)", () => {
    setup({});
    expect(screen.getByRole("button", { name: "닫기" })).toBeTruthy();
  });

  it("nav.share 가 있으면 [공유하기] 를 누르는 즉시(첫 await 앞) share 가 title·text·url 만으로 한 번 불린다", () => {
    const share = vi.fn().mockResolvedValue(undefined);
    setup({ share });
    fireEvent.click(screen.getByRole("button", { name: "공유하기" }));
    expect(share).toHaveBeenCalledTimes(1);
    expect(share).toHaveBeenCalledWith({ title: "Minifia", text: buildShareText("민수", "0042"), url: "https://x/r/0042" });
  });

  it("공유를 취소해도(AbortError) 아무 표시도 없고 시트는 그대로다", async () => {
    const share = vi.fn().mockRejectedValue(Object.assign(new Error("x"), { name: "AbortError" }));
    const { onClose } = setup({ share });
    fireEvent.click(screen.getByRole("button", { name: "공유하기" }));
    await flush();
    expect(screen.queryByText("길게 눌러 복사하세요")).toBeNull();
    expect(screen.queryByRole("status")).toBeNull();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("nav.share 가 없으면 [공유하기] 가 없고 [링크 복사] 만 보인다", () => {
    setup({ clipboard: { writeText: vi.fn() } });
    expect(screen.queryByRole("button", { name: "공유하기" })).toBeNull();
    expect(screen.getByRole("button", { name: "링크 복사" })).toBeTruthy();
  });

  it("[링크 복사] 성공 → 즉시 writeText(url), 버튼이 2초 동안 '복사했어요' 였다가 '링크 복사' 로 돌아오고 시트는 닫히지 않는다", async () => {
    vi.useFakeTimers();
    const writeText = vi.fn().mockResolvedValue(undefined);
    const { onClose } = setup({ clipboard: { writeText } });
    fireEvent.click(screen.getByRole("button", { name: "링크 복사" }));
    expect(writeText).toHaveBeenCalledTimes(1);
    expect(writeText).toHaveBeenCalledWith("https://x/r/0042");
    await flush();
    expect(screen.getByRole("button", { name: "복사했어요" })).toBeTruthy();
    advance(1999);
    expect(screen.queryByRole("button", { name: "복사했어요" })).not.toBeNull();
    advance(1);
    expect(screen.queryByRole("button", { name: "링크 복사" })).not.toBeNull();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("복사가 실패하면 링크 칸이 전체 선택되고 '길게 눌러 복사하세요' 가 보인다", async () => {
    const writeText = vi.fn().mockRejectedValue(Object.assign(new Error("x"), { name: "NotAllowedError" }));
    setup({ clipboard: { writeText } });
    fireEvent.click(screen.getByRole("button", { name: "링크 복사" }));
    await flush();
    expect(screen.getByText("길게 눌러 복사하세요")).toBeTruthy();
    const input = linkInput();
    expect(document.activeElement).toBe(input);
    expect(input.selectionStart).toBe(0);
    expect(input.selectionEnd).toBe(input.value.length);
  });

  it("링크 칸에 포커스하면 전체 선택된다", () => {
    setup({});
    const input = linkInput();
    fireEvent.focus(input);
    expect(input.selectionStart).toBe(0);
    expect(input.selectionEnd).toBe(input.value.length);
  });

  it("full 이면 맨 위에 '방이 가득 찼어요', 아니면 없다", () => {
    const { unmount } = setup({}, { full: true });
    expect(screen.getByText("방이 가득 찼어요")).toBeTruthy();
    unmount();
    setup({});
    expect(screen.queryByText("방이 가득 찼어요")).toBeNull();
  });
});

describe("진홍 금지 (파괴 동작·공유 시트)", () => {
  it("sheet.css·ConfirmSheet·ShareSheet 소스에 진홍이나 hex 색이 없다", () => {
    for (const src of [sheetCss, confirmSource, shareSource]) {
      expect(src).not.toMatch(/crimson/i);
      expect(src).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    }
  });
});

// ---- G-01-9 시트 진입 모션 (UAT Test 9, D-19 개정) ----
// 폰(iOS Safari)에서 [내 역할] 시트가 "위에 잠깐 떴다가 아래로 떨어지는" 증상.
// 가설: showModal 직후 첫 프레임이 최종 위치로 그려진 뒤 animation 이 시작된다.
// 고침: 진입 전 초기 위치를 CSS 로 아래에 고정하고, 두 프레임 뒤에 열림 클래스를 붙여 전환으로 올라오게 한다.

// 위의 `sheet.css?raw` 는 vitest 가 CSS 를 처리하지 않아 빈 문자열이 된다(css.include 기본값). 규칙 값은 파일을 직접 읽어 본다.
const sheetCssSource = readFileSync("src/styles/sheet.css", "utf8");

/** 주석을 지운 CSS 에서 선택자가 규칙 시작부터 정확히 일치하는 블록의 선언 값을 찾는다. 없으면 undefined. */
function cssDecl(selector: string, prop: string): string | undefined {
  const css = sheetCssSource.replace(/\/\*[\s\S]*?\*\//g, "");
  const re = /(?<=^|\})\s*([^{}]+?)\s*\{([^{}]*)\}/g;
  for (const m of css.matchAll(re)) {
    if (m[1] !== selector) continue;
    for (const decl of m[2].split(";")) {
      const at = decl.indexOf(":");
      if (at < 0) continue;
      if (decl.slice(0, at).trim() === prop) return decl.slice(at + 1).trim();
    }
  }
  return undefined;
}

/** 규칙 안에 animation 으로 시작하는 선언이 하나라도 있는지. */
function hasAnimationDecl(selector: string): boolean {
  const css = sheetCssSource.replace(/\/\*[\s\S]*?\*\//g, "");
  const re = /(?<=^|\})\s*([^{}]+?)\s*\{([^{}]*)\}/g;
  for (const m of css.matchAll(re)) {
    if (m[1] === selector && /(^|;)\s*animation[\w-]*\s*:/.test(m[2])) return true;
  }
  return false;
}

/** requestAnimationFrame 을 콜백 쌓기 가짜로 갈아 끼운다. 한 프레임씩 직접 실행한다. */
function stubFrames() {
  const frames: FrameRequestCallback[] = [];
  const cancel = vi.fn();
  vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
    frames.push(cb);
    return frames.length;
  });
  vi.stubGlobal("cancelAnimationFrame", cancel);
  const runFrame = () =>
    act(() => {
      frames.shift()?.(0);
    });
  return { frames, cancel, runFrame };
}

const isOpenClass = (dlg: HTMLDialogElement) => dlg.classList.contains("mf-dialog--open");

describe("G-01-9 시트 진입 모션 — CSS 값 규칙", () => {
  it("G-01-9: sheet.css 를 실제로 읽었다(빈 문자열이 아니다)", () => {
    expect(sheetCssSource.length > 0).toBe(true);
  });

  it("G-01-9: 시트의 진입 전 초기 위치는 CSS 로 아래에 고정된다", () => {
    expect(cssDecl(".mf-sheet", "transform")).toBe("translateY(100%)");
  });

  it("G-01-9: 열림 클래스가 붙으면 시트는 제자리(0), 막은 불투명(1)이고 막의 기본은 투명(0)이다", () => {
    expect(cssDecl(".mf-dialog--open .mf-sheet", "transform")).toBe("translateY(0)");
    expect(cssDecl(".mf-dialog--open .mf-sheet-scrim", "opacity")).toBe("1");
    expect(cssDecl(".mf-sheet-scrim", "opacity")).toBe("0");
  });

  it("G-01-9: 진입이 CSS animation 하나에 의존하지 않고 transform 전환으로 한다", () => {
    expect(hasAnimationDecl(".mf-sheet")).toBe(false);
    expect(hasAnimationDecl(".mf-sheet-scrim")).toBe(false);
    expect((cssDecl(".mf-sheet", "transition") ?? "").includes("transform")).toBe(true);
    expect(cssDecl(".mf-sheet--closing", "transform")).toBe("translateY(100%)");
  });
});

describe("G-01-9 Sheet 열림 클래스 시점", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("G-01-9: 시트는 열린 직후 진입 전 상태이고 두 프레임 뒤 열림 클래스가 붙는다", () => {
    const { runFrame } = stubFrames();
    const { container } = render(
      <Sheet label="내 역할" onClose={() => {}}>
        <p>내용</p>
      </Sheet>,
    );
    const dlg = dialogOf(container);
    expect(dlg.open).toBe(true);
    expect(isOpenClass(dlg)).toBe(false);
    runFrame();
    expect(isOpenClass(dlg)).toBe(false);
    runFrame();
    expect(isOpenClass(dlg)).toBe(true);
  });
});

describe("G-01-9 Sheet 안전장치", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  const plain = (onClose: () => void = () => {}) => (
    <Sheet label="내 역할" onClose={onClose}>
      <p>내용</p>
    </Sheet>
  );

  it("G-01-9: 프레임이 오지 않아도 60ms 폴백으로 열림 클래스가 붙는다 (T-01-58)", () => {
    vi.useFakeTimers();
    stubFrames(); // 콜백을 쌓기만 하고 실행하지 않는다(숨겨진 탭 흉내)
    const { container } = render(plain());
    const dlg = dialogOf(container);
    expect(isOpenClass(dlg)).toBe(false);
    advance(59);
    expect(isOpenClass(dlg)).toBe(false);
    advance(1);
    expect(isOpenClass(dlg)).toBe(true);
  });

  it("G-01-9: 열린 뒤 Esc 를 누르면 열림 클래스가 빠지고 닫는 중 클래스가 생기며 260ms 뒤 onClose 한 번", () => {
    vi.useFakeTimers();
    stubFrames();
    const onClose = vi.fn();
    const { container } = render(plain(onClose));
    const dlg = dialogOf(container);
    advance(60);
    expect(isOpenClass(dlg)).toBe(true);
    pressEsc(dlg);
    expect(isOpenClass(dlg)).toBe(false);
    expect(dlg.classList.contains("mf-dialog--closing")).toBe(true);
    expect(container.querySelector(".mf-sheet--closing") !== null).toBe(true);
    advance(260);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("G-01-9: 열리기 전에 Esc 를 눌러도 열림 클래스는 한 번도 붙지 않고 260ms 뒤 onClose 한 번이다", () => {
    vi.useFakeTimers();
    const { runFrame } = stubFrames();
    const onClose = vi.fn();
    const { container } = render(plain(onClose));
    const dlg = dialogOf(container);
    pressEsc(dlg);
    expect(isOpenClass(dlg)).toBe(false);
    runFrame();
    runFrame(); // 닫는 중에 프레임이 와도 무시한다
    expect(isOpenClass(dlg)).toBe(false);
    advance(260);
    expect(onClose).toHaveBeenCalledTimes(1);
    advance(1000);
    expect(isOpenClass(dlg)).toBe(false);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("G-01-9: 마운트 직후 언마운트하면 프레임 요청을 취소하고 남는 타이머가 없다", () => {
    vi.useFakeTimers();
    const { cancel } = stubFrames();
    const { unmount } = render(plain());
    unmount();
    expect(cancel.mock.calls.length > 0).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
    expect(() => advance(1000)).not.toThrow();
  });

  it("G-01-9: 열린 직후 포커스는 preventScroll 로 준다", () => {
    stubFrames();
    const focus = vi.spyOn(HTMLElement.prototype, "focus");
    const { unmount } = render(
      <Sheet label="a" onClose={() => {}} showClose>
        <p>x</p>
      </Sheet>,
    );
    expect(focus.mock.calls.length > 0).toBe(true);
    expect(focus.mock.calls[0]?.[0]?.preventScroll).toBe(true);
    unmount();
    focus.mockClear();
    render(<ConfirmSheet title="방에서 나갈까요?" confirmLabel="나가기" onConfirm={() => {}} onClose={() => {}} />);
    expect(focus.mock.calls.length > 0).toBe(true);
    expect(focus.mock.calls[0]?.[0]?.preventScroll).toBe(true);
  });

  it.each([
    ["ConfirmSheet", () => <ConfirmSheet title="방에서 나갈까요?" confirmLabel="나가기" onConfirm={() => {}} onClose={() => {}} />],
    ["ShareSheet", () => <ShareSheet code="0042" hostNickname="민수" full={false} onClose={() => {}} origin="https://x" nav={{}} />],
  ])("G-01-9: %s 도 같은 틀이라 열린 직후엔 진입 전 상태이고 두 프레임 뒤 열림 클래스가 붙는다", (_name, make) => {
    const { runFrame } = stubFrames();
    const { container } = render(make());
    const dlg = dialogOf(container);
    expect(isOpenClass(dlg)).toBe(false);
    runFrame();
    expect(isOpenClass(dlg)).toBe(false);
    runFrame();
    expect(isOpenClass(dlg)).toBe(true);
  });
});

describe("G-01-9 다이얼로그 자동 스크롤 차단 (실기기 패널: 시트 아래끝이 다이얼로그 아래끝보다 위로 갔다 돌아옴)", () => {
  it(".mf-dialog 는 overflow: clip 으로 포커스 이동에 의한 스크롤을 막는다", () => {
    const css = sheetCssSource.replace(/\/\*[\s\S]*?\*\//g, "");
    const block = css.match(/\.mf-dialog\s*\{([^{}]*)\}/)?.[1] ?? "";
    expect(block).toMatch(/overflow:\s*clip/);
  });
});
