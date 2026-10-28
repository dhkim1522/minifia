// 4페이즈 새 CSS(verdict.css·result.css)의 정적 게이트 (04-28, UI-SPEC 4·5·6·12, D-33).
// 글자 크기·색·층·모션·터치 통과 계약이 값으로 회귀하지 않게 CSS 원문을 읽어 규칙 단위로 단언한다.
// vitest 는 CSS 를 비워 주므로 `?raw` 대신 readFileSync 로 읽는다(01-17 선례). 레이아웃(겹침)은 단위 시험이 못 재므로 E2E(04-29~)가 본다.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const css = (name: string): string => readFileSync(new URL(`../../src/styles/${name}.css`, import.meta.url), "utf8");

// ---- 얇은 CSS 규칙 파서: 주석을 지우고 중괄호 깊이로 규칙·선언·자식 규칙(@media·@keyframes)을 나눈다 ----
interface Rule {
  selector: string;
  decls: Array<{ prop: string; value: string }>;
  children: Rule[];
}

function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "");
}

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

interface FlatRule extends Rule {
  /** 이 규칙을 감싼 @ 규칙(바깥 → 안) */
  within: string[];
}

function flatten(rules: Rule[], within: string[] = []): FlatRule[] {
  const out: FlatRule[] = [];
  for (const r of rules) {
    out.push({ ...r, within });
    if (r.children.length > 0) out.push(...flatten(r.children, r.selector.startsWith("@") ? [...within, r.selector] : within));
  }
  return out;
}

const FILES = { verdict: css("verdict"), result: css("result") } as const;
const PARSED = { verdict: flatten(parse(FILES.verdict)), result: flatten(parse(FILES.result)) } as const;
const BOTH = ["verdict", "result"] as const;

/** 선택자 목록(쉼표)에 이 선택자가 그대로 들어 있는가 */
const hasSelector = (rule: Rule, selector: string): boolean => rule.selector.split(",").some((s) => s.trim() === selector);
const declsOf = (rule: Rule, prop: string): string[] => rule.decls.filter((d) => d.prop === prop).map((d) => d.value);
const keyframes = (rules: FlatRule[]): FlatRule[] => rules.filter((r) => r.selector.startsWith("@keyframes "));
/** @keyframes 안쪽의 프레임 규칙 */
const frames = (rules: FlatRule[]): FlatRule[] => rules.filter((r) => r.within.some((w) => w.startsWith("@keyframes ")));
/** 일반 규칙: @keyframes 의 프레임이 아니고 @ 규칙 머리도 아닌 것 */
const styleRules = (rules: FlatRule[]): FlatRule[] => rules.filter((r) => !r.selector.startsWith("@") && !r.within.some((w) => w.startsWith("@keyframes ")));

const tokens = css("tokens");
const tokenPx = (name: string): number => {
  const m = new RegExp(`--${name}:\\s*(\\d+)px`).exec(tokens);
  if (!m) throw new Error(`토큰 --${name} 를 tokens.css 에서 찾지 못함`);
  return Number(m[1]);
};

describe("CSS 파서 점검(시험이 읽을 수 있는 모양인가)", () => {
  it("주석을 지우고, 중첩 @media·@keyframes 를 자식 규칙으로 나눈다", () => {
    const rules = flatten(parse(`/* a { x: 1 } */ .a, .b { color: red; z-index: 3 } @media (x) { .c { top: 1px } } @keyframes k { from { opacity: 0 } 50%, 100% { opacity: 1; scale: 2 } }`));
    expect(rules.map((r) => r.selector)).toEqual([".a, .b", "@media (x)", ".c", "@keyframes k", "from", "50%, 100%"]);
    expect(rules[2]!.within).toEqual(["@media (x)"]);
    expect(frames(rules).map((r) => r.selector)).toEqual(["from", "50%, 100%"]);
    expect(declsOf(rules[0]!, "z-index")).toEqual(["3"]);
  });

  it("두 파일에서 규칙·선언·키프레임이 충분히 읽힌다(파서가 비어 있어 모든 단언이 공허하게 통과하는 일이 없다)", () => {
    expect(styleRules(PARSED.verdict).length).toBeGreaterThan(60);
    expect(styleRules(PARSED.result).length).toBeGreaterThan(30);
    expect(keyframes(PARSED.verdict).length).toBeGreaterThanOrEqual(15);
    expect(keyframes(PARSED.result).length).toBeGreaterThanOrEqual(3);
    for (const f of BOTH) expect(PARSED[f].flatMap((r) => r.decls).length, f).toBeGreaterThan(100);
  });
});

describe.each(BOTH)("%s.css — 글자 (UI-SPEC 5: 크기 14·16·24·36, 굵기 400·700)", (file) => {
  const decls = styleRules(PARSED[file]).flatMap((r) => r.decls.map((d) => ({ ...d, selector: r.selector })));

  it("모든 font-size 가 14px·16px·24px·36px 이다(inherit 허용)", () => {
    const sizes = decls.filter((d) => d.prop === "font-size");
    expect(sizes.length, "font-size 선언이 읽힘").toBeGreaterThan(0);
    const bad = sizes.filter((d) => !["14px", "16px", "24px", "36px", "inherit"].includes(d.value)).map((d) => `${d.selector} → ${d.value}`);
    expect(bad.join(" | ")).toBe("");
  });

  it("font-weight 는 400·700 뿐이고 font 줄임 표기는 쓰지 않는다", () => {
    const bad = decls
      .filter((d) => d.prop === "font-weight" && !["400", "700", "inherit"].includes(d.value))
      .map((d) => `${d.selector} → ${d.value}`);
    expect(bad.join(" | ")).toBe("");
    expect(decls.filter((d) => d.prop === "font").map((d) => d.selector).join(" | ")).toBe("");
  });
});

describe.each(BOTH)("%s.css — 색 (UI-SPEC 6: 토큰만)", (file) => {
  const decls = styleRules(PARSED[file]).flatMap((r) => r.decls.map((d) => ({ ...d, selector: r.selector })));
  // 키프레임 안 선언의 색도 검사한다
  const allDecls = PARSED[file].flatMap((r) => r.decls.map((d) => ({ ...d, selector: r.selector })));

  it("직접 색 값(# 16진수, rgb·rgba·hsl·hsla 함수, white·black)이 없다", () => {
    const bad = allDecls
      .filter((d) => /#[0-9a-fA-F]{3,8}\b|\b(?:rgb|rgba|hsl|hsla|hwb|lab|lch|oklab|oklch)\(|(?:^|[\s(,])(?:white|black)(?=[\s),;]|$)/.test(d.value))
      .map((d) => `${d.selector} { ${d.prop}: ${d.value} }`);
    expect(bad.join(" | ")).toBe("");
  });

  it("색 섞기는 color-mix(in srgb, var(--토큰) N%, transparent 또는 var(--토큰)) 모양뿐이다", () => {
    const mixes = allDecls.flatMap((d) => [...d.value.matchAll(/color-mix\(([^()]*(?:\([^()]*\)[^()]*)*)\)/g)].map((m) => ({ ...d, mix: m[1]! })));
    const shape = /^in srgb, var\(--[\w-]+\) (?:[\d.]+%|var\(--[\w-]+\)), (?:transparent|var\(--[\w-]+\))$/;
    const bad = mixes.filter((m) => !shape.test(m.mix.trim())).map((m) => `${m.selector} { ${m.prop}: color-mix(${m.mix}) }`);
    expect(bad.join(" | ")).toBe("");
    if (file === "verdict") expect(mixes.length, "color-mix 가 읽힘").toBeGreaterThan(10);
    void decls;
  });
});

describe("진홍 예약 (D-33, UI-SPEC 6.1)", () => {
  const crimsonRules = (file: (typeof BOTH)[number]) =>
    PARSED[file].filter((r) => r.decls.some((d) => /crimson/.test(d.value)));

  it("verdict.css 에는 진홍 토큰 참조가 없다(투표·변론·처형 요소는 진홍을 쓰지 않는다)", () => {
    expect(crimsonRules("verdict").map((r) => r.selector).join(" | ")).toBe("");
    expect(/crimson/.test(stripComments(FILES.verdict))).toBe(false);
  });

  it("result.css 의 진홍은 승리 배너(띠·제목)·위쪽 번짐·`마피아` 직업 글자 규칙에만 있다", () => {
    const rules = crimsonRules("result");
    expect(rules.length, "진홍 규칙이 읽힘").toBeGreaterThanOrEqual(4);
    const allowed = /mf-result__(?:glow|band|banner-title|role--mafia)\b/;
    const bad = rules.filter((r) => !allowed.test(r.selector)).map((r) => r.selector);
    expect(bad.join(" | ")).toBe("");
    // 배너 규칙은 마피아 승일 때만 진홍이다
    for (const r of rules.filter((x) => /mf-result__(?:band|banner-title)\b/.test(x.selector))) {
      expect(r.selector, "배너의 진홍은 data-winner=mafiaWin 아래").toContain('[data-winner="mafiaWin"]');
    }
  });
});

describe.each(BOTH)("%s.css — 층 (UI-SPEC 12: z-index)", (file) => {
  // UI-SPEC 12 의 값: 헤더·패널 3, 어둡게·원뿔 30, 후보 좌석 31, 후보 이름표 32, 화살표 40, 칩 46, 카드 70.
  const ALLOWED = new Set([3, 30, 31, 32, 40, 46, 70]);
  // 좌석 한 칸 안에서 사람 층과 유령 층의 겹침 순서(1)는 장면 층이 아니다. 이 규칙 하나만 예외다.
  const LOCAL_EXCEPTION = ".mf-figure--exec-out";
  const withZ = styleRules(PARSED[file]).flatMap((r) => declsOf(r, "z-index").map((v) => ({ selector: r.selector, value: v })));

  it("z-index 값이 UI-SPEC 12 의 값 안이다", () => {
    const bad = withZ.filter((z) => !(ALLOWED.has(Number(z.value)) || (z.selector === LOCAL_EXCEPTION && z.value === "1"))).map((z) => `${z.selector} → ${z.value}`);
    expect(bad.join(" | ")).toBe("");
  });

  it("z-index 예외는 좌석 안 사람/유령 층 하나뿐이다", () => {
    const exceptions = withZ.filter((z) => !ALLOWED.has(Number(z.value)));
    expect(exceptions.map((z) => z.selector)).toEqual(file === "verdict" ? [LOCAL_EXCEPTION] : []);
  });
});

describe("층 배치 (UI-SPEC 12.1·12.2)", () => {
  const rules = styleRules(PARSED.verdict);
  const zOf = (selector: string): string[] => rules.filter((r) => hasSelector(r, selector)).flatMap((r) => declsOf(r, "z-index"));

  it(".mf-dayscene--verdict 규칙이 헤더 래퍼와 하단 패널에 position: relative + z-index 3 을 준다", () => {
    for (const selector of [".mf-dayscene--verdict > .mf-dayscene__enter:first-child", ".mf-dayscene--verdict > .mf-dayscene__panel"]) {
      const rule = rules.find((r) => hasSelector(r, selector));
      expect(rule, selector).toBeDefined();
      expect(declsOf(rule!, "z-index"), `${selector} z-index`).toEqual(["3"]);
      expect(declsOf(rule!, "position"), `${selector} position`).toEqual(["relative"]);
    }
  });

  it("화살표 40 · 원뿔 30 · 카드 70", () => {
    expect(zOf(".mf-varrow")).toEqual(["40"]);
    expect(zOf(".mf-dt__cone")).toEqual(["30"]);
    expect(zOf(".mf-vintro")).toEqual(["70"]);
  });

  it("어둡게 층 30 은 daytable.css 의 기본 규칙에서 오고 verdict 변형은 그 층을 쓴다", () => {
    const dim = styleRules(flatten(parse(css("daytable")))).find((r) => hasSelector(r, ".mf-dt__dim"));
    expect(dim && declsOf(dim, "z-index")).toEqual(["30"]);
  });
});

describe.each(BOTH)("%s.css — 모션 (UI-SPEC 13)", (file) => {
  const rules = PARSED[file];

  it("@keyframes 에서 움직이는 속성은 opacity·transform·scale·translate·rotate·filter 뿐이다(위치·크기 속성 애니메이션 없음)", () => {
    const ok = new Set(["opacity", "transform", "scale", "translate", "rotate", "filter", "animation-timing-function"]);
    const kfs = keyframes(rules);
    if (file === "verdict") expect(kfs.length).toBeGreaterThanOrEqual(15);
    const bad = frames(rules).flatMap((f) => f.decls.filter((d) => !ok.has(d.prop)).map((d) => `${f.within.join(" ")} ${f.selector} → ${d.prop}`));
    expect(bad.join(" | ")).toBe("");
  });

  it("@media (prefers-reduced-motion: reduce) 분기가 있다", () => {
    const reduced = rules.filter((r) => /^@media\s*\(\s*prefers-reduced-motion:\s*reduce\s*\)$/.test(r.selector));
    expect(reduced.length, "모션 줄이기 분기").toBeGreaterThanOrEqual(1);
    expect(reduced.flatMap((r) => r.children).length, "분기 안 규칙").toBeGreaterThan(0);
  });

  it("transition: all 이 없다", () => {
    const bad = styleRules(rules)
      .filter((r) => r.decls.some((d) => (d.prop === "transition" || d.prop === "transition-property") && /(^|[\s,])all([\s,]|$)/.test(d.value)))
      .map((r) => r.selector);
    expect(bad.join(" | ")).toBe("");
  });
});

describe("모션 줄이기 짝 (UI-SPEC 13.4)", () => {
  it("result.css 는 연출 애니메이션과 전이를 모션 줄이기 분기에서 끈다", () => {
    const branch = PARSED.result.filter((r) => /prefers-reduced-motion/.test(r.selector)).flatMap((r) => r.children);
    const off = branch.filter((r) => r.decls.some((d) => d.prop === "animation" && d.value === "none"));
    const joined = off.map((r) => r.selector).join(" ");
    for (const part of ["mf-result__banner", "mf-result__glow", "mf-result__card", "mf-result__rise"]) expect(joined, part).toContain(part);
    expect(branch.some((r) => r.decls.some((d) => d.prop === "transition" && d.value === "none"))).toBe(true);
  });

  it("-webkit-backdrop-filter 는 같은 규칙의 backdrop-filter 와 짝이다", () => {
    for (const file of BOTH) {
      const hit = styleRules(PARSED[file]).filter((r) => r.decls.some((d) => /backdrop-filter$/.test(d.prop)));
      if (file === "verdict") expect(hit.length, "backdrop-filter 규칙").toBeGreaterThanOrEqual(1);
      for (const r of hit) {
        expect(declsOf(r, "backdrop-filter"), `${r.selector} backdrop-filter`).toHaveLength(1);
        expect(declsOf(r, "-webkit-backdrop-filter"), `${r.selector} -webkit-backdrop-filter`).toEqual(declsOf(r, "backdrop-filter"));
      }
    }
  });
});

describe("터치 통과 (T-04-62: 연출 층은 입력을 가로채지 않는다)", () => {
  const noneIn = (file: string, selector: string): boolean =>
    styleRules(flatten(parse(css(file)))).some((r) => r.selector.split(",").some((s) => s.trim() === selector) && declsOf(r, "pointer-events").includes("none"));

  // [선택자, 어느 파일들에서 찾는가]: 변형 클래스는 기본 클래스가 이미 터치를 통과시키면 그 규칙을 상속한다
  const layers: Array<[string, string[]]> = [
    [".mf-vintro", ["verdict"]],
    [".mf-vintro *", ["verdict"]],
    [".mf-vchip", ["verdict"]],
    [".mf-varrow", ["verdict"]],
    [".mf-dt__cone", ["verdict"]],
    [".mf-dt__dim--verdict", ["verdict", "daytable"]], // 기본 .mf-dt__dim (daytable.css)
    [".mf-morningcard--amber", ["verdict", "night"]], // 기본 .mf-morningcard (night.css)
    [".mf-morningcard--scene", ["verdict", "night"]],
  ];

  it.each(layers)("%s 은(는) pointer-events: none", (selector, files) => {
    // 변형은 기본 클래스(.mf-dt__dim, .mf-morningcard)에서 상속하므로 기본 선택자도 인정한다
    const base = selector.replace(/--\w+$/, "");
    const ok = files.some((f) => noneIn(f, selector) || noneIn(f, base));
    expect(ok, `${selector} 가 ${files.join("·")} 에서 pointer-events: none 을 받음`).toBe(true);
  });

  it("공개 칩·화살표·인트로 카드는 verdict.css 자체 규칙으로 막는다(상속에 기대지 않음)", () => {
    for (const selector of [".mf-vintro", ".mf-vchip", ".mf-varrow", ".mf-dt__cone"]) expect(noneIn("verdict", selector), selector).toBe(true);
  });
});

describe("탭 대상 (UI-SPEC 4: 투표 버튼·변론 칩 높이 --tap-min 44 이상)", () => {
  const verdictRules = styleRules(PARSED.verdict);
  const px = (value: string): number | null => {
    const v = /^var\(--tap-min\)$/.test(value.trim()) ? tokenPx("tap-min") : (/^(\d+(?:\.\d+)?)px$/.exec(value.trim())?.[1] ?? null);
    return v === null ? null : Number(v);
  };

  it("--tap-min 은 44px 이다", () => {
    expect(tokenPx("tap-min")).toBe(44);
  });

  it("기본 알약 버튼(.mf-seg__b, 찬성·반대·변론 칩이 쓰는 모양)의 높이는 --tap-min 이다", () => {
    const rule = styleRules(flatten(parse(css("day")))).find((r) => hasSelector(r, ".mf-seg__b"));
    expect(rule, ".mf-seg__b 규칙").toBeDefined();
    const h = declsOf(rule!, "height").concat(declsOf(rule!, "min-height")).map(px);
    expect(h.some((v) => v !== null && v >= 44), `.mf-seg__b 높이 ${h.join(",")}`).toBe(true);
  });

  it("verdict.css 의 찬성·반대·변론 칩 규칙은 높이를 44 아래로 줄이지 않는다", () => {
    const rules = verdictRules.filter((r) => /mf-execvote__seg|mf-defchips__b|mf-seg__b/.test(r.selector));
    expect(rules.length, "해당 규칙이 읽힘").toBeGreaterThanOrEqual(2);
    const bad = rules
      .flatMap((r) => r.decls.filter((d) => ["height", "min-height", "max-height"].includes(d.prop)).map((d) => ({ selector: r.selector, ...d })))
      .filter((d) => d.prop === "max-height" || (px(d.value) ?? 0) < 44)
      .map((d) => `${d.selector} { ${d.prop}: ${d.value} }`);
    expect(bad.join(" | ")).toBe("");
  });
});
