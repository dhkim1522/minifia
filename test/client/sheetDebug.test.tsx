import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import "../helpers/singleLineErrors";
import { MemoryStorage } from "../helpers/memoryStorage";
import { Sheet } from "../../src/components/Sheet";
import { getSheetProbe, initSheetDebug, setSheetProbe, sheetDebugEnabled } from "../../src/debug/sheetProbe";
import type { SheetMark, SheetProbe } from "../../src/debug/sheetProbe";

const advance = (ms: number) =>
  act(() => {
    vi.advanceTimersByTime(ms);
  });

const dialogOf = (container: HTMLElement) => container.querySelector("dialog") as HTMLDialogElement;

const pressEsc = (dlg: HTMLDialogElement) => {
  const ev = new Event("cancel", { cancelable: true });
  fireEvent(dlg, ev);
  return ev;
};

/** rAF 를 id → 콜백 Map 가짜로 갈아 끼운다. cancelAnimationFrame 이 그 id 를 실제로 지운다. */
function stubFrames() {
  const frames = new Map<number, FrameRequestCallback>();
  let next = 0;
  vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
    next += 1;
    frames.set(next, cb);
    return next;
  });
  vi.stubGlobal("cancelAnimationFrame", (id: number) => {
    frames.delete(id);
  });
  const runFrame = () =>
    act(() => {
      const first = frames.entries().next();
      if (first.done) return;
      frames.delete(first.value[0]);
      first.value[1](0);
    });
  return { frames, runFrame };
}

const isOpenClass = (dlg: HTMLDialogElement) => dlg.classList.contains("mf-dialog--open");

afterEach(() => {
  cleanup();
  setSheetProbe(null);
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  document.querySelectorAll("[data-sheetdebug], .mf-sheetdebug-probes").forEach((el) => el.remove());
});

const plain = () => (
  <Sheet label="내 역할" onClose={() => {}}>
    <p>내용</p>
  </Sheet>
);

describe("G-01-9 시트 계측 — 플래그와 지연 로드", () => {
  it("G-01-9: ?sheetdebug=1 은 켜고 저장하며, 주소가 바뀌어도 유지되고, =0 이면 끈다", () => {
    const s = new MemoryStorage();
    expect(sheetDebugEnabled("?sheetdebug=1", s)).toBe(true);
    expect(s.getItem("minifia:sheetdebug")).toBe("1");
    expect(sheetDebugEnabled("", s)).toBe(true);
    expect(sheetDebugEnabled("?sheetdebug=0", s)).toBe(false);
    expect(s.getItem("minifia:sheetdebug")).toBe(null);
    expect(sheetDebugEnabled("", new MemoryStorage())).toBe(false);
  });

  it("G-01-9: 저장소가 없거나 예외를 던져도 쿼리 값만으로 판정한다", () => {
    expect(sheetDebugEnabled("?sheetdebug=1", null)).toBe(true);
    expect(sheetDebugEnabled("", null)).toBe(false);
    const boom = () => {
      throw new Error("denied");
    };
    const bad = { getItem: boom, setItem: boom, removeItem: boom } as unknown as Storage;
    expect(sheetDebugEnabled("?sheetdebug=1", bad)).toBe(true);
  });

  it("G-01-9: 플래그가 없으면 initSheetDebug 는 null 이고 계측기를 등록하지 않는다", () => {
    expect(initSheetDebug("", new MemoryStorage())).toBe(null);
    expect(getSheetProbe()).toBe(null);
  });

  it("G-01-9: 플래그가 있으면 지연 로드 뒤 계측기가 등록된다", async () => {
    await initSheetDebug("?sheetdebug=1", new MemoryStorage());
    expect(getSheetProbe() !== null).toBe(true);
  });
});

describe("G-01-9 시트 계측 — Sheet 훅 순서", () => {
  it("G-01-9: 계측기가 없으면 패널이 없고 열림 클래스는 두 프레임 뒤 붙는다", () => {
    vi.useFakeTimers();
    const { runFrame } = stubFrames();
    setSheetProbe(null);
    const { container } = render(plain());
    const dlg = dialogOf(container);
    expect(isOpenClass(dlg)).toBe(false);
    runFrame();
    expect(isOpenClass(dlg)).toBe(false);
    runFrame();
    expect(isOpenClass(dlg)).toBe(true);
    expect(document.querySelectorAll("[data-sheetdebug]").length).toBe(0);
  });

  it("G-01-9: start 는 열기 전에 한 번, mark 는 shown,focused,entered,close 순서, unmount 에서 end 한 번", () => {
    vi.useFakeTimers();
    const { runFrame } = stubFrames();
    const marks: SheetMark[] = [];
    let starts = 0;
    let ends = 0;
    let startOpen: boolean | null = null;
    let startLabel = "";
    let shownOpen: boolean | null = null;
    const probe: SheetProbe = {
      start(target) {
        starts += 1;
        startOpen = target.dialog.open;
        startLabel = target.label;
        return {
          mark(ev) {
            marks.push(ev);
            if (ev === "shown") shownOpen = target.dialog.open;
          },
          end() {
            ends += 1;
          },
        };
      },
    };
    setSheetProbe(probe);
    const { container, unmount } = render(plain());
    const dlg = dialogOf(container);
    expect(starts).toBe(1);
    expect(startOpen).toBe(false);
    expect(startLabel).toBe("내 역할");
    expect(marks.join(",")).toBe("shown,focused");
    expect(shownOpen).toBe(true);
    runFrame();
    runFrame();
    expect(marks.join(",")).toBe("shown,focused,entered");
    pressEsc(dlg);
    expect(marks.join(",")).toBe("shown,focused,entered,close");
    unmount();
    expect(ends).toBe(1);
    advance(1000);
  });
});

describe("G-01-9 시트 계측 — 트레이서 한 경로", () => {
  it("G-01-9: 진짜 계측기가 시트 안에 패널을 붙이고 before·shown·entered 를 보이며, 끝나면 body 로 옮긴다", async () => {
    await initSheetDebug("?sheetdebug=1", new MemoryStorage());
    vi.useFakeTimers();
    stubFrames();
    const { container, unmount } = render(plain());
    const dlg = dialogOf(container);
    const panels = dlg.querySelectorAll("[data-sheetdebug]");
    expect(panels.length).toBe(1);
    const text = panels[0].textContent ?? "";
    expect(text.includes("before")).toBe(true);
    expect(text.includes("shown")).toBe(true);
    advance(60);
    expect((dlg.querySelector("[data-sheetdebug]")?.textContent ?? "").includes("entered")).toBe(true);
    const panel = dlg.querySelector("[data-sheetdebug]") as HTMLElement;
    unmount();
    expect(panel.parentElement === document.body).toBe(true);
  });
});
