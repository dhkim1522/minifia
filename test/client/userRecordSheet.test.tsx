/// <reference types="node" />
import { readFileSync } from "node:fs";
import { cleanup, fireEvent, render, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import "../helpers/singleLineErrors";
import type { ClaimLogEntry } from "../../shared/protocol";
import { UserRecordSheet } from "../../src/components/UserRecordSheet";
import sheetSource from "../../src/components/UserRecordSheet.tsx?raw";

// 유저 기록 카드(03.1 UI-SPEC C, D-06). 입력은 공개 정보 claimLog 와 그 사람의 seat·닉네임뿐이다(D-19).

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const LOG: ClaimLogEntry[] = [
  { n: 1, seat: 1, claim: "police" },
  { n: 1, seat: 2, claim: "mafia" },
  { n: 2, seat: 1, claim: "none" },
  { n: 2, seat: 2, claim: "citizen" },
  { n: 3, seat: 1, claim: "doctor" },
  { n: 3, seat: 3, claim: "mafia" },
];

function open(over: Partial<{ seat: number; nickname: string; claimLog: readonly ClaimLogEntry[]; onClose: () => void }> = {}) {
  const props = { seat: 1, nickname: "하윤", claimLog: LOG, onClose: () => {}, ...over };
  return render(<UserRecordSheet {...props} />);
}

const rows = (c: HTMLElement) => [...c.querySelectorAll(".mf-urecord__row")];
const rowText = (li: Element) => [li.querySelector(".mf-urecord__day")?.textContent ?? "", li.querySelector(".mf-urecord__text")?.textContent ?? ""];

describe("UserRecordSheet — 시트 틀·제목 (UI-SPEC C)", () => {
  it("dialog 이름이 `{닉네임} 기록` 이고 제목 한 줄은 색깔점 + 닉네임, 닫기 버튼이 있다", () => {
    const { container } = open({ seat: 1, nickname: "하윤" });
    const dlg = container.querySelector("dialog");
    expect(dlg?.getAttribute("aria-label")).toBe("하윤 기록");
    const h = container.querySelector("h2.mf-urecord__title");
    expect(h?.textContent).toBe("하윤");
    const dot = h?.querySelector("i.mf-urecord__dot") as HTMLElement | null;
    expect(dot?.getAttribute("aria-hidden")).toBe("true");
    expect(dot?.style.background).toContain("--seat-2");
    expect(within(container).getByRole("button", { name: "닫기" }) !== null).toBe(true);
    expect(container.querySelector(".mf-sheet--urecord") !== null).toBe(true);
  });

  it("색깔점은 seat % 8 + 1 번 토큰을 쓴다(seat 9 → --seat-2)", () => {
    const { container } = open({ seat: 9 });
    expect((container.querySelector(".mf-urecord__dot") as HTMLElement).style.background).toContain("--seat-2");
  });

  it("닫기를 누르면 닫는 애니메이션 뒤 onClose 가 한 번 불린다", () => {
    vi.useFakeTimers();
    const onClose = vi.fn();
    const { container } = open({ onClose });
    fireEvent.click(within(container).getByRole("button", { name: "닫기" }));
    expect(onClose).not.toHaveBeenCalled();
    vi.advanceTimersByTime(400);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe("UserRecordSheet — 행 (날짜별 주장)", () => {
  it("그 seat 의 줄만, 일차 내림차순(최신 위)으로 `N일차` | 문장", () => {
    const { container } = open({ seat: 1 });
    expect(rows(container).map(rowText)).toEqual([
      ["3일차", "의사라고 주장했어요"],
      ["2일차", "말하지 않았어요"],
      ["1일차", "경찰이라고 주장했어요"],
    ]);
  });

  it("직업명은 굵은 b 이고 조사는 CLAIM_JOSA 표(마피아 라고·경찰 이라고·의사 라고·시민 이라고)", () => {
    const log: ClaimLogEntry[] = [
      { n: 1, seat: 1, claim: "mafia" },
      { n: 2, seat: 1, claim: "police" },
      { n: 3, seat: 1, claim: "doctor" },
      { n: 4, seat: 1, claim: "citizen" },
    ];
    const { container } = open({ claimLog: log });
    const texts = rows(container).map((li) => rowText(li)[1]);
    expect(texts).toEqual(["시민이라고 주장했어요", "의사라고 주장했어요", "경찰이라고 주장했어요", "마피아라고 주장했어요"]);
    const bolds = rows(container).map((li) => li.querySelector(".mf-urecord__text b")?.textContent);
    expect(bolds).toEqual(["시민", "의사", "경찰", "마피아"]);
  });

  it("말 안 함 행은 b 가 없고 gray-300 문장 `말하지 않았어요`", () => {
    const { container } = open({ claimLog: [{ n: 1, seat: 1, claim: "none" }] });
    const li = rows(container)[0]!;
    expect(rowText(li)).toEqual(["1일차", "말하지 않았어요"]);
    expect(li.querySelector("b")).toBeNull();
    expect(li.classList.contains("mf-urecord__row--none")).toBe(true);
  });

  it("같은 일차에 줄이 여럿이면 기록 역순(나중 줄이 위)이다", () => {
    const log: ClaimLogEntry[] = [
      { n: 2, seat: 1, claim: "mafia" },
      { n: 2, seat: 1, claim: "citizen" },
    ];
    const { container } = open({ claimLog: log });
    expect(rows(container).map((li) => rowText(li)[1])).toEqual(["시민이라고 주장했어요", "마피아라고 주장했어요"]);
  });

  it("입력 배열을 바꾸지 않는다", () => {
    const copy = JSON.stringify(LOG);
    open({ seat: 1 });
    expect(JSON.stringify(LOG)).toBe(copy);
  });

  it("다른 seat 의 줄은 들어가지 않는다", () => {
    const { container } = open({ seat: 3 });
    expect(rows(container).map(rowText)).toEqual([["3일차", "마피아라고 주장했어요"]]);
  });
});

describe("UserRecordSheet — 빈 상태·금지", () => {
  it("기록이 없으면 목록 면은 그대로 두고 `아직 주장 기록이 없어요` 한 줄", () => {
    const { container } = open({ seat: 0 });
    expect(container.querySelector("ol.mf-urecord__list") !== null).toBe(true);
    expect(rows(container).length).toBe(0);
    const empty = container.querySelectorAll(".mf-urecord__empty");
    expect(empty.length).toBe(1);
    expect(empty[0]?.textContent).toBe("아직 주장 기록이 없어요");
  });

  it("기록이 있으면 빈 상태 줄이 없다", () => {
    const { container } = open({ seat: 1 });
    expect(container.querySelector(".mf-urecord__empty")).toBeNull();
  });

  it("투표 칸·추가 줄이 없고 다른 말(처형·탈락)을 쓰지 않는다", () => {
    const { container } = open({ seat: 1 });
    const text = container.textContent ?? "";
    expect(text.includes("처형")).toBe(false);
    expect(text.includes("탈락")).toBe(false);
    expect(text.includes("투표")).toBe(false);
    expect(container.querySelectorAll("li").length).toBe(3);
  });

  it("닉네임·주장 문장은 글자로만 그린다 (T-03.1-23)", () => {
    const { container } = open({ nickname: "<img src=x onerror=alert(1)>" });
    expect(container.querySelector(".mf-urecord__title img")).toBeNull();
    expect(container.querySelector("h2")?.textContent).toBe("<img src=x onerror=alert(1)>");
    expect(container.querySelectorAll(".mf-urecord__text b").length).toBe(2); // 주장이 있는 두 줄(경찰·의사)
  });
});

describe("UserRecordSheet — 입력은 공개 정보뿐 (D-19, T-03.1-22)", () => {
  it("소스가 spectate·me.role·RoomView 를 쓰지 않고 `처형` 도 없다", () => {
    const code = sheetSource.replace(/\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");
    expect(/spectate/.test(code)).toBe(false);
    expect(/\bme\.role\b/.test(code)).toBe(false);
    expect(/RoomView/.test(code)).toBe(false);
    expect(sheetSource.includes("처형")).toBe(false);
  });
});

describe("urecord.css 규약 (UI-SPEC C)", () => {
  // vitest 는 CSS 를 처리하지 않아 css?raw 가 빈 문자열이 된다 — 파일을 직접 읽는다.
  const css = readFileSync("src/styles/urecord.css", "utf8");
  const noComments = css.replace(/\/\*[\s\S]*?\*\//g, "");

  it("행 격자 64px minmax(0, 1fr), 열 간격 8px, 최소 높이 48px, 안쪽 위아래 8px, 점선 구분(마지막 줄 없음)", () => {
    expect(/grid-template-columns:\s*64px minmax\(0,\s*1fr\)/.test(noComments)).toBe(true);
    expect(/column-gap:\s*8px/.test(noComments)).toBe(true);
    expect(/min-height:\s*48px/.test(noComments)).toBe(true);
    expect(/padding:\s*8px 0/.test(noComments)).toBe(true);
    expect(/border-bottom:\s*1px dashed var\(--night-600\)/.test(noComments)).toBe(true);
    expect(/:last-child\s*\{[^}]*border-bottom:\s*0/.test(noComments)).toBe(true);
  });

  it("목록 면 night-700·모서리 radius-md, 시트 높이 min(360px, 70dvh)", () => {
    expect(/\.mf-urecord__list\s*\{[^}]*background:\s*var\(--night-700\)/.test(noComments)).toBe(true);
    expect(/\.mf-urecord__list\s*\{[^}]*border-radius:\s*var\(--radius-md\)/.test(noComments)).toBe(true);
    expect(/\.mf-sheet\.mf-sheet--urecord\s*\{[^}]*height:\s*min\(360px,\s*70dvh\)/.test(noComments)).toBe(true);
  });

  it("점 12px, 제목 한 줄(nowrap), 직업명 b 는 gray-50 굵게, 색 hex 없음", () => {
    expect(/\.mf-urecord__dot\s*\{[^}]*width:\s*12px/.test(noComments)).toBe(true);
    expect(/\.mf-urecord__title\s*\{[^}]*white-space:\s*nowrap/.test(noComments)).toBe(true);
    expect(/b\s*\{[^}]*color:\s*var\(--gray-50\)[^}]*\}/.test(noComments) || /b\s*\{[^}]*font-weight:\s*700/.test(noComments)).toBe(true);
    expect(/#[0-9a-fA-F]{3,8}\b/.test(noComments)).toBe(false);
  });
});
