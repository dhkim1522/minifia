// 24-07: FocusRing — 대상 DOM 사각형을 재서 사방 8 키운 4px 깜빡임 링 + 바깥 어둡게(--scrim)를 그린다 (UI-SPEC P24-26, 결정 0078-8, T-17-11).
// 옛 구현(00829164^)의 측정 시험을 새 표식(data-tutorial-ring·data-tutorial-target)과 한 링 모양에 맞춰 되살렸다.
import { readFileSync } from "node:fs";
import { act, cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FocusRing } from "../../src/components/tutorial/FocusRing";
import "../helpers/singleLineErrors";

const rects = new Map<string, { left: number; top: number; width: number; height: number }>();

beforeEach(() => {
  vi.useFakeTimers();
  rects.clear();
  vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(function (this: Element) {
    const r = rects.get(this.getAttribute("data-t") ?? "") ?? { left: 0, top: 0, width: 0, height: 0 };
    return { ...r, right: r.left + r.width, bottom: r.top + r.height, x: r.left, y: r.top, toJSON: () => ({}) } as DOMRect;
  });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

const frame = (): void => {
  act(() => {
    vi.advanceTimersByTime(50);
  });
};
const ring = (c: ParentNode) => c.querySelector<HTMLElement>("[data-tutorial-ring]");
const dim = (c: ParentNode) => c.querySelector<SVGSVGElement>("svg[data-tutorial-dim]");
const hole = (c: ParentNode) => c.querySelector<SVGRectElement>("rect[data-tutorial-hole]");
const sel = (name: string) => ({ id: "send" as const, selectors: [`[data-t="${name}"]`] });

describe("링 상자 (사방 8)", () => {
  it("대상 {100,200,96,40} → 링 left 92·top 192·width 112·height 56, aria-hidden, data-tutorial-ring·data-tutorial-target 값", () => {
    rects.set("a", { left: 100, top: 200, width: 96, height: 40 });
    const { container } = render(
      <>
        <button data-t="a">a</button>
        <FocusRing target={sel("a")} />
      </>,
    );
    frame();
    const box = ring(container);
    expect(box).not.toBeNull();
    expect(box!.style.left).toBe("92px");
    expect(box!.style.top).toBe("192px");
    expect(box!.style.width).toBe("112px");
    expect(box!.style.height).toBe("56px");
    expect(box!.getAttribute("aria-hidden")).toBe("true");
    expect(box!.getAttribute("data-tutorial-target")).toBe("send");
  });

  it("링·어둡게 층 모두 pointer-events none 이 되도록 CSS 에 적혀 있다", () => {
    const css = readFileSync("src/styles/tutorial.css", "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
    for (const head of [".tut-focus-layer {", ".tut-ring {", ".tut-dim {"]) {
      const start = css.indexOf(head);
      expect(start, head).toBeGreaterThanOrEqual(0);
      expect(css.slice(start, css.indexOf("}", start))).toMatch(/pointer-events:\s*none/);
    }
  });

  it("사각형이 0×0 이면 링도 어둡게도 그리지 않는다(못 쟀으면 그리지 않는다)", () => {
    const { container } = render(
      <>
        <button data-t="zero">z</button>
        <FocusRing target={sel("zero")} />
      </>,
    );
    frame();
    expect(ring(container)).toBeNull();
    expect(dim(container)).toBeNull();
  });

  it("selectors 에 맞는 요소가 없어도, target 이 null 이어도 그리지 않는다", () => {
    const none = render(<FocusRing target={{ id: "send", selectors: ['[data-t="nothing"]'] }} />);
    frame();
    expect(ring(none.container)).toBeNull();
    cleanup();
    const off = render(<FocusRing target={null} />);
    frame();
    expect(ring(off.container)).toBeNull();
    expect(dim(off.container)).toBeNull();
  });

  it("화면 오른쪽 끝에 붙은 대상은 링이 innerWidth − 8 안으로 밀린다(크기는 그대로)", () => {
    const w = window.innerWidth;
    rects.set("edge", { left: w - 96, top: 100, width: 96, height: 40 });
    const { container } = render(
      <>
        <button data-t="edge">e</button>
        <FocusRing target={sel("edge")} />
      </>,
    );
    frame();
    const box = ring(container)!;
    expect(Number.parseFloat(box.style.left) + Number.parseFloat(box.style.width)).toBeLessThanOrEqual(w - 8);
    expect(Number.parseFloat(box.style.width)).toBe(112);
  });

  it("왼쪽·위 끝에 붙은 대상은 링이 8 안쪽으로 밀린다", () => {
    rects.set("corner", { left: 0, top: 0, width: 50, height: 30 });
    const { container } = render(
      <>
        <button data-t="corner">c</button>
        <FocusRing target={sel("corner")} />
      </>,
    );
    frame();
    const box = ring(container)!;
    expect(Number.parseFloat(box.style.left)).toBeGreaterThanOrEqual(8);
    expect(Number.parseFloat(box.style.top)).toBeGreaterThanOrEqual(8);
  });

  it("selectors 둘을 주면 링 하나가 두 사각형의 합집합을 감싼다", () => {
    rects.set("tile", { left: 100, top: 300, width: 64, height: 64 });
    rects.set("act", { left: 120, top: 250, width: 80, height: 44 });
    const { container } = render(
      <>
        <button data-t="tile">t</button>
        <button data-t="act">a</button>
        <FocusRing target={{ id: "send", selectors: ['[data-t="tile"]', '[data-t="act"]'] }} />
      </>,
    );
    frame();
    expect(container.querySelectorAll("[data-tutorial-ring]")).toHaveLength(1);
    const box = ring(container)!;
    expect(box.style.left).toBe("92px");
    expect(box.style.top).toBe("242px");
    expect(box.style.width).toBe("116px");
    expect(box.style.height).toBe("130px");
  });

  it("pill 대상은 모서리가 radius-pill 이다", () => {
    rects.set("p", { left: 40, top: 100, width: 88, height: 24 });
    const { container } = render(
      <>
        <div data-t="p">p</div>
        <FocusRing target={{ ...sel("p"), pill: true }} />
      </>,
    );
    frame();
    expect(ring(container)!.style.borderRadius).toBe("var(--radius-pill)");
  });

  it("측정이 직전과 같으면 상태를 바꾸지 않는다(같은 DOM 노드 유지, T-17-11)", () => {
    rects.set("a", { left: 100, top: 200, width: 96, height: 40 });
    const { container } = render(
      <>
        <button data-t="a">a</button>
        <FocusRing target={sel("a")} />
      </>,
    );
    frame();
    const first = ring(container);
    const style = first!.getAttribute("style");
    frame();
    frame();
    expect(ring(container)).toBe(first);
    expect(ring(container)!.getAttribute("style")).toBe(style);
  });

  it("대상이 사라지면 링도 사라지고, 움직이면 다음 프레임에 따라간다", () => {
    rects.set("mv", { left: 100, top: 200, width: 96, height: 40 });
    const { container, rerender } = render(
      <>
        <button data-t="mv">m</button>
        <FocusRing target={sel("mv")} />
      </>,
    );
    frame();
    rects.set("mv", { left: 150, top: 220, width: 96, height: 40 });
    frame();
    expect(ring(container)!.style.left).toBe("142px");
    expect(ring(container)!.style.top).toBe("212px");
    rerender(<FocusRing target={null} />);
    frame();
    expect(ring(container)).toBeNull();
  });

  it("대상 요소가 DOM 에서 사라져 0×0 이 되면 링이 사라진다", () => {
    rects.set("gone", { left: 100, top: 200, width: 96, height: 40 });
    const { container, rerender } = render(
      <>
        <button data-t="gone">g</button>
        <FocusRing target={sel("gone")} />
      </>,
    );
    frame();
    expect(ring(container)).not.toBeNull();
    rerender(<FocusRing target={sel("gone")} />);
    frame();
    expect(ring(container)).toBeNull();
  });
});

describe("바깥 어둡게(--scrim)", () => {
  it("링 하나 → 막 1개(aria-hidden), 구멍 1개, 구멍 좌표 = 링 좌표(같은 상자)", () => {
    rects.set("a", { left: 100, top: 200, width: 96, height: 40 });
    const { container } = render(
      <>
        <button data-t="a">a</button>
        <FocusRing target={sel("a")} />
      </>,
    );
    frame();
    expect(container.querySelectorAll("svg[data-tutorial-dim]")).toHaveLength(1);
    expect(dim(container)!.getAttribute("aria-hidden")).toBe("true");
    expect(container.querySelectorAll("mask#tut-dim-mask")).toHaveLength(1);
    expect(container.querySelectorAll("rect[data-tutorial-hole]")).toHaveLength(1);
    const box = ring(container)!;
    const h = hole(container)!;
    expect(Number(h.getAttribute("x"))).toBe(Number.parseFloat(box.style.left));
    expect(Number(h.getAttribute("y"))).toBe(Number.parseFloat(box.style.top));
    expect(Number(h.getAttribute("width"))).toBe(Number.parseFloat(box.style.width));
    expect(Number(h.getAttribute("height"))).toBe(Number.parseFloat(box.style.height));
    expect(container.querySelector(".tut-dim__fill")?.getAttribute("mask")).toBe("url(#tut-dim-mask)");
  });
});

describe("tutorial.css 의 링·어둡게 (P24-26)", () => {
  const CSS = readFileSync("src/styles/tutorial.css", "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
  const ruleOf = (head: string): string => {
    const start = CSS.indexOf(head);
    return start < 0 ? "" : CSS.slice(start, CSS.indexOf("}", start) + 1);
  };
  const blockOf = (head: string): string => {
    const start = CSS.indexOf(head);
    if (start < 0) return "";
    let depth = 0;
    for (let i = CSS.indexOf("{", start); i < CSS.length; i += 1) {
      if (CSS[i] === "{") depth += 1;
      else if (CSS[i] === "}") {
        depth -= 1;
        if (depth === 0) return CSS.slice(start, i + 1);
      }
    }
    return "";
  };

  it("링은 4px light-lamp 테두리·1초 주기 깜빡임, 번짐은 22px 6px color-mix 55%", () => {
    const rule = ruleOf(".tut-ring {");
    expect(rule).toMatch(/4px solid var\(--light-lamp\)/);
    expect(rule).toMatch(/box-sizing:\s*border-box/);
    expect(rule).toMatch(/1s ease-in-out infinite/);
    const kf = blockOf("@keyframes tut-ring");
    expect(kf).toMatch(/0 0 22px 6px color-mix\(in srgb, var\(--light-lamp\) 55%, transparent\)/);
    expect(kf).toMatch(/50%/);
  });

  it("어둡게 면은 --scrim 이고 애니메이션이 없다", () => {
    expect(ruleOf(".tut-dim__fill {")).toMatch(/fill:\s*var\(--scrim\)/);
    expect(ruleOf(".tut-dim {")).not.toMatch(/animation/);
    expect(ruleOf(".tut-dim__fill {")).not.toMatch(/animation/);
    expect(/backdrop-filter|blur\(/.test(CSS)).toBe(false);
  });

  it("모션 줄이기: 링은 깜빡임 없이 정지 테두리 + 중간 번짐", () => {
    const media = blockOf("@media (prefers-reduced-motion: reduce)");
    expect(media).toMatch(/\.tut-ring\s*\{[^}]*animation:\s*none/);
    expect(media).toMatch(/\.tut-ring\s*\{[^}]*box-shadow:\s*0 0 11px 3px/);
  });

  it("튜토리얼 안에서는 이름표 깜빡임·호출 빛남 맥박을 끈다(깜빡이는 것은 링 하나, 0080-6)", () => {
    expect(CSS).toMatch(/\[data-tutorial-screen\]\s+\.mv-tag\.is-blink\s*\{[^}]*animation:\s*none/);
    expect(CSS).toMatch(/\[data-tutorial-screen\]\s+\.is-call::before\s*\{[^}]*animation:\s*none/);
  });

  it("hex 색이 없다(토큰만)", () => {
    expect(CSS).not.toMatch(/#[0-9a-fA-F]{3,6}\b/);
  });
});
