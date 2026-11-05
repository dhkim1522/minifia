// @vitest-environment happy-dom
// 12-06: 소리 시험 페이지(?sound-lab=1) — 게이트·지연 로드·오프라인 렌더 (D-18, D-19, T-12-19, T-12-20).
// 실제 소리도 실제 OfflineAudioContext 도 쓰지 않는다: 가짜 컨텍스트가 그래프를 기록하고 시험이 렌더 결과를 정한다.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { initPerfDebug } from "../../src/debug/perfProbe";
import { SOUND_LAB_PARAM, soundLabEnabled } from "../../src/debug/soundLabData";
import { analyzeSamples, mount, renderOffline, type OfflineFactory } from "../../src/debug/soundLab";
import { buildMixGraph } from "../../src/audio/synth";
import { BED_IDS, BUS_GAIN, COMPRESSOR, MASTER_GAIN, RECIPES } from "../../src/audio/recipes";
import { FakeAudioContext, createFakeClock, type FakeGain } from "../helpers/fakeAudio";
import { makeRig } from "../helpers/soundRig";

const mem = (v: string | null) => ({ getItem: () => v, setItem: () => {}, removeItem: () => {} });

describe("soundLabEnabled — 게이트 (T-12-19)", () => {
  it("상수 이름", () => {
    expect(SOUND_LAB_PARAM).toBe("sound-lab");
  });
  it("쿼리만 있고 개발도 e2e 도 아니면 거짓", () => {
    expect(soundLabEnabled("?sound-lab=1", mem(null), false)).toBe(false);
  });
  it("쿼리 + 개발 빌드면 참", () => {
    expect(soundLabEnabled("?sound-lab=1", mem(null), true)).toBe(true);
  });
  it("쿼리 + ?e2e=1 이면 참", () => {
    expect(soundLabEnabled("?e2e=1&sound-lab=1", mem(null), false)).toBe(true);
  });
  it("e2e 문맥인데 sound-lab 쿼리가 없거나 0 이면 거짓", () => {
    expect(soundLabEnabled("?e2e=1", mem(null), true)).toBe(false);
    expect(soundLabEnabled("?sound-lab=0", mem(null), true)).toBe(false);
    expect(soundLabEnabled("?e2e=1&sound-lab=0", mem(null), true)).toBe(false);
  });
  it("저장소에 e2e 가 남아 있어도 sound-lab 쿼리가 있어야 한다", () => {
    expect(soundLabEnabled("", mem("1"), true)).toBe(false);
    expect(soundLabEnabled("?sound-lab=1", mem("1"), false)).toBe(true);
  });
  it("initPerfDebug 는 게이트가 거짓이면 false 를 돌려준다(운영 주소 ?sound-lab=1)", () => {
    expect(initPerfDebug("?sound-lab=1", { dev: false, storage: null })).toBe(false);
  });
});

describe("정적 — 시험 페이지 본체는 동적 import 로만 불린다 (T-12-19)", () => {
  const SRC = fileURLToPath(new URL("../../src/", import.meta.url));
  const files: { f: string; text: string }[] = [];
  const walk = (dir: string): void => {
    for (const name of readdirSync(dir)) {
      const p = `${dir}${name}`;
      if (statSync(p).isDirectory()) walk(`${p}/`);
      else if (/\.(tsx?|css)$/.test(name)) files.push({ f: p.slice(SRC.length), text: readFileSync(p, "utf8") });
    }
  };
  walk(SRC);

  it("soundLab 본체를 정적 import 하는 파일이 없다", () => {
    const stat = files.filter((x) => /\bfrom\s*["'][^"']*\/soundLab["']/.test(x.text) || /^\s*import\s*["'][^"']*\/soundLab["']/m.test(x.text));
    expect(stat.map((x) => x.f)).toEqual([]);
  });
  it("동적 import(\"./soundLab\") 는 perfProbe.ts 에 한 줄", () => {
    const dyn = files.filter((x) => x.text.includes('import("./soundLab")'));
    expect(dyn.map((x) => x.f)).toEqual(["debug/perfProbe.ts"]);
  });
  it("soundLabData.ts 는 audio 폴더·net/session(타입)·world/testHooks 게이트만 안다", () => {
    const data = files.find((x) => x.f === "debug/soundLabData.ts")!;
    const specs = [...data.text.matchAll(/\bfrom\s*["']([^"']+)["']/g)].map((m) => m[1]!);
    for (const s of specs) expect(s).toMatch(/^(\.\.\/audio\/[A-Za-z]+|\.\.\/net\/session|\.\.\/world\/testHooks)$/);
  });
  it("setMasterTrim 은 엔진과 시험 페이지에서만 쓰인다(제품 화면 호출 0)", () => {
    const users = files.filter((x) => x.text.includes("setMasterTrim")).map((x) => x.f).sort();
    expect(users).toEqual(["audio/engine.ts", "debug/soundLab.ts"]);
  });
  it("시험 페이지는 서버·네트워크 API 를 쓰지 않는다", () => {
    const lab = files.find((x) => x.f === "debug/soundLab.ts")!;
    expect(lab.text).not.toMatch(/\b(fetch|WebSocket|XMLHttpRequest|sendBeacon|EventSource)\b/);
  });
});

/** 렌더 결과를 시험이 정하는 가짜 OfflineAudioContext */
class FakeOffline extends FakeAudioContext {
  rendered: Float32Array | null = null;
  constructor(
    public readonly channels: number,
    public readonly length: number,
    sr: number,
    private readonly fill: (data: Float32Array, sr: number) => void,
  ) {
    super(createFakeClock());
    this.sampleRate = sr;
  }
  startRendering(): Promise<{ length: number; sampleRate: number; getChannelData(c: number): Float32Array }> {
    const data = new Float32Array(this.length);
    this.fill(data, this.sampleRate);
    this.rendered = data;
    return Promise.resolve({ length: this.length, sampleRate: this.sampleRate, getChannelData: () => data });
  }
}

function factoryWith(fill: (data: Float32Array, sr: number) => void): { make: OfflineFactory; made: FakeOffline[] } {
  const made: FakeOffline[] = [];
  const make: OfflineFactory = (channels, length, sr) => {
    const c = new FakeOffline(channels, length, sr, fill);
    made.push(c);
    return c as unknown as ReturnType<OfflineFactory>;
  };
  return { make, made };
}

describe("analyzeSamples — 피크·RMS·길이·NaN", () => {
  const sr = 1000;
  it("진폭 0.5 사인: 피크 약 −6.02 dBFS, RMS 약 −9.03 dBFS", () => {
    const d = new Float32Array(1000);
    for (let i = 0; i < d.length; i += 1) d[i] = 0.5 * Math.sin((2 * Math.PI * 50 * i) / sr);
    const r = analyzeSamples(d, sr);
    expect(r.peakDb).toBeCloseTo(-6.02, 1);
    expect(r.rmsDb).toBeCloseTo(-9.03, 1);
    expect(r.nan).toBe(0);
    expect(r.lengthMs).toBeGreaterThan(980);
  });
  it("길이는 −60 dBFS(0.001)를 넘는 마지막 표본 시각이다", () => {
    const d = new Float32Array(2000);
    d[499] = 0.5;
    d[500] = 0.0011; // 문턱 위
    d[501] = 0.0009; // 문턱 아래
    d[1500] = 0.0005;
    expect(analyzeSamples(d, sr).lengthMs).toBe(501);
  });
  it("NaN·무한대는 개수로 세고 피크·RMS 계산에서 뺀다", () => {
    const d = new Float32Array(100);
    d[3] = Number.NaN;
    d[4] = Number.POSITIVE_INFINITY;
    d[5] = 0.25;
    const r = analyzeSamples(d, sr);
    expect(r.nan).toBe(2);
    expect(Number.isFinite(r.peakDb)).toBe(true);
    expect(r.peakDb).toBeCloseTo(-12.04, 1);
  });
  it("무음이면 피크·RMS 는 −Infinity 가 아니라 −200 으로 고정하고 길이는 0", () => {
    const r = analyzeSamples(new Float32Array(500), sr);
    expect(r.peakDb).toBe(-200);
    expect(r.rmsDb).toBe(-200);
    expect(r.lengthMs).toBe(0);
  });
});

describe("buildMixGraph — 엔진과 오프라인 렌더가 같은 그래프를 쓴다 (D-18)", () => {
  it("compressor → destination, master → compressor, 버스 셋 → master, 값은 레시피 상수", () => {
    const ctx = new FakeAudioContext(createFakeClock());
    const g = buildMixGraph(ctx as unknown as BaseAudioContext);
    const comp = ctx.ofKind("compressor")[0]!;
    expect(comp.out).toContain(ctx.destination);
    const master = g.master as unknown as FakeGain;
    expect(master.out).toContain(comp);
    expect(master.gain.value).toBe(MASTER_GAIN);
    for (const bus of ["bgm", "sfx", "ui"] as const) {
      const node = g.buses[bus] as unknown as FakeGain;
      expect(node.out).toContain(master);
      expect(node.gain.value).toBe(BUS_GAIN[bus]);
    }
    const c = comp as unknown as { threshold: { value: number }; ratio: { value: number }; attack: { value: number }; release: { value: number } };
    expect([c.threshold.value, c.ratio.value, c.attack.value, c.release.value]).toEqual([COMPRESSOR.threshold, COMPRESSOR.ratio, COMPRESSOR.attack, COMPRESSOR.release]);
  });

  it("엔진이 unlock 때 만든 노드(종류·값)가 buildMixGraph 가 만든 것과 같다", () => {
    const rig = makeRig();
    rig.engine.unlock();
    const engineCtx = rig.fake.ctx();
    const direct = new FakeAudioContext(createFakeClock());
    buildMixGraph(direct as unknown as BaseAudioContext);
    const sig = (c: FakeAudioContext): unknown[] =>
      c.nodes
        .filter((n) => n.kind === "gain" || n.kind === "compressor")
        .slice(0, 5)
        .map((n) => (n.kind === "gain" ? ["gain", (n as FakeGain).gain.value] : ["compressor", (n as unknown as { threshold: { value: number } }).threshold.value]));
    expect(sig(engineCtx)).toEqual(sig(direct));
    expect(sig(direct)).toHaveLength(5);
  });
});

describe("renderOffline — 같은 그래프의 오프라인 렌더 (D-18)", () => {
  const sine = (amp: number, hz = 200) => (data: Float32Array, sr: number) => {
    for (let i = 0; i < data.length; i += 1) data[i] = amp * Math.sin((2 * Math.PI * hz * i) / sr);
  };

  it("ui.toggle 한 개: 결과 모양 { id, peakDb, rmsDb, nan, lengthMs, declaredMs }", async () => {
    const { make } = factoryWith(sine(0.25));
    const r = await renderOffline("ui.toggle", make);
    expect(r.id).toBe("ui.toggle");
    expect(r.peakDb).toBeCloseTo(-12.04, 1);
    expect(r.nan).toBe(0);
    expect(r.lengthMs).toBeGreaterThan(0);
    expect(r.declaredMs).toBeGreaterThan(0);
    expect(Object.keys(r).sort()).toEqual(["declaredMs", "id", "lengthMs", "nan", "peakDb", "rmsDb"]);
  });

  it("같은 입력이면 같은 값, 그래프 노드 종류 목록도 같다", async () => {
    const a = factoryWith(sine(0.3));
    const b = factoryWith(sine(0.3));
    const ra = await renderOffline("ui.toggle", a.make);
    const rb = await renderOffline("ui.toggle", b.make);
    expect(rb).toEqual(ra);
    expect(a.made[0]!.nodes.map((n) => n.kind)).toEqual(b.made[0]!.nodes.map((n) => n.kind));
  });

  it("렌더 컨텍스트에는 믹스 그래프(컴프레서·버스)와 소스가 들어 있고 sfx 는 레시피 길이보다 긴 버퍼를 연다", async () => {
    const { make, made } = factoryWith(sine(0.2));
    await renderOffline("kill.slash", make);
    const c = made[0]!;
    expect(c.ofKind("compressor")).toHaveLength(1);
    expect(c.sources().length).toBeGreaterThan(0);
    expect(c.channels).toBe(1);
    expect((c.length / c.sampleRate) * 1000).toBeGreaterThan(RECIPES["kill.slash"].layers.reduce((m, l) => Math.max(m, l.at + l.dur + l.env[3]), 0));
  });

  it("침대는 8초 구간을 렌더하고 선언 길이는 null", async () => {
    const { make, made } = factoryWith(sine(0.2));
    const id = BED_IDS[0];
    const r = await renderOffline(id, make);
    expect(r.declaredMs).toBeNull();
    expect(Math.round((made[0]!.length / made[0]!.sampleRate) * 1000)).toBe(8000);
  });

  it("렌더 중 예외가 나면 NaN 으로 센다(−200·길이 0, 던지지 않는다)", async () => {
    const make: OfflineFactory = () => {
      throw new Error("no offline context");
    };
    const r = await renderOffline("ui.tap", make);
    expect(r.nan).toBeGreaterThan(0);
    expect(r.peakDb).toBe(-200);
  });
});

describe("mount — 지연 로드 본체 (D-19)", () => {
  it("루트에 [data-sound-lab] 이 생기고 ui.toggle ▶ 를 누르면 엔진에 요청이 들어간다", () => {
    const rig = makeRig();
    const root = document.createElement("div");
    document.body.appendChild(root);
    mount(root, new URLSearchParams("sound-lab=1"), { engine: rig.engine });
    expect(root.querySelector("[data-sound-lab]")).not.toBeNull();
    const btn = root.querySelector<HTMLElement>('[data-sound-id="ui.toggle"]');
    expect(btn).not.toBeNull();
    btn!.click();
    expect(rig.fake.contexts).toHaveLength(1);
    const entry = rig.engine.log().find((e) => e.id === "ui.toggle");
    expect(entry?.played).toBe(true);
  });

  it("서버 호출·소리 설정 외 저장이 없다(저장소 쓰기 0)", () => {
    const rig = makeRig();
    const root = document.createElement("div");
    mount(root, new URLSearchParams("sound-lab=1"), { engine: rig.engine });
    root.querySelector<HTMLElement>('[data-sound-id="ui.toggle"]')!.click();
    expect(rig.storage.length).toBe(0);
  });

  it("[계산] 한 개가 오프라인 렌더 결과를 훅과 화면에 낸다", async () => {
    const { make } = factoryWith((d, sr) => {
      for (let i = 0; i < d.length; i += 1) d[i] = 0.25 * Math.sin((2 * Math.PI * 200 * i) / sr);
    });
    const root = document.createElement("div");
    const handle = mount(root, new URLSearchParams("sound-lab=1"), { engine: makeRig().engine, createOffline: make });
    const calc = root.querySelector<HTMLElement>('[data-sound-calc="ui.toggle"]');
    expect(calc).not.toBeNull();
    calc!.click();
    await handle.idle();
    const hook = (window as unknown as { __mfSoundLab?: { results: { id: string; peakDb: number }[] } }).__mfSoundLab;
    expect(hook?.results.map((r) => r.id)).toEqual(["ui.toggle"]);
    expect(hook!.results[0]!.peakDb).toBeCloseTo(-12.04, 1);
    expect(root.querySelector('[data-sound-id="ui.toggle"]')?.parentElement?.textContent).toMatch(/-12\.0/);
  });
});
