// 결과 시간표 순수 모듈 시험 (11-05, 결정 D-1·D-11·D-25). 시각은 인자라 가짜 타이머가 필요 없다.
import { describe, expect, it } from "vitest";
import { ringSlots } from "../../shared/game/gather";
import type { RoleId } from "../../shared/game/roles";
import type { GameWinner, PublicPlayer, RoomView } from "../../shared/protocol";
import { castOf, CEREMONY_START_MS, finalState, holdSnap, RESULT_TIMELINE, slotsFor, teamOf } from "../../src/game/resultDirector";
import { jobOutfit } from "../../src/world/ghostOutfit";

const JOBS: RoleId[] = ["citizen", "police", "doctor", "mafia", "citizen", "mafia"];

function viewOf(jobs: RoleId[], dead: number[] = [], winner: GameWinner = "citizenWin"): RoomView & { result: NonNullable<RoomView["result"]> } {
  // 좌석 순서를 일부러 섞어 둔다 — 디렉터가 좌석 오름차순으로 정렬해야 한다
  const seats = jobs.map((job, seat) => ({ seat, job })).reverse();
  const players: PublicPlayer[] = jobs.map((_, seat) => ({ seat, nickname: `손님${seat}`, connected: true, isHost: seat === 0, ...(dead.includes(seat) ? { alive: false } : {}) }));
  return {
    code: "0042",
    phase: "ended",
    phaseEndsAt: null,
    phaseDurationMs: null,
    serverNow: 0,
    minPlayers: 4,
    maxPlayers: 8,
    players,
    me: { seat: 0, isHost: true, chat: "all" },
    result: { winner, seats, summary: [] },
  };
}

describe("RESULT_TIMELINE (A-1, D-1)", () => {
  it("값이 계약과 같다", () => {
    expect(RESULT_TIMELINE).toEqual({ gatherMs: 1200, flipStartMs: 1200, flipGapMs: 400, lightAtMs: 4600, announceEndMs: 5200, ceremonyStartMs: 5600 });
    expect(CEREMONY_START_MS).toBe(5600);
  });
});

describe("castOf · slotsFor", () => {
  it("좌석 오름차순으로 {seat, job, team, alive} 를 만든다 (탈락자 포함)", () => {
    const cast = castOf(viewOf(JOBS, [2, 5]));
    expect(cast.map((c) => c.seat)).toEqual([0, 1, 2, 3, 4, 5]);
    expect(cast.map((c) => c.job)).toEqual(JOBS);
    expect(cast.map((c) => c.alive)).toEqual([true, true, false, true, true, false]);
    expect(cast.map((c) => c.team)).toEqual(["citizen", "citizen", "citizen", "mafia", "citizen", "mafia"]);
  });

  it("마피아 직업만 마피아 편이다", () => {
    expect(teamOf("mafia")).toBe("mafia");
    for (const job of ["citizen", "police", "doctor"] as const) expect(teamOf(job)).toBe("citizen");
  });

  it("i 번째 좌석은 ringSlots(n)[i] 자리다 — 모든 폰이 같은 배치", () => {
    const cast = castOf(viewOf(JOBS));
    const slots = slotsFor(cast);
    const table = ringSlots(JOBS.length);
    cast.forEach((c, i) => expect(slots[c.seat]).toEqual(table[i]));
    expect(slotsFor(castOf(viewOf(JOBS, [1])))).toEqual(slots); // 생사와 무관
  });

  it("참가자 수 2~8 어디서나 자리가 모두 다르다", () => {
    for (let n = 2; n <= 8; n++) {
      const jobs: RoleId[] = Array.from({ length: n }, (_, i) => (i === 0 ? "mafia" : "citizen"));
      const slots = Object.values(slotsFor(castOf(viewOf(jobs))));
      expect(new Set(slots.map((s) => s.join(","))).size).toBe(n);
    }
  });
});

describe("finalState (A-5)", () => {
  it("시민 승: 전원 뒤집힘·직업 의상, 마피아 편 어둠, 조명 켜짐, 승리 알림 없음, 제목 시민 승리", () => {
    const cast = castOf(viewOf(JOBS, [2]));
    const s = finalState(cast, "citizenWin");
    expect(s.stage).toBe("final");
    expect(s.flipped).toEqual([0, 1, 2, 3, 4, 5]);
    expect(s.costumes).toEqual({ 0: "coat", 1: "police", 2: "doctor", 3: "mafia", 4: "coat", 5: "mafia" });
    expect(s.dimmed).toEqual([3, 5]);
    expect(s.lit).toBe(true);
    expect(s.announce).toBe(false);
    expect(s.clap).toEqual([]);
    expect(s.title).toBe("citizenWin");
  });

  it("마피아 승: 진 팀은 시민 편 전원이다", () => {
    const cast = castOf(viewOf(JOBS, [], "mafiaWin"));
    const s = finalState(cast, "mafiaWin");
    expect(s.dimmed).toEqual([0, 1, 2, 4]);
    expect(s.title).toBe("mafiaWin");
  });

  it("의상은 ghostOutfit 의 jobOutfit 한 곳과 같다 (새 표 없음)", () => {
    const cast = castOf(viewOf(JOBS));
    const s = finalState(cast, "citizenWin");
    for (const c of cast) expect(s.costumes[c.seat]).toBe(jobOutfit(c.job));
  });
});

describe("holdSnap — 한 점 구간", () => {
  it("자리마다 한 점 구간(p 두 값, 정수)이고 모두 같은 t0 다", () => {
    const cast = castOf(viewOf(JOBS));
    const ents = holdSnap(slotsFor(cast), 123_456);
    expect(ents.map((e) => e.s)).toEqual([0, 1, 2, 3, 4, 5]);
    for (const e of ents) {
      expect(e.p).toHaveLength(2);
      expect(e.p.every(Number.isInteger)).toBe(true);
      expect(e.t0).toBe(123_456);
    }
  });
});
