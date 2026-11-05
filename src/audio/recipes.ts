// 12-02: 소리 레시피 표 — 순수 데이터와 결정적 렌더 계획 (SOUND-01, D-1, D-16, D-18, D-20).
// 이 모듈은 아무것도 import 하지 않는다(정적 가드 soundStaticGuard 가 고정한다). Web Audio·DOM·시계·전역 난수를 모른다.
// 시각·변형·음높이 이동은 인자로만 받고, 난수는 시드 고정 mulberry32 뿐이다.
// 모든 소리는 발진기·필터링한 잡음·엔벨로프 레시피다. 외부 오디오 파일·소리 라이브러리·알려진 곡의 선율은 없다.
// 마음에 안 드는 id 는 나중에 CC0 샘플로 바꿀 수 있게 SoundId → 레시피 표(RECIPES·BEDS)를 단일 정의로 둔다.

// ───────────────────────── 한계와 믹스 상수 (UI-SPEC A-3, D) ─────────────────────────

export const MAX_LAYERS = 4;
export const MAX_RECIPE_MS = 3000;
export const FREQ_MIN = 40;
export const FREQ_MAX = 9000;
export const LFO_MAX_HZ = 8;
/** 침대 발진기 상한(소음은 따로 1) */
export const BED_OSC_MAX = 6;
/** 레벨 추정이 넘으면 안 되는 값(dBFS) */
export const PEAK_DBFS_MAX = -6;
export const GAIN_DB_MIN = -24;
/** 효과음 한 레시피의 노드(소스 + 필터 + LFO) 상한 */
export const RECIPE_NODE_MAX = 8;
/** 침대 하나의 노드(소스 + 필터) 상한 */
export const BED_NODE_MAX = 16;
/** 동시 노드 예산. 합이 넘는 조합은 엔진이 보이스를 끊어 지킨다(12-05) */
export const NODE_BUDGET = 48;
/** 효과음 동시 보이스 상한 */
export const SFX_VOICE_MAX = 8;

export type Bus = "bgm" | "sfx" | "ui";
export const BUS_GAIN: Readonly<Record<Bus, number>> = { bgm: 0.3, sfx: 0.7, ui: 0.45 };
export const MASTER_GAIN = 0.7;
/** DynamicsCompressor 기본값(threshold dB·ratio·attack s·release s) */
export const COMPRESSOR = { threshold: -18, ratio: 4, attack: 0.005, release: 0.2 } as const;

// ───────────────────────── 형식 ─────────────────────────

export type Wave = "sine" | "triangle" | "square" | "sawtooth" | "noise";
export type FilterType = "lowpass" | "highpass" | "bandpass";
/**
 * 필터. lfoHz 가 없으면 f 는 [시작, 끝] 지수 램프, 있으면 [하한, 상한] 범위를 LFO 가 오간다.
 */
export interface Filter {
  type: FilterType;
  f: readonly [number, number];
  q: number;
  lfoHz?: number;
}
/** 엔벨로프 [어택 ms, 디케이 ms, 서스테인 0..1, 릴리스 ms] — 릴리스는 게이트(dur) 뒤에 이어진다 */
export type Env = readonly [number, number, number, number];
export interface Layer {
  src: Wave;
  /** 레시피 시작 기준 ms */
  at: number;
  /** 게이트 길이 ms (릴리스 제외) */
  dur: number;
  /** 시작→끝 Hz(지수 램프). 잡음 층에는 없다 */
  f?: readonly [number, number];
  gain: number;
  env: Env;
  filter?: Filter;
  detune?: number;
  /** 음높이 떨림(Hz ≤ 8, cents) */
  lfo?: { hz: number; cents: number };
}
export type Priority = 0 | 1 | 2;
export interface Recipe {
  id: SfxId;
  bus: Bus;
  layers: readonly Layer[];
  prio: Priority;
  /** 같은 id 동시 상한 */
  max: number;
  /** 같은 id 최소 간격 ms */
  gapMs: number;
  gainDb: number;
  duck?: { db: number; holdMs: number };
}

/** 평면 렌더 이벤트 — 컨텍스트 개념이 없어 실시간 엔진과 오프라인 렌더가 같은 입력으로 쓴다 */
export interface PlanEvent {
  kind: "osc" | "noise";
  wave: Wave;
  /** 시작 ms(레시피·침대 질의 기준) */
  t: number;
  /** 게이트 길이 ms */
  dur: number;
  /** 잡음은 0 */
  f0: number;
  f1: number;
  /** 버스 이전 선형 이득(레이어 이득 × 레시피 gainDb) */
  gain: number;
  env: Env;
  filter?: Filter;
  detune: number;
  lfoHz?: number;
  lfoCents?: number;
  /** 잡음 버퍼 시작 위치를 정하는 시드(잡음만) */
  seed?: number;
}

export interface Bed {
  id: BedId;
  bpm: number;
  /** 음 고르기·잡음 시드 */
  seed: number;
  /** 코드 진행(MIDI). 드론 침대는 비어 있다 */
  chords: readonly (readonly number[])[];
  barsPerChord: number;
  /** 코드마다 하나(MIDI), 1·3박 플럭. 없으면 빈 배열 */
  bass: readonly number[];
  pad?: { wave: "triangle" | "sine"; filter: Filter };
  /** 길게 이어지는 사인 드론. open 이 있으면 로우패스가 ms 에 걸쳐 from→to 로 열린다 */
  drone?: { notes: readonly number[]; open?: { from: number; to: number; ms: number } };
  /** 2·4박 브러시 비율(1 이면 매번) */
  brush?: number;
  /** 피아노 비슷한 코드톤 음: 박마다 확률 p */
  notes?: { p: number; octave: number };
  room?: { f: number };
  wind?: { f: readonly [number, number]; lfoHz: number };
  /** 부품별 레벨(dB, 버스 이전) */
  db: Partial<Record<"pad" | "bass" | "drone" | "brush" | "notes" | "room" | "wind", number>>;
}

// ───────────────────────── id ─────────────────────────

export const BED_IDS = ["bed.night"] as const;
export type BedId = (typeof BED_IDS)[number];
export const SFX_IDS = ["ui.toggle", "verdict.heart"] as const;
export type SfxId = (typeof SFX_IDS)[number];
export type SoundId = BedId | SfxId;

// ───────────────────────── 수학 도우미 ─────────────────────────

/** MIDI 번호 → Hz. A4(69) = 440 */
export function midiToHz(m: number): number {
  return 440 * 2 ** ((m - 69) / 12);
}

/** 시드 고정 난수. [0, 1) */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const dbToLin = (db: number): number => 10 ** (db / 20);

function fnv1a(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

/** 소수 셋째 자리로 반올림한 JSON 에 FNV-1a 32비트를 건 해시(8자리 16진) */
export function planHash(plan: readonly PlanEvent[]): string {
  const json = JSON.stringify(plan, (_k, v: unknown) => (typeof v === "number" ? Math.round(v * 1000) / 1000 : v));
  return fnv1a(json).toString(16).padStart(8, "0");
}

// ───────────────────────── 레시피 만들기 도우미 ─────────────────────────

const perc = (decayMs: number): Env => [2, Math.max(1, decayMs - 2), 0, 8];
const hold = (a: number, r: number): Env => [a, 0, 1, r];

function osc(
  src: Exclude<Wave, "noise">,
  at: number,
  dur: number,
  f: number | readonly [number, number],
  gain: number,
  env: Env,
  extra: { filter?: Filter; detune?: number; lfo?: { hz: number; cents: number } } = {},
): Layer {
  const range: readonly [number, number] = typeof f === "number" ? [f, f] : f;
  return { src, at, dur, f: range, gain, env, ...extra };
}

function nz(at: number, dur: number, filter: Filter, gain: number, env: Env): Layer {
  return { src: "noise", at, dur, gain, env, filter };
}

const lp = (f0: number, f1 = f0, q = 0.7): Filter => ({ type: "lowpass", f: [f0, f1], q });

/** 표의 gainDb 가 −24 보다 낮으면 −24 로 막고 나머지 차이를 레이어 이득에 접는다(들리는 크기는 같다) */
function fold(tableDb: number): { gainDb: number; k: number } {
  const gainDb = Math.max(GAIN_DB_MIN, tableDb);
  return { gainDb, k: dbToLin(tableDb - gainDb) };
}

function recipe(
  id: SfxId,
  bus: Bus,
  prio: Priority,
  tableDb: number,
  layers: readonly Layer[],
  extra: { max?: number; gapMs?: number; duck?: { db: number; holdMs: number } } = {},
): Recipe {
  const { gainDb, k } = fold(tableDb);
  const scaled = layers.map((l) => ({ ...l, gain: l.gain * k }));
  return {
    id,
    bus,
    layers: scaled,
    prio,
    max: extra.max ?? 2,
    gapMs: extra.gapMs ?? 0,
    gainDb,
    ...(extra.duck !== undefined ? { duck: extra.duck } : {}),
  };
}

// ───────────────────────── 효과음 표 ─────────────────────────

/** 같은 id 안의 변형(켬/끔). 직업별·카드 종류별 변형은 두지 않는다(LS-5) */
export const VARIANTS: Readonly<Partial<Record<SfxId, Readonly<Record<string, readonly Layer[]>>>>> = {
  "ui.toggle": {
    on: [osc("sine", 0, 90, [440, 660], 1, [3, 60, 0.3, 30])],
    off: [osc("sine", 0, 90, [440, 330], 1, [3, 60, 0.3, 30])],
  },
};

export const RECIPES: Readonly<Record<SfxId, Recipe>> = {
  "ui.toggle": recipe("ui.toggle", "ui", 2, -18, VARIANTS["ui.toggle"]!["on"]!),
  "verdict.heart": recipe(
    "verdict.heart",
    "sfx",
    0,
    -14,
    [
      osc("sine", 0, 120, 55, 1, [4, 90, 0, 20], { filter: lp(120) }),
      osc("sine", 160, 120, 55, dbToLin(-3), [4, 90, 0, 20], { filter: lp(120) }),
    ],
    { max: 2 },
  ),
};

// ───────────────────────── 침대 표 ─────────────────────────

export const BEDS: Readonly<Record<BedId, Bed>> = {
  "bed.night": {
    id: "bed.night",
    bpm: 60,
    seed: 5,
    chords: [],
    barsPerChord: 1,
    bass: [],
    // D1(36.7Hz)은 40Hz 한계 밖이라 한 옥타브 위 D2 로 둔다(폰 스피커 대역)
    drone: { notes: [38, 33] },
    room: { f: 300 },
    wind: { f: [400, 800], lfoHz: 0.05 },
    db: { drone: -34, room: -40, wind: -40 },
  },
};

// ───────────────────────── 계산 ─────────────────────────

export interface RenderOpts {
  /** 같은 id 안의 변형 이름(ui.toggle: on|off) */
  variant?: string;
  /** 음높이 이동 cents(role.flip 의 오름 등, 호출하는 쪽이 준다) */
  cents?: number;
}

function layersOf(id: SfxId, variant: string | undefined): readonly Layer[] {
  const base = RECIPES[id];
  if (variant === undefined) return base.layers;
  const table = VARIANTS[id]?.[variant];
  if (table === undefined) throw new Error(`unknown variant ${variant} for ${id}`);
  const { k } = fold(RECIPES[id].gainDb);
  return table.map((l) => ({ ...l, gain: l.gain * k }));
}

function layerToEvent(l: Layer, gainLin: number, cents: number, seed: number): PlanEvent {
  const noise = l.src === "noise";
  if (!noise && l.f === undefined) throw new Error("oscillator layer needs f");
  const ev: PlanEvent = {
    kind: noise ? "noise" : "osc",
    wave: l.src,
    t: l.at,
    dur: l.dur,
    f0: noise ? 0 : l.f![0],
    f1: noise ? 0 : l.f![1],
    gain: l.gain * gainLin,
    env: [l.env[0], l.env[1], l.env[2], l.env[3]],
    detune: (l.detune ?? 0) + cents,
  };
  if (l.filter !== undefined) ev.filter = { ...l.filter, f: [l.filter.f[0], l.filter.f[1]] };
  if (l.lfo !== undefined) {
    ev.lfoHz = l.lfo.hz;
    ev.lfoCents = l.lfo.cents;
  }
  if (noise) ev.seed = seed;
  return ev;
}

/** 효과음 한 개의 렌더 계획. 같은 입력이면 항상 같은 출력이다 */
export function renderPlan(id: SfxId, opts: RenderOpts = {}): PlanEvent[] {
  const recipeRow = RECIPES[id];
  const gainLin = dbToLin(recipeRow.gainDb);
  const cents = opts.cents ?? 0;
  const base = fnv1a(id);
  const events = layersOf(id, opts.variant).map((l, i) => layerToEvent(l, gainLin, cents, (base + i * 7919) >>> 0));
  return events.sort((a, b) => a.t - b.t);
}

/** 레이어 at + dur + 릴리스의 최댓값(ms) */
export function recipeDurationMs(id: SfxId): number {
  return RECIPES[id].layers.reduce((m, l) => Math.max(m, l.at + l.dur + l.env[3]), 0);
}

/** 효과음 한 레시피의 노드 수(소스 + 필터 + LFO) */
export function recipeNodeCount(id: SfxId): number {
  return RECIPES[id].layers.reduce((n, l) => n + 1 + (l.filter !== undefined ? 1 : 0) + (l.lfo !== undefined ? 1 : 0), 0);
}

// 침대 ----------------------------------------------------------------

export const BED_SEGMENT_MS = 4000;
export const BED_OVERLAP_MS = 800;
const PAD_ENV: Env = [600, 0, 1, 800];
const SEG_ENV: Env = [BED_OVERLAP_MS, 0, 1, BED_OVERLAP_MS];

/** 동시에 울리는 발진기 수(정상 상태). 한계 6 */
export function bedOscCount(bed: Bed): number {
  const padVoices = bed.pad !== undefined ? (bed.chords[0]?.length ?? 0) : 0;
  return padVoices + (bed.bass.length > 0 ? 1 : 0) + (bed.drone?.notes.length ?? 0) + (bed.notes !== undefined ? 1 : 0);
}

/** 잡음 소스 수. 방 소리·바람은 같은 버퍼 소스에서 갈라져 하나로 센다 */
export function bedNoiseCount(bed: Bed): number {
  return bed.brush !== undefined || bed.room !== undefined || bed.wind !== undefined ? 1 : 0;
}

/** 침대 노드 수(소스 + 필터) */
export function bedNodeCount(bed: Bed): number {
  const filters =
    (bed.pad !== undefined ? 1 : 0) +
    (bed.drone?.open !== undefined ? 1 : 0) +
    (bed.brush !== undefined ? 1 : 0) +
    (bed.room !== undefined ? 1 : 0) +
    (bed.wind !== undefined ? 1 : 0) +
    (bed.notes !== undefined ? 1 : 0);
  return bedOscCount(bed) + bedNoiseCount(bed) + filters;
}

function bedOf(bed: Bed | BedId): Bed {
  return typeof bed === "string" ? BEDS[bed] : bed;
}

/** 침대 부품 레벨 합(선형, 버스 이전) */
function bedLevelLinear(bed: Bed): number {
  const lin = (part: keyof Bed["db"]): number => (bed.db[part] === undefined ? 0 : dbToLin(bed.db[part]!));
  const padVoices = bed.pad !== undefined ? (bed.chords[0]?.length ?? 0) : 0;
  return (
    padVoices * lin("pad") +
    (bed.bass.length > 0 ? lin("bass") : 0) +
    (bed.drone?.notes.length ?? 0) * lin("drone") +
    lin("brush") +
    lin("notes") +
    lin("room") +
    lin("wind")
  );
}

/** 레벨 추정(dBFS): 이득 합 × 레시피 gainDb × 버스 × master */
export function peakDbEstimate(id: SoundId): number {
  if ((BED_IDS as readonly string[]).includes(id)) {
    return 20 * Math.log10(bedLevelLinear(BEDS[id as BedId]) * BUS_GAIN.bgm * MASTER_GAIN);
  }
  const r = RECIPES[id as SfxId];
  const sum = r.layers.reduce((s, l) => s + l.gain, 0);
  return 20 * Math.log10(sum * dbToLin(r.gainDb) * BUS_GAIN[r.bus] * MASTER_GAIN);
}

/** 박 n 의 난수 — 질의 구간과 무관하게 같은 값(접두 일관성) */
function stepRng(seed: number, step: number, part: number): () => number {
  return mulberry32((seed ^ Math.imul(step + 1, 0x9e3779b1) ^ Math.imul(part + 1, 0x85ebca6b)) >>> 0);
}

function openFreq(open: { from: number; to: number; ms: number }, atMs: number): number {
  const u = Math.min(1, Math.max(0, atMs / open.ms));
  return open.from * (open.to / open.from) ** u;
}

/**
 * 침대의 [fromMs, toMs) 안에서 시작하는 이벤트. 이벤트 시각은 질의와 무관한 격자의 함수라
 * 0~8초 결과는 0~16초 결과의 앞부분이다(접두 일관). 드론·방 소리·바람은 4초 조각이 0.8초씩 겹쳐 이어진다.
 */
export function bedPlan(bedOrId: Bed | BedId, fromMs: number, toMs: number): PlanEvent[] {
  const bed = bedOf(bedOrId);
  if (!(toMs > fromMs)) return [];
  const from = Math.max(0, fromMs);
  const events: PlanEvent[] = [];
  const lin = (part: keyof Bed["db"]): number => dbToLin(bed.db[part] ?? -60);
  const beatMs = 60000 / bed.bpm;
  const barMs = beatMs * 4;

  // 패드: 코드마다 한 번, 코드 길이 동안
  if (bed.pad !== undefined && bed.chords.length > 0) {
    const chordMs = barMs * bed.barsPerChord;
    for (let k = Math.ceil(from / chordMs); k * chordMs < toMs; k += 1) {
      const chord = bed.chords[k % bed.chords.length]!;
      chord.forEach((m, i) => {
        events.push({
          kind: "osc",
          wave: bed.pad!.wave,
          t: k * chordMs,
          dur: chordMs,
          f0: midiToHz(m),
          f1: midiToHz(m),
          gain: lin("pad"),
          env: [...PAD_ENV],
          filter: { ...bed.pad!.filter, f: [bed.pad!.filter.f[0], bed.pad!.filter.f[1]] },
          detune: i % 2 === 0 ? -5 : 5,
        });
      });
    }
  }

  // 박 단위: 베이스 플럭(1·3박), 브러시(2·4박), 피아노 비슷한 음(박마다 확률)
  const chordIndexAtBeat = (n: number): number => Math.floor(n / 4 / bed.barsPerChord) % Math.max(1, bed.chords.length);
  for (let n = Math.ceil(from / beatMs); n * beatMs < toMs; n += 1) {
    const t = n * beatMs;
    const inBar = n % 4;
    if (bed.bass.length > 0 && (inBar === 0 || inBar === 2)) {
      const m = bed.bass[chordIndexAtBeat(n) % bed.bass.length]!;
      events.push({
        kind: "osc",
        wave: "sine",
        t,
        dur: 450,
        f0: midiToHz(m),
        f1: midiToHz(m),
        gain: lin("bass"),
        env: [3, 440, 0, 12],
        detune: 0,
      });
    }
    if (bed.brush !== undefined && (inBar === 1 || inBar === 3) && stepRng(bed.seed, n, 1)() < bed.brush) {
      events.push({
        kind: "noise",
        wave: "noise",
        t,
        dur: 30,
        f0: 0,
        f1: 0,
        gain: lin("brush"),
        env: perc(30),
        filter: { type: "highpass", f: [5000, 5000], q: 0.7 },
        detune: 0,
        seed: (bed.seed + n * 31) >>> 0,
      });
    }
    if (bed.notes !== undefined && bed.chords.length > 0) {
      const rng = stepRng(bed.seed, n, 2);
      if (rng() < bed.notes.p) {
        const chord = bed.chords[chordIndexAtBeat(n)]!;
        const m = chord[Math.floor(rng() * chord.length)]! + 12 * bed.notes.octave;
        events.push({
          kind: "osc",
          wave: "triangle",
          t,
          dur: 900,
          f0: midiToHz(m),
          f1: midiToHz(m),
          gain: lin("notes"),
          env: [4, 800, 0, 200],
          filter: lp(3000),
          detune: 0,
        });
      }
    }
  }

  // 4초 조각: 드론·방 소리·바람
  for (let k = Math.ceil(from / BED_SEGMENT_MS); k * BED_SEGMENT_MS < toMs; k += 1) {
    const t = k * BED_SEGMENT_MS;
    if (bed.drone !== undefined) {
      const open = bed.drone.open;
      for (const m of bed.drone.notes) {
        const ev: PlanEvent = {
          kind: "osc",
          wave: "sine",
          t,
          dur: BED_SEGMENT_MS,
          f0: midiToHz(m),
          f1: midiToHz(m),
          gain: lin("drone"),
          env: [...SEG_ENV],
          detune: 0,
        };
        if (open !== undefined) ev.filter = lp(openFreq(open, t), openFreq(open, t + BED_SEGMENT_MS));
        events.push(ev);
      }
    }
    if (bed.room !== undefined) {
      events.push({
        kind: "noise",
        wave: "noise",
        t,
        dur: BED_SEGMENT_MS,
        f0: 0,
        f1: 0,
        gain: lin("room"),
        env: [...SEG_ENV],
        filter: lp(bed.room.f),
        detune: 0,
        seed: (bed.seed + k * 131) >>> 0,
      });
    }
    if (bed.wind !== undefined) {
      events.push({
        kind: "noise",
        wave: "noise",
        t,
        dur: BED_SEGMENT_MS,
        f0: 0,
        f1: 0,
        gain: lin("wind"),
        env: [...SEG_ENV],
        filter: { type: "bandpass", f: [bed.wind.f[0], bed.wind.f[1]], q: 1, lfoHz: bed.wind.lfoHz },
        detune: 0,
        seed: (bed.seed + k * 131 + 17) >>> 0,
      });
    }
  }

  return events.sort((a, b) => a.t - b.t);
}
