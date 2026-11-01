import { describe, expect, it } from "vitest";
import { MOVE_MIN_GAP_MS } from "../../shared/game/world";
import { createTapGate, createTapTracker, TAP_GAP_MARGIN_MS, TAP_MAX_MS, TAP_MIN_GAP_MS, TAP_SLOP_PX } from "../../src/world/input";

// 06-13 Task 1: 탭 판정은 순수 함수다(시각은 인자). UI-SPEC "터치해서 걷기" 1번·탭 간격은 서버 150ms 위에 여유 100ms(WR-04).

describe("createTapTracker (MAP-02)", () => {
  it("상수는 UI-SPEC 수치다", () => {
    expect(TAP_SLOP_PX).toBe(10);
    expect(TAP_MAX_MS).toBe(350);
    expect(TAP_MIN_GAP_MS).toBe(250);
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

describe("createTapGate (MAP-02, 서버 속도 제한 150ms 보다 크게)", () => {
  it("기본 간격은 서버 MOVE_MIN_GAP_MS 보다 여유만큼 크다 (WR-04: 같은 값이면 지터에 서버가 조용히 버린다)", () => {
    expect(MOVE_MIN_GAP_MS).toBe(150);
    expect(TAP_MIN_GAP_MS).toBeGreaterThan(MOVE_MIN_GAP_MS);
    expect(TAP_MIN_GAP_MS - MOVE_MIN_GAP_MS).toBeGreaterThanOrEqual(TAP_GAP_MARGIN_MS);
    expect(TAP_GAP_MARGIN_MS).toBeGreaterThanOrEqual(100);
  });

  it("보낸 탭 사이 도착 시각이 여유만큼 흔들려도 서버 간격(150ms) 아래로 내려가지 않는다", () => {
    const g = createTapGate();
    const sends: number[] = [];
    for (let t = 0; t < 5000; t += 37) if (g.accept(t)) sends.push(t); // 거의 연타
    expect(sends.length).toBeGreaterThan(5);
    for (let i = 1; i < sends.length; i += 1) {
      const worstCaseArrivalGap = sends[i]! - TAP_GAP_MARGIN_MS - sends[i - 1]!; // 뒤는 일찍, 앞은 늦지 않게 최악의 어긋남
      expect(worstCaseArrivalGap).toBeGreaterThanOrEqual(MOVE_MIN_GAP_MS);
    }
  });

  it("0 은 받고 249 는 거절하고 250 은 받는다", () => {
    const g = createTapGate();
    expect(g.accept(0)).toBe(true);
    expect(g.accept(149)).toBe(false);
    expect(g.accept(249)).toBe(false);
    expect(g.accept(250)).toBe(true);
  });

  it("거절한 탭은 간격 시계를 늘리지 않는다", () => {
    const g = createTapGate();
    expect(g.accept(0)).toBe(true);
    expect(g.accept(100)).toBe(false);
    expect(g.accept(250)).toBe(true);
  });

  it("간격을 인자로 바꿀 수 있다", () => {
    const g = createTapGate(1000);
    expect(g.accept(0)).toBe(true);
    expect(g.accept(999)).toBe(false);
    expect(g.accept(1000)).toBe(true);
  });
});
