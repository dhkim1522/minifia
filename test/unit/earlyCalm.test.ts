import { describe, expect, it } from "vitest";
import type { PhaseId, RoomView } from "../../shared/protocol";
import { earlyCalmNext, type EarlyCalmMemo } from "../../src/net/earlyCalm";

// 조기 진행 감지(23-11, P23-23·24, D-11). 서버는 phaseEndsAt 만 줄이고 phaseDurationMs 는 그대로다.
// 한 단계(phase, 일차, 판, 연결) 안에서 마감이 작아지면 그 단계 동안 true — 막대·링 색을 calm 으로 고정하는 근거다.

function v(phase: PhaseId, endsAt: number | null, o: { n?: number; round?: number } = {}): RoomView {
  return {
    code: "0042",
    phase,
    phaseEndsAt: endsAt,
    phaseDurationMs: endsAt === null ? null : 30_000,
    serverNow: 0,
    minPlayers: 4,
    maxPlayers: 8,
    players: [],
    me: { seat: 0, isHost: false },
    day: { n: o.n ?? 1, roles: [] },
    ...(o.round !== undefined ? { round: o.round } : {}),
  } as RoomView;
}

function run(views: RoomView[], epoch = 1): boolean[] {
  let memo: EarlyCalmMemo | null = null;
  return views.map((x) => {
    memo = earlyCalmNext(memo, x, epoch);
    return memo.early;
  });
}

describe("earlyCalmNext 순수 판정", () => {
  it("첫 프레임은 false 다(재접속·새로고침 첫 프레임)", () => {
    expect(run([v("verdict", 5_000)])).toEqual([false]);
  });

  it("같은 단계에서 마감이 작아지면 true", () => {
    expect(run([v("verdict", 30_000), v("verdict", 1_500)])).toEqual([false, true]);
  });

  it("같은 값·커지는 값만 보이면 false 를 유지한다", () => {
    expect(run([v("verdict", 30_000), v("verdict", 30_000), v("verdict", 31_000)])).toEqual([false, false, false]);
  });

  it("그 뒤 같은 단계에서 마감이 다시 커져도(번복) true 를 유지한다", () => {
    expect(run([v("verdict", 30_000), v("verdict", 1_500), v("verdict", 3_000), v("verdict", 3_000)])).toEqual([false, true, true, true]);
  });

  it("단계가 바뀌면 해제되고 새 단계 첫 프레임은 false 다", () => {
    expect(run([v("verdict", 30_000), v("verdict", 1_500), v("night", 30_000), v("night", 29_000)])).toEqual([false, true, false, true]);
    expect(run([v("verdict", 30_000), v("verdict", 1_500), v("night", 30_000), v("night", 30_000)])).toEqual([false, true, false, false]);
  });

  it("일차·판이 바뀌어도 해제된다(같은 단계 이름의 다음 날)", () => {
    expect(run([v("night", 30_000, { n: 1 }), v("night", 1_000, { n: 1 }), v("night", 30_000, { n: 2 })])).toEqual([false, true, false]);
    expect(run([v("night", 30_000, { round: 1 }), v("night", 1_000, { round: 1 }), v("night", 30_000, { round: 2 })])).toEqual([false, true, false]);
  });

  it("마감이 없는 프레임은 판정하지 않고 값을 건드리지 않는다", () => {
    expect(run([v("verdict", 30_000), v("verdict", null), v("verdict", 29_000)])).toEqual([false, false, false]);
  });

  it("연결 번호가 바뀐 첫 프레임에는 켜지지 않는다", () => {
    let memo: EarlyCalmMemo | null = null;
    memo = earlyCalmNext(memo, v("verdict", 30_000), 1);
    memo = earlyCalmNext(memo, v("verdict", 1_500), 1);
    expect(memo.early).toBe(true);
    memo = earlyCalmNext(memo, v("verdict", 1_000), 2);
    expect(memo.early).toBe(false);
  });
});
