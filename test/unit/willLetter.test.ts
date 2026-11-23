// 유언 편지 순수 모델 시험 (09.1-10, 결정 0063-3, UI-SPEC C-1~C-3, M-7·M-8·M-9)
import { describe, expect, it } from "vitest";
import type { DayView, PhaseId, PublicPlayer, RoomView } from "../../shared/protocol";
import type { RoomState } from "../../shared/game/room";
import { morningMsOf } from "../../shared/game/discussion";
import { letterT0, LETTER_END_AT_MS, LETTER_FOLD_AT_MS, LETTER_FOLD_MS, LETTER_RISE_MS, LETTER_SEAL_AT_MS, LETTER_SEAL_MS, oneParagraph, SEAL_GLYPH } from "../../src/game/willLetter";

describe("유언 시간표", () => {
  it("편지가 나타난 뒤 봉랍을 찍고 채팅 공개 시각에 접힌다", () => {
    expect([LETTER_RISE_MS, LETTER_SEAL_AT_MS, LETTER_SEAL_MS]).toEqual([700, 760, 500]);
    expect(LETTER_SEAL_AT_MS + LETTER_SEAL_MS).toBeLessThan(LETTER_FOLD_AT_MS);
    expect([LETTER_FOLD_AT_MS, LETTER_FOLD_MS, LETTER_END_AT_MS]).toEqual([5000, 420, 5420]);
    expect(SEAL_GLYPH).toBe("M");
  });
});

describe("oneParagraph", () => {
  it("줄바꿈은 공백으로 이어 한 문단", () => {
    expect(oneParagraph("가\n나")).toBe("가 나");
    expect(oneParagraph("가\r\n\r\n나 \n 다")).toBe("가 나 다");
    expect(oneParagraph("  그대로  ")).toBe("그대로");
  });
});

// ---- letterT0 ----
const NAMES = ["서연", "민준", "도윤", "지호", "하윤"];
const pl = (seat: number, alive = true): PublicPlayer => ({ seat, nickname: NAMES[seat]!, connected: true, isHost: seat === 0, ...(alive ? {} : { alive: false }) });
function viewOf(phase: PhaseId, opts: { mySeat?: number; dead?: number[]; day?: Partial<DayView>; me?: Partial<RoomView["me"]> } = {}): RoomView {
  return {
    code: "0042",
    phase,
    phaseEndsAt: null,
    phaseDurationMs: null,
    serverNow: 0,
    minPlayers: 4,
    maxPlayers: 8,
    players: NAMES.map((_, seat) => pl(seat, !(opts.dead ?? []).includes(seat))),
    me: { seat: opts.mySeat ?? 0, isHost: false, ...opts.me },
    day: { n: 1, roles: [], ...opts.day },
  };
}

describe("letterT0 — 보는 사람별 시작 시각", () => {
  it("일반: 400", () => {
    expect(letterT0(viewOf("night", { mySeat: 2 }), viewOf("morning", { mySeat: 2, dead: [3], day: { morning: { eliminated: 3 } } }))).toBe(400);
  });
  it("피해자 본인: 700", () => {
    expect(letterT0(viewOf("night", { mySeat: 1 }), viewOf("morning", { mySeat: 1, dead: [1], day: { morning: { eliminated: 1 } } }))).toBe(700);
  });
  it("경찰 본인(조사 결과 줄이 생김): 2600", () => {
    const prev = viewOf("night", { mySeat: 2, me: { role: "police", records: [] } });
    const cur = viewOf("morning", { mySeat: 2, dead: [3], day: { morning: { eliminated: 3 } }, me: { role: "police", records: [{ n: 1, target: 4, isMafia: false }] } });
    expect(letterT0(prev, cur)).toBe(2600);
  });
  it("밤 → 아침이 아니거나 탈락자가 없으면 null", () => {
    const morning = viewOf("morning", { dead: [3], day: { morning: { eliminated: 3 } } });
    expect(letterT0(null, morning)).toBeNull();
    expect(letterT0(viewOf("lobby"), morning)).toBeNull();
    expect(letterT0(viewOf("night"), viewOf("morning", { day: { morning: { saved: true } } }))).toBeNull();
    expect(letterT0(viewOf("night"), viewOf("morning", { day: { morning: {} } }))).toBeNull();
    expect(letterT0(viewOf("night"), morning, { reset: true })).toBeNull();
  });
});

describe("M-9 아침 길이 불변식 — 편지가 끝나고 0.5초 이상 남는다", () => {
  const stateOf = (will: string, note: string): RoomState =>
    ({ morning: { eliminated: 3 }, players: [{ seat: 3, will }], ...(note === "" ? {} : { nightNote: note }) }) as unknown as RoomState;
  for (const [label, ms] of [
    ["유언만", morningMsOf(stateOf("안녕", ""))],
    ["유언+쪽지", morningMsOf(stateOf("안녕", "쪽지"))],
  ] as const) {
    it(`${label} (${ms}ms)`, () => {
      expect(ms).toBeGreaterThanOrEqual(9000);
      for (const t0 of [400, 700, 2600]) expect(t0 + LETTER_END_AT_MS + 500).toBeLessThanOrEqual(ms);
    });
  }
});
