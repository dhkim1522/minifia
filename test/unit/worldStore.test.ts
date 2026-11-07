import { describe, expect, it, vi } from "vitest";
import { WorldStore } from "../../src/world/store";

const snap = (ents: { s: number; p: number[]; t0: number; v: number }[], at = 0) => ({ t: "world" as const, k: "snap" as const, at, ents });
const move = (s: number, p: number[], t0: number, v = 180) => ({ t: "world" as const, k: "move" as const, s, p, t0, v });

describe("WorldStore: snap·move 기본 (MAP-05)", () => {
  it("snap(epoch 1)을 적용하면 준비되고 seat 와 서 있는 위치를 안다", () => {
    const store = new WorldStore();
    expect(store.isReady()).toBe(false);
    store.applyFrame(snap([{ s: 0, p: [360, 40], t0: 0, v: 180 }]), 1);
    expect(store.isReady()).toBe(true);
    expect(store.seats()).toEqual([0]);
    expect(store.positionOf(0, 123456)).toEqual({ x: 3.6, z: 0.4 });
  });

  it("move 는 seat 의 구간을 바꾸고 positionOf 는 서버 시각의 보간 위치를 준다", () => {
    const store = new WorldStore();
    store.applyFrame(snap([{ s: 0, p: [360, 40], t0: 0, v: 180 }]), 1);
    store.applyFrame(move(0, [360, 40, 360, 220], 1000), 1);
    expect(store.segOf(0)).toEqual({ p: [360, 40, 360, 220], t0: 1000, v: 180 });
    expect(store.positionOf(0, 2000)).toEqual({ x: 3.6, z: 2.2 });
  });

  it("모르는 seat 는 위치가 null 이다", () => {
    const store = new WorldStore();
    store.applyFrame(snap([]), 1);
    expect(store.positionOf(5, 0)).toBeNull();
    expect(store.segOf(5)).toBeUndefined();
  });
});

const rest = (s: number, x = 100, z = 100) => ({ s, p: [x, z], t0: 0, v: 180 });

describe("WorldStore: 연결 단위 교체 (MAP-05, T-06-21)", () => {
  it("새 epoch 의 move 가 snap 보다 먼저 오면 버려지고 준비 상태가 풀린다", () => {
    const store = new WorldStore();
    store.applyFrame(snap([rest(0), rest(1)]), 1);
    store.applyFrame(move(0, [100, 100, 500, 100], 5000), 2);
    expect(store.isReady()).toBe(false);
    expect(store.segOf(0)?.p).toEqual([100, 100]);
  });

  it("새 epoch 의 snap 은 이전 연결의 위치를 병합하지 않고 통째로 바꾼다", () => {
    const store = new WorldStore();
    store.applyFrame(snap([rest(0), rest(1)]), 1);
    store.applyFrame(move(0, [100, 100, 500, 100], 5000), 2);
    store.applyFrame(snap([rest(1, 200, 200), rest(2)]), 2);
    expect(store.isReady()).toBe(true);
    expect(store.seats()).toEqual([1, 2]);
    expect(store.segOf(1)?.p).toEqual([200, 200]);
  });

  it("낡은 epoch 의 늦은 move 는 새 연결의 snap 뒤에도 버려진다", () => {
    const store = new WorldStore();
    store.applyFrame(snap([rest(0)]), 1);
    store.applyFrame(snap([rest(0, 300, 300)]), 2);
    store.applyFrame(move(0, [300, 300, 500, 300], 9000), 1);
    expect(store.segOf(0)?.p).toEqual([300, 300]);
    expect(store.isReady()).toBe(true);
  });

  it("snap 전에 move 만 오면 준비되지 않고 아무것도 쌓이지 않는다", () => {
    const store = new WorldStore();
    store.applyFrame(move(0, [100, 100, 500, 100], 5000), 1);
    expect(store.isReady()).toBe(false);
    expect(store.seats()).toEqual([]);
  });

  it("reset 뒤에는 준비되지 않고 seat 가 없다", () => {
    const store = new WorldStore();
    store.applyFrame(snap([rest(0)]), 1);
    store.reset();
    expect(store.isReady()).toBe(false);
    expect(store.seats()).toEqual([]);
  });
});

describe("WorldStore: 등장·퇴장 seat (UI-SPEC 입장 연출)", () => {
  it("첫 snap 의 seat 는 등장 대상이 아니고, snap 뒤 move 로 처음 온 seat 만 한 번 등장한다", () => {
    const store = new WorldStore();
    store.applyFrame(snap([rest(0), rest(1)]), 1);
    expect(store.takeEntered()).toEqual([]);
    store.applyFrame(move(3, [100, 100, 400, 100], 7000), 1);
    expect(store.takeEntered()).toEqual([3]);
    expect(store.takeEntered()).toEqual([]);
  });

  it("이미 있는 seat 의 move 는 등장이 아니다", () => {
    const store = new WorldStore();
    store.applyFrame(snap([rest(0)]), 1);
    store.applyFrame(move(0, [100, 100, 400, 100], 7000), 1);
    expect(store.takeEntered()).toEqual([]);
  });

  it("같은 연결의 두 번째 snap(대기실 복귀)은 구간을 바꾸되 등장 대상을 만들지 않는다", () => {
    const store = new WorldStore();
    store.applyFrame(snap([rest(0)]), 1);
    store.applyFrame(snap([rest(0, 300, 300), rest(4)]), 1);
    expect(store.seats()).toEqual([0, 4]);
    expect(store.segOf(0)?.p).toEqual([300, 300]);
    expect(store.takeEntered()).toEqual([]);
  });

  it("retainSeats 는 view 에 없는 seat 를 지우고 지운 목록을 돌려준다", () => {
    const store = new WorldStore();
    store.applyFrame(snap([rest(0), rest(1), rest(2)]), 1);
    expect(store.retainSeats([0, 1])).toEqual([2]);
    expect(store.seats()).toEqual([0, 1]);
    expect(store.retainSeats([0, 1])).toEqual([]);
  });

  it("지운 seat 의 늦은 move 는 다시 나타나되 새 사람으로 등장 대상이 된다", () => {
    const store = new WorldStore();
    store.applyFrame(snap([rest(0), rest(2)]), 1);
    store.retainSeats([0]);
    store.applyFrame(move(2, [100, 100, 400, 100], 7000), 1);
    expect(store.seats()).toEqual([0, 2]);
    expect(store.takeEntered()).toEqual([2]);
  });

  it("retainSeats 가 지운 seat 는 등장 대기에서도 빠진다", () => {
    const store = new WorldStore();
    store.applyFrame(snap([rest(0)]), 1);
    store.applyFrame(move(3, [100, 100, 400, 100], 7000), 1);
    store.retainSeats([0]);
    expect(store.takeEntered()).toEqual([]);
  });
});

describe("WorldStore: 구독", () => {
  it("snap·move·실제로 지운 retain 마다 한 번씩 알리고, 버려진 프레임·변화 없는 retain 은 알리지 않는다", () => {
    const store = new WorldStore();
    let n = 0;
    const off = store.subscribe(() => {
      n += 1;
    });
    store.applyFrame(snap([rest(0), rest(1)]), 1);
    expect(n).toBe(1);
    store.applyFrame(move(0, [100, 100, 400, 100], 7000), 1);
    expect(n).toBe(2);
    store.retainSeats([0, 1]);
    expect(n).toBe(2);
    store.retainSeats([0]);
    expect(n).toBe(3);
    store.applyFrame(move(0, [100, 100, 400, 100], 7000), 0);
    expect(n).toBe(3);
    off();
    store.applyFrame(snap([]), 1);
    expect(n).toBe(3);
  });
});

describe("WorldStore: currentEpoch (06-13 런타임이 새 연결 첫 프레임을 알아본다)", () => {
  it("처음은 -1, snap 이 받아들여지면 그 epoch, 낡은 프레임은 바꾸지 않고, reset 하면 -1 이다", () => {
    const store = new WorldStore();
    expect(store.currentEpoch()).toBe(-1);
    store.applyFrame(snap([rest(0)]), 3);
    expect(store.currentEpoch()).toBe(3);
    store.applyFrame(snap([rest(0)]), 2);
    expect(store.currentEpoch()).toBe(3);
    store.reset();
    expect(store.currentEpoch()).toBe(-1);
  });
});

describe("WorldStore.moveSeqOf — 이 연결의 snap 뒤 자리에 적용된 move 수 (결정 0059)", () => {
  it("snap 뒤 0, 같은 epoch move 를 셀 때마다 늘고 다른 자리는 따로 센다", () => {
    const store = new WorldStore();
    store.applyFrame(snap([rest(0), rest(1)]), 1);
    expect(store.moveSeqOf(0)).toBe(0);
    store.applyFrame(move(0, [100, 100, 500, 100], 1000), 1);
    store.applyFrame(move(0, [100, 100, 100, 500], 2000), 1);
    store.applyFrame(move(1, [100, 100, 300, 100], 2000), 1);
    expect(store.moveSeqOf(0)).toBe(2);
    expect(store.moveSeqOf(1)).toBe(1);
    expect(store.moveSeqOf(9)).toBe(0);
  });

  it("낡은 epoch move·새 epoch 선행 move·준비 전 move 는 세지 않는다", () => {
    const store = new WorldStore();
    store.applyFrame(move(0, [100, 100, 500, 100], 1000), 1); // 준비 전
    expect(store.moveSeqOf(0)).toBe(0);
    store.applyFrame(snap([rest(0)]), 2);
    store.applyFrame(move(0, [100, 100, 500, 100], 1000), 1); // 낡은 epoch
    expect(store.moveSeqOf(0)).toBe(0);
    store.applyFrame(move(0, [100, 100, 500, 100], 1000), 3); // 새 epoch 가 snap 보다 먼저
    expect(store.moveSeqOf(0)).toBe(0);
  });

  it("새 snap·reset() 뒤 0 으로 돌아가고 retainSeats 로 지운 자리는 0 이다", () => {
    const store = new WorldStore();
    store.applyFrame(snap([rest(0), rest(1)]), 1);
    store.applyFrame(move(0, [100, 100, 500, 100], 1000), 1);
    store.applyFrame(move(1, [100, 100, 500, 100], 1000), 1);
    expect(store.retainSeats([0])).toEqual([1]);
    expect(store.moveSeqOf(1)).toBe(0);
    expect(store.moveSeqOf(0)).toBe(1);
    store.applyFrame(snap([rest(0)]), 1);
    expect(store.moveSeqOf(0)).toBe(0);
    store.applyFrame(move(0, [100, 100, 500, 100], 1000), 1);
    expect(store.moveSeqOf(0)).toBe(1);
    store.reset();
    expect(store.moveSeqOf(0)).toBe(0);
  });
});

describe("WorldStore: 동작 프레임 (10-03, D-9)", () => {
  const emote = (seat: number, id: "clap" | "dance", n: number) => ({ t: "emote" as const, seat, id, n });

  it("applyEmote 는 구독자(onEmote)에게 프레임을 한 번 알리고 위치 구독자는 깨우지 않는다", () => {
    const store = new WorldStore();
    store.applyFrame(snap([rest(0)]), 1);
    const onEmote = vi.fn();
    const onWorld = vi.fn();
    store.onEmote(onEmote);
    store.subscribe(onWorld);
    store.applyEmote(emote(0, "clap", 1), 1);
    expect(onEmote).toHaveBeenCalledTimes(1);
    expect(onEmote).toHaveBeenCalledWith(emote(0, "clap", 1));
    expect(onWorld).not.toHaveBeenCalled();
    expect(store.seats()).toEqual([0]);
  });

  it("더 낡은 epoch 의 프레임은 버린다. 같거나 새 epoch 는 받고 store 의 epoch 를 바꾸지 않는다", () => {
    const store = new WorldStore();
    store.applyFrame(snap([rest(0)]), 3);
    const onEmote = vi.fn();
    store.onEmote(onEmote);
    store.applyEmote(emote(0, "clap", 1), 2);
    expect(onEmote).not.toHaveBeenCalled();
    store.applyEmote(emote(0, "clap", 2), 3);
    store.applyEmote(emote(0, "dance", 3), 4);
    expect(onEmote).toHaveBeenCalledTimes(2);
    expect(store.currentEpoch()).toBe(3);
  });

  it("해제 함수는 구독을 끊고 reset() 은 구독자를 그대로 둔다", () => {
    const store = new WorldStore();
    const kept = vi.fn();
    const dropped = vi.fn();
    store.onEmote(kept);
    store.onEmote(dropped)();
    store.reset();
    store.applyEmote(emote(0, "clap", 1), 1);
    expect(kept).toHaveBeenCalledTimes(1);
    expect(dropped).not.toHaveBeenCalled();
  });

  it("마지막 프레임을 기억하지 않는다 — 늦게 구독한 쪽은 지난 동작을 받지 못한다(사건이다)", () => {
    const store = new WorldStore();
    store.applyEmote(emote(0, "clap", 1), 1);
    const late = vi.fn();
    store.onEmote(late);
    expect(late).not.toHaveBeenCalled();
  });
});

const nearSnap = (ents: { s: number; p: number[]; t0: number; v: number }[], at = 0) => ({ ...snap(ents, at), near: true as const });

describe("WorldStore: 근처 snap (15페이즈 D-02, UI-SPEC U-17)", () => {
  it("near snap 은 같은 epoch 에서 사본을 그 사람들로 통째로 바꾸고, 새로 보이는 좌석만 오름차순으로 entered 에 넣는다", () => {
    const store = new WorldStore();
    store.applyFrame(snap([rest(0), rest(1)]), 1);
    store.takeEntered();
    store.applyFrame(nearSnap([rest(0), rest(4), rest(2)]), 1);
    expect(store.seats()).toEqual([0, 2, 4]);
    expect(store.takeEntered()).toEqual([2, 4]);
  });

  it("near snap 에서 빠진 좌석은 seats·segOf·positionOf 에서 사라지고 늦은 move 는 새 사람으로 다시 나타난다", () => {
    const store = new WorldStore();
    store.applyFrame(snap([rest(0), rest(1), rest(2)]), 1);
    store.applyFrame(nearSnap([rest(0)]), 1);
    expect(store.seats()).toEqual([0]);
    expect(store.segOf(1)).toBeUndefined();
    expect(store.positionOf(2, 0)).toBeNull();
    store.takeEntered();
    store.applyFrame(move(1, [100, 100, 200, 100], 10), 1);
    expect(store.takeEntered()).toEqual([1]);
  });

  it("near 가 없는 snap(대기실 복귀·밤 진입)은 기존처럼 entered 를 비운다(회귀)", () => {
    const store = new WorldStore();
    store.applyFrame(snap([rest(0)]), 1);
    store.applyFrame(snap([rest(0), rest(3)]), 1);
    expect(store.takeEntered()).toEqual([]);
  });

  it("첫 snap(ready 전)과 새 epoch 의 near snap 은 등장 연출 없이 바로 맞춘다", () => {
    const first = new WorldStore();
    first.applyFrame(nearSnap([rest(0), rest(1)]), 1);
    expect(first.takeEntered()).toEqual([]);
    const next = new WorldStore();
    next.applyFrame(snap([rest(0)]), 1);
    next.applyFrame(nearSnap([rest(0), rest(1)]), 2);
    expect(next.seats()).toEqual([0, 1]);
    expect(next.takeEntered()).toEqual([]);
  });

  it("더 낡은 epoch 의 near snap 은 버린다", () => {
    const store = new WorldStore();
    store.applyFrame(snap([rest(0), rest(1)]), 2);
    store.applyFrame(nearSnap([rest(0)]), 1);
    expect(store.seats()).toEqual([0, 1]);
  });

  it("near snap 이후 늦게 온 move 의 좌석이 이미 snap 에 있으면 entered 에 안 들어간다", () => {
    const store = new WorldStore();
    store.applyFrame(snap([rest(0)]), 1);
    store.applyFrame(nearSnap([rest(0), rest(5)]), 1);
    store.takeEntered();
    store.applyFrame(move(5, [100, 100, 300, 100], 20), 1);
    expect(store.takeEntered()).toEqual([]);
  });

  it("near snap 은 남은 좌석의 move 수(내 이동 응답 세기)를 지우지 않는다", () => {
    const store = new WorldStore();
    store.applyFrame(snap([rest(0), rest(1)]), 1);
    store.applyFrame(move(0, [100, 100, 200, 100], 10), 1);
    expect(store.moveSeqOf(0)).toBe(1);
    store.applyFrame(nearSnap([rest(0)]), 1);
    expect(store.moveSeqOf(0)).toBe(1);
    expect(store.moveSeqOf(1)).toBe(0);
  });
});
