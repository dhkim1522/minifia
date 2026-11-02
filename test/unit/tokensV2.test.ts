// v2.0 디자인 시스템 토큰이 앱 토큰(design/tokens.json → src/styles/tokens.css)에 같은 값으로 들어 있음을 고정한다.
// 명조 글꼴(type.families.serif → --font-serif)은 8페이즈(08-05)에서 합쳤다. 글자 스타일 묶음(.badge-number 등)은 변수가 아니라
// v2.css 의 배지·도장 규칙에 직접 쓴다(생성기는 :root 변수만 만든다).
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

// 08-05: 명조 글꼴 토큰. 값은 승인 v2.0 토큰(design/v2.0/design-system/tokens.json type.families.serif) 그대로다.
describe("명조 글꼴 토큰 --font-serif (08-05, UI-SPEC Font)", () => {
  type TypeDoc = { type?: { families?: Record<string, string> } };
  const fam = (doc: unknown, key: string): string | undefined => (doc as TypeDoc).type?.families?.[key];
  const V2_CSS = readFileSync(new URL("../../src/styles/v2.css", import.meta.url), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
  const INDEX = readFileSync(new URL("../../index.html", import.meta.url), "utf8");
  const body = (selector: string): string => {
    const hit = [...V2_CSS.matchAll(/([^{}]+)\{([^{}]*)\}/g)].find((m) => (m[1] ?? "").trim() === selector);
    return hit?.[2] ?? "";
  };

  it("tokens.css 에 --font-serif 한 줄이 생성되어 있다", () => {
    expect(css.split("\n").filter((l) => l.includes("--font-serif:")).length).toBe(1);
  });

  it("tokens.css 의 --font-serif 값이 승인 v2.0 serif 와 같다", () => {
    const m = css.match(/--font-serif: ([^;]+);/);
    expect(m !== null).toBe(true);
    expect(m?.[1] === fam(v2, "serif")).toBe(true);
  });

  it("design/tokens.json type.families.serif 가 v2.0 과 같고 ui 는 그대로다", () => {
    expect(fam(app, "serif") !== undefined).toBe(true);
    expect(fam(app, "serif") === fam(v2, "serif")).toBe(true);
    expect(fam(app, "ui") === fam(v2, "ui")).toBe(true);
  });

  it("index.html 은 Gowun Batang 700 과 Gowun Dodum 을 한 요청(같은 호스트)으로 부른다", () => {
    const links = [...INDEX.matchAll(/<link[^>]*href="(https:\/\/fonts\.googleapis\.com\/css2[^"]*)"/g)].map((m) => m[1] ?? "");
    expect(links.length).toBe(1);
    expect(links[0]?.includes("family=Gowun+Batang:wght@700")).toBe(true);
    expect(links[0]?.includes("family=Gowun+Dodum")).toBe(true);
  });

  it("v2.css 에서 --font-serif 는 배지 숫자와 유력 도장 규칙에만 쓰이고 대체값이 없다", () => {
    const users = [...V2_CSS.matchAll(/([^{}]+)\{([^{}]*)\}/g)].filter((m) => (m[2] ?? "").includes("--font-serif")).map((m) => (m[1] ?? "").trim());
    expect(users.join("|")).toBe(".mv-badge__num|.mv-stamp");
    expect(V2_CSS.includes("var(--font-serif,")).toBe(false);
  });

  it("글자 스타일: 배지 숫자 22/1/700, 단위 12/1/700(ui), 도장 15/1/700 자간 0.12em", () => {
    const num = body(".mv-badge__num");
    expect(num.includes("font-family: var(--font-serif)")).toBe(true);
    expect(num.includes("font-size: 22px; line-height: 1; font-weight: 700")).toBe(true);
    const unit = body(".mv-badge__unit");
    expect(unit.includes("font-family: var(--font-ui)")).toBe(true);
    expect(unit.includes("font-size: 12px; line-height: 1; font-weight: 700")).toBe(true);
    const stamp = body(".mv-stamp");
    expect(stamp.includes("font-size: 15px; line-height: 1; font-weight: 700; letter-spacing: 0.12em")).toBe(true);
  });
});
