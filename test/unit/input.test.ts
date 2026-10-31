import { describe, expect, it } from "vitest";
import { createTapGate, createTapTracker, TAP_MAX_MS, TAP_MIN_GAP_MS, TAP_SLOP_PX } from "../../src/world/input";

// 06-13 Task 1: 탭 판정은 순수 함수다(시각은 인자). UI-SPEC "터치해서 걷기" 1번·탭 간격 150ms.

describe("createTapTracker (MAP-02)", () => {
  it("상수는 UI-SPEC 수치다", () => {
    expect(TAP_SLOP_PX).toBe(10);
    expect(TAP_MAX_MS).toBe(350);
    expect(TAP_MIN_GAP_MS).toBe(150);
  });

  it("5px 움직이고 200ms 안에 뗀 손가락은 뗀 자리의 탭이다", () => {
    const t = createTapTracker();
    t.down(1, 100, 100, 0);
    expect(t.up(1, 105, 100, 200)).toEqual({ x: 105, y: 100 });
  });

  it("10px 이상 움직이면 탭이 아니다", () => {
    const t = createTapTracker();
    t.down(1, 100, 100, 0);
    t.move(1, 111, 100);
    expect(t.up(1, 111, 100, 100)).toBeNull();
  });

  it("움직임은 가장 멀리 간 값으로 센다: 10px 나갔다 돌아와도 탭이 아니다", () => {
    const t = createTapTracker();
    t.down(1, 100, 100, 0);
    t.move(1, 100, 112);
    t.move(1, 100, 101);
    expect(t.up(1, 100, 101, 100)).toBeNull();
  });

  it("뗀 자리가 시작에서 10px 이상이면 move 없이도 탭이 아니다", () => {
    const t = createTapTracker();
    t.down(1, 100, 100, 0);
    expect(t.up(1, 100, 110, 100)).toBeNull();
  });

  it("350ms 는 탭이고 351ms 는 탭이 아니다", () => {
    const t = createTapTracker();
    t.down(1, 0, 0, 0);
    expect(t.up(1, 0, 0, 350)).toEqual({ x: 0, y: 0 });
    t.down(1, 0, 0, 1000);
    expect(t.up(1, 0, 0, 1351)).toBeNull();
  });

  it("두 번째 손가락은 무시한다: 첫 손가락의 탭 판정을 바꾸지 않는다", () => {
    const t = createTapTracker();
    t.down(1, 100, 100, 0);
    t.down(2, 300, 300, 10);
    expect(t.up(2, 300, 300, 60)).toBeNull();
    expect(t.up(1, 100, 100, 80)).toEqual({ x: 100, y: 100 });
  });

  it("cancel 한 손가락은 뗄 때 탭이 아니고 다음 탭은 새로 센다", () => {
    const t = createTapTracker();
    t.down(1, 0, 0, 0);
    t.cancel(1);
    expect(t.up(1, 0, 0, 50)).toBeNull();
    t.down(3, 5, 5, 100);
    expect(t.up(3, 5, 5, 150)).toEqual({ x: 5, y: 5 });
  });

  it("누르지 않은 손가락의 up 은 null 이다", () => {
    const t = createTapTracker();
    expect(t.up(9, 0, 0, 10)).toBeNull();
  });
});

describe("createTapGate (MAP-02, 서버 속도 제한과 같은 150ms)", () => {
  it("0 은 받고 149 는 거절하고 150 은 받는다", () => {
    const g = createTapGate();
    expect(g.accept(0)).toBe(true);
    expect(g.accept(149)).toBe(false);
    expect(g.accept(150)).toBe(true);
  });

  it("거절한 탭은 간격 시계를 늘리지 않는다", () => {
    const g = createTapGate();
    expect(g.accept(0)).toBe(true);
    expect(g.accept(100)).toBe(false);
    expect(g.accept(150)).toBe(true);
  });

  it("간격을 인자로 바꿀 수 있다", () => {
    const g = createTapGate(1000);
    expect(g.accept(0)).toBe(true);
    expect(g.accept(999)).toBe(false);
    expect(g.accept(1000)).toBe(true);
  });
});
