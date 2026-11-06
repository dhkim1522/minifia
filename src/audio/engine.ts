// 12-05: 소리 엔진 — AudioContext 하나, 버스, 보이스 풀. 소리 부수효과는 여기만 닿는다 (D-2, D-7, D-8, D-16, D-22).
// 컨텍스트·시계·타이머·저장소·문서·내비게이터는 모두 deps 로 받는다(시험은 가짜를 넘긴다). 서버·네트워크 API 는 쓰지 않는다.
// 엔진은 DOM 이벤트를 듣지 않는다: 제스처 연결과 가시성 연결은 화면(useSound, 12-07)이 하고 엔진은 메서드만 둔다.
import { loadSoundPref, saveSoundPref } from "./prefs";
import {
  BEDS,
  BUS_GAIN,
  MASTER_GAIN,
  NODE_BUDGET,
  RECIPES,
  SFX_VOICE_MAX,
  bedNodeCount,
  bedPlan,
  renderPlan,
  type BedId,
  type PlanEvent,
  type SfxId,
  type SoundId,
} from "./recipes";
import type { DuckSpan, ScriptItem } from "./script";
import { buildMixGraph, buildVoice, countNodes, noiseBufferFor, type MixGraph, type Voice } from "./synth";

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
  /** 침대 버스를 db 만큼 내렸다가 holdMs 뒤 releaseMs(기본 250)에 걸쳐 복귀한다 */
  duckBed(db: number, holdMs: number, releaseMs?: number): void;
  /** 침대를 바꾼다(같은 침대면 아무 일 없음, null 이면 페이드아웃 뒤 멈춤) */
  setBed(id: BedId | null): void;
  /** 대본 항목을 at ms 뒤 play 로 예약한다. 같은 key 는 이전 것을 취소한다. duck 이 있으면 구간 덕킹도 예약한다 */
  runScript(key: string, items: readonly ScriptItem[], duck?: DuckSpan | null): void;
  cancelScript(key: string): void;
  /** 예약된 대본·보이스·침대를 모두 멈추고 침대를 비운다 */
  stopAll(): void;
  /** 제스처 밖에서 resume 만 시도한다(컨텍스트가 있을 때). 성공 여부를 돌려준다 */
  resume(): Promise<boolean>;
  /** 시험 페이지 전용: master 이득에 곱하는 선형 0..1 (제품 화면은 부르지 않는다, 12-06) */
  setMasterTrim(linear: number): void;
  /** 탭이 숨겨짐: master 120ms 페이드 뒤 suspend, 침대·대본 정지 */
  hidden(): void;
  /** 탭이 다시 보임: resume 성공이면 현재 침대만 되살림, 거절이면 locked */
  visible(): Promise<void>;
  log(): LogEntry[];
  clearLog(): void;
  voiceCount(): number;
  /** 활성 효과음 보이스(시험·점검용 읽기 전용 사본) */
  voiceInfo(): { id: SfxId; prio: number; nodes: number }[];
  /** 활성 노드 합(효과음 보이스) — NODE_BUDGET 과 비교한다 */
  activeNodes(): number;
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

/** 한 침대의 실행 상태: 침대 게인(크로스페이드)·시작 시각·스케줄러 커서·예약한 보이스 */
interface BedRuntime {
  id: BedId;
  gain: GainNode;
  /** 침대 시작 시각(컨텍스트 초) */
  origin: number;
  /** 다음에 예약할 침대 시각(ms) */
  cursor: number;
  timer: unknown;
  voices: Voice[];
  nodes: number;
}

const LOG_MAX = 300;
/** 침대 스케줄러 주기와 앞서 보는 구간(ms) */
const BED_TICK_MS = 60;
const BED_LOOKAHEAD_MS = 250;
/** 침대 크로스페이드·켜기 페이드인(초) */
const BED_FADE_S = 1.2;
/** 끄기·숨김 페이드아웃(초) */
const OFF_FADE_S = 0.12;
/** 시험 슬라이더 램프(초) */
const TRIM_RAMP_S = 0.03;
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

export function createEngine(deps: EngineDeps = {}): SoundEngine {
  const createContext = deps.createContext ?? defaultCreateContext;
  const now = deps.now ?? ((): number => Date.now());
  const setTimer = deps.setTimer ?? ((fn: () => void, ms: number): unknown => setTimeout(fn, ms));
  const clearTimer = deps.clearTimer ?? ((h: unknown): void => clearTimeout(h as ReturnType<typeof setTimeout>));
  const nav = deps.nav === undefined ? (typeof navigator === "undefined" ? null : (navigator as unknown as NonNullable<EngineDeps["nav"]>)) : deps.nav;

  let ctx: AudioContext | null = null;
  let graph: MixGraph | null = null;
  /** 시험 페이지 마스터 슬라이더 값(선형 0..1). 제품 화면은 부르지 않으니 늘 1 이다 */
  let masterTrim = 1;
  let failed = false;
  let forcedLocked = false;
  let on = loadSoundPref(deps.storage);
  let bed: BedId | null = null;
  let hiddenFlag = false;
  let hiddenTimer: unknown = null;
  /** 우리가 suspend() 를 불러 멈춘 상태(잠금과 구별한다) */
  let weSuspended = false;
  let bedRt: BedRuntime | null = null;
  const fading: BedRuntime[] = [];
  const scripts = new Map<string, unknown[]>();
  let order = 0;
  const voices: ActiveVoice[] = [];
  const entries: LogEntry[] = [];
  const lastPlayedAt = new Map<SfxId, number>();
  let duck: { target: number; releaseAt: number; returnMs: number; timer: unknown } | null = null;
  const subs = new Set<() => void>();

  const computeState = (): EngineState => {
    if (ctx === null || ctx.state === "closed") return "none";
    if (forcedLocked) return "locked";
    if (ctx.state === "running") return "running";
    return weSuspended && ctx.state === "suspended" ? "suspended" : "locked";
  };
  const canSound = (): boolean =>
    ctx !== null && graph !== null && on && !hiddenFlag && deps.doc?.visibilityState !== "hidden" && computeState() === "running";
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
      killBeds();
      clearTimer(duck?.timer);
      duck = null;
      ctx = null;
      graph = null;
      weSuspended = false;
    } else if (ctx.state === "running") {
      forcedLocked = false;
      weSuspended = false;
      ensureBed();
    } else {
      // suspended·interrupted: 소리가 나지 않으니 침대 스케줄러와 보이스 풀을 멈춘다(현재 침대 id 는 그대로)
      killBeds();
      for (const v of [...voices]) dropVoice(v);
    }
    notify();
  };

  const dropVoice = (v: ActiveVoice): void => {
    clearTimer(v.timer);
    const i = voices.indexOf(v);
    if (i >= 0) voices.splice(i, 1);
  };

  const pushLog = (entry: LogEntry): void => {
    entries.push(entry);
    if (entries.length > LOG_MAX) entries.splice(0, entries.length - LOG_MAX);
  };

  /** resume() 를 호출 안에서 동기로 걸고 결과를 기다린다. 거절·예외는 locked 로 삼킨다 */
  const resumeCtx = async (c: AudioContext): Promise<boolean> => {
    try {
      await c.resume();
    } catch {
      if (ctx === c) {
        forcedLocked = true;
        notify();
      }
      return false;
    }
    if (ctx !== c) return false;
    const ok = c.state === "running";
    forcedLocked = !ok;
    notify();
    return ok;
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
        graph = buildMixGraph(made, masterTrim);
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
    void resumeCtx(c);
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

  const bedNodesInUse = (): number => (bedRt?.nodes ?? 0) + fading.reduce((n, r) => n + r.nodes, 0);
  const usedNodes = (): number => voices.reduce((n, v) => n + v.nodes, 0) + bedNodesInUse();

  /** 보이스를 20ms 페이드로 끊는다(클릭 방지) */
  const cutVoice = (v: ActiveVoice, fadeSec = 0.02): void => {
    if (ctx !== null) v.voice.stop(ctx.currentTime, fadeSec);
    dropVoice(v);
  };

  /**
   * 새 요청 하나가 들어갈 자리를 만든다. (동시 8 · 같은 id max · 노드 예산 48) 중 하나라도 넘기면
   * 끊을 후보 = 우선순위 숫자가 큰(낮은 우선) 것 먼저, 같으면 오래된 것. 우선 0 은 후보가 아니다.
   * 후보가 없으면 새 요청이 우선 0 이 아닐 때 거절하고(false), 우선 0 이면 일시 초과로 낸다(true).
   */
  const makeRoom = (id: SfxId, prio: number, max: number, nodes: number): boolean => {
    for (;;) {
      const same = voices.filter((v) => v.id === id);
      const sameFull = same.length >= max;
      const globalOver = voices.length >= SFX_VOICE_MAX || usedNodes() + nodes > NODE_BUDGET;
      if (!sameFull && !globalOver) return true;
      // 같은 id 가 가득 찼으면 같은 id 안에서 먼저 끊고, 후보가 없을 때만 전체 한도를 본다
      let pool = sameFull ? same.filter((v) => v.prio > 0) : [];
      if (pool.length === 0 && globalOver) pool = voices.filter((v) => v.prio > 0);
      if (pool.length === 0) return prio === 0;
      pool.sort((a, b) => b.prio - a.prio || a.order - b.order);
      cutVoice(pool[0]!);
    }
  };

  const bgmParam = (): AudioParam | null => (graph === null ? null : graph.buses.bgm.gain);

  const releaseDuck = (): void => {
    const d = duck;
    duck = null;
    const p = bgmParam();
    if (d === null || p === null || ctx === null) return;
    p.setTargetAtTime(BUS_GAIN.bgm, ctx.currentTime, d.returnMs / 1000);
  };

  const duckBed = (db: number, holdMs: number, releaseMs = 250): void => {
    const p = bgmParam();
    if (p === null || ctx === null || computeState() !== "running") return;
    const target = BUS_GAIN.bgm * dbToLin(db);
    const releaseAt = now() + holdMs;
    if (duck === null) {
      duck = { target, releaseAt, returnMs: releaseMs, timer: null };
      p.setTargetAtTime(target, ctx.currentTime, 0.03);
    } else {
      if (target < duck.target) {
        duck.target = target;
        p.setTargetAtTime(target, ctx.currentTime, 0.03);
      }
      duck.releaseAt = Math.max(duck.releaseAt, releaseAt);
      duck.returnMs = releaseMs;
      clearTimer(duck.timer);
    }
    duck.timer = setTimer(releaseDuck, Math.max(0, duck.releaseAt - now()));
  };

  const clearDuck = (): void => {
    if (duck === null) return;
    clearTimer(duck.timer);
    releaseDuck();
  };

  const play = (id: SfxId, opts: PlayOpts = {}): void => {
    const entry: LogEntry = { id, at: now(), gain: dbToLin(opts.gainDb ?? 0), played: false };
    pushLog(entry);
    if (!canSound() || ctx === null || graph === null) return;
    const recipe = RECIPES[id];
    const last = lastPlayedAt.get(id);
    if (last !== undefined && entry.at - last < recipe.gapMs) return;
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
    const nodes = countNodes(events);
    if (!makeRoom(id, recipe.prio, recipe.max, nodes)) return;
    const c = ctx;
    let voice: Voice;
    try {
      voice = buildVoice(c, events, graph.buses[recipe.bus], c.currentTime, { noise: noiseBufferFor(c) });
    } catch {
      return;
    }
    const av: ActiveVoice = { id, prio: recipe.prio, nodes, order: (order += 1), voice, timer: null };
    av.timer = setTimer(() => dropVoice(av), Math.max(0, (voice.endAt - c.currentTime) * 1000) + 20);
    voices.push(av);
    lastPlayedAt.set(id, entry.at);
    entry.played = true;
    if (recipe.duck !== undefined) duckBed(recipe.duck.db, recipe.duck.holdMs);
  };

  /** 활성 보이스 전부를 fadeSec 동안 줄여 끝낸다 */
  const fadeOutVoices = (fadeSec: number): void => {
    for (const v of [...voices]) cutVoice(v, fadeSec);
  };

  // ───────────── 침대 ─────────────

  const bedTick = (rt: BedRuntime): void => {
    const c = ctx;
    if (c === null || graph === null || bedRt !== rt) return;
    const nowMs = (c.currentTime - rt.origin) * 1000;
    // 오래 멈췄다 돌아온 경우: 놓친 구간은 건너뛴다(이미 지난 소리를 한꺼번에 쏟지 않는다)
    if (rt.cursor < nowMs - BED_LOOKAHEAD_MS) rt.cursor = nowMs;
    const target = nowMs + BED_LOOKAHEAD_MS;
    if (target > rt.cursor) {
      const events = bedPlan(rt.id, rt.cursor, target);
      rt.cursor = target;
      if (events.length > 0) {
        try {
          rt.voices.push(buildVoice(c, events, rt.gain, rt.origin, { noise: noiseBufferFor(c) }));
        } catch {
          // 한 조각 실패는 다음 조각에 영향을 주지 않는다.
        }
      }
    }
    rt.voices = rt.voices.filter((v) => v.endAt > c.currentTime);
    rt.timer = setTimer(() => bedTick(rt), BED_TICK_MS);
  };

  const startBed = (id: BedId, fadeSec: number): void => {
    const c = ctx;
    if (c === null || graph === null) return;
    const t = c.currentTime;
    const gain = c.createGain();
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(1, t + fadeSec);
    gain.connect(graph.buses.bgm);
    const rt: BedRuntime = { id, gain, origin: t, cursor: 0, timer: null, voices: [], nodes: bedNodeCount(BEDS[id]) };
    bedRt = rt;
    bedTick(rt);
  };

  /** 침대 하나를 fadeSec 동안 줄여 멈춘다(스케줄러는 바로 멈추고, 이미 예약된 조각은 페이드가 끝날 때 정지) */
  const fadeOutBed = (rt: BedRuntime, fadeSec: number): void => {
    clearTimer(rt.timer);
    rt.timer = null;
    if (bedRt === rt) bedRt = null;
    const c = ctx;
    if (c === null) return;
    const t = c.currentTime;
    const p = rt.gain.gain;
    const cur = p.value;
    p.cancelScheduledValues(t);
    p.setValueAtTime(cur, t);
    p.linearRampToValueAtTime(0, t + fadeSec);
    for (const v of rt.voices) v.stop(t + fadeSec, 0.01);
    rt.voices = [];
    fading.push(rt);
    rt.timer = setTimer(() => {
      const i = fading.indexOf(rt);
      if (i >= 0) fading.splice(i, 1);
      try {
        rt.gain.disconnect();
      } catch {
        // 이미 끊긴 노드.
      }
    }, fadeSec * 1000 + 30);
  };

  /** 소리가 날 수 없는 상태로 넘어갈 때: 페이드 없이 침대 전부를 정리한다 */
  function killBeds(): void {
    for (const rt of [bedRt, ...fading]) {
      if (rt === null) continue;
      clearTimer(rt.timer);
      rt.timer = null;
      for (const v of rt.voices) v.stop(ctx?.currentTime ?? 0, 0.005);
      rt.voices = [];
      try {
        rt.gain.disconnect();
      } catch {
        // 이미 끊긴 노드.
      }
    }
    bedRt = null;
    fading.length = 0;
  }

  /** 현재 침대가 있고 소리 낼 수 있는데 돌고 있지 않으면 1.2초 페이드인으로 시작한다 */
  function ensureBed(): void {
    if (bed !== null && bedRt === null && canSound()) startBed(bed, BED_FADE_S);
  }

  const setBed = (id: BedId | null): void => {
    if (id === bed) return;
    bed = id;
    const entry: LogEntry | null = id === null ? null : { id, at: now(), gain: 1, played: false };
    if (entry !== null) pushLog(entry);
    if (canSound()) {
      if (bedRt !== null) fadeOutBed(bedRt, BED_FADE_S);
      if (id !== null) {
        startBed(id, BED_FADE_S);
        if (entry !== null) entry.played = true;
      }
    }
    notify();
  };

  // ───────────── 대본 ─────────────

  const cancelScript = (key: string): void => {
    for (const h of scripts.get(key) ?? []) clearTimer(h);
    scripts.delete(key);
  };
  const cancelAllScripts = (): void => {
    for (const key of [...scripts.keys()]) cancelScript(key);
  };

  const runScript = (key: string, items: readonly ScriptItem[], duckSpan: DuckSpan | null = null): void => {
    cancelScript(key);
    const handles: unknown[] = items.map((item) =>
      setTimer(() => play(item.id, { gainDb: item.gainDb, cents: item.cents }), Math.max(0, item.at)),
    );
    if (duckSpan !== null) {
      handles.push(setTimer(() => duckBed(duckSpan.db, Math.max(0, duckSpan.toMs - duckSpan.fromMs), duckSpan.returnMs), Math.max(0, duckSpan.fromMs)));
    }
    scripts.set(key, handles);
  };

  const stopAll = (): void => {
    cancelAllScripts();
    fadeOutVoices(OFF_FADE_S);
    if (bedRt !== null) fadeOutBed(bedRt, OFF_FADE_S);
    clearDuck();
    bed = null;
    notify();
  };

  // ───────────── 켬/끔 ─────────────

  const setOn = (next: boolean): void => {
    if (next === on) return;
    if (!next) {
      // 끌 때 ui.toggle(끔 변형)을 먼저 낸다: 끈 뒤에는 모든 요청이 막히므로 순서를 바꿀 수 없다(12-07).
      // 방금 낸 토글 보이스는 페이드 대상에서 빼고, 이미 울리던 나머지만 120ms 에 줄인다.
      const others = [...voices];
      play("ui.toggle", { variant: "off" });
      on = false;
      saveSoundPref(on, deps.storage);
      cancelAllScripts();
      for (const v of others) if (voices.includes(v)) cutVoice(v, OFF_FADE_S);
      if (bedRt !== null) fadeOutBed(bedRt, OFF_FADE_S);
      clearDuck();
      notify();
      return;
    }
    on = true;
    saveSoundPref(on, deps.storage);
    play("ui.toggle", { variant: "on" });
    ensureBed();
    notify();
  };

  // ───────────── 잠금 해제·숨김·복귀 ─────────────

  const resume = async (): Promise<boolean> => (ctx === null ? false : resumeCtx(ctx));

  const hidden = (): void => {
    hiddenFlag = true;
    cancelAllScripts();
    fadeOutVoices(OFF_FADE_S);
    if (bedRt !== null) fadeOutBed(bedRt, OFF_FADE_S);
    clearDuck();
    const c = ctx;
    if (c === null || graph === null || c.state !== "running") return;
    const t = c.currentTime;
    const m = graph.master.gain;
    m.cancelScheduledValues(t);
    m.setValueAtTime(m.value, t);
    m.linearRampToValueAtTime(0, t + OFF_FADE_S);
    clearTimer(hiddenTimer);
    hiddenTimer = setTimer(() => {
      hiddenTimer = null;
      if (ctx !== c || !hiddenFlag) return;
      weSuspended = true;
      try {
        void Promise.resolve(c.suspend()).catch(() => {});
      } catch {
        // suspend 실패는 보이지 않는다.
      }
      notify();
    }, OFF_FADE_S * 1000 + 10);
  };

  const setMasterTrim = (linear: number): void => {
    masterTrim = Number.isFinite(linear) ? Math.min(1, Math.max(0, linear)) : 1;
    const c = ctx;
    if (c === null || graph === null) return;
    const t = c.currentTime;
    const m = graph.master.gain;
    m.cancelScheduledValues(t);
    m.setValueAtTime(m.value, t);
    m.linearRampToValueAtTime(MASTER_GAIN * masterTrim, t + TRIM_RAMP_S);
  };

  const visible = async (): Promise<void> => {
    hiddenFlag = false;
    clearTimer(hiddenTimer);
    hiddenTimer = null;
    const c = ctx;
    if (c === null || graph === null) return;
    const restoreMaster = (): void => {
      if (ctx !== c || graph === null) return;
      const t = c.currentTime;
      const m = graph.master.gain;
      m.cancelScheduledValues(t);
      m.setValueAtTime(0, t);
      m.linearRampToValueAtTime(MASTER_GAIN * masterTrim, t + OFF_FADE_S);
    };
    if (!weSuspended && c.state === "running") {
      // suspend 전에 돌아왔다
      restoreMaster();
      ensureBed();
      notify();
      return;
    }
    weSuspended = false;
    const ok = await resumeCtx(c);
    if (ok) {
      restoreMaster();
      ensureBed();
    }
    notify();
  };

  return {
    unlock,
    supported: supportedNow,
    state: computeState,
    isOn: () => on,
    setOn,
    play,
    duckBed,
    setBed,
    runScript,
    cancelScript,
    stopAll,
    setMasterTrim,
    resume,
    hidden,
    visible,
    log: () => entries.map((e) => ({ ...e })),
    clearLog: () => {
      entries.length = 0;
    },
    voiceCount: () => voices.length,
    voiceInfo: () => voices.map((v) => ({ id: v.id, prio: v.prio, nodes: v.nodes })),
    activeNodes: usedNodes,
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
