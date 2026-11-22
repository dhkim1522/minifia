// 23-03: 서버 전용 키워드 모듈이 클라이언트 번들에 실리지 않게 하는 정적 가드(Pitfall 8, T-23-11)와 답 상수 시험(D-07).
// 주석을 지우고 본 import·export from·동적 import 만 잡는다. 23-01 의 번들 grep 과 이중 방어다.
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { ANSWER_MAX_GRAPHEMES, ANSWER_MIN_GAP_MS } from "../../shared/game/answerRules";
import { stripComments } from "./chatStaticGuard.test";

const ROOT = fileURLToPath(new URL("../../", import.meta.url));

/** 클라이언트가 import 하면 안 되는 서버 전용 모듈. 키워드 목록과 비공개 제출 규칙을 담는다. */
const SERVER_ONLY_MODULE = /shared[\\/]game[\\/](keywords|keywordAnswer)(\.[a-z]+)?$/;

/** 주석을 지운 본문에서 서버 전용 키워드 모듈을 가리키는 import·export from·동적 import 의 지정자를 모은다. */
export function keywordModuleImports(path: string, src: string): string[] {
  const code = stripComments(src);
  const hits: string[] = [];
  // import ... from "x" / export ... from "x" / import "x" / import("x") / require("x") 의 지정자 문자열
  const re = /(?:\bfrom\s*|\bimport\s*\(?\s*|\brequire\s*\(\s*)(["'`])([^"'`\n]+)\1/g;
  for (const m of code.matchAll(re)) {
    if (SERVER_ONLY_MODULE.test(m[2]!)) hits.push(`${path}: ${m[2]}`);
  }
  return hits;
}

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = `${dir}/${name}`;
    if (statSync(full).isDirectory()) out.push(...sourceFiles(full));
    else if (/\.tsx?$/.test(name)) out.push(full);
  }
  return out;
}

describe("답 상수(D-07)", () => {
  it("ANSWER_MAX_GRAPHEMES 는 20, ANSWER_MIN_GAP_MS 는 400 이다", () => {
    expect(ANSWER_MAX_GRAPHEMES).toBe(20);
    expect(ANSWER_MIN_GAP_MS).toBe(400);
  });

  it("answerRules.ts 는 import 가 없다(클라이언트가 가볍게 import 한다)", () => {
    const code = stripComments(readFileSync(`${ROOT}shared/game/answerRules.ts`, "utf8"));
    expect(code).not.toMatch(/^\s*import\b/m);
  });
});

describe("src 는 서버 전용 키워드 모듈을 import 하지 않는다(Pitfall 8)", () => {
  it("가드 자기 검사: 가짜 import 본문은 위반 1건을 낸다", () => {
    expect(keywordModuleImports("fake.ts", `import { GENRES } from '../../shared/game/keywords';`)).toHaveLength(1);
    expect(keywordModuleImports("fake.ts", `export { violatesKeyword } from "../../shared/game/keywordGuard";`)).toHaveLength(0);
    expect(keywordModuleImports("fake.ts", `const m = await import("../../shared/game/keywordAnswer");`)).toHaveLength(1);
  });

  it("가드 자기 검사: 주석 안 언급과 무관한 import 는 위반이 아니다", () => {
    expect(keywordModuleImports("fake.ts", `// import { GENRES } from "../../shared/game/keywords";`)).toHaveLength(0);
    expect(keywordModuleImports("fake.ts", `import { ANSWER_MAX_GRAPHEMES } from "../../shared/game/answerRules";`)).toHaveLength(0);
    expect(keywordModuleImports("fake.ts", `import { x } from "../../shared/game/keywordsHelper";`)).toHaveLength(0);
  });

  it("src/ 아래 .ts·.tsx 어디에도 서버 전용 키워드 모듈 import 가 없다", () => {
    const files = sourceFiles(`${ROOT}src`);
    expect(files.length).toBeGreaterThan(0);
    const hits = files.flatMap((f) => keywordModuleImports(f.slice(ROOT.length), readFileSync(f, "utf8")));
    expect(hits).toEqual([]);
  });
});

/** 값 import 지정자(import type 은 번들에 실리지 않으므로 뺀다)를 모은다. import·export from·import "x"·import("x") 를 본다. */
export function valueImportSpecifiers(src: string): string[] {
  const code = stripComments(src);
  const specs: string[] = [];
  const stmt = /\b(?:import|export)\s+(type\s+)?(?:[^"'`;]*?\s+from\s*)?(["'])([^"'\n]+)\2/g;
  for (const m of code.matchAll(stmt)) if (m[1] === undefined) specs.push(m[3]!);
  for (const m of code.matchAll(/\bimport\s*\(\s*(["'])([^"'\n]+)\1\s*\)/g)) specs.push(m[2]!);
  return specs;
}

function resolveRelative(from: string, spec: string): string | null {
  if (!spec.startsWith(".")) return null;
  const base = resolve(dirname(from), spec);
  for (const cand of [`${base}.ts`, `${base}.tsx`, `${base}/index.ts`, `${base}/index.tsx`]) if (existsSync(cand)) return cand;
  return null;
}

/** 시작 파일들에서 값 import 로 닿는 모든 파일(시작 파일 포함)을 {파일: 처음 닿은 부모} 로 돌려준다. */
export function reachableFrom(entries: readonly string[], read: (file: string) => string = (f) => readFileSync(f, "utf8")): Map<string, string> {
  const seen = new Map<string, string>();
  const queue = [...entries];
  for (const e of entries) seen.set(e, "");
  while (queue.length > 0) {
    const file = queue.pop()!;
    for (const spec of valueImportSpecifiers(read(file))) {
      const next = resolveRelative(file, spec);
      if (next === null || seen.has(next)) continue;
      seen.set(next, file);
      queue.push(next);
    }
  }
  return seen;
}

describe("클라이언트에서 닿는 모든 모듈은 서버 전용 키워드 모듈을 가져오지 않는다(WR-03, 전이 가드)", () => {
  it("가드 자기 검사: import type 은 건너뛰고 값 import·동적 import 는 센다", () => {
    expect(valueImportSpecifiers(`import type { A } from "./a";\nimport { b } from "./b";\nexport { c } from "./c";\nconst d = await import("./d");\nimport "./e";`)).toEqual([
      "./b",
      "./c",
      "./e",
      "./d",
    ]);
  });

  it("가드 자기 검사: 전이 경로(entry → mid → keywords)를 잡는다", () => {
    const entry = resolve(ROOT, "shared/game/__fakeEntry.ts");
    const files: Record<string, string> = {
      [entry]: `import { x } from "./room";`,
      [resolve(ROOT, "shared/game/room.ts")]: `import { GENRES } from "./keywords";`,
      [resolve(ROOT, "shared/game/keywords.ts")]: ``,
    };
    const hit = reachableFrom([entry], (f) => files[f] ?? readFileSync(f, "utf8"));
    expect([...hit.keys()].some((f) => SERVER_ONLY_MODULE.test(f))).toBe(true);
  });

  it("src/ 의 모든 파일에서 값 import 로 닿는 shared·src 모듈에 keywords·keywordAnswer 가 없다", () => {
    const entries = sourceFiles(`${ROOT}src`);
    const reached = reachableFrom(entries);
    expect(reached.size).toBeGreaterThan(entries.length); // shared 까지 따라갔다
    const hits = [...reached.entries()]
      .filter(([f]) => SERVER_ONLY_MODULE.test(f))
      .map(([f, parent]) => `${f.slice(ROOT.length)} <- ${parent.slice(ROOT.length)}`);
    expect(hits).toEqual([]);
  });
});

describe("빌드 산출물(있을 때만)에 키워드 목록이 없다(WR-03)", () => {
  const assets = `${ROOT}dist/client/assets`;
  it.skipIf(!existsSync(assets))("dist/client/assets 의 JS 에 표본 단어·별칭이 없다", () => {
    const samples = ["Harry Potter", "해리포터", "렛잇고", "keywordProbed"];
    const hits: string[] = [];
    for (const name of readdirSync(assets)) {
      if (!name.endsWith(".js")) continue;
      const body = readFileSync(`${assets}/${name}`, "utf8");
      for (const sample of samples) if (body.includes(sample)) hits.push(`${name}: ${sample}`);
    }
    expect(hits).toEqual([]);
  });
});
