import { describe, expect, it } from "vitest";
import { SEAT_COUNT, seatLayout } from "../../shared/seatLayout";

const seats = Array.from({ length: SEAT_COUNT }, (_, i) => i);

describe("seatLayout", () => {
  it("내 자리는 맨 아래 가운데에 가장 크고 앞에 놓인다", () => {
    const p = seatLayout(3, 3);
    expect(p.slot).toBe(0);
    expect(p.x).toBeCloseTo(50);
    expect(p.y).toBeCloseTo(72);
    expect(p.scale).toBeCloseTo(1);
    expect(p.z).toBe(10);
    expect(p.depth).toBeCloseTo(1);
  });

  it("맞은편 자리는 맨 위 가운데에 작게, 맨 뒤에 놓인다", () => {
    const p = seatLayout(7, 3);
    expect(p.slot).toBe(4);
    expect(p.x).toBeCloseTo(50);
    expect(p.y).toBeCloseTo(28);
    expect(p.scale).toBeCloseTo(0.62);
    expect(p.z).toBe(0);
    expect(p.depth).toBeCloseTo(0);
  });

  it.each(seats)("mySeat %i 에서 8자리 좌표가 모두 다르고 slot 이 0~7 을 한 번씩 쓴다", (mySeat) => {
    const positions = seats.map((seat) => seatLayout(seat, mySeat));
    expect(positions.map((p) => p.slot).sort((a, b) => a - b)).toEqual(seats);
    const coords = new Set(positions.map((p) => `${p.x.toFixed(4)},${p.y.toFixed(4)}`));
    expect(coords.size).toBe(SEAT_COUNT);
  });

  it.each(seats)("mySeat %i 에서도 이웃 자리의 slot 차이는 항상 1(mod 8)이다", (mySeat) => {
    for (const seat of seats) {
      const a = seatLayout(seat, mySeat).slot;
      const b = seatLayout((seat + 1) % SEAT_COUNT, mySeat).slot;
      expect((b - a + SEAT_COUNT) % SEAT_COUNT).toBe(1);
    }
  });

  it("slot k 와 slot 8-k 는 x 가 50 을 기준으로 대칭이고 y·scale 이 같다", () => {
    for (let k = 1; k < SEAT_COUNT / 2; k += 1) {
      const left = seatLayout(k, 0);
      const right = seatLayout(SEAT_COUNT - k, 0);
      expect(left.x + right.x).toBeCloseTo(100);
      expect(left.y).toBeCloseTo(right.y);
      expect(left.scale).toBeCloseTo(right.scale);
    }
  });

  it("rx, ry 를 바꾸면 타원 크기가 따라간다", () => {
    const p = seatLayout(0, 0, SEAT_COUNT, 30, 10);
    expect(p.y).toBeCloseTo(60);
  });
});
