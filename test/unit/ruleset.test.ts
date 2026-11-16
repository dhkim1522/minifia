// 판 규칙 시험(13-01 결정 0072, 22-07 결정 0089-12). 규칙은 shared/game/ruleset.ts 의 상수 RULES 하나이고 서버·화면 모두 이것을 직접 읽는다 — 판 종류는 없다.
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { RULES, politicsOn } from "../../shared/game/ruleset";

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

describe("단일 규칙 RULES (결정 0089-12, 22-07 D-01)", () => {
  it("키 집합은 badge·pickTurn·runoff·showdown·whisper 다섯이고 값은 모두 꺼짐이다 — 22-09 가 pickTurn 을 true 로 켠다", () => {
    expect(Object.keys(RULES).sort().join(",")).toBe("badge,pickTurn,runoff,showdown,whisper");
    expect(JSON.stringify(RULES)).toBe(JSON.stringify({ badge: false, whisper: false, pickTurn: false, runoff: false, showdown: false }));
  });

  it("RULES 는 얼린 객체 하나다", () => {
    expect(Object.isFrozen(RULES)).toBe(true);
  });

  it("politicsOn 은 이 계획 시점의 RULES 에 대해 거짓이고 장치 하나라도 켜면 참이다", () => {
    expect(`${politicsOn(RULES)}/${politicsOn({ ...RULES, runoff: true })}`).toBe("false/true");
  });
});

describe("규칙은 한 곳에서 읽는다 (22-07)", () => {
  it("ruleset.ts 가 내보내는 이름은 Ruleset·RULES·politicsOn 셋뿐이다 (rulesetOf·modeOf·RULES_BY_MODE 가 없다)", () => {
    const names = [...read("shared/game/ruleset.ts").matchAll(/^export (?:const|function|interface|type) (\w+)/gm)].map((m) => m[1]);
    expect(names.join(",")).toBe("Ruleset,RULES,politicsOn");
  });

  it("src·shared·worker·test·scripts 의 소스 어디에도 옛 전역 상수 이름이 없다 (주석 포함)", () => {
    const files = sourceFiles();
    const hits = files.filter((rel) => read(rel).includes(OLD_NAME));
    expect(files.length).toBeGreaterThan(300);
    expect(hits.join(" ")).toBe("");
  });

  it("규칙으로 갈리는 서버 모듈은 규칙을 ./ruleset 에서 얻는다 — tick·nomination·room·view·방 DO 는 RULES 를 가져오고, phases 는 규칙을 가져오지도 받지도 않는다(22페이즈: 낮 시작 분기가 사라졌다)", () => {
    const takes = (rel: string, from: string): boolean => new RegExp(`import \\{[^}]*\\bRULES\\b[^}]*\\} from "${from}"`).test(read(rel));
    const seen = ["tick.ts", "nomination.ts", "room.ts", "view.ts"].map((f) => `${f}:${takes(`shared/game/${f}`, "\\./ruleset")}`);
    expect(seen.join(" ")).toBe("tick.ts:true nomination.ts:true room.ts:true view.ts:true");
    expect(takes("worker/room.ts", "\\.\\./shared/game/ruleset")).toBe(true);
    const phases = read("shared/game/phases.ts");
    expect(/from "\.\/ruleset"/.test(phases)).toBe(false);
  });

  it("규칙 값은 한 파일에만 있다 — 갈리는 모듈에 정치 장치 값을 직접 적지 않았다", () => {
    const literal = ["tick.ts", "phases.ts", "nomination.ts", "room.ts", "view.ts"].filter((f) => /\b(pickTurn|runoff|showdown|badge|whisper)\s*:\s*(true|false)\b/.test(read(`shared/game/${f}`)));
    expect(literal.join(",")).toBe("");
  });

  it("화면 모델은 규칙을 RULES 에서 직접 읽는다 — 문구 표는 규칙을 가져오지 않는다", () => {
    const has = (rel: string): boolean => /import \{[^}]*\bRULES\b[^}]*\} from "[^"]*shared\/game\/ruleset"/.test(read(rel));
    expect(["src/game/badgeView.ts", "src/game/whisperView.ts", "src/screens/GameMap.tsx", "src/game/resultText.ts"].map((f) => `${f}:${has(f)}`).join(" ")).toBe(
      "src/game/badgeView.ts:true src/game/whisperView.ts:true src/screens/GameMap.tsx:true src/game/resultText.ts:false",
    );
    expect(sourceFiles().filter((rel) => /\b(rulesetOf|modeOf|GAME_MODES|DEFAULT_MODE|modePick)\b/.test(read(rel)) && rel !== "test/unit/ruleset.test.ts").join(" ")).toBe("");
  });
});
