/// <reference types="node" />
import { readFileSync } from "node:fs";
import { act, cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CLAIM_REVEAL_MS } from "../../shared/game/phases";
import type { RoleId } from "../../shared/game/roles";
import type { Claim, PhaseId, RoomView, SeatClaim } from "../../shared/protocol";
import type { RoomConnection } from "../../src/net/useRoomConnection";
import { DayScene } from "../../src/screens/DayScene";

// 낮 장면 단위 테스트: 직업 공개(S-06b)·공개 연출(S-06c). 세 단계는 DayTable 하나를 쓴다(결정 0017-1·0017-6).
// 서버와는 view 픽스처로만 만난다.

const NOW = 1_700_000_000_000;

interface ViewOpts {
  phase: PhaseId;
  n?: number;
  claimDone?: number[];
  claims?: SeatClaim[];
  myClaim?: Claim;
  role?: RoleId;
  allies?: number[];
}

function makeView(o: ViewOpts): RoomView {
  const me: RoomView["me"] = { seat: 0, isHost: false };
  if (o.role !== undefined) me.role = o.role;
  if (o.allies !== undefined) me.allies = o.allies;
  if (o.myClaim !== undefined) me.claim = o.myClaim;
  return {
    code: "0042",
    phase: o.phase,
    phaseEndsAt: NOW + 15_000,
    phaseDurationMs: 15_000,
    serverNow: NOW,
    minPlayers: 4,
    maxPlayers: 8,
    players: [
      { seat: 0, nickname: "지우", connected: true, isHost: true },
      { seat: 1, nickname: "하윤", connected: true, isHost: false },
      { seat: 2, nickname: "민지", connected: true, isHost: false },
      { seat: 3, nickname: "도현", connected: true, isHost: false },
    ],
    me,
    day: {
      n: o.n ?? 1,
      roles: ["mafia", "police", "citizen"],
      ...(o.claimDone ? { claimDone: o.claimDone } : {}),
      ...(o.claims ? { claims: o.claims } : {}),
    },
  };
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

/** 자리 번호 순서로 이름표 아랫줄 요소(없으면 null) */
function rowOf(c: HTMLElement, seat: number): HTMLElement | null {
  return c.querySelector<HTMLElement>(`.mf-dt__tag[data-seat="${seat}"] .mf-dt__claim`);
}
// 배열 toEqual 은 실패 때 여러 줄 보고서를 만든다(TAP 이 깨진다). 한 줄 문자열로 비교한다.
const rowTexts = (c: HTMLElement) => [0, 1, 2, 3].map((s) => rowOf(c, s)?.textContent ?? "(없음)").join("|");
const flags = (c: HTMLElement, cls: string, inner?: string) =>
  [0, 1, 2, 3].map((s) => (inner ? rowOf(c, s)?.querySelector(inner) != null : (rowOf(c, s)?.classList.contains(cls) ?? false)) ? "1" : "0").join("");
const popped = (c: HTMLElement) => flags(c, "mf-dt__claim--pop");

afterEach(cleanup);

describe("DayScene 직업 공개 (S-06b, D-01·D-03, 결정 0017-6)", () => {
  it("claim 단계: 하단 패널에 ClaimPanel(칩 줄)이 있다", () => {
    const { container } = scene(makeView({ phase: "claim" }));
    const panel = container.querySelector(".mf-dayscene__panel");
    expect(panel?.textContent).toContain("주장할 직업을 고르세요");
    expect(panel?.querySelectorAll(".mf-chip").length).toBe(4);
  });

  it("claimDone [1,3] → 자리 1·3 아랫줄만 ✓ 완료(--done), 0·2 는 …(--wait). 옛 알약·말풍선 요소가 없다", () => {
    const { container } = scene(makeView({ phase: "claim", claimDone: [1, 3] }));
    expect(flags(container, "mf-dt__claim--done")).toBe("0101");
    expect(flags(container, "mf-dt__claim--wait")).toBe("1010");
    expect(rowOf(container, 1)?.textContent).toBe("완료");
    expect(rowOf(container, 0)?.textContent).toBe("…");
    expect(container.querySelectorAll(".mf-done, .mf-bubble, .mf-float").length).toBe(0);
  });

  it("2일차 me.claim 이 있어도 claimDone 에 내 자리가 없으면 내 아랫줄은 … 이다 (D-09, T-02-44)", () => {
    const { container } = scene(makeView({ phase: "claim", n: 2, myClaim: "police", claimDone: [] }));
    expect(rowOf(container, 0)?.classList.contains("mf-dt__claim--wait")).toBe(true);
    expect(rowOf(container, 0)?.textContent).toBe("…");
    expect(container.querySelectorAll(".mf-dt__claim--done").length).toBe(0);
  });

  it("마피아(allies [2])와 시민 화면의 패널 HTML 이 같다 (T-02-25)", () => {
    const panelHtml = (v: RoomView) => {
      const r = scene(v);
      const html = r.container.querySelector(".mf-dayscene__panel")?.outerHTML ?? "";
      cleanup();
      return html;
    };
    const mafia = panelHtml(makeView({ phase: "claim", role: "mafia", allies: [2] }));
    const citizen = panelHtml(makeView({ phase: "claim", role: "citizen" }));
    expect(mafia).toContain("mf-chip");
    expect(mafia).toBe(citizen);
  });

  it("마피아 화면에서만 동료 자리(2)에 .mf-dt__ring--mate", () => {
    const mafia = scene(makeView({ phase: "claim", role: "mafia", allies: [2] }));
    expect(mafia.container.querySelector('.mf-dt__seat[data-seat="2"] .mf-dt__ring--mate')).not.toBeNull();
    expect(mafia.container.querySelectorAll(".mf-dt__ring--mate").length).toBe(1);
    cleanup();
    const citizen = scene(makeView({ phase: "claim", role: "citizen" }));
    expect(citizen.container.querySelectorAll(".mf-dt__ring--mate").length).toBe(0);
  });

  it("끊긴 자리도 아랫줄이 그대로 있다 (UI-SPEC partial 행)", () => {
    const v = makeView({ phase: "claim", claimDone: [1] });
    const off: RoomView = { ...v, players: v.players.map((p) => (p.seat === 1 ? { ...p, connected: false } : p)) };
    const { container } = scene(off);
    expect(container.querySelector('.mf-dt__seat[data-seat="1"]')?.getAttribute("aria-label")).toContain("연결 끊김");
    expect(rowOf(container, 1)?.textContent).toBe("완료");
  });
});

describe("DayScene 공개 연출 (S-06c, D-04·D-06·D-08, 결정 0017-6)", () => {
  const CLAIMS: SeatClaim[] = [
    { seat: 0, claim: "police", changed: false },
    { seat: 1, claim: "none", changed: false },
    { seat: 2, claim: "mafia", changed: true },
    { seat: 3, claim: "citizen", changed: false },
  ];
  const reveal = (claims: SeatClaim[] = CLAIMS, over: Partial<ViewOpts> = {}) =>
    makeView({ phase: "claimReveal", claims, role: "citizen", ...over });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("claim 을 보던 화면이 claimReveal 을 받으면 네 자리 아랫줄이 동시에 주장으로 바뀌고 모두 팝, ↺ 는 말 바꿈 자리(2)만, 머리 위 말풍선은 없다", () => {
    const r = scene(makeView({ phase: "claim", claimDone: [0, 1, 2, 3] }));
    expect(r.container.querySelectorAll(".mf-dt__claim--done").length).toBe(4);
    r.rerender(reveal());
    expect(rowTexts(r.container)).toBe("경찰|-|마피아|시민");
    expect(popped(r.container)).toBe("1111");
    expect(flags(r.container, "", ".mf-dt__chg")).toBe("0010");
    expect(r.container.querySelectorAll(".mf-dt__claim--done").length).toBe(0);
    expect(r.container.querySelectorAll(".mf-bubble, .mf-float, .mf-done").length).toBe(0);
  });

  it("2000ms(CLAIM_REVEAL_MS) 뒤 팝은 사라지고 주장 글자·↺ 는 남는다", () => {
    vi.useFakeTimers();
    const r = scene(makeView({ phase: "claim" }));
    r.rerender(reveal());
    expect(popped(r.container)).toBe("1111");
    act(() => {
      vi.advanceTimersByTime(CLAIM_REVEAL_MS - 1);
    });
    expect(popped(r.container)).toBe("1111");
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(popped(r.container)).toBe("0000");
    expect(rowTexts(r.container)).toBe("경찰|-|마피아|시민");
    expect(r.container.querySelectorAll(".mf-dt__chg").length).toBe(1);
  });

  it("claimReveal 로 처음 마운트(재접속)하면 팝 없이 주장만 보인다", () => {
    const r = scene(reveal());
    expect(popped(r.container)).toBe("0000");
    expect(rowTexts(r.container)).toBe("경찰|-|마피아|시민");
    expect(r.container.querySelectorAll(".mf-dt__claim--done").length).toBe(0);
  });

  it("claimReveal 패널: 제목·안내가 공개 문구로 바뀌고 칩은 내 공개 값이 선택된 채 모두 꺼지며 보내기 버튼이 없다", () => {
    const r = scene(makeView({ phase: "claim", myClaim: "citizen" }));
    r.rerender(reveal());
    const panel = r.container.querySelector<HTMLElement>(".mf-dayscene__panel")!;
    expect(within(panel).queryByText("주장이 공개됐어요")).not.toBeNull();
    expect(within(panel).queryByText("곧 토론이 시작돼요")).not.toBeNull();
    expect(within(panel).queryByText("주장할 직업을 고르세요")).toBeNull();
    const chips = [...panel.querySelectorAll<HTMLButtonElement>(".mf-chip")];
    expect(chips.map((c) => c.textContent).join("|")).toBe("마피아|경찰|시민|말 안 함");
    expect(chips.every((c) => c.disabled)).toBe(true);
    // 내 자리(seat 0)의 공개 값 police 가 선택돼 있다
    expect(chips.map((c) => c.getAttribute("aria-pressed")).join("|")).toBe("false|true|false|false");
    expect(within(panel).queryAllByRole("button").length).toBe(4);
  });

  it("claim → claimReveal → discussion: DayTable 루트가 같은 DOM 노드이고 주장이 유지된다 (다시 마운트 없음)", () => {
    const r = scene(makeView({ phase: "claim" }));
    const table = r.container.querySelector(".mf-dt");
    expect(table).not.toBeNull();
    r.rerender(reveal());
    expect(r.container.querySelector(".mf-dt") === table).toBe(true);
    r.rerender(makeView({ phase: "discussion", claims: CLAIMS, role: "citizen" }));
    expect(r.container.querySelector(".mf-dt") === table).toBe(true);
    expect(rowTexts(r.container)).toBe("경찰|-|마피아|시민");
    expect(popped(r.container)).toBe("0000");
    expect(r.container.querySelectorAll(".mf-bubble").length).toBe(0);
  });

  it("1일차 전원 none → 아랫줄 '-' 넷, 모두 흐림(--none)", () => {
    const all: SeatClaim[] = [0, 1, 2, 3].map((seat) => ({ seat, claim: "none" as const, changed: false }));
    const r = scene(makeView({ phase: "claim" }));
    r.rerender(reveal(all));
    expect(rowTexts(r.container)).toBe("-|-|-|-");
    expect(flags(r.container, "mf-dt__claim--none")).toBe("1111");
  });

  it("공개 연출 화면에도 내 역할에 따른 차이가 없다 (T-02-25)", () => {
    const panelHtml = (v: RoomView) => {
      const r = scene(v);
      const html = r.container.querySelector(".mf-dayscene__panel")?.outerHTML ?? "";
      cleanup();
      return html;
    };
    expect(panelHtml(reveal(CLAIMS, { role: "mafia", allies: [2] }))).toBe(panelHtml(reveal(CLAIMS, { role: "citizen" })));
    expect(screen.queryAllByRole("group", { name: /^테이블$/ }).length).toBe(0);
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
