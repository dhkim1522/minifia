// 09.1.1-11: 핀 조명 계획의 정적 가드 (L22, T-09.1.1-30).
// 핀 계획은 서버가 모두에게 공개한 값(day.turn·day.points)만 읽는다. 연결·스토어·개인 정보 이름이 코드에 없음을 소스 문자열로 고정한다.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const ROOT = fileURLToPath(new URL("../../", import.meta.url));
const SRC = readFileSync(`${ROOT}src/world/pinPlan.ts`, "utf8");

/** 문자열 안의 // 는 남기고 주석만 지운다 */
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

const CODE = stripComments(SRC);
const importLines = (code: string): string[] => code.split("\n").filter((l) => /^\s*import\b/.test(l) || /\brequire\s*\(/.test(l) || /\bimport\s*\(/.test(l));
const specifier = (line: string): string => /["']([^"']+)["']/.exec(line)?.[1] ?? line;
const BAD_TOKENS = ["role", "spectate", "allies", "nightPick", "mafia"] as const;
const tokensIn = (code: string): string[] => BAD_TOKENS.filter((t) => new RegExp(`\\b${t}\\b`).test(code));

describe("검사 함수 자기 시험", () => {
  it("주석 안의 이름은 허용하고 코드의 것만 잡는다", () => {
    expect(tokensIn(stripComments("// role 은 안 읽는다\nconst a = 1;"))).toEqual([]);
    expect(tokensIn(stripComments("const r = view.me.role;"))).toEqual(["role"]);
    expect(tokensIn(stripComments("const m = x.mafia && y.spectate;"))).toEqual(["spectate", "mafia"]);
    expect(importLines('import { a } from "../net/x";\nconst b = 1;')).toHaveLength(1);
  });
});

describe("pinPlan.ts 정적 가드 (L22)", () => {
  it("연결·스토어·소켓 문자열이 없다", () => {
    for (const bad of ['from "../net', 'from "./store"', "useRoomConnection", "WebSocket"]) expect(CODE).not.toContain(bad);
  });

  it("import 는 shared/protocol(type 만)과 shared/game/phases 뿐이다", () => {
    const lines = importLines(CODE);
    expect(lines.length).toBeGreaterThan(0);
    for (const line of lines) {
      const spec = specifier(line);
      if (spec.endsWith("shared/protocol")) expect(line).toMatch(/^\s*import type\b/);
      else expect(spec).toMatch(/shared\/game\/phases$/);
    }
  });

  it("역할·관전·동료·밤 선택 같은 이름이 주석 밖 코드에 없다", () => {
    expect(tokensIn(CODE)).toEqual([]);
  });

  it("view 에서 읽는 것은 phase·phaseEndsAt 와 day.turn·points·candidate·ballots·verdict 뿐이다 (view.me 접근 없음)", () => {
    expect(CODE).not.toMatch(/\bview\.me\b/);
    expect(CODE).not.toMatch(/\bview\.players\b/);
    const reads = [...CODE.matchAll(/\bview\.([A-Za-z]+(?:\??\.[A-Za-z]+)?)/g)].map((m) => m[1]!.replace("?.", "."));
    const allowed = new Set(["phase", "phaseEndsAt", "day.turn", "day.points", "day.candidate", "day.ballots", "day.verdict"]);
    for (const r of reads) expect(allowed.has(r!), `view.${r}`).toBe(true);
  });
});
