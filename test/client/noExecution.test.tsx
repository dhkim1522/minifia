/// <reference types="node" />
import { readFileSync } from "node:fs";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "../helpers/singleLineErrors";
import type { NoExecutionReason, PhaseId, RoomView } from "../../shared/protocol";
import type { RoomConnection } from "../../src/net/useRoomConnection";
import { DAY_SCENE_H, DAY_SCENE_W, dayTableGeometry } from "../../src/game/dayTable";
import { SCENE_INTRO_MS } from "../../src/game/scenes";
import { NO_EXEC_CARD_MS, NO_EXEC_INTRO_DELAY_MS, VERDICT_TEXT, introCardGeometry, noExecutionPrefix, noExecutionText } from "../../src/game/verdict";

// RoomScreen 의 연결 훅만 가짜로 바꾼다(execution.test.tsx 와 같은 방식). 서버와는 view 픽스처로만 만난다.
const connectionMock = vi.hoisted(() => ({ current: null as unknown }));
vi.mock("../../src/net/useRoomConnection", () => ({
  useRoomConnection: () => connectionMock.current,
}));
const { RoomScreen } = await import("../../src/screens/RoomScreen");
const { NoExecutionCard } = await import("../../src/components/NoExecutionCard");

// 처형 무효 카드(04-24, D-34, P-3): 처형이 성립하지 않아 밤으로 올 때(같은 접속) 회색 카드가 1.6초 뜨고 밤 시작 문구는 1.6초 뒤부터 2초 뜬다.
// 카드는 터치를 막지 않고 서버 밤 시간은 늘지 않는다. 읽기 안내는 `처형 무효. {부제}. ` 로 시작한다.

const NOW = 1_700_000_000_000;
const NAMES = ["지우", "하윤", "민지", "도현"];

interface Opts {
  role?: "mafia" | "police" | "doctor" | "citizen";
  reason?: NoExecutionReason | null;
  n?: number;
  dead?: number[];
  epoch?: number;
}

function makeView(phase: PhaseId, o: Opts = {}): RoomView {
  const dead = o.dead ?? [];
  const reason = o.reason === undefined ? "tie" : o.reason;
  return {
    code: "0042",
    phase,
    phaseEndsAt: NOW + 30_000,
    phaseDurationMs: 30_000,
    serverNow: NOW,
    minPlayers: 4,
    maxPlayers: 8,
    players: NAMES.map((nickname, seat) => ({ seat, nickname, connected: true, isHost: seat === 0, ...(dead.includes(seat) ? { alive: false } : {}) })),
    me: { seat: 0, isHost: true, role: o.role ?? "citizen" },
    day: {
      n: o.n ?? 1,
      roles: ["mafia", "police", "citizen"],
      claimLog: [],
      ...(phase === "night" && reason !== null ? { noExecution: { reason } } : {}),
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

function renderRoom(view: RoomView, over: Partial<RoomConnection> = {}) {
  connectionMock.current = conn(view, over);
  const r = render(<RoomScreen code="0042" token={"t".repeat(43)} onExit={vi.fn()} />);
  const rerenderRoom = (v: RoomView, o: Partial<RoomConnection> = over) => {
    connectionMock.current = conn(v, o);
    r.rerender(<RoomScreen code="0042" token={"t".repeat(43)} onExit={vi.fn()} />);
  };
  return { ...r, rerenderRoom };
}

const voidCard = (c: HTMLElement) => c.querySelector<HTMLElement>(".mf-vintro--void");
const sceneIntro = (c: HTMLElement) => c.querySelector<HTMLElement>(".mf-sceneintro");
const announce = (c: HTMLElement) => c.querySelector<HTMLElement>(".mf-room > p.mf-sr-only[aria-live]")?.textContent;
const advance = (ms: number) => act(() => void vi.advanceTimersByTime(ms));

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("NoExecutionCard 카드 단위 (D-34)", () => {
  const layout = { sceneW: DAY_SCENE_W, sceneH: DAY_SCENE_H };
  const reasons: Array<[NoExecutionReason, string]> = [
    ["notMajority", "찬성이 과반이 아니에요"],
    ["tie", "동률이라 처형하지 않아요"],
    ["noVotes", "던진 표가 없어요"],
  ];
  for (const [reason, sub] of reasons) {
    it(`${reason}: 제목 \`처형 무효\`, 부제 \`${sub}\`(noExecutionText 와 같은 출처), aria-hidden, 회색 변형`, () => {
      const { container } = render(<NoExecutionCard layout={layout} reason={reason} onDone={vi.fn()} />);
      const el = container.querySelector<HTMLElement>(".mf-vintro")!;
      expect(el.classList.contains("mf-vintro--void")).toBe(true);
      expect(el.classList.contains("mf-vintro--intro")).toBe(false);
      expect(el.getAttribute("aria-hidden")).toBe("true");
      expect(el.querySelector(".mf-vintro__title")?.textContent).toBe(VERDICT_TEXT.noExecCardTitle);
      expect(el.querySelector(".mf-vintro__title")?.textContent).toBe("처형 무효");
      expect(el.querySelector(".mf-vintro__sub")?.textContent).toBe(sub);
      expect(el.querySelector(".mf-vintro__sub")?.textContent).toBe(noExecutionText(reason));
      // 셰브런·질문 강조·번짐은 없다
      expect(el.querySelectorAll(".mf-vintro__chev, .mf-vintro__chevs, .mf-vintro__q, .mf-vintro__q-big, .mf-vintro__glow, .mf-vintro__smear").length).toBe(0);
      expect(el.querySelector("h1, h2, h3, h4, h5, h6")).toBeNull();
    });
  }

  it("위치·크기는 인트로와 같다: 위쪽 = cy − 105, 폭 280·높이 176 은 CSS", () => {
    const { container } = render(<NoExecutionCard layout={layout} reason="tie" onDone={vi.fn()} />);
    const drop = container.querySelector<HTMLElement>(".mf-vintro__drop")!;
    expect(drop.style.top).toBe(`${dayTableGeometry(DAY_SCENE_W, DAY_SCENE_H).cy - 105}px`);
    expect(drop.style.top).toBe(`${introCardGeometry(DAY_SCENE_W, DAY_SCENE_H).top}px`);
  });

  it("onDone 은 NO_EXEC_CARD_MS(1600) 뒤 한 번만 불리고, 다시 그려도 연장되지 않으며, 언마운트하면 타이머가 남지 않는다", () => {
    expect(NO_EXEC_CARD_MS).toBe(1600);
    const onDone = vi.fn();
    const { rerender, unmount } = render(<NoExecutionCard layout={layout} reason="tie" onDone={onDone} />);
    advance(1000);
    rerender(<NoExecutionCard layout={layout} reason="tie" onDone={onDone} />);
    advance(599);
    expect(onDone).not.toHaveBeenCalled();
    advance(1);
    expect(onDone).toHaveBeenCalledTimes(1);
    advance(5000);
    expect(onDone).toHaveBeenCalledTimes(1);
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe("처형 무효 CSS (정적 단언)", () => {
  const css = readFileSync("src/styles/verdict.css", "utf8");
  const section = css.slice(css.indexOf("/* ==== mf-vintro 시작 ==== */"), css.indexOf("/* ==== mf-vintro 끝 ==== */"));
  const voidRules = [...section.matchAll(/[^{}]*mf-vintro--void[^{}]*\{[^}]*\}/g)].map((m) => m[0]).join("\n");

  it("무효 변형(--void)은 회색 토큰만 쓰고 앰버·진홍이 없다: 바탕 gray-700 → gray-800, 테두리 2px gray-300", () => {
    expect(voidRules).toContain("--gray-700");
    expect(voidRules).toContain("--gray-800");
    expect(voidRules).toMatch(/border(-color)?:[^;]*--gray-300/);
    expect(voidRules).not.toMatch(/amber|crimson/);
    expect(voidRules).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(css).toContain("mf-vintro--void");
  });

  it("시각표: 낙하 420ms(바운스 없음), 페이드아웃은 1300ms 에 300ms, 막 0 → .25 → 0", () => {
    expect(section).toMatch(/--mf-vintro--void|mf-vintro--void\s*\{[^}]*--mf-vi-out-delay:\s*1300ms/);
    expect(voidRules).toMatch(/--mf-vi-out-ms:\s*300ms/);
    expect(voidRules).toMatch(/mf-vi-fall-void\s+420ms/);
    const fallVoid = section.match(/@keyframes mf-vi-fall-void \{[\s\S]*?\n\}/)?.[0] ?? "";
    expect(fallVoid).toMatch(/translate:\s*0 -276px/);
    expect(fallVoid).not.toMatch(/4px/);
    expect(section.match(/@keyframes mf-vi-veil-void \{[\s\S]*?\n\}/)?.[0] ?? "").toMatch(/0\.25/);
  });
});

describe("처형 무효로 밤이 올 때 (RoomScreen, D-34·P-3)", () => {
  it.each([
    ["execVote", "notMajority", "찬성이 과반이 아니에요"],
    ["execVote", "tie", "동률이라 처형하지 않아요"],
    ["candidateVoteReveal", "tie", "동률이라 처형하지 않아요"],
    ["candidateVoteReveal", "noVotes", "던진 표가 없어요"],
  ] as const)("%s → night(%s): 같은 접속이면 회색 카드가 이유 `%s` 와 함께 뜬다", (from, reason, sub) => {
    const r = renderRoom(makeView(from, { reason }));
    expect(voidCard(r.container)).toBeNull();
    r.rerenderRoom(makeView("night", { reason }));
    const el = voidCard(r.container)!;
    expect(el).not.toBeNull();
    expect(el.querySelector(".mf-vintro__title")?.textContent).toBe("처형 무효");
    expect(el.querySelector(".mf-vintro__sub")?.textContent).toBe(sub);
    expect(r.container.querySelectorAll(".mf-vintro").length).toBe(1);
    expect(el.closest(".mf-dt")).not.toBeNull();
  });

  it("도착 조건 5가지: 처음 마운트·재접속·noExecution 없는 밤(처형이 이뤄진 밤)·밤 중 다시 그리기·다른 단계에서 온 밤에는 뜨지 않는다", () => {
    // 1) 처음 마운트
    expect(voidCard(renderRoom(makeView("night")).container)).toBeNull();
    cleanup();
    // 2) 재접속(단계와 epoch 가 함께 바뀜)
    const b = renderRoom(makeView("execVote"), { epoch: 1 });
    b.rerenderRoom(makeView("night"), { epoch: 2 });
    expect(voidCard(b.container)).toBeNull();
    cleanup();
    // 3) noExecution 없는 밤(처형이 이뤄진 밤 포함): execution → night, execVote → night(reason 없음)
    const c = renderRoom(makeView("execution"));
    c.rerenderRoom(makeView("night", { reason: null }));
    expect(voidCard(c.container)).toBeNull();
    cleanup();
    const d = renderRoom(makeView("execVote"));
    d.rerenderRoom(makeView("night", { reason: null }));
    expect(voidCard(d.container)).toBeNull();
    cleanup();
    // 4) 밤 중 다시 그리기: 카드가 끝난 뒤 새 view 로 다시 그려도 돌아오지 않는다
    const e = renderRoom(makeView("execVote"));
    e.rerenderRoom(makeView("night"));
    advance(NO_EXEC_CARD_MS);
    expect(voidCard(e.container)).toBeNull();
    e.rerenderRoom(makeView("night"));
    e.rerenderRoom(makeView("night", { role: "police" }));
    expect(voidCard(e.container)).toBeNull();
    cleanup();
    // 5) 다른 단계에서 온 밤(예: 낮 토론 → 밤)에는 noExecution 이 있어도 뜨지 않는다
    const f = renderRoom(makeView("discussion"));
    f.rerenderRoom(makeView("night"));
    expect(voidCard(f.container)).toBeNull();
  });

  it("1599ms 에는 카드가 있고 1600ms 에 사라진다, 밤 중간에 다시 그려도 연장되지 않는다", () => {
    const r = renderRoom(makeView("execVote"));
    r.rerenderRoom(makeView("night"));
    advance(1000);
    r.rerenderRoom(makeView("night", { role: "citizen" }));
    advance(599);
    expect(voidCard(r.container)).not.toBeNull();
    advance(1);
    expect(voidCard(r.container)).toBeNull();
    expect(r.container.querySelectorAll(".mf-vintro, .mf-vintro__veil").length).toBe(0);
  });

  it("밤 시작 문구는 1000ms 에는 없고 1700ms 에 있다(NO_EXEC_INTRO_DELAY_MS 뒤부터 2초), 그 뒤 사라진다", () => {
    expect(NO_EXEC_INTRO_DELAY_MS).toBe(1600);
    const r = renderRoom(makeView("execVote"));
    r.rerenderRoom(makeView("night"));
    advance(1000);
    expect(sceneIntro(r.container)).toBeNull();
    advance(599);
    expect(sceneIntro(r.container)).toBeNull();
    advance(101); // 1700ms
    const el = sceneIntro(r.container)!;
    expect(el).not.toBeNull();
    expect(Array.from(el.querySelectorAll("p")).map((p) => p.textContent)).toEqual(["1일차", "밤이 되었습니다"]);
    // 카드는 이미 사라졌고 두 문구가 겹치지 않는다
    expect(voidCard(r.container)).toBeNull();
    advance(SCENE_INTRO_MS - 101 - 1); // 3599ms: 마지막 순간 전
    expect(sceneIntro(r.container)).not.toBeNull();
    advance(2); // 3600ms 이후
    expect(sceneIntro(r.container)).toBeNull();
  });

  it("noExecution 이 없는 밤의 시작 문구는 지금처럼 바로 뜬다(지연 없음)", () => {
    const r = renderRoom(makeView("execution"));
    r.rerenderRoom(makeView("night", { reason: null }));
    expect(sceneIntro(r.container)).not.toBeNull();
    advance(SCENE_INTRO_MS);
    expect(sceneIntro(r.container)).toBeNull();
  });

  it("카드가 떠 있는 동안 밤 행동이 된다: 경찰의 대상 좌석 버튼 클릭이 send 로 이어진다", () => {
    const send = vi.fn(() => true);
    const r = renderRoom(makeView("execVote", { role: "police" }), { send });
    r.rerenderRoom(makeView("night", { role: "police" }), { send });
    expect(voidCard(r.container)).not.toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "하윤, 조사 대상" }));
    expect(send).toHaveBeenCalledWith({ t: "pick", target: 1 });
  });

  it("밤 장면은 그대로다: 제목 `밤`, 1일차, 서버 단계 시간(타이머)은 그대로, 하단은 기존 시민 밤 하단", () => {
    const r = renderRoom(makeView("execVote"));
    r.rerenderRoom(makeView("night"));
    expect(screen.queryByRole("heading", { name: "밤" })).not.toBeNull();
    expect(r.container.querySelector(".mf-phasebar__do")?.textContent).toBe("1일차");
    expect(r.container.querySelector(".mf-dayscene__panel h2")?.textContent).not.toBe("");
    expect(r.container.querySelector(".mf-dayscene")?.classList.contains("mf-dayscene--verdict")).toBe(false);
  });

  it("읽기 안내: noExecution 이 있으면 `처형 무효. {부제}. {일차}일차 밤. …`, 없으면 기존 문구", () => {
    const a = renderRoom(makeView("execVote"));
    a.rerenderRoom(makeView("night", { reason: "tie" }));
    expect(announce(a.container)).toBe(`${noExecutionPrefix("tie")}1일차 밤. 밤이 되었어요`);
    expect(announce(a.container)).toBe("처형 무효. 동률이라 처형하지 않아요. 1일차 밤. 밤이 되었어요");
    cleanup();
    const b = renderRoom(makeView("execVote", { role: "mafia" }));
    b.rerenderRoom(makeView("night", { role: "mafia", reason: "notMajority" }));
    expect(announce(b.container)).toBe("처형 무효. 찬성이 과반이 아니에요. 1일차 밤. 함께 지목하세요");
    cleanup();
    const c = renderRoom(makeView("execution"));
    c.rerenderRoom(makeView("night", { reason: null }));
    expect(announce(c.container)).toBe("1일차 밤. 밤이 되었어요");
  });

  it("카드 소스는 직업 표를 읽지 않는다", () => {
    for (const f of ["src/components/NoExecutionCard.tsx", "src/components/ExecIntroCard.tsx"]) {
      expect(readFileSync(f, "utf8")).not.toMatch(/roleText|ROLE_TEXT|ROLE_IDS|roleArtSrc|me\.role/);
    }
  });
});
