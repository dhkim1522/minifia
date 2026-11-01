/// <reference types="node" />
import { readFileSync } from "node:fs";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "../helpers/singleLineErrors";
import type { RoomView } from "../../shared/protocol";
import type { RoomConnection } from "../../src/net/useRoomConnection";
import { VERDICT_BLUR_PX, VERDICT_DIM_PERCENT, defenseStartLine } from "../../src/game/verdict";

// RoomScreen 한 경로용: 연결 훅만 가짜로 바꾼다.
const connectionMock = vi.hoisted(() => ({ current: null as unknown }));
vi.mock("../../src/net/useRoomConnection", () => ({
  useRoomConnection: () => connectionMock.current,
}));
const { RoomScreen } = await import("../../src/screens/RoomScreen");

// 최후 변론(defense) 04-21, 07-15 개정: 하단은 후보 포함 살아 있는 모두에게 ChatPanel(채널 all), 탈락자에게 ChatPanel(ghost)이다(CHAT-01·03, 결정 0053).
// 후보 상태 줄("{닉네임}님이 변론하는 중 · N초")은 없어지고 기록 첫 줄 시스템 줄과 헤더 타이머가 대신한다. 서버와는 view 픽스처로만 만난다.

const NOW = 1_700_000_000_000;

function makeView(over: Partial<RoomView> = {}): RoomView {
  return {
    code: "0042",
    phase: "defense",
    phaseEndsAt: NOW + 10_000,
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
    me: { seat: 0, isHost: true },
    day: { n: 1, roles: ["mafia", "police", "citizen"], candidate: 2 },
    ...over,
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

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

// ---- Task 3: RoomScreen 한 경로 (defense 연결) ----
const FILL: Partial<RoomView> = {};

function roomView(o: { me?: number; candidate?: number | null; dead?: number[]; disconnected?: number[]; mafia?: number[]; players?: number; spectate?: number[] } = {}): RoomView {
  const base = makeView();
  const names = ["지우", "하윤", "민지", "도현", "서연", "다온"];
  const count = o.players ?? 4;
  const me = o.me ?? 0;
  const dead = o.dead ?? [];
  const view: RoomView = {
    ...base,
    ...FILL,
    players: Array.from({ length: count }, (_, seat) => ({
      seat,
      nickname: names[seat] ?? `사람${seat}`,
      connected: !(o.disconnected ?? []).includes(seat),
      isHost: seat === 0,
      ...(dead.includes(seat) ? { alive: false } : {}),
    })),
    me: { seat: me, isHost: me === 0, role: o.mafia ? "mafia" : "citizen", chat: dead.includes(me) ? "ghost" : "all" },
    day: {
      n: 1,
      roles: ["mafia", "police", "citizen"],
      ...(o.candidate === null ? {} : { candidate: o.candidate ?? 2 }),
    },
  };
  if (o.mafia && dead.includes(me)) {
    view.spectate = { seats: o.mafia.map((seat) => ({ seat, job: "mafia" as const })) };
  } else if (o.mafia) {
    view.me.allies = o.mafia.filter((s) => s !== me);
  }
  return view;
}

function renderRoom(view: RoomView, over: Partial<RoomConnection> = {}) {
  connectionMock.current = conn(view, over);
  const r = render(<RoomScreen code="0042" token={"t".repeat(43)} onExit={vi.fn()} />);
  const rerenderRoom = (v: RoomView, o: Partial<RoomConnection> = over) => {
    connectionMock.current = conn(v, o);
    r.rerender(<RoomScreen code="0042" token={"t".repeat(43)} onExit={vi.fn()} />);
  };
  return { ...r, rerenderRoom, send: (connectionMock.current as RoomConnection).send as ReturnType<typeof vi.fn> };
}

const panelOf = (c: HTMLElement) => c.querySelector<HTMLElement>(".mf-dayscene__panel")!;
const seatOf = (c: HTMLElement, n: number) => c.querySelector<HTMLElement>(`.mf-dt__seat[data-seat="${n}"]`)!;
const haloSeats = (c: HTMLElement, kind: "white" | "crimson") =>
  Array.from(c.querySelectorAll<HTMLElement>(`img.mf-figure--halo-${kind}`))
    .map((img) => img.closest<HTMLElement>(".mf-dt__seat")!.dataset.seat)
    .join(",");
const announce = (c: HTMLElement) => c.querySelector<HTMLElement>(".mf-room > p.mf-sr-only[aria-live]")?.textContent;

describe("defense 화면 한 경로 (VOTE-03, D-15·D-16·D-29, COMM-03)", () => {
  it("남의 변론: 헤더 `낮 · 최후 변론`/`1일차 · 민지님의 변론`, 후보 center·흰 후광 하나, 어둡게 층 하나, 원뿔 하나, 하단 ChatPanel(all), 안내 `민지님의 최후 변론`", () => {
    const { container } = renderRoom(roomView());
    expect(screen.queryByText("연결 중…")).toBeNull();
    expect(screen.queryByRole("heading", { name: "낮 · 최후 변론" })).not.toBeNull();
    expect(screen.queryByText("1일차 · 민지님의 변론")).not.toBeNull();
    expect(container.querySelector(".mf-dayscene")?.classList.contains("mf-dayscene--verdict")).toBe(true);
    expect(haloSeats(container, "white")).toBe("2");
    expect(container.querySelectorAll('img[class*="mf-figure--halo"]').length).toBe(1);
    expect(seatOf(container, 2).style.zIndex).toBe("31");
    expect(container.querySelectorAll(".mf-dt__dim--verdict").length).toBe(1);
    expect(container.querySelectorAll(".mf-dt__cone").length).toBe(1);
    const chatPanel = panelOf(container).querySelector("[data-chat-panel]");
    expect(chatPanel?.getAttribute("data-chat-channel")).toBe("all");
    expect(panelOf(container).querySelector("[data-chat-input]")?.getAttribute("aria-label")).toBe("채팅 입력");
    expect(panelOf(container).classList.contains("mf-dayscene__panel--chat")).toBe(true);
    // 옛 상태 줄(`~님이 변론하는 중 · N초`)은 없다: 남은 시간은 헤더 타이머만 보인다
    expect(panelOf(container).querySelector(".st-row, .stat")).toBeNull();
    expect(announce(container)).toBe("민지님의 최후 변론");
  });

  it("어둡게 45%·흐림 3px 는 VERDICT_DIM_PERCENT·VERDICT_BLUR_PX 에서만 온다(화면 파일에 숫자를 쓰지 않는다)", () => {
    const { container } = renderRoom(roomView());
    const dim = container.querySelector<HTMLElement>(".mf-dt__dim--verdict")!;
    expect(dim.style.getPropertyValue("--mf-verdict-dim")).toBe(`${VERDICT_DIM_PERCENT}%`);
    expect(dim.style.getPropertyValue("--mf-verdict-blur")).toBe(`${VERDICT_BLUR_PX}px`);
    const src = readFileSync("src/screens/verdictScene.tsx", "utf8");
    expect(src).toContain("VERDICT_DIM_PERCENT");
    expect(src).toContain("VERDICT_BLUR_PX");
    expect(/dimPercent:\s*\d|blurPx:\s*\d/.test(src)).toBe(false);
  });

  it("후보 본인도 같은 ChatPanel(all)을 쓴다 — 후보만 말하기 제한이 없다. 안내 `1일차 · 내 변론`, 칩·버튼은 보내기뿐, 안내문 `내 최후 변론`", () => {
    const { container, send } = renderRoom(roomView({ me: 2 }));
    expect(screen.queryByText("1일차 · 내 변론")).not.toBeNull();
    const section = panelOf(container);
    expect(section.tagName).toBe("SECTION");
    expect(section.querySelector("[data-chat-panel]")?.getAttribute("data-chat-channel")).toBe("all");
    expect(section.querySelector(".mf-turnpanel")).toBeNull();
    expect(section.querySelector("h2")).toBeNull();
    expect(section.querySelector(".mf-defchips")).toBeNull();
    expect(section.querySelector(".mf-msglog")).toBeNull();
    expect([...section.querySelectorAll("button")].map((b) => b.getAttribute("aria-label"))).toEqual(["보내기"]);
    expect(section.querySelectorAll("input").length).toBe(1);
    expect(send).not.toHaveBeenCalled();
    expect(haloSeats(container, "white")).toBe("2");
    expect(announce(container)).toBe("내 최후 변론");
  });

  it("변론 하단에서 보낸 글은 변론 단계 키(1:defense)와 본문만 서버로 간다", () => {
    const { container, send } = renderRoom(roomView({ me: 2 }));
    const input = container.querySelector<HTMLInputElement>("[data-chat-input]")!;
    fireEvent.change(input, { target: { value: "저는 시민이에요" } });
    fireEvent.submit(input.closest("form")!);
    // 입력 중 신호(typing)는 07-18 부터 글을 넣을 때 따로 나간다 — 채팅 메시지만 가려 본다.
    expect(send.mock.calls.map((c) => c[0]).filter((m) => m.t === "chat")).toEqual([{ t: "chat", text: "저는 시민이에요", pk: "1:defense" }]);
  });

  it("후보 본인 화면에서도 가운데 이동·어둡게 층·원뿔은 그대로다", () => {
    const { container } = renderRoom(roomView({ me: 2 }));
    expect(container.querySelector(".mf-dayscene")?.classList.contains("mf-dayscene--verdict")).toBe(true);
    expect(container.querySelectorAll(".mf-dt__dim--verdict").length).toBe(1);
    expect(container.querySelectorAll(".mf-dt__cone").length).toBe(1);
    expect(seatOf(container, 2).style.zIndex).toBe("31");
  });

  it("변론으로 넘어오는 렌더에 point 아이콘 + `민지 님이 변론하는 중` 시스템 줄이 기록 첫 줄로 한 번 생긴다(같은 변론을 다시 그려도 늘지 않는다)", () => {
    const r = renderRoom({ ...roomView(), phase: "candidateVoteReveal" });
    expect(r.container.querySelector("[data-chat-log]")).toBeNull();
    r.rerenderRoom(roomView());
    const sys = () => [...r.container.querySelectorAll("[data-chat-log] > p.mv-chat__sys")];
    expect(sys().map((p) => p.textContent?.trim())).toEqual(["민지 님이 변론하는 중"]);
    expect(sys()[0]?.querySelector("svg path")?.getAttribute("d")?.startsWith("M3 9.5")).toBe(true);
    expect(defenseStartLine("민지", true)).toBe("민지 님이 변론하는 중");
    r.rerenderRoom({ ...roomView(), serverNow: NOW + 500 });
    expect(sys().length).toBe(1);
    // 변론 시작 줄은 후보 본인 화면에도 같은 문장이다
    const mine = renderRoom({ ...roomView({ me: 2 }), phase: "candidateVoteReveal" });
    mine.rerenderRoom(roomView({ me: 2 }));
    expect([...mine.container.querySelectorAll("[data-chat-log] > p.mv-chat__sys")].map((p) => p.textContent?.trim())).toEqual(["민지 님이 변론하는 중"]);
  });

  it("후보가 연결이 끊긴 채 변론이 시작되면 `민지 님은 연결이 끊겨 있어요` 한 줄이고, 재접속으로 처음 받은 변론 view 에는 시작 줄이 없다", () => {
    const r = renderRoom({ ...roomView({ disconnected: [2] }), phase: "candidateVoteReveal" });
    r.rerenderRoom(roomView({ disconnected: [2] }));
    expect([...r.container.querySelectorAll("[data-chat-log] > p.mv-chat__sys")].map((p) => p.textContent?.trim())).toEqual(["민지 님은 연결이 끊겨 있어요"]);
    expect(defenseStartLine("민지", false)).toBe("민지 님은 연결이 끊겨 있어요");
    cleanup();
    // 재접속: 처음부터 변론 view 로 마운트 / 연결 epoch 가 바뀌며 변론 view 를 받음 → 시작 줄 없음
    const fresh = renderRoom(roomView());
    expect(fresh.container.querySelectorAll("[data-chat-log] > p.mv-chat__sys").length).toBe(0);
    cleanup();
    const re = renderRoom({ ...roomView(), phase: "candidateVoteReveal" });
    re.rerenderRoom(roomView(), { epoch: 2 });
    expect(re.container.querySelectorAll("[data-chat-log] > p.mv-chat__sys").length).toBe(0);
  });

  it("탈락 viewer: 하단은 ChatPanel(ghost) — 관전 알약이 아니다. 좌석은 버튼이 아니다(기록 카드 열림 없음)", () => {
    const { container } = renderRoom(roomView({ me: 1, dead: [1] }));
    expect(panelOf(container).querySelector("[data-chat-panel]")?.getAttribute("data-chat-channel")).toBe("ghost");
    expect(panelOf(container).querySelector("[data-chat-input]")?.getAttribute("aria-label")).toBe("유령 채팅 입력");
    expect(panelOf(container).querySelector(".mf-ro")).toBeNull();
    expect(panelOf(container).querySelector(".st-row")).toBeNull();
    expect(container.querySelectorAll("button.mf-dt__seat").length).toBe(0);
    fireEvent.click(seatOf(container, 3));
    expect(document.querySelector("dialog")).toBeNull();
  });

  it("서버 채널이 없는 탈락 view(옛 서버)는 패널 없이 관전 알약으로 안전하게 그린다", () => {
    const view = roomView({ me: 1, dead: [1] });
    const { chat: _chat, ...me } = view.me;
    const { container } = renderRoom({ ...view, me });
    expect(container.querySelector("[data-chat-panel]")).toBeNull();
    expect(panelOf(container).querySelector(".mf-ro")?.textContent).toBe("관전 중 · 볼 수만 있어요");
  });

  it("살아 있는 viewer 의 좌석도 버튼이 아니다 — 누를 수 없다", () => {
    const { container } = renderRoom(roomView());
    expect(container.querySelectorAll("button.mf-dt__seat").length).toBe(0);
    expect(container.querySelectorAll(".mf-dt__seat[role='group']").length).toBe(4);
  });

  it("후보 연결 끊김: 그림은 끊김 흐림 + 흰 후광", () => {
    const { container } = renderRoom(roomView({ disconnected: [2] }));
    const img = seatOf(container, 2).querySelector("img")!;
    expect(img.classList.contains("mf-figure--disconnected")).toBe(true);
    expect(img.classList.contains("mf-figure--halo-white")).toBe(true);
  });

  it("마피아 동료의 진홍 후광은 유지되고(후보 흰 + 동료 진홍), 합이 3 을 넘으면 진홍부터 꺼지며 마름모는 남는다", () => {
    // 살아 있는 마피아: 후보 흰 1 + 동료 진홍 1 = 2
    const a = renderRoom(roomView({ me: 0, mafia: [0, 1] }));
    expect(haloSeats(a.container, "white")).toBe("2");
    expect(haloSeats(a.container, "crimson")).toBe("1");
    cleanup();
    // 관전자가 마피아 셋을 보면 흰 1 + 진홍 3 = 4 → 진홍 하나가 꺼진다(번호가 큰 쪽부터), 마름모 셋은 남는다
    const b = renderRoom(roomView({ me: 0, dead: [0], players: 6, mafia: [1, 3, 4] }));
    expect(haloSeats(b.container, "white")).toBe("2");
    expect(b.container.querySelectorAll('img[class*="mf-figure--halo"]').length).toBe(3);
    expect(haloSeats(b.container, "crimson")).toBe("1,3");
    expect(b.container.querySelectorAll(".mf-dt__mark").length).toBe(3);
  });

  it("candidateVoteReveal → defense 에서 테이블(.mf-dt)과 장면 래퍼는 같은 DOM 노드다. 후보 좌석 좌표만 가운데로 바뀐다", () => {
    const r = renderRoom({ ...roomView(), phase: "candidateVoteReveal" });
    const scene = r.container.querySelector(".mf-phase-enter");
    const table = r.container.querySelector(".mf-dt");
    const before = seatOf(r.container, 2).style.top;
    expect(r.container.querySelector(".mf-dayscene")?.classList.contains("mf-dayscene--verdict")).toBe(false);
    expect(r.container.querySelectorAll(".mf-dt__dim--verdict, .mf-dt__cone").length).toBe(0);
    r.rerenderRoom(roomView());
    expect(r.container.querySelector(".mf-phase-enter") === scene).toBe(true);
    expect(r.container.querySelector(".mf-dt") === table).toBe(true);
    expect(seatOf(r.container, 2).style.top).not.toBe(before);
    expect(r.container.querySelector(".mf-dt")?.classList.contains("mf-dt--verdict")).toBe(true);
  });

  it("서버 이상(candidate 없음): center·층 없이 NightPanel 로 안전하게 그린다", () => {
    const { container } = renderRoom(roomView({ candidate: null }));
    expect(container.querySelectorAll(".mf-dt__dim--verdict, .mf-dt__cone").length).toBe(0);
    expect(container.querySelector(".mf-dayscene")?.classList.contains("mf-dayscene--verdict")).toBe(false);
    expect(panelOf(container).querySelector("h2")).not.toBeNull();
    expect(container.querySelectorAll(".mf-dt__seat").length).toBe(4);
  });

  it("변론 장면에는 말풍선·이모티콘 층과 하단 채팅 줄이 없다(CHAT-06)", () => {
    const { container } = renderRoom(roomView());
    expect(container.querySelectorAll(".mf-dt__bubble, .mf-dt__emoji").length).toBe(0);
    expect(panelOf(container).querySelector(".mf-msglog")).toBeNull();
  });

  it("후보 위치 공식은 candidateCenter 한 곳이다 — DayTable 은 좌표 숫자를 따로 갖지 않는다", () => {
    const src = readFileSync("src/components/DayTable.tsx", "utf8");
    expect(src).toContain("candidateCenter");
    expect(/\+\s*80\b|-\s*34\b/.test(src)).toBe(false);
  });
});
