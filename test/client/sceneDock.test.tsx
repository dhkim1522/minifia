import { readFileSync } from "node:fs";
import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import "../helpers/singleLineErrors";
import { DOCK_H, DOCK_ROW_H, HOLD_MS, SceneDock } from "../../src/components/v2/SceneDock";
import type { SceneDockProps } from "../../src/components/v2/SceneDock";
import { LOG_H } from "../../src/game/chatUi";

// 21-11 Task 1 (D-06·D-23·D-24, P21-1·P21-6·P21-8): 저녁·아침 독. 읽기 전용 기록 두 줄 + 금빛 [켜기](길게 누르기 hold) + [건너뛰기] 토글.
// 부품에는 역할 prop 이 없다 — 같은 입력이면 같은 DOM 이고, 누르는 동안의 채움 막대도 누구에게나 같다(T-21-27).
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const V2_CSS = readFileSync("src/styles/v2.css", "utf8");
const GAME_CSS = readFileSync("src/styles/game.css", "utf8");

function props(over: Partial<SceneDockProps> = {}): SceneDockProps {
  return {
    log: { messages: [] },
    primary: { kind: "lamp", disabled: false, call: false, done: false, onPress: vi.fn() },
    skip: { count: 2, total: 4, pressed: false, onToggle: vi.fn() },
    ...over,
  };
}
const mainBtn = (c: ParentNode): HTMLElement => c.querySelector<HTMLElement>("[data-errand-act]")!;
const skipBtn = (c: ParentNode): HTMLElement | null => c.querySelector<HTMLElement>("[data-skip-phase]");

describe("SceneDock: 구성과 높이 (P21-1)", () => {
  it("독 높이 170 = 위 14 + 기록 LOG_H(68) + 간격 10 + 행동 줄 56 + 아래 22 이고 기존 패널 값에서 온다", () => {
    expect(DOCK_ROW_H).toBe(56);
    expect(DOCK_H).toBe(14 + LOG_H + 10 + DOCK_ROW_H + 22);
    expect(DOCK_H).toBe(170);
    // 기존 .mf-game__panel 의 패딩 14·22·간격 10 을 독이 그대로 쓴다(새 수 없음)
    expect(GAME_CSS).toMatch(/\.mf-game__panel\s*\{[^}]*gap: 10px[^}]*padding: 14px var\(--space-md\) 22px/);
  });

  it("읽기 전용 기록 칸(두 줄 창 68)만 있고 입력줄·키보드 입력은 없다", () => {
    const { container } = render(<SceneDock {...props()} />);
    const log = container.querySelector<HTMLElement>("[data-chat-log]")!;
    expect(log).not.toBeNull();
    expect(log.style.height).toBe("68px");
    expect(container.querySelector("[data-chat-input]")).toBeNull();
    expect(container.querySelector("form")).toBeNull();
    expect(container.querySelector("input, textarea")).toBeNull();
  });

  it("기록 줄은 받은 messages 를 그대로 보인다", () => {
    const { container } = render(<SceneDock {...props({ log: { messages: [{ key: "a", kind: "system", text: "하늘 님이 들어왔어요" }] } })} />);
    expect(container.querySelector("[data-chat-log]")!.textContent).toContain("하늘 님이 들어왔어요");
  });

  it("독 루트는 패널 자리의 표식(data-world-panel)과 ref 를 받는다", () => {
    const ref = { current: null as HTMLElement | null };
    const { container } = render(<SceneDock {...props()} panelRef={ref} />);
    const root = container.querySelector<HTMLElement>("[data-scene-dock]")!;
    expect(root.classList.contains("mf-game__dock")).toBe(true);
    expect(root.hasAttribute("data-world-panel")).toBe(true);
    expect(ref.current).toBe(root);
  });
});

describe("SceneDock: [켜기] 주 단추 (D-24, P21-5)", () => {
  it("data-errand-act 표식·접근성 이름 '등불 켜기'·보이는 글 '켜기'·불꽃 아이콘, 처음에는 비활성도 빛도 아니다", () => {
    const { container } = render(<SceneDock {...props()} />);
    const b = mainBtn(container);
    expect(b.tagName).toBe("BUTTON");
    expect(b.getAttribute("aria-label")).toBe("등불 켜기");
    expect(b.textContent).toBe("켜기");
    expect(b.querySelector("svg path")!.getAttribute("d")).toContain("M12 3c3 4 5 6 5 10"); // flame
    expect(b.hasAttribute("aria-disabled")).toBe(false);
    expect(b.hasAttribute("data-call")).toBe(false);
    expect(b.classList.contains("is-call")).toBe(false);
  });

  it("disabled 이면 aria-disabled=true 이고 눌러도 onPress 가 불리지 않는다(안내 글 없음)", () => {
    const onPress = vi.fn();
    const { container } = render(<SceneDock {...props({ primary: { kind: "lamp", disabled: true, call: false, done: false, onPress } })} />);
    const b = mainBtn(container);
    expect(b.getAttribute("aria-disabled")).toBe("true");
    fireEvent.pointerDown(b);
    fireEvent.pointerUp(b);
    fireEvent.click(b);
    fireEvent.keyDown(b, { key: "Enter" });
    expect(onPress).not.toHaveBeenCalled();
    expect(container.querySelector("[role=alert], [role=status]:not([data-chat-notice])")).toBeNull();
    expect(b.textContent).toBe("켜기");
  });

  it("call 이면 data-call(값 없음)과 is-call 이 있다", () => {
    const { container } = render(<SceneDock {...props({ primary: { kind: "lamp", disabled: false, call: true, done: false, onPress: vi.fn() } })} />);
    const b = mainBtn(container);
    expect(b.getAttribute("data-call")).toBe("");
    expect(b.classList.contains("is-call")).toBe(true);
  });

  it("done 이면 '완료' 비활성 모양(check)이고 눌러도 아무 일 없다", () => {
    const onPress = vi.fn();
    const { container } = render(<SceneDock {...props({ primary: { kind: "lamp", disabled: false, call: false, done: true, onPress } })} />);
    const b = mainBtn(container);
    expect(b.textContent).toBe("완료");
    expect(b.getAttribute("aria-disabled")).toBe("true");
    expect(b.querySelector("svg path")!.getAttribute("d")).toContain("M5 12.5l4.5 4.5L19 7.5"); // check
    fireEvent.pointerDown(b);
    fireEvent.pointerUp(b);
    expect(onPress).not.toHaveBeenCalled();
  });
});

describe("SceneDock: 길게 누르기 hold 판정 (D-06, P21-8)", () => {
  const press = (c: ParentNode, ms: number, end: "pointerUp" | "pointerCancel" | "pointerLeave" = "pointerUp"): void => {
    const b = mainBtn(c);
    fireEvent.pointerDown(b);
    act(() => {
      vi.advanceTimersByTime(ms);
    });
    fireEvent[end](b);
  };
  const setup = () => {
    vi.useFakeTimers({ now: 1_700_000_000_000 });
    const onPress = vi.fn();
    const r = render(<SceneDock {...props({ primary: { kind: "lamp", disabled: false, call: false, done: false, onPress } })} />);
    return { ...r, onPress };
  };

  it("HOLD_MS 는 600 이다", () => {
    expect(HOLD_MS).toBe(600);
  });

  it("300ms 만에 떼면 onPress(false), 700ms 면 onPress(true) 가 각각 한 번", () => {
    const { container, onPress } = setup();
    press(container, 300);
    expect(onPress).toHaveBeenCalledTimes(1);
    expect(onPress).toHaveBeenLastCalledWith(false);
    press(container, 700);
    expect(onPress).toHaveBeenCalledTimes(2);
    expect(onPress).toHaveBeenLastCalledWith(true);
  });

  it("경계: 599ms 는 false, 600ms 는 true", () => {
    const { container, onPress } = setup();
    press(container, 599);
    expect(onPress).toHaveBeenLastCalledWith(false);
    press(container, 600);
    expect(onPress).toHaveBeenLastCalledWith(true);
  });

  it("pointercancel·pointerleave 로 끝나면 보내지 않는다", () => {
    const { container, onPress } = setup();
    press(container, 800, "pointerCancel");
    press(container, 800, "pointerLeave");
    expect(onPress).not.toHaveBeenCalled();
  });

  it("Enter·Space 는 onPress(false) 한 번(길게 누르기 없음)", () => {
    const { container, onPress } = setup();
    const b = mainBtn(container);
    fireEvent.keyDown(b, { key: "Enter" });
    expect(onPress).toHaveBeenCalledTimes(1);
    expect(onPress).toHaveBeenLastCalledWith(false);
    fireEvent.keyDown(b, { key: " " });
    expect(onPress).toHaveBeenCalledTimes(2);
    expect(onPress).toHaveBeenLastCalledWith(false);
  });

  it("손가락 누름 뒤 따라오는 click 은 한 번 더 보내지 않는다", () => {
    const { container, onPress } = setup();
    press(container, 100);
    fireEvent.click(mainBtn(container), { detail: 1 });
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it("누르는 동안 채움 막대가 켜지고(0.6초 선형) 떼면 곧바로 비워진다", () => {
    const { container } = setup();
    const b = mainBtn(container);
    const fill = b.querySelector<HTMLElement>("[data-hold-fill]")!;
    expect(fill.style.transform).toBe("scaleX(0)");
    fireEvent.pointerDown(b);
    expect(fill.style.transform).toBe("scaleX(1)");
    expect(fill.style.transition).toContain("600ms");
    expect(fill.style.transition).toContain("linear");
    fireEvent.pointerUp(b);
    expect(fill.style.transform).toBe("scaleX(0)");
  });

  it("모션 줄이기: 채움 막대의 transition 이 없고 누르는 즉시 가득 찬다", () => {
    vi.stubGlobal("matchMedia", (q: string) => ({ matches: q.includes("reduce"), media: q, addEventListener: () => {}, removeEventListener: () => {}, addListener: () => {}, removeListener: () => {} }));
    const { container } = setup();
    const b = mainBtn(container);
    const fill = b.querySelector<HTMLElement>("[data-hold-fill]")!;
    fireEvent.pointerDown(b);
    expect(fill.style.transform).toBe("scaleX(1)");
    expect(fill.style.transition === "" || fill.style.transition === "none").toBe(true);
  });
});

describe("SceneDock: 역할을 모른다 (T-21-27, P21-8)", () => {
  it("같은 props 로 두 번 그린 독의 outerHTML 이 같고 누르는 동안의 DOM 도 같다(역할 prop 은 타입이 막는다)", () => {
    const outs: string[] = [];
    const holding: string[] = [];
    for (let i = 0; i < 2; i++) {
      const { container, unmount } = render(<SceneDock {...props()} />);
      outs.push(container.innerHTML);
      fireEvent.pointerDown(mainBtn(container));
      holding.push(container.innerHTML);
      unmount();
    }
    expect(outs[1]).toBe(outs[0]);
    expect(holding[1]).toBe(holding[0]);
    // @ts-expect-error 역할 prop 은 없다 — 화면은 역할을 읽지 않는다
    render(<SceneDock {...props()} role="mafia" />);
  });

  it("부품 소스가 역할·동료·서버 전용 낱말을 읽지 않고 hex 색도 쓰지 않는다", () => {
    const src = readFileSync("src/components/v2/SceneDock.tsx", "utf8");
    const code = src.split("\n").filter((l) => !/^\s*\/\//.test(l)).join("\n");
    expect(code).not.toMatch(/\.role\b|allies|\bme\b/);
    expect(code).not.toMatch(/#[0-9a-fA-F]{3,6}\b/);
    expect(src).toContain("data-skip-phase");
    expect(src).toContain("data-errand-act");
  });
});

describe("SceneDock: [건너뛰기] (D-23, P21-6)", () => {
  it("표식 data-skip-phase·data-skip-count·접근성 이름 '건너뛰기 2/4'·aria-pressed", () => {
    const { container } = render(<SceneDock {...props()} />);
    const b = skipBtn(container)!;
    expect(b.getAttribute("data-skip-count")).toBe("2");
    expect(b.getAttribute("aria-label")).toBe("건너뛰기 2/4");
    expect(b.getAttribute("aria-pressed")).toBe("false");
    expect(b.textContent).toContain("건너뛰기");
    expect(b.textContent).toContain("2 / 4");
  });

  it("누르면 onToggle(!pressed): 안 눌렸으면 true, 눌렸으면 false", () => {
    const onToggle = vi.fn();
    const a = render(<SceneDock {...props({ skip: { count: 0, total: 4, pressed: false, onToggle } })} />);
    fireEvent.click(skipBtn(a.container)!);
    expect(onToggle).toHaveBeenLastCalledWith(true);
    a.unmount();
    const b = render(<SceneDock {...props({ skip: { count: 1, total: 4, pressed: true, onToggle } })} />);
    expect(skipBtn(b.container)!.getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(skipBtn(b.container)!);
    expect(onToggle).toHaveBeenLastCalledWith(false);
  });

  it("skip 이 null(유령)이면 단추가 없다", () => {
    const { container } = render(<SceneDock {...props({ skip: null })} />);
    expect(skipBtn(container)).toBeNull();
    expect(mainBtn(container)).not.toBeNull();
  });
});

describe("SceneDock: 스타일 계약 (토큰만, 새 값 없음)", () => {
  const rule = (css: string, sel: string): string => css.match(new RegExp(`${sel.replace(/[.[\]]/g, "\\$&")}\\s*\\{([^}]*)\\}`))?.[1] ?? "";

  it("[켜기] 는 --light-lamp 바탕·--night-900 글·16/700·높이 56·알약", () => {
    const r = rule(V2_CSS, ".mv-scene-dock__main");
    expect(r).toMatch(/background: var\(--light-lamp\)/);
    expect(r).toMatch(/color: var\(--night-900\)/);
    expect(r).toMatch(/height: 56px/);
    expect(r).toMatch(/font-size: 16px/);
    expect(r).toMatch(/font-weight: 700/);
    expect(r).toMatch(/border-radius: var\(--radius-pill\)/);
  });

  it("비활성은 --night-700 면·불투명도 0.45, 채움 막대는 --gray-100 35%, 켜기 빛 테두리는 3px", () => {
    expect(rule(V2_CSS, '.mv-scene-dock__main[aria-disabled="true"]')).toMatch(/background: var\(--night-700\)[^}]*opacity: 0\.45/);
    expect(rule(V2_CSS, ".mv-scene-dock__fill")).toMatch(/var\(--gray-100\) 35%/);
    expect(rule(V2_CSS, ".mv-scene-dock__main.is-call::after")).toMatch(/border-width: 3px/);
  });

  it("[건너뛰기] 는 너비 112·높이 56, 독 규칙에는 hex 가 없다", () => {
    const r = rule(V2_CSS, ".mv-scene-dock__skip");
    expect(r).toMatch(/width: 112px/);
    expect(r).toMatch(/height: 56px/);
    const block = V2_CSS.slice(V2_CSS.indexOf(".mv-scene-dock"), V2_CSS.indexOf(".mv-errand-pin {"));
    expect(block).not.toMatch(/#[0-9a-fA-F]{3,6}\b/);
  });
});
