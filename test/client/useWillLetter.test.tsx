// 유언 편지 상태 훅 시험 (09.1-10, 결정 0063-3, UI-SPEC C-1·C-4, L16). 실제 ChatStore 와 가짜 타이머.
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ChatLineFrame, DayView, PhaseId, PublicPlayer, RoomView } from "../../shared/protocol";
import { LETTER_END_AT_MS, LETTER_FOLD_AT_MS } from "../../src/game/willLetter";
import { ChatStore } from "../../src/net/chatStore";
import { useWillLetter } from "../../src/net/useWillLetter";

const NAMES = ["서연", "민준", "도윤", "지호", "하윤"];
const T = 1_000_000;

function viewOf(phase: PhaseId, opts: { mySeat?: number; dead?: number[]; day?: Partial<DayView>; me?: Partial<RoomView["me"]> } = {}): RoomView {
  const dead = opts.dead ?? [];
  const players: PublicPlayer[] = NAMES.map((nickname, seat) => ({ seat, nickname, connected: true, isHost: seat === 0, ...(dead.includes(seat) ? { alive: false } : {}) }));
  return {
    code: "0042",
    phase,
    phaseEndsAt: null,
    phaseDurationMs: null,
    serverNow: 0,
    minPlayers: 4,
    maxPlayers: 8,
    players,
    me: { seat: opts.mySeat ?? 2, isHost: false, ...opts.me },
    day: { n: 1, roles: [], ...opts.day },
  };
}
const night = (mySeat = 2, me: Partial<RoomView["me"]> = {}) => viewOf("night", { mySeat, me });
const morning = (mySeat = 2, extra: { me?: Partial<RoomView["me"]>; morning?: DayView["morning"] } = {}) =>
  viewOf("morning", { mySeat, dead: [3], day: { morning: extra.morning ?? { eliminated: 3 } }, ...(extra.me ? { me: extra.me } : {}) });

const card = (k: "will" | "note", seat: number, seq: number, text: string): ChatLineFrame => ({ t: "chat", ch: "all", seat, seq, text, at: 900 + seq, k });

function setup(initial: RoomView | null = night()) {
  const chat = new ChatStore();
  chat.setContext({ pk: "1:morning", channel: "all", epoch: 1 });
  const hook = renderHook((p: { view: RoomView | null; epoch: number }) => useWillLetter({ view: p.view, epoch: p.epoch, chat }), {
    initialProps: { view: initial, epoch: 1 },
  });
  const rerender = (view: RoomView | null, epoch = 1) => act(() => hook.rerender({ view, epoch }));
  const give = (frame: ChatLineFrame) => act(() => chat.apply(frame, 1, Date.now()));
  const tick = (ms: number) => act(() => void vi.advanceTimersByTime(ms));
  return { chat, hook, rerender, give, tick };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(T);
});
afterEach(() => {
  vi.useRealTimers();
});

describe("useWillLetter", () => {
  it("밤 → 아침에 유언 카드가 이미 있으면 편지(T0 = 렌더 + 400)를 돌려주고 카드를 접힘까지 보류한다", () => {
    const s = setup();
    s.give(card("will", 3, 1, "현우 님 말투가\n이상해요"));
    s.rerender(morning());
    const letter = s.hook.result.current;
    expect(letter).toMatchObject({ seat: 3, name: "지호", text: "현우 님 말투가 이상해요", t0: T + 400 });
    expect(letter?.announce).toMatchObject({ text: "지호 님이 당했습니다", icon: "target" });
    expect(s.chat.visibleLines("all", T + 400 + LETTER_FOLD_AT_MS - 1)).toHaveLength(0);
    expect(s.chat.visibleLines("all", T + 400 + LETTER_FOLD_AT_MS)).toHaveLength(1);
  });

  it("카드가 아침 view 뒤에 접힘 전에 도착해도 편지가 시작되고 유언 → 쪽지 순서로 접힘 시각에 나타난다", () => {
    const s = setup();
    s.rerender(morning());
    expect(s.hook.result.current).toBeNull();
    s.tick(1000);
    s.give(card("will", 3, 1, "유언"));
    s.give(card("note", 3, 2, "쪽지"));
    expect(s.hook.result.current).toMatchObject({ seat: 3, text: "유언", t0: T + 400 });
    const foldAt = T + 400 + LETTER_FOLD_AT_MS;
    expect(s.chat.visibleLines("all", foldAt - 1)).toHaveLength(0);
    expect(s.chat.visibleLines("all", foldAt).map((l) => l.card).join()).toBe("will,note");
  });

  it("T0 + 5420 에 null 로 돌아간다", () => {
    const s = setup();
    s.give(card("will", 3, 1, "유언"));
    s.rerender(morning());
    s.tick(400 + LETTER_END_AT_MS - 1);
    expect(s.hook.result.current).not.toBeNull();
    s.tick(1);
    expect(s.hook.result.current).toBeNull();
  });

  it("피해자 본인은 T0 700, 경찰 본인은 T0 2600", () => {
    const a = setup(night(3));
    a.give(card("will", 3, 1, "유언"));
    a.rerender(morning(3));
    expect(a.hook.result.current?.t0).toBe(T + 700);
    a.hook.unmount();
    const police = { role: "police" as const, records: [] };
    const b = setup(night(2, police));
    b.give(card("will", 3, 1, "유언"));
    b.rerender(morning(2, { me: { ...police, records: [{ n: 1, target: 4, isMafia: false }] } }));
    expect(b.hook.result.current?.t0).toBe(T + 2600);
  });

  it("카드가 T0 + 5초 뒤에 오면 편지를 만들지 않고 카드는 기본 보류(2.8초)다", () => {
    const s = setup();
    s.rerender(morning());
    s.tick(400 + LETTER_FOLD_AT_MS + 100);
    s.give(card("will", 3, 1, "늦은 유언"));
    expect(s.hook.result.current).toBeNull();
    expect(s.chat.nextCardReveal(Date.now())).toBe(Date.now() + 2800);
  });

  it("유언 카드 없음(쪽지만)·공백뿐·구출·탈락자 없음은 편지가 없고 보류도 기본 그대로다", () => {
    const noWill = setup();
    noWill.give(card("note", 3, 1, "쪽지"));
    noWill.rerender(morning());
    expect(noWill.hook.result.current).toBeNull();
    expect(noWill.chat.nextCardReveal(Date.now())).toBe(Date.now() + 2800);

    const blank = setup();
    blank.give(card("will", 3, 1, "   \n  "));
    blank.rerender(morning());
    expect(blank.hook.result.current).toBeNull();
    expect(blank.chat.nextCardReveal(Date.now())).toBe(Date.now() + 2800);

    const saved = setup();
    saved.give(card("will", 3, 1, "유언"));
    saved.rerender(morning(2, { morning: { saved: true } }));
    expect(saved.hook.result.current).toBeNull();
  });

  it("다른 좌석의 유언 카드(처형 등)로는 편지를 만들지 않는다", () => {
    const s = setup();
    s.give(card("will", 4, 1, "처형된 사람의 유언"));
    s.rerender(morning());
    s.tick(6000);
    expect(s.hook.result.current).toBeNull();
  });

  it("재접속 첫 스냅샷(직전 view 없음)·밤이 아닌 곳에서 온 아침·epoch 가 바뀐 첫 스냅샷은 편지가 없다", () => {
    const first = setup(null);
    first.give(card("will", 3, 1, "유언"));
    first.rerender(morning());
    expect(first.hook.result.current).toBeNull();

    const lobby = setup(viewOf("lobby"));
    lobby.give(card("will", 3, 1, "유언"));
    lobby.rerender(morning());
    expect(lobby.hook.result.current).toBeNull();

    const reset = setup();
    reset.give(card("will", 3, 1, "유언"));
    reset.rerender(morning(), 2);
    expect(reset.hook.result.current).toBeNull();
  });

  it("처형 아침이 아닌 곳(처형 카드)은 9페이즈 2.4초 보류 그대로다", () => {
    const s = setup();
    s.chat.setContext({ pk: "1:execution", channel: "all", epoch: 1 });
    s.give(card("will", 4, 1, "처형 유언"));
    expect(s.chat.nextCardReveal(Date.now())).toBe(Date.now() + 2400);
    expect(s.hook.result.current).toBeNull();
  });

  it("view.me.will 이 있어도 읽지 않는다(L16) — 본문은 카드에서만", () => {
    const s = setup(night(3));
    s.rerender(viewOf("morning", { mySeat: 3, dead: [3], day: { morning: { eliminated: 3 } }, me: { will: "내 유언 view" } }));
    s.tick(6000);
    expect(s.hook.result.current).toBeNull();
  });
});
