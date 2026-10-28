import { act, cleanup, fireEvent, render, renderHook, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CandidateVoteLine, PhaseId, RoomView } from "../../shared/protocol";
import { readFileSync } from "node:fs";
import { CLINCH_BEAT_MS, CLINCH_VIBRATE_MS, VERDICT_TEXT, clinchBeat, revealIntroHint, revealPlan, revealStateAt } from "../../src/game/verdict";
import { useRevealState } from "../../src/net/useRevealState";
import type { RoomConnection } from "../../src/net/useRoomConnection";

// 후보 선택 공개(candidateVoteReveal) 상태 (04-19). Task 1: useRevealState 훅. Task 2: RoomScreen 한 경로(아래).
const connectionMock = vi.hoisted(() => ({ current: null as unknown }));
vi.mock("../../src/net/useRoomConnection", () => ({
  useRoomConnection: () => connectionMock.current,
}));

const { RoomScreen } = await import("../../src/screens/RoomScreen");

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
  // 확정 두근(700ms)이 끝나 느린 박동으로 넘어가는 시각도 경계다(04-20)
  if (plan.clinch !== null) all.add(plan.clinch.atMs + CLINCH_BEAT_MS);
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

// ---- Task 2: RoomScreen 한 경로 (candidateVoteReveal 연결) ----
function conn(view: RoomView, over: Partial<RoomConnection> = {}): RoomConnection {
  return {
    status: "open",
    banner: "hidden",
    view,
    offset: 0,
    epoch: 1,
    removedReason: null,
    canSend: true,
    send: vi.fn(() => true),
    onEvent: vi.fn(() => () => {}),
    reconnect: vi.fn(),
    retry: vi.fn(),
    ...over,
  };
}

/** 서버 시각 START + t 에서 RoomScreen 을 그린다. 이후 vi.advanceTimersByTime 이 시계를 같이 흘린다. */
function renderAt(t: number, view: RoomView, over: Partial<RoomConnection> = {}) {
  vi.useFakeTimers();
  vi.setSystemTime(START + t);
  connectionMock.current = conn(view, over);
  const utils = render(<RoomScreen code="0042" token={"t".repeat(43)} onExit={vi.fn()} />);
  const rerenderRoom = (v: RoomView, o: Partial<RoomConnection> = {}) => {
    connectionMock.current = conn(v, o);
    utils.rerender(<RoomScreen code="0042" token={"t".repeat(43)} onExit={vi.fn()} />);
  };
  const advance = (ms: number) =>
    act(() => {
      vi.advanceTimersByTime(ms);
    });
  return { ...utils, rerenderRoom, advance, send: (connectionMock.current as RoomConnection).send as ReturnType<typeof vi.fn> };
}

const panelOf = (c: HTMLElement) => c.querySelector<HTMLElement>(".mf-dayscene__panel")!;
const chipOf = (c: HTMLElement, n: number) => c.querySelector<HTMLElement>(`.mf-vchip[data-seat="${n}"]`);
const seatOf = (c: HTMLElement, n: number) => c.querySelector<HTMLElement>(`.mf-dt__seat[data-seat="${n}"]`)!;
const amberSeats = (c: HTMLElement) =>
  Array.from(c.querySelectorAll<HTMLElement>("img.mf-figure--halo-amber")).map((img) => Number(img.closest<HTMLElement>(".mf-dt__seat")!.dataset.seat));
const allHalos = (c: HTMLElement) => c.querySelectorAll('img[class*="mf-figure--halo"]').length;
const titleOf = (c: HTMLElement) => panelOf(c).querySelector("h2")?.textContent;
const hintOf = (c: HTMLElement) => panelOf(c).querySelector("p")?.textContent;
const verdictLive = (c: HTMLElement) => c.querySelector<HTMLElement>(".mf-dayscene p.mf-sr-only[aria-live='polite']");

describe("candidateVoteReveal 화면 한 경로 (VOTE-02, D-07, D-20, D-31)", () => {
  beforeEach(() => {
    cleanup();
  });

  it("연결 중… 이 아니라 낮 테이블: 헤더 `낮 · 투표 공개`/`1일차`, 하단은 제목+안내뿐(버튼·알약 없음), 타이머 calm, 단계 안내 `투표 공개`", () => {
    const { container } = renderAt(0, makeView({ votes: VOTES }));
    expect(screen.queryByText("연결 중…")).toBeNull();
    expect(screen.queryByRole("heading", { name: "낮 · 투표 공개" })).not.toBeNull();
    expect(screen.queryByText("1일차")).not.toBeNull();
    // 첫 화살표 전(200ms)에는 기본 제목
    expect(titleOf(container)).toBe(VERDICT_TEXT.revealIntroTitle);
    expect(hintOf(container)).toBe(revealIntroHint(5));
    expect(panelOf(container).querySelectorAll("button, [role=status]").length).toBe(0);
    expect(container.querySelector(".mf-timer--urgent")).toBeNull();
    expect(container.querySelector<HTMLElement>(".mf-room > p.mf-sr-only[aria-live]")?.textContent).toBe("투표 공개");
    // 하단 래퍼는 aria-live 를 끈다(빠른 교체를 읽지 않는다)
    expect(panelOf(container).querySelector("[aria-live='off']")).not.toBeNull();
    expect(container.querySelectorAll(".mf-vchip").length).toBe(0);
    expect(allHalos(container)).toBe(0);
  });

  it("candidateVote → 공개에서 테이블(.mf-dt)과 장면 래퍼는 같은 DOM 노드다", () => {
    const r = renderAt(0, makeView({ phase: "candidateVote", votes: VOTES }));
    const scene = r.container.querySelector(".mf-phase-enter");
    const table = r.container.querySelector(".mf-dt");
    expect(table).not.toBeNull();
    r.rerenderRoom(makeView({ votes: VOTES }));
    expect(r.container.querySelector(".mf-phase-enter") === scene).toBe(true);
    expect(r.container.querySelector(".mf-dt") === table).toBe(true);
  });

  it("좌석은 버튼이 아니다: 탭해도 기록 카드가 열리지 않고 아무것도 보내지 않는다", () => {
    const { container, send } = renderAt(1500, makeView({ votes: VOTES }));
    expect(container.querySelectorAll(".mf-dt button").length).toBe(0);
    fireEvent.click(seatOf(container, 3));
    expect(document.querySelector("dialog[open]")).toBeNull();
    expect(send).not.toHaveBeenCalled();
  });

  it("닿은 순서대로 칩 수가 오른다: 첫 표 직후 도현 1(유일한 선두라 lead + 앰버 후광), 문구는 `하윤님이 도현님을 골랐어요`/`1번째 표 · 모두 5표`", () => {
    const { container } = renderAt(480, makeView({ votes: VOTES }));
    expect(chipOf(container, 3)?.textContent).toBe("1");
    expect(chipOf(container, 3)?.className).toContain("mf-vchip--lead");
    expect(container.querySelectorAll(".mf-vchip").length).toBe(1);
    expect(amberSeats(container)).toEqual([3]);
    expect(titleOf(container)).toBe("하윤님이 도현님을 골랐어요");
    expect(hintOf(container)).toBe("1번째 표 · 모두 5표");
  });

  it("방금 닿은 대상은 pop + 앰버 후광, 유일한 선두는 lead + 앰버 후광, 그 밖은 plain(후광 없음)", () => {
    // 셋째 표(지우 → 하윤)가 닿은 직후: 하윤 1 = pop, 도현 2 = lead
    const { container, advance } = renderAt(1500, makeView({ votes: VOTES }));
    expect(chipOf(container, 1)?.className).toContain("mf-vchip--pop");
    expect(chipOf(container, 1)?.textContent).toBe("1");
    expect(chipOf(container, 3)?.className).toContain("mf-vchip--lead");
    expect(chipOf(container, 3)?.textContent).toBe("2");
    expect(amberSeats(container).sort()).toEqual([1, 3]);
    expect(titleOf(container)).toBe("지우님이 하윤님을 골랐어요");
    expect(hintOf(container)).toBe("3번째 표 · 모두 5표");
    // 다음 화살표가 시작하면(1700) 팝이 풀려 하윤 칩은 plain, 앰버 후광은 선두만
    advance(200);
    expect(chipOf(container, 1)?.className).toContain("mf-vchip--plain");
    expect(chipOf(container, 3)?.className).toContain("mf-vchip--lead");
    expect(amberSeats(container)).toEqual([3]);
    expect(titleOf(container)).toBe("서연님이 도현님을 골랐어요");
    expect(hintOf(container)).toBe("4번째 표 · 모두 5표");
  });

  it("시간이 흐르면 같은 화면에서 끝 상태까지 간다: 도현 3표 lead 앰버 후광 하나, 나머지 plain, 하단 `도현님이 가장 많은 표를 받았어요`/`3표 · 곧 최후 변론이 시작돼요`", () => {
    const { container, advance } = renderAt(0, makeView({ votes: VOTES }));
    const table = container.querySelector(".mf-dt");
    expect(verdictLive(container)?.textContent ?? "").toBe("");
    advance(2699);
    expect(titleOf(container)).toBe("도현님이 민지님을 골랐어요");
    expect(verdictLive(container)?.textContent ?? "").toBe(""); // 끝 상태 전에는 읽지 않는다
    advance(1);
    expect(container.querySelector(".mf-dt") === table).toBe(true);
    expect(titleOf(container)).toBe("도현님이 가장 많은 표를 받았어요");
    expect(hintOf(container)).toBe("3표 · 곧 최후 변론이 시작돼요");
    expect(chipOf(container, 3)?.textContent).toBe("3");
    expect(chipOf(container, 3)?.className).toContain("mf-vchip--lead");
    expect(chipOf(container, 1)?.className).toContain("mf-vchip--plain");
    expect(chipOf(container, 2)?.className).toContain("mf-vchip--plain");
    expect(chipOf(container, 0)).toBeNull();
    expect(chipOf(container, 4)).toBeNull();
    expect(amberSeats(container)).toEqual([3]);
    // 읽기용 안내: 끝 상태에서 한 문장
    expect(verdictLive(container)?.textContent).toBe("도현님이 3표로 가장 많은 표를 받았어요");
    expect(container.querySelectorAll(".mf-dayscene p.mf-sr-only[aria-live='polite']").length).toBe(1);
  });

  it("동률: `표가 갈렸어요`, 칩만 남고 앰버 후광·큰 칩 없음, 읽기 문장도 동률", () => {
    const votes: CandidateVoteLine[] = [
      { seat: 1, target: 2 },
      { seat: 2, target: 3 },
      { seat: 3, target: 2 },
      { seat: 4, target: 3 },
    ];
    const { container } = renderAt(2800, makeView({ votes }));
    expect(titleOf(container)).toBe("표가 갈렸어요");
    expect(hintOf(container)).toBe("동률이라 처형하지 않아요 · 곧 밤이 시작돼요");
    expect(chipOf(container, 2)?.textContent).toBe("2");
    expect(chipOf(container, 3)?.textContent).toBe("2");
    expect(container.querySelectorAll(".mf-vchip--lead, .mf-vchip--beat, .mf-vchip--pop").length).toBe(0);
    expect(amberSeats(container)).toEqual([]);
    expect(allHalos(container)).toBe(0);
    expect(verdictLive(container)?.textContent).toBe("표가 갈렸어요. 동률이라 처형하지 않아요");
  });

  it("던진 표 0: `투표한 사람이 없어요`/`던진 표가 없어요 · 곧 밤이 시작돼요`, 칩 0, 후광 0", () => {
    const { container } = renderAt(100, makeView({ votes: [] }));
    expect(titleOf(container)).toBe("투표한 사람이 없어요");
    expect(hintOf(container)).toBe("던진 표가 없어요 · 곧 밤이 시작돼요");
    expect(container.querySelectorAll(".mf-vchip").length).toBe(0);
    expect(allHalos(container)).toBe(0);
    expect(verdictLive(container)?.textContent).toBe("투표한 사람이 없어요");
  });

  it("서버 순서가 바뀌어도(같은 득표 분포) 화면은 받은 배열 순서를 따른다 (T-04-53)", () => {
    const reordered: CandidateVoteLine[] = [VOTES[2], VOTES[4], VOTES[0], VOTES[3], VOTES[1]];
    const a = renderAt(480, makeView({ votes: VOTES }));
    expect(titleOf(a.container)).toBe("하윤님이 도현님을 골랐어요");
    a.unmount();
    const b = renderAt(480, makeView({ votes: reordered }));
    expect(titleOf(b.container)).toBe("지우님이 하윤님을 골랐어요");
    expect(chipOf(b.container, 1)?.textContent).toBe("1");
    expect(chipOf(b.container, 3)).toBeNull();
  });

  it("중간 합류(단계 시작 + 3000ms 에 첫 렌더): 지난 화살표를 재생하지 않고 그 시각의 칩 수로 시작한다", () => {
    const { container } = renderAt(3000, makeView({ votes: VOTES }));
    expect(chipOf(container, 3)?.textContent).toBe("3");
    expect(chipOf(container, 1)?.textContent).toBe("1");
    expect(chipOf(container, 2)?.textContent).toBe("1");
    expect(titleOf(container)).toBe("도현님이 가장 많은 표를 받았어요");
    expect(amberSeats(container)).toEqual([3]);
  });

  it("후광 상한 3: 마피아 viewer 의 동료 진홍이 앰버와 합쳐 3 을 넘으면 진홍부터 꺼지고 마름모는 남는다 (결정 0030)", () => {
    // 1500ms: 앰버 둘(하윤 pop, 도현 lead). 동료 하윤(1)·민지(2)·서연(4): 하윤은 앰버가 이겨 한 자리에 하나, 남은 진홍 둘 중 큰 번호가 꺼진다
    const { container } = renderAt(1500, makeView({ votes: VOTES, allies: [1, 2, 4] }));
    expect(amberSeats(container).sort()).toEqual([1, 3]);
    expect(seatOf(container, 2).querySelector("img.mf-figure--halo-crimson")).not.toBeNull();
    expect(seatOf(container, 4).querySelector("img.mf-figure--halo-crimson")).toBeNull();
    expect(allHalos(container)).toBe(3);
    expect(container.querySelectorAll(".mf-dt__mark").length).toBe(3);
  });

  it("끝 상태에서 마피아 viewer 의 동료 진홍 후광은 앰버(1)와 함께 남는다", () => {
    const { container } = renderAt(2800, makeView({ votes: VOTES, allies: [1] }));
    expect(amberSeats(container)).toEqual([3]);
    expect(seatOf(container, 1).querySelector("img.mf-figure--halo-crimson")).not.toBeNull();
    expect(allHalos(container)).toBe(2);
  });

  it("탈락한 viewer 도 같은 공개를 보되 좌석은 버튼이 아니다", () => {
    const { container } = renderAt(2800, makeView({ votes: VOTES, dead: [0] }));
    expect(container.querySelectorAll(".mf-dt button").length).toBe(0);
    expect(titleOf(container)).toBe("도현님이 가장 많은 표를 받았어요");
    expect(chipOf(container, 3)?.textContent).toBe("3");
    expect(panelOf(container).querySelectorAll("button").length).toBe(0);
  });

  it("단계가 바뀌면 칩·읽기 안내가 사라진다(defense 는 아직 연결 중…)", () => {
    const r = renderAt(2800, makeView({ votes: VOTES }));
    expect(r.container.querySelectorAll(".mf-vchip").length).toBe(3);
    r.rerenderRoom(makeView({ phase: "candidateVote", votes: VOTES }));
    expect(r.container.querySelectorAll(".mf-vchip").length).toBe(0);
    expect(verdictLive(r.container)).toBeNull();
  });
});

// ---- 04-20 Task 1·2: 화살표 층 연결, 과반 확정 두근, 느린 박동, 진동 ----
const seatClasses = (c: HTMLElement, n: number) => seatOf(c, n).className;
/** 두근(clinch)·느린 박동(slow) 클래스가 붙은 좌석 번호 */
const beatSeats = (c: HTMLElement, kind: "clinch" | "slow") =>
  Array.from(c.querySelectorAll<HTMLElement>(`.mf-dt__seat--${kind}`)).map((el) => Number(el.dataset.seat));
const chipSlow = (c: HTMLElement) => Array.from(c.querySelectorAll<HTMLElement>(".mf-vchip--slow")).map((el) => Number(el.dataset.seat));

/** 도현(3)이 세 번째 표에서 확정(3-0-0, 남은 2표): 닿음 = 시작 + 200 + 2×500 + 280 = 1480 */
const CLINCH_THIRD: CandidateVoteLine[] = [
  { seat: 1, target: 3 },
  { seat: 2, target: 3 },
  { seat: 0, target: 3 },
  { seat: 4, target: 1 },
  { seat: 3, target: 2 },
];
/** 도현(3)이 두 번째 표에서 확정(2-0, 남은 1표 → 2 > 0 + 1): 닿음 = 200 + 500 + 280 = 980 */
const CLINCH_SECOND: CandidateVoteLine[] = [
  { seat: 1, target: 3 },
  { seat: 2, target: 3 },
  { seat: 0, target: 1 },
];
/** 동률 [A,B,A,B]: 끝까지 2-2 */
const TIE: CandidateVoteLine[] = [
  { seat: 1, target: 2 },
  { seat: 2, target: 3 },
  { seat: 3, target: 2 },
  { seat: 4, target: 3 },
];
/** 미확정: 세 갈래 1-1-1 */
const SPLIT: CandidateVoteLine[] = [
  { seat: 1, target: 2 },
  { seat: 2, target: 3 },
  { seat: 3, target: 4 },
];

describe("clinchBeat: 확정 두근 700ms 뒤 느린 박동 (D-31 ③, 순수 함수)", () => {
  it("확정 사건 전엔 null, 닿는 시각부터 700ms 는 clinch, 그 뒤는 slow", () => {
    const plan = revealPlan(CLINCH_THIRD, START);
    expect(plan.clinch).toEqual({ seat: 3, atMs: START + 1480, step: 2 });
    expect(clinchBeat(plan, START + 1479)).toBeNull();
    expect(clinchBeat(plan, START + 1480)).toEqual({ seat: 3, beat: "clinch" });
    expect(clinchBeat(plan, START + 1480 + CLINCH_BEAT_MS - 1)).toEqual({ seat: 3, beat: "clinch" });
    expect(clinchBeat(plan, START + 1480 + CLINCH_BEAT_MS)).toEqual({ seat: 3, beat: "slow" });
    expect(clinchBeat(plan, START + 99_999)).toEqual({ seat: 3, beat: "slow" });
  });

  it("동률·미확정·표 없음은 언제나 null", () => {
    for (const votes of [TIE, SPLIT, []]) {
      const plan = revealPlan(votes, START);
      for (const t of [0, 500, 1500, 2500, 3500, 3999]) expect(clinchBeat(plan, START + t)).toBeNull();
    }
  });
});

describe("candidateVoteReveal 화살표 층 연결 (D-20, 04-20)", () => {
  beforeEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("화살표가 자라는 구간에만 .mf-varrow 하나가 장면 안에 있고, 닿고 사라진 뒤에는 없다", () => {
    const { container, advance } = renderAt(350, makeView({ votes: VOTES }));
    expect(container.querySelectorAll(".mf-dt .mf-varrow").length).toBe(1);
    expect(container.querySelector(".mf-varrow")?.getAttribute("data-step")).toBe("0");
    advance(270); // 620: 첫 화살표가 사라진 끝(600)을 지난 첫 프레임(16ms 간격) 뒤
    expect(container.querySelectorAll(".mf-varrow").length).toBe(0);
    advance(100); // 720: 둘째 화살표 시작(700) 뒤
    expect(container.querySelector(".mf-varrow")?.getAttribute("data-step")).toBe("1");
  });

  it("다른 단계(후보 선택)에는 화살표 층이 없다", () => {
    const { container } = renderAt(350, makeView({ phase: "candidateVote", votes: VOTES }));
    expect(container.querySelectorAll(".mf-varrow").length).toBe(0);
  });

  it("축소 모션 설정이면 첫 화살표가 시작하자마자 완성된 모습이다", () => {
    vi.stubGlobal("matchMedia", (q: string) => ({
      matches: q.includes("prefers-reduced-motion"),
      addEventListener: () => {},
      removeEventListener: () => {},
    }));
    const { container } = renderAt(210, makeView({ votes: VOTES }));
    const top = container.querySelector<SVGLineElement>(".mf-varrow__line")!;
    expect(top).not.toBeNull();
    // 완성: 끝점이 시작점과 다르다(보통 모션이면 시작 + 10ms 에는 거의 같다)
    expect(Math.hypot(Number(top.getAttribute("x2")) - Number(top.getAttribute("x1")), Number(top.getAttribute("y2")) - Number(top.getAttribute("y1")))).toBeGreaterThan(20);
    vi.unstubAllGlobals();
  });
});

describe("과반 확정 두근과 느린 박동 (D-31 ③, P-14, 04-20)", () => {
  beforeEach(() => {
    cleanup();
  });

  it("세 번째 표에서 확정: 닿는 순간 도현 좌석에 clinch 700ms, 칩은 beat, 그 뒤 공개가 끝날 때까지 slow(칩은 lead + slow). 다른 자리엔 없다", () => {
    const { container, advance } = renderAt(1479, makeView({ votes: CLINCH_THIRD }));
    expect(beatSeats(container, "clinch")).toEqual([]);
    expect(beatSeats(container, "slow")).toEqual([]);
    expect(chipOf(container, 3)?.className).toContain("mf-vchip--lead");
    advance(1); // 1480
    expect(beatSeats(container, "clinch")).toEqual([3]);
    expect(beatSeats(container, "slow")).toEqual([]);
    expect(chipOf(container, 3)?.textContent).toBe("3");
    expect(chipOf(container, 3)?.className).toContain("mf-vchip--beat");
    expect(chipOf(container, 3)?.className).not.toContain("mf-vchip--slow");
    expect(chipSlow(container)).toEqual([]);
    expect(seatClasses(container, 1)).not.toMatch(/--clinch|--slow/);
    // 다른 자리의 칩이 올라도(1980 = 서연 → 하윤 닿음) 도현만 두근
    advance(699); // 2179
    expect(beatSeats(container, "clinch")).toEqual([3]);
    expect(chipOf(container, 1)?.className).not.toMatch(/beat|slow/);
    advance(1); // 2180 = 1480 + 700
    expect(beatSeats(container, "clinch")).toEqual([]);
    expect(beatSeats(container, "slow")).toEqual([3]);
    expect(chipOf(container, 3)?.className).toContain("mf-vchip--lead");
    expect(chipOf(container, 3)?.className).not.toContain("mf-vchip--beat");
    expect(chipSlow(container)).toEqual([3]);
    // 끝 상태(2700 이후)에도 박동 유지
    advance(1200);
    expect(beatSeats(container, "slow")).toEqual([3]);
    expect(chipSlow(container)).toEqual([3]);
    expect(chipOf(container, 3)?.className).toContain("mf-vchip--lead");
  });

  it("두 번째 표에서 확정하는 판: 두 번째 표가 닿는 980 에 두근", () => {
    const { container, advance } = renderAt(979, makeView({ votes: CLINCH_SECOND }));
    expect(beatSeats(container, "clinch")).toEqual([]);
    advance(1);
    expect(beatSeats(container, "clinch")).toEqual([3]);
    advance(CLINCH_BEAT_MS);
    expect(beatSeats(container, "slow")).toEqual([3]);
  });

  it("동률 [A,B,A,B]: 두근·느린 박동 클래스가 처음부터 끝까지 어디에도 없다", () => {
    const { container, advance } = renderAt(0, makeView({ votes: TIE }));
    for (let t = 0; t < 4000; t += 100) {
      expect(container.querySelectorAll(".mf-dt__seat--clinch, .mf-dt__seat--slow, .mf-vchip--beat, .mf-vchip--slow").length).toBe(0);
      advance(100);
    }
  });

  it("미확정(세 갈래)·표 없음도 없다", () => {
    const split = renderAt(3000, makeView({ votes: SPLIT }));
    expect(split.container.querySelectorAll(".mf-dt__seat--clinch, .mf-dt__seat--slow, .mf-vchip--beat, .mf-vchip--slow").length).toBe(0);
    split.unmount();
    const none = renderAt(3000, makeView({ votes: [] }));
    expect(none.container.querySelectorAll(".mf-dt__seat--clinch, .mf-dt__seat--slow, .mf-vchip--beat, .mf-vchip--slow").length).toBe(0);
  });

  it("중간 합류(확정 700ms 뒤): 바로 slow 이고 clinch 는 없다", () => {
    const { container } = renderAt(2800, makeView({ votes: CLINCH_THIRD }));
    expect(beatSeats(container, "clinch")).toEqual([]);
    expect(beatSeats(container, "slow")).toEqual([3]);
    expect(chipSlow(container)).toEqual([3]);
    expect(chipOf(container, 3)?.className).toContain("mf-vchip--lead");
  });

  it("확정 두근 중 합류(1700): clinch 로 시작해 남은 시간 뒤 slow", () => {
    const { container, advance } = renderAt(1700, makeView({ votes: CLINCH_THIRD }));
    expect(beatSeats(container, "clinch")).toEqual([3]);
    advance(480); // 2180
    expect(beatSeats(container, "slow")).toEqual([3]);
  });

  it("두근 때 칩이 다른 사람에게 가도 확정 좌석의 칩만 beat 다(후광은 앰버 하나)", () => {
    const { container } = renderAt(1500, makeView({ votes: CLINCH_THIRD }));
    expect(amberSeats(container)).toEqual([3]);
    expect(container.querySelectorAll(".mf-vchip--beat").length).toBe(1);
  });
});

describe("확정 진동 navigator.vibrate (D-31 구현 재량)", () => {
  const original = Object.getOwnPropertyDescriptor(navigator, "vibrate");
  const stubVibrate = (fn: unknown) => Object.defineProperty(navigator, "vibrate", { value: fn, configurable: true, writable: true });
  beforeEach(() => {
    cleanup();
  });
  afterEach(() => {
    if (original) Object.defineProperty(navigator, "vibrate", original);
    else delete (navigator as unknown as Record<string, unknown>).vibrate;
  });

  it("확정 순간 정확히 한 번 30ms. 이후 박동·끝 상태·재렌더에서 다시 울리지 않는다", () => {
    const vibrate = vi.fn(() => true);
    stubVibrate(vibrate);
    const { advance, rerenderRoom } = renderAt(1000, makeView({ votes: CLINCH_THIRD }));
    expect(vibrate).not.toHaveBeenCalled();
    advance(480); // 1480
    expect(vibrate).toHaveBeenCalledTimes(1);
    expect(vibrate).toHaveBeenCalledWith(CLINCH_VIBRATE_MS);
    expect(CLINCH_VIBRATE_MS).toBe(30);
    advance(3000);
    rerenderRoom(makeView({ votes: CLINCH_THIRD }));
    expect(vibrate).toHaveBeenCalledTimes(1);
  });

  it("확정 700ms 뒤에 합류한 폰에서는 울리지 않는다", () => {
    const vibrate = vi.fn(() => true);
    stubVibrate(vibrate);
    renderAt(2800, makeView({ votes: CLINCH_THIRD }));
    expect(vibrate).not.toHaveBeenCalled();
  });

  it("동률·미확정에서는 울리지 않는다", () => {
    const vibrate = vi.fn(() => true);
    stubVibrate(vibrate);
    const r = renderAt(0, makeView({ votes: TIE }));
    r.advance(4000);
    r.unmount();
    const s = renderAt(0, makeView({ votes: SPLIT }));
    s.advance(4000);
    expect(vibrate).not.toHaveBeenCalled();
  });

  it("vibrate 가 예외를 던져도 화면은 멈추지 않는다", () => {
    stubVibrate(
      vi.fn(() => {
        throw new Error("blocked");
      }),
    );
    const { container, advance } = renderAt(1000, makeView({ votes: CLINCH_THIRD }));
    expect(() => advance(480)).not.toThrow();
    expect(beatSeats(container, "clinch")).toEqual([3]);
    advance(3000);
    expect(beatSeats(container, "slow")).toEqual([3]);
  });

  it("vibrate 구현이 없는 환경(데스크톱·iOS)에서도 멈추지 않는다", () => {
    delete (navigator as unknown as Record<string, unknown>).vibrate;
    const { container, advance } = renderAt(1000, makeView({ votes: CLINCH_THIRD }));
    advance(480);
    expect(beatSeats(container, "clinch")).toEqual([3]);
  });
});

describe("verdict.css: 확정 두근 스타일 규칙 (UI-SPEC 8.3·13.4)", () => {
  const css = readFileSync("src/styles/verdict.css", "utf8");
  const keyframe = (name: string): string => new RegExp(`@keyframes ${name}\\s*\\{([\\s\\S]*?\\n\\})`).exec(css)?.[1] ?? "";
  const reduced = css.slice(css.lastIndexOf("@media (prefers-reduced-motion: reduce)"));

  it("키프레임 이름은 mf- 접두어이고 mf-dk- 가 5개 이상이다", () => {
    expect((css.match(/@keyframes mf-dk-[\w-]+/g) ?? []).length).toBeGreaterThanOrEqual(5);
    expect(css.match(/@keyframes (?!mf-)/g)).toBeNull();
  });

  it("두근: 캐릭터 1 → 1.12 → 1 ×2, 칩 1 → 1.3 → 1 ×2 (개별 속성 scale, transform 금지)", () => {
    const c = keyframe("mf-dk-c");
    const chip = keyframe("mf-dk-chip");
    expect(c).toContain("scale: 1.12");
    expect(chip).toContain("scale: 1.3");
    expect((c.match(/scale: 1\.12/g) ?? []).length).toBe(2);
    expect((chip.match(/scale: 1\.3/g) ?? []).length).toBe(2);
    expect(c).not.toContain("transform");
    expect(chip).not.toContain("transform");
    expect(css).toMatch(/\.mf-dt__seat--clinch\s*\{[^}]*mf-dk-c 700ms/);
    expect(css).toMatch(/\.mf-vchip--beat\s*\{[^}]*mf-dk-chip 700ms/);
  });

  it("후광: 3px/18px 로 밝아졌다 돌아온다, 후광 그림에만", () => {
    const h = keyframe("mf-dk-halo");
    expect(h).toContain("drop-shadow(0 0 3px");
    expect(h).toContain("drop-shadow(0 0 18px");
    expect(css).toMatch(/\.mf-dt__seat--clinch \.mf-figure--halo-amber[^{]*\{[^}]*mf-dk-halo 700ms/);
  });

  it("느린 박동: 주기 1200ms 무한, 캐릭터 1 → 1.04 → 1, 칩 1 → 1.1 → 1", () => {
    expect(keyframe("mf-dk-slow")).toContain("scale: 1.04");
    expect(keyframe("mf-dk-chip-slow")).toContain("scale: 1.1");
    expect(css).toMatch(/\.mf-dt__seat--slow\s*\{[^}]*mf-dk-slow 1200ms[^;}]*infinite/);
    expect(css).toMatch(/\.mf-vchip--slow\s*\{[^}]*mf-dk-chip-slow 1200ms[^;}]*infinite/);
  });

  it("축소 모션: 크기 변화 없이 밝기 깜빡임만(brightness 1.3 2회), 느린 박동 없음, 전역 0.01ms 규칙을 이 깜빡임만 되돌린다", () => {
    const flash = keyframe("mf-dk-flash");
    expect(flash).toContain("brightness(1.3)");
    expect((flash.match(/brightness\(1\.3\)/g) ?? []).length).toBeGreaterThanOrEqual(2);
    expect(flash).not.toContain("scale");
    expect(reduced).toMatch(/\.mf-dt__seat--clinch[^{]*\{[^}]*animation: none/);
    expect(reduced).toMatch(/\.mf-dt__seat--slow[^{]*\{[^}]*animation: none/);
    expect(reduced).toMatch(/\.mf-vchip--slow[^{]*\{[^}]*animation: none/);
    expect(reduced).toMatch(/mf-dk-flash 700ms[^;]*!important/);
    expect(reduced).toMatch(/mf-dk-chip-flash 700ms[^;]*!important/);
    // 크기·위치가 변하는 키프레임은 되돌리지 않는다
    expect(reduced).not.toMatch(/mf-dk-(c|chip|slow|chip-slow) [^;]*!important/);
  });
});
