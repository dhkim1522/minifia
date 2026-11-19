// v2.0 디자인 시스템 토큰이 앱 토큰(design/tokens.json → src/styles/tokens.css)에 같은 값으로 들어 있음을 고정한다.
// v3의 글꼴과 글자 역할은 현재 제품 규격을 기준으로 검사한다.
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

describe("v3 공통 글꼴과 글자 역할", () => {
  type TypeDoc = { type?: { families?: Record<string, string> } };
  const fam = (doc: unknown, key: string): string | undefined => (doc as TypeDoc).type?.families?.[key];
  const V2_CSS = readFileSync(new URL("../../src/styles/v2.css", import.meta.url), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
  const INDEX = readFileSync(new URL("../../index.html", import.meta.url), "utf8");
  const body = (selector: string): string => {
    const hit = [...V2_CSS.matchAll(/([^{}]+)\{([^{}]*)\}/g)].find((m) => (m[1] ?? "").trim() === selector);
    return hit?.[2] ?? "";
  };

  it("홈과 중앙 발표는 시스템 고딕을 공유하고 문서 본문은 손글씨를 쓴다", () => {
    expect(fam(app, "ui")).toContain('"Apple SD Gothic Neo"');
    expect(fam(app, "ui")).toContain("system-ui");
    expect(fam(app, "hand")).toContain('"Nanum Pen Script"');
    expect(css).toContain("--type-brand: 900 clamp(50px, 15vw, 72px)/1.08 var(--font-ui);");
    expect(css).toContain("--type-headline: 900 clamp(32px, 10vw, 36px)/1.2 var(--font-ui);");
    expect(css).toContain("--type-section: 700 20px/1.3 var(--font-ui);");
    expect(css).toContain("--type-body: 400 16px/1.5 var(--font-ui);");
    expect(css).toContain("--type-label: 400 14px/1.4 var(--font-ui);");
    expect(css).toContain("--type-hand-note: 400 20px/1.35 var(--font-hand);");
  });

  it("홈에서 별도의 웹폰트를 불러오지 않는다", () => {
    const base = readFileSync(new URL("../../src/styles/base.css", import.meta.url), "utf8");
    expect(INDEX).not.toMatch(/fonts\.googleapis\.com|fonts\.gstatic\.com/);
    expect(base).not.toMatch(/serifFont|noto-serif/);
    expect(css).not.toContain("--font-serif:");
  });

  it("일반 인용은 본문 규격을 쓰고 유언 인용에 손글씨를 적용한다", () => {
    expect(body(".mv-quote")).toContain("var(--type-body)");
    expect(body(".mv-quote--will")).toContain("var(--type-hand-note)");
    expect(body(".mv-stamp")).toContain("var(--font-ui)");
    expect(V2_CSS).not.toContain("var(--font-serif)");
  });

  it("글자 스타일: 배지 숫자 22/1/700, 단위 12/1/700(ui), 도장 15/1/700 자간 0.12em", () => {
    const num = body(".mv-badge__num");
    expect(num.includes("font-family: var(--font-ui)")).toBe(true);
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
    const reduce = V2.slice(V2.indexOf("@media (prefers-reduced-motion: reduce)"));
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

  it("떠 있는 단추 지름 48(control-input, 상자가 곧 면), 옆 열 단추는 52(control-button), 칩 높이 44(tap-min) — 16-06: 면 요소 없음", () => {
    const btn = mine(V2, /^\.mv-float$/)[0]?.body ?? "";
    expect(btn).toMatch(/width:\s*var\(--control-input\)/);
    expect(btn).toMatch(/height:\s*var\(--control-input\)/);
    expect(mine(V2, /^\.mv-float\[data-side-button\]$/)[0]?.body ?? "").toMatch(/width:\s*var\(--control-button\)/);
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

  it("귓속말 시트는 중립색 중심이고 보내기 버튼은 종이·잉크 색으로 표시한다", () => {
    for (const r of NEW) {
      for (const m of r.body.matchAll(/var\(--([a-z0-9-]+)\)/g)) {
        const name = m[1] ?? "";
        if (/^(space|radius|tap|control|font|shadow|dur|ease|z)-?/.test(name)) continue;
        expect(name, `${r.selector}: --${name}`).toMatch(/^(night|gray|noir)-/);
      }
      expect(r.body, r.selector).not.toMatch(/--(crimson|brass|cream|journal|amber|felt)-/);
    }
  });

  it("글자 크기는 14 이상(14·16 중 하나)이다", () => {
    for (const r of NEW) for (const m of r.body.matchAll(/font-size:\s*([^;]+);/g)) expect(["14px", "16px"], `${r.selector}: ${m[1]}`).toContain((m[1] ?? "").trim());
    expect(NEW.some((r) => /font-size/.test(r.body))).toBe(true);
  });

  it("시트는 누아르 패널과 구분선, 안쪽 여백 12px, 부모 폭 − 20px을 쓴다", () => {
    const body = NEW.find((r) => r.selector === ".mv-line-sheet")?.body ?? "";
    expect(body).toMatch(/background:\s*var\(--noir-sheet-light\), var\(--noir-panel\)/);
    expect(body).toMatch(/border:\s*1px solid/);
    expect(body).toMatch(/border-color:\s*var\(--noir-line\)/);
    expect(body).toMatch(/border-radius:\s*var\(--noir-surface-radius\)/);
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
    const close = rules.find((r) => r.selector === ".mv-closepill")?.body ?? "";
    expect(close).toMatch(/width:\s*var\(--tap-min\)/);
    expect(close).toMatch(/height:\s*var\(--tap-min\)/);
    expect(readFileSync("src/components/v2/LineSheet.tsx", "utf8")).toContain('className="mv-closepill mv-line__close"');
  });

  it("입력칸 글자는 16px, 보내기는 금빛 글자와 진행 버튼 면, 글자 수는 고정 너비 숫자", () => {
    const body = (sel: string) => NEW.find((r) => r.selector === sel)?.body ?? "";
    expect(body(".mv-line__input")).toMatch(/font-size:\s*16px/);
    expect(body(".mv-line__input")).toMatch(/background:\s*var\(--noir-inset\)/);
    expect(body(".mv-line__send")).toMatch(/background:\s*var\(--noir-action\)/);
    expect(body(".mv-line__send")).toMatch(/color:\s*var\(--noir-accent\)/);
    expect(body(".mv-line__count")).toMatch(/tabular-nums/);
  });

  it("귓속말 모드의 이름표 깜빡임은 모션 줄이기에서 gray-100 2px 고정 테두리다(기존 .mv-tag.is-blink 규칙)", () => {
    const reduce = V2.match(/@media \(prefers-reduced-motion: reduce\)\s*\{[\s\S]*?\n\}/g)?.join("\n") ?? "";
    expect(reduce).toMatch(/\.mv-tag\.is-blink\s*\{\s*animation:\s*none;\s*box-shadow:\s*inset 0 0 0 2px var\(--gray-100\)/);
  });
});

// 09.1.1-15: 마지막 3인 한마디 칩 시트·인용 카드 CSS 정적 검사 (UI-SPEC E-2·E-4, "Color"·"Typography"·"접근성 · 모션 · 입력")
describe("마지막 3인 CSS 규칙 (09.1.1-15)", () => {
  const V2 = readFileSync(new URL("../../src/styles/v2.css", import.meta.url), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
  const rules = [...V2.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((m) => ({ selector: (m[1] ?? "").trim(), body: m[2] ?? "" }));
  const NEW = rules.filter((r) => /(mv-speak|mv-quote)/.test(r.selector));
  const body = (sel: string) => NEW.find((r) => r.selector === sel)?.body ?? "";
  const tokenPx = (name: string): number => Number(new RegExp(`${name}:\\s*(\\d+)px`).exec(css)?.[1]);

  it("새 규칙이 있다(시트·칩·인용 카드, 4곳 이상)", () => {
    for (const sel of [".mv-speak-sheet", ".mv-speak-chip", ".mv-quote", ".mv-quote.is-on"]) expect(NEW.some((r) => r.selector === sel), sel).toBe(true);
    expect((V2.match(/mv-speak|mv-quote/g) ?? []).length).toBeGreaterThanOrEqual(4);
  });

  it("hex·rgb 색 리터럴이 없다", () => {
    for (const r of NEW) {
      expect(r.body, r.selector).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
      expect(r.body, r.selector).not.toMatch(/\brgba?\(/);
    }
  });

  it("인용문에는 누아르와 기존 중립색을 쓴다", () => {
    for (const r of NEW) {
      expect(r.body, r.selector).not.toMatch(/--(crimson|brass|cream|green|amber|felt)-/);
      for (const m of r.body.matchAll(/var\(--([a-z0-9-]+)\)/g)) {
        const name = m[1] ?? "";
        if (/^(space|radius|tap|control|font|type|shadow|dur|ease|z|mf)-?/.test(name)) continue;
        expect(name, `${r.selector}: --${name}`).toMatch(/^(night|gray|noir)-/);
      }
    }
  });

  it("글자 크기는 16px 한 가지(14 미만 없음)", () => {
    for (const r of NEW) for (const m of r.body.matchAll(/font-size:\s*([^;]+);/g)) expect((m[1] ?? "").trim(), r.selector).toBe("16px");
    expect(body(".mv-speak-chip")).toMatch(/font-size:\s*16px/);
    expect(body(".mv-quote")).toContain("font: var(--type-body)");
  });

  it("인용 카드: 은색 테두리 1.5px, 안쪽 8px 16px, 두 줄까지, 누를 수 없다", () => {
    const q = body(".mv-quote");
    expect(q).toMatch(/border:\s*1\.5px solid/);
    expect(q).toMatch(/border-color:\s*var\(--noir-silver\)/);
    expect(q).toMatch(/background:\s*color-mix\(in srgb, var\(--noir-inset\) 96%, transparent\)/);
    expect(q).toMatch(/border-radius:\s*var\(--noir-control-radius\)/);
    expect(q).toMatch(/padding:\s*var\(--space-sm\) var\(--space-md\)/);
    expect(q).toMatch(/color:\s*var\(--gray-50\)/);
    expect(q).toMatch(/word-break:\s*keep-all/);
    expect(q).toMatch(/overflow-wrap:\s*anywhere/);
    expect(q).toMatch(/-webkit-line-clamp:\s*2/);
    expect(q).toMatch(/pointer-events:\s*none/);
    expect(q).toMatch(/transition:\s*opacity var\(--dur-med\)/);
  });

  it("한마디 시트: 패널 높이(--mf-panel-h)와 같은 높이, 면은 패널과 같은 night-800 97%, 칩 높이 44·좌우 16·사이 8", () => {
    const sheet = body(".mv-speak-sheet");
    expect(sheet).toMatch(/height:\s*var\(--mf-panel-h/);
    expect(sheet).toMatch(/background:\s*color-mix\(in srgb, var\(--night-800\) 97%, transparent\)/);
    expect(sheet).toMatch(/flex-wrap:\s*wrap/);
    expect(sheet).toMatch(/gap:\s*var\(--space-sm\)/);
    expect(sheet).toMatch(/padding:\s*12px var\(--space-md\)/);
    const chip = body(".mv-speak-chip");
    expect(chip).toMatch(/min-height:\s*var\(--tap-min\)/);
    expect(chip).toMatch(/padding:\s*0 var\(--space-md\)/);
  });

  it("칩 3줄 + 안쪽이 패널 188 안에 들어간다: 44×3 + 8×2 + 12×2 = 172 ≤ 188 (토큰 값으로 계산)", () => {
    const tap = tokenPx("--tap-min");
    const gap = tokenPx("--space-sm");
    expect(tap).toBe(44);
    expect(gap).toBe(8);
    const rows = 3;
    const inner = 12 * 2;
    const total = tap * rows + gap * (rows - 1) + inner;
    expect(total).toBe(172);
    expect(total).toBeLessThanOrEqual(188);
  });

  it("모션 줄이기: 시트에는 애니메이션이 없고 인용 카드 페이드는 transition: none, 이름표 깜빡임은 gray-100 2px 고정 테두리", () => {
    for (const r of NEW) expect(r.body, r.selector).not.toMatch(/animation/);
    const reduce = [...readFileSync(new URL("../../src/styles/v2.css", import.meta.url), "utf8").matchAll(/@media \(prefers-reduced-motion: reduce\)\s*\{([\s\S]*?)\n\}|@media \(prefers-reduced-motion: reduce\)\s*\{([^{}]*\{[^{}]*\}\s*)+\}/g)].map((m) => m[0]).join("\n");
    expect(reduce).toMatch(/\.mv-quote\s*\{\s*transition:\s*none/);
    expect(reduce).toMatch(/\.mv-tag\.is-blink\s*\{[^}]*box-shadow:\s*inset 0 0 0 2px var\(--gray-100\)/);
  });
});
