import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CandidateVoteLine, PhaseId, RoomView } from "../../shared/protocol";
import { revealPlan, revealStateAt } from "../../src/game/verdict";
import { useRevealState } from "../../src/net/useRevealState";

// 후보 선택 공개(candidateVoteReveal) 상태 (04-19). Task 1: useRevealState 훅. Task 2: RoomScreen 한 경로(아래).
const connectionMock = vi.hoisted(() => ({ current: null as unknown }));
vi.mock("../../src/net/useRoomConnection", () => ({
  useRoomConnection: () => connectionMock.current,
}));

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

// ---- 공통 입력 ----
/** 공개 단계 시작의 서버 시각 */
const START = 1_700_000_000_000;
const DURATION = 4000;

const NAMES: Record<number, string> = { 0: "지우", 1: "하윤", 2: "민지", 3: "도현", 4: "서연" };

interface ViewOpts {
  phase?: PhaseId;
  votes?: CandidateVoteLine[];
  /** voteLog 의 일차(기본 1). day.n 과 다르면 그 줄은 쓰지 않는다 */
  logN?: number;
  dayN?: number;
  noCand?: boolean;
  dead?: number[];
  allies?: number[];
  players?: number;
  spectate?: boolean;
}

function makeView(o: ViewOpts = {}): RoomView {
  const dead = o.dead ?? [];
  const count = o.players ?? 5;
  const me: RoomView["me"] = { seat: 0, isHost: false, role: o.allies ? "mafia" : "citizen" };
  if (o.allies) me.allies = o.allies;
  return {
    code: "0042",
    phase: o.phase ?? "candidateVoteReveal",
    phaseEndsAt: START + DURATION,
    phaseDurationMs: DURATION,
    serverNow: START,
    minPlayers: 4,
    maxPlayers: 8,
    players: Array.from({ length: count }, (_, seat) => ({
      seat,
      nickname: NAMES[seat] ?? `사람${seat}`,
      connected: true,
      isHost: seat === 0,
      ...(dead.includes(seat) ? { alive: false } : {}),
    })),
    me,
    day: {
      n: o.dayN ?? 1,
      roles: ["mafia", "police", "citizen"],
      claimLog: [],
      voteLog: [
        {
          n: o.logN ?? 1,
          exec: { yes: 3, no: 1, passed: true },
          ...(o.noCand ? {} : { cand: { votes: o.votes ?? [] } }),
        },
      ],
    },
  };
}

/** 다섯 명이 던진 표: 서버가 정한 순서. 도현(3)이 3표로 유일한 최다 */
const VOTES: CandidateVoteLine[] = [
  { seat: 1, target: 3 },
  { seat: 2, target: 3 },
  { seat: 0, target: 1 },
  { seat: 4, target: 3 },
  { seat: 3, target: 2 },
];

/** 다섯 슬롯(500ms) 시간표의 경계: 시작 200 뒤 슬롯마다 시작·닿음(+280)·사라짐 끝(+400), 마지막 슬롯 끝 2700 */
const BOUNDARIES = (() => {
  const plan = revealPlan(VOTES, START);
  const all = new Set<number>([plan.endMs]);
  for (const s of plan.steps) {
    all.add(s.startMs);
    all.add(s.touchMs);
    all.add(s.fadeEndMs);
  }
  return [...all].sort((a, b) => a - b);
})();

describe("useRevealState (VOTE-02, D-20, D-31, 결정 0036-5)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it("단계가 candidateVoteReveal 이 아니면 null 이고 타이머도 없다", () => {
    vi.setSystemTime(START);
    const { result } = renderHook(() => useRevealState(makeView({ phase: "candidateVote", votes: VOTES }), 0));
    expect(result.current).toBeNull();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("시계를 단계 시작 + t 로 두면 revealStateAt(plan, 시작 + t) 와 같은 상태·문구를 준다. 서버 시각 = Date.now() + offset", () => {
    const offset = 250; // 서버가 로컬보다 250ms 앞선다
    for (const t of [0, 199, 200, 479, 480, 700, 2200, 2699, 2700, 3900]) {
      vi.setSystemTime(START + t - offset);
      const { result, unmount } = renderHook(() => useRevealState(makeView({ votes: VOTES }), offset));
      const expected = revealStateAt(revealPlan(VOTES, START), START + t);
      expect(result.current?.state).toEqual(expected);
      unmount();
    }
  });

  it("경계 시각마다 정확히 한 번만 다시 그린다(사이에는 그리지 않는다)", () => {
    vi.setSystemTime(START);
    let renders = 0;
    const { result } = renderHook(() => {
      renders += 1;
      return useRevealState(makeView({ votes: VOTES }), 0);
    });
    expect(renders).toBe(1);
    expect(result.current?.state.current).toBeNull();
    let now = START;
    let expectedRenders = 1;
    for (const boundary of BOUNDARIES) {
      // 경계 1ms 전까지는 다시 그리지 않는다
      act(() => {
        vi.advanceTimersByTime(boundary - 1 - now);
      });
      now = boundary - 1;
      expect(renders).toBe(expectedRenders);
      act(() => {
        vi.advanceTimersByTime(1);
      });
      now = boundary;
      expectedRenders += 1;
      expect(renders).toBe(expectedRenders);
      expect(result.current?.state).toEqual(revealStateAt(revealPlan(VOTES, START), boundary));
    }
    // 마지막 경계(끝 상태) 뒤에는 더 그리지 않는다
    expect(result.current?.state.ended).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(renders).toBe(expectedRenders);
  });

  it("칩 수는 닿는 시각(280ms)에 오르고 팝은 다음 화살표 시작에 풀린다", () => {
    vi.setSystemTime(START);
    const { result } = renderHook(() => useRevealState(makeView({ votes: VOTES }), 0));
    act(() => {
      vi.advanceTimersByTime(479);
    });
    expect(result.current?.state.counts).toEqual({});
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(result.current?.state.counts).toEqual({ 3: 1 });
    expect(result.current?.state.pop).toBe(3);
    act(() => {
      vi.advanceTimersByTime(220); // 다음 화살표 시작 = 시작 + 700
    });
    expect(result.current?.state.pop).toBeNull();
    expect(result.current?.state.counts).toEqual({ 3: 1 });
  });

  it("중간 합류(시작 + 3000ms 에 첫 렌더): 지난 화살표를 재생하지 않고 그 시각의 상태, 남은 경계에서만 다시 그린다", () => {
    vi.setSystemTime(START + 3000);
    let renders = 0;
    const { result } = renderHook(() => {
      renders += 1;
      return useRevealState(makeView({ votes: VOTES }), 0);
    });
    expect(renders).toBe(1);
    expect(result.current?.state.counts).toEqual({ 1: 1, 2: 1, 3: 3 });
    expect(result.current?.state.ended).toBe(true);
    expect(result.current?.state.arrow).toBeNull();
    expect(vi.getTimerCount()).toBe(0);
    // 시작 + 1000 합류: 첫 두 슬롯 + 셋째 칩이 이미 올라 있고 다음 경계(셋째 닿음 이후)부터만 그린다
    cleanup();
    vi.setSystemTime(START + 1000);
    renders = 0;
    const mid = renderHook(() => {
      renders += 1;
      return useRevealState(makeView({ votes: VOTES }), 0);
    });
    expect(mid.result.current?.state).toEqual(revealStateAt(revealPlan(VOTES, START), START + 1000));
    expect(mid.result.current?.state.counts).toEqual({ 3: 2 });
    const before = renders;
    act(() => {
      vi.advanceTimersByTime(100);
    });
    expect(renders).toBe(before + 1); // 시작 + 1100 = 둘째 화살표가 사라지는 끝
  });

  it("순서 보존: 받은 votes 배열 순서 그대로 문구가 나온다. 같은 득표 분포·다른 순서는 다른 첫 문구를 준다 (T-04-53)", () => {
    const reordered: CandidateVoteLine[] = [VOTES[2], VOTES[4], VOTES[0], VOTES[3], VOTES[1]];
    const captionAt = (votes: CandidateVoteLine[], t: number): string | undefined => {
      cleanup();
      vi.setSystemTime(START + t);
      const { result } = renderHook(() => useRevealState(makeView({ votes }), 0));
      return result.current?.caption?.title;
    };
    expect(captionAt(VOTES, 250)).toBe("하윤님이 도현님을 골랐어요");
    expect(captionAt(reordered, 250)).toBe("지우님이 하윤님을 골랐어요");
    // 셋째 화살표(시작 + 1200): 받은 배열의 index 2 줄 그대로
    expect(captionAt(VOTES, 1250)).toBe("지우님이 하윤님을 골랐어요");
    expect(captionAt(reordered, 1250)).toBe("하윤님이 도현님을 골랐어요");
  });

  it("같은 votes·같은 시작이면 view 객체가 바뀌어도 plan 이 새로 만들어지지 않는다(안정 키)", () => {
    vi.setSystemTime(START);
    const { result, rerender } = renderHook(({ v }) => useRevealState(v, 0), { initialProps: { v: makeView({ votes: VOTES }) } });
    const plan = result.current?.plan;
    expect(plan).toBeDefined();
    rerender({ v: makeView({ votes: VOTES.map((x) => ({ ...x })) }) });
    expect(result.current?.plan).toBe(plan);
    rerender({ v: makeView({ votes: [...VOTES].reverse() }) });
    expect(result.current?.plan).not.toBe(plan);
  });

  it("그날(n) 줄의 cand.votes 만 쓴다. 줄이 없거나 cand 가 없으면 빈 배열(연출 없음, 끝 상태)", () => {
    vi.setSystemTime(START + 100);
    const other = renderHook(() => useRevealState(makeView({ votes: VOTES, logN: 1, dayN: 2 }), 0));
    expect(other.result.current?.plan.steps.length).toBe(0);
    expect(other.result.current?.state.outcome).toBe("none");
    const noCand = renderHook(() => useRevealState(makeView({ noCand: true }), 0));
    expect(noCand.result.current?.plan.steps.length).toBe(0);
    expect(noCand.result.current?.caption?.title).toBe("투표한 사람이 없어요");
  });

  it("단계를 벗어나면 null 이 되고 대기 중인 타이머를 정리한다. 언마운트도 정리한다", () => {
    vi.setSystemTime(START);
    const { result, rerender, unmount } = renderHook(({ v }) => useRevealState(v, 0), { initialProps: { v: makeView({ votes: VOTES }) } });
    expect(vi.getTimerCount()).toBe(1);
    rerender({ v: makeView({ phase: "defense", votes: VOTES }) });
    expect(result.current).toBeNull();
    expect(vi.getTimerCount()).toBe(0);
    rerender({ v: makeView({ votes: VOTES }) });
    expect(vi.getTimerCount()).toBe(1);
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
});
