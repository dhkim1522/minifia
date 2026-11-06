// 12-09: 밤·아침 소리 감독 규칙 (SOUND-02, D-10, D-11, D-12, LS-2, LS-3, LS-5, LS-7, LS-8, LS-10, LS-11).
// 감독은 순수 함수라 view 열과 로컬 시계·난수·불리언만 먹여 출력을 비교한다.
import { describe, expect, it } from "vitest";
import { NIGHT_MS } from "../../shared/game/phases";
import type { PhaseId, PublicPlayer, RoleId, RoomView } from "../../shared/protocol";
import { audioViewOf, type AudioView } from "../../src/audio/audioView";
import { direct, directEvent, directSignal, type DirectOutput, type LocalClock } from "../../src/audio/director";
import { RECIPES } from "../../src/audio/recipes";
import { MORNING_SLASH_AT, nightCues, NIGHT_CUE, willScript } from "../../src/audio/script";
import { KILL_FX_START_MS } from "../../src/components/KillFx";
import { ANNOUNCE_MORNING_AT, ANNOUNCE_VICTIM_AT, POLICE_CARD_AT } from "../../src/game/dayView";
import { LETTER_FOLD_AT_MS, LETTER_MS_PER_CHAR, LETTER_SEAL_GAP_MS, LETTER_WRITE_AT_MS, LETTER_WRITE_MAX_MS } from "../../src/game/willLetter";
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
    verdict: null,
    hasBallots: false,
    runoff: null,
    showdown: null,
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

// ───────────────────────── 아침 분기 (D-12) ─────────────────────────

describe("아침 진입: morning.dawn + bed.dawn 는 결과와 무관하고 분기만 갈린다", () => {
  const MORNING = (morning: AudioView["morning"]): AudioView => av("morning", { endsAt: NOW + 5_000, morning });
  const enter = (morning: AudioView["morning"]): DirectOutput => direct(NIGHT_VIEW(), MORNING(morning), clock());
  const scriptItems = (out: DirectOutput): { at: number; id: string }[] => out.scripts.flatMap((s) => s.items.map((i) => ({ at: i.at, id: i.id })));

  it("평화: morning.calm 이 ANNOUNCE_MORNING_AT 에", () => {
    const out = enter({ eliminated: false, saved: false });
    expect(out.bed).toBe("bed.dawn");
    expect(out.now.map((c) => c.id)).toEqual(["morning.dawn"]);
    expect(out.scripts.map((s) => s.key)).toEqual(["phase:morning:1"]);
    expect(scriptItems(out)).toEqual([{ at: ANNOUNCE_MORNING_AT, id: "morning.calm" }]);
  });

  it("구출: morning.saved 가 같은 시각에", () => {
    const out = enter({ eliminated: false, saved: true });
    expect(scriptItems(out)).toEqual([{ at: ANNOUNCE_MORNING_AT, id: "morning.saved" }]);
  });

  it("희생자: chalk.draw 가 ANNOUNCE_VICTIM_AT 에 (kill.slash 는 감독이 view 로는 내지 않는다)", () => {
    const out = enter({ eliminated: true, saved: false });
    expect(scriptItems(out)).toEqual([{ at: ANNOUNCE_VICTIM_AT, id: "chalk.draw" }]);
  });

  it("세 갈래 모두 morning.dawn 과 침대가 같다 (결과 무관, LS-1)", () => {
    const a = enter({ eliminated: false, saved: false });
    for (const m of [{ eliminated: false, saved: true }, { eliminated: true, saved: false }, null]) {
      const b = enter(m);
      expect(b.now).toEqual(a.now);
      expect(b.bed).toEqual(a.bed);
      expect(b.duck).toEqual(a.duck);
    }
  });

  it("아침 view 의 공개 모양: eliminated 존재·saved 여부만 읽는다 (누구인지는 읽지 않는다)", () => {
    const base = {
      code: "0042", phase: "morning" as const, phaseEndsAt: null, phaseDurationMs: null, serverNow: 0, minPlayers: 4, maxPlayers: 8,
      players: [0, 1, 2, 3].map((seat) => ({ seat, nickname: `p${seat}`, connected: true, isHost: seat === 0 })),
      me: { seat: 1, isHost: false },
    };
    const day = (morning?: { eliminated?: number; saved?: true }): RoomView => ({ ...base, day: { n: 1, roles: [], ...(morning ? { morning } : {}) } }) as RoomView;
    expect(audioViewOf(day()).morning).toBeNull();
    expect(audioViewOf(day({})).morning).toEqual({ eliminated: false, saved: false });
    expect(audioViewOf(day({ saved: true })).morning).toEqual({ eliminated: false, saved: true });
    expect(audioViewOf(day({ eliminated: 0 })).morning).toEqual({ eliminated: true, saved: false });
    expect(audioViewOf(day({ eliminated: 3 })).morning).toEqual(audioViewOf(day({ eliminated: 0 })).morning); // 누구든 같다
  });

  it("재접속(LS-10): 아침 중간 첫 view·epoch 변경은 bed.dawn 만 — morning.dawn·분기·slash 없음", () => {
    for (const m of [{ eliminated: true, saved: false }, { eliminated: false, saved: true }, { eliminated: false, saved: false }]) {
      const first = direct(null, MORNING(m), clock());
      const reset = direct(NIGHT_VIEW(), MORNING(m), clock({ reset: true }));
      for (const out of [first, reset]) {
        expect(out.bed).toBe("bed.dawn");
        expect(out.now).toEqual([]);
        expect(out.scripts).toEqual([]);
      }
    }
  });

  it("한 번 본 아침 view 가 되풀이되면 아무것도 새로 안 난다", () => {
    const a = MORNING({ eliminated: true, saved: false });
    expect(quiet(direct(a, structuredClone(a), clock()))).toBe(true);
  });

  it("아침을 떠나면 아침 대본·암살음·편지·경찰 카드 키가 모두 취소된다", () => {
    const out = direct(MORNING({ eliminated: true, saved: false }), av("dayAnnounce", { endsAt: NOW + 2000 }), clock());
    expect(out.cancel).toEqual(expect.arrayContaining(["phase:morning:1", "kill:1", "letter:1", "card:police:1"]));
  });
});

// ───────────────────────── 암살음 (LS-8) ─────────────────────────

describe("LS-8: 암살음은 피해자 본인만, 아침 도착 뒤", () => {
  const MORNING = av("morning", { endsAt: NOW + 7_000, morning: { eliminated: true, saved: false } });

  it("KILL_FX_START_MS(KillFx 의 시작 지연)와 MORNING_SLASH_AT 이 같은 값이다", () => {
    expect(MORNING_SLASH_AT).toBe(KILL_FX_START_MS);
  });

  it("killFx 입력이 서면 killFx.at + 50ms 에 kill.slash 한 번", () => {
    const out = directEvent({ kind: "kill", at: NOW }, MORNING, clock());
    expect(out.scripts.map((s) => s.key)).toEqual(["kill:1"]);
    expect(out.scripts[0]!.items).toEqual([{ at: KILL_FX_START_MS, id: "kill.slash" }]);
    expect(out.now).toEqual([]);
    const late = directEvent({ kind: "kill", at: NOW - 20 }, MORNING, clock());
    expect(late.scripts[0]!.items).toEqual([{ at: KILL_FX_START_MS - 20, id: "kill.slash" }]);
    const past = directEvent({ kind: "kill", at: NOW - 500 }, MORNING, clock());
    expect(past.now).toEqual([{ id: "kill.slash" }]);
  });

  it("밤 중·낮·ended·view 없음에서는 killFx 가 와도 소리가 없다", () => {
    for (const phase of ["night", "discussion", "nomination", "execution", "dayAnnounce", "ended"] as const) {
      expect(quiet(directEvent({ kind: "kill", at: NOW }, av(phase), clock())), phase).toBe(true);
    }
    expect(quiet(directEvent({ kind: "kill", at: NOW }, null, clock()))).toBe(true);
  });

  it("view 만으로는 어떤 갈래·재접속·밤에서도 kill.slash 가 나지 않는다 (killFx 입력이 없으면 출력 없음)", () => {
    const outs: DirectOutput[] = [];
    for (const m of [{ eliminated: true, saved: false }, { eliminated: false, saved: true }, { eliminated: false, saved: false }, null]) {
      outs.push(direct(NIGHT_VIEW(), av("morning", { endsAt: NOW + 5000, morning: m }), clock()));
      outs.push(direct(null, av("morning", { endsAt: NOW + 5000, morning: m }), clock()));
    }
    outs.push(direct(av("execution"), NIGHT_VIEW(), clock()), direct(null, NIGHT_VIEW(), clock()));
    for (const o of outs) {
      const all = [...o.now.map((c) => c.id), ...o.scripts.flatMap((s) => s.items.map((i) => i.id))];
      expect(all).not.toContain("kill.slash");
    }
  });
});

// ───────────────────────── 유언 편지 (C-5) ─────────────────────────

describe("유언 편지: t0 기준으로 quill → seal → fold", () => {
  const MORNING = av("morning", { endsAt: NOW + 9_000, morning: { eliminated: true, saved: false } });
  const abs = (out: DirectOutput, now: number): { at: number; id: string }[] => out.scripts.flatMap((s) => s.items.map((i) => ({ at: now + i.at, id: i.id }))).concat(out.now.map((c) => ({ at: now, id: c.id })));

  it("t0 가 앞에 있으면 willScript 의 모든 줄이 t0 + at 에 선다 (글은 입력에 없다)", () => {
    const t0 = NOW + 600;
    const writeMs = 1_900;
    const out = directEvent({ kind: "letter", t0, writeMs }, MORNING, clock());
    expect(out.scripts.map((s) => s.key)).toEqual(["letter:1"]);
    expect(abs(out, NOW).sort((a, b) => a.at - b.at)).toEqual(willScript({ writeMs }).items.map((i) => ({ at: t0 + i.at, id: i.id })));
    const ids = out.scripts[0]!.items.map((i) => i.id);
    expect(ids.filter((id) => id === "will.quill").length).toBe(Math.floor(writeMs / 60));
    expect(ids.slice(-2)).toEqual(["will.seal", "will.fold"]);
    const seal = out.scripts[0]!.items.find((i) => i.id === "will.seal")!;
    const fold = out.scripts[0]!.items.find((i) => i.id === "will.fold")!;
    expect(seal.at).toBe(600 + LETTER_WRITE_AT_MS + writeMs + LETTER_SEAL_GAP_MS);
    expect(fold.at).toBe(600 + LETTER_FOLD_AT_MS);
  });

  it("편지가 늦게 떠서 t0 가 이미 지났으면 지난 줄은 빼고 남은 줄만 난다", () => {
    const out = directEvent({ kind: "letter", t0: NOW - 2_000, writeMs: 1_900 }, MORNING, clock());
    for (const i of out.scripts[0]!.items) expect(i.at).toBeGreaterThanOrEqual(0);
    expect(out.scripts[0]!.items.at(-1)).toEqual({ at: LETTER_FOLD_AT_MS - 2_000, id: "will.fold" });
    expect(out.scripts[0]!.items.some((i) => i.id === "will.quill")).toBe(true);
  });

  it("쓰기 길이 상한은 상수 (190 × 글자, 최대 2300)", () => {
    expect(Math.min(LETTER_WRITE_MAX_MS, LETTER_MS_PER_CHAR * 4)).toBe(760);
  });

  it("편지가 없거나 writeMs 가 0 이하거나 아침이 아니면 없다", () => {
    expect(quiet(directEvent({ kind: "letter", t0: NOW, writeMs: 0 }, MORNING, clock()))).toBe(true);
    expect(quiet(directEvent({ kind: "letter", t0: NOW, writeMs: 1000 }, av("night"), clock()))).toBe(true);
    expect(quiet(directEvent({ kind: "letter", t0: NOW, writeMs: 1000 }, null, clock()))).toBe(true);
  });
});

// ───────────────────────── 카드 도착 (LS-5) ─────────────────────────

describe("카드 도착 ui.card: 종류 구분이 없다 (LS-5, T-12-34)", () => {
  const MORNING = av("morning", { endsAt: NOW + 9_000, morning: { eliminated: true, saved: false } });

  it("경찰 카드: policeCard 이벤트는 POLICE_CARD_AT 에 ui.card 한 번", () => {
    const out = directEvent({ kind: "policeCard" }, MORNING, clock());
    expect(out.scripts.map((s) => s.key)).toEqual(["card:police:1"]);
    expect(out.scripts[0]!.items).toEqual([{ at: POLICE_CARD_AT, id: "ui.card" }]);
  });

  it("카드 신호(유언·쪽지): delayMs 뒤 ui.card 한 번, 0 이면 즉시", () => {
    const out = directSignal({ kind: "card", delayMs: 2_800 }, MORNING);
    expect(out.scripts).toHaveLength(1);
    expect(out.scripts[0]!.items).toEqual([{ at: 2_800, id: "ui.card" }]);
    expect(directSignal({ kind: "card", delayMs: 0 }, MORNING).now).toEqual([{ id: "ui.card" }]);
    expect(directSignal({ kind: "card", delayMs: Number.NaN }, MORNING).now).toEqual([{ id: "ui.card" }]);
  });

  it("세 가지 카드(유언·쪽지·경찰)의 소리는 같은 id·같은 이득이고 레시피는 하나다", () => {
    const will = directSignal({ kind: "card", delayMs: 2_400 }, MORNING).scripts[0]!.items[0]!;
    const note = directSignal({ kind: "card", delayMs: 2_400 }, MORNING).scripts[0]!.items[0]!;
    const police = directEvent({ kind: "policeCard" }, MORNING, clock()).scripts[0]!.items[0]!;
    expect(will).toEqual(note);
    expect(police).toEqual({ at: POLICE_CARD_AT, id: "ui.card" });
    expect(will.id).toBe(police.id);
    expect(will).not.toHaveProperty("gainDb");
    expect(will).not.toHaveProperty("cents");
    expect(Object.keys(RECIPES).filter((id) => id.startsWith("ui.card"))).toEqual(["ui.card"]);
  });

  it("밤에는 카드 신호·경찰 카드 모두 무음", () => {
    expect(quiet(directSignal({ kind: "card", delayMs: 1_000 }, NIGHT_VIEW()))).toBe(true);
    expect(quiet(directEvent({ kind: "policeCard" }, NIGHT_VIEW(), clock()))).toBe(true);
  });

  it("ANNOUNCE 상수가 정해진 값이다 (400 / 700 / 2400)", () => {
    expect([ANNOUNCE_MORNING_AT, ANNOUNCE_VICTIM_AT, POLICE_CARD_AT]).toEqual([400, 700, 2400]);
  });
});
