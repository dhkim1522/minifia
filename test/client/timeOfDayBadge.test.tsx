import { cleanup, render } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it } from "vitest";
import "../helpers/singleLineErrors";
import { TimeOfDayBadge } from "../../src/components/v2/TimeOfDayBadge";
import { TOD_ORDER, todSrc } from "../../src/game/timeOfDay";

afterEach(cleanup);

// 18.1-03(UI-SPEC D 계약 4·5): 배지는 겹친 4장·누를 수 없음·글자 없음·크로스페이드 하나뿐이다.
const CSS = readFileSync("src/styles/timeOfDay.css", "utf8");

function rulesFor(css: string, selector: string): string {
  const bare = css.replace(/\/\*[\s\S]*?\*\//g, "");
  return [...bare.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
    .filter((m) => (m[1] ?? "").split(",").some((x) => x.trim() === selector))
    .map((m) => m[2] ?? "")
    .join(";");
}

describe("TimeOfDayBadge 부품", () => {
  it("verdict: role=img·저녁·dusk, 포커스 없음·글자 없음, img 4장이 TOD_ORDER 순서·is-on 은 dusk 하나", () => {
    const { container } = render(<TimeOfDayBadge phase="verdict" />);
    const b = container.querySelector("[data-tod]") as HTMLElement;
    expect(b.getAttribute("role")).toBe("img");
    expect(b.getAttribute("aria-label")).toBe("저녁");
    expect(b.getAttribute("data-tod")).toBe("dusk");
    expect(b.hasAttribute("tabindex")).toBe(false);
    expect(b.textContent).toBe("");
    const imgs = [...b.querySelectorAll("img")];
    expect(imgs.map((i) => i.getAttribute("src"))).toEqual(TOD_ORDER.map((x) => todSrc(x)));
    for (const i of imgs) {
      expect(i.getAttribute("alt")).toBe("");
      expect(i.getAttribute("aria-hidden")).toBe("true");
    }
    expect(imgs.filter((i) => i.classList.contains("is-on")).length).toBe(1);
    expect(imgs[TOD_ORDER.indexOf("dusk")]?.classList.contains("is-on")).toBe(true);
  });

  it("night 로 바꿔 다시 그리면 is-on 만 옮겨 가고 img 요소는 같은 네 개다(새로 만들지 않음)", () => {
    const { container, rerender } = render(<TimeOfDayBadge phase="verdict" />);
    const before = [...container.querySelectorAll("img")];
    rerender(<TimeOfDayBadge phase="night" />);
    const after = [...container.querySelectorAll("img")];
    expect(after.length).toBe(4);
    after.forEach((el, i) => expect(el).toBe(before[i]));
    expect(after.filter((i) => i.classList.contains("is-on")).length).toBe(1);
    expect(after[TOD_ORDER.indexOf("night")]?.classList.contains("is-on")).toBe(true);
    expect(container.querySelector("[data-tod]")?.getAttribute("aria-label")).toBe("밤");
  });
});

describe("timeOfDay.css 계약", () => {
  it(".mv-tod 원형 44·테두리 night-600·누를 수 없음", () => {
    const r = rulesFor(CSS, ".mv-tod");
    expect(r).toMatch(/width:\s*44px/);
    expect(r).toMatch(/height:\s*44px/);
    expect(r).toMatch(/border-radius:\s*var\(--radius-pill\)/);
    expect(r).toMatch(/border:\s*1px solid var\(--night-600\)/);
    expect(r).toMatch(/pointer-events:\s*none/);
    expect(r).toMatch(/overflow:\s*hidden/);
  });

  it("img 는 불투명도 0, is-on 은 1, 전환은 --dur-med 하나, 모션 줄이기면 전환 없음", () => {
    expect(rulesFor(CSS, ".mv-tod__img")).toMatch(/opacity:\s*0/);
    expect(rulesFor(CSS, ".mv-tod__img")).toMatch(/transition:\s*opacity var\(--dur-med\)/);
    expect(rulesFor(CSS, ".mv-tod__img.is-on")).toMatch(/opacity:\s*1/);
    expect(CSS).toMatch(/@media \(prefers-reduced-motion: reduce\)\s*\{\s*\.mv-tod__img\s*\{\s*transition:\s*none/);
  });

  it("반복 애니메이션이 없다", () => {
    expect(CSS).not.toMatch(/animation/);
    expect(CSS).not.toMatch(/@keyframes/);
  });
});
