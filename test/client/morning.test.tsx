/// <reference types="node" />
import { existsSync, readFileSync } from "node:fs";
import { cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "../helpers/singleLineErrors";
import type { RoleId } from "../../shared/game/roles";
import type { MorningView, PhaseId, RoomView, SpectateView } from "../../shared/protocol";
import type { RoomConnection } from "../../src/net/useRoomConnection";
import { DayScene } from "../../src/screens/DayScene";

// 아침 발표 통합 테스트(03-10): DayScene 의 morning 분기를 view 픽스처로 만난다.
// 실패 보고서가 한 줄이 되도록 단언은 문자열·불리언으로 둔다.

const NOW = 10_000;
const NAMES = ["지우", "하윤", "민지", "도현", "서연"];

interface ViewOpts {
  phase?: PhaseId;
  n?: number;
  role?: RoleId;
  allies?: number[];
  pick?: number;
  allyPicks?: number[];
  dead?: number[];
  morning?: MorningView;
  spectate?: SpectateView;
  endsIn?: number;
}

function makeView(o: ViewOpts = {}): RoomView {
  const me: RoomView["me"] = { seat: 0, isHost: false };
  if (o.role !== undefined) me.role = o.role;
  if (o.allies !== undefined) me.allies = o.allies;
  if (o.pick !== undefined) me.pick = o.pick;
  if (o.allyPicks !== undefined) me.allyPicks = o.allyPicks;
  const dead = o.dead ?? [];
  const phase = o.phase ?? "morning";
  const view: RoomView = {
    code: "0042",
    phase,
    phaseEndsAt: NOW + (o.endsIn ?? 5_000),
    phaseDurationMs: phase === "morning" ? 5_000 : 30_000,
    serverNow: NOW,
    minPlayers: 4,
    maxPlayers: 8,
    players: NAMES.map((nickname, seat) => ({ seat, nickname, connected: true, isHost: seat === 0, alive: !dead.includes(seat) })),
    me,
    day: {
      n: o.n ?? 1,
      roles: ["mafia", "police", "doctor", "citizen"],
      claims: NAMES.map((_, seat) => ({ seat, claim: "citizen" as const, changed: false })),
    },
  };
  if (o.morning !== undefined && view.day) view.day.morning = o.morning;
  if (o.spectate) view.spectate = o.spectate;
  return view;
}

function conn(view: RoomView): RoomConnection {
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
  };
}

function scene(view: RoomView) {
  const c = conn(view);
  const role = <button type="button">내 역할</button>;
  const utils = render(<DayScene view={view} connection={c} myRoleButton={role} />);
  const rerender = (v: RoomView) => utils.rerender(<DayScene view={v} connection={{ ...c, view: v }} myRoleButton={role} />);
  return { ...utils, rerender, conn: c };
}

const panel = (container: HTMLElement) => container.querySelector<HTMLElement>(".mf-dayscene__panel");
const readCss = (path: string) => (existsSync(path) ? readFileSync(path, "utf8") : "");

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("아침 발표 (M1)", () => {
  it("morning view(day.n 1, morning {eliminated: 2, phrase: 1}): 카드 제목이 '민지님이 이슬이 되어 사라졌습니다' 이고 보조 문단이 없다", () => {
    const { container } = scene(makeView({ morning: { eliminated: 2, phrase: 1 } }));
    expect(container.querySelectorAll(".mf-morningcard").length).toBe(1);
    expect(container.querySelector(".mf-morningcard__t")?.textContent).toBe("민지님이 이슬이 되어 사라졌습니다");
    expect(container.querySelector(".mf-morningcard__s") === null).toBe(true);
  });

  it("카드는 .mf-dayscene 직계이고 테이블 장면 상자 밖이다", () => {
    const { container } = scene(makeView({ morning: { eliminated: 2, phrase: 1 } }));
    const card = container.querySelector(".mf-morningcard")!;
    expect(card.parentElement?.classList.contains("mf-dayscene")).toBe(true);
    expect(card.closest(".mf-dayscene__scene") === null).toBe(true);
  });

  it("위쪽 바 제목 '아침', 안내 '2일차', 배경 낮, 하단 제목 '아침이 밝았습니다'·안내 '곧 낮 토론이 시작돼요'(알약·채팅·버튼 없음)", () => {
    const { container } = scene(makeView({ morning: { eliminated: 2, phrase: 1 } }));
    expect(container.querySelector("h1")?.textContent).toBe("아침");
    expect(container.querySelector(".mf-phasebar__do")?.textContent).toBe("2일차");
    expect(container.querySelector(".mf-backdrop--day") !== null).toBe(true);
    expect(container.querySelector(".mf-backdrop--night") === null).toBe(true);
    const p = panel(container)!;
    expect(p.querySelector("h2")?.textContent).toBe("아침이 밝았습니다");
    expect(p.querySelector(".mf-claimpanel__guide")?.textContent).toBe("곧 낮 토론이 시작돼요");
    expect(p.querySelectorAll(".mf-pk, .mf-ro, button, textarea, input").length).toBe(0);
  });

  it("phase 4 → '민지님이 차갑게 식은 채 발견되었습니다'", () => {
    const { container } = scene(makeView({ morning: { eliminated: 2, phrase: 4 } }));
    expect(container.querySelector(".mf-morningcard__t")?.textContent).toBe("민지님이 차갑게 식은 채 발견되었습니다");
  });

  it("night → morning 으로 바뀌어도 .mf-dt 루트가 같은 DOM 노드다", () => {
    const r = scene(makeView({ phase: "night", role: "citizen" }));
    const table = r.container.querySelector(".mf-dt");
    expect(table !== null).toBe(true);
    r.rerender(makeView({ phase: "morning", role: "citizen", morning: { eliminated: 2, phrase: 1 } }));
    expect(r.container.querySelector(".mf-dt") === table).toBe(true);
  });
});

describe("night.css: 아침 카드 (03-10)", () => {
  const css = readCss("src/styles/night.css");
  const rule = (sel: string) => css.match(new RegExp(`(^|\\n)${sel.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*\\{([^}]*)\\}`))?.[2] ?? "";

  it(".mf-morningcard 값이 시안 .bn 을 토큰으로 옮긴 것이다", () => {
    const r = rule(".mf-morningcard");
    expect(/position:\s*absolute/.test(r)).toBe(true);
    expect(/z-index:\s*70/.test(r)).toBe(true);
    expect(/top:\s*168px/.test(r)).toBe(true);
    expect(/width:\s*252px/.test(r)).toBe(true);
    expect(/left:\s*50%/.test(r)).toBe(true);
    expect(/background:\s*color-mix\(in srgb, var\(--night-900\) 92%, transparent\)/.test(r)).toBe(true);
    expect(/box-shadow:\s*0 10px 28px var\(--shadow\)/.test(r)).toBe(true);
    expect(/border:\s*1px solid var\(--night-600\)/.test(r)).toBe(true);
    expect(/word-break:\s*keep-all/.test(r)).toBe(true);
  });

  it("제목은 24px 700 gray-50, 보조는 14px gray-300", () => {
    const t = rule(".mf-morningcard__t");
    expect(/font-size:\s*24px/.test(t)).toBe(true);
    expect(/font-weight:\s*700/.test(t)).toBe(true);
    expect(/color:\s*var\(--gray-50\)/.test(t)).toBe(true);
    const s = rule(".mf-morningcard__s");
    expect(/font-size:\s*14px/.test(s)).toBe(true);
    expect(/color:\s*var\(--gray-300\)/.test(s)).toBe(true);
  });
});
