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

/**
 * RoomView 를 읽는 유일한 파일(12-08, D-3): 공개 view 에서 허용 필드만 고르는 audioView.ts.
 * 이 파일만 RoomView 타입과 phaseEndsAt 필드 이름을 쓸 수 있고, 나머지 금지 이름은 그대로 걸린다.
 */
const VIEW_READER = "audioView.ts";
const VIEW_READER_ALLOWED = /\b(RoomView|phaseEndsAt)\b/g;

function forbiddenIn(src: string, file = ""): string[] {
  let code = stripComments(src);
  if (file === VIEW_READER) code = code.replace(VIEW_READER_ALLOWED, "");
  return FORBIDDEN_PATTERNS.filter((p) => p.re.test(code)).map((p) => p.label);
}

/** 소스에서 `view.` 로 시작하는 접근 경로(`?.` 는 `.` 로 본다)를 모은다 */
function viewPaths(src: string): string[] {
  const code = stripComments(src);
  const out = new Set<string>();
  for (const m of code.matchAll(/\bview((?:\??\.[A-Za-z_]\w*)+)/g)) {
    let path = `view${m[1]!.replace(/\?\./g, ".")}`;
    // 끝이 메서드 호출(view.players.map( …)이면 그 메서드 이름은 필드가 아니다
    if (code[m.index! + m[0].length] === "(") path = path.slice(0, path.lastIndexOf("."));
    out.add(path);
  }
  return [...out].sort();
}

/** AudioView 가 RoomView 에서 읽을 수 있는 경로의 허용 집합 (LS-6). 이후 계획이 필요한 공개 필드를 여기와 audioView.ts 에 함께 더한다 */
const ALLOWED_VIEW_PATHS: readonly string[] = [
  "view.phase",
  "view.phaseEndsAt",
  "view.day.n",
  "view.day.turn",
  "view.day.points",
  "view.day.candidate",
  "view.day.morning",
  "view.players",
  "view.me.seat",
];

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
    expect(forbiddenIn(readFileSync(full, "utf8"), full.slice(AUDIO_DIR.length + 1))).toEqual([]);
  });
});

describe("AudioView 의 읽는 경로 허용 목록 (LS-6, T-12-27)", () => {
  const files = listSources(AUDIO_DIR);
  const read = (name: string): string => readFileSync(`${AUDIO_DIR}/${name}`, "utf8");

  it("가드 자기 시험: view 접근 경로를 모으고 숨은 경로는 허용 집합 밖이다", () => {
    expect(viewPaths("const a = view.phase; const b = view.day?.turn; // view.me.role")).toEqual(["view.day.turn", "view.phase"]);
    expect(viewPaths("const r = view.me?.role;")).toEqual(["view.me.role"]);
    expect(viewPaths("view.players.map((p) => p.seat);")).toEqual(["view.players"]);
    expect(forbiddenIn("const v: RoomView = x; const e = x.phaseEndsAt;", "audioView.ts")).toEqual([]);
    expect(forbiddenIn("const v: RoomView = x;", "director.ts")).toContain("연결·스토어");
    expect(forbiddenIn("const c = view.me.chat;", "audioView.ts")).toContain("채팅");
  });

  it("audioView.ts 가 있고 읽는 경로가 모두 허용 집합 안이다", () => {
    const paths = viewPaths(read("audioView.ts"));
    expect(paths.length).toBeGreaterThan(0);
    const extra = paths.filter((p) => !ALLOWED_VIEW_PATHS.includes(p));
    expect(extra).toEqual([]);
  });

  it("금지 경로(me.role·allies·pick·allyPicks·nightTally·nightSure·records·chat·note·will·spectate·whisper)가 audioView.ts 에 없다", () => {
    const code = stripComments(read("audioView.ts"));
    for (const name of ["role", "allies", "pick", "allyPicks", "nightTally", "nightSure", "records", "chat", "note", "will", "spectate", "whisperUsed", "ballot", "verdictVote", "result"]) {
      expect(new RegExp(`\\.${name}\\b`).test(code), name).toBe(false);
    }
  });

  it("RoomView 를 가져오는 파일은 audioView.ts 뿐이다 (director·script·engine·useSound 는 AudioView 만 안다)", () => {
    for (const f of files) {
      const name = f.slice(AUDIO_DIR.length + 1);
      const refs = importRefs(readFileSync(f, "utf8")).filter((r) => /\bRoomView\b/.test(r.text));
      if (name === VIEW_READER) expect(refs.length).toBeGreaterThan(0);
      else expect(refs, name).toEqual([]);
    }
  });

  it("useSound.ts 는 audioViewOf 를 쓰고 눌림 시작 이벤트 이름이 주석에도 없다", () => {
    const src = read("useSound.ts");
    expect(src.includes("audioViewOf")).toBe(true);
    expect(/touchstart|pointerdown/.test(src)).toBe(false);
  });
});
