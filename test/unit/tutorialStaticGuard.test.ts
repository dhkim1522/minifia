// 24-07: 튜토리얼 네트워크 0 정적 가드 (D-15·D-18, T-24-19·T-24-21, 결정 0089-15).
// 혼자 하기 튜토리얼은 실제 게임 부품에 가짜 view 를 먹이는 화면이라 서버·소켓·세션 토큰에 닿으면 안 된다. 두 가지를 소스로 막는다:
//   ① 진입 모듈에서 시작한 값 import 폐포(import type 과 전부 type 인 중괄호 import 는 따라가지 않는다)에 네트워크·세션 모듈이 없다 — 이 앱에서 네트워크를 쓰는 소스는
//      src/net/api.ts(fetch)·src/net/useRoomConnection.ts(WebSocket) 둘뿐이고, 토큰을 저장하는 src/net/session.ts 도 같이 막는다.
//   ② 진입 모듈 본문(주석 제외)에 innerHTML 계열·useDayFx·저장 닉네임 읽기·sendBeacon·fetch(·new WebSocket·내 역할 읽기가 없다.
// 가드가 빈 통과가 아니도록 자기 점검(가짜 진입 파일이 net/api 를 값으로 가져오면 찾아낸다)을 둔다. 폐포 계산은 정규식 기반 약 30줄이다.
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const ROOT = fileURLToPath(new URL("../../", import.meta.url));

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

/** 진입 모듈 목록. 있는 파일만 검사한다 — 24-08 이 TutorialScreen·useTutorialScene 을 더하면 자동으로 걸린다 */
export const TUTORIAL_ENTRIES: readonly string[] = [
  "src/game/tutorialScript.ts",
  "src/components/tutorial/FocusRing.tsx",
  "src/components/tutorial/TutorialFrame.tsx",
  "src/screens/TutorialScreen.tsx",
  "src/net/useTutorialScene.ts",
];

/** 튜토리얼 모듈 그래프에 들어오면 안 되는 파일(ROOT 상대) — 네트워크 두 곳과 토큰 저장 한 곳 */
const FORBIDDEN_MODULES: readonly string[] = ["src/net/api.ts", "src/net/useRoomConnection.ts", "src/net/session.ts"];

type Reader = (absPath: string) => string | null;

const diskReader: Reader = (p) => (existsSync(p) ? readFileSync(p, "utf8") : null);

/** 상대 경로 지정자를 파일로 푼다(.ts·.tsx·index). 못 풀면 null — 패키지·css·에셋 import 는 따라가지 않는다 */
function resolveSpec(fromFile: string, spec: string, read: Reader): string | null {
  if (!spec.startsWith(".")) return null;
  const base = resolve(dirname(fromFile), spec);
  for (const cand of [base, `${base}.ts`, `${base}.tsx`, `${base}/index.ts`, `${base}/index.tsx`]) {
    if (/\.(ts|tsx)$/.test(cand) && read(cand) !== null) return cand;
  }
  return null;
}

/** 값 import 지정자들. import type · 전부 type 인 중괄호 import 는 건너뛴다. export … from 과 동적 import() 는 따라간다 */
function valueSpecs(src: string): string[] {
  const code = stripComments(src);
  const specs: string[] = [];
  const clause = /\b(import|export)\s+(type\s+)?([^;"'`]*?)\s*\bfrom\s*["']([^"']+)["']/g;
  for (const m of code.matchAll(clause)) {
    if (m[2] !== undefined) continue; // import type X / export type { X }
    const names = m[3] ?? "";
    const braces = /^\{([\s\S]*)\}$/.exec(names.trim());
    if (braces !== null) {
      const items = braces[1]!.split(",").map((s) => s.trim()).filter((s) => s !== "");
      if (items.length > 0 && items.every((s) => /^type\s/.test(s))) continue;
    }
    specs.push(m[4]!);
  }
  for (const m of code.matchAll(/\bimport\s*\(\s*["']([^"']+)["']\s*\)/g)) specs.push(m[1]!);
  for (const m of code.matchAll(/(?:^|[;\n])\s*import\s+["']([^"']+)["']/g)) specs.push(m[1]!); // import "x" (부수 효과)
  return specs;
}

/** 진입 파일들에서 시작한 값 import 폐포(절대 경로 집합, 진입 파일 포함) */
function closureOf(entries: readonly string[], read: Reader): Set<string> {
  const seen = new Set<string>();
  const queue = [...entries];
  while (queue.length > 0) {
    const file = queue.pop()!;
    if (seen.has(file)) continue;
    seen.add(file);
    const src = read(file);
    if (src === null) continue;
    for (const spec of valueSpecs(src)) {
      const next = resolveSpec(file, spec, read);
      if (next !== null && !seen.has(next)) queue.push(next);
    }
  }
  return seen;
}

/** 폐포에 들어온 금지 모듈(ROOT 상대 경로) */
function forbiddenIn(closure: ReadonlySet<string>): string[] {
  return FORBIDDEN_MODULES.filter((rel) => closure.has(resolve(ROOT, rel)));
}

/** 진입 모듈 본문에서 금지하는 것 — 주석을 뺀 코드에 쓰이면 위반 */
const FORBIDDEN_CODE: readonly { label: string; re: RegExp }[] = [
  { label: "innerHTML 계열", re: /\b(innerHTML|outerHTML|insertAdjacentHTML|dangerouslySetInnerHTML)\b|\bdocument\s*\.\s*write\b/ },
  { label: "useDayFx", re: /\buseDayFx\b/ },
  { label: "저장된 닉네임 읽기", re: /\b(loadLastNickname|saveLastNickname|NICKNAME_KEY|lastNickname)\b|minifia:lastNickname/ },
  { label: "sendBeacon", re: /\bsendBeacon\b/ },
  { label: "fetch·WebSocket", re: /\bfetch\s*\(|\bnew\s+(WebSocket|EventSource)\b|\bWebSocket\s*\(/ },
  { label: "내 역할 읽기", re: /\bme\s*\??\.\s*role\b/ },
];

function violationsOf(src: string): string[] {
  const code = stripComments(src);
  return FORBIDDEN_CODE.filter((f) => f.re.test(code)).map((f) => f.label);
}

const entries = TUTORIAL_ENTRIES.map((rel) => resolve(ROOT, rel)).filter((abs) => existsSync(abs));

describe("정적 가드 자기 시험 — 일부러 만든 위반 표본을 가드가 잡는다", () => {
  const E = resolve(ROOT, "src/game/__virtual_entry.ts");
  const virtual = (files: Record<string, string>): Reader => (p) => files[p] ?? diskReader(p);

  it("가짜 진입 파일이 net/api 를 값으로 import 하면 찾아낸다", () => {
    const read = virtual({ [E]: 'import { createRoom } from "../net/api";\nexport const x = createRoom;' });
    expect(forbiddenIn(closureOf([E], read))).toEqual(["src/net/api.ts"]);
  });

  it("net/useRoomConnection·net/session 도 찾아낸다", () => {
    const read = virtual({ [E]: 'import { useRoomConnection } from "../net/useRoomConnection";\nimport { loadSession } from "../net/session";\nexport const x = [useRoomConnection, loadSession];' });
    // useRoomConnection 은 api 를 다시 가져오므로 폐포에는 세 파일이 모두 들어온다
    expect(forbiddenIn(closureOf([E], read))).toEqual(expect.arrayContaining(["src/net/session.ts", "src/net/useRoomConnection.ts"]));
  });

  it("건너 건너(전이) import 도 찾아낸다", () => {
    const M = resolve(ROOT, "src/game/__virtual_mid.ts");
    const read = virtual({ [E]: 'import { y } from "./__virtual_mid";\nexport const x = y;', [M]: 'export * from "../net/api";\nexport const y = 1;' });
    expect(forbiddenIn(closureOf([E], read))).toEqual(["src/net/api.ts"]);
  });

  it("동적 import() 와 export … from 재수출도 따라간다", () => {
    const read = virtual({ [E]: 'export const lazy = () => import("../net/useRoomConnection");\nexport { saveSession } from "../net/session";' });
    expect(forbiddenIn(closureOf([E], read))).toEqual(expect.arrayContaining(["src/net/session.ts", "src/net/useRoomConnection.ts"]));
  });

  it("import type 과 전부 type 인 중괄호 import 는 따라가지 않는다(깨끗한 파일은 통과)", () => {
    const read = virtual({
      [E]: 'import type { CreateRoomResponse } from "../net/api";\nimport { type StoredSession, type StorageLike } from "../net/session";\nexport type T = [CreateRoomResponse, StoredSession, StorageLike];',
    });
    expect(forbiddenIn(closureOf([E], read))).toEqual([]);
  });

  it("값과 type 이 섞인 중괄호 import 는 따라간다", () => {
    const read = virtual({ [E]: 'import { type StoredSession, loadSession } from "../net/session";\nexport const x: StoredSession | null = loadSession();' });
    expect(forbiddenIn(closureOf([E], read))).toEqual(["src/net/session.ts"]);
  });

  it("주석 안의 import 글자는 따라가지 않는다", () => {
    const read = virtual({ [E]: '// import { x } from "../net/api";\n/* import "../net/session"; */\nexport const a = 1;' });
    expect(forbiddenIn(closureOf([E], read))).toEqual([]);
  });

  it.each([
    ["innerHTML 계열", "el.innerHTML = name;"],
    ["innerHTML 계열", "<div dangerouslySetInnerHTML={{ __html: name }} />"],
    ["useDayFx", 'import { useDayFx } from "../net/useDayFx";'],
    ["저장된 닉네임 읽기", "const n = loadLastNickname();"],
    ["sendBeacon", 'navigator.sendBeacon("/x");'],
    ["fetch·WebSocket", 'await fetch("/api/rooms");'],
    ["fetch·WebSocket", 'const ws = new WebSocket("wss://x");'],
    ["내 역할 읽기", "const r = view.me.role;"],
  ])("본문 규칙 %s: %s", (label, sample) => {
    expect(violationsOf(sample)).toContain(label);
  });

  it("주석 안의 낱말은 허용하고 깨끗한 코드는 위반이 없다", () => {
    expect(violationsOf("// me.role 과 innerHTML·fetch(url) 은 쓰지 않는다\n/* new WebSocket */\nexport const a = 1;")).toEqual([]);
    expect(violationsOf('const cast = { seat: 1, name: "도윤" };\nreturn <span>{cast.name}</span>;')).toEqual([]);
    expect(violationsOf('const me = { seat: 5, isHost: false, role: "citizen" };')).toEqual([]);
  });
});

describe("튜토리얼 모듈 그래프에 네트워크·세션 모듈이 없다 (T-24-19)", () => {
  it("진입 모듈을 세 개 이상 찾는다(경로 오타로 거짓 통과 방지)", () => {
    expect(entries.length).toBeGreaterThanOrEqual(3);
    expect(entries).toContain(resolve(ROOT, "src/game/tutorialScript.ts"));
  });

  it("값 import 폐포가 대본·링·틀 파일을 포함한다(폐포 계산이 비어 있지 않다)", () => {
    const closure = closureOf(entries, diskReader);
    expect(closure.size).toBeGreaterThan(entries.length);
    for (const abs of entries) expect(closure.has(abs)).toBe(true);
    expect(closure.has(resolve(ROOT, "shared/game/world.ts"))).toBe(true);
  });

  it("폐포에 src/net/api.ts·src/net/useRoomConnection.ts·src/net/session.ts 가 없다", () => {
    expect(forbiddenIn(closureOf(entries, diskReader))).toEqual([]);
  });

  it.each(entries.map((f) => [f.slice(ROOT.length), f] as const))("%s: 본문에 금지 항목 위반 0", (_rel, full) => {
    expect(violationsOf(readFileSync(full, "utf8"))).toEqual([]);
  });
});
