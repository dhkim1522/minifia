/// <reference types="node" />
import { readFileSync } from "node:fs";
import { act, cleanup, fireEvent, render, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { RoleId } from "../../shared/game/roles";
import type { ClaimLogEntry, MorningView, PhaseId, RoomView, SpectateView } from "../../shared/protocol";
import type { RoomConnection, RoomEvent } from "../../src/net/useRoomConnection";
import { DayScene } from "../../src/screens/DayScene";
import { TABLE_FIT_MIN_H, TAG_H } from "../../src/game/dayTable";

// 낮 장면 단위 테스트: 순차 주장(03.1 UI-SPEC B)·낮 토론. 낮 단계는 DayTable 하나를 쓴다(결정 0017-1).
// 서버와는 view 픽스처로만 만난다.

const NOW = 1_700_000_000_000;

interface ViewOpts {
  phase: PhaseId;
  n?: number;
  /** claim 단계의 지금 차례 seat. 기본 0(= 나). null 이면 차례 키를 싣지 않는다 */
  turn?: number | null;
  role?: RoleId;
  allies?: number[];
  /** 탈락한 자리들 */
  dead?: number[];
  spectate?: SpectateView;
  /** 마감까지 남은 ms (기본 8000) */
  endsIn?: number;
  /** 공개된 주장 기록 (기본 비어 있음) */
  claimLog?: ClaimLogEntry[];
  /** 아침 발표(morning 단계에서만 싣는다) */
  morning?: MorningView;
}

function makeView(o: ViewOpts): RoomView {
  const me: RoomView["me"] = { seat: 0, isHost: false };
  if (o.role !== undefined) me.role = o.role;
  if (o.allies !== undefined) me.allies = o.allies;
  const dead = o.dead ?? [];
  const turn = o.turn === undefined ? 0 : o.turn;
  const view: RoomView = {
    code: "0042",
    phase: o.phase,
    phaseEndsAt: NOW + (o.endsIn ?? 8_000),
    phaseDurationMs: 8_000,
    serverNow: NOW,
    minPlayers: 4,
    maxPlayers: 8,
    players: [
      { seat: 0, nickname: "지우", connected: true, isHost: true },
      { seat: 1, nickname: "하윤", connected: true, isHost: false },
      { seat: 2, nickname: "민지", connected: true, isHost: false },
      { seat: 3, nickname: "도현", connected: true, isHost: false },
    ].map((p) => (dead.includes(p.seat) ? { ...p, alive: false } : p)),
    me,
    day: {
      n: o.n ?? 1,
      roles: ["mafia", "police", "citizen"],
      ...(o.phase === "claim" && turn !== null ? { turn: { seat: turn } } : {}),
      claimLog: o.claimLog ?? [],
    },
  };
  if (o.spectate) view.spectate = o.spectate;
  if (o.morning !== undefined && view.day) view.day.morning = o.morning;
  return view;
}

function conn(view: RoomView, over: Partial<RoomConnection> = {}): RoomConnection {
  return {
    status: "open",
    banner: "hidden",
    view,
    offset: 0,
    epoch: 1,
    removedReason: null,
    canSend: true,
    send: vi.fn(() => true),
    onEvent: vi.fn(() => () => {}),
    reconnect: vi.fn(),
    retry: vi.fn(),
    ...over,
  };
}

function scene(view: RoomView, over: Partial<RoomConnection> = {}) {
  const c = conn(view, over);
  const utils = render(<DayScene view={view} connection={c} myRoleButton={<button type="button">내 역할</button>} />);
  const rerender = (v: RoomView) =>
    utils.rerender(<DayScene view={v} connection={{ ...c, view: v }} myRoleButton={<button type="button">내 역할</button>} />);
  return { ...utils, rerender, conn: c };
}

const claimRows = (c: HTMLElement) => c.querySelectorAll(".mf-dt__claim").length; // 옛 아랫줄이 어디에도 없음을 세는 용도
const chipGroup = () => within(document.body).queryByRole("group", { name: "주장할 직업" });
const turnText = (c: HTMLElement) => c.querySelector(".st-row .stat")?.textContent ?? "";

afterEach(cleanup);

describe("DayScene 순차 주장 하단 (03.1 UI-SPEC B, D-03·D-04)", () => {
  // 남은 초는 시각에서 나오므로 현재 시각을 픽스처의 NOW 에 고정한다
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("claim 에서 day.turn.seat === me.seat 이면 직업 칩 줄(group 주장할 직업)이 있고 `…님이 주장하는 중` 은 없다", () => {
    const { container } = scene(makeView({ phase: "claim", turn: 0 }));
    const panel = container.querySelector(".mf-dayscene__panel");
    expect(chipGroup()).not.toBeNull();
    expect(panel?.textContent).toContain("내 차례예요");
    expect(panel?.querySelectorAll(".mf-seg__b").length).toBe(4);
    expect(panel?.textContent).not.toContain("님이 주장하는 중");
    expect(container.querySelector(".st-row")).toBeNull();
  });

  it("claim 에서 day.turn.seat !== me.seat 이면 `{차례 닉네임}님이 주장하는 중` 과 `N초` 가 있고 직업 칩 줄은 없다. N초는 헤더 타이머(role=timer)의 남은 시간과 같다", () => {
    const { container } = scene(makeView({ phase: "claim", turn: 2, endsIn: 5_000 }));
    expect(chipGroup()).toBeNull();
    expect(container.querySelectorAll(".mf-seg__b").length).toBe(0);
    expect(turnText(container)).toBe("민지님이 주장하는 중5초");
    const timer = container.querySelector('[role="timer"]');
    expect(timer?.getAttribute("aria-label")).toBe("남은 시간 5초");
  });

  it("차례 닉네임에 `<` 가 들어 있어도 글자로만 그린다 (T-03.1-10)", () => {
    const v = makeView({ phase: "claim", turn: 1 });
    const evil: RoomView = { ...v, players: v.players.map((p) => (p.seat === 1 ? { ...p, nickname: "<b>x</b>" } : p)) };
    const { container } = scene(evil);
    expect(container.querySelector(".st-row .stat b")?.textContent).toBe("<b>x</b>님이 주장하는 중");
    expect(container.querySelector(".st-row .stat b b")).toBeNull();
  });

  it("claim 의 테이블 이름표는 모두 이름 한 줄이다 — 탈락자 포함, '탈락' 글자 없음, 유령 그림 (D-04)", () => {
    const { container } = scene(makeView({ phase: "claim", turn: 0 }));
    const oneLine = (c: HTMLElement): boolean => [...c.querySelectorAll(".mf-dt__tag")].every((t) => t.children.length === 1 && t.firstElementChild?.classList.contains("mf-dt__name"));
    expect(oneLine(container)).toBe(true);
    cleanup();
    // 살아 있는 사람 화면에 탈락자(seat 3)가 있어도 `탈락` 줄이 없다
    const withDead = scene(makeView({ phase: "claim", turn: 2, dead: [3] }));
    expect(oneLine(withDead.container)).toBe(true);
    const tag = withDead.container.querySelector('.mf-dt__tag[data-seat="3"]');
    expect(tag?.classList.contains("mf-dt__tag--dead")).toBe(true);
    expect(tag?.textContent?.includes("탈락")).toBe(false);
    expect(withDead.container.querySelector('.mf-dt__seat[data-seat="3"] img')?.getAttribute("src")).toContain("/characters/ghost/");
  });

  it("claim 의 헤더 타이머는 마지막 5초여도 .mf-timer--urgent 가 아니다(calm), 숫자는 지금 차례의 남은 시간", () => {
    const { container } = scene(makeView({ phase: "claim", turn: 1, endsIn: 3_000 }));
    expect(container.querySelector(".mf-timer--urgent")).toBeNull();
    expect(container.querySelector(".mf-timer__num")?.textContent).toBe("0:03");
    cleanup();
    // 비교: 낮 토론은 마지막 5초에 진홍으로 바뀐다
    const disc = scene(makeView({ phase: "discussion", endsIn: 3_000 }));
    expect(disc.container.querySelector(".mf-timer--urgent")).not.toBeNull();
  });

  it("탈락한 viewer(spectate 있음)의 claim 하단은 직업 칩도 TurnPanel 도 아닌 기존 관전 하단(채팅 + 읽기 전용 안내)이다", () => {
    const spectate: SpectateView = {
      seats: [0, 1, 2, 3].map((seat) => ({ seat, job: "citizen" as const })),
      picks: { mafia: [], police: [], doctor: [] },
    };
    for (const turn of [0, 2]) {
      const { container } = scene(makeView({ phase: "claim", turn, dead: [0], role: "citizen", spectate }));
      const panel = container.querySelector(".mf-dayscene__panel")!;
      expect(panel.querySelectorAll(".mf-seg__b").length).toBe(0);
      expect(container.querySelector(".st-row")).toBeNull();
      expect(panel.textContent).toContain("탈락했어요 · 볼 수만 있어요");
      cleanup();
    }
  });

  it("마피아(allies [2])와 시민 화면의 패널 HTML 이 같다 — 내 차례도 남의 차례도 (T-02-25)", () => {
    const panelHtml = (v: RoomView) => {
      const r = scene(v);
      const html = r.container.querySelector(".mf-dayscene__panel")?.outerHTML ?? "";
      cleanup();
      return html;
    };
    for (const turn of [0, 2]) {
      const mafia = panelHtml(makeView({ phase: "claim", turn, role: "mafia", allies: [2] }));
      const citizen = panelHtml(makeView({ phase: "claim", turn, role: "citizen" }));
      expect(mafia.length).toBeGreaterThan(0);
      expect(mafia).toBe(citizen);
    }
  });

  it("마피아 화면에서만 동료 자리(2)에 .mf-dt__ring--mate", () => {
    const mafia = scene(makeView({ phase: "claim", role: "mafia", allies: [2] }));
    expect(mafia.container.querySelector('.mf-dt__seat[data-seat="2"] .mf-dt__ring--mate')).not.toBeNull();
    expect(mafia.container.querySelectorAll(".mf-dt__ring--mate").length).toBe(1);
    cleanup();
    const citizen = scene(makeView({ phase: "claim", role: "citizen" }));
    expect(citizen.container.querySelectorAll(".mf-dt__ring--mate").length).toBe(0);
  });

  it("끊긴 자리도 접근성 이름에 연결 끊김이 있고 이름표는 한 줄이다", () => {
    const v = makeView({ phase: "claim", turn: 0 });
    const off: RoomView = { ...v, players: v.players.map((p) => (p.seat === 1 ? { ...p, connected: false } : p)) };
    const { container } = scene(off);
    expect(container.querySelector('.mf-dt__seat[data-seat="1"]')?.getAttribute("aria-label")).toContain("연결 끊김");
    expect(claimRows(container)).toBe(0);
  });

  it("claim → discussion: DayTable 루트가 같은 DOM 노드이고, 토론 하단은 예전과 같다 (회귀)", () => {
    const r = scene(makeView({ phase: "claim", turn: 2 }));
    const table = r.container.querySelector(".mf-dt");
    expect(table).not.toBeNull();
    r.rerender(makeView({ phase: "discussion", role: "citizen" }));
    expect(r.container.querySelector(".mf-dt") === table).toBe(true);
    const panel = r.container.querySelector(".mf-dayscene__panel")!;
    expect(panel.querySelector(".st-row")).toBeNull();
    expect(panel.querySelectorAll(".mf-seg__b").length).toBe(0);
    expect(panel.querySelector("button")).not.toBeNull(); // 토론 보내기 줄(DiscussionControls)
  });
});

describe("DayScene 장면 상자 (SPEC 판 구성, 결정 0017-1)", () => {
  const css = readFileSync("src/styles/day.css", "utf8");
  const has = (re: RegExp): boolean => re.test(css);

  it("장면 상자 좌우 여백은 12px, max-width 389px 에서 4px, 같은 규칙에 flex 1·min-height 0 이 있고 .mf-table 규칙은 없다", () => {
    expect(has(/\.mf-dayscene__scene\s*\{[^}]*flex:\s*1[;\s][^}]*\}/)).toBe(true);
    expect(has(/\.mf-dayscene__scene\s*\{[^}]*min-height:\s*0/)).toBe(true);
    expect(has(/\.mf-dayscene__scene\s*\{[^}]*padding:\s*0 12px/)).toBe(true);
    expect(has(/@media \(max-width: 389px\)\s*\{[^@]*\.mf-dayscene__scene\s*\{[^}]*padding:\s*0 4px/)).toBe(true);
    expect(has(/\.mf-dayscene__scene \.mf-table/)).toBe(false);
  });

  it("장면이 짧으면 테이블이 올라간다: 잰 폭 352·높이 300 에서 테이블 면 top 118px (높이 407 기본이면 150px)", () => {
    class FakeRO {
      constructor(private cb: (entries: { contentRect: { width: number; height: number } }[]) => void) {}
      observe(): void {
        this.cb([{ contentRect: { width: 352, height: 300 } }]);
      }
      unobserve(): void {}
      disconnect(): void {}
    }
    const felt = (c: HTMLElement) => c.querySelector<HTMLElement>(".mf-dt__felt")!;
    try {
      vi.stubGlobal("ResizeObserver", FakeRO);
      const short = scene(makeView({ phase: "claim" }));
      expect(felt(short.container).style.top).toBe("118px");
      cleanup();
    } finally {
      vi.unstubAllGlobals();
    }
    const normal = scene(makeView({ phase: "claim" }));
    expect(felt(normal.container).style.top).toBe("150px");
  });
});

describe("DayScene 하단 패널 (SPEC 하단, 결정 0017-6)", () => {
  const css = readFileSync("src/styles/day.css", "utf8");
  const panelRule = /\.mf-dayscene__panel\s*\{([^}]*)\}/.exec(css)?.[1] ?? "";
  const views: [string, RoomView][] = [
    ["claim 내 차례", makeView({ phase: "claim", turn: 0 })],
    ["claim 남의 차례", makeView({ phase: "claim", turn: 2 })],
    ["discussion", makeView({ phase: "discussion" })],
  ];

  it.each(views)("%s: 패널 section 의 클래스는 mf-dayscene__panel 이다", (_name, view) => {
    const { container } = scene(view);
    expect(container.querySelectorAll("section.mf-dayscene__panel").length).toBe(1);
  });

  it("패널 높이 CSS: calc(157px + 아래 안전 영역)·flex none·border-box·night-800, 안쪽 여백 8px 16px calc(12px + 안전 영역), 간격 8", () => {
    expect(/height:\s*calc\(157px \+ env\(safe-area-inset-bottom\)\)/.test(panelRule)).toBe(true);
    expect(/flex:\s*none/.test(panelRule)).toBe(true);
    expect(/box-sizing:\s*border-box/.test(panelRule)).toBe(true);
    expect(/gap:\s*var\(--space-sm\)/.test(panelRule)).toBe(true);
    expect(/padding:\s*8px var\(--space-md\) calc\(12px \+ env\(safe-area-inset-bottom\)\)/.test(panelRule)).toBe(true);
    expect(/background:\s*var\(--night-800\)/.test(panelRule)).toBe(true);
    expect(/border-radius:\s*var\(--radius-lg\) var\(--radius-lg\) 0 0/.test(panelRule)).toBe(true);
  });

  it("패널 손잡이(::before) 규칙과 max-height 미디어의 패널·칩 여백 줄임 규칙이 없다 (세 단계 같은 높이)", () => {
    expect(css.includes(".mf-dayscene__panel::before")).toBe(false);
    expect(/@media \(max-height/.test(css)).toBe(false);
  });

  it("짧은 화면: 장면 상자를 352×340 으로 재면 내 자리(맨 앞) 이름표의 top + 46 이 340 이하 — 패널이 맨 앞 이름표를 가리지 않는다 (TABLE_FIT_MIN_H 이상)", () => {
    expect(TABLE_FIT_MIN_H <= 340).toBe(true);
    class FakeRO {
      constructor(private cb: (entries: { contentRect: { width: number; height: number } }[]) => void) {}
      observe(): void {
        this.cb([{ contentRect: { width: 352, height: 340 } }]);
      }
      unobserve(): void {}
      disconnect(): void {}
    }
    try {
      vi.stubGlobal("ResizeObserver", FakeRO);
      const short = scene(makeView({ phase: "discussion" }));
      const tag = short.container.querySelector<HTMLElement>('.mf-dt__tag[data-seat="0"]')!;
      expect(parseFloat(tag.style.top) + TAG_H <= 340).toBe(true);
      cleanup();
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

// ---- 03.1-07: 차례 강조 연결 · 주장 채팅 줄 · claim 중 이모티콘 ----

function emitter() {
  const listeners = new Set<(e: RoomEvent) => void>();
  return {
    onEvent: (l: (e: RoomEvent) => void) => {
      listeners.add(l);
      return () => {
        listeners.delete(l);
      };
    },
    emit: (e: RoomEvent) =>
      act(() => {
        for (const l of [...listeners]) l(e);
      }),
  };
}

const logItems = (c: HTMLElement) => [...c.querySelectorAll<HTMLElement>('.mf-dayscene__panel [role="log"] .mf-msglog__item')];
const itemRow = (el: HTMLElement) => `${el.querySelector(".mf-msglog__name")?.textContent}:${el.querySelector(".mf-msglog__text")?.textContent}`;
const seatsWith = (c: HTMLElement, selector: string) => [...c.querySelectorAll(selector)].map((el) => el.closest("[data-seat]")?.getAttribute("data-seat") ?? el.getAttribute("data-seat")).join(",");

describe("DayScene 차례 강조 (D-03)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("claim: day.turn.seat 한 자리에만 발밑 링·말풍선 배지·이름표 반전이 하나씩 있고, 차례가 넘어가면 다음 자리로 옮겨 간다", () => {
    const r = scene(makeView({ phase: "claim", turn: 2 }));
    expect(r.container.querySelectorAll(".mf-dt__spot").length).toBe(1);
    expect(r.container.querySelectorAll(".mf-dt__turn").length).toBe(1);
    expect(r.container.querySelectorAll(".mf-dt__tag--turn").length).toBe(1);
    expect(seatsWith(r.container, ".mf-dt__spot")).toBe("2");
    expect(r.container.querySelector('.mf-dt__tag--turn')?.getAttribute("data-seat")).toBe("2");
    r.rerender(makeView({ phase: "claim", turn: 3 }));
    expect(r.container.querySelectorAll(".mf-dt__spot").length).toBe(1);
    expect(seatsWith(r.container, ".mf-dt__spot")).toBe("3");
    expect(r.container.querySelector('.mf-dt__tag--turn')?.getAttribute("data-seat")).toBe("3");
  });

  it("내 차례여도 내 자리에 켜진다", () => {
    const r = scene(makeView({ phase: "claim", turn: 0 }));
    expect(seatsWith(r.container, ".mf-dt__spot")).toBe("0");
  });

  it("discussion·night·morning 에는 셋 모두 없다", () => {
    for (const phase of ["discussion", "night", "morning"] as const) {
      const r = scene(makeView({ phase, role: "citizen" }));
      expect(`${phase}:${r.container.querySelectorAll(".mf-dt__spot, .mf-dt__turn, .mf-dt__tag--turn").length}`).toBe(`${phase}:0`);
      cleanup();
    }
  });
});

describe("DayScene 주장 채팅 줄 (D-04, D-05)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  const log: ClaimLogEntry[] = [
    { n: 1, seat: 1, claim: "police" },
    { n: 1, seat: 0, claim: "citizen" },
    { n: 2, seat: 3, claim: "mafia" },
  ];

  it("claim 중 남의 차례 하단 채팅 로그에 오늘 줄이 평문으로 올라온다(내 줄은 `나`), 어제(n 이 다른) 줄은 없다", () => {
    const { container } = scene(makeView({ phase: "claim", n: 1, turn: 2, claimLog: log }));
    expect(logItems(container).map(itemRow).join(" | ")).toBe("하윤:저는 경찰이에요 | 나:저는 시민이에요");
    // 대괄호·배지·카드가 없다
    expect(container.querySelector(".mf-dayscene__panel")?.textContent).not.toContain("[");
  });

  it("none 은 `말하지 않았어요`", () => {
    const { container } = scene(makeView({ phase: "claim", n: 1, turn: 3, claimLog: [{ n: 1, seat: 2, claim: "none" }] }));
    expect(logItems(container).map(itemRow).join(" | ")).toBe("민지:말하지 않았어요");
  });

  it("내 차례일 때는 하단에 채팅 로그가 없다(칩 패널만)", () => {
    const { container } = scene(makeView({ phase: "claim", n: 1, turn: 0, claimLog: log }));
    expect(container.querySelector('.mf-dayscene__panel [role="log"]')).toBeNull();
    expect(chipGroup()).not.toBeNull();
  });

  it("discussion 으로 넘어가도 오늘 주장 줄이 남고 그 뒤에 받은 채팅이 이어진다", () => {
    const ev = emitter();
    const r = scene(makeView({ phase: "discussion", n: 1, claimLog: log.slice(0, 2) }), { onEvent: ev.onEvent });
    expect(logItems(r.container).map(itemRow).join(" | ")).toBe("하윤:저는 경찰이에요 | 나:저는 시민이에요");
    ev.emit({ t: "chat", seq: 1, seat: 2, template: "innocent", at: 0 } as RoomEvent);
    expect(logItems(r.container).map(itemRow).join(" | ")).toBe("하윤:저는 경찰이에요 | 나:저는 시민이에요 | 민지:저 아니에요");
  });

  it("재접속(새로 마운트)해도 같은 view 의 오늘 줄이 복원된다", () => {
    const view = makeView({ phase: "discussion", n: 1, claimLog: log.slice(0, 2) });
    const first = scene(view);
    const before = logItems(first.container).map(itemRow).join(" | ");
    cleanup();
    const second = scene(view);
    expect(logItems(second.container).map(itemRow).join(" | ")).toBe(before);
    expect(before).toBe("하윤:저는 경찰이에요 | 나:저는 시민이에요");
  });

  it("일차가 바뀌면 지난 일차 줄은 사라진다", () => {
    const r = scene(makeView({ phase: "discussion", n: 1, claimLog: log.slice(0, 2) }));
    r.rerender(makeView({ phase: "discussion", n: 2, claimLog: log.slice(0, 2) }));
    expect(logItems(r.container).length).toBe(0);
  });

  it("night 에는 마피아 채팅만 있고 주장 줄이 없다", () => {
    const { container } = scene(makeView({ phase: "night", n: 1, role: "mafia", allies: [2], claimLog: log.slice(0, 2) }));
    const text = container.querySelector(".mf-dayscene__panel")?.textContent ?? "";
    expect(text).not.toContain("저는 경찰이에요");
    expect(text).not.toContain("저는 시민이에요");
  });

  it("닉네임에 `<` 가 들어 있어도 글자로만 그린다 (T-03.1-47)", () => {
    const v = makeView({ phase: "claim", n: 1, turn: 2, claimLog: [{ n: 1, seat: 1, claim: "doctor" }] });
    const evil: RoomView = { ...v, players: v.players.map((p) => (p.seat === 1 ? { ...p, nickname: "<b>x</b>" } : p)) };
    const { container } = scene(evil);
    expect(logItems(container).map(itemRow).join(" | ")).toBe("<b>x</b>:저는 의사예요");
    expect(container.querySelector(".mf-dayscene__panel .mf-msglog b")).toBeNull();
  });

  it("탈락한 viewer 의 claim 하단: 주장 줄이 있는 채팅 세 줄 + 읽기 전용 안내만, stat·이모티콘 버튼은 없다", () => {
    const spectate: SpectateView = {
      seats: [0, 1, 2, 3].map((seat) => ({ seat, job: "citizen" as const })),
      picks: { mafia: [], police: [], doctor: [] },
    };
    const { container } = scene(makeView({ phase: "claim", n: 1, turn: 2, dead: [0], role: "citizen", spectate, claimLog: log.slice(0, 2) }));
    const panel = container.querySelector(".mf-dayscene__panel")!;
    expect(logItems(container).map(itemRow).join(" | ")).toBe("하윤:저는 경찰이에요 | 나:저는 시민이에요");
    expect(panel.querySelector(".mf-ro")?.textContent).toBe("탈락했어요 · 볼 수만 있어요");
    expect(panel.querySelector(".st-row")).toBeNull();
    expect(panel.querySelector('button[aria-label="이모티콘"]')).toBeNull();
  });
});

describe("DayScene claim 중 이모티콘 (결정 0023-2)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("claim 중 emoji 이벤트를 받으면 그 자리 머리 위 말풍선이 뜨고 live 줄이 읽는다", () => {
    const ev = emitter();
    const { container } = scene(makeView({ phase: "claim", turn: 2 }), { onEvent: ev.onEvent });
    expect(container.querySelectorAll(".mf-dt__emoji").length).toBe(0);
    ev.emit({ t: "emoji", seat: 1, icon: "heart", at: 0 });
    expect(container.querySelectorAll('.mf-dt__emoji[data-seat="1"]').length).toBe(1);
    expect(container.querySelector(".mf-sr-only")?.textContent).toBe("하윤: 좋아요");
  });

  it("남의 차례 하단 이모티콘 버튼을 눌러 보내면 { t:'emoji', icon } 가 간다", () => {
    const r = scene(makeView({ phase: "claim", turn: 2 }));
    const btn = r.container.querySelector<HTMLButtonElement>('button[aria-label="이모티콘"]')!;
    act(() => btn.click());
    const heart = document.querySelector<HTMLButtonElement>('dialog button[aria-label="좋아요"]')!;
    act(() => heart.click());
    expect(r.conn.send).toHaveBeenCalledWith({ t: "emoji", icon: "heart" });
  });
});

describe("DayScene 낮 캐릭터 탭 → 유저 기록 카드 (03.1-08, D-06·D-19)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  const claimLog: ClaimLogEntry[] = [
    { n: 1, seat: 0, claim: "citizen" },
    { n: 1, seat: 1, claim: "police" },
    { n: 1, seat: 2, claim: "none" },
    { n: 2, seat: 1, claim: "mafia" },
  ];
  const inspect = (c: HTMLElement) => [...c.querySelectorAll<HTMLButtonElement>(".mf-dt button.mf-dt__seat--inspect")];
  const sheet = (name: string) => document.querySelector(`dialog[aria-label="${name}"]`);
  const rowsOf = (name: string) => [...(sheet(name)?.querySelectorAll(".mf-urecord__row") ?? [])].map((li) => li.textContent);

  it("claim·discussion·morning: 모든 자리가 button 이고 이름이 `{닉네임}, 주장 기록 보기` 로 끝난다(내 자리는 (나) 포함)", () => {
    for (const phase of ["claim", "discussion", "morning"] as const) {
      const { container } = scene(makeView({ phase, claimLog }));
      const names = inspect(container).map((b) => b.getAttribute("aria-label") ?? "");
      expect(`${phase}:${names.length}`).toBe(`${phase}:4`);
      expect(names.every((n) => n.endsWith(", 주장 기록 보기"))).toBe(true);
      expect(names.some((n) => n.startsWith("지우 (나)"))).toBe(true);
      expect(container.querySelectorAll('.mf-dt [role="group"][data-seat]').length).toBe(0);
      cleanup();
    }
  });

  it("자리를 누르면 `{닉네임} 기록` 시트가 열리고 그 사람의 오늘·지난 줄이 최신 위로 보인다", () => {
    const { container } = scene(makeView({ phase: "discussion", claimLog }));
    expect(sheet("하윤 기록")).toBeNull();
    fireEvent.click(within(container).getByRole("button", { name: "하윤, 주장 기록 보기" }));
    expect(sheet("하윤 기록") !== null).toBe(true);
    expect(rowsOf("하윤 기록")).toEqual(["2일차마피아라고 주장했어요", "1일차경찰이라고 주장했어요"]);
  });

  it("내 자리를 누르면 내 기록이 열린다", () => {
    const { container } = scene(makeView({ phase: "claim", turn: 2, claimLog }));
    fireEvent.click(inspect(container).find((b) => b.dataset.seat === "0")!);
    expect(sheet("지우 기록") !== null).toBe(true);
    expect(rowsOf("지우 기록")).toEqual(["1일차시민이라고 주장했어요"]);
  });

  it("기록이 없는 사람은 빈 상태 문구가 보인다", () => {
    const { container } = scene(makeView({ phase: "discussion", claimLog }));
    fireEvent.click(within(container).getByRole("button", { name: "도현, 주장 기록 보기" }));
    expect(sheet("도현 기록")?.textContent).toContain("아직 주장 기록이 없어요");
  });

  it("아침(morning)에도 열린다", () => {
    const { container } = scene(makeView({ phase: "morning", claimLog }));
    fireEvent.click(within(container).getByRole("button", { name: "하윤, 주장 기록 보기" }));
    expect(sheet("하윤 기록") !== null).toBe(true);
  });

  it("탈락한 viewer(spectate 있음)도 낮에 같은 카드를 연다 — 주장 기록만, 직업 정보 줄이 더해지지 않는다", () => {
    const spectate: SpectateView = {
      seats: [0, 1, 2, 3].map((seat) => ({ seat, job: seat === 1 ? ("mafia" as const) : ("citizen" as const) })),
      picks: { mafia: [], police: [], doctor: [] },
    };
    const { container } = scene(makeView({ phase: "discussion", dead: [0], spectate, role: "citizen", claimLog }));
    const btn = inspect(container).find((b) => b.dataset.seat === "1")!;
    expect(btn.getAttribute("aria-label")?.endsWith(", 주장 기록 보기")).toBe(true);
    fireEvent.click(btn);
    const dlg = sheet("하윤 기록")!;
    expect(dlg !== null).toBe(true);
    expect(dlg.querySelectorAll("li").length).toBe(2);
    expect(rowsOf("하윤 기록")).toEqual(["2일차마피아라고 주장했어요", "1일차경찰이라고 주장했어요"]);
    // 카드의 글자는 제목·닫기·주장 문장뿐이다(관전자에게만 오는 실제 직업 줄이 없다)
  });

  it("연결이 끊겨도(canSend false) 기록 카드는 열리고 서버 요청은 없다", () => {
    const r = scene(makeView({ phase: "discussion", claimLog }), { canSend: false, status: "reconnecting", banner: "reconnecting" });
    fireEvent.click(within(r.container).getByRole("button", { name: "하윤, 주장 기록 보기" }));
    expect(sheet("하윤 기록") !== null).toBe(true);
    expect(vi.mocked(r.conn.send).mock.calls.length).toBe(0);
  });

  it("닫기를 누르면 닫는다", () => {
    const { container } = scene(makeView({ phase: "discussion", claimLog }));
    fireEvent.click(within(container).getByRole("button", { name: "하윤, 주장 기록 보기" }));
    fireEvent.click(within(sheet("하윤 기록") as HTMLElement).getByRole("button", { name: "닫기" }));
    act(() => {
      vi.advanceTimersByTime(400);
    });
    expect(sheet("하윤 기록")).toBeNull();
  });

  it("카드 입력은 claimLog 뿐이다 — 주장 문장이 DayScene 이 만드는 채팅 줄과 같은 표를 쓰고 view.spectate 직업은 카드에 나오지 않는다", () => {
    const spectate: SpectateView = {
      seats: [0, 1, 2, 3].map((seat) => ({ seat, job: seat === 2 ? ("doctor" as const) : ("citizen" as const) })),
      picks: { mafia: [], police: [], doctor: [] },
    };
    const { container } = scene(makeView({ phase: "discussion", dead: [0], spectate, role: "citizen", claimLog }));
    fireEvent.click(within(container).getByRole("button", { name: "민지, 의사, 주장 기록 보기" }));
    expect(rowsOf("민지 기록")).toEqual(["1일차말하지 않았어요"]);
    expect(sheet("민지 기록")?.textContent?.includes("의사")).toBe(false);
  });
});

describe("DayScene 아침 어둡게 층·유령 강조 (03.1-10, D-15, UI-SPEC F)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  const dims = (c: HTMLElement) => c.querySelectorAll(".mf-dt__dim");
  const spot = (c: HTMLElement) => [...c.querySelectorAll<HTMLElement>(".mf-dt__seat--spotlit")];
  const seatNo = (el: HTMLElement) => el.getAttribute("data-seat");

  it("morning: .mf-dt__dim 이 정확히 하나(aria-hidden)이고 헤더·하단 패널 안에는 없다", () => {
    const { container } = scene(makeView({ phase: "morning", morning: { eliminated: 2, phrase: 1 }, dead: [2] }));
    expect(dims(container).length).toBe(1);
    expect(dims(container)[0]!.getAttribute("aria-hidden")).toBe("true");
    expect(container.querySelector(".mf-phasebar .mf-dt__dim") === null).toBe(true);
    expect(container.querySelector(".mf-dayscene__panel .mf-dt__dim") === null).toBe(true);
  });

  it("morning 이 아닌 단계(claim·discussion·night)에는 층이 0개", () => {
    for (const phase of ["claim", "discussion", "night"] as const) {
      const { container } = scene(makeView({ phase, role: "citizen" }));
      expect(`${phase}:${dims(container).length}`).toBe(`${phase}:0`);
      cleanup();
    }
  });

  it("탈락자 X 가 있는 아침: X 자리만 spotlit 이고 인라인 z-index 31, 탈락자 없는 아침은 spotlit 0개", () => {
    const { container } = scene(makeView({ phase: "morning", morning: { eliminated: 2, phrase: 1 }, dead: [2] }));
    expect(spot(container).map(seatNo).join(",")).toBe("2");
    expect(spot(container)[0]!.style.zIndex).toBe("31");
    cleanup();
    const quiet = scene(makeView({ phase: "morning", morning: {} }));
    expect(spot(quiet.container).length).toBe(0);
  });

  it("밤 → 아침을 직접 보면 X 자리에 pulse, 처음부터 아침으로 마운트하면 spotlit 만 있고 pulse 는 없다", () => {
    const r = scene(makeView({ phase: "night", role: "citizen" }));
    r.rerender(makeView({ phase: "morning", role: "citizen", morning: { eliminated: 2, phrase: 1 }, dead: [2] }));
    expect(r.container.querySelectorAll(".mf-dt__seat--pulse").length).toBe(1);
    expect(seatNo(r.container.querySelector<HTMLElement>(".mf-dt__seat--pulse")!)).toBe("2");
    cleanup();
    const fresh = scene(makeView({ phase: "morning", morning: { eliminated: 2, phrase: 1 }, dead: [2] }));
    expect(spot(fresh.container).length).toBe(1);
    expect(fresh.container.querySelectorAll(".mf-dt__seat--pulse").length).toBe(0);
  });

  it("아침 → 다음 단계(discussion)에서 pulse·spotlit·dim 이 모두 사라진다", () => {
    const r = scene(makeView({ phase: "night", role: "citizen" }));
    r.rerender(makeView({ phase: "morning", role: "citizen", morning: { eliminated: 2, phrase: 1 }, dead: [2] }));
    r.rerender(makeView({ phase: "discussion", role: "citizen", dead: [2] }));
    expect(`${spot(r.container).length},${r.container.querySelectorAll(".mf-dt__seat--pulse").length},${dims(r.container).length}`).toBe("0,0,0");
  });

  it("아침 카드·층이 탈락자·관전자·살아 있는 사람 화면 모두에 하나씩 보인다", () => {
    const spectate: SpectateView = {
      seats: [0, 1, 2, 3].map((seat) => ({ seat, job: "citizen" as const })),
      picks: { mafia: [], police: [], doctor: [] },
    };
    const views = [
      makeView({ phase: "morning", role: "citizen", morning: { eliminated: 0, phrase: 1 }, dead: [0], spectate }),
      makeView({ phase: "morning", role: "citizen", morning: { eliminated: 2, phrase: 1 }, dead: [2] }),
      makeView({ phase: "morning", role: "citizen", morning: { eliminated: 2, phrase: 1 }, dead: [0, 2] }),
    ];
    for (const [i, v] of views.entries()) {
      const { container } = scene(v);
      expect(`${i}:${container.querySelectorAll(".mf-morningcard").length},${dims(container).length}`).toBe(`${i}:1,1`);
      cleanup();
    }
  });

  it("아침 하단은 `아침이 밝았습니다` + `곧 낮 토론이 시작돼요`, 헤더는 `아침` / `{n+1}일차`", () => {
    const { container } = scene(makeView({ phase: "morning", n: 1, morning: {} }));
    expect(container.querySelector("h1")?.textContent).toBe("아침");
    expect(container.querySelector(".mf-phasebar__do")?.textContent).toBe("2일차");
    expect(container.querySelector(".mf-dayscene__panel h2")?.textContent).toBe("아침이 밝았습니다");
    expect(container.querySelector(".mf-dayscene__panel .mf-claimpanel__guide")?.textContent).toBe("곧 낮 토론이 시작돼요");
  });
});

describe("DayScene 눌리는 밤 끝 알림 (03.1-11, D-12, UI-SPEC D·R6)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  const withRecords = (view: RoomView, records: RoomView["me"]["records"]): RoomView => ({ ...view, me: { ...view.me, records } });
  const toast = (): HTMLElement | null => document.querySelector<HTMLElement>(".mf-rolecard-toast");

  function renderNotice(role: RoleId, props: { roleCardOpen?: boolean; onOpenActivity?: () => void } = {}) {
    const c = conn(makeView({ phase: "night", role }));
    const ui = (v: RoomView, p: typeof props) => (
      <DayScene
        view={v}
        connection={{ ...c, view: v }}
        myRoleButton={<button type="button">역할 카드</button>}
        roleCardOpen={p.roleCardOpen ?? false}
        onOpenActivity={p.onOpenActivity ?? (() => {})}
      />
    );
    const utils = render(ui(withRecords(makeView({ phase: "night", role }), []), props));
    return {
      ...utils,
      grow: (record: NonNullable<RoomView["me"]["records"]>[number], p: typeof props = props) =>
        utils.rerender(ui(withRecords(makeView({ phase: "morning", role, morning: {} }), [record]), p)),
      reprops: (p: typeof props) => utils.rerender(ui(withRecords(makeView({ phase: "morning", role, morning: {} }), [{ n: 1, target: 2, isMafia: true }]), p)),
    };
  }

  it.each([
    ["police", { n: 1, target: 2, isMafia: true }, "수사일지가 추가됐어요 · 눌러서 보기"],
    ["mafia", { n: 1, target: 2, died: false }, "암살일지가 추가됐어요 · 눌러서 보기"],
    ["doctor", { n: 1, target: 2 }, "치료일지가 추가됐어요 · 눌러서 보기"],
  ] as const)("%s: 같은 접속에서 기록이 늘면 눌리는 알림이 뜬다", (role, rec, text) => {
    const r = renderNotice(role);
    r.grow(rec);
    expect(toast()?.textContent ?? "(알림 없음)").toBe(text);
    expect(toast()?.parentElement?.getAttribute("role") ?? "(role 없음)").toBe("status");
  });

  it("시민에게는 알림이 없다", () => {
    const r = renderNotice("citizen");
    r.grow({ n: 1, target: 2, isMafia: true });
    expect(toast() === null ? "없음" : "있음").toBe("없음");
  });

  it("누르면 onOpenActivity 가 한 번 불리고 알림이 사라진다", () => {
    const onOpenActivity = vi.fn();
    const r = renderNotice("police", { onOpenActivity });
    r.grow({ n: 1, target: 2, isMafia: true });
    fireEvent.click(toast()!);
    expect(onOpenActivity).toHaveBeenCalledTimes(1);
    expect(toast() === null ? "사라짐" : "있음").toBe("사라짐");
  });

  it("시트가 열려 있으면 알림이 없고, 알림이 떠 있다가 시트가 열리면 사라진다", () => {
    const open = renderNotice("police", { roleCardOpen: true });
    open.grow({ n: 1, target: 2, isMafia: true });
    expect(toast() === null ? "없음" : "있음").toBe("없음");
    cleanup();
    const r = renderNotice("police");
    r.grow({ n: 1, target: 2, isMafia: true });
    expect(toast() === null ? "없음" : "있음").toBe("있음");
    r.reprops({ roleCardOpen: true });
    expect(toast() === null ? "없음" : "있음").toBe("없음");
  });

  it("4000ms 뒤 사라진다(3999 에는 있다)", () => {
    const r = renderNotice("doctor");
    r.grow({ n: 1, target: 2 });
    act(() => {
      vi.advanceTimersByTime(3_999);
    });
    expect(toast() === null ? "없음" : "있음").toBe("있음");
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(toast() === null ? "없음" : "있음").toBe("없음");
  });

  it("옛 알림 `수사 기록이 추가됐어요`, `.mf-records-toast` 가 없다", () => {
    const r = renderNotice("police");
    r.grow({ n: 1, target: 2, isMafia: true });
    expect(document.body.textContent?.includes("수사 기록이 추가됐어요") ? "있음" : "없음").toBe("없음");
    expect(document.querySelector(".mf-records-toast") === null ? "없음" : "있음").toBe("없음");
  });
});

describe("rolecard.css 알림 규약 (03.1-11, UI-SPEC D·R6)", () => {
  const css = readFileSync("src/styles/rolecard.css", "utf8");
  const rule = (sel: string): string => {
    const at = css.indexOf(`\n${sel} {`);
    return at < 0 ? "" : css.slice(css.indexOf("{", at) + 1, css.indexOf("}", at));
  };

  it(".mf-rolecard-toast: 눌리는 알약 - 높이 44 이상, 한 줄, 폭 상한, 색은 변수", () => {
    const r = rule(".mf-rolecard-toast");
    expect(/min-height:\s*var\(--tap-min\)/.test(r)).toBe(true);
    expect(/white-space:\s*nowrap/.test(r)).toBe(true);
    expect(/max-width:\s*calc\(100% - 32px\)/.test(r)).toBe(true);
    expect(/background:\s*color-mix\(in srgb, var\(--night-900\) 94%, transparent\)/.test(r)).toBe(true);
    expect(/border:\s*1px solid var\(--gray-100\)/.test(r)).toBe(true);
    expect(/border-radius:\s*var\(--radius-pill\)/.test(r)).toBe(true);
    expect(/font-size:\s*14px/.test(r)).toBe(true);
    expect(/font-weight:\s*700/.test(r)).toBe(true);
    expect(/color:\s*var\(--gray-50\)/.test(r)).toBe(true);
    expect(/padding:\s*12px 16px/.test(r)).toBe(true);
    expect(/pointer-events:\s*auto/.test(r)).toBe(true);
    expect(/animation:[^;]*var\(--dur-fast\)/.test(r)).toBe(true);
  });

  it(".mf-rolecard-toast-wrap: 헤더 아래 top 127, 클릭을 막지 않는다", () => {
    const r = rule(".mf-rolecard-toast-wrap");
    expect(/top:\s*127px/.test(r)).toBe(true);
    expect(/pointer-events:\s*none/.test(r)).toBe(true);
    expect(/position:\s*absolute/.test(r)).toBe(true);
  });

  it("줄이는 모션 설정에서는 animation 이 없다", () => {
    expect(/prefers-reduced-motion:\s*reduce[\s\S]*\.mf-rolecard-toast\s*\{[^}]*animation:\s*none/.test(css)).toBe(true);
  });
});

