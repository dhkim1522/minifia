import { describe, expect, it } from "vitest";
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
