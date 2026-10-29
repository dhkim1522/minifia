import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useWakeLock } from "../../src/net/useWakeLock";
import { installWakeLock, removeWakeLock, resetVisibility } from "../helpers/wakeLockFake";

// 요청이 resolve 되어 sentinel 이 훅에 닿을 때까지 마이크로태스크를 비운다.
const flush = () => act(async () => {});

beforeEach(() => {
  resetVisibility();
});
afterEach(() => {
  cleanup();
  removeWakeLock();
  resetVisibility();
  vi.restoreAllMocks();
});


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
});
