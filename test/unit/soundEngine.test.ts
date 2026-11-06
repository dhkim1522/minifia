// 12-05: 소리 엔진 — 가짜 컨텍스트로 돈다 (D-2, D-7, D-8, D-16, B-3). 실제 소리 출력에 기대지 않는다.
import { describe, expect, it } from "vitest";
import { buildVoice } from "../../src/audio/synth";
import type { EngineDeps } from "../../src/audio/engine";
import { BED_IDS, BED_NODE_MAX, BEDS, BUS_GAIN, COMPRESSOR, MASTER_GAIN, NODE_BUDGET, RECIPES, SFX_IDS, SFX_VOICE_MAX, bedNodeCount, bedPlan, recipeNodeCount, renderPlan, type BedId, type SfxId } from "../../src/audio/recipes";
import { SOUND_PREF_KEY } from "../../src/audio/prefs";
import { seededRandInt } from "../helpers/seededRandom";
import { MemoryStorage } from "../helpers/memoryStorage";
import { FakeAudioContext, FakeGain, createFakeRig, type FakeNode, type FakeSource } from "../helpers/fakeAudio";
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

// ───────────────────────── Task 2: 믹스 ─────────────────────────

/** id 를 한 번 요청하고, 그 요청이 만든 소스들을 돌려준다 */
function fire(rig: ReturnType<typeof makeRig>, id: SfxId, opts?: Parameters<ReturnType<typeof makeRig>["engine"]["play"]>[1]): FakeSource[] {
  const ctx = rig.fake.ctx();
  const before = ctx.sources().length;
  rig.engine.play(id, opts);
  return ctx.sources().slice(before);
}

/** 끊긴 소스인가: 정지 시각이 지금 바로 뒤다 */
function isCut(rig: ReturnType<typeof makeRig>, s: FakeSource): boolean {
  return s.stoppedAt !== null && s.stoppedAt <= rig.fake.ctx().currentTime + 0.1;
}

function unlocked(over: Partial<EngineDeps> = {}): ReturnType<typeof makeRig> {
  const rig = makeRig(over);
  rig.engine.unlock();
  return rig;
}

describe("보이스 한도 — 우선순위 낮은 것 → 오래된 것을 끊는다 (D-16)", () => {
  const MIXED: SfxId[] = ["pin.move", "day.start", "morning.dawn", "chalk.draw", "runoff.intro", "pick.turn", "ballot.yes", "ballot.no"];

  it("아홉 번째 요청은 우선순위 숫자가 가장 큰 보이스를 끊고 난다", () => {
    const rig = unlocked();
    const made = MIXED.map((id) => fire(rig, id));
    expect(rig.engine.voiceCount()).toBe(SFX_VOICE_MAX);
    const nine = fire(rig, "verdict.reject");
    expect(nine.length).toBeGreaterThan(0);
    expect(rig.engine.log().at(-1)).toMatchObject({ id: "verdict.reject", played: true });
    expect(rig.engine.voiceCount()).toBe(SFX_VOICE_MAX);
    expect(made[0]!.every((s) => isCut(rig, s))).toBe(true); // pin.move 는 우선 2
    for (const m of made.slice(1)) expect(m.some((s) => isCut(rig, s))).toBe(false);
  });

  it("우선순위가 같으면 가장 오래된 것을 끊는다", () => {
    const rig = unlocked();
    const prio1: SfxId[] = ["day.start", "morning.dawn", "chalk.draw", "runoff.intro", "pick.turn", "ballot.yes", "ballot.no", "game.start"];
    const made = prio1.map((id) => fire(rig, id));
    fire(rig, "verdict.reject");
    expect(made[0]!.every((s) => isCut(rig, s))).toBe(true);
    for (const m of made.slice(1)) expect(m.some((s) => isCut(rig, s))).toBe(false);
    expect(rig.engine.voiceCount()).toBe(SFX_VOICE_MAX);
  });

  it("활성 보이스가 전부 우선 0 이면 우선 0 이 아닌 새 요청은 버려지고 우선 0 은 일시 초과로 난다", () => {
    const rig = unlocked();
    const zero: SfxId[] = ["verdict.heart", "verdict.heart", "execution.gavel", "execution.gavel", "kill.slash", "kill.slash", "award.final", "award.final"];
    zero.forEach((id) => fire(rig, id));
    expect(rig.engine.voiceCount()).toBe(8);
    const dropped = fire(rig, "ui.deny");
    expect(dropped).toHaveLength(0);
    expect(rig.engine.log().at(-1)).toMatchObject({ id: "ui.deny", played: false });
    expect(rig.engine.voiceCount()).toBe(8);
    const over = fire(rig, "result.lose");
    expect(over.length).toBeGreaterThan(0);
    expect(rig.engine.voiceCount()).toBe(9);
    rig.fake.clock.advance(700);
    expect(rig.engine.voiceCount()).toBeLessThan(9);
  });

  it("같은 id 가 max 이면 같은 id 안에서 가장 오래된 것을 끊는다", () => {
    const rig = unlocked();
    const other = fire(rig, "day.start");
    const a = fire(rig, "game.start");
    const b = fire(rig, "game.start");
    const c = fire(rig, "game.start");
    expect(RECIPES["game.start"].max).toBe(2);
    expect(a.every((s) => isCut(rig, s))).toBe(true);
    expect(b.some((s) => isCut(rig, s))).toBe(false);
    expect(c.length).toBeGreaterThan(0);
    expect(other.some((s) => isCut(rig, s))).toBe(false);
    expect(rig.engine.voiceInfo().filter((v) => v.id === "game.start")).toHaveLength(2);
  });

  it("gapMs 안의 같은 id 요청은 버려지고 간격이 지나면 난다", () => {
    const rig = unlocked();
    expect(fire(rig, "timer.tick").length).toBeGreaterThan(0);
    rig.fake.clock.advance(300);
    expect(fire(rig, "timer.tick")).toHaveLength(0);
    expect(rig.engine.log().at(-1)).toMatchObject({ id: "timer.tick", played: false });
    rig.fake.clock.advance(600);
    expect(fire(rig, "timer.tick").length).toBeGreaterThan(0);
    expect(rig.engine.log().at(-1)!.played).toBe(true);
  });

  it("끊긴 보이스는 20ms 페이드로 멈춘다(클릭 방지)", () => {
    const rig = unlocked();
    const first = fire(rig, "pin.move");
    ["day.start", "morning.dawn", "chalk.draw", "runoff.intro", "pick.turn", "ballot.yes", "ballot.no"].forEach((id) => fire(rig, id as SfxId));
    fire(rig, "verdict.reject");
    const ctx = rig.fake.ctx();
    const fades = ctx.ofKind("gain").filter((g) => (g as FakeGain).gain.of("linear").some((c) => c.value === 0 && Math.abs(c.time - (ctx.currentTime + 0.02)) < 1e-9));
    expect(fades.length).toBeGreaterThanOrEqual(1);
    expect(first.every((s) => s.stoppedAt! <= ctx.currentTime + 0.05)).toBe(true);
  });
});

describe("노드 예산 — 어떤 요청 열로도 상한을 넘은 채 남지 않는다 (D-16, T-12-16)", () => {
  it.each([1, 7, 42, 2024, 99991])("최악 조합 열(시드 %i): 보이스 8·노드 48, 넘는 것은 우선 0 뿐", (seed) => {
    const rig = unlocked();
    const pick = seededRandInt(seed);
    for (let i = 0; i < 400; i += 1) {
      const id = SFX_IDS[pick(SFX_IDS.length)]!;
      rig.engine.play(id);
      rig.fake.clock.advance(pick(90));
      const info = rig.engine.voiceInfo();
      const nodes = info.reduce((n, v) => n + v.nodes, 0);
      expect(nodes).toBe(rig.engine.activeNodes());
      const allZero = info.every((v) => v.prio === 0);
      if (info.length > SFX_VOICE_MAX || nodes > NODE_BUDGET) expect(allZero, `step ${i}`).toBe(true);
    }
    rig.fake.clock.advance(5000);
    expect(rig.engine.voiceCount()).toBe(0);
    expect(rig.engine.activeNodes()).toBe(0);
  });
});

describe("침대 버스 덕킹 (D-16)", () => {
  const bgmOf = (rig: ReturnType<typeof makeRig>): FakeGain => graphOf(rig.fake.ctx()).bgm;

  it("덕킹 레시피는 setTargetAtTime(attack 30ms)으로 내리고 holdMs 뒤 release 250ms 로 복귀한다", () => {
    const rig = unlocked();
    const { db, holdMs } = RECIPES["game.start"].duck!;
    fire(rig, "game.start");
    const t = bgmOf(rig).gain.of("target");
    expect(t).toHaveLength(1);
    expect(t[0]!.value).toBeCloseTo(BUS_GAIN.bgm * 10 ** (db / 20), 6);
    expect(t[0]!.tc).toBeCloseTo(0.03, 6);
    rig.fake.clock.advance(holdMs - 10);
    expect(bgmOf(rig).gain.of("target")).toHaveLength(1);
    rig.fake.clock.advance(20);
    const after = bgmOf(rig).gain.of("target");
    expect(after).toHaveLength(2);
    expect(after[1]!.value).toBe(BUS_GAIN.bgm);
    expect(after[1]!.tc).toBeCloseTo(0.25, 6);
  });

  it("duckBed 를 직접 불러도 같다", () => {
    const rig = unlocked();
    rig.engine.duckBed(-8, 500);
    expect(bgmOf(rig).gain.of("target")[0]!.value).toBeCloseTo(BUS_GAIN.bgm * 10 ** (-8 / 20), 6);
    rig.fake.clock.advance(501);
    expect(bgmOf(rig).gain.of("target")).toHaveLength(2);
  });

  it("겹친 덕킹은 더 깊은 쪽이 이기고 복귀는 마지막 덕킹이 끝난 뒤다", () => {
    const rig = unlocked();
    rig.engine.duckBed(-6, 1000);
    rig.fake.clock.advance(100);
    rig.engine.duckBed(-14, 500);
    const calls = bgmOf(rig).gain.of("target");
    expect(calls).toHaveLength(2);
    expect(calls[1]!.value).toBeCloseTo(BUS_GAIN.bgm * 10 ** (-14 / 20), 6);
    rig.fake.clock.advance(850); // 두 번째 hold 는 끝났지만 첫 hold(1000ms)는 아직
    expect(bgmOf(rig).gain.of("target")).toHaveLength(2);
    rig.fake.clock.advance(100);
    expect(bgmOf(rig).gain.of("target")).toHaveLength(3);
  });

  it("얕은 덕킹이 뒤에 와도 더 내리지 않고 복귀만 미룬다", () => {
    const rig = unlocked();
    rig.engine.duckBed(-14, 500);
    rig.fake.clock.advance(100);
    rig.engine.duckBed(-6, 2000);
    expect(bgmOf(rig).gain.of("target")).toHaveLength(1);
    rig.fake.clock.advance(1000);
    expect(bgmOf(rig).gain.of("target")).toHaveLength(1);
    rig.fake.clock.advance(1100);
    expect(bgmOf(rig).gain.of("target")).toHaveLength(2);
  });
});

describe("끄기/켜기 (D-5, B-1)", () => {
  it("setOn(false): 활성 보이스에 120ms 페이드아웃, 이후 요청은 기록만 하고 played 거짓", () => {
    const rig = unlocked();
    fire(rig, "game.start");
    fire(rig, "day.start");
    const ctx = rig.fake.ctx();
    const t0 = ctx.currentTime;
    rig.engine.setOn(false);
    const fades = ctx.ofKind("gain").filter((g) => (g as FakeGain).gain.of("linear").some((c) => c.value === 0 && Math.abs(c.time - (t0 + 0.12)) < 1e-9));
    expect(fades.length).toBeGreaterThanOrEqual(2);
    rig.fake.clock.advance(200);
    expect(rig.engine.voiceCount()).toBe(0);
    const before = ctx.sources().length;
    rig.engine.play("ui.tap");
    expect(ctx.sources()).toHaveLength(before);
    expect(rig.engine.log().at(-1)).toMatchObject({ id: "ui.tap", played: false });
    expect(rig.engine.isOn()).toBe(false);
  });

  it("12-07 setOn(false): ui.toggle(끔 변형)을 먼저 내 played 참으로 남기고, 나머지 보이스만 120ms 페이드아웃한다", () => {
    const rig = unlocked();
    fire(rig, "game.start");
    fire(rig, "day.start");
    const ctx = rig.fake.ctx();
    const before = ctx.sources().length;
    const t0 = ctx.currentTime;
    rig.engine.clearLog();
    rig.engine.setOn(false);
    expect(rig.engine.log()).toMatchObject([{ id: "ui.toggle", played: true }]);
    const made = ctx.sources().slice(before);
    expect(made).toHaveLength(1);
    expect(made[0]!.frequency.of("exp")[0]!.value).toBe(330); // 끔 변형은 440 → 330
    // 켜 둔 동안 낸 소리는 페이드 중이고, 방금 낸 ui.toggle 보이스만 남아 있다
    expect(rig.engine.voiceCount()).toBe(1);
    expect(rig.engine.voiceInfo()[0]!.id).toBe("ui.toggle");
    expect(made[0]!.stoppedAt === null || made[0]!.stoppedAt > t0 + 0.12).toBe(true);
    rig.fake.clock.advance(200);
    expect(rig.engine.voiceCount()).toBe(0);
    rig.engine.play("ui.tap");
    expect(rig.engine.log().at(-1)).toMatchObject({ id: "ui.tap", played: false });
  });

  it("12-07 setOn(false): 순서 — ui.toggle 소스가 만들어진 뒤에 나머지 보이스가 끊긴다", () => {
    const rig = unlocked();
    fire(rig, "game.start");
    const ctx = rig.fake.ctx();
    const sourcesBefore = ctx.sources().length;
    const order: string[] = [];
    const origCreate = ctx.createOscillator.bind(ctx);
    ctx.createOscillator = ((...a: Parameters<typeof origCreate>) => {
      order.push("create");
      return origCreate(...a);
    }) as typeof ctx.createOscillator;
    for (const src of ctx.sources()) {
      const stop = src.stop.bind(src);
      src.stop = ((t?: number) => {
        order.push("stop");
        return stop(t);
      }) as typeof src.stop;
    }
    rig.engine.setOn(false);
    expect(ctx.sources().length).toBeGreaterThan(sourcesBefore);
    expect(order.indexOf("create")).toBeGreaterThanOrEqual(0);
    const firstStop = order.indexOf("stop");
    if (firstStop >= 0) expect(order.indexOf("create")).toBeLessThan(firstStop);
  });

  it("12-07 저장값이 켜짐이어도 locked(컨텍스트가 running 이 아님)에서 setOn(false)는 조용히 저장만 한다", () => {
    const rig = makeRig();
    expect(() => rig.engine.setOn(false)).not.toThrow();
    expect(rig.engine.isOn()).toBe(false);
    expect(rig.engine.log()).toMatchObject([{ id: "ui.toggle", played: false }]);
  });

  it("setOn(true): ui.toggle(on 변형)을 한 번 낸다. 꺼져 있던 동안의 요청은 되살리지 않는다", () => {
    const rig = unlocked();
    rig.engine.setOn(false);
    rig.engine.play("kill.slash");
    rig.engine.play("result.win");
    const ctx = rig.fake.ctx();
    const before = ctx.sources().length;
    rig.engine.clearLog();
    rig.engine.setOn(true);
    const made = ctx.sources().slice(before);
    expect(made).toHaveLength(1);
    expect(made[0]!.frequency.of("exp")[0]!.value).toBe(660); // on 변형은 440 → 660
    expect(rig.engine.log()).toMatchObject([{ id: "ui.toggle", played: true }]);
  });

  it("같은 값으로 setOn 을 되풀이해도 소리가 겹치지 않는다", () => {
    const rig = unlocked();
    rig.engine.setOn(true);
    expect(rig.engine.log()).toHaveLength(0);
    rig.engine.setOn(false);
    rig.engine.setOn(false);
    expect(rig.storage.getItem(SOUND_PREF_KEY)).toBe(JSON.stringify({ v: 1, on: false }));
  });

  it("엔진은 생성 때 저장값을 읽고 setOn 은 저장한다", () => {
    const storage = new MemoryStorage();
    storage.setItem(SOUND_PREF_KEY, JSON.stringify({ v: 1, on: false }));
    const rig = unlocked({ storage });
    expect(rig.engine.isOn()).toBe(false);
    rig.engine.play("ui.tap");
    expect(rig.engine.log()[0]!.played).toBe(false);
    rig.engine.setOn(true);
    expect(storage.getItem(SOUND_PREF_KEY)).toBe(JSON.stringify({ v: 1, on: true }));
  });

  it("저장소가 막혀 있어도 엔진은 켜짐으로 시작하고 예외가 없다", () => {
    const storage = {
      getItem(): string | null {
        throw new Error("blocked");
      },
      setItem(): void {
        throw new Error("blocked");
      },
    };
    const rig = unlocked({ storage });
    expect(rig.engine.isOn()).toBe(true);
    expect(() => rig.engine.setOn(false)).not.toThrow();
  });
});

// ───────────────────────── Task 3: 수명 ─────────────────────────

const flush = async (): Promise<void> => {
  for (let i = 0; i < 4; i += 1) await Promise.resolve();
};

/** bgm 버스로 이어지는 침대 게인들(시작 순서대로) */
function bedGains(ctx: FakeAudioContext): FakeGain[] {
  const bgm = graphOf(ctx).bgm;
  return ctx.ofKind("gain").filter((g) => g.out.includes(bgm)) as FakeGain[];
}

const lastRamp = (g: FakeGain): { value: number; time: number } | undefined => g.gain.of("linear").at(-1);

describe("상태: 잠금·중단·닫힘 (D-9, B-3)", () => {
  it("interrupted 면 locked, running 으로 돌아오면 running", () => {
    const rig = unlocked();
    const ctx = rig.fake.ctx();
    ctx.setState("interrupted");
    expect(rig.engine.state()).toBe("locked");
    const before = ctx.sources().length;
    rig.engine.play("ui.tap");
    expect(ctx.sources()).toHaveLength(before);
    expect(rig.engine.log().at(-1)!.played).toBe(false);
    ctx.setState("running");
    expect(rig.engine.state()).toBe("running");
    rig.engine.play("ui.deny");
    expect(rig.engine.log().at(-1)!.played).toBe(true);
  });

  it("closed 면 none 이고 다음 unlock() 이 컨텍스트를 새로 만든다", () => {
    const rig = unlocked();
    rig.fake.ctx().setState("closed");
    expect(rig.engine.state()).toBe("none");
    rig.engine.unlock();
    expect(rig.fake.contexts).toHaveLength(2);
    expect(rig.engine.state()).toBe("running");
  });

  it("resume() 이 거절돼도 예외가 새지 않고 locked", async () => {
    const fake = createFakeRig();
    fake.resumeMode = "reject";
    const rig = makeRig({ createContext: fake.createContext as unknown as EngineDeps["createContext"] });
    expect(() => rig.engine.unlock()).not.toThrow();
    await flush();
    expect(rig.engine.state()).toBe("locked");
    fake.resumeMode = "grant";
    fake.ctx().resumeMode = "grant";
    rig.engine.unlock();
    await flush();
    expect(rig.engine.state()).toBe("running");
  });

  it("subscribe 는 state·on·bed 변화마다 부르고 해제할 수 있다", () => {
    const rig = makeRig();
    let n = 0;
    const off = rig.engine.subscribe(() => {
      n += 1;
    });
    rig.engine.unlock();
    expect(n).toBeGreaterThan(0);
    const snap = rig.engine.snapshot();
    expect(snap).toMatchObject({ state: "running", on: true, bed: null, supported: true });
    expect(rig.engine.snapshot()).toBe(snap); // 변화가 없으면 같은 객체
    const a = n;
    rig.engine.setBed("bed.day");
    rig.engine.setOn(false);
    expect(n).toBeGreaterThanOrEqual(a + 2);
    expect(rig.engine.snapshot()).toMatchObject({ on: false, bed: "bed.day" });
    off();
    const b = n;
    rig.engine.setOn(true);
    expect(n).toBe(b);
  });
});

describe("침대 — 스케줄러와 크로스페이드 (D-16, B-1)", () => {
  /** 침대를 시작해 secs 초를 60ms 걸음으로 돌린다 */
  function runBed(id: BedId, secs: number): { rig: ReturnType<typeof makeRig>; origin: number; cursor: number } {
    const rig = unlocked();
    const origin = rig.fake.ctx().currentTime;
    rig.engine.setBed(id);
    for (let i = 0; i < Math.round((secs * 1000) / 60); i += 1) rig.fake.clock.advance(60);
    return { rig, origin, cursor: Math.round((secs * 1000) / 60) * 60 + 250 };
  }

  it("같은 침대에 다시 부르면 아무 일도 없다 (로그·노드)", () => {
    const rig = unlocked();
    rig.engine.setBed("bed.day");
    const n = rig.fake.ctx().nodes.length;
    const logs = rig.engine.log().length;
    rig.engine.setBed("bed.day");
    expect(rig.fake.ctx().nodes.length).toBe(n);
    expect(rig.engine.log()).toHaveLength(logs);
    expect(rig.engine.currentBed()).toBe("bed.day");
    expect(rig.engine.log().at(-1)).toMatchObject({ id: "bed.day", played: true });
  });

  it.each(BED_IDS)("%s: 10초를 돌려도 같은 이벤트를 두 번 예약하지 않고 빠뜨리지도 않는다", (id) => {
    const { rig, origin, cursor } = runBed(id, 10);
    const ctx = rig.fake.ctx();
    const got = ctx
      .sources()
      .filter((s) => s.startedAt !== null && s.startedAt >= origin - 1e-9 && !(s.buffer !== null && s.buffer.length === 1))
      .map((s) => Math.round((s.startedAt! - origin) * 1000))
      .sort((a, b) => a - b);
    const want: number[] = [];
    for (const e of bedPlan(id, 0, cursor)) {
      want.push(Math.round(e.t));
      if (e.kind === "osc" && e.lfoHz !== undefined && e.lfoCents !== undefined) want.push(Math.round(e.t));
    }
    want.sort((a, b) => a - b);
    expect(got).toEqual(want);
    expect(got.length).toBeGreaterThan(0);
  });

  it.each(BED_IDS)("%s: 동시에 울리는 소스는 침대 노드 상한 안", (id) => {
    const { rig, origin } = runBed(id, 12);
    const ctx = rig.fake.ctx();
    let max = 0;
    for (let ms = 0; ms < 12000; ms += 50) max = Math.max(max, ctx.liveSourcesAt(origin + ms / 1000));
    expect(max).toBeLessThanOrEqual(BED_NODE_MAX);
  });

  it("침대를 켜면 침대 게인이 0 에서 1 로 1.2초 램프, 훅의 bed 와 로그에 id 가 남는다", () => {
    const rig = unlocked();
    const ctx = rig.fake.ctx();
    const t0 = ctx.currentTime;
    rig.engine.setBed("bed.lobby");
    const [g] = bedGains(ctx);
    expect(g!.gain.of("set")[0]).toMatchObject({ value: 0 });
    expect(lastRamp(g!)!.value).toBe(1);
    expect(lastRamp(g!)!.time).toBeCloseTo(t0 + 1.2, 6);
    expect(rig.engine.log().at(-1)).toMatchObject({ id: "bed.lobby", played: true });
  });

  it("다른 침대로 바꾸면 이전은 1.2초 동안 0 으로, 새 것은 0 에서 1 로 오른다(크로스페이드)", () => {
    const rig = unlocked();
    const ctx = rig.fake.ctx();
    rig.engine.setBed("bed.day");
    rig.fake.clock.advance(2000);
    const t = ctx.currentTime;
    rig.engine.setBed("bed.vote");
    const [oldG, newG] = bedGains(ctx);
    expect(lastRamp(oldG!)).toMatchObject({ value: 0 });
    expect(lastRamp(oldG!)!.time).toBeCloseTo(t + 1.2, 6);
    expect(lastRamp(newG!)).toMatchObject({ value: 1 });
    expect(lastRamp(newG!)!.time).toBeCloseTo(t + 1.2, 6);
    const before = ctx.sources().length;
    rig.fake.clock.advance(6000); // 드론 침대는 4초 조각이라 한 조각 넘어가야 새 소스가 생긴다
    const fresh = ctx.sources().slice(before);
    expect(fresh.length).toBeGreaterThan(0);
    for (const s of fresh) {
      expect(ctx.reaches(s, newG!)).toBe(true);
      expect(ctx.reaches(s, oldG!)).toBe(false);
    }
    // 이전 침대 소스는 페이드가 끝난 뒤 모두 정지가 예약돼 있다
    for (const s of ctx.sources().filter((x) => ctx.reaches(x, oldG!))) expect(s.stoppedAt!).toBeLessThanOrEqual(t + 1.2 + 0.1);
  });

  it("setBed(null) 은 페이드아웃 뒤 멈추고 스케줄러도 멈춘다", () => {
    const rig = unlocked();
    const ctx = rig.fake.ctx();
    rig.engine.setBed("bed.night");
    rig.fake.clock.advance(1000);
    const t = ctx.currentTime;
    rig.engine.setBed(null);
    const [g] = bedGains(ctx);
    expect(lastRamp(g!)).toMatchObject({ value: 0 });
    expect(lastRamp(g!)!.time).toBeCloseTo(t + 1.2, 6);
    expect(rig.engine.currentBed()).toBeNull();
    rig.fake.clock.advance(1500);
    const n = ctx.sources().length;
    rig.fake.clock.advance(3000);
    expect(ctx.sources()).toHaveLength(n);
  });

  it("잠금 중에 정한 침대는 기록만 남고(played 거짓), 풀리면 시작한다", () => {
    const fake = createFakeRig();
    fake.resumeMode = "stay";
    const rig = makeRig({ createContext: fake.createContext as unknown as EngineDeps["createContext"] });
    rig.engine.unlock();
    const ctx = fake.ctx();
    const before = ctx.sources().length;
    rig.engine.setBed("bed.reveal");
    expect(rig.engine.log().at(-1)).toMatchObject({ id: "bed.reveal", played: false });
    rig.fake.clock.advance(500);
    expect(ctx.sources()).toHaveLength(before);
    ctx.setState("running");
    rig.fake.clock.advance(500);
    expect(ctx.sources().length).toBeGreaterThan(before);
    expect(rig.engine.currentBed()).toBe("bed.reveal");
  });

  it("꺼져 있는 동안 정한 침대는 소리가 없고, 켜면 1.2초 페이드인과 ui.toggle 한 번", () => {
    const rig = unlocked();
    const ctx = rig.fake.ctx();
    rig.engine.setOn(false);
    const before = ctx.sources().length;
    rig.engine.setBed("bed.day");
    rig.fake.clock.advance(500);
    expect(ctx.sources()).toHaveLength(before);
    rig.engine.clearLog();
    const t = ctx.currentTime;
    rig.engine.setOn(true);
    const [g] = bedGains(ctx);
    expect(lastRamp(g!)).toMatchObject({ value: 1 });
    expect(lastRamp(g!)!.time).toBeCloseTo(t + 1.2, 6);
    expect(rig.engine.log().filter((e) => e.id === "ui.toggle" && e.played)).toHaveLength(1);
    rig.fake.clock.advance(500);
    expect(ctx.sources().length).toBeGreaterThan(before + 1);
  });

  it("끄면 침대 게인을 120ms 에 줄이고 스케줄러를 멈춘다", () => {
    const rig = unlocked();
    const ctx = rig.fake.ctx();
    rig.engine.setBed("bed.day");
    rig.fake.clock.advance(1000);
    const t = ctx.currentTime;
    rig.engine.setOn(false);
    const [g] = bedGains(ctx);
    expect(lastRamp(g!)).toMatchObject({ value: 0 });
    expect(lastRamp(g!)!.time).toBeCloseTo(t + 0.12, 6);
    rig.fake.clock.advance(300);
    const n = ctx.sources().length;
    rig.fake.clock.advance(3000);
    expect(ctx.sources()).toHaveLength(n);
  });

  it("interrupted 동안 스케줄러는 멈추고 돌아오면 현재 침대만 다시 시작한다", () => {
    const rig = unlocked();
    const ctx = rig.fake.ctx();
    rig.engine.setBed("bed.day");
    rig.fake.clock.advance(1000);
    ctx.setState("interrupted");
    const n = ctx.sources().length;
    rig.fake.clock.advance(3000);
    expect(ctx.sources()).toHaveLength(n);
    ctx.setState("running");
    rig.fake.clock.advance(500);
    expect(ctx.sources().length).toBeGreaterThan(n);
  });

  it("침대가 켜져 있어도 보이스·노드 상한이 지켜진다 (침대 노드 포함)", () => {
    const rig = unlocked();
    rig.engine.setBed("bed.night");
    const bedNodes = rig.engine.activeNodes();
    expect(bedNodes).toBe(bedNodeCount(BEDS["bed.night"]));
    const pick = seededRandInt(77);
    for (let i = 0; i < 300; i += 1) {
      rig.engine.play(SFX_IDS[pick(SFX_IDS.length)]!);
      rig.fake.clock.advance(pick(90));
      const info = rig.engine.voiceInfo();
      const allZero = info.every((v) => v.prio === 0);
      if (rig.engine.activeNodes() > NODE_BUDGET) expect(allZero, `step ${i}`).toBe(true);
    }
  });
});

describe("숨김·복귀 (D-9)", () => {
  it("hidden(): master 120ms 페이드 뒤 suspend, 침대 타이머 정지, state suspended", () => {
    const rig = unlocked();
    const ctx = rig.fake.ctx();
    rig.engine.setBed("bed.day");
    rig.fake.clock.advance(500);
    const master = graphOf(ctx).master;
    const t = ctx.currentTime;
    rig.engine.hidden();
    expect(lastRamp(master)).toMatchObject({ value: 0 });
    expect(lastRamp(master)!.time).toBeCloseTo(t + 0.12, 6);
    expect(ctx.suspendCalls).toBe(0);
    rig.fake.clock.advance(130);
    expect(ctx.suspendCalls).toBe(1);
    expect(rig.engine.state()).toBe("suspended");
    const n = ctx.sources().length;
    rig.fake.clock.advance(3000);
    expect(ctx.sources()).toHaveLength(n);
    rig.engine.play("ui.tap");
    expect(rig.engine.log().at(-1)!.played).toBe(false);
  });

  it("visible(): resume 성공이면 master 복구, 현재 침대만 되살린다(숨겨진 동안의 대본·일회성은 없다)", async () => {
    const rig = unlocked();
    const ctx = rig.fake.ctx();
    rig.engine.setBed("bed.day");
    rig.engine.runScript("verdict", [{ at: 1000, id: "ballot.yes" }]);
    rig.fake.clock.advance(200);
    rig.engine.hidden();
    rig.fake.clock.advance(2000);
    rig.engine.clearLog();
    const resumes = ctx.resumeCalls;
    const n = ctx.sources().length;
    await rig.engine.visible();
    expect(ctx.resumeCalls).toBe(resumes + 1);
    expect(rig.engine.state()).toBe("running");
    expect(lastRamp(graphOf(ctx).master)).toMatchObject({ value: MASTER_GAIN });
    rig.fake.clock.advance(1500);
    expect(ctx.sources().length).toBeGreaterThan(n);
    expect(rig.engine.log().filter((e) => e.id === "ballot.yes")).toHaveLength(0);
  });

  it("visible() 에서 resume 이 거절되면 locked", async () => {
    const rig = unlocked();
    const ctx = rig.fake.ctx();
    rig.engine.hidden();
    rig.fake.clock.advance(200);
    ctx.resumeMode = "reject";
    await rig.engine.visible();
    expect(rig.engine.state()).toBe("locked");
  });

  it("120ms 안에 다시 보이면 suspend 하지 않는다", async () => {
    const rig = unlocked();
    const ctx = rig.fake.ctx();
    rig.engine.hidden();
    rig.fake.clock.advance(50);
    await rig.engine.visible();
    rig.fake.clock.advance(500);
    expect(ctx.suspendCalls).toBe(0);
    expect(rig.engine.state()).toBe("running");
  });

  it("컨텍스트가 없을 때의 hidden/visible 은 아무 일도 없다", async () => {
    const rig = makeRig();
    rig.engine.hidden();
    await rig.engine.visible();
    expect(rig.fake.contexts).toHaveLength(0);
  });
});

describe("대본 예약·취소", () => {
  it("항목을 at ms 뒤에 play 하고 gainDb 를 로그 gain 에 싣는다", () => {
    const rig = unlocked();
    rig.engine.runScript("k", [
      { at: 100, id: "ui.tap" },
      { at: 500, id: "kill.slash", gainDb: -6 },
    ]);
    rig.fake.clock.advance(99);
    expect(rig.engine.log()).toHaveLength(0);
    rig.fake.clock.advance(2);
    expect(rig.engine.log().map((e) => e.id)).toEqual(["ui.tap"]);
    rig.fake.clock.advance(400);
    const slash = rig.engine.log().at(-1)!;
    expect(slash).toMatchObject({ id: "kill.slash", played: true });
    expect(slash.gain).toBeCloseTo(10 ** (-6 / 20), 6);
  });

  it("같은 key 로 다시 부르면 이전 것을 취소한다", () => {
    const rig = unlocked();
    rig.engine.runScript("k", [{ at: 300, id: "ui.tap" }]);
    rig.engine.runScript("k", [{ at: 300, id: "ui.deny" }]);
    rig.fake.clock.advance(400);
    expect(rig.engine.log().map((e) => e.id)).toEqual(["ui.deny"]);
  });

  it("cancelScript·stopAll·setOn(false)·hidden() 이 남은 타이머를 모두 지운다", () => {
    const run = (cancel: (e: ReturnType<typeof makeRig>["engine"]) => void): string[] => {
      const rig = unlocked();
      rig.engine.runScript("a", [{ at: 300, id: "ui.tap" }]);
      rig.engine.runScript("b", [{ at: 400, id: "ui.deny" }]);
      cancel(rig.engine);
      rig.fake.clock.advance(1000);
      return rig.engine.log().map((e) => e.id);
    };
    expect(run((e) => e.cancelScript("a"))).toEqual(["ui.deny"]);
    expect(run((e) => e.stopAll())).toEqual([]);
    expect(run((e) => e.setOn(false))).toEqual(["ui.toggle"]); // 12-07: 끌 때 ui.toggle(끔) 한 번만 남는다
    expect(run((e) => e.hidden())).toEqual([]);
  });

  it("이미 소리 중인 보이스는 자연 종료까지 둔다(cancelScript)", () => {
    const rig = unlocked();
    rig.engine.runScript("a", [{ at: 0, id: "game.start" }]);
    rig.fake.clock.advance(10);
    expect(rig.engine.voiceCount()).toBe(1);
    rig.engine.cancelScript("a");
    expect(rig.engine.voiceCount()).toBe(1);
  });

  it("덕킹 구간을 함께 주면 fromMs 에 내리고 toMs 에서 returnMs 로 복귀한다", () => {
    const rig = unlocked();
    const bgm = graphOf(rig.fake.ctx()).bgm;
    rig.engine.runScript("v", [], { fromMs: 200, toMs: 900, db: -14, returnMs: 800 });
    expect(bgm.gain.of("target")).toHaveLength(0);
    rig.fake.clock.advance(201);
    expect(bgm.gain.of("target")).toHaveLength(1);
    rig.fake.clock.advance(700);
    const t = bgm.gain.of("target");
    expect(t).toHaveLength(2);
    expect(t[1]!.tc).toBeCloseTo(0.8, 6);
  });

  it("stopAll 은 침대와 보이스도 멈추고 침대를 비운다", () => {
    const rig = unlocked();
    rig.engine.setBed("bed.day");
    rig.engine.play("game.start");
    rig.engine.stopAll();
    expect(rig.engine.currentBed()).toBeNull();
    expect(rig.engine.voiceCount()).toBe(0);
    const n = rig.fake.ctx().sources().length;
    rig.fake.clock.advance(3000);
    expect(rig.fake.ctx().sources()).toHaveLength(n);
  });
});

describe("미지원 환경의 침대·대본", () => {
  it("컨텍스트가 없어도 setBed·runScript·hidden·visible 이 예외 없이 끝난다", async () => {
    const rig = makeRig({ createContext: () => null });
    rig.engine.unlock();
    expect(() => rig.engine.setBed("bed.day")).not.toThrow();
    expect(() => rig.engine.runScript("k", [{ at: 10, id: "ui.tap" }])).not.toThrow();
    rig.fake.clock.advance(50);
    rig.engine.hidden();
    await rig.engine.visible();
    expect(rig.engine.log().every((e) => !e.played)).toBe(true);
  });
});

describe("setMasterTrim — 시험 페이지 전용 마스터 슬라이더 (12-06, D-19)", () => {
  it("0..1 로 자르고 master 게인에 램프를 건다(기본 1 이면 MASTER_GAIN 그대로)", () => {
    const rig = makeRig();
    rig.engine.unlock();
    const { master } = graphOf(rig.fake.ctx());
    expect(master.gain.value).toBe(MASTER_GAIN);
    rig.engine.setMasterTrim(0.5);
    const ramp = master.gain.of("linear").at(-1)!;
    expect(ramp.value).toBeCloseTo(MASTER_GAIN * 0.5, 9);
    rig.engine.setMasterTrim(3);
    expect(master.gain.of("linear").at(-1)!.value).toBeCloseTo(MASTER_GAIN, 9);
    rig.engine.setMasterTrim(-1);
    expect(master.gain.of("linear").at(-1)!.value).toBe(0);
    rig.engine.setMasterTrim(Number.NaN);
    expect(master.gain.of("linear").at(-1)!.value).toBeCloseTo(MASTER_GAIN, 9);
  });

  it("컨텍스트가 없을 때 부르면 값만 기억하고, 만들어진 뒤 master 가 그 값으로 시작한다", () => {
    const rig = makeRig();
    rig.engine.setMasterTrim(0.25);
    rig.engine.unlock();
    const { master } = graphOf(rig.fake.ctx());
    expect(master.gain.value).toBeCloseTo(MASTER_GAIN * 0.25, 9);
  });

  it("숨김에서 돌아오면 trim 이 적용된 master 로 복귀한다", async () => {
    const rig = makeRig();
    rig.engine.unlock();
    rig.engine.setMasterTrim(0.5);
    rig.engine.hidden();
    rig.fake.clock.advance(300);
    await rig.engine.visible();
    const { master } = graphOf(rig.fake.ctx());
    expect(master.gain.of("linear").at(-1)!.value).toBeCloseTo(MASTER_GAIN * 0.5, 9);
  });
});
