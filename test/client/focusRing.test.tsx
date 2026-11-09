// 17-04: FocusRing — 대상 DOM 사각형을 재서 사방 8 키운 4px 깜빡임 상자를 그린다 (TUT-03, 결정 0078-8, UI-SPEC "포커스 테두리 계약", T-17-11).
import { readFileSync } from "node:fs";
import { act, cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "../helpers/singleLineErrors";

type RingModule = typeof import("../../src/components/v2/FocusRing");
/** 정적 분석이 모듈 없음으로 파일 전체를 죽이지 않도록 경로를 변수로 둔다 */
const RING_PATH = "../../src/components/v2/FocusRing";

/** 모듈이 있어야 한다는 단언을 import 오류가 아닌 실패 메시지로 남기려고 동적으로 가져온다 */
async function loadRing(): Promise<RingModule> {
  const mod = (await import(/* @vite-ignore */ RING_PATH).catch(() => null)) as RingModule | null;
  expect(mod, "src/components/v2/FocusRing.tsx 모듈이 있어야 한다").not.toBeNull();
  return mod!;
}

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
const boxes = (c: ParentNode) => [...c.querySelectorAll<HTMLElement>("[data-tutorial-focus]")];

describe("FocusRing 상자 (사방 8)", () => {
  it("대상 {100,200,96,40} → 상자 left 92·top 192·width 112·height 56, aria-hidden, pointer-events 없음", async () => {
    const { FocusRing } = await loadRing();
    rects.set("a", { left: 100, top: 200, width: 96, height: 40 });
    const { container } = render(
      <>
        <button data-t="a">a</button>
        <FocusRing groups={[{ key: "a", selectors: ['[data-t="a"]'] }]} />
      </>,
    );
    frame();
    const [box] = boxes(container);
    expect(box).toBeDefined();
    expect(box!.style.left).toBe("92px");
    expect(box!.style.top).toBe("192px");
    expect(box!.style.width).toBe("112px");
    expect(box!.style.height).toBe("56px");
    expect(box!.getAttribute("aria-hidden")).toBe("true");
    expect(getComputedStyle(box!).pointerEvents === "none" || box!.style.pointerEvents === "none" || box!.className.includes("tut-focus")).toBe(true);
  });

  it("사각형이 0×0 이면 상자가 없다(못 쟀으면 그리지 않는다)", async () => {
    const { FocusRing } = await loadRing();
    const { container } = render(
      <>
        <button data-t="zero">z</button>
        <FocusRing groups={[{ key: "z", selectors: ['[data-t="zero"]'] }]} />
      </>,
    );
    frame();
    expect(boxes(container)).toHaveLength(0);
  });

  it("selectors 에 맞는 요소가 없어도 상자가 없다", async () => {
    const { FocusRing } = await loadRing();
    const { container } = render(<FocusRing groups={[{ key: "x", selectors: ['[data-t="nothing"]'] }]} />);
    frame();
    expect(boxes(container)).toHaveLength(0);
  });

  it("화면 오른쪽 끝에 붙은 대상은 상자가 innerWidth − 8 안으로 밀린다", async () => {
    const { FocusRing } = await loadRing();
    const w = window.innerWidth;
    rects.set("edge", { left: w - 96, top: 100, width: 96, height: 40 });
    const { container } = render(
      <>
        <button data-t="edge">e</button>
        <FocusRing groups={[{ key: "e", selectors: ['[data-t="edge"]'] }]} />
      </>,
    );
    frame();
    const [box] = boxes(container);
    expect(box).toBeDefined();
    const right = Number.parseFloat(box!.style.left) + Number.parseFloat(box!.style.width);
    expect(right).toBeLessThanOrEqual(w - 8);
    expect(Number.parseFloat(box!.style.width)).toBe(112);
  });

  it("왼쪽·위 끝에 붙은 대상은 상자가 8 안쪽으로 밀린다", async () => {
    const { FocusRing } = await loadRing();
    rects.set("corner", { left: 0, top: 0, width: 50, height: 30 });
    const { container } = render(
      <>
        <button data-t="corner">c</button>
        <FocusRing groups={[{ key: "c", selectors: ['[data-t="corner"]'] }]} />
      </>,
    );
    frame();
    const [box] = boxes(container);
    expect(Number.parseFloat(box!.style.left)).toBeGreaterThanOrEqual(8);
    expect(Number.parseFloat(box!.style.top)).toBeGreaterThanOrEqual(8);
  });

  it("selectors 둘(타일·[처리])을 한 묶음으로 주면 상자 하나가 두 사각형의 합집합이다", async () => {
    const { FocusRing } = await loadRing();
    rects.set("tile", { left: 100, top: 300, width: 64, height: 64 });
    rects.set("act", { left: 120, top: 250, width: 80, height: 44 });
    const { container } = render(
      <>
        <button data-t="tile">t</button>
        <button data-t="act">a</button>
        <FocusRing groups={[{ key: "g", selectors: ['[data-t="tile"]', '[data-t="act"]'] }]} />
      </>,
    );
    frame();
    expect(boxes(container)).toHaveLength(1);
    const [box] = boxes(container);
    // 합집합 left 100, top 250, right 200, bottom 364 → 사방 8: 92, 242, 116 × 130
    expect(box!.style.left).toBe("92px");
    expect(box!.style.top).toBe("242px");
    expect(box!.style.width).toBe("116px");
    expect(box!.style.height).toBe("130px");
  });

  it("extendDown 은 아래로만 늘린다(이름표 + 몸)", async () => {
    const { FocusRing } = await loadRing();
    rects.set("tag", { left: 100, top: 200, width: 80, height: 24 });
    const { container } = render(
      <>
        <div data-t="tag">t</div>
        <FocusRing groups={[{ key: "s", selectors: ['[data-t="tag"]'], extendDown: 90 }]} />
      </>,
    );
    frame();
    const [box] = boxes(container);
    expect(box!.style.top).toBe("192px");
    expect(box!.style.height).toBe(`${24 + 16 + 90}px`);
  });

  it("묶음마다 상자 하나", async () => {
    const { FocusRing } = await loadRing();
    rects.set("p1", { left: 40, top: 100, width: 88, height: 24 });
    rects.set("p2", { left: 200, top: 100, width: 88, height: 24 });
    const { container } = render(
      <>
        <div data-t="p1">1</div>
        <div data-t="p2">2</div>
        <FocusRing
          groups={[
            { key: "p1", selectors: ['[data-t="p1"]'], pill: true },
            { key: "p2", selectors: ['[data-t="p2"]'], pill: true },
          ]}
        />
      </>,
    );
    frame();
    expect(boxes(container)).toHaveLength(2);
  });

  it("대상이 사라지면 상자도 사라진다", async () => {
    const { FocusRing } = await loadRing();
    rects.set("gone", { left: 100, top: 200, width: 96, height: 40 });
    const groups = [{ key: "gone", selectors: ['[data-t="gone"]'] }];
    const { container, rerender } = render(
      <>
        <button data-t="gone">g</button>
        <FocusRing groups={groups} />
      </>,
    );
    frame();
    expect(boxes(container)).toHaveLength(1);
    rerender(<FocusRing groups={groups} />);
    frame();
    expect(boxes(container)).toHaveLength(0);
  });

  it("대상이 움직이면 다음 프레임에 상자가 따라간다", async () => {
    const { FocusRing } = await loadRing();
    rects.set("mv", { left: 100, top: 200, width: 96, height: 40 });
    const { container } = render(
      <>
        <button data-t="mv">m</button>
        <FocusRing groups={[{ key: "m", selectors: ['[data-t="mv"]'] }]} />
      </>,
    );
    frame();
    rects.set("mv", { left: 150, top: 220, width: 96, height: 40 });
    frame();
    const [box] = boxes(container);
    expect(box!.style.left).toBe("142px");
    expect(box!.style.top).toBe("212px");
  });
});

describe("tutorial.css 의 깜빡임 (UI-SPEC 포커스 테두리 계약)", () => {
  const CSS = (() => {
    try {
      return readFileSync("src/styles/tutorial.css", "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
    } catch {
      return "";
    }
  })();

  function block(css: string, head: string): string {
    const start = css.indexOf(head);
    if (start < 0) return "";
    let depth = 0;
    for (let i = css.indexOf("{", start); i < css.length; i += 1) {
      if (css[i] === "{") depth += 1;
      else if (css[i] === "}") {
        depth -= 1;
        if (depth === 0) return css.slice(start, i + 1);
      }
    }
    return "";
  }

  it("tutorial.css 가 있고 .tut-focus 가 테두리 4px light-lamp 이다", () => {
    expect(CSS, "src/styles/tutorial.css 가 있어야 한다").not.toBe("");
    const rule = block(CSS, ".tut-focus {");
    expect(rule).toMatch(/4px solid var\(--light-lamp\)/);
    expect(rule).toMatch(/pointer-events:\s*none/);
    expect(rule).toMatch(/box-sizing:\s*border-box/);
  });

  it("키프레임 tut-ring·tut-glow 는 opacity 만 바꾼다, 주기 1s", () => {
    for (const name of ["tut-ring", "tut-glow"]) {
      const kf = block(CSS, `@keyframes ${name}`);
      expect(kf, `${name} 키프레임이 있어야 한다`).not.toBe("");
      const props = [...kf.matchAll(/([a-z-]+)\s*:/g)].map((m) => m[1]);
      expect(props.length).toBeGreaterThan(0);
      expect([...new Set(props)]).toEqual(["opacity"]);
    }
    expect(block(CSS, ".tut-focus {")).toMatch(/1s ease-in-out infinite/);
  });

  it("prefers-reduced-motion 에서는 animation none (정지한 4px 테두리)", () => {
    const media = block(CSS, "@media (prefers-reduced-motion: reduce)");
    expect(media).not.toBe("");
    expect(media).toMatch(/\.tut-focus[^{]*\{[^}]*animation:\s*none/);
  });
});
