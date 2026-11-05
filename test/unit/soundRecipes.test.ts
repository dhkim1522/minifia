// 12-02: 소리 레시피 — 순수 데이터와 결정적 렌더 계획 (D-1, D-16, D-18). 오디오 출력 없이 한계·결정성을 건다.
import { describe, expect, it } from "vitest";
import { EMOTE_IDS } from "../../shared/protocol";
import {
  AMBIENT_IDS,
  BEDS,
  BED_IDS,
  BED_NODE_MAX,
  BED_OSC_MAX,
  GAIN_DB_MIN,
  NODE_BUDGET,
  RECIPE_NODE_MAX,
  SCREEN_COUNTERPART,
  SFX_IDS,
  SOUND_IDS,
  SFX_VOICE_MAX,
  VARIANTS,
  bedNodeCount,
  bedNoiseCount,
  recipeNodeCount,
  worstCaseNodes,
  BUS_GAIN,
  COMPRESSOR,
  FREQ_MAX,
  FREQ_MIN,
  LFO_MAX_HZ,
  MASTER_GAIN,
  MAX_LAYERS,
  MAX_RECIPE_MS,
  PEAK_DBFS_MAX,
  RECIPES,
  bedOscCount,
  bedPlan,
  midiToHz,
  mulberry32,
  peakDbEstimate,
  planHash,
  recipeDurationMs,
  renderPlan,
  type PlanEvent,
} from "../../src/audio/recipes";

function assertSane(plan: readonly PlanEvent[]): void {
  for (const e of plan) {
    for (const v of [e.t, e.dur, e.f0, e.f1, e.gain, e.detune, ...e.env]) expect(Number.isFinite(v)).toBe(true);
    expect(e.t).toBeGreaterThanOrEqual(0);
    expect(e.dur).toBeGreaterThan(0);
    expect(e.gain).toBeGreaterThan(0);
    if (e.kind === "osc") {
      expect(e.f0).toBeGreaterThanOrEqual(FREQ_MIN);
      expect(e.f0).toBeLessThanOrEqual(FREQ_MAX);
      expect(e.f1).toBeGreaterThanOrEqual(FREQ_MIN);
      expect(e.f1).toBeLessThanOrEqual(FREQ_MAX);
    }
    if (e.filter !== undefined) {
      for (const f of e.filter.f) {
        expect(f).toBeGreaterThanOrEqual(FREQ_MIN);
        expect(f).toBeLessThanOrEqual(FREQ_MAX);
      }
    }
  }
  const times = plan.map((e) => e.t);
  expect(times).toEqual([...times].sort((a, b) => a - b));
}

describe("소리 레시피 — 트레이서 (D-1, D-18)", () => {
  it("midiToHz: A4=440, A3=220", () => {
    expect(Math.abs(midiToHz(69) - 440)).toBeLessThan(1e-9);
    expect(Math.abs(midiToHz(57) - 220)).toBeLessThan(1e-9);
  });

  it("mulberry32: 같은 시드는 같은 열, 0 이상 1 미만", () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    const seqA = Array.from({ length: 50 }, () => a());
    const seqB = Array.from({ length: 50 }, () => b());
    expect(seqA).toEqual(seqB);
    for (const v of seqA) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
    expect(mulberry32(43)()).not.toBe(seqA[0]);
  });

  it("한계·믹스 상수를 내보낸다", () => {
    expect([MAX_LAYERS, MAX_RECIPE_MS, FREQ_MIN, FREQ_MAX, LFO_MAX_HZ, BED_OSC_MAX, PEAK_DBFS_MAX]).toEqual([
      4, 3000, 40, 9000, 8, 6, -6,
    ]);
    expect(BUS_GAIN).toEqual({ bgm: 0.3, sfx: 0.7, ui: 0.45 });
    expect(MASTER_GAIN).toBe(0.7);
    expect(COMPRESSOR).toEqual({ threshold: -18, ratio: 4, attack: 0.005, release: 0.2 });
  });

  it("ui.toggle: 켬 440→660 / 끔 440→330, 90ms, 변형은 variant 인자", () => {
    const on = renderPlan("ui.toggle", { variant: "on" });
    const off = renderPlan("ui.toggle", { variant: "off" });
    expect(on).toHaveLength(1);
    expect(on[0]).toMatchObject({ kind: "osc", wave: "sine", t: 0, dur: 90, f0: 440, f1: 660 });
    expect(off[0]).toMatchObject({ kind: "osc", wave: "sine", t: 0, dur: 90, f0: 440, f1: 330 });
    expect(planHash(on)).not.toBe(planHash(off));
    expect(RECIPES["ui.toggle"].gainDb).toBe(-18);
  });

  it("verdict.heart: lub-dub 한 쌍, 두 번째가 −3dB 이고 +160ms", () => {
    const plan = renderPlan("verdict.heart");
    expect(plan).toHaveLength(2);
    expect(plan[0]!.t).toBe(0);
    expect(plan[1]!.t).toBe(160);
    expect(plan[0]!.f0).toBe(55);
    expect(plan[0]!.filter).toMatchObject({ type: "lowpass", f: [120, 120] });
    expect(plan[0]!.dur).toBe(120);
    expect(plan[1]!.gain / plan[0]!.gain).toBeCloseTo(10 ** (-3 / 20), 6);
    expect(recipeDurationMs("verdict.heart")).toBeLessThanOrEqual(MAX_RECIPE_MS);
    expect(RECIPES["verdict.heart"].prio).toBe(0);
  });

  it("renderPlan: 같은 입력이면 같은 출력, 다른 id 는 다른 해시, 값이 모두 정상", () => {
    for (const id of ["ui.toggle", "verdict.heart"] as const) {
      const a = renderPlan(id);
      const b = renderPlan(id);
      expect(a).toEqual(b);
      expect(planHash(a)).toBe(planHash(b));
      assertSane(a);
    }
    expect(planHash(renderPlan("ui.toggle"))).not.toBe(planHash(renderPlan("verdict.heart")));
  });

  it("레벨 추정과 길이", () => {
    for (const id of ["ui.toggle", "verdict.heart", "bed.night"] as const) {
      expect(peakDbEstimate(id)).toBeLessThanOrEqual(PEAK_DBFS_MAX);
    }
    expect(recipeDurationMs("ui.toggle")).toBeGreaterThanOrEqual(90);
    expect(recipeDurationMs("ui.toggle")).toBeLessThan(200);
  });

  it("bed.night: 사인 드론 + 잡음 방 소리 + 대역통과 잡음 바람, 발진기 ≤ 6", () => {
    const bed = BEDS["bed.night"];
    expect(bedOscCount(bed)).toBeLessThanOrEqual(BED_OSC_MAX);
    const plan = bedPlan(bed, 0, 8000);
    assertSane(plan);
    expect(plan.some((e) => e.kind === "osc" && e.wave === "sine")).toBe(true);
    expect(plan.some((e) => e.kind === "noise" && e.filter?.type === "lowpass" && e.filter.f[0] === 300)).toBe(true);
    const wind = plan.find((e) => e.kind === "noise" && e.filter?.type === "bandpass");
    expect(wind?.filter?.f).toEqual([400, 800]);
    expect(wind?.filter?.lfoHz).toBe(0.05);
    expect(planHash(bedPlan(bed, 0, 8000))).toBe(planHash(plan));
  });
});

// ───────────────────────── Task 2: 56개 전수 ─────────────────────────

const EXPECTED_BEDS = ["bed.lobby", "bed.reveal", "bed.day", "bed.vote", "bed.night", "bed.dawn", "bed.result"];
const EXPECTED_SFX = [
  "ui.tap", "ui.toggle", "ui.deny", "ui.card", "lobby.join", "game.start", "role.flip", "day.start", "timer.tick",
  "phase.vote", "pin.on", "pin.move", "pick.turn", "pick.tick", "pick.point", "pick.skip", "runoff.intro",
  "runoff.reveal", "showdown.reveal", "vote.cast", "verdict.heart", "ballot.yes", "ballot.no", "execution.gavel",
  "execution.rise", "verdict.reject", "night.fall", "night.cue", "kill.slash", "morning.dawn", "morning.calm",
  "chalk.draw", "morning.saved", "will.quill", "will.seal", "will.fold", "emote.clap", "emote.praise",
  "emote.handshake", "emote.dance", "emote.surprise", "emote.cry", "emote.deny", "emote.point", "emote.throat",
  "result.win", "result.lose", "award.plate", "award.final",
];
const PRIO0 = ["verdict.heart", "execution.gavel", "kill.slash", "result.win", "result.lose", "award.final"];

describe("소리 레시피 — 56개 전수 (D-1, D-16, D-17)", () => {
  it("SOUND_IDS 는 56개(침대 7 + 효과음 49)이고 중복이 없으며 목록이 같다", () => {
    expect(SOUND_IDS).toHaveLength(56);
    expect(new Set(SOUND_IDS).size).toBe(56);
    expect([...BED_IDS]).toEqual(EXPECTED_BEDS);
    expect([...SFX_IDS]).toEqual(EXPECTED_SFX);
  });

  it("emote.* 접미사 집합 = EMOTE_IDS", () => {
    const suffixes = SFX_IDS.filter((id) => id.startsWith("emote.")).map((id) => id.slice("emote.".length));
    expect(new Set(suffixes)).toEqual(new Set(EMOTE_IDS));
    expect(suffixes).toHaveLength(9);
  });

  it("표의 키가 id 와 정확히 일치한다(침대는 침대 표, 효과음은 레시피 표)", () => {
    expect(Object.keys(RECIPES).sort()).toEqual([...SFX_IDS].sort());
    expect(Object.keys(BEDS).sort()).toEqual([...BED_IDS].sort());
    for (const id of SFX_IDS) expect(RECIPES[id].id).toBe(id);
    for (const id of BED_IDS) expect(BEDS[id].id).toBe(id);
  });

  it.each(SFX_IDS)("%s: 레이어·길이·주파수·레벨·엔벨로프 한계", (id) => {
    const r = RECIPES[id];
    expect(r.layers.length).toBeGreaterThanOrEqual(1);
    expect(r.layers.length).toBeLessThanOrEqual(MAX_LAYERS);
    expect(recipeDurationMs(id)).toBeLessThanOrEqual(MAX_RECIPE_MS);
    expect(r.gainDb).toBeGreaterThanOrEqual(GAIN_DB_MIN);
    expect(r.gainDb).toBeLessThanOrEqual(0);
    expect([0, 1, 2]).toContain(r.prio);
    expect(r.max).toBeGreaterThanOrEqual(1);
    expect(r.gapMs).toBeGreaterThanOrEqual(0);
    expect(peakDbEstimate(id)).toBeLessThanOrEqual(PEAK_DBFS_MAX);
    expect(recipeNodeCount(id)).toBeLessThanOrEqual(RECIPE_NODE_MAX);
    for (const l of r.layers) {
      expect(l.gain).toBeGreaterThan(0);
      expect(l.gain).toBeLessThanOrEqual(1);
      expect(l.env[0]).toBeGreaterThanOrEqual(2);
      expect(l.env[3]).toBeGreaterThanOrEqual(8);
      expect(l.dur).toBeGreaterThan(0);
      if (l.lfo !== undefined) expect(l.lfo.hz).toBeLessThanOrEqual(LFO_MAX_HZ);
      if (l.filter?.lfoHz !== undefined) expect(l.filter.lfoHz).toBeLessThanOrEqual(LFO_MAX_HZ);
      if (l.src === "noise") expect(l.filter).toBeDefined();
    }
    const plan = renderPlan(id);
    expect(plan.length).toBeGreaterThan(0);
    assertSane(plan);
    expect(planHash(renderPlan(id))).toBe(planHash(plan));
  });

  it("효과음 49개는 서로 다른 해시다(같은 소리 복사 금지)", () => {
    const hashes = SFX_IDS.map((id) => planHash(renderPlan(id)));
    expect(new Set(hashes).size).toBe(49);
  });

  it.each(BED_IDS)("%s: 발진기 ≤ 6 + 소음 1, 노드·레벨 한계", (id) => {
    const bed = BEDS[id];
    expect(bedOscCount(bed)).toBeLessThanOrEqual(BED_OSC_MAX);
    expect(bedNoiseCount(bed)).toBeLessThanOrEqual(1);
    expect(bedNodeCount(bed)).toBeLessThanOrEqual(BED_NODE_MAX);
    expect(peakDbEstimate(id)).toBeLessThanOrEqual(PEAK_DBFS_MAX);
    const plan = bedPlan(bed, 0, 20000);
    expect(plan.length).toBeGreaterThan(0);
    assertSane(plan);
    for (const e of plan) if (e.filter?.lfoHz !== undefined) expect(e.filter.lfoHz).toBeLessThanOrEqual(LFO_MAX_HZ);
  });

  it("우선순위 0 은 정해진 여섯 id 뿐이다", () => {
    const zero = SFX_IDS.filter((id) => RECIPES[id].prio === 0);
    expect(new Set(zero)).toEqual(new Set(PRIO0));
  });

  it("덕킹은 game.start·execution.gavel·night.fall 만, db 는 음수 holdMs 는 양수", () => {
    const ducked = SFX_IDS.filter((id) => RECIPES[id].duck !== undefined);
    expect(new Set(ducked)).toEqual(new Set(["game.start", "execution.gavel", "night.fall"]));
    for (const id of ducked) {
      expect(RECIPES[id].duck!.db).toBeLessThan(0);
      expect(RECIPES[id].duck!.holdMs).toBeGreaterThan(0);
    }
    expect(RECIPES["game.start"].duck).toEqual({ db: -10, holdMs: expect.any(Number) });
    expect(RECIPES["execution.gavel"].duck).toEqual({ db: -12, holdMs: 1200 });
  });

  it("같은 id 간격 규칙: timer.tick 800 · emote.* 250 · vote.cast 120 · ui.tap 80, 그 밖은 0, max 기본 2", () => {
    expect(RECIPES["timer.tick"].gapMs).toBe(800);
    expect(RECIPES["vote.cast"].gapMs).toBe(120);
    expect(RECIPES["ui.tap"].gapMs).toBe(80);
    for (const id of SFX_IDS.filter((x) => x.startsWith("emote."))) expect(RECIPES[id].gapMs).toBe(250);
    const special = new Set(["timer.tick", "vote.cast", "ui.tap", ...SFX_IDS.filter((x) => x.startsWith("emote."))]);
    for (const id of SFX_IDS) {
      if (!special.has(id)) expect(RECIPES[id].gapMs).toBe(0);
      expect(RECIPES[id].max).toBe(2);
    }
  });

  it("버스: 침대 bgm 은 BEDS 만, ui.tap·ui.toggle·ui.deny·ui.card·vote.cast 는 ui 버스, 나머지 sfx", () => {
    const uiIds = new Set(["ui.tap", "ui.toggle", "ui.deny", "ui.card", "vote.cast"]);
    for (const id of SFX_IDS) expect(RECIPES[id].bus).toBe(uiIds.has(id) ? "ui" : "sfx");
  });

  it("표의 대표 값: 세부 레시피 몇 줄을 직접 확인한다", () => {
    expect(renderPlan("pin.on")[0]!.dur).toBe(180);
    expect(RECIPES["result.win"].layers.map((l) => l.f![0])).toEqual([262, 330, 392]);
    expect(RECIPES["result.lose"].layers.map((l) => l.f![0])).toEqual([262, 247]);
    expect(RECIPES["award.final"].layers.some((l) => l.f?.[0] === 784)).toBe(true);
    expect(RECIPES["award.final"].layers.some((l) => l.f?.[0] === 196)).toBe(true);
    expect(RECIPES["emote.cry"].layers[0]!.lfo?.hz).toBe(6);
    expect(recipeDurationMs("game.start")).toBeGreaterThanOrEqual(2800);
  });

  it("침대: 같은 시드·같은 구간이면 같은 해시, 다른 침대는 다른 해시, 빈 구간은 빈 목록", () => {
    const hashes = BED_IDS.map((id) => planHash(bedPlan(id, 0, 12000)));
    expect(new Set(hashes).size).toBe(7);
    for (const id of BED_IDS) expect(planHash(bedPlan(id, 0, 12000))).toBe(planHash(bedPlan(id, 0, 12000)));
    expect(bedPlan("bed.lobby", 5000, 5000)).toEqual([]);
    expect(bedPlan("bed.lobby", 6000, 5000)).toEqual([]);
  });

  it.each(BED_IDS)("%s: 구간 질의가 접두 일관적이다 (0~8000 = 0~16000 의 앞부분)", (id) => {
    const short = bedPlan(id, 0, 8000);
    const long = bedPlan(id, 0, 16000).filter((e) => e.t < 8000);
    expect(short).toEqual(long);
    const mid = bedPlan(id, 4000, 8000);
    expect(mid).toEqual(long.filter((e) => e.t >= 4000));
  });

  it("침대 음 고르기는 시드 고정 — bed.day 는 박마다 확률 0.3 으로 코드톤을 고른다", () => {
    const plan = bedPlan("bed.day", 0, 60000);
    const triangleNotes = plan.filter((e) => e.kind === "osc" && e.dur === 900);
    const beats = Math.floor(60000 / (60000 / BEDS["bed.day"].bpm));
    expect(triangleNotes.length).toBeGreaterThan(beats * 0.15);
    expect(triangleNotes.length).toBeLessThan(beats * 0.45);
    expect(bedPlan("bed.vote", 0, 30000).some((e) => e.dur === 900)).toBe(false);
  });

  it("침대 일부 규칙: lobby 브러시 2·4박, vote 는 브러시·피아노 없음, reveal 필터가 15초에 열린다", () => {
    const lobby = bedPlan("bed.lobby", 0, 20000);
    const beat = 60000 / BEDS["bed.lobby"].bpm;
    for (const e of lobby.filter((x) => x.kind === "noise" && x.dur === 30)) {
      const n = Math.round(e.t / beat);
      expect([1, 3]).toContain(n % 4);
    }
    expect(BEDS["bed.vote"].brush).toBeUndefined();
    expect(BEDS["bed.vote"].notes).toBeUndefined();
    const early = bedPlan("bed.reveal", 0, 4000).find((e) => e.filter !== undefined)!;
    const late = bedPlan("bed.reveal", 16000, 20000).find((e) => e.filter !== undefined)!;
    expect(early.filter!.f[0]).toBe(300);
    expect(late.filter!.f[0]).toBeCloseTo(1200, 5);
  });

  it("노드 예산: 레시피 하나 ≤ 8, 침대 하나 ≤ 상한. 합이 예산을 넘는 조합은 엔진이 보이스를 끊는다(12-05)", () => {
    expect(NODE_BUDGET).toBe(48);
    expect(SFX_VOICE_MAX).toBe(8);
    const worst = worstCaseNodes();
    expect(Number.isInteger(worst)).toBe(true);
    expect(worst).toBeGreaterThan(0);
    const maxBed = Math.max(...BED_IDS.map((id) => bedNodeCount(BEDS[id])));
    const top = SFX_IDS.map((id) => recipeNodeCount(id)).sort((a, b) => b - a).slice(0, SFX_VOICE_MAX);
    expect(worst).toBe(maxBed + top.reduce((a, b) => a + b, 0));
    // 합이 NODE_BUDGET 을 넘을 수 있다 — 엔진이 우선순위·오래된 순으로 끊는다.
  });

  it("ui.toggle 만 변형(on/off)이 있고 role.flip·ui.card 에는 변형이 없다 (LS-5)", () => {
    expect(Object.keys(VARIANTS)).toEqual(["ui.toggle"]);
    const shape = (id: (typeof SFX_IDS)[number]): string => Object.keys(RECIPES[id]).sort().join(",");
    for (const id of ["role.flip", "ui.card"] as const) {
      expect(shape(id)).toBe(shape("ui.tap"));
      expect(Object.keys(RECIPES[id])).not.toContain("variant");
      expect(Object.keys(RECIPES[id])).not.toContain("variants");
      expect(renderPlan(id)).toEqual(renderPlan(id));
    }
    expect(() => renderPlan("role.flip", { variant: "mafia" })).toThrow();
  });

  it("화면 대응 표: 56개 모두 한 줄, ambient 는 침대 7개와 night.cue 뿐 (LS-1)", () => {
    expect(Object.keys(SCREEN_COUNTERPART).sort()).toEqual([...SOUND_IDS].sort());
    for (const id of SOUND_IDS) {
      expect(SCREEN_COUNTERPART[id].trim()).not.toBe("");
      expect(SCREEN_COUNTERPART[id]).not.toContain("\n");
    }
    expect(new Set(AMBIENT_IDS)).toEqual(new Set([...BED_IDS, "night.cue"]));
    for (const id of SOUND_IDS) {
      expect(SCREEN_COUNTERPART[id].startsWith("ambient")).toBe((AMBIENT_IDS as readonly string[]).includes(id));
    }
  });
});
