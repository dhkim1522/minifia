import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// 장면 상자(결정 0028): 위 = 헤더 119.2, 아래 = 뷰포트 − 하단 패널 157(+안전 영역), 좌우 여백 12(폰 폭 < 390 이면 4).
// 낮·역할 배정이 같은 상자를 쓴다(대기실은 06-15 에서 맵 로비로 바뀌어 이 상자를 쓰지 않는다 — 로비 틀의 값은 lobby.test.tsx 의 스타일 계약이 지킨다).
// 이 값들은 CSS 두 파일에 나뉘어 있어 한 곳만 바뀌면 단계가 바뀔 때 테이블이 움직인다 —
// 그래서 CSS 를 읽어(vitest 가 CSS import 를 비워 버린다) 두 화면을 교차로 확인한다. E2E T1 이 실제 브라우저에서 같은 것을 다시 본다.
const day = readFileSync("src/styles/day.css", "utf8");
const phase = readFileSync("src/styles/phase.css", "utf8");
const tokens = readFileSync("src/styles/tokens.css", "utf8");
const dt = readFileSync("src/styles/daytable.css", "utf8");

const esc = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const strip = (css: string): string => css.replace(/\/\*[\s\S]*?\*\//g, "");

/** 중괄호 안에 다른 중괄호가 없는 규칙의 본문. 선택자는 규칙 맨 앞이어야 한다(선택자 목록의 일부는 안 된다). 첫 일치만. */
function body(css: string, selector: string): string | null {
  const m = new RegExp(`(?:^|[}\\s])${esc(selector)}\\s*\\{([^}]*)\\}`).exec(strip(css));
  return m ? m[1]! : null;
}

/** `@media (max-width: 389px)` 블록 안의 본문 */
function narrowBody(css: string, selector: string): string | null {
  const c = strip(css);
  const at = c.indexOf("@media (max-width: 389px)");
  if (at < 0) return null;
  let i = c.indexOf("{", at);
  let depth = 0;
  const start = i;
  for (; i < c.length; i += 1) {
    if (c[i] === "{") depth += 1;
    else if (c[i] === "}") {
      depth -= 1;
      if (depth === 0) break;
    }
  }
  return body(c.slice(start + 1, i), selector);
}

const norm = (s: string | null): string => (s ?? "").replace(/\s+/g, " ").trim();

const PANEL_H = "calc(157px + env(safe-area-inset-bottom))";

describe("장면 상자: 하단 패널 높이 157 (+ 안전 영역)", () => {
  it.each([
    ["낮 하단 패널", day, ".mf-dayscene__panel"],
    ["역할 배정 빈 패널", phase, ".mf-assign__panel"],
  ])("%s 는 height calc(157px + 안전 영역) 이고 flex none·border-box 이다", (_name, css, selector) => {
    const b = norm(body(css, selector));
    expect(b, `${selector} 규칙`).not.toBe("");
    expect(b).toContain(`height: ${PANEL_H}`);
    expect(b).toMatch(/flex:\s*none/);
    expect(b).toMatch(/box-sizing:\s*border-box/);
  });

  it("두 패널은 같은 면과 모서리(night-800, 위쪽 radius-lg)다", () => {
    for (const [css, sel] of [
      [day, ".mf-dayscene__panel"],
      [phase, ".mf-assign__panel"],
    ] as const) {
      const b = norm(body(css, sel));
      expect(b, sel).toContain("background: var(--night-800)");
      expect(b, sel).toContain("border-radius: var(--radius-lg) var(--radius-lg) 0 0");
    }
  });
});

describe("장면 상자: 머리 높이 119.2", () => {
  it("배정 바는 height 119.2px 고정이다", () => {
    expect(norm(body(phase, ".mf-assign__bar"))).toMatch(/(?:^|[ ;])height: 119\.2px/);
    expect(norm(body(phase, ".mf-assign__bar"))).toMatch(/flex:\s*none/);
  });

  it("낮 머리(PhaseBar)는 내용 높이로 119.2 다: 16 + 윗줄 최소 50.4 + 간격 8 + 타이머 28.8 + 16", () => {
    const bar = norm(body(phase, ".mf-phasebar"));
    expect(bar).toContain("gap: var(--space-sm)");
    expect(bar).toContain("padding: var(--space-md)");
    expect(norm(body(phase, ".mf-phasebar__row"))).toContain("min-height: 50.4px");
    expect(norm(body(phase, ".mf-timer__num"))).toMatch(/font-size:\s*24px/);
    expect(norm(body(phase, ".mf-timer__num"))).toMatch(/line-height:\s*1\.2/);
    expect(/--space-md:\s*16px/.test(tokens)).toBe(true);
    expect(/--space-sm:\s*8px/.test(tokens)).toBe(true);
    // 16 + 50.4 + 8 + 24 × 1.2 + 16
    expect(16 + 50.4 + 8 + 24 * 1.2 + 16).toBeCloseTo(119.2, 5);
  });
});

describe("장면 상자: 좌우 여백 12 (폰 폭 < 390 이면 4), flex 1, min-height 0", () => {
  it.each([
    ["낮", day, ".mf-dayscene__scene"],
    ["역할 배정", phase, ".mf-assign__scene"],
  ])("%s 장면 상자: position relative · flex 1 · min-height 0 · padding 0 12px, max-width 389px 에서 0 4px", (_name, css, selector) => {
    const b = norm(body(css, selector));
    expect(b, selector).toMatch(/position:\s*relative/);
    expect(b, selector).toMatch(/flex:\s*1[;\s]/);
    expect(b, selector).toMatch(/min-height:\s*0/);
    expect(b, selector).toMatch(/padding:\s*0 12px/);
    expect(norm(narrowBody(css, selector)), selector).toMatch(/padding:\s*0 4px/);
  });

  it("DayTable 의 장면 여백 변수(--mf-scene-pad)도 같은 12 / 4 다", () => {
    expect(norm(body(dt, ".mf-dt"))).toMatch(/--mf-scene-pad:\s*12px/);
    expect(norm(narrowBody(dt, ".mf-dt"))).toMatch(/--mf-scene-pad:\s*4px/);
  });
});

describe("장면 상자: 배경은 남는 높이를 채운다(고정 높이 아님)", () => {
  it.each([
    ["낮", day, ".mf-dayscene__backdrop"],
    ["역할 배정", phase, ".mf-assign__backdrop"],
  ])("%s 배경: flex 1 1 0 · min-height 0 · height auto", (_name, css, selector) => {
    const b = norm(body(css, selector));
    expect(b, selector).toMatch(/flex:\s*1 1 0/);
    expect(b, selector).toMatch(/min-height:\s*0/);
    expect(b, selector).toMatch(/height:\s*auto/);
    expect(b, selector).not.toMatch(/dvh|100vh/);
  });

  it("두 화면 CSS 어디에도 100dvh 로 따로 계산한 배경·루트 높이가 없다", () => {
    for (const css of [day, phase]) expect(/100dvh/.test(strip(css))).toBe(false);
  });
});
