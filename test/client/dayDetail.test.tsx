import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import "../helpers/singleLineErrors";
import { DayDetail } from "../../src/components/v2/DayDetail";
import { dayLinesOf } from "../../src/game/timelineView";
import { tlLog, tlView, TL_NAMES } from "../helpers/timelineState";

afterEach(cleanup);

// 하루 상세 (11-11, 결정 D-8·D-9, 0066-1). 모든 줄이 얼굴·아이콘·숫자 — 보이는 글자는 숫자뿐이다.
function setup(n: number, log = tlLog()) {
  const onJumpWhisper = vi.fn();
  const lines = dayLinesOf(tlView(), log, n);
  const r = render(<DayDetail lines={lines} contacts={TL_NAMES} onJumpWhisper={onJumpWhisper} />);
  return { ...r, onJumpWhisper, detail: r.container.querySelector<HTMLElement>(`[data-day-detail="${n}"]`)! };
}
const alts = (el: Element | null | undefined) => Array.from(el?.querySelectorAll("img") ?? []).map((i) => i.getAttribute("alt"));
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

describe("DayDetail — 찬반 (D-8)", () => {
  it("thumbUp 찬성 얼굴들 / thumbDown 반대 얼굴들", () => {
    const { detail } = setup(1);
    const ballots = row(detail, "ballots")!;
    expect(alts(ballots.querySelector("[data-ballot=yes]"))).toEqual(["민지", "도현", "지우", "수빈"]);
    expect(alts(ballots.querySelector("[data-ballot=no]"))).toEqual(["하윤"]);
    expect(ballots.querySelector("[data-ballot=yes] svg")).not.toBeNull();
    expect(ballots.querySelector("[data-ballot=no] svg")).not.toBeNull();
  });
  it("찬반 기록이 없는 날은 줄이 없다", () => {
    const { detail } = setup(3);
    expect(row(detail, "ballots")).toBeNull();
  });
  it("반대가 없으면 반대 묶음은 그리지 않는다", () => {
    const { detail } = setup(1, tlLog({ ballots: { lines: [{ n: 1, yes: [1, 2], no: [] }], complete: true } }));
    expect(detail.querySelector("[data-ballot=no]")).toBeNull();
    expect(detail.querySelector("[data-ballot=yes]")).not.toBeNull();
  });
});

describe("DayDetail — 주장 (D-8, D-9, 0067-3)", () => {
  it("산 사람마다 얼굴 + 주장 직업 칩, 거짓(마피아의 다른 직업 주장)만 is-lie (진홍 점선)", () => {
    const { detail } = setup(1);
    const claims = Array.from(detail.querySelectorAll<HTMLElement>("[data-claim]"));
    expect(claims.map((c) => c.getAttribute("data-claim"))).toEqual(["0", "2", "4"]);
    expect(claims.map((c) => c.querySelector("[data-role-chip]")?.getAttribute("data-role-chip"))).toEqual(["citizen", "police", "police"]);
    expect(claims.map((c) => c.getAttribute("data-lie"))).toEqual(["true", "false", "false"]);
    expect(claims.map((c) => c.classList.contains("is-lie"))).toEqual([true, false, false]);
    expect(alts(claims[0]!)).toEqual(["지우"]);
  });
  it("시민이 경찰을 주장해도 점선 없음 (마피아 아님)", () => {
    const four = detail1().querySelector('[data-claim="4"]')!;
    expect(four.classList.contains("is-lie")).toBe(false);
  });
  it("주장한 사람이 없으면 줄이 없다", () => {
    const { detail } = setup(1, tlLog({ claim: { lines: [], complete: true } }));
    expect(row(detail, "claims")).toBeNull();
  });
});

function detail1() {
  return setup(1).detail;
}

describe("DayDetail — 말 바꿈 (D-8)", () => {
  it("그날 주장을 바꾼 얼굴에 swap 아이콘", () => {
    const { detail } = setup(2);
    const swaps = row(detail, "swaps")!;
    expect(alts(swaps)).toEqual(["지우"]);
    expect(swaps.querySelector("[data-swap] svg")).not.toBeNull();
  });
  it("바꾼 사람이 없으면 줄이 없다", () => {
    expect(row(setup(1).detail, "swaps")).toBeNull();
  });
});

describe("DayDetail — 귓속말 (D-8)", () => {
  it("그날 건수만큼 얼굴 → 얼굴 쌍, 쌍마다 data-whisper-pair", () => {
    const { detail } = setup(1);
    const pairs = Array.from(detail.querySelectorAll<HTMLElement>("[data-whisper-pair]"));
    expect(pairs).toHaveLength(2);
    expect(alts(pairs[0]!)).toEqual(["민지", "도현"]);
    expect(alts(pairs[1]!)).toEqual(["지우", "하윤"]);
    expect(pairs[0]!.tagName).toBe("BUTTON");
  });
  it("쌍을 누르면 onJumpWhisper(n)", () => {
    const { detail, onJumpWhisper } = setup(2);
    fireEvent.click(detail.querySelector("[data-whisper-pair]")!);
    expect(onJumpWhisper).toHaveBeenCalledWith(2);
  });
  it("귓속말이 없는 날은 줄이 없다", () => {
    expect(row(setup(3).detail, "whispers")).toBeNull();
  });
});

describe("DayDetail — 밤 (D-8)", () => {
  it("마피아 얼굴들 → 대상 얼굴 + 결과 아이콘(heal 구출 · ghost 죽음)", () => {
    const n1 = row(setup(1).detail, "night")!;
    expect(alts(n1.querySelector("[data-from]"))).toEqual(["지우", "하윤"]);
    expect(alts(n1.querySelector("[data-to]"))).toEqual(["민지"]);
    expect(n1.querySelector("[data-night-result=saved] svg")).not.toBeNull();
    const n2 = row(setup(2).detail, "night")!;
    expect(alts(n2.querySelector("[data-to]"))).toEqual(["도현"]);
    expect(n2.querySelector("[data-night-result=died] svg")).not.toBeNull();
  });
  it("마지막 일차가 낮에 끝났으면 밤 줄이 없다", () => {
    expect(row(setup(3).detail, "night")).toBeNull();
  });
  it("무지목 밤은 quiet 결과", () => {
    const lines = dayLinesOf({ ...tlView(), result: { ...tlView().result, summary: [{ n: 1, night: { died: false } }] } }, tlLog(), 1);
    const { container } = render(<DayDetail lines={lines} contacts={TL_NAMES} />);
    const n = row(container, "night")!;
    expect(n.querySelector("[data-night-result=none] svg")).not.toBeNull();
    expect(n.querySelector("[data-to]")).toBeNull();
  });
});

describe("DayDetail — 문장 없음 (D-8, 결정 0051)", () => {
  it.each([1, 2, 3])("%i일차: 보이는 글자는 숫자뿐 (숫자·공백을 지우면 빈 문자열)", (n) => {
    expect(noWords(setup(n).detail)).toBe("");
  });
  it("닉네임·직업 이름은 img alt·aria-label 로만 — textContent 에 없다", () => {
    const text = setup(1).detail.textContent ?? "";
    for (const name of ["지우", "하윤", "민지", "도현", "서연", "수빈", "시민", "경찰"]) expect(text).not.toContain(name);
  });
  it("닉네임에 마크업이 있어도 요소가 만들어지지 않는다", () => {
    const evil = new Map([...TL_NAMES, [4, '<b id="x">서연</b>']]);
    const r = render(<DayDetail lines={dayLinesOf(tlView(), tlLog(), 1)} contacts={evil} />);
    expect(r.container.querySelector("#x")).toBeNull();
  });
});
