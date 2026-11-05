// 12-05: 소리 엔진 시험용 가짜 AudioContext 와 가짜 시계. 실제 소리는 나지 않는다.
// 노드 생성 개수·연결 그래프·오디오 파라미터 램프 호출을 기록하고, state 를 시험이 바꾸며 statechange 를 보낼 수 있다.

export interface ParamCall {
  type: "set" | "linear" | "exp" | "target" | "cancel";
  value: number;
  time: number;
  /** setTargetAtTime 의 시간 상수 */
  tc?: number;
}

export class FakeParam {
  value: number;
  calls: ParamCall[] = [];
  constructor(initial = 0) {
    this.value = initial;
  }
  setValueAtTime(value: number, time: number): this {
    this.value = value;
    this.calls.push({ type: "set", value, time });
    return this;
  }
  linearRampToValueAtTime(value: number, time: number): this {
    this.calls.push({ type: "linear", value, time });
    return this;
  }
  exponentialRampToValueAtTime(value: number, time: number): this {
    this.calls.push({ type: "exp", value, time });
    return this;
  }
  setTargetAtTime(value: number, time: number, tc: number): this {
    this.calls.push({ type: "target", value, time, tc });
    return this;
  }
  cancelScheduledValues(time: number): this {
    this.calls.push({ type: "cancel", value: 0, time });
    return this;
  }
  cancelAndHoldAtTime(time: number): this {
    this.calls.push({ type: "cancel", value: 0, time });
    return this;
  }
  of(type: ParamCall["type"]): ParamCall[] {
    return this.calls.filter((c) => c.type === type);
  }
}

export class FakeNode {
  out: FakeNode[] = [];
  disconnected = false;
  constructor(
    public readonly kind: string,
    public readonly ctx: FakeAudioContext,
  ) {}
  connect<T extends FakeNode | FakeParam>(target: T): T {
    if (target instanceof FakeNode) this.out.push(target);
    return target;
  }
  disconnect(): void {
    this.disconnected = true;
    this.out = [];
  }
}

export class FakeGain extends FakeNode {
  gain = new FakeParam(1);
  constructor(ctx: FakeAudioContext) {
    super("gain", ctx);
  }
}

export class FakeSource extends FakeNode {
  startedAt: number | null = null;
  startOffset: number | undefined;
  stoppedAt: number | null = null;
  buffer: FakeBuffer | null = null;
  loop = false;
  type = "sine";
  frequency = new FakeParam(440);
  detune = new FakeParam(0);
  constructor(kind: "osc" | "buffer", ctx: FakeAudioContext) {
    super(kind, ctx);
  }
  start(when = 0, offset?: number): void {
    this.startedAt = when;
    this.startOffset = offset;
  }
  stop(when = 0): void {
    this.stoppedAt = when;
  }
}

export class FakeFilter extends FakeNode {
  type = "lowpass";
  frequency = new FakeParam(350);
  Q = new FakeParam(1);
  constructor(ctx: FakeAudioContext) {
    super("filter", ctx);
  }
}

export class FakeCompressor extends FakeNode {
  threshold = new FakeParam(-24);
  knee = new FakeParam(30);
  ratio = new FakeParam(12);
  attack = new FakeParam(0.003);
  release = new FakeParam(0.25);
  constructor(ctx: FakeAudioContext) {
    super("compressor", ctx);
  }
}

export class FakeBuffer {
  private data: Float32Array;
  constructor(
    public readonly numberOfChannels: number,
    public readonly length: number,
    public readonly sampleRate: number,
  ) {
    this.data = new Float32Array(length);
  }
  getChannelData(): Float32Array {
    return this.data;
  }
}

export interface FakeContextOptions {
  latencyHint?: string;
}

export class FakeAudioContext {
  state: "suspended" | "running" | "interrupted" | "closed" = "suspended";
  sampleRate = 8000;
  destination: FakeNode;
  options: FakeContextOptions;
  nodes: FakeNode[] = [];
  buffers: FakeBuffer[] = [];
  resumeCalls = 0;
  suspendCalls = 0;
  closeCalls = 0;
  /** resume() 의 결과: grant = running 이 되고 이행, reject = 거절, stay = 이행하되 suspended 유지 */
  resumeMode: "grant" | "reject" | "stay" = "grant";
  private listeners = new Set<() => void>();
  constructor(
    private readonly clock: FakeClock,
    options: FakeContextOptions = {},
  ) {
    this.options = options;
    this.destination = new FakeNode("destination", this);
  }
  get currentTime(): number {
    return this.clock.now() / 1000;
  }
  private add<T extends FakeNode>(n: T): T {
    this.nodes.push(n);
    return n;
  }
  createGain(): FakeGain {
    return this.add(new FakeGain(this));
  }
  createOscillator(): FakeSource {
    return this.add(new FakeSource("osc", this));
  }
  createBufferSource(): FakeSource {
    return this.add(new FakeSource("buffer", this));
  }
  createBiquadFilter(): FakeFilter {
    return this.add(new FakeFilter(this));
  }
  createDynamicsCompressor(): FakeCompressor {
    return this.add(new FakeCompressor(this));
  }
  createBuffer(channels: number, length: number, sampleRate: number): FakeBuffer {
    const b = new FakeBuffer(channels, length, sampleRate);
    this.buffers.push(b);
    return b;
  }
  addEventListener(type: string, fn: () => void): void {
    if (type === "statechange") this.listeners.add(fn);
  }
  removeEventListener(type: string, fn: () => void): void {
    if (type === "statechange") this.listeners.delete(fn);
  }
  /** 시험이 상태를 바꾸고 statechange 를 보낸다 */
  setState(s: FakeAudioContext["state"]): void {
    this.state = s;
    for (const fn of [...this.listeners]) fn();
  }
  resume(): Promise<void> {
    this.resumeCalls += 1;
    if (this.resumeMode === "reject") return Promise.reject(new Error("NotAllowedError"));
    if (this.resumeMode === "grant") this.setState("running");
    return Promise.resolve();
  }
  suspend(): Promise<void> {
    this.suspendCalls += 1;
    this.setState("suspended");
    return Promise.resolve();
  }
  close(): Promise<void> {
    this.closeCalls += 1;
    this.setState("closed");
    return Promise.resolve();
  }
  // ── 시험용 조회 ──
  ofKind(kind: string): FakeNode[] {
    return this.nodes.filter((n) => n.kind === kind);
  }
  sources(): FakeSource[] {
    return this.nodes.filter((n): n is FakeSource => n instanceof FakeSource);
  }
  /** from 에서 출력을 따라가면 to 에 닿는가 */
  reaches(from: FakeNode, to: FakeNode): boolean {
    const seen = new Set<FakeNode>();
    const walk = (n: FakeNode): boolean => {
      if (n === to) return true;
      if (seen.has(n)) return false;
      seen.add(n);
      return n.out.some(walk);
    };
    return walk(from);
  }
  /** 시각 t(초)에 울리는 소스 수 */
  liveSourcesAt(t: number): number {
    return this.sources().filter((s) => s.startedAt !== null && s.startedAt <= t && (s.stoppedAt === null || s.stoppedAt > t)).length;
  }
}

// ───────────────────────── 가짜 시계 ─────────────────────────

export interface FakeClock {
  now(): number;
  advance(ms: number): void;
  setTimer(fn: () => void, ms: number): number;
  clearTimer(h: unknown): void;
  pending(): number;
}

export function createFakeClock(start = 1_000_000): FakeClock {
  let t = start;
  let seq = 0;
  const timers = new Map<number, { at: number; fn: () => void }>();
  return {
    now: () => t,
    setTimer(fn, ms) {
      seq += 1;
      timers.set(seq, { at: t + Math.max(0, ms), fn });
      return seq;
    },
    clearTimer(h) {
      timers.delete(h as number);
    },
    pending: () => timers.size,
    advance(ms) {
      const end = t + ms;
      for (;;) {
        let nextId = -1;
        let nextAt = Infinity;
        for (const [id, tm] of timers) {
          if (tm.at <= end && (tm.at < nextAt || (tm.at === nextAt && id < nextId))) {
            nextId = id;
            nextAt = tm.at;
          }
        }
        if (nextId < 0) break;
        const tm = timers.get(nextId)!;
        timers.delete(nextId);
        t = Math.max(t, tm.at);
        tm.fn();
      }
      t = end;
    },
  };
}

export interface FakeRig {
  clock: FakeClock;
  contexts: FakeAudioContext[];
  /** 새로 만드는 컨텍스트의 resume() 결과 */
  resumeMode: FakeAudioContext["resumeMode"];
  /** 엔진 deps 로 넘기는 createContext */
  createContext: (opts: FakeContextOptions) => FakeAudioContext;
  ctx(): FakeAudioContext;
}

export function createFakeRig(): FakeRig {
  const clock = createFakeClock();
  const contexts: FakeAudioContext[] = [];
  const rig: FakeRig = {
    clock,
    contexts,
    resumeMode: "grant",
    createContext(opts) {
      const c = new FakeAudioContext(clock, opts);
      c.resumeMode = rig.resumeMode;
      contexts.push(c);
      return c;
    },
    ctx() {
      const c = contexts[contexts.length - 1];
      if (c === undefined) throw new Error("no context yet");
      return c;
    },
  };
  return rig;
}
