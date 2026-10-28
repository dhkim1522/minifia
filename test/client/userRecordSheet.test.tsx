/// <reference types="node" />
import { readFileSync } from "node:fs";
import { cleanup, fireEvent, render, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import "../helpers/singleLineErrors";
import type { ClaimLogEntry, VoteLogEntry } from "../../shared/protocol";
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

function open(
  over: Partial<{
    seat: number;
    nickname: string;
    claimLog: readonly ClaimLogEntry[];
    voteLog: readonly VoteLogEntry[];
    nicknameOf: (seat: number) => string | undefined;
    onClose: () => void;
  }> = {},
) {
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
  it("기록이 없으면 목록 면은 그대로 두고 `아직 기록이 없어요` 한 줄", () => {
    const { container } = open({ seat: 0 });
    expect(container.querySelector("ol.mf-urecord__list") !== null).toBe(true);
    expect(rows(container).length).toBe(0);
    const empty = container.querySelectorAll(".mf-urecord__empty");
    expect(empty.length).toBe(1);
    expect(empty[0]?.textContent).toBe("아직 기록이 없어요");
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

// ---- 04-27: 날짜별 투표 줄 (VOTE-04, D-02, D-08, P-16) ----
const NAMES: Record<number, string> = { 0: "지우", 1: "하윤", 2: "도현", 3: "민서" };
const nameOf = (seat: number): string | undefined => NAMES[seat];
const VOTES: VoteLogEntry[] = [
  { n: 1, exec: { yes: 1, no: 3, passed: false }, cand: { votes: [{ seat: 1, target: 2 }, { seat: 0, target: 2 }], candidate: 2 } },
  { n: 2, exec: { yes: 3, no: 1, passed: true } },
];

describe("UserRecordSheet — 투표 줄 (04-27)", () => {
  it("일차 내림차순, 같은 일차는 주장 → 처형 여부 → 후보 선택 순으로 같은 행 모양에 그린다", () => {
    const { container } = open({ seat: 1, voteLog: VOTES, nicknameOf: nameOf });
    expect(rows(container).map(rowText)).toEqual([
      ["3일차", "의사라고 주장했어요"],
      ["2일차", "말하지 않았어요"],
      ["2일차", "처형 여부 찬성 3 · 반대 1"],
      ["1일차", "경찰이라고 주장했어요"],
      ["1일차", "처형 여부 찬성 1 · 반대 3 · 미통과"],
      ["1일차", "도현님에게 투표했어요"],
    ]);
  });

  it("후보 선택 행의 대상 이름만 굵고, 투표 행에는 보조 클래스가 붙는다", () => {
    const { container } = open({ seat: 1, voteLog: VOTES, nicknameOf: nameOf });
    const voteRows = rows(container).filter((li) => li.classList.contains("mf-urecord__row--vote"));
    expect(voteRows.length).toBe(3);
    const cand = voteRows[2]!;
    expect(cand.querySelector("b")?.textContent).toBe("도현");
    expect(voteRows[0]!.querySelector("b")).toBeNull();
  });

  it("처형 여부 집계는 모든 사람에게 같다(이 사람 줄이 없어도 나온다)", () => {
    const { container } = open({ seat: 3, claimLog: [], voteLog: VOTES, nicknameOf: nameOf });
    expect(rows(container).map(rowText)).toEqual([
      ["2일차", "처형 여부 찬성 3 · 반대 1"],
      ["1일차", "처형 여부 찬성 1 · 반대 3 · 미통과"],
    ]);
  });

  it("후보 선택 기록이 있어도 이 사람의 줄이 없으면 후보 선택 행이 없다 (P-16)", () => {
    const { container } = open({ seat: 3, claimLog: [], voteLog: VOTES, nicknameOf: nameOf });
    expect((container.textContent ?? "").includes("투표했어요")).toBe(false);
  });

  it("집계 줄에 개인 표시가 없다(찬성·반대한 사람 이름이 나오지 않는다) (T-04-67)", () => {
    const { container } = open({ seat: 3, claimLog: [], voteLog: [VOTES[1]!], nicknameOf: nameOf });
    const text = container.querySelector(".mf-urecord__list")?.textContent ?? "";
    for (const name of Object.values(NAMES)) expect(text.includes(name)).toBe(false);
  });

  it("대상 이름을 못 찾으면 `알 수 없는 사람`, 닉네임은 글자로만 그린다", () => {
    const votes: VoteLogEntry[] = [{ n: 1, exec: { yes: 0, no: 0, passed: false }, cand: { votes: [{ seat: 1, target: 2 }, { seat: 0, target: 9 }] } }];
    const { container } = open({ seat: 1, claimLog: [], voteLog: votes, nicknameOf: () => "<img src=x onerror=alert(1)>" });
    expect(container.querySelector(".mf-urecord__list img")).toBeNull();
    expect(rows(container).map((li) => rowText(li)[1])).toEqual(["처형 여부 찬성 0 · 반대 0 · 미통과", "<img src=x onerror=alert(1)>님에게 투표했어요"]);
    cleanup();
    const r = open({ seat: 0, claimLog: [], voteLog: votes, nicknameOf: () => undefined });
    expect(rows(r.container).map((li) => rowText(li)[1])[1]).toBe("알 수 없는 사람님에게 투표했어요");
  });

  it("voteLog 가 비어 있고 주장도 없으면 `아직 기록이 없어요`", () => {
    const { container } = open({ seat: 0, voteLog: [], nicknameOf: nameOf });
    expect(container.querySelector(".mf-urecord__empty")?.textContent).toBe("아직 기록이 없어요");
  });

  it("주장이 없어도 투표 줄만 있으면 빈 상태 문구는 없다", () => {
    const { container } = open({ seat: 3, claimLog: [], voteLog: VOTES, nicknameOf: nameOf });
    expect(container.querySelector(".mf-urecord__empty")).toBeNull();
  });

  it("voteLog 를 주지 않으면 이전과 같은 주장 줄만 나온다", () => {
    const { container } = open({ seat: 1 });
    expect(container.querySelectorAll(".mf-urecord__row--vote").length).toBe(0);
    expect(rows(container).length).toBe(3);
  });

  it("voteLog 입력 배열을 바꾸지 않는다", () => {
    const copy = JSON.stringify(VOTES);
    open({ seat: 1, voteLog: VOTES, nicknameOf: nameOf });
    expect(JSON.stringify(VOTES)).toBe(copy);
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
