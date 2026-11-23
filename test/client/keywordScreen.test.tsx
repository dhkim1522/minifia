// 23-01: 키워드 카드 화면(src/screens/Keyword.tsx) — 장르 줄·큰 키워드(마피아는 ???)·각주(P23-3~5).
// 표식 값에는 역할·키워드를 싣지 않는다(T-23-03). 키워드는 텍스트 노드로만.
import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { KEYWORD_MS } from "../../shared/game/phases";
import type { ClientMessage, RoomView } from "../../shared/protocol";
import type { RoomEvent } from "../../src/net/useRoomConnection";

// 키보드 열림은 가짜로 바꾼다(실제 visualViewport 측정은 keyboardLift.test 가 시험한다)
const kb = vi.hoisted(() => ({ open: false }));
vi.mock("../../src/net/useKeyboardLift", async (importOriginal) => {
  const real = await importOriginal<typeof import("../../src/net/useKeyboardLift")>();
  return { ...real, useKeyboardLift: () => ({ open: kb.open, lift: () => 0, inSheet: false }) };
});

const { Keyword } = await import("../../src/screens/Keyword");

afterEach(() => {
  cleanup();
  kb.open = false;
});

const NOW = 1_700_000_000_000;

function makeView(me: RoomView["me"], elapsed = 0): RoomView {
  return {
    code: "0042",
    phase: "keyword",
    phaseEndsAt: NOW - elapsed + KEYWORD_MS,
    phaseDurationMs: KEYWORD_MS,
    serverNow: NOW,
    minPlayers: 4,
    maxPlayers: 8,
    players: [
      { seat: 0, nickname: "지우", connected: true, isHost: true, alive: true },
      { seat: 1, nickname: "하윤", connected: true, isHost: false, alive: true },
      { seat: 2, nickname: "민지", connected: true, isHost: false, alive: true },
      { seat: 3, nickname: "도현", connected: true, isHost: false, alive: true },
    ],
    me,
    day: { n: 1, roles: ["mafia", "police", "doctor", "citizen"], keyword: { genre: "영화" } },
  };
}

const renderKeyword = (view: RoomView) =>
  render(<Keyword view={view} offset={0} myRoleButton={<button type="button">역할 카드</button>} send={() => true} canSend onEvent={() => () => {}} />);

describe("키워드 카드 — 시민 편", () => {
  it("장르 줄·키워드·각주가 카드에 있고 카드는 '제시어 카드' 그룹이다", () => {
    const { container, getByRole } = renderKeyword(makeView({ seat: 0, isHost: true, role: "citizen", keyword: "해리포터" }));
    expect(container.querySelector("[data-keyword-screen]")).not.toBeNull();
    expect(container.querySelector("[data-keyword-genre]")!.textContent).toBe("주제 · 영화");
    expect(container.querySelector("[data-keyword-word]")!.textContent).toBe("해리포터");
    expect(container.querySelector("[data-keyword-note]")).toBeNull();
    expect(container.querySelector("input")?.placeholder).toBe("단서 입력");
    expect(getByRole("group", { name: "제시어 카드" })).toBe(container.querySelector("[data-keyword-card]"));
  });
});

describe("키워드 카드 — 마피아", () => {
  it("키워드 자리는 ??? 이고 접근성 이름은 '제시어를 볼 수 없어요', 어떤 data- 속성 값에도 역할·키워드가 없다", () => {
    const { container, getByLabelText } = renderKeyword(makeView({ seat: 1, isHost: false, role: "mafia", allies: [] }));
    const word = container.querySelector("[data-keyword-word]")!;
    expect(word.textContent).toBe("???");
    expect(getByLabelText("제시어를 볼 수 없어요")).toBe(word);
    expect(container.querySelector("[data-keyword-genre]")!.textContent).toBe("주제 · 영화");
    for (const el of container.querySelectorAll("*")) {
      for (const attr of Array.from(el.attributes)) {
        if (!attr.name.startsWith("data-")) continue;
        expect(attr.value).not.toMatch(/mafia|citizen|police|doctor|해리포터/);
      }
    }
  });
});

// ---- 23-09: 단서 입력줄·컴팩트 카드 (P23-6·9·12·13·15) ----

const CITIZEN: RoomView["me"] = { seat: 0, isHost: true, role: "citizen", keyword: "해리포터" };
const MAFIA: RoomView["me"] = { seat: 0, isHost: true, role: "mafia", allies: [] };

interface Run {
  sent: ClientMessage[];
  emit: (e: RoomEvent) => void;
  container: HTMLElement;
  rerenderWith: (view: RoomView) => void;
}

function renderAnswer(view: RoomView, opts: { canSend?: boolean } = {}): Run {
  const sent: ClientMessage[] = [];
  const listeners = new Set<(e: RoomEvent, meta: { epoch: number }) => void>();
  const send = (m: ClientMessage): boolean => {
    sent.push(m);
    return true;
  };
  const onEvent = (l: (e: RoomEvent, meta: { epoch: number }) => void) => {
    listeners.add(l);
    return () => listeners.delete(l);
  };
  const tree = (v: RoomView) => <Keyword view={v} offset={0} myRoleButton={<button type="button">역할 카드</button>} send={send} canSend={opts.canSend ?? true} onEvent={onEvent} />;
  const r = render(tree(view));
  return { sent, emit: (e) => listeners.forEach((l) => l(e, { epoch: 0 })), container: r.container, rerenderWith: (v) => r.rerender(tree(v)) };
}

const q = (c: HTMLElement, sel: string): HTMLElement => {
  const el = c.querySelector<HTMLElement>(sel);
  if (el === null) throw new Error(`없음: ${sel}`);
  return el;
};
const root = (c: HTMLElement) => q(c, "[data-answer-state]");
const input = (c: HTMLElement) => q(c, "[data-answer-input]") as HTMLInputElement;
const sendBtn = (c: HTMLElement) => q(c, "[data-answer-send]");
const type = (c: HTMLElement, text: string) => fireEvent.change(input(c), { target: { value: text } });
const errorFrame = (): RoomEvent => ({ t: "error", code: "BAD_MESSAGE", message: "x" }) as RoomEvent;

describe("키워드 입력줄 — 시작부터 쓰기", () => {
  beforeEach(() => {
    vi.useFakeTimers({ now: NOW });
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("제시어가 처음 보일 때 바로 입력할 수 있고, 입력 후 강조가 사라진다", () => {
    const { container } = renderAnswer(makeView(CITIZEN));
    expect(root(container).getAttribute("data-answer-state")).toBe("open");
    expect(input(container).disabled).toBe(false);
    expect(input(container).closest(".mv-chat__field")!.classList.contains("is-call")).toBe(true);
    expect(input(container).hasAttribute("data-call")).toBe(true);
    type(container, "안");
    expect(input(container).closest(".mv-chat__field")!.classList.contains("is-call")).toBe(false);
    expect(input(container).hasAttribute("data-call")).toBe(false);
  });

  it("입력칸 접근성·입력 속성: 이름과 자리표시는 '단서 입력', enterKeyHint send, autoComplete off", () => {
    const { container } = renderAnswer(makeView(CITIZEN, 5_000));
    const el = input(container);
    expect(el.getAttribute("aria-label")).toBe("단서 입력");
    expect(el.getAttribute("enterkeyhint")).toBe("send");
    expect(el.getAttribute("autocomplete")).toBe("off");
    expect(el.getAttribute("placeholder")).toBe("단서 입력");
    expect(el.getAttribute("aria-describedby")).toBe(q(container, ".mf-keyword__meta").id);
  });

  it("입력칸 옆에 남은 초를 표시하고 글자 수가 20이면 한도를 강조한다", () => {
    const { container } = renderAnswer(makeView(CITIZEN, 5_000));
    const gauge = q(container, ".mf-reveal__header [data-phase-gauge]");
    expect(gauge.getAttribute("aria-label")).toBe("남은 시간 30초");
    expect(gauge.textContent).toBe("");
    const seconds = q(container, "[data-answer-seconds]");
    expect(seconds.textContent).toBe("30초");
    expect(seconds.getAttribute("aria-hidden")).toBe("true");
    act(() => vi.advanceTimersByTime(1_000));
    expect(seconds.textContent).toBe("29초");
    expect(q(container, "[data-answer-count]").textContent).toBe("0/20");
    type(container, "안경");
    expect(q(container, "[data-answer-count]").textContent).toBe("2/20");
    expect(q(container, "[data-answer-count]").hasAttribute("data-full")).toBe(false);
    type(container, "가".repeat(21));
    expect(input(container).value).toBe("가".repeat(20));
    expect(q(container, "[data-answer-count]").textContent).toBe("20/20");
    expect(q(container, "[data-answer-count]").hasAttribute("data-full")).toBe(true);
  });
});

describe("키워드 입력줄 — 보내기와 제출 뒤 (P23-12·13)", () => {
  beforeEach(() => {
    vi.useFakeTimers({ now: NOW });
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("빈 글과 공백에는 전송을 숨기고 제출을 막는다. 지우면 다시 숨긴다", () => {
    const { container, sent } = renderAnswer(makeView(CITIZEN, 5_000));
    expect(container.querySelector("[data-answer-send], [data-answer-check]")).toBeNull();
    type(container, "안경");
    expect(sendBtn(container).closest(".mv-chat__field")).toBe(input(container).parentElement);
    type(container, "  ");
    expect(container.querySelector("[data-answer-send], [data-answer-check]")).toBeNull();
    fireEvent.submit(q(container, "form"));
    expect(sent).toHaveLength(0);
    expect(root(container).getAttribute("data-answer-state")).toBe("open");
  });

  it("연결이 끊기면 전송을 비활성화한다", () => {
    const off = renderAnswer(makeView(CITIZEN, 5_000), { canSend: false });
    type(off.container, "안경");
    expect((sendBtn(off.container) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.submit(q(off.container, "form"));
    expect(off.sent).toHaveLength(0);
  });

  it("글을 보내면 읽기 전용으로 바뀌고 서버가 접수한 뒤 같은 입력칸에 체크와 접근성 상태가 생긴다", () => {
    const { container, sent, rerenderWith } = renderAnswer(makeView(CITIZEN, 5_000));
    expect(input(container).closest("[data-keyword-card]")).not.toBeNull();
    type(container, "안경");
    expect((sendBtn(container) as HTMLButtonElement).disabled).toBe(false);
    expect(sendBtn(container).getAttribute("aria-label")).toBe("단서 보내기");
    fireEvent.click(sendBtn(container));
    expect(sent).toEqual([{ t: "answer", text: "안경", final: true }]);
    expect(root(container).getAttribute("data-answer-state")).toBe("sent");
    expect(input(container).readOnly).toBe(true);
    expect(input(container).value).toBe("안경");
    expect(container.querySelector("[data-answer-send], [data-answer-check], [data-answer-done]")).toBeNull();
    rerenderWith(makeView({ ...CITIZEN, answer: { text: "안경", final: true } }, 5_000));
    const check = q(container, "[data-answer-check]");
    expect(check.tagName).toBe("SPAN");
    expect(check.parentElement).toBe(input(container).parentElement);
    expect(check.querySelector("svg path")!.getAttribute("d")).toBe("M5 12.5l4.5 4.5L19 7.5");
    expect(q(container, "[data-answer-done]").textContent).toBe("단서 보냄");
    expect(q(container, "[data-answer-done]").closest("[data-keyword-card]")).not.toBeNull();
    // 제출 뒤 다시 제출해도 더 보내지 않는다
    fireEvent.submit(q(container, "form"));
    expect(sent.filter((m) => m.t === "answer" && m.final)).toHaveLength(1);
  });

  it("[보내기] mousedown 의 기본 동작을 막아 입력칸 포커스를 지킨다", () => {
    const { container } = renderAnswer(makeView(CITIZEN, 5_000));
    type(container, "안경");
    expect(fireEvent.mouseDown(sendBtn(container))).toBe(false);
  });

  it("입력 중 키보드 제출을 연달아 요청해도 한글 조합이 끝난 글을 한 번만 보낸다", () => {
    const { container, sent } = renderAnswer(makeView(CITIZEN, 5_000));
    fireEvent.compositionStart(input(container));
    type(container, "안겨");
    fireEvent.submit(q(container, "form"));
    fireEvent.submit(q(container, "form"));
    expect(sent).toHaveLength(0);
    type(container, "안경");
    fireEvent.compositionEnd(input(container));
    expect(sent).toEqual([{ t: "answer", text: "안경", final: true }]);
  });

  it("금지어로 거절되면 '쓸 수 없는 말이에요'(role=status) 2.5초, 입력 가능으로 돌아오고 글이 남는다", () => {
    const { container, emit } = renderAnswer(makeView(CITIZEN, 5_000));
    type(container, "안경");
    fireEvent.click(sendBtn(container));
    act(() => emit(errorFrame()));
    const notice = q(container, "[data-answer-notice]");
    expect(notice.getAttribute("role")).toBe("status");
    expect(notice.textContent).toBe("쓸 수 없는 말이에요");
    expect(root(container).getAttribute("data-answer-state")).toBe("open");
    expect(input(container).value).toBe("안경");
    expect(input(container).readOnly).toBe(false);
    expect(sendBtn(container).tagName).toBe("BUTTON");
    expect(container.querySelector("[data-answer-check]")).toBeNull();
    act(() => {
      vi.advanceTimersByTime(2_500);
    });
    expect(q(container, "[data-answer-notice]").textContent).toBe("");
  });

  it("시민 편은 알려진 제시어가 들어가면 수정 안내를 받고, 모르는 마피아에게는 정상 접수와 같은 조작을 제공한다", () => {
    const citizen = renderAnswer(makeView(CITIZEN));
    type(citizen.container, "해 리 포 터처럼");
    expect(q(citizen.container, "[data-answer-notice]").textContent).toBe("제시어가 들어 있어요. 다른 표현으로 바꿔 주세요.");
    expect(input(citizen.container).getAttribute("aria-invalid")).toBe("true");
    expect((sendBtn(citizen.container) as HTMLButtonElement).disabled).toBe(true);
    type(citizen.container, "안경");
    expect(q(citizen.container, "[data-answer-notice]").textContent).toBe("");
    fireEvent.click(sendBtn(citizen.container));
    expect(citizen.sent).toEqual([{ t: "answer", text: "안경", final: true }]);
    cleanup();
    const mafia = renderAnswer(makeView(MAFIA));
    type(mafia.container, "해 리 포 터처럼");
    expect(q(mafia.container, "[data-answer-notice]").textContent).toBe("");
    fireEvent.click(sendBtn(mafia.container));
    expect(mafia.sent).toEqual([{ t: "answer", text: "해 리 포 터처럼", final: true }]);
    expect(root(mafia.container).getAttribute("data-answer-state")).toBe("sent");
  });

  it("마피아와 시민의 입력줄(표식·문구·거절 알림)이 같다 — 카드의 키워드 줄만 다르다 (T-23-32·33)", () => {
    const outputs: string[] = [];
    for (const me of [CITIZEN, MAFIA]) {
      const { container, emit } = renderAnswer(makeView(me, 5_000));
      type(container, "안경");
      fireEvent.click(sendBtn(container));
      act(() => emit(errorFrame()));
      outputs.push(q(container, ".mf-keyword__answer").outerHTML);
      cleanup();
    }
    expect(outputs[0]).toBe(outputs[1]);
    expect(outputs[0]).not.toMatch(/mafia|citizen|police|doctor|해리포터/);
  });

  it("재접속: 시작 뒤 8초에 me.answer(확정)가 있는 view 는 카드 모션 없이(is-still) 입력줄 sent, 글이 그대로 보인다", () => {
    const { container } = renderAnswer(makeView({ ...CITIZEN, answer: { text: "안경", final: true } }, 8_000));
    expect(q(container, "[data-keyword-card]").classList.contains("is-still")).toBe(true);
    expect(root(container).getAttribute("data-answer-state")).toBe("sent");
    expect(input(container).value).toBe("안경");
    expect(q(container, "[data-answer-done]").textContent).toBe("단서 보냄");
  });

  it("재접속: 초안이면 글을 채우고 open 으로 이어 쓴다", () => {
    const { container } = renderAnswer(makeView({ ...CITIZEN, answer: { text: "안경", final: false } }, 8_000));
    expect(root(container).getAttribute("data-answer-state")).toBe("open");
    expect(input(container).value).toBe("안경");
  });
});

describe("키워드 카드 — 키보드가 열리면 컴팩트 (P23-15)", () => {
  beforeEach(() => {
    vi.useFakeTimers({ now: NOW });
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("열림이면 카드가 data-compact=true, 닫히면 큰 카드로 돌아온다", () => {
    const view = makeView(CITIZEN, 5_000);
    const { container, rerenderWith } = renderAnswer(view);
    expect(q(container, "[data-keyword-card]").hasAttribute("data-compact")).toBe(false);
    kb.open = true;
    rerenderWith(view);
    const card = q(container, "[data-keyword-card]");
    expect(card.getAttribute("data-compact")).toBe("true");
    expect(card.classList.contains("is-compact")).toBe(true);
    expect(q(container, "[data-keyword-word]").textContent).toBe("해리포터");
    kb.open = false;
    rerenderWith(view);
    expect(q(container, "[data-keyword-card]").hasAttribute("data-compact")).toBe(false);
  });

  it("CSS: 컴팩트 카드는 키워드 Heading 24 한 줄(nowrap), 안쪽 8 16, hex 색이 없다", () => {
    const css = readFileSync("src/styles/phase.css", "utf8");
    expect(css).toMatch(/\.mf-keyword__card\.is-compact \.mf-keyword__word\s*\{[^}]*font-size:\s*24px[^}]*white-space:\s*nowrap/);
    expect(css).toMatch(/\.mf-keyword__card\.is-compact\s*\{[^}]*padding:\s*8px 16px/);
    expect(css).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
  });
});
