import { describe, expect, it } from "vitest";
import type { CandidateVoteLine } from "../../shared/protocol";
import { daySeatLayout, dayTableGeometry, FIG_H, TAG_H } from "../../src/game/dayTable";
import {
  CHIP_H,
  CHIP_H_LEAD,
  CHIP_W,
  CHIP_W_LEAD,
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
  REVEAL_BUDGET_MS,
  REVEAL_DRAW_MS,
  REVEAL_FADE_MS,
  REVEAL_LEAD_MS,
  REVEAL_POP_MS,
  REVEAL_SLOT_MAX_MS,
  VERDICT_BLUR_PX,
  VERDICT_CANDIDATE_SCALE,
  VERDICT_CONE_DELAY_MS,
  VERDICT_CONE_FADE_MS,
  VERDICT_DIM_FADE_MS,
  VERDICT_DIM_PERCENT,
  VERDICT_MOVE_MS,
  arrowEndpoints,
  candidateCenter,
  capHalos,
  chipAnchor,
  clinchedTarget,
  revealPlan,
  revealStateAt,
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

describe("상수 (UI-SPEC 13.1)", () => {
  it("값이 UI-SPEC 와 같다", () => {
    expect([EXEC_INTRO_MS, NO_EXEC_CARD_MS, NO_EXEC_INTRO_DELAY_MS]).toEqual([1600, 1600, 1600]);
    expect([REVEAL_LEAD_MS, REVEAL_SLOT_MAX_MS, REVEAL_BUDGET_MS, REVEAL_DRAW_MS, REVEAL_FADE_MS, REVEAL_POP_MS]).toEqual([
      200, 500, 3600, 280, 120, 220,
    ]);
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

describe("revealPlan — 슬롯과 단계 시각 (D-21, UI-SPEC 13.2)", () => {
  it("n=0 이면 단계 목록이 비고 끝이 곧 시작이다", () => {
    const plan = revealPlan([], 1000);
    expect(plan.steps).toEqual([]);
    expect(plan.clinch).toBeNull();
    expect(plan.outcome).toBe("none");
  });

  it.each([
    [1, 500],
    [2, 500],
    [7, 500],
    [8, 450],
  ])("n=%i 이면 슬롯 %ims", (n, slot) => {
    const plan = revealPlan(votesOf(Array.from({ length: n }, () => 0)), 0);
    expect(plan.slotMs).toBe(slot);
  });

  it("인원 0~8 모두에서 마지막 슬롯 끝이 단계 시작 + 3800ms 이하다", () => {
    for (let n = 0; n <= 8; n++) {
      const plan = revealPlan(votesOf(Array.from({ length: n }, (_, i) => i % 3)), 5000);
      if (n === 0) continue;
      expect(plan.slotMs).toBe(Math.floor(Math.min(500, 3600 / n)));
      expect(plan.endMs).toBe(5000 + 200 + n * plan.slotMs);
      expect(plan.endMs).toBeLessThanOrEqual(5000 + 3800);
    }
  });

  it("단계 k 의 시작 = 시작 + 200 + k×슬롯, 닿음 = +280, 사라짐 끝 = 닿음 + 120", () => {
    const plan = revealPlan(sameSeatVotes([[3, 1], [4, 2], [5, 1]]), 10_000);
    plan.steps.forEach((s, k) => {
      expect(s.index).toBe(k);
      expect(s.startMs).toBe(10_000 + 200 + k * 500);
      expect(s.touchMs).toBe(s.startMs + 280);
      expect(s.fadeEndMs).toBe(s.touchMs + 120);
    });
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
    expect(plan.slotMs).toBe(Math.floor(3600 / 20));
    const dup = revealPlan(sameSeatVotes([[1, 2], [1, 2], [1, 2]]), 0);
    expect(dup.steps).toHaveLength(3);
  });
});

describe("revealStateAt — 같은 서버 시각이면 같은 상태 (D-20, D-31, 결정 0036-5)", () => {
  const plan = revealPlan(sameSeatVotes([[1, 7], [2, 8], [3, 7]]), 1000);
  // 단계 0: 시작 1200 닿음 1480 끝 1600 / 단계 1: 시작 1700 닿음 1980 / 단계 2: 시작 2200 닿음 2480 / 끝 2700

  it("첫 단계 시작 전엔 칩 0·화살표 없음·팝 없음", () => {
    for (const now of [0, 1000, 1199]) {
      const st = revealStateAt(plan, now);
      expect(st.counts).toEqual({});
      expect(st.arrow).toBeNull();
      expect(st.pop).toBeNull();
      expect(st.leader).toBeNull();
      expect(st.current).toBeNull();
      expect(st.ended).toBe(false);
    }
  });

  it("단계 0 시작 + 140ms 이면 화살표 단계 0, 진행 0.5, 칩 0", () => {
    const st = revealStateAt(plan, 1200 + 140);
    expect(st.arrow).toMatchObject({ step: 0, voter: 1, target: 7, progress: 0.5, opacity: 1 });
    expect(st.counts).toEqual({});
    expect(st.current).toBe(0);
  });

  it("닿는 시각엔 대상 칩 1·팝 = 그 대상·진행 1", () => {
    const st = revealStateAt(plan, 1200 + 280);
    expect(st.counts).toEqual({ 7: 1 });
    expect(st.pop).toBe(7);
    expect(st.arrow).toMatchObject({ step: 0, progress: 1 });
    expect(st.leader).toBe(7);
  });

  it("닿고 60ms 뒤엔 화살표가 반쯤 사라지고, 120ms 뒤엔 없다", () => {
    const half = revealStateAt(plan, 1200 + 280 + 60);
    expect(half.arrow?.opacity).toBeCloseTo(0.5, 5);
    expect(revealStateAt(plan, 1200 + 280 + 120).arrow).toBeNull();
  });

  it("다음 단계가 시작하면 팝이 해제되고 칩은 남는다", () => {
    expect(revealStateAt(plan, 1699).pop).toBe(7);
    const st = revealStateAt(plan, 1700);
    expect(st.pop).toBeNull();
    expect(st.counts).toEqual({ 7: 1 });
    expect(st.arrow).toMatchObject({ step: 1, voter: 2, target: 8, progress: 0 });
    expect(st.current).toBe(1);
  });

  it("동률 선두는 leader null (P-14), 다시 한 표 더 받으면 선두", () => {
    const tie = revealStateAt(plan, 1980);
    expect(tie.counts).toEqual({ 7: 1, 8: 1 });
    expect(tie.leader).toBeNull();
    expect(revealStateAt(plan, 2480).leader).toBe(7);
  });

  it("마지막 슬롯 끝 뒤에는 팝 없음·최종 칩 수·끝 상태", () => {
    const st = revealStateAt(plan, plan.endMs);
    expect(plan.endMs).toBe(1000 + 200 + 3 * 500);
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
    const joined = revealStateAt(plan, 2300);
    expect(joined.counts).toEqual({ 7: 1, 8: 1 });
    expect(joined.arrow).toMatchObject({ step: 2, voter: 3, target: 7 });
    expect(joined.arrow?.progress).toBeCloseTo(100 / 280, 5);
    expect(revealStateAt(plan, 2300)).toEqual(joined);
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
    expect(c.footY).toBeCloseTo(Math.min(cy + 80, h - 34), 9);
    expect(c.tagTop + TAG_H).toBeLessThanOrEqual(h - 4 + 1e-9);
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
