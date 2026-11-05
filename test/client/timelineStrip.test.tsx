import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import "../helpers/singleLineErrors";
import { TimelineStrip } from "../../src/components/v2/TimelineStrip";
import { timelineOf } from "../../src/game/timelineView";
import { tlLog, tlView, TL_NAMES } from "../helpers/timelineState";

afterEach(cleanup);

// 일차 카드 띠 (11-11, 결정 D-8, UI-SPEC C). 카드 72×112 는 CSS 가 정하고(E2E 가 실제 좌표를 잰다), 여기서는 구조·표식·선택을 본다.
const cards = timelineOf(tlView(), tlLog());
function setup(selected = 1) {
  const onSelect = vi.fn();
  const r = render(<TimelineStrip cards={cards} selected={selected} onSelect={onSelect} contacts={TL_NAMES} />);
  const card = (n: number) => r.container.querySelector<HTMLElement>(`[data-day-card="${n}"]`)!;
  return { ...r, onSelect, card };
}

describe("TimelineStrip (D-8)", () => {
  it("카드가 일차 수만큼, data-day-card 와 aria-pressed 로 그려지고 선택한 카드만 눌린 상태다", () => {
    const { container, card } = setup(1);
    expect(container.querySelectorAll("[data-day-card]")).toHaveLength(3);
    expect(card(1).getAttribute("aria-pressed")).toBe("true");
    expect(card(2).getAttribute("aria-pressed")).toBe("false");
    expect(card(3).getAttribute("aria-pressed")).toBe("false");
  });

  it("카드를 누르면 onSelect(n)", () => {
    const { card, onSelect } = setup(1);
    fireEvent.click(card(2));
    expect(onSelect).toHaveBeenCalledWith(2);
  });

  it("카드 위에 일차 숫자가 있다 (글자는 숫자뿐)", () => {
    const { container } = setup();
    const nums = Array.from(container.querySelectorAll(".mf-tl__num")).map((e) => e.textContent);
    expect(nums).toEqual(["1", "2", "3"]);
    expect((container.textContent ?? "").replace(/[\d\s]/g, "")).toBe("");
  });

  it("낮 칸: 처형된 사람 얼굴 + 진짜 직업 칩(소형), 처형 없음이면 quiet 아이콘", () => {
    const { card } = setup();
    const d1 = card(1).querySelector("[data-half=day]")!;
    expect(d1.getAttribute("data-kind")).toBe("executed");
    expect(d1.querySelector("img")?.getAttribute("alt")).toBe("서연");
    expect(d1.querySelector("[data-role-chip]")?.getAttribute("data-role-chip")).toBe("citizen");
    const d2 = card(2).querySelector("[data-half=day]")!;
    expect(d2.getAttribute("data-kind")).toBe("none");
    expect(d2.querySelector("img")).toBeNull();
    expect(d2.querySelector("[data-role-chip]")).toBeNull();
    expect(d2.querySelector("svg")).not.toBeNull();
    const d3 = card(3).querySelector("[data-half=day]")!;
    expect(d3.querySelector("[data-role-chip]")?.getAttribute("data-role-chip")).toBe("mafia");
  });

  it("밤 칸: 지킨 밤은 얼굴 + heal, 죽은 밤은 어두운 얼굴 + ghost, 마지막이 낮에 끝났으면 비어 있다", () => {
    const { card } = setup();
    const n1 = card(1).querySelector("[data-half=night]")!;
    expect(n1.getAttribute("data-kind")).toBe("saved");
    expect(n1.querySelector("img")?.getAttribute("alt")).toBe("민지");
    expect(n1.querySelector("[data-night-mark=heal]")).not.toBeNull();
    const n2 = card(2).querySelector("[data-half=night]")!;
    expect(n2.getAttribute("data-kind")).toBe("died");
    expect(n2.querySelector("img.is-dead")).not.toBeNull();
    expect(n2.querySelector("[data-night-mark=ghost]")).not.toBeNull();
    const n3 = card(3).querySelector("[data-half=night]")!;
    expect(n3.getAttribute("data-kind")).toBe("empty");
    expect(n3.querySelector("img, svg")).toBeNull();
  });

  it("지목 없는 밤은 quiet", () => {
    const only = timelineOf({ ...tlView(), result: { ...tlView().result, summary: [{ n: 1, night: { died: false } }] } }, tlLog());
    const { container } = render(<TimelineStrip cards={only} selected={1} onSelect={() => {}} contacts={TL_NAMES} />);
    const n = container.querySelector("[data-half=night]")!;
    expect(n.getAttribute("data-kind")).toBe("none");
    expect(n.querySelector("img")).toBeNull();
    expect(n.querySelector("svg")).not.toBeNull();
  });

  it("카드는 접근성 이름을 가진다 (닉네임·직업 이름은 속성으로만)", () => {
    const { card } = setup();
    expect(card(1).getAttribute("aria-label")).toContain("서연");
  });
});
