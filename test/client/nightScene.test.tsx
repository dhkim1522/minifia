/// <reference types="node" />
import { existsSync, readFileSync } from "node:fs";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "../helpers/singleLineErrors";
import type { RoleId } from "../../shared/game/roles";
import type { PhaseId, RoomView, SpectateView } from "../../shared/protocol";
import type { RoomConnection, RoomEvent } from "../../src/net/useRoomConnection";
import { DayScene } from "../../src/screens/DayScene";

// 밤 장면 통합 테스트(03-08): 역할별 하단·대상 탭·낙관적 선택·관전 화면을 DayScene 으로 만난다.
// 서버와는 view 픽스처와 이벤트 발행기로만 만난다. 실패 보고서가 한 줄이 되도록 단언은 문자열·불리언으로 둔다.

const NOW = 10_000;
const NAMES = ["지우", "하윤", "민지", "도현", "서연"];

interface ViewOpts {
  phase?: PhaseId;
  n?: number;
  role?: RoleId;
  allies?: number[];
  pick?: number;
  allyPicks?: number[];
  /** 탈락한 자리들 */
  dead?: number[];
  spectate?: SpectateView;
}

function makeView(o: ViewOpts = {}): RoomView {
  const me: RoomView["me"] = { seat: 0, isHost: false };
  if (o.role !== undefined) me.role = o.role;
  if (o.allies !== undefined) me.allies = o.allies;
  if (o.pick !== undefined) me.pick = o.pick;
  if (o.allyPicks !== undefined) me.allyPicks = o.allyPicks;
  const dead = o.dead ?? [];
  const view: RoomView = {
    code: "0042",
    phase: o.phase ?? "night",
    phaseEndsAt: NOW + 30_000,
    phaseDurationMs: 30_000,
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
  if (o.spectate) view.spectate = o.spectate;
  return view;
}

/** 서버 chat·emoji·error 프레임을 흉내 내는 발행기 */
function emitter() {
  const listeners = new Set<(e: RoomEvent) => void>();
  return {
    onEvent: (l: (e: RoomEvent) => void) => {
      listeners.add(l);
      return () => {
        listeners.delete(l);
      };
    },
    emit: (e: RoomEvent) =>
      act(() => {
        for (const l of [...listeners]) l(e);
      }),
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
  const role = <button type="button">내 역할</button>;
  const utils = render(<DayScene view={view} connection={c} myRoleButton={role} />);
  const rerender = (v: RoomView) => utils.rerender(<DayScene view={v} connection={{ ...c, view: v }} myRoleButton={role} />);
  return { ...utils, rerender, conn: c };
}

const seatEl = (container: HTMLElement, seat: number) => container.querySelector<HTMLElement>(`.mf-dt__seat[data-seat="${seat}"]`);
const panel = (container: HTMLElement) => container.querySelector<HTMLElement>(".mf-dayscene__panel");
const sent = (c: RoomConnection) => JSON.stringify(vi.mocked(c.send).mock.calls);
const readCss = (path: string) => (existsSync(path) ? readFileSync(path, "utf8") : "");

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("밤 — 경찰 (N-3)", () => {
  it("night·경찰: 밤 배경, 제목 '밤', 안내 '1일차', 타이머 하나, 하단 제목·안내·알약 '선택 안 함'", () => {
    const { container } = scene(makeView({ role: "police" }));
    expect(container.querySelector(".mf-backdrop--night") !== null).toBe(true);
    expect(container.querySelector("h1")?.textContent).toBe("밤");
    expect(container.querySelector(".mf-phasebar__do")?.textContent).toBe("1일차");
    expect(screen.getAllByRole("timer").length).toBe(1);
    const p = panel(container)!;
    expect(p.querySelector("h2")?.textContent).toBe("조사할 사람을 고르세요");
    expect(p.querySelector(".mf-claimpanel__guide")?.textContent).toBe("결과는 밤이 끝날 때 알려 드려요 · 마감까지 바꿀 수 있어요");
    const pill = p.querySelector(".mf-pk");
    expect(pill?.textContent).toBe("선택 안 함");
    expect(pill?.classList.contains("mf-pk--empty")).toBe(true);
  });

  it("살아 있는 다섯 자리 모두(나 포함)가 대상 버튼이다", () => {
    const { container } = scene(makeView({ role: "police" }));
    expect(container.querySelectorAll(".mf-dt button.mf-dt__seat").length).toBe(5);
    expect(screen.getByRole("button", { name: "하윤, 조사 대상" }) !== null).toBe(true);
    expect(screen.getByRole("button", { name: "지우 (나), 조사 대상" }) !== null).toBe(true);
  });

  it("자리 2 를 누르면 {t:'pick', target:2} 한 번 — 링·배지·aria-pressed·알약 '선택 민지' 가 즉시 바뀐다", () => {
    const r = scene(makeView({ role: "police" }));
    fireEvent.click(seatEl(r.container, 2)!);
    expect(sent(r.conn)).toBe('[[{"t":"pick","target":2}]]');
    const s = seatEl(r.container, 2)!;
    expect(s.querySelector(".mf-dt__sel") !== null).toBe(true);
    expect(s.querySelector(".mf-dt__pick--me") !== null).toBe(true);
    expect(s.getAttribute("aria-pressed")).toBe("true");
    const pill = within(panel(r.container)!).getByRole("status");
    expect(pill.textContent).toBe("선택 민지");
    expect(pill.querySelector("b")?.textContent).toBe("민지");
    expect(pill.querySelector(".mf-pk__dot") !== null).toBe(true);
  });

  it("같은 대상을 다시 누르면 send 가 더 불리지 않는다", () => {
    const r = scene(makeView({ role: "police" }));
    fireEvent.click(seatEl(r.container, 2)!);
    fireEvent.click(seatEl(r.container, 2)!);
    expect(vi.mocked(r.conn.send).mock.calls.length).toBe(1);
  });

  it("새 view(me.pick 3)가 오면 링이 자리 3 으로 가고 알약 '선택 도현' — 서버 값이 이긴다", () => {
    const r = scene(makeView({ role: "police" }));
    fireEvent.click(seatEl(r.container, 2)!);
    r.rerender(makeView({ role: "police", pick: 3 }));
    expect(seatEl(r.container, 2)!.querySelector(".mf-dt__sel") === null).toBe(true);
    expect(seatEl(r.container, 3)!.querySelector(".mf-dt__sel") !== null).toBe(true);
    expect(within(panel(r.container)!).getByRole("status").textContent).toBe("선택 도현");
  });

  it("discussion → night 로 바뀌어도 .mf-dt 루트가 같은 DOM 노드다 (C5)", () => {
    const r = scene(makeView({ phase: "discussion", role: "police" }));
    const before = r.container.querySelector(".mf-dt");
    r.rerender(makeView({ phase: "night", role: "police" }));
    expect(r.container.querySelector(".mf-dt") === before).toBe(true);
    expect(r.container.querySelector(".mf-backdrop--night") !== null).toBe(true);
  });
});

describe("밤 — 마피아 (N-2)", () => {
  const mafia = (o: ViewOpts = {}) => makeView({ role: "mafia", allies: [2], ...o });

  it("안내 '1일차 · 함께 지목하세요', 자신·동료는 버튼이 아니고 나머지는 '지목 대상' 버튼, 동료에 마피아 링", () => {
    const { container } = scene(mafia());
    expect(container.querySelector(".mf-phasebar__do")?.textContent).toBe("1일차 · 함께 지목하세요");
    const isButton = (n: number) => seatEl(container, n)?.tagName === "BUTTON";
    expect([0, 1, 2, 3, 4].map((n) => (isButton(n) ? "1" : "0")).join("")).toBe("01011");
    expect(screen.getByRole("button", { name: "하윤, 지목 대상" }) !== null).toBe(true);
    expect(seatEl(container, 2)!.querySelector(".mf-dt__ring--mate") !== null).toBe(true);
  });

  it("allyPicks [3] → 자리 3 에 --ally. 내가 3 을 고르면 --ally 와 --me 둘 다", () => {
    const r = scene(mafia({ allyPicks: [3] }));
    expect(seatEl(r.container, 3)!.querySelector(".mf-dt__pick--ally") !== null).toBe(true);
    expect(seatEl(r.container, 3)!.querySelector(".mf-dt__pick--me") === null).toBe(true);
    fireEvent.click(seatEl(r.container, 3)!);
    expect(sent(r.conn)).toBe('[[{"t":"pick","target":3}]]');
    expect(seatEl(r.container, 3)!.querySelector(".mf-dt__pick--ally") !== null).toBe(true);
    expect(seatEl(r.container, 3)!.querySelector(".mf-dt__pick--me") !== null).toBe(true);
  });

  it("하단: 로그 '마피아 채팅' 첫 줄 '마피아끼리만 보여요', [이모티콘] 있음, 제목 없음, [빠른 메시지] 칩은 밤 세 개", () => {
    const { container } = scene(mafia());
    const log = screen.getByRole("log", { name: "마피아 채팅" });
    expect(log.querySelector(".mf-msglog__item")?.textContent).toBe("마피아끼리만 보여요");
    expect(screen.getByRole("button", { name: "이모티콘" }) !== null).toBe(true);
    expect(panel(container)!.querySelector("h2") === null).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "빠른 메시지" }));
    const chips = within(screen.getByRole("group", { name: "문구" })).getAllByRole("button");
    expect(chips.map((b) => b.textContent).join("|")).toBe("[○○] 지목해요|동의해요|다른 사람을 지목해요");
  });

  it("night 중 emoji 이벤트(자리 2) → 머리 위 이모티콘, chat 이벤트(2 → 3) → 로그에 '도현 지목해요'", () => {
    const em = emitter();
    const r = scene(mafia(), { onEvent: em.onEvent });
    em.emit({ t: "emoji", seat: 2, icon: "smile", at: NOW });
    expect(r.container.querySelectorAll('.mf-dt__emoji[data-seat="2"]').length).toBe(1);
    em.emit({ t: "chat", seq: 1, seat: 2, template: "nightTarget", target: 3, at: NOW });
    const log = screen.getByRole("log", { name: "마피아 채팅" });
    expect(log.textContent).toContain("도현 지목해요");
  });

  it("마피아 하단 HTML 에 역할 이름이 없다 (허용 문구 '마피아끼리만 보여요'·'마피아 채팅' 제외)", () => {
    const { container } = scene(mafia());
    const html = panel(container)!.innerHTML.replaceAll("마피아끼리만 보여요", "").replaceAll("마피아 채팅", "");
    expect(/마피아|경찰|의사|시민/.test(html)).toBe(false);
  });
});

describe("밤 — 의사·시민 (N-3·N-4)", () => {
  it("의사: 자기 자리 버튼 '지우 (나), 보호 대상', 누르면 알약 '선택 나' 와 제목 '지킬 사람을 고르세요'", () => {
    const r = scene(makeView({ role: "doctor" }));
    expect(panel(r.container)!.querySelector("h2")?.textContent).toBe("지킬 사람을 고르세요");
    fireEvent.click(screen.getByRole("button", { name: "지우 (나), 보호 대상" }));
    expect(sent(r.conn)).toBe('[[{"t":"pick","target":0}]]');
    expect(within(panel(r.container)!).getByRole("status").textContent).toBe("선택 나");
  });

  it("시민: 테이블에 button 이 0 개, 하단 '밤이 되었어요'·안내·'이번 밤에는 할 수 있는 행동이 없어요'", () => {
    const { container } = scene(makeView({ role: "citizen" }));
    expect(container.querySelectorAll(".mf-dt button").length).toBe(0);
    const p = panel(container)!;
    expect(p.querySelector("h2")?.textContent).toBe("밤이 되었어요");
    expect(p.querySelector(".mf-claimpanel__guide")?.textContent).toBe("다른 사람들이 행동하는 중이에요. 마감까지 기다려 주세요");
    expect(p.querySelector(".mf-pk")?.textContent).toBe("이번 밤에는 할 수 있는 행동이 없어요");
    expect(/마피아|경찰|의사|시민/.test(p.innerHTML)).toBe(false);
  });
});

describe("밤 — 오류·끊김·탈락 표시", () => {
  it("경찰 화면에 error BAD_MESSAGE → 토스트, WRONG_PHASE → 토스트 없음", () => {
    const em = emitter();
    scene(makeView({ role: "police" }), { onEvent: em.onEvent });
    em.emit({ t: "error", code: "WRONG_PHASE" });
    expect(screen.queryByText("보내지 못했어요. 다시 시도해 주세요") === null).toBe(true);
    em.emit({ t: "error", code: "BAD_MESSAGE" });
    expect(screen.getByText("보내지 못했어요. 다시 시도해 주세요") !== null).toBe(true);
  });

  it("canSend false → 대상 버튼이 모두 disabled, 눌러도 send 없음", () => {
    const r = scene(makeView({ role: "police" }), { canSend: false });
    const buttons = [...r.container.querySelectorAll<HTMLButtonElement>(".mf-dt button.mf-dt__seat")];
    expect(buttons.map((b) => (b.disabled ? "1" : "0")).join("")).toBe("11111");
    fireEvent.click(buttons[2]!);
    expect(vi.mocked(r.conn.send).mock.calls.length).toBe(0);
  });

  it("탈락한 자리(dead [4])는 살아 있는 경찰 화면에서 버튼이 아니고 유령 그림 + 아랫줄 '탈락'", () => {
    const { container } = scene(makeView({ role: "police", dead: [4] }));
    expect(seatEl(container, 4)!.tagName).toBe("DIV");
    expect(container.querySelectorAll(".mf-dt button.mf-dt__seat").length).toBe(4);
    expect(seatEl(container, 4)!.querySelector("img")?.getAttribute("src")).toContain("/characters/ghost/");
    expect(container.querySelector('.mf-dt__tag[data-seat="4"] .mf-dt__claim')?.textContent).toBe("탈락");
  });
});

describe("night.css: 선택 알약 (03-08)", () => {
  const css = readCss("src/styles/night.css");
  const rule = (sel: string) => css.match(new RegExp(`(^|\\n)${sel.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*\\{([^}]*)\\}`))?.[2] ?? "";

  it(".mf-pk 값이 시안 .pk 를 토큰으로 옮긴 것이다", () => {
    const r = rule(".mf-pk");
    expect(/min-height:\s*var\(--tap-min\)/.test(r)).toBe(true);
    expect(/padding:\s*0 var\(--space-md\)/.test(r)).toBe(true);
    expect(/border-radius:\s*var\(--radius-md\)/.test(r)).toBe(true);
    expect(/background:\s*var\(--night-700\)/.test(r)).toBe(true);
    expect(/font-size:\s*14px/.test(r)).toBe(true);
    expect(/line-height:\s*20px/.test(r)).toBe(true);
  });

  it(".mf-pk--empty 는 gray-300 이고 코드 줄에 hex 색이 없다", () => {
    expect(/color:\s*var\(--gray-300\)/.test(rule(".mf-pk--empty"))).toBe(true);
    const code = css.split("\n").filter((l) => !/^\s*\/?\*/.test(l)).join("\n");
    expect(css.length > 0 && !/#[0-9a-fA-F]{3,6}/.test(code)).toBe(true);
  });
});
