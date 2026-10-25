/// <reference types="node" />
import { readFileSync } from "node:fs";
import { act, cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DAY_ANNOUNCE_MS } from "../../shared/game/phases";
import type { RoleId } from "../../shared/game/roles";
import type { PhaseId, RoomView } from "../../shared/protocol";
import { NIGHT_INTRO_MS } from "../../src/components/NightIntro";
import { DayScene } from "../../src/screens/DayScene";
import type { RoomConnection } from "../../src/net/useRoomConnection";

// 밤 시작 문구(결정 0028, U-03): 같은 접속에서 비밤 → 밤으로 넘어가는 순간에만 한 번 뜬다.
// 길이는 낮 시작 발표(DAY_ANNOUNCE_MS)와 같고, 재접속(epoch 변화)·처음 마운트·밤 안의 다시 그리기에는 뜨지 않는다.

const NOW = 1_700_000_000_000;

function makeView(o: { phase: PhaseId; n?: number; role?: RoleId; dead?: number[] }): RoomView {
  const me: RoomView["me"] = { seat: 0, isHost: false };
  if (o.role !== undefined) me.role = o.role;
  const dead = o.dead ?? [];
  return {
    code: "0042",
    phase: o.phase,
    phaseEndsAt: NOW + 30_000,
    phaseDurationMs: 30_000,
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
    day: { n: o.n ?? 1, roles: ["mafia", "police", "citizen"], claimLog: [] },
  };
}

function conn(view: RoomView, epoch: number): RoomConnection {
  return {
    status: "open",
    banner: "hidden",
    view,
    offset: 0,
    epoch,
    removedReason: null,
    canSend: true,
    send: vi.fn(() => true),
    onEvent: vi.fn(() => () => {}),
    reconnect: vi.fn(),
    retry: vi.fn(),
  };
}

const btn = <button type="button">내 역할</button>;
function scene(view: RoomView, epoch = 1) {
  const utils = render(<DayScene view={view} connection={conn(view, epoch)} myRoleButton={btn} />);
  const rerender = (v: RoomView, e = epoch) => utils.rerender(<DayScene view={v} connection={conn(v, e)} myRoleButton={btn} />);
  return { ...utils, rerender };
}
const intro = (c: HTMLElement) => c.querySelector<HTMLElement>(".mf-nightintro");
const advance = (ms: number) => act(() => void vi.advanceTimersByTime(ms));

afterEach(cleanup);

describe("DayScene 밤 시작 문구 (결정 0028, U-03)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("토론 → 밤(같은 epoch)이면 aria-hidden 문구 `1일차`·`밤이 되었습니다` 가 뜨고 장면 제목 h1 은 여전히 `밤` 하나다", () => {
    const { container, rerender } = scene(makeView({ phase: "discussion", role: "citizen" }));
    expect(intro(container)).toBeNull();
    rerender(makeView({ phase: "night", role: "citizen" }));
    const el = intro(container)!;
    expect(el).not.toBeNull();
    expect(el.getAttribute("aria-hidden")).toBe("true");
    expect(Array.from(el.querySelectorAll("p")).map((p) => p.textContent)).toEqual(["1일차", "밤이 되었습니다"]);
    const h1s = container.querySelectorAll("h1");
    expect(h1s.length).toBe(1);
    expect(h1s[0]?.textContent).toBe("밤");
    expect(el.querySelector("h1")).toBeNull();
  });

  it("처음 마운트가 밤이면 뜨지 않는다", () => {
    const { container } = scene(makeView({ phase: "night", role: "citizen" }));
    expect(intro(container)).toBeNull();
  });

  it("단계와 epoch 가 함께 바뀌면(재접속) 뜨지 않는다", () => {
    const { container, rerender } = scene(makeView({ phase: "discussion", role: "citizen" }), 1);
    rerender(makeView({ phase: "night", role: "citizen" }), 2);
    expect(intro(container)).toBeNull();
  });

  it("NIGHT_INTRO_MS 는 낮 시작 발표 길이와 같고, 1999ms 에는 있고 2000ms 에는 사라진다", () => {
    expect(NIGHT_INTRO_MS).toBe(DAY_ANNOUNCE_MS);
    expect(DAY_ANNOUNCE_MS).toBe(2000);
    const { container, rerender } = scene(makeView({ phase: "discussion", role: "citizen" }));
    rerender(makeView({ phase: "night", role: "citizen" }));
    advance(1999);
    expect(intro(container)).not.toBeNull();
    advance(1);
    expect(intro(container)).toBeNull();
  });

  it("같은 밤의 새 view 로 다시 그려도 타이머가 연장되지 않고, 사라진 뒤 다시 그려도 돌아오지 않는다", () => {
    const { container, rerender } = scene(makeView({ phase: "discussion", role: "citizen" }));
    rerender(makeView({ phase: "night", role: "citizen" }));
    advance(1000);
    rerender(makeView({ phase: "night", role: "citizen" }));
    expect(intro(container)).not.toBeNull();
    advance(999);
    expect(intro(container)).not.toBeNull();
    advance(1);
    expect(intro(container)).toBeNull();
    rerender(makeView({ phase: "night", role: "citizen" }));
    expect(intro(container)).toBeNull();
    advance(5000);
    expect(intro(container)).toBeNull();
  });

  it("밤 → 아침으로 가면 즉시 사라지고, 다음 밤(2일차)에 `2일차` 로 다시 뜬다", () => {
    const { container, rerender } = scene(makeView({ phase: "discussion", role: "citizen" }));
    rerender(makeView({ phase: "night", role: "citizen" }));
    expect(intro(container)).not.toBeNull();
    advance(500);
    rerender(makeView({ phase: "morning", role: "citizen" }));
    expect(intro(container)).toBeNull();
    rerender(makeView({ phase: "discussion", role: "citizen", n: 2 }));
    rerender(makeView({ phase: "night", role: "citizen", n: 2 }));
    expect(Array.from(intro(container)!.querySelectorAll("p")).map((p) => p.textContent)).toEqual(["2일차", "밤이 되었습니다"]);
    advance(NIGHT_INTRO_MS);
    expect(intro(container)).toBeNull();
  });

  it("역할 4종과 탈락자 화면 모두 같은 글자다 (역할 유출 없음)", () => {
    const texts: string[] = [];
    const cases: Array<{ role: RoleId; dead?: number[] }> = [
      { role: "mafia" },
      { role: "police" },
      { role: "doctor" },
      { role: "citizen" },
      { role: "citizen", dead: [0] },
    ];
    for (const c of cases) {
      const { container, rerender, unmount } = scene(makeView({ phase: "discussion", role: c.role, ...(c.dead ? { dead: c.dead } : {}) }));
      rerender(makeView({ phase: "night", role: c.role, ...(c.dead ? { dead: c.dead } : {}) }));
      const el = intro(container);
      expect(el).not.toBeNull();
      texts.push(el!.textContent ?? "");
      unmount();
    }
    expect(new Set(texts).size).toBe(1);
    expect(texts[0]).toBe("1일차밤이 되었습니다");
  });
});

describe("night.css: .mf-nightintro (낮 시작 발표와 같은 방식)", () => {
  const raw = readFileSync("src/styles/night.css", "utf8");
  const css = raw.replace(/\/\*[\s\S]*?\*\//g, "");
  const blocks = css.match(/[^{}]*mf-nightintro[^{}]*\{[^}]*\}/g) ?? [];
  const rule = (sel: string): string => {
    const m = new RegExp(`(?:^|\\})\\s*${sel.replace(/[.]/g, "\\.")}\\s*\\{([^}]*)\\}`).exec(css);
    return m?.[1] ?? "";
  };

  it("루트: absolute·inset 0·pointer-events none·z-index 는 0 보다 크고 --z-overlay(50)보다 작은 정수", () => {
    const r = rule(".mf-nightintro");
    expect(/position:\s*absolute/.test(r)).toBe(true);
    expect(/inset:\s*0\b/.test(r)).toBe(true);
    expect(/pointer-events:\s*none/.test(r)).toBe(true);
    const z = /z-index:\s*(\d+)/.exec(r);
    expect(z).not.toBeNull();
    expect(Number(z![1]) > 0 && Number(z![1]) < 50).toBe(true);
    expect(/--z-overlay:\s*50\b/.test(readFileSync("src/styles/tokens.css", "utf8"))).toBe(true);
  });

  it("퇴장 지연은 인라인 변수에서 받고, 막과 제목 번짐은 --dur-slow·--ease-out 이다", () => {
    expect(/animation:[^;]*var\(--mf-nightintro-exit-delay[,)]/.test(rule(".mf-nightintro"))).toBe(true);
    expect(/animation:[^;]*var\(--dur-slow\)\s+var\(--ease-out\)/.test(rule(".mf-nightintro__veil"))).toBe(true);
    expect(/animation:[^;]*var\(--dur-slow\)\s+var\(--ease-out\)/.test(rule(".mf-nightintro__title"))).toBe(true);
    expect(/@keyframes mf-nightintro-\w+/.test(css)).toBe(true);
  });

  it("축소 모션 개별 규칙이 없고(전역 규칙에 맡김) 그 전역 규칙이 있다", () => {
    expect(blocks.length).toBeGreaterThan(0);
    // 축소 모션 @media 블록마다 중괄호를 세어 본문을 잘라 그 안에 mf-nightintro 가 없는지 본다
    const re = /@media[^{]*prefers-reduced-motion[^{]*\{/g;
    for (let m = re.exec(css); m; m = re.exec(css)) {
      let depth = 1;
      let i = re.lastIndex;
      for (; i < css.length && depth > 0; i++) depth += css[i] === "{" ? 1 : css[i] === "}" ? -1 : 0;
      expect(css.slice(re.lastIndex, i).includes("mf-nightintro")).toBe(false);
    }
    const base = readFileSync("src/styles/base.css", "utf8");
    expect(/prefers-reduced-motion:\s*reduce\)\s*\{[^@]*animation-duration:\s*0\.01ms\s*!important/.test(base)).toBe(true);
  });

  it("코드 줄에 # 색 값이 없다 (토큰 변수만)", () => {
    expect(blocks.some((b) => /#[0-9a-fA-F]{3,8}\b/.test(b))).toBe(false);
  });
});
