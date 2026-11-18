import { describe, expect, it } from "vitest";
import { endCountOf, endReached, phaseDurationOf, toggleEnd } from "../../shared/game/discussion";
import { shrinkDeadline } from "../../shared/game/early";
import { pickTarget } from "../../shared/game/night";
import { allRolesReady, castFirstBallot, confirmRole, voteOpensAt } from "../../shared/game/playtest";
import type { PhaseId } from "../../shared/protocol";
import { createRoomState, type RoomState } from "../../shared/game/room";
import { resetToLobby } from "../../shared/game/testTools";
import { tick } from "../../shared/game/tick";
import { castVerdict } from "../../shared/game/verdict";
import { buildView } from "../../shared/game/view";

function room(phase: PhaseId = "verdict", deadline = 200_000): RoomState {
  const created = createRoomState({ code: "1234", hostId: "p0", hostToken: "token", hostNickname: "연습", now: 0, playtest: true, testMode: true });
  if (!created.ok) throw new Error("invalid fixture");
  const roles = ["police", "mafia", "citizen", "citizen"] as const;
  return {
    ...created.state,
    phase,
    phaseEndsAt: deadline,
    day: 1,
    keyword: { genre: "food", word: "떡볶이" },
    players: roles.map((role, seat) => ({ ...created.state.players[0]!, id: `p${seat}`, seat, role, connected: true })),
  };
}

function ballot(state: RoomState, seat: number, target: number | null): RoomState {
  const result = castFirstBallot(state, `p${seat}`, target);
  if (!result.ok) throw new Error(result.error);
  return result.state;
}

describe("로컬 첫날 실험 규칙", () => {
  it("재즈 바에서 역할 확인을 기다리고 봇이 준비를 막지 않는다", () => {
    let assigning = room("assigning");
    assigning = { ...assigning, players: assigning.players.map((p) => p.seat === 3 ? { ...p, isBot: true } : p) };
    expect(assigning.mapChoice).toBe("bar");
    let ready = tick(assigning, 200_000);
    expect(ready.phase).toBe("roleReveal");
    expect(ready.phaseEndsAt).toBe(255_000);
    for (let seat = 0; seat < 3; seat += 1) {
      expect(allRolesReady(ready)).toBe(false);
      const next = confirmRole(ready, `p${seat}`);
      if (!next.ok) throw new Error(next.error);
      ready = next.state;
      expect(buildView(ready, `p${seat}`, 205_000).me.roleReady).toBe(true);
    }
    expect(allRolesReady(ready)).toBe(true);
    expect(confirmRole(ready, "p0")).toEqual({ ok: true, state: ready });
    expect(confirmRole(ready, "p3")).toEqual({ ok: false, error: "BAD_MESSAGE" });
    expect(buildView(ready, "p0", 205_000).players).toEqual(buildView(assigning, "p0", 195_000).players);
    const timedOut = tick(tick(assigning, 200_000), 255_000);
    expect(timedOut.phase).toBe("keyword");
    expect(timedOut.phaseEndsAt).toBe(288_000);
  });

  it("공개 키워드 마감과 첫 아침 읽기 여유, 45초 이후 토론 마감 요청을 적용한다", () => {
    const keyword = room("keyword");
    keyword.answerSubmits = keyword.players.map(({ seat }) => ({ seat, text: "한 줄" }));
    expect(shrinkDeadline(keyword, 160_000, { extend: false })).toBe(keyword);
    expect(phaseDurationOf(keyword)).toBe(33_000);
    const discussion = room("discussion");
    discussion.players[3] = { ...discussion.players[3]!, isBot: true, endVote: true };
    expect(voteOpensAt(discussion)).toBe(125_000);
    expect(buildView(discussion, "p0", 100_000).day).toMatchObject({ endCount: 0, voteOpensAt: 125_000, voteReadyRequired: 2 });
    let ended = discussion;
    for (const actor of ["p0", "p1"]) {
      const next = toggleEnd(ended, actor, true);
      if (!next.ok) throw new Error(next.error);
      ended = next.state;
    }
    expect(endCountOf(ended)).toBe(2);
    expect(endReached(ended)).toBe(true);
    expect(phaseDurationOf(room("morning"))).toBe(8_000);
  });

  it("개인 표와 자기·탈락자의 투표를 차단하고 마감 뒤 집계만 공개한다", () => {
    const state = room();
    expect(castFirstBallot(state, "p0", 0)).toEqual({ ok: false, error: "BAD_MESSAGE" });
    expect(castVerdict(state, "p0", true)).toEqual({ ok: false, error: "WRONG_PHASE" });
    const votes = ballot(ballot(ballot(state, 0, 2), 1, 2), 2, null);
    expect(buildView(votes, "p0", 190_000).me.firstBallot).toBe(2);
    expect(buildView(votes, "p2", 190_000).me.firstBallot).toBeNull();
    const passive = buildView(votes, "p3", 190_000);
    expect(passive.me).not.toHaveProperty("firstBallot");
    expect(passive.day?.firstBallot).toEqual({ count: 3 });
    expect(passive.players.every((p) => !Object.hasOwn(p, "firstBallot") && !Object.hasOwn(p, "role"))).toBe(true);
    const revealed = tick(votes, 200_000);
    expect(revealed.phase).toBe("verdict");
    expect(revealed.phaseEndsAt).toBe(207_000);
    expect(revealed.players.every((p) => !Object.hasOwn(p, "firstBallot"))).toBe(true);
    expect(castFirstBallot(revealed, "p3", null)).toEqual({ ok: false, error: "WRONG_PHASE" });
    expect(buildView(revealed, "p0", 201_000).day?.firstBallot).toEqual({ count: 3, result: { target: 2, votes: 2, holds: 1 } });
    const defense = tick(revealed, 207_000);
    expect(defense.phase).toBe("defense");
    expect(tick(defense, defense.phaseEndsAt!).players[2]?.alive).toBe(false);
  });

  it.each([
    { targets: [null, null, 1] as const, reason: "held" },
    { targets: [1, 2] as const, reason: "tie" },
    { targets: [1, null] as const, reason: "tie" },
    { targets: [] as const, reason: "noVotes" },
  ])("동률·보류·무투표 $reason 에는 아무도 탈락하지 않는다", ({ targets, reason }) => {
    let state = room();
    for (const [seat, target] of targets.entries()) state = ballot(state, seat, target);
    const result = tick(state, 200_000);
    expect(buildView(result, "p0", 201_000).day?.firstBallot?.result).toMatchObject({ target: null, reason });
    const answer = tick(result, 207_000);
    expect(answer.phase).toBe("answerReveal");
    expect(tick(answer, answer.phaseEndsAt!).phase).toBe("night");
    expect(answer.players.every((p) => p.alive !== false)).toBe(true);
  });

  it("같은 밤 마감과 기존 둘째 날 투표를 사용하고 실험 모드는 방에 남긴다", () => {
    let night = room("night");
    expect(pickTarget(night, "p2", 1)).toEqual({ ok: false, error: "BAD_MESSAGE" });
    for (const [id, target] of [["p0", 1], ["p1", 3]] as const) {
      const picked = pickTarget(night, id, target);
      if (!picked.ok) throw new Error(picked.error);
      night = picked.state;
    }
    expect(shrinkDeadline(night, 171_000, { extend: false })).toBe(night);
    expect(buildView(night, "p2", 185_000).phaseEndsAt).toBe(200_000);
    expect(buildView(night, "p2", 185_000).me).not.toHaveProperty("pick");
    const morning = tick(night, 200_000);
    expect(morning.morning?.eliminated).toBe(3);
    const second = tick(morning, 210_000);
    expect(second.day).toBe(2);
    expect(tick(second, second.phaseEndsAt!).phaseEndsAt).toBe(302_000);
    const reset = resetToLobby(night, "p0");
    expect(reset).toMatchObject({ ok: true, state: { playtest: true, mapChoice: "bar" } });
  });

  it("일반 방에는 실험 프로토콜과 규칙이 적용되지 않는다", () => {
    const { playtest: _test, ...legacy } = room();
    expect(castFirstBallot(legacy, "p0", 1)).toEqual({ ok: false, error: "BAD_MESSAGE" });
    expect(buildView(legacy, "p0", 190_000)).not.toHaveProperty("playtest");
    expect(buildView(legacy, "p0", 190_000).day?.verdictCount).toEqual({ yes: 0, no: 0 });
    expect(tick(legacy, 200_000).phase).toBe("answerReveal");
  });
});
