// 소리 시험 페이지(?sound-lab=1) 본체 — 순수 DOM, 지연 로드 (12-06, D-18, D-19, UI-SPEC E).
// perfProbe 의 동적 import 로만 불린다(진입 번들에 들어가지 않는다). 서버 호출 없음, 저장소 쓰기 없음.
// 오프라인 렌더는 엔진과 같은 믹스 그래프(buildMixGraph)·같은 보이스 합성기(buildVoice)로 OfflineAudioContext 에 만든다.
import { createEngine, type SoundEngine } from "../audio/engine";
import {
  BEDS,
  BED_IDS,
  BUS_GAIN,
  MASTER_GAIN,
  RECIPES,
  SFX_IDS,
  bedPlan,
  peakDbEstimate,
  recipeDurationMs,
  renderPlan,
  type BedId,
  type SfxId,
  type SoundId,
} from "../audio/recipes";
import { buildMixGraph, buildVoice, noiseBufferFor } from "../audio/synth";
import { installSoundHook } from "../audio/testHook";
import { SOUND_LIMITS } from "./soundLabData";

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
 * 효과음의 선언 길이(ms): 레이어마다 (버스·master 를 거친) 서스테인 이득에서 릴리스(선형)가 −60 dBFS 아래로 내려가는 지점,
 * 그 최댓값. 레시피 선언의 at + dur + 릴리스 전체(recipeDurationMs)와 달리 들리지 않는 꼬리는 세지 않는다.
 */
export function declaredLengthMs(id: SfxId): number {
  const bus = BUS_GAIN[RECIPES[id].bus] * MASTER_GAIN;
  let end = 0;
  for (const ev of renderPlan(id)) {
    const peak = ev.gain * bus;
    if (peak <= SILENCE_LIN) continue;
    const sustain = peak * ev.env[2];
    const tail = sustain > SILENCE_LIN ? ev.env[3] * (1 - SILENCE_LIN / sustain) : 0;
    end = Math.max(end, ev.t + ev.dur + tail);
  }
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

function el<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Record<string, string> = {}, text = ""): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  if (text !== "") node.textContent = text;
  return node;
}

const fmtDb = (v: number): string => (v <= DB_FLOOR ? "-inf" : v.toFixed(1));

/** 트레이서 범위: 게이트 → 지연 로드 → ▶ 하나(ui.toggle)와 [계산] 하나 */
export function mount(root: HTMLElement, _params: URLSearchParams, deps: LabDeps = {}): LabHandle {
  const engine = deps.engine ?? createEngine({ storage: null });
  const factory = deps.createOffline ?? defaultFactory;
  installSoundHook(engine, true);
  const hook: LabHook = { done: false, results: [] };
  window.__mfSoundLab = hook;
  const pending = new Set<Promise<void>>();

  const page = el("div", { "data-sound-lab": "1" });
  page.style.cssText = "font:14px/1.4 var(--font-ui, system-ui, sans-serif);padding:16px;max-width:480px;margin:0 auto;";
  const row = el("div");
  row.style.cssText = `display:flex;align-items:center;gap:8px;min-height:${TAP_MIN}px;`;
  const play = el("button", { "data-sound-id": "ui.toggle", type: "button" }, "▶");
  play.style.cssText = `min-width:${TAP_MIN}px;min-height:${TAP_MIN}px;font-size:16px;`;
  const label = el("span", {}, "ui.toggle");
  label.style.cssText = "flex:1";
  const stat = el("span", { "data-sound-stat": "ui.toggle" }, `추정 ${fmtDb(peakDbEstimate("ui.toggle"))}`);
  const calc = el("button", { "data-sound-calc": "ui.toggle", type: "button" }, "계산");
  calc.style.cssText = `min-width:${TAP_MIN}px;min-height:${TAP_MIN}px;`;
  row.append(play, label, stat, calc);
  page.append(row);
  root.append(page);

  // 제스처 안에서 unlock 을 동기로 걸고, 아직 running 이 아니면 resume 이 끝난 뒤 한 번 낸다
  const press = (fn: () => void): void => {
    engine.unlock();
    if (engine.state() === "running") fn();
    else void engine.resume().then((ok) => ok && fn());
  };
  play.addEventListener("click", () => press(() => engine.play("ui.toggle")));
  calc.addEventListener("click", () => {
    const p = renderOffline("ui.toggle", factory).then((r) => {
      hook.results = [{ ...r, ok: soundOk(r) }];
      stat.textContent = `${fmtDb(r.peakDb)} dB / ${Math.round(r.lengthMs)}ms`;
    });
    pending.add(p);
    void p.finally(() => pending.delete(p));
  });

  return {
    dispose(): void {
      engine.stopAll();
      page.remove();
    },
    async idle(): Promise<void> {
      await Promise.all([...pending]);
    },
  };
}

// 사용하지 않는 import 경고 방지용 참조(전체 화면은 다음 작업에서 채운다)
void BEDS;
void SFX_IDS;
