// 판 규칙 시험(13-01 결정 0072, 19-02 D-03). 규칙 값은 shared/game/ruleset.ts 한 곳에 있고 판 종류마다 얼린 객체 하나다.
// 전역 규칙 상수는 없다 — 서버는 방 상태의 판 종류에서, 화면은 view.mode 에서 rulesetOf(modeOf(…)) 로 얻는다.
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { modeOf, politicsOn, rulesetOf } from "../../shared/game/ruleset";
import { DEFAULT_MODE, GAME_MODES } from "../../shared/protocol";

const ROOT = fileURLToPath(new URL("../../", import.meta.url));
const read = (rel: string): string => readFileSync(`${ROOT}${rel}`, "utf8");

/** 옛 전역 상수의 이름. 이 파일도 아래 검사 대상이라 낱말을 그대로 적지 않고 조각으로 만든다. */
const OLD_NAME = ["RULE", "SET"].join("");
const CODE_DIRS = ["src", "shared", "worker", "test", "scripts"] as const;
/** 코드 폴더 다섯의 소스 파일(.ts·.tsx·.mjs·.js). E2E 산출물 폴더는 코드가 아니라 뺀다. */
function sourceFiles(): string[] {
  return CODE_DIRS.flatMap((dir) =>
    (readdirSync(`${ROOT}${dir}`, { recursive: true }) as string[])
      .map((rel) => `${dir}/${rel.split("\\").join("/")}`)
      .filter((rel) => /\.(ts|tsx|mjs|js)$/.test(rel) && !rel.startsWith("scripts/e2e/out/") && !rel.includes("/node_modules/")),
  );
}

describe("판 규칙 표 (결정 0072, 19페이즈 D-02)", () => {
  it("두 판의 여덟 값: 정치 장치 다섯은 두 판 모두 꺼짐, 심부름·목격 기록·흔적은 extended 만 켜짐", () => {
    expect(JSON.stringify(rulesetOf("basic"))).toBe(JSON.stringify({ badge: false, whisper: false, pickTurn: false, runoff: false, showdown: false, errand: false, witness: false, trace: false }));
    expect(JSON.stringify(rulesetOf("extended"))).toBe(JSON.stringify({ badge: false, whisper: false, pickTurn: false, runoff: false, showdown: false, errand: true, witness: true, trace: true }));
  });

  it("판 종류는 둘뿐이고 어느 판도 정치 장치가 켜져 있지 않다 (T-19-07)", () => {
    expect(GAME_MODES.map((mode) => `${mode}:${politicsOn(rulesetOf(mode))}`).join(" ")).toBe("basic:false extended:false");
  });

  it("규칙 객체는 얼려 있고, 같은 판은 늘 같은 객체이며 두 판은 서로 다른 객체다", () => {
    expect(GAME_MODES.map((mode) => `${Object.isFrozen(rulesetOf(mode))}/${rulesetOf(mode) === rulesetOf(mode)}`).join(" ")).toBe("true/true true/true");
    expect(rulesetOf("basic") === rulesetOf("extended")).toBe(false);
  });

  it("modeOf 의 기본값: mode 가 없거나 허용 밖이면 기본 판(extended)이고 그 규칙은 rulesetOf(DEFAULT_MODE) 다", () => {
    expect([modeOf({}), modeOf({ mode: undefined }), modeOf({ mode: "turbo" }), modeOf({ mode: "basic" })].join(",")).toBe("extended,extended,extended,basic");
    expect(DEFAULT_MODE).toBe("extended");
    expect(rulesetOf(modeOf({})) === rulesetOf(DEFAULT_MODE)).toBe(true);
  });
});

describe("전역 규칙 상수가 없다 (19-02, D-03)", () => {
  it("ruleset.ts 가 내보내는 이름에 대문자 상수가 없다 — 타입과 함수 셋뿐이다", () => {
    const names = [...read("shared/game/ruleset.ts").matchAll(/^export (?:const|function|interface|type) (\w+)/gm)].map((m) => m[1]);
    expect(names.join(",")).toBe("Ruleset,rulesetOf,modeOf,politicsOn");
  });

  it("src·shared·worker·test·scripts 의 소스 어디에도 옛 전역 상수 이름이 없다 (주석 포함)", () => {
    const files = sourceFiles();
    const hits = files.filter((rel) => read(rel).includes(OLD_NAME));
    expect(files.length).toBeGreaterThan(300);
    expect(hits.join(" ")).toBe("");
  });

  it("규칙으로 갈리는 서버 모듈은 규칙을 ./ruleset 에서 얻는다 — tick·nomination·room·view·방 DO 는 rulesetOf 를 가져오고, phases 는 규칙을 인자로 받는다(타입만)", () => {
    const takes = (rel: string, from: string): boolean => new RegExp(`import \\{[^}]*\\brulesetOf\\b[^}]*\\} from "${from}"`).test(read(rel));
    const seen = ["tick.ts", "nomination.ts", "room.ts", "view.ts"].map((f) => `${f}:${takes(`shared/game/${f}`, "\\./ruleset")}`);
    expect(seen.join(" ")).toBe("tick.ts:true nomination.ts:true room.ts:true view.ts:true");
    expect(takes("worker/room.ts", "\\.\\./shared/game/ruleset")).toBe(true);
    const phases = read("shared/game/phases.ts");
    expect(`${/import type \{ Ruleset \} from "\.\/ruleset"/.test(phases)}/${/import \{[^}]*\} from "\.\/ruleset"/.test(phases)}`).toBe("true/false");
  });

  it("규칙 값은 한 파일에만 있다 — 갈리는 모듈에 정치 장치 값을 직접 적지 않았다", () => {
    const literal = ["tick.ts", "phases.ts", "nomination.ts", "room.ts", "view.ts"].filter((f) => /\b(pickTurn|runoff|showdown|badge|whisper)\s*:\s*(true|false)\b/.test(read(`shared/game/${f}`)));
    expect(literal.join(",")).toBe("");
  });

  it("화면 모델은 규칙을 view.mode 에서 얻는다 — rulesetOf 를 가져오고, 문구 표는 규칙을 가져오지 않고 인자로 받는다", () => {
    const has = (rel: string): boolean => /import \{[^}]*\brulesetOf\b[^}]*\} from "[^"]*shared\/game\/ruleset"/.test(read(rel));
    expect(["src/game/badgeView.ts", "src/game/whisperView.ts", "src/screens/GameMap.tsx", "src/game/resultText.ts"].map((f) => `${f}:${has(f)}`).join(" ")).toBe(
      "src/game/badgeView.ts:true src/game/whisperView.ts:true src/screens/GameMap.tsx:true src/game/resultText.ts:false",
    );
    expect(["src/game/badgeView.ts", "src/game/whisperView.ts", "src/screens/GameMap.tsx"].map((f) => /modeOf\(view\)/.test(read(f))).join(",")).toBe("true,true,true");
  });
});
