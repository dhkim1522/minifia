import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import "../helpers/singleLineErrors";
import { ChatPanel, type ChatPanelMessage, type ChatPanelProps } from "../../src/components/v2/ChatPanel";

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
