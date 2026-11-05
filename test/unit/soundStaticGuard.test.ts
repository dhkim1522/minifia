// 12-02: 소리 모듈의 정적 가드 (LS-6, T-12-04).
// LS-6 — 소리는 숨은 정보를 읽지 못한다: src/audio/** 의 import 는 허용 목록 안에서만, 숨은 필드 이름은 금지.
// 주석을 뺀 소스를 문자열로 검사한다. 디렉터리를 훑으므로 새 파일(엔진·감독)에도 자동으로 걸린다.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const ROOT = fileURLToPath(new URL("../../", import.meta.url));
const AUDIO_DIR = `${ROOT}src/audio`;

/** import 경로 허용 목록. typeOnly 는 `import type` 만 허용한다 */
const ALLOWED_IMPORTS: readonly { spec: RegExp; typeOnly?: boolean }[] = [
  { spec: /^\.\/[A-Za-z][\w-]*$/ }, // 자기 폴더
  { spec: /^react$/ },
  { spec: /^\.\.\/\.\.\/shared\/protocol$/, typeOnly: true },
  { spec: /^\.\.\/\.\.\/shared\/game\/phases$/ },
  { spec: /^\.\.\/game\/(dayView|verdictMoment|willLetter)$/ },
];

/** 숨은 필드·연결·스토어 이름 — 소리 코드에 나오면 소리가 정보를 나를 수 있다 */
const FORBIDDEN_PATTERNS: readonly { label: string; re: RegExp }[] = [
  { label: "me.role", re: /\bme\.role\b/ },
  { label: "숨은 필드 접근", re: /\.(allyPicks|allies|nightTally|nightSure|spectate|whisperUsed|testRole|testBots|testMode|records|verdictVote|note|will)\b/ },
  { label: "숨은 필드 이름", re: /\b(allyPicks|nightTally|nightSure|whisperUsed|testRole|testBots|testMode|verdictVote)\b/ },
  { label: "마피아 채널·귓속말", re: /\b(mafia|whisper)\b/i },
  { label: "채팅", re: /\bchat/i },
  { label: "연결·스토어", re: /\b(useRoomConnection|chatStore|WorldStore|RoomView|WorldFrame|phaseEndsAt|serverNow)\b/ },
];

/** 문자열·템플릿 안의 // 는 남기고 주석만 지운다. 줄 수는 유지한다 (tensionStaticGuard 의 것을 복사) */
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

interface ImportRef {
  spec: string;
  typeOnly: boolean;
  text: string;
}

/** 주석을 뺀 코드의 import·export-from 문(여러 줄 포함)과 동적 import·require */
function importRefs(src: string): ImportRef[] {
  const code = stripComments(src);
  const refs: ImportRef[] = [];
  for (const m of code.matchAll(/\bimport\s+(type\s+)?[^;"']*?\bfrom\s*["']([^"']+)["']/g)) {
    refs.push({ spec: m[2]!, typeOnly: m[1] !== undefined, text: m[0] });
  }
  for (const m of code.matchAll(/\bexport\s+(type\s+)?[^;"']*?\bfrom\s*["']([^"']+)["']/g)) {
    refs.push({ spec: m[2]!, typeOnly: m[1] !== undefined, text: m[0] });
  }
  for (const m of code.matchAll(/\bimport\s*["']([^"']+)["']/g)) refs.push({ spec: m[1]!, typeOnly: false, text: m[0] });
  for (const m of code.matchAll(/\b(?:require|import)\s*\(/g)) refs.push({ spec: "<dynamic>", typeOnly: false, text: m[0] });
  return refs;
}

/** 허용 목록 밖을 불러오는 import */
function disallowedImports(src: string): string[] {
  return importRefs(src)
    .filter((r) => {
      const rule = ALLOWED_IMPORTS.find((a) => a.spec.test(r.spec));
      return rule === undefined || (rule.typeOnly === true && !r.typeOnly);
    })
    .map((r) => r.text.replace(/\s+/g, " "));
}

function forbiddenIn(src: string): string[] {
  const code = stripComments(src);
  return FORBIDDEN_PATTERNS.filter((p) => p.re.test(code)).map((p) => p.label);
}

function listSources(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = `${dir}/${name}`;
    if (statSync(full).isDirectory()) out.push(...listSources(full));
    else if (/\.(ts|tsx)$/.test(name)) out.push(full);
  }
  return out.sort();
}

describe("정적 가드 자기 시험 (LS-6)", () => {
  it("허용 목록 안의 import 는 통과시키고 연결·스토어·프로토콜 값 import 는 잡는다", () => {
    const ok =
      'import type { EmoteId } from "../../shared/protocol";\nimport { EXECUTION_MS } from "../../shared/game/phases";\nimport {\n  BALLOT_YES_AT,\n} from "../game/verdictMoment";\nimport { a } from "./recipes";\nimport { useEffect } from "react";';
    expect(disallowedImports(ok)).toEqual([]);
    expect(disallowedImports('import { EMOTE_IDS } from "../../shared/protocol";')).toHaveLength(1);
    expect(disallowedImports('import { useRoomConnection } from "../net/useRoomConnection";')).toHaveLength(1);
    expect(disallowedImports('import { WorldStore } from "../world/store";')).toHaveLength(1);
    expect(disallowedImports('import { x } from "../game/chatStore";')).toHaveLength(1);
    expect(disallowedImports('import { x } from "../world/tension";')).toHaveLength(1);
    expect(disallowedImports('const m = await import("x");')).toHaveLength(1);
    expect(disallowedImports('const m = require("x");')).toHaveLength(1);
    expect(disallowedImports('export { y } from "../net/z";')).toHaveLength(1);
    expect(disallowedImports('// import { x } from "../net/z";\nexport const a = 1;')).toEqual([]);
  });

  it("주석 안의 이름은 허용하고 코드의 숨은 필드 접근만 잡는다", () => {
    expect(forbiddenIn("// me.role 은 읽지 않는다\nexport const a = 1;")).toEqual([]);
    expect(forbiddenIn("const r = me.role;")).toContain("me.role");
    expect(forbiddenIn("const p = view.allyPicks;")).toContain("숨은 필드 접근");
    expect(forbiddenIn("const w = x.will;")).toContain("숨은 필드 접근");
    expect(forbiddenIn('const id = "will.quill";')).toEqual([]);
    expect(forbiddenIn("send(chatBody);")).toContain("채팅");
    expect(forbiddenIn("const m = mafiaChannel;")).toEqual([]);
    expect(forbiddenIn("const m = mafia;")).toContain("마피아 채널·귓속말");
  });
});

describe("소리 모듈은 숨은 정보를 읽지 못한다 (LS-6, T-12-04)", () => {
  const files = listSources(AUDIO_DIR);

  it("src/audio 에 recipes.ts·script.ts 가 있다 (경로 오타로 거짓 통과 방지)", () => {
    const names = files.map((f) => f.slice(AUDIO_DIR.length + 1));
    expect(names).toContain("recipes.ts");
    expect(names).toContain("script.ts");
  });

  it("recipes.ts 는 import 가 0개인 순수 모듈이다", () => {
    expect(importRefs(readFileSync(`${AUDIO_DIR}/recipes.ts`, "utf8"))).toEqual([]);
  });

  it.each(files.map((f) => [f.slice(ROOT.length), f] as const))("%s: import 는 허용 목록 안", (_rel, full) => {
    expect(disallowedImports(readFileSync(full, "utf8"))).toEqual([]);
  });

  it.each(files.map((f) => [f.slice(ROOT.length), f] as const))("%s: 숨은 필드·연결·스토어 이름이 없다", (_rel, full) => {
    expect(forbiddenIn(readFileSync(full, "utf8"))).toEqual([]);
  });
});
