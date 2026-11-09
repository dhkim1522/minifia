// 17-03: 튜토리얼 소스·CSS 의 정적 가드 (TUT-05, T-17-08·T-17-09, T-18, 결정 0080-13).
// 튜토리얼은 실제 게임 부품에 가짜 view 를 먹이는 화면이라 세 가지를 소스로 막는다:
//   ① 실제 연결·내 역할·저장된 닉네임을 읽지 않는다(누설·혼동), ② 문자열을 HTML 로 넣지 않는다(T-17-09), ③ 진홍은 T-18 연출 선택자에서만 쓴다.
// 금지 정규식은 이 파일 안에만 둔다. 대상은 파일 이름 규칙으로 찾으므로 뒤 계획이 만드는 화면·부품·감독 훅도 자동으로 걸린다.
// 소스는 주석을 뺀 코드로 본다(soundStaticGuard 와 같은 방식).
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const ROOT = fileURLToPath(new URL("../../", import.meta.url));

/** 문자열·템플릿 안의 // 는 남기고 주석만 지운다. 줄 수는 유지한다 (soundStaticGuard 의 것을 복사) */
function stripComments(src: string): string {
  let out = "";
  let i = 0;
  let quote: string | null = null;
  while (i < src.length) {
    const c = src[i]!;
    const next = src[i + 1];
    if (quote !== null) {
      out += c;
      if (c === "\\") {
        out += next ?? "";
        i += 2;
        continue;
      }
      if (c === quote || (c === "\n" && quote !== "`")) quote = null;
      i += 1;
      continue;
    }
    if (c === "/" && next === "/") {
      while (i < src.length && src[i] !== "\n") i += 1;
      continue;
    }
    if (c === "/" && next === "*") {
      i += 2;
      while (i < src.length && !(src[i] === "*" && src[i + 1] === "/")) {
        if (src[i] === "\n") out += "\n";
        i += 1;
      }
      i += 2;
      continue;
    }
    if (c === '"' || c === "'" || c === "`") quote = c;
    out += c;
    i += 1;
  }
  return out;
}

/** 튜토리얼 소스에서 금지하는 것 — 주석을 뺀 코드에 쓰이면 위반 */
const FORBIDDEN: readonly { label: string; re: RegExp }[] = [
  { label: "실제 연결 훅", re: /\b(useRoomConnection|useDayFx)\b/ },
  { label: "내 역할 읽기", re: /\bme\s*\??\.\s*role\b/ },
  { label: "동료 목록", re: /\b(allies|allyPicks)\b/ },
  { label: "플레이어 항목의 역할", re: /\bplayers\s*(?:\??\.\s*\w+\((?:[^()]|\([^()]*\))*\)|\??\[[^\]]*\])\s*\??\.\s*role\b/ },
  { label: "콜백 인자의 역할", re: /\b(?:p|pl|player)\s*\??\.\s*role\b/ },
  { label: "저장된 닉네임 읽기", re: /\b(loadLastNickname|saveLastNickname|NICKNAME_KEY|lastNickname)\b|minifia:lastNickname/ },
  { label: "innerHTML 계열", re: /\b(innerHTML|outerHTML|insertAdjacentHTML|dangerouslySetInnerHTML)\b|\bdocument\s*\.\s*write\b/ },
  { label: "fetch·WebSocket", re: /\bfetch\s*\(|\bnew\s+(WebSocket|EventSource)\b|\bWebSocket\s*\(/ },
];

function violationsOf(src: string): string[] {
  const code = stripComments(src);
  return FORBIDDEN.filter((f) => f.re.test(code)).map((f) => f.label);
}

/** 가드 대상 소스: 대본 + (있으면) 화면·감독 훅 + 컴포넌트 폴더에서 이름이 Tutorial·FocusRing·OpeningFx 로 시작하는 .tsx */
function tutorialSources(): string[] {
  const out = [`${ROOT}src/game/tutorialScript.ts`];
  for (const rel of ["src/screens/TutorialScreen.tsx", "src/net/useTutorialDirector.ts"]) {
    if (existsSync(`${ROOT}${rel}`)) out.push(`${ROOT}${rel}`);
  }
  const dir = `${ROOT}src/components/v2`;
  for (const name of readdirSync(dir).sort()) {
    if (/^(Tutorial|FocusRing|OpeningFx).*\.tsx$/.test(name)) out.push(`${dir}/${name}`);
  }
  return out;
}

/** 튜토리얼 CSS: src/styles 에서 이름이 tutorial 로 시작하는 .css (없으면 빈 목록) */
function tutorialStyles(): string[] {
  const dir = `${ROOT}src/styles`;
  return readdirSync(dir)
    .filter((n) => /^tutorial.*\.css$/.test(n))
    .sort()
    .map((n) => `${dir}/${n}`);
}

/** 진홍을 써도 되는 선택자 앞부분(T-18 연출) */
const CRIMSON_OK_SELECTOR = /^\.tut-(opening|reveal|role)/;
/** 진홍을 써도 되는 키프레임 이름 */
const CRIMSON_OK_KEYFRAMES = /^@keyframes\s+tut-(opening|reveal|role)/;

/**
 * `--crimson-` 을 쓰는 규칙 가운데 허용 선택자·키프레임 밖에 있는 것의 선택자(또는 키프레임 이름)들.
 * 중괄호를 세는 작은 파서라 @media 안의 규칙도, @keyframes 안의 단계도 본다.
 */
function crimsonViolations(css: string): string[] {
  const code = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const stack: string[] = [];
  const bad: string[] = [];
  let buf = "";
  for (const ch of code) {
    if (ch === "{") {
      stack.push(buf.trim());
      buf = "";
    } else if (ch === "}") {
      const prelude = stack.pop() ?? "";
      if (buf.includes("--crimson-") || /var\(\s*--crimson-/.test(buf)) {
        const keyframes = stack.find((p) => p.startsWith("@keyframes"));
        if (keyframes !== undefined) {
          if (!CRIMSON_OK_KEYFRAMES.test(keyframes)) bad.push(keyframes);
        } else {
          for (const sel of prelude.split(",").map((s) => s.trim())) {
            if (!CRIMSON_OK_SELECTOR.test(sel)) bad.push(sel);
          }
        }
      }
      buf = "";
    } else {
      buf += ch;
    }
  }
  return bad;
}

describe("정적 가드 자기 시험 — 일부러 만든 위반 표본을 각 규칙이 잡는다", () => {
  const SAMPLES: readonly [string, string][] = [
    ["실제 연결 훅", 'import { useRoomConnection } from "../net/useRoomConnection";'],
    ["내 역할 읽기", "const r = view.me.role;"],
    ["동료 목록", "const a = view.me.allies;"],
    ["플레이어 항목의 역할", "const r = view.players[2].role;"],
    ["플레이어 항목의 역할", "const r = view.players.find((x) => x.seat === 1)?.role;"],
    ["콜백 인자의 역할", "const rs = view.players.map((p) => p.role);"],
    ["저장된 닉네임 읽기", "const n = loadLastNickname();"],
    ["저장된 닉네임 읽기", 'const k = "minifia:lastNickname";'],
    ["innerHTML 계열", "el.innerHTML = name;"],
    ["innerHTML 계열", "<div dangerouslySetInnerHTML={{ __html: name }} />"],
    ["fetch·WebSocket", 'await fetch("/api/rooms");'],
    ["fetch·WebSocket", 'const ws = new WebSocket("wss://x");'],
  ];

  it.each(SAMPLES)("%s: %s", (label, sample) => {
    expect(violationsOf(sample)).toContain(label);
  });

  it("주석 안의 낱말은 허용하고 깨끗한 코드는 위반이 없다", () => {
    expect(violationsOf("// me.role 과 innerHTML 은 쓰지 않는다\n/* fetch(url) */\nexport const a = 1;")).toEqual([]);
    expect(violationsOf('const cast = { seat: 1, name: "도윤", look: "noir" };\nreturn <span>{cast.name}</span>;')).toEqual([]);
    expect(violationsOf("const me = { seat: 5, isHost: false };")).toEqual([]);
  });

  it("진홍: 허용 선택자·키프레임 밖의 사용은 잡고 안의 사용은 통과시킨다", () => {
    expect(crimsonViolations(".tut-card { border-color: var(--crimson-500); }")).toEqual([".tut-card"]);
    expect(crimsonViolations(".tut-reveal__card { box-shadow: 0 0 8px var(--crimson-500); }")).toEqual([]);
    expect(crimsonViolations(".tut-opening { color: var(--crimson-300); } .tut-role--mafia { color: var(--crimson-300); }")).toEqual([]);
    expect(crimsonViolations(".a, .tut-role { color: var(--crimson-500); }")).toEqual([".a"]);
    expect(crimsonViolations("@media (prefers-reduced-motion: reduce) { .tut-opening { color: var(--crimson-500); } }")).toEqual([]);
    expect(crimsonViolations("@media (prefers-reduced-motion: reduce) { .tut-ring { color: var(--crimson-500); } }")).toEqual([".tut-ring"]);
    expect(crimsonViolations("@keyframes tut-reveal-glow { 0% { color: var(--crimson-300); } }")).toEqual([]);
    expect(crimsonViolations("@keyframes tut-ring { 0% { border-color: var(--crimson-300); } }")).toEqual(["@keyframes tut-ring"]);
    expect(crimsonViolations("/* var(--crimson-500) */ .tut-card { color: red; }")).toEqual([]);
    expect(crimsonViolations(":root { --tut-flash: var(--crimson-500); }")).toEqual([":root"]);
  });
});

describe("튜토리얼 소스는 연결·역할·저장된 닉네임·HTML 주입을 쓰지 않는다 (TUT-05, T-17-08, T-17-09)", () => {
  const files = tutorialSources();

  it("대본 파일을 하나 이상 찾는다 (경로 오타로 거짓 통과 방지)", () => {
    expect(files.length).toBeGreaterThanOrEqual(1);
    expect(files.some((f) => f.endsWith("src/game/tutorialScript.ts"))).toBe(true);
  });

  it.each(files.map((f) => [f.slice(ROOT.length), f] as const))("%s: 금지 항목 위반 0", (_rel, full) => {
    expect(violationsOf(readFileSync(full, "utf8"))).toEqual([]);
  });
});

describe("튜토리얼 CSS 의 진홍은 T-18 연출 선택자에서만 쓴다 (T-18, 0080-13)", () => {
  const styles = tutorialStyles();

  it("CSS 파일이 없으면 빈 목록으로 통과하고, 있으면 모두 읽힌다", () => {
    for (const f of styles) expect(readFileSync(f, "utf8").length).toBeGreaterThan(0);
  });

  it.each(styles.map((f) => [f.slice(ROOT.length), f] as const))("%s: 진홍 사용처는 .tut-opening·.tut-reveal·.tut-role 뿐", (_rel, full) => {
    expect(crimsonViolations(readFileSync(full, "utf8"))).toEqual([]);
  });
});
