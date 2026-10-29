import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useWakeLock } from "../../src/net/useWakeLock";
import { installWakeLock, removeWakeLock, resetVisibility, setVisibility } from "../helpers/wakeLockFake";

// 요청이 resolve 되어 sentinel 이 훅에 닿을 때까지 마이크로태스크를 비운다.
const flush = () => act(async () => {});

let errorSpy: ReturnType<typeof vi.spyOn>;
let warnSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
  resetVisibility();
});
afterEach(() => {
  cleanup();
  removeWakeLock();
  resetVisibility();
  vi.restoreAllMocks();
});

const silent = () => {
  expect(errorSpy).not.toHaveBeenCalled();
  expect(warnSpy).not.toHaveBeenCalled();
};

describe("useWakeLock: 요청 (CONN-03, D-12)", () => {
  it("active false 로 시작하면 요청 0, true 로 바뀌면 \"screen\" 으로 1번", async () => {
    const wl = installWakeLock();
    const { rerender } = renderHook(({ active }) => useWakeLock(active), { initialProps: { active: false } });
    await flush();
    expect(wl.request).not.toHaveBeenCalled();
    rerender({ active: true });
    await flush();
    expect(wl.request).toHaveBeenCalledTimes(1);
    expect(wl.request).toHaveBeenCalledWith("screen");
  });

  it("① active 를 유지한 채 리렌더해도 다시 요청하지 않는다", async () => {
    const wl = installWakeLock();
    const { rerender } = renderHook(({ active }) => useWakeLock(active), { initialProps: { active: true } });
    await flush();
    rerender({ active: true });
    rerender({ active: true });
    await flush();
    expect(wl.request).toHaveBeenCalledTimes(1);
  });

  it("요청이 아직 끝나지 않았을 때 visible 이벤트가 와도 겹쳐 요청하지 않는다", async () => {
    const wl = installWakeLock({ mode: "pending" });
    renderHook(() => useWakeLock(true));
    setVisibility("visible");
    setVisibility("visible");
    expect(wl.request).toHaveBeenCalledTimes(1);
    await act(async () => wl.resolvers[0]?.());
    // 살아 있는 sentinel 이 있는 동안에도 같다
    setVisibility("visible");
    expect(wl.request).toHaveBeenCalledTimes(1);
  });
});

describe("useWakeLock: 조용한 생략 (D-12, UI-SPEC 7.1)", () => {
  it("② navigator.wakeLock 이 없으면 렌더·리렌더·해제·visible 이벤트에서 예외도 로그도 없다", async () => {
    removeWakeLock();
    expect("wakeLock" in navigator).toBe(false);
    const { rerender, unmount } = renderHook(({ active }) => useWakeLock(active), { initialProps: { active: true } });
    await flush();
    rerender({ active: true });
    setVisibility("hidden");
    setVisibility("visible");
    rerender({ active: false });
    unmount();
    silent();
  });

  it("③-a request 가 동기 예외를 던져도 렌더가 성공하고 콘솔 호출 0", async () => {
    const wl = installWakeLock({ mode: "throw" });
    const { unmount } = renderHook(() => useWakeLock(true));
    await flush();
    expect(wl.request).toHaveBeenCalledTimes(1);
    unmount();
    silent();
  });

  it("③-b 거부(NotAllowedError)돼도 콘솔 호출 0, 같은 상태 리렌더에서 재시도하지 않는다", async () => {
    const wl = installWakeLock({ mode: "reject" });
    const { rerender, unmount } = renderHook(({ active }) => useWakeLock(active), { initialProps: { active: true } });
    await flush();
    rerender({ active: true });
    await flush();
    expect(wl.request).toHaveBeenCalledTimes(1);
    unmount();
    silent();
  });
});

describe("useWakeLock: 재요청은 visibilitychange 한 곳뿐 (T-05-03)", () => {
  it("④-a sentinel release 이벤트로는 재요청하지 않고, hidden 에서도 안 하며, visible 복귀에서 정확히 한 번 더 요청한다", async () => {
    const wl = installWakeLock();
    renderHook(() => useWakeLock(true));
    await flush();
    expect(wl.request).toHaveBeenCalledTimes(1);
    // 시스템이 잠금을 풂: released 가 참이 되고 release 이벤트가 온다
    await act(async () => {
      await wl.sentinels[0]!.release();
    });
    expect(wl.request).toHaveBeenCalledTimes(1);
    setVisibility("hidden");
    expect(wl.request).toHaveBeenCalledTimes(1);
    setVisibility("visible");
    await flush();
    expect(wl.request).toHaveBeenCalledTimes(2);
    expect(wl.request).toHaveBeenLastCalledWith("screen");
  });

  it("거부가 반복돼도 visible 이벤트 한 번에 요청 한 번뿐이다(루프 없음)", async () => {
    const wl = installWakeLock({ mode: "reject" });
    renderHook(() => useWakeLock(true));
    await flush();
    setVisibility("visible");
    await flush();
    setVisibility("visible");
    await flush();
    expect(wl.request).toHaveBeenCalledTimes(3);
    silent();
  });

  it("④-b active 가 거짓인 동안에는 visible 이벤트가 와도 요청하지 않는다", async () => {
    const wl = installWakeLock();
    renderHook(() => useWakeLock(false));
    setVisibility("hidden");
    setVisibility("visible");
    await flush();
    expect(wl.request).not.toHaveBeenCalled();
  });
});

describe("useWakeLock: 해제 (T-05-05)", () => {
  it("④-c active 가 거짓이 되면 sentinel.release 가 정확히 1번 불리고 이후 visible 이벤트에 요청하지 않는다", async () => {
    const wl = installWakeLock();
    const { rerender } = renderHook(({ active }) => useWakeLock(active), { initialProps: { active: true } });
    await flush();
    rerender({ active: false });
    await flush();
    expect(wl.sentinels[0]!.releaseCalls).toBe(1);
    setVisibility("visible");
    await flush();
    expect(wl.request).toHaveBeenCalledTimes(1);
  });

  it("④-c 언마운트하면 release 1번, 리스너가 떨어져 이후 이벤트에 요청 0", async () => {
    const wl = installWakeLock();
    const { unmount } = renderHook(() => useWakeLock(true));
    await flush();
    unmount();
    expect(wl.sentinels[0]!.releaseCalls).toBe(1);
    setVisibility("hidden");
    setVisibility("visible");
    await flush();
    expect(wl.request).toHaveBeenCalledTimes(1);
  });

  it("④-d 요청이 끝나기 전에 active 가 거짓이 되고 그 뒤 resolve 되면, 받은 sentinel 을 곧바로 release 한다", async () => {
    const wl = installWakeLock({ mode: "pending" });
    const { rerender } = renderHook(({ active }) => useWakeLock(active), { initialProps: { active: true } });
    expect(wl.request).toHaveBeenCalledTimes(1);
    rerender({ active: false });
    expect(wl.sentinels[0]!.releaseCalls).toBe(0);
    await act(async () => wl.resolvers[0]?.());
    expect(wl.sentinels[0]!.releaseCalls).toBe(1);
    silent();
  });

  it("해제 중 release 가 거부돼도 삼킨다(콘솔 0)", async () => {
    const wl = installWakeLock();
    const { unmount } = renderHook(() => useWakeLock(true));
    await flush();
    wl.sentinels[0]!.release = () => {
      wl.sentinels[0]!.releaseCalls += 1;
      return Promise.reject(new Error("already released"));
    };
    unmount();
    await flush();
    expect(wl.sentinels[0]!.releaseCalls).toBe(1);
    silent();
  });
});
