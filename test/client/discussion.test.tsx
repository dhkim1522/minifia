import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "../helpers/singleLineErrors";
import type { ChatLine, PhaseId, RoomView } from "../../shared/protocol";
import { seatLayout } from "../../shared/seatLayout";
import type { RoomConnection, RoomEvent } from "../../src/net/useRoomConnection";
import { DayScene } from "../../src/screens/DayScene";

// 낮 토론 화면 통합 테스트(S-07): MessageLog·DiscussionControls·말풍선·이모티콘 층을 DayScene 으로 만난다.
// 서버와는 view 픽스처와 이벤트 발행기로만 만난다.

const NOW = 10_000;

interface ViewOpts {
  phase?: PhaseId;
  n?: number;
  messages?: ChatLine[];
  extendUsed?: boolean;
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
      claims: [0, 1, 2, 3].map((seat) => ({ seat, claim: "none" as const, changed: false })),
      messages: o.messages ?? [],
      extendUsed: o.extendUsed ?? false,
    },
  };
}

const line = (seq: number, seat: number, target: number | undefined, at: number, template: ChatLine["template"] = "suspect"): ChatLine => ({
  seq,
  seat,
  template,
  ...(target !== undefined ? { target } : {}),
  at,
});

/** 서버 emoji·error 프레임을 흉내 내는 발행기 */
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

const log = () => screen.getByRole("log");
const items = () => [...log().querySelectorAll<HTMLElement>(".mf-msglog__item")];
const quickBtn = () => screen.getByRole("button", { name: "빠른 메시지" }) as HTMLButtonElement;
const emojiBtn = () => screen.getByRole("button", { name: "이모티콘" }) as HTMLButtonElement;
const dialog = (name: string) => document.querySelector<HTMLDialogElement>(`dialog[aria-label="${name}"]`);

const pct = (n: number): string => `${Math.round(n * 1000) / 1000}%`;
/** 떠 있는 층이 어느 자리 머리 위인지: 가로(--mf-float-left)와 세로(top)가 그 자리 좌표(Table 의 FIG_H 21.33)와 같은 층. 마주 보는 자리는 x 가 같아 세로도 본다 */
function floatsOfSeat(container: HTMLElement, seat: number, mySeat = 0): HTMLElement[] {
  const L = seatLayout(seat, mySeat);
  const x = pct(L.x);
  const top = pct(L.y - 21.33 * L.scale - (L.depth >= 0.5 ? 1 : 8));
  return [...container.querySelectorAll<HTMLElement>(".mf-float")].filter(
    (el) => (el.style.getPropertyValue("--mf-float-left") ?? "").includes(`, ${x},`) && el.style.top === top,
  );
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("낮 토론 화면 — 로그·말하기 줄 (COMM-01, D-15·D-16·D-17)", () => {
  it("메시지가 없으면 로그에 '아직 메시지가 없어요'가 보이고, 말하기 줄과 위쪽 바가 있으며, 비방장은 방장 줄이 없다", () => {
    const r = scene(makeView());
    expect(within(log()).getByText("아직 메시지가 없어요")).toBeTruthy();
    expect(items().length).toBe(0);
    expect(log().getAttribute("aria-live")).toBe("polite");
    expect(log().getAttribute("aria-relevant")).toBe("additions");
    expect(quickBtn()).toBeTruthy();
    expect(emojiBtn()).toBeTruthy();
    expect(screen.queryByRole("button", { name: /\+30초 연장/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /넘기기/ })).toBeNull();
    // 위쪽 바: 낮 · 토론, 1일차, 타이머
    expect(r.container.textContent).toContain("낮 · 토론");
    expect(r.container.textContent).toContain("1일차");
    expect(screen.getByRole("timer").textContent).toBe("1:30");
  });

  it("[빠른 메시지] → 시트가 열리고, 하윤 → [보내기] 가 {t:say, template:suspect, target:1} 을 한 번 보내며 시트가 닫힌다", () => {
    const r = scene(makeView());
    expect(dialog("빠른 메시지")).toBeNull();
    fireEvent.click(quickBtn());
    expect(dialog("빠른 메시지")).not.toBeNull();
    fireEvent.click(within(screen.getByRole("group", { name: "대상" })).getByRole("button", { name: "하윤" }));
    fireEvent.click(screen.getByRole("button", { name: "보내기" }));
    expect(r.conn.send).toHaveBeenCalledTimes(1);
    expect(r.conn.send).toHaveBeenCalledWith({ t: "say", template: "suspect", target: 1 });
    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(dialog("빠른 메시지")).toBeNull();
  });

  it("새 줄(민지 → 하윤 의심돼요)이 오면 로그 마지막 줄과 자리 2 머리 위 말풍선이 같은 문장이고, 내 줄은 '나'로 보인다", () => {
    const r = scene(makeView());
    r.rerender(
      makeView({
        messages: [line(1, 0, 1, NOW - 500, "trust"), line(2, 2, 1, NOW)],
      }),
    );
    const rows = items();
    expect(rows.length).toBe(2);
    const last = rows[1]!;
    expect(last.querySelector(".mf-msglog__name")?.textContent).toBe("민지");
    expect(last.querySelector(".mf-msglog__text")?.textContent).toBe("하윤 의심돼요");
    // 내 자리(0) 메시지의 이름은 "나", title 은 전체 닉네임
    const mine = rows[0]!.querySelector(".mf-msglog__name");
    expect(mine?.textContent).toBe("나");
    expect(mine?.getAttribute("title")).toBe("지우");
    // 구분 점은 자리 색 변수
    expect(last.querySelector<HTMLElement>(".mf-msglog__dot")?.getAttribute("style")).toContain("--seat-3");
    // 말풍선: 자리 2 머리 위, 같은 문장
    const bubbles = floatsOfSeat(r.container, 2);
    expect(bubbles.length).toBe(1);
    expect(bubbles[0]?.querySelector(".mf-bubble")?.textContent).toBe("하윤 의심돼요");
  });

  it("3000ms 뒤 말풍선은 사라지고 로그 줄은 남는다", () => {
    const r = scene(makeView());
    r.rerender(makeView({ messages: [line(1, 2, 1, NOW)] }));
    expect(r.container.querySelectorAll(".mf-float .mf-bubble").length).toBe(1);
    act(() => {
      vi.advanceTimersByTime(2_999);
    });
    expect(r.container.querySelectorAll(".mf-float .mf-bubble").length).toBe(1);
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(r.container.querySelectorAll(".mf-float .mf-bubble").length).toBe(0);
    expect(items().length).toBe(1);
  });

  it("메시지 4줄이면 로그 항목이 4개이고 마지막 줄만 밝은 글자 클래스다", () => {
    scene(
      makeView({
        messages: [1, 2, 3, 4].map((seq) => line(seq, (seq % 3) + 1, 0, NOW - 60_000 - seq)),
      }),
    );
    const rows = items();
    expect(rows.length).toBe(4);
    expect(rows.map((el) => el.classList.contains("mf-msglog__item--latest"))).toEqual([false, false, false, true]);
  });

  it("재접속: 처음 마운트할 때 1초 전 줄은 말풍선이 바로 보이고, 3초 넘게 지난 줄은 말풍선이 없다", () => {
    const r = scene(
      makeView({
        messages: [line(1, 1, 2, NOW - 5_000, "trust"), line(2, 3, 1, NOW - 1_000)],
      }),
    );
    expect(floatsOfSeat(r.container, 3).length).toBe(1);
    expect(floatsOfSeat(r.container, 1).length).toBe(0);
    expect(items().length).toBe(2);
  });

  it("시트를 연 채 다음 낮 발표(dayAnnounce) view 로 바뀌면 시트가 문서에서 사라진다", () => {
    const r = scene(makeView());
    fireEvent.click(quickBtn());
    expect(dialog("빠른 메시지")).not.toBeNull();
    r.rerender(makeView({ phase: "dayAnnounce", n: 2 }));
    expect(dialog("빠른 메시지")).toBeNull();
    expect(screen.queryByRole("log")).toBeNull();
  });

  it("서버가 보낸 문장·HTML 은 그려지지 않는다: 닉네임은 텍스트로만, 줄의 알 수 없는 text 필드는 무시한다 (T-02-31)", () => {
    const base = makeView({ messages: [] });
    const evil = {
      ...base,
      players: base.players.map((p) => (p.seat === 2 ? { ...p, nickname: "<img src=x>" } : p)),
      day: {
        ...base.day!,
        messages: [{ ...line(1, 2, 1, NOW), text: "<script>alert(1)</script>" } as ChatLine],
      },
    } satisfies RoomView;
    const r = scene(evil);
    expect(r.container.querySelector("img[src=\"x\"]")).toBeNull();
    expect(r.container.querySelector("script")).toBeNull();
    expect(items()[0]?.querySelector(".mf-msglog__name")?.textContent).toBe("<img src=x>");
    expect(r.container.textContent).not.toContain("alert(1)");
    expect(r.container.querySelector(".mf-float .mf-bubble")?.textContent).toBe("하윤 의심돼요");
  });
});
