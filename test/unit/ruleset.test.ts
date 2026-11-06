// 기본판 설정 RULESET 시험(13-01, 결정 0072, D-05). 설정은 shared/game/ruleset.ts 한 곳이고, 분기 모듈은 그 값을 import 해서 읽는다.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { BASIC_RULESET, RULESET } from "../../shared/game/ruleset";

const ROOT = fileURLToPath(new URL("../../", import.meta.url));
const read = (rel: string): string => readFileSync(`${ROOT}${rel}`, "utf8");

describe("기본판 설정 RULESET (결정 0072)", () => {
  it("RULESET 은 BASIC_RULESET 과 같은 객체이고 다섯 값이 모두 꺼짐이며 얼려 있다", () => {
    expect(RULESET === BASIC_RULESET).toBe(true);
    expect(JSON.stringify(RULESET)).toBe(JSON.stringify({ badge: false, whisper: false, pickTurn: false, runoff: false, showdown: false }));
    expect(Object.isFrozen(BASIC_RULESET)).toBe(true);
  });

  it("분기하는 모듈은 설정을 ./ruleset 에서 가져온다 (설정 값이 한 파일에만 있다)", () => {
    const importers = ["tick.ts", "phases.ts", "nomination.ts", "room.ts"].map((f) => `${f}:${/from "\.\/ruleset"/.test(read(`shared/game/${f}`))}`);
    expect(importers.join(" ")).toBe("tick.ts:true phases.ts:true nomination.ts:true room.ts:true");
    const literal = ["tick.ts", "phases.ts", "nomination.ts", "room.ts"].filter((f) => /\b(pickTurn|runoff|showdown|badge|whisper)\s*:\s*(true|false)\b/.test(read(`shared/game/${f}`)));
    expect(literal.join(",")).toBe("");
  });
});
