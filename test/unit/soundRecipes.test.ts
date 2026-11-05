// 12-02: 소리 레시피 — 순수 데이터와 결정적 렌더 계획 (D-1, D-16, D-18). 오디오 출력 없이 한계·결정성을 건다.
import { describe, expect, it } from "vitest";
import {
  BEDS,
  BED_OSC_MAX,
  BUS_GAIN,
  COMPRESSOR,
  FREQ_MAX,
  FREQ_MIN,
  LFO_MAX_HZ,
  MASTER_GAIN,
  MAX_LAYERS,
  MAX_RECIPE_MS,
  PEAK_DBFS_MAX,
  RECIPES,
  bedOscCount,
  bedPlan,
  midiToHz,
  mulberry32,
  peakDbEstimate,
  planHash,
  recipeDurationMs,
  renderPlan,
  type PlanEvent,
} from "../../src/audio/recipes";

function assertSane(plan: readonly PlanEvent[]): void {
  for (const e of plan) {
    for (const v of [e.t, e.dur, e.f0, e.f1, e.gain, e.detune, ...e.env]) expect(Number.isFinite(v)).toBe(true);
    expect(e.t).toBeGreaterThanOrEqual(0);
    expect(e.dur).toBeGreaterThan(0);
    expect(e.gain).toBeGreaterThan(0);
    if (e.kind === "osc") {
      expect(e.f0).toBeGreaterThanOrEqual(FREQ_MIN);
      expect(e.f0).toBeLessThanOrEqual(FREQ_MAX);
      expect(e.f1).toBeGreaterThanOrEqual(FREQ_MIN);
      expect(e.f1).toBeLessThanOrEqual(FREQ_MAX);
    }
    if (e.filter !== undefined) {
      for (const f of e.filter.f) {
        expect(f).toBeGreaterThanOrEqual(FREQ_MIN);
        expect(f).toBeLessThanOrEqual(FREQ_MAX);
      }
    }
  }
  const times = plan.map((e) => e.t);
  expect(times).toEqual([...times].sort((a, b) => a - b));
}

describe("소리 레시피 — 트레이서 (D-1, D-18)", () => {
  it("midiToHz: A4=440, A3=220", () => {
    expect(Math.abs(midiToHz(69) - 440)).toBeLessThan(1e-9);
    expect(Math.abs(midiToHz(57) - 220)).toBeLessThan(1e-9);
  });

  it("mulberry32: 같은 시드는 같은 열, 0 이상 1 미만", () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    const seqA = Array.from({ length: 50 }, () => a());
    const seqB = Array.from({ length: 50 }, () => b());
    expect(seqA).toEqual(seqB);
    for (const v of seqA) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
    expect(mulberry32(43)()).not.toBe(seqA[0]);
  });

  it("한계·믹스 상수를 내보낸다", () => {
    expect([MAX_LAYERS, MAX_RECIPE_MS, FREQ_MIN, FREQ_MAX, LFO_MAX_HZ, BED_OSC_MAX, PEAK_DBFS_MAX]).toEqual([
      4, 3000, 40, 9000, 8, 6, -6,
    ]);
    expect(BUS_GAIN).toEqual({ bgm: 0.3, sfx: 0.7, ui: 0.45 });
    expect(MASTER_GAIN).toBe(0.7);
    expect(COMPRESSOR).toEqual({ threshold: -18, ratio: 4, attack: 0.005, release: 0.2 });
  });

  it("ui.toggle: 켬 440→660 / 끔 440→330, 90ms, 변형은 variant 인자", () => {
    const on = renderPlan("ui.toggle", { variant: "on" });
    const off = renderPlan("ui.toggle", { variant: "off" });
    expect(on).toHaveLength(1);
    expect(on[0]).toMatchObject({ kind: "osc", wave: "sine", t: 0, dur: 90, f0: 440, f1: 660 });
    expect(off[0]).toMatchObject({ kind: "osc", wave: "sine", t: 0, dur: 90, f0: 440, f1: 330 });
    expect(planHash(on)).not.toBe(planHash(off));
    expect(RECIPES["ui.toggle"].gainDb).toBe(-18);
  });

  it("verdict.heart: lub-dub 한 쌍, 두 번째가 −3dB 이고 +160ms", () => {
    const plan = renderPlan("verdict.heart");
    expect(plan).toHaveLength(2);
    expect(plan[0]!.t).toBe(0);
    expect(plan[1]!.t).toBe(160);
    expect(plan[0]!.f0).toBe(55);
    expect(plan[0]!.filter).toMatchObject({ type: "lowpass", f: [120, 120] });
    expect(plan[0]!.dur).toBe(120);
    expect(plan[1]!.gain / plan[0]!.gain).toBeCloseTo(10 ** (-3 / 20), 6);
    expect(recipeDurationMs("verdict.heart")).toBeLessThanOrEqual(MAX_RECIPE_MS);
    expect(RECIPES["verdict.heart"].prio).toBe(0);
  });

  it("renderPlan: 같은 입력이면 같은 출력, 다른 id 는 다른 해시, 값이 모두 정상", () => {
    for (const id of ["ui.toggle", "verdict.heart"] as const) {
      const a = renderPlan(id);
      const b = renderPlan(id);
      expect(a).toEqual(b);
      expect(planHash(a)).toBe(planHash(b));
      assertSane(a);
    }
    expect(planHash(renderPlan("ui.toggle"))).not.toBe(planHash(renderPlan("verdict.heart")));
  });

  it("레벨 추정과 길이", () => {
    for (const id of ["ui.toggle", "verdict.heart", "bed.night"] as const) {
      expect(peakDbEstimate(id)).toBeLessThanOrEqual(PEAK_DBFS_MAX);
    }
    expect(recipeDurationMs("ui.toggle")).toBeGreaterThanOrEqual(90);
    expect(recipeDurationMs("ui.toggle")).toBeLessThan(200);
  });

  it("bed.night: 사인 드론 + 잡음 방 소리 + 대역통과 잡음 바람, 발진기 ≤ 6", () => {
    const bed = BEDS["bed.night"];
    expect(bedOscCount(bed)).toBeLessThanOrEqual(BED_OSC_MAX);
    const plan = bedPlan(bed, 0, 8000);
    assertSane(plan);
    expect(plan.some((e) => e.kind === "osc" && e.wave === "sine")).toBe(true);
    expect(plan.some((e) => e.kind === "noise" && e.filter?.type === "lowpass" && e.filter.f[0] === 300)).toBe(true);
    const wind = plan.find((e) => e.kind === "noise" && e.filter?.type === "bandpass");
    expect(wind?.filter?.f).toEqual([400, 800]);
    expect(wind?.filter?.lfoHz).toBe(0.05);
    expect(planHash(bedPlan(bed, 0, 8000))).toBe(planHash(plan));
  });
});
