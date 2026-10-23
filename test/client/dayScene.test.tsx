import { act, cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CLAIM_REVEAL_MS } from "../../shared/game/phases";
import type { RoleId } from "../../shared/game/roles";
import type { Claim, PhaseId, RoomView, SeatClaim } from "../../shared/protocol";
import type { RoomConnection } from "../../src/net/useRoomConnection";
import { DayScene } from "../../src/screens/DayScene";

// 낮 장면 단위 테스트: 직업 공개(S-06b)·공개 연출(S-06c). 서버와는 view 픽스처로만 만난다.

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

/** 완료 알약이 뜬 자리 수와 위치 대신, 자리 접근성 이름("선택 완료")으로 어느 자리인지 읽는다 */
function doneSeats(container: HTMLElement): string[] {
  return [...container.querySelectorAll<HTMLElement>(".mf-seat[role=group]")]
    .filter((s) => (s.getAttribute("aria-label") ?? "").includes("선택 완료"))
    .map((s) => (s.getAttribute("aria-label") ?? "").split(/[ ,]/)[0]!);
}

afterEach(cleanup);

describe("DayScene 직업 공개 (S-06b, D-01·D-03)", () => {
  it("claim 단계: 하단 패널에 ClaimPanel(칩 줄)이 있다", () => {
    const { container } = scene(makeView({ phase: "claim" }));
    const panel = container.querySelector(".mf-dayscene__panel");
    expect(panel?.textContent).toContain("주장할 직업을 고르세요");
    expect(panel?.querySelectorAll(".mf-chip").length).toBe(4);
  });

  it("claimDone [1,3] → 자리 1·3 에만 '완료' 알약, 0·2 에는 없다", () => {
    const { container } = scene(makeView({ phase: "claim", claimDone: [1, 3] }));
    const pills = container.querySelectorAll(".mf-done");
    expect(pills.length).toBe(2);
    expect(doneSeats(container).sort()).toEqual(["도현", "하윤"]);
    expect(pills[0]?.textContent).toBe("완료");
  });

  it("2일차 me.claim 이 있어도 claimDone 에 내 자리가 없으면 내 자리에 완료 알약이 없다", () => {
    const { container } = scene(makeView({ phase: "claim", n: 2, myClaim: "police", claimDone: [] }));
    expect(container.querySelectorAll(".mf-done").length).toBe(0);
    expect(doneSeats(container)).toEqual([]);
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
});

describe("DayScene 공개 연출 (S-06c, D-04·D-06·D-08)", () => {
  const CLAIMS: SeatClaim[] = [
    { seat: 0, claim: "police", changed: false },
    { seat: 1, claim: "none", changed: false },
    { seat: 2, claim: "mafia", changed: true },
    { seat: 3, claim: "citizen", changed: false },
  ];
  const reveal = (claims: SeatClaim[] = CLAIMS, over: Partial<ViewOpts> = {}) =>
    makeView({ phase: "claimReveal", claims, role: "citizen", ...over });

  const bubbles = (c: HTMLElement) => [...c.querySelectorAll<HTMLElement>(".mf-float .mf-bubble--reveal")];
  const tags = (c: HTMLElement) => [...c.querySelectorAll<HTMLElement>(".mf-tag__claim")];

  afterEach(() => {
    vi.useRealTimers();
  });

  it("claim 을 보던 화면이 claimReveal 을 받으면 모든 자리에 동시에 팝+흔들림 말풍선, 말 안 함은 흐림", () => {
    const r = scene(makeView({ phase: "claim", claimDone: [0, 1, 2, 3] }));
    expect(r.container.querySelectorAll(".mf-done").length).toBe(4);
    r.rerender(reveal());
    const b = bubbles(r.container);
    expect(b.map((x) => x.textContent)).toEqual(["경찰", "말 안 함", "마피아", "시민"]);
    expect(b.every((x) => x.classList.contains("mf-bubble--pop") && x.classList.contains("mf-bubble--shake"))).toBe(true);
    expect(b.map((x) => x.classList.contains("mf-bubble--dim"))).toEqual([false, true, false, false]);
    // 완료 알약은 사라진다
    expect(r.container.querySelectorAll(".mf-done").length).toBe(0);
  });

  it("같은 순간 이름표 아래 주장 알약 넷, 말 바꿈 자리에만 '· 말 바꿈'", () => {
    const r = scene(makeView({ phase: "claim" }));
    r.rerender(reveal());
    const t = tags(r.container);
    expect(t.length).toBe(4);
    expect(t.map((x) => x.querySelector("b")?.textContent)).toEqual(["경찰", "말 안 함", "마피아", "시민"]);
    expect(t.map((x) => x.textContent?.includes("· 말 바꿈"))).toEqual([false, false, true, false]);
  });

  it("2000ms(CLAIM_REVEAL_MS) 뒤 말풍선은 사라지고 주장 알약은 남는다", () => {
    vi.useFakeTimers();
    const r = scene(makeView({ phase: "claim" }));
    r.rerender(reveal());
    expect(bubbles(r.container).length).toBe(4);
    act(() => {
      vi.advanceTimersByTime(CLAIM_REVEAL_MS - 1);
    });
    expect(bubbles(r.container).length).toBe(4);
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(bubbles(r.container).length).toBe(0);
    expect(tags(r.container).length).toBe(4);
  });

  it("claimReveal 로 처음 마운트(재접속)하면 말풍선 없이 주장 알약만 보인다", () => {
    const r = scene(reveal());
    expect(bubbles(r.container).length).toBe(0);
    expect(tags(r.container).length).toBe(4);
    expect(r.container.querySelectorAll(".mf-done").length).toBe(0);
  });

  it("claimReveal 패널: 제목·안내가 공개 문구로 바뀌고 칩은 내 공개 값이 선택된 채 모두 꺼지며 보내기 버튼이 없다", () => {
    const r = scene(makeView({ phase: "claim", myClaim: "citizen" }));
    r.rerender(reveal());
    const panel = r.container.querySelector<HTMLElement>(".mf-dayscene__panel")!;
    expect(within(panel).queryByText("주장이 공개됐어요")).not.toBeNull();
    expect(within(panel).queryByText("곧 토론이 시작돼요")).not.toBeNull();
    expect(within(panel).queryByText("주장할 직업을 고르세요")).toBeNull();
    const chips = [...panel.querySelectorAll<HTMLButtonElement>(".mf-chip")];
    expect(chips.map((c) => c.textContent)).toEqual(["마피아", "경찰", "시민", "말 안 함"]);
    expect(chips.every((c) => c.disabled)).toBe(true);
    // 내 자리(seat 0)의 공개 값 police 가 선택돼 있다
    expect(chips.map((c) => c.getAttribute("aria-pressed"))).toEqual(["false", "true", "false", "false"]);
    expect(within(panel).queryAllByRole("button").length).toBe(4);
  });

  it("claimReveal → discussion: 테이블은 같은 노드이고 주장 알약이 유지된다", () => {
    const r = scene(makeView({ phase: "claim" }));
    r.rerender(reveal());
    const table = r.container.querySelector(".mf-table");
    r.rerender(makeView({ phase: "discussion", claims: CLAIMS, role: "citizen" }));
    expect(r.container.querySelector(".mf-table") === table).toBe(true);
    expect(tags(r.container).length).toBe(4);
    expect(bubbles(r.container).length).toBe(0);
  });

  it("1일차 전원 none → 말 안 함 말풍선 넷, 모두 흐림", () => {
    const all: SeatClaim[] = [0, 1, 2, 3].map((seat) => ({ seat, claim: "none" as const, changed: false }));
    const r = scene(makeView({ phase: "claim" }));
    r.rerender(reveal(all));
    const b = bubbles(r.container);
    expect(b.map((x) => x.textContent)).toEqual(["말 안 함", "말 안 함", "말 안 함", "말 안 함"]);
    expect(b.every((x) => x.classList.contains("mf-bubble--dim"))).toBe(true);
  });

  it("공개 연출 화면에도 내 역할에 따른 차이가 없다 (T-02-25)", () => {
    const panelHtml = (v: RoomView) => {
      const r = scene(v);
      const html = r.container.querySelector(".mf-dayscene__panel")?.outerHTML ?? "";
      cleanup();
      return html;
    };
    expect(panelHtml(reveal(CLAIMS, { role: "mafia", allies: [2] }))).toBe(panelHtml(reveal(CLAIMS, { role: "citizen" })));
    expect(screen.queryAllByRole("group").length).toBe(0);
  });
});
