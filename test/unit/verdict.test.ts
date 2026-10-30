import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  CANDIDATE_REVEAL_LEAD_MS,
  CANDIDATE_REVEAL_SLOT_MS,
  CANDIDATE_REVEAL_TAIL_MS,
  EXEC_VOTE_MS,
  candidateRevealMs,
} from "../../shared/game/phases";
import type { CandidateVoteLine, SummaryRow, VoteLogEntry } from "../../shared/protocol";
import { daySeatLayout, dayTableGeometry, FIG_H, FIG_W, TAG_H } from "../../src/game/dayTable";
import {
  CHIP_H,
  CHIP_H_LEAD,
  CHIP_W,
  CHIP_W_LEAD,
  CLINCH_BEAT_MS,
  CLINCH_VIBRATE_MS,
  CONE_H,
  CONE_W,
  DEFENSE_SENT_MS,
  EXEC_INTRO_MS,
  GHOST_FADE_MS,
  NO_EXEC_CARD_MS,
  NO_EXEC_INTRO_DELAY_MS,
  RESULT_BANNER_MS,
  RESULT_FLIP_AT_MS,
  RESULT_FLIP_MS,
  RESULT_REDUCED_FADE_MS,
  RESULT_SUMMARY_AT_MS,
  REVEAL_DRAW_MS,
  REVEAL_FADE_MS,
  REVEAL_LEAD_MS,
  REVEAL_POP_MS,
  REVEAL_REDUCED_HOLD_MS,
  REVEAL_SLOT_MS,
  REVEAL_TAIL_MS,
  VERDICT_BLUR_PX,
  VERDICT_CANDIDATE_SCALE,
  VERDICT_CONE_DELAY_MS,
  VERDICT_CONE_FADE_MS,
  VERDICT_DIM_FADE_MS,
  VERDICT_DIM_PERCENT,
  VERDICT_MOVE_MS,
  VERDICT_TEXT,
  UNKNOWN_NAME,
  arrowEndpoints,
  candidateCenter,
  capHalos,
  chipAnchor,
  chipPlacement,
  candidateSeatLabel,
  clinchBeat,
  clinchedTarget,
  defenseAnnounce,
  defenseDisconnected,
  defenseInstruction,
  defenseSent,
  defenseStatus,
  endedAnnounce,
  endedSubtitle,
  execTallyText,
  noExecutionPrefix,
  noExecutionText,
  revealCaption,
  revealPlan,
  revealResultLine,
  revealStateAt,
  summaryLines,
  tagBoxesOf,
  winnerText,
  type ChipRect,
  type HaloRequest,
} from "../../src/game/verdict";

// 4페이즈 화면 연출 수치·시간표·기하·후광 상한(D-20, D-21, D-31, D-38, 결정 0030). DOM 없는 순수 모듈이라 직접 부른다.
const votesOf = (targets: number[]): CandidateVoteLine[] => targets.map((target, i) => ({ seat: 10 + i, target }));
const sameSeatVotes = (pairs: [number, number][]): CandidateVoteLine[] => pairs.map(([seat, target]) => ({ seat, target }));
const r1 = (v: number): number => Math.round(v * 10) / 10;

// 폰 폭 4종의 장면 크기(dayTable.ts 머리 주석 표)
const PHONES = [
  { phone: 360, w: 352, h: 363.8, pad: 4 },
  { phone: 375, w: 367, h: 390.8, pad: 4 },
  { phone: 390, w: 366, h: 387.8, pad: 12 },
  { phone: 430, w: 406, h: 655.8, pad: 12 },
] as const;
// 패널 157 기준(표의 높이)과 236 기준(변론의 후보 본인: 장면 높이 − 79)
const SCENES = PHONES.flatMap((p) => [
  { ...p, label: `${p.phone} 폭 · 패널 157`, h: p.h },
  { ...p, label: `${p.phone} 폭 · 패널 236`, h: p.h - 79 },
]);

describe("상수 (UI-SPEC 13.1, 결정 0039 개정)", () => {
  it("값이 UI-SPEC 와 같다", () => {
    // 결정 0039: 처형 투표 카드 3초(무효 카드는 1.6초 그대로), 공개는 한 표 2초·닿음 1.2초
    expect([EXEC_INTRO_MS, NO_EXEC_CARD_MS, NO_EXEC_INTRO_DELAY_MS]).toEqual([3000, 1600, 1600]);
    expect([
      REVEAL_LEAD_MS,
      REVEAL_SLOT_MS,
      REVEAL_TAIL_MS,
      REVEAL_DRAW_MS,
      REVEAL_FADE_MS,
      REVEAL_POP_MS,
      REVEAL_REDUCED_HOLD_MS,
    ]).toEqual([400, 2000, 600, 1200, 120, 220, 1200]);
    expect([VERDICT_MOVE_MS, VERDICT_DIM_FADE_MS, VERDICT_CONE_DELAY_MS, VERDICT_CONE_FADE_MS]).toEqual([600, 400, 200, 500]);
    expect([VERDICT_DIM_PERCENT, VERDICT_BLUR_PX, VERDICT_CANDIDATE_SCALE]).toEqual([45, 3, 1.7]);
    expect([CONE_W, CONE_H, GHOST_FADE_MS, CLINCH_VIBRATE_MS]).toEqual([300, 340, 400, 30]);
    expect([CHIP_H, CHIP_H_LEAD, CHIP_W, CHIP_W_LEAD]).toEqual([24, 32, 28, 36]);
    expect([DEFENSE_SENT_MS]).toEqual([2000]);
    expect([RESULT_BANNER_MS, RESULT_FLIP_AT_MS, RESULT_FLIP_MS, RESULT_SUMMARY_AT_MS, RESULT_REDUCED_FADE_MS]).toEqual([
      360, 300, 360, 900, 160,
    ]);
  });
});

describe("상수 관계와 서버 출처 (결정 0039)", () => {
  it("공개 앞·한 표·뒤 여유는 서버(shared/game/phases)와 같은 출처다", () => {
    expect([REVEAL_LEAD_MS, REVEAL_SLOT_MS, REVEAL_TAIL_MS]).toEqual([
      CANDIDATE_REVEAL_LEAD_MS,
      CANDIDATE_REVEAL_SLOT_MS,
      CANDIDATE_REVEAL_TAIL_MS,
    ]);
  });

  it("처형 투표 카드가 사라진 뒤에도 여부 투표가 10초 이상 남는다", () => {
    expect(EXEC_VOTE_MS - EXEC_INTRO_MS).toBeGreaterThanOrEqual(10_000);
  });

  it("화살표 + 사라짐, 화살표 + 확정 두근이 한 슬롯 안에 든다", () => {
    expect(REVEAL_DRAW_MS + REVEAL_FADE_MS).toBeLessThanOrEqual(REVEAL_SLOT_MS);
    expect(REVEAL_DRAW_MS + CLINCH_BEAT_MS).toBeLessThanOrEqual(REVEAL_SLOT_MS);
  });

  it("모션 줄이기 화살표는 닿을 때까지 보인다", () => {
    expect(REVEAL_REDUCED_HOLD_MS).toBe(REVEAL_DRAW_MS);
  });
});

describe("revealPlan — 슬롯과 단계 시각 (D-21, UI-SPEC 13.2)", () => {
  it("n=0 이면 단계 목록이 비고 끝이 곧 시작이다", () => {
    const plan = revealPlan([], 1000);
    expect(plan.steps).toEqual([]);
    expect(plan.clinch).toBeNull();
    expect(plan.outcome).toBe("none");
  });

  it.each([1, 2, 5, 7, 8, 20])("n=%i 이면 슬롯 2000ms 고정", (n) => {
    const plan = revealPlan(votesOf(Array.from({ length: n }, () => 0)), 0);
    expect(plan.slotMs).toBe(2000);
  });

  it("n=1..8: 마지막 슬롯 끝 + 뒤 여유 600 = 서버 마감 시각 (start + candidateRevealMs(n))", () => {
    for (let n = 1; n <= 8; n++) {
      const plan = revealPlan(votesOf(Array.from({ length: n }, (_, i) => i % 3)), 5000);
      expect(plan.slotMs).toBe(2000);
      expect(plan.endMs).toBe(5000 + 400 + n * 2000);
      expect(plan.endMs + REVEAL_TAIL_MS).toBe(5000 + candidateRevealMs(n));
    }
  });

  it("n=0: 끝이 곧 시작이고 서버 길이는 2000ms 다", () => {
    const plan = revealPlan([], 5000);
    expect(plan.endMs).toBe(5000);
    expect(candidateRevealMs(0)).toBe(2000);
  });

  it("8표 최악: 마지막 닿음 = start + 15600, endMs = start + 16400, 서버 길이 17000", () => {
    const plan = revealPlan(votesOf(Array.from({ length: 8 }, (_, i) => i % 3)), 0);
    expect(plan.steps.at(-1)!.touchMs).toBe(15_600);
    expect(plan.endMs).toBe(16_400);
    expect(candidateRevealMs(8)).toBe(17_000);
  });

  it("단계 k 의 시작 = 시작 + 400 + k×2000, 닿음 = +1200, 사라짐 끝 = 닿음 + 120", () => {
    const plan = revealPlan(sameSeatVotes([[3, 1], [4, 2], [5, 1]]), 10_000);
    plan.steps.forEach((s, k) => {
      expect(s.index).toBe(k);
      expect(s.startMs).toBe(10_000 + 400 + k * 2000);
      expect(s.touchMs).toBe(s.startMs + 1200);
      expect(s.fadeEndMs).toBe(s.touchMs + 120);
    });
  });

  it("확정 두근(닿음 + 700)은 다음 화살표 시작보다 먼저 끝난다", () => {
    const plan = revealPlan(votesOf([1, 1, 1, 2, 3]), 0);
    const c = plan.clinch!;
    expect(c.atMs + CLINCH_BEAT_MS).toBeLessThan(plan.steps[c.step + 1]!.startMs);
    expect(clinchBeat(plan, c.atMs + CLINCH_BEAT_MS - 1)?.beat).toBe("clinch");
  });

  it("투표 순서는 입력 배열 그대로고 입력은 바뀌지 않는다", () => {
    const votes = sameSeatVotes([[5, 2], [1, 0], [3, 2]]);
    const snapshot = JSON.parse(JSON.stringify(votes)) as CandidateVoteLine[];
    const plan = revealPlan(votes, 0);
    expect(plan.steps.map((s) => [s.voter, s.target])).toEqual([[5, 2], [1, 0], [3, 2]]);
    expect(votes).toEqual(snapshot);
  });

  it("T-04-41: 9표 이상·중복 자리 입력도 단계 수는 입력 길이이고 끝난다", () => {
    const many = votesOf(Array.from({ length: 20 }, () => 1));
    const plan = revealPlan(many, 0);
    expect(plan.steps).toHaveLength(20);
    expect(plan.slotMs).toBe(2000);
    const dup = revealPlan(sameSeatVotes([[1, 2], [1, 2], [1, 2]]), 0);
    expect(dup.steps).toHaveLength(3);
  });
});

describe("revealStateAt — 같은 서버 시각이면 같은 상태 (D-20, D-31, 결정 0036-5)", () => {
  const plan = revealPlan(sameSeatVotes([[1, 7], [2, 8], [3, 7]]), 1000);
  // 단계 0: 시작 1400 닿음 2600 끝 2720 / 단계 1: 시작 3400 닿음 4600 / 단계 2: 시작 5400 닿음 6600 / 끝 7400

  it("첫 단계 시작 전엔 칩 0·화살표 없음·팝 없음", () => {
    for (const now of [0, 1000, 1399]) {
      const st = revealStateAt(plan, now);
      expect(st.counts).toEqual({});
      expect(st.arrow).toBeNull();
      expect(st.pop).toBeNull();
      expect(st.leader).toBeNull();
      expect(st.current).toBeNull();
      expect(st.ended).toBe(false);
    }
  });

  it("단계 0 시작 + 600ms 이면 화살표 단계 0, 진행 0.5, 칩 0", () => {
    const st = revealStateAt(plan, 1400 + 600);
    expect(st.arrow).toMatchObject({ step: 0, voter: 1, target: 7, progress: 0.5, opacity: 1 });
    expect(st.counts).toEqual({});
    expect(st.current).toBe(0);
  });

  it("닿는 시각엔 대상 칩 1·팝 = 그 대상·진행 1", () => {
    const st = revealStateAt(plan, 1400 + 1200);
    expect(st.counts).toEqual({ 7: 1 });
    expect(st.pop).toBe(7);
    expect(st.arrow).toMatchObject({ step: 0, progress: 1 });
    expect(st.leader).toBe(7);
  });

  it("닿고 60ms 뒤엔 화살표가 반쯤 사라지고, 120ms 뒤엔 없다", () => {
    const half = revealStateAt(plan, 1400 + 1200 + 60);
    expect(half.arrow?.opacity).toBeCloseTo(0.5, 5);
    expect(revealStateAt(plan, 1400 + 1200 + 120).arrow).toBeNull();
  });

  it("다음 단계가 시작하면 팝이 해제되고 칩은 남는다", () => {
    expect(revealStateAt(plan, 3399).pop).toBe(7);
    const st = revealStateAt(plan, 3400);
    expect(st.pop).toBeNull();
    expect(st.counts).toEqual({ 7: 1 });
    expect(st.arrow).toMatchObject({ step: 1, voter: 2, target: 8, progress: 0 });
    expect(st.current).toBe(1);
  });

  it("동률 선두는 leader null (P-14), 다시 한 표 더 받으면 선두", () => {
    const tie = revealStateAt(plan, 4600);
    expect(tie.counts).toEqual({ 7: 1, 8: 1 });
    expect(tie.leader).toBeNull();
    expect(revealStateAt(plan, 6600).leader).toBe(7);
  });

  it("마지막 슬롯 끝 뒤에는 팝 없음·최종 칩 수·끝 상태", () => {
    const st = revealStateAt(plan, plan.endMs);
    expect(plan.endMs).toBe(1000 + 400 + 3 * 2000);
    expect(st.ended).toBe(true);
    expect(st.pop).toBeNull();
    expect(st.arrow).toBeNull();
    expect(st.counts).toEqual({ 7: 2, 8: 1 });
    expect(st.leader).toBe(7);
    expect(st.outcome).toBe("leader");
    expect(st.finalLeader).toBe(7);
    expect(revealStateAt(plan, plan.endMs - 1).ended).toBe(false);
    expect(revealStateAt(plan, plan.endMs + 100_000)).toEqual(st);
  });

  it("중간 합류는 지금 시각의 상태다 — 지난 화살표를 재생하지 않고 같은 시각이면 같은 결과다", () => {
    const joined = revealStateAt(plan, 5600);
    expect(joined.counts).toEqual({ 7: 1, 8: 1 });
    expect(joined.arrow).toMatchObject({ step: 2, voter: 3, target: 7 });
    expect(joined.arrow?.progress).toBeCloseTo(200 / 1200, 5);
    expect(revealStateAt(plan, 5600)).toEqual(joined);
  });

  it("최종 결과 종류: 유일 선두 leader · 동률 tie · 표 없음 none", () => {
    expect(revealPlan(votesOf([1, 1, 2]), 0).outcome).toBe("leader");
    const tie = revealPlan(votesOf([1, 2]), 0);
    expect(tie.outcome).toBe("tie");
    expect(revealStateAt(tie, tie.endMs).finalLeader).toBeNull();
    const none = revealPlan([], 0);
    const st = revealStateAt(none, 0);
    expect(st.outcome).toBe("none");
    expect(st.ended).toBe(true);
    expect(st.counts).toEqual({});
  });

  it("최종 선두 표 수를 plan 이 갖는다", () => {
    expect(revealPlan(votesOf([4, 4, 4, 1]), 0).finalLeaderVotes).toBe(3);
    expect(revealPlan(votesOf([4, 1]), 0).finalLeaderVotes).toBe(0);
  });
});

describe("clinchedTarget (D-31 ③)", () => {
  it.each([
    [{ 1: 3, 2: 1 }, 1, 1],
    [{ 1: 2, 2: 2 }, 0, null],
    [{ 1: 2, 2: 1 }, 1, null],
    [{ 1: 1 }, 0, 1],
    [{}, 0, null],
    [{}, 3, null],
    [{ 5: 3, 6: 3 }, 2, null],
  ])("counts %j · 남은 %i → %j", (counts, remaining, expected) => {
    expect(clinchedTarget(counts, remaining)).toBe(expected);
  });

  it("남은 표가 음수여도 0 으로 본다", () => {
    expect(clinchedTarget({ 1: 2, 2: 1 }, -5)).toBe(1);
  });

  it("확정 사건: [A,A,A,B,C] 는 세 번째 표, [A,A,B] 는 두 번째 표, [A,B,A,B] 는 없음", () => {
    const a = revealPlan(votesOf([1, 1, 1, 2, 3]), 0);
    expect(a.clinch).toEqual({ seat: 1, atMs: a.steps[2].touchMs, step: 2 });
    const b = revealPlan(votesOf([1, 1, 2]), 0);
    expect(b.clinch).toEqual({ seat: 1, atMs: b.steps[1].touchMs, step: 1 });
    expect(revealPlan(votesOf([1, 2, 1, 2]), 0).clinch).toBeNull();
  });

  it("revealStateAt.clinched 는 확정 시각 이후에만 후보를 돌려주고 확정 뒤엔 바뀌지 않는다", () => {
    const plan = revealPlan(votesOf([1, 1, 1, 2, 3]), 0);
    const at = plan.clinch!.atMs;
    expect(revealStateAt(plan, at - 1).clinched).toBeNull();
    expect(revealStateAt(plan, at).clinched).toBe(1);
    for (const s of plan.steps) expect(revealStateAt(plan, s.touchMs).clinched === null || revealStateAt(plan, s.touchMs).clinched === 1).toBe(true);
    expect(revealStateAt(plan, plan.endMs).clinched).toBe(1);
  });
});

describe("candidateCenter — 변론 후보 위치 (UI-SPEC 8.4)", () => {
  it("390 폭·장면 높이 약 388 에서 발 y 는 290 이고 가운데 x 는 장면 폭 / 2 다", () => {
    const c = candidateCenter(366, 387.8, 12);
    expect(c.x).toBe(183);
    expect(r1(c.footY)).toBe(290);
    expect(c.scale).toBe(1.7);
    expect(c.tagTop).toBeCloseTo(c.footY + 8, 9);
  });

  it.each(SCENES)("$label: 이름표 아래끝이 장면 아래 − 4 이내다", ({ w, h, pad }) => {
    const c = candidateCenter(w, h, pad);
    const { cy } = dayTableGeometry(w, h, pad);
    expect(c.footY).toBeCloseTo(Math.min(cy + 80, h - 38), 9);
    expect(c.tagTop + TAG_H).toBeLessThanOrEqual(h - 8 + 1e-9);
    // 실제 이름표 상자는 알약(TAG_H 22)보다 4 크다(인라인 줄 상자): 상자 아래끝도 장면 아래 − 4 이내다
    expect(c.tagTop + TAG_H + 4).toBeLessThanOrEqual(h - 4 + 1e-9);
    // 확대한 그림이 장면 위로 나가지 않는다
    expect(c.footY - FIG_H * c.scale).toBeGreaterThanOrEqual(0);
  });
});

describe("chipAnchor — 표수 칩 위치 (UI-SPEC 8.3)", () => {
  it("폭 28(강조 36), 높이 24(강조 32), 위 = max(4, 머리 위 − 8 − 높이)", () => {
    const place = { x: 100, y: 200, scale: 1 };
    const normal = chipAnchor(place, "normal", 366);
    expect(normal).toEqual({ left: 86, top: 200 - 96 - 8 - 24, width: 28, height: 24 });
    const lead = chipAnchor(place, "lead", 366);
    expect(lead).toEqual({ left: 82, top: 200 - 96 - 8 - 32, width: 36, height: 32 });
  });

  it("머리가 장면 위쪽에 있으면 위는 4 에서 멈춘다 (P-14)", () => {
    expect(chipAnchor({ x: 100, y: 110, scale: 0.8 }, "normal", 366).top).toBe(4);
  });

  it("장면 가장자리 밖으로 나가는 좌표는 장면 안으로 민다", () => {
    expect(chipAnchor({ x: 2, y: 300, scale: 1 }, "normal", 366).left).toBe(0);
    expect(chipAnchor({ x: 365, y: 300, scale: 1 }, "lead", 366).left).toBe(366 - 36);
  });

  it.each(SCENES)("$label: 4~8명 모두 칩 사각형이 [0, 장면 폭] 안이고 위가 4 이상이며 밀림 없이 머리 위 가운데다", ({ w, h, pad }) => {
    for (let n = 4; n <= 8; n++) {
      const seats = Array.from({ length: n }, (_, i) => ({ seat: i }));
      for (const place of daySeatLayout(seats, 0, w, h, pad)) {
        for (const tone of ["normal", "lead"] as const) {
          const chip = chipAnchor(place, tone, w);
          expect(chip.left).toBeGreaterThanOrEqual(0);
          expect(chip.left + chip.width).toBeLessThanOrEqual(w);
          expect(chip.top).toBeGreaterThanOrEqual(4);
          expect(chip.left).toBeCloseTo(place.x - chip.width / 2, 9);
        }
      }
    }
  });
});

// 04-32 Rule-1: 실제 화면에서 선두 칩(머리 위 8px)이 앞줄 자리의 이름표와 겹쳐 E2E P10 이 실패했다.
// chipPlacement 는 UI-SPEC 8.3 의 머리 위 가운데(chipAnchor)를 먼저 쓰고, 다른 자리 이름표와 겹치면 머리 폭 안에서 옆으로,
// 그래도 안 되면 위로 옮긴다. 이름표 폭은 최악(NAME_TAG_MAX_W)·높이는 인라인 줄 상자(TAG_H + 4) 로 본다.
describe("chipPlacement — 이름표를 피하는 표수 칩 위치 (04-32, P10)", () => {
  const overlap = (a: ChipRect, b: ChipRect, eps = 0): boolean =>
    a.left < b.left + b.width - eps && b.left < a.left + a.width - eps && a.top < b.top + b.height - eps && b.top < a.top + a.height - eps;

  it("겹치는 이름표가 없으면 chipAnchor 와 같다", () => {
    const place = { x: 100, y: 200, scale: 1 };
    expect(chipPlacement(place, "lead", 366, [])).toEqual(chipAnchor(place, "lead", 366));
    expect(chipPlacement(place, "normal", 366, [{ left: 0, top: 260, width: 100, height: 26 }])).toEqual(chipAnchor(place, "normal", 366));
  });

  it("기본 자리가 이름표와 겹치면 머리 폭 안에서 옆으로 옮겨 피한다(위로 올리지 않는다)", () => {
    const place = { x: 60, y: 200, scale: 1 };
    const base = chipAnchor(place, "lead", 366); // left 42, top 64..96
    const tag = { left: 50, top: 70, width: 100, height: 26 }; // 오른쪽 이름표
    const got = chipPlacement(place, "lead", 366, [tag]);
    expect(overlap(got, tag)).toBe(false);
    expect(got.top).toBe(base.top);
    expect(got.left).toBeLessThan(base.left);
    expect(Math.abs(got.left + got.width / 2 - place.x)).toBeLessThanOrEqual(36);
  });

  it("옆으로 피할 수 없으면 위로 올려 피한다", () => {
    const place = { x: 100, y: 200, scale: 1 };
    const tag = { left: 0, top: 60, width: 200, height: 26 }; // 머리 위를 가로로 덮는 긴 띠
    const got = chipPlacement(place, "normal", 366, [tag]);
    expect(overlap(got, tag)).toBe(false);
    expect(got.top).toBeGreaterThanOrEqual(4);
  });

  it("회귀 근거: 기본 자리(chipAnchor)만 쓰면 실제 배치에서 이름표와 겹치는 경우가 있다(390 폭 8명판 선두 칩 등)", () => {
    const layout = daySeatLayout(Array.from({ length: 8 }, (_, i) => ({ seat: i })), 0, 366, 387.8, 12);
    const tags = tagBoxesOf(layout);
    const hit = layout.filter((p) => tags.some((t) => overlap(chipAnchor(p, "lead", 366), t)));
    expect(hit.length).toBeGreaterThan(0);
    for (const p of hit) expect(chipPlacement(p, "lead", 366, tags)).not.toEqual(chipAnchor(p, "lead", 366));
  });

  it.each(SCENES)("$label: 4~8명 모든 자리·두 칩에서 어떤 이름표(최악 폭)와도 겹치지 않고 장면 안·위 4 이상·머리 폭 안이다", ({ w, h, pad }) => {
    for (let n = 4; n <= 8; n++) {
      const seats = Array.from({ length: n }, (_, i) => ({ seat: i }));
      const layout = daySeatLayout(seats, 0, w, h, pad);
      const tags = tagBoxesOf(layout);
      for (const place of layout) {
        for (const tone of ["normal", "lead"] as const) {
          const chip = chipPlacement(place, tone, w, tags);
          const where = `${n}명 자리 ${place.seat} ${tone}`;
          for (const t of tags) expect(overlap(chip, t, 0), `${where} 칩 ${JSON.stringify(chip)} ↔ 이름표 ${JSON.stringify(t)}`).toBe(false);
          expect(chip.left, where).toBeGreaterThanOrEqual(0);
          expect(chip.left + chip.width, where).toBeLessThanOrEqual(w);
          expect(chip.top, where).toBeGreaterThanOrEqual(4);
          expect(Math.abs(chip.left + chip.width / 2 - place.x), where).toBeLessThanOrEqual(FIG_W * place.scale / 2 + 1e-9);
        }
      }
    }
  });
});

describe("arrowEndpoints — 화살표 시작·끝 (UI-SPEC 8.3, D-32)", () => {
  it("시안 RA2: 지호 (80.7,380,0.95) → 도윤 (195,230,0.8) 의 (98.9,306.2) → (174.4,207) 과 6px 안", () => {
    const { start, end } = arrowEndpoints({ x: 80.7, y: 380, scale: 0.95 }, { x: 195, y: 230, scale: 0.8 });
    expect(Math.abs(start.x - 98.9)).toBeLessThan(6);
    expect(Math.abs(start.y - 306.2)).toBeLessThan(6);
    expect(Math.abs(end.x - 174.4)).toBeLessThan(6);
    expect(Math.abs(end.y - 207)).toBeLessThan(6);
  });

  it("시작은 투표자 몸 중심에서 32, 끝은 대상 몸 중심에서 26 앞이다 (몸 중심 = 발 y − 48×배율)", () => {
    const from = { x: 0, y: 148, scale: 2 }; // 몸 중심 (0, 52)
    const to = { x: 300, y: 148, scale: 2 }; // 몸 중심 (300, 52)
    const { start, end } = arrowEndpoints(from, to);
    expect(start.x).toBeCloseTo(32, 9);
    expect(start.y).toBeCloseTo(52, 9);
    expect(end.x).toBeCloseTo(300 - 26, 9);
    expect(end.y).toBeCloseTo(52, 9);
  });

  it("같은 자리·가까운 두 자리여도 NaN 이 없고 시작이 끝을 넘지 않는다", () => {
    const same = arrowEndpoints({ x: 50, y: 100, scale: 1 }, { x: 50, y: 100, scale: 1 });
    for (const v of [same.start.x, same.start.y, same.end.x, same.end.y]) expect(Number.isFinite(v)).toBe(true);
    const near = arrowEndpoints({ x: 50, y: 100, scale: 1 }, { x: 80, y: 100, scale: 1 });
    expect(near.start.x).toBeLessThanOrEqual(near.end.x + 1e-9);
  });
});

describe("capHalos — 후광 상한 3 (결정 0030, D-33, UI-SPEC 12.4)", () => {
  const req = (seat: number, kind: HaloRequest["kind"]): HaloRequest => ({ seat, kind });

  it("3개 이하면 그대로 둔다", () => {
    const out = capHalos([req(1, "white"), req(2, "amber"), req(3, "crimson")]);
    expect([...out.kinds.entries()].sort()).toEqual([[1, "white"], [2, "amber"], [3, "crimson"]]);
    expect(out.off).toEqual([]);
  });

  it("한 자리에 흰+진홍이 겹치면 흰 하나", () => {
    const out = capHalos([req(4, "crimson"), req(4, "white")]);
    expect(out.kinds.get(4)).toBe("white");
    expect(out.kinds.size).toBe(1);
    expect(out.off).toEqual([]);
  });

  it("합이 3 을 넘으면 진홍부터 끈다 (관전자가 마피아 둘을 볼 때 앰버 둘과 합쳐 4개)", () => {
    const out = capHalos([req(1, "amber"), req(2, "amber"), req(3, "crimson"), req(5, "crimson")]);
    expect(out.kinds.size).toBe(3);
    expect(out.kinds.get(1)).toBe("amber");
    expect(out.kinds.get(2)).toBe("amber");
    // 같은 순위(진홍)에서는 자리 번호가 큰 쪽부터 뺀다
    expect(out.kinds.get(3)).toBe("crimson");
    expect(out.kinds.has(5)).toBe(false);
    expect(out.off).toEqual([5]);
  });

  it("진홍이 다 꺼져도 넘으면 앰버를 끄고 흰은 항상 남는다", () => {
    const out = capHalos([req(0, "white"), req(1, "amber"), req(2, "amber"), req(3, "amber"), req(4, "crimson")]);
    expect(out.kinds.get(0)).toBe("white");
    expect(out.kinds.size).toBe(3);
    expect(out.kinds.has(4)).toBe(false);
    expect(out.kinds.has(3)).toBe(false);
    expect(out.off).toEqual([3, 4]);
  });

  it("흰이 상한을 넘게 많아도 흰은 끄지 않는다", () => {
    const out = capHalos([req(0, "white"), req(1, "white"), req(2, "white"), req(3, "white"), req(4, "amber")]);
    expect([...out.kinds.values()].filter((k) => k === "white")).toHaveLength(4);
    expect(out.off).toEqual([4]);
  });

  it("max 인자를 바꿀 수 있고 입력을 바꾸지 않는다", () => {
    const input = [req(1, "amber"), req(2, "crimson")];
    const copy = [...input];
    const out = capHalos(input, 1);
    expect(out.kinds.get(1)).toBe("amber");
    expect(out.off).toEqual([2]);
    expect(input).toEqual(copy);
  });

  it("빈 요청은 빈 결과", () => {
    const out = capHalos([]);
    expect(out.kinds.size).toBe(0);
    expect(out.off).toEqual([]);
  });
});

describe("순수 모듈 검사 (D-38)", () => {
  it("DOM·현재 시각·난수를 쓰지 않는다", async () => {
    const { readFileSync } = await import("node:fs");
    const src = readFileSync(new URL("../../src/game/verdict.ts", import.meta.url), "utf8")
      .split("\n")
      .filter((line) => !/^\s*(\/\/|\*|\/\*)/.test(line))
      .join("\n");
    expect(src).not.toMatch(/Date\.now|Math\.random|document\.|window\./);
  });
});

// ---- Task 2: 문구 정본 (UI-SPEC 7.2·7.3, D-11, D-19, D-27, D-34, D-35) ----
const NAMES: Record<number, string> = { 0: "나나나나나", 1: "지호", 2: "도윤", 3: "서연", 4: "하늘" };
const nameOf = (seat: number): string | undefined => NAMES[seat];

describe("VERDICT_TEXT — UI-SPEC 7.2 와 글자까지 같다", () => {
  it("옛 후보 선택 안내 키는 없다 (결정 0040: 이름을 글자 그대로 두지 않아 남은 참조를 grep 이 잡는다)", () => {
    expect(Object.hasOwn(VERDICT_TEXT, ["candidate", "Hint"].join(""))).toBe(false);
  });

  it("고정 문구 전부", () => {
    expect(VERDICT_TEXT).toMatchObject({
      execTitle: "오늘 처형을 할까요?",
      execIntroHint: "카드 뒤에서도 바로 고를 수 있어요",
      spectatorPill: "관전 중 · 볼 수만 있어요",
      candidateTitle: "처형할 사람을 고르세요",
      candidateGuideNone: "아무도 고르지 않으면 무효표가 돼요",
      candidateGuidePicked: "빈 곳을 누르면 선택이 취소돼요",
      candidateNone: "선택 안 함",
      votedSuffix: "님에게 투표했어요",
      candidateSpectatorTitle: "처형할 사람을 고르는 중이에요",
      candidateSpectatorHint: "누구를 골랐는지는 공개될 때 볼 수 있어요",
      defenseChooseTitle: "변론할 말을 고르세요",
      defenseChooseHint: "한 번에 하나씩 보낼 수 있어요",
      executionDoneTitle: "처형이 끝났어요",
      executionDoneHint: "곧 다음으로 넘어가요",
      executionCardSub: "처형이 집행됐어요",
      execIntroCardTitle: "처형 투표",
      noExecCardTitle: "처형 무효",
      endedTitle: "게임 종료",
      summaryTitle: "이번 판 기록",
      homeButton: "처음으로",
      roomCloseNote: "이 방은 30분 뒤에 닫혀요",
      noRecord: "아직 기록이 없어요",
    });
  });

  it("값이 UI-SPEC 문서에도 그대로 있다 (문서가 있을 때)", () => {
    const path = new URL("../../.planning/milestones/v1.0-phases/04-execution-verdict/04-UI-SPEC.md", import.meta.url);
    if (!existsSync(path)) return;
    const doc = readFileSync(path, "utf8");
    const flat = (v: unknown): string[] => (typeof v === "string" ? [v] : typeof v === "object" && v !== null ? Object.values(v).flatMap(flat) : []);
    for (const text of flat(VERDICT_TEXT)) expect(doc, text).toContain(text);
  });

  it("읽기용 단계 안내와 보조 문구 함수", () => {
    expect(VERDICT_TEXT.announce.execVote).toBe("처형 여부 투표. 오늘 처형을 할까요?");
    expect(VERDICT_TEXT.announce.candidateVote).toBe("후보 선택 투표. 처형할 사람을 고르세요");
    expect(VERDICT_TEXT.announce.candidateVoteReveal).toBe("투표 공개");
    expect(defenseAnnounce("도윤")).toBe("도윤님의 최후 변론");
    expect(defenseAnnounce(null)).toBe("내 최후 변론. 변론할 말을 고르세요");
    expect(endedAnnounce("citizenWin")).toBe("게임이 끝났습니다. 시민 팀 승리");
    expect(endedAnnounce("mafiaWin")).toBe("게임이 끝났습니다. 마피아 팀 승리");
    expect(defenseStatus("도윤")).toBe("도윤님이 변론하는 중");
    expect(defenseDisconnected("도윤")).toBe("도윤님은 연결이 끊겨 있어요");
    expect(defenseInstruction(2, "도윤")).toBe("2일차 · 도윤님의 변론");
    expect(defenseInstruction(2, null)).toBe("2일차 · 내 변론");
    expect(defenseSent("저 아니에요")).toBe("보냈어요 · 저 아니에요");
    expect(candidateSeatLabel("도윤", false)).toBe("도윤, 투표 대상");
    expect(candidateSeatLabel("도윤", true)).toBe("도윤 (나), 투표 대상");
    expect(noExecutionPrefix("tie")).toBe("처형 무효. 동률이라 처형하지 않아요. ");
  });
});

describe("execTallyText (D-35, UI-SPEC 7.2)", () => {
  it("생존 5·찬성 3·반대 1 → 아직 1명", () => {
    expect(execTallyText({ yes: 3, no: 1 }, 5)).toEqual({ strong: "찬성 3 · 반대 1", rest: "아직 1명 · 마감까지 바꿀 수 있어요" });
  });
  it("모두 던지면 모두 냈어요 (360 폭 한 줄에 들어가도록 짧게, 04-33)", () => {
    expect(execTallyText({ yes: 3, no: 1 }, 4).rest).toBe("모두 냈어요 · 마감까지 바꿀 수 있어요");
  });
  it("던진 표가 생존자보다 많아도 남은 수는 0", () => {
    expect(execTallyText({ yes: 4, no: 3 }, 5).rest).toBe("모두 냈어요 · 마감까지 바꿀 수 있어요");
  });
  it("아무도 안 던졌으면 생존자 수 전부가 남았다", () => {
    expect(execTallyText({ yes: 0, no: 0 }, 6)).toEqual({ strong: "찬성 0 · 반대 0", rest: "아직 6명 · 마감까지 바꿀 수 있어요" });
  });
});

describe("revealCaption · revealResultLine (UI-SPEC 7.2 candidateVoteReveal)", () => {
  const plan = revealPlan(sameSeatVotes([[1, 2], [3, 2], [4, 1]]), 0);

  it("첫 화살표 전에는 문구가 없다", () => {
    expect(revealCaption(plan, revealStateAt(plan, 0), nameOf)).toBeNull();
  });

  it("화살표 k 가 나가는 중이면 누가 누구를 골랐는지와 몇 번째 표", () => {
    expect(revealCaption(plan, revealStateAt(plan, REVEAL_LEAD_MS + 100), nameOf)).toEqual({
      title: "지호님이 도윤님을 골랐어요",
      hint: "1번째 표 · 모두 3표",
    });
    const second = plan.steps[1].startMs + 50;
    expect(revealCaption(plan, revealStateAt(plan, second), nameOf)).toEqual({
      title: "서연님이 도윤님을 골랐어요",
      hint: "2번째 표 · 모두 3표",
    });
  });

  it("화살표 사이 틈에서는 직전 문구를 유지한다", () => {
    const gap = plan.steps[0].fadeEndMs + 10;
    expect(revealStateAt(plan, gap).arrow).toBeNull();
    expect(revealCaption(plan, revealStateAt(plan, gap), nameOf)?.title).toBe("지호님이 도윤님을 골랐어요");
  });

  it("끝 상태: 유일한 선두", () => {
    const st = revealStateAt(plan, plan.endMs);
    expect(revealCaption(plan, st, nameOf)).toEqual({ title: "도윤님이 가장 많은 표를 받았어요", hint: "2표 · 곧 최후 변론이 시작돼요" });
    expect(revealResultLine(plan, nameOf)).toBe("도윤님이 2표로 가장 많은 표를 받았어요");
  });

  it("끝 상태: 동률", () => {
    const tie = revealPlan(sameSeatVotes([[1, 2], [3, 4]]), 0);
    expect(revealCaption(tie, revealStateAt(tie, tie.endMs), nameOf)).toEqual({
      title: "표가 갈렸어요",
      hint: "동률이라 처형하지 않아요 · 곧 밤이 시작돼요",
    });
    expect(revealResultLine(tie, nameOf)).toBe("표가 갈렸어요. 동률이라 처형하지 않아요");
  });

  it("끝 상태: 던진 표 0", () => {
    const none = revealPlan([], 0);
    expect(revealCaption(none, revealStateAt(none, 0), nameOf)).toEqual({
      title: "투표한 사람이 없어요",
      hint: "던진 표가 없어요 · 곧 밤이 시작돼요",
    });
    expect(revealResultLine(none, nameOf)).toBe("투표한 사람이 없어요");
  });

  it("이름을 못 찾으면 알 수 없는 사람", () => {
    const lost = revealPlan(sameSeatVotes([[99, 98]]), 0);
    expect(revealCaption(lost, revealStateAt(lost, REVEAL_LEAD_MS + 50), nameOf)?.title).toBe(`${UNKNOWN_NAME}님이 ${UNKNOWN_NAME}님을 골랐어요`);
    expect(UNKNOWN_NAME).toBe("알 수 없는 사람");
  });
});

describe("noExecutionText · winnerText (D-34, UI-SPEC 7.2)", () => {
  it("무효 이유 부제 세 개", () => {
    expect(noExecutionText("notMajority")).toBe("찬성이 과반이 아니에요");
    expect(noExecutionText("tie")).toBe("동률이라 처형하지 않아요");
    expect(noExecutionText("noVotes")).toBe("던진 표가 없어요");
  });
  it("승리 배너", () => {
    expect(winnerText("citizenWin")).toEqual({ title: "시민 팀 승리", sub: "마피아가 모두 탈락했어요", announce: "게임이 끝났습니다. 시민 팀 승리" });
    expect(winnerText("mafiaWin")).toEqual({
      title: "마피아 팀 승리",
      sub: "마피아 수가 나머지 생존자 수와 같아졌어요",
      announce: "게임이 끝났습니다. 마피아 팀 승리",
    });
  });
});

describe("summaryLines · endedSubtitle (D-27, UI-SPEC 7.2 ended)", () => {
  const voteLog: VoteLogEntry[] = [
    { n: 1, exec: { yes: 3, no: 1, passed: true }, cand: { votes: sameSeatVotes([[0, 2], [1, 2], [3, 4]]), candidate: 2 } },
    { n: 2, exec: { yes: 1, no: 3, passed: false } },
    { n: 3, exec: { yes: 3, no: 0, passed: true }, cand: { votes: [] } },
    { n: 4, exec: { yes: 3, no: 0, passed: true }, cand: { votes: sameSeatVotes([[0, 1], [3, 4]]) } },
  ];

  it("낮 → 밤 순서로 일차 오름차순, 낮은 처형·무효 네 갈래", () => {
    const summary: SummaryRow[] = [
      { n: 2, exec: { yes: 1, no: 3, passed: false }, night: { target: 1, died: true } },
      { n: 1, exec: { yes: 3, no: 1, passed: true, candidate: 2 }, night: { target: 3, died: false } },
      { n: 3, exec: { yes: 3, no: 0, passed: true } },
      { n: 4, exec: { yes: 3, no: 0, passed: true }, night: { died: false } },
    ];
    const lines = summaryLines(summary, voteLog, nameOf);
    expect(lines.map((l) => [l.label, l.text])).toEqual([
      ["1일차 낮", "도윤님 처형 (2표)"],
      ["1일차 밤", "서연님을 노렸지만 의사가 지켰어요"],
      ["2일차 낮", "처형 없음 (찬성 1 · 반대 3)"],
      ["2일차 밤", "지호님 사망"],
      ["3일차 낮", "처형 없음 (던진 표 없음)"],
      ["4일차 낮", "처형 없음 (동률)"],
      ["4일차 밤", "아무 일도 없었어요"],
    ]);
  });

  it("exec 가 없는 일차는 낮 행이 없고 night 가 없으면 밤 행이 없다", () => {
    const lines = summaryLines([{ n: 1, night: { target: 1, died: true } }, { n: 2, exec: { yes: 0, no: 2, passed: false } }], [], nameOf);
    expect(lines.map((l) => l.label)).toEqual(["1일차 밤", "2일차 낮"]);
  });

  it("밤에 지목 자체가 없으면 아무 일도 없었어요", () => {
    const lines = summaryLines([{ n: 1, night: { died: false } }], [], nameOf);
    expect(lines).toEqual([{ n: 1, kind: "night", label: "1일차 밤", text: "아무 일도 없었어요" }]);
  });

  it("투표 기록을 못 찾아도 예외 없이 표 수만 뺀다", () => {
    const lines = summaryLines([{ n: 7, exec: { yes: 3, no: 0, passed: true, candidate: 2 } }], voteLog, nameOf);
    expect(lines[0].text).toBe("도윤님 처형");
  });

  it("입력을 바꾸지 않는다", () => {
    const summary: SummaryRow[] = [{ n: 2 }, { n: 1 }];
    summaryLines(summary, [], nameOf);
    expect(summary.map((r) => r.n)).toEqual([2, 1]);
  });

  it("endedSubtitle: 마지막 행에 night 가 있으면 밤, 없으면 낮, 행이 없으면 빈 문자열", () => {
    expect(endedSubtitle([{ n: 1, exec: { yes: 1, no: 1, passed: false } }, { n: 2, night: { target: 1, died: true } }])).toBe("2일차 밤");
    expect(endedSubtitle([{ n: 1, night: { died: false } }, { n: 2, exec: { yes: 3, no: 0, passed: true, candidate: 1 } }])).toBe("2일차 낮");
    expect(endedSubtitle([])).toBe("");
  });
});

describe("T-04-40: 닉네임은 평문으로만 이어 붙인다", () => {
  const evil = (seat: number): string | undefined => (seat === 1 ? "<b>가나다라</b>" : seat === 2 ? "{x}&amp;" : undefined);
  it("모든 문구 함수가 마크업·중괄호를 그대로 둔 문자열을 돌려준다", () => {
    const plan = revealPlan(sameSeatVotes([[1, 2]]), 0);
    expect(revealCaption(plan, revealStateAt(plan, REVEAL_LEAD_MS + 50), evil)?.title).toBe("<b>가나다라</b>님이 {x}&amp;님을 골랐어요");
    expect(summaryLines([{ n: 1, night: { target: 1, died: true } }], [], evil)[0].text).toBe("<b>가나다라</b>님 사망");
    expect(defenseStatus("<i>")).toBe("<i>님이 변론하는 중");
  });
  it("5글자 닉네임으로도 예외 없이 문자열을 만든다", () => {
    const five = (): string => "가나다라마";
    const plan = revealPlan(sameSeatVotes([[1, 2], [3, 2]]), 0);
    for (const now of [0, 250, 1000, plan.endMs]) {
      const cap = revealCaption(plan, revealStateAt(plan, now), five);
      if (cap !== null) {
        expect(typeof cap.title).toBe("string");
        expect(typeof cap.hint).toBe("string");
      }
    }
    expect(revealResultLine(plan, five)).toBe("가나다라마님이 2표로 가장 많은 표를 받았어요");
  });
});
