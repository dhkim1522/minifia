import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import "../helpers/singleLineErrors";
import { DayDetail } from "../../src/components/v2/DayDetail";
import { dayLinesOf } from "../../src/game/timelineView";
import { tlLog, tlView, TL_NAMES } from "../helpers/timelineState";

afterEach(cleanup);

// 하루 상세 (11-11, 결정 D-8·D-9, 0066-1). 모든 줄이 얼굴·아이콘·숫자 — 보이는 글자는 숫자뿐이다.
function setup(n: number) {
  const lines = dayLinesOf(tlView(), tlLog(), n);
  const r = render(<DayDetail lines={lines} contacts={TL_NAMES} />);
  return { ...r, detail: r.container.querySelector<HTMLElement>(`[data-day-detail="${n}"]`)! };
}
const row = (c: ParentNode, name: string) => c.querySelector<HTMLElement>(`[data-row="${name}"]`);
const noWords = (el: Element) => (el.textContent ?? "").replace(/[\d\s]/g, "");

describe("DayDetail — 지목 줄 (D-8)", () => {
  it("data-day-detail 에 일차가 붙는다", () => {
    const { detail } = setup(1);
    expect(detail).not.toBeNull();
  });

  it("지목 줄: 받은 사람마다 그 사람을 지목한 얼굴들 → 받은 얼굴, 받은 사람 위에 득표 숫자", () => {
    const { detail } = setup(1);
    const pointing = row(detail, "pointing")!;
    const groups = Array.from(pointing.querySelectorAll<HTMLElement>("[data-point-group]"));
    expect(groups.map((g) => g.getAttribute("data-point-group"))).toEqual(["4", "2"]);
    const g4 = groups[0]!;
    expect(Array.from(g4.querySelectorAll("[data-from] img")).map((i) => i.getAttribute("alt"))).toEqual(["민지", "도현", "지우", "수빈"]);
    expect(g4.querySelector("[data-to] img")?.getAttribute("alt")).toBe("서연");
    expect(g4.querySelector("[data-votes]")?.textContent).toBe("4");
    expect(groups[1]!.querySelector("[data-votes]")?.textContent).toBe("2");
  });

  it("보이는 글자는 숫자뿐 — 득표 배지에 '표' 같은 단위가 없다", () => {
    const { detail } = setup(1);
    expect(noWords(detail)).toBe("");
  });

  it("지목 기록이 없는 일차는 지목 줄이 없다", () => {
    const lines = dayLinesOf(tlView({ day: { voteLog: [] } }), tlLog(), 1);
    const { container } = render(<DayDetail lines={lines} contacts={TL_NAMES} />);
    expect(row(container, "pointing")).toBeNull();
  });
});
