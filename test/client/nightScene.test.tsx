/// <reference types="node" />
import { existsSync, readFileSync } from "node:fs";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "../helpers/singleLineErrors";
import type { RoleId } from "../../shared/game/roles";
import type { ClaimLogEntry, PhaseId, RoomView, SpectateView } from "../../shared/protocol";
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
  /** 공개된 주장 기록 (기본 비어 있음) */
  claimLog?: ClaimLogEntry[];
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
      claimLog: o.claimLog ?? [],
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

  it("탈락한 자리(dead [4])는 살아 있는 경찰 화면에서 버튼이 아니고 유령 그림 + 한 줄 탈락 이름표('탈락' 글자 없음)", () => {
    const { container } = scene(makeView({ role: "police", dead: [4] }));
    expect(seatEl(container, 4)!.tagName).toBe("DIV");
    expect(container.querySelectorAll(".mf-dt button.mf-dt__seat").length).toBe(4);
    expect(seatEl(container, 4)!.querySelector("img")?.getAttribute("src")).toContain("/characters/ghost/");
    const tag = container.querySelector('.mf-dt__tag[data-seat="4"]');
    expect(tag?.classList.contains("mf-dt__tag--dead")).toBe(true);
    expect(tag?.textContent?.includes("탈락")).toBe(false);
  });
});

describe("관전 (N-6, 결정 0021)", () => {
  // 나(seat 0)는 탈락. 서버가 탈락자에게만 보낸 spectate: 0 시민·1 마피아·2 시민·3 경찰·4 의사
  const spectate: SpectateView = {
    seats: [
      { seat: 0, job: "citizen" },
      { seat: 1, job: "mafia" },
      { seat: 2, job: "citizen" },
      { seat: 3, job: "police" },
      { seat: 4, job: "doctor" },
    ],
    picks: { mafia: [4], police: [1], doctor: [2] },
  };
  const dead0 = (o: ViewOpts = {}) => makeView({ role: "citizen", dead: [0], spectate, ...o });
  // 이름표는 이름 한 줄이라 아랫줄(.mf-dt__claim)이 어디에도 없다. 다른 자리의 실제 직업 그림(roleArt)은 03.1-10 이 연결하고 그 단언도 거기서 더한다.
  const claimRowCount = (c: HTMLElement) => c.querySelectorAll(".mf-dt__claim").length;

  it("밤: 내 자리 유령 + 탈락 이름표, 이름표 아랫줄 없음, 마피아 링·마름모, 역할별 배지, 버튼 0 개", () => {
    const { container } = scene(dead0());
    expect(seatEl(container, 0)!.querySelector("img")?.getAttribute("src")).toContain("/characters/ghost/");
    expect(container.querySelector('.mf-dt__tag[data-seat="0"]')?.classList.contains("mf-dt__tag--dead")).toBe(true);
    expect(claimRowCount(container)).toBe(0);
    expect(seatEl(container, 1)!.querySelector(".mf-dt__ring--mate") !== null).toBe(true);
    expect(seatEl(container, 1)!.querySelector('[role="img"][aria-label="마피아"]') !== null).toBe(true);
    expect(seatEl(container, 4)!.querySelector('.mf-dt__pick--ally[role="img"][aria-label="마피아 지목 대상"]') !== null).toBe(true);
    expect(seatEl(container, 1)!.querySelector('.mf-dt__pick--police[role="img"][aria-label="경찰 조사 대상"]') !== null).toBe(true);
    expect(seatEl(container, 2)!.querySelector('.mf-dt__pick--doctor[role="img"][aria-label="의사 보호 대상"]') !== null).toBe(true);
    expect(container.querySelectorAll(".mf-dt button").length).toBe(0);
  });

  it("밤 하단: 로그 '마피아 채팅(관전)', 첫 줄 '관전 중 · 마피아 채팅', ^ 없음, p.mf-ro, 보내기 줄·제목 없음", () => {
    const { container } = scene(dead0());
    const log = screen.getByRole("log", { name: "마피아 채팅(관전)" });
    expect(log.querySelector(".mf-msglog__item")?.textContent).toBe("관전 중 · 마피아 채팅");
    expect(screen.queryByRole("button", { name: "채팅 내역 크게 보기" }) === null).toBe(true);
    const ro = panel(container)!.querySelector("p.mf-ro");
    expect(ro?.textContent).toBe("탈락했어요 · 볼 수만 있어요");
    expect(screen.queryByRole("button", { name: "빠른 메시지" }) === null).toBe(true);
    expect(screen.queryByRole("button", { name: "이모티콘" }) === null).toBe(true);
    expect(panel(container)!.querySelector("h2") === null).toBe(true);
    expect(panel(container)!.querySelectorAll("button").length).toBe(0);
  });

  it("밤 중 chat 이벤트(마피아 자리 1 의 nightAgree) → 로그에 '하윤'·'동의해요'", () => {
    const em = emitter();
    scene(dead0(), { onEvent: em.onEvent });
    em.emit({ t: "chat", seq: 1, seat: 1, template: "nightAgree", at: NOW });
    const text = screen.getByRole("log", { name: "마피아 채팅(관전)" }).textContent ?? "";
    expect(text.includes("하윤") && text.includes("동의해요")).toBe(true);
  });

  it("낮 토론: 하단 '최근 채팅' 로그(빈 상태, ^ 있음) + .mf-ro, [빠른 메시지] 없음, 이름표 아랫줄 없음", () => {
    const { container } = scene(dead0({ phase: "discussion", spectate: { seats: spectate.seats } }));
    expect(within(screen.getByRole("log", { name: "최근 채팅" })).getByText("아직 메시지가 없어요") !== null).toBe(true);
    expect(screen.getByRole("button", { name: "채팅 내역 크게 보기" }) !== null).toBe(true);
    expect(panel(container)!.querySelector("p.mf-ro")?.textContent).toBe("탈락했어요 · 볼 수만 있어요");
    expect(screen.queryByRole("button", { name: "빠른 메시지" }) === null).toBe(true);
    expect(claimRowCount(container)).toBe(0);
    expect(container.querySelectorAll(".mf-dt__pick").length).toBe(0);
  });

  it("직업 공개(claim): 칩 줄이 없고 하단은 로그 + .mf-ro, 이름표 아랫줄이 하나도 없다 (결정 0023-3, 탈락·실제 직업 줄 포함)", () => {
    const { container } = scene(dead0({ phase: "claim", spectate: { seats: spectate.seats } }));
    expect(container.querySelectorAll(".mf-seg__b").length).toBe(0);
    expect(panel(container)!.querySelector("p.mf-ro") !== null).toBe(true);
    expect(panel(container)!.querySelector('[role="log"]') !== null).toBe(true);
    expect(claimRowCount(container)).toBe(0);
  });

  it("살아 있는 경찰 화면(dead [4], spectate 없음): 자리 4 는 유령 + 탈락 이름표, 관전 클래스·직업 그림이 렌더 HTML 에 없다", () => {
    const { container } = scene(makeView({ role: "police", dead: [4] }));
    expect(seatEl(container, 4)!.querySelector("img")?.getAttribute("src")).toContain("/characters/ghost/");
    expect(container.querySelector('.mf-dt__tag[data-seat="4"]')?.classList.contains("mf-dt__tag--dead")).toBe(true);
    expect(container.querySelectorAll('.mf-dt img[src*="/characters/roles/"]').length).toBe(0);
    const found = [".mf-dt__claim", ".mf-dt__pick--police", ".mf-dt__pick--doctor", ".mf-ro"].filter((sel) => container.querySelector(sel) !== null);
    expect(found.join(",")).toBe("");
  });

  it("탈락했지만 spectate 가 없는 view(옛 서버): 하단은 관전 하단, 이름표는 탈락 표시만(직업 그림 없음)", () => {
    const { container } = scene(makeView({ role: "citizen", dead: [0] }));
    expect(panel(container)!.querySelector("p.mf-ro") !== null).toBe(true);
    expect(screen.getByRole("log", { name: "마피아 채팅(관전)" }) !== null).toBe(true);
    expect(container.querySelector('.mf-dt__tag[data-seat="0"]')?.classList.contains("mf-dt__tag--dead")).toBe(true);
    expect(container.querySelectorAll('.mf-dt img[src*="/characters/roles/"]').length).toBe(0);
    expect(container.querySelectorAll(".mf-dt button").length).toBe(0);
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

describe("밤에는 기록 카드가 열리지 않는다 (03.1-08, D-06)", () => {
  const inspectBtns = (c: HTMLElement) => c.querySelectorAll(".mf-dt button.mf-dt__seat--inspect");
  const spectate: SpectateView = {
    seats: NAMES.map((_, seat) => ({ seat, job: "citizen" as const })),
    picks: { mafia: [], police: [], doctor: [] },
  };

  it("행동자(경찰·의사·마피아)는 기존 `… 대상` 버튼만 있고 `주장 기록 보기` 버튼은 없다", () => {
    for (const role of ["police", "doctor", "mafia"] as const) {
      const { container } = scene(makeView(role === "mafia" ? { role, allies: [1] } : { role }));
      expect(`${role}:${inspectBtns(container).length}`).toBe(`${role}:0`);
      expect(`${role}:${screen.queryAllByRole("button", { name: /주장 기록 보기/ }).length}`).toBe(`${role}:0`);
      expect(container.querySelectorAll(".mf-dt button.mf-dt__seat").length > 0).toBe(true);
      cleanup();
    }
    const { container } = scene(makeView({ role: "police" }));
    expect(screen.getByRole("button", { name: "하윤, 조사 대상" }) !== null).toBe(true);
    expect(container.querySelectorAll(".mf-dt button.mf-dt__seat").length).toBe(5);
  });

  it("시민·탈락한 viewer(관전자)의 자리는 버튼이 아니라 group 이다", () => {
    const citizen = scene(makeView({ role: "citizen" }));
    expect(citizen.container.querySelectorAll(".mf-dt button").length).toBe(0);
    expect(citizen.container.querySelectorAll('.mf-dt [role="group"][data-seat]').length).toBe(5);
    cleanup();
    const dead = scene(makeView({ role: "citizen", dead: [0], spectate }));
    expect(dead.container.querySelectorAll(".mf-dt button").length).toBe(0);
    expect(dead.container.querySelectorAll('.mf-dt [role="group"][data-seat]').length).toBe(5);
  });

  it("낮에 연 기록 카드는 밤이 되면 닫히고, 다시 낮이 되어도 다시 열리지 않는다", () => {
    const claimLog: ClaimLogEntry[] = [{ n: 1, seat: 1, claim: "police" }];
    const r = scene(makeView({ phase: "discussion", role: "citizen", claimLog }));
    fireEvent.click(screen.getByRole("button", { name: /^하윤, 주장 기록 보기$/ }));
    expect(r.container.querySelector('dialog[aria-label="하윤 기록"]') !== null).toBe(true);
    r.rerender(makeView({ phase: "night", role: "citizen", claimLog }));
    expect(r.container.querySelector("dialog") === null).toBe(true);
    expect(inspectBtns(r.container).length).toBe(0);
    r.rerender(makeView({ phase: "discussion", n: 2, role: "citizen", claimLog }));
    expect(r.container.querySelector("dialog") === null).toBe(true);
    expect(inspectBtns(r.container).length).toBe(5);
  });

  it("밤 행동자의 대상 버튼을 눌러도 기록 카드는 열리지 않고 pick 이 간다", () => {
    const r = scene(makeView({ role: "police" }));
    fireEvent.click(screen.getByRole("button", { name: "하윤, 조사 대상" }));
    expect(r.container.querySelector("dialog") === null).toBe(true);
    expect(sent(r.conn)).toContain('"t":"pick"');
  });
});

describe("관전자 테이블: 직업 캐릭터는 탈락한 본인에게만 (03.1-10, D-17·D-19, 결정 0021)", () => {
  const JOBS = ["citizen", "mafia", "citizen", "police", "doctor"] as const;
  const spectateOf = (): SpectateView => ({
    seats: JOBS.map((job, seat) => ({ seat, job })),
    picks: { mafia: [4], police: [1], doctor: [2] },
  });
  const roleSrc = (job: RoleId) => `/characters/roles/${job}_default%402x.png`;
  const imgOf = (c: HTMLElement, seat: number) => seatEl(c, seat)!.querySelector("img");
  const rolesImgs = (c: HTMLElement) => c.querySelectorAll('.mf-dt img[src*="/characters/roles/"]').length;
  /** 본인(0)이 탈락, 3 도 탈락. 살아 있는 다른 자리: 1 마피아·2 시민·4 의사 */
  const viewOf = (phase: PhaseId): RoomView => {
    const morning = phase === "morning" ? { morning: { eliminated: 3, phrase: 1 } } : {};
    const v = makeView({ phase, role: "citizen", dead: [0, 3], spectate: spectateOf() });
    if (v.day && morning.morning) v.day.morning = morning.morning;
    return v;
  };

  it("내가 탈락했고 spectate 가 있는 claim·discussion·night·morning: 살아 있는 다른 자리는 직업 캐릭터, 탈락한 자리(내 자리 포함)는 유령", () => {
    for (const phase of ["claim", "discussion", "night", "morning"] as const) {
      const { container } = scene(viewOf(phase));
      const got = [1, 2, 4].map((s) => imgOf(container, s)?.getAttribute("src")).join("|");
      expect(`${phase}:${got}`).toBe(`${phase}:${[roleSrc("mafia"), roleSrc("citizen"), roleSrc("doctor")].join("|")}`);
      expect(imgOf(container, 1)?.getAttribute("srcset")?.includes("%404x.png 2x")).toBe(true);
      expect(imgOf(container, 0)?.getAttribute("src")).toContain("/characters/ghost/");
      expect(imgOf(container, 3)?.getAttribute("src")).toContain("/characters/ghost/");
      cleanup();
    }
  });

  it("모든 이름표는 한 줄이고 .mf-dt__dot 이 있다. 살아 있는 다른 자리의 aria-label 은 `{닉네임}, {직업 이름}`", () => {
    const { container } = scene(viewOf("discussion"));
    expect(container.querySelectorAll(".mf-dt__claim").length).toBe(0);
    expect(container.querySelectorAll(".mf-dt__tag .mf-dt__dot").length).toBe(5);
    expect(seatEl(container, 1)!.getAttribute("aria-label")?.startsWith("하윤, 마피아")).toBe(true);
    expect(seatEl(container, 4)!.getAttribute("aria-label")?.startsWith("서연, 의사")).toBe(true);
  });

  it("마피아 직업 자리는 진홍 링·마름모(`마피아`)가 그대로이고 밤 표적 배지도 그대로다", () => {
    const { container } = scene(viewOf("night"));
    expect(seatEl(container, 1)!.querySelector(".mf-dt__ring--mate") !== null).toBe(true);
    expect(seatEl(container, 1)!.querySelector('[role="img"][aria-label="마피아"]') !== null).toBe(true);
    expect(seatEl(container, 4)!.querySelector('.mf-dt__pick--ally[role="img"]') !== null).toBe(true);
  });

  it("살아 있는 viewer: 4~8명, 낮·밤·아침 단계, 네 역할 모두 DayTable 안에 roles 그림이 0개", () => {
    for (const count of [4, 5, 6, 7, 8]) {
      for (const phase of ["claim", "discussion", "night", "morning"] as const) {
        for (const role of ["mafia", "police", "doctor", "citizen"] as const) {
          const v = makeView({ phase, role, ...(role === "mafia" ? { allies: [1] } : {}) });
          v.players = Array.from({ length: count }, (_, seat) => ({ seat, nickname: `P${seat}`, connected: true, isHost: seat === 0, alive: true }));
          const { container } = scene(v);
          expect(`${count}/${phase}/${role}:${rolesImgs(container)}`).toBe(`${count}/${phase}/${role}:0`);
          cleanup();
        }
      }
    }
  });

  it("마피아 viewer 의 동료 표시는 링·마름모뿐이고 직업 그림이 아니다", () => {
    const { container } = scene(makeView({ phase: "night", role: "mafia", allies: [1] }));
    expect(seatEl(container, 1)!.querySelector(".mf-dt__ring--mate") !== null).toBe(true);
    expect(rolesImgs(container)).toBe(0);
  });

  it("방어: me 가 살아 있는데 view.spectate 가 잘못 실려 있어도 roles 그림 0개", () => {
    for (const phase of ["claim", "discussion", "night", "morning"] as const) {
      const { container } = scene(makeView({ phase, role: "citizen", dead: [3], spectate: spectateOf() }));
      expect(`${phase}:${rolesImgs(container)}`).toBe(`${phase}:0`);
      expect(container.querySelector(".mf-dt__ring--mate") === null).toBe(true);
      cleanup();
    }
  });

  it("탈락했지만 spectate 가 없는 옛 서버 view: 유령 + 중립 인물, roles 그림 없음, 하단은 관전 하단", () => {
    const { container } = scene(makeView({ phase: "discussion", role: "citizen", dead: [0, 3] }));
    expect(rolesImgs(container)).toBe(0);
    expect(imgOf(container, 1)?.getAttribute("src")).toContain("/characters/");
    expect(imgOf(container, 0)?.getAttribute("src")).toContain("/characters/ghost/");
    expect(panel(container)!.querySelector("p.mf-ro") !== null).toBe(true);
  });

  it("관전자도 낮에 자리를 누르면 기록 카드(주장 기록만), 밤에는 어떤 자리도 눌리지 않는다", () => {
    const day = scene(viewOf("discussion"));
    fireEvent.click(within(day.container).getByRole("button", { name: /^하윤, 마피아, 주장 기록 보기$/ }));
    expect(day.container.querySelector('dialog[aria-label="하윤 기록"]') !== null).toBe(true);
    cleanup();
    const night = scene(viewOf("night"));
    expect(night.container.querySelectorAll(".mf-dt button").length).toBe(0);
  });

  it("reconnect: 처음부터 spectate 가 있는 view 로 마운트해도 직업 그림이 그려진다", () => {
    const { container } = scene(viewOf("discussion"));
    expect(rolesImgs(container)).toBe(3);
  });
});
