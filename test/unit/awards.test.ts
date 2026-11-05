// 11-02 칭호(END-04) 순수 규칙 시험. Task 1: 대체 칭호 경로(D-4). 서버 기록만으로 결정적으로 정하고 입력을 바꾸지 않는다.
import { describe, expect, it } from "vitest";
import { computeAwards, eliminationOf } from "../../shared/game/awards";
import { buildView } from "../../shared/game/view";
import type { AwardLine } from "../../shared/protocol";
import { ROLES5, endedState, execDay } from "../helpers/awardsState";
import { startedAt } from "../helpers/voteState";

describe("칭호 — 대체 칭호 경로 (D-4)", () => {
  it("산 사람은 survivor(k 없음), 처형된 사람은 spectator(k=일차, at=day), 밤에 죽은 사람은 spectator(at=night)", () => {
    const s = endedState({
      roles: ROLES5,
      dead: [3, 4],
      voteLog: [execDay(1, [[0, 3], [1, 3], [2, 3], [3, 0], [4, 3]], 3)],
      nightLog: [{ n: 1, target: 4, died: true }],
      winner: "mafiaWin",
    });
    expect(eliminationOf(s, 3)).toEqual({ n: 1, at: "day" });
    expect(eliminationOf(s, 4)).toEqual({ n: 1, at: "night" });
    expect(eliminationOf(s, 0)).toBeUndefined();
    const awards = computeAwards(s);
    // 마피아 승리: 진 팀(시민 편: seat 1·2·3·4) 먼저, 이긴 팀(seat 0) 나중
    expect(awards).toEqual<AwardLine[]>([
      { seat: 1, award: "survivor" },
      { seat: 2, award: "survivor" },
      { seat: 3, award: "spectator", k: 1, at: "day" },
      { seat: 4, award: "spectator", k: 1, at: "night" },
      { seat: 0, award: "survivor" },
    ]);
  });

  it("참가자(role 있는 사람)만 한 장씩 받는다 — role 이 없는 사람은 없다", () => {
    const s = endedState({ roles: ["mafia", "police", "citizen", "citizen", undefined] });
    const awards = computeAwards(s);
    expect(awards.length).toBe(4);
    expect(awards.some((a) => a.seat === 4)).toBe(false);
  });

  it("시민 승리면 진 팀은 마피아 편이 먼저, 같은 팀은 낮은 좌석부터", () => {
    const s = endedState({ roles: ["citizen", "mafia", "doctor", "mafia", "police"], winner: "citizenWin" });
    expect(computeAwards(s).map((a) => a.seat)).toEqual([1, 3, 0, 2, 4]);
  });

  it("입력을 바꾸지 않고 같은 입력은 같은 출력이다", () => {
    const s = endedState({ roles: ROLES5, dead: [2], nightLog: [{ n: 1, target: 2, died: true }] });
    const before = JSON.stringify(s);
    const a = computeAwards(s);
    expect(JSON.stringify(s)).toBe(before);
    expect(computeAwards(s)).toEqual(a);
  });
});

describe("buildView — result.awards (D-4, L35)", () => {
  it("ended 의 result.awards 는 computeAwards 와 같고, ended 가 아닌 단계의 view 에는 result 도 awards 도 없다", () => {
    const s = endedState({ roles: ROLES5, dead: [3], voteLog: [execDay(1, [[0, 3]], 3)] });
    const view = buildView(s, s.players[0]!.id, 1_000);
    expect(JSON.stringify(view.result?.awards)).toBe(JSON.stringify(computeAwards(s)));
    for (const phase of ["roleReveal", "dayAnnounce", "discussion", "nomination"] as const) {
      const mid = startedAt(5, 3, phase);
      const text = JSON.stringify(buildView(mid, mid.players[0]!.id, 1_000));
      expect(`${phase}:${text.includes("awards")}:${text.includes("\"result\"")}`).toBe(`${phase}:false:false`);
    }
  });
});
