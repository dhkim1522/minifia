import { readFileSync } from "node:fs";
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import "../helpers/singleLineErrors";
import { VoteBadge } from "../../src/components/v2/VoteBadge";

afterEach(cleanup);

// 08-03: 승인 v2.0 부품(design/v2.0/design-system/components/bundle.js)을 React 19 로 옮긴 득표·도장·직업 칩·찬반 부품.
// happy-dom 은 글자 폭·애니메이션을 재지 못한다. 여기서는 마크업과 v2.css 스타일 계약을 고정한다.

const V2_CSS = readFileSync("src/styles/v2.css", "utf8");

// 주석을 지운 규칙 본문 중 선택자가 `selector` 로 시작하는 것만 모은다(다음 글자가 이름 글자가 아니어야 한다).
function rulesFor(css: string, selector: string): string[] {
  const bare = css.replace(/\/\*[\s\S]*?\*\//g, "");
  return [...bare.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
    .filter((m) => (m[1] ?? "").split(",").some((s) => s.trim().startsWith(selector) && !/[\w-]/.test(s.trim().charAt(selector.length))))
    .map((m) => m[2] ?? "");
}

// 모션 줄이기 @media 블록 안의 규칙 중 선택자 목록에 `selector` 가 정확히 들어 있는 것의 본문.
function reducedMotionRules(css: string, selector: string): string[] {
  const bare = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const blocks = [...bare.matchAll(/@media \(prefers-reduced-motion: reduce\)\s*\{((?:[^{}]*\{[^{}]*\})*)\s*\}/g)];
  return blocks.flatMap((b) =>
    [...(b[1] ?? "").matchAll(/([^{}]+)\{([^{}]*)\}/g)]
      .filter((m) => (m[1] ?? "").split(",").some((s) => s.trim() === selector))
      .map((m) => m[2] ?? ""),
  );
}

describe("VoteBadge (DAY-04, 결정 0049)", () => {
  it("count 3 은 span.mv-badge 안에 숫자 3 과 단위 표, data-count 를 그린다", () => {
    const { container } = render(<VoteBadge count={3} />);
    const badge = container.querySelector("span.mv-badge");
    expect(badge).not.toBeNull();
    expect(badge?.getAttribute("data-count")).toBe("3");
    expect(badge?.querySelector(".mv-badge__num")?.textContent).toBe("3");
    expect(badge?.querySelector(".mv-badge__unit")?.textContent).toBe("표");
  });

  it.each([0, -1, Number.NaN])("count %s 이면 아무 요소도 그리지 않는다", (count) => {
    const { container } = render(<VoteBadge count={count} />);
    expect(container.firstChild).toBeNull();
  });

  it("count 가 없으면(undefined) 아무 요소도 그리지 않는다", () => {
    const { container } = render(<VoteBadge {...({} as { count: number })} />);
    expect(container.firstChild).toBeNull();
  });

  it("lead 면 .is-lead 가 붙고, 없으면 붙지 않는다", () => {
    const a = render(<VoteBadge count={2} lead />);
    expect(a.container.querySelector("span.mv-badge")?.classList.contains("is-lead")).toBe(true);
    cleanup();
    const b = render(<VoteBadge count={2} />);
    expect(b.container.querySelector("span.mv-badge")?.classList.contains("is-lead")).toBe(false);
  });

  it("8표도 그대로 그린다", () => {
    const { container } = render(<VoteBadge count={8} />);
    expect(container.querySelector(".mv-badge__num")?.textContent).toBe("8");
  });

  it("3 에서 4 로 다시 그려도 같은 DOM 노드에서 숫자만 바뀐다", () => {
    const { container, rerender } = render(<VoteBadge count={3} />);
    const before = container.querySelector("span.mv-badge");
    const num = container.querySelector(".mv-badge__num");
    rerender(<VoteBadge count={4} />);
    expect(container.querySelector("span.mv-badge")).toBe(before);
    expect(container.querySelector(".mv-badge__num")).toBe(num);
    expect(num?.textContent).toBe("4");
    expect(before?.getAttribute("data-count")).toBe("4");
  });
});

describe("v2.css 득표 배지 스타일 계약 (DAY-04)", () => {
  it(".mv-badge 는 overlay-ink-strong 면·brass-400 2px 테두리·radius-badge 이고 색은 토큰 변수만 쓴다", () => {
    const body = rulesFor(V2_CSS, ".mv-badge").join(" ");
    expect(body).toContain("var(--overlay-ink-strong)");
    expect(body).toMatch(/border:\s*2px solid var\(--brass-400\)/);
    expect(body).toContain("var(--radius-badge)");
    expect(body).not.toMatch(/#[0-9a-fA-F]{3,6}\b/);
  });

  it("숫자·단위 규칙이 있고 숫자는 명조 대체값을 가진다", () => {
    expect(rulesFor(V2_CSS, ".mv-badge__num").join(" ")).toContain("var(--font-serif, serif)");
    expect(rulesFor(V2_CSS, ".mv-badge__unit").length).toBeGreaterThan(0);
  });

  it("모션 줄이기면 배지 애니메이션이 꺼지고 선두 배지는 scale(1.18) 로 고정된다", () => {
    expect(reducedMotionRules(V2_CSS, ".mv-badge").join(" ")).toContain("animation: none");
    expect(reducedMotionRules(V2_CSS, ".mv-badge.is-lead").join(" ")).toContain("scale(1.18)");
  });
});
