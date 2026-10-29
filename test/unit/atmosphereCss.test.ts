// 5페이즈 새 CSS(atmosphere.css)의 정적 게이트 (05-03, LOOK-01, D-05·D-06·D-07, T-05-06·T-05-08).
// 두 층(밤 비네팅·아침 밝아짐)이 탭을 가로채지 않고, 값은 상수 한 곳에서만 오며, 금지 속성·색 값이 없음을 CSS 원문으로 지킨다.
// vitest 는 CSS 를 비워 주므로 `?raw` 대신 readFileSync 로 읽는다(01-17 선례). 실제 쌓임은 E2E AT1·AT2(05-06)가 본다.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const RAW = readFileSync(new URL("../../src/styles/atmosphere.css", import.meta.url), "utf8");

interface Rule {
  selector: string;
  decls: Array<{ prop: string; value: string }>;
  children: Rule[];
}

const stripComments = (src: string): string => src.replace(/\/\*[\s\S]*?\*\//g, "");

function parse(src: string): Rule[] {
  const text = stripComments(src);
  let i = 0;
  const pushDecl = (decls: Rule["decls"], buf: string): void => {
    const at = buf.indexOf(":");
    if (at < 0) return;
    const prop = buf.slice(0, at).trim();
    const value = buf.slice(at + 1).trim();
    if (prop !== "") decls.push({ prop, value });
  };
  const body = (): { decls: Rule["decls"]; rules: Rule[] } => {
    const decls: Rule["decls"] = [];
    const rules: Rule[] = [];
    let buf = "";
    while (i < text.length) {
      const ch = text[i++]!;
      if (ch === "{") {
        const selector = buf.trim().replace(/\s+/g, " ");
        buf = "";
        const inner = body();
        rules.push({ selector, decls: inner.decls, children: inner.rules });
      } else if (ch === "}") {
        pushDecl(decls, buf);
        return { decls, rules };
      } else if (ch === ";") {
        pushDecl(decls, buf);
        buf = "";
      } else {
        buf += ch;
      }
    }
    pushDecl(decls, buf);
    return { decls, rules };
  };
  return body().rules;
}

const RULES = parse(RAW);
const CODE = stripComments(RAW);
const rule = (selector: string): Rule => {
  const r = RULES.find((x) => x.selector.split(",").some((s) => s.trim() === selector));
  if (!r) throw new Error(`규칙 ${selector} 없음`);
  return r;
};
const decl = (r: Rule, prop: string): string[] => r.decls.filter((d) => d.prop === prop).map((d) => d.value);

describe("atmosphere.css 공통 금지 (D-05·D-07, 04-35)", () => {
  it("주석을 뺀 코드에 # 색 값·backdrop-filter(접두 포함)·앰버·진홍 토큰이 없다", () => {
    expect(CODE).not.toMatch(/#[0-9a-fA-F]{3,8}/);
    expect(CODE).not.toContain("backdrop-filter");
    expect(CODE).not.toContain("--amber");
    expect(CODE).not.toContain("--crimson");
  });

  it("주석까지 포함한 파일 전체에도 # 색 값·backdrop-filter 와 모션 줄이기 분기 이름이 없다 (정적 게이트가 파일 전체를 센다)", () => {
    expect(RAW).not.toMatch(/#[0-9a-fA-F]{3,8}/);
    expect(RAW).not.toContain("backdrop-filter");
    expect(RAW).not.toContain("prefers-reduced-motion");
  });

  it("규칙의 선택자는 두 층(.mf-backdrop__vignette·.mf-morningglow) 것뿐이다 — 다른 요소를 건드리지 않는다", () => {
    const selectors = RULES.filter((r) => !r.selector.startsWith("@")).map((r) => r.selector);
    for (const s of selectors) expect(s.startsWith(".mf-backdrop__vignette") || s.startsWith(".mf-morningglow")).toBe(true);
  });
});

describe("밤 비네팅 .mf-backdrop__vignette (T-05-06)", () => {
  it("그림 층을 덮고(absolute·inset 0) 탭을 통과시키며 배경은 인라인 변수 하나다", () => {
    const r = rule(".mf-backdrop__vignette");
    expect(decl(r, "position")).toEqual(["absolute"]);
    expect(decl(r, "inset")).toEqual(["0"]);
    expect(decl(r, "pointer-events")).toEqual(["none"]);
    expect(decl(r, "background")).toEqual(["var(--mf-vignette)"]);
  });

  it("켜짐·꺼짐 애니메이션·전환을 따로 두지 않는다 (그림 층의 opacity 전환을 따른다)", () => {
    const r = rule(".mf-backdrop__vignette");
    expect(r.decls.some((d) => d.prop === "animation" || d.prop.startsWith("transition"))).toBe(false);
  });
});

describe("아침 밝아짐 .mf-morningglow (T-05-06, D-06)", () => {
  it("장면 상자를 덮고 DayTable 뒤(z-index -1)에서 탭을 통과시키며 배경은 인라인 변수 하나다", () => {
    const r = rule(".mf-morningglow");
    expect(decl(r, "position")).toEqual(["absolute"]);
    expect(decl(r, "inset")).toEqual(["0"]);
    expect(decl(r, "z-index")).toEqual(["-1"]);
    expect(decl(r, "pointer-events")).toEqual(["none"]);
    expect(decl(r, "background")).toEqual(["var(--mf-glow)"]);
  });

  it("퇴장: 300ms linear, 지연은 아침 카드와 같은 --mf-morning-exit-delay 변수, forwards", () => {
    const anim = decl(rule(".mf-morningglow"), "animation").join(" ");
    expect(anim).toMatch(/mf-morningglow-out 300ms linear var\(--mf-morning-exit-delay[^)]*\) forwards/);
  });

  it("상승(--rise): 길이는 --mf-glow-rise-ms 변수, 이징은 --ease-out, 퇴장 애니메이션도 함께 나열한다", () => {
    const anim = decl(rule(".mf-morningglow--rise"), "animation").join(" ");
    expect(anim).toMatch(/mf-morningglow-rise var\(--mf-glow-rise-ms[^)]*\) var\(--ease-out\) both/);
    expect(anim).toMatch(/mf-morningglow-out 300ms linear var\(--mf-morning-exit-delay/);
  });

  it("두 @keyframes 는 opacity 만 바꾼다", () => {
    const kfs = RULES.filter((r) => r.selector.startsWith("@keyframes "));
    expect(kfs.map((k) => k.selector).sort()).toEqual(["@keyframes mf-morningglow-out", "@keyframes mf-morningglow-rise"]);
    for (const k of kfs) {
      expect(k.children.length).toBeGreaterThan(0);
      for (const f of k.children) expect(f.decls.map((d) => d.prop)).toEqual(["opacity"]);
    }
  });
});
