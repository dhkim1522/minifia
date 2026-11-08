// 단계 길이와 기본 다음 단계 표(DAY-07, 결정 0060-1). 낮은 토론 → 지목 → 변론 → 찬반 → 처형 → 밤으로 돈다.
import { describe, expect, it } from "vitest";
import {
  DEFENSE_MS,
  DISCUSSION_MS,
  MORNING_MAX_MS,
  MORNING_MS,
  MORNING_NOTE_MS,
  MORNING_VICTIM_MS,
  MORNING_WILL_MS,
  PHASE_DEFS,
} from "../../shared/game/phases";
import { RULESET } from "../../shared/game/ruleset";

describe("단계 표 (DAY-07, 결정 0060-1)", () => {
  it("낮 단계 길이: 토론 90000·지목 진입(모이기) 3000·변론 20000·찬반 10000·처형 5600(5000 + 판결 앞머리 600), 밤 30000 (결정 0063-1)", () => {
    expect(DISCUSSION_MS).toBe(90_000);
    expect(DEFENSE_MS).toBe(20_000);
    const ms = (["discussion", "nomination", "defense", "verdict", "execution", "night"] as const).map(
      (id) => PHASE_DEFS[id].durationMs,
    );
    expect(ms.join(",")).toBe(RULESET.pickTurn ? "90000,3000,20000,10000,5600,30000" : "90000,15000,20000,10000,5600,30000"); // 기본판(결정 0072)은 투표 15초
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

describe("아침 길이 상수 (MORN-04, 결정 0061-13)", () => {
  it("기본 5000 + 탈락 2000 + 유언 2000 + 쪽지 2000, 상한 16000(16페이즈 A3: 흔적 구간 5초) 이고 단계 표 morning 행은 기본 길이다", () => {
    expect(`${MORNING_MS},${MORNING_VICTIM_MS},${MORNING_WILL_MS},${MORNING_NOTE_MS},${MORNING_MAX_MS}`).toBe(
      "5000,2000,2000,2000,16000",
    );
    expect(PHASE_DEFS.morning.durationMs).toBe(MORNING_MS);
  });
});
