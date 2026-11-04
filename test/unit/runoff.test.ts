// 동점 결선 규칙 단위 시험(09.1.1-04, POL-04, 결정 0066-4). 순수 모듈 runoff.ts 와 지목 집계 분기, tick 사슬.
import { describe, expect, it } from "vitest";
import { RUNOFF_END_MS, RUNOFF_INTRO_MS, RUNOFF_VOTE_MS } from "../../shared/game/phases";
import { castRunoffVote, resolveRunoff, runoffStepMs, runoffVotersOf, stepRunoff } from "../../shared/game/runoff";
import type { RoomState } from "../../shared/game/room";
import { tick } from "../../shared/game/tick";
import { castPoints, startedAt } from "../helpers/voteState";
import { seededRandInt } from "../helpers/seededRandom";

const idOf = (s: RoomState, seat: number): string => s.players.find((p) => p.seat === seat)!.id;
const rand = seededRandInt(9);

/** 6명 판, 지목 0→1·1→0·2→0·3→1·4→2·5 기권: 좌석 0·1 이 2표씩 최다 정확히 둘 동점(좌석 2 는 1표). */
const TIE: Record<number, number> = { 0: 1, 1: 0, 2: 0, 3: 1, 4: 2 };

/** 지목 마감을 넘긴 직후 = runoff 앞머리(step 0). */
function atRunoff(points: Record<number, number> = TIE): RoomState {
  const nominated = castPoints(startedAt(6, 3, "nomination"), points);
  return tick(nominated, nominated.phaseEndsAt!, rand);
}

/** 앞머리를 지난 투표 창(step 1). */
function atVoteWindow(): RoomState {
  const lead = atRunoff();
  return tick(lead, lead.phaseEndsAt!, rand);
}

describe("지목 집계 분기 (결정 0066-4)", () => {
  it("최다 득표가 정확히 둘 동점이면 night 대신 runoff 로 간다 — 후보는 낮은 좌석부터, 단계 길이 1초", () => {
    const nominated = castPoints(startedAt(6, 3, "nomination"), TIE);
    const deadline = nominated.phaseEndsAt!;
    const s = tick(nominated, deadline, rand);
    expect(s.phase).toBe("runoff");
    expect(s.runoff).toEqual({ cand: [0, 1], step: 0 });
    expect(s.phaseEndsAt).toBe(deadline + RUNOFF_INTRO_MS);
    expect(s.pickTurn).toBeUndefined();
    const line = s.voteLog!.at(-1)!;
    expect(line.cand?.candidate).toBeUndefined();
    expect(line.cand?.votes.length).toBe(5);
    expect(s.players.some((p) => p.nominate !== undefined)).toBe(false);
  });

  it("최다가 셋 이상 동점이거나 0표면 runoff 없이 night(처형 없음)", () => {
    for (const points of [{ 0: 1, 1: 0, 2: 3, 3: 2, 4: 5, 5: 4 }, {}, { 0: 3, 1: 3, 2: 4, 3: 4, 4: 5, 5: 5 }]) {
      const nominated = castPoints(startedAt(6, 3, "nomination"), points);
      const s = tick(nominated, nominated.phaseEndsAt!, rand);
      expect(s.phase).toBe("night");
      expect(s.runoff).toBeUndefined();
    }
  });

  it("최다 한 명이면 지금 규칙 그대로 defense", () => {
    const nominated = castPoints(startedAt(6, 3, "nomination"), { 0: 2, 1: 2, 3: 2 });
    const s = tick(nominated, nominated.phaseEndsAt!, rand);
    expect(s.phase).toBe("defense");
    expect(s.verdict?.candidate).toBe(2);
  });
});

describe("runoff 사슬 (stay)", () => {
  it("앞머리 → 투표(5초) → 결과(1.5초) 마감이 이전 마감 + 길이로 이어진다", () => {
    const lead = atRunoff();
    const open = tick(lead, lead.phaseEndsAt!, rand);
    expect(open.phase).toBe("runoff");
    expect(open.runoff?.step).toBe(1);
    expect(open.phaseEndsAt).toBe(lead.phaseEndsAt! + RUNOFF_VOTE_MS);
    const shown = tick(open, open.phaseEndsAt!, rand);
    expect(shown.runoff?.step).toBe(2);
    expect(shown.phaseEndsAt).toBe(open.phaseEndsAt! + RUNOFF_END_MS);
    expect(runoffStepMs(lead)).toBe(RUNOFF_INTRO_MS);
    expect(runoffStepMs(open)).toBe(RUNOFF_VOTE_MS);
    expect(runoffStepMs(shown)).toBe(RUNOFF_END_MS);
  });

  it("step 1 → 2 전환에서 tally 가 후보 순서대로 확정되고 산 유권자의 후보 표만 센다", () => {
    let s = atVoteWindow();
    for (const [seat, target] of [[2, 0], [3, 0], [4, 1]] as const) {
      const r = castRunoffVote(s, idOf(s, seat), target, s.phaseEndsAt! - 100);
      expect(r.ok).toBe(true);
      if (r.ok) s = r.state;
    }
    // 던진 뒤 탈락한 유권자의 표는 세지 않는다
    s = { ...s, players: s.players.map((p) => (p.seat === 3 ? { ...p, alive: false } : p)) };
    const shown = stepRunoff(s, s.phaseEndsAt!);
    expect(shown.stay).toBe(true);
    expect(shown.state.runoff?.tally).toEqual([1, 1]);
  });

  it("결과를 지나면 많이 받은 후보가 voteLog·verdict 의 candidate 가 되고 runoff 상태가 사라진다", () => {
    let s = atVoteWindow();
    for (const [seat, target] of [[2, 1], [3, 1], [4, 1], [5, 0]] as const) {
      const r = castRunoffVote(s, idOf(s, seat), target, s.phaseEndsAt! - 100);
      if (r.ok) s = r.state;
    }
    const shown = tick(s, s.phaseEndsAt!, rand);
    const done = tick(shown, shown.phaseEndsAt!, rand);
    expect(done.phase).toBe("defense");
    expect(done.verdict).toEqual({ passed: false, candidate: 1 });
    expect(done.voteLog!.at(-1)!.cand?.candidate).toBe(1);
    expect("runoff" in done).toBe(false);
    expect(done.players.some((p) => "runoffVote" in p)).toBe(false);
  });

  it("결선도 동점(무표 포함)이면 night — candidate 가 없고 이유는 기존 규칙이 파생한다", () => {
    for (const votes of [[], [[2, 0], [3, 1]]] as Array<Array<[number, number]>>) {
      let s = atVoteWindow();
      for (const [seat, target] of votes) {
        const r = castRunoffVote(s, idOf(s, seat), target, s.phaseEndsAt! - 100);
        if (r.ok) s = r.state;
      }
      const shown = tick(s, s.phaseEndsAt!, rand);
      const done = tick(shown, shown.phaseEndsAt!, rand);
      expect(done.phase).toBe("night");
      expect(done.voteLog!.at(-1)!.cand?.candidate).toBeUndefined();
      expect("runoff" in done).toBe(false);
      expect(done.verdict?.candidate).toBeUndefined();
    }
  });

  it("resolveRunoff 는 입력 상태를 바꾸지 않는다", () => {
    const s = atVoteWindow();
    const voted = castRunoffVote(s, idOf(s, 2), 0, s.phaseEndsAt! - 100);
    if (!voted.ok) throw new Error("준비 실패");
    const shown = stepRunoff(voted.state, voted.state.phaseEndsAt!).state;
    const before = JSON.stringify(shown);
    resolveRunoff(shown);
    expect(JSON.stringify(shown)).toBe(before);
  });
});

describe("castRunoffVote 검사 순서 (계약)", () => {
  it("단계 → 행위자 → 후보 본인 → 투표 창 → 대상 순으로 거절한다", () => {
    const lead = atRunoff();
    const open = tick(lead, lead.phaseEndsAt!, rand);
    const t = open.phaseEndsAt! - 100;
    const nominationState = startedAt(6, 3, "nomination");
    expect(castRunoffVote(nominationState, idOf(nominationState, 2), 0, 0)).toEqual({ ok: false, error: "WRONG_PHASE" });
    expect(castRunoffVote(open, "없는-사람", 0, t)).toEqual({ ok: false, error: "BAD_MESSAGE" });
    const ghosted = { ...open, players: open.players.map((p) => (p.seat === 4 ? { ...p, alive: false } : p)) };
    expect(castRunoffVote(ghosted, idOf(open, 4), 0, t)).toEqual({ ok: false, error: "BAD_MESSAGE" });
    // 후보 본인: 단계 창 밖(앞머리)이어도 BAD_MESSAGE (창 검사보다 먼저)
    expect(castRunoffVote(lead, idOf(lead, 0), 1, lead.phaseEndsAt! - 100)).toEqual({ ok: false, error: "BAD_MESSAGE" });
    expect(castRunoffVote(open, idOf(open, 1), 0, t)).toEqual({ ok: false, error: "BAD_MESSAGE" });
    // 창: 앞머리·결과·마감 이후
    expect(castRunoffVote(lead, idOf(lead, 2), 0, lead.phaseEndsAt! - 100)).toEqual({ ok: false, error: "WRONG_PHASE" });
    expect(castRunoffVote(open, idOf(open, 2), 0, open.phaseEndsAt!)).toEqual({ ok: false, error: "WRONG_PHASE" });
    const shown = tick(open, open.phaseEndsAt!, rand);
    expect(castRunoffVote(shown, idOf(shown, 2), 0, shown.phaseEndsAt! - 100)).toEqual({ ok: false, error: "WRONG_PHASE" });
    // 대상: 후보 밖 좌석·정수 아님
    expect(castRunoffVote(open, idOf(open, 2), 2, t)).toEqual({ ok: false, error: "BAD_MESSAGE" });
    expect(castRunoffVote(open, idOf(open, 2), 5, t)).toEqual({ ok: false, error: "BAD_MESSAGE" });
    expect(castRunoffVote(open, idOf(open, 2), 0.5, t)).toEqual({ ok: false, error: "BAD_MESSAGE" });
  });

  it("같은 값은 입력 상태 그대로, 바꾸면 그 사람의 runoffVote 만 바뀐 새 상태", () => {
    const open = atVoteWindow();
    const t = open.phaseEndsAt! - 100;
    const first = castRunoffVote(open, idOf(open, 2), 0, t);
    if (!first.ok) throw new Error("준비 실패");
    expect(first.state).not.toBe(open);
    expect(first.state.players.find((p) => p.seat === 2)!.runoffVote).toBe(0);
    expect(first.state.players.filter((p) => p.runoffVote !== undefined).length).toBe(1);
    const same = castRunoffVote(first.state, idOf(open, 2), 0, t);
    expect(same.ok && same.state === first.state).toBe(true);
    const changed = castRunoffVote(first.state, idOf(open, 2), 1, t);
    expect(changed.ok && changed.state.players.find((p) => p.seat === 2)!.runoffVote).toBe(1);
  });

  it("유권자는 산 사람 중 후보가 아닌 사람이다", () => {
    const open = atVoteWindow();
    expect(runoffVotersOf(open).map((p) => p.seat)).toEqual([2, 3, 4, 5]);
    const ghosted = { ...open, players: open.players.map((p) => (p.seat === 4 ? { ...p, alive: false } : p)) };
    expect(runoffVotersOf(ghosted).map((p) => p.seat)).toEqual([2, 3, 5]);
  });
});
