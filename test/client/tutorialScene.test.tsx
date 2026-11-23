import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useTutorialScene } from "../../src/net/useTutorialScene";

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const wait = (ms: number) => act(async () => vi.advanceTimersByTimeAsync(ms));

describe("혼자 하기 장면 시계", () => {
  it("허용된 단추를 눌렀을 때와 12초 대행이 같은 '찬성' 반응을 만든다", async () => {
    const { result } = renderHook(() => useTutorialScene(vi.fn()));
    act(() => result.current.go("verdict"));
    expect(result.current.send({ t: "verdict", agree: true })).toBe(true);
    expect(result.current.cursor.acted).toBe(0);
    await wait(1_000);
    expect(result.current.target).toBe("yes");
    act(() => result.current.send({ t: "verdict", agree: false }));
    expect(result.current.cursor.acted).toBe(0);
    act(() => result.current.send({ t: "verdict", agree: true }));
    expect(result.current.cursor.acted).toBe(1);
    expect(result.current.target).toBeNull();

    act(() => result.current.go("verdict"));
    await wait(1_000);
    await wait(12_000);
    expect(result.current.cursor.acted).toBe(1);
    expect(result.current.target).toBeNull();
    for (let i = 0; i < 5; i++) await wait(300);
    expect(result.current.cursor.acted).toBe(6);
    await wait(1_600);
    expect(result.current.scene.id).toBe("pick");
  });

  it("포스트잇 대행도 실제 모드 단추를 호출하고 다음 비트부터 이름표를 기다린다", async () => {
    const clickSuspect = vi.fn();
    const { result } = renderHook(() => useTutorialScene(clickSuspect));
    act(() => result.current.go("postit"));
    await wait(0);
    expect(result.current.target).toBe("suspect-btn");
    await wait(12_000);
    expect(clickSuspect).toHaveBeenCalledTimes(1);
    expect(result.current.beat.id).toBe("a");
    await wait(0);
    expect(result.current.target).toBe("tag-4");
    act(() => result.current.send({ t: "suspect", target: 4 }));
    expect(result.current.beat.id).toBe("b");
    await wait(3_000);
    expect(result.current.beat.id).toBe("c");
    await wait(1_800);
    expect(result.current.scene.id).toBe("end");
  });

  it("장면을 다시 시작하면 이전 장면의 대행을 취소한다", async () => {
    const clickSuspect = vi.fn();
    const { result } = renderHook(() => useTutorialScene(clickSuspect));
    act(() => result.current.go("postit"));
    await wait(0);
    act(() => result.current.go("end"));
    await wait(12_000);
    expect(clickSuspect).not.toHaveBeenCalled();
    expect(result.current.scene.id).toBe("end");
  });

  it("실험방에서는 첫 투표와 아침 준비를 실제 입력과 이어 준다", async () => {
    const clickTool = vi.fn();
    const { result } = renderHook(() => useTutorialScene(clickTool, true));
    expect(result.current.steps).toBe(9);
    act(() => result.current.go("answerReveal"));
    await wait(3_000);
    expect(result.current.scene.id).toBe("postit");
    act(() => result.current.go("verdict"));
    await wait(0);
    expect(result.current.target).toBe("first-ballot");
    act(() => result.current.send({ t: "firstBallot", target: 4 }));
    expect(result.current.cursor.firstBallot).toBe(4);
    await wait(1500);
    expect(result.current.beat.id).toBe("c");
    await wait(3000);
    expect(result.current.scene.id).toBe("night");

    act(() => result.current.go("night"));
    await wait(0);
    expect(result.current.target).toBe("night-done");
    act(() => result.current.send({ t: "nightDone" }));
    expect(result.current.beat.id).toBe("b");
    await wait(1500);
    expect(result.current.beat.id).toBe("c");
  });
});
