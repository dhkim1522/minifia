import { readFileSync } from "node:fs";
import type { ReactElement } from "react";
import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import "../helpers/singleLineErrors";
import { ErrandAct } from "../../src/components/v2/ErrandAct";
import { ErrandDots } from "../../src/components/v2/ErrandDots";
import { ErrandStartCard } from "../../src/components/v2/ErrandStartCard";
import { ErrandArrow, ErrandMarker } from "../../src/components/v2/ErrandMarker";
import { PLACE_IDS } from "../../shared/protocol";
import type { PlaceId } from "../../shared/protocol";

afterEach(cleanup);

// 15-04·16-07·16-08: 심부름 부품(ErrandMarker 64 타일·ErrandArrow 40 글리프·ErrandAct 알약·ErrandStartCard 시작 카드·ErrandDots 진행 점). 마피아·시민이 같은 마크업(D-03, ERRAND-04) — 부품은 역할·좌석 prop 이 없고
// 같은 입력에 같은 DOM 을 낸다. 표식 값에는 장소 id·진행 수뿐이다(D-08).

const V2_CSS = readFileSync("src/styles/v2.css", "utf8");
const PLACES: PlaceId[] = ["glass", "piano", "sax"];

/** v2.css 에서 첫 `.mv-errand` 이후 끝까지(새 블록은 파일 끝에 둔다) */
function errandBlock(): string {
  const at = V2_CSS.indexOf(".mv-errand");
  expect(at).toBeGreaterThan(0);
  return V2_CSS.slice(at);
}

describe("ErrandMarker (64 타일)", () => {
  it("button 하나, data-errand-place=id, 접근성 이름 '{낱말} 장소', 안에 컬러 에셋 44 한 개(장식), 글자(텍스트 노드) 0", () => {
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
    expect(b.hasAttribute("data-rest")).toBe(false);
    expect(b.classList.contains("is-call")).toBe(false);
    const svg = b.querySelector("svg")!;
    expect(svg.getAttribute("width")).toBe("44");
    expect(svg.getAttribute("aria-hidden")).toBe("true");
    expect(svg.hasAttribute("role")).toBe(false);
    // 컬러 에셋(16-02) — 옛 선 아이콘(currentColor)이 아니다
    expect(svg.innerHTML).not.toContain("currentColor");
  });

  it("그림은 PlaceArt 와 같다(16개 전부 서로 다르다)", () => {
    const seen = new Set<string>();
    for (const id of PLACE_IDS) {
      const { container, unmount } = render(<ErrandMarker id={id} done={false} call={false} onWalk={() => {}} />);
      seen.add(container.querySelector("svg")!.innerHTML);
      unmount();
    }
    expect(seen.size).toBe(16);
  });

  it("처리했으면 data-done(값 없음)·이름 '…, 처리함'·체크 배지(24)가 더해지고 그림은 그대로다", () => {
    const todo = render(<ErrandMarker id="glass" done={false} call={false} onWalk={() => {}} />);
    const before = todo.container.querySelector("svg")!.innerHTML;
    expect(todo.container.querySelector(".mv-errand-pin__badge")).toBeNull();
    todo.unmount();
    const { container } = render(<ErrandMarker id="glass" done call={false} onWalk={() => {}} />);
    const b = container.querySelector("button")!;
    expect(b.getAttribute("data-done")).toBe("");
    expect(b.getAttribute("aria-label")).toBe("술잔 장소, 처리함");
    const badge = b.querySelector(".mv-errand-pin__badge")!;
    expect(badge).not.toBeNull();
    expect(badge.querySelector("svg")!.innerHTML).toContain("M5 12.5l4.5 4.5L19 7.5"); // check 의 경로
    expect(badge.querySelector("svg")!.getAttribute("aria-hidden")).toBe("true");
    expect(b.querySelectorAll("svg")).toHaveLength(2);
    expect(b.querySelector("svg")!.innerHTML).toBe(before);
  });

  it("눌러 onWalk 한 번", () => {
    const onWalk = vi.fn();
    const { container } = render(<ErrandMarker id="piano" done={false} call={false} onWalk={onWalk} />);
    fireEvent.click(container.querySelector("button")!);
    expect(onWalk).toHaveBeenCalledTimes(1);
  });

  it("call 이면 is-call 클래스와 data-call(값 없음), rest 이면 data-rest(값 없음), 아니면 없다", () => {
    const on = render(<ErrandMarker id="piano" done={false} call onWalk={() => {}} />);
    const b = on.container.querySelector("button")!;
    expect(b.classList.contains("is-call")).toBe(true);
    expect(b.getAttribute("data-call")).toBe("");
    on.unmount();
    const rest = render(<ErrandMarker id="piano" done={false} call={false} rest onWalk={() => {}} />);
    const r = rest.container.querySelector("button")!;
    expect(r.getAttribute("data-rest")).toBe("");
    expect(r.classList.contains("is-call")).toBe(false);
  });

  it("style 을 그대로 받는다(맵 위 자리)", () => {
    const { container } = render(<ErrandMarker id="sax" done={false} call={false} onWalk={() => {}} style={{ left: 12, top: 34 }} />);
    const b = container.querySelector("button")!;
    expect(b.style.left).toBe("12px");
    expect(b.style.top).toBe("34px");
  });
});

describe("ErrandArrow (40 글리프)", () => {
  it("data-errand-arrow, aria-hidden, 버튼이 아니다(tabIndex·role 없음), 안에 시안 글리프 한 개(40)", () => {
    const { container } = render(<ErrandArrow angle={90} call={false} />);
    const a = container.querySelector("[data-errand-arrow]") as HTMLElement;
    expect(a).not.toBeNull();
    expect(a.getAttribute("aria-hidden")).toBe("true");
    expect(a.tagName).toBe("SPAN");
    expect(a.hasAttribute("tabindex")).toBe(false);
    expect(a.hasAttribute("role")).toBe(false);
    expect(container.querySelectorAll("button")).toHaveLength(0);
    expect(a.querySelectorAll("svg")).toHaveLength(1);
    const svg = a.querySelector("svg")!;
    expect(svg.getAttribute("width")).toBe("40");
    expect(svg.getAttribute("height")).toBe("40");
    expect(svg.innerHTML).toContain("M12 2l7 10h-4v10H9V12H5z"); // Errand-Map 시안 글리프
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

describe("ErrandAct ([처리] 알약)", () => {
  it("data-errand-act 버튼 하나, aria-label '{장소}에서 처리', 글 '처리' + 손 아이콘 svg 16", () => {
    const { container } = render(<ErrandAct id="fountain" call={false} onPress={() => {}} />);
    const btns = container.querySelectorAll("button");
    expect(btns).toHaveLength(1);
    const b = btns[0] as HTMLButtonElement;
    expect(b.getAttribute("type")).toBe("button");
    expect(b.hasAttribute("data-errand-act")).toBe(true);
    expect(b.getAttribute("data-errand-act")).toBe("");
    expect(b.getAttribute("aria-label")).toBe("분수에서 처리");
    expect(b.classList.contains("mv-errand-act")).toBe(true);
    expect(b.textContent).toBe("처리");
    const svg = b.querySelector("svg")!;
    expect(svg.getAttribute("width")).toBe("16");
    expect(svg.getAttribute("aria-hidden")).toBe("true");
    expect(svg.innerHTML).toContain("M9 11V5a1.5 1.5 0 0 1 3 0v5V4"); // 손 경로
    expect(b.hasAttribute("data-call")).toBe(false);
  });

  it("누르면 onPress 한 번", () => {
    const onPress = vi.fn();
    const { container } = render(<ErrandAct id="glass" call={false} onPress={onPress} />);
    fireEvent.click(container.querySelector("button")!);
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it("call 이면 is-call·data-call(값 없음), style 을 받는다", () => {
    const { container } = render(<ErrandAct id="glass" call onPress={() => {}} style={{ left: 3 }} />);
    const b = container.querySelector("button")!;
    expect(b.classList.contains("is-call")).toBe(true);
    expect(b.getAttribute("data-call")).toBe("");
    expect(b.style.left).toBe("3px");
  });
});

describe("ErrandStartCard (2초 '오늘 갈 곳' 카드, 16-08 V-19)", () => {
  it("루트 하나, 타일 3(role=img·aria-label '{장소} 장소', 각 svg 하나), 제목·한 줄, button 0, 장소 이름 글자 없음", () => {
    const { container } = render(<ErrandStartCard places={PLACES} />);
    expect(container.querySelectorAll("[data-errand-start-card]")).toHaveLength(1);
    const tiles = [...container.querySelectorAll("[role='img']")];
    expect(tiles.map((t) => t.getAttribute("aria-label"))).toEqual(["술잔 장소", "피아노 장소", "색소폰 장소"]);
    for (const t of tiles) {
      expect(t.querySelectorAll("svg")).toHaveLength(1);
      expect(t.textContent).toBe("");
      expect(t.querySelector("svg")!.getAttribute("width")).toBe("60");
    }
    expect(container.textContent).toContain("오늘 갈 곳");
    expect(container.textContent).toContain("가는 길에 본 사람이 기록돼요");
    expect(container.querySelectorAll("button")).toHaveLength(0);
    for (const n of ["술잔", "피아노", "색소폰"]) expect(container.textContent).not.toContain(n);
  });
  it("places 가 0개면 아무것도 그리지 않는다", () => {
    const { container } = render(<ErrandStartCard places={[]} />);
    expect(container.innerHTML).toBe("");
  });
  it("같은 입력에 같은 DOM(마피아·시민 구분 없음), 속성은 data-errand-start-card 하나뿐", () => {
    const a = render(<ErrandStartCard places={PLACES} />);
    const h1 = a.container.innerHTML;
    a.unmount();
    const b = render(<ErrandStartCard places={PLACES} />);
    expect(b.container.innerHTML).toBe(h1);
    const names = new Set([b.container, ...b.container.querySelectorAll("*")].flatMap((e) => e.getAttributeNames().filter((n) => n.startsWith("data-"))));
    expect([...names]).toEqual(["data-errand-start-card"]);
  });
});

describe("ErrandDots (진행 점 3, 16-08 V-23)", () => {
  it("3곳·done 1 → 점 3(1·2·3, 첫째만 data-done), data-errand-progress='1/3', role=group·aria-label '진행 1/3'·aria-live polite, 보이는 글자·단추·tabindex 없음", () => {
    const { container } = render(<ErrandDots total={3} done={1} />);
    const root = container.querySelector("[data-errand-dots]")!;
    expect(root.getAttribute("data-errand-progress")).toBe("1/3");
    expect(root.getAttribute("role")).toBe("group");
    expect(root.getAttribute("aria-label")).toBe("진행 1/3");
    expect(root.getAttribute("aria-live")).toBe("polite");
    const dots = [...container.querySelectorAll("[data-errand-dot]")];
    expect(dots.map((d) => d.getAttribute("data-errand-dot"))).toEqual(["1", "2", "3"]);
    expect(dots.map((d) => d.hasAttribute("data-done"))).toEqual([true, false, false]);
    expect(container.textContent).toBe("");
    expect(container.querySelectorAll("button")).toHaveLength(0);
    expect(container.querySelectorAll("[tabindex]")).toHaveLength(0);
  });
  it("done 3 → 모두 채움 3/3, done 이 total 을 넘어도 total 로 자른다", () => {
    const { container } = render(<ErrandDots total={3} done={5} />);
    expect([...container.querySelectorAll("[data-errand-dot]")].every((d) => d.hasAttribute("data-done"))).toBe(true);
    expect(container.querySelector("[data-errand-dots]")!.getAttribute("data-errand-progress")).toBe("3/3");
  });
  it("done 0 → 채움 0, total 0 이면 null", () => {
    const a = render(<ErrandDots total={3} done={0} />);
    expect(a.container.querySelectorAll("[data-errand-dot][data-done]")).toHaveLength(0);
    a.unmount();
    const b = render(<ErrandDots total={0} done={0} />);
    expect(b.container.innerHTML).toBe("");
  });
});

describe("시작 카드·진행 점 스타일 (16-08)", () => {
  it("시작 카드·막·진행 점 줄은 눌림을 통과하고, hex 없이 토큰만 쓴다", () => {
    const css = errandBlock();
    expect(css).toMatch(/\.mv-errand-start\s*\{[^}]*pointer-events: none/);
    expect(css).toMatch(/\.mv-errand-dots\s*\{[^}]*pointer-events: none/);
    expect(css).toMatch(/\.mv-errand-start__card\s*\{[^}]*border-radius: 20px[^}]*background: var\(--night-800\)/);
    expect(css).toMatch(/\.mv-errand-start__scrim\s*\{[^}]*background: var\(--scrim\)/);
    expect(css).toMatch(/\.mv-errand-start__tile\s*\{[^}]*width: 84px[^}]*height: 84px[^}]*border-radius: 20px[^}]*background: var\(--night-700\)/);
    expect(css).toMatch(/\.mv-errand-dot\s*\{[^}]*width: 20px[^}]*height: 20px[^}]*border: 3px solid var\(--brass-400\)/);
    expect(css).toMatch(/\.mv-errand-dot\[data-done\]\s*\{[^}]*background: var\(--brass-400\)/);
    expect(css).toMatch(/\.mv-errand-dots\s*\{[^}]*gap: 12px/);
  });
  it("모션 줄이기에서 시작 카드 등장이 즉시다", () => {
    const css = errandBlock();
    const reduce = [...css.matchAll(/@media \(prefers-reduced-motion: reduce\)\s*\{([^]*?)\n\}/g)].map((m) => m[1]).join("\n");
    expect(reduce).toMatch(/mv-errand-start/);
  });
});

describe("같은 마크업 (D-03, ERRAND-04, T-15-16, T-16-15)", () => {
  const html = (node: ReactElement): string => {
    const r = render(node);
    const out = r.container.innerHTML;
    r.unmount();
    return out;
  };
  const attrNames = (root: Element): string[] => [root, ...root.querySelectorAll("*")].flatMap((e) => e.getAttributeNames().filter((n) => n.startsWith("data-")));

  it("같은 props 로 두 번 렌더한 HTML 이 같다(여섯 부품)", () => {
    const dots = <ErrandDots total={3} done={2} />;
    expect(html(dots)).toBe(html(dots));
    const card = <ErrandStartCard places={PLACES} />;
    expect(html(card)).toBe(html(card));
    const pin = <ErrandMarker id="door" done call onWalk={() => {}} />;
    expect(html(pin)).toBe(html(pin));
    const arrow = <ErrandArrow angle={45} call />;
    expect(html(arrow)).toBe(html(arrow));
    const act = <ErrandAct id="door" call onPress={() => {}} />;
    expect(html(act)).toBe(html(act));
  });

  it("부품은 역할·좌석·가짜 표식 prop 을 받지 않는다: 알려진 prop 말고 넘기면 타입 오류(@ts-expect-error)이고 DOM 에도 나오지 않는다", () => {
    // @ts-expect-error 부품에는 role·seat·fake prop 이 없다
    const dots = <ErrandDots total={3} done={0} role="mafia" seat={3} fake />;
    // @ts-expect-error 부품에는 role·seat·fake prop 이 없다
    const startCard = <ErrandStartCard places={PLACES} role="mafia" fake />;
    // @ts-expect-error 부품에는 role·seat·fake prop 이 없다
    const pin = <ErrandMarker id="glass" done={false} call={false} onWalk={() => {}} role="mafia" fake />;
    // @ts-expect-error 부품에는 role·seat·fake prop 이 없다
    const act = <ErrandAct id="glass" call={false} onPress={() => {}} role="mafia" fake />;
    const { container } = render(
      <div>
        {dots}
        {startCard}
        {pin}
        {act}
      </div>,
    );
    const text = container.innerHTML;
    expect(text).not.toContain("mafia");
    expect(text).not.toMatch(/data-(fake|role|seat)/);
  });

  it("data-* 속성 이름 집합은 입력 상태(done 수·call·rest)에만 따르고 값에 좌석·역할 문자열이 없다(장소 id·진행 수뿐)", () => {
    const names = new Set<string>();
    const values: string[] = [];
    for (const done of [[], ["glass"], ["glass", "piano"], [...PLACES]] as PlaceId[][]) {
      for (const call of [false, true]) {
        for (const rest of [false, true]) {
          const { container, unmount } = render(
            <div>
              <ErrandDots total={3} done={done.length} />
              <ErrandStartCard places={PLACES} />
              <ErrandMarker id="glass" done={done.length > 0} call={call} rest={rest} onWalk={() => {}} />
              <ErrandArrow angle={10} call={call} />
              <ErrandAct id="glass" call={call} onPress={() => {}} />
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
    expect([...names].sort()).toEqual(["data-call", "data-done", "data-errand-act", "data-errand-arrow", "data-errand-dot", "data-errand-dots", "data-errand-place", "data-errand-progress", "data-errand-start-card", "data-rest"]);
    for (const v of values) expect(v).toMatch(/^(|\d(\/\d)?|glass)$/);
    const sample = render(<ErrandDots total={3} done={1} />);
    expect(attrNames(sample.container).length).toBeGreaterThan(0);
  });
});

describe("접근성·스타일 (UI-SPEC)", () => {
  it("장소 타일·[처리] 알약은 button 이고 점·시작 카드·화살표는 button·tabindex 가 없다(포커스를 받지 않는다)", () => {
    const { container } = render(
      <div>
        <ErrandDots total={3} done={0} />
        <ErrandStartCard places={PLACES} />
        <ErrandArrow angle={0} call={false} />
        <ErrandMarker id="glass" done={false} call={false} onWalk={() => {}} />
        <ErrandAct id="glass" call={false} onPress={() => {}} />
      </div>,
    );
    expect(container.querySelectorAll("button")).toHaveLength(2);
    for (const e of container.querySelectorAll("[data-errand-dots], [data-errand-dot], [data-errand-start-card], [data-errand-arrow]")) {
      expect(e.tagName).not.toBe("BUTTON");
      expect(e.hasAttribute("tabindex")).toBe(false);
    }
  });

  it("v2.css 새 블록: hex 색 없음·토큰 변수만, 타일 64·누르기 64·모서리 16·면 night-800, 알약 높이 44·면 brass-400·글 night-950, 포커스 링 gray-100 2px", () => {
    const css = errandBlock();
    expect(css.match(/#[0-9a-fA-F]{3,8}\b/g)).toBeNull();
    expect(css).toMatch(/\.mv-errand-pin:focus-visible/);
    expect(css).toMatch(/\.mv-errand-act:focus-visible/);
    expect(css).toMatch(/outline: 2px solid var\(--gray-100\)/);
    expect(css).toMatch(/\.mv-errand-pin\s*\{[^}]*width: 64px[^}]*height: 64px[^}]*border-radius: 16px[^}]*background: var\(--night-800\)/);
    expect(css).toMatch(/\.mv-errand-pin\[data-done\]\s*\{[^}]*opacity: 0\.55/);
    expect(css).toMatch(/\.mv-errand-pin__badge\s*\{[^}]*width: 24px[^}]*background: var\(--brass-400\)[^}]*color: var\(--night-950\)/);
    expect(css).toMatch(/\.mv-errand-arrow\s*\{[^}]*pointer-events: none/);
    expect(css).toMatch(/\.mv-errand-arrow svg\s*\{[^}]*fill: var\(--light-lamp\)[^}]*stroke: var\(--night-950\)/);
    expect(css).toMatch(/\.mv-errand-act\s*\{[^}]*height: 44px[^}]*background: var\(--brass-400\)[^}]*color: var\(--night-950\)/);
    expect(css).toMatch(/\.mv-errand-pin\[data-rest\]\s*\{[^}]*var\(--brass-200\)/);
    expect(css).toMatch(/\.mv-errand-pin\.is-call::after\s*\{[^}]*border-width: 3px/);
    // 옛 36 원 표지·가장자리 칩·아래 패널(독) 규칙은 없다
    expect(css).not.toMatch(/mv-errand-pin__disc|mv-errand-dock|mv-errand-chip/);
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
    // 알약 등장은 dur-pop
    expect(css).toMatch(/\.mv-errand-act\s*\{[^}]*animation: mv-errand-pop var\(--dur-pop\)/);
  });

  it("색 약속(16-07 V-20~22): 놋쇠(brass)·램프 빛(light-lamp)은 타일 테두리·알약·화살표에만 쓰고 진홍(crimson)은 쓰지 않는다", () => {
    const css = errandBlock();
    expect(css).not.toMatch(/crimson/);
    for (const m of css.matchAll(/(^|\n)([^\n{]+)\{([^}]*(?:brass|light-lamp)[^}]*)\}/g)) {
      expect(m[2], m[2]).toMatch(/mv-errand-(pin|act|arrow|start|dot)/);
    }
  });
});
