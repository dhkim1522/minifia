import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { RoomView } from "../../shared/protocol";
import { FIRST_GAME_GUIDE_KEY, useFirstGameGuide } from "../../src/net/useFirstGameGuide";

const firstRound: RoomView = {
  code: "0042",
  round: 1,
  phase: "roleReveal",
  phaseEndsAt: null,
  phaseDurationMs: null,
  serverNow: 0,
  minPlayers: 4,
  maxPlayers: 8,
  players: [],
  me: { seat: 0, isHost: true, role: "citizen" },
};

function setup(initialProps: RoomView | null) {
  return renderHook((view: RoomView | null) => useFirstGameGuide(view), { initialProps });
}

beforeEach(() => {
  const storage = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, value),
  });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("첫 게임의 도움말 진행 저장", () => {
  it("연결과 대기실은 첫 게임을 사용하지 않고, 역할 확인부터 도움말이 생긴다", () => {
    const { result, rerender } = setup(null);
    expect(result.current).toBeUndefined();
    rerender({ ...firstRound, phase: "lobby" });
    expect(localStorage.getItem(FIRST_GAME_GUIDE_KEY)).toBeNull();
    expect(result.current).toBeUndefined();
    rerender(firstRound);
    expect(result.current?.seen("role")).toBe(false);
  });

  it("같은 판 재접속에서는 본 항목만 생략하고, 다음 판이나 다른 방에는 다시 뜨지 않는다", () => {
    const first = setup(firstRound);
    act(() => first.result.current?.markSeen("role"));
    first.unmount();

    const resumed = setup({ ...firstRound, phase: "keyword" });
    expect(resumed.result.current?.seen("role")).toBe(true);
    expect(resumed.result.current?.seen("clue")).toBe(false);
    resumed.rerender({ ...firstRound, phase: "ended" });
    expect(resumed.result.current).toBeUndefined();
    resumed.rerender({ ...firstRound, round: 2 });
    expect(resumed.result.current).toBeUndefined();
    resumed.rerender({ ...firstRound, code: "0043" });
    expect(resumed.result.current).toBeUndefined();
  });

  it("브라우저가 저장소를 차단해도 현재 판에서는 같은 항목을 기억한다", () => {
    const blocked = () => { throw new Error("Storage blocked"); };
    vi.stubGlobal("localStorage", { getItem: blocked, setItem: blocked });
    const { result, rerender } = setup(firstRound);
    act(() => result.current?.markSeen("role"));
    rerender({ ...firstRound, phase: "keyword" });
    expect(result.current?.seen("role")).toBe(true);
    expect(result.current?.seen("clue")).toBe(false);
  });
});
