// 12-05: 소리 엔진 — 가짜 컨텍스트로 돈다 (D-2, D-7, D-8, D-16, B-3). 실제 소리 출력에 기대지 않는다.
import { describe, expect, it } from "vitest";
import { buildVoice } from "../../src/audio/synth";
import type { EngineDeps } from "../../src/audio/engine";
import { BUS_GAIN, COMPRESSOR, MASTER_GAIN, NODE_BUDGET, RECIPES, SFX_IDS, SFX_VOICE_MAX, recipeNodeCount, renderPlan, type SfxId } from "../../src/audio/recipes";
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
