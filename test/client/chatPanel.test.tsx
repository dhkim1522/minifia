import { readFileSync } from "node:fs";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import "../helpers/singleLineErrors";
import { ChatPanel, type ChatPanelMessage, type ChatPanelProps } from "../../src/components/v2/ChatPanel";
import { V2Icon } from "../../src/components/v2/V2Icon";

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
    expect(document.activeElement === inp, "포커스가 입력칸").toBe(true);
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
    expect(screen.getByLabelText("채팅 입력") === input(container), "라벨로 찾은 칸이 입력칸").toBe(true);
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

// ---------------------------------------------------------------------------------------------
// 07-03 Task 2: 한글 조합 제출·채널 모양·막힘 알림·새 메시지 점·쿨다운 흐림·키보드 열림 compact (CHAT-05)
// happy-dom 은 실제 IME 를 재현하지 못한다(가정 A1): compositionstart/end 이벤트를 직접 발생시켜 제출 순서만 본다.
// 실제 조합은 07-19(Chromium CDP imeSetComposition)·07-21(iPhone)이 본다.
// ---------------------------------------------------------------------------------------------

function advance(ms: number) {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
}

describe("ChatPanel 한글 조합 중 제출 (UI-SPEC 한글 입력, 합격 검사 4)", () => {
  it("조합 중 제출은 compositionend 를 기다려 확정된 값을 한 번 보낸다", () => {
    vi.useFakeTimers();
    const onSend = vi.fn();
    const { container } = render(<Harness onSend={onSend} />);
    const inp = input(container);
    fireEvent.compositionStart(inp);
    fireEvent.change(inp, { target: { value: "안녕하" } });
    fireEvent.submit(form(container));
    expect(onSend).toHaveBeenCalledTimes(0);
    advance(50);
    expect(onSend).toHaveBeenCalledTimes(0);
    fireEvent.change(inp, { target: { value: "안녕하세요" } });
    fireEvent.compositionEnd(inp);
    expect(onSend).toHaveBeenCalledTimes(1);
    expect(onSend).toHaveBeenCalledWith("안녕하세요");
    advance(300);
    expect(onSend).toHaveBeenCalledTimes(1);
  });

  it("compositionend 가 오지 않으면 100ms 뒤 그때 DOM 값으로 한 번 보낸다", () => {
    vi.useFakeTimers();
    const onSend = vi.fn();
    const { container } = render(<Harness onSend={onSend} />);
    const inp = input(container);
    fireEvent.compositionStart(inp);
    fireEvent.change(inp, { target: { value: "안녕하" } });
    fireEvent.submit(form(container));
    advance(99);
    expect(onSend).toHaveBeenCalledTimes(0);
    advance(1);
    expect(onSend).toHaveBeenCalledTimes(1);
    expect(onSend).toHaveBeenCalledWith("안녕하");
  });

  it("기다리는 중에 다시 제출해도 두 번 가지 않는다", () => {
    vi.useFakeTimers();
    const onSend = vi.fn();
    const { container } = render(<Harness onSend={onSend} />);
    const inp = input(container);
    fireEvent.compositionStart(inp);
    fireEvent.change(inp, { target: { value: "가나" } });
    fireEvent.submit(form(container));
    fireEvent.submit(form(container));
    advance(200);
    expect(onSend).toHaveBeenCalledTimes(1);
  });

  it("같은 문장이 300ms 안에 다시 제출되면 무시하고, 301ms 뒤에는 보낸다", () => {
    vi.useFakeTimers();
    const onSend = vi.fn();
    // 값이 비워지지 않는 부모(서버 응답 전·IME 로 같은 글이 남은 경우)
    const { container } = render(<ChatPanel messages={[]} value="가" onChange={() => {}} onSend={onSend} logHeight={96} />);
    fireEvent.submit(form(container));
    advance(150);
    fireEvent.submit(form(container));
    expect(onSend).toHaveBeenCalledTimes(1);
    advance(151);
    fireEvent.submit(form(container));
    expect(onSend).toHaveBeenCalledTimes(2);
  });

  it("보낸 직후(500ms 안) 조합이 끝나 입력칸이 보낸 문장의 꼬리가 되면 한 번 더 비운다", () => {
    vi.useFakeTimers();
    const onChangeSpy = vi.fn();
    const { container } = render(<Harness onChangeSpy={onChangeSpy} />);
    const inp = input(container);
    fireEvent.change(inp, { target: { value: "안녕" } });
    fireEvent.submit(form(container));
    fireEvent.compositionStart(inp);
    fireEvent.change(inp, { target: { value: "녕" } });
    advance(100);
    fireEvent.compositionEnd(inp);
    expect(onChangeSpy.mock.calls.map((c) => c[0]).join("|")).toBe("안녕||녕|");
  });

  it("보낸 지 600ms 뒤에 끝난 조합이면 지우지 않는다", () => {
    vi.useFakeTimers();
    const onChangeSpy = vi.fn();
    const { container } = render(<Harness onChangeSpy={onChangeSpy} />);
    const inp = input(container);
    fireEvent.change(inp, { target: { value: "안녕" } });
    fireEvent.submit(form(container));
    advance(600);
    fireEvent.compositionStart(inp);
    fireEvent.change(inp, { target: { value: "녕" } });
    fireEvent.compositionEnd(inp);
    expect(onChangeSpy.mock.calls.map((c) => c[0]).join("|")).toBe("안녕||녕");
  });

  it("보낸 직후라도 보낸 문장의 끝부분이 아닌 새 단어면 지우지 않는다", () => {
    vi.useFakeTimers();
    const onChangeSpy = vi.fn();
    const { container } = render(<Harness onChangeSpy={onChangeSpy} />);
    const inp = input(container);
    fireEvent.change(inp, { target: { value: "안녕" } });
    fireEvent.submit(form(container));
    fireEvent.compositionStart(inp);
    fireEvent.change(inp, { target: { value: "다른말" } });
    fireEvent.compositionEnd(inp);
    expect(onChangeSpy.mock.calls.map((c) => c[0]).join("|")).toBe("안녕||다른말");
  });

  it("onComposingChange 가 조합 시작에 true, 끝에 false 로 불린다", () => {
    const onComposingChange = vi.fn();
    const { container } = render(<Harness onComposingChange={onComposingChange} />);
    const inp = input(container);
    fireEvent.compositionStart(inp);
    fireEvent.compositionEnd(inp);
    expect(onComposingChange.mock.calls.map((c) => String(c[0])).join("|")).toBe("true|false");
  });

  it("보내기 버튼에 포커스가 있었어도 보낸 뒤 포커스는 입력칸으로 돌아온다", () => {
    const { container } = render(<Harness initial="안녕" />);
    sendBtn(container).focus();
    fireEvent.click(sendBtn(container));
    expect(document.activeElement === input(container), "포커스가 입력칸").toBe(true);
  });

  it("보내기 버튼을 누르는 순간(mousedown)이 포커스를 옮기지 않는다: 키보드가 닫히며 버튼이 손가락 밑에서 내려가는 일이 없다 (CHAT-05, 합격 검사 6)", () => {
    const { container } = render(<Harness initial="안녕" />);
    const inp = input(container);
    inp.focus();
    // fireEvent 는 기본 동작이 막히지 않았을 때만 true 를 돌려준다
    const notPrevented = fireEvent.mouseDown(sendBtn(container));
    expect(notPrevented, "mousedown 의 기본 동작(포커스 이동)이 막힘").toBe(false);
    expect(document.activeElement === inp, "포커스가 입력칸").toBe(true);
  });

  it("Esc 는 입력칸을 blur 하고 값은 그대로 둔다", () => {
    const { container } = render(<Harness initial="abc" />);
    const inp = input(container);
    inp.focus();
    expect(document.activeElement === inp, "포커스가 입력칸").toBe(true);
    fireEvent.keyDown(inp, { key: "Escape" });
    expect(document.activeElement === inp, "포커스가 입력칸").toBe(false);
    expect(inp.value).toBe("abc");
  });

  it("Enter keydown 은 아무것도 보내지 않는다: 제출은 form onSubmit 한 길", () => {
    const onSend = vi.fn();
    const { container } = render(<Harness onSend={onSend} initial="안녕" />);
    fireEvent.keyDown(input(container), { key: "Enter" });
    expect(onSend).not.toHaveBeenCalled();
  });

  it("입력칸 포커스·블러를 알린다", () => {
    const onInputFocus = vi.fn();
    const onInputBlur = vi.fn();
    const { container } = render(<Harness onInputFocus={onInputFocus} onInputBlur={onInputBlur} />);
    const inp = input(container);
    fireEvent.focus(inp);
    fireEvent.blur(inp);
    expect(onInputFocus).toHaveBeenCalledTimes(1);
    expect(onInputBlur).toHaveBeenCalledTimes(1);
  });

  it("바깥 inputRef 와 inputId 가 입력칸에 연결된다", () => {
    const ref = { current: null as HTMLInputElement | null };
    const { container } = render(<Harness inputRef={ref} inputId="chat-x" />);
    expect(ref.current === input(container), "inputRef 가 입력칸").toBe(true);
    expect(input(container).id).toBe("chat-x");
  });
});

describe("ChatPanel 채널 모양 (UI-SPEC 채널별 모양, T-07-08)", () => {
  it("마피아: 입력칸 이름·placeholder·앞 아이콘(aria-hidden)·왼쪽 안쪽 여백 규칙", () => {
    const { container } = render(<Harness channel="mafia" />);
    const inp = screen.getByLabelText("마피아 채팅 입력");
    expect(inp === input(container), "라벨로 찾은 칸이 입력칸").toBe(true);
    expect(inp.getAttribute("placeholder")).toBe("마피아끼리만 보여요");
    const chan = container.querySelector(".mv-chat__chan");
    expect(chan?.querySelector("svg")?.getAttribute("aria-hidden")).toBe("true");
    expect(chan?.querySelector("svg")?.getAttribute("width")).toBe("20");
    expect(chan?.classList.contains("is-mafia")).toBe(true);
    expect(container.querySelector("[data-chat-panel]")?.getAttribute("data-chat-channel")).toBe("mafia");
    expect(rulesFor(V2_CSS, ".mv-chat.has-chan .mv-chat__input").join(";")).toContain("padding-left: 40px");
    expect(container.querySelector(".mv-chat.has-chan")).not.toBeNull();
  });

  it("유령: 입력칸 이름·placeholder·앞 아이콘", () => {
    const { container } = render(<Harness channel="ghost" />);
    expect(screen.getByLabelText("유령 채팅 입력") === input(container), "라벨로 찾은 칸이 입력칸").toBe(true);
    expect(input(container).getAttribute("placeholder")).toBe("유령끼리만 보여요");
    expect(container.querySelector(".mv-chat__chan")?.classList.contains("is-ghost")).toBe(true);
  });

  it("all: 아이콘·placeholder 가 없고 DOM 에 '마피아' 문자열이 0건이다 (시민 편 DOM)", () => {
    const { container } = render(<Harness channel="all" />);
    expect(container.querySelector(".mv-chat__chan")).toBeNull();
    expect(input(container).hasAttribute("placeholder")).toBe(false);
    expect(container.innerHTML.includes("마피아"), "시민 편 DOM 의 마피아 문구").toBe(false);
    expect(container.innerHTML.includes("유령"), "산 사람 DOM 의 유령 문구").toBe(false);
  });

  it("채널 아이콘 색: 마피아 crimson-300, 유령 gray-300", () => {
    expect(rulesFor(V2_CSS, ".mv-chat__chan.is-mafia").join(";")).toContain("color: var(--crimson-300)");
    expect(rulesFor(V2_CSS, ".mv-chat__chan.is-ghost").join(";")).toContain("color: var(--gray-300)");
  });

  const MIXED: ChatPanelMessage[] = [
    { key: "1", kind: "player", seat: 1, name: "민수", text: "작전", ch: "mafia" },
    { key: "2", kind: "player", seat: 2, name: "영희", text: "으스스", ch: "ghost" },
    { key: "3", kind: "player", seat: 3, name: "철수", text: "안녕", ch: "all" },
  ];

  it("보는 사람 채널이 ghost 면 마피아 줄·유령 줄 이름 앞에 14px 아이콘이 붙고 공개 줄에는 없다", () => {
    const { container } = render(<Harness channel="ghost" messages={MIXED} />);
    const lines = [...container.querySelectorAll("[data-chat-log] > p")];
    const mark = (i: number) => lines[i]?.querySelector(".mv-chat__mark");
    expect(mark(0)?.classList.contains("is-mafia")).toBe(true);
    expect(mark(0)?.querySelector("svg")?.getAttribute("width")).toBe("14");
    expect(mark(1)?.classList.contains("is-ghost")).toBe(true);
    expect(mark(2)).toBeNull();
    expect(rulesFor(V2_CSS, ".mv-chat__mark.is-mafia").join(";")).toContain("color: var(--crimson-300)");
    expect(rulesFor(V2_CSS, ".mv-chat__mark.is-ghost").join(";")).toContain("color: var(--gray-300)");
  });

  it("보는 사람 채널이 all·mafia 면 줄 앞 채널 아이콘이 없다", () => {
    for (const channel of ["all", "mafia"] as const) {
      const { container, unmount } = render(<Harness channel={channel} messages={MIXED} />);
      expect(container.querySelectorAll("[data-chat-log] .mv-chat__mark").length).toBe(0);
      unmount();
    }
  });

  it("마피아 채널 줄은 어느 보는 사람에게나 is-mafia(이름 crimson-300)이다", () => {
    const { container } = render(<Harness messages={MIXED} />);
    const lines = [...container.querySelectorAll("[data-chat-log] > p")];
    expect(lines[0]?.classList.contains("is-mafia")).toBe(true);
    expect(lines[2]?.classList.contains("is-mafia")).toBe(false);
    expect(rulesFor(V2_CSS, ".mv-chat__msg.is-mafia .mv-chat__name").join(";")).toContain("color: var(--crimson-300)");
  });

  it("system 줄은 앞 아이콘을 가질 수 있고 긴 안내도 한 덩어리 글자로 그려진다", () => {
    const msgs: ChatPanelMessage[] = [{ key: "s", kind: "system", icon: "ghost", text: "유령 채팅 · 산 사람에게 안 보여요" }];
    const { container } = render(<Harness channel="ghost" messages={msgs} />);
    const sys = container.querySelector(".mv-chat__sys");
    expect(sys?.querySelector("svg")).not.toBeNull();
    expect(sys?.textContent).toBe("유령 채팅 · 산 사람에게 안 보여요");
    expect(rulesFor(V2_CSS, ".mv-chat__sys").join(";")).not.toContain("nowrap");
  });
});

describe("ChatPanel 시스템 줄 종류 vote·hot (DAY-04·05·06)", () => {
  const KINDS: ChatPanelMessage[] = [
    { key: "s", kind: "system", text: "지목 시작" },
    { key: "v", kind: "vote", text: "민준 → 도윤" },
    { key: "h", kind: "hot", text: "도윤 님이 앞서요" },
  ];

  it("vote 줄은 p.mv-chat__sys.is-vote 안에 point 아이콘 14 와 글자", () => {
    const { container } = render(<Harness messages={KINDS} />);
    const p = container.querySelector("p.mv-chat__sys.is-vote");
    expect(p).not.toBeNull();
    expect(p?.querySelectorAll("svg").length).toBe(1);
    expect(p?.querySelector("svg")?.getAttribute("width")).toBe("14");
    expect(p?.textContent).toBe("민준 → 도윤");
  });

  it("vote 줄은 icon 을 따로 줘도 point 14 로 강제한다", () => {
    const msgs: ChatPanelMessage[] = [{ key: "v", kind: "vote", icon: "ghost", text: "민준 → 도윤" }];
    const paths = (root: ParentNode | null | undefined) => [...(root?.querySelectorAll("path") ?? [])].map((x) => x.getAttribute("d")).join("|");
    const point = paths(render(<V2Icon name="point" size={14} />).container);
    cleanup();
    const { container } = render(<Harness messages={msgs} />);
    expect(point.length).toBeGreaterThan(0);
    expect(paths(container.querySelector(".is-vote"))).toBe(point);
  });

  it("hot 줄은 p.mv-chat__sys.is-hot 이고 아이콘 요소가 없다 (icon 을 줘도)", () => {
    const msgs: ChatPanelMessage[] = [{ key: "h", kind: "hot", icon: "check", text: "도윤 님 과반" }];
    const { container } = render(<Harness messages={msgs} />);
    const p = container.querySelector("p.mv-chat__sys.is-hot");
    expect(p).not.toBeNull();
    expect(p?.querySelectorAll("svg").length).toBe(0);
    expect(p?.textContent).toBe("도윤 님 과반");
  });

  it("기존 system 줄 모양은 그대로다: is-vote·is-hot 없음", () => {
    const { container } = render(<Harness messages={KINDS} />);
    const first = container.querySelector("[data-chat-log] > p");
    expect(first?.className).toBe("mv-chat__sys");
  });

  it("줄 글자는 텍스트 노드다: <b>x</b> 가 그대로 보이고 요소가 생기지 않는다", () => {
    const msgs: ChatPanelMessage[] = [
      { key: "v", kind: "vote", text: "<b>x</b> → y" },
      { key: "h", kind: "hot", text: "<b>x</b> 님 과반" },
    ];
    const { container } = render(<Harness messages={msgs} />);
    expect(container.querySelector("b")).toBeNull();
    expect(container.querySelector(".is-vote")?.textContent).toBe("<b>x</b> → y");
    expect(container.querySelector(".is-hot")?.textContent).toBe("<b>x</b> 님 과반");
  });

  it("CSS: .is-vote 글자 gray-100, .is-hot 글자 brass-200 (둘 다 14px 한 줄 규칙을 물려받는다)", () => {
    expect(rulesFor(V2_CSS, ".mv-chat__sys.is-vote").length).toBe(1);
    expect(rulesFor(V2_CSS, ".mv-chat__sys.is-hot").length).toBe(1);
    expect(rulesFor(V2_CSS, ".mv-chat__sys.is-vote").join(";")).toContain("color: var(--gray-100)");
    expect(rulesFor(V2_CSS, ".mv-chat__sys.is-hot").join(";")).toContain("color: var(--brass-200)");
    expect(rulesFor(V2_CSS, ".mv-chat__sys").join(";")).toContain("font-size: 14px");
  });
});

describe("ChatPanel 막힘 알림 (UI-SPEC 막힘 알림)", () => {
  it("notice 는 기록 칸 맨 아래 한 줄(role status)이고 아이콘이 없다", () => {
    const { container } = render(<Harness notice="지금은 보낼 수 없어요" />);
    const log = logOf(container);
    const last = log.lastElementChild;
    expect(last?.matches("p[data-chat-notice]")).toBe(true);
    expect(last?.getAttribute("role")).toBe("status");
    expect(last?.textContent).toBe("지금은 보낼 수 없어요");
    expect(last?.querySelector("svg")).toBeNull();
  });

  it("notice 가 null 이면 알림이 없다", () => {
    const { container } = render(<Harness notice={null} />);
    expect(container.querySelector("[data-chat-notice]")).toBeNull();
  });

  it("스타일: crimson-300 14px 이고 한 줄로 고정하지 않는다(nowrap 없음)", () => {
    const body = rulesFor(V2_CSS, ".mv-chat__notice").join(";");
    expect(body).toContain("color: var(--crimson-300)");
    expect(body).toContain("font-size: 14px");
    expect(body).not.toContain("nowrap");
    expect(body).toContain("word-break: keep-all");
  });
});

describe("ChatPanel 자동 스크롤과 새 메시지 점 (UI-SPEC 기록 칸 동작)", () => {
  // happy-dom 은 레이아웃이 없다(scrollHeight 0). 치수를 요소에 직접 정한다.
  function geometry(log: HTMLElement, g: { scrollHeight: number; clientHeight: number; scrollTop: number }) {
    const state = { top: g.scrollTop };
    Object.defineProperty(log, "scrollHeight", { configurable: true, get: () => g.scrollHeight });
    Object.defineProperty(log, "clientHeight", { configurable: true, get: () => g.clientHeight });
    Object.defineProperty(log, "scrollTop", { configurable: true, get: () => state.top, set: (v: number) => (state.top = v) });
    return state;
  }
  const MORE: ChatPanelMessage[] = [...TWO_LINES, { key: "c", kind: "player", seat: 0, name: "철수", text: "새 줄", ch: "all" }];

  it("처음에는 맨 아래로 따라간다", () => {
    const { container, rerender } = render(<Harness />);
    const log = logOf(container);
    const st = geometry(log, { scrollHeight: 500, clientHeight: 100, scrollTop: 400 });
    rerender(<Harness messages={MORE} />);
    expect(st.top).toBe(500);
    expect(container.querySelector("[data-chat-newdot]")).toBeNull();
  });

  it("바닥 24px 이내면 새 줄을 따라가고 점이 없다", () => {
    const { container, rerender } = render(<Harness />);
    const log = logOf(container);
    const st = geometry(log, { scrollHeight: 500, clientHeight: 100, scrollTop: 380 });
    fireEvent.scroll(log);
    rerender(<Harness messages={MORE} />);
    expect(st.top).toBe(500);
    expect(container.querySelector("[data-chat-newdot]")).toBeNull();
  });

  it("위로 올려 읽는 중이면 끌어내리지 않고 새 메시지 점(44×44, aria-label)을 띄운다", () => {
    const { container, rerender } = render(<Harness />);
    const log = logOf(container);
    const st = geometry(log, { scrollHeight: 500, clientHeight: 100, scrollTop: 300 });
    fireEvent.scroll(log);
    rerender(<Harness messages={MORE} />);
    expect(st.top).toBe(300);
    const dot = container.querySelector("button[data-chat-newdot]");
    expect(dot?.getAttribute("aria-label")).toBe("새 메시지");
    expect(dot?.textContent).toBe("");
    const body = rulesFor(V2_CSS, ".mv-chat__newdot").join(";");
    expect(body).toMatch(/width:\s*(var\(--tap-min\)|44px)/);
    expect(body).toMatch(/height:\s*(var\(--tap-min\)|44px)/);
  });

  it("점을 누르면 맨 아래로 가고 점이 사라진다", () => {
    const { container, rerender } = render(<Harness />);
    const log = logOf(container);
    const st = geometry(log, { scrollHeight: 500, clientHeight: 100, scrollTop: 300 });
    fireEvent.scroll(log);
    rerender(<Harness messages={MORE} />);
    const dot = container.querySelector("button[data-chat-newdot]");
    expect(dot).not.toBeNull();
    fireEvent.click(dot as Element);
    expect(st.top).toBe(500);
    expect(container.querySelector("[data-chat-newdot]")).toBeNull();
  });

  it("직접 바닥까지 내려 읽으면 점이 사라진다", () => {
    const { container, rerender } = render(<Harness />);
    const log = logOf(container);
    const st = geometry(log, { scrollHeight: 500, clientHeight: 100, scrollTop: 300 });
    fireEvent.scroll(log);
    rerender(<Harness messages={MORE} />);
    expect(container.querySelector("[data-chat-newdot]")).not.toBeNull();
    st.top = 395;
    fireEvent.scroll(log);
    expect(container.querySelector("[data-chat-newdot]")).toBeNull();
  });

  it("quiet(재접속 복원)면 위로 올려 읽는 중이어도 점을 만들지 않는다", () => {
    const { container, rerender } = render(<Harness />);
    const log = logOf(container);
    geometry(log, { scrollHeight: 500, clientHeight: 100, scrollTop: 300 });
    fireEvent.scroll(log);
    rerender(<Harness messages={MORE} quiet />);
    expect(container.querySelector("[data-chat-newdot]")).toBeNull();
  });

  it("막힘 알림이 뜨면 기록 칸을 맨 아래로 내려 알림이 보이게 한다", () => {
    const { container, rerender } = render(<Harness />);
    const log = logOf(container);
    const st = geometry(log, { scrollHeight: 500, clientHeight: 100, scrollTop: 300 });
    fireEvent.scroll(log);
    rerender(<Harness notice="조금 천천히 보내요" />);
    expect(st.top).toBe(500);
  });
});

describe("ChatPanel 보내기 상태와 키보드 열림 (UI-SPEC 입력 상태표)", () => {
  it("sendDim 이면 보내기만 is-dim 이 되고 입력칸은 계속 쓸 수 있다", () => {
    const { container } = render(<Harness sendDim initial="안녕" />);
    expect(sendBtn(container).classList.contains("is-dim")).toBe(true);
    expect(input(container).disabled).toBe(false);
    expect(rulesFor(V2_CSS, ".mv-chat__send.is-dim").join(";")).toContain("opacity: 0.45");
  });

  it("sendDisabled(연결 끊김)면 글자가 있어도 aria-disabled 이고 눌러도 안 가며, 입력칸은 활성이다", () => {
    const onSend = vi.fn();
    const { container } = render(<Harness sendDisabled onSend={onSend} initial="안녕" />);
    expect(sendBtn(container).getAttribute("aria-disabled")).toBe("true");
    expect(input(container).disabled).toBe(false);
    fireEvent.click(sendBtn(container));
    fireEvent.submit(form(container));
    expect(onSend).not.toHaveBeenCalled();
    expect(input(container).value).toBe("안녕");
  });

  it("compact 면 루트에 is-compact", () => {
    const { container } = render(<Harness compact />);
    expect(container.querySelector("[data-chat-panel]")?.classList.contains("is-compact")).toBe(true);
    const { container: c2 } = render(<Harness />);
    expect(c2.querySelector("[data-chat-panel]")?.classList.contains("is-compact")).toBe(false);
  });

  it("모션 줄이기: 새 메시지 점 맥박이 꺼진다", () => {
    const bare = V2_CSS.replace(/\/\*[\s\S]*?\*\//g, "");
    const block = bare.slice(bare.indexOf("@media (prefers-reduced-motion: reduce)"));
    expect(block.includes(".mv-chat__newdot")).toBe(true);
    expect(block.includes("animation: none")).toBe(true);
  });

  it("햅틱·진동·소리가 없다 (앱 전환 때 추가)", () => {
    for (const f of ["src/components/v2/ChatPanel.tsx", "src/game/chatUi.ts", "src/game/chatText.ts"]) {
      const code = readFileSync(f, "utf8")
        .split("\n")
        .filter((l) => !/^\s*(\/\/|\*)/.test(l))
        .join("\n");
      expect(/vibrate|new Audio|AudioContext|\.play\(/.test(code), `${f} 의 진동·소리`).toBe(false);
    }
  });
});

// 09-11 (MORN-02): 유언·쪽지·경찰 카드 블록
describe("ChatPanel card 메시지 (MORN-02)", () => {
  const will: ChatPanelMessage = { key: "c1", kind: "card", card: "will", title: "서연 님의 유언", icon: "quill", text: "범인은 2번" };

  it("유언 카드는 [data-card=will] 안에 아이콘 16·제목·본문을 그린다", () => {
    const { container } = render(<Harness messages={[will]} />);
    const card = container.querySelector('[data-card="will"]');
    expect(card, "[data-card=will]").toBeInstanceOf(HTMLElement);
    expect(card?.classList.contains("mv-chat__card")).toBe(true);
    expect(card?.querySelector(".mv-chat__card-title")?.textContent).toBe("서연 님의 유언");
    expect(card?.querySelector(".mv-chat__card-title svg")?.getAttribute("width")).toBe("16");
    expect(card?.querySelector(".mv-chat__card-text")?.textContent).toBe("범인은 2번");
  });

  it("쪽지 카드는 tone mafia 면 --mafia 변형을 달고, 경찰 카드는 data-card=eye 다", () => {
    const msgs: ChatPanelMessage[] = [
      { key: "n", kind: "card", card: "note", title: "쪽지", icon: "note", tone: "mafia", text: "다음은 너" },
      { key: "e", kind: "card", card: "eye", title: "민준", icon: "eye", text: "마피아 아님" },
    ];
    const { container } = render(<Harness messages={msgs} />);
    expect(container.querySelector('[data-card="note"]')?.classList.contains("mv-chat__card--mafia")).toBe(true);
    expect(container.querySelector('[data-card="eye"]')?.classList.contains("mv-chat__card--mafia")).toBe(false);
  });

  it("카드 본문의 HTML 은 글자 그대로 보이고 요소가 생기지 않는다 (T-09-23, E6 #33)", () => {
    const { container } = render(<Harness messages={[{ ...will, text: "<b>x</b>" }]} />);
    expect(container.querySelector("b")).toBeNull();
    expect(container.querySelector(".mv-chat__card-text")?.textContent).toBe("<b>x</b>");
  });

  it("카드 CSS: 반경 sm·면 night-800·테두리 night-600(쪽지 crimson-700), 제목 14px 700, 본문 16px gray-100·keep-all", () => {
    expect(rulesFor(V2_CSS, ".mv-chat__card").join(";")).toContain("background: var(--night-800)");
    expect(rulesFor(V2_CSS, ".mv-chat__card").join(";")).toContain("border: 1px solid var(--night-600)");
    expect(rulesFor(V2_CSS, ".mv-chat__card").join(";")).toContain("border-radius: var(--radius-sm)");
    expect(rulesFor(V2_CSS, ".mv-chat__card--mafia").join(";")).toContain("border-color: var(--crimson-700)");
    expect(rulesFor(V2_CSS, ".mv-chat__card-title").join(";")).toContain("font-size: 14px");
    expect(rulesFor(V2_CSS, ".mv-chat__card-text").join(";")).toContain("word-break: keep-all");
    expect(rulesFor(V2_CSS, ".mv-chat__card-text").join(";")).toContain("overflow-wrap: anywhere");
  });
});
