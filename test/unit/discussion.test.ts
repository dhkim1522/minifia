import { describe, expect, it } from "vitest";
import * as discussionModule from "../../shared/game/discussion";
import { phaseDurationOf } from "../../shared/game/discussion";
import * as phasesModule from "../../shared/game/phases";
import { CANDIDATE_VOTE_MS, DISCUSSION_MS, candidateRevealMs } from "../../shared/game/phases";
import { ROOM_TTL_MS } from "../../shared/game/room";
import type { Player, RoomState } from "../../shared/game/room";
import type { PhaseId } from "../../shared/protocol";
import { castCandidateVotes, stateWithVerdict } from "../helpers/voteState";

function player(i: number): Player {
  return {
    id: `p${i}`,
    token: `token-p${i}-0123456789`,
    seat: i,
    nickname: `이름${i}`,
    nicknameKey: `이름${i}`,
    joinSeq: i,
    connected: true,
    connId: `c${i}`,
  };
}

/** 5명 방, 방장은 p0. */
function room(phase: PhaseId, phaseEndsAt: number | null, extra: Record<string, unknown> = {}): RoomState {
  return {
    code: "0420",
    createdAt: 0,
    expiresAt: ROOM_TTL_MS,
    phase,
    phaseEndsAt,
    day: 1,
    hostId: "p0",
    nextJoinSeq: 5,
    players: [0, 1, 2, 3, 4].map(player),
    ...extra,
  } as RoomState;
}

// 결과는 한 줄 문자열로 비교한다(TAP 증거 규칙).
describe("phaseDurationOf - 단계 길이 파생 (결정 0017-5, Pitfall 3)", () => {
  it("phaseDurationOf 는 단계 표 길이 그대로다: discussion 40000, dayAnnounce 2000, lobby null", () => {
    const got = (["discussion", "dayAnnounce", "lobby"] as const)
      .map((phase) => `${phase}:${phaseDurationOf(room(phase, phase === "lobby" ? null : 100_000))}`)
      .join(" ");
    expect(got).toBe("discussion:40000 dayAnnounce:2000 lobby:null");
  });

  it("저장된 옛 상태에 연장 표시(extendUsed true)가 남아 있어도 discussion 길이는 40000 이다", () => {
    expect(phaseDurationOf(room("discussion", 100_000, { extendUsed: true }))).toBe(DISCUSSION_MS);
  });

  it("discussion 모듈이 내보내는 것은 phaseDurationOf 하나다", () => {
    expect(Object.keys(discussionModule).sort().join(",")).toBe("phaseDurationOf");
  });

  it("phases 모듈에 연장 길이 상수가 없다", () => {
    expect(Object.keys(phasesModule).filter((k) => k.startsWith("EXTEND")).join(",")).toBe("");
  });
});

describe("phaseDurationOf - 공개 단계 길이는 그날 공개 표 수로 파생한다 (결정 0039)", () => {
  it("후보 있음: 공개 단계 길이 = candidateRevealMs(그날 cand.votes 길이)", () => {
    const state = stateWithVerdict(6, 3, "candidateVoteReveal");
    const votes = state.voteLog!.find((e) => e.n === state.day)!.cand!.votes;
    expect(votes.length).toBeGreaterThan(0);
    expect(phaseDurationOf(state)).toBe(candidateRevealMs(votes.length));
  });

  it("동률도 던진 표 수로 길이가 정해진다", () => {
    const state = stateWithVerdict(6, 3, "candidateVoteReveal", { candidate: "tie" });
    const votes = state.voteLog!.find((e) => e.n === state.day)!.cand!.votes;
    expect(votes.length).toBe(2);
    expect(phaseDurationOf(state)).toBe(candidateRevealMs(2));
  });

  it("0표는 candidateRevealMs(0) = 2000 이다", () => {
    const state = stateWithVerdict(6, 3, "candidateVoteReveal", { candidate: "none" });
    expect(phaseDurationOf(state)).toBe(candidateRevealMs(0));
    expect(phaseDurationOf(state)).toBe(2000);
  });

  it("그날 줄이나 cand 가 없으면 candidateRevealMs(0) 이다", () => {
    expect(phaseDurationOf(room("candidateVoteReveal", 100_000))).toBe(candidateRevealMs(0));
    expect(phaseDurationOf(room("candidateVoteReveal", 100_000, { voteLog: [{ n: 1, exec: { yes: 3, no: 0, passed: true } }] }))).toBe(
      candidateRevealMs(0),
    );
  });

  it("입력 상태를 바꾸지 않는다", () => {
    const state = stateWithVerdict(6, 3, "candidateVoteReveal");
    const before = JSON.stringify(state);
    phaseDurationOf(state);
    expect(JSON.stringify(state)).toBe(before);
  });

  it("진행 중 후보 선택(candidateVote)은 표가 몇 개 들어와도 15000 이다 (T-t40-01: 표 수가 길이로 새지 않는다)", () => {
    const empty = stateWithVerdict(6, 3, "candidateVote", { candidate: "none" });
    const full = stateWithVerdict(6, 3, "candidateVote", { candidate: "citizen" });
    const alive = full.players.filter((p) => p.alive !== false);
    expect(alive.length).toBeGreaterThan(2);
    expect(phaseDurationOf(empty)).toBe(CANDIDATE_VOTE_MS);
    expect(phaseDurationOf(full)).toBe(CANDIDATE_VOTE_MS);
    // 일부만 던진 상태
    const some = castCandidateVotes(empty, { [alive[0]!.seat]: alive[1]!.seat });
    expect(phaseDurationOf(some)).toBe(CANDIDATE_VOTE_MS);
  });
});
