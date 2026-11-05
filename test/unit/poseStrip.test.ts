// 10-06: 포즈 스트립 디버그 화면 — 게이트·격자 정의·샘플 계획·선택값 파서 (D-8, O-11, T-10-19).
import { describe, expect, it } from "vitest";
import { EMOTE_MS } from "../../shared/game/emote";
import { EMOTE_IDS } from "../../shared/protocol";
import { WALK_PHASE_RATE } from "../../src/world/character";
import { FIGS, OUTFITS } from "../../src/world/characterData";
import { emoteDurationMs } from "../../src/world/emoteCap";
import { FIG_COUNT, OUTFIT_ORDER, WALK_RATE, parsePoseStripParams, poseStripEnabled, samplePlan, stripRows, STRIP_COLS } from "../../src/debug/poseStripData";
import { initPerfDebug } from "../../src/debug/perfProbe";

const mem = (v: string | null) => ({ getItem: () => v, setItem: () => {}, removeItem: () => {} });

describe("poseStripEnabled — 게이트 (T-10-19)", () => {
  it("쿼리만 있고 개발도 e2e 도 아니면 거짓", () => {
    expect(poseStripEnabled("?pose-strip=1", mem(null), false)).toBe(false);
  });
  it("쿼리 + 개발 빌드면 참", () => {
    expect(poseStripEnabled("?pose-strip=1", mem(null), true)).toBe(true);
  });
  it("쿼리 + ?e2e=1 이면 참", () => {
    expect(poseStripEnabled("?e2e=1&pose-strip=1", mem(null), false)).toBe(true);
  });
  it("e2e 문맥인데 pose-strip 쿼리가 없으면 거짓", () => {
    expect(poseStripEnabled("?e2e=1", mem(null), true)).toBe(false);
    expect(poseStripEnabled("?e2e=1&pose-strip=0", mem(null), true)).toBe(false);
  });
  it("저장소에 e2e 가 남아 있어도 pose-strip 쿼리가 있어야 한다", () => {
    expect(poseStripEnabled("", mem("1"), true)).toBe(false);
    expect(poseStripEnabled("?pose-strip=1", mem("1"), false)).toBe(true);
  });
  it("initPerfDebug 는 게이트가 거짓이면 false 를 돌려준다(운영 주소 ?pose-strip=1)", () => {
    expect(initPerfDebug("?pose-strip=1", { dev: false, storage: null })).toBe(false);
  });
});

describe("데이터 모듈의 되풀이 상수는 원본과 같다", () => {
  it("WALK_RATE = WALK_PHASE_RATE, FIG_COUNT = FIGS.length", () => {
    expect(WALK_RATE).toBe(WALK_PHASE_RATE);
    expect(FIG_COUNT).toBe(FIGS.length);
  });
});

describe("stripRows / samplePlan — 격자 (D-8)", () => {
  it("행은 동작 아홉 + idle + walk 11개, 열은 4개", () => {
    expect(stripRows()).toEqual([...EMOTE_IDS, "idle", "walk"]);
    expect(STRIP_COLS).toBe(4);
  });
  it("동작 행의 샘플 시각은 길이의 15·40·65·90%", () => {
    for (const id of EMOTE_IDS) {
      const ms = emoteDurationMs(id, false);
      const ts = [0, 1, 2, 3].map((c) => samplePlan({ view: "strip", row: id }, c));
      expect(ts.map((p) => p.kind)).toEqual(["emote", "emote", "emote", "emote"]);
      expect(ts.map((p) => p.id)).toEqual([id, id, id, id]);
      [0.15, 0.4, 0.65, 0.9].forEach((f, i) => expect(ts[i].t).toBeCloseTo((ms / 1000) * f, 9));
    }
  });
  it("EMOTE_MS 와 emoteDurationMs 가 같다(데이터 모듈은 EMOTE_MS 를 쓴다)", () => {
    for (const id of EMOTE_IDS) expect(EMOTE_MS[id]).toBe(emoteDurationMs(id, false));
  });
  it("idle 은 0·0.5·1·1.5초", () => {
    expect([0, 1, 2, 3].map((c) => samplePlan({ view: "strip", row: "idle" }, c))).toEqual([
      { kind: "idle", t: 0 },
      { kind: "idle", t: 0.5 },
      { kind: "idle", t: 1 },
      { kind: "idle", t: 1.5 },
    ]);
  });
  it("walk 는 위상 0·π/2·π·3π/2 를 dt = 위상 / WALK_PHASE_RATE 로 계획한다", () => {
    const ps = [0, 1, 2, 3].map((c) => samplePlan({ view: "strip", row: "walk" }, c));
    ps.forEach((p, i) => {
      expect(p.kind).toBe("walk");
      expect(p.phase).toBeCloseTo((i * Math.PI) / 2, 9);
      expect(p.t).toBeCloseTo(((i * Math.PI) / 2) / WALK_PHASE_RATE, 9);
    });
  });
  it("combos 보기는 의상 9행 × 인물 5열이고 자세는 idle(t=0) 또는 walk(위상 π/2)", () => {
    expect(OUTFIT_ORDER).toEqual(Object.keys(OUTFITS));
    expect(OUTFIT_ORDER.length).toBe(9);
    expect(FIGS.length).toBe(5);
    expect(samplePlan({ view: "combos", pose: "idle" }, 0)).toEqual({ kind: "idle", t: 0 });
    const w = samplePlan({ view: "combos", pose: "walk" }, 4);
    expect(w.kind).toBe("walk");
    expect(w.phase).toBeCloseTo(Math.PI / 2, 9);
    expect(w.t).toBeCloseTo(Math.PI / 2 / WALK_PHASE_RATE, 9);
  });
});

describe("parsePoseStripParams — 선택값", () => {
  it("기본값은 fig 0 · coat · strip · idle", () => {
    expect(parsePoseStripParams("?pose-strip=1")).toEqual({ fig: 0, outfit: "coat", view: "strip", pose: "idle" });
  });
  it("정상 값을 읽는다", () => {
    expect(parsePoseStripParams("?fig=3&outfit=hood&view=combos&pose=walk")).toEqual({ fig: 3, outfit: "hood", view: "combos", pose: "walk" });
  });
  it("잘못된 값은 기본값", () => {
    expect(parsePoseStripParams("?fig=9&outfit=zzz&view=x&pose=y")).toEqual({ fig: 0, outfit: "coat", view: "strip", pose: "idle" });
    expect(parsePoseStripParams("?fig=-1")).toMatchObject({ fig: 0 });
    expect(parsePoseStripParams("?fig=1.5")).toMatchObject({ fig: 0 });
    expect(parsePoseStripParams("?fig=abc")).toMatchObject({ fig: 0 });
    expect(parsePoseStripParams("?outfit=constructor")).toMatchObject({ outfit: "coat" });
  });
});
