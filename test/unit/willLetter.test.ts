// 유언 편지 순수 모델 시험 (09.1-10, 결정 0063-3, UI-SPEC C-1~C-3, M-7·M-8·M-9)
import { describe, expect, it } from "vitest";
import type { DayView, PhaseId, PublicPlayer, RoomView } from "../../shared/protocol";
import type { RoomState } from "../../shared/game/room";
import { morningMsOf } from "../../shared/game/discussion";
import {
  chooseTier,
  letterT0,
  LETTER_END_AT_MS,
  LETTER_FOLD_AT_MS,
  LETTER_FOLD_MS,
  LETTER_FONT_WAIT_MS,
  LETTER_LINE_GAP_MS,
  LETTER_MS_PER_CHAR,
  LETTER_PAPER_MAX_H,
  LETTER_PAPER_MIN_H,
  LETTER_RISE_MS,
  LETTER_SEAL_GAP_MS,
  LETTER_SEAL_MS,
  LETTER_TIERS,
  LETTER_WRITE_AT_MS,
  LETTER_WRITE_MAX_MS,
  oneParagraph,
  paperHeight,
  SEAL_GLYPH,
  writeSchedule,
} from "../../src/game/willLetter";

describe("상수", () => {
  it("시안 값 그대로", () => {
    expect([LETTER_RISE_MS, LETTER_WRITE_AT_MS, LETTER_LINE_GAP_MS, LETTER_MS_PER_CHAR, LETTER_WRITE_MAX_MS]).toEqual([700, 800, 100, 190, 2300]);
    expect([LETTER_SEAL_GAP_MS, LETTER_SEAL_MS, LETTER_FOLD_AT_MS, LETTER_FOLD_MS, LETTER_END_AT_MS, LETTER_FONT_WAIT_MS]).toEqual([100, 500, 5000, 420, 5420, 1000]);
    expect([LETTER_PAPER_MAX_H, LETTER_PAPER_MIN_H]).toEqual([340, 220]);
    expect(LETTER_TIERS).toEqual([
      { font: 46, line: 56 },
      { font: 36, line: 44 },
      { font: 28, line: 32 },
    ]);
    expect(SEAL_GLYPH).toBe("M");
  });
  it("접힘이 끝나는 시각 = 접힘 시작 + 접힘 길이", () => {
    expect(LETTER_FOLD_AT_MS + LETTER_FOLD_MS).toBe(LETTER_END_AT_MS);
  });
});

describe("writeSchedule", () => {
  it("두 줄(8자·4자): W 2280, 첫 줄 800, 줄 사이 100, 인장 3180", () => {
    const s = writeSchedule(["현우 님 말투가", "이상해요"])!;
    expect(s.writeMs).toBe(2280);
    expect(s.lines).toHaveLength(2);
    expect(s.lines[0]).toMatchObject({ at: 800, steps: 8 });
    expect(s.lines[1]).toMatchObject({ steps: 4 });
    expect(s.lines[1]!.at).toBe(s.lines[0]!.at + s.lines[0]!.ms + 100);
    // 두 줄 ms 합 = W − 100, 비율 8:4
    expect(s.lines[0]!.ms + s.lines[1]!.ms).toBe(2280 - 100);
    expect(Math.abs(s.lines[0]!.ms - 2 * s.lines[1]!.ms)).toBeLessThanOrEqual(2);
    expect(s.lines[1]!.at + s.lines[1]!.ms).toBe(800 + 2280);
    expect(s.sealAt).toBe(3180);
    expect(s.foldAt).toBe(5000);
    expect(s.endAt).toBe(5420);
  });
  it("한 줄 3자: W 570, 인장 1470", () => {
    const s = writeSchedule(["가나다"])!;
    expect(s.writeMs).toBe(570);
    expect(s.lines).toEqual([{ at: 800, ms: 570, steps: 3 }]);
    expect(s.sealAt).toBe(1470);
  });
  it("100자는 상한 2300", () => {
    const s = writeSchedule(["가".repeat(100)])!;
    expect(s.writeMs).toBe(2300);
    expect(s.sealAt).toBe(800 + 2300 + 100);
  });
  it("자소(이모지 등) 기준으로 센다", () => {
    expect(writeSchedule(["👨‍👩‍👧가"])!.lines[0]!.steps).toBe(2);
  });
  it("빈 배열·공백뿐이면 null", () => {
    expect(writeSchedule([])).toBeNull();
    expect(writeSchedule(["", "  "])).toBeNull();
  });
});

describe("chooseTier", () => {
  const measure = (n1: number, n2: number, n3: number) => (t: { font: number }) => (t.font === 46 ? n1 : t.font === 36 ? n2 : n3);
  it("1단계 줄 수 × 56 ≤ 284 이면 1단계 (5줄 = 280)", () => {
    expect(chooseTier(measure(5, 3, 2), 284)).toMatchObject({ tier: 1, font: 46, line: 56, lines: 5, overflow: false });
  });
  it("1단계가 넘으면 2단계 (6 × 56 = 336 > 284, 6 × 44 = 264)", () => {
    expect(chooseTier(measure(9, 6, 4), 284)).toMatchObject({ tier: 2, font: 36, line: 44, lines: 6, overflow: false });
  });
  it("2단계도 넘으면 3단계 (8 × 32 = 256)", () => {
    expect(chooseTier(measure(12, 9, 8), 284)).toMatchObject({ tier: 3, font: 28, line: 32, overflow: false });
  });
  it("3단계로도 넘으면 3단계 + overflow", () => {
    expect(chooseTier(measure(20, 14, 10), 284)).toMatchObject({ tier: 3, lines: 10, overflow: true });
  });
});

describe("paperHeight", () => {
  it("가용 높이를 220~340 으로 자른다", () => {
    expect([paperHeight(400), paperHeight(268), paperHeight(200), paperHeight(340), paperHeight(220)]).toEqual([340, 268, 220, 340, 220]);
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
