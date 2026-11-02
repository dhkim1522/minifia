// 4페이즈 Nyquist 감사 — 여러 날에 걸친 처형·승패 흐름 (VOTE-01~04, END-01, END-02, CONN-02). 08-11: 낮 흐름이 지목·찬반으로 바뀌어 새 흐름으로 옮김.
// 단일 날 시험은 있으나 "날을 건너 쌓이는 기록과 청소" 는 한 판 연속으로 본 시험이 없었다. 상태는 실제 투표 주입과 tick 으로만 만든다.
import { describe, expect, it } from "vitest";
import { isAlive } from "../../shared/game/alive";
import { buildSummary } from "../../shared/game/endgame";
import type { RoomState } from "../../shared/game/room";
import { tick } from "../../shared/game/tick";
import { buildView } from "../../shared/game/view";
import { seededRandInt } from "../helpers/seededRandom";
import { castPoints, castVerdicts, startedAt } from "../helpers/voteState";

function advanceTo(state: RoomState, phase: RoomState["phase"], seed: number): RoomState {
  let s = state;
  for (let guard = 0; s.phase !== phase; guard += 1) {
    if (s.phaseEndsAt === null || guard > 40) throw new Error(`cannot reach ${phase} from ${s.phase}`);
    s = tick(s, s.phaseEndsAt, seededRandInt(seed + guard));
  }
  return s;
}

/** 변론자를 뺀 산 사람 전원 찬성(통과). */
const allYesExcept = (s: RoomState, defender: number): Record<number, boolean> =>
  Object.fromEntries(s.players.filter((p) => isAlive(p) && p.seat !== defender).map((p) => [p.seat, true]));

/** 지목에서 seat 를 최다 득표로 만든다(나머지가 그 사람을 가리키고 본인은 다른 사람을 가리킨다). */
function electing(s: RoomState, seat: number): Record<number, number> {
  const alive = s.players.filter(isAlive);
  const other = alive.find((p) => p.seat !== seat)!;
  return Object.fromEntries(alive.map((p) => [p.seat, p.seat === seat ? other.seat : seat]));
}

/** 서버 전용 개인 표 키가 한 사람에게도 남아 있지 않다. */
const noPersonalKeys = (s: RoomState): boolean => !s.players.some((p) => "nominate" in p || "verdictVote" in p || "endVote" in p);

describe("여러 날에 걸친 처형 흐름 (6명, 마피아 2)", () => {
  for (const seed of [1, 2, 3]) {
    it(`시드 ${seed}: 1일차 지목 동률 무효 → 2일차 마피아 처형(미종료) → 3일차 마피아 처형 → ended citizenWin, 기록이 날짜별로 쌓인다`, () => {
      let s = startedAt(6, seed, "nomination");
      expect(s.day).toBe(1);

      // 1일차: 지목이 서로 1:1 동률 → 변론 없이 밤
      const [a, b] = s.players.filter(isAlive).sort((x, y) => x.seat - y.seat);
      s = castPoints(s, { [a!.seat]: b!.seat, [b!.seat]: a!.seat });
      s = advanceTo(s, "night", seed + 200);
      expect(s.players.every(isAlive)).toBe(true);
      expect(s.voteLog?.length).toBe(1);
      expect(s.voteLog?.[0]?.cand?.candidate).toBeUndefined();

      // 2일차 지목: 지난 낮의 흔적이 모두 비어 있다(낮 시작 청소, Pitfall 1)
      s = advanceTo(s, "nomination", seed + 300);
      expect(s.day).toBe(2);
      expect(s.verdict).toBeUndefined();
      expect(s.execution).toBeUndefined();
      expect(noPersonalKeys(s)).toBe(true);
      expect(s.voteLog?.length).toBe(1); // 기록은 남는다

      const mafias = () => s.players.filter((p) => p.role === "mafia" && isAlive(p)).sort((x, y) => x.seat - y.seat);
      const first = mafias()[0]!.seat;
      s = castPoints(s, electing(s, first));
      s = advanceTo(s, "verdict", seed + 400);
      s = castVerdicts(s, allYesExcept(s, first));
      s = advanceTo(s, "execution", seed + 500);
      expect(s.execution?.seat).toBe(first);
      expect(s.players.find((p) => p.seat === first)?.alive).toBe(false);
      s = tick(s, s.phaseEndsAt!, seededRandInt(seed + 600)); // 마피아 1 vs 시민 4: 끝나지 않는다
      expect(s.phase).toBe("night");
      expect(s.winner).toBeUndefined();

      // 3일차: 남은 마피아 처형 → 종료
      s = advanceTo(s, "nomination", seed + 700);
      expect(s.day).toBe(3);
      expect(noPersonalKeys(s)).toBe(true);
      const second = mafias()[0]!.seat;
      expect(second).not.toBe(first);
      s = castPoints(s, electing(s, second));
      s = advanceTo(s, "verdict", seed + 800);
      s = castVerdicts(s, allYesExcept(s, second));
      s = advanceTo(s, "execution", seed + 900);
      s = tick(s, s.phaseEndsAt!, seededRandInt(seed + 1000));
      expect(s.phase).toBe("ended");
      expect(s.winner).toBe("citizenWin");
      expect(s.phaseEndsAt).toBeNull();

      // 판 요약: 날짜 오름차순, 1일차 후보 없음(부결 줄), 2·3일차 후보가 처형자(변론자를 뺀 유권자 전원 찬성)
      const summary = buildSummary(s);
      expect(summary.map((r) => r.n)).toEqual([1, 2, 3]);
      expect(summary[0]!.exec?.passed).toBe(false);
      expect(summary[0]!.exec?.candidate).toBeUndefined();
      expect(summary[1]!.exec?.candidate).toBe(first);
      expect(summary[1]!.exec?.passed).toBe(true);
      expect(summary[2]!.exec?.candidate).toBe(second);
      expect(summary[2]!.exec?.passed).toBe(true);

      // 종료 뒤 모든 viewer 가 같은 결과를 받고, 종료 후 투표는 거부된다
      const results = s.players.map((p) => JSON.stringify(buildView(s, p.id, 0).result));
      expect(new Set(results).size).toBe(1);
      expect(JSON.parse(results[0]!).winner).toBe("citizenWin");
    });
  }
});

describe("종료 뒤에는 행동이 거부된다 (END-01, END-02)", () => {
  it("ended 에서 지목·찬반·토론 끝내기·밤 지목이 모두 WRONG_PHASE 다", async () => {
    const { castPoint } = await import("../../shared/game/nomination");
    const { castVerdict } = await import("../../shared/game/verdict");
    const { toggleEnd } = await import("../../shared/game/discussion");
    const { pickTarget } = await import("../../shared/game/night");
    const { stateWithVerdict } = await import("../helpers/voteState");
    const s0 = stateWithVerdict(4, 1, "execution", { candidate: "mafia" });
    const ended = tick(s0, s0.phaseEndsAt!, seededRandInt(9));
    expect(ended.phase).toBe("ended");
    const who = ended.players.find(isAlive)!;
    const other = ended.players.find((p) => p.id !== who.id && isAlive(p))!;
    const outcomes = [
      castPoint(ended, who.id, other.seat),
      castVerdict(ended, who.id, true),
      toggleEnd(ended, who.id, true),
      pickTarget(ended, who.id, other.seat),
    ].map((r) => (r.ok ? "ok" : r.error));
    expect(outcomes).toEqual(["WRONG_PHASE", "WRONG_PHASE", "WRONG_PHASE", "WRONG_PHASE"]);
  });
});
