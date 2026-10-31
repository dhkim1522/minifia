/// <reference types="node" />
import { readFileSync } from "node:fs";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "../helpers/singleLineErrors";
import type { ChatLine, RoomView } from "../../shared/protocol";
import type { RoomConnection, RoomEvent } from "../../src/net/useRoomConnection";
import { TurnPanel } from "../../src/components/TurnPanel";

// 남의 차례 하단 완성형(03.1 UI-SPEC B, 시안 K2): 채팅 세 줄 + `{닉네임}님이 주장하는 중 · N초` + 44×44 이모티콘 버튼.
// 빠른 메시지 버튼은 없다. 서버와는 view 픽스처와 이벤트 발행기로만 만난다.

const NOW = 1_700_000_000_000;

function makeView(over: Partial<RoomView> = {}): RoomView {
  return {
    code: "0042",
    phase: "claim",
    phaseEndsAt: NOW + 5_000,
    phaseDurationMs: 8_000,
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
    day: { n: 1, roles: ["mafia", "police", "citizen"], turn: { seat: 2 }, claimLog: [] },
    ...over,
  };
}

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

const claimLine = (seq: number, seat: number, claimedRole?: ChatLine["claimedRole"]): ChatLine =>
  claimedRole !== undefined
    ? { seq, seat, template: "claimRole", claimedRole, at: 0 }
    : { seq, seat, template: "claimNone", at: 0 };

function panel(lines: ChatLine[] = [], over: Partial<RoomConnection> = {}, view: RoomView = makeView()) {
  const c = conn(view, over);
  const showToast = vi.fn();
  const utils = render(<TurnPanel view={view} connection={c} showToast={showToast} lines={lines} />);
  return { ...utils, conn: c, showToast };
}

const log = () => screen.getByRole("log", { name: "최근 채팅" });
const items = () => [...log().querySelectorAll<HTMLElement>(".mf-msglog__item")];
const emojiBtn = () => screen.getByRole("button", { name: "이모티콘" }) as HTMLButtonElement;
const dialog = (name: string) => document.querySelector<HTMLDialogElement>(`dialog[aria-label="${name}"]`);
const advance = (ms: number) =>
  act(() => {
    vi.advanceTimersByTime(ms);
  });

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("TurnPanel 구성 (UI-SPEC B 하단 — 남의 차례)", () => {
  it("채팅 로그(role=log, 최근 채팅) 아래에 .st-row(.stat + 이모티콘 버튼)가 있고 빠른 메시지 버튼은 없다", () => {
    const { container } = panel();
    const root = container.querySelector(".mf-turnpanel")!;
    expect(root.firstElementChild?.classList.contains("mf-msglog")).toBe(true);
    expect(root.lastElementChild?.classList.contains("st-row")).toBe(true);
    expect(log()).toBeTruthy();
    expect(root.querySelector(".st-row .stat")).not.toBeNull();
    expect(root.querySelectorAll(".st-row button").length).toBe(1);
    expect(screen.queryByRole("button", { name: "빠른 메시지" })).toBeNull();
  });

  it("stat: 굵은 `{닉네임}님이 주장하는 중` 과 오른쪽 `{N}초`(남은 시간 올림)", () => {
    const { container } = panel();
    expect(container.querySelector(".stat b")?.textContent).toBe("민지님이 주장하는 중");
    expect(container.querySelector(".stat span")?.textContent).toBe("5초");
    cleanup();
    const view = makeView({ phaseEndsAt: NOW + 4_200 });
    const other = panel([], {}, view);
    expect(other.container.querySelector(".stat span")?.textContent).toBe("5초");
  });

  it("닉네임에 `<` 가 있어도 글자로만 그린다 (T-03.1-47)", () => {
    const v = makeView();
    const evil = { ...v, players: v.players.map((p) => (p.seat === 2 ? { ...p, nickname: "<b>x</b>" } : p)) };
    const { container } = panel([claimLine(-1, 2, "police")], {}, evil);
    expect(container.querySelector(".stat b")?.textContent).toBe("<b>x</b>님이 주장하는 중");
    expect(container.querySelector(".stat b b")).toBeNull();
    expect(items()[0]!.querySelector(".mf-msglog__name")?.textContent).toBe("<b>x</b>");
    expect(container.querySelector(".mf-msglog b")).toBeNull();
  });

  it("이모티콘 버튼은 aria-label 이모티콘이고 CSS 에서 44×44 정사각이다", () => {
    panel();
    expect(emojiBtn().querySelectorAll("svg").length).toBe(1);
    const css = readFileSync("src/styles/day.css", "utf8");
    const rule = /\.st-row \.mf-btn\s*\{([^}]*)\}/.exec(css)?.[1] ?? "";
    expect(/width:\s*var\(--tap-min\)/.test(rule)).toBe(true);
    expect(/height:\s*var\(--tap-min\)/.test(rule)).toBe(true);
    expect(/\.mf-turnpanel\s*\{[^}]*flex-direction:\s*column/.test(css)).toBe(true);
  });

  it("마감이 없으면 초를 그리지 않는다", () => {
    const { container } = panel([], {}, makeView({ phaseEndsAt: null, phaseDurationMs: null }));
    expect(container.querySelector(".stat span")).toBeNull();
  });
});

describe("TurnPanel 채팅 (주장 줄 포함)", () => {
  const lines = [claimLine(-3, 1, "police"), claimLine(-2, 3), claimLine(-1, 0, "doctor"), { seq: 1, seat: 2, template: "innocent", at: 0 } as ChatLine];

  it("세 줄을 넘으면 최근 세 줄만 보이고 내 줄은 `나` 다", () => {
    panel(lines);
    expect(items().length).toBe(3);
    expect(items().map((el) => el.querySelector(".mf-msglog__name")?.textContent).join("|")).toBe("도현|나|민지");
    expect(items().map((el) => el.querySelector(".mf-msglog__text")?.textContent).join("|")).toBe("말하지 않았어요|저는 의사예요|저 아니에요");
  });

  it("^ 버튼(채팅 내역 크게 보기)을 누르면 채팅 내역 모달에 주장 줄을 포함한 전체 줄이 있다", () => {
    panel(lines);
    fireEvent.click(screen.getByRole("button", { name: "채팅 내역 크게 보기" }));
    const dlg = dialog("채팅 내역")!;
    const rows = [...dlg.querySelectorAll<HTMLElement>(".mf-msglog__item")];
    expect(rows.length).toBe(4);
    expect(rows[0]!.querySelector(".mf-msglog__text")?.textContent).toBe("저는 경찰이에요");
  });
});

describe("TurnPanel 이모티콘 (합산 쿨다운 훅 공용)", () => {
  it("버튼 → 트레이가 열리고 이모티콘을 고르면 { t:'emoji', icon } 를 보내며 버튼이 2초 잠긴다", () => {
    const { conn: c } = panel();
    fireEvent.click(emojiBtn());
    expect(dialog("이모티콘")).not.toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "좋아요" }));
    expect(c.send).toHaveBeenCalledTimes(1);
    expect(c.send).toHaveBeenCalledWith({ t: "emoji", icon: "heart" });
    expect(emojiBtn().disabled).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "웃음" }));
    expect(c.send).toHaveBeenCalledTimes(1);
    advance(1_999);
    expect(emojiBtn().disabled).toBe(true);
    advance(1);
    expect(emojiBtn().disabled).toBe(false);
  });

  it("서버 RATE_LIMITED 는 표시 없이 다시 2초 잠그고 BAD_MESSAGE 는 토스트를 부른다", () => {
    const ev = emitter();
    const { showToast } = panel([], { onEvent: ev.onEvent });
    expect(emojiBtn().disabled).toBe(false);
    ev.emit({ t: "error", code: "RATE_LIMITED" });
    expect(emojiBtn().disabled).toBe(true);
    expect(showToast).not.toHaveBeenCalled();
    advance(2_000);
    expect(emojiBtn().disabled).toBe(false);
    ev.emit({ t: "error", code: "BAD_MESSAGE" });
    expect(showToast).toHaveBeenCalledWith("보내지 못했어요. 다시 시도해 주세요");
  });

  it("canSend 가 false 면 버튼이 disabled 다", () => {
    panel([], { canSend: false });
    expect(emojiBtn().disabled).toBe(true);
  });

  it("단계가 바뀌어 언마운트되면 열려 있던 트레이도 닫힌다", () => {
    const { unmount } = panel();
    fireEvent.click(emojiBtn());
    expect(dialog("이모티콘")).not.toBeNull();
    unmount();
    expect(dialog("이모티콘")).toBeNull();
  });
});

describe("TurnPanel 은 공개 정보만 쓴다", () => {
  it("로그 안에 직업 글자 외의 역할 정보가 없다 — 줄은 받은 lines 로만 그린다", () => {
    panel([claimLine(-1, 1, "mafia")]);
    expect(within(log()).getByText("저는 마피아예요")).toBeTruthy();
  });
});
