import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import "../helpers/singleLineErrors";
import type { ResultLogChatLine, ResultLogWhisperLine } from "../../shared/protocol";
import { ResultPanel } from "../../src/components/v2/ResultPanel";
import type { ResultPanelProps, ResultTab } from "../../src/components/v2/ResultPanel";
import { RESULT_PANEL_TEXT } from "../../src/game/resultText";
import type { ResultLogSnapshot } from "../../src/net/resultLogStore";
import { tlLog, TL_NAMES, TL_RESULT, TL_VOTE_LOG } from "../helpers/timelineState";

afterEach(cleanup);

// 결과 탭 패널(11-07, D-2·D-3·D-9, UI-SPEC A-3). 순수 표시 — 어느 탭이 열렸는지·열린 적이 있는지는 부르는 쪽(ResultScreen)이 쥔다.
const part = <L,>(lines: L[], complete = true) => ({ lines, complete });
const mline = (seat: number, n: number, text: string): ResultLogChatLine => ({ seat, n, text, at: 1 });
const wline = (seat: number, to: number, n: number, text: string): ResultLogWhisperLine => ({ seat, to, n, text, at: 1 });

function snap(over: Partial<ResultLogSnapshot> = {}): ResultLogSnapshot {
  return {
    mafia: part<ResultLogChatLine>([mline(3, 1, "오늘 밤은 지우"), mline(5, 1, "좋아"), mline(3, 2, "다음은 하윤")]),
    ghost: part<ResultLogChatLine>([mline(2, 2, "억울해"), mline(4, 3, "누가 범인")]),
    whisper: part<ResultLogWhisperLine>([wline(0, 1, 1, "비밀이야"), wline(1, 0, 2, "알았어")]),
    claim: part([]),
    ballots: part([]),
    ...over,
  };
}

const NAMES = new Map([
  [0, "지우"],
  [1, "하윤"],
  [2, "민지"],
  [3, "도현"],
  [4, "서연"],
  [5, "수빈"],
]);

function setup(over: Partial<ResultPanelProps> = {}) {
  const onTab = vi.fn();
  const props: ResultPanelProps = {
    tab: "all",
    onTab,
    expanded: false,
    tabsVisible: true,
    lines: snap(),
    contacts: NAMES,
    opened: new Set<ResultTab>(["all"]),
    allSlot: <div data-all-slot="">전체 대화 내용 <input data-chat-input="" /></div>,
    ...over,
  };
  const r = render(<ResultPanel {...props} />);
  return { ...r, onTab, panel: r.container.querySelector<HTMLElement>("[data-result-panel]")! };
}
const tabs = (c: ParentNode) => Array.from(c.querySelectorAll<HTMLElement>("[data-result-tab]"));
const tabOf = (c: ParentNode, id: string) => c.querySelector<HTMLElement>(`[data-result-tab="${id}"]`)!;
const text = (el: Element | null | undefined) => el?.textContent ?? "";

describe("탭 행 (A-3)", () => {
  it("tablist 안에 아이콘 탭 다섯 개: 전체·마피아·유령·귓속말·기록, 접근성 이름이 붙는다", () => {
    const { container } = setup();
    const list = container.querySelector("[role=tablist]")!;
    expect(list).not.toBeNull();
    expect(tabs(container).map((t) => t.getAttribute("data-result-tab"))).toEqual(["all", "mafia", "ghost", "whisper", "log"]);
    expect(tabs(container).map((t) => t.getAttribute("aria-label"))).toEqual(["전체 대화", "마피아 밤 대화", "유령 대화", "귓속말 기록", "판 기록"]);
    for (const t of tabs(container)) {
      expect(t.getAttribute("role")).toBe("tab");
      expect(t.querySelector("svg")).not.toBeNull();
    }
  });

  it("tabsVisible 이 거짓이면 전체 탭 하나뿐이다", () => {
    const { container } = setup({ tabsVisible: false });
    expect(tabs(container).map((t) => t.getAttribute("data-result-tab"))).toEqual(["all"]);
  });

  it("선택된 탭만 aria-selected 이고 라벨 14px 이 아이콘 옆에 붙는다", () => {
    const { container } = setup({ tab: "ghost", expanded: true, opened: new Set<ResultTab>(["all", "ghost"]) });
    expect(tabs(container).map((t) => t.getAttribute("aria-selected"))).toEqual(["false", "false", "true", "false", "false"]);
    const labels = Array.from(container.querySelectorAll(".mf-result__tab-label")).map((e) => text(e));
    expect(labels).toEqual([RESULT_PANEL_TEXT.tab.ghost]);
    expect(labels).toEqual(["유령"]);
  });

  it("탭을 누르면 onTab(id), 좌우 화살표키는 이웃 탭으로 옮긴다 (끝에서 끝으로 돈다)", () => {
    const { container, onTab } = setup({ tab: "mafia", expanded: true });
    fireEvent.click(tabOf(container, "whisper"));
    expect(onTab).toHaveBeenLastCalledWith("whisper");
    fireEvent.keyDown(tabOf(container, "mafia"), { key: "ArrowRight" });
    expect(onTab).toHaveBeenLastCalledWith("ghost");
    fireEvent.keyDown(tabOf(container, "mafia"), { key: "ArrowLeft" });
    expect(onTab).toHaveBeenLastCalledWith("all");
    fireEvent.keyDown(tabOf(container, "all"), { key: "ArrowLeft" });
    expect(onTab).toHaveBeenLastCalledWith("log");
  });

  it("마피아 탭 아이콘만 진홍 표식(is-mafia)이다", () => {
    const { container } = setup();
    expect(tabOf(container, "mafia").classList.contains("is-mafia")).toBe(true);
    for (const id of ["all", "ghost", "whisper", "log"]) expect(tabOf(container, id).classList.contains("is-mafia")).toBe(false);
  });

  it("새 탭 점(data-result-dot): 열린 적 없는 마피아·유령·귓속말 탭에만, 기록·전체 탭에는 없다", () => {
    const { container } = setup();
    const dotted = tabs(container).filter((t) => t.querySelector("[data-result-dot]") !== null).map((t) => t.getAttribute("data-result-tab"));
    expect(dotted).toEqual(["mafia", "ghost", "whisper"]);
    cleanup();
    const again = setup({ opened: new Set<ResultTab>(["all", "mafia", "whisper"]) });
    const left = tabs(again.container).filter((t) => t.querySelector("[data-result-dot]") !== null).map((t) => t.getAttribute("data-result-tab"));
    expect(left).toEqual(["ghost"]);
  });
});

describe("전체 탭: 접힌 상태 (A-3)", () => {
  it("allSlot 이 보이고 확장이 아니며 숨은 기록 본문은 DOM 에 없다 (탭을 열기 전 본문 없음, T-11-23)", () => {
    const { container, panel } = setup();
    expect(container.querySelector("[data-all-slot]")).not.toBeNull();
    expect(panel.getAttribute("data-expanded")).toBe("false");
    expect(panel.getAttribute("data-tab")).toBe("all");
    expect(text(container)).not.toContain("오늘 밤은 지우");
    expect(text(container)).not.toContain("억울해");
    expect(text(container)).not.toContain("비밀이야");
  });
});

describe("마피아 탭: 확장 (D-3, D-9)", () => {
  const open = (extra: Partial<ResultPanelProps> = {}) => setup({ tab: "mafia", expanded: true, opened: new Set<ResultTab>(["all", "mafia"]), ...extra });

  it("data-expanded=true, 입력줄(allSlot)이 DOM 에 없고 마피아 줄이 보인다", () => {
    const { container, panel } = open();
    expect(panel.getAttribute("data-expanded")).toBe("true");
    expect(container.querySelector("[data-chat-input]")).toBeNull();
    expect(container.querySelector("[data-all-slot]")).toBeNull();
    expect(Array.from(container.querySelectorAll(".mv-chat__msg .mv-chat__text")).map((e) => text(e))).toEqual(["오늘 밤은 지우", "좋아", "다음은 하윤"]);
  });

  it("줄의 n 이 바뀔 때마다 앞에 `{n}밤` 구분선이 한 번 있다", () => {
    const { container } = open();
    const body = container.querySelector("[data-result-body]")!;
    const order = Array.from(body.children).map((e) => (e.hasAttribute("data-result-divider") ? `|${text(e)}` : text(e.querySelector(".mv-chat__text"))));
    expect(order).toEqual(["|1밤", "오늘 밤은 지우", "좋아", "|2밤", "다음은 하윤"]);
  });

  it("줄은 이름 점(자리 구분색) + 닉네임 + 본문 모양이다", () => {
    const { container } = open();
    const first = container.querySelector<HTMLElement>(".mv-chat__msg")!;
    expect(first.getAttribute("data-seat")).toBe("3");
    expect(text(first.querySelector(".mv-chat__name"))).toBe("도현");
    expect(first.querySelector<HTMLElement>(".mv-chat__dot")!.style.background).toContain("var(--seat-4)");
  });

  it("높이는 expandedHeight 로 정해진다 (인라인 height)", () => {
    const { panel } = open({ expandedHeight: 392 });
    expect(panel.style.height).toBe("392px");
  });

  it("알약 자리(pill)는 확장일 때만 폭 전체로 남는다", () => {
    const { container } = open({ pill: <button type="button" data-pill-probe="">알약</button> });
    expect(container.querySelector(".mf-result__pill [data-pill-probe]")).not.toBeNull();
    cleanup();
    const folded = setup({ pill: <button type="button" data-pill-probe="">알약</button> });
    expect(folded.container.querySelector("[data-pill-probe]")).toBeNull();
  });

  it("닉네임·본문의 마크업은 평문이다 (T-11-22)", () => {
    const lines = snap({ mafia: part<ResultLogChatLine>([mline(3, 1, "<img src=x onerror=alert(1)>")]) });
    const { container } = open({ lines, contacts: new Map([[3, "<b>도현</b>"]]) });
    expect(container.querySelector(".mv-chat__text img")).toBeNull();
    expect(container.querySelector(".mv-chat__name b")).toBeNull();
    expect(text(container.querySelector(".mv-chat__text"))).toBe("<img src=x onerror=alert(1)>");
    expect(text(container.querySelector(".mv-chat__name"))).toBe("<b>도현</b>");
  });
});

describe("유령·귓속말·기록 탭 (A-3)", () => {
  it("유령 탭: 유령 줄 + `{n}일차` 구분선", () => {
    const { container } = setup({ tab: "ghost", expanded: true });
    const body = container.querySelector("[data-result-body]")!;
    const order = Array.from(body.children).map((e) => (e.hasAttribute("data-result-divider") ? `|${text(e)}` : text(e.querySelector(".mv-chat__text"))));
    expect(order).toEqual(["|2일차", "억울해", "|3일차", "누가 범인"]);
  });

  it("귓속말 탭: 줄마다 `보낸 얼굴 → 받은 얼굴` 머리줄 + 본문 한 줄 + `{n}일차` 구분선", () => {
    const { container } = setup({ tab: "whisper", expanded: true });
    const body = container.querySelector("[data-result-body]")!;
    expect(Array.from(body.querySelectorAll("[data-result-divider]")).map((e) => text(e))).toEqual(["1일차", "2일차"]);
    const rows = Array.from(body.querySelectorAll<HTMLElement>("[data-result-whisper]"));
    expect(rows).toHaveLength(2);
    const heads = rows.map((r) => Array.from(r.querySelectorAll<HTMLImageElement>(".mf-result__face")).map((i) => i.getAttribute("src")));
    expect(heads[0]).toEqual(["/characters/faces/face-0.png", "/characters/faces/face-1.png"]);
    expect(heads[1]).toEqual(["/characters/faces/face-1.png", "/characters/faces/face-0.png"]);
    expect(rows[0]!.querySelector(".mf-result__arrow")).not.toBeNull();
    expect(rows[0]!.querySelector<HTMLElement>(".mf-result__whisper-dot")!.style.background).toContain("var(--seat-1)");
    expect(text(rows[0]!.querySelector(".mf-result__whisper-text"))).toBe("비밀이야");
    // 얼굴 그림 대체 글은 닉네임이다
    expect(Array.from(rows[0]!.querySelectorAll<HTMLImageElement>(".mf-result__face")).map((i) => i.alt)).toEqual(["지우", "하윤"]);
  });

  it("줄이 없는 탭은 본문 없이 quiet 아이콘 하나다 (글 없음)", () => {
    const { container } = setup({ tab: "ghost", expanded: true, lines: snap({ ghost: part<ResultLogChatLine>([]) }) });
    const body = container.querySelector("[data-result-body]")!;
    expect(body.querySelector("[data-result-divider]")).toBeNull();
    expect(body.querySelectorAll("svg")).toHaveLength(1);
    expect(text(body).trim()).toBe("");
  });

  it("탭 아이콘은 줄이 없어도 나타난다 (마피아가 한마디도 안 했다는 사실도 정보)", () => {
    const { container } = setup({ lines: snap({ mafia: part<ResultLogChatLine>([]) }) });
    expect(tabOf(container, "mafia")).not.toBeNull();
  });

  it("기록 탭은 logSlot 이 채운다 (11-11), 없으면 빈 몸통", () => {
    const { container } = setup({ tab: "log", expanded: true, logSlot: <div data-log-probe="">타임라인</div> });
    expect(container.querySelector("[data-result-body='log'] [data-log-probe]")).not.toBeNull();
    cleanup();
    const bare = setup({ tab: "log", expanded: true });
    expect(bare.container.querySelector("[data-result-body='log']")).not.toBeNull();
  });
});

describe("기록 탭 (11-11)", () => {
  const view = { result: TL_RESULT, day: { voteLog: TL_VOTE_LOG } };
  const logSnap = (): ResultLogSnapshot => ({ ...snap(), ...tlLog() });

  it("기록 탭 몸통은 view 가 있을 때 일차 카드 띠와 하루 상세다 — 탭을 열기 전엔 DOM 에 없다", () => {
    const closed = setup({ tab: "all", view, lines: logSnap(), contacts: TL_NAMES });
    expect(closed.container.querySelector("[data-day-card]")).toBeNull();
    closed.unmount();
    const open = setup({ tab: "log", expanded: true, view, lines: logSnap(), contacts: TL_NAMES });
    expect(open.container.querySelectorAll("[data-day-card]")).toHaveLength(3);
    expect(open.container.querySelector("[data-day-detail='1']")).not.toBeNull();
    expect(open.container.querySelector("[data-result-body='log']")?.classList.contains("mf-result__body--log")).toBe(true);
  });

  it("logSlot 이 있으면 그것이 우선이다", () => {
    const { container } = setup({ tab: "log", expanded: true, view, lines: logSnap(), logSlot: <i data-custom="" /> });
    expect(container.querySelector("[data-custom]")).not.toBeNull();
    expect(container.querySelector("[data-day-card]")).toBeNull();
  });

  it("귓속말 탭: focusDay 가 있으면 그날 구분선(data-day)이 보이게 스크롤한다 · onJumpWhisper 는 기록 상세에 이어진다", () => {
    const scrollIntoView = vi.fn();
    Object.defineProperty(Element.prototype, "scrollIntoView", { configurable: true, value: scrollIntoView });
    setup({ tab: "whisper", expanded: true, focusDay: 2 });
    const target = scrollIntoView.mock.contexts.at(-1) as HTMLElement;
    expect(target.getAttribute("data-day")).toBe("2");
    delete (Element.prototype as { scrollIntoView?: unknown }).scrollIntoView;
  });

  it("기록 탭의 귓속말 쌍은 onJumpWhisper(n) 을 부른다", () => {
    const onJumpWhisper = vi.fn();
    const { container } = setup({ tab: "log", expanded: true, view, lines: logSnap(), contacts: TL_NAMES, onJumpWhisper });
    fireEvent.click(container.querySelector("[data-day-detail='1'] [data-whisper-pair]")!);
    expect(onJumpWhisper).toHaveBeenCalledWith(1);
  });
});
