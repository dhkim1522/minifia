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

  it("변론 하단에서 보낸 글은 변론 단계 키(1:defense)와 본문만 서버로 간다", () => {
    const { container, send } = renderRoom(roomView({ me: 2 }));
    const input = container.querySelector<HTMLInputElement>("[data-chat-input]")!;
    fireEvent.change(input, { target: { value: "저는 시민이에요" } });
    fireEvent.submit(input.closest("form")!);
    // 입력 중 신호(typing)는 07-18 부터 글을 넣을 때 따로 나간다 — 채팅 메시지만 가려 본다.
    expect(send.mock.calls.map((c) => c[0]).filter((m) => m.t === "chat")).toEqual([{ t: "chat", text: "저는 시민이에요", pk: "1:defense" }]);
  });

  it("후보 위치 공식은 candidateCenter 한 곳이다 — DayTable 은 좌표 숫자를 따로 갖지 않는다", () => {
    const src = readFileSync("src/components/DayTable.tsx", "utf8");
    expect(src).toContain("candidateCenter");
    expect(/\+\s*80\b|-\s*34\b/.test(src)).toBe(false);
  });
});
