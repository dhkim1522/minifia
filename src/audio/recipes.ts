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

export const BED_IDS = ["bed.lobby", "bed.reveal", "bed.day", "bed.vote", "bed.night", "bed.dawn", "bed.result"] as const;
export type BedId = (typeof BED_IDS)[number];
export const SFX_IDS = [
  "ui.tap", "ui.toggle", "ui.deny", "ui.card", "ui.host", "lobby.join", "game.start", "role.flip",
  "day.start", "timer.tick", "phase.vote", "pin.on", "pin.move", "pick.turn", "pick.tick", "pick.point",
  "pick.skip", "runoff.intro", "runoff.reveal", "showdown.reveal", "vote.cast",
  "verdict.heart", "ballot.yes", "ballot.no", "execution.gavel", "execution.rise", "verdict.reject",
  "night.fall", "night.cue", "kill.slash", "morning.dawn", "morning.calm", "chalk.draw", "morning.saved",
  "will.quill", "will.seal", "will.fold",
  "emote.clap", "emote.praise", "emote.handshake", "emote.dance", "emote.surprise", "emote.cry", "emote.deny",
  "emote.point", "emote.throat",
  "result.win", "result.lose", "award.plate", "award.final",
  // 튜토리얼(17-02, TUT-04, 결정 0080-8): 장면 효과음 12개 + 사회자 음절. voice.syl 이 끝에 온다
  "tut.lampOff", "tut.scream", "tut.whoosh", "tut.sting", "tut.step", "tut.eye", "tut.link", "tut.buzz", "tut.stamp",
  "tut.fanfare", "tut.flip", "tut.warm", "voice.syl",
] as const;
export type SfxId = (typeof SFX_IDS)[number];
/** 소리 id 70개: 침대 7 + 효과음 63 */
export const SOUND_IDS = [...BED_IDS, ...SFX_IDS] as const;
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

// 표기: 파형 시작→끝Hz · 길이 · 레벨(표 gainDb). 값은 UI-SPEC C-2 의 시작 레시피를 그대로 옮긴 기본값이다(듣고 조정).
// 표 gainDb 가 −24 보다 낮은 행(−26·−28·−30)은 recipe() 가 −24 로 막고 차이를 레이어 이득에 접는다(들리는 크기 같음).

const bp = (f0: number, f1 = f0, q = 1): Filter => ({ type: "bandpass", f: [f0, f1], q });
const hp = (f0: number, f1 = f0, q = 0.7): Filter => ({ type: "highpass", f: [f0, f1], q });
/** 둔탁한 한 번 울림 */
const thud = (dur: number): Env => [4, Math.max(1, dur - 10), 0, 20];

/** 같은 id 안의 변형(켬/끔). 직업별·카드 종류별 변형은 두지 않는다(LS-5) */
export const VARIANTS: Readonly<Partial<Record<SfxId, Readonly<Record<string, readonly Layer[]>>>>> = {
  "ui.toggle": {
    on: [osc("sine", 0, 90, [440, 660], 1, [3, 60, 0.3, 30])],
    off: [osc("sine", 0, 90, [440, 330], 1, [3, 60, 0.3, 30])],
  },
};

const EMOTE_GAP = 250;

export const RECIPES: Readonly<Record<SfxId, Recipe>> = {
  // 공통·로비·역할 확인
  "ui.tap": recipe("ui.tap", "ui", 2, -20, [osc("triangle", 0, 60, [520, 480], 1, perc(60))], { gapMs: 80 }),
  "ui.toggle": recipe("ui.toggle", "ui", 2, -18, VARIANTS["ui.toggle"]!["on"]!),
  "ui.deny": recipe("ui.deny", "ui", 2, -22, [
    osc("square", 0, 80, 180, 1, perc(80), { filter: lp(600) }),
    osc("square", 120, 80, 180, 1, perc(80), { filter: lp(600) }),
  ]),
  "ui.card": recipe("ui.card", "ui", 2, -24, [
    nz(0, 70, bp(2200, 2200, 2), 0.8, perc(70)),
    osc("sine", 20, 40, 880, 0.6, perc(40)),
  ]),
  // 사회자 알림(14-03, HOST-02, D-01): 맑은 종 두 음 상승 약 350ms. 음성·외부 샘플 없음(결정 0070). 800ms 안 되풀이는 gapMs 가 막는다
  "ui.host": recipe(
    "ui.host",
    "ui",
    2,
    -24,
    [osc("sine", 0, 120, 880, 1, perc(120)), osc("sine", 120, 230, 1318, 1, perc(230))],
    { gapMs: 800 },
  ),
  "lobby.join": recipe("lobby.join", "sfx", 2, -26, [osc("sine", 0, 80, [600, 800], 1, perc(80))]),
  "game.start": recipe(
    "game.start",
    "sfx",
    1,
    -16,
    [
      osc("sine", 0, 2800, [80, 200], 1, [400, 0, 1, 150]),
      nz(0, 2800, lp(200, 2000), 0.5, [1200, 0, 1, 150]),
    ],
    { duck: { db: -10, holdMs: 2800 } },
  ),
  "role.flip": recipe("role.flip", "sfx", 1, -22, [
    nz(0, 80, bp(1800, 1800, 1.5), 0.8, perc(80)),
    osc("triangle", 0, 120, 330, 0.7, [3, 110, 0, 20]),
  ]),

  // 낮·지목·변론
  "day.start": recipe("day.start", "sfx", 1, -16, [
    osc("sine", 0, 1200, 196, 1, [5, 1195, 0, 30]),
    osc("sine", 0, 1200, 392, 0.7, [5, 1195, 0, 30]),
  ]),
  "timer.tick": recipe("timer.tick", "sfx", 2, -28, [nz(0, 20, hp(3000), 1, perc(20))], { gapMs: 800 }),
  "phase.vote": recipe("phase.vote", "sfx", 1, -18, [
    osc("triangle", 0, 70, [220, 110], 1, perc(70)),
    osc("triangle", 140, 70, [220, 110], 1, perc(70)),
  ]),
  "pin.on": recipe("pin.on", "sfx", 1, -20, [
    osc("sine", 0, 180, 90, 1, [15, 100, 0.3, 40]),
    nz(0, 180, lp(400), 0.6, [15, 100, 0.3, 40]),
  ]),
  "pin.move": recipe("pin.move", "sfx", 2, -30, [nz(0, 900, bp(600, 1200, 1.2), 1, [200, 0, 1, 150])]),
  "pick.turn": recipe("pick.turn", "sfx", 1, -18, [
    osc("sine", 0, 60, 660, 1, perc(60)),
    osc("sine", 70, 60, 880, 1, perc(60)),
  ]),
  "pick.tick": recipe("pick.tick", "sfx", 2, -24, [
    nz(0, 15, hp(3000), 0.8, perc(15)),
    osc("sine", 0, 15, 520, 0.7, perc(15)),
  ]),
  "pick.point": recipe("pick.point", "sfx", 1, -22, [
    nz(0, 15, bp(3000, 3000, 1.5), 0.8, perc(15)),
    osc("sine", 0, 90, 330, 1, [3, 80, 0, 15]),
  ]),
  "pick.skip": recipe("pick.skip", "sfx", 2, -26, [osc("sine", 0, 200, [300, 200], 1, [3, 190, 0, 20])]),
  "runoff.intro": recipe("runoff.intro", "sfx", 1, -20, [
    osc("sine", 0, 600, 220, 1, [20, 400, 0.2, 120]),
    osc("sine", 0, 600, 330, 0.8, [20, 400, 0.2, 120]),
  ]),
  "runoff.reveal": recipe("runoff.reveal", "sfx", 1, -20, [
    osc("sine", 0, 90, 330, 1, perc(90)),
    osc("sine", 110, 120, 440, 1, perc(120)),
  ]),
  "showdown.reveal": recipe("showdown.reveal", "sfx", 1, -22, [
    osc("sine", 0, 30, 330, 1, perc(30)),
    osc("sine", 100, 30, 330, 1, perc(30)),
    osc("sine", 200, 30, 330, 1, perc(30)),
  ]),
  "vote.cast": recipe(
    "vote.cast",
    "ui",
    2,
    -22,
    [nz(0, 20, bp(2500, 2500, 1.5), 0.8, perc(20)), osc("sine", 10, 60, 180, 1, [3, 50, 0, 15])],
    { gapMs: 120 },
  ),

  // 판결·처형
  "verdict.heart": recipe("verdict.heart", "sfx", 0, -14, [
    osc("sine", 0, 120, 55, 1, [4, 90, 0, 20], { filter: lp(120) }),
    osc("sine", 160, 120, 55, dbToLin(-3), [4, 90, 0, 20], { filter: lp(120) }),
  ]),
  "ballot.yes": recipe("ballot.yes", "sfx", 1, -18, [osc("sine", 0, 150, 262, 1, thud(150), { filter: lp(800) })]),
  "ballot.no": recipe("ballot.no", "sfx", 1, -18, [osc("sine", 0, 150, 196, 1, thud(150), { filter: lp(800) })]),
  "execution.gavel": recipe(
    "execution.gavel",
    "sfx",
    0,
    -10,
    [nz(0, 30, lp(800), 1, perc(30)), osc("sine", 0, 220, [110, 60], 1, [3, 210, 0, 20])],
    { duck: { db: -12, holdMs: 1200 } },
  ),
  "execution.rise": recipe("execution.rise", "sfx", 1, -26, [
    osc("sine", 0, 2400, [220, 880], 1, [600, 0, 1, 500]),
    nz(0, 2400, bp(800, 2400, 1.5), 0.5, [900, 0, 1, 500]),
  ]),
  "verdict.reject": recipe("verdict.reject", "sfx", 1, -22, [
    osc("sine", 0, 100, 150, 1, thud(100)),
    osc("sine", 150, 100, 150, 1, thud(100)),
  ]),

  // 밤·아침
  "night.fall": recipe(
    "night.fall",
    "sfx",
    1,
    -18,
    [
      osc("sine", 0, 1800, [110, 55], 1, [100, 0, 1, 300], { filter: lp(500, 150) }),
      nz(0, 1800, lp(250, 120), 0.4, [300, 0, 1, 300]),
    ],
    { duck: { db: -12, holdMs: 1800 } },
  ),
  "night.cue": recipe("night.cue", "sfx", 2, -26, [
    nz(0, 40, lp(300), 1, perc(40)),
    nz(380, 40, lp(300), 1, perc(40)),
    osc("sine", 800, 120, 50, 1, [4, 90, 0, 20]),
    osc("sine", 960, 120, 50, dbToLin(-3), [4, 90, 0, 20]),
  ]),
  "kill.slash": recipe("kill.slash", "sfx", 0, -12, [
    nz(0, 200, hp(3000, 800), 1, [2, 190, 0, 20]),
    osc("sine", 0, 400, [140, 60], 1, [3, 390, 0, 30]),
  ]),
  "morning.dawn": recipe("morning.dawn", "sfx", 1, -22, [
    osc("sine", 0, 1200, [330, 392], 1, [600, 0, 1, 500]),
    osc("sine", 0, 1200, [495, 588], 0.7, [600, 0, 1, 500]),
  ]),
  "morning.calm": recipe("morning.calm", "sfx", 1, -24, [osc("sine", 0, 300, [392, 440], 1, [10, 280, 0, 40])]),
  "chalk.draw": recipe("chalk.draw", "sfx", 1, -28, [nz(0, 700, bp(2500, 2500, 3), 1, [40, 0, 1, 60])]),
  "morning.saved": recipe("morning.saved", "sfx", 1, -22, [
    osc("sine", 0, 120, 523, 1, perc(120)),
    osc("sine", 140, 160, 784, 1, perc(160)),
  ]),
  "will.quill": recipe("will.quill", "sfx", 2, -22, [nz(0, 60, bp(3500, 3500, 4), 1, [6, 40, 0.4, 14])]),
  "will.seal": recipe("will.seal", "sfx", 1, -18, [
    nz(0, 30, lp(500), 1, perc(30)),
    osc("sine", 0, 120, 95, 1, [3, 110, 0, 20]),
  ]),
  "will.fold": recipe("will.fold", "sfx", 2, -28, [nz(0, 220, hp(1500, 3000), 1, [10, 200, 0, 20])]),

  // 동작 9개
  "emote.clap": recipe("emote.clap", "sfx", 2, -20, [
    nz(0, 40, bp(2000, 2000, 1.5), 1, perc(40)),
    nz(80, 40, bp(2000, 2000, 1.5), 1, perc(40)),
    nz(160, 40, bp(2000, 2000, 1.5), 1, perc(40)),
  ], { gapMs: EMOTE_GAP }),
  "emote.praise": recipe("emote.praise", "sfx", 2, -24, [
    osc("sine", 0, 100, 440, 1, perc(100)),
    osc("sine", 120, 140, 587, 1, perc(140)),
  ], { gapMs: EMOTE_GAP }),
  "emote.handshake": recipe("emote.handshake", "sfx", 2, -24, [
    osc("sine", 0, 90, 130, 1, thud(90), { filter: lp(400) }),
    osc("sine", 150, 90, 130, 1, thud(90), { filter: lp(400) }),
  ], { gapMs: EMOTE_GAP }),
  "emote.dance": recipe("emote.dance", "sfx", 2, -26, [
    osc("triangle", 0, 70, 300, 1, perc(70)),
    osc("triangle", 150, 70, 300, 1, perc(70)),
    osc("triangle", 300, 70, 300, 1, perc(70)),
  ], { gapMs: EMOTE_GAP }),
  "emote.surprise": recipe("emote.surprise", "sfx", 2, -22, [osc("sine", 0, 120, [300, 700], 1, [3, 100, 0.2, 20])], {
    gapMs: EMOTE_GAP,
  }),
  "emote.cry": recipe(
    "emote.cry",
    "sfx",
    2,
    -26,
    [osc("sine", 0, 500, [440, 330], 1, [10, 400, 0.3, 60], { lfo: { hz: 6, cents: 30 } })],
    { gapMs: EMOTE_GAP },
  ),
  "emote.deny": recipe("emote.deny", "sfx", 2, -24, [
    osc("triangle", 0, 100, [330, 250], 1, perc(100)),
    osc("triangle", 140, 100, [330, 250], 1, perc(100)),
  ], { gapMs: EMOTE_GAP }),
  "emote.point": recipe("emote.point", "sfx", 2, -24, [
    nz(0, 15, bp(3000, 3000, 1.5), 0.8, perc(15)),
    osc("sine", 10, 40, 400, 1, perc(40)),
  ], { gapMs: EMOTE_GAP }),
  "emote.throat": recipe("emote.throat", "sfx", 2, -28, [nz(0, 300, bp(1500, 400, 1.2), 1, [40, 0, 1, 60])], {
    gapMs: EMOTE_GAP,
  }),

  // 결과·시상
  "result.win": recipe("result.win", "sfx", 0, -14, [
    osc("triangle", 0, 400, 262, 1, [20, 300, 0.4, 300], { filter: lp(1800) }),
    osc("triangle", 350, 400, 330, 1, [20, 300, 0.4, 300], { filter: lp(1800) }),
    osc("triangle", 700, 400, 392, 1, [20, 300, 0.4, 300], { filter: lp(1800) }),
  ]),
  "result.lose": recipe("result.lose", "sfx", 0, -16, [
    osc("triangle", 0, 600, 262, 1, [20, 500, 0.3, 300], { filter: lp(1500) }),
    osc("triangle", 500, 600, 247, 1, [20, 500, 0.3, 300], { filter: lp(1500) }),
  ]),
  "award.plate": recipe("award.plate", "sfx", 1, -20, [osc("sine", 0, 600, 784, 1, [3, 590, 0, 30])]),
  "award.final": recipe("award.final", "sfx", 0, -16, [
    osc("sine", 0, 600, 784, 1, [3, 590, 0, 30]),
    osc("sine", 0, 1200, 196, 0.8, [30, 1000, 0, 300]),
    osc("sine", 0, 1200, 294, 0.5, [30, 1000, 0, 300]),
  ]),

  // 튜토리얼 장면 효과음 12개(17-02, TUT-04, 결정 0080-8). 값은 승인 시안(design/v3.0/first-case/Sound.dc.html)의 소리 시트를 층 한계(4) 안으로 옮긴 것이다.
  // 같은 소리를 여러 번 내는 것(램프·걸음·뒤집기·링크)은 레시피 하나를 장면 대본이 여러 번 부른다. 시작 레벨은 −16~−24 dB, 듣고 조정은 v3.0 끝 실테스트.
  "tut.lampOff": recipe("tut.lampOff", "sfx", 2, -18, [
    osc("sine", 0, 280, [120, 60], 1, [3, 270, 0, 20]),
    nz(0, 60, bp(900, 900, 1.2), 0.34, perc(60)),
  ]),
  "tut.scream": recipe("tut.scream", "sfx", 2, -18, [
    osc("sawtooth", 0, 700, [1250, 520], 0.13, [20, 680, 0, 40]),
    osc("sine", 0, 700, [1310, 540], 0.2, [20, 680, 0, 40]),
    nz(0, 500, bp(1800, 1800, 0.8), 0.3, [10, 490, 0, 30]),
    osc("sine", 100, 1400, [73, 55], 1, [60, 1340, 0, 80]),
  ]),
  "tut.whoosh": recipe("tut.whoosh", "sfx", 2, -20, [nz(0, 320, bp(1400, 1400, 0.6), 1, [60, 260, 0, 40])]),
  "tut.sting": recipe("tut.sting", "sfx", 2, -18, [
    osc("sawtooth", 0, 1300, [146.8, 142.4], 0.12, [10, 1290, 0, 60]),
    osc("sawtooth", 20, 1300, [174.6, 169.4], 0.12, [10, 1290, 0, 60]),
    osc("sawtooth", 40, 1300, [207.7, 201.5], 0.12, [10, 1290, 0, 60]),
    osc("sine", 0, 1400, [55, 50], 1, [10, 1390, 0, 60]),
  ]),
  "tut.step": recipe("tut.step", "sfx", 2, -16, [nz(0, 50, bp(400, 400, 2), 1, perc(50))]),
  "tut.eye": recipe("tut.eye", "sfx", 2, -22, [
    osc("sine", 0, 180, [880, 1320], 1, [3, 170, 0, 20]),
    osc("sine", 120, 250, [1320, 1318], 0.67, [3, 240, 0, 30]),
  ]),
  "tut.link": recipe("tut.link", "sfx", 2, -22, [osc("triangle", 0, 350, [520, 780], 1, [10, 340, 0, 30])]),
  "tut.buzz": recipe("tut.buzz", "sfx", 2, -24, [osc("square", 0, 250, [140, 110], 1, [3, 240, 0, 20])]),
  "tut.stamp": recipe("tut.stamp", "sfx", 2, -18, [
    nz(0, 90, bp(300, 300, 0.7), 0.78, perc(90)),
    osc("sine", 0, 220, [90, 50], 1, [3, 210, 0, 20]),
  ]),
  // D·F·A·E 네 음 삼각파 0.5초, 0.11초 간격. 시안의 다섯 번째 음(C)과 옥타브 겹침 사인은 층 한계(4) 때문에 뺐다
  "tut.fanfare": recipe("tut.fanfare", "sfx", 2, -22, [
    osc("triangle", 0, 500, 293.7, 1, [5, 495, 0, 40]),
    osc("triangle", 110, 500, 349.2, 1, [5, 495, 0, 40]),
    osc("triangle", 220, 500, 440, 1, [5, 495, 0, 40]),
    osc("triangle", 330, 500, 659.3, 1, [5, 495, 0, 40]),
  ]),
  "tut.flip": recipe("tut.flip", "sfx", 2, -22, [
    nz(0, 90, bp(2400, 2400, 1.5), 1, perc(90)),
    osc("triangle", 50, 120, [440, 520], 0.5, [3, 110, 0, 20]),
  ]),
  "tut.warm": recipe("tut.warm", "sfx", 2, -24, [
    osc("sine", 0, 1600, 146.8, 1, [200, 1400, 0, 150]),
    osc("sine", 50, 1600, 220, 1, [200, 1400, 0, 150]),
    osc("sine", 100, 1600, 277.2, 1, [200, 1400, 0, 150]),
    osc("sine", 150, 1600, 329.6, 1, [200, 1400, 0, 150]),
  ]),

  // 튜토리얼 사회자 웅얼 목소리(17-02, TUT-04, 결정 0078-4·0080-8): 글자마다 음절 하나. 음높이는 대본 항목의 cents 로만 옮긴다.
  // 삼각 75ms(205→192.7Hz) + 사인 2배음 50ms(412→389.5Hz), 이득비 0.15:0.035. ui 버스라 효과음 위로 덮이지 않는다. 음성·TTS·녹음 없음
  "voice.syl": recipe("voice.syl", "ui", 2, -16, [
    osc("triangle", 0, 75, [205, 192.7], 1, perc(75)),
    osc("sine", 0, 50, [412, 389.5], 0.035 / 0.15, perc(50)),
  ]),
};

// ───────────────────────── 침대 표 ─────────────────────────
// 코드 진행은 일반 화성 기능(D 단조 순환)만 쓴다. 알려진 곡의 선율을 옮기지 않는다.

const MINOR_LOOP: readonly (readonly number[])[] = [
  [50, 57, 60, 64], // Dm9
  [55, 58, 62, 65], // Gm9
  [61, 64, 67, 70], // A7♭9
  [50, 57, 60, 64], // Dm9
];
const MINOR_LOOP_BASS = [38, 43, 45, 38];

export const BEDS: Readonly<Record<BedId, Bed>> = {
  "bed.lobby": {
    id: "bed.lobby",
    bpm: 64,
    seed: 11,
    chords: MINOR_LOOP,
    barsPerChord: 4,
    bass: MINOR_LOOP_BASS,
    pad: { wave: "triangle", filter: { type: "lowpass", f: [700, 1100], q: 0.7, lfoHz: 0.08 } },
    brush: 1,
    db: { pad: -26, bass: -20, brush: -34 },
  },
  "bed.reveal": {
    id: "bed.reveal",
    bpm: 60,
    seed: 23,
    chords: [],
    barsPerChord: 1,
    bass: [],
    // D1(36.7Hz)은 40Hz 한계 밖이라 한 옥타브 위 D2 로 둔다(폰 스피커 대역)
    drone: { notes: [38, 33], open: { from: 300, to: 1200, ms: 15000 } },
    db: { drone: -28 },
  },
  "bed.day": {
    id: "bed.day",
    bpm: 76,
    seed: 31,
    chords: MINOR_LOOP,
    barsPerChord: 4,
    bass: MINOR_LOOP_BASS,
    pad: { wave: "triangle", filter: { type: "lowpass", f: [1200, 1600], q: 0.7, lfoHz: 0.08 } },
    brush: 1,
    notes: { p: 0.3, octave: 1 },
    db: { pad: -26, bass: -20, brush: -34, notes: -24 },
  },
  "bed.vote": {
    id: "bed.vote",
    bpm: 60,
    seed: 41,
    chords: [[50, 57, 62, 65]], // Dm
    barsPerChord: 4,
    bass: [],
    pad: { wave: "triangle", filter: { type: "lowpass", f: [500, 700], q: 0.7, lfoHz: 0.1 } },
    drone: { notes: [38] }, // D2 페달
    db: { pad: -28, drone: -24 },
  },
  "bed.night": {
    id: "bed.night",
    bpm: 60,
    seed: 5,
    chords: [],
    barsPerChord: 1,
    bass: [],
    drone: { notes: [38, 33] },
    room: { f: 300 },
    wind: { f: [400, 800], lfoHz: 0.05 },
    db: { drone: -34, room: -40, wind: -40 },
  },
  "bed.dawn": {
    id: "bed.dawn",
    bpm: 60,
    seed: 59,
    chords: [],
    barsPerChord: 1,
    bass: [],
    drone: { notes: [74, 81], open: { from: 500, to: 4000, ms: 5000 } },
    db: { drone: -30 },
  },
  "bed.result": {
    id: "bed.result",
    bpm: 56,
    seed: 67,
    chords: MINOR_LOOP,
    barsPerChord: 4,
    bass: [],
    notes: { p: 0.2, octave: 1 },
    db: { notes: -22 },
  },
};

// ───────────────────────── 화면 대응 (LS-1) ─────────────────────────
// 소리가 붙는 사건을 이미 화면이 보여 주는 곳을 한 줄로 적는다. 소리만 아는 정보는 없다.
// 'ambient' 로 시작하는 줄은 분위기 소리(정보가 아니다): 침대 7개와 night.cue 뿐.

export const SCREEN_COUNTERPART: Readonly<Record<SoundId, string>> = {
  "bed.lobby": "ambient: 로비 화면 전체의 분위기",
  "bed.reveal": "ambient: 역할 카드 공개 장면의 분위기",
  "bed.day": "ambient: 낮 장면의 분위기",
  "bed.vote": "ambient: 지목·변론·판결 장면의 긴장 분위기",
  "bed.night": "ambient: 밤 장면의 분위기(모든 역할이 같다)",
  "bed.dawn": "ambient: 아침 장면의 분위기",
  "bed.result": "ambient: 결과 장면의 분위기",
  "ui.tap": "눌린 버튼의 눌림 모양",
  "ui.toggle": "소리 단추의 켬/끔 모양 변화",
  "ui.deny": "거절 토스트가 뜨는 모습",
  "ui.card": "카드·편지가 화면에 도착하는 모습",
  "ui.host": "자막 띠 문장이 바뀌는 모습",
  "lobby.join": "입장 토스트와 새로 선 캐릭터",
  "game.start": "시작 직후 배정 연출 화면",
  "role.flip": "역할 카드가 뒤집히는 모습",
  "day.start": "낮이 되었습니다 알림 문구와 낮 장면",
  "timer.tick": "마지막 5초 숫자 카운트다운의 빨간 숫자",
  "phase.vote": "지목 단계 이름 표시와 후보 서기",
  "pin.on": "핀 조명이 켜지는 모습",
  "pin.move": "핀 조명이 다음 사람에게 옮겨 가는 모습",
  "pick.turn": "내 차례 알약과 핀 조명",
  "pick.tick": "내 차례 남은 시간 숫자",
  "pick.point": "캐릭터가 손가락으로 가리키는 몸동작",
  "pick.skip": "기권으로 차례가 넘어가는 표시",
  "runoff.intro": "결선 후보 둘이 서는 모습",
  "runoff.reveal": "결선 득표 수 숫자가 나타나는 모습",
  "showdown.reveal": "마지막 3인의 지목 화살표가 동시에 드러나는 모습",
  "vote.cast": "찬반 카드에서 눌린 선택의 강조",
  "verdict.heart": "판결 순간의 줌과 어두워지는 화면",
  "ballot.yes": "찬성 묶음이 등장하는 모습",
  "ballot.no": "반대 묶음이 등장하는 모습",
  "execution.gavel": "처형 확정 알림 문구가 뜨는 모습",
  "execution.rise": "처형된 유령이 반투명으로 떠오르는 모습",
  "verdict.reject": "처형 없음 알림 문구",
  "night.fall": "밤 장면으로 바뀌는 전환",
  "night.cue": "ambient: 밤 긴장 맥박 비네트(모든 폰이 각자 난수로 같은 규칙)",
  "kill.slash": "암살 이펙트 번쩍임",
  "morning.dawn": "아침 장면으로 바뀌는 전환",
  "morning.calm": "평화로운 밤 알림 문구",
  "chalk.draw": "분필 윤곽과 희생자 알림",
  "morning.saved": "누군가 살아났어요 알림 문구",
  "will.quill": "유언 편지에 깃펜으로 글이 써지는 모습",
  "will.seal": "편지에 인장이 찍히는 모습",
  "will.fold": "편지가 접히는 모습",
  "emote.clap": "캐릭터의 박수 몸동작",
  "emote.praise": "캐릭터의 최고 몸동작",
  "emote.handshake": "캐릭터의 악수 몸동작",
  "emote.dance": "캐릭터의 춤 몸동작",
  "emote.surprise": "캐릭터의 깜짝 몸동작",
  "emote.cry": "캐릭터의 엉엉 몸동작",
  "emote.deny": "캐릭터의 손사래 몸동작",
  "emote.point": "캐릭터의 손가락 몸동작",
  "emote.throat": "캐릭터의 목긋기 몸동작",
  "result.win": "이긴 팀 조명과 결과 화면",
  "result.lose": "진 팀의 결과 화면",
  "award.plate": "시상 패가 등장하는 모습",
  "award.final": "마지막 큰 칭호 패가 등장하는 모습",
  "tut.lampOff": "오프닝 램프 번짐 하나가 어두워질 때",
  "tut.scream": "오프닝에서 한 사람이 사라지며 진홍빛이 번쩍일 때",
  "tut.whoosh": "장면이 바뀌며 새 무대가 미끄러져 들어올 때",
  "tut.sting": "사회자의 무거운 줄이 나올 때 화면이 어두워지는 모습",
  "tut.step": "발자국 표시가 하나씩 찍힐 때",
  "tut.eye": "눈 표시가 켜질 때",
  "tut.link": "두 사람을 잇는 선이 그어질 때",
  "tut.buzz": "오답 지목에 줄이 흔들릴 때",
  "tut.stamp": "정답 지목 도장이 찍힐 때",
  "tut.fanfare": "정체 카드가 뒤집혀 뜰 때",
  "tut.flip": "직업 카드 한 장이 뒤집힐 때",
  "tut.warm": "마지막 장면에 따뜻한 조명이 들어올 때",
  "voice.syl": "사회자 띠 파형 막대가 움직이는 동안 글자마다 한 음절",
};

/** 분위기 소리(정보가 아니다): 침대 7개와 night.cue */
export const AMBIENT_IDS: readonly SoundId[] = [...BED_IDS, "night.cue"];

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

/**
 * 최악 합 노드 수: 가장 큰 침대 + 노드가 많은 효과음 상위 SFX_VOICE_MAX 개.
 * 합이 NODE_BUDGET 을 넘는 조합이 있을 수 있다 — 엔진이 우선순위 낮은 것 → 오래된 것 순으로 보이스를 끊어 지킨다(12-05).
 */
export function worstCaseNodes(): number {
  const bed = Math.max(...BED_IDS.map((id) => bedNodeCount(BEDS[id])));
  const top = SFX_IDS.map((id) => recipeNodeCount(id))
    .sort((a, b) => b - a)
    .slice(0, SFX_VOICE_MAX);
  return bed + top.reduce((a, b) => a + b, 0);
}
