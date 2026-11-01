/// <reference types="node" />
import { readFileSync } from "node:fs";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "../helpers/singleLineErrors";
import type { ChatChannel, PhaseId, RoomView } from "../../shared/protocol";
import type { RoomConnection, RoomEvent } from "../../src/net/useRoomConnection";
import { DayScene } from "../../src/screens/DayScene";
import { ChatStore } from "../../src/net/chatStore";

// 낮 토론 화면 통합 테스트(S-07): 위쪽 바와 하단 채팅 패널을 DayScene 으로 만난다. 빠른 메시지·이모티콘·채팅 세 줄 로그·말풍선은 07-07 에서 화면에서 사라졌다(CHAT-06).
// 낮 토론 하단은 07-15 부터 ChatPanel(채널 all)이다. 서버와는 view 픽스처와 이벤트 발행기로만 만난다.

const NOW = 10_000;

interface ViewOpts {
  phase?: PhaseId;
  n?: number;
  isHost?: boolean;
  endsIn?: number;
  durationMs?: number;
  serverNow?: number;
  /** 화면이 방장 여부를 players 에서 읽지 않는지 보려고 players 쪽 isHost 를 따로 줄 수 있다 */
  playerHostSeat?: number;
  /** 서버가 보낸 내 채널(view.me.chat). 없으면 키가 없다 */
  chat?: ChatChannel;
}

function makeView(o: ViewOpts = {}): RoomView {
  const serverNow = o.serverNow ?? NOW;
  const hostSeat = o.playerHostSeat ?? 0;
  return {
    code: "0042",
    phase: o.phase ?? "discussion",
    phaseEndsAt: serverNow + (o.endsIn ?? 90_000),
    phaseDurationMs: o.durationMs ?? 90_000,
    serverNow,
    minPlayers: 4,
    maxPlayers: 8,
    players: [
      { seat: 0, nickname: "지우", connected: true, isHost: hostSeat === 0 },
      { seat: 1, nickname: "하윤", connected: true, isHost: hostSeat === 1 },
      { seat: 2, nickname: "민지", connected: true, isHost: hostSeat === 2 },
      { seat: 3, nickname: "도현", connected: true, isHost: hostSeat === 3 },
    ],
    me: { seat: 0, isHost: o.isHost ?? false, ...(o.chat !== undefined ? { chat: o.chat } : {}) },
    day: {
      n: o.n ?? 1,
      roles: ["mafia", "police", "citizen"],
    },
  };
}

/** 서버 error 프레임을 흉내 내는 발행기 */
function emitter() {
  const listeners = new Set<(e: RoomEvent, meta: { epoch: number }) => void>();
  return {
    onEvent: (l: (e: RoomEvent, meta: { epoch: number }) => void) => {
      listeners.add(l);
      return () => {
        listeners.delete(l);
      };
    },
    emit: (e: RoomEvent) =>
      act(() => {
        for (const l of [...listeners]) l(e, { epoch: 1 });
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
  const chat = new ChatStore();
  const role = <button type="button">내 역할</button>;
  const utils = render(<DayScene view={view} connection={c} chat={chat} myRoleButton={role} />);
  const rerender = (v: RoomView) => utils.rerender(<DayScene view={v} connection={{ ...c, view: v }} chat={chat} myRoleButton={role} />);
  return { ...utils, rerender, conn: c };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const advance = (ms: number) =>
  act(() => {
    vi.advanceTimersByTime(ms);
  });

describe("낮 토론 화면 — 위쪽 바와 하단 (CHAT-06, 가정 A1)", () => {
  it("위쪽 바(낮 · 토론, 1일차, 타이머)가 있고, 빠른 메시지·이모티콘 버튼·채팅 로그·방장 줄이 없다", () => {
    const r = scene(makeView());
    expect(r.container.textContent).toContain("낮 · 토론");
    expect(r.container.textContent).toContain("1일차");
    expect(screen.getByRole("timer").textContent).toBe("1:30");
    expect(screen.queryByRole("button", { name: "빠른 메시지" })).toBeNull();
    expect(screen.queryByRole("button", { name: "이모티콘" })).toBeNull();
    expect(screen.queryByRole("button", { name: "채팅 내역 크게 보기" })).toBeNull();
    expect(screen.queryByRole("log")).toBeNull();
    expect(screen.queryByRole("button", { name: /\+30초 연장/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /넘기기/ })).toBeNull();
  });

  it("서버가 채널(me.chat)을 보내지 않은 view 에서는 하단에 패널이 없고(서버 값이 기준) 머리 위에 말풍선·이모티콘 층도 없다", () => {
    const r = scene(makeView());
    const panel = r.container.querySelector(".mf-dayscene__panel")!;
    expect(panel.querySelectorAll("button, input, textarea, dialog").length).toBe(0);
    expect(r.container.querySelectorAll(".mf-dt__bubble, .mf-dt__emoji").length).toBe(0);
    expect(panel.classList.contains("mf-dayscene__panel--chat")).toBe(false);
  });

  it("산 사람의 낮 토론 하단은 ChatPanel(채널 all)이다: 입력칸 '채팅 입력', 안내 문구·채널 아이콘 없음, 기록 칸 role=log", () => {
    const r = scene(makeView({ chat: "all" }));
    const panel = r.container.querySelector<HTMLElement>(".mf-dayscene__panel")!;
    const chatPanel = panel.querySelector<HTMLElement>("[data-chat-panel]");
    expect(chatPanel?.getAttribute("data-chat-channel")).toBe("all");
    const input = panel.querySelector<HTMLInputElement>("[data-chat-input]")!;
    expect(input.getAttribute("aria-label")).toBe("채팅 입력");
    expect(input.getAttribute("placeholder") ?? "").toBe("");
    expect(panel.querySelector(".mv-chat__chan")).toBeNull();
    expect(screen.getByRole("log", { name: "채팅 기록" })).not.toBeNull();
    expect(panel.querySelector("[data-chat-send]")?.getAttribute("aria-label")).toBe("보내기");
  });

  it("채팅 패널이 붙은 하단은 --mf-chat-panel-h(LOG_H + 92)를 갖고 chat 변형 클래스가 붙는다", () => {
    const r = scene(makeView({ chat: "all" }));
    const panel = r.container.querySelector<HTMLElement>(".mf-dayscene__panel")!;
    expect(panel.classList.contains("mf-dayscene__panel--chat")).toBe(true);
    const logH = Number.parseFloat(panel.querySelector<HTMLElement>("[data-chat-log]")!.style.height);
    expect([96, 152]).toContain(logH);
    expect(panel.style.getPropertyValue("--mf-chat-panel-h")).toBe(`${logH + 92}px`);
    const css = readFileSync("src/styles/day.css", "utf8");
    expect(css).toMatch(/\.mf-dayscene__panel\.mf-dayscene__panel--chat\s*\{[^}]*--mf-chat-panel-h/);
  });

  it("보낸 줄은 pk(1:discussion)와 본문만 서버로 가고, 서버가 방송한 줄이 기록 칸에 나타난다", () => {
    const view = makeView({ chat: "all" });
    const c = conn(view);
    const chat = new ChatStore();
    render(<DayScene view={view} connection={c} chat={chat} myRoleButton={<button type="button">내 역할</button>} />);
    const input = document.querySelector<HTMLInputElement>("[data-chat-input]")!;
    fireEvent.change(input, { target: { value: "저는 시민이에요" } });
    fireEvent.submit(input.closest("form")!);
    expect((c.send as ReturnType<typeof vi.fn>).mock.calls[0]?.[0]).toEqual({ t: "chat", text: "저는 시민이에요", pk: "1:discussion" });
    // 내 줄은 서버 방송이 와야 나타난다
    expect(document.querySelector("[data-chat-log] .mv-chat__msg")).toBeNull();
    act(() => chat.apply({ t: "chat", seat: 0, ch: "all", seq: 1, text: "저는 시민이에요", at: NOW }, 1, NOW));
    const line = document.querySelector("[data-chat-log] .mv-chat__msg");
    expect(line?.getAttribute("data-ch")).toBe("all");
    expect(line?.querySelector(".mv-chat__name")?.textContent).toBe("나");
  });

  it("화면은 낮 토론에서 아무것도 보내지 않는다(say·emoji·extend·skip)", () => {
    const r = scene(makeView({ isHost: true }));
    const labels = [...r.container.querySelectorAll("button")].map((b) => b.textContent ?? "").join("|");
    expect(/\+30초 연장|넘기기|이미 연장했어요|빠른 메시지/.test(labels)).toBe(false);
    expect(r.container.querySelectorAll(".mf-discuss__host").length).toBe(0);
    expect((r.conn.send as ReturnType<typeof vi.fn>).mock.calls.length).toBe(0);
  });

  it("옛 서버의 오류 프레임(BAD_MESSAGE·RATE_LIMITED)을 낮 토론 화면이 토스트로 그리지 않는다", () => {
    const ev = emitter();
    scene(makeView(), { onEvent: ev.onEvent });
    ev.emit({ t: "error", code: "BAD_MESSAGE" });
    ev.emit({ t: "error", code: "RATE_LIMITED" });
    advance(100);
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("다음 낮 발표(dayAnnounce) view 로 바뀌어도 하단·시트가 문서에 남지 않는다", () => {
    const r = scene(makeView());
    r.rerender(makeView({ phase: "dayAnnounce", n: 2 }));
    expect(document.querySelector("dialog")).toBeNull();
    expect(screen.queryByRole("log")).toBeNull();
  });

  it("낮 화면 토스트는 타이머를 가리지 않도록 top 을 덮어쓴다(CSS)", () => {
    const css = readFileSync("src/styles/day.css", "utf8");
    expect(css).toMatch(/\.mf-dayscene[^{]*\.mf-toast--top\s*\{[^}]*space-3xl[^}]*\}/);
  });

  it("지운 부품의 CSS(.mf-msglog·.mf-chatlog·.mf-discuss·.mf-sheet--chat)가 day.css 에 없다", () => {
    const css = readFileSync("src/styles/day.css", "utf8");
    expect(/mf-msglog|mf-chatlog|mf-discuss|mf-sheet--chat/.test(css)).toBe(false);
  });
});

describe("낮 토론 화면 — 방장 전용 줄 없음 (결정 0017-5, DAY-01)", () => {
  it("방장(me.isHost true)에게도 연장·넘기기 버튼이 없고, 화면은 extend·skip 을 보내지 않는다 (결정 0017-5)", () => {
    const r = scene(makeView({ isHost: true }));
    const labels = [...r.container.querySelectorAll("button")].map((b) => b.textContent ?? "").join("|");
    expect(/\+30초 연장|넘기기|이미 연장했어요/.test(labels)).toBe(false);
    expect(r.container.querySelectorAll(".mf-discuss__host").length).toBe(0);
    const sentTypes = (r.conn.send as ReturnType<typeof vi.fn>).mock.calls.map((c) => (c[0] as { t: string }).t);
    expect(sentTypes.filter((t) => t === "extend" || t === "skip").length).toBe(0);
  });

  it("view 가 바뀌어도 '방장이 30초를 늘렸어요' 토스트가 없다", () => {
    const r = scene(makeView({ isHost: true }));
    // 옛 서버가 보내던 연장 표시를 키로만 넣는다(타입 선언에 기대지 않는다)
    const old = makeView({ isHost: true, endsIn: 115_000, durationMs: 120_000 });
    r.rerender({ ...old, day: { ...old.day!, extendUsed: true } } as unknown as RoomView);
    advance(100);
    expect(screen.queryAllByRole("status").length).toBe(0);
    expect(r.container.textContent).not.toContain("30초를 늘렸어요");
  });
});
