// v2.0 디자인 시스템 토큰이 앱 토큰(design/tokens.json → src/styles/tokens.css)에 같은 값으로 들어 있음을 고정한다.
// 글꼴(type)·글자 스타일 묶음은 합치지 않는다(7~8페이즈에서 Gowun Batang 과 함께 추가).
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

type Token = { name: string; value: string };
type Doc = Record<string, { tokens?: Token[] } | unknown>;

const read = (p: string): Doc => JSON.parse(readFileSync(new URL(`../../${p}`, import.meta.url), "utf8"));
const app = read("design/tokens.json");
const v2 = read("design/v2.0/design-system/tokens.json");
const css = readFileSync(new URL("../../src/styles/tokens.css", import.meta.url), "utf8");

const FAMILIES = ["color", "spacing", "radius", "shadow", "size", "duration", "easing", "zIndex"];
const tokensOf = (doc: Doc, family: string): Token[] => (doc[family] as { tokens?: Token[] } | undefined)?.tokens ?? [];

const UI_SPEC_NAMES = [
  "overlay-ink",
  "overlay-ink-strong",
  "brass-200",
  "brass-400",
  "brass-600",
  "cream-100",
  "light-lamp",
  "light-stage",
  "light-spot",
  "light-moon",
  "sky-overcast",
  "radius-stamp",
  "radius-badge",
  "shadow-badge",
  "badge-min",
  "toast-top",
  "dur-pop",
  "dur-pulse",
  "dur-toast",
  "z-world",
  "z-tags",
  "z-toast",
];

describe("v2.0 토큰 합치기", () => {
  it.each(FAMILIES)("v2 의 %s 토큰이 모두 앱 토큰에 같은 값으로 있다", (family) => {
    const mine = new Map(tokensOf(app, family).map((t) => [t.name, t.value]));
    for (const t of tokensOf(v2, family)) {
      expect(mine.get(t.name), `${family}/${t.name}`).toBe(t.value);
    }
  });

  it("UI-SPEC 의 22개 이름이 모두 design/tokens.json 에 있다", () => {
    const all = new Set(FAMILIES.flatMap((f) => tokensOf(app, f).map((t) => t.name)));
    for (const name of UI_SPEC_NAMES) expect(all.has(name), name).toBe(true);
  });

  it("tokens.css 에 v2 변수가 만들어져 있다", () => {
    for (const v of ["--light-lamp", "--z-tags", "--toast-top", "--dur-pulse", "--overlay-ink"]) {
      expect(css).toContain(`${v}:`);
    }
  });

  it("v1.0 에만 있던 토큰은 지워지지 않았다", () => {
    const names = new Set(FAMILIES.flatMap((f) => tokensOf(app, f).map((t) => t.name)));
    for (const keep of ["z-table", "z-overlay", "z-modal", "night-900", "night-950", "gray-50"]) {
      expect(names.has(keep), keep).toBe(true);
    }
    const count = FAMILIES.reduce((n, f) => n + tokensOf(app, f).length, 0);
    expect(count).toBeGreaterThanOrEqual(63 + 7 + 4 + 2 + 5 + 3 + 1 + 3 + 22);
  });
});
