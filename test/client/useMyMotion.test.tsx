import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "../helpers/singleLineErrors";
import type { Segment } from "../../shared/game/world";
import { segmentEndsAt } from "../../shared/game/world";
import { EMOTE_MS } from "../../shared/game/emote";
import type { EmoteFrame } from "../../shared/protocol";
import { useMyMotion, type MotionStore } from "../../src/net/useMyMotion";

// 10-05 Task 2: 내 캐릭터가 걷는 중인지(moving)·내 동작이 재생 중인지(emoting)를 정하는 훅. 가짜 저장소와 가짜 타이머.
// 서버 시각은 부르는 쪽이 serverNow() 로 넘긴다(Date.now() + offset).

const T0 = 1_000_000;
// 이동 거리 200 고정소수점 단위, 속도 v → 걷는 시간 = 200 * 1000 / v
const walkSeg = (t0: number, v = 100): Segment => ({ p: [0, 0, 200, 0], t0, v });
const restSeg: Segment = { p: [0, 0], t0: T0 - 5000, v: 100 };

class FakeStore implements MotionStore {
  segs = new Map<number, Segment>();
  subs = new Set<() => void>();
  emoteSubs = new Set<(f: EmoteFrame) => void>();
  segOf(seat: number) {
    return this.segs.get(seat);
  }
  subscribe(cb: () => void) {
    this.subs.add(cb);
    return () => this.subs.delete(cb);
  }
  onEmote(cb: (f: EmoteFrame) => void) {
    this.emoteSubs.add(cb);
    return () => this.emoteSubs.delete(cb);
  }
  setSeg(seat: number, seg: Segment) {
    this.segs.set(seat, seg);
    for (const cb of [...this.subs]) cb();
  }
  emote(seat: number, id: EmoteFrame["id"]) {
    for (const cb of [...this.emoteSubs]) cb({ t: "emote", seat, id, n: 1 });
  }
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(T0);
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const mount = (store: FakeStore, seat = 1) => renderHook(() => useMyMotion(store, seat, () => Date.now()));
const state = (r: { current: { moving: boolean; emoting: string | null } }) => `${r.current.moving}|${r.current.emoting}`;

describe("useMyMotion moving", () => {
  it("구간이 없거나 끝난 한 점이면 걷는 중이 아니다", () => {
    const s = new FakeStore();
    const { result } = mount(s);
    expect(state(result)).toBe("false|null");
    act(() => s.setSeg(1, restSeg));
    expect(state(result)).toBe("false|null");
  });

  it("걷는 구간이 오면 참이고 구간 끝 시각에 타이머로 거짓이 된다", () => {
    const s = new FakeStore();
    const { result } = mount(s);
    const seg = walkSeg(T0);
    const dur = segmentEndsAt(seg) - T0;
    act(() => s.setSeg(1, seg));
    expect(result.current.moving).toBe(true);
    act(() => vi.advanceTimersByTime(dur - 1));
    expect(result.current.moving).toBe(true);
    act(() => vi.advanceTimersByTime(1));
    expect(result.current.moving).toBe(false);
  });

  it("다른 사람의 구간은 세지 않는다", () => {
    const s = new FakeStore();
    const { result } = mount(s, 1);
    act(() => s.setSeg(2, walkSeg(T0)));
    expect(result.current.moving).toBe(false);
  });

  it("걷는 중에 새 구간이 오면 새 끝 시각을 따른다", () => {
    const s = new FakeStore();
    const { result } = mount(s);
    act(() => s.setSeg(1, walkSeg(T0, 200)));
    act(() => vi.advanceTimersByTime(300));
    const seg2 = walkSeg(T0 + 300, 100);
    act(() => s.setSeg(1, seg2));
    const dur2 = segmentEndsAt(seg2) - (T0 + 300);
    act(() => vi.advanceTimersByTime(dur2 - 1));
    expect(result.current.moving).toBe(true);
    act(() => vi.advanceTimersByTime(1));
    expect(result.current.moving).toBe(false);
  });
});

describe("useMyMotion emoting", () => {
  it("내 좌석 프레임이면 EMOTE_MS 동안 그 id, 지나면 null", () => {
    const s = new FakeStore();
    const { result } = mount(s);
    act(() => s.emote(1, "clap"));
    expect(state(result)).toBe("false|clap");
    act(() => vi.advanceTimersByTime(EMOTE_MS.clap - 1));
    expect(result.current.emoting).toBe("clap");
    act(() => vi.advanceTimersByTime(1));
    expect(result.current.emoting).toBe(null);
  });

  it("다른 좌석 프레임은 무시한다", () => {
    const s = new FakeStore();
    const { result } = mount(s);
    act(() => s.emote(3, "dance"));
    expect(result.current.emoting).toBe(null);
  });

  it("내 이동이 시작되면 바로 null", () => {
    const s = new FakeStore();
    const { result } = mount(s);
    act(() => s.emote(1, "dance"));
    act(() => s.setSeg(1, walkSeg(T0)));
    expect(state(result)).toBe("true|null");
  });

  it("새 프레임은 앞 재생을 대체하고 타이머도 새 길이를 따른다", () => {
    const s = new FakeStore();
    const { result } = mount(s);
    act(() => s.emote(1, "dance"));
    act(() => vi.advanceTimersByTime(500));
    act(() => s.emote(1, "surprise"));
    expect(result.current.emoting).toBe("surprise");
    act(() => vi.advanceTimersByTime(EMOTE_MS.surprise));
    expect(result.current.emoting).toBe(null);
  });

  it("해제하면 구독과 타이머가 남지 않는다", () => {
    const s = new FakeStore();
    const { unmount } = mount(s);
    act(() => s.emote(1, "clap"));
    unmount();
    expect(`${s.subs.size}|${s.emoteSubs.size}|${vi.getTimerCount()}`).toBe("0|0|0");
  });
});
