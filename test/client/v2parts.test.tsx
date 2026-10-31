import { readFileSync } from "node:fs";
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import "../helpers/singleLineErrors";
import { HeadStack, NameTag } from "../../src/components/v2/HeadStack";
import { V2Icon } from "../../src/components/v2/V2Icon";

afterEach(cleanup);

// 06-12: 승인 v2.0 부품(design/v2.0/design-system/components/bundle.js)을 React 19 로 옮긴 DOM 부품.
// happy-dom 은 글자 폭을 재지 못한다(가정 A1). 실제 폭·잘림은 06-17 E2E 가 폰 6종에서 잰다.
// 여기서는 말줄임이 없다는 스타일 계약(nowrap·max-width 없음·ellipsis 없음)과 마크업을 고정한다.

const V2_CSS = readFileSync("src/styles/v2.css", "utf8");

// 주석을 지운 규칙 본문 중 선택자에 `selector` 가 들어 있는 것만 모은다.
function rulesFor(css: string, selector: string): string[] {
  const bare = css.replace(/\/\*[\s\S]*?\*\//g, "");
  return [...bare.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
    .filter((m) => (m[1] ?? "").split(",").some((s) => s.trim().startsWith(selector)))
    .map((m) => m[2] ?? "");
}

describe("NameTag (MAP-07, MAP-01)", () => {
  it("전각 8자 + (나) 를 .mv-tag.is-me 로 한 글자도 줄이지 않고 그린다", () => {
    const { container } = render(<NameTag name="가나다라마바사아" color="var(--seat-3)" me />);
    const tag = container.querySelector("span.mv-tag");
    expect(tag?.classList.contains("is-me")).toBe(true);
    expect(tag?.querySelector(".mv-tag__name")?.textContent).toBe("가나다라마바사아 (나)");
  });

  it("점은 자리 구분색을 background 로 가진다", () => {
    const { container } = render(<NameTag name="철수" color="var(--seat-3)" />);
    const dot = container.querySelector(".mv-tag__dot") as HTMLElement | null;
    expect(dot?.getAttribute("style")).toContain("var(--seat-3)");
  });

  it("away 는 .is-away, me 가 아니면 (나) 가 없다", () => {
    const { container } = render(<NameTag name="철수" color="var(--seat-1)" away />);
    const tag = container.querySelector("span.mv-tag");
    expect(tag?.classList.contains("is-away")).toBe(true);
    expect(tag?.classList.contains("is-me")).toBe(false);
    expect(tag?.textContent).not.toContain("(나)");
  });

  it("끊긴 나도 그려진다: is-me 와 is-away 가 함께 붙는다", () => {
    const { container } = render(<NameTag name="가나다라마바사아" color="var(--seat-8)" me away />);
    const tag = container.querySelector("span.mv-tag");
    expect(tag?.classList.contains("is-me") && tag.classList.contains("is-away")).toBe(true);
    expect(tag?.textContent).toBe("가나다라마바사아 (나)");
  });

  it("닉네임에 HTML 이 들어 있어도 글자 그대로이고 요소가 생기지 않는다 (T-06-26)", () => {
    const { container } = render(<NameTag name="<b>x</b>" color="var(--seat-1)" />);
    expect(container.querySelector("b")).toBeNull();
    expect(container.querySelector(".mv-tag__name")?.textContent).toBe("<b>x</b>");
  });
});

describe("HeadStack", () => {
  it("div.mv-head 안에 span.mv-tag 하나", () => {
    const { container } = render(<HeadStack name="철수" color="var(--seat-1)" />);
    const head = container.querySelector("div.mv-head");
    expect(head).not.toBeNull();
    expect(head?.children.length).toBe(1);
    expect(head?.firstElementChild?.matches("span.mv-tag")).toBe(true);
  });
});

describe("V2Icon", () => {
  it("label 이 없으면 aria-hidden svg", () => {
    const { container } = render(<V2Icon name="crown" />);
    const svg = container.querySelector("svg");
    expect(svg?.getAttribute("aria-hidden")).toBe("true");
    expect(svg?.getAttribute("role")).toBeNull();
    expect(svg?.getAttribute("viewBox")).toBe("0 0 24 24");
  });

  it("label 을 주면 role img 와 aria-label", () => {
    const { container } = render(<V2Icon name="crown" label="방장" />);
    const svg = container.querySelector("svg");
    expect(svg?.getAttribute("role")).toBe("img");
    expect(svg?.getAttribute("aria-label")).toBe("방장");
    expect(svg?.getAttribute("aria-hidden")).toBeNull();
  });

  it.each(["point", "crown", "play", "check", "roleCitizen"] as const)("%s 는 그림 요소를 가진다", (name) => {
    const { container } = render(<V2Icon name={name} />);
    expect(container.querySelectorAll("svg path, svg circle").length).toBeGreaterThan(0);
  });
});

describe("v2.css 이름표 스타일 계약 (MAP-07, 결정 0052-2)", () => {
  it(".mv-tag 규칙은 nowrap 이고 max-width·overflow hidden·ellipsis 가 없다", () => {
    const bodies = rulesFor(V2_CSS, ".mv-tag").join(";");
    expect(bodies).toContain("white-space: nowrap");
    expect(bodies).not.toMatch(/max-width/);
    expect(bodies).not.toMatch(/overflow\s*:\s*hidden/);
    expect(bodies).not.toMatch(/text-overflow/);
  });

  it("파일 어디에도 ellipsis 가 없다", () => {
    expect(V2_CSS).not.toContain("ellipsis");
  });

  it("승인 치수: 안쪽 2px 8px, 점 8×8, 점과 이름 6px, 면 overlay-ink, 글자 gray-50 14px 700", () => {
    const tag = rulesFor(V2_CSS, ".mv-tag")[0] ?? "";
    expect(tag).toContain("gap: 6px");
    expect(tag).toContain("padding: 2px var(--space-sm)");
    expect(tag).toContain("background: var(--overlay-ink)");
    expect(tag).toContain("color: var(--gray-50)");
    expect(tag).toContain("font-size: 14px");
    expect(tag).toContain("font-weight: 700");
    expect(tag).toContain("text-shadow: var(--shadow-text)");
    const dot = rulesFor(V2_CSS, ".mv-tag__dot").join(";");
    expect(dot).toContain("width: 8px");
    expect(dot).toContain("height: 8px");
  });

  it("내 이름표는 안쪽 테두리 1.5px gray-100, 끊긴 이름표는 불투명도 0.55 와 점 gray-700", () => {
    expect(V2_CSS).toMatch(/\.mv-tag\.is-me\s*\{[^}]*inset 0 0 0 1\.5px var\(--gray-100\)/);
    expect(V2_CSS).toMatch(/\.mv-tag\.is-away\s*\{[^}]*opacity: 0\.55/);
    expect(V2_CSS).toMatch(/\.mv-tag\.is-away \.mv-tag__dot\s*\{[^}]*var\(--gray-700\)/);
  });

  it("hex 색이 없고 진홍·놋쇠 토큰을 쓰지 않는다", () => {
    expect(V2_CSS).not.toMatch(/#[0-9a-fA-F]{6}\b/);
    expect(V2_CSS).not.toMatch(/--(crimson|brass)-/);
  });
});
