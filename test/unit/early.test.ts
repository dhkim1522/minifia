// 23-08 Task 1: 일찍 넘어가기 순수 규칙(0089-26, D-11·D-12·D-25, Pitfall 5). earlyReady 와 shrinkDeadline 은 상태를 바꾸지 않고 시각을 읽지 않는다(now 는 인자).
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { botPlanKey } from "../../shared/game/bots";
import { EARLY_GRACE_MS, earlyReady, shrinkDeadline } from "../../shared/game/early";
import { GENRES } from "../../shared/game/keywords";
import type { RoomState } from "../../shared/game/room";
import type { PhaseId } from "../../shared/protocol";
import { openKeyword } from "../helpers/keyword";
import { startedAt } from "../helpers/voteState";

let restore: () => void = () => {};
beforeEach(() => {
  restore = openKeyword();
});
afterEach(() => restore());

const ORIGIN = 100_000; // 원래 마감

/** 5명(좌석 4 는 봇) 판을 그 단계로 놓는다. 마감은 ORIGIN 으로 박는다. */
function stateIn(phase: PhaseId, opts: { day?: number } = {}): RoomState {
  const s = startedAt(5, 3, "keyword");
  return {
    ...s,
    phase,
    phaseEndsAt: ORIGIN,
    day: opts.day ?? 1,
    keyword: { genre: GENRES[0]!.id, word: "해리포터" },
    players: s.players.map((p) => ({ ...p, role: p.seat === 0 ? ("mafia" as const) : ("citizen" as const), ...(p.seat === 4 ? { isBot: true as const } : {}) })),
  };
}
const withKeywordSubmits = (s: RoomState, seats: number[]): RoomState => ({ ...s, answerSubmits: seats.map((seat) => ({ seat, text: `답${seat}` })) });
const withVotes = (s: RoomState, seats: number[]): RoomState => ({ ...s, players: s.players.map((p) => (seats.includes(p.seat) ? { ...p, verdictVote: true } : p)) });
const withPicks = (s: RoomState, seats: number[]): RoomState => ({ ...s, players: s.players.map((p) => (seats.includes(p.seat) ? { ...p, nightPick: 1 } : p)) });
const kill = (s: RoomState, seat: number): RoomState => ({ ...s, players: s.players.map((p) => (p.seat === seat ? { ...p, alive: false } : p)) });

describe("earlyReady (D-11·D-12)", () => {
  it("keyword: 산 사람 중 사람 전원이 확정했으면 참 — 봇이 안 냈어도", () => {
    const s = stateIn("keyword");
    expect(earlyReady(withKeywordSubmits(s, [0, 1, 2, 3]))).toBe(true);
  });

  it("keyword: 사람 한 명이라도 안 냈으면 거짓(끊긴 사람도 같다)", () => {
    const s = stateIn("keyword");
    expect(earlyReady(withKeywordSubmits(s, [0, 1, 2]))).toBe(false);
    expect(earlyReady(s)).toBe(false);
  });

  it("keyword: 죽은 사람은 세지 않는다, 산 사람 중 사람이 0명이면 거짓", () => {
    const s = kill(stateIn("keyword"), 3);
    expect(earlyReady(withKeywordSubmits(s, [0, 1, 2]))).toBe(true);
    const onlyBot = { ...stateIn("keyword"), players: stateIn("keyword").players.map((p) => (p.seat === 4 ? p : { ...p, alive: false })) };
    expect(earlyReady(onlyBot)).toBe(false);
  });

  it("verdict: 산 사람 전원(봇 포함)이 투표해야 참", () => {
    const s = stateIn("verdict");
    expect(earlyReady(withVotes(s, [0, 1, 2, 3, 4]))).toBe(true);
    expect(earlyReady(withVotes(s, [0, 1, 2, 3]))).toBe(false);
    expect(earlyReady(withVotes(kill(s, 2), [0, 1, 3, 4]))).toBe(true);
  });

  it("night: 산 사람 전원(봇 포함)이 nightPick 을 가져야 참", () => {
    const s = stateIn("night");
    expect(earlyReady(withPicks(s, [0, 1, 2, 3, 4]))).toBe(true);
    expect(earlyReady(withPicks(s, [0, 1, 2, 3]))).toBe(false);
  });

  it("그 밖 단계는 늘 거짓 — 연출 단계·토론·유언은 못 넘긴다(D-12)", () => {
    const phases: PhaseId[] = ["dayAnnounce", "discussion", "nomination", "defense", "execution", "answerReveal", "morning"];
    for (const phase of phases) {
      const s = withPicks(withVotes(withKeywordSubmits(stateIn(phase), [0, 1, 2, 3]), [0, 1, 2, 3, 4]), [0, 1, 2, 3, 4]);
      expect(earlyReady(s), phase).toBe(false);
    }
  });
});

describe("shrinkDeadline — 한 번 줄이기 (밤·키워드, D-25)", () => {
  it("준비가 안 됐으면 같은 객체", () => {
    const s = stateIn("night");
    expect(shrinkDeadline(s, 10_000, { extend: false })).toBe(s);
  });

  it("준비되면 마감을 now + 1500 으로, 원래 마감은 earlyFrom 에 보관한다", () => {
    const s = withPicks(stateIn("night"), [0, 1, 2, 3, 4]);
    const next = shrinkDeadline(s, 10_000, { extend: false });
    expect(next.phaseEndsAt).toBe(10_000 + EARLY_GRACE_MS);
    expect(next.earlyFrom).toEqual({ phase: "night", day: 1, endsAt: ORIGIN });
    expect(s.phaseEndsAt).toBe(ORIGIN); // 입력은 그대로
  });

  it("이미 줄였으면 다시 부르면 같은 객체 — 연장도 재단축도 없다", () => {
    const s = withPicks(stateIn("night"), [0, 1, 2, 3, 4]);
    const once = shrinkDeadline(s, 10_000, { extend: false });
    expect(shrinkDeadline(once, 10_400, { extend: false })).toBe(once);
    expect(shrinkDeadline(once, 50_000, { extend: false })).toBe(once);
  });

  it("now + 1500 이 원래 마감 이상이면 같은 객체(원래 마감을 넘지 않는다)", () => {
    const s = withPicks(stateIn("night"), [0, 1, 2, 3, 4]);
    expect(shrinkDeadline(s, ORIGIN - 1_000, { extend: false })).toBe(s);
    expect(shrinkDeadline(s, ORIGIN - EARLY_GRACE_MS, { extend: false })).toBe(s);
  });

  it("keyword 도 한 번만 줄인다", () => {
    const s = withKeywordSubmits(stateIn("keyword"), [0, 1, 2, 3]);
    const once = shrinkDeadline(s, 20_000, { extend: false });
    expect(once.phaseEndsAt).toBe(20_000 + EARLY_GRACE_MS);
    expect(shrinkDeadline(once, 20_300, { extend: false })).toBe(once);
  });

  it("phaseEndsAt 이 null 이면 같은 객체", () => {
    const s = { ...withPicks(stateIn("night"), [0, 1, 2, 3, 4]), phaseEndsAt: null };
    expect(shrinkDeadline(s, 10_000, { extend: false })).toBe(s);
  });
});

describe("shrinkDeadline — 찬반 번복 연장 (D-25)", () => {
  it("번복은 마감을 now2 + 1500 으로 다시 정하되 원래 마감을 넘지 않는다", () => {
    const s = withVotes(stateIn("verdict"), [0, 1, 2, 3, 4]);
    const first = shrinkDeadline(s, 10_000, { extend: true });
    expect(first.phaseEndsAt).toBe(11_500);
    const second = shrinkDeadline(first, 11_000, { extend: true });
    expect(second.phaseEndsAt).toBe(12_500); // 늘어났다
    expect(second.earlyFrom).toEqual({ phase: "verdict", day: 1, endsAt: ORIGIN });
    const late = shrinkDeadline(second, ORIGIN - 500, { extend: true });
    expect(late.phaseEndsAt).toBe(ORIGIN); // 상한 = 원래 마감
    expect(late.phaseEndsAt!).toBeLessThanOrEqual(ORIGIN);
  });

  it("같은 시각에 다시 부르면 같은 객체(값이 안 바뀐다)", () => {
    const s = withVotes(stateIn("verdict"), [0, 1, 2, 3, 4]);
    const first = shrinkDeadline(s, 10_000, { extend: true });
    expect(shrinkDeadline(first, 10_000, { extend: true })).toBe(first);
  });

  it("전원이 아니게 되면(참가자 번복이 아니라 준비 해제) 같은 객체", () => {
    const s = withVotes(stateIn("verdict"), [0, 1, 2, 3]);
    expect(shrinkDeadline(s, 10_000, { extend: true })).toBe(s);
  });
});

describe("earlyFrom 의 키 (phase + day)", () => {
  it("어제 찬반 기록은 무시하고 새로 줄인다", () => {
    const s = { ...withVotes(stateIn("verdict", { day: 2 }), [0, 1, 2, 3, 4]), earlyFrom: { phase: "verdict" as const, day: 1, endsAt: 5_000 } };
    const next = shrinkDeadline(s, 10_000, { extend: false });
    expect(next.phaseEndsAt).toBe(11_500);
    expect(next.earlyFrom).toEqual({ phase: "verdict", day: 2, endsAt: ORIGIN });
  });

  it("day 가 없으면 0 으로 본다", () => {
    const s = withKeywordSubmits(stateIn("keyword"), [0, 1, 2, 3]);
    const { day: _day, ...noDay } = s;
    const next = shrinkDeadline(noDay as RoomState, 10_000, { extend: false });
    expect(next.earlyFrom).toEqual({ phase: "keyword", day: 0, endsAt: ORIGIN });
  });
});

describe("봇 계획 키 (Pitfall 5, T-23-30)", () => {
  it("줄어든 마감으로 계획 키를 같이 갈아 끼워 syncBotPlan 이 다시 세우지 않는다", () => {
    const base = withVotes(stateIn("verdict"), [0, 1, 2, 3, 4]);
    const s = { ...base, botPlan: { key: botPlanKey(base)!, steps: [] } };
    const next = shrinkDeadline(s, 10_000, { extend: true });
    expect(next.phaseEndsAt).toBe(11_500);
    expect(next.botPlan?.key).toBe(botPlanKey(next));
    expect(next.botPlan?.key).toBe("verdict:11500");
  });

  it("봇 계획이 없으면 만들지 않는다, 키가 없는 단계(keyword)는 계획 키를 건드리지 않는다", () => {
    const s = withKeywordSubmits(stateIn("keyword"), [0, 1, 2, 3]);
    expect(shrinkDeadline(s, 10_000, { extend: false }).botPlan).toBeUndefined();
  });
});
