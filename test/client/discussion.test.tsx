/// <reference types="node" />
import { readFileSync } from "node:fs";
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "../helpers/singleLineErrors";
import type { PhaseId, RoomView } from "../../shared/protocol";
import type { RoomConnection, RoomEvent } from "../../src/net/useRoomConnection";
import { DayScene } from "../../src/screens/DayScene";

// 낮 토론 화면 통합 테스트(S-07): 위쪽 바와 빈 하단을 DayScene 으로 만난다. 빠른 메시지·이모티콘·채팅 세 줄 로그·말풍선은 07-07 에서 화면에서 사라졌다(CHAT-06).
// 채팅 패널은 07-13·07-15 가 붙인다. 서버와는 view 픽스처와 이벤트 발행기로만 만난다.

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
    me: { seat: 0, isHost: o.isHost ?? false },
    day: {
      n: o.n ?? 1,
      roles: ["mafia", "police", "citizen"],
      claimLog: [],
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
  const role = <button type="button">내 역할</button>;
  const utils = render(<DayScene view={view} connection={c} myRoleButton={role} />);
  const rerender = (v: RoomView) => utils.rerender(<DayScene view={v} connection={{ ...c, view: v }} myRoleButton={role} />);
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

describe("낮 토론 화면 — 위쪽 바와 빈 하단 (CHAT-06, 가정 A1)", () => {
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

  it("하단 패널에 버튼·입력이 없고 머리 위에 말풍선·이모티콘 층이 없다", () => {
    const r = scene(makeView());
    const panel = r.container.querySelector(".mf-dayscene__panel")!;
    expect(panel.querySelectorAll("button, input, textarea, dialog").length).toBe(0);
    expect(r.container.querySelectorAll(".mf-dt__bubble, .mf-dt__emoji").length).toBe(0);
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
