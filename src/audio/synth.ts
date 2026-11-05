// 12-05: 합성기 — renderPlan·bedPlan 의 평면 이벤트를 Web Audio 노드 그래프로 바꾼다 (D-16, D-18).
// 실시간 엔진(engine.ts)과 오프라인 렌더(12-06)가 함께 쓴다. BaseAudioContext 를 인자로 받고, 컨텍스트의 시계·전역을 읽지 않는다.
// 모든 시각은 인자(startAt, 초)다. 이벤트의 t 는 ms 이고 startAt 기준이다(침대는 침대 시작 시각을 startAt 으로 준다).
import { BUS_GAIN, COMPRESSOR, MASTER_GAIN, mulberry32, type Bus, type PlanEvent } from "./recipes";

/** 모든 잡음 소스가 공유하는 버퍼 길이(초) — 시작할 때 한 번만 만든다 */
export const NOISE_SECONDS = 2;
const NOISE_SEED = 0x6d6e6669;
/** 소스를 끝 시각보다 조금 더 늦게 멈춘다(릴리스 꼬리 보호) */
const STOP_SLACK_S = 0.05;
/** 필터 LFO 를 자동화 점으로 흉내 낼 때의 최대 점 수 */
const FILTER_SWEEP_MAX_POINTS = 24;

export interface Voice {
  /** 만든 노드 수(소스 + 필터 + LFO). recipeNodeCount 와 같은 방식으로 센다 */
  nodes: number;
  /** 마지막 릴리스가 끝나는 시각(초) */
  endAt: number;
  /** 이 보이스의 출력 게인 — 호출한 쪽이 크로스페이드·끊기에 쓴다 */
  output: GainNode;
  /** atSec 에 fadeSec 동안 줄여 끝낸다. 예외를 던지지 않는다 */
  stop(atSec: number, fadeSec: number): void;
}

/** 믹스 그래프: 버스 셋 → master → 컴프레서 → destination */
export interface MixGraph {
  master: GainNode;
  buses: Record<Bus, GainNode>;
  compressor: DynamicsCompressorNode;
}

/**
 * 믹스 그래프를 만든다(UI-SPEC D). 실시간 엔진(engine.ts)과 시험 페이지의 오프라인 렌더(12-06)가 같은 함수를 써
 * 오프라인 피크가 실제 소리의 피크와 같은 그래프에서 나오게 한다. master 이득은 trim 으로 곱해 시작할 수 있다(시험 슬라이더).
 */
export function buildMixGraph(ctx: BaseAudioContext, trim = 1): MixGraph {
  const compressor = ctx.createDynamicsCompressor();
  compressor.threshold.value = COMPRESSOR.threshold;
  compressor.ratio.value = COMPRESSOR.ratio;
  compressor.attack.value = COMPRESSOR.attack;
  compressor.release.value = COMPRESSOR.release;
  compressor.connect(ctx.destination);
  const master = ctx.createGain();
  master.gain.value = MASTER_GAIN * trim;
  master.connect(compressor);
  const mk = (bus: Bus): GainNode => {
    const g = ctx.createGain();
    g.gain.value = BUS_GAIN[bus];
    g.connect(master);
    return g;
  };
  return { master, compressor, buses: { bgm: mk("bgm"), sfx: mk("sfx"), ui: mk("ui") } };
}

const noiseCache = new WeakMap<object, AudioBuffer>();

/** 시드 고정 2초 흰 잡음 버퍼. 같은 컨텍스트에는 하나만 만든다 */
export function noiseBufferFor(ctx: BaseAudioContext): AudioBuffer {
  const hit = noiseCache.get(ctx);
  if (hit !== undefined) return hit;
  const sr = ctx.sampleRate;
  const buf = ctx.createBuffer(1, Math.round(sr * NOISE_SECONDS), sr);
  const data = buf.getChannelData(0);
  const rng = mulberry32(NOISE_SEED);
  for (let i = 0; i < data.length; i += 1) data[i] = rng() * 2 - 1;
  noiseCache.set(ctx, buf);
  return buf;
}

/** 같은 시각·길이·모양의 필터는 한 노드를 나눠 쓴다(침대 패드 코드의 음들) */
function filterKey(ev: PlanEvent): string | null {
  return ev.filter === undefined ? null : `${ev.t}|${ev.dur}|${JSON.stringify(ev.filter)}`;
}

/** 이벤트 묶음이 만들 노드 수(소스 + 나눠 쓴 필터 + 음높이 LFO). 노드 예산 계산에 쓴다 */
export function countNodes(events: readonly PlanEvent[]): number {
  const filters = new Set<string>();
  let n = 0;
  for (const ev of events) {
    n += 1;
    const key = filterKey(ev);
    if (key !== null) filters.add(key);
    if (ev.lfoHz !== undefined && ev.lfoCents !== undefined && ev.kind === "osc") n += 1;
  }
  return n + filters.size;
}

function makeFilter(ctx: BaseAudioContext, ev: PlanEvent, t0: number, tGate: number): BiquadFilterNode {
  const f = ctx.createBiquadFilter();
  const spec = ev.filter!;
  f.type = spec.type;
  f.Q.value = spec.q;
  const [lo, hi] = spec.f;
  if (spec.lfoHz === undefined) {
    f.frequency.setValueAtTime(lo, t0);
    if (hi !== lo) f.frequency.exponentialRampToValueAtTime(hi, tGate);
    return f;
  }
  // LFO 가 [lo, hi] 를 오가는 것을 반 주기마다 찍은 점으로 흉내 낸다(노드를 더 만들지 않는다)
  f.frequency.setValueAtTime(lo, t0);
  const half = 1 / (2 * Math.max(spec.lfoHz, 0.001));
  const points = Math.min(FILTER_SWEEP_MAX_POINTS, Math.max(1, Math.ceil((tGate - t0) / half)));
  for (let i = 1; i <= points; i += 1) {
    const at = Math.min(tGate, t0 + i * half);
    f.frequency.exponentialRampToValueAtTime(i % 2 === 1 ? hi : lo, at);
  }
  return f;
}

/**
 * 이벤트 묶음을 노드로 만들어 destination 에 잇는다. 소스는 모두 start/stop 이 예약된다.
 * noise 버퍼를 안 주면 컨텍스트마다 하나씩 만들어 쓴다.
 */
export function buildVoice(
  ctx: BaseAudioContext,
  events: readonly PlanEvent[],
  destination: AudioNode,
  startAt: number,
  opts: { noise?: AudioBuffer } = {},
): Voice {
  const out = ctx.createGain();
  out.gain.value = 1;
  out.connect(destination);
  const sources: AudioScheduledSourceNode[] = [];
  const filters = new Map<string, BiquadFilterNode>();
  let nodes = 0;
  let endAt = startAt;

  for (const ev of events) {
    const t0 = startAt + ev.t / 1000;
    const tGate = t0 + ev.dur / 1000;
    const tEnd = tGate + ev.env[3] / 1000;
    endAt = Math.max(endAt, tEnd);
    const tStop = tEnd + STOP_SLACK_S;

    // 엔벨로프: 어택 → 디케이 → 서스테인 → 게이트 뒤 릴리스. 시각은 게이트 안으로 눌러 둔다.
    const env = ctx.createGain();
    const peak = ev.gain;
    const sustain = peak * ev.env[2];
    const tA = Math.min(t0 + Math.max(ev.env[0], 1) / 1000, tGate);
    const tD = Math.min(tA + ev.env[1] / 1000, tGate);
    env.gain.setValueAtTime(0, t0);
    env.gain.linearRampToValueAtTime(peak, tA);
    if (tD > tA) env.gain.linearRampToValueAtTime(sustain, tD);
    if (tD < tGate) env.gain.setValueAtTime(sustain, tGate);
    env.gain.linearRampToValueAtTime(0, tEnd);

    let src: AudioScheduledSourceNode;
    if (ev.kind === "noise") {
      const b = ctx.createBufferSource();
      b.buffer = opts.noise ?? noiseBufferFor(ctx);
      b.loop = true;
      b.start(t0, (((ev.seed ?? 0) % 1000) / 1000) * NOISE_SECONDS);
      src = b;
    } else {
      const o = ctx.createOscillator();
      o.type = ev.wave as OscillatorType;
      o.frequency.setValueAtTime(ev.f0, t0);
      if (ev.f1 !== ev.f0) o.frequency.exponentialRampToValueAtTime(ev.f1, tGate);
      o.detune.value = ev.detune;
      if (ev.lfoHz !== undefined && ev.lfoCents !== undefined) {
        const lfo = ctx.createOscillator();
        lfo.frequency.value = ev.lfoHz;
        const depth = ctx.createGain();
        depth.gain.value = ev.lfoCents;
        lfo.connect(depth);
        depth.connect(o.detune);
        lfo.start(t0);
        lfo.stop(tStop);
        sources.push(lfo);
        nodes += 1;
      }
      o.start(t0);
      src = o;
    }
    src.stop(tStop);
    sources.push(src);
    nodes += 1;

    const key = filterKey(ev);
    if (key === null) {
      src.connect(env);
      env.connect(out);
    } else {
      let f = filters.get(key);
      if (f === undefined) {
        f = makeFilter(ctx, ev, t0, tGate);
        f.connect(out);
        filters.set(key, f);
        nodes += 1;
      }
      src.connect(env);
      env.connect(f);
    }
  }

  return {
    nodes,
    endAt,
    output: out,
    stop(atSec: number, fadeSec: number): void {
      try {
        out.gain.cancelScheduledValues(atSec);
        out.gain.setValueAtTime(1, atSec);
        out.gain.linearRampToValueAtTime(0, atSec + fadeSec);
        for (const s of sources) s.stop(atSec + fadeSec + 0.01);
      } catch {
        // 이미 끝난 소스의 stop 실패는 보이지 않는다.
      }
    },
  };
}
