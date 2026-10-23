import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import "../helpers/singleLineErrors";
import { MemoryStorage } from "../helpers/memoryStorage";
import { Sheet } from "../../src/components/Sheet";
import { classifyTrace, createSheetProbe } from "../../src/debug/sheetDebug";
import type { SheetSample, SheetTraceRecord } from "../../src/debug/sheetDebug";
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

// ---- Task 2: 판정 규칙 ----

type SampleOver = Partial<SheetSample>;

/** 기본: 한 화면 800px, 시트 330px 가 바닥에 붙은 정지 상태. shB 는 따로 말하지 않으면 dlgB 와 같다(gap 0). */
function smp(t: number, ev: string, over: SampleOver = {}): SheetSample {
  const dlgB = over.dlgB ?? 800;
  return {
    t,
    ev,
    vvH: 800,
    vvTop: 0,
    inH: 800,
    docH: 800,
    docSH: 800,
    scY: 0,
    dvh: 800,
    svh: 800,
    lvh: 800,
    pct: 800,
    ins: 800,
    safeB: 0,
    dlgT: 0,
    dlgB,
    dlgH: 800,
    shT: dlgB - 330,
    shB: dlgB,
    shH: 330,
    shTY: 0,
    cls: "open",
    img: "loaded",
    ...over,
  };
}

function rec(samples: SheetSample[]): SheetTraceRecord {
  return {
    n: 1,
    label: "내 역할",
    screen: "day",
    ua: "test",
    dpr: 3,
    screenH: 874,
    standalone: false,
    startedAt: "2026-01-01T00:00:00.000Z",
    samples,
    verdict: "",
  };
}

describe("G-01-9 판정 규칙 classifyTrace", () => {
  it("G-01-9: 마지막에만 lvh 높이로 커지면 A-lvh", () => {
    const r = classifyTrace(
      rec([
        smp(0, "before"),
        smp(1, "shown", { svh: 800, lvh: 860, dvh: 800 }),
        smp(30, "entered", { dlgB: 800 }),
        smp(300, "t300", { dlgB: 800 }),
        smp(1000, "t1000", { dlgB: 860, dlgH: 860 }),
      ]),
    );
    expect(r.verdict).toBe("A-lvh");
    expect(r.dlgShift).toBe(60);
  });

  it("G-01-9: svh 와 lvh 가 둘 다 맞으면 정적 단위 svh 가 먼저다 (A-svh)", () => {
    const r = classifyTrace(
      rec([
        smp(0, "before"),
        smp(1, "shown", { svh: 800, dvh: 800, lvh: 860 }),
        smp(30, "entered", { dlgB: 860 }),
        smp(300, "t300", { dlgB: 860 }),
        smp(1000, "t1000", { dlgB: 800, dlgH: 800 }),
      ]),
    );
    expect(r.verdict).toBe("A-svh");
  });

  it("G-01-9: 어느 단위와도 안 맞게 다이얼로그가 움직이면 A-none", () => {
    const r = classifyTrace(
      rec([
        smp(0, "before"),
        smp(1, "shown", { svh: 700, dvh: 750, lvh: 900 }),
        smp(30, "entered", { dlgB: 740 }),
        smp(300, "t300", { dlgB: 740 }),
        smp(1000, "t1000", { dlgB: 800, dlgH: 800 }),
      ]),
    );
    expect(r.verdict).toBe("A-none");
  });

  it("G-01-9: 다이얼로그는 그대로인데 시트 높이가 커지면 B", () => {
    const r = classifyTrace(
      rec([
        smp(0, "before", { shH: 130, img: "pending" }),
        smp(1, "shown", { shH: 130, img: "pending" }),
        smp(30, "entered", { shH: 130, img: "pending" }),
        smp(120, "img-load", { shH: 330, img: "loaded" }),
        smp(300, "t300", { shH: 330 }),
        smp(1000, "t1000", { shH: 330 }),
      ]),
    );
    expect(r.verdict).toBe("B");
    expect(r.shGrow).toBe(200);
  });

  it("G-01-9: 다이얼로그가 움직이고 문서 스크롤이 바뀌었으면 D", () => {
    const r = classifyTrace(
      rec([
        smp(0, "before"),
        smp(1, "shown", { scY: 0 }),
        smp(30, "entered", { dlgB: 740, scY: 0 }),
        smp(300, "t300", { dlgB: 740, scY: 60 }),
        smp(1000, "t1000", { dlgB: 800, scY: 60 }),
      ]),
    );
    expect(r.verdict).toBe("D");
  });

  it("G-01-9: 진입 이동(shTY 330 -> 0)만 있으면 stable 이고 shDrift 는 0", () => {
    const r = classifyTrace(
      rec([
        smp(0, "before", { dlgB: 860, dlgH: 860, shTY: 330, shB: 1190 }),
        smp(1, "shown", { dlgB: 860, dlgH: 860, shTY: 330, shB: 1190 }),
        smp(30, "entered", { dlgB: 860, dlgH: 860, shTY: 330, shB: 1190, vvH: 801 }),
        smp(300, "t300", { dlgB: 860, dlgH: 860, shTY: 0, shB: 860, vvH: 802 }),
        smp(1000, "t1000", { dlgB: 860, dlgH: 860, shTY: 0, shB: 860, vvH: 800 }),
      ]),
    );
    expect(r.verdict).toBe("stable");
    expect(r.shDrift).toBe(0);
  });

  it("G-01-9: 다이얼로그 하단과 시트 높이가 함께 바뀌면 mixed", () => {
    const r = classifyTrace(
      rec([
        smp(0, "before", { shH: 130 }),
        smp(1, "shown", { shH: 130 }),
        smp(30, "entered", { dlgB: 740, shH: 130 }),
        smp(300, "t300", { dlgB: 800, shH: 330 }),
        smp(1000, "t1000", { dlgB: 800, shH: 330 }),
      ]),
    );
    expect(r.verdict).toBe("mixed");
  });

  it("G-01-9: 뷰포트 높이만 바뀌면 viewport", () => {
    const r = classifyTrace(
      rec([
        smp(0, "before"),
        smp(1, "shown"),
        smp(30, "entered"),
        smp(300, "t300", { vvH: 830 }),
        smp(1000, "t1000", { vvH: 860 }),
      ]),
    );
    expect(r.verdict).toBe("viewport");
  });

  it("G-01-9: 바닥보다 60px 위에 멈췄다가 내려오면 sheet-drift (실제 증상 모양), 4px 이하면 stable", () => {
    const base = { dlgB: 860, dlgH: 860 };
    const make = (enteredB: number, t300B: number) =>
      rec([
        smp(0, "before", { ...base, shTY: 330, shB: 1190 }),
        smp(1, "shown", { ...base, shTY: 330, shB: 1190 }),
        smp(30, "entered", { ...base, shTY: 330, shB: enteredB }),
        smp(300, "t300", { ...base, shTY: 0, shB: t300B }),
        smp(1000, "t1000", { ...base, shTY: 0, shB: 860 }),
      ]);
    const drift = classifyTrace(make(1130, 800));
    expect(drift.verdict).toBe("sheet-drift");
    expect(drift.shDrift).toBe(60);
    expect(classifyTrace(make(1186, 856)).verdict).toBe("stable");
  });
});

// ---- Task 2: 기록 전체 값 ----

const FIELD_ORDER =
  "t,ev,vvH,vvTop,inH,docH,docSH,scY,dvh,svh,lvh,pct,ins,safeB,dlgT,dlgB,dlgH,shT,shB,shH,shTY,cls,img";

describe("G-01-9 계측 기록 전체 값", () => {
  const TRACES_KEY = "minifia:sheetdebug:traces";

  function openProbed(children: React.ReactNode = <p>내용</p>) {
    vi.useFakeTimers();
    const frames = stubFrames();
    const storage = new MemoryStorage();
    setSheetProbe(createSheetProbe({ storage }));
    const view = render(
      <Sheet label="내 역할" onClose={() => {}}>
        {children}
      </Sheet>,
    );
    return { ...view, storage, frames };
  }

  const stored = (storage: MemoryStorage) => JSON.parse(storage.getItem(TRACES_KEY) ?? "[]") as SheetTraceRecord[];

  it("G-01-9: 1초 뒤 기록 한 개가 저장되고 표본 필드 순서와 시점이 규칙대로다", () => {
    const { storage } = openProbed();
    advance(1000);
    const traces = stored(storage);
    expect(traces.length).toBe(1);
    expect(Object.keys(traces[0].samples[0]).join(",")).toBe(FIELD_ORDER);
    const evs = traces[0].samples.map((s) => s.ev).join(" ");
    for (const ev of ["before", "shown", "focused", "entered", "t100", "t200", "t300", "t500", "t1000"]) {
      expect(evs.split(" ").includes(ev)).toBe(true);
    }
    expect(traces[0].screen).toBe("other");
    expect(traces[0].n).toBe(1);
  });

  it("G-01-9: 1초 뒤 타이머·프레임·리스너가 모두 정리된다 (T-01-64)", () => {
    const remove = vi.spyOn(window, "removeEventListener");
    const { frames } = openProbed();
    advance(1000);
    expect(vi.getTimerCount()).toBe(0);
    expect(frames.frames.size).toBe(0);
    const names = remove.mock.calls.map((c) => String(c[0]));
    expect(names.includes("resize")).toBe(true);
    expect(names.includes("scroll")).toBe(true);
  });

  it("G-01-9: 열자마자 닫히면(StrictMode 이중 effect 흉내) 저장도 콘솔도 없다", () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    const { storage, unmount } = openProbed();
    advance(10);
    unmount();
    expect(stored(storage).length).toBe(0);
    expect(info).not.toHaveBeenCalled();
  });

  it("G-01-9: 마무리 때 콘솔에 [sheetdebug] 머리말과 JSON 문자열이 한 번 나온다", () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    openProbed();
    advance(1000);
    expect(info).toHaveBeenCalledTimes(1);
    expect(info.mock.calls[0][0]).toBe("[sheetdebug]");
    const json = info.mock.calls[0][1];
    expect(typeof json).toBe("string");
    expect(JSON.parse(json as string).label).toBe("내 역할");
  });

  it("G-01-9: 시트 안 글자·그림 주소는 기록과 패널에 없다 (T-01-62)", () => {
    const { storage, container } = openProbed(
      <>
        <p>경찰</p>
        <img src="/characters/roles/police_default%402x.png" alt="" />
      </>,
    );
    advance(1000);
    const json = storage.getItem(TRACES_KEY) ?? "";
    const panel = container.querySelector("[data-sheetdebug]")?.textContent ?? "";
    for (const bad of ["경찰", "police", "%40"]) {
      expect(json.includes(bad)).toBe(false);
      expect(panel.includes(bad)).toBe(false);
    }
    const imgState = stored(storage)[0].samples[0].img;
    expect(["pending", "loaded", "error"].includes(imgState)).toBe(true);
  });

  it("G-01-9: 닫힌 뒤 body 패널에 #1 과 판정과 label 이 있다", () => {
    const { storage, unmount } = openProbed();
    advance(100);
    unmount();
    const verdict = stored(storage)[0].verdict;
    const text = document.querySelector("[data-sheetdebug]")?.textContent ?? "";
    expect(text.includes("#1")).toBe(true);
    expect(verdict !== "").toBe(true);
    expect(text.includes(verdict)).toBe(true);
    expect(text.includes("내 역할")).toBe(true);
  });
});
