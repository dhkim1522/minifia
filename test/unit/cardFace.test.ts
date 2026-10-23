import { describe, expect, it } from "vitest";
import {
  AUTO_FLIP_MS,
  autoFlipDelayMs,
  initialCardState,
  onAutoTimer,
  onTap,
  sinceStartMs,
  type CardState,
} from "../../src/net/cardFace";

const BACK: CardState = { face: "back", locked: false, seenFront: false };

describe("initialCardState", () => {
  it("시작 직후(0ms)는 뒷면이고 잠기지 않았다", () => {
    expect(initialCardState(0, true)).toEqual({ face: "back", locked: false, seenFront: false });
  });

  it("4999ms 까지는 뒷면(경계 바로 앞)", () => {
    expect(initialCardState(AUTO_FLIP_MS - 1, true)).toEqual({ face: "back", locked: false, seenFront: false });
  });

  it("5초 정각에 들어온 사람은 앞면부터이고 자동 뒤집기는 소진된 상태다", () => {
    expect(initialCardState(5_000, true)).toEqual({ face: "front", locked: true, seenFront: true });
  });

  it("5초가 한참 지나 들어와도 앞면부터", () => {
    expect(initialCardState(14_000, true)).toEqual({ face: "front", locked: true, seenFront: true });
  });

  it("역할이 없는 뷰는 늦게 들어와도 뒷면이다", () => {
    expect(initialCardState(9_000, false)).toEqual({ face: "back", locked: false, seenFront: false });
  });
});

describe("onTap", () => {
  it("뒷면을 누르면 앞면이 되고 자동 뒤집기가 소진된다(seenFront)", () => {
    expect(onTap(BACK, true)).toEqual({ face: "front", locked: true, seenFront: true });
  });

  it("앞면을 다시 누르면 뒷면으로 가려지고, seenFront 는 유지된다", () => {
    const front = onTap(BACK, true);
    expect(onTap(front, true)).toEqual({ face: "back", locked: true, seenFront: true });
  });

  it("역할이 없으면 누르기를 무시한다(같은 상태)", () => {
    expect(onTap(BACK, false)).toBe(BACK);
  });

  it("입력 상태를 바꾸지 않고 새 객체를 돌려준다", () => {
    const before: CardState = { face: "back", locked: false, seenFront: false };
    const after = onTap(before, true);
    expect(before).toEqual({ face: "back", locked: false, seenFront: false });
    expect(after).not.toBe(before);
  });
});

describe("onAutoTimer", () => {
  it("아직 누르지 않았으면 앞면으로 뒤집고 소진한다", () => {
    expect(onAutoTimer(BACK, true)).toEqual({ face: "front", locked: true, seenFront: true });
  });

  it("이미 잠겼으면(누른 적 있거나 자동이 한 번 돌았으면) 그대로다 — 자동은 한 번만", () => {
    const afterAuto = onAutoTimer(BACK, true);
    expect(onAutoTimer(afterAuto, true)).toEqual(afterAuto);
    // 사용자가 눌러 뒷면으로 가렸다면 자동이 다시 앞면으로 돌리지 않는다
    const hidden = onTap(afterAuto, true);
    expect(hidden.face).toBe("back");
    expect(onAutoTimer(hidden, true)).toEqual(hidden);
  });

  it("사용자가 먼저 눌렀다면 자동 타이머가 와도 달라지지 않는다", () => {
    const tapped = onTap(BACK, true);
    expect(onAutoTimer(tapped, true)).toEqual(tapped);
  });

  it("역할이 없으면 자동으로도 뒤집히지 않는다", () => {
    expect(onAutoTimer(BACK, false)).toEqual(BACK);
  });
});

describe("시각 계산(서버 시각 = 로컬 + 오프셋)", () => {
  // 역할 확인 15초: 마감 20000, 시작 t0 = 5000, 자동 뒤집기는 10000.
  it("sinceStartMs: 시작 뒤 흐른 시간", () => {
    expect(sinceStartMs(20_000, 15_000, 0, 7_000)).toBe(2_000);
  });

  it("autoFlipDelayMs: 자동 뒤집기까지 남은 시간", () => {
    expect(autoFlipDelayMs(20_000, 15_000, 0, 7_000)).toBe(3_000);
  });

  it("오프셋 1000: 서버가 1초 앞서 있으므로 더 흐른 것으로 센다", () => {
    expect(sinceStartMs(20_000, 15_000, 1_000, 7_000)).toBe(3_000);
    expect(autoFlipDelayMs(20_000, 15_000, 1_000, 7_000)).toBe(2_000);
  });

  it("이미 5초가 지났으면 autoFlipDelayMs 는 0 이하다", () => {
    expect(autoFlipDelayMs(20_000, 15_000, 0, 10_000)).toBeLessThanOrEqual(0);
    expect(autoFlipDelayMs(20_000, 15_000, 0, 12_000)).toBe(-2_000);
  });

  it("sinceStartMs 가 5000 이상이면 initialCardState 는 앞면(재접속 경로와 맞물림)", () => {
    const since = sinceStartMs(20_000, 15_000, 0, 10_000);
    expect(since).toBe(5_000);
    expect(initialCardState(since, true).face).toBe("front");
  });
});
