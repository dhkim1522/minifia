// E2E 순수 도우미(scripts/e2e/lib.mjs)와 앱 상수의 동일성 (05-05, T-05-12).
// 두 목록이 어긋나면 UX1(안내·타이머 검사)이 거짓 통과·거짓 실패한다 — scenes.test.ts 의 EXPECTED_SCENE 비교와 같은 방식.
import { describe, expect, it } from "vitest";
import { candidateRevealMs } from "../../shared/game/phases";
import { TIMELESS_PHASES } from "../../src/game/scenes";
import { BLANK_TAP_SLOP_PX } from "../../src/game/blankTap";
import { EXEC_INTRO_MS, VERDICT_TEXT } from "../../src/game/verdict";
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

describe("E2E 의 시간 사본과 앱 상수 (결정 0039)", () => {
  it("INTRO_GONE_MS = EXEC_INTRO_MS + 200 (측정 여유는 예전과 같다)", () => {
    expect((e2eLib as { INTRO_GONE_MS: number }).INTRO_GONE_MS).toBe(EXEC_INTRO_MS + 200);
  });

  it("candidateRevealMs(n) 사본이 shared/game/phases 와 n = 0..8 에서 같다", () => {
    const copy = (e2eLib as { candidateRevealMs: (n: number) => number }).candidateRevealMs;
    for (let n = 0; n <= 8; n += 1) expect(copy(n)).toBe(candidateRevealMs(n));
  });
});

describe("E2E 의 후보 선택 안내·빈 곳 여유 사본 (결정 0040)", () => {
  it("CANDIDATE_GUIDE 가 VERDICT_TEXT 의 두 안내 문장과 같다", () => {
    const copy = (e2eLib as { CANDIDATE_GUIDE: { none: string; picked: string } }).CANDIDATE_GUIDE;
    expect(copy.none).toBe(VERDICT_TEXT.candidateGuideNone);
    expect(copy.picked).toBe(VERDICT_TEXT.candidateGuidePicked);
  });

  it("BLANK_TAP_E2E_MARGIN 은 앱 여유(BLANK_TAP_SLOP_PX)의 두 배 이상이다 (측정 점이 분명히 빈 곳)", () => {
    expect((e2eLib as { BLANK_TAP_E2E_MARGIN: number }).BLANK_TAP_E2E_MARGIN).toBeGreaterThanOrEqual(2 * BLANK_TAP_SLOP_PX);
  });
});
