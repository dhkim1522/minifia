import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "../helpers/singleLineErrors";
import type { ClientMessage, PublicPlayer, RoomView } from "../../shared/protocol";
import { READY_TOGGLE_GAP_MS, REMATCH_LOCK_MS, useReady } from "../../src/net/useReady";

// 11-12 Task 1: 다시 하기 알약의 상태 훅. 손님 토글(250ms 간격)·방장 시작(토스트·확인·2초 잠금)은 훅이 쥐고 화면은 그린다.
// 판정(방장·인원·round·단계)은 서버가 한다 — 클라이언트는 의도만 보내고 거절은 알리지 않는다(L40).

const T0 = 1_000_000;
const NAMES = ["지우", "하윤", "민지", "도현", "서연", "수빈"];

interface Spec {
  seat: number;
  ready?: boolean;
  connected?: boolean;
  sat?: boolean;
}
function viewOf(specs: Spec[], over: { me: number; round?: number; min?: number } = { me: 0 }): RoomView {
  const players: PublicPlayer[] = specs.map((s) => ({
    seat: s.seat,
    nickname: NAMES[s.seat]!,
    connected: s.connected ?? true,
    isHost: s.seat === 0,
    ...(s.ready ? { ready: true as const } : {}),
    ...(s.sat ? { sat: true as const } : {}),
  }));
  return {
    code: "0042",
    phase: "ended",
    ...(over.round !== undefined ? { round: over.round } : {}),
    phaseEndsAt: null,
    phaseDurationMs: null,
    serverNow: 0,
    minPlayers: over.min ?? 4,
    maxPlayers: 8,
    players,
    me: { seat: over.me, isHost: over.me === 0 },
  };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(T0);
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

function setup(view: RoomView, o: { canSend?: boolean; stageActive?: boolean } = {}) {
  const send = vi.fn((_m: ClientMessage) => true);
  const hook = renderHook((p: { view: RoomView; canSend: boolean; stageActive: boolean }) => useReady({ view: p.view, send, canSend: p.canSend, stageActive: p.stageActive }), {
    initialProps: { view, canSend: o.canSend ?? true, stageActive: o.stageActive ?? true },
  });
  return { send, hook, sent: () => send.mock.calls.map((c) => c[0]) };
}
const tick = (ms: number) =>
  act(() => {
    vi.advanceTimersByTime(ms);
  });

const FIVE_HOST_READY_THREE = [{ seat: 0, ready: true }, { seat: 1, ready: true }, { seat: 2, ready: true }, { seat: 3 }, { seat: 4 }];

describe("useReady — 상수", () => {
  it("손님 토글 간격 250ms, 시작 잠금 2초", () => {
    expect(READY_TOGGLE_GAP_MS).toBe(250);
    expect(REMATCH_LOCK_MS).toBe(2000);
  });
});

describe("useReady — 숫자", () => {
  it("n 은 준비한 연결된 사람, m 은 연결된 사람. 끊긴 사람은 둘 다에서 빠진다", () => {
    const a = setup(viewOf([{ seat: 0, ready: true }, { seat: 1, ready: true }, { seat: 2, connected: false, ready: true }, { seat: 3 }, { seat: 4 }]));
    expect(a.hook.result.current.ready).toBe(2);
    expect(a.hook.result.current.total).toBe(4);
    expect(a.hook.result.current.canStart).toBe(false); // 2 < 4
    const b = setup(viewOf(FIVE_HOST_READY_THREE));
    expect(b.hook.result.current.ready).toBe(3);
    expect(b.hook.result.current.total).toBe(5);
  });

  it("canStart 는 n 이 view.minPlayers 이상일 때만", () => {
    const a = setup(viewOf([{ seat: 0, ready: true }, { seat: 1, ready: true }, { seat: 2, ready: true }], { me: 0, min: 3 }));
    expect(a.hook.result.current.canStart).toBe(true);
    const b = setup(viewOf([{ seat: 0, ready: true }, { seat: 1, ready: true }], { me: 0, min: 3 }));
    expect(b.hook.result.current.canStart).toBe(false);
  });

  it("mine 은 서버가 실은 내 줄의 ready", () => {
    expect(setup(viewOf([{ seat: 0, ready: true }, { seat: 1, ready: true }], { me: 1 })).hook.result.current.mine).toBe(true);
    expect(setup(viewOf([{ seat: 0, ready: true }, { seat: 1 }], { me: 1 })).hook.result.current.mine).toBe(false);
  });
});

describe("useReady — 손님 토글", () => {
  it("누르면 { t:'ready', on: !mine, round } 한 번. round 는 view.round ?? 1", () => {
    const a = setup(viewOf([{ seat: 0, ready: true }, { seat: 1 }], { me: 1, round: 3 }));
    act(() => a.hook.result.current.press());
    expect(a.sent()).toEqual([{ t: "ready", on: true, round: 3 }]);
    const b = setup(viewOf([{ seat: 0, ready: true }, { seat: 1, ready: true }], { me: 1 }));
    act(() => b.hook.result.current.press());
    expect(b.sent()).toEqual([{ t: "ready", on: false, round: 1 }]);
  });

  it("250ms 안의 다시 누르기는 무시한다 (서버 state 가 오기 전이라 같은 값이 한 번만 간다)", () => {
    const a = setup(viewOf([{ seat: 0, ready: true }, { seat: 1 }], { me: 1 }));
    act(() => a.hook.result.current.press());
    tick(100);
    act(() => a.hook.result.current.press());
    expect(a.sent()).toHaveLength(1);
    tick(READY_TOGGLE_GAP_MS);
    act(() => a.hook.result.current.press());
    expect(a.sent()).toHaveLength(2);
  });

  it("stageActive 가 거짓이거나 canSend 가 거짓이면 아무 일 없다", () => {
    const a = setup(viewOf([{ seat: 0, ready: true }, { seat: 1 }], { me: 1 }), { stageActive: false });
    act(() => a.hook.result.current.press());
    expect(a.sent()).toEqual([]);
    const b = setup(viewOf([{ seat: 0, ready: true }, { seat: 1 }], { me: 1 }), { canSend: false });
    act(() => b.hook.result.current.press());
    expect(b.sent()).toEqual([]);
  });
});

describe("useReady — 방장 시작", () => {
  it("n 이 최소 인원 미만이면 토스트 '{최소}명부터 시작해요' 만 — 보내지 않는다", () => {
    const a = setup(viewOf([{ seat: 0, ready: true }, { seat: 1, ready: true }, { seat: 2 }], { me: 0, min: 4 }));
    act(() => a.hook.result.current.press());
    expect(a.sent()).toEqual([]);
    expect(a.hook.result.current.toast?.text).toBe("4명부터 시작해요");
    expect(a.hook.result.current.confirm).toBeNull();
  });

  it("토스트는 누를 때마다 새 번호다 (같은 문구를 다시 띄울 수 있다)", () => {
    const a = setup(viewOf([{ seat: 0, ready: true }, { seat: 1 }], { me: 0 }));
    act(() => a.hook.result.current.press());
    const first = a.hook.result.current.toast!.n;
    act(() => a.hook.result.current.press());
    expect(a.hook.result.current.toast!.n).toBeGreaterThan(first);
  });

  it("모두 준비했으면 확인 없이 { t:'rematch', round } 를 보내고 2초 잠근다", () => {
    const a = setup(viewOf([{ seat: 0, ready: true }, { seat: 1, ready: true }, { seat: 2, ready: true }, { seat: 3, ready: true }], { me: 0, round: 2 }));
    act(() => a.hook.result.current.press());
    expect(a.sent()).toEqual([{ t: "rematch", round: 2 }]);
    expect(a.hook.result.current.confirm).toBeNull();
    expect(a.hook.result.current.pending).toBe(true);
    act(() => a.hook.result.current.press());
    expect(a.sent()).toHaveLength(1); // 잠금 중
    tick(REMATCH_LOCK_MS);
    expect(a.hook.result.current.pending).toBe(false);
    act(() => a.hook.result.current.press());
    expect(a.sent()).toHaveLength(2);
  });

  it("준비 안 한 연결된 사람이 있으면 확인을 연다 — 쉬게 될 사람은 연결된 미준비자(sat 포함), 끊긴 사람은 아니다", () => {
    const a = setup(viewOf([{ seat: 0, ready: true }, { seat: 1, ready: true }, { seat: 2, ready: true }, { seat: 3, ready: true }, { seat: 4 }, { seat: 5, sat: true }], { me: 0 }));
    act(() => a.hook.result.current.press());
    expect(a.sent()).toEqual([]);
    expect(a.hook.result.current.confirm?.resting.map((r) => r.seat)).toEqual([4, 5]);
    expect(a.hook.result.current.confirm?.resting.map((r) => r.nickname)).toEqual(["서연", "수빈"]);
  });

  it("끊긴 미준비자만 있으면 확인 없이 바로 보낸다", () => {
    const a = setup(viewOf([{ seat: 0, ready: true }, { seat: 1, ready: true }, { seat: 2, ready: true }, { seat: 3, ready: true }, { seat: 4, connected: false }], { me: 0 }));
    act(() => a.hook.result.current.press());
    expect(a.sent()).toEqual([{ t: "rematch", round: 1 }]);
  });

  it("confirmStart 가 rematch 를 한 번 보내고 확인을 닫고 잠근다. cancelConfirm 은 닫기만", () => {
    const a = setup(viewOf([...FIVE_HOST_READY_THREE.slice(0, 3), { seat: 3, ready: true }, { seat: 4 }], { me: 0 }));
    act(() => a.hook.result.current.press());
    act(() => a.hook.result.current.cancelConfirm());
    expect(a.hook.result.current.confirm).toBeNull();
    expect(a.sent()).toEqual([]);
    act(() => a.hook.result.current.press());
    act(() => a.hook.result.current.confirmStart());
    expect(a.sent()).toEqual([{ t: "rematch", round: 1 }]);
    expect(a.hook.result.current.confirm).toBeNull();
    expect(a.hook.result.current.pending).toBe(true);
    act(() => a.hook.result.current.confirmStart());
    expect(a.sent()).toHaveLength(1);
  });

  it("stageActive 가 거짓이거나 canSend 가 거짓이면 아무 일 없다 (토스트도 없다)", () => {
    const four = [{ seat: 0, ready: true }, { seat: 1, ready: true }, { seat: 2, ready: true }, { seat: 3, ready: true }];
    const a = setup(viewOf(four, { me: 0 }), { stageActive: false });
    act(() => a.hook.result.current.press());
    expect(a.sent()).toEqual([]);
    const b = setup(viewOf([{ seat: 0, ready: true }, { seat: 1 }], { me: 0 }), { canSend: false });
    act(() => b.hook.result.current.press());
    expect(b.sent()).toEqual([]);
    expect(b.hook.result.current.toast).toBeNull();
  });

  it("send 가 false 를 돌려주면(소켓 닫힘) 잠그지 않는다", () => {
    const send = vi.fn(() => false);
    const view = viewOf([{ seat: 0, ready: true }, { seat: 1, ready: true }, { seat: 2, ready: true }, { seat: 3, ready: true }], { me: 0 });
    const hook = renderHook(() => useReady({ view, send, canSend: true, stageActive: true }));
    act(() => hook.result.current.press());
    expect(send).toHaveBeenCalledTimes(1);
    expect(hook.result.current.pending).toBe(false);
  });

  it("방장이 아니면 시작 경로는 없다 — 새 방장으로 바뀌면 같은 훅이 방장 규칙을 쓴다", () => {
    const first = viewOf([{ seat: 0, ready: true }, { seat: 1 }], { me: 1 });
    const a = setup(first);
    expect(a.hook.result.current.isHost).toBe(false);
    const next: RoomView = { ...first, me: { seat: 1, isHost: true }, players: first.players.map((p) => ({ ...p, isHost: p.seat === 1 })) };
    a.hook.rerender({ view: next, canSend: true, stageActive: true });
    expect(a.hook.result.current.isHost).toBe(true);
  });
});
