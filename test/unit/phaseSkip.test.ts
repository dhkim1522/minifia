import { describe, expect, it } from "vitest";
import { phaseSkipOpensAt, votePhaseSkip } from "../../shared/game/phaseSkip";
import { PHASE_DEFS, PICK_GAP_MS, PICK_TURN_MS } from "../../shared/game/phases";
import { createRoomState, type RoomState } from "../../shared/game/room";
import { tick } from "../../shared/game/tick";
import { buildView } from "../../shared/game/view";

const START = 20_000;
const OPEN = START + 3_000;

function room(phase: RoomState["phase"], extra: Partial<RoomState> = {}): RoomState {
  const created = createRoomState({ code: "1234", hostId: "p0", hostToken: "secret", hostNickname: "방장", now: 0 });
  if (!created.ok) throw new Error(created.error);
  return {
    ...created.state,
    day: 1,
    phase,
    phaseEndsAt: START + (PHASE_DEFS[phase].durationMs ?? 0),
    players: [
      { ...created.state.players[0]!, id: "p0", connected: true },
      { ...created.state.players[0]!, id: "p1", seat: 1, connected: true },
      { ...created.state.players[0]!, id: "p2", seat: 2, connected: false },
      { ...created.state.players[0]!, id: "p3", seat: 3, connected: true, alive: false },
      { ...created.state.players[0]!, id: "p4", seat: 4, isBot: true },
    ],
    ...extra,
  };
}

describe("서버 단계 건너뛰기", () => {
  it("3초가 지난 창에서 산 사람만 동의하고 취소하며, 끊긴 사람도 분모에 포함한다", () => {
    const state = room("night", { phaseStartsAt: START });
    expect(phaseSkipOpensAt(state)).toBe(OPEN);
    expect(votePhaseSkip(state, "p0", OPEN, true, OPEN - 1)).toEqual({ ok: false, error: "WRONG_PHASE" });
    for (const actor of ["p3", "p4", "outsider"]) {
      expect(votePhaseSkip(state, actor, OPEN, true, OPEN)).toEqual({ ok: false, error: "BAD_MESSAGE" });
    }

    const one = votePhaseSkip(state, "p0", OPEN, true, OPEN);
    if (!one.ok) throw new Error(one.error);
    expect(one.unanimous).toBe(false);
    expect(votePhaseSkip(one.state, "p0", OPEN, true, OPEN)).toEqual({ ...one, unanimous: false });
    const canceled = votePhaseSkip(one.state, "p0", OPEN, false, OPEN);
    if (!canceled.ok) throw new Error(canceled.error);
    expect(canceled.state.phaseSkipVotes).toEqual([]);
    expect(state.phaseSkipVotes).toBeUndefined();

    const two = votePhaseSkip(one.state, "p1", OPEN, true, OPEN);
    if (!two.ok) throw new Error(two.error);
    expect(two.unanimous).toBe(false);
    for (const actor of ["p0", "p1", "p2", "p3"]) {
      const view = buildView(two.state, actor, OPEN);
      expect(view.phaseSkip).toEqual({ opensAt: OPEN, count: 2, total: 3, canVote: actor !== "p3" });
      expect(view.me.phaseSkip).toBe(["p0", "p1"].includes(actor) ? true : undefined);
      expect(JSON.stringify(view)).not.toContain("phaseSkipVotes");
    }
    const all = votePhaseSkip(two.state, "p2", OPEN, true, OPEN);
    if (!all.ok) throw new Error(all.error);
    expect(all.unanimous).toBe(true);
    expect(votePhaseSkip(two.state, "p2", OPEN, true, state.phaseEndsAt!)).toEqual({ ok: false, error: "WRONG_PHASE" });
  });

  it("조기 집계 뒤 결과 발표에서 새 동의 창이 +3초에 열린다", () => {
    const shortened = START + 4_500;
    const voting = room("verdict", {
      playtest: true,
      phaseStartsAt: START,
      phaseEndsAt: shortened,
      earlyFrom: { phase: "verdict", day: 1, endsAt: START + 28_000 },
      phaseSkipVotes: ["p0"],
    });
    const result = tick(voting, shortened);
    expect(result.phase).toBe("verdict");
    expect(result.firstBallotOutcome).toBeDefined();
    expect(result.phaseSkipVotes).toBeUndefined();
    expect(result.earlyFrom).toBeUndefined();
    expect(phaseSkipOpensAt(result)).toBe(shortened + 3_000);
    expect(phaseSkipOpensAt({ ...result, earlyFrom: voting.earlyFrom })).toBe(shortened + 3_000);
    expect(votePhaseSkip(result, "p1", OPEN, true, shortened + 3_000)).toEqual({ ok: false, error: "WRONG_PHASE" });
  });

  it("지목 차례 기권 시 정상 사이와 다음 차례를 밟고 이전 동의가 따라오지 않는다", () => {
    const phaseEndsAt = START + PICK_TURN_MS;
    const state = room("nomination", {
      phaseEndsAt,
      pickTurn: { order: [0, 1, 2, 4], i: 0, endsAt: phaseEndsAt },
      phaseSkipVotes: ["p0", "p1"],
    });
    const all = votePhaseSkip(state, "p2", OPEN, true, OPEN);
    if (!all.ok) throw new Error(all.error);
    expect(all.unanimous).toBe(true);
    const gap = tick({ ...all.state, phaseEndsAt: OPEN }, OPEN);
    expect(gap.pickTurn).toMatchObject({ i: 0, doneAt: OPEN, skip: true });
    expect(phaseSkipOpensAt(gap)).toBeUndefined();
    const nextAt = OPEN + PICK_GAP_MS;
    const next = tick(gap, nextAt);
    expect(next.pickTurn?.i).toBe(1);
    expect(next.phaseSkipVotes).toBeUndefined();
    expect(phaseSkipOpensAt(next)).toBe(nextAt + 3_000);
  });

  it("처형과 아침 결과의 읽는 시간, 짧은 정답·일반 낮 발표를 보호한다", () => {
    expect(phaseSkipOpensAt(room("execution"))).toBe(START + 5_000);
    expect(phaseSkipOpensAt(room("morning"))).toBeUndefined();
    expect(phaseSkipOpensAt(room("morning", { playtest: true, phaseEndsAt: START + 8_000 }))).toBe(START + 4_600);
    expect(phaseSkipOpensAt(room("dayAnnounce"))).toBeUndefined();
    expect(phaseSkipOpensAt(room("answerReveal"))).toBeUndefined();
  });
});
