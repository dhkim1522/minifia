import { readFileSync } from "node:fs";
import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import "../helpers/singleLineErrors";
import { ClueCard } from "../../src/components/v2/ClueCard";
import { ClueSpot } from "../../src/components/v2/ClueSpot";
import { TRACE_TEXT } from "../../src/game/traceText";
import { SPOT_IDS } from "../../shared/protocol";
import type { SpotId, TracePiece } from "../../shared/protocol";

// 21-10 단서 지점 표지(ClueSpot, P21-10)와 단서 카드(ClueCard, P21-12): 상태 넷·카드 여섯 모양. 두 부품 모두 역할 prop 이 없고 같은 입력에 같은 DOM 을 낸다.
// 스타일은 v2.css(토큰 변수만).
const V2_CSS = readFileSync("src/styles/v2.css", "utf8");

afterEach(() => cleanup());

const spot = (id: SpotId, state: "new" | "done" | "dim", extra: { why?: "dark" | "touched"; call?: boolean; onWalk?: () => void } = {}) =>
  render(<ClueSpot id={id} state={state} call={extra.call === true} {...(extra.why !== undefined ? { why: extra.why } : {})} onWalk={extra.onWalk ?? (() => {})} />).container.querySelector<HTMLElement>("[data-clue-spot]")!;

describe("ClueSpot — 지점 표지 상태 넷", () => {
  it("button 하나, data-clue-spot=지점 id, data-state 는 new·done·dim(어두워서 못 봄·손댄 흔적은 둘 다 dim)", () => {
    expect(spot("footprint", "new").tagName).toBe("BUTTON");
    expect(spot("cloth", "new").getAttribute("data-clue-spot")).toBe("cloth");
    cleanup();
    expect(spot("window", "done").getAttribute("data-state")).toBe("done");
    cleanup();
    expect(spot("window", "dim", { why: "dark" }).getAttribute("data-state")).toBe("dim");
    cleanup();
    expect(spot("footprint", "dim", { why: "touched" }).getAttribute("data-state")).toBe("dim");
  });

  it("접근성 이름: '{발자국|옷 조각|창문} 지점' + 상태(살핌·어두워서 못 봄·먼저 손댄 흔적)", () => {
    expect(spot("cloth", "new").getAttribute("aria-label")).toBe("옷 조각 지점");
    cleanup();
    expect(spot("footprint", "new").getAttribute("aria-label")).toBe("발자국 지점");
    cleanup();
    expect(spot("window", "dim", { why: "dark" }).getAttribute("aria-label")).toBe("창문 지점, 어두워서 못 봄");
    cleanup();
    expect(spot("footprint", "dim", { why: "touched" }).getAttribute("aria-label")).toBe("발자국 지점, 먼저 손댄 흔적");
    cleanup();
    expect(spot("cloth", "done").getAttribute("aria-label")).toBe("옷 조각 지점, 살핌");
  });

  it("지점 표지에는 장소 이름·설명 글자가 없다(아이콘만) — 이름은 접근성 속성에만 있다", () => {
    for (const id of SPOT_IDS) {
      for (const state of ["new", "done", "dim"] as const) {
        expect(spot(id, state, { why: "dark" }).textContent).toBe("");
        cleanup();
      }
    }
  });

  it("살핌(done)에는 check 배지가 있고 new·dim 에는 없다", () => {
    expect(spot("cloth", "done").querySelector(".mv-clue-spot__badge")).not.toBeNull();
    cleanup();
    expect(spot("cloth", "new").querySelector(".mv-clue-spot__badge")).toBeNull();
    cleanup();
    expect(spot("window", "dim", { why: "dark" }).querySelector(".mv-clue-spot__badge")).toBeNull();
  });

  it("dim 두 모양(어두워서 못 봄·먼저 손댄 흔적)은 접근성 이름 외 마크업이 같다 — 이유를 모양으로 가르지 않는다", () => {
    const strip = (el: HTMLElement): string => {
      const c = el.cloneNode(true) as HTMLElement;
      c.removeAttribute("aria-label");
      return c.outerHTML;
    };
    const dark = strip(spot("window", "dim", { why: "dark" }));
    cleanup();
    const touched = strip(spot("window", "dim", { why: "touched" }));
    expect(touched).toBe(dark);
  });

  it("빛남(call)은 is-call 과 data-call, 아니면 둘 다 없다", () => {
    const lit = spot("footprint", "new", { call: true });
    expect(lit.classList.contains("is-call")).toBe(true);
    expect(lit.hasAttribute("data-call")).toBe(true);
    cleanup();
    const idle = spot("footprint", "new");
    expect(idle.classList.contains("is-call")).toBe(false);
    expect(idle.hasAttribute("data-call")).toBe(false);
  });

  it("누르면 onWalk 를 한 번 부른다(그 지점으로 걷기)", () => {
    const onWalk = vi.fn();
    fireEvent.click(spot("cloth", "new", { onWalk }));
    expect(onWalk).toHaveBeenCalledTimes(1);
  });

  it("마크업에 역할 관련 속성·문자열이 없다", () => {
    for (const state of ["new", "done", "dim"] as const) {
      expect(spot("cloth", state, { why: "touched" }).outerHTML).not.toMatch(/mafia|police|doctor|citizen|data-role|data-ring-kind|범인|증거|확정/i);
      cleanup();
    }
  });
});

const card = (props: Parameters<typeof ClueCard>[0]["card"]) => render(<ClueCard card={props} />).container.querySelector<HTMLElement>("[data-clue-card]")!;

describe("ClueCard — 카드 여섯 모양", () => {
  it("발자국 n=2: 숫자 '2'만 있고 aria '발자국 2개'·data-count '2'·role=status", () => {
    const el = card({ spot: "footprint", kind: "clue", n: 2 });
    expect(el.getAttribute("data-clue-card")).toBe("footprint");
    expect(el.getAttribute("data-count")).toBe("2");
    expect(el.getAttribute("aria-label")).toBe("발자국 2개");
    expect(el.getAttribute("role")).toBe("status");
    expect(el.textContent).toBe("2");
  });

  it("옷 조각 clue: 조각 그림(TraceArt) + TRACE_TEXT 이름, data-count 없음", () => {
    const el = card({ spot: "cloth", kind: "clue", piece: "blackCloth" });
    expect(el.getAttribute("data-clue-card")).toBe("cloth");
    expect(el.hasAttribute("data-count")).toBe(false);
    expect(el.textContent).toBe(TRACE_TEXT.blackCloth);
    expect(el.querySelector(".mv-clue-card__art")).not.toBeNull();
  });

  it("창문 clue: window 아이콘 + 조각 그림 + 조각 이름", () => {
    const el = card({ spot: "window", kind: "clue", piece: "grayThread" });
    expect(el.getAttribute("data-clue-card")).toBe("window");
    expect(el.textContent).toBe(TRACE_TEXT.grayThread);
    expect(el.querySelector(".mv-clue-card__art")).not.toBeNull();
    expect(el.querySelector(".mv-clue-card__spot")).not.toBeNull();
  });

  it("손댄 흔적 '먼저 손댄 흔적'·어두워서 못 봄 '어두워서 못 봤어요'·찾은 게 없음 '아무것도 없어요' — 점선(is-dim)", () => {
    const touched = card({ spot: "cloth", kind: "touched" });
    expect(touched.textContent).toBe("먼저 손댄 흔적");
    expect(touched.classList.contains("is-dim")).toBe(true);
    cleanup();
    const dark = card({ spot: "window", kind: "dark" });
    expect(dark.textContent).toBe("어두워서 못 봤어요");
    expect(dark.classList.contains("is-dim")).toBe(true);
    cleanup();
    const none = card({ spot: "footprint", kind: "none" });
    expect(none.textContent).toBe("아무것도 없어요");
    expect(none.classList.contains("is-dim")).toBe(true);
    expect(none.hasAttribute("data-count")).toBe(false);
  });

  it("받은 단서(clue)는 is-dim 이 아니다(테두리 light-lamp)", () => {
    expect(card({ spot: "cloth", kind: "clue", piece: "pin" }).classList.contains("is-dim")).toBe(false);
  });

  it("어떤 카드에도 '범인'·'증거'·'확정' 문자열과 역할 단어가 없다(조각 아홉 + 상태 셋 전부)", () => {
    const pieces = Object.keys(TRACE_TEXT) as TracePiece[];
    const html: string[] = [];
    for (const piece of pieces) {
      html.push(render(<ClueCard card={{ spot: "cloth", kind: "clue", piece }} />).container.innerHTML);
      cleanup();
      html.push(render(<ClueCard card={{ spot: "window", kind: "clue", piece }} />).container.innerHTML);
      cleanup();
    }
    for (const kind of ["touched", "dark", "none"] as const) {
      html.push(render(<ClueCard card={{ spot: "window", kind }} />).container.innerHTML);
      cleanup();
    }
    html.push(render(<ClueCard card={{ spot: "footprint", kind: "clue", n: 3 }} />).container.innerHTML);
    for (const h of html) expect(h).not.toMatch(/범인|증거|확정|mafia|police|doctor|citizen|data-role/i);
  });

  it("같은 입력은 같은 DOM 이다(역할 prop 이 없다)", () => {
    const a = render(<ClueCard card={{ spot: "cloth", kind: "clue", piece: "pin" }} />).container.innerHTML;
    cleanup();
    const b = render(<ClueCard card={{ spot: "cloth", kind: "clue", piece: "pin" }} />).container.innerHTML;
    expect(b).toBe(a);
  });
});

describe("v2.css 규칙", () => {
  const block = (): string => {
    const at = V2_CSS.indexOf(".mv-clue-spot");
    expect(at).toBeGreaterThan(0);
    return V2_CSS.slice(at);
  };

  it("지점 표지 지름 52·카드 높이 56·테두리 1·진홍·hex·rgb 리터럴 없음", () => {
    const css = block();
    expect(css).toMatch(/\.mv-clue-spot\s*\{[^}]*width: 52px[^}]*height: 52px/);
    expect(css).toMatch(/\.mv-clue-card\s*\{[^}]*height: 56px/);
    expect(css).toMatch(/\.mv-clue-card\s*\{[^}]*border: 1px solid var\(--light-lamp\)/);
    expect(css).toMatch(/\.mv-clue-card\.is-dim\s*\{[^}]*border: 1px dashed var\(--gray-500\)/);
    expect(css).not.toMatch(/crimson/);
    expect(css).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(css).not.toMatch(/\brgba?\(/);
  });

  it("점선 상태는 gray-500·불투명도 .6, 새 지점은 light-lamp 2px 테두리", () => {
    const css = block();
    expect(css).toMatch(/\.mv-clue-spot\[data-state="dim"\]\s*\{[^}]*border: 1px dashed var\(--gray-500\)[^}]*opacity: 0\.6/);
    expect(css).toMatch(/\.mv-clue-spot\[data-state="new"\]\s*\{[^}]*border: 2px solid var\(--light-lamp\)/);
  });
});
