import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { PhaseId } from "../../shared/protocol";
import { lightingOf } from "../../src/world/presence";
import { TOD_LABEL, TOD_ORDER, todOf, todWordOf, type TimeOfDay } from "../../src/game/timeOfDay";

// 18.1-11(결정 0083-1): 헤더 시간대는 공개 단계 하나로 정한 글자다. 모든 PhaseId 를 표로 고정한다.
const EXPECT: Record<PhaseId, TimeOfDay> = {
  lobby: "day",
  tutorial: "day",
  assigning: "day",
  roleReveal: "day",
  dayAnnounce: "day",
  errand: "day",
  discussion: "day",
  nomination: "dusk",
  runoff: "dusk",
  showdown: "dusk",
  verdict: "dusk",
  defense: "dusk",
  execution: "dusk",
  night: "night",
  morning: "morning",
  ended: "day",
};

describe("시간대 표 (todOf, D 계약 3)", () => {
  it("모든 단계가 기대표와 같다", () => {
    for (const phase of Object.keys(EXPECT) as PhaseId[]) {
      expect(todOf(phase), phase).toBe(EXPECT[phase]);
    }
  });

  it("장면 조명과 어긋나지 않는다 — talk→day, vote·trial→dusk, night→night, morning→morning", () => {
    const byLight = { talk: "day", vote: "dusk", trial: "dusk", night: "night", nightCitizen: "night", nightGhost: "night", morning: "morning" } as const;
    for (const phase of Object.keys(EXPECT) as PhaseId[]) {
      expect(todOf(phase), phase).toBe(byLight[lightingOf(phase)]);
    }
  });

  it("라벨·순서", () => {
    expect(TOD_LABEL).toEqual({ morning: "아침", day: "낮", dusk: "저녁", night: "밤" });
    expect(TOD_ORDER).toEqual(["morning", "day", "dusk", "night"]);
  });
});

describe("헤더 시간대 낱말 (todWordOf, 결정 0083-1)", () => {
  it("낮·저녁은 낱말이 있다", () => {
    expect(todWordOf("discussion", "토론")).toBe("낮");
    expect(todWordOf("dayAnnounce", "토론")).toBe("낮");
    expect(todWordOf("errand", "심부름")).toBe("낮");
    expect(todWordOf("nomination", "투표")).toBe("저녁");
    expect(todWordOf("runoff", "결선")).toBe("저녁");
    expect(todWordOf("defense", "최후 변론")).toBe("저녁");
    expect(todWordOf("verdict", "찬반")).toBe("저녁");
    expect(todWordOf("execution", "처형")).toBe("저녁");
  });

  it("밤·아침은 단계 이름이 같은 낱말이라 한 단어다(null)", () => {
    expect(todWordOf("night", "밤")).toBeNull();
    expect(todWordOf("morning", "아침")).toBeNull();
  });
});

describe("날씨 배지 삭제 (0083-1)", () => {
  it("public/weather 폴더가 없고 _headers 에 날씨 캐시 규칙이 없다", () => {
    expect(existsSync("public/weather")).toBe(false);
    expect(readFileSync("public/_headers", "utf8")).not.toContain("weather");
  });
});
