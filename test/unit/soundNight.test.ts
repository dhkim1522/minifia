// 12-09: 밤·아침 소리 감독 규칙 (SOUND-02, D-10, D-11, D-12, LS-2, LS-3, LS-5, LS-7, LS-8, LS-10, LS-11).
// 감독은 순수 함수라 view 열과 로컬 시계·난수·불리언만 먹여 출력을 비교한다.
import { describe, expect, it } from "vitest";
import { NIGHT_MS } from "../../shared/game/phases";
import type { PhaseId, PublicPlayer, RoleId, RoomView } from "../../shared/protocol";
import { audioViewOf, type AudioView } from "../../src/audio/audioView";
import { direct, directSignal, type DirectOutput, type LocalClock } from "../../src/audio/director";
import { nightCues, NIGHT_CUE } from "../../src/audio/script";
import { SIGNAL_KINDS, type LocalSignal } from "../../src/audio/signals";
import { nightDarkOf } from "../../src/game/nightDark";
import { planTensionCues } from "../../src/world/tension";
import { seededRandInt } from "../helpers/seededRandom";

const NOW = 1_000_000;

/** 시드 난수 [0,1) — planTensionCues·nightCues 가 같은 난수열을 받도록 시험이 만든다 */
function rngOf(seed: number): () => number {
  const next = seededRandInt(seed);
  return () => next(1_000_000) / 1_000_000;
}

function clock(over: Partial<LocalClock> = {}): LocalClock {
  return { now: NOW, offset: 0, reset: false, lastJoinAt: null, rng: rngOf(1), visualCues: false, ...over };
}

function av(phase: PhaseId, over: Partial<AudioView> = {}): AudioView {
  return {
    phase,
    endsAt: null,
    dayN: 1,
    turn: null,
    points: [],
    candidate: null,
    morning: null,
    players: [0, 1, 2, 3].map((seat) => ({ seat, alive: true })),
    mySeat: 0,
    ...over,
  };
}

const ids = (out: DirectOutput): string[] => out.now.map((c) => c.id);
const quiet = (out: DirectOutput): boolean => out.cancel.length === 0 && !("bed" in out) && out.scripts.length === 0 && out.now.length === 0 && out.duck === null;
const cueAts = (out: DirectOutput): number[] => out.scripts.flatMap((s) => s.items.filter((i) => i.id === "night.cue").map((i) => i.at));

/** 큐 규칙(C-4): 개수 2~4, 첫 큐 ≥ 5000, 간격 4000~9000, 창 28000 이내 */
function expectCueRule(at: number[]): void {
  expect(at.length).toBeGreaterThanOrEqual(NIGHT_CUE.countMin);
  expect(at.length).toBeLessThanOrEqual(NIGHT_CUE.countMax);
  expect(at[0]!).toBeGreaterThanOrEqual(NIGHT_CUE.firstMin);
  for (let i = 1; i < at.length; i += 1) {
    const gap = at[i]! - at[i - 1]!;
    expect(gap).toBeGreaterThanOrEqual(NIGHT_CUE.gapMin);
    expect(gap).toBeLessThanOrEqual(NIGHT_CUE.gapMax);
  }
  expect(at[at.length - 1]!).toBeLessThan(NIGHT_CUE.windowMs);
}

const NIGHT_VIEW = (): AudioView => av("night", { endsAt: NOW + NIGHT_MS });
const SEEDS = Array.from({ length: 40 }, (_, i) => i + 1);

// ───────────────────────── nightDarkOf ─────────────────────────

describe("nightDarkOf: 시민 편 밤 어둠 판정 (GameMap 의 nightDark 와 같은 식)", () => {
  const players = (deadSeat?: number): PublicPlayer[] =>
    [0, 1, 2, 3].map((seat) => ({ seat, nickname: `p${seat}`, connected: true, isHost: seat === 0, ...(seat === deadSeat ? { alive: false } : {}) }));
  const view = (phase: PhaseId, role: RoleId | undefined, deadSeat?: number): RoomView =>
    ({
      code: "0042",
      phase,
      phaseEndsAt: null,
      phaseDurationMs: null,
      serverNow: 0,
      minPlayers: 4,
      maxPlayers: 8,
      players: players(deadSeat),
      me: { seat: 1, isHost: false, ...(role !== undefined ? { role } : {}) },
    }) as RoomView;

  it("밤 + 산 사람 + 마피아가 아니면 참 (시민·경찰·의사)", () => {
    for (const role of ["citizen", "police", "doctor"] as const) expect(nightDarkOf(view("night", role)), role).toBe(true);
  });

  it("마피아·유령·낮·아침은 거짓", () => {
    expect(nightDarkOf(view("night", "mafia"))).toBe(false);
    expect(nightDarkOf(view("night", "citizen", 1))).toBe(false);
    expect(nightDarkOf(view("discussion", "citizen"))).toBe(false);
    expect(nightDarkOf(view("morning", "police"))).toBe(false);
  });

  it("내 좌석이 목록에 없으면 산 사람으로 본다", () => {
    const v = view("night", "citizen");
    v.players = v.players.filter((p) => p.seat !== 1);
    expect(nightDarkOf(v)).toBe(true);
  });
});

// ───────────────────────── 밤 진입 (D-10, D-11) ─────────────────────────

describe("밤 진입: night.fall + bed.night + 큐 (소리 전용 갈래 / 시각 갈래)", () => {
  it("소리 전용 갈래: night.fall 즉시, 침대 bed.night, 큐 대본 night:1 이 planTensionCues 와 같은 목록", () => {
    for (const seed of SEEDS) {
      const out = direct(av("execution"), NIGHT_VIEW(), clock({ rng: rngOf(seed) }));
      expect(out.bed).toBe("bed.night");
      expect(ids(out)).toEqual(["night.fall"]);
      expect(out.scripts.map((s) => s.key)).toEqual(["night:1"]);
      expect(out.scripts[0]!.items.every((i) => i.id === "night.cue")).toBe(true);
      expect(cueAts(out)).toEqual(planTensionCues(rngOf(seed)));
      expect(cueAts(out)).toEqual(nightCues(rngOf(seed)));
      expectCueRule(cueAts(out));
    }
  });

  it("시각 갈래(visualCues 참): night.fall·침대는 같고 큐 대본은 없다 (큐는 tensionCue 신호가 낸다)", () => {
    const out = direct(av("execution"), NIGHT_VIEW(), clock({ visualCues: true }));
    expect(out.bed).toBe("bed.night");
    expect(ids(out)).toEqual(["night.fall"]);
    expect(out.scripts).toEqual([]);
  });

  it("밤이 아니게 되면 큐 대본을 취소한다", () => {
    const out = direct(NIGHT_VIEW(), av("morning", { endsAt: NOW + 5000 }), clock());
    expect(out.cancel).toContain("night:1");
  });

  it("같은 밤 view 가 되풀이되거나 밤 안에서 공개 필드가 그대로면 빈 출력", () => {
    const a = NIGHT_VIEW();
    expect(quiet(direct(a, structuredClone(a), clock()))).toBe(true);
  });

  it("tensionCue 신호: 밤이고 visualCues 가 참일 때만 night.cue 하나", () => {
    const sig: LocalSignal = { kind: "tensionCue" };
    expect(directSignal(sig, NIGHT_VIEW(), { visualCues: true }).now).toEqual([{ id: "night.cue" }]);
    expect(quiet(directSignal(sig, NIGHT_VIEW(), { visualCues: false }))).toBe(true);
    expect(quiet(directSignal(sig, NIGHT_VIEW()))).toBe(true);
    expect(quiet(directSignal(sig, av("discussion"), { visualCues: true }))).toBe(true);
    expect(quiet(directSignal(sig, null, { visualCues: true }))).toBe(true);
  });
});

// ───────────────────────── LS-2 메타모픽 ─────────────────────────

describe("LS-2: 밤 동안 서버 프레임이 소리를 만들지 않는다", () => {
  const players: PublicPlayer[] = [0, 1, 2, 3, 4].map((seat) => ({ seat, nickname: `p${seat}`, connected: true, isHost: seat === 0 }));
  const nightView = (): RoomView => ({
    code: "0042",
    phase: "night",
    round: 1,
    phaseEndsAt: NOW + NIGHT_MS,
    phaseDurationMs: NIGHT_MS,
    serverNow: NOW,
    minPlayers: 4,
    maxPlayers: 8,
    players,
    me: { seat: 2, isHost: false },
    day: { n: 1, roles: ["mafia", "citizen"] },
  });

  const mutations: [string, (v: RoomView) => void][] = [
    ["role", (v) => { v.me.role = "mafia"; }],
    ["role doctor", (v) => { v.me.role = "doctor"; }],
    ["role police", (v) => { v.me.role = "police"; }],
    ["pick", (v) => { v.me.pick = 3; }],
    ["allyPicks·allies", (v) => { v.me.allyPicks = [1, 4]; v.me.allies = [0]; }],
    ["nightTally·nightSure", (v) => { v.me.nightTally = [{ seat: 3, n: 2 }]; v.me.nightSure = 3; }],
    ["records", (v) => { v.me.records = [{ n: 1, kind: "investigate", target: 1, mafia: true } as never]; }],
    ["spectate.picks", (v) => { v.spectate = { seats: [], picks: { mafia: [1], police: [2], doctor: [3] } } as never; }],
    ["chat·whisper", (v) => { v.me.chat = "mafia"; v.me.whisperUsed = true; }],
  ];

  it("같은 밤 진입을 선택·치료·조사 값만 바꿔 넣어도 audioView 와 감독 출력이 같다", () => {
    const prev = nightView();
    prev.phase = "execution";
    const want = direct(audioViewOf(prev), audioViewOf(nightView()), clock({ rng: rngOf(7) }));
    for (const [name, m] of mutations) {
      const v = nightView();
      m(v);
      expect(audioViewOf(v), name).toEqual(audioViewOf(nightView()));
      expect(direct(audioViewOf(prev), audioViewOf(v), clock({ rng: rngOf(7) })), name).toEqual(want);
    }
  });

  it("밤 안에서 view 가 바뀌어도(선택·확정 등 비공개 변화) 감독 출력은 빈 출력이다", () => {
    const a = nightView();
    for (const [name, m] of mutations) {
      const b = nightView();
      m(b);
      expect(quiet(direct(audioViewOf(a), audioViewOf(b), clock())), name).toBe(true);
    }
  });
});

// ───────────────────────── LS-3 역할 동일성 ─────────────────────────

describe("LS-3: 밤 소리는 역할과 무관하게 같은 대본이다", () => {
  const ROLES = ["mafia", "citizen", "police", "doctor", "ghost"] as const;

  /** 한 폰이 밤 진입에서 낸 소리 열: 침대·즉시 소리·큐 시각. visualCues 는 RoomScreen 이 계산하는 불리언 하나 */
  function nightRun(role: (typeof ROLES)[number], reducedMotion: boolean, seed: number): { ids: Set<string>; cues: number[] } {
    const alive = role !== "ghost";
    const visualCues = alive && role !== "mafia" && !reducedMotion; // nightDarkOf(view) && !reducedMotion
    const out = direct(av("execution"), NIGHT_VIEW(), clock({ rng: rngOf(seed), visualCues }));
    const set = new Set<string>();
    if (typeof out.bed === "string") set.add(out.bed);
    for (const id of ids(out)) set.add(id);
    let cues: number[];
    if (visualCues) {
      // 시각 갈래: TensionVignette 가 planTensionCues(rng) 시각에 tensionCue 신호를 낸다
      cues = planTensionCues(rngOf(seed));
      for (const _ of cues) for (const c of directSignal({ kind: "tensionCue" }, NIGHT_VIEW(), { visualCues }).now) set.add(c.id);
    } else {
      cues = cueAts(out);
      for (const s of out.scripts) for (const i of s.items) set.add(i.id);
    }
    return { ids: set, cues };
  }

  it("역할 다섯 × 모션 줄이기 × 시드 열: id 집합은 {bed.night, night.fall, night.cue} 로 같고 큐는 2~4개 규칙을 지킨다", () => {
    for (const seed of SEEDS) {
      for (const role of ROLES) {
        for (const reduced of [false, true]) {
          const run = nightRun(role, reduced, seed);
          expect([...run.ids].sort(), `${role}/${reduced}/${seed}`).toEqual(["bed.night", "night.cue", "night.fall"]);
          expectCueRule(run.cues);
        }
      }
    }
  });

  it("두 갈래의 큐 시각과 개수는 같은 시드에서 같다 (갈림 불리언이 대본을 바꾸지 않는다)", () => {
    for (const seed of SEEDS) {
      expect(nightRun("mafia", false, seed).cues).toEqual(nightRun("citizen", false, seed).cues);
      expect(nightRun("ghost", true, seed).cues).toEqual(nightRun("police", false, seed).cues);
    }
  });

  it("갈림 불리언은 즉시 소리·침대·덕킹에 영향이 없다", () => {
    const a = direct(av("execution"), NIGHT_VIEW(), clock({ visualCues: true }));
    const b = direct(av("execution"), NIGHT_VIEW(), clock({ visualCues: false }));
    expect({ ...a, scripts: [] }).toEqual({ ...b, scripts: [] });
  });
});

// ───────────────────────── LS-7 밤 UI 무음 ─────────────────────────

describe("LS-7: 밤의 모든 UI 조작은 무음이다", () => {
  /** 닫힌 신호 종류마다 대표 신호 하나. 종류가 늘면 여기에도 더해야 시험이 통과한다 */
  const SAMPLE: Record<(typeof SIGNAL_KINDS)[number], LocalSignal> = {
    tap: { kind: "tap" },
    card: { kind: "card", delayMs: 0 },
    tensionCue: { kind: "tensionCue" },
  } as never;

  it("대표 신호표가 닫힌 목록 전부를 덮는다", () => {
    expect(Object.keys(SAMPLE).sort()).toEqual([...SIGNAL_KINDS].sort());
  });

  it("밤에 visualCues 거짓이면 어떤 신호도 소리를 만들지 않는다", () => {
    for (const kind of SIGNAL_KINDS) expect(quiet(directSignal(SAMPLE[kind], NIGHT_VIEW(), { visualCues: false })), kind).toBe(true);
  });

  it("밤에 visualCues 참이어도 시각 큐 신호(tensionCue) 하나만 night.cue 를 만든다", () => {
    for (const kind of SIGNAL_KINDS) {
      const out = directSignal(SAMPLE[kind], NIGHT_VIEW(), { visualCues: true });
      if (kind === "tensionCue") expect(out.now).toEqual([{ id: "night.cue" }]);
      else expect(quiet(out), kind).toBe(true);
    }
  });

  it("낮에는 tap 이 ui.tap 을 만든다 (밤 게이트가 낮을 막지 않는다)", () => {
    expect(directSignal({ kind: "tap" }, av("discussion")).now).toEqual([{ id: "ui.tap" }]);
  });
});

// ───────────────────────── 재접속 (LS-10, LS-11) ─────────────────────────

describe("밤 재접속·도착 지연 (LS-10, LS-11)", () => {
  it("밤 중간 첫 view(직전 없음)·epoch 변경: 침대만 + 남은 시간 안의 새 큐, night.fall 없음", () => {
    for (const seed of SEEDS) {
      for (const rest of [28_000, 20_000, 12_000, 6_000, 1_500]) {
        const view = av("night", { endsAt: NOW + rest });
        const first = direct(null, view, clock({ rng: rngOf(seed) }));
        const reset = direct(av("night", { endsAt: NOW + rest + 3000 }), view, clock({ rng: rngOf(seed), reset: true }));
        for (const out of [first, reset]) {
          expect(out.bed).toBe("bed.night");
          expect(out.now).toEqual([]);
          const delays = cueAts(out);
          expect(delays.length).toBeLessThanOrEqual(NIGHT_CUE.countMax);
          for (const d of delays) {
            expect(d).toBeGreaterThanOrEqual(0);
            expect(d).toBeLessThanOrEqual(rest - 1000);
          }
        }
      }
    }
  });

  it("재접속에서도 visualCues 가 참이면 큐 대본은 없다 (시각 맥박이 새로 시작한다)", () => {
    const out = direct(null, av("night", { endsAt: NOW + 12_000 }), clock({ visualCues: true }));
    expect(out.bed).toBe("bed.night");
    expect(out.scripts).toEqual([]);
  });

  it("epoch 변경은 이전 view 의 밤 대본 키를 취소한다", () => {
    const out = direct(NIGHT_VIEW(), NIGHT_VIEW(), clock({ reset: true }));
    expect(out.cancel).toContain("night:1");
  });

  it("view 도착이 늦어도 큐의 서버 시각은 같고 night.fall 은 진입 즉시다 (LS-11)", () => {
    const endsAt = 9_000_000;
    const abs = (late: number): number[] => {
      const local = clock({ now: endsAt - NIGHT_MS + late, rng: rngOf(5) });
      const out = direct(av("execution"), av("night", { endsAt }), local);
      expect(ids(out)).toEqual(["night.fall"]);
      return cueAts(out).map((d) => local.now + local.offset + d);
    };
    const base = abs(0);
    expect(base).toEqual(nightCues(rngOf(5)).map((c) => endsAt - NIGHT_MS + c));
    for (const late of [1, 120, 900, 3_000]) expect(abs(late)).toEqual(base);
  });

  it("아주 늦게 도착하면(남은 시간이 줄어) 큐 창이 남은 시간 안으로만 줄어든다", () => {
    const endsAt = 9_000_000;
    for (const seed of SEEDS) {
      for (const late of [5_000, 12_000, 20_000]) {
        const local = clock({ now: endsAt - NIGHT_MS + late, rng: rngOf(seed) });
        const out = direct(av("execution"), av("night", { endsAt }), local);
        for (const d of cueAts(out)) expect(d).toBeLessThanOrEqual(NIGHT_MS - late - 1000);
      }
    }
  });
});
