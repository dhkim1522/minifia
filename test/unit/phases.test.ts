// 단계 길이와 기본 다음 단계 표(DAY-07, 결정 0060-1). 낮은 토론 → 지목 → 변론 → 찬반 → 처형 → 밤으로 돈다.
import { describe, expect, it } from "vitest";
import { DEFENSE_MS, DISCUSSION_MS, PHASE_DEFS } from "../../shared/game/phases";

describe("단계 표 (DAY-07, 결정 0060-1)", () => {
  it("낮 단계 길이: 토론 90000·지목 15000·변론 20000·찬반 10000·처형 5000, 밤 30000", () => {
    expect(DISCUSSION_MS).toBe(90_000);
    expect(DEFENSE_MS).toBe(20_000);
    const ms = (["discussion", "nomination", "defense", "verdict", "execution", "night"] as const).map(
      (id) => PHASE_DEFS[id].durationMs,
    );
    expect(ms.join(",")).toBe("90000,15000,20000,10000,5000,30000");
  });

  it("기본 다음 단계 사슬: discussion → nomination → defense → verdict → execution → night → morning → dayAnnounce", () => {
    const chain: string[] = ["discussion"];
    let at = PHASE_DEFS.discussion.next;
    while (at !== null && at !== "discussion" && chain.length < 12) {
      chain.push(at);
      if (at === "dayAnnounce") break;
      at = PHASE_DEFS[at].next;
    }
    expect(chain.join(" > ")).toBe("discussion > nomination > defense > verdict > execution > night > morning > dayAnnounce");
  });

  it("옛 처형 여부·후보 선택·후보 공개 단계로는 기본 경로로도 가지 않는다", () => {
    const OLD = ["execVote", "candidateVote", "candidateVoteReveal"];
    // 08-22: 단계 표에 옛 행 자체가 없고, 어떤 행의 기본 다음 단계도 옛 단계가 아니다.
    expect(Object.keys(PHASE_DEFS).filter((id) => OLD.includes(id))).toEqual([]);
    const targets: Array<string | null> = Object.values(PHASE_DEFS).map((def) => def.next);
    for (const old of OLD) {
      expect(targets.includes(old)).toBe(false);
    }
  });
});
