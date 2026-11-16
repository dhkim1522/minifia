// 23-03: 서버 전용 키워드 모듈이 클라이언트 번들에 실리지 않게 하는 정적 가드(Pitfall 8, T-23-11)와 답 상수 시험(D-07).
// 주석을 지우고 본 import·export from·동적 import 만 잡는다. 23-01 의 번들 grep 과 이중 방어다.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { ANSWER_MAX_GRAPHEMES, ANSWER_MIN_GAP_MS } from "../../shared/game/answerRules";
import { stripComments } from "./chatStaticGuard.test";

const ROOT = fileURLToPath(new URL("../../", import.meta.url));

/** 클라이언트가 import 하면 안 되는 서버 전용 모듈. 정답 추론 재료(목록·판정·답 규칙)다. */
const SERVER_ONLY_MODULE = /shared\/game\/(keywords|keywordGuard|keywordAnswer)(\.[a-z]+)?$/;

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
    expect(keywordModuleImports("fake.ts", `export { violatesKeyword } from "../../shared/game/keywordGuard";`)).toHaveLength(1);
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
