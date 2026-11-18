/// <reference types="node" />
import { readFileSync } from "node:fs";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import "../helpers/singleLineErrors";
import { ROLE_IDS } from "../../shared/game/roles";
import type { RoleId } from "../../shared/game/roles";
import type { RoleRecord, RoomView } from "../../shared/protocol";
import { RoleCardSheet } from "../../src/components/RoleCardSheet";
import type { RoleCardTab } from "../../src/components/RoleCardSheet";
import { ROLE_TEXT } from "../../src/game/roleText";
import { roleArtSrc } from "../../src/net/assets";

// 역할 카드 시트(03.1-06 3B, 결정 0026, UI-SPEC D). 열림·탭 상태는 부모(RoomScreen, 03.1-11)가 쥐므로
// 시트는 제어 컴포넌트다. 단언은 문자열·불리언·숫자로 둔다(한 줄 보고서).

afterEach(cleanup);

// 폐지된 목표 칩 표식(P181-0) — 어느 화면에도 없어야 한다. 이름은 조각으로 이어 붙여 src 에서 옛 표식을 찾는 검사에 걸리지 않게 한다.
const REMOVED_GOAL_SELECTOR = `[data-role-${"goal"}], .mf-${"goal"}`;

const TABBED: RoleId[] = ["police", "mafia", "doctor"];

const RECORDS: Record<string, RoleRecord[]> = {
  police: [{ n: 1, target: 1, isMafia: true }],
  mafia: [{ n: 1, target: 0, died: true }],
  doctor: [{ n: 1, target: 2 }],
};

function makeView(role: RoleId | null, o: { allies?: number[]; records?: RoleRecord[] } = {}): RoomView {
  const me: RoomView["me"] = { seat: 0, isHost: false };
  if (role !== null) me.role = role;
  if (o.allies !== undefined) me.allies = o.allies;
  if (o.records !== undefined) me.records = o.records;
  return {
    code: "0042",
    phase: "night",
    phaseEndsAt: 1_700_000_020_000,
    phaseDurationMs: 30_000,
    serverNow: 1_700_000_000_000,
    minPlayers: 4,
    maxPlayers: 8,
    players: ["지우", "하윤", "민지", "도현"].map((nickname, seat) => ({ seat, nickname, connected: true, isHost: seat === 0 })),
    me,
  };
}

interface SheetOpts {
  role?: RoleId | null;
  showBack?: boolean;
  tab?: RoleCardTab;
  unread?: number;
  newCount?: number;
  allies?: number[];
  records?: RoleRecord[];
  onTab?: (t: RoleCardTab) => void;
}

function renderSheet(o: SheetOpts = {}) {
  const role = o.role === undefined ? "police" : o.role;
  const onTab = o.onTab ?? vi.fn();
  const view = makeView(role, { allies: o.allies, records: o.records ?? (role !== null ? RECORDS[role] : undefined) });
  const result = render(
    <RoleCardSheet
      view={view}
      showBack={o.showBack ?? false}
      tab={o.tab ?? "role"}
      onTab={onTab}
      unread={o.unread ?? 0}
      newCount={o.newCount ?? 0}
      onClose={vi.fn()}
    />,
  );
  return { ...result, onTab };
}

const tablist = (): HTMLElement | null => document.querySelector<HTMLElement>('[role="tablist"]');
const tabs = (): HTMLElement[] => Array.from(document.querySelectorAll<HTMLElement>('[role="tab"]'));
const body = (): HTMLElement | null => document.querySelector<HTMLElement>(".mf-rolecard__body");
const roleTab = (): HTMLElement => tabs()[0]!;
const activityTab = (): HTMLElement => tabs()[1]!;

describe("RoleCardSheet 제목과 탭 줄", () => {
  it("시트 이름과 제목은 `역할 카드`다", () => {
    renderSheet({ role: "police" });
    expect(document.querySelector("dialog")?.getAttribute("aria-label")).toBe("역할 카드");
    const h = document.querySelector("h2.mf-sheet__title");
    expect(h?.textContent).toBe("역할 카드");
    expect(document.querySelector(".mf-sheet")?.className).toContain("mf-sheet--rolecard");
    expect(screen.getByRole("button", { name: "닫기" })).toBeTruthy();
  });

  it.each(TABBED)("%s: tablist 안에 탭 `내 역할`·`활동 기록` 둘이 있다", (role) => {
    renderSheet({ role });
    const list = tablist()!;
    expect(list.getAttribute("aria-label")).toBe("역할 카드 탭");
    const names = tabs().map((t) => t.textContent);
    expect(names).toEqual(["내 역할", "활동 기록"]);
    expect(tabs().every((t) => list.contains(t))).toBe(true);
  });

  it("시민·역할 없음에는 탭 줄이 없다", () => {
    renderSheet({ role: "citizen" });
    expect(tablist()).toBeNull();
    expect(tabs().length).toBe(0);
    cleanup();
    renderSheet({ role: null });
    expect(tablist()).toBeNull();
  });

  it.each(["role", "activity"] as const)("뒷면 상태(tab=%s)에는 탭 줄도 일지도 없다", (tab) => {
    renderSheet({ role: "police", showBack: true, tab });
    expect(tablist()).toBeNull();
    expect(document.querySelector('[role="tabpanel"]')).toBeNull();
    expect(document.querySelector(".mf-journal")).toBeNull();
  });
});

describe("RoleCardSheet 탭 접근성", () => {
  it.each(TABBED)("%s: 선택 탭만 aria-selected true 이고 roving tabIndex 다", (role) => {
    renderSheet({ role, tab: "role" });
    expect(tabs().map((t) => t.getAttribute("aria-selected"))).toEqual(["true", "false"]);
    expect(tabs().map((t) => t.tabIndex)).toEqual([0, -1]);
    cleanup();
    renderSheet({ role, tab: "activity" });
    expect(tabs().map((t) => t.getAttribute("aria-selected"))).toEqual(["false", "true"]);
    expect(tabs().map((t) => t.tabIndex)).toEqual([-1, 0]);
  });

  it("선택된 탭의 tabpanel 이 그 탭 id 로 aria-labelledby 하고, 탭의 aria-controls 가 그 패널이다", () => {
    for (const tab of ["role", "activity"] as const) {
      renderSheet({ role: "police", tab });
      const selected = tab === "role" ? roleTab() : activityTab();
      const panel = document.querySelector<HTMLElement>('[role="tabpanel"]')!;
      expect(document.querySelectorAll('[role="tabpanel"]').length).toBe(1);
      expect(selected.id.length).toBeGreaterThan(0);
      expect(panel.getAttribute("aria-labelledby")).toBe(selected.id);
      expect(selected.getAttribute("aria-controls")).toBe(panel.id);
      expect(new Set(tabs().map((t) => t.id)).size).toBe(2);
      cleanup();
    }
  });

  it("tab=role 이면 본문(직업명), tab=activity 이면 Journal(머리 이름)이 보인다", () => {
    renderSheet({ role: "police", tab: "role" });
    expect(body()?.textContent).toContain("경찰");
    expect(document.querySelector(".mf-journal")).toBeNull();
    cleanup();
    renderSheet({ role: "police", tab: "activity" });
    expect(document.querySelector(".mf-journal__h b")?.textContent).toBe("수사일지");
    expect(body()).toBeNull();
  });

  it("탭 클릭은 onTab 을 부른다(제어 컴포넌트: 선택은 부모가 바꾼다)", () => {
    const { onTab } = renderSheet({ role: "mafia", tab: "role" });
    fireEvent.click(activityTab());
    expect(onTab).toHaveBeenLastCalledWith("activity");
    fireEvent.click(roleTab());
    expect(onTab).toHaveBeenLastCalledWith("role");
  });

  it("←/→ 는 다음/이전 탭을 선택하고 포커스를 옮기며, Home/End 는 처음/끝이다", () => {
    const { onTab } = renderSheet({ role: "doctor", tab: "role" });
    roleTab().focus();
    fireEvent.keyDown(roleTab(), { key: "ArrowRight" });
    expect(onTab).toHaveBeenLastCalledWith("activity");
    expect(document.activeElement).toBe(activityTab());
    fireEvent.keyDown(activityTab(), { key: "ArrowLeft" });
    expect(onTab).toHaveBeenLastCalledWith("role");
    expect(document.activeElement).toBe(roleTab());
    fireEvent.keyDown(roleTab(), { key: "End" });
    expect(onTab).toHaveBeenLastCalledWith("activity");
    expect(document.activeElement).toBe(activityTab());
    fireEvent.keyDown(activityTab(), { key: "Home" });
    expect(onTab).toHaveBeenLastCalledWith("role");
    expect(document.activeElement).toBe(roleTab());
    // 끝에서 → 는 처음으로, 처음에서 ← 는 끝으로 돈다
    fireEvent.keyDown(activityTab(), { key: "ArrowRight" });
    expect(onTab).toHaveBeenLastCalledWith("role");
    fireEvent.keyDown(roleTab(), { key: "ArrowLeft" });
    expect(onTab).toHaveBeenLastCalledWith("activity");
  });

  it("관련 없는 키는 탭을 바꾸지 않는다", () => {
    const { onTab } = renderSheet({ role: "police" });
    fireEvent.keyDown(roleTab(), { key: "a" });
    fireEvent.keyDown(roleTab(), { key: "ArrowDown" });
    expect(onTab).not.toHaveBeenCalled();
  });

  it("부모가 tab 을 바꾸는 실제 흐름: 키로 바꾸면 패널이 따라 바뀐다", () => {
    function Harness() {
      const [tab, setTab] = useState<RoleCardTab>("role");
      return <RoleCardSheet view={makeView("police", { records: RECORDS.police })} showBack={false} tab={tab} onTab={setTab} unread={0} newCount={0} onClose={() => {}} />;
    }
    render(<Harness />);
    expect(body()).not.toBeNull();
    fireEvent.keyDown(roleTab(), { key: "ArrowRight" });
    expect(document.querySelector(".mf-journal")).not.toBeNull();
    expect(roleTab().getAttribute("aria-selected")).toBe("false");
    expect(document.activeElement).toBe(activityTab());
  });

  it("tab=activity 로 열면 활동 기록 탭이 초기 포커스를 받는다", () => {
    renderSheet({ role: "police", tab: "activity" });
    expect(document.activeElement).toBe(activityTab());
  });
});

describe("RoleCardSheet 앰버 점 (D-11)", () => {
  it("unread > 0 이면 활동 기록 탭 안에 점(aria-hidden)과 `활동 기록, 새 기록` 이름이 있다", () => {
    renderSheet({ role: "police", unread: 2 });
    const dot = activityTab().querySelector(".mf-rolecard__dot");
    expect(dot).not.toBeNull();
    expect(dot?.getAttribute("aria-hidden")).toBe("true");
    expect(activityTab().getAttribute("aria-label")).toBe("활동 기록, 새 기록");
    expect(screen.getByRole("tab", { name: "활동 기록, 새 기록" })).toBe(activityTab());
  });

  it("unread 0 이면 점이 없고 이름은 `활동 기록`이다. `내 역할` 탭에는 점이 없다", () => {
    renderSheet({ role: "police", unread: 0 });
    expect(document.querySelector(".mf-rolecard__dot")).toBeNull();
    expect(screen.getByRole("tab", { name: "활동 기록" })).toBe(activityTab());
    cleanup();
    renderSheet({ role: "police", unread: 3 });
    expect(roleTab().querySelector(".mf-rolecard__dot")).toBeNull();
    expect(roleTab().getAttribute("aria-label")).toBeNull();
  });

  it("숫자가 어디에도 안 보인다", () => {
    renderSheet({ role: "police", unread: 3, newCount: 3, tab: "role" });
    expect(tablist()?.textContent).toBe("내 역할활동 기록");
    expect(tablist()?.textContent).not.toMatch(/\d/);
  });
});

describe("RoleCardSheet 내 역할 본문", () => {
  it.each(ROLE_IDS)("%s: 직업명·설명이 같은 `.mf-rolecard__body` 안에 있고 그림은 128×160 액자(alt 빈 문자열)다", (role) => {
    renderSheet({ role, allies: [] });
    const b = body()!;
    expect(b.querySelector(".mf-rolecard__t b, .mf-rolecard__t h3")?.textContent).toBe(ROLE_TEXT[role].name);
    expect(b.textContent).toContain(ROLE_TEXT[role].desc);
    const img = b.querySelector<HTMLImageElement>("img.mf-rolecard__art")!;
    expect(img.getAttribute("width")).toBe("128");
    expect(img.getAttribute("height")).toBe("160");
    expect(img.getAttribute("alt")).toBe("");
  });

  it("시민 본문은 경찰·마피아·의사 시트와 같은 클래스 구조다", () => {
    renderSheet({ role: "citizen" });
    const citizen = Array.from(body()!.querySelectorAll("*")).map((el) => el.className);
    cleanup();
    renderSheet({ role: "police" });
    const police = Array.from(body()!.querySelectorAll("*")).map((el) => el.className);
    expect(citizen).toEqual(police);
  });

  it("마피아 본문에 동료 줄이 설명 아래에 있다(동료 · 닉네임 / 혼자예요)", () => {
    renderSheet({ role: "mafia", allies: [1, 3] });
    const t = document.querySelector<HTMLElement>(".mf-rolecard__t")!;
    const lines = Array.from(t.children).map((el) => el.textContent);
    expect(lines).toEqual(["마피아", ROLE_TEXT.mafia.desc, "동료 · 하윤, 도현"]);
    cleanup();
    renderSheet({ role: "mafia", allies: [] });
    expect(document.querySelector(".mf-rolecard__t")?.textContent).toContain("혼자예요");
  });

  it.each(["police", "doctor", "citizen"] as const)("%s: 동료 줄이 없다", (role) => {
    renderSheet({ role });
    expect(document.body.textContent).not.toContain("동료");
    expect(document.body.textContent).not.toContain("혼자");
  });
});

describe("RoleCardSheet 뒷면·역할 없음", () => {
  it.each(ROLE_IDS)("showBack(%s): 직업 글자·그림·설명이 DOM 에 없고 마름모 뒷면만 있다", (role) => {
    renderSheet({ role, showBack: true, allies: [1] });
    const dlg = document.querySelector("dialog")!;
    expect(dlg.querySelector("img")).toBeNull();
    for (const t of ["마피아", "경찰", "의사", "시민", "동료", "혼자", "하윤"]) expect(dlg.textContent).not.toContain(t);
    expect(dlg.innerHTML).not.toMatch(/mafia|police|doctor|citizen/);
    expect(document.querySelector(".mf-rolecard__back svg.mf-card__diamond")).not.toBeNull();
    expect(tablist()).toBeNull();
  });

  it("역할 없음: `아직 역할이 없어요`, 탭 없음", () => {
    renderSheet({ role: null });
    expect(document.querySelector(".mf-rolecard__empty")?.textContent).toBe("아직 역할이 없어요");
    expect(tablist()).toBeNull();
    expect(document.querySelector("img")).toBeNull();
  });
});

describe("RoleCardSheet 직업 그림 (T-03.1-20)", () => {
  it.each(ROLE_IDS)("%s: 직업 그림 img 는 내 역할 하나뿐이고 다른 역할의 /characters/roles/ 경로가 없다", (role) => {
    renderSheet({ role, allies: [] });
    const dlg = document.querySelector("dialog")!;
    const arts = Array.from(dlg.querySelectorAll<HTMLImageElement>("img")).filter((img) => (img.getAttribute("src") ?? "").includes("/characters/roles/"));
    expect(arts.length).toBe(1);
    expect(arts[0]!.getAttribute("src")).toBe(roleArtSrc(role).src);
    const html = dlg.innerHTML;
    for (const other of ROLE_IDS.filter((r) => r !== role)) expect(html).not.toContain(`/characters/roles/${other}_`);
  });

  it("활동 기록 탭에는 직업 그림이 없다(일지 그림만)", () => {
    renderSheet({ role: "police", tab: "activity" });
    const srcs = Array.from(document.querySelectorAll("img")).map((i) => i.getAttribute("src") ?? "");
    expect(srcs.some((s) => s.includes("/characters/"))).toBe(false);
    expect(srcs.every((s) => s.startsWith("/journals/"))).toBe(true);
  });
});

describe("RoleCardSheet 활동 기록 본문", () => {
  it.each(TABBED)("%s: records·players·mySeat·newCount 가 Journal 로 전달된다", (role) => {
    renderSheet({ role, tab: "activity", newCount: 1 });
    const rows = document.querySelectorAll(".mf-journal__row");
    expect(rows.length).toBeGreaterThanOrEqual(1);
    expect(document.querySelectorAll(".mf-journal__new").length).toBe(1);
    expect(document.querySelector(".mf-journal")?.className).toContain(`mf-journal--${role}`);
    // players 에서 이름을 찾고(경찰: 하윤, 의사: 민지), 내 자리(0)는 `나` 다(마피아 기록의 대상이 0).
    const who = document.querySelector(".mf-journal__w b")?.textContent;
    const expected: Record<RoleId, string> = { police: "하윤", mafia: "나", doctor: "민지", citizen: "" };
    expect(who).toBe(expected[role]);
  });

  it("records 가 없으면(me.records 키 없음) 빈 문구다", () => {
    const view = makeView("police");
    render(<RoleCardSheet view={view} showBack={false} tab="activity" onTab={() => {}} unread={0} newCount={0} onClose={() => {}} />);
    expect(document.querySelector(".mf-journal__empty")?.textContent).toBe("아직 조사한 사람이 없어요");
  });
});

describe("rolecard.css — 시트 규약", () => {
  const css = readFileSync("src/styles/rolecard.css", "utf8");

  function rule(selector: string): string {
    const bodies: string[] = [];
    for (const m of css.matchAll(/([^{}]+)\{([^}]*)\}/g)) {
      const selectors = m[1]!.replace(/\/\*[\s\S]*?\*\//g, "").split(",").map((s) => s.trim());
      if (selectors.includes(selector)) bodies.push(m[2]!);
    }
    expect(bodies.length, `규칙 ${selector}`).toBeGreaterThan(0);
    return bodies.join(" ").replace(/\s+/g, " ");
  }

  it("탭: 최소 높이 var(--tap-min), 선택/안 선택 색", () => {
    expect(rule(".mf-rolecard__tab")).toContain("min-height: var(--tap-min)");
    const sel = rule('.mf-rolecard__tab[aria-selected="true"]');
    expect(sel).toContain("background: var(--noir-raised)");
    expect(sel).toContain("border-color: var(--noir-accent)");
    expect(sel).toContain("color: var(--noir-paper)");
    const off = rule(".mf-rolecard__tab");
    expect(off).toContain("background: var(--noir-inset)");
    expect(off).toContain("border-color: var(--noir-line)");
    expect(off).toContain("color: var(--gray-300)");
  });

  it("앰버 점: 10px, var(--amber-400), 전환 없음", () => {
    const dot = rule(".mf-rolecard__dot");
    expect(dot).toContain("width: 10px");
    expect(dot).toContain("height: 10px");
    expect(dot).toContain("background: var(--amber-400)");
    expect(dot).not.toContain("transition");
  });

  it("액자: 128×160, 공통 모서리, 안쪽 여백 8px", () => {
    const art = rule(".mf-rolecard__art");
    expect(art).toContain("width: 128px");
    expect(art).toContain("height: 160px");
    expect(art).toContain("border-radius: var(--noir-control-radius)");
    expect(art).toContain("padding: 8px");
  });

  it("시트 높이는 내용에 맞춘다: height auto, max-height min(420px, 80dvh), 고정 height 없음 (feedback-7)", () => {
    const sheet = rule(".mf-sheet.mf-sheet--rolecard");
    expect(sheet).toContain("height: auto");
    expect(sheet).toContain("max-height: min(420px, 80dvh)");
    expect(sheet).not.toMatch(/(^|[^-])height: min\(420px, 80dvh\)/);
    // 기록이 길면 최대 높이 안에서 줄어든다: 탭 본문·일지는 min-height 0 이고 일지가 넘치는 것을 안에서 다룬다
    expect(rule(".mf-rolecard__panel")).toContain("min-height: 0");
    expect(rule(".mf-journal")).toContain("min-height: 0");
  });

  it("키보드 포커스 링과 탭 줄 간격", () => {
    expect(rule(".mf-rolecard__tab:focus-visible")).toContain("outline: 2px solid var(--gray-100)");
    expect(rule(".mf-rolecard__tabs")).toContain("grid-template-columns: 1fr 1fr");
  });

  it("색 hex 가 없고 전환·애니메이션도 없다", () => {
    const code = css.replace(/\/\*[\s\S]*?\*\//g, "");
    expect(/#[0-9a-fA-F]{3,8}\b/.test(code)).toBe(false);
    expect(/transition|animation/.test(code)).toBe(false);
  });
});

describe("RoleCardSheet 역할 문구 한 덩어리 (P181-0, HOST-05)", () => {
  it.each(ROLE_IDS)("%s 앞면: [data-role-line] 하나(.mf-rolecard__desc), 자기 문구만 — 다른 직업 문구는 DOM 에 없고 목표 표식도 없다", (role) => {
    renderSheet({ role, tab: "role" });
    const lines = document.querySelectorAll("[data-role-line]");
    expect(lines.length).toBe(1);
    expect(lines[0]!.className).toBe("mf-rolecard__desc");
    expect(lines[0]!.getAttribute("data-role-line")).toBe("");
    expect(lines[0]!.textContent).toBe(ROLE_TEXT[role].desc);
    expect(document.querySelectorAll(REMOVED_GOAL_SELECTOR).length).toBe(0);
    const text = document.querySelector("dialog")?.textContent ?? "";
    for (const other of ROLE_IDS) {
      if (other === role) continue;
      expect(text.includes(ROLE_TEXT[other].desc)).toBe(false);
    }
  });

  it.each(ROLE_IDS)("%s 뒷면(showBack)에는 문구 줄이 없다", (role) => {
    renderSheet({ role, showBack: true });
    expect(document.querySelector("[data-role-line]")).toBeNull();
    const text = document.querySelector("dialog")?.textContent ?? "";
    expect(text).not.toContain(ROLE_TEXT[role].desc);
  });

  it("역할 없음에는 문구 줄이 없다", () => {
    renderSheet({ role: null });
    expect(document.querySelector("[data-role-line]")).toBeNull();
  });
});

// ---- 기록 카드 단서와 의심 탭(23-11 첫날 답 → 24-06 일반화, P23-16·18·19·29, P24-19·20, D-14) ----
import type { KeywordAnswerRow } from "../../shared/protocol";
import { keywordAnswerOf, keywordAnswersOf, keywordGenreOf } from "../../src/game/keywordView";

const ANSWER_NICKS = ["지우", "하윤", "민지", "도현", "서연", "예준", "하준", "여덟글자닉네임이다"];

function answersView(role: RoleId | null, o: { rows?: KeywordAnswerRow[] | null; answer?: string; n?: number; mySeat?: number } = {}): RoomView {
  const n = o.n ?? 4;
  const base = makeView(role);
  const rows: KeywordAnswerRow[] | null =
    o.rows === undefined ? [{ order: 1, seat: 2, text: "해리포터" }, { order: 2, seat: 0, text: "안경" }, { order: 3, seat: 1, text: null }, { order: 4, seat: 3, text: null }] : o.rows;
  const keyword: { genre: string; answers?: KeywordAnswerRow[]; answer?: string } = { genre: "영화" };
  if (rows !== null) keyword.answers = rows;
  if (o.answer !== undefined) keyword.answer = o.answer;
  return {
    ...base,
    players: ANSWER_NICKS.slice(0, n).map((nickname, seat) => ({ seat, nickname, connected: true, isHost: seat === 0 })),
    me: { ...base.me, seat: o.mySeat ?? 0 },
    day: { n: 1, roles: [], keyword },
  };
}

function renderAnswers(view: RoomView, tab: RoleCardTab = "records", onTab: (t: RoleCardTab) => void = vi.fn()) {
  return render(<RoleCardSheet view={view} showBack={false} tab={tab} onTab={onTab} unread={0} newCount={0} onClose={vi.fn()} />);
}

describe("keywordView 선택기 (T-23-40)", () => {
  it("view 의 공개 값만 읽고 없으면 undefined 다", () => {
    const v = answersView("citizen", { answer: "해리포터" });
    expect(keywordAnswerOf(v)).toBe("해리포터");
    expect(keywordGenreOf(v)).toBe("영화");
    expect(keywordAnswersOf(v)?.length).toBe(4);
    const none = answersView("citizen", { rows: null });
    expect(keywordAnswerOf(none)).toBeUndefined();
    expect(keywordAnswersOf(none)).toBeUndefined();
    expect(keywordAnswerOf(makeView("citizen"))).toBeUndefined();
  });
});

describe("RoleCardSheet 단서와 의심 탭 (P23-16·29, P24-19)", () => {
  it("시민: 답이 있으면 탭 둘 `내 역할`·`단서와 의심`", () => {
    renderAnswers(answersView("citizen"), "role");
    expect(tabs().map((t) => t.textContent)).toEqual(["내 역할", "단서와 의심"]);
    expect(tabs()[1]!.getAttribute("data-rolecard-tab")).toBe("records");
  });

  it.each(TABBED)("%s: 탭 셋 `내 역할`·`활동 기록`·`단서와 의심`", (role) => {
    renderAnswers(answersView(role), "role");
    expect(tabs().map((t) => t.textContent)).toEqual(["내 역할", "활동 기록", "단서와 의심"]);
  });

  it("답이 없으면 시민은 탭 줄이 없고 경찰은 둘이다", () => {
    renderAnswers(answersView("citizen", { rows: null }), "role");
    expect(tablist()).toBeNull();
    cleanup();
    renderAnswers(answersView("police", { rows: null }), "role");
    expect(tabs().map((t) => t.textContent)).toEqual(["내 역할", "활동 기록"]);
  });

  it("뒷면(showBack)에는 탭이 없다", () => {
    render(<RoleCardSheet view={answersView("citizen")} showBack tab="role" onTab={vi.fn()} unread={0} newCount={0} onClose={vi.fn()} />);
    expect(tablist()).toBeNull();
  });

  it("선택되면 시트 이름·제목이 `모두의 기록`이고 아니면 `역할 카드`다", () => {
    renderAnswers(answersView("citizen"));
    expect(document.querySelector("dialog")?.getAttribute("aria-label")).toBe("모두의 기록");
    expect(document.querySelector("h2.mf-sheet__title")?.textContent).toBe("모두의 기록");
    expect(tabs()[1]!.getAttribute("aria-selected")).toBe("true");
    cleanup();
    renderAnswers(answersView("citizen"), "role");
    expect(document.querySelector("dialog")?.getAttribute("aria-label")).toBe("역할 카드");
  });

  it("←/→/Home/End 가 탭 순서대로 돈다(시민 2칸, 경찰 3칸)", () => {
    const onTab = vi.fn();
    renderAnswers(answersView("citizen"), "role", onTab);
    fireEvent.keyDown(tabs()[0]!, { key: "ArrowRight" });
    expect(onTab).toHaveBeenLastCalledWith("records");
    fireEvent.keyDown(tabs()[1]!, { key: "ArrowRight" });
    expect(onTab).toHaveBeenLastCalledWith("role");
    fireEvent.keyDown(tabs()[0]!, { key: "End" });
    expect(onTab).toHaveBeenLastCalledWith("records");
    cleanup();
    const onTab2 = vi.fn();
    renderAnswers(answersView("police"), "role", onTab2);
    fireEvent.keyDown(tabs()[0]!, { key: "ArrowLeft" });
    expect(onTab2).toHaveBeenLastCalledWith("records");
    fireEvent.keyDown(tabs()[0]!, { key: "ArrowRight" });
    expect(onTab2).toHaveBeenLastCalledWith("activity");
    fireEvent.keyDown(tabs()[0]!, { key: "End" });
    expect(onTab2).toHaveBeenLastCalledWith("records");
  });

  it("단서와 의심 탭에는 점·NEW 가 없다", () => {
    renderAnswers(answersView("police"), "records");
    expect(tabs()[2]!.querySelector(".mf-rolecard__dot")).toBeNull();
  });
});

describe("RoleCardSheet 첫날 답 목록 (P23-18·19)", () => {
  const sec = (): HTMLElement => document.querySelector<HTMLElement>('section[data-answer-day="1"]')!;
  const rows = (): HTMLElement[] => Array.from(document.querySelectorAll<HTMLElement>("ol[data-answer-list] > li[data-answer-row]"));

  it("1일차 구역 머리와 장르 줄", () => {
    renderAnswers(answersView("citizen"));
    expect(sec().textContent).toContain("1일차");
    expect(sec().textContent).toContain("주제 · 영화");
    expect(document.querySelectorAll("section[data-answer-day]").length).toBe(1);
  });

  it("서버 순서 그대로 번호·좌석·닉네임·답, 단서 없음은 맨 끝에 번호가 이어진다", () => {
    renderAnswers(answersView("citizen"));
    const r = rows();
    expect(r.length).toBe(4);
    expect(r.map((x) => x.getAttribute("data-answer-order"))).toEqual(["1", "2", "3", "4"]);
    expect(r.map((x) => x.getAttribute("data-answer-seat"))).toEqual(["2", "0", "1", "3"]);
    expect(r[0]!.textContent).toContain("민지");
    expect(r[0]!.textContent).toContain("해리포터");
    expect(r[1]!.textContent).toContain("안경");
    expect(r.map((x) => x.hasAttribute("data-answer-none"))).toEqual([false, false, true, true]);
    expect(r[2]!.textContent).toContain("단서 없음");
    expect(r[2]!.textContent).toContain("3");
  });

  it("내 줄만 aria-label 에 `내 단서`이 있다", () => {
    renderAnswers(answersView("citizen", { mySeat: 2 }));
    const mine = rows().filter((x) => (x.getAttribute("aria-label") ?? "").includes("내 단서"));
    expect(mine.length).toBe(1);
    expect(mine[0]!.getAttribute("data-answer-seat")).toBe("2");
  });

  it("8명 판은 8줄, 전원 단서 없음이어도 같은 모양이다", () => {
    const eight: KeywordAnswerRow[] = Array.from({ length: 8 }, (_, i) => ({ order: i + 1, seat: i, text: i < 3 ? `답${i}` : null }));
    renderAnswers(answersView("citizen", { rows: eight, n: 8 }));
    expect(rows().length).toBe(8);
    expect(rows()[7]!.textContent).toContain("여덟글자닉네임이다");
    cleanup();
    const none: KeywordAnswerRow[] = Array.from({ length: 4 }, (_, i) => ({ order: i + 1, seat: i, text: null }));
    renderAnswers(answersView("citizen", { rows: none }));
    expect(rows().length).toBe(4);
    expect(document.querySelectorAll("[data-answer-none]").length).toBe(4);
  });

  it("답 글은 텍스트 노드 그대로 보이고 줄은 두 줄까지 감기는 클래스를 쓴다", () => {
    const xss: KeywordAnswerRow[] = [{ order: 1, seat: 0, text: "<b>x</b>" }, { order: 2, seat: 1, text: "가나다라마바사아자차카타파하가나다라마바" }];
    renderAnswers(answersView("citizen", { rows: xss }));
    expect(document.querySelector("[data-answer-list] b")).toBeNull();
    expect(rows()[0]!.textContent).toContain("<b>x</b>");
    expect(rows()[1]!.querySelector(".mf-answers__text")?.textContent).toBe("가나다라마바사아자차카타파하가나다라마바");
  });

  it("정답이 있으면 `제시어 · 해리포터` 한 줄, 없으면 0건", () => {
    renderAnswers(answersView("citizen", { answer: "해리포터" }));
    expect(document.querySelectorAll("[data-answer-correct]").length).toBe(1);
    expect(document.querySelector("[data-answer-correct]")?.textContent).toBe("제시어 · 해리포터");
    cleanup();
    renderAnswers(answersView("citizen"));
    expect(document.querySelectorAll("[data-answer-correct]").length).toBe(0);
    expect(document.querySelector("dialog")?.textContent).not.toContain("제시어");
  });

  it("마피아 view 도 같은 목록이고 유령도 본다", () => {
    renderAnswers(answersView("mafia"));
    expect(rows().length).toBe(4);
  });
});

// ---- 일차 구역·의심 줄(24-06, P24-19·20, D-27) ----
function suspectView(role: RoleId | null, log: { n: number; from: number; to: number }[], o: { withAnswers?: boolean; n?: number; mySeat?: number; nicks?: string[] } = {}): RoomView {
  const base = answersView(role, { rows: o.withAnswers === true ? undefined : null, mySeat: o.mySeat ?? 0, n: 4 });
  const players = o.nicks !== undefined ? o.nicks.map((nickname, seat) => ({ seat, nickname, connected: true, isHost: seat === 0 })) : base.players;
  return { ...base, players, day: { ...base.day!, n: o.n ?? 3, ...(log.length > 0 ? { suspectLog: log } : {}) } };
}

describe("RoleCardSheet 의심 구역 (P24-19·20, D-27)", () => {
  const secs = (): HTMLElement[] => Array.from(document.querySelectorAll<HTMLElement>("section[data-log-day]"));
  const lines = (sec: ParentNode = document): HTMLElement[] => Array.from(sec.querySelectorAll<HTMLElement>("ul[data-suspect-list] > li[data-suspect-row]"));
  const LOG = [
    { n: 2, from: 2, to: 1 }, { n: 2, from: 0, to: 3 }, { n: 3, from: 1, to: 0 }, { n: 3, from: 3, to: 2 }, { n: 3, from: 0, to: 1 },
  ];

  it("답 없이 의심 기록만 있어도 탭이 있고 구역이 최신 일차부터 [3일차, 2일차] 다", () => {
    renderAnswers(suspectView("citizen", LOG));
    expect(tabs().map((t) => t.textContent)).toEqual(["내 역할", "단서와 의심"]);
    expect(secs().map((x) => x.getAttribute("data-log-day"))).toEqual(["3", "2"]);
    expect(secs().map((x) => x.querySelector(".mf-answers__dayname")?.textContent)).toEqual(["3일차", "2일차"]);
    expect(document.querySelector("h2.mf-sheet__title")?.textContent).toBe("모두의 기록");
  });

  it("줄 수는 그날 기록 수, 일차 안은 붙인 좌석 오름차순, from·to 는 좌석이다", () => {
    renderAnswers(suspectView("citizen", LOG));
    const [d3, d2] = secs();
    expect(lines(d3!).length).toBe(3);
    expect(lines(d2!).length).toBe(2);
    expect(lines(d3!).map((x) => `${x.getAttribute("data-suspect-from")}>${x.getAttribute("data-suspect-to")}`)).toEqual(["0>1", "1>0", "3>2"]);
    expect(lines(d2!).map((x) => `${x.getAttribute("data-suspect-from")}>${x.getAttribute("data-suspect-to")}`)).toEqual(["0>3", "2>1"]);
  });

  it("접근성 이름으로 딱지를 붙인 사람과 받은 사람을 읽는다", () => {
    renderAnswers(suspectView("citizen", LOG));
    const d3 = secs()[0]!;
    expect(lines(d3).map((x) => x.getAttribute("aria-label"))).toEqual(["하윤 님에게 내가 붙인 의심딱지", "하윤 님이 지우 님에게 붙인 의심딱지", "도현 님이 민지 님에게 붙인 의심딱지"]);
    expect(lines(d3)[0]!.className).toContain("mf-suspect__row--mine");
    expect(lines(d3)[1]!.className).not.toContain("--mine");
  });

  it("줄은 좌석 점 둘과 화살표를 갖고 닉네임은 글자 노드다", () => {
    renderAnswers(suspectView("citizen", LOG));
    const row = lines(secs()[0]!)[1]!;
    expect(row.querySelectorAll(".mf-suspect__dot").length).toBe(2);
    expect(row.querySelectorAll("svg").length).toBe(1);
    expect(Array.from(row.querySelectorAll(".mf-suspect__nick")).map((x) => x.textContent)).toEqual(["하윤", "지우"]);
  });

  it("답 + 2일차 의심이면 [2일차 의심 구역, 1일차 답 구역(data-answer-list 그대로)] 이다", () => {
    renderAnswers(suspectView("citizen", [{ n: 2, from: 1, to: 2 }], { withAnswers: true, n: 2 }));
    expect(secs().map((x) => x.getAttribute("data-log-day"))).toEqual(["2", "1"]);
    const first = secs()[1]!;
    expect(first.querySelector("ol[data-answer-list]")).not.toBeNull();
    expect(first.textContent).toContain("주제 · 영화");
    expect(secs()[0]!.querySelector("ol[data-answer-list]")).toBeNull();
    expect(lines(secs()[0]!).length).toBe(1);
    expect(document.querySelectorAll("section[data-answer-day]").length).toBe(1);
  });

  it("의심이 없는 일차는 구역도 빈 문구도 없다", () => {
    renderAnswers(suspectView("citizen", [{ n: 3, from: 1, to: 0 }], { n: 3 }));
    expect(secs().map((x) => x.getAttribute("data-log-day"))).toEqual(["3"]);
    expect(document.querySelectorAll("[data-suspect-row]").length).toBe(1);
  });

  it("답도 의심도 없으면 탭이 없고 경찰은 활동 기록 탭만 있다", () => {
    renderAnswers(suspectView("citizen", []), "role");
    expect(tablist()).toBeNull();
    cleanup();
    renderAnswers(suspectView("police", []), "role");
    expect(tabs().map((t) => t.textContent)).toEqual(["내 역할", "활동 기록"]);
  });

  it("한 일차 8줄도 모두 그리고 8자 닉네임은 글자 그대로 접근성 이름에 전체가 들어간다", () => {
    const nicks = ANSWER_NICKS;
    const eight = Array.from({ length: 8 }, (_, i) => ({ n: 2, from: i, to: (i + 1) % 8 }));
    renderAnswers(suspectView("citizen", eight, { n: 2, nicks, mySeat: 5 }));
    expect(lines().length).toBe(8);
    const last = lines()[7]!;
    expect(last.getAttribute("aria-label")).toBe("여덟글자닉네임이다 님이 지우 님에게 붙인 의심딱지");
    expect(last.querySelector(".mf-suspect__nick")?.textContent).toBe("여덟글자닉네임이다");
  });

  it("닉네임의 마크업 글자는 텍스트 노드다(T-24-16)", () => {
    renderAnswers(suspectView("citizen", [{ n: 2, from: 1, to: 0 }], { n: 2, nicks: ["<b>x</b>", "<i>y</i>"] }));
    expect(document.querySelector("[data-suspect-list] b, [data-suspect-list] i")).toBeNull();
    expect(lines()[0]!.textContent).toContain("<i>y</i>");
  });

  it("표식은 꺼진 장치 접두(data-record)와 부딪히지 않는다", () => {
    renderAnswers(suspectView("citizen", LOG, { withAnswers: true }));
    const names = new Set<string>();
    for (const el of Array.from(document.querySelectorAll("*"))) for (const a of Array.from(el.attributes)) names.add(a.name);
    expect(Array.from(names).filter((n) => n.startsWith("data-record"))).toEqual([]);
  });
});

describe("rolecard.css — 첫날 답 규칙 (P23-28)", () => {
  const css = readFileSync("src/styles/rolecard.css", "utf8");
  it(".mf-answers 규칙이 있고 hex 색이 없다", () => {
    expect(css.includes(".mf-answers")).toBe(true);
    expect(/#[0-9a-fA-F]{3,8}\b/.test(css)).toBe(false);
  });
  it("구역 머리는 위에 붙고 의심 줄 닉네임은 한 줄 말줄임이다(P24-19·20)", () => {
    expect(/\.mf-answers__head\s*\{[^}]*position:\s*sticky/.test(css)).toBe(true);
    expect(/\.mf-suspect__nick\s*\{[^}]*text-overflow:\s*ellipsis/.test(css)).toBe(true);
    expect(/\.mf-suspect__row--mine\s*\{[^}]*night-700/.test(css)).toBe(true);
  });
});
