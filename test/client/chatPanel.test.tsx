import { readFileSync } from "node:fs";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import "../helpers/singleLineErrors";
import { ChatPanel, type ChatPanelMessage, type ChatPanelProps } from "../../src/components/v2/ChatPanel";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

// 07-03 Task 1: 승인 v2.0 ChatPanel(design/v2.0/design-system/components/bundle.js)을 React 19 로 옮긴 부품.
// 입력 → form 제출 → onSend 한 번 → 칸 비움·포커스 유지 → 받은 줄 그리기 한 길을 먼저 고정한다 (CHAT-01).
// happy-dom 은 글자 폭·스크롤 치수·실제 IME 를 재현하지 못한다(가정 A1) — 여기서는 마크업·이벤트 순서·스타일 계약만 본다.

const SRC = readFileSync("src/components/v2/ChatPanel.tsx", "utf8");
const V2_CSS = readFileSync("src/styles/v2.css", "utf8");

function rulesFor(css: string, selector: string): string[] {
  const bare = css.replace(/\/\*[\s\S]*?\*\//g, "");
  return [...bare.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
    .filter((m) => (m[1] ?? "").split(",").some((s) => s.trim().startsWith(selector) && !/[\w-]/.test(s.trim().charAt(selector.length))))
    .map((m) => m[2] ?? "");
}

const TWO_LINES: ChatPanelMessage[] = [
  { key: "a", kind: "player", seat: 2, name: "지호", text: "안녕", ch: "all" },
  { key: "b", kind: "system", text: "지호 님 입장" },
];

interface HarnessProps extends Partial<ChatPanelProps> {
  onChangeSpy?: (v: string) => void;
  initial?: string;
}

// 값은 부모가 들고 있다(제어 입력). onChange 에서 가공하지 않는다.
function Harness({ onChangeSpy, initial = "", ...rest }: HarnessProps) {
  const [value, setValue] = useState(initial);
  return (
    <ChatPanel
      messages={TWO_LINES}
      logHeight={96}
      onSend={() => {}}
      {...rest}
      value={value}
      onChange={(v) => {
        onChangeSpy?.(v);
        setValue(v);
      }}
    />
  );
}

// 요소가 없으면 계획한 단언(요소가 있다)으로 실패한다 — 도구 오류(TypeError)로 실패하지 않게 한다.
function input(container: HTMLElement): HTMLInputElement {
  const el = container.querySelector("input[data-chat-input]");
  expect(el, "입력칸 input[data-chat-input]").toBeInstanceOf(HTMLInputElement);
  return el as HTMLInputElement;
}
function sendBtn(container: HTMLElement): HTMLButtonElement {
  const el = container.querySelector("button[data-chat-send]");
  expect(el, "보내기 button[data-chat-send]").toBeInstanceOf(HTMLButtonElement);
  return el as HTMLButtonElement;
}
function form(container: HTMLElement): HTMLFormElement {
  const el = container.querySelector("form");
  expect(el, "form").toBeInstanceOf(HTMLFormElement);
  return el as HTMLFormElement;
}
function logOf(container: HTMLElement): HTMLElement {
  const el = container.querySelector("[data-chat-log]");
  expect(el, "기록 칸 [data-chat-log]").toBeInstanceOf(HTMLElement);
  return el as HTMLElement;
}

describe("ChatPanel 기록 칸 (CHAT-01)", () => {
  it("받은 줄을 순서대로 그린다: player 는 data-seat·data-ch·자리 구분색 점·이름·본문", () => {
    const { container } = render(<Harness />);
    const log = logOf(container);
    const lines = [...log.children];
    expect(lines.length).toBe(2);
    const first = lines[0] as HTMLElement;
    expect(first.getAttribute("data-seat")).toBe("2");
    expect(first.getAttribute("data-ch")).toBe("all");
    expect(first.querySelector(".mv-chat__dot")?.getAttribute("style")).toContain("var(--seat-3)");
    expect(first.querySelector(".mv-chat__name")?.textContent).toBe("지호");
    expect(first.textContent).toContain("안녕");
    const second = lines[1] as HTMLElement;
    expect(second.classList.contains("mv-chat__sys")).toBe(true);
    expect(second.textContent).toBe("지호 님 입장");
  });

  it("내 줄(me)의 이름은 '나' 이다", () => {
    const msgs: ChatPanelMessage[] = [{ key: "m", kind: "player", seat: 0, name: "철수", me: true, text: "나야", ch: "all" }];
    const { container } = render(<Harness messages={msgs} />);
    expect(container.querySelector(".mv-chat__name")?.textContent).toBe("나");
  });

  it("기록 칸은 role log·aria-live polite·aria-label '채팅 기록' 이고 높이는 logHeight 로 고정된다", () => {
    const { container } = render(<Harness logHeight={152} />);
    const log = logOf(container);
    expect(log.getAttribute("role")).toBe("log");
    expect(log.getAttribute("aria-live")).toBe("polite");
    expect(log.getAttribute("aria-label")).toBe("채팅 기록");
    expect(log.style.height).toBe("152px");
  });

  it("본문과 이름의 HTML 은 글자 그대로 보이고 요소가 생기지 않는다 (T-07-07)", () => {
    const msgs: ChatPanelMessage[] = [{ key: "x", kind: "player", seat: 1, name: "<i>n</i>", text: "<b>x</b>", ch: "all" }];
    const { container } = render(<Harness messages={msgs} />);
    expect(container.querySelector("b")).toBeNull();
    expect(container.querySelector("i")).toBeNull();
    expect(container.textContent).toContain("<b>x</b>");
    expect(container.querySelector(".mv-chat__name")?.textContent).toBe("<i>n</i>");
  });

  it("보내기 전에 내 줄을 미리 그리지 않는다: 받은 messages 만 그린다 (낙관적 표시 없음)", () => {
    const { container } = render(<Harness initial="안녕하세요" />);
    fireEvent.submit(form(container));
    const log = logOf(container);
    expect(log.children.length).toBe(2);
    expect(log.textContent).not.toContain("안녕하세요");
  });
});

describe("ChatPanel 입력줄 제출 한 길 (CHAT-01)", () => {
  it("입력 → 보내기 활성 → 클릭 → onSend 정확히 한 번 → onChange('') → 포커스 유지", () => {
    const onSend = vi.fn();
    const onChangeSpy = vi.fn();
    const { container } = render(<Harness onSend={onSend} onChangeSpy={onChangeSpy} />);
    const inp = input(container);
    inp.focus();
    expect(sendBtn(container).getAttribute("aria-disabled")).toBe("true");
    fireEvent.change(inp, { target: { value: "안녕하세요" } });
    expect(sendBtn(container).getAttribute("aria-disabled")).toBe("false");
    fireEvent.click(sendBtn(container));
    expect(onSend).toHaveBeenCalledTimes(1);
    expect(onSend).toHaveBeenCalledWith("안녕하세요");
    expect(onChangeSpy).toHaveBeenLastCalledWith("");
    expect(inp.value).toBe("");
    expect(document.activeElement).toBe(inp);
  });

  it("입력칸에서 폼 제출(Enter)이면 onSend 한 번", () => {
    const onSend = vi.fn();
    const { container } = render(<Harness onSend={onSend} initial="반가워요" />);
    fireEvent.submit(form(container));
    expect(onSend).toHaveBeenCalledTimes(1);
    expect(onSend).toHaveBeenCalledWith("반가워요");
  });

  it("keydown 에서 Enter 를 가로채지 않는다: 소스에 Enter 키 처리가 없다", () => {
    // 소스 전체를 단언 메시지에 싣지 않는다(보고서가 여러 줄이 되지 않게 불리언으로 비교).
    expect(SRC.includes("onSubmit"), "소스에 onSubmit 이 있다").toBe(true);
    expect(/key\s*===\s*["']Enter["']/.test(SRC), "Enter 키 직접 처리").toBe(false);
    expect(/onKeyDown=.*Enter/.test(SRC), "onKeyDown 의 Enter 처리").toBe(false);
  });

  it("값이 공백만이면 보내기는 aria-disabled true 이고 눌러도 onSend 가 없다", () => {
    const onSend = vi.fn();
    const { container } = render(<Harness onSend={onSend} initial="   " />);
    expect(sendBtn(container).getAttribute("aria-disabled")).toBe("true");
    fireEvent.click(sendBtn(container));
    fireEvent.submit(form(container));
    expect(onSend).not.toHaveBeenCalled();
  });

  it("onSend 가 없으면 form·입력칸·보내기가 없다", () => {
    const { container } = render(<ChatPanel messages={TWO_LINES} value="" onChange={() => {}} logHeight={96} />);
    expect(container.querySelector("form")).toBeNull();
    expect(container.querySelector("input")).toBeNull();
    expect(container.querySelector("[data-chat-send]")).toBeNull();
    logOf(container);
  });

  it("루트에 data-chat-panel·data-chat-channel(기본 all)이 있다", () => {
    const { container } = render(<Harness />);
    const root = container.querySelector("[data-chat-panel]");
    expect(root?.getAttribute("data-chat-channel")).toBe("all");
  });
});

describe("ChatPanel 입력칸 계약 (CHAT-05, UI-SPEC 패널과 키보드)", () => {
  it("한 줄 text, enterkeyhint send, 자동 보정 끔, maxlength 100, inputmode text", () => {
    const { container } = render(<Harness />);
    const inp = input(container);
    expect(inp.getAttribute("type")).toBe("text");
    expect(inp.getAttribute("enterkeyhint")).toBe("send");
    expect(inp.getAttribute("autocomplete")).toBe("off");
    expect(inp.getAttribute("autocapitalize")).toBe("off");
    expect(inp.getAttribute("autocorrect")).toBe("off");
    expect(inp.getAttribute("spellcheck")).toBe("false");
    expect(inp.getAttribute("maxlength")).toBe("100");
    expect(inp.getAttribute("inputmode")).toBe("text");
  });

  it("채널 all 이면 접근성 이름이 '채팅 입력' 이고 placeholder 가 없다", () => {
    const { container } = render(<Harness />);
    expect(screen.getByLabelText("채팅 입력")).toBe(input(container));
    expect(input(container).hasAttribute("placeholder")).toBe(false);
  });

  it("보내기는 아이콘 버튼이다: aria-label '보내기', 글자 라벨 없음", () => {
    const { container } = render(<Harness />);
    const btn = sendBtn(container);
    expect(btn.getAttribute("aria-label")).toBe("보내기");
    expect(btn.getAttribute("type")).toBe("submit");
    expect(btn.querySelector("svg")).not.toBeNull();
    expect(btn.textContent).toBe("");
  });

  it("CSS: 입력칸 글자 16px, 입력줄 높이 control-input, 보내기 면 gray-100, 비활성은 night-700 면·gray-500 아이콘", () => {
    expect(rulesFor(V2_CSS, ".mv-chat__input").join(";")).toContain("font-size: 16px");
    expect(rulesFor(V2_CSS, ".mv-chat__input").join(";")).toContain("height: var(--control-input)");
    expect(rulesFor(V2_CSS, ".mv-chat__send").join(";")).toContain("background: var(--gray-100)");
    const off = rulesFor(V2_CSS, '.mv-chat__send[aria-disabled="true"]').join(";");
    expect(off).toContain("background: var(--night-700)");
    expect(off).toContain("color: var(--gray-500)");
  });

  it("CSS: 줄 글자 규칙(player 16px/1.5, system 14px/1.4, keep-all, overflow-wrap anywhere)과 기록 칸 고정 높이", () => {
    const msg = rulesFor(V2_CSS, ".mv-chat__msg").join(";");
    expect(msg).toContain("font-size: 16px");
    expect(msg).toContain("line-height: 1.5");
    expect(msg).toContain("word-break: keep-all");
    expect(msg).toContain("overflow-wrap: anywhere");
    const sys = rulesFor(V2_CSS, ".mv-chat__sys").join(";");
    expect(sys).toContain("font-size: 14px");
    expect(sys).toContain("line-height: 1.4");
    const log = rulesFor(V2_CSS, ".mv-chat__log").join(";");
    expect(log).not.toMatch(/min-height|max-height/);
    expect(log).toContain("overflow-y: auto");
  });

  it("소스에 HTML 주입 경로가 없다 (T-07-07)", () => {
    const code = SRC.split("\n").filter((l) => !/^\s*(\/\/|\*)/.test(l)).join("\n");
    expect(/dangerouslySetInnerHTML=|\.innerHTML\s*=/.test(code), "HTML 주입 코드").toBe(false);
  });
});
