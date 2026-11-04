// 판결 순간 시간표 순수 모듈 시험 — UI-SPEC C-1, 결정 0066-7. 처형 단계 진입 시각 T 기준 ms.
import { describe, expect, it } from "vitest";
import { EXECUTION_MS, VERDICT_LEAD_MS } from "../../shared/game/phases";
import type { RoomView } from "../../shared/protocol";
import {
  BALLOT_END_AT,
  BALLOT_NO_AT,
  BALLOT_YES_AT,
  DARKEN_ALPHA,
  executionStartOf,
  momentAt,
  PIN_OFF_EXEC_AT,
  PIN_OFF_NO_EXEC_AT,
  VERDICT_ZOOM,
  ZOOM_BACK_MS,
  ZOOM_IN_MS,
} from "../../src/game/verdictMoment";

describe("verdictMoment — 상수", () => {
  it("UI-SPEC 시간표 값", () => {
    expect(VERDICT_ZOOM).toBe(1.1);
    expect(BALLOT_YES_AT).toBe(600);
    expect(BALLOT_NO_AT).toBe(1000);
    expect(BALLOT_END_AT).toBe(4600);
    expect(PIN_OFF_NO_EXEC_AT).toBe(4000);
    expect(PIN_OFF_EXEC_AT).toBe(5000);
    expect(DARKEN_ALPHA).toBe(0.45);
    expect(ZOOM_IN_MS).toBe(600);
    expect(ZOOM_BACK_MS).toBe(600);
  });

  it("서버 판결 앞머리와 어긋나지 않는다", () => {
    expect(BALLOT_YES_AT).toBe(VERDICT_LEAD_MS);
    expect(EXECUTION_MS).toBe(5600);
    expect(PIN_OFF_EXEC_AT).toBeLessThanOrEqual(EXECUTION_MS);
    expect(BALLOT_END_AT + ZOOM_BACK_MS).toBeLessThanOrEqual(EXECUTION_MS);
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
  it("T=0: 막·핀이 켜지고 줌은 1, 묶음은 아직 없다", () => {
    expect(momentAt(0, true)).toEqual({ darken: true, zoom: 1, yes: false, no: false, pin: true, end: false });
  });

  it("음수 시각은 0 으로 본다", () => {
    expect(momentAt(-500, false)).toEqual(momentAt(0, false));
  });

  it("줌: 600ms 에 1 → 1.10, 중간은 그 사이이고 단조 증가", () => {
    expect(momentAt(600, true).zoom).toBeCloseTo(1.1, 10);
    expect(momentAt(300, true).zoom).toBeCloseTo(1.05, 10);
    let prev = 1;
    for (let t = 0; t <= 600; t += 50) {
      const z = momentAt(t, true).zoom;
      expect(z).toBeGreaterThanOrEqual(prev);
      prev = z;
    }
  });

  it("줌은 600~4600 에 1.10 을 유지하고 4600 부터 600ms 에 1 로 돌아온다", () => {
    expect(momentAt(2000, true).zoom).toBe(VERDICT_ZOOM);
    expect(momentAt(4599, true).zoom).toBe(VERDICT_ZOOM);
    expect(momentAt(4600, true).zoom).toBe(VERDICT_ZOOM);
    expect(momentAt(4900, true).zoom).toBeCloseTo(1.05, 10);
    expect(momentAt(5200, true).zoom).toBe(1);
    expect(momentAt(5600, true).zoom).toBe(1);
  });

  it("찬성 묶음은 0.6초, 반대 묶음은 1.0초부터", () => {
    expect(momentAt(599, true).yes).toBe(false);
    expect(momentAt(600, true).yes).toBe(true);
    expect(momentAt(999, true).no).toBe(false);
    expect(momentAt(1000, true).no).toBe(true);
    expect(momentAt(1000, true).yes).toBe(true);
  });

  it("막(darken)은 0 ≤ t < 4600, end 는 t ≥ 4600", () => {
    expect(momentAt(4599, true)).toMatchObject({ darken: true, end: false });
    expect(momentAt(4600, true)).toMatchObject({ darken: false, end: true });
  });

  it("핀: 부결 4.0초, 처형 5.0초에 꺼진다", () => {
    expect(momentAt(3999, false).pin).toBe(true);
    expect(momentAt(4000, false).pin).toBe(false);
    expect(momentAt(4999, true).pin).toBe(true);
    expect(momentAt(5000, true).pin).toBe(false);
  });
});
