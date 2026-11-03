// 09-06: 긴장 연출 코드의 정적 가드 (NIGHT-10, T-09-10).
// L3 — 긴장 연출 코드는 서버 신호와 끊김(결정 0061-15, UI-SPEC 누설 불변식 L3).
// 주석을 뺀 소스에서 import·require 줄과 서버 시각·프레임 필드 이름이 없는지 문자열로 고정한다.
// 09-15: 화면 부품 TensionVignette.tsx 를 더한다. 스케줄러(tension.ts)는 import 0개이고, 부품은 react·tension 모듈·css 만 불러올 수 있다.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const ROOT = fileURLToPath(new URL("../../", import.meta.url));
const read = (rel: string): string => readFileSync(`${ROOT}${rel}`, "utf8");

/** 아무것도 import 하지 않는 순수 스케줄러 */
const PURE = ["src/world/tension.ts"];
/** 화면 부품: React 를 쓰므로 import 는 허용 목록 안에서만 허용한다(연결·스토어·프로토콜·world/store·shared 는 불러오지 않는다) */
const COMPONENTS = ["src/components/TensionVignette.tsx"];
const GUARDED = [...PURE, ...COMPONENTS];
/** 화면 부품이 불러올 수 있는 모듈 경로(따옴표 안 값). 이유: 서버 신호와 이어진 모듈을 못 부르게 하는 L3 */
const ALLOWED_IMPORTS: readonly RegExp[] = [/^react$/, /^\.\.\/world\/tension$/, /^\.\.\/styles\/night\.css$/];

/** 서버 시각·프레임 필드 이름 — 긴장 연출 코드에 나오면 서버 신호와 이어진 것이다 */
const FORBIDDEN_NAMES = ["phaseEndsAt", "serverNow", "phaseDurationMs", "WorldFrame", "RoomView"] as const;

/** 문자열·템플릿 안의 // 는 남기고 주석만 지운다. 줄 수는 유지한다 */
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

/** 주석을 뺀 코드의 import·require 줄 */
function importLines(src: string): string[] {
  return stripComments(src)
    .split("\n")
    .filter((line) => /^\s*import\b/.test(line) || /\brequire\s*\(/.test(line) || /\bimport\s*\(/.test(line));
}

/** import 줄의 모듈 경로. 줄 모양을 못 읽으면 줄 전체를 돌려준다(허용 목록에 안 맞아 실패한다) */
function specifierOf(line: string): string {
  return /["']([^"']+)["']/.exec(line)?.[1] ?? line;
}

/** 허용 목록 밖 모듈을 불러오는 import 줄 */
function disallowedImports(src: string): string[] {
  return importLines(src).filter((line) => !ALLOWED_IMPORTS.some((re) => re.test(specifierOf(line))));
}

/** 주석을 뺀 코드에 나오는 금지 이름 */
function forbiddenNamesIn(src: string): string[] {
  const code = stripComments(src);
  return FORBIDDEN_NAMES.filter((name) => new RegExp(`\\b${name}\\b`).test(code));
}

describe("검사 함수 자기 시험", () => {
  it("import 줄이 있는 소스는 잡고 없는 소스는 통과시킨다", () => {
    expect(importLines('import { x } from "../store";\nexport const a = 1;')).toHaveLength(1);
    expect(importLines('const m = require("x");')).toHaveLength(1);
    expect(importLines('const m = await import("x");')).toHaveLength(1);
    expect(importLines("export const a = 1;")).toHaveLength(0);
  });

  it("주석 안의 import·금지 이름은 허용하고 코드의 것만 잡는다", () => {
    expect(importLines('// import { x } from "y";\n/* import z */\nexport const a = 1;')).toHaveLength(0);
    expect(forbiddenNamesIn("// phaseEndsAt 와 끊긴다\nexport const a = 1;")).toEqual([]);
    expect(forbiddenNamesIn("const t = frame.phaseEndsAt;")).toEqual(["phaseEndsAt"]);
    expect(forbiddenNamesIn("function f(v: RoomView, n = serverNow) {}")).toEqual(["serverNow", "RoomView"]);
  });
});

describe("허용 import 검사 자기 시험", () => {
  it("react·tension·night.css 는 통과시키고 연결·스토어·프로토콜은 잡는다", () => {
    expect(disallowedImports('import { useEffect } from "react";\nimport { startTension } from "../world/tension";\nimport "../styles/night.css";')).toEqual([]);
    expect(disallowedImports('import { WorldStore } from "../world/store";')).toHaveLength(1);
    expect(disallowedImports('import type { RoomView } from "../../shared/protocol";')).toHaveLength(1);
    expect(disallowedImports('import { useRoomConnection } from "../net/useRoomConnection";')).toHaveLength(1);
  });
});

describe("긴장 연출 코드는 서버 신호와 끊겨 있다 (L3)", () => {
  const tracked = new Set(
    execFileSync("git", ["ls-files", "src"], { cwd: ROOT, encoding: "utf8" })
      .split("\n")
      .filter((p) => p !== ""),
  );

  it.each(GUARDED)("%s 는 git 이 추적하는 파일이다 (경로 오타로 거짓 통과 방지)", (rel) => {
    expect(tracked.has(rel)).toBe(true);
  });

  it.each(PURE)("%s 는 import·require 줄이 0개다", (rel) => {
    expect(importLines(read(rel))).toEqual([]);
  });

  it.each(COMPONENTS)("%s 는 react·tension 모듈·css 밖의 모듈을 불러오지 않는다", (rel) => {
    expect(disallowedImports(read(rel))).toEqual([]);
  });

  it.each(COMPONENTS)("%s 의 props 는 reducedMotion·onCue 뿐이고 서버 시각을 받지 않는다", (rel) => {
    const code = stripComments(read(rel));
    const props = /interface\s+TensionVignetteProps\s*\{([^}]*)\}/.exec(code)?.[1] ?? "";
    const names = [...props.matchAll(/^\s*(\w+)\??\s*:/gm)].map((m) => m[1]);
    expect(names).toEqual(["reducedMotion", "onCue"]);
  });

  it.each(GUARDED)("%s 는 서버 시각·프레임 필드 이름을 쓰지 않는다", (rel) => {
    expect(forbiddenNamesIn(read(rel))).toEqual([]);
  });
});
