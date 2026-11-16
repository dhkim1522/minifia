// 판결 순간 시간표 순수 모듈 시험 — UI-SPEC C-1·P22-13·P22-14, 결정 D-27. 처형 단계 진입 시각 T 기준 ms.
// 찬반 묶음(yes·no·end)은 없다(D-14) — 어둡게 막·줌·핀이 [0, PIN_OFF_EXEC_AT) 창이고 줌은 창이 끝날 때 0.6초에 1 로 돌아온다.
import { describe, expect, it } from "vitest";
import { EXECUTION_MS, PIN_OFF_EXEC_AT, WILL_REVEAL_MS } from "../../shared/game/phases";
import type { RoomView } from "../../shared/protocol";
import * as moment from "../../src/game/verdictMoment";
import { DARKEN_ALPHA, executionStartOf, momentAt, VERDICT_ZOOM, ZOOM_BACK_MS, ZOOM_IN_MS } from "../../src/game/verdictMoment";

describe("verdictMoment — 상수", () => {
  it("UI-SPEC 시간표 값", () => {
    expect(VERDICT_ZOOM).toBe(1.1);
    expect(DARKEN_ALPHA).toBe(0.45);
    expect(ZOOM_IN_MS).toBe(600);
    expect(ZOOM_BACK_MS).toBe(600);
  });

  it("처형 시간표는 phases.ts 한 표에서 나온다", () => {
    expect(EXECUTION_MS).toBe(6600);
    expect(PIN_OFF_EXEC_AT).toBe(6000);
    expect(PIN_OFF_EXEC_AT + ZOOM_BACK_MS).toBe(EXECUTION_MS);
    expect(WILL_REVEAL_MS).toBe(3000);
  });

  it("찬반 묶음 상수가 없다(D-14)", () => {
    for (const key of ["BALLOT_YES_AT", "BALLOT_NO_AT", "BALLOT_END_AT", "PIN_OFF_NO_EXEC_AT"]) expect(key in moment).toBe(false);
  });
});

describe("executionStartOf", () => {
  const v = (phaseEndsAt: number | null) => ({ phaseEndsAt }) as RoomView;
  it("phaseEndsAt − EXECUTION_MS", () => {
    expect(executionStartOf(v(100_000))).toBe(100_000 - EXECUTION_MS);
  });
  it("phaseEndsAt 가 null 이면 null", () => {
    expect(executionStartOf(v(null))).toBeNull();
  });
});

describe("momentAt", () => {
  it("T=0: 막·핀이 켜지고 줌은 1 — 반환 키는 darken·zoom·pin 뿐", () => {
    expect(momentAt(0)).toEqual({ darken: true, zoom: 1, pin: true });
  });

  it("음수 시각은 0 으로 본다", () => {
    expect(momentAt(-500)).toEqual(momentAt(0));
  });

  it("줌: 600ms 에 1 → 1.10, 중간은 그 사이이고 단조 증가", () => {
    expect(momentAt(600).zoom).toBeCloseTo(1.1, 10);
    expect(momentAt(300).zoom).toBeCloseTo(1.05, 10);
    let prev = 1;
    for (let t = 0; t <= 600; t += 50) {
      const z = momentAt(t).zoom;
      expect(z).toBeGreaterThanOrEqual(prev);
      prev = z;
    }
  });

  it("줌은 600~6000 에 1.10 을 유지하고 6000 부터 600ms 에 1 로 돌아온다", () => {
    expect(momentAt(3000).zoom).toBe(VERDICT_ZOOM);
    expect(momentAt(5999).zoom).toBe(VERDICT_ZOOM);
    expect(momentAt(6000).zoom).toBe(VERDICT_ZOOM);
    expect(momentAt(6300).zoom).toBeCloseTo(1.05, 10);
    expect(momentAt(6600).zoom).toBe(1);
  });

  it("막(darken)·핀은 [0, 6000) 창, 6000 이후 모두 꺼진다", () => {
    expect(momentAt(5999)).toMatchObject({ darken: true, pin: true });
    expect(momentAt(6000)).toMatchObject({ darken: false, pin: false });
    expect(momentAt(6600)).toMatchObject({ darken: false, pin: false });
  });
});
