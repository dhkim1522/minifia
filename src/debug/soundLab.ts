// 소리 시험 페이지(?sound-lab=1) 본체 — 순수 DOM, 지연 로드 (12-06, D-18, D-19, UI-SPEC E).
// perfProbe 의 동적 import 로만 불린다(진입 번들에 들어가지 않는다). 서버 호출 없음, 저장소 쓰기 없음.
// 오프라인 렌더는 엔진과 같은 믹스 그래프(buildMixGraph)·같은 보이스 합성기(buildVoice)로 OfflineAudioContext 에 만든다.
import { createEngine, type SoundEngine } from "../audio/engine";
import {
  BED_IDS,
  BUS_GAIN,
  MASTER_GAIN,
  RECIPES,
  SFX_IDS,
  SOUND_IDS,
  bedPlan,
  mulberry32,
  peakDbEstimate,
  recipeDurationMs,
  recipeNodeCount,
  renderPlan,
  type BedId,
  type PlanEvent,
  type SfxId,
  type SoundId,
} from "../audio/recipes";
import { awardScript, morningScript, nightScript, resultScript, verdictScript, willScript, type MorningOutcome, type Script } from "../audio/script";
import { buildMixGraph, buildVoice, noiseBufferFor } from "../audio/synth";
import { installSoundHook } from "../audio/testHook";
import { LAB_GROUPS, SOUND_LIMITS, SOUND_NAMES } from "./soundLabData";

// ───────────────────────── 오프라인 렌더 ─────────────────────────

/** 렌더 표본률(Hz). 모노 한 채널만 렌더해 메모리를 아낀다 */
export const RENDER_SAMPLE_RATE = 44100;
/** 효과음 렌더 길이 = 선언 길이 + 이 여유(ms) */
export const SFX_TAIL_PAD_MS = 500;
/** 침대 렌더 구간(ms) */
export const BED_RENDER_MS = 8000;
/** 길이·무음 판정 문턱(선형) = −60 dBFS */
export const SILENCE_LIN = 0.001;
const DB_FLOOR = -200;

export interface RenderResult {
  id: SoundId;
  peakDb: number;
  rmsDb: number;
  /** NaN·무한대 표본 수 */
  nan: number;
  /** −60 dBFS 를 넘는 마지막 표본의 끝 시각(ms) */
  lengthMs: number;
  /** 레시피가 선언한 길이(ms). 침대는 null */
  declaredMs: number | null;
}

export type OfflineFactory = (channels: number, length: number, sampleRate: number) => OfflineAudioContext;

const defaultFactory: OfflineFactory = (channels, length, sampleRate) => new OfflineAudioContext(channels, length, sampleRate);

const toDb = (lin: number): number => (lin > 0 ? Math.max(DB_FLOOR, 20 * Math.log10(lin)) : DB_FLOOR);

/** 표본에서 피크·RMS·길이·NaN 을 낸다. RMS 는 소리가 있는 구간(처음~마지막 −60dBFS 초과 표본)에서 잰다 */
export function analyzeSamples(data: ArrayLike<number>, sampleRate: number): { peakDb: number; rmsDb: number; nan: number; lengthMs: number } {
  let peak = 0;
  let nan = 0;
  let last = -1;
  for (let i = 0; i < data.length; i += 1) {
    const v = data[i]!;
    if (!Number.isFinite(v)) {
      nan += 1;
      continue;
    }
    const a = Math.abs(v);
    if (a > peak) peak = a;
    if (a > SILENCE_LIN) last = i;
  }
  let sum = 0;
  let n = 0;
  for (let i = 0; i <= last; i += 1) {
    const v = data[i]!;
    if (!Number.isFinite(v)) continue;
    sum += v * v;
    n += 1;
  }
  const rms = n > 0 ? Math.sqrt(sum / n) : 0;
  return { peakDb: toDb(peak), rmsDb: toDb(rms), nan, lengthMs: last < 0 ? 0 : ((last + 1) * 1000) / sampleRate };
}

/**
 * 이벤트 하나가 −60 dBFS 위로 들리는 마지막 시각(ms, 레시피 기준). synth.buildVoice 의 엔벨로프(어택 → 디케이 → 서스테인 → 게이트 뒤 선형 릴리스)를
 * 같은 구간으로 풀어 레벨이 문턱 아래로 내려가는 지점을 찾는다. bus 는 버스·master 이득(선형).
 */
function audibleEndMs(ev: PlanEvent, bus: number): number {
  const peak = ev.gain * bus;
  if (!(peak > SILENCE_LIN)) return 0;
  const [a, d, s, r] = ev.env;
  const tA = Math.min(Math.max(a, 1), ev.dur);
  const tD = Math.min(tA + d, ev.dur);
  const sustain = peak * s;
  if (sustain > SILENCE_LIN) return ev.t + ev.dur + r * (1 - SILENCE_LIN / sustain);
  // 서스테인이 문턱 아래: 디케이 도중에 문턱을 지난다(릴리스는 이미 들리지 않는 값에서 시작한다)
  if (tD > tA) return ev.t + tA + ((tD - tA) * (peak - SILENCE_LIN)) / (peak - sustain);
  return ev.t + tA;
}

/**
 * 효과음의 선언 길이(ms): 레시피가 선언한 레이어 엔벨로프에서 (버스·master 를 거친) 레벨이 −60 dBFS 아래로 내려가는 지점의 최댓값.
 * 레시피 선언의 at + dur + 릴리스 전체(recipeDurationMs)와 달리 들리지 않는 꼬리는 세지 않는다.
 */
export function declaredLengthMs(id: SfxId): number {
  const bus = BUS_GAIN[RECIPES[id].bus] * MASTER_GAIN;
  let end = 0;
  for (const ev of renderPlan(id)) end = Math.max(end, audibleEndMs(ev, bus));
  return Math.min(end, recipeDurationMs(id));
}

/** 소리 하나를 오프라인으로 렌더해 수치를 낸다. 렌더가 던지면 NaN 1 로 센다(던지지 않는다) */
export async function renderOffline(id: SoundId, factory: OfflineFactory = defaultFactory): Promise<RenderResult> {
  const isBed = (BED_IDS as readonly string[]).includes(id);
  const declaredMs = isBed ? null : declaredLengthMs(id as SfxId);
  const renderMs = isBed ? BED_RENDER_MS : recipeDurationMs(id as SfxId) + SFX_TAIL_PAD_MS;
  try {
    const length = Math.ceil((renderMs * RENDER_SAMPLE_RATE) / 1000);
    const ctx = factory(1, length, RENDER_SAMPLE_RATE);
    const graph = buildMixGraph(ctx);
    const events = isBed ? bedPlan(id as BedId, 0, BED_RENDER_MS) : renderPlan(id as SfxId);
    const bus = isBed ? "bgm" : RECIPES[id as SfxId].bus;
    buildVoice(ctx, events, graph.buses[bus], 0, { noise: noiseBufferFor(ctx) });
    const buf = await ctx.startRendering();
    const a = analyzeSamples(buf.getChannelData(0), buf.sampleRate);
    return { id, ...a, declaredMs };
  } catch {
    return { id, peakDb: DB_FLOOR, rmsDb: DB_FLOOR, nan: 1, lengthMs: 0, declaredMs };
  }
}

/** 합격 판정 — 문턱은 soundLabData.SOUND_LIMITS 한 곳 (T-12-22) */
export function soundOk(r: RenderResult): boolean {
  if (r.nan !== 0 || r.peakDb > SOUND_LIMITS.peakMaxDb || r.rmsDb < SOUND_LIMITS.rmsMinDb) return false;
  return r.declaredMs === null || Math.abs(r.lengthMs - r.declaredMs) <= SOUND_LIMITS.lengthTolMs;
}

// ───────────────────────── 화면 ─────────────────────────

export interface LabRow extends RenderResult {
  ok: boolean;
}

export interface LabHook {
  done: boolean;
  results: LabRow[];
}

declare global {
  interface Window {
    __mfSoundLab?: LabHook;
  }
}

export interface LabDeps {
  engine?: SoundEngine;
  createOffline?: OfflineFactory;
}

export interface LabHandle {
  dispose(): void;
  /** 진행 중인 계산이 모두 끝나기를 기다린다(시험용) */
  idle(): Promise<void>;
}

const TAP_MIN = 44;
const BG = "#15131a";
const FG = "#eeeaf2";
const MUTED = "#a9a3b5";
const BAD = "#ff8a80";
/** 최악 합 시험이 한꺼번에 요청하는 효과음 수 */
const WORST_SFX = 6;
/** 시상 시험의 칭호 수(마지막 패가 award.final) */
const AWARD_TOTAL = 3;
/** 유언 시험의 쓰기 길이(ms, LETTER_WRITE_MAX_MS 안) */
const WILL_WRITE_MS = 2000;
const POLL_MS = 250;

/** 노드 수가 많은 효과음 순(같으면 SFX_IDS 순)의 앞 여섯 — 최악 합 시험 */
export function worstSfx(): SfxId[] {
  return SFX_IDS.map((id, i) => ({ id, i, n: recipeNodeCount(id) }))
    .sort((a, b) => b.n - a.n || a.i - b.i)
    .slice(0, WORST_SFX)
    .map((x) => x.id);
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Record<string, string> = {}, text = "", css = ""): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  if (text !== "") node.textContent = text;
  if (css !== "") node.style.cssText = css;
  return node;
}

const fmtDb = (v: number): string => (v <= DB_FLOOR ? "-inf" : v.toFixed(1));

/** 누르는 단추: 최소 44x44 */
function button(label: string, attrs: Record<string, string>, onClick: () => void, extra = ""): HTMLButtonElement {
  const b = el("button", { type: "button", ...attrs }, label, `min-width:${TAP_MIN}px;min-height:${TAP_MIN}px;font:inherit;font-size:16px;padding:0 10px;${extra}`);
  b.addEventListener("click", onClick);
  return b;
}

/** 소리 시험 페이지를 root 에 세운다. 서버 호출·저장소 쓰기 없음(엔진 저장소도 끈다) */
export function mount(root: HTMLElement, _params: URLSearchParams, deps: LabDeps = {}): LabHandle {
  const engine = deps.engine ?? createEngine({ storage: null });
  const factory = deps.createOffline ?? defaultFactory;
  installSoundHook(engine, true);
  const hook: LabHook = { done: false, results: [] };
  window.__mfSoundLab = hook;
  const pending = new Set<Promise<void>>();
  const track = (p: Promise<void>): void => {
    pending.add(p);
    void p.finally(() => pending.delete(p));
  };

  const byId = new Map<SoundId, LabRow>();
  const stats = new Map<SoundId, HTMLElement>();
  const rows = new Map<SoundId, HTMLElement>();
  const bedBtns = new Map<BedId, HTMLElement>();

  const page = el("div", { "data-sound-lab": "1" }, "", `font:14px/1.4 var(--font-ui, system-ui, sans-serif);color:${FG};background:${BG};min-height:100vh;padding-bottom:48px;`);

  // 제스처 안에서 unlock 을 동기로 걸고, 아직 running 이 아니면 resume 이 끝난 뒤 한 번 낸다
  const press = (fn: () => void): void => {
    engine.unlock();
    if (engine.state() === "running") fn();
    else void engine.resume().then((ok) => ok && fn());
    refresh();
  };

  // ① 상단 고정 줄
  const bar = el("div", { "data-sound-bar": "1" }, "", `position:sticky;top:0;z-index:2;background:${BG};padding:8px 12px;border-bottom:1px solid #3a3544;display:flex;flex-wrap:wrap;align-items:center;gap:8px;`);
  const master = el("input", { type: "range", min: "0", max: "1", step: "0.01", value: "1", "data-sound-master": "1", "aria-label": "마스터" }, "", `min-height:${TAP_MIN}px;flex:1 1 120px;`);
  master.addEventListener("input", () => engine.setMasterTrim(parseFloat(master.value)));
  const stop = button("모두 멈춤", { "data-sound-stop": "1" }, () => {
    engine.stopAll();
    refresh();
  });
  const calcAllBtn = button("전부 계산", { "data-sound-calc-all": "1" }, () => track(calcAll()));
  const stateEl = el("span", { "data-sound-state": "1" });
  const voicesEl = el("span", { "data-sound-voices": "1" });
  const progressEl = el("span", { "data-sound-progress": "1" }, "", `color:${MUTED};`);
  const worstTop = button("최악 합 ▶", { "data-lab-script": "worst" }, () => runWorst());
  bar.append(master, stop, calcAllBtn, worstTop, stateEl, voicesEl, progressEl);
  page.append(bar);

  const refresh = (): void => {
    stateEl.textContent = engine.state();
    voicesEl.textContent = `보이스 ${engine.voiceCount()}`;
    const cur = engine.currentBed();
    for (const [id, b] of bedBtns) b.style.background = id === cur ? "#5b4a8a" : "";
  };
  const unsub = engine.subscribe(refresh);
  const poll = setInterval(refresh, POLL_MS);

  // 소리 한 줄: [▶] id · 한글 이름 · 수치 · [계산]
  const estimateText = (id: SoundId): string => {
    const isBed = (BED_IDS as readonly string[]).includes(id);
    return isBed ? `~${fmtDb(peakDbEstimate(id))} dB` : `~${fmtDb(peakDbEstimate(id))} dB · ${Math.round(declaredLengthMs(id as SfxId))}ms`;
  };
  const soundRow = (id: SoundId, onPlay: () => void): HTMLElement => {
    const row = el("div", {}, "", `display:flex;align-items:center;gap:8px;min-height:${TAP_MIN}px;padding:0 12px;`);
    const play = button("▶", { "data-sound-id": id }, onPlay);
    const label = el("div", {}, "", "flex:1 1 auto;min-width:0;line-height:1.3;");
    const name = el("div", {}, `${id} · ${SOUND_NAMES[id]}`, "overflow:hidden;text-overflow:ellipsis;white-space:nowrap;");
    const stat = el("div", { "data-sound-stat": id }, estimateText(id), `color:${MUTED};font-size:14px;white-space:nowrap;`);
    label.append(name, stat);
    const calc = button("계산", { "data-sound-calc": id }, () => track(calcOne(id)), "padding:0;white-space:nowrap;");
    row.append(play, label, calc);
    stats.set(id, stat);
    rows.set(id, row);
    if ((BED_IDS as readonly string[]).includes(id)) bedBtns.set(id as BedId, play);
    return row;
  };
  const group = (key: string, title: string): HTMLElement => {
    const g = el("section", { "data-lab-group": key });
    g.append(el("h2", {}, title, `font-size:16px;margin:16px 12px 4px;color:${MUTED};`));
    return g;
  };

  // ② 침대
  const beds = group("beds", "② 침대 — 누르면 크로스페이드, 같은 침대를 다시 누르면 정지");
  for (const id of BED_IDS) {
    beds.append(
      soundRow(id, () => {
        engine.unlock();
        engine.setBed(engine.currentBed() === id ? null : id);
        refresh();
      }),
    );
  }
  page.append(beds);

  // ③ 효과음
  for (const g of LAB_GROUPS) {
    const sec = group(g.key, `③ ${g.title}`);
    for (const id of g.ids) sec.append(soundRow(id, () => press(() => engine.play(id))));
    page.append(sec);
  }

  // ④ 대본 재생
  const scripts = group("scripts", "④ 대본 재생");
  const line = (): HTMLElement => el("div", {}, "", `display:flex;flex-wrap:wrap;align-items:center;gap:8px;padding:4px 12px;`);
  const play = (key: string, script: Script, bed?: BedId): void =>
    press(() => {
      if (bed !== undefined) engine.setBed(bed);
      engine.runScript(`lab:${key}`, script.items, script.duck);
    });
  const scriptBtn = (label: string, id: string, run: () => void): HTMLButtonElement => button(label, { "data-lab-script": id }, run);

  const verdictLine = line();
  verdictLine.append(
    el("span", {}, "판결 순간 5.6초", "flex:1 0 100%;"),
    scriptBtn("통과", "verdict:pass", () => play("verdict", verdictScript({ passed: true, last: false, hasBallots: true }), "bed.vote")),
    scriptBtn("부결", "verdict:reject", () => play("verdict", verdictScript({ passed: false, last: false, hasBallots: true }), "bed.vote")),
    scriptBtn("마지막 3인", "verdict:last", () => play("verdict", verdictScript({ passed: true, last: true, hasBallots: false }), "bed.vote")),
  );
  let seed = 1;
  const seedEl = el("span", { "data-lab-seed": "1" }, `시드 ${seed}`, `color:${MUTED};`);
  const nightLine = line();
  nightLine.append(
    el("span", {}, "밤 30초 (큐 난수)", "flex:1 0 100%;"),
    scriptBtn("밤 재생", "night", () => play("night", nightScript(mulberry32(seed)), "bed.night")),
    button("시드 바꾸기", { "data-lab-seed-next": "1" }, () => {
      seed += 1;
      seedEl.textContent = `시드 ${seed}`;
    }),
    seedEl,
  );
  let mine = true;
  const mineBox = el("input", { type: "checkbox", "data-lab-mine": "1", checked: "" });
  mineBox.addEventListener("change", () => {
    mine = mineBox.checked;
  });
  const mineLabel = el("label", {}, "", `display:inline-flex;align-items:center;gap:6px;min-height:${TAP_MIN}px;`);
  mineLabel.append(mineBox, el("span", {}, "내가 암살 피해자"));
  const morning = (outcome: MorningOutcome): void => {
    const m = morningScript({ outcome, mine });
    play("morning", m, m.bed);
  };
  const morningLine = line();
  morningLine.append(
    el("span", {}, "아침", "flex:1 0 100%;"),
    scriptBtn("희생자", "morning:victim", () => morning("victim")),
    scriptBtn("평화", "morning:calm", () => morning("calm")),
    scriptBtn("구출", "morning:saved", () => morning("saved")),
    mineLabel,
  );
  const willLine = line();
  willLine.append(el("span", {}, "유언 편지", "flex:1 0 100%;"), scriptBtn("편지 재생", "will", () => play("will", willScript({ writeMs: WILL_WRITE_MS }))));
  const resultLine = line();
  resultLine.append(el("span", {}, "결과·시상", "flex:1 0 100%;"));
  for (const n of [4, 8]) {
    for (const win of [true, false]) {
      resultLine.append(
        scriptBtn(`${n}명 ${win ? "승" : "패"}`, `result:${n}:${win ? "win" : "lose"}`, () => {
          const base = resultScript({ n, win });
          const items = [...base.items];
          for (let k = 0; k < AWARD_TOTAL; k += 1) items.push(...awardScript({ k, total: AWARD_TOTAL }).items);
          items.sort((a, b) => a.at - b.at);
          play("result", { items, duck: base.duck }, "bed.result");
        }),
      );
    }
  }
  scripts.append(verdictLine, nightLine, morningLine, willLine, resultLine);
  page.append(scripts);

  // ⑤ 최악 합
  const worst = group("worst", "⑤ 최악 합 — 밤 침대 + 효과음 6개 동시");
  const worstLine = line();
  worstLine.append(scriptBtn("최악 합 ▶", "worst", () => runWorst()), el("span", {}, worstSfx().join(" · "), `color:${MUTED};flex:1 1 200px;`));
  worst.append(worstLine);
  page.append(worst);

  function runWorst(): void {
    press(() => {
      engine.setBed("bed.night");
      for (const id of worstSfx()) engine.play(id);
    });
  }

  // 오프라인 계산: 한 번에 하나씩 순차로 돌려 메모리를 아낀다 (T-12-20)
  const record = (r: RenderResult): void => {
    const row: LabRow = { ...r, ok: soundOk(r) };
    byId.set(r.id, row);
    hook.results = SOUND_IDS.filter((id) => byId.has(id)).map((id) => byId.get(id)!);
    const stat = stats.get(r.id);
    if (stat !== undefined) {
      stat.textContent = `${fmtDb(r.peakDb)} dB · ${Math.round(r.lengthMs)}ms${row.ok ? "" : " ✗"}`;
      stat.style.color = row.ok ? MUTED : BAD;
    }
    rows.get(r.id)?.setAttribute("data-sound-ok", row.ok ? "1" : "0");
  };
  async function calcOne(id: SoundId): Promise<void> {
    record(await renderOffline(id, factory));
  }
  let running = false;
  async function calcAll(): Promise<void> {
    if (running) return;
    running = true;
    hook.done = false;
    hook.results = [];
    byId.clear();
    try {
      let n = 0;
      for (const id of SOUND_IDS) {
        record(await renderOffline(id, factory));
        n += 1;
        progressEl.textContent = `${n}/${SOUND_IDS.length}`;
      }
      const bad = hook.results.filter((r) => !r.ok).length;
      progressEl.textContent = bad === 0 ? `${SOUND_IDS.length}개 합격` : `실패 ${bad}개`;
      hook.done = true;
    } finally {
      running = false;
    }
  }

  // 앱 틀(#root, 최소 높이 100dvh)이 비어 있어도 자리를 차지하니 시험 페이지가 떠 있는 동안 숨긴다
  const appRoot = typeof document.getElementById === "function" ? document.getElementById("root") : null;
  const appRootDisplay = appRoot?.style.display ?? "";
  if (appRoot !== null) appRoot.style.display = "none";
  root.append(page);
  refresh();

  return {
    dispose(): void {
      clearInterval(poll);
      unsub();
      engine.stopAll();
      page.remove();
      if (appRoot !== null) appRoot.style.display = appRootDisplay;
    },
    async idle(): Promise<void> {
      while (pending.size > 0) await Promise.all([...pending]);
    },
  };
}
