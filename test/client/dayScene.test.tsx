import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
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
