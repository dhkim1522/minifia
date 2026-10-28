/// <reference types="node" />
import { readFileSync } from "node:fs";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "../helpers/singleLineErrors";
import type { PhaseId, RoomView } from "../../shared/protocol";
import type { RoomConnection } from "../../src/net/useRoomConnection";
import { DAY_SCENE_H, DAY_SCENE_W, dayTableGeometry } from "../../src/game/dayTable";
import { EXEC_INTRO_MS, VERDICT_TEXT, execTallyText, introCardGeometry } from "../../src/game/verdict";

// RoomScreen 의 연결 훅만 가짜로 바꾼다(execution.test.tsx 와 같은 방식). 서버와는 view 픽스처로만 만난다.
const connectionMock = vi.hoisted(() => ({ current: null as unknown }));
vi.mock("../../src/net/useRoomConnection", () => ({
  useRoomConnection: () => connectionMock.current,
}));
const { RoomScreen } = await import("../../src/screens/RoomScreen");

// 처형 투표 인트로 카드(04-24, D-23·D-24·D-30·D-33): 같은 접속에서 discussion → execVote 로 바뀐 렌더에서만 1.6초 뜬다.
// 탭을 막지 않고(pointer-events none), 끝나면 DOM 에 흔적이 없고, 모션 줄이기 분기에는 낙하·바운스·셰브런 이동이 없다.

const NOW = 1_700_000_000_000;
const NAMES = ["지우", "하윤", "민지", "도현"];

function makeView(phase: PhaseId = "execVote", o: { endsIn?: number; n?: number; yes?: number } = {}): RoomView {
  return {
    code: "0042",
    phase,
    phaseEndsAt: NOW + (o.endsIn ?? 10_000),
    phaseDurationMs: 10_000,
    serverNow: NOW,
    minPlayers: 4,
    maxPlayers: 8,
    players: NAMES.map((nickname, seat) => ({ seat, nickname, connected: true, isHost: seat === 0 })),
    me: { seat: 0, isHost: true, role: "citizen" },
    day: {
      n: o.n ?? 1,
      roles: ["mafia", "police", "citizen"],
      claimLog: [],
      ...(phase === "execVote" ? { execTally: { yes: o.yes ?? 0, no: 0 } } : {}),
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

const intro = (c: HTMLElement) => c.querySelector<HTMLElement>(".mf-vintro");
const hint = (c: HTMLElement) => c.querySelector(".mf-execvote__tally > span")?.textContent;
const advance = (ms: number) => act(() => void vi.advanceTimersByTime(ms));

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("처형 투표 인트로 카드 (D-23·D-30)", () => {
  it("discussion → execVote(같은 접속)에서 카드가 뜬다: aria-hidden, 제목 `처형 투표`, 질문 `오늘 처형을 할까요?`, 장면 상자(DayTable) 안", () => {
    const r = renderRoom(makeView("discussion"));
    expect(intro(r.container)).toBeNull();
    r.rerenderRoom(makeView("execVote"));
    const el = intro(r.container)!;
    expect(el).not.toBeNull();
    expect(el.classList.contains("mf-vintro--intro")).toBe(true);
    expect(el.classList.contains("mf-vintro--void")).toBe(false);
    expect(el.getAttribute("aria-hidden")).toBe("true");
    expect(el.querySelector(".mf-vintro__title")?.textContent).toBe(VERDICT_TEXT.execIntroCardTitle);
    expect(el.querySelector(".mf-vintro__title")?.textContent).toBe("처형 투표");
    const qs = Array.from(el.querySelectorAll(".mf-vintro__q > p")).map((p) => p.textContent);
    expect(qs).toEqual(["오늘 처형을 할까요?", "오늘 처형을 할까요?"]);
    expect(el.closest(".mf-dt")).not.toBeNull();
    expect(r.container.querySelectorAll(".mf-vintro").length).toBe(1);
    // 읽기는 하단·단계 안내가 한다: 카드는 제목 요소(h1~h6)를 만들지 않는다
    expect(el.querySelector("h1, h2, h3, h4, h5, h6")).toBeNull();
  });

  it("위치: 카드 위쪽 = cy − 105(dayTableGeometry), 셰브런 3개, 높이는 clamp(96, 장면 아래 − 카드 아래끝 − 16, 230)", () => {
    const r = renderRoom(makeView("discussion"));
    r.rerenderRoom(makeView("execVote"));
    const geo = dayTableGeometry(DAY_SCENE_W, DAY_SCENE_H);
    const { top, chevH } = introCardGeometry(DAY_SCENE_W, DAY_SCENE_H);
    expect(top).toBe(geo.cy - 105);
    const drop = r.container.querySelector<HTMLElement>(".mf-vintro__drop")!;
    expect(drop.style.top).toBe(`${top}px`);
    expect(r.container.querySelectorAll(".mf-vintro__chev").length).toBe(3);
    expect(r.container.querySelector<HTMLElement>(".mf-vintro__chevs")!.style.height).toBe(`${chevH}px`);
  });

  it("introCardGeometry: 폰 폭 4종·짧은 폰에서 cy − 105 와 셰브런 높이 clamp(96~230)", () => {
    for (const [w, h] of [
      [366, 407],
      [352, 383],
      [406, 480],
      [366, 300],
      [366, 700],
    ] as const) {
      const { top, chevH } = introCardGeometry(w, h);
      expect(top).toBe(dayTableGeometry(w, h).cy - 105);
      expect(chevH).toBe(Math.min(230, Math.max(96, h - (top + 176) - 16)));
      expect(chevH).toBeGreaterThanOrEqual(96);
      expect(chevH).toBeLessThanOrEqual(230);
    }
  });

  it("처음 마운트(execVote 에서 시작)·재접속(epoch 변화)·다른 단계 전환에서는 뜨지 않는다", () => {
    expect(intro(renderRoom(makeView("execVote")).container)).toBeNull();
    cleanup();
    const a = renderRoom(makeView("discussion"), { epoch: 1 });
    a.rerenderRoom(makeView("execVote"), { epoch: 2 });
    expect(intro(a.container)).toBeNull();
    cleanup();
    const b = renderRoom(makeView("claim"));
    b.rerenderRoom(makeView("discussion"));
    expect(intro(b.container)).toBeNull();
    b.rerenderRoom(makeView("candidateVote"));
    expect(intro(b.container)).toBeNull();
  });

  it("1599ms 에는 있고 1600ms 에 DOM 에서 사라진다(EXEC_INTRO_MS), 같은 단계 안에서 다시 그리거나 마감 시각이 바뀌어도 돌아오지 않는다", () => {
    expect(EXEC_INTRO_MS).toBe(1600);
    const r = renderRoom(makeView("discussion"));
    r.rerenderRoom(makeView("execVote"));
    advance(1599);
    expect(intro(r.container)).not.toBeNull();
    advance(1);
    expect(intro(r.container)).toBeNull();
    expect(r.container.querySelectorAll(".mf-vintro, .mf-vintro__chev, .mf-vintro__veil").length).toBe(0);
    r.rerenderRoom(makeView("execVote", { yes: 1 }));
    r.rerenderRoom(makeView("execVote", { endsIn: 7_000 }));
    expect(intro(r.container)).toBeNull();
    advance(5_000);
    expect(intro(r.container)).toBeNull();
  });

  it("같은 단계의 새 view 로 다시 그려도 타이머가 연장되지 않는다", () => {
    const r = renderRoom(makeView("discussion"));
    r.rerenderRoom(makeView("execVote"));
    advance(1000);
    r.rerenderRoom(makeView("execVote", { yes: 1 }));
    advance(599);
    expect(intro(r.container)).not.toBeNull();
    advance(1);
    expect(intro(r.container)).toBeNull();
  });

  it("카드가 떠 있는 동안 집계 줄 회색 부분은 `카드 뒤에서도 바로 고를 수 있어요`, 사라지면 `아직 4명 · 마감까지 바꿀 수 있어요`", () => {
    const r = renderRoom(makeView("discussion"));
    r.rerenderRoom(makeView("execVote"));
    expect(hint(r.container)).toBe(VERDICT_TEXT.execIntroHint);
    expect(hint(r.container)).toBe("카드 뒤에서도 바로 고를 수 있어요");
    advance(EXEC_INTRO_MS);
    expect(hint(r.container)).toBe(execTallyText({ yes: 0, no: 0 }, 4).rest);
    expect(hint(r.container)).toBe("아직 4명 · 마감까지 바꿀 수 있어요");
    // 앞(굵은 부분)은 카드와 상관없이 집계다
    expect(r.container.querySelector(".mf-execvote__tally b")?.textContent).toBe("찬성 0 · 반대 0");
  });

  it("카드 위에서도 [찬성]·[반대] 가 눌려 send 로 이어진다(카드는 터치를 막지 않는다)", () => {
    const send = vi.fn(() => true);
    const r = renderRoom(makeView("discussion"), { send });
    r.rerenderRoom(makeView("execVote"), { send });
    expect(intro(r.container)).not.toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "찬성" }));
    expect(send).toHaveBeenCalledWith({ t: "execVote", agree: true });
    fireEvent.click(screen.getByRole("button", { name: "반대" }));
    expect(send).toHaveBeenCalledWith({ t: "execVote", agree: false });
  });

  it("언마운트하면 타이머가 정리된다(남는 타이머 없음)", () => {
    const r = renderRoom(makeView("discussion"));
    r.rerenderRoom(makeView("execVote"));
    r.unmount();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("직업을 읽지 않는다: 카드 소스에 직업 표가 없고 view 의 역할을 입력으로 받지 않는다", () => {
    const src = readFileSync("src/components/ExecIntroCard.tsx", "utf8");
    expect(src).not.toMatch(/roleText|ROLE_TEXT|ROLE_IDS|roleArtSrc|me\.role/);
  });
});

// ---- CSS 정적 단언: vitest 는 CSS 를 비우므로 파일을 직접 읽는다(?raw 를 쓰지 않는다) ----
const css = readFileSync("src/styles/verdict.css", "utf8");
const START = "/* ==== mf-vintro 시작 ==== */";
const END = "/* ==== mf-vintro 끝 ==== */";
const section = css.slice(css.indexOf(START), css.indexOf(END));
const reducedBlocks = [...section.matchAll(/@media \(prefers-reduced-motion: reduce\) \{([\s\S]*?)\n\}/g)].map((m) => m[1] ?? "");

describe("verdict.css 의 인트로·무효 카드 구역 (정적 단언)", () => {
  it("구역 표지가 있고 규칙이 충분하다(mf-vintro 5회 이상, 무효 변형 1회 이상)", () => {
    expect(css.indexOf(START)).toBeGreaterThanOrEqual(0);
    expect(css.indexOf(END)).toBeGreaterThan(css.indexOf(START));
    expect((css.match(/mf-vintro/g) ?? []).length).toBeGreaterThanOrEqual(5);
  });

  it("루트와 모든 자식이 터치를 통과시킨다(pointer-events: none)", () => {
    expect(section).toMatch(/\.mf-vintro,\s*\.mf-vintro \*\s*\{[^}]*pointer-events:\s*none/);
  });

  it("진홍 계열 토큰과 직접 # 색이 없고 글자 크기는 14·24·36 만 쓴다(D-33)", () => {
    expect(section).not.toMatch(/crimson/);
    expect(section).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    const sizes = new Set([...section.matchAll(/font-size:\s*(\d+)px/g)].map((m) => m[1]));
    expect([...sizes].sort()).toEqual(["14", "24", "36"]);
  });

  it("앰버 토큰(700·900·400)을 쓰고 질문 강조는 24px 700 이다", () => {
    for (const t of ["--amber-700", "--amber-900", "--amber-400"]) expect(section).toContain(t);
    expect(section).toMatch(/\.mf-vintro__q-big\s*\{[^}]*font-size:\s*24px[^}]*font-weight:\s*700/);
    expect(section).toMatch(/\.mf-vintro__title\s*\{[^}]*font-size:\s*36px/);
  });

  it("축소 모션 분기가 있고 낙하·바운스·회전·이동 키프레임을 거기에 두지 않는다(D-24)", () => {
    expect(reducedBlocks.length).toBeGreaterThanOrEqual(1);
    const reduced = reducedBlocks.join("\n");
    expect(reduced).toContain("mf-vintro");
    expect(reduced).not.toMatch(/translate|rotate|mf-vi-fall|bounce|mf-vi-chev\b|mf-vi-smear/);
    // 단계 전환(페이드)은 남는다
    expect(reduced).toContain("mf-vi-fade-in");
  });

  it("낙하 키프레임은 translate·rotate 를 쓰고 바운스(+4px)가 있다", () => {
    const fall = section.match(/@keyframes mf-vi-fall \{[\s\S]*?\n\}/)?.[0] ?? "";
    expect(fall).toMatch(/translate:\s*0 -276px/);
    expect(fall).toMatch(/rotate:\s*-5deg/);
    expect(fall).toMatch(/translate:\s*0 4px/);
  });
});
