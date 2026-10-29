// E2E 순수 도우미(scripts/e2e/lib.mjs)와 앱 상수의 동일성 (05-05, T-05-12).
// 두 목록이 어긋나면 UX1(안내·타이머 검사)이 거짓 통과·거짓 실패한다 — scenes.test.ts 의 EXPECTED_SCENE 비교와 같은 방식.
import { describe, expect, it } from "vitest";
import { TIMELESS_PHASES } from "../../src/game/scenes";
// 타입 선언이 없는 .mjs 다(allowJs 없음).
// @ts-expect-error -- 선언 없는 스크립트 모듈
import * as e2eLib from "../../scripts/e2e/lib.mjs";

describe("E2E 의 TIMELESS_PHASES 와 앱 상수", () => {
  it("scripts/e2e/lib.mjs 의 TIMELESS_PHASES 가 src/game/scenes.ts 의 같은 이름 상수와 같은 목록이다", () => {
    const e2e = (e2eLib as { TIMELESS_PHASES: readonly string[] }).TIMELESS_PHASES;
    expect(Array.isArray(e2e)).toBe(true);
    expect([...e2e].sort()).toEqual([...TIMELESS_PHASES].sort());
    expect(e2e.length).toBe(TIMELESS_PHASES.length);
  });
});
