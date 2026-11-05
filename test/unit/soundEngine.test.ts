// 12-05: 소리 엔진 — 가짜 컨텍스트로 돈다 (D-2, D-7, D-8, D-16, B-3). 실제 소리 출력에 기대지 않는다.
import { describe, expect, it } from "vitest";
import { buildVoice } from "../../src/audio/synth";
import type { EngineDeps } from "../../src/audio/engine";
import { BUS_GAIN, COMPRESSOR, MASTER_GAIN, SFX_IDS, recipeNodeCount, renderPlan } from "../../src/audio/recipes";
import { FakeAudioContext, FakeGain, createFakeRig, type FakeNode } from "../helpers/fakeAudio";
import { makeRig } from "../helpers/soundRig";

/** 컨텍스트 그래프에서 컴프레서·master·버스 셋을 구조로 찾는다 */
function graphOf(ctx: FakeAudioContext): { comp: FakeNode; master: FakeGain; bgm: FakeGain; sfx: FakeGain; ui: FakeGain } {
  const comp = ctx.ofKind("compressor")[0]!;
  const master = ctx.ofKind("gain").find((g) => g.out.includes(comp)) as FakeGain;
  const buses = ctx.ofKind("gain").filter((g) => g.out.includes(master)) as FakeGain[];
  const by = (v: number): FakeGain => buses.find((b) => b.gain.value === v)!;
  return { comp, master, bgm: by(BUS_GAIN.bgm), sfx: by(BUS_GAIN.sfx), ui: by(BUS_GAIN.ui) };
}

describe("unlock — 컨텍스트는 호출 안에서 동기로 만든다 (D-2, D-7, D-8)", () => {
  it("만들기 전에는 컨텍스트가 없고 state 는 none", () => {
    const { engine, fake } = makeRig();
    expect(engine.state()).toBe("none");
    expect(fake.contexts).toHaveLength(0);
    expect(engine.supported()).toBe(true);
  });

  it("unlock() 은 await 없이 컨텍스트 한 개를 만들고 balanced 로 resume 과 무음 한 프레임을 건다", () => {
    const { engine, fake } = makeRig();
    engine.unlock();
    expect(fake.contexts).toHaveLength(1);
    const ctx = fake.ctx();
    expect(ctx.options.latencyHint).toBe("balanced");
    expect(ctx.resumeCalls).toBe(1);
    const silent = ctx.buffers.find((b) => b.length === 1);
    expect(silent).toBeDefined();
    const src = ctx.sources().find((s) => s.buffer === silent);
    expect(src?.startedAt).not.toBeNull();
    expect(engine.state()).toBe("running");
  });

  it("두 번째 unlock() 은 컨텍스트를 새로 만들지 않는다", () => {
    const { engine, fake } = makeRig();
    engine.unlock();
    engine.unlock();
    expect(fake.contexts).toHaveLength(1);
  });

  it("nav.audioSession 이 있으면 type 이 ambient, 없으면 아무 일도 없다", () => {
    const session = { type: "auto" };
    const a = makeRig({ nav: { audioSession: session } });
    a.engine.unlock();
    expect(session.type).toBe("ambient");
    const b = makeRig({ nav: {} });
    expect(() => b.engine.unlock()).not.toThrow();
    const c = makeRig({ nav: null });
    expect(() => c.engine.unlock()).not.toThrow();
  });

  it("그래프: 버스 셋 → master → compressor → destination, 초기값은 recipes 의 상수", () => {
    const { engine, fake } = makeRig();
    engine.unlock();
    const ctx = fake.ctx();
    const g = graphOf(ctx);
    expect(g.comp.out).toContain(ctx.destination);
    expect(g.master.gain.value).toBe(MASTER_GAIN);
    expect(g.bgm.gain.value).toBe(BUS_GAIN.bgm);
    expect(g.sfx.gain.value).toBe(BUS_GAIN.sfx);
    expect(g.ui.gain.value).toBe(BUS_GAIN.ui);
    const comp = g.comp as unknown as { threshold: { value: number }; ratio: { value: number }; attack: { value: number }; release: { value: number } };
    expect(comp.threshold.value).toBe(COMPRESSOR.threshold);
    expect(comp.ratio.value).toBe(COMPRESSOR.ratio);
    expect(comp.attack.value).toBe(COMPRESSOR.attack);
    expect(comp.release.value).toBe(COMPRESSOR.release);
  });

  it("잡음 버퍼는 컨텍스트마다 2초짜리 하나뿐이다", () => {
    const { engine, fake } = makeRig();
    engine.unlock();
    const ctx = fake.ctx();
    const noise = ctx.buffers.filter((b) => b.length === ctx.sampleRate * 2);
    expect(noise).toHaveLength(1);
    engine.play("kill.slash");
    engine.play("ui.card");
    expect(ctx.buffers.filter((b) => b.length === ctx.sampleRate * 2)).toHaveLength(1);
  });
});

describe("play — 요청은 항상 기록하고 조건이 맞을 때만 소리가 난다 (D-22)", () => {
  it("running + 켜짐: ui.toggle 은 레이어 수만큼 소스를 ui 버스로 잇고 played 참", () => {
    const { engine, fake } = makeRig();
    engine.unlock();
    const ctx = fake.ctx();
    const before = ctx.sources().length;
    engine.play("ui.toggle", { variant: "on" });
    const made = ctx.sources().slice(before);
    expect(made).toHaveLength(renderPlan("ui.toggle", { variant: "on" }).length);
    const g = graphOf(ctx);
    for (const s of made) {
      expect(s.startedAt).not.toBeNull();
      expect(ctx.reaches(s, g.ui)).toBe(true);
      expect(ctx.reaches(s, g.sfx)).toBe(false);
    }
    const log = engine.log();
    expect(log).toHaveLength(1);
    expect(log[0]).toMatchObject({ id: "ui.toggle", played: true });
    expect(Object.keys(log[0]!).sort()).toEqual(["at", "gain", "id", "played"]);
  });

  it("컨텍스트가 없으면 노드 0개, 로그는 played 거짓 한 줄", () => {
    const { engine, fake } = makeRig();
    engine.play("ui.toggle", { variant: "on" });
    expect(fake.contexts).toHaveLength(0);
    expect(engine.log()).toMatchObject([{ id: "ui.toggle", played: false }]);
  });

  it("resume 이 거절돼 locked 이면 소스가 늘지 않고 played 거짓", async () => {
    const fake = createFakeRig();
    fake.resumeMode = "reject";
    const { engine } = makeRig({ createContext: fake.createContext as unknown as EngineDeps["createContext"] });
    engine.unlock();
    await Promise.resolve();
    await Promise.resolve();
    const ctx = fake.ctx();
    const before = ctx.sources().length;
    engine.play("ui.toggle", { variant: "on" });
    expect(ctx.sources()).toHaveLength(before);
    expect(engine.state()).toBe("locked");
    expect(engine.log()).toMatchObject([{ id: "ui.toggle", played: false }]);
  });

  it("suspended 로 남는 컨텍스트도 locked 이고 소리가 나지 않는다", () => {
    const fake = createFakeRig();
    fake.resumeMode = "stay";
    const { engine } = makeRig({ createContext: fake.createContext as unknown as EngineDeps["createContext"] });
    engine.unlock();
    const before = fake.ctx().sources().length;
    engine.play("ui.tap");
    expect(fake.ctx().sources()).toHaveLength(before);
    expect(engine.state()).toBe("locked");
  });

  it("createContext 가 던지면 supported() 거짓이고 unlock·play 는 예외 없이 끝난다", () => {
    const { engine } = makeRig({
      createContext: () => {
        throw new Error("no audio");
      },
    });
    expect(() => engine.unlock()).not.toThrow();
    expect(engine.supported()).toBe(false);
    expect(() => engine.play("ui.tap")).not.toThrow();
    expect(engine.log()).toMatchObject([{ id: "ui.tap", played: false }]);
  });

  it("AudioContext 가 없어 null 이 와도 같다", () => {
    const { engine } = makeRig({ createContext: () => null });
    expect(() => engine.unlock()).not.toThrow();
    expect(engine.supported()).toBe(false);
    engine.play("ui.tap");
    expect(engine.log()[0]!.played).toBe(false);
  });
});

describe("buildVoice — 실시간·오프라인 공용 합성기 (D-18)", () => {
  it("모든 효과음: 노드 수가 recipeNodeCount 와 같고 끝 시각은 시작 + 마지막 릴리스", () => {
    for (const id of SFX_IDS) {
      const fake = createFakeRig();
      const ctx = fake.createContext({});
      const events = renderPlan(id);
      const dest = ctx.createGain();
      const v = buildVoice(ctx as unknown as BaseAudioContext, events, dest as unknown as AudioNode, 2);
      expect(v.nodes, id).toBe(recipeNodeCount(id));
      const end = Math.max(...events.map((e) => 2 + (e.t + e.dur + e.env[3]) / 1000));
      expect(v.endAt, id).toBeCloseTo(end, 6);
      const sources = ctx.sources();
      expect(sources.length, id).toBeGreaterThanOrEqual(events.length);
      for (const s of sources) {
        expect(s.startedAt, id).not.toBeNull();
        expect(s.stoppedAt, id).not.toBeNull();
      }
    }
  });

  it("컨텍스트의 시계를 읽지 않고 모든 시각은 인자다", () => {
    const fake = createFakeRig();
    const ctx = fake.createContext({});
    const dest = ctx.createGain();
    buildVoice(ctx as unknown as BaseAudioContext, renderPlan("ui.tap"), dest as unknown as AudioNode, 5);
    const s = ctx.sources()[0]!;
    expect(s.startedAt).toBeGreaterThanOrEqual(5);
  });
});
