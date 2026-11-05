// 12-05: 소리 엔진 — AudioContext 하나, 버스, 보이스 풀. 소리 부수효과는 여기만 닿는다 (D-2, D-7, D-8, D-16, D-22).
// 컨텍스트·시계·타이머·저장소·문서·내비게이터는 모두 deps 로 받는다(시험은 가짜를 넘긴다). 서버·네트워크 API 는 쓰지 않는다.
// 엔진은 DOM 이벤트를 듣지 않는다: 제스처 연결과 가시성 연결은 화면(useSound, 12-07)이 하고 엔진은 메서드만 둔다.
import {
  BUS_GAIN,
  COMPRESSOR,
  MASTER_GAIN,
  RECIPES,
  renderPlan,
  type Bus,
  type BedId,
  type PlanEvent,
  type SfxId,
  type SoundId,
} from "./recipes";
import { buildVoice, countNodes, noiseBufferFor, type Voice } from "./synth";

export type EngineState = "none" | "locked" | "running" | "suspended";

/** 요청 한 줄. 재생 요청이 들어오는 순간 기록하고 실제로 안 났으면 played 가 거짓이다 */
export interface LogEntry {
  id: SoundId;
  at: number;
  gain: number;
  played: boolean;
}

export interface PlayOpts {
  /** ui.toggle 의 on|off 같은 변형 */
  variant?: string;
  /** 음높이 이동(cents) */
  cents?: number;
  /** 레시피 위에 더하는 dB */
  gainDb?: number;
}

export interface EngineSnapshot {
  state: EngineState;
  on: boolean;
  bed: BedId | null;
  supported: boolean;
}

export interface EngineDeps {
  createContext?: (opts: { latencyHint: "balanced" }) => AudioContext | null;
  now?: () => number;
  setTimer?: (fn: () => void, ms: number) => unknown;
  clearTimer?: (handle: unknown) => void;
  storage?: Pick<Storage, "getItem" | "setItem"> | null;
  doc?: { visibilityState: string } | null;
  nav?: { audioSession?: { type: string } } | null;
}

export interface SoundEngine {
  unlock(): void;
  supported(): boolean;
  state(): EngineState;
  isOn(): boolean;
  setOn(on: boolean): void;
  play(id: SfxId, opts?: PlayOpts): void;
  log(): LogEntry[];
  clearLog(): void;
  voiceCount(): number;
  currentBed(): BedId | null;
  subscribe(cb: () => void): () => void;
  snapshot(): EngineSnapshot;
}

interface ActiveVoice {
  id: SfxId;
  prio: number;
  nodes: number;
  order: number;
  voice: Voice;
  timer: unknown;
}

const LOG_MAX = 300;
const dbToLin = (db: number): number => 10 ** (db / 20);

type CtxCtor = new (opts?: AudioContextOptions) => AudioContext;

function defaultCreateContext(opts: { latencyHint: "balanced" }): AudioContext | null {
  const g = globalThis as unknown as { AudioContext?: CtxCtor; webkitAudioContext?: CtxCtor };
  const C = g.AudioContext ?? g.webkitAudioContext;
  return C === undefined ? null : new C(opts);
}

function hasAudioContext(): boolean {
  const g = globalThis as unknown as { AudioContext?: unknown; webkitAudioContext?: unknown };
  return g.AudioContext !== undefined || g.webkitAudioContext !== undefined;
}

interface Graph {
  master: GainNode;
  buses: Record<Bus, GainNode>;
}

export function createEngine(deps: EngineDeps = {}): SoundEngine {
  const createContext = deps.createContext ?? defaultCreateContext;
  const now = deps.now ?? ((): number => Date.now());
  const setTimer = deps.setTimer ?? ((fn: () => void, ms: number): unknown => setTimeout(fn, ms));
  const clearTimer = deps.clearTimer ?? ((h: unknown): void => clearTimeout(h as ReturnType<typeof setTimeout>));
  const nav = deps.nav === undefined ? (typeof navigator === "undefined" ? null : (navigator as unknown as NonNullable<EngineDeps["nav"]>)) : deps.nav;

  let ctx: AudioContext | null = null;
  let graph: Graph | null = null;
  let failed = false;
  let forcedLocked = false;
  let on = true;
  let bed: BedId | null = null;
  let order = 0;
  const voices: ActiveVoice[] = [];
  const entries: LogEntry[] = [];
  const subs = new Set<() => void>();

  const computeState = (): EngineState => {
    if (ctx === null || ctx.state === "closed") return "none";
    if (forcedLocked) return "locked";
    return ctx.state === "running" ? "running" : "locked";
  };
  const supportedNow = (): boolean => !failed && (deps.createContext !== undefined || hasAudioContext());

  let snap: EngineSnapshot = { state: "none", on, bed, supported: supportedNow() };
  const notify = (): void => {
    const next: EngineSnapshot = { state: computeState(), on, bed, supported: supportedNow() };
    if (next.state === snap.state && next.on === snap.on && next.bed === snap.bed && next.supported === snap.supported) return;
    snap = next;
    for (const cb of [...subs]) cb();
  };

  const onCtxState = (): void => {
    if (ctx === null) return;
    if (ctx.state === "closed") {
      for (const v of [...voices]) dropVoice(v);
      ctx = null;
      graph = null;
    } else if (ctx.state === "running") {
      forcedLocked = false;
    }
    notify();
  };

  const dropVoice = (v: ActiveVoice): void => {
    clearTimer(v.timer);
    const i = voices.indexOf(v);
    if (i >= 0) voices.splice(i, 1);
  };

  const buildGraph = (c: AudioContext): Graph => {
    const comp = c.createDynamicsCompressor();
    comp.threshold.value = COMPRESSOR.threshold;
    comp.ratio.value = COMPRESSOR.ratio;
    comp.attack.value = COMPRESSOR.attack;
    comp.release.value = COMPRESSOR.release;
    comp.connect(c.destination);
    const master = c.createGain();
    master.gain.value = MASTER_GAIN;
    master.connect(comp);
    const mk = (bus: Bus): GainNode => {
      const g = c.createGain();
      g.gain.value = BUS_GAIN[bus];
      g.connect(master);
      return g;
    };
    return { master, buses: { bgm: mk("bgm"), sfx: mk("sfx"), ui: mk("ui") } };
  };

  const pushLog = (entry: LogEntry): void => {
    entries.push(entry);
    if (entries.length > LOG_MAX) entries.splice(0, entries.length - LOG_MAX);
  };

  const requestResume = (c: AudioContext): void => {
    try {
      const p = c.resume();
      void Promise.resolve(p).then(
        () => {
          if (ctx === c) {
            if (c.state === "running") forcedLocked = false;
            else forcedLocked = true;
            notify();
          }
        },
        () => {
          if (ctx === c) {
            forcedLocked = true;
            notify();
          }
        },
      );
    } catch {
      forcedLocked = true;
    }
  };

  const unlock = (): void => {
    if (failed) return;
    if (ctx !== null && ctx.state === "closed") {
      ctx = null;
      graph = null;
    }
    if (ctx === null) {
      try {
        // 무음 스위치를 존중하는 ambient 세션(다른 앱 음악과 섞인다). 지원하지 않으면 아무 일도 없다.
        if (nav?.audioSession !== undefined) nav.audioSession.type = "ambient";
      } catch {
        // 세션 설정 실패는 보이지 않는다.
      }
      let made: AudioContext | null = null;
      try {
        made = createContext({ latencyHint: "balanced" });
      } catch {
        made = null;
      }
      if (made === null) {
        failed = true;
        notify();
        return;
      }
      ctx = made;
      try {
        graph = buildGraph(made);
        noiseBufferFor(made);
        made.addEventListener("statechange", onCtxState);
      } catch {
        failed = true;
        ctx = null;
        graph = null;
        notify();
        return;
      }
    }
    const c = ctx;
    // 제스처 안에서 resume 과 무음 한 프레임을 건다(iOS 가 이 둘을 한 번에 인정한다)
    requestResume(c);
    try {
      const silent = c.createBuffer(1, 1, c.sampleRate || 22050);
      const s = c.createBufferSource();
      s.buffer = silent;
      s.connect(c.destination);
      s.start(0);
    } catch {
      // 무음 프레임 실패는 보이지 않는다.
    }
    notify();
  };

  const play = (id: SfxId, opts: PlayOpts = {}): void => {
    const entry: LogEntry = { id, at: now(), gain: dbToLin(opts.gainDb ?? 0), played: false };
    pushLog(entry);
    if (ctx === null || graph === null || !on || computeState() !== "running") return;
    const recipe = RECIPES[id];
    let events: PlanEvent[];
    try {
      events = renderPlan(id, { variant: opts.variant, cents: opts.cents });
    } catch {
      return;
    }
    if (opts.gainDb !== undefined && opts.gainDb !== 0) {
      const k = dbToLin(opts.gainDb);
      events = events.map((e) => ({ ...e, gain: e.gain * k }));
    }
    const c = ctx;
    let voice: Voice;
    try {
      voice = buildVoice(c, events, graph.buses[recipe.bus], c.currentTime, { noise: noiseBufferFor(c) });
    } catch {
      return;
    }
    const av: ActiveVoice = { id, prio: recipe.prio, nodes: countNodes(events), order: (order += 1), voice, timer: null };
    av.timer = setTimer(() => dropVoice(av), Math.max(0, (voice.endAt - c.currentTime) * 1000) + 20);
    voices.push(av);
    entry.played = true;
  };

  return {
    unlock,
    supported: supportedNow,
    state: computeState,
    isOn: () => on,
    setOn(next: boolean): void {
      on = next;
      notify();
    },
    play,
    log: () => entries.map((e) => ({ ...e })),
    clearLog: () => {
      entries.length = 0;
    },
    voiceCount: () => voices.length,
    currentBed: () => bed,
    subscribe(cb: () => void): () => void {
      subs.add(cb);
      return () => {
        subs.delete(cb);
      };
    },
    snapshot: () => snap,
  };
}
