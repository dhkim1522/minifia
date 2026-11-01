/// <reference types="node" />
import { existsSync, readFileSync } from "node:fs";
import { act, cleanup, fireEvent, render, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { RoleId } from "../../shared/game/roles";
import type { ChatChannel, MorningView, PhaseId, RoomView, SpectateView, VoteLogEntry } from "../../shared/protocol";
import type { RoomConnection } from "../../src/net/useRoomConnection";
import { DayScene } from "../../src/screens/DayScene";
import { ChatStore } from "../../src/net/chatStore";
import { TABLE_FIT_MIN_H, TAG_H } from "../../src/game/dayTable";

// 낮 장면 단위 테스트: 낮 토론·기록 카드·아침·배경. 순차 주장은 없어졌다(07-04, CHAT-06). 낮 단계는 DayTable 하나를 쓴다(결정 0017-1).
// 서버와는 view 픽스처로만 만난다.

const NOW = 1_700_000_000_000;

interface ViewOpts {
  phase: PhaseId;
  n?: number;
  role?: RoleId;
  allies?: number[];
  /** 탈락한 자리들 */
  dead?: number[];
  spectate?: SpectateView;
  /** 마감까지 남은 ms (기본 8000) */
  endsIn?: number;
  /** 아침 발표(morning 단계에서만 싣는다) */
  morning?: MorningView;
  /** 날짜별 공개 투표 기록 (기본 없음) */
  voteLog?: VoteLogEntry[];
  /** 서버가 보낸 내 채널(view.me.chat). 없으면 키가 없다 */
  chat?: ChatChannel;
}

function makeView(o: ViewOpts): RoomView {
  const me: RoomView["me"] = { seat: 0, isHost: false };
  if (o.role !== undefined) me.role = o.role;
  if (o.allies !== undefined) me.allies = o.allies;
  if (o.chat !== undefined) me.chat = o.chat;
  const dead = o.dead ?? [];
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
    },
  };
  if (o.spectate) view.spectate = o.spectate;
  if (o.morning !== undefined && view.day) view.day.morning = o.morning;
  if (o.voteLog !== undefined && view.day) view.day.voteLog = o.voteLog;
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
  const chat = new ChatStore();
  const utils = render(<DayScene view={view} connection={c} chat={chat} myRoleButton={<button type="button">내 역할</button>} />);
  const rerender = (v: RoomView) =>
    utils.rerender(<DayScene view={v} connection={{ ...c, view: v }} chat={chat} myRoleButton={<button type="button">내 역할</button>} />);
  return { ...utils, rerender, conn: c };
}

afterEach(cleanup);

describe("DayScene 낮 토론 하단·테이블 (03.1 UI-SPEC B, 07-04 이후 순차 주장 없음)", () => {
  // 남은 초는 시각에서 나오므로 현재 시각을 픽스처의 NOW 에 고정한다
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("낮 토론의 테이블 이름표는 모두 이름 한 줄이다 — 탈락자 포함, '탈락' 글자 없음, 유령 그림 (D-04)", () => {
    const { container } = scene(makeView({ phase: "discussion" }));
    const oneLine = (c: HTMLElement): boolean => [...c.querySelectorAll(".mf-dt__tag")].every((t) => t.children.length === 1 && t.firstElementChild?.classList.contains("mf-dt__name"));
    expect(oneLine(container)).toBe(true);
    cleanup();
    // 살아 있는 사람 화면에 탈락자(seat 3)가 있어도 `탈락` 줄이 없다
    const withDead = scene(makeView({ phase: "discussion", dead: [3] }));
    expect(oneLine(withDead.container)).toBe(true);
    const tag = withDead.container.querySelector('.mf-dt__tag[data-seat="3"]');
    expect(tag?.classList.contains("mf-dt__tag--dead")).toBe(true);
    expect(tag?.textContent?.includes("탈락")).toBe(false);
    expect(withDead.container.querySelector('.mf-dt__seat[data-seat="3"] img')?.getAttribute("src")).toContain("/characters/ghost/");
  });

  it("낮 토론의 헤더 타이머는 마지막 5초에 진홍(urgent)이고, 낮 시작(dayAnnounce)은 calm 이다", () => {
    const disc = scene(makeView({ phase: "discussion", endsIn: 3_000 }));
    expect(disc.container.querySelector(".mf-timer--urgent")).not.toBeNull();
    expect(disc.container.querySelector(".mf-timer__num")?.textContent).toBe("0:03");
    cleanup();
    const announce = scene(makeView({ phase: "dayAnnounce", endsIn: 1_000 }));
    expect(announce.container.querySelector(".mf-timer--urgent")).toBeNull();
  });

  it("서버 채널(me.chat)이 없는 view 에서 탈락한 viewer(spectate 있음)의 낮 토론 하단은 읽기 전용 안내뿐이고 칩·보내기 줄이 없다", () => {
    const spectate: SpectateView = {
      seats: [0, 1, 2, 3].map((seat) => ({ seat, job: "citizen" as const })),
      picks: { mafia: [], police: [], doctor: [] },
    };
    const { container } = scene(makeView({ phase: "discussion", dead: [0], role: "citizen", spectate }));
    const panel = container.querySelector(".mf-dayscene__panel")!;
    expect(panel.querySelectorAll(".mf-seg__b").length).toBe(0);
    expect(container.querySelector(".st-row")).toBeNull();
    expect(panel.textContent).toContain("탈락했어요 · 볼 수만 있어요");
  });

  it("마피아(allies [2])와 시민 화면의 낮 토론 패널 HTML 이 같다 — 채팅 패널(all)도 같고 역할 단어·마피아 채널 문구가 없다 (T-02-25, T-07-40)", () => {
    const panelHtml = (v: RoomView) => {
      const r = scene(v);
      const html = r.container.querySelector(".mf-dayscene__panel")?.outerHTML ?? "";
      cleanup();
      return html;
    };
    const mafia = panelHtml(makeView({ phase: "discussion", role: "mafia", allies: [2], chat: "all" }));
    const citizen = panelHtml(makeView({ phase: "discussion", role: "citizen", chat: "all" }));
    expect(mafia.length).toBeGreaterThan(0);
    expect(mafia).toContain("data-chat-panel");
    expect(mafia).toBe(citizen);
    expect(/마피아|유령/.test(mafia)).toBe(false);
  });

  it("마피아 화면에서만 동료 자리(2)의 그림에 진홍 후광(mf-figure--halo-crimson)", () => {
    const mafia = scene(makeView({ phase: "discussion", role: "mafia", allies: [2] }));
    expect(mafia.container.querySelector('.mf-dt__seat[data-seat="2"] img.mf-figure--halo-crimson')).not.toBeNull();
    expect(mafia.container.querySelectorAll(".mf-figure--halo-crimson").length).toBe(1);
    cleanup();
    const citizen = scene(makeView({ phase: "discussion", role: "citizen" }));
    expect(citizen.container.querySelectorAll(".mf-figure--halo-crimson").length).toBe(0);
  });

  it("끊긴 자리도 접근성 이름에 연결 끊김이 있고 이름표는 한 줄이다", () => {
    const v = makeView({ phase: "discussion" });
    const off: RoomView = { ...v, players: v.players.map((p) => (p.seat === 1 ? { ...p, connected: false } : p)) };
    const { container } = scene(off);
    expect(container.querySelector('.mf-dt__seat[data-seat="1"]')?.getAttribute("aria-label")).toContain("연결 끊김");
    expect(container.querySelectorAll(".mf-dt__claim").length).toBe(0);
  });

  it("dayAnnounce → discussion: DayTable 루트가 같은 DOM 노드이고, 토론 하단에 버튼이 없다 (회귀)", () => {
    const r = scene(makeView({ phase: "dayAnnounce" }));
    const table = r.container.querySelector(".mf-dt");
    expect(table).not.toBeNull();
    r.rerender(makeView({ phase: "discussion", role: "citizen" }));
    expect(r.container.querySelector(".mf-dt") === table).toBe(true);
    const panel = r.container.querySelector(".mf-dayscene__panel")!;
    expect(panel.querySelector(".st-row")).toBeNull();
    expect(panel.querySelectorAll(".mf-seg__b").length).toBe(0);
    expect(panel.querySelector("button")).toBeNull(); // 토론 하단은 비어 있다(채팅 패널은 07-13·07-15)
  });
});

describe("DayScene 장면 상자 (SPEC 판 구성, 결정 0017-1)", () => {
  const css = readFileSync("src/styles/day.css", "utf8");
  const has = (re: RegExp): boolean => re.test(css);

  it("장면 상자 좌우 여백은 12px, max-width 389px 에서 4px, 같은 규칙에 flex 1·min-height 0 이 있다", () => {
    expect(has(/\.mf-dayscene__scene\s*\{[^}]*flex:\s*1[;\s][^}]*\}/)).toBe(true);
    expect(has(/\.mf-dayscene__scene\s*\{[^}]*min-height:\s*0/)).toBe(true);
    expect(has(/\.mf-dayscene__scene\s*\{[^}]*padding:\s*0 12px/)).toBe(true);
    expect(has(/@media \(max-width: 389px\)\s*\{[^@]*\.mf-dayscene__scene\s*\{[^}]*padding:\s*0 4px/)).toBe(true);
  });

  it("장면이 짧으면 테이블이 올라간다: 잰 폭 352·높이 320 에서 테이블 면 top 134px (높이 407 기본이면 150px)", () => {
    class FakeRO {
      constructor(private cb: (entries: { contentRect: { width: number; height: number } }[]) => void) {}
      observe(): void {
        this.cb([{ contentRect: { width: 352, height: 320 } }]);
      }
      unobserve(): void {}
      disconnect(): void {}
    }
    const felt = (c: HTMLElement) => c.querySelector<HTMLElement>(".mf-dt__felt")!;
    try {
      vi.stubGlobal("ResizeObserver", FakeRO);
      const short = scene(makeView({ phase: "discussion" }));
      expect(felt(short.container).style.top).toBe("134px");
      cleanup();
    } finally {
      vi.unstubAllGlobals();
    }
    const normal = scene(makeView({ phase: "discussion" }));
    expect(felt(normal.container).style.top).toBe("150px");
  });
});

describe("DayScene 하단 패널 (SPEC 하단, 결정 0017-6)", () => {
  const css = readFileSync("src/styles/day.css", "utf8");
  const panelRule = /\.mf-dayscene__panel\s*\{([^}]*)\}/.exec(css)?.[1] ?? "";
  const views: [string, RoomView][] = [
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

// ---- 03.1-07: 후광 · 말풍선 없음 ----

describe("DayScene 후광·말풍선 (결정 0030)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("discussion·night·morning 에는 후광·말풍선이 없고, 발밑 원·옛 배지·이름표 반전은 어느 단계에도 없다", () => {
    for (const phase of ["discussion", "night", "morning"] as const) {
      const r = scene(makeView({ phase, role: "citizen" }));
      expect(`${phase}:${r.container.querySelectorAll(".mf-figure--halo-white, .mf-dt__bubble").length}`).toBe(`${phase}:0`);
      cleanup();
    }
    for (const phase of ["discussion", "night", "morning"] as const) {
      const r = scene(makeView({ phase, role: "citizen" }));
      expect(`${phase}:${r.container.querySelectorAll(".mf-dt__spot, .mf-dt__ring, .mf-dt__sel, .mf-dt__turn, .mf-dt__tag--turn, .mf-dt__tag--spoke").length}`).toBe(`${phase}:0`);
      expect(`${phase}:${r.container.querySelectorAll('[aria-label="방장"]').length}`).toBe(`${phase}:0`);
      cleanup();
    }
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

  // 카드는 날짜별 공개 투표 기록(voteLog)만 그린다(07-04, CHAT-06: 주장 줄 없음)
  const voteLog: VoteLogEntry[] = [
    { n: 1, exec: { yes: 1, no: 3, passed: false }, cand: { votes: [{ seat: 1, target: 2 }], candidate: 2 } },
    { n: 2, exec: { yes: 3, no: 1, passed: true } },
  ];
  const inspect = (c: HTMLElement) => [...c.querySelectorAll<HTMLButtonElement>(".mf-dt button.mf-dt__seat--inspect")];
  const sheet = (name: string) => document.querySelector(`dialog[aria-label="${name}"]`);
  const rowsOf = (name: string) => [...(sheet(name)?.querySelectorAll(".mf-urecord__row") ?? [])].map((li) => li.textContent);

  it("discussion·morning: 모든 자리가 button 이고 이름이 `{닉네임}, 기록 보기` 로 끝난다(내 자리는 (나) 포함)", () => {
    for (const phase of ["discussion", "morning"] as const) {
      const { container } = scene(makeView({ phase, voteLog }));
      const names = inspect(container).map((b) => b.getAttribute("aria-label") ?? "");
      expect(`${phase}:${names.length}`).toBe(`${phase}:4`);
      expect(names.every((n) => n.endsWith(", 기록 보기"))).toBe(true);
      expect(names.some((n) => n.startsWith("지우 (나)"))).toBe(true);
      expect(names.some((n) => n.includes("주장"))).toBe(false);
      expect(container.querySelectorAll('.mf-dt [role="group"][data-seat]').length).toBe(0);
      cleanup();
    }
  });

  it("자리를 누르면 `{닉네임} 기록` 시트가 열리고 날짜별 투표 줄이 최신 위로 보인다 (VOTE-04)", () => {
    const { container } = scene(makeView({ phase: "discussion", n: 3, voteLog }));
    expect(sheet("하윤 기록")).toBeNull();
    fireEvent.click(within(container).getByRole("button", { name: "하윤, 기록 보기" }));
    expect(sheet("하윤 기록") !== null).toBe(true);
    expect(rowsOf("하윤 기록")).toEqual(["2일차처형 여부 찬성 3 · 반대 1", "1일차처형 여부 찬성 1 · 반대 3 · 미통과", "1일차민지님에게 투표했어요"]);
  });

  it("내 자리를 누르면 내 기록이 열린다 — 후보 선택 줄은 이 사람이 던졌을 때만 있다 (P-16)", () => {
    const { container } = scene(makeView({ phase: "discussion", n: 3, voteLog }));
    fireEvent.click(inspect(container).find((b) => b.dataset.seat === "0")!);
    expect(sheet("지우 기록") !== null).toBe(true);
    expect(rowsOf("지우 기록")).toEqual(["2일차처형 여부 찬성 3 · 반대 1", "1일차처형 여부 찬성 1 · 반대 3 · 미통과"]);
  });

  it("낮 → 낮 사이(discussion → morning)에는 열린 카드가 닫히지 않는다", () => {
    const r = scene(makeView({ phase: "discussion", voteLog }));
    fireEvent.click(within(r.container).getByRole("button", { name: "하윤, 기록 보기" }));
    r.rerender(makeView({ phase: "morning", voteLog }));
    expect(sheet("하윤 기록") !== null).toBe(true);
  });

  it("밤이 되면 열린 카드가 닫힌다(기존 규칙 불변)", () => {
    const r = scene(makeView({ phase: "discussion", voteLog }));
    fireEvent.click(within(r.container).getByRole("button", { name: "하윤, 기록 보기" }));
    r.rerender(makeView({ phase: "night", role: "citizen", voteLog }));
    expect(sheet("하윤 기록")).toBeNull();
  });

  it("기록이 없으면 빈 상태 문구가 보인다", () => {
    const { container } = scene(makeView({ phase: "discussion" }));
    fireEvent.click(within(container).getByRole("button", { name: "도현, 기록 보기" }));
    expect(sheet("도현 기록")?.textContent).toContain("아직 기록이 없어요");
  });

  it("아침(morning)에도 열린다", () => {
    const { container } = scene(makeView({ phase: "morning", voteLog }));
    fireEvent.click(within(container).getByRole("button", { name: "하윤, 기록 보기" }));
    expect(sheet("하윤 기록") !== null).toBe(true);
  });

  it("탈락한 viewer(spectate 있음)도 낮에 같은 카드를 연다 — 직업 정보 줄이 더해지지 않는다", () => {
    const spectate: SpectateView = {
      seats: [0, 1, 2, 3].map((seat) => ({ seat, job: seat === 1 ? ("mafia" as const) : ("citizen" as const) })),
      picks: { mafia: [], police: [], doctor: [] },
    };
    const { container } = scene(makeView({ phase: "discussion", n: 3, dead: [0], spectate, role: "citizen", voteLog }));
    const btn = inspect(container).find((b) => b.dataset.seat === "1")!;
    expect(btn.getAttribute("aria-label")?.endsWith(", 기록 보기")).toBe(true);
    fireEvent.click(btn);
    const dlg = sheet("하윤 기록")!;
    expect(dlg !== null).toBe(true);
    expect(dlg.querySelectorAll("li").length).toBe(3);
    expect(rowsOf("하윤 기록")).toEqual(["2일차처형 여부 찬성 3 · 반대 1", "1일차처형 여부 찬성 1 · 반대 3 · 미통과", "1일차민지님에게 투표했어요"]);
  });

  it("연결이 끊겨도(canSend false) 기록 카드는 열리고 서버 요청은 없다", () => {
    const r = scene(makeView({ phase: "discussion", voteLog }), { canSend: false, status: "reconnecting", banner: "reconnecting" });
    fireEvent.click(within(r.container).getByRole("button", { name: "하윤, 기록 보기" }));
    expect(sheet("하윤 기록") !== null).toBe(true);
    expect(vi.mocked(r.conn.send).mock.calls.length).toBe(0);
  });

  it("닫기를 누르면 닫는다", () => {
    const { container } = scene(makeView({ phase: "discussion", voteLog }));
    fireEvent.click(within(container).getByRole("button", { name: "하윤, 기록 보기" }));
    fireEvent.click(within(sheet("하윤 기록") as HTMLElement).getByRole("button", { name: "닫기" }));
    act(() => {
      vi.advanceTimersByTime(400);
    });
    expect(sheet("하윤 기록")).toBeNull();
  });

  it("카드 입력은 voteLog 뿐이다 — view.spectate 직업은 카드에 나오지 않는다", () => {
    const spectate: SpectateView = {
      seats: [0, 1, 2, 3].map((seat) => ({ seat, job: seat === 2 ? ("doctor" as const) : ("citizen" as const) })),
      picks: { mafia: [], police: [], doctor: [] },
    };
    const { container } = scene(makeView({ phase: "discussion", dead: [0], spectate, role: "citizen" }));
    fireEvent.click(within(container).getByRole("button", { name: "민지, 의사, 기록 보기" }));
    expect(rowsOf("민지 기록")).toEqual([]);
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

  it("morning 이 아닌 단계(discussion·night)에는 층이 0개", () => {
    for (const phase of ["discussion", "night"] as const) {
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

describe("DayScene 밤 끝 알림 없음 (결정 0028, UI-SPEC D·R6)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  const withRecords = (view: RoomView, records: RoomView["me"]["records"]): RoomView => ({ ...view, me: { ...view.me, records } });
  // 알림 전용 선택 props 를 하나도 넘기지 않는다(밤 → 아침으로 기록이 늘어도 알림이 없어야 한다)
  function renderGrow(role: RoleId, record: NonNullable<RoomView["me"]["records"]>[number]) {
    const night = withRecords(makeView({ phase: "night", role }), []);
    const morning = withRecords(makeView({ phase: "morning", role, morning: {} }), [record]);
    const growChat = new ChatStore();
    const ui = (v: RoomView) => <DayScene view={v} connection={{ ...conn(v), view: v }} chat={growChat} myRoleButton={<button type="button">역할 카드</button>} />;
    const utils = render(ui(night));
    utils.rerender(ui(morning));
    return utils;
  }
  const statusTexts = (): string[] => Array.from(document.querySelectorAll('[role="status"]')).map((el) => el.textContent ?? "");

  it.each([
    ["police", { n: 1, target: 2, isMafia: true }],
    ["mafia", { n: 1, target: 2, died: false }],
    ["doctor", { n: 1, target: 2 }],
  ] as const)("%s: 밤 -> 아침으로 기록이 늘어도 일지 알림(role=status)과 알림 버튼이 없다", (role, rec) => {
    renderGrow(role, rec);
    expect(statusTexts().filter((t) => t.includes("일지")).length).toBe(0);
    const buttons = Array.from(document.querySelectorAll("button")).map((b) => b.textContent ?? "");
    expect(buttons.filter((t) => t.includes("일지") || t.includes("눌러서 보기")).length).toBe(0);
    expect(document.querySelector(".mf-rolecard-toast")).toBeNull();
    expect(document.body.textContent?.includes("눌러서 보기") ? "있음" : "없음").toBe("없음");
  });

  it("알림 컴포넌트 파일과 알림 CSS 파일이 저장소에 없다", () => {
    expect(existsSync("src/components/RoleCardToast.tsx")).toBe(false);
    expect(existsSync("src/styles/rolecard-toast.css")).toBe(false);
  });
});

describe("DayScene 배경 장면 (단계 → 장면 규칙표 PHASE_SCENE, 결정 0030)", () => {
  const sceneOfMount = (view: RoomView) => {
    const { container } = scene(view);
    const arts = [...container.querySelectorAll<HTMLElement>(".mf-backdrop__art")];
    return { arts, root: container.querySelector(".mf-backdrop")! };
  };

  it("dayAnnounce·discussion 은 낮, 밤은 밤, 아침은 아침 장면이다 (처음 마운트는 층 하나가 바로 current)", () => {
    for (const [phase, expected] of [
      ["dayAnnounce", "day"],
      ["discussion", "day"],
      ["night", "night"],
      ["morning", "morning"],
    ] as const) {
      const { arts, root } = sceneOfMount(makeView({ phase, role: "citizen", ...(phase === "morning" ? { morning: { phrase: 1 } } : {}) }));
      expect(arts.map((a) => `${a.dataset.scene}:${a.dataset.state}`), phase).toEqual([`${expected}:current`]);
      expect(root.classList.contains(`mf-backdrop--${expected}`), phase).toBe(true);
    }
  });

  it("실내 배경은 어느 단계에도 헤더 막이 없다", () => {
    const style = (phase: PhaseId) => sceneOfMount(makeView({ phase, role: "citizen", ...(phase === "morning" ? { morning: { phrase: 1 } } : {}) })).arts[0]!.style.getPropertyValue("--mf-scrim");
    expect(style("discussion")).toBe("");
    expect(style("morning")).toBe("");
    expect(style("night")).toBe("");
  });
});

// ---- 07-19: 키보드가 열려도 장면은 다시 배치하지 않고 패널만 키보드 위로 올린다 (CHAT-05, UI-SPEC 테이블 화면 붙이기) ----

describe("DayScene 키보드 열림·닫힘 (CHAT-05)", () => {
  const INNER_H = 844;
  const realInnerH = window.innerHeight;
  interface FakeVV extends EventTarget {
    height: number;
    offsetTop: number;
  }
  const installVV = (height: number, offsetTop = 0): FakeVV => {
    const vv = Object.assign(new EventTarget(), { height, offsetTop }) as FakeVV;
    Object.defineProperty(window, "visualViewport", { value: vv, configurable: true, writable: true });
    return vv;
  };
  const advance = (ms: number) => act(() => void vi.advanceTimersByTime(ms));

  beforeEach(() => {
    // 시각은 고정하지 않는다: setSystemTime 으로 시계를 옮기면 가짜 requestAnimationFrame(훅이 프레임마다 한 번 읽는 길)이 20ms 안에 돌지 않는다
    vi.useFakeTimers();
    Object.defineProperty(window, "innerHeight", { value: INNER_H, configurable: true, writable: true });
  });
  afterEach(() => {
    vi.useRealTimers();
    Object.defineProperty(window, "innerHeight", { value: realInnerH, configurable: true, writable: true });
    Reflect.deleteProperty(window, "visualViewport");
  });

  const panelOf = (c: HTMLElement) => c.querySelector("section.mf-dayscene__panel") as HTMLElement;
  const logOf = (c: HTMLElement) => c.querySelector("[data-chat-log]") as HTMLElement;
  const rootOf = (c: HTMLElement) => c.querySelector("main.mf-dayscene") as HTMLElement;

  it("낮 토론: 포커스 + lift 336 이면 패널에 --kb·기록 칸 72·루트 --mf-kb-lift 336px, 테이블 노드와 패널 높이 변수는 그대로", () => {
    const vv = installVV(INNER_H);
    const { container } = scene(makeView({ phase: "discussion", role: "citizen", chat: "all" }));
    const table = container.querySelector(".mf-dt");
    const panelH = panelOf(container).style.getPropertyValue("--mf-chat-panel-h");
    expect(panelH).toBe("244px");
    expect(logOf(container).style.height).toBe("152px");
    expect(panelOf(container).classList.contains("mf-dayscene__panel--kb")).toBe(false);

    act(() => container.querySelector<HTMLInputElement>("[data-chat-input]")!.focus());
    vv.height = INNER_H - 336;
    act(() => void vv.dispatchEvent(new Event("resize")));
    advance(20);
    expect(panelOf(container).classList.contains("mf-dayscene__panel--kb")).toBe(true);
    expect(rootOf(container).style.getPropertyValue("--mf-kb-lift")).toBe("336px");
    expect(logOf(container).style.height).toBe("72px");
    expect(container.querySelector(".mv-chat.is-compact")).not.toBeNull();
    // 장면을 다시 배치하지 않는다: 테이블은 같은 노드, 패널이 차지하는 자리(높이 변수)는 그대로
    expect(container.querySelector(".mf-dt")).toBe(table);
    expect(panelOf(container).style.getPropertyValue("--mf-chat-panel-h")).toBe(panelH);
  });

  it("블러하면 원래대로 돌아온다", () => {
    const vv = installVV(INNER_H);
    const { container } = scene(makeView({ phase: "discussion", role: "citizen", chat: "all" }));
    const input = container.querySelector<HTMLInputElement>("[data-chat-input]")!;
    act(() => input.focus());
    vv.height = INNER_H - 336;
    act(() => void vv.dispatchEvent(new Event("resize")));
    advance(20);
    act(() => input.blur());
    expect(panelOf(container).classList.contains("mf-dayscene__panel--kb")).toBe(false);
    expect(rootOf(container).style.getPropertyValue("--mf-kb-lift")).toBe("0px");
    expect(logOf(container).style.height).toBe("152px");
  });

  it("lift 60(열림 경계 아래)은 열림이 아니다", () => {
    const vv = installVV(INNER_H);
    const { container } = scene(makeView({ phase: "discussion", role: "citizen", chat: "all" }));
    act(() => container.querySelector<HTMLInputElement>("[data-chat-input]")!.focus());
    vv.height = INNER_H - 60;
    act(() => void vv.dispatchEvent(new Event("resize")));
    advance(20);
    expect(panelOf(container).classList.contains("mf-dayscene__panel--kb")).toBe(false);
    expect(logOf(container).style.height).toBe("152px");
  });

  it("스타일 계약: --kb 패널은 bottom 이 --mf-kb-lift, 높이 150·아래 여백 8, 차지하던 자리는 위 여백으로 채운다", () => {
    const css = readFileSync("src/styles/day.css", "utf8");
    const rule = css.match(/\.mf-dayscene__panel[^{]*\.mf-dayscene__panel--kb\s*\{[^}]*\}/)?.[0] ?? "";
    expect(rule).toContain("bottom: var(--mf-kb-lift, 0px)");
    expect(rule).toContain("height: 150px");
    expect(rule).toContain("padding-bottom: 8px");
    expect(rule).toContain("margin-top: calc(var(--mf-chat-panel-h) + env(safe-area-inset-bottom) - 150px)");
    expect(14 + 72 + 8 + 48 + 8).toBe(150);
  });

  it("스타일 계약: 위쪽 바는 vv.offsetTop 만큼 내려와 보이는 영역 맨 위에 머문다", () => {
    const css = readFileSync("src/styles/day.css", "utf8");
    expect(css).toMatch(/\.mf-dayscene > \.mf-dayscene__enter:first-child[^}]*translateY\(var\(--mf-vv-top, 0px\)\)/);
  });
});
