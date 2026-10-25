/// <reference types="node" />
import { readFileSync } from "node:fs";
import { cleanup, render, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { RoleId } from "../../shared/game/roles";
import type { PhaseId, RoomView, SpectateView } from "../../shared/protocol";
import type { RoomConnection } from "../../src/net/useRoomConnection";
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
      claimLog: [],
    },
  };
  if (o.spectate) view.spectate = o.spectate;
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

const claimRows = (c: HTMLElement) => c.querySelectorAll(".mf-dt__claim").length;
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

  it("claim 의 테이블 이름표에 아랫줄(.mf-dt__claim)이 하나도 없다 — 탈락자 포함 (D-04)", () => {
    const { container } = scene(makeView({ phase: "claim", turn: 0 }));
    expect(claimRows(container)).toBe(0);
    cleanup();
    // 살아 있는 사람 화면에 탈락자(seat 3)가 있어도 `탈락` 줄이 없다
    const withDead = scene(makeView({ phase: "claim", turn: 2, dead: [3] }));
    expect(claimRows(withDead.container)).toBe(0);
    expect(withDead.container.querySelectorAll(".mf-dt__claim--done, .mf-dt__claim--wait, .mf-dt__claim--dead").length).toBe(0);
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

  it("끊긴 자리도 접근성 이름에 연결 끊김이 있고 아랫줄은 없다", () => {
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

  it("장면이 짧으면 테이블이 올라간다: 잰 폭 352·높이 300 에서 테이블 면 top 117px (높이 407 기본이면 150px)", () => {
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
      expect(felt(short.container).style.top).toBe("117px");
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

  it("패널 높이 CSS: calc(157px + 아래 안전 영역)·flex none·border-box·night-800, 안쪽 여백 10px 16px calc(12px + 안전 영역), 간격 8", () => {
    expect(/height:\s*calc\(157px \+ env\(safe-area-inset-bottom\)\)/.test(panelRule)).toBe(true);
    expect(/flex:\s*none/.test(panelRule)).toBe(true);
    expect(/box-sizing:\s*border-box/.test(panelRule)).toBe(true);
    expect(/gap:\s*var\(--space-sm\)/.test(panelRule)).toBe(true);
    expect(/padding:\s*10px var\(--space-md\) calc\(12px \+ env\(safe-area-inset-bottom\)\)/.test(panelRule)).toBe(true);
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
