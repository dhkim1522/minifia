import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// 장면 상자(결정 0028): 위 = 헤더 119.2, 아래 = 뷰포트 − 하단 패널 157(+안전 영역), 좌우 여백 12(폰 폭 < 390 이면 4).
// 08-27: 낮은 08-13 부터 맵 화면이라 옛 낮 장면 상자·테이블 여백 변수 행은 지웠다(맵 화면은 이 상자를 쓰지 않는다 — 틀의 값은 gameMap.test.tsx 의
// 스타일 측정 시험이 지킨다). 남은 것은 역할 배정 장면 상자이고, 이 행들은 배정 화면을 지우는 08-19 가 함께 지운다.
// CSS 를 읽어(vitest 가 CSS import 를 비워 버린다) 확인한다. E2E T1 이 실제 브라우저에서 같은 것을 다시 본다.
const phase = readFileSync("src/styles/phase.css", "utf8");
const tokens = readFileSync("src/styles/tokens.css", "utf8");

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
  it("역할 배정 빈 패널은 height calc(157px + 안전 영역) 이고 flex none·border-box 이다", () => {
    const b = norm(body(phase, ".mf-assign__panel"));
    expect(b, ".mf-assign__panel 규칙").not.toBe("");
    expect(b).toContain(`height: ${PANEL_H}`);
    expect(b).toMatch(/flex:\s*none/);
    expect(b).toMatch(/box-sizing:\s*border-box/);
  });

  it("역할 배정 패널의 면과 모서리는 night-800, 위쪽 radius-lg 다", () => {
    const b = norm(body(phase, ".mf-assign__panel"));
    expect(b).toContain("background: var(--night-800)");
    expect(b).toContain("border-radius: var(--radius-lg) var(--radius-lg) 0 0");
  });
});

describe("장면 상자: 머리 높이 119.2", () => {
  it("배정 바는 height 119.2px 고정이다", () => {
    expect(norm(body(phase, ".mf-assign__bar"))).toMatch(/(?:^|[ ;])height: 119\.2px/);
    expect(norm(body(phase, ".mf-assign__bar"))).toMatch(/flex:\s*none/);
  });
});

describe("장면 상자: 좌우 여백 12 (폰 폭 < 390 이면 4), flex 1, min-height 0", () => {
  it("역할 배정 장면 상자: position relative · flex 1 · min-height 0 · padding 0 12px, max-width 389px 에서 0 4px", () => {
    const selector = ".mf-assign__scene";
    const b = norm(body(phase, selector));
    expect(b, selector).toMatch(/position:\s*relative/);
    expect(b, selector).toMatch(/flex:\s*1[;\s]/);
    expect(b, selector).toMatch(/min-height:\s*0/);
    expect(b, selector).toMatch(/padding:\s*0 12px/);
    expect(norm(narrowBody(phase, selector)), selector).toMatch(/padding:\s*0 4px/);
  });
});

describe("장면 상자: 배경은 남는 높이를 채운다(고정 높이 아님)", () => {
  it("역할 배정 배경: flex 1 1 0 · min-height 0 · height auto", () => {
    const selector = ".mf-assign__backdrop";
    const b = norm(body(phase, selector));
    expect(b, selector).toMatch(/flex:\s*1 1 0/);
    expect(b, selector).toMatch(/min-height:\s*0/);
    expect(b, selector).toMatch(/height:\s*auto/);
    expect(b, selector).not.toMatch(/dvh|100vh/);
  });

  it("단계 화면 CSS(phase.css) 어디에도 100dvh 로 따로 계산한 배경·루트 높이가 없다", () => {
    expect(/100dvh/.test(strip(phase))).toBe(false);
  });
});
