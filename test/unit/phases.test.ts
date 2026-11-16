// 단계 길이와 기본 다음 단계 표(DAY-07, 결정 0060-1). 낮은 토론 → 찬반 → 지목 → 유언(변론 자리) → 처형 → 밤으로 돈다(결정 0089-18, D-10).
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

describe("단계 표 (DAY-07, 결정 0060-1)", () => {
  it("낮 단계 길이: 토론 90000·찬반 10000·지목 자리 값 15000(순차 지목은 진입 훅 뒤 phaseDurationOf 가 모이기 3000 으로 다시 구한다)·유언 10000(결정 0089-19, 22-11)·처형 6600(유언 카드 3000 + 처형 3000 + 꼬리 600, 22-12), 밤 30000", () => {
    expect(DISCUSSION_MS).toBe(90_000);
    expect(DEFENSE_MS).toBe(10_000);
    const ms = (["discussion", "verdict", "nomination", "defense", "execution", "night"] as const).map(
      (id) => PHASE_DEFS[id].durationMs,
    );
    expect(ms.join(",")).toBe("90000,10000,15000,10000,6600,30000");
  });

  it("기본 다음 단계 사슬: discussion → verdict → nomination → defense → execution → night → morning → dayAnnounce", () => {
    const chain: string[] = ["discussion"];
    let at = PHASE_DEFS.discussion.next;
    while (at !== null && at !== "discussion" && chain.length < 12) {
      chain.push(at);
      if (at === "dayAnnounce") break;
      at = PHASE_DEFS[at].next;
    }
    expect(chain.join(" > ")).toBe("discussion > verdict > nomination > defense > execution > night > morning > dayAnnounce");
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
