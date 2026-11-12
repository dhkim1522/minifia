// 기본판 설정 RULESET 시험(13-01, 결정 0072, D-05). 설정은 shared/game/ruleset.ts 한 곳이고, 분기 모듈은 그 값을 import 해서 읽는다.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { BASIC_RULESET, RULESET } from "../../shared/game/ruleset";

const ROOT = fileURLToPath(new URL("../../", import.meta.url));
const read = (rel: string): string => readFileSync(`${ROOT}${rel}`, "utf8");

describe("기본판 설정 RULESET (결정 0072)", () => {
  it("RULESET 은 BASIC_RULESET 과 같은 객체이고 정치 장치 다섯은 모두 꺼짐·확장판 세 플래그는 켜짐이며 얼려 있다 (19-01: 옮기는 동안 기본 판 extended 의 규칙을 가리킨다)", () => {
    expect(RULESET === BASIC_RULESET).toBe(true);
    expect(JSON.stringify(RULESET)).toBe(JSON.stringify({ badge: false, whisper: false, pickTurn: false, runoff: false, showdown: false, errand: true, witness: true, trace: true }));
    expect(Object.isFrozen(BASIC_RULESET)).toBe(true);
  });

  it("분기하는 모듈은 설정을 ./ruleset 에서 가져온다 (설정 값이 한 파일에만 있다)", () => {
    const importers = ["tick.ts", "phases.ts", "nomination.ts", "room.ts"].map((f) => `${f}:${/from "\.\/ruleset"/.test(read(`shared/game/${f}`))}`);
    expect(importers.join(" ")).toBe("tick.ts:true phases.ts:true nomination.ts:true room.ts:true");
    const literal = ["tick.ts", "phases.ts", "nomination.ts", "room.ts"].filter((f) => /\b(pickTurn|runoff|showdown|badge|whisper)\s*:\s*(true|false)\b/.test(read(`shared/game/${f}`)));
    expect(literal.join(",")).toBe("");
  });
  it("방 DO 와 view 는 설정을 RULESET 으로 읽는다 (13-04, 꺼진 메시지·꺼진 view 키)", () => {
    const room = read("worker/room.ts");
    const view = read("shared/game/view.ts");
    expect(`${/import \{[^}]*\bRULESET\b[^}]*\} from "..\/shared\/game\/ruleset"/.test(room)}/${/import \{[^}]*\bRULESET\b[^}]*\} from "\.\/ruleset"/.test(view)}`).toBe("true/true");
  });
  it("화면 모델은 설정을 RULESET 으로 읽는다 (13-04, 떠 있는 버튼·결과 탭 진입점)", () => {
    const has = (rel: string): boolean => /import \{[^}]*\bRULESET\b[^}]*\} from "[^"]*shared\/game\/ruleset"/.test(read(rel));
    expect(["src/game/badgeView.ts", "src/game/whisperView.ts", "src/game/resultText.ts"].map((f) => `${f}:${has(f)}`).join(" ")).toBe(
      "src/game/badgeView.ts:true src/game/whisperView.ts:true src/game/resultText.ts:true",
    );
  });
});
