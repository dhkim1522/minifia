import { readFileSync, statSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { PhaseId } from "../../shared/protocol";
import { lightingOf } from "../../src/world/presence";
import { ASSET_VERSION } from "../../src/net/assets";
import { TOD_LABEL, TOD_ORDER, todOf, todSrc, type TimeOfDay } from "../../src/game/timeOfDay";

// 18.1-03(R4, P181-5, UI-SPEC D 계약 3): 시간대 그림은 공개 단계 하나로 정한다. 모든 PhaseId 를 표로 고정한다.
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

  it("라벨·순서·주소", () => {
    expect(TOD_LABEL).toEqual({ morning: "아침", day: "낮", dusk: "저녁", night: "밤" });
    expect(TOD_ORDER).toEqual(["morning", "day", "dusk", "night"]);
    expect(todSrc("day")).toBe(`/weather/weather-day.svg?v=${ASSET_VERSION}`);
  });
});

// D3: 날씨 에셋은 사용자 원본 그대로 — 정사각·가볍고·외부 참조 없음·큰 원본 사본과 바이트가 같다.
describe("날씨 에셋 계약 (D3)", () => {
  for (const tod of ["morning", "day", "dusk", "night"] as const) {
    const file = `public/weather/weather-${tod}.svg`;
    it(`${tod}: 정사각 viewBox·≤ 8KB·외부 참조·script 없음·원본 사본과 같다`, () => {
      expect(statSync(file).size).toBeLessThanOrEqual(8192);
      const svg = readFileSync(file, "utf8");
      const vb = /viewBox="0 0 (\d+(?:\.\d+)?) (\d+(?:\.\d+)?)"/.exec(svg);
      expect(vb, "viewBox").not.toBeNull();
      expect(vb![1]).toBe(vb![2]);
      for (const bad of ["<script", "href", "<image", "<style", "<animate", "@keyframes", "<text"]) expect(svg, bad).not.toContain(bad);
      for (const m of svg.matchAll(/url\(/g)) expect(svg.slice(m.index!, m.index! + 5)).toBe("url(#");
      expect(readFileSync(file).equals(readFileSync(`design/v3.0/weather/weather-${tod}.svg`))).toBe(true);
    });
  }
});
