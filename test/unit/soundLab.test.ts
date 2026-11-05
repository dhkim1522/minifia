// @vitest-environment happy-dom
// 12-06: 소리 시험 페이지(?sound-lab=1) — 게이트·지연 로드·오프라인 렌더 (D-18, D-19, T-12-19, T-12-20).
// 실제 소리도 실제 OfflineAudioContext 도 쓰지 않는다: 가짜 컨텍스트가 그래프를 기록하고 시험이 렌더 결과를 정한다.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { initPerfDebug } from "../../src/debug/perfProbe";
import { LAB_GROUPS, SOUND_LIMITS, SOUND_NAMES, SOUND_LAB_PARAM, soundLabEnabled } from "../../src/debug/soundLabData";
import { analyzeSamples, mount, renderOffline, soundOk, type LabHook, type OfflineFactory, type RenderResult } from "../../src/debug/soundLab";
import { buildMixGraph } from "../../src/audio/synth";
import { BED_IDS, BUS_GAIN, COMPRESSOR, MASTER_GAIN, RECIPES, SFX_IDS, SOUND_IDS } from "../../src/audio/recipes";
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
  const SRC = `${process.cwd()}/src/`; // happy-dom 환경이라 import.meta.url 이 file: 이 아니다
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
    expect(users).toContain("audio/engine.ts");
    for (const u of users) expect(["audio/engine.ts", "debug/soundLab.ts"]).toContain(u);
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

// ───────────────────────── Task 2: 데이터·한 화면 전체·전부 계산 ─────────────────────────

describe("LAB_GROUPS·SOUND_NAMES — 묶음과 한글 이름 (E)", () => {
  it("효과음 49개를 여섯 단계 묶음으로 나누고 합집합이 SFX_IDS 전부(중복·누락 0)", () => {
    expect(LAB_GROUPS).toHaveLength(6);
    const all = LAB_GROUPS.flatMap((g) => [...g.ids]);
    expect(all).toHaveLength(SFX_IDS.length);
    expect(new Set(all).size).toBe(all.length);
    expect([...all].sort()).toEqual([...SFX_IDS].sort());
    expect(LAB_GROUPS.map((g) => g.title)).toEqual(["공통·로비·역할", "낮·지목·변론", "판결·처형", "밤·아침", "동작", "결과·시상"]);
  });
  it("56개 모두 한글 이름이 있고 한 줄이다", () => {
    expect(Object.keys(SOUND_NAMES).sort()).toEqual([...SOUND_IDS].sort());
    for (const id of SOUND_IDS) {
      const n = SOUND_NAMES[id];
      expect(n, id).toMatch(/[가-힣]/);
      expect(n, id).not.toMatch(/\n/);
      expect(n.length, id).toBeLessThanOrEqual(16);
    }
  });
  it("SOUND_LIMITS 는 56·−3·−60·50", () => {
    expect({ ...SOUND_LIMITS }).toEqual({ count: 56, peakMaxDb: -3, rmsMinDb: -60, lengthTolMs: 50 });
  });
});

describe("soundOk — 합격 판정 경계 (D-18, T-12-22)", () => {
  const base: RenderResult = { id: "ui.tap", peakDb: -10, rmsDb: -30, nan: 0, lengthMs: 100, declaredMs: 100 };
  it("피크 −3.0 통과 / −2.99 실패", () => {
    expect(soundOk({ ...base, peakDb: -3 })).toBe(true);
    expect(soundOk({ ...base, peakDb: -2.99 })).toBe(false);
  });
  it("RMS −60 통과 / −60.01 실패", () => {
    expect(soundOk({ ...base, rmsDb: -60 })).toBe(true);
    expect(soundOk({ ...base, rmsDb: -60.01 })).toBe(false);
  });
  it("NaN 1 개면 실패", () => {
    expect(soundOk({ ...base, nan: 1 })).toBe(false);
  });
  it("길이 차이 50ms 통과 / 51ms 실패, 침대(선언 null)는 길이를 보지 않는다", () => {
    expect(soundOk({ ...base, lengthMs: 150 })).toBe(true);
    expect(soundOk({ ...base, lengthMs: 50 })).toBe(true);
    expect(soundOk({ ...base, lengthMs: 151 })).toBe(false);
    expect(soundOk({ ...base, lengthMs: 5, declaredMs: null })).toBe(true);
  });
});

describe("mount — 한 화면 전체 (E)", () => {
  function open(over: Partial<Parameters<typeof mount>[2]> = {}) {
    const rig = makeRig();
    const root = document.createElement("div");
    document.body.appendChild(root);
    const handle = mount(root, new URLSearchParams("sound-lab=1"), { engine: rig.engine, ...over });
    const q = (sel: string) => root.querySelector<HTMLElement>(sel);
    const qa = (sel: string) => [...root.querySelectorAll<HTMLElement>(sel)];
    return { rig, root, handle, q, qa };
  }
  const hookOf = () => (window as unknown as { __mfSoundLab: LabHook }).__mfSoundLab;

  it("[data-sound-id] 단추가 정확히 56개(침대 7 + 효과음 49)이고 id 가 SOUND_IDS 와 같다", () => {
    const { qa } = open();
    const ids = qa("[data-sound-id]").map((b) => b.getAttribute("data-sound-id"));
    expect(ids).toHaveLength(56);
    expect([...ids].sort()).toEqual([...SOUND_IDS].sort());
  });

  it("누르는 대상은 모두 최소 44x44 (인라인 스타일 값)", () => {
    const { qa } = open();
    const targets = qa("button, input[type=range], label");
    expect(targets.length).toBeGreaterThan(56);
    for (const t of targets) {
      const h = parseFloat(t.style.minHeight || "0");
      expect(h, t.outerHTML.slice(0, 80)).toBeGreaterThanOrEqual(44);
      if (t.tagName === "BUTTON") expect(parseFloat(t.style.minWidth || "0"), t.outerHTML.slice(0, 80)).toBeGreaterThanOrEqual(44);
    }
  });

  it("상단 고정 줄: 마스터 슬라이더·모두 멈춤·전부 계산·컨텍스트 상태·보이스 수·최악 합", () => {
    const { q } = open();
    const bar = q("[data-sound-bar]")!;
    expect(bar).not.toBeNull();
    expect(bar.style.position).toBe("sticky");
    for (const sel of ["[data-sound-master]", "[data-sound-stop]", "[data-sound-calc-all]", "[data-sound-state]", "[data-sound-voices]", '[data-lab-script="worst"]']) {
      expect(bar.querySelector(sel), sel).not.toBeNull();
    }
  });

  it("묶음: 침대 한 묶음 + 효과음 여섯 묶음, 행에 id 와 한글 이름", () => {
    const { qa, q } = open();
    expect(qa("[data-lab-group]").map((g) => g.getAttribute("data-lab-group"))).toEqual(["beds", ...LAB_GROUPS.map((g) => g.key)]);
    expect(q('[data-sound-id="kill.slash"]')!.parentElement!.textContent).toContain("kill.slash");
    expect(q('[data-sound-id="kill.slash"]')!.parentElement!.textContent).toContain(SOUND_NAMES["kill.slash"]);
  });

  it("침대: 누르면 재생, 같은 침대를 다시 누르면 정지, 다른 침대는 바꾼다", () => {
    const { rig, q } = open();
    q('[data-sound-id="bed.day"]')!.click();
    expect(rig.engine.currentBed()).toBe("bed.day");
    q('[data-sound-id="bed.day"]')!.click();
    expect(rig.engine.currentBed()).toBeNull();
    q('[data-sound-id="bed.day"]')!.click();
    q('[data-sound-id="bed.night"]')!.click();
    expect(rig.engine.currentBed()).toBe("bed.night");
    expect(rig.engine.log().filter((e) => e.id === "bed.night" && e.played)).toHaveLength(1);
  });

  it("효과음 ▶ 는 해당 id 를 엔진에 요청한다", () => {
    const { rig, q } = open();
    q('[data-sound-id="result.win"]')!.click();
    expect(rig.engine.log().some((e) => e.id === "result.win" && e.played)).toBe(true);
  });

  it("모두 멈춤은 침대와 보이스를 비운다", () => {
    const { rig, q } = open();
    q('[data-sound-id="bed.vote"]')!.click();
    q('[data-sound-id="game.start"]')!.click();
    q("[data-sound-stop]")!.click();
    expect(rig.engine.currentBed()).toBeNull();
    expect(rig.engine.voiceCount()).toBe(0);
  });

  it("마스터 슬라이더는 setMasterTrim 으로 master 이득에 램프를 건다", () => {
    const { rig, q } = open();
    q('[data-sound-id="ui.tap"]')!.click();
    const slider = q("[data-sound-master]") as HTMLInputElement;
    slider.value = "0.5";
    slider.dispatchEvent(new Event("input", { bubbles: true }));
    const comp = rig.fake.ctx().ofKind("compressor")[0]!;
    const master = rig.fake.ctx().ofKind("gain").find((g) => g.out.includes(comp)) as FakeGain;
    expect(master.gain.of("linear").at(-1)!.value).toBeCloseTo(MASTER_GAIN * 0.5, 9);
  });

  it("컨텍스트 상태와 보이스 수가 화면에 보인다", () => {
    const { rig, q } = open();
    expect(q("[data-sound-state]")!.textContent).toMatch(/none|없음/);
    q('[data-sound-id="game.start"]')!.click();
    expect(q("[data-sound-state]")!.textContent).toMatch(/running/);
    expect(rig.engine.voiceCount()).toBeGreaterThan(0);
  });

  it("판결 대본: 통과를 누르면 심장 박동과 처형 소리가 대본 시각에 난다", () => {
    const { rig, q } = open();
    q('[data-lab-script="verdict:pass"]')!.click();
    expect(rig.engine.currentBed()).toBe("bed.vote");
    rig.fake.clock.advance(6000);
    const ids = rig.engine.log().map((e) => e.id);
    expect(ids).toContain("verdict.heart");
    expect(ids).toContain("execution.gavel");
    expect(ids).not.toContain("verdict.reject");
  });

  it("판결 대본: 부결은 verdict.reject, 마지막 3인은 gavel+rise 즉시", () => {
    const a = open();
    a.q('[data-lab-script="verdict:reject"]')!.click();
    a.rig.fake.clock.advance(6000);
    expect(a.rig.engine.log().map((e) => e.id)).toContain("verdict.reject");
    const b = open();
    b.q('[data-lab-script="verdict:last"]')!.click();
    b.rig.fake.clock.advance(10);
    expect(b.rig.engine.log().map((e) => e.id)).toEqual(expect.arrayContaining(["execution.gavel", "execution.rise"]));
  });

  it("밤 30초: night.fall 과 night.cue 가 시드로 정해지고, 시드를 바꾸면 큐 시각이 달라질 수 있다", () => {
    const { rig, q } = open();
    const seedView = q("[data-lab-seed]")!;
    const first = seedView.textContent;
    q('[data-lab-script="night"]')!.click();
    expect(rig.engine.currentBed()).toBe("bed.night");
    rig.fake.clock.advance(30000);
    const ids = rig.engine.log().map((e) => e.id);
    expect(ids).toContain("night.fall");
    expect(ids.filter((i) => i === "night.cue").length).toBeGreaterThanOrEqual(2);
    q("[data-lab-seed-next]")!.click();
    expect(seedView.textContent).not.toBe(first);
  });

  it("아침: 희생자(내가 피해자)는 slash 가 있고, 체크를 풀면 없다. 평화·구출은 400ms", () => {
    const { rig, q } = open();
    q('[data-lab-script="morning:victim"]')!.click();
    expect(rig.engine.currentBed()).toBe("bed.dawn");
    rig.fake.clock.advance(1000);
    expect(rig.engine.log().map((e) => e.id)).toEqual(expect.arrayContaining(["morning.dawn", "kill.slash", "chalk.draw"]));
    rig.engine.clearLog();
    (q("[data-lab-mine]") as HTMLInputElement).click();
    rig.fake.clock.advance(5000);
    q('[data-lab-script="morning:victim"]')!.click();
    rig.fake.clock.advance(1000);
    expect(rig.engine.log().map((e) => e.id)).not.toContain("kill.slash");
    rig.engine.clearLog();
    rig.fake.clock.advance(5000);
    q('[data-lab-script="morning:saved"]')!.click();
    rig.fake.clock.advance(1000);
    expect(rig.engine.log().map((e) => e.id)).toContain("morning.saved");
  });

  it("유언 편지: 쓰기·인장·접힘", () => {
    const { rig, q } = open();
    q('[data-lab-script="will"]')!.click();
    rig.fake.clock.advance(6000);
    const ids = rig.engine.log().map((e) => e.id);
    expect(ids).toEqual(expect.arrayContaining(["will.quill", "will.seal", "will.fold"]));
  });

  it("결과·시상: 4명/8명 × 승/패 네 단추, 승은 result.win 패는 result.lose, 시상 패가 이어진다", () => {
    const { rig, q, qa } = open();
    expect(qa('[data-lab-script^="result:"]').map((b) => b.getAttribute("data-lab-script"))).toEqual(["result:4:win", "result:4:lose", "result:8:win", "result:8:lose"]);
    q('[data-lab-script="result:8:win"]')!.click();
    expect(rig.engine.currentBed()).toBe("bed.result");
    rig.fake.clock.advance(20000);
    const ids = rig.engine.log().map((e) => e.id);
    expect(ids.filter((i) => i === "role.flip")).toHaveLength(8);
    expect(ids).toContain("result.win");
    expect(ids).not.toContain("result.lose");
    expect(ids).toContain("award.plate");
    expect(ids).toContain("award.final");
  });

  it("최악 합: 밤 침대 + 효과음 6개를 함께 요청한다", () => {
    const { rig, q } = open();
    q('[data-lab-script="worst"]')!.click();
    expect(rig.engine.currentBed()).toBe("bed.night");
    const requested = rig.engine.log().filter((e) => !BED_IDS.includes(e.id as never));
    expect(new Set(requested.map((e) => e.id)).size).toBe(6);
    expect(rig.engine.activeNodes()).toBeGreaterThan(0);
  });

  it("[전부 계산]: 56개를 한 번에 하나씩 순차로 렌더하고 훅이 done 이 된다", async () => {
    let inflight = 0;
    let maxInflight = 0;
    let n = 0;
    const make: OfflineFactory = (channels, length, sr) => {
      const c = new FakeOffline(channels, length, sr, (d, rate) => {
        for (let i = 0; i < d.length; i += 1) d[i] = 0.25 * Math.sin((2 * Math.PI * 200 * i) / rate);
      });
      const orig = c.startRendering.bind(c);
      c.startRendering = async () => {
        inflight += 1;
        n += 1;
        maxInflight = Math.max(maxInflight, inflight);
        await Promise.resolve();
        const r = await orig();
        inflight -= 1;
        return r;
      };
      return c as unknown as ReturnType<OfflineFactory>;
    };
    const { q, handle } = open({ createOffline: make });
    expect(hookOf().done).toBe(false);
    q("[data-sound-calc-all]")!.click();
    await handle.idle();
    const hook = hookOf();
    expect(hook.done).toBe(true);
    expect(n).toBe(56);
    expect(maxInflight).toBe(1);
    expect(hook.results.map((r) => r.id)).toEqual([...SOUND_IDS]);
    for (const r of hook.results) {
      expect(r).toEqual(expect.objectContaining({ id: expect.any(String), peakDb: expect.any(Number), rmsDb: expect.any(Number), nan: expect.any(Number), lengthMs: expect.any(Number), ok: expect.any(Boolean) }));
      expect("declaredMs" in r).toBe(true);
    }
    // 화면 표에도 피크가 보인다
    expect(q('[data-sound-id="kill.slash"]')!.parentElement!.textContent).toMatch(/-12\.0/);
    // 다시 누르면 새로 56 개(이전 결과를 덮어쓴다)
    q("[data-sound-calc-all]")!.click();
    await handle.idle();
    expect(hookOf().results).toHaveLength(56);
  });
});
