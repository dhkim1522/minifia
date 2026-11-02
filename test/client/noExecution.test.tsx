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

// 처형 무효로 밤이 올 때(execVote·candidateVoteReveal → night)의 회색 카드·밤 시작 문구·읽기 안내 시험 9개는 지웠다:
// 08-18 부터 밤이 맵 화면(GameMap)이라 그 카드(NoExecutionCard)가 닿는 경로가 없다. 경찰 대상 버튼 → pick 은 nightMap.test 가,
// 지목 동률·0표로 온 밤의 '처형 없음' 알림 1.4초는 nightMap.test(08-18 Task 3)가 본다.
describe("처형 무효 카드 소스 (D-34)", () => {
  it("카드 소스는 직업 표를 읽지 않는다", () => {
    for (const f of ["src/components/NoExecutionCard.tsx", "src/components/ExecIntroCard.tsx"]) {
      expect(readFileSync(f, "utf8")).not.toMatch(/roleText|ROLE_TEXT|ROLE_IDS|roleArtSrc|me\.role/);
    }
  });
});
