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

// 09.1.1-08: 직업 배지·칩 시트·떠 있는 버튼 CSS 정적 검사 (UI-SPEC "Color"·"Typography"·"접근성 · 모션 · 입력")
describe("직업 배지 CSS 규칙 (09.1.1-08)", () => {
  const strip = (name: string): string => readFileSync(new URL(`../../src/styles/${name}`, import.meta.url), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
  const V2 = strip("v2.css");
  const GAME = strip("game.css");
  const rules = (css: string): { selector: string; body: string }[] => [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((m) => ({ selector: (m[1] ?? "").trim(), body: m[2] ?? "" }));
  const mine = (css: string, re: RegExp) => rules(css).filter((r) => re.test(r.selector));
  const NEW = [...mine(V2, /(mv-claim|mv-float)/), ...mine(GAME, /mf-float/)];

  it("새 규칙이 있다(mv-claim 5곳 이상, 떠 있는 버튼, mf-float)", () => {
    expect((V2.match(/mv-claim/g) ?? []).length).toBeGreaterThanOrEqual(5);
    expect(mine(V2, /\.mv-float/).length).toBeGreaterThan(0);
    expect(mine(GAME, /\.mf-float/).length).toBe(1);
  });

  it("hex·rgb 색 리터럴이 없다 — tokens.css 변수만", () => {
    for (const r of NEW) {
      expect(r.body, r.selector).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
      expect(r.body, r.selector).not.toMatch(/\brgba?\(/);
    }
  });

  it("font-size 는 14·16·24·36 중 하나다", () => {
    for (const r of NEW) {
      for (const m of r.body.matchAll(/font-size:\s*([^;]+);/g)) expect(["14px", "16px", "24px", "36px"], `${r.selector}: ${m[1]}`).toContain((m[1] ?? "").trim());
    }
    expect(NEW.some((r) => /font-size/.test(r.body))).toBe(true);
  });

  it("진홍·놋쇠 변수를 한 번도 쓰지 않는다(배지·시트는 gray/night 계열만)", () => {
    for (const r of NEW) expect(r.body, r.selector).not.toMatch(/--(crimson|brass)-/);
  });

  it("글자 14px 미만이 없다(12px 아이콘 점은 글자가 아니다)", () => {
    for (const r of NEW) for (const m of r.body.matchAll(/font-size:\s*(\d+)px/g)) expect(Number(m[1])).toBeGreaterThanOrEqual(14);
  });

  it("모션 줄이기: 배지 팝·알약 페이드·시트 등장 애니메이션이 없다(animation: none)", () => {
    const reduce = V2.slice(V2.lastIndexOf("@media (prefers-reduced-motion: reduce)"));
    const hit = rules(reduce).find((r) => r.selector.includes(".mv-claim.is-pop") && r.selector.includes(".mv-claim__notice") && r.selector.includes(".mv-claim-sheet"));
    expect(hit?.body).toMatch(/animation:\s*none/);
  });

  it("애니메이션은 transform·opacity 만 움직인다", () => {
    const keyframes = [...V2.matchAll(/@keyframes\s+(mv-claim[\w-]*)\s*\{((?:[^{}]*\{[^{}]*\})*)\s*\}/g)];
    expect(keyframes.length).toBeGreaterThanOrEqual(4);
    for (const k of keyframes) for (const decl of (k[2] ?? "").matchAll(/\{([^{}]*)\}/g)) for (const prop of (decl[1] ?? "").split(";").map((d) => d.split(":")[0]?.trim()).filter(Boolean)) expect(["transform", "opacity"], `${k[1]}: ${prop}`).toContain(prop);
  });

  it("떠 있는 버튼 묶음은 키보드 올림 + 패널 높이 + 8 위에 앉고 시트(z-overlay) 아래다", () => {
    const body = mine(GAME, /\.mf-float/)[0]?.body ?? "";
    expect(body).toMatch(/--mf-kb-lift/);
    expect(body).toMatch(/--mf-panel-h/);
    expect(body).toMatch(/var\(--space-sm\)/);
    expect(body).toMatch(/right:\s*var\(--space-md\)/);
    expect(body).toMatch(/z-index:\s*calc\(var\(--z-overlay\) - 1\)/);
  });

  it("버튼 지름 48(control-input), 칩 높이 44(tap-min)", () => {
    const btn = mine(V2, /^\.mv-float$/)[0]?.body ?? "";
    expect(btn).toMatch(/width:\s*var\(--control-input\)/);
    expect(btn).toMatch(/height:\s*var\(--control-input\)/);
    expect(mine(V2, /^\.mv-claim-chip$/)[0]?.body ?? "").toMatch(/min-height:\s*var\(--tap-min\)/);
  });
});

// 09.1.1-09: 귓속말 한 줄 시트·비공개 줄 CSS 정적 검사 (UI-SPEC B, "쓰지 않을 것")
describe("귓속말 CSS 규칙 (09.1.1-09)", () => {
  const V2 = readFileSync(new URL("../../src/styles/v2.css", import.meta.url), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
  const rules = [...V2.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((m) => ({ selector: (m[1] ?? "").trim(), body: m[2] ?? "" }));
  const NEW = rules.filter((r) => /(mv-line|mv-chat__whisper)/.test(r.selector));

  it("새 규칙이 있다(한 줄 시트·윗줄·입력줄·비공개 블록)", () => {
    expect(NEW.length).toBeGreaterThanOrEqual(10);
    for (const sel of [".mv-line-sheet", ".mv-line__head", ".mv-line__row", ".mv-line__input", ".mv-line__send", ".mv-chat__whisper"]) expect(NEW.some((r) => r.selector === sel), sel).toBe(true);
  });

  it("hex·rgb 색 리터럴이 없다 — tokens.css 변수만", () => {
    for (const r of NEW) {
      expect(r.body, r.selector).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
      expect(r.body, r.selector).not.toMatch(/\brgba?\(/);
    }
  });

  it("밝은 종이 면·진홍·놋쇠·초록·호박이 없다 — 색 변수는 night/gray 계열뿐", () => {
    for (const r of NEW) {
      for (const m of r.body.matchAll(/var\(--([a-z0-9-]+)\)/g)) {
        const name = m[1] ?? "";
        if (/^(space|radius|tap|control|font|shadow|dur|ease|z)-?/.test(name)) continue;
        expect(name, `${r.selector}: --${name}`).toMatch(/^(night|gray)-/);
      }
      expect(r.body, r.selector).not.toMatch(/--(crimson|brass|cream|journal|amber|felt)-/);
    }
  });

  it("글자 크기는 14 이상(14·16 중 하나)이다", () => {
    for (const r of NEW) for (const m of r.body.matchAll(/font-size:\s*([^;]+);/g)) expect(["14px", "16px"], `${r.selector}: ${m[1]}`).toContain((m[1] ?? "").trim());
    expect(NEW.some((r) => /font-size/.test(r.body))).toBe(true);
  });

  it("시트 틀은 유언 시트와 같은 값 — night-800 면·night-600 테두리·radius-lg·안쪽 12·폭 부모 − 20", () => {
    const body = NEW.find((r) => r.selector === ".mv-line-sheet")?.body ?? "";
    expect(body).toMatch(/background:\s*var\(--night-800\)/);
    expect(body).toMatch(/border:\s*1px solid var\(--night-600\)/);
    expect(body).toMatch(/border-radius:\s*var\(--radius-lg\)/);
    expect(body).toMatch(/padding:\s*12px/);
    expect(body).toMatch(/width:\s*calc\(100% - 20px\)/);
  });

  it("윗줄 높이 44(tap-min), 입력줄·입력칸·보내기 48(control-input), 닫기 44×44", () => {
    const body = (sel: string) => NEW.find((r) => r.selector === sel)?.body ?? "";
    expect(body(".mv-line__head")).toMatch(/height:\s*var\(--tap-min\)/);
    expect(body(".mv-line__row")).toMatch(/height:\s*var\(--control-input\)/);
    expect(body(".mv-line__input")).toMatch(/height:\s*var\(--control-input\)/);
    expect(body(".mv-line__send")).toMatch(/width:\s*var\(--control-input\)/);
    expect(body(".mv-line__send")).toMatch(/height:\s*var\(--control-input\)/);
    expect(body(".mv-line__close")).toMatch(/width:\s*var\(--tap-min\)/);
    expect(body(".mv-line__close")).toMatch(/height:\s*var\(--tap-min\)/);
  });

  it("입력칸 16px night-900 면, 보내기 gray-100 면 night-900 글자, 글자 수 tabular-nums", () => {
    const body = (sel: string) => NEW.find((r) => r.selector === sel)?.body ?? "";
    expect(body(".mv-line__input")).toMatch(/font-size:\s*16px/);
    expect(body(".mv-line__input")).toMatch(/background:\s*var\(--night-900\)/);
    expect(body(".mv-line__send")).toMatch(/background:\s*var\(--gray-100\)/);
    expect(body(".mv-line__send")).toMatch(/color:\s*var\(--night-900\)/);
    expect(body(".mv-line__count")).toMatch(/tabular-nums/);
  });

  it("귓속말 모드의 이름표 깜빡임은 모션 줄이기에서 gray-100 2px 고정 테두리다(기존 .mv-tag.is-blink 규칙)", () => {
    const reduce = V2.match(/@media \(prefers-reduced-motion: reduce\)\s*\{[\s\S]*?\n\}/g)?.join("\n") ?? "";
    expect(reduce).toMatch(/\.mv-tag\.is-blink\s*\{\s*animation:\s*none;\s*box-shadow:\s*inset 0 0 0 2px var\(--gray-100\)/);
  });
});
