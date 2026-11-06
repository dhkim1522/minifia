// 12-08: 소리 감독(director)과 AudioView — 공개 view 의 차이와 닫힌 신호·로컬 시계만으로 소리를 정한다 (D-3, D-11, D-17, LS-1, LS-5, LS-6, LS-7, LS-10, LS-11).
import { describe, expect, it } from "vitest";
import { PICK_TURN_MS } from "../../shared/game/phases";
import type { DayView, PhaseId, PublicPlayer, RoomView } from "../../shared/protocol";
import { URGENT_MS } from "../../src/net/countdown";
import { AUDIO_VIEW_FIELDS, audioViewOf, type AudioView } from "../../src/audio/audioView";
import { BED_OF, direct, directSignal, JOIN_GAP_MS, TICK_PHASES, type DirectOutput, type LocalClock } from "../../src/audio/director";
import { AMBIENT_IDS, BED_IDS, RECIPES, SCREEN_COUNTERPART, type SfxId } from "../../src/audio/recipes";
import { tickSchedule } from "../../src/audio/script";
import { bindSignals, emitSignal, SIGNAL_KINDS } from "../../src/audio/signals";
import { pinOf } from "../../src/world/pinPlan";

const PHASES: readonly PhaseId[] = [
  "lobby", "assigning", "roleReveal", "dayAnnounce", "discussion", "nomination", "runoff",
  "showdown", "defense", "verdict", "execution", "night", "morning", "ended",
];

const NOW = 1_000_000;

function clock(over: Partial<LocalClock> = {}): LocalClock {
  return { now: NOW, offset: 0, reset: false, lastJoinAt: null, ...over };
}

function av(phase: PhaseId, over: Partial<AudioView> = {}): AudioView {
  return {
    phase,
    endsAt: null,
    dayN: phase === "lobby" || phase === "assigning" ? null : 1,
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
const keysOf = (out: DirectOutput): string[] => out.scripts.map((s) => s.key);
const quiet = (out: DirectOutput): boolean => out.cancel.length === 0 && !("bed" in out) && out.scripts.length === 0 && out.now.length === 0 && out.duck === null;

// ───────────────────────── 단계 → 침대 표 ─────────────────────────

describe("단계 → 침대 표 (D-17, O-7)", () => {
  it("14개 단계 전수", () => {
    expect(Object.keys(BED_OF).sort()).toEqual([...PHASES].sort());
    expect(BED_OF).toEqual({
      lobby: "bed.lobby",
      assigning: null,
      roleReveal: "bed.reveal",
      dayAnnounce: "bed.day",
      discussion: "bed.day",
      nomination: "bed.vote",
      runoff: "bed.vote",
      showdown: "bed.vote",
      defense: "bed.vote",
      verdict: "bed.vote",
      execution: "bed.vote",
      night: "bed.night",
      morning: "bed.dawn",
      ended: "bed.result",
    });
  });

  it("침대 id 는 모두 BED_IDS 안이다 (null 은 assigning 하나)", () => {
    for (const p of PHASES) {
      const b = BED_OF[p];
      if (b !== null) expect(BED_IDS).toContain(b);
    }
    expect(PHASES.filter((p) => BED_OF[p] === null)).toEqual(["assigning"]);
  });
});

// ───────────────────────── 첫 스냅샷·epoch·되풀이 (LS-10) ─────────────────────────

describe("첫 스냅샷·epoch 변경·같은 view 의 되풀이 (LS-10)", () => {
  it.each(PHASES)("%s: 직전 view 가 없으면 침대만 (일회성·대본 0)", (phase) => {
    // 밤의 큐 대본은 시각 맥박이 도는 갈래(visualCues 참)에서는 없다. 소리 전용 갈래의 재접속 큐는 soundNight.test.ts 가 본다 (LS-10)
    const out = direct(null, av(phase, { endsAt: NOW + 60_000 }), clock({ visualCues: true }));
    expect(out.bed).toBe(BED_OF[phase]);
    expect(out.now).toEqual([]);
    expect(out.scripts).toEqual([]);
    expect(out.cancel).toEqual([]);
  });

  it("지목 도중(내 차례·끝난 차례)의 첫 스냅샷도 침대만", () => {
    const turn = { order: [0, 1, 2], i: 1, endsAt: NOW + 5000 };
    expect(direct(null, av("nomination", { turn, mySeat: 1 }), clock())).toMatchObject({ bed: "bed.vote", now: [], scripts: [] });
    const done = { order: [0, 1, 2], i: 1, endsAt: NOW + 5000, doneAt: NOW - 100 };
    expect(direct(null, av("nomination", { turn: done, points: [{ seat: 1, target: 2 }] }), clock())).toMatchObject({ now: [], scripts: [] });
  });

  it("epoch 가 바뀐 렌더(reset)는 단계가 바뀌었어도 침대만이고, 이전 view 의 예약 키를 취소한다", () => {
    const prev = av("discussion", { endsAt: NOW + 40_000 });
    const out = direct(prev, av("nomination", { turn: { order: [0, 1], i: 0, endsAt: NOW + 8000 } }), clock({ reset: true }));
    expect(out.bed).toBe("bed.vote");
    expect(out.now).toEqual([]);
    expect(out.scripts).toEqual([]);
    expect(out.cancel).toContain("phase:discussion:1");
  });

  it.each(PHASES)("%s: 같은 view 가 되풀이되면 빈 출력", (phase) => {
    const turn = phase === "nomination" ? { order: [0, 1, 2], i: 1, endsAt: NOW + 6000 } : null;
    const a = av(phase, { endsAt: NOW + 30_000, turn });
    expect(quiet(direct(a, structuredClone(a), clock()))).toBe(true);
  });
});

// ───────────────────────── 단계 전환 (진입 소리·침대) ─────────────────────────

describe("단계 전환 표", () => {
  it("lobby → assigning: game.start 즉시, 침대 null(페이드아웃). 덕킹 −10dB 는 레시피에 있다", () => {
    const out = direct(av("lobby"), av("assigning", { endsAt: NOW + 3000 }), clock());
    expect(ids(out)).toEqual(["game.start"]);
    expect(out.bed).toBeNull();
    expect("bed" in out).toBe(true);
    expect(out.scripts).toEqual([]);
    expect(RECIPES["game.start"].duck?.db).toBe(-10);
  });

  it("assigning → roleReveal: role.flip 즉시 + bed.reveal", () => {
    const out = direct(av("assigning"), av("roleReveal", { endsAt: NOW + 15_000 }), clock());
    expect(ids(out)).toEqual(["role.flip"]);
    expect(out.bed).toBe("bed.reveal");
  });

  it("roleReveal → dayAnnounce: day.start + bed.day", () => {
    const out = direct(av("roleReveal"), av("dayAnnounce", { endsAt: NOW + 2000 }), clock());
    expect(ids(out)).toEqual(["day.start"]);
    expect(out.bed).toBe("bed.day");
  });

  it("dayAnnounce → discussion: 침대 변화 없음(bed 필드 없음), 일회성 소리 없음", () => {
    const out = direct(av("dayAnnounce"), av("discussion", { endsAt: NOW + 90_000 }), clock());
    expect("bed" in out).toBe(false);
    expect(out.now).toEqual([]);
  });

  it("discussion → nomination: phase.vote + bed.vote, 토론 틱 취소", () => {
    const out = direct(av("discussion", { endsAt: NOW + 3000 }), av("nomination", { endsAt: NOW + 3000, turn: { order: [0, 1], i: -1 } }), clock());
    expect(ids(out)).toEqual(["phase.vote"]);
    expect(out.bed).toBe("bed.vote");
    expect(out.cancel).toEqual(["phase:discussion:1"]);
  });

  it.each([
    ["nomination", "defense"],
    ["defense", "verdict"],
    ["verdict", "execution"],
    ["nomination", "runoff"],
    ["runoff", "defense"],
    ["nomination", "showdown"],
    ["showdown", "execution"],
  ] as const)("%s → %s: bed.vote 를 이어 가므로 침대 요청 없음", (a, b) => {
    const out = direct(av(a), av(b), clock());
    expect("bed" in out).toBe(false);
  });

  it("execution → night / night → morning / morning → dayAnnounce / → ended: 새 침대만 (밤·아침 소리는 12-09)", () => {
    expect(direct(av("execution"), av("night"), clock()).bed).toBe("bed.night");
    expect(direct(av("night"), av("morning"), clock()).bed).toBe("bed.dawn");
    expect(direct(av("morning"), av("ended"), clock()).bed).toBe("bed.result");
    const out = direct(av("morning"), av("dayAnnounce"), clock());
    expect(out.bed).toBe("bed.day");
    expect(ids(out)).toEqual(["day.start"]);
  });

  it("ended → lobby: bed.lobby 만", () => {
    const out = direct(av("ended"), av("lobby"), clock());
    expect(out.bed).toBe("bed.lobby");
    expect(out.now).toEqual([]);
  });

  it("role.flip 은 어떤 view 에서도 같은 호출이다 (LS-5: 직업별 변형 없음)", () => {
    const a = direct(av("assigning"), av("roleReveal", { mySeat: 0, players: [{ seat: 0, alive: true }, { seat: 1, alive: true }] }), clock());
    const b = direct(av("assigning"), av("roleReveal", { mySeat: 3, players: [0, 1, 2, 3, 4, 5].map((seat) => ({ seat, alive: true })) }), clock({ now: NOW + 777, offset: 90 }));
    expect(a.now).toEqual([{ id: "role.flip" }]);
    expect(b.now).toEqual(a.now);
  });
});

// ───────────────────────── 로비 입장 ─────────────────────────

describe("lobby.join (C-2)", () => {
  const lobby = (n: number): AudioView => av("lobby", { players: Array.from({ length: n }, (_, seat) => ({ seat, alive: true })) });

  it("같은 로비에서 사람 수가 늘면 한 번 (둘이 한꺼번에 늘어도 하나)", () => {
    expect(ids(direct(lobby(3), lobby(4), clock()))).toEqual(["lobby.join"]);
    expect(ids(direct(lobby(3), lobby(5), clock()))).toEqual(["lobby.join"]);
  });

  it("같은 수·줄어듦은 없음", () => {
    expect(direct(lobby(4), lobby(4), clock()).now).toEqual([]);
    expect(direct(lobby(4), lobby(3), clock()).now).toEqual([]);
  });

  it("1초 안에 이미 낸 적이 있으면 없음 (최대 1초에 하나)", () => {
    expect(JOIN_GAP_MS).toBe(1000);
    expect(direct(lobby(3), lobby(4), clock({ lastJoinAt: NOW - 999 })).now).toEqual([]);
    expect(ids(direct(lobby(3), lobby(4), clock({ lastJoinAt: NOW - 1000 })))).toEqual(["lobby.join"]);
  });

  it("로비가 아닌 단계의 사람 수 변화는 없음, 내가 막 들어와 받은 첫 view 도 없음", () => {
    expect(direct(av("nomination", { players: lobby(3).players }), av("nomination", { players: lobby(5).players }), clock()).now).toEqual([]);
    expect(direct(null, lobby(4), clock()).now).toEqual([]);
  });
});

// ───────────────────────── 카운트다운 틱 ─────────────────────────

describe("timer.tick (C-2, LS-11)", () => {
  it("공개 5초 규칙은 net/countdown 의 URGENT_MS 와 같다", () => {
    expect(URGENT_MS).toBe(5000);
    expect(tickSchedule(URGENT_MS)).toHaveLength(5);
    expect(tickSchedule(URGENT_MS - 1)).toHaveLength(4);
    expect(tickSchedule(URGENT_MS + 1)).toHaveLength(5);
  });

  it("토론·변론·찬반 단계만 틱을 쓴다", () => {
    expect([...TICK_PHASES].sort()).toEqual(["defense", "discussion", "verdict"]);
  });

  it("토론 진입: 마지막 5초 경계 5개를 한 대본으로 예약", () => {
    const out = direct(av("dayAnnounce"), av("discussion", { endsAt: NOW + 90_000 }), clock());
    expect(out.scripts).toHaveLength(1);
    const s = out.scripts[0]!;
    expect(s.key).toBe("phase:discussion:1");
    expect(s.items.map((i) => i.id)).toEqual(Array(5).fill("timer.tick"));
    expect(s.items.map((i) => i.at)).toEqual([85_000, 86_000, 87_000, 88_000, 89_000]);
    expect(s.duck).toBeNull();
  });

  it.each(["defense", "verdict"] as const)("%s 진입도 같은 규칙", (phase) => {
    const from: PhaseId = phase === "defense" ? "nomination" : "defense";
    const out = direct(av(from), av(phase, { endsAt: NOW + 10_000 }), clock());
    expect(out.scripts[0]?.items.map((i) => i.at)).toEqual([5000, 6000, 7000, 8000, 9000]);
  });

  it.each(["nomination", "runoff", "showdown", "execution", "ended", "dayAnnounce", "roleReveal"] as const)(
    "%s 에는 틱이 없다",
    (phase) => {
      const out = direct(av("lobby"), av(phase, { endsAt: NOW + 4000 }), clock());
      expect(out.scripts).toEqual([]);
      expect(ids(out)).not.toContain("timer.tick");
    },
  );

  it.each(["night", "morning"] as const)("%s 의 대본에는 timer.tick 이 없다 (밤·아침은 카운트다운 무음)", (phase) => {
    const out = direct(av("lobby"), av(phase, { endsAt: NOW + 4000 }), clock());
    expect(ids(out)).not.toContain("timer.tick");
    expect(out.scripts.flatMap((s) => s.items.map((i) => i.id))).not.toContain("timer.tick");
  });

  it("이미 지난 경계는 만들지 않는다 (늦게 들어온 view)", () => {
    const out = direct(av("dayAnnounce"), av("discussion", { endsAt: NOW + 3500 }), clock());
    expect(out.scripts[0]?.items.map((i) => i.at)).toEqual([500, 1500, 2500]);
    const late = direct(av("dayAnnounce"), av("discussion", { endsAt: NOW + 800 }), clock());
    expect(late.scripts[0]?.items.map((i) => i.at) ?? []).toEqual([]);
  });

  it("틱 시각은 서버 시각 기준이다: 프레임이 늦게 도착해도 서버 시각의 예약 지점이 같다 (LS-11)", () => {
    const endsAt = 5_000_000;
    const abs = (delay: number): number[] => {
      const local = clock({ now: endsAt - 90_000 + delay, offset: 0 });
      const out = direct(av("dayAnnounce"), av("discussion", { endsAt }), local);
      return out.scripts[0]!.items.map((i) => local.now + local.offset + i.at);
    };
    const base = abs(0);
    expect(base).toEqual([endsAt - 5000, endsAt - 4000, endsAt - 3000, endsAt - 2000, endsAt - 1000]);
    for (const d of [1, 120, 900, 5_000, 30_000]) expect(abs(d)).toEqual(base);
    // 로컬 시계가 서버와 어긋나 있어도 offset 으로 환산하면 같다
    const skew = (offset: number): number[] => {
      const local = clock({ now: 777, offset: endsAt - 90_000 - 777 + offset });
      const out = direct(av("dayAnnounce"), av("discussion", { endsAt }), local);
      return out.scripts[0]!.items.map((i) => local.now + local.offset + i.at);
    };
    expect(skew(0)).toEqual(base);
  });

  it("같은 단계 안에서 마감이 당겨지면(토론 일찍 끝내기) 같은 키로 다시 예약한다", () => {
    const out = direct(av("discussion", { endsAt: NOW + 60_000 }), av("discussion", { endsAt: NOW + 4_000 }), clock());
    expect(out.scripts.map((s) => s.key)).toEqual(["phase:discussion:1"]);
    expect(out.scripts[0]!.items.map((i) => i.at)).toEqual([0, 1000, 2000, 3000]);
  });

  it("단계가 바뀌면 이전 단계 대본 키가 취소된다", () => {
    const out = direct(av("discussion", { endsAt: NOW + 3000 }), av("night", { endsAt: NOW + 30_000 }), clock());
    expect(out.cancel).toEqual(["phase:discussion:1"]);
  });
});

// ───────────────────────── 지목 ─────────────────────────

describe("지목 pick.*·pin.* (D-11)", () => {
  const ORDER = [0, 1, 2, 3];
  const nom = (turn: AudioView["turn"], over: Partial<AudioView> = {}): AudioView => av("nomination", { turn, endsAt: NOW + 60_000, ...over });

  it("모이는 중 → 첫 차례: 모두에게 pin.on, 내 차례가 아니면 pick.* 없음", () => {
    const out = direct(nom({ order: ORDER, i: -1 }), nom({ order: ORDER, i: 0, endsAt: NOW + PICK_TURN_MS }, { mySeat: 2 }), clock());
    expect(ids(out)).toEqual(["pin.on"]);
    expect(out.scripts).toEqual([]);
  });

  it("내 차례 시작: pin.on 과 pick.turn, 마지막 3·2·1초 pick.tick 셋을 예약", () => {
    const out = direct(nom({ order: ORDER, i: 0, doneAt: NOW - 1 }), nom({ order: ORDER, i: 2, endsAt: NOW + PICK_TURN_MS }, { mySeat: 2 }), clock());
    expect(ids(out)).toEqual(["pin.on", "pick.turn"]);
    expect(out.scripts).toHaveLength(1);
    expect(out.scripts[0]!.key).toBe("pick:1:2");
    expect(out.scripts[0]!.items).toEqual([5000, 6000, 7000].map((at) => ({ at, id: "pick.tick" })));
  });

  it("차례인 사람만 pick.turn·pick.tick (다른 좌석의 view 에는 없다)", () => {
    for (const mySeat of [0, 1, 3]) {
      const out = direct(nom({ order: ORDER, i: 1, doneAt: NOW }), nom({ order: ORDER, i: 2, endsAt: NOW + PICK_TURN_MS }, { mySeat }), clock());
      expect(ids(out)).toEqual(["pin.on"]);
      expect(out.scripts).toEqual([]);
    }
  });

  it("차례 확정(기권 아님, 지목 줄 있음): pick.point 와 pin.move 가 같은 순간 모두에게, 내 틱은 취소", () => {
    const prev = nom({ order: ORDER, i: 2, endsAt: NOW + 4000 }, { mySeat: 2 });
    const cur = nom({ order: ORDER, i: 2, endsAt: NOW + 4000, doneAt: NOW }, { mySeat: 2, points: [{ seat: 2, target: 3 }] });
    const out = direct(prev, cur, clock());
    expect(ids(out)).toEqual(["pick.point", "pin.move"]);
    expect(out.cancel).toEqual(["pick:1:2"]);
  });

  it("기권: pick.skip 하나, pin 소리 없음", () => {
    const prev = nom({ order: ORDER, i: 1, endsAt: NOW + 100 });
    const cur = nom({ order: ORDER, i: 1, endsAt: NOW + 100, doneAt: NOW + 100, skip: true });
    expect(ids(direct(prev, cur, clock()))).toEqual(["pick.skip"]);
  });

  it("확정 뒤 다음 차례가 시작하면 pin.on 만 (확정 소리는 한 번)", () => {
    const done = nom({ order: ORDER, i: 0, doneAt: NOW - 900, endsAt: NOW - 900 }, { points: [{ seat: 0, target: 1 }] });
    const next = nom({ order: ORDER, i: 1, endsAt: NOW + PICK_TURN_MS }, { points: [{ seat: 0, target: 1 }] });
    expect(ids(direct(done, next, clock()))).toEqual(["pin.on"]);
  });

  it("같은 차례 안에서 다른 사람의 지목 줄이 바뀌어도 소리가 없다", () => {
    const a = nom({ order: ORDER, i: 2, endsAt: NOW + 5000 }, { points: [{ seat: 0, target: 1 }] });
    const b = nom({ order: ORDER, i: 2, endsAt: NOW + 5000 }, { points: [{ seat: 0, target: 3 }, { seat: 1, target: 3 }] });
    expect(quiet(direct(a, b, clock()))).toBe(true);
  });

  it("끝 알림(i >= 길이)·모이는 중에는 지목 소리가 없다", () => {
    const last = nom({ order: ORDER, i: 3, doneAt: NOW - 900 }, { points: [{ seat: 3, target: 0 }] });
    const end = nom({ order: ORDER, i: 4 }, { points: [{ seat: 3, target: 0 }] });
    expect(direct(last, end, clock()).now).toEqual([]);
    expect(direct(nom({ order: ORDER, i: -1 }), nom({ order: ORDER, i: -1 }), clock()).now).toEqual([]);
  });

  it("pick.tick 은 서버 시각 기준이다 (도착 지연과 무관, LS-11)", () => {
    const endsAt = 7_000_000;
    const abs = (delay: number): number[] => {
      const local = clock({ now: endsAt - PICK_TURN_MS + delay });
      const out = direct(nom({ order: ORDER, i: 1, doneAt: 1 }), nom({ order: ORDER, i: 2, endsAt }, { mySeat: 2 }), local);
      return out.scripts[0]!.items.map((i) => local.now + local.offset + i.at);
    };
    expect(abs(0)).toEqual([endsAt - 3000, endsAt - 2000, endsAt - 1000]);
    for (const d of [10, 400, 2500]) expect(abs(d)).toEqual(abs(0));
  });

  it("지목이 아닌 단계의 turn·points 는 읽지 않는다", () => {
    const cur = av("discussion", { turn: { order: ORDER, i: 1, endsAt: NOW + 3000 }, points: [{ seat: 1, target: 2 }] });
    const prev = av("discussion", { turn: { order: ORDER, i: 0, endsAt: NOW + 3000 } });
    expect(direct(prev, cur, clock()).now).toEqual([]);
  });

  // pinPlan.pinOf 의 전이와 같은 순간에 같은 소리가 나는가
  it("대표 view 열: pin.on·pin.move 순간이 pinOf 의 turn 시작·slide 시작과 같다", () => {
    const players: PublicPlayer[] = [0, 1, 2, 3].map((seat) => ({ seat, nickname: `p${seat}`, connected: true, isHost: seat === 0 }));
    const base = (day: Partial<DayView>, phase: PhaseId = "nomination"): RoomView => ({
      code: "0042", phase, phaseEndsAt: NOW + 60_000, phaseDurationMs: null, serverNow: NOW, minPlayers: 4, maxPlayers: 8, players,
      me: { seat: 1, isHost: false }, day: { n: 1, roles: [], ...day },
    });
    const O = [0, 1, 2, 3];
    const seq: RoomView[] = [
      base({}, "discussion"),
      base({ turn: { order: O, i: -1 }, points: [] }),
      base({ turn: { order: O, i: 0, endsAt: NOW + 8000 }, points: [] }),
      base({ turn: { order: O, i: 0, endsAt: NOW + 8000, doneAt: NOW + 2000 }, points: [{ seat: 0, target: 2 }] }),
      base({ turn: { order: O, i: 1, endsAt: NOW + 9000 }, points: [{ seat: 0, target: 2 }] }),
      base({ turn: { order: O, i: 1, endsAt: NOW + 9000, doneAt: NOW + 9000, skip: true }, points: [{ seat: 0, target: 2 }] }),
      base({ turn: { order: O, i: 2, endsAt: NOW + 18000 }, points: [{ seat: 0, target: 2 }] }),
      base({ turn: { order: O, i: 2, endsAt: NOW + 18000, doneAt: NOW + 12000 }, points: [{ seat: 0, target: 2 }, { seat: 2, target: 0 }] }),
      base({ turn: { order: O, i: 4 }, points: [{ seat: 0, target: 2 }, { seat: 2, target: 0 }] }),
    ];
    let onCount = 0;
    let moveCount = 0;
    for (let k = 1; k < seq.length; k += 1) {
      const p = pinOf(seq[k - 1]!);
      const c = pinOf(seq[k]!);
      const turnStart = c?.mode === "turn" && !(p?.mode === "turn" && p.seat === c.seat);
      const slideStart = c?.mode === "slide" && !(p?.mode === "slide" && p.startAt === c.startAt);
      const out = direct(audioViewOf(seq[k - 1]!), audioViewOf(seq[k]!), clock());
      expect(ids(out).includes("pin.on"), `step ${k} pin.on`).toBe(turnStart);
      expect(ids(out).includes("pin.move"), `step ${k} pin.move`).toBe(slideStart);
      if (turnStart) onCount += 1;
      if (slideStart) moveCount += 1;
    }
    expect(onCount).toBe(3);
    expect(moveCount).toBe(2);
  });
});

// ───────────────────────── 신호 (ui.tap) ─────────────────────────

describe("신호 tap → ui.tap (LS-7)", () => {
  it("닫힌 신호 종류는 tap·card·tensionCue 이고 인자에 선택값·역할·좌석이 없다", () => {
    expect([...SIGNAL_KINDS]).toEqual(["tap", "card", "tensionCue"]);
  });

  it.each(PHASES.filter((p) => p !== "night"))("%s: ui.tap 한 번", (phase) => {
    const out = directSignal({ kind: "tap" }, av(phase));
    expect(out.now).toEqual([{ id: "ui.tap" }]);
    expect(out.scripts).toEqual([]);
  });

  it("밤에는 무음이다", () => {
    expect(quiet(directSignal({ kind: "tap" }, av("night")))).toBe(true);
  });

  it("view 가 없으면(홈·연결 전) 아무것도 없다", () => {
    expect(quiet(directSignal({ kind: "tap" }, null))).toBe(true);
  });

  it("출력은 호출한 쪽의 선택·역할·좌석과 무관하다", () => {
    const a = directSignal({ kind: "tap" }, av("discussion", { mySeat: 0 }));
    const b = directSignal({ kind: "tap" }, av("discussion", { mySeat: 3, players: [] }));
    expect(b).toEqual(a);
  });
});

describe("signals: emitSignal·bindSignals", () => {
  it("바인딩이 없으면 아무 일도 없다", () => {
    expect(() => emitSignal({ kind: "tap" })).not.toThrow();
  });

  it("바인딩한 처리기가 신호를 받고 해제하면 더 받지 않는다", () => {
    const got: string[] = [];
    const off = bindSignals((s) => got.push(s.kind));
    emitSignal({ kind: "tap" });
    off();
    emitSignal({ kind: "tap" });
    expect(got).toEqual(["tap"]);
  });

  it("뒤에 바인딩한 처리기가 앞의 것을 대신하고, 앞의 해제 함수는 뒤의 것을 풀지 않는다", () => {
    const a: string[] = [];
    const b: string[] = [];
    const offA = bindSignals((s) => a.push(s.kind));
    const offB = bindSignals((s) => b.push(s.kind));
    offA();
    emitSignal({ kind: "tap" });
    expect(a).toEqual([]);
    expect(b).toEqual(["tap"]);
    offB();
  });

  it("처리기가 던져도 눌림은 막히지 않는다", () => {
    const off = bindSignals(() => {
      throw new Error("x");
    });
    expect(() => emitSignal({ kind: "tap" })).not.toThrow();
    off();
  });
});

// ───────────────────────── 화면 대응 (LS-1) ─────────────────────────

describe("감독 출력 id 는 모두 화면 대응이 있다 (LS-1)", () => {
  it("모든 단계 전환·낮 안의 소리·신호가 낼 수 있는 id 전수", () => {
    const outs: DirectOutput[] = [];
    for (const a of PHASES) {
      for (const b of PHASES) outs.push(direct(av(a, { endsAt: NOW + 20_000 }), av(b, { endsAt: NOW + 20_000 }), clock()));
      outs.push(directSignal({ kind: "tap" }, av(a)));
      outs.push(directSignal({ kind: "card", delayMs: 0 }, av(a)), directSignal({ kind: "tensionCue" }, av(a), { visualCues: true }));
    }
    const lobby = (n: number): AudioView => av("lobby", { players: Array.from({ length: n }, (_, seat) => ({ seat, alive: true })) });
    outs.push(direct(lobby(2), lobby(3), clock()));
    const ORDER = [0, 1, 2];
    const mine = av("nomination", { turn: { order: ORDER, i: 1, endsAt: NOW + 8000 }, mySeat: 1 });
    outs.push(direct(av("nomination", { turn: { order: ORDER, i: 0, doneAt: 1 } }), mine, clock()));
    outs.push(direct(mine, av("nomination", { turn: { order: ORDER, i: 1, doneAt: NOW }, points: [{ seat: 1, target: 2 }], mySeat: 1 }), clock()));
    outs.push(direct(mine, av("nomination", { turn: { order: ORDER, i: 1, doneAt: NOW, skip: true }, mySeat: 1 }), clock()));

    const emitted = new Set<string>();
    for (const o of outs) {
      for (const c of o.now) emitted.add(c.id);
      for (const s of o.scripts) for (const i of s.items) emitted.add(i.id);
      if (typeof o.bed === "string") emitted.add(o.bed);
    }
    for (const id of emitted) {
      expect(Object.keys(SCREEN_COUNTERPART), id).toContain(id);
      // 분위기 소리(침대·night.cue)는 정보가 아니다 — 그 밖의 id 는 분위기 표에 없어야 한다 (night.cue 는 12-09 밤 큐)
      if (!(BED_IDS as readonly string[]).includes(id) && id !== "night.cue") expect(AMBIENT_IDS as readonly string[], id).not.toContain(id);
    }
    // 이 계획이 맡는 소리가 실제로 모두 나온다
    for (const id of ["game.start", "role.flip", "day.start", "phase.vote", "lobby.join", "timer.tick", "pin.on", "pick.turn", "pick.tick", "pick.point", "pin.move", "pick.skip", "ui.tap", "night.fall", "night.cue", "ui.card"] as SfxId[]) {
      expect(emitted.has(id), id).toBe(true);
    }
  });
});

// ───────────────────────── AudioView (LS-6) ─────────────────────────

describe("audioViewOf: 허용 필드만 (LS-6, T-12-27)", () => {
  const players: PublicPlayer[] = [
    { seat: 0, nickname: "가", connected: true, isHost: true },
    { seat: 1, nickname: "나", connected: false, isHost: false, alive: false, badge: "police", look: "coat" },
    { seat: 2, nickname: "다", connected: true, isHost: false },
  ];
  const baseView = (): RoomView => ({
    code: "0042",
    phase: "nomination",
    round: 2,
    phaseEndsAt: 123_456,
    phaseDurationMs: 11_000,
    serverNow: 100_000,
    minPlayers: 4,
    maxPlayers: 8,
    players,
    me: { seat: 2, isHost: false },
    day: { n: 3, roles: ["mafia", "citizen"], turn: { order: [0, 2], i: 1, endsAt: 130_000 }, points: [{ seat: 0, target: 2 }], candidate: 2 },
  });

  it("키 집합이 허용 목록의 부분집합이고 값이 공개 값이다", () => {
    const a = audioViewOf(baseView());
    expect(Object.keys(a).every((k) => (AUDIO_VIEW_FIELDS as readonly string[]).includes(k))).toBe(true);
    expect(a).toEqual({
      phase: "nomination",
      endsAt: 123_456,
      dayN: 3,
      turn: { order: [0, 2], i: 1, endsAt: 130_000 },
      points: [{ seat: 0, target: 2 }],
      candidate: 2,
      morning: null,
      players: [{ seat: 0, alive: true }, { seat: 1, alive: false }, { seat: 2, alive: true }],
      mySeat: 2,
    });
  });

  it("메타모픽: 역할·선택·기록·채팅·관전·서버 시각·닉네임을 바꿔 넣어도 같다", () => {
    const want = audioViewOf(baseView());
    const mutations: ((v: RoomView) => void)[] = [
      (v) => { v.me.role = "mafia"; },
      (v) => { v.me.role = "doctor"; v.me.allies = [0, 1]; },
      (v) => { v.me.pick = 1; v.me.allyPicks = [1, 3]; v.me.nightTally = [{ seat: 1, n: 2 }]; v.me.nightSure = 1; },
      (v) => { v.me.records = [{ n: 1, kind: "investigate", target: 1, mafia: true } as never]; },
      (v) => { v.me.chat = "mafia"; v.me.whisperUsed = true; v.me.note = "쪽지"; v.me.will = "유언"; },
      (v) => { v.me.ballot = 1; v.me.verdictVote = true; v.me.endDiscussion = true; },
      (v) => { v.me.testMode = true; v.me.testRole = "police"; v.me.testBots = 3; },
      (v) => { v.spectate = { seats: [] } as never; },
      (v) => { v.serverNow = 999_999; v.phaseDurationMs = 1; v.round = 9; v.code = "9999"; },
      (v) => { v.players = v.players.map((p) => ({ ...p, nickname: "x", connected: !p.connected, isHost: !p.isHost, badge: "mafia" as never, look: "hat" as never })); },
      (v) => { v.mapChoice = "plaza"; v.map = "bar"; v.resting = true as never; },
    ];
    for (const m of mutations) {
      const v = baseView();
      m(v);
      expect(audioViewOf(v)).toEqual(want);
    }
  });

  it("day 가 없으면 turn·points·candidate·dayN 은 비어 있다", () => {
    const v = baseView();
    delete v.day;
    expect(audioViewOf(v)).toMatchObject({ dayN: null, turn: null, points: [], candidate: null });
  });

  it("감독 출력은 AudioView 가 같으면 같다: 역할만 바꾼 view 열의 출력이 모두 같다", () => {
    const withRole = (role: "mafia" | "citizen" | "police"): RoomView => {
      const v = baseView();
      v.me.role = role;
      v.me.pick = role === "mafia" ? 1 : undefined;
      return v;
    };
    const prev = baseView();
    prev.phase = "assigning";
    const outs = (["mafia", "citizen", "police"] as const).map((r) => direct(audioViewOf(prev), audioViewOf({ ...withRole(r), phase: "roleReveal" }), clock()));
    expect(outs[1]).toEqual(outs[0]);
    expect(outs[2]).toEqual(outs[0]);
  });
});
