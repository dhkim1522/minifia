// 4페이즈 Nyquist 감사 — 여러 날에 걸친 처형·승패 흐름 (VOTE-01~04, END-01, END-02, CONN-02).
// 단일 날 시험은 있으나 "날을 건너 쌓이는 기록과 청소" 는 한 판 연속으로 본 시험이 없었다. 상태는 실제 투표 주입과 tick 으로만 만든다.
import { describe, expect, it } from "vitest";
import { isAlive } from "../../shared/game/alive";
import { buildSummary } from "../../shared/game/endgame";
import type { RoomState } from "../../shared/game/room";
import { tick } from "../../shared/game/tick";
import { buildView } from "../../shared/game/view";
import { seededRandInt } from "../helpers/seededRandom";
import { castCandidateVotes, castExecVotes, startedAt } from "../helpers/voteState";

function advanceTo(state: RoomState, phase: RoomState["phase"], seed: number): RoomState {
  let s = state;
  for (let guard = 0; s.phase !== phase; guard += 1) {
    if (s.phaseEndsAt === null || guard > 40) throw new Error(`cannot reach ${phase} from ${s.phase}`);
    s = tick(s, s.phaseEndsAt, seededRandInt(seed + guard));
  }
  return s;
}

const allYes = (s: RoomState): Record<number, boolean> =>
  Object.fromEntries(s.players.filter(isAlive).map((p) => [p.seat, true]));

/** 후보 선택 후 표를 던져 후보 seat 를 최다 득표로 만든다(후보 본인은 다른 사람을 고른다). */
function electing(s: RoomState, seat: number): Record<number, number> {
  const alive = s.players.filter(isAlive);
  const other = alive.find((p) => p.seat !== seat)!;
  return Object.fromEntries(alive.map((p) => [p.seat, p.seat === seat ? other.seat : seat]));
}

describe("여러 날에 걸친 처형 흐름 (6명, 마피아 2)", () => {
  for (const seed of [1, 2, 3]) {
    it(`시드 ${seed}: 1일차 동률 무효 → 2일차 마피아 처형(미종료) → 3일차 마피아 처형 → ended citizenWin, 기록이 날짜별로 쌓인다`, () => {
      let s = startedAt(6, seed, "execVote");
      expect(s.day).toBe(1);

      // 1일차: 통과하지만 후보 선택이 서로 1:1 → 처형 없이 밤
      s = castExecVotes(s, allYes(s));
      s = advanceTo(s, "candidateVote", seed + 100);
      const [a, b] = s.players.filter(isAlive).sort((x, y) => x.seat - y.seat);
      s = castCandidateVotes(s, { [a!.seat]: b!.seat, [b!.seat]: a!.seat });
      s = advanceTo(s, "night", seed + 200);
      expect(s.players.every(isAlive)).toBe(true);
      expect(s.voteLog?.length).toBe(1);
      expect(s.voteLog?.[0]?.cand?.candidate).toBeUndefined();

      // 2일차 execVote: 지난 투표의 흔적이 모두 비어 있다
      s = advanceTo(s, "execVote", seed + 300);
      expect(s.day).toBe(2);
      expect(s.verdict).toBeUndefined();
      expect(s.execution).toBeUndefined();
      expect(s.players.some((p) => "execVote" in p || "candidateVote" in p)).toBe(false);
      expect(s.voteLog?.length).toBe(1); // 기록은 남는다

      const mafias = () => s.players.filter((p) => p.role === "mafia" && isAlive(p)).sort((x, y) => x.seat - y.seat);
      const first = mafias()[0]!.seat;
      s = castExecVotes(s, allYes(s));
      s = advanceTo(s, "candidateVote", seed + 400);
      s = castCandidateVotes(s, electing(s, first));
      s = advanceTo(s, "execution", seed + 500);
      expect(s.execution?.seat).toBe(first);
      expect(s.players.find((p) => p.seat === first)?.alive).toBe(false);
      s = tick(s, s.phaseEndsAt!, seededRandInt(seed + 600)); // 마피아 1 vs 시민 4: 끝나지 않는다
      expect(s.phase).toBe("night");
      expect(s.winner).toBeUndefined();

      // 3일차: 남은 마피아 처형 → 종료
      s = advanceTo(s, "execVote", seed + 700);
      expect(s.day).toBe(3);
      expect(s.players.some((p) => "execVote" in p || "candidateVote" in p)).toBe(false);
      const second = mafias()[0]!.seat;
      expect(second).not.toBe(first);
      s = castExecVotes(s, allYes(s));
      s = advanceTo(s, "candidateVote", seed + 800);
      s = castCandidateVotes(s, electing(s, second));
      s = advanceTo(s, "execution", seed + 900);
      s = tick(s, s.phaseEndsAt!, seededRandInt(seed + 1000));
      expect(s.phase).toBe("ended");
      expect(s.winner).toBe("citizenWin");
      expect(s.phaseEndsAt).toBeNull();

      // 판 요약: 날짜 오름차순, 1일차 후보 없음, 2·3일차 후보가 처형자
      const summary = buildSummary(s);
      expect(summary.map((r) => r.n)).toEqual([1, 2, 3]);
      expect(summary[0]!.exec?.passed).toBe(true);
      expect(summary[0]!.exec?.candidate).toBeUndefined();
      expect(summary[1]!.exec?.candidate).toBe(first);
      expect(summary[2]!.exec?.candidate).toBe(second);

      // 종료 뒤 모든 viewer 가 같은 결과를 받고, 종료 후 투표는 거부된다
      const results = s.players.map((p) => JSON.stringify(buildView(s, p.id, 0).result));
      expect(new Set(results).size).toBe(1);
      expect(JSON.parse(results[0]!).winner).toBe("citizenWin");
    });
  }
});

describe("종료 뒤에는 행동이 거부된다 (END-01, END-02)", () => {
  it("ended 에서 여부 투표·후보 선택·지목·이모티콘이 모두 WRONG_PHASE 다", async () => {
    const { castCandidateVote, castExecVote } = await import("../../shared/game/vote");
    const { emote } = await import("../../shared/game/chat");
    const { pickTarget } = await import("../../shared/game/night");
    const { stateWithVerdict } = await import("../helpers/voteState");
    const s0 = stateWithVerdict(4, 1, "execution", { candidate: "mafia" });
    const ended = tick(s0, s0.phaseEndsAt!, seededRandInt(9));
    expect(ended.phase).toBe("ended");
    const who = ended.players.find(isAlive)!;
    const other = ended.players.find((p) => p.id !== who.id && isAlive(p))!;
    const outcomes = [
      castExecVote(ended, who.id, true),
      castCandidateVote(ended, who.id, other.seat),
      pickTarget(ended, who.id, other.seat),
      emote(ended, who.id, "smile", 1_000_000),
    ].map((r) => (r.ok ? "ok" : r.error));
    expect(outcomes).toEqual(["WRONG_PHASE", "WRONG_PHASE", "WRONG_PHASE", "WRONG_PHASE"]);
  });
});
