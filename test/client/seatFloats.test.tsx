import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ChatLine, PhaseId, RoomView } from "../../shared/protocol";
import { BUBBLE_MS, EMOJI_MS, useSeatFloats } from "../../src/net/seatFloats";
import type { RoomEvent } from "../../src/net/useRoomConnection";

const NOW = 10_000;

function line(seq: number, seat: number, at: number, over: Partial<ChatLine> = {}): ChatLine {
  return { seq, seat, template: "innocent", at, ...over };
}

function viewOf(messages: ChatLine[], over: Partial<RoomView> = {}, phase: PhaseId = "discussion"): RoomView {
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
    day: { n: 1, roles: ["mafia", "citizen"], messages },
    ...over,
  };
}

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

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("useSeatFloats: 말풍선", () => {
  it("상수: 말풍선 3초, 이모티콘 2초", () => {
    expect(BUBBLE_MS).toBe(3_000);
    expect(EMOJI_MS).toBe(2_000);
  });

  it("첫 렌더에 3초 안 지난 줄이 있으면 남은 시간만큼 복원한다 (elapsedMs 1000, 2000ms 뒤 사라짐)", () => {
    const { hook } = setup(viewOf([line(1, 1, NOW - 1_000)]));
    const f = hook.result.current[1];
    expect(f?.kind).toBe("bubble");
    expect(f?.elapsedMs).toBe(1_000);
    expect(f && f.until - Date.now()).toBe(2_000);
    act(() => {
      vi.advanceTimersByTime(1_999);
    });
    expect(hook.result.current[1]).toBeDefined();
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(hook.result.current[1]).toBeUndefined();
  });

  it("serverNow − 3000 이하의 줄은 복원하지 않는다", () => {
    const { hook } = setup(viewOf([line(1, 1, NOW - 3_000), line(2, 2, NOW - 5_000)]));
    expect(hook.result.current).toEqual({});
  });

  it("같은 자리에 새 줄이 오면 바꾸고 key 가 달라진다; 다른 자리면 둘 다 뜨고 나중 것의 z 가 크다", () => {
    const { hook, update } = setup(viewOf([line(1, 1, NOW)]));
    const first = hook.result.current[1];
    update(viewOf([line(1, 1, NOW), line(2, 1, NOW)], { serverNow: NOW }));
    const second = hook.result.current[1];
    expect(second?.kind === "bubble" && second.line.seq).toBe(2);
    expect(second?.key).not.toBe(first?.key);
    update(viewOf([line(1, 1, NOW), line(2, 1, NOW), line(3, 3, NOW)]));
    const third = hook.result.current[3];
    expect(hook.result.current[1]).toBeDefined();
    expect(third).toBeDefined();
    expect(third!.z).toBeGreaterThan(hook.result.current[1]!.z);
  });

  it("같은 messages 로 새 view 객체가 와도 상태 그대로(타이머 연장 없음)", () => {
    const { hook, update } = setup(viewOf([line(1, 1, NOW)]));
    const before = hook.result.current[1];
    act(() => {
      vi.advanceTimersByTime(1_500);
    });
    update(viewOf([line(1, 1, NOW)], { serverNow: NOW + 1_500 }));
    expect(hook.result.current[1]).toBe(before);
    act(() => {
      vi.advanceTimersByTime(1_500);
    });
    expect(hook.result.current[1]).toBeUndefined();
  });

  it("view 가 없거나 messages 가 없으면 비어 있다", () => {
    expect(setup(null).hook.result.current).toEqual({});
    expect(setup(viewOf([], { day: undefined })).hook.result.current).toEqual({});
  });
});

describe("useSeatFloats: 이모티콘", () => {
  it("emoji 이벤트는 그 자리에 2000ms 뜬다", () => {
    const { hook, emit } = setup(viewOf([]));
    emit({ t: "emoji", seat: 2, icon: "heart", at: 1 });
    const f = hook.result.current[2];
    expect(f?.kind === "emoji" && f.icon).toBe("heart");
    expect(f?.elapsedMs).toBe(0);
    act(() => {
      vi.advanceTimersByTime(1_999);
    });
    expect(hook.result.current[2]).toBeDefined();
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(hook.result.current[2]).toBeUndefined();
  });

  it("같은 자리의 말풍선은 이모티콘으로 바뀐다, error 이벤트는 무시한다", () => {
    const { hook, emit } = setup(viewOf([line(1, 2, NOW)]));
    expect(hook.result.current[2]?.kind).toBe("bubble");
    emit({ t: "error", code: "RATE_LIMITED" });
    expect(hook.result.current[2]?.kind).toBe("bubble");
    emit({ t: "emoji", seat: 2, icon: "smile", at: 1 });
    expect(hook.result.current[2]?.kind).toBe("emoji");
  });

  it("이모티콘에 이은 말풍선도 같은 자리를 바꾸고, 나중 것의 z 가 크다", () => {
    const { hook, emit, update } = setup(viewOf([]));
    emit({ t: "emoji", seat: 2, icon: "smile", at: 1 });
    const z1 = hook.result.current[2]!.z;
    update(viewOf([line(1, 2, NOW)]));
    expect(hook.result.current[2]?.kind).toBe("bubble");
    expect(hook.result.current[2]!.z).toBeGreaterThan(z1);
  });
});

describe("useSeatFloats: 정리", () => {
  it("단계가 discussion 이 아니게 되면 모두 사라진다", () => {
    const { hook, emit, update } = setup(viewOf([line(1, 1, NOW)]));
    emit({ t: "emoji", seat: 2, icon: "smile", at: 1 });
    expect(Object.keys(hook.result.current)).toHaveLength(2);
    update(viewOf([], {}, "dayAnnounce"));
    expect(hook.result.current).toEqual({});
  });

  it("discussion 이 아닌 동안 온 emoji 는 뜨지 않는다", () => {
    const { hook, emit } = setup(viewOf([], {}, "dayAnnounce"));
    emit({ t: "emoji", seat: 2, icon: "smile", at: 1 });
    expect(hook.result.current).toEqual({});
  });

  it("언마운트하면 onEvent 를 해제하고 남은 타이머가 없다", () => {
    const { hook, emit, unsubscribe, listeners } = setup(viewOf([line(1, 1, NOW)]));
    emit({ t: "emoji", seat: 2, icon: "smile", at: 1 });
    expect(vi.getTimerCount()).toBeGreaterThan(0);
    hook.unmount();
    expect(unsubscribe).toHaveBeenCalled();
    expect(listeners.size).toBe(0);
    expect(vi.getTimerCount()).toBe(0);
  });
});
