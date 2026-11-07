import { readFileSync } from "node:fs";
import type { ReactElement } from "react";
import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import "../helpers/singleLineErrors";
import { ErrandDock } from "../../src/components/v2/ErrandDock";
import { ErrandArrow, ErrandMarker } from "../../src/components/v2/ErrandMarker";
import type { PlaceId } from "../../shared/protocol";

afterEach(cleanup);

// 15-04: 심부름 부품(ErrandMarker·ErrandArrow·ErrandDock). 마피아·시민이 같은 마크업(D-03, ERRAND-04) — 부품은 역할·좌석 prop 이 없고
// 같은 입력에 같은 DOM 을 낸다. 표식 값에는 장소 id·진행 수뿐이다(D-08).

const V2_CSS = readFileSync("src/styles/v2.css", "utf8");
const PLACES: PlaceId[] = ["glass", "piano", "sax"];

/** v2.css 에서 첫 `.mv-errand` 이후 끝까지(새 블록은 파일 끝에 둔다) */
function errandBlock(): string {
  const at = V2_CSS.indexOf(".mv-errand");
  expect(at).toBeGreaterThan(0);
  return V2_CSS.slice(at);
}

describe("ErrandMarker", () => {
  it("button 하나, data-errand-place=id, 접근성 이름 '{낱말} 장소', 안에 장소 아이콘 한 개, 글자(텍스트 노드) 0", () => {
    const { container } = render(<ErrandMarker id="clock" done={false} call={false} onWalk={() => {}} />);
    const btns = container.querySelectorAll("button");
    expect(btns).toHaveLength(1);
    const b = btns[0] as HTMLButtonElement;
    expect(b.getAttribute("type")).toBe("button");
    expect(b.getAttribute("data-errand-place")).toBe("clock");
    expect(b.getAttribute("aria-label")).toBe("시계탑 장소");
    expect(b.classList.contains("mv-errand-pin")).toBe(true);
    expect(b.querySelectorAll("svg")).toHaveLength(1);
    expect(b.textContent).toBe("");
    expect(b.hasAttribute("data-done")).toBe(false);
    expect(b.hasAttribute("data-call")).toBe(false);
    expect(b.classList.contains("is-call")).toBe(false);
    // 아이콘은 20, 장식(aria-hidden)
    const svg = b.querySelector("svg")!;
    expect(svg.getAttribute("width")).toBe("20");
    expect(svg.getAttribute("aria-hidden")).toBe("true");
  });

  it("처리했으면 data-done(값 없음)·이름 '…, 처리함'·아이콘이 check 로 바뀐다", () => {
    const todo = render(<ErrandMarker id="glass" done={false} call={false} onWalk={() => {}} />);
    const before = todo.container.querySelector("svg")!.innerHTML;
    todo.unmount();
    const { container } = render(<ErrandMarker id="glass" done call={false} onWalk={() => {}} />);
    const b = container.querySelector("button")!;
    expect(b.getAttribute("data-done")).toBe("");
    expect(b.getAttribute("aria-label")).toBe("술잔 장소, 처리함");
    const after = b.querySelector("svg")!.innerHTML;
    expect(after).not.toBe(before);
    expect(after).toContain("M5 12.5l4.5 4.5L19 7.5"); // check 의 경로
  });

  it("눌러 onWalk 한 번", () => {
    const onWalk = vi.fn();
    const { container } = render(<ErrandMarker id="piano" done={false} call={false} onWalk={onWalk} />);
    fireEvent.click(container.querySelector("button")!);
    expect(onWalk).toHaveBeenCalledTimes(1);
  });

  it("call 이면 is-call 클래스와 data-call(값 없음), 아니면 둘 다 없다", () => {
    const on = render(<ErrandMarker id="piano" done={false} call onWalk={() => {}} />);
    const b = on.container.querySelector("button")!;
    expect(b.classList.contains("is-call")).toBe(true);
    expect(b.getAttribute("data-call")).toBe("");
  });

  it("style 을 그대로 받는다(맵 위 자리)", () => {
    const { container } = render(<ErrandMarker id="sax" done={false} call={false} onWalk={() => {}} style={{ left: 12, top: 34 }} />);
    const b = container.querySelector("button")!;
    expect(b.style.left).toBe("12px");
    expect(b.style.top).toBe("34px");
  });
});

describe("ErrandArrow", () => {
  it("data-errand-arrow, aria-hidden, 버튼이 아니다(tabIndex·role 없음), 안에 arrow 아이콘", () => {
    const { container } = render(<ErrandArrow angle={90} call={false} />);
    const a = container.querySelector("[data-errand-arrow]") as HTMLElement;
    expect(a).not.toBeNull();
    expect(a.getAttribute("aria-hidden")).toBe("true");
    expect(a.tagName).toBe("SPAN");
    expect(a.hasAttribute("tabindex")).toBe(false);
    expect(a.hasAttribute("role")).toBe(false);
    expect(container.querySelectorAll("button")).toHaveLength(0);
    expect(a.querySelectorAll("svg")).toHaveLength(1);
    expect(a.querySelector("svg")!.innerHTML).toContain("M12 20V5"); // arrow 의 경로
    expect(a.hasAttribute("data-call")).toBe(false);
  });

  it("angle 이 회전 transform 으로 들어간다", () => {
    const { container } = render(<ErrandArrow angle={-37.5} call={false} />);
    const rot = container.querySelector("[data-errand-arrow] [style*='rotate']") as HTMLElement;
    expect(rot.style.transform).toBe("rotate(-37.5deg)");
  });

  it("call 이면 is-call + data-call", () => {
    const { container } = render(<ErrandArrow angle={0} call />);
    const a = container.querySelector("[data-errand-arrow]")!;
    expect(a.classList.contains("is-call")).toBe(true);
    expect(a.getAttribute("data-call")).toBe("");
  });
});

describe("ErrandDock", () => {
  it("3곳·done 1 → 칩 3(1·2·3, 첫째만 data-done), data-errand-progress='1/3', 스크린리더용 '진행 1/3'(aria-live polite), [처리] 글자 '처리'", () => {
    const { container } = render(<ErrandDock places={PLACES} done={["piano"]} canAct={false} call={false} onAct={() => {}} />);
    expect(container.querySelector("[data-errand-dock]")).not.toBeNull();
    const chips = [...container.querySelectorAll("[data-errand-chip]")];
    expect(chips.map((c) => c.getAttribute("data-errand-chip"))).toEqual(["1", "2", "3"]);
    expect(chips.map((c) => c.hasAttribute("data-done"))).toEqual([true, false, false]);
    expect(chips[0]!.querySelector("svg")).not.toBeNull(); // 채운 칩에 check
    expect(chips[1]!.querySelector("svg")).toBeNull();
    const progress = container.querySelector("[data-errand-progress]")!;
    expect(progress.getAttribute("data-errand-progress")).toBe("1/3");
    expect(progress.getAttribute("aria-hidden")).toBe("true");
    expect(progress.textContent).toBe("1/3");
    const live = container.querySelector("[aria-live='polite']")!;
    expect(live.textContent).toBe("진행 1/3");
    expect(container.querySelector("[role='group']")!.getAttribute("aria-label")).toBe("진행 1/3");
    const act = container.querySelector("button[data-errand-act]")!;
    expect(act.textContent).toBe("처리");
  });

  it("canAct false → aria-disabled='true' 이고 눌러도 onAct 0", () => {
    const onAct = vi.fn();
    const { container } = render(<ErrandDock places={PLACES} done={[]} canAct={false} call={false} onAct={onAct} />);
    const act = container.querySelector("button[data-errand-act]")!;
    expect(act.getAttribute("aria-disabled")).toBe("true");
    fireEvent.click(act);
    expect(onAct).not.toHaveBeenCalled();
  });

  it("canAct true → aria-disabled 없음, 누르면 onAct 한 번", () => {
    const onAct = vi.fn();
    const { container } = render(<ErrandDock places={PLACES} done={[]} canAct call={false} onAct={onAct} />);
    const act = container.querySelector("button[data-errand-act]")!;
    expect(act.hasAttribute("aria-disabled")).toBe(false);
    fireEvent.click(act);
    expect(onAct).toHaveBeenCalledTimes(1);
  });

  it("call true → 단추에 is-call·data-call, 아니면 둘 다 없다", () => {
    const on = render(<ErrandDock places={PLACES} done={[]} canAct call onAct={() => {}} />);
    const act = on.container.querySelector("button[data-errand-act]")!;
    expect(act.classList.contains("is-call")).toBe(true);
    expect(act.getAttribute("data-call")).toBe("");
    on.unmount();
    const off = render(<ErrandDock places={PLACES} done={[]} canAct onAct={() => {}} call={false} />);
    const act2 = off.container.querySelector("button[data-errand-act]")!;
    expect(act2.classList.contains("is-call")).toBe(false);
    expect(act2.hasAttribute("data-call")).toBe(false);
  });

  it("done 3 → 글자 '완료'·check 아이콘·aria-disabled·data-done, 눌러도 onAct 0, 칩 셋 모두 data-done", () => {
    const onAct = vi.fn();
    const { container } = render(<ErrandDock places={PLACES} done={[...PLACES]} canAct call onAct={onAct} />);
    const act = container.querySelector("button[data-errand-act]")!;
    expect(act.textContent).toBe("완료");
    expect(act.querySelector("svg")!.innerHTML).toContain("M5 12.5l4.5 4.5L19 7.5");
    expect(act.getAttribute("aria-disabled")).toBe("true");
    expect(act.hasAttribute("data-done")).toBe(true);
    expect(act.classList.contains("is-call")).toBe(false); // 3곳 완료 → 빛 없음
    fireEvent.click(act);
    expect(onAct).not.toHaveBeenCalled();
    expect([...container.querySelectorAll("[data-errand-chip]")].every((c) => c.hasAttribute("data-done"))).toBe(true);
    expect(container.querySelector("[data-errand-progress]")!.getAttribute("data-errand-progress")).toBe("3/3");
    expect(container.querySelector("[aria-live='polite']")!.textContent).toBe("진행 3/3");
  });

  it("places 빈 배열 → null(아무것도 안 그림)", () => {
    const { container } = render(<ErrandDock places={[]} done={[]} canAct={false} call={false} onAct={() => {}} />);
    expect(container.innerHTML).toBe("");
  });
});

describe("같은 마크업 (D-03, ERRAND-04, T-15-16)", () => {
  const html = (node: ReactElement): string => {
    const r = render(node);
    const out = r.container.innerHTML;
    r.unmount();
    return out;
  };
  const attrNames = (root: Element): string[] => [root, ...root.querySelectorAll("*")].flatMap((e) => e.getAttributeNames().filter((n) => n.startsWith("data-")));

  it("같은 props 로 두 번 렌더한 HTML 이 같다(세 부품)", () => {
    const dock = <ErrandDock places={PLACES} done={["glass", "sax"]} canAct call onAct={() => {}} />;
    expect(html(dock)).toBe(html(dock));
    const pin = <ErrandMarker id="door" done call onWalk={() => {}} />;
    expect(html(pin)).toBe(html(pin));
    const arrow = <ErrandArrow angle={45} call />;
    expect(html(arrow)).toBe(html(arrow));
  });

  it("부품은 역할·좌석·가짜 표식 prop 을 받지 않는다: 알려진 prop 말고 넘기면 타입 오류(@ts-expect-error)이고 DOM 에도 나오지 않는다", () => {
    // @ts-expect-error 부품에는 role·seat·fake prop 이 없다
    const dock = <ErrandDock places={PLACES} done={[]} canAct={false} call={false} onAct={() => {}} role="mafia" seat={3} fake />;
    const { container } = render(dock);
    const text = container.innerHTML;
    expect(text).not.toContain("mafia");
    expect(text).not.toMatch(/data-(fake|role|seat)/);
  });

  it("data-* 속성 이름 집합은 입력 상태(done 수·canAct·call)에만 따르고 값에 좌석·역할 문자열이 없다(장소 id·진행 수뿐)", () => {
    const names = new Set<string>();
    const values: string[] = [];
    for (const done of [[], ["glass"], ["glass", "piano"], [...PLACES]] as PlaceId[][]) {
      for (const canAct of [false, true]) {
        for (const call of [false, true]) {
          const { container, unmount } = render(
            <div>
              <ErrandDock places={PLACES} done={done} canAct={canAct} call={call} onAct={() => {}} />
              <ErrandMarker id="glass" done={done.length > 0} call={call} onWalk={() => {}} />
              <ErrandArrow angle={10} call={call} />
            </div>,
          );
          for (const e of [container, ...container.querySelectorAll("*")]) {
            for (const n of e.getAttributeNames()) {
              if (!n.startsWith("data-")) continue;
              names.add(n);
              values.push(e.getAttribute(n) ?? "");
            }
          }
          unmount();
        }
      }
    }
    expect([...names].sort()).toEqual(["data-call", "data-done", "data-errand-act", "data-errand-arrow", "data-errand-chip", "data-errand-dock", "data-errand-place", "data-errand-progress"]);
    for (const v of values) expect(v).toMatch(/^(|\d(\/\d)?|glass)$/);
    const sample = render(<ErrandDock places={PLACES} done={["glass"]} canAct call onAct={() => {}} />);
    expect(attrNames(sample.container).length).toBeGreaterThan(0);
  });
});

describe("접근성·스타일 (UI-SPEC)", () => {
  it("장소 표지·[처리]는 button 이고 칩·화살표는 button·tabindex 가 없다(포커스를 받지 않는다)", () => {
    const { container } = render(
      <div>
        <ErrandDock places={PLACES} done={[]} canAct onAct={() => {}} call={false} />
        <ErrandArrow angle={0} call={false} />
      </div>,
    );
    expect(container.querySelectorAll("button")).toHaveLength(1);
    for (const e of container.querySelectorAll("[data-errand-chip], [data-errand-arrow], [data-errand-progress]")) {
      expect(e.tagName).not.toBe("BUTTON");
      expect(e.hasAttribute("tabindex")).toBe(false);
    }
  });

  it("v2.css 새 블록: hex 색 없음·토큰 변수만, 포커스 링 gray-100 2px, 크기 36·44·104×48·높이 84", () => {
    const css = errandBlock();
    expect(css.match(/#[0-9a-fA-F]{3,8}\b/g)).toBeNull();
    expect(css).toMatch(/\.mv-errand-pin:focus-visible/);
    expect(css).toMatch(/\.mv-errand-dock__act:focus-visible/);
    expect(css).toMatch(/outline: 2px solid var\(--gray-100\)/);
    expect(css).toMatch(/\.mv-errand-pin\s*\{[^}]*width: var\(--tap-min\)/);
    expect(css).toMatch(/\.mv-errand-pin__disc\s*\{[^}]*width: 36px/);
    expect(css).toMatch(/\.mv-errand-arrow\s*\{[^}]*width: 36px[^}]*pointer-events: none/);
    expect(css).toMatch(/\.mv-errand-dock\s*\{[^}]*84px/);
    expect(css).toMatch(/\.mv-errand-dock__act\s*\{[^}]*width: 104px[^}]*height: 48px/);
    expect(css).toMatch(/\.mv-errand-dock__act\[aria-disabled="true"\]\s*\{[^}]*opacity: 0\.45/);
  });

  it("새 블록의 모든 글자 크기는 14px 이상이다", () => {
    const sizes = [...errandBlock().matchAll(/font-size: (\d+)px/g)].map((m) => Number(m[1]));
    expect(sizes.length).toBeGreaterThan(0);
    for (const s of sizes) expect(s).toBeGreaterThanOrEqual(14);
  });

  it("애니메이션은 transform·opacity·filter 뿐이고 prefers-reduced-motion 에서 채움·등장 연출이 즉시다", () => {
    const css = errandBlock().replace(/\/\*[\s\S]*?\*\//g, "");
    // 키프레임 안에 쓰인 속성
    for (const m of css.matchAll(/@keyframes mv-errand[\w-]*\s*\{((?:[^{}]*\{[^{}]*\})+)\s*\}/g)) {
      const props = [...(m[1] ?? "").matchAll(/([a-z-]+)\s*:/g)].map((x) => x[1]);
      for (const p of props) expect(["transform", "opacity", "filter"], p).toContain(p);
    }
    // transition 은 transform·opacity·filter 만
    for (const m of css.matchAll(/transition:\s*([^;}]+)/g)) {
      for (const part of (m[1] ?? "").split(",")) expect(part.trim().split(/\s+/)[0], part).toMatch(/^(transform|opacity|filter)$/);
    }
    const reduce = [...css.matchAll(/@media \(prefers-reduced-motion: reduce\)\s*\{([^]*?)\n\}/g)].map((m) => m[1]).join("\n");
    expect(reduce).toMatch(/mv-errand/);
    expect(reduce).toMatch(/animation: none/);
  });

  it("색 약속: 새 블록은 진홍(crimson)·놋쇠(brass) 를 쓰지 않는다(빛남 색은 .is-call 이 낸다)", () => {
    const css = errandBlock();
    expect(css).not.toMatch(/crimson|brass|light-lamp/);
  });
});
