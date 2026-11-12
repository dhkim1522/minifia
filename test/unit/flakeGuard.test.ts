// 12-03: 간헐 실패를 덮지 않는다는 정적 가드 (D-26, T-12-08).
// 'ended' 군의 가끔 실패는 원인(편집이 낡은 메모리 방에 덮이는 경합)을 고쳐서 없앴다. skip·todo·재시도·vitest 의 retry 로 덮으면 이후 회귀를 놓치므로
// 시험 파일과 도우미, vitest 설정에 그런 우회가 다시 생기지 않게 소스 문자열로 고정한다(chatStaticGuard.test.ts 와 같은 구조 회귀 시험).
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const ROOT = fileURLToPath(new URL("../../", import.meta.url));

/** 주석을 지운다(설명하는 주석은 허용하고 코드에 남은 우회만 잡는다). 줄 수는 유지한다. */
function code(rel: string): string {
  const src = readFileSync(`${ROOT}${rel}`, "utf8");
  return src.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " ")).replace(/(^|[^:"'`\\])\/\/[^\n]*/g, "$1");
}

const FILES = ["test/worker/testTools.test.ts", "test/worker/helpers.ts", "test/worker/waitHelpers.test.ts", "test/worker/bots.test.ts"];

describe("D-26 간헐 실패를 skip·재시도로 덮지 않는다", () => {
  it("testTools·helpers·waitHelpers·bots 시험에 skip·todo·재시도가 하나도 없다", () => {
    for (const rel of FILES) {
      const src = code(rel);
      // 13-02(결정 0072): 꺼진 장치(판 규칙 — 시험 파일의 GAME_RULES = rulesetOf("extended"))에 묶인 skipIf(!GAME_RULES.x) 는 간헐 실패를 덮는 우회가 아니라 규칙 설정에 따른 조건이라 허용한다. 그 밖의 skip·todo·skipIf 는 그대로 막는다.
      expect(`${rel}:skip:${/\b(?:it|test|describe)\.(?:skip|todo)\b|\b(?:it|test|describe)\.skipIf\((?!\s*!GAME_RULES\.)/.test(src)}`).toBe(`${rel}:skip:false`);
      expect(`${rel}:x:${/\b(?:xit|xtest|xdescribe)\s*\(/.test(src)}`).toBe(`${rel}:x:false`);
      expect(`${rel}:retry:${/\bretry\b|retryTimes/i.test(src)}`).toBe(`${rel}:retry:false`);
    }
  });

  it("vitest 설정에 retry 키가 없다", () => {
    expect(/\bretry\b/i.test(code("vitest.config.ts"))).toBe(false);
  });

  it("'ended' 군(endedRoom)과 driveToEnded 는 그대로 있다 — 시험을 지워서 안정시키지 않았다", () => {
    const tools = code("test/worker/testTools.test.ts");
    expect(tools).toContain("async function endedRoom()");
    expect(tools.match(/await endedRoom\(\)/g)?.length ?? 0).toBeGreaterThanOrEqual(2);
    expect(code("test/worker/helpers.ts")).toContain("export async function driveToEnded(");
  });

  it("한도를 늘려서 덮지 않았다 — 전이 대기 한도는 도우미 한 곳의 상수 하나이고 08-11 의 10초 그대로다", () => {
    const helpers = code("test/worker/helpers.ts");
    expect(helpers.match(/export const TRANSITION_WAIT_MS = (\d|_)+;/g)).toEqual(["export const TRANSITION_WAIT_MS = 10_000;"]);
  });
});
