// ?perf=1 지표 계산(순수). 시각·DOM·three 를 모른다 — node 에서 그대로 시험된다.
// 정의는 RESEARCH R2.2 표: 평균 fps = 프레임 수 ÷ 경과 초(순간 fps 의 평균이 아님), 끊김 = 델타 > 50ms,
// 백분위는 정렬 복사본, 첫 1분 대비 마지막 1분 비율 < 0.85 이면 열 스로틀 의심, rAF 중앙값으로 120/60/30Hz 를 알아본다.

/** 5분 × 60fps 에 여유(60 × 330 칸 = 19,800개 ≈ 79KB). 120Hz 폰은 호출하는 쪽이 더 크게 잡는다 */
export const FRAME_CAPACITY = 60 * 330;
/** 이 값(ms)을 넘는 프레임이 끊김이다 */
export const JANK_MS = 50;
/** 첫 1분 대비 마지막 1분 비율이 이보다 작으면 열 스로틀을 의심한다 */
export const THERMAL_SUSPECT_RATIO = 0.85;
const MINUTE_MS = 60_000;

/**
 * 프레임 델타(ms) 기록기. 고정 크기 Float32Array 에 차례로 쌓고, 가득 차면 기록을 멈춘다(덮어쓰지 않는다).
 * HUD 가 켜져 있든 아니든 같은 코드로 쌓는다(R2.2).
 */
export class FrameRecorder {
  readonly capacity: number;
  private readonly buf: Float32Array;
  private n = 0;
  private last: number | null = null;

  constructor(capacity: number = FRAME_CAPACITY) {
    this.capacity = capacity;
    this.buf = new Float32Array(capacity);
  }

  get length(): number {
    return this.n;
  }

  get full(): boolean {
    return this.n >= this.capacity;
  }

  /** 델타 하나를 쌓는다. 가득 차 있으면 쌓지 않고 false */
  push(deltaMs: number): boolean {
    if (this.n >= this.capacity) return false;
    this.buf[this.n++] = deltaMs;
    return true;
  }

  /** rAF 콜백이 받은 시각. 앞 시각과의 차를 쌓는다(첫 시각은 기준일 뿐) */
  frame(rafTimeMs: number): void {
    if (this.last !== null) this.push(rafTimeMs - this.last);
    this.last = rafTimeMs;
  }

  /** 쌓인 만큼만 보는 뷰(복사하지 않는다) */
  values(): Float32Array {
    return this.buf.subarray(0, this.n);
  }

  clear(): void {
    this.n = 0;
    this.last = null;
  }
}

function sumOf(d: ArrayLike<number>): number {
  let s = 0;
  for (let i = 0; i < d.length; i++) s += d[i]!;
  return s;
}

/** 평균 fps = 프레임 수 ÷ 경과 초. 기록이 없으면 0 */
export function avgFps(deltas: ArrayLike<number>): number {
  const total = sumOf(deltas);
  return deltas.length === 0 || total <= 0 ? 0 : deltas.length / (total / 1000);
}

/** 한 프레임이 50ms 를 넘은 횟수(50 은 넘은 것이 아니다) */
export function jankCount(deltas: ArrayLike<number>): number {
  let n = 0;
  for (let i = 0; i < deltas.length; i++) if (deltas[i]! > JANK_MS) n += 1;
  return n;
}

/** 오름차순 정렬된 배열의 q(0~1) 백분위, 가까운 순위(nearest-rank). 빈 배열은 0 */
export function percentile(sortedAsc: ArrayLike<number>, q: number): number {
  const n = sortedAsc.length;
  if (n === 0) return 0;
  const idx = Math.min(n - 1, Math.max(0, Math.ceil(q * n) - 1));
  return sortedAsc[idx]!;
}

const RAF_HZ = [30, 60, 90, 120, 144] as const;

/** rAF 델타 중앙값(ms)으로 화면 주사율을 가까운 값으로 알아본다. 30Hz 면 저전력 모드(iOS rAF 30fps 제한) 의심 */
export function rafHzGuess(medianMs: number): { hz: number; lowPower: boolean } {
  if (!(medianMs > 0)) return { hz: 0, lowPower: false };
  const hz = 1000 / medianMs;
  let best: number = RAF_HZ[0];
  for (const c of RAF_HZ) if (Math.abs(c - hz) < Math.abs(best - hz)) best = c;
  return { hz: best, lowPower: best === 30 };
}

/** 마지막 1분 평균 fps ÷ 첫 1분 평균 fps. 0.85 미만이면 열 스로틀 의심. 첫 값이 없으면 구하지 않는다 */
export function thermalRatio(firstMinuteFps: number, lastMinuteFps: number): { ratio: number | null; suspect: boolean } {
  if (!(firstMinuteFps > 0)) return { ratio: null, suspect: false };
  const ratio = lastMinuteFps / firstMinuteFps;
  return { ratio, suspect: ratio < THERMAL_SUSPECT_RATIO };
}

export type HeartbeatState = "running" | "finished";
export interface Heartbeat {
  state: HeartbeatState;
  at: number;
}
export type HeartbeatVerdict = "first" | "clean" | "crashed";

/**
 * 시작할 때 읽은 이전 하트비트로 지난 실행을 판정한다. 없으면 처음, running 이 남아 있으면 도중에 죽었다
 * (메모리 압박으로 탭이 폐기됐거나 사람이 새로 고침했다), finished 면 깨끗하게 끝났다.
 */
export function heartbeatVerdict(stored: Heartbeat | null): HeartbeatVerdict {
  if (stored === null) return "first";
  if (stored.state === "running") return "crashed";
  if (stored.state === "finished") return "clean";
  return "first";
}

/** 저장소 문자열을 하트비트로. 깨진 값은 null */
export function parseHeartbeat(raw: string | null): Heartbeat | null {
  if (raw === null) return null;
  try {
    const v = JSON.parse(raw) as { state?: unknown; at?: unknown };
    if ((v.state === "running" || v.state === "finished") && typeof v.at === "number") return { state: v.state, at: v.at };
  } catch {
    // 깨진 값은 처음으로 본다
  }
  return null;
}

/** 앞에서(또는 뒤에서) 60초를 채우는 프레임들의 평균 fps */
function minuteFps(deltas: ArrayLike<number>, fromEnd: boolean): number {
  let sum = 0;
  let count = 0;
  const n = deltas.length;
  for (let i = 0; i < n && sum < MINUTE_MS; i++) {
    sum += deltas[fromEnd ? n - 1 - i : i]!;
    count += 1;
  }
  return sum > 0 ? count / (sum / 1000) : 0;
}

export interface FrameSummary {
  count: number;
  seconds: number;
  avgFps: number;
  jank: number;
  p50: number;
  p95: number;
  p99: number;
  max: number;
  rafHz: number;
  lowPowerSuspect: boolean;
  /** 2분 미만이면 null */
  firstMinuteFps: number | null;
  lastMinuteFps: number | null;
  thermalRatio: number | null;
  thermalSuspect: boolean;
}

/** 프레임 델타(ms) 기록 전체의 요약. 정렬은 복사본에서 한다 */
export function summarizeFrames(deltas: ArrayLike<number>): FrameSummary {
  const sorted = Float64Array.from(deltas as ArrayLike<number>).sort();
  const total = sumOf(deltas);
  const p50 = percentile(sorted, 0.5);
  const raf = rafHzGuess(p50);
  const longEnough = total >= 2 * MINUTE_MS;
  const first = longEnough ? minuteFps(deltas, false) : null;
  const last = longEnough ? minuteFps(deltas, true) : null;
  const th = first !== null && last !== null ? thermalRatio(first, last) : { ratio: null, suspect: false };
  return {
    count: deltas.length,
    seconds: total / 1000,
    avgFps: avgFps(deltas),
    jank: jankCount(deltas),
    p50,
    p95: percentile(sorted, 0.95),
    p99: percentile(sorted, 0.99),
    max: sorted.length > 0 ? sorted[sorted.length - 1]! : 0,
    rafHz: raf.hz,
    lowPowerSuspect: raf.lowPower,
    firstMinuteFps: first,
    lastMinuteFps: last,
    thermalRatio: th.ratio,
    thermalSuspect: th.suspect,
  };
}
