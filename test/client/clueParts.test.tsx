import { readFileSync } from "node:fs";
import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import "../helpers/singleLineErrors";
import { ClueChip } from "../../src/components/v2/ClueChip";
import { ClueSpot } from "../../src/components/v2/ClueSpot";
import { LampOffMark } from "../../src/components/v2/LampOffMark";

// 21-13 Task 1 (D-08·D-14·D-15·D-26, P21-13): 현장 표식·단서 칩/카드·꺼진 등불 부품.
// 부품에는 역할 prop 이 없다 — 상태·글은 내가 받은 서버 값(me.clues 에서 온 상태·글)뿐이고 같은 입력이면 같은 DOM 이다(T-21-31).
afterEach(() => cleanup());

const V2_CSS = readFileSync("src/styles/v2.css", "utf8");
/** v2.css 에서 21-13 블록(첫 `.mv-clue-spot` 부터 끝까지) */
const CSS = ((): string => {
  const at = V2_CSS.indexOf(".mv-clue-spot");
  return at < 0 ? "" : V2_CSS.slice(at);
})();
const rule = (sel: string): string => new RegExp(`(?:^|\\n)${sel.replace(/[.[\]]/g, "\\$&")}\\s*\\{([^}]*)\\}`).exec(CSS)?.[1] ?? "";

describe("ClueSpot: 단서 지점 표식 52 (D-13·D-26)", () => {
  it("fresh: data-clue-spot·data-state=fresh·'발자국 살펴보기'·V 배지 없음·아이콘 26", () => {
    const { container } = render(<ClueSpot spot={1} state="fresh" onWalk={() => {}} />);
    const b = container.querySelector<HTMLElement>("[data-clue-spot]")!;
    expect(b.tagName).toBe("BUTTON");
    expect(b.dataset.clueSpot).toBe("1");
    expect(b.dataset.state).toBe("fresh");
    expect(b.getAttribute("aria-label")).toBe("발자국 살펴보기");
    expect(container.querySelector(".mv-clue-spot__badge")).toBeNull();
    expect(container.querySelector("svg")?.getAttribute("width")).toBe("26");
  });

  it("① 발자국 ② 옷 조각 ③ 창문의 접근성 이름: fresh '…살펴보기' · done '…살핌' · blurred '먼저 손댄 흔적'", () => {
    const label = (spot: 1 | 2 | 3, state: "fresh" | "done" | "blurred"): string => {
      const { container, unmount } = render(<ClueSpot spot={spot} state={state} onWalk={() => {}} />);
      const out = container.querySelector("[data-clue-spot]")!.getAttribute("aria-label")!;
      unmount();
      return out;
    };
    expect([label(1, "fresh"), label(2, "fresh"), label(3, "fresh")]).toEqual(["발자국 살펴보기", "옷 조각 살펴보기", "창문 살펴보기"]);
    expect([label(1, "done"), label(2, "done"), label(3, "done")]).toEqual(["발자국 살핌", "옷 조각 살핌", "창문 살핌"]);
    expect([label(1, "blurred"), label(2, "blurred"), label(3, "blurred")]).toEqual(["먼저 손댄 흔적", "먼저 손댄 흔적", "먼저 손댄 흔적"]);
  });

  it("V 배지는 done 에만 있다(블러는 점선·흐림이고 배지가 없다)", () => {
    const has = (state: "fresh" | "done" | "blurred"): boolean => {
      const { container, unmount } = render(<ClueSpot spot={2} state={state} onWalk={() => {}} />);
      const out = container.querySelector(".mv-clue-spot__badge") !== null;
      unmount();
      return out;
    };
    expect([has("fresh"), has("done"), has("blurred")]).toEqual([false, true, false]);
  });

  it("call 이면 is-call 과 data-call, 아니면 둘 다 없다. 누르면 onWalk 한 번", () => {
    const onWalk = vi.fn();
    const { container, rerender } = render(<ClueSpot spot={3} state="fresh" onWalk={onWalk} />);
    const b = () => container.querySelector<HTMLElement>("[data-clue-spot]")!;
    expect(b().className).not.toMatch(/is-call/);
    expect(b().hasAttribute("data-call")).toBe(false);
    rerender(<ClueSpot spot={3} state="fresh" call onWalk={onWalk} />);
    expect(b().className).toMatch(/is-call/);
    expect(b().hasAttribute("data-call")).toBe(true);
    fireEvent.click(b());
    expect(onWalk).toHaveBeenCalledTimes(1);
  });

  it("hidden 이면 숨김으로 마운트한다(투영 전 — 위치는 층이 쓴다)", () => {
    const { container } = render(<ClueSpot spot={1} state="fresh" hidden onWalk={() => {}} />);
    expect(container.querySelector<HTMLElement>("[data-clue-spot]")!.hidden).toBe(true);
  });

  it("같은 입력이면 같은 DOM 이다", () => {
    const a = render(<ClueSpot spot={2} state="done" onWalk={() => {}} />).container.innerHTML;
    cleanup();
    const b = render(<ClueSpot spot={2} state="done" onWalk={() => {}} />).container.innerHTML;
    expect(a).toBe(b);
  });
});

describe("ClueChip: 칩 32 · 카드 44 (D-14·D-15, P21-13)", () => {
  it("칩·카드 크기 클래스와 data-clue-chip 종류, 글은 받은 text 그대로", () => {
    const chip = render(<ClueChip kind="footprint" icon="footprint" text="발자국 둘" size="chip" />).container;
    const el = chip.querySelector<HTMLElement>("[data-clue-chip]")!;
    expect(el.dataset.clueChip).toBe("footprint");
    expect(el.className).toMatch(/mv-clue-chip--chip/);
    expect(el.textContent).toBe("발자국 둘");
    cleanup();
    const card = render(<ClueChip kind="cloth" icon="cloth" text="검은 천 조각" size="card" />).container;
    const el2 = card.querySelector<HTMLElement>("[data-clue-chip]")!;
    expect(el2.dataset.clueChip).toBe("cloth");
    expect(el2.className).toMatch(/mv-clue-chip--card/);
    expect(el2.textContent).toBe("검은 천 조각");
  });

  it("아이콘 크기: 칩 14 · 카드 22", () => {
    const w = (size: "chip" | "card"): string | null => {
      const { container, unmount } = render(<ClueChip kind="window" icon="window" text="푸른 천 조각" size={size} />);
      const out = container.querySelector("svg")?.getAttribute("width") ?? null;
      unmount();
      return out;
    };
    expect([w("chip"), w("card")]).toEqual(["14", "22"]);
  });

  it("먼저 손댄 흔적·어두워서 못 봤어요·단서 없음은 점선(is-faint), 받은 단서는 점선이 아니다", () => {
    const faint = (kind: "footprint" | "touched" | "dark" | "none"): boolean => {
      const { container, unmount } = render(<ClueChip kind={kind} icon={kind === "none" ? null : "window"} text="글" size="card" />);
      const out = (container.querySelector<HTMLElement>("[data-clue-chip]")!.className).includes("is-faint");
      unmount();
      return out;
    };
    expect([faint("footprint"), faint("touched"), faint("dark"), faint("none")]).toEqual([false, true, true, true]);
  });

  it("아이콘이 없는 칩(단서 없음)은 svg 가 없다", () => {
    const { container } = render(<ClueChip kind="none" icon={null} text="단서 없음" size="chip" />);
    expect(container.querySelector("svg")).toBeNull();
    expect(container.textContent).toBe("단서 없음");
  });

  it("같은 입력이면 같은 DOM 이다", () => {
    const a = render(<ClueChip kind="touched" icon="footprint" text="먼저 손댄 흔적" size="card" />).container.innerHTML;
    cleanup();
    const b = render(<ClueChip kind="touched" icon="footprint" text="먼저 손댄 흔적" size="card" />).container.innerHTML;
    expect(a).toBe(b);
  });
});

describe("LampOffMark: 꺼진 등불 표식 36 (D-08)", () => {
  it("data-lamp-off 값·접근성 이름 '꺼진 등불'·flame 18·눌림 통과 클래스", () => {
    const { container } = render(<LampOffMark n={2} />);
    const el = container.querySelector<HTMLElement>("[data-lamp-off]")!;
    expect(el.dataset.lampOff).toBe("2");
    expect(el.getAttribute("aria-label")).toBe("꺼진 등불");
    expect(el.tagName).not.toBe("BUTTON");
    expect(el.className).toMatch(/mv-lamp-off/);
    expect(container.querySelector("svg")?.getAttribute("width")).toBe("18");
    expect(rule(".mv-lamp-off")).toMatch(/pointer-events: none/);
  });
});

describe("스타일 계약 (토큰만)", () => {
  it("표식 52·2px 금빛 테두리와 빛, done 은 gray-500 테두리·gray-800 면, blurred 는 점선·불투명도 0.6", () => {
    expect(rule(".mv-clue-spot")).toMatch(/width: 52px/);
    expect(rule(".mv-clue-spot")).toMatch(/height: 52px/);
    expect(rule(".mv-clue-spot")).toMatch(/border: 2px solid var\(--light-lamp\)/);
    expect(rule(".mv-clue-spot")).toMatch(/box-shadow: 0 0 14px 3px/);
    expect(rule('.mv-clue-spot[data-state="done"]')).toMatch(/border-color: var\(--gray-500\)/);
    expect(rule('.mv-clue-spot[data-state="done"]')).toMatch(/background: var\(--gray-800\)/);
    expect(rule('.mv-clue-spot[data-state="blurred"]')).toMatch(/border-style: dashed/);
    expect(rule('.mv-clue-spot[data-state="blurred"]')).toMatch(/opacity: 0\.6/);
  });

  it("V 배지 20·gray-100, 꺼진 등불 36 점선 gray-500 불투명도 0.6", () => {
    expect(rule(".mv-clue-spot__badge")).toMatch(/width: 20px/);
    expect(rule(".mv-clue-spot__badge")).toMatch(/background: var\(--gray-100\)/);
    expect(rule(".mv-lamp-off")).toMatch(/width: 36px/);
    expect(rule(".mv-lamp-off")).toMatch(/border: 2px dashed var\(--gray-500\)/);
    expect(rule(".mv-lamp-off")).toMatch(/opacity: 0\.6/);
  });

  it("카드 44·둥근 14·14/700·night-800 면 + 1px night-600, 점선 카드는 gray-500·불투명도 0.75", () => {
    expect(rule(".mv-clue-chip--card")).toMatch(/height: 44px/);
    expect(rule(".mv-clue-chip--card")).toMatch(/border-radius: var\(--radius-md\)/);
    expect(rule(".mv-clue-chip--card")).toMatch(/font-size: 14px/);
    expect(rule(".mv-clue-chip--card")).toMatch(/font-weight: 700/);
    expect(rule(".mv-clue-chip--card")).toMatch(/background: var\(--night-800\)/);
    expect(rule(".mv-clue-chip--card")).toMatch(/border: 1px solid var\(--night-600\)/);
    expect(rule(".mv-clue-chip--card.is-faint")).toMatch(/border: 1px dashed var\(--gray-500\)/);
    expect(rule(".mv-clue-chip--card.is-faint")).toMatch(/opacity: 0\.75/);
    expect(rule(".mv-clue-chip--chip")).toMatch(/height: 32px/);
    expect(rule(".mv-clue-chip")).toMatch(/word-break: keep-all/);
  });

  it("카드 올라옴은 --dur-fast, 모션 줄이기에서는 애니메이션이 없다", () => {
    expect(rule(".mv-clue-chip--card")).toMatch(/animation: mv-clue-rise var\(--dur-fast\)/);
    const reduced = /@media \(prefers-reduced-motion: reduce\)\s*\{[^}]*\.mv-clue-chip[^}]*animation: none/.test(CSS);
    expect(reduced).toBe(true);
    expect(rule(".mv-clue-spot")).not.toMatch(/transition/);
  });

  it("21-13 블록에는 hex 색이 없다", () => {
    expect(CSS).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
  });
});
