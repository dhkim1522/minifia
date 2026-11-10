import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import "../helpers/singleLineErrors";
import { ChatPanel, type ChatPanelMessage, type ChatPanelProps } from "../../src/components/v2/ChatPanel";

const V2_CSS = readFileSync("src/styles/v2.css", "utf8");

function rulesFor(css: string, selector: string): string[] {
  const bare = css.replace(/\/\*[\s\S]*?\*\//g, "");
  return [...bare.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
    .filter((m) => (m[1] ?? "").split(",").some((s) => s.trim().startsWith(selector) && !/[\w-]/.test(s.trim().charAt(selector.length))))
    .map((m) => m[2] ?? "");
}

// happy-dom 은 레이아웃이 없다. 요소 치수를 프로토타입에서 정하고 scrollTop 은 요소마다 따로 든다.
const tops = new WeakMap<object, number>();
let dims = { scrollHeight: 500, clientHeight: 100 };
const protoDescs: Record<string, PropertyDescriptor | undefined> = {};
function stubGeometry() {
  for (const k of ["scrollHeight", "clientHeight", "scrollTop"]) protoDescs[k] = Object.getOwnPropertyDescriptor(HTMLElement.prototype, k) ?? Object.getOwnPropertyDescriptor(Element.prototype, k);
  Object.defineProperty(HTMLElement.prototype, "scrollHeight", { configurable: true, get: () => dims.scrollHeight });
  Object.defineProperty(HTMLElement.prototype, "clientHeight", { configurable: true, get: () => dims.clientHeight });
  Object.defineProperty(HTMLElement.prototype, "scrollTop", {
    configurable: true,
    get() {
      return tops.get(this) ?? 0;
    },
    set(v: number) {
      tops.set(this, v);
    },
  });
}
function restoreGeometry() {
  for (const k of ["scrollHeight", "clientHeight", "scrollTop"]) {
    delete (HTMLElement.prototype as unknown as Record<string, unknown>)[k];
    const d = protoDescs[k];
    if (d) Object.defineProperty(Element.prototype, k, d);
  }
}

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

// 18.1-04: 기록 칸을 누르면 기록 시트가 올라온다(P181-4). 시트는 패널과 같은 줄 부품(ChatLines)을 쓴다.

const LINES: ChatPanelMessage[] = [
  { key: "a", kind: "player", seat: 2, name: "지호", text: "안녕", ch: "all" },
  { key: "b", kind: "system", text: "지호 님 입장" },
  { key: "c", kind: "card", card: "note", title: "쪽지", text: "조심해" },
];

function Harness(rest: Partial<ChatPanelProps>) {
  const [value, setValue] = useState("");
  return <ChatPanel messages={LINES} logHeight={68} onSend={() => {}} {...rest} value={value} onChange={setValue} />;
}

function openBtn(container: HTMLElement): HTMLButtonElement {
  const el = container.querySelector("button[data-chat-open]");
  expect(el, "열기 단추 button[data-chat-open]").toBeInstanceOf(HTMLButtonElement);
  return el as HTMLButtonElement;
}
function dialog(): HTMLElement | null {
  return document.querySelector('dialog[aria-label="채팅 기록"]');
}
function lineCount(root: ParentNode): number {
  return root.querySelectorAll(".mv-chat__msg, .mv-chat__sys, .mv-chat__card").length;
}

describe("채팅 기록 시트 (P181-4, B 계약 3)", () => {
  it("기록 칸을 누르면 기록 시트가 열리고 패널과 같은 줄·클래스가 보인다", () => {
    const { container } = render(<Harness />);
    expect(dialog()).toBeNull();
    fireEvent.click(openBtn(container));
    const dlg = dialog();
    expect(dlg).not.toBeNull();
    const sheet = dlg?.querySelector(".mf-sheet.mf-sheet--chatlog");
    expect(sheet).not.toBeNull();
    const list = sheet?.querySelector("[data-chat-sheet-log]");
    expect(list).not.toBeNull();
    const panelLog = container.querySelector("[data-chat-log]") as HTMLElement;
    expect(lineCount(list as HTMLElement)).toBeGreaterThanOrEqual(lineCount(panelLog));
    const msg = list?.querySelector(".mv-chat__msg");
    expect(msg?.getAttribute("data-seat")).toBe("2");
    expect(msg?.getAttribute("data-ch")).toBe("all");
    expect(list?.querySelector(".mv-chat__card")?.getAttribute("data-card")).toBe("note");
    expect(sheet?.querySelector("[data-chat-log]")).toBeNull();
  });

  it("시트에는 제목 요소가 없고 채널 아이콘 하나(aria-hidden)만 있다 — 전체·마피아·유령", () => {
    for (const channel of ["all", "mafia", "ghost"] as const) {
      const { container, unmount } = render(<Harness channel={channel} />);
      fireEvent.click(openBtn(container));
      const chan = dialog()?.querySelector(".mv-chat__sheet-chan");
      expect(chan, `${channel} 채널 아이콘 자리`).not.toBeNull();
      expect(chan?.getAttribute("aria-hidden")).toBe("true");
      expect(chan?.querySelectorAll("svg").length).toBe(1);
      expect(dialog()?.querySelector("h1, h2, h3")).toBeNull();
      unmount();
    }
  });

  it("[닫기] 와 Esc 로 닫으면 포커스가 기록 칸 단추로 돌아온다", () => {
    vi.useFakeTimers();
    const { container } = render(<Harness />);
    fireEvent.click(openBtn(container));
    const close = dialog()?.querySelector('button[aria-label="닫기"]');
    expect(close).not.toBeNull();
    fireEvent.click(close as Element);
    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(dialog()).toBeNull();
    expect(document.activeElement).toBe(openBtn(container));

    fireEvent.click(openBtn(container));
    const dlg = dialog() as HTMLElement;
    fireEvent(dlg, new Event("cancel", { cancelable: true }));
    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(dialog()).toBeNull();
    expect(document.activeElement).toBe(openBtn(container));
  });

  it("시트를 열고 닫아도 입력칸에 쓰던 글이 그대로다 (B4)", () => {
    vi.useFakeTimers();
    const { container } = render(<Harness />);
    const field = container.querySelector("input[data-chat-input]") as HTMLInputElement;
    fireEvent.change(field, { target: { value: "안녕" } });
    fireEvent.click(openBtn(container));
    fireEvent.click(dialog()?.querySelector('button[aria-label="닫기"]') as Element);
    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect((container.querySelector("input[data-chat-input]") as HTMLInputElement).value).toBe("안녕");
  });

  it("본문·닉네임의 HTML 은 시트에서도 글자 그대로다 (T-07-07)", () => {
    const msgs: ChatPanelMessage[] = [{ key: "x", kind: "player", seat: 1, name: "<i>n</i>", text: "<b>x</b>", ch: "all" }];
    const { container } = render(<Harness messages={msgs} />);
    fireEvent.click(openBtn(container));
    const list = dialog()?.querySelector("[data-chat-sheet-log]") as HTMLElement;
    expect(list.querySelector("b")).toBeNull();
    expect(list.querySelector("i")).toBeNull();
    expect(list.querySelector(".mv-chat__name")?.textContent).toBe("<i>n</i>");
    expect(list.querySelector(".mv-chat__text")?.textContent).toBe("<b>x</b>");
  });
});

describe("기록 시트 따라가기·새 글 알약·빈 상태 (B 계약 3)", () => {
  const MORE: ChatPanelMessage[] = [...LINES, { key: "d", kind: "player", seat: 0, name: "철수", text: "새 줄", ch: "all" }];
  const listOf = () => dialog()?.querySelector("[data-chat-sheet-log]") as HTMLElement;
  const dotOf = () => dialog()?.querySelector("button[data-chat-newdot]") ?? null;

  function setup() {
    dims = { scrollHeight: 500, clientHeight: 100 };
    stubGeometry();
  }
  afterEach(restoreGeometry);

  it("처음 열면 시트 목록이 맨 아래다", () => {
    setup();
    const { container } = render(<Harness />);
    fireEvent.click(openBtn(container));
    expect(listOf().scrollTop).toBe(500);
  });

  it("바닥 24px 안이면 새 줄을 따라가고 알약이 없다", () => {
    setup();
    const { container, rerender } = render(<Harness />);
    fireEvent.click(openBtn(container));
    listOf().scrollTop = 380;
    fireEvent.scroll(listOf());
    rerender(<Harness messages={MORE} />);
    expect(listOf().scrollTop).toBe(500);
    expect(dotOf()).toBeNull();
  });

  it("위로 올려 읽는 중이면 끌어내리지 않고 새 글 알약(aria-label 새 글)이 뜬다", () => {
    setup();
    const { container, rerender } = render(<Harness />);
    fireEvent.click(openBtn(container));
    listOf().scrollTop = 300;
    fireEvent.scroll(listOf());
    rerender(<Harness messages={MORE} />);
    expect(listOf().scrollTop).toBe(300);
    const dot = dotOf();
    expect(dot?.getAttribute("aria-label")).toBe("새 글");
    expect(dot?.textContent).toBe("새 글");
  });

  it("알약을 누르면 맨 아래로 가고 사라진다", () => {
    setup();
    const { container, rerender } = render(<Harness />);
    fireEvent.click(openBtn(container));
    listOf().scrollTop = 300;
    fireEvent.scroll(listOf());
    rerender(<Harness messages={MORE} />);
    fireEvent.click(dotOf() as Element);
    expect(listOf().scrollTop).toBe(500);
    expect(dotOf()).toBeNull();
  });

  it("직접 바닥까지 내리면 알약이 사라진다", () => {
    setup();
    const { container, rerender } = render(<Harness />);
    fireEvent.click(openBtn(container));
    listOf().scrollTop = 300;
    fireEvent.scroll(listOf());
    rerender(<Harness messages={MORE} />);
    expect(dotOf()).not.toBeNull();
    listOf().scrollTop = 395;
    fireEvent.scroll(listOf());
    expect(dotOf()).toBeNull();
  });

  it("quiet(재접속 복원)면 알약을 만들지 않는다", () => {
    setup();
    const { container, rerender } = render(<Harness />);
    fireEvent.click(openBtn(container));
    listOf().scrollTop = 300;
    fireEvent.scroll(listOf());
    rerender(<Harness messages={MORE} quiet />);
    expect(dotOf()).toBeNull();
  });

  it("줄이 0개면 quiet 아이콘 하나뿐이고 글자가 없다", () => {
    const { container } = render(<Harness messages={[]} />);
    fireEvent.click(openBtn(container));
    const empty = dialog()?.querySelector("[data-chat-sheet-empty]");
    expect(empty).not.toBeNull();
    expect(empty?.querySelectorAll("svg").length).toBe(1);
    expect((empty?.textContent ?? "").trim()).toBe("");
    expect(dialog()?.querySelector("[data-chat-sheet-log]")).toBeNull();
  });

  it("스타일: 시트 높이 min(60dvh, 440px), 목록 스크롤·overscroll contain, 알약 44×44 는 기존 규칙", () => {
    const sheet = rulesFor(V2_CSS, ".mf-sheet.mf-sheet--chatlog").join(";");
    expect(sheet).toContain("height: min(60dvh, 440px)");
    const list = rulesFor(V2_CSS, ".mv-chat__sheetlog").join(";");
    expect(list).toContain("overflow-y: auto");
    expect(list).toContain("overscroll-behavior: contain");
    const dot = rulesFor(V2_CSS, ".mv-chat__newdot").join(";");
    expect(dot).toMatch(/width:\s*(var\(--tap-min\)|44px)/);
    expect(dot).toMatch(/height:\s*(var\(--tap-min\)|44px)/);
  });
});
