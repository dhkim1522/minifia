import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PhaseId, RoomView } from "../../shared/protocol";
import { EMOJI_MS, SPOKE_MS, useDayChat, useSeatFloats } from "../../src/net/seatFloats";
import type { RoomEvent } from "../../src/net/useRoomConnection";

// 낮 토론의 보낸 사람 반전(3초)·이모티콘(2초)·그날 채팅 줄은 chat·emoji 이벤트에서만 만든다(결정 0017-2·0017-7).
// 서버 뷰에는 메시지가 없다. 보고서가 한 줄로 남도록 배열·객체 비교 대신 문자열·숫자로 단언한다.

const NOW = 10_000;

function viewOf(over: Partial<RoomView> = {}, phase: PhaseId = "discussion", n = 1): RoomView {
  return {
    code: "0042",
    phase,
    phaseEndsAt: null,
    phaseDurationMs: null,
    serverNow: NOW,
    minPlayers: 4,
    maxPlayers: 8,
    players: [0, 1, 2, 3].map((seat) => ({ seat, nickname: `p${seat}`, connected: true, isHost: seat === 0 })),
    me: { seat: 0, isHost: true },
    day: { n, roles: ["mafia", "citizen"] },
    ...over,
  };
}

const chat = (seq: number, seat: number, over: Record<string, unknown> = {}): RoomEvent =>
  ({ t: "chat", seq, seat, template: "innocent", at: NOW, ...over }) as RoomEvent;

/** onEvent 가짜: 구독 목록을 쥐고 이벤트를 흘려 보낸다 */
function bus() {
  const listeners = new Set<(e: RoomEvent) => void>();
  const unsubscribe = vi.fn();
  const onEvent = (l: (e: RoomEvent) => void) => {
    listeners.add(l);
    return () => {
      unsubscribe();
      listeners.delete(l);
    };
  };
  return { onEvent, unsubscribe, emit: (e: RoomEvent) => act(() => listeners.forEach((l) => l(e))), listeners };
}

function setup(initial: RoomView | null) {
  const b = bus();
  const hook = renderHook(({ view }: { view: RoomView | null }) => useSeatFloats(view, b.onEvent), {
    initialProps: { view: initial },
  });
  return { ...b, hook, update: (view: RoomView | null) => hook.rerender({ view }) };
}

function setupChat(initial: RoomView | null) {
  const b = bus();
  const hook = renderHook(({ view }: { view: RoomView | null }) => useDayChat(view, b.onEvent), {
    initialProps: { view: initial },
  });
  return { ...b, hook, update: (view: RoomView | null) => hook.rerender({ view }) };
}

const advance = (ms: number) =>
  act(() => {
    vi.advanceTimersByTime(ms);
  });

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("useSeatFloats: 보낸 사람 반전", () => {
  it("상수: 반전 SPOKE_MS 3000, 이모티콘 EMOJI_MS 2000", () => {
    expect(`${SPOKE_MS}:${EMOJI_MS}`).toBe("3000:2000");
  });

  it("discussion 중 chat 이벤트는 그 자리 spoke 를 3000ms 켠다", () => {
    const { hook, emit } = setup(viewOf());
    emit(chat(1, 2));
    expect(hook.result.current.spoke[2] !== undefined).toBe(true);
    advance(2_999);
    expect(hook.result.current.spoke[2] !== undefined).toBe(true);
    advance(1);
    expect(hook.result.current.spoke[2] === undefined).toBe(true);
  });

  it("같은 자리 새 chat 은 key 가 바뀌고 다시 3000ms, 다른 자리는 따로 센다", () => {
    const { hook, emit } = setup(viewOf());
    emit(chat(1, 2));
    const k1 = hook.result.current.spoke[2]?.key;
    advance(2_000);
    emit(chat(2, 2));
    emit(chat(3, 1));
    const k2 = hook.result.current.spoke[2]?.key;
    expect(k1 !== undefined && k2 !== undefined && k1 !== k2).toBe(true);
    advance(2_999);
    expect(hook.result.current.spoke[2] !== undefined).toBe(true);
    advance(1);
    expect(hook.result.current.spoke[2] === undefined).toBe(true);
    expect(hook.result.current.spoke[1] === undefined).toBe(true);
  });

  it("서버 뷰의 messages 키는 읽지 않는다 (재접속 복원 없음)", () => {
    const base = viewOf();
    const legacy = { ...base, day: { ...base.day!, messages: [{ seq: 1, seat: 1, template: "innocent", at: NOW }] } } as unknown as RoomView;
    const { hook } = setup(legacy);
    expect(Object.keys(hook.result.current.spoke).length).toBe(0);
  });

  it("error 이벤트와 view 가 없는 상태는 무시한다", () => {
    const { hook, emit } = setup(null);
    emit({ t: "error", code: "RATE_LIMITED" });
    emit(chat(1, 1));
    expect(Object.keys(hook.result.current.spoke).length + Object.keys(hook.result.current.emoji).length).toBe(0);
  });
});

describe("useSeatFloats: 이모티콘", () => {
  it("emoji 이벤트는 그 자리에 2000ms 뜬다", () => {
    const { hook, emit } = setup(viewOf());
    emit({ t: "emoji", seat: 2, icon: "heart", at: 1 });
    expect(hook.result.current.emoji[2]?.icon).toBe("heart");
    advance(1_999);
    expect(hook.result.current.emoji[2] !== undefined).toBe(true);
    advance(1);
    expect(hook.result.current.emoji[2] === undefined).toBe(true);
  });

  it("같은 자리에 spoke 가 있어도 둘 다 남는다; 나중 이모티콘의 z 가 크다", () => {
    const { hook, emit } = setup(viewOf());
    emit(chat(1, 2));
    emit({ t: "emoji", seat: 2, icon: "smile", at: 1 });
    expect(hook.result.current.spoke[2] !== undefined && hook.result.current.emoji[2] !== undefined).toBe(true);
    const z1 = hook.result.current.emoji[2]!.z;
    emit({ t: "emoji", seat: 2, icon: "grin", at: 2 });
    expect(hook.result.current.emoji[2]!.z > z1).toBe(true);
    expect(hook.result.current.emoji[2]?.icon).toBe("grin");
  });
});

describe("useSeatFloats: 정리", () => {
  it("discussion 이 아닌 동안 온 chat·emoji 는 무시한다", () => {
    const { hook, emit } = setup(viewOf({}, "claimReveal"));
    emit(chat(1, 1));
    emit({ t: "emoji", seat: 2, icon: "smile", at: 1 });
    expect(Object.keys(hook.result.current.spoke).length + Object.keys(hook.result.current.emoji).length).toBe(0);
  });

  it("discussion 을 벗어나면 모두 비운다", () => {
    const { hook, emit, update } = setup(viewOf());
    emit(chat(1, 1));
    emit({ t: "emoji", seat: 2, icon: "smile", at: 1 });
    expect(Object.keys(hook.result.current.spoke).length + Object.keys(hook.result.current.emoji).length).toBe(2);
    update(viewOf({}, "dayAnnounce"));
    expect(Object.keys(hook.result.current.spoke).length + Object.keys(hook.result.current.emoji).length).toBe(0);
  });

  it("언마운트하면 구독을 풀고 타이머가 남지 않는다", () => {
    const { hook, emit, unsubscribe, listeners } = setup(viewOf());
    emit(chat(1, 1));
    emit({ t: "emoji", seat: 2, icon: "smile", at: 1 });
    expect(vi.getTimerCount() > 0).toBe(true);
    hook.unmount();
    expect(unsubscribe).toHaveBeenCalled();
    expect(listeners.size).toBe(0);
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe("useDayChat: 그날 받은 chat 이벤트로만 만드는 줄 (결정 0017-7, T-02-45)", () => {
  const seqs = (lines: readonly { seq: number }[]) => lines.map((l) => l.seq).join(",");

  it("처음에는 빈 목록이다 (재접속 복원 없음)", () => {
    const { hook } = setupChat(viewOf());
    expect(hook.result.current.length).toBe(0);
  });

  it("discussion 중 chat 이벤트를 받은 순서대로 쌓는다", () => {
    const { hook, emit } = setupChat(viewOf());
    emit(chat(1, 1));
    emit(chat(2, 2, { template: "suspect", target: 3 }));
    expect(seqs(hook.result.current)).toBe("1,2");
    expect(hook.result.current[1]?.target).toBe(3);
  });

  it("줄은 seq·seat·template·target?·claimedRole?·at 만 필드별로 복사한다 (text·t 키 없음)", () => {
    const { hook, emit } = setupChat(viewOf());
    emit(chat(1, 2, { template: "claimed", target: 1, claimedRole: "police", text: "<script>x</script>", extra: 1 }));
    const l = hook.result.current[0]!;
    expect(Object.keys(l).sort().join(",")).toBe("at,claimedRole,seat,seq,target,template");
    expect(l.claimedRole).toBe("police");
  });

  it("target·claimedRole 이 없으면 그 키도 없다", () => {
    const { hook, emit } = setupChat(viewOf());
    emit(chat(1, 2));
    expect(Object.keys(hook.result.current[0]!).sort().join(",")).toBe("at,seat,seq,template");
  });

  it("seq 가 이미 본 최대값 이하인 프레임은 버린다", () => {
    const { hook, emit } = setupChat(viewOf());
    emit(chat(5, 1));
    emit(chat(5, 2));
    emit(chat(3, 3));
    emit(chat(6, 2));
    expect(seqs(hook.result.current)).toBe("5,6");
  });

  it("template 이 알려진 것 밖이면 버린다", () => {
    const { hook, emit } = setupChat(viewOf());
    emit(chat(1, 1, { template: "hack" }));
    emit(chat(2, 1));
    expect(seqs(hook.result.current)).toBe("2");
  });

  it("view.day.n 이 바뀌면 비운다", () => {
    const { hook, emit, update } = setupChat(viewOf({}, "discussion", 1));
    emit(chat(1, 1));
    expect(hook.result.current.length).toBe(1);
    update(viewOf({}, "discussion", 2));
    expect(hook.result.current.length).toBe(0);
    emit(chat(1, 2));
    expect(seqs(hook.result.current)).toBe("1");
  });

  it("discussion 이 아닌 단계의 chat 은 버린다", () => {
    const { hook, emit } = setupChat(viewOf({}, "claimReveal"));
    emit(chat(1, 1));
    expect(hook.result.current.length).toBe(0);
  });
});
