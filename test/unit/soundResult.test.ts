// 12-11: 결과·시상 소리 — 사건(뒤집기·조명·패) → 소리 순수 함수, 감독의 ended 규칙, 11페이즈 상수 대조 (SOUND-01·02, D-15, LS-1, LS-10, T-12-41, T-12-42).
// 소리는 11페이즈 시계가 낸 사건에 붙는다: 건너뛰기·일시정지·재접속의 규칙은 시계(ResultScreen)가 정하고 여기서는 사건 하나가 낼 소리만 본다.
import { describe, expect, it } from "vitest";
import type { PhaseId } from "../../shared/protocol";
import type { AudioView } from "../../src/audio/audioView";
import { direct, directSignal } from "../../src/audio/director";
import { SCREEN_COUNTERPART } from "../../src/audio/recipes";
import { awardScript, flipCue, lightCues, plateCues, RESULT_AT, resultScript } from "../../src/audio/script";
import { SIGNAL_KINDS, type LocalSignal } from "../../src/audio/signals";
import { RESULT_TIMELINE } from "../../src/game/resultDirector";

function av(phase: PhaseId): AudioView {
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
  };
}

interface Row {
  at: number;
  id: string;
  gainDb?: number;
  cents?: number;
}
const rows = (items: readonly Row[], shift = 0): Row[] =>
  items.map((i) => ({ at: i.at + shift, id: i.id, ...(i.gainDb !== undefined ? { gainDb: i.gainDb } : {}), ...(i.cents !== undefined ? { cents: i.cents } : {}) }));

describe("11페이즈 상수 대조 (T-12-42)", () => {
  it("RESULT_AT 의 결과 시간표가 RESULT_TIMELINE 과 같다", () => {
    expect(RESULT_AT.flipFirst).toBe(RESULT_TIMELINE.flipStartMs);
    expect(RESULT_AT.flipStep).toBe(RESULT_TIMELINE.flipGapMs);
    expect(RESULT_AT.verdict).toBe(RESULT_TIMELINE.lightAtMs);
    expect(RESULT_AT.awardBase).toBe(RESULT_TIMELINE.finalAtMs);
  });

  it("시상 대본 상수는 그대로다 (18.1-16: 화면의 시상식은 지웠고 소리 대본·시험 페이지만 남는다)", () => {
    expect(RESULT_AT.awardStep).toBe(2500);
    expect(RESULT_AT.awardLead).toBe(900);
  });
});

describe("사건 → 소리 (D-15, C-6)", () => {
  it("flipCue(i): role.flip 한 개, i 마다 +20 cents, 최대 8번", () => {
    for (let i = 0; i < 8; i += 1) expect(flipCue(i)).toEqual([{ at: 0, id: "role.flip", cents: 20 * i }]);
    expect(flipCue(8)).toEqual([]);
    expect(flipCue(11)).toEqual([]);
    expect(flipCue(-1)).toEqual([]);
    expect(flipCue(Number.NaN)).toEqual([]);
  });

  it("lightCues({win}): 승패 소리 한 개 + 박수 3개(−10dB, 0·80·160ms) + 침대 −6dB 1400ms", () => {
    for (const win of [true, false]) {
      const s = lightCues({ win });
      expect(s.items.map((i) => [i.at, i.id, i.gainDb])).toEqual([
        [0, win ? "result.win" : "result.lose", undefined],
        [0, "emote.clap", -10],
        [80, "emote.clap", -10],
        [160, "emote.clap", -10],
      ]);
      expect(s.duck).toEqual({ fromMs: 0, toMs: 1400, db: -6, returnMs: 250 });
    }
  });

  it("plateCues({k, total}): 패 소리 + 박수 3개(−12dB), 마지막 패는 award.final", () => {
    expect(plateCues({ k: 0, total: 3 }).map((i) => [i.at, i.id, i.gainDb])).toEqual([
      [0, "award.plate", undefined],
      [0, "emote.clap", -12],
      [80, "emote.clap", -12],
      [160, "emote.clap", -12],
    ]);
    expect(plateCues({ k: 2, total: 3 })[0]!.id).toBe("award.final");
    expect(plateCues({ k: 0, total: 1 })[0]!.id).toBe("award.final");
  });

  it.each([4, 8])("n=%i · win 참/거짓: 사건 함수를 시각에 옮기면 resultScript 와 같은 줄이다", (n) => {
    for (const win of [true, false]) {
      const table = resultScript({ n, win });
      const events: Row[] = [];
      for (let i = 0; i < n; i += 1) events.push(...rows(flipCue(i), RESULT_AT.flipFirst + RESULT_AT.flipStep * i));
      const light = lightCues({ win });
      events.push(...rows(light.items, RESULT_AT.verdict));
      const byAt = (a: Row, b: Row): number => a.at - b.at || a.id.localeCompare(b.id);
      expect([...events].sort(byAt)).toEqual(rows(table.items).sort(byAt));
      expect(table.duck).toEqual({ fromMs: RESULT_AT.verdict + light.duck.fromMs, toMs: RESULT_AT.verdict + light.duck.toMs, db: light.duck.db, returnMs: light.duck.returnMs });
    }
  });

  it.each([4, 8, 12])("total=%i: 모든 k 에서 plateCues 를 패 시각에 옮기면 awardScript 와 같은 줄이다", (total) => {
    for (let k = 0; k < total; k += 1) {
      const shift = RESULT_AT.awardBase + RESULT_AT.awardStep * k + RESULT_AT.awardLead;
      expect(rows(plateCues({ k, total }), shift)).toEqual(rows(awardScript({ k, total }).items));
    }
  });

  it("승패 소리 id 는 win 에만 달렸다: 같은 win 이면 누가 불러도 같다 (순수)", () => {
    expect(lightCues({ win: true })).toEqual(lightCues({ win: true }));
    expect(lightCues({ win: true }).items[0]!.id).not.toBe(lightCues({ win: false }).items[0]!.id);
  });

  it("화면 대응 문구가 있다 (LS-1)", () => {
    for (const id of ["role.flip", "result.win", "result.lose", "award.plate", "award.final", "bed.result"] as const) expect(SCREEN_COUNTERPART[id], id).toBeTruthy();
  });
});

describe("감독: result 신호는 ended 에서만 소리가 된다 (T-12-41)", () => {
  const flip = (i: number): LocalSignal => ({ kind: "result", step: "flip", i });
  const light = (win: boolean): LocalSignal => ({ kind: "result", step: "light", win });
  const plate = (k: number, total: number): LocalSignal => ({ kind: "result", step: "plate", k, total });
  const ids = (o: ReturnType<typeof directSignal>): string[] => [...o.now.map((c) => c.id), ...o.scripts.flatMap((s) => s.items.map((i) => i.id))];

  it("result 는 닫힌 신호 종류다", () => {
    expect(SIGNAL_KINDS).toContain("result");
  });

  it("ended: flip 은 role.flip 을 지금, 8번째 이후는 무음", () => {
    const o = directSignal(flip(3), av("ended"));
    expect(o.now).toEqual([{ id: "role.flip", cents: 60 }]);
    expect(o.scripts).toEqual([]);
    expect(directSignal(flip(8), av("ended")).now).toEqual([]);
  });

  it("ended: light 는 승패 소리 지금 + 박수(80·160ms 뒤 대본) + 침대 덕킹", () => {
    const o = directSignal(light(true), av("ended"));
    expect(o.now.map((c) => [c.id, c.gainDb])).toEqual([
      ["result.win", undefined],
      ["emote.clap", -10],
    ]);
    expect(o.scripts).toHaveLength(1);
    expect(o.scripts[0]!.items.map((i) => [i.at, i.id, i.gainDb])).toEqual([
      [80, "emote.clap", -10],
      [160, "emote.clap", -10],
    ]);
    expect(o.duck).toEqual({ fromMs: 0, toMs: 1400, db: -6, returnMs: 250 });
    expect(ids(directSignal(light(false), av("ended")))[0]).toBe("result.lose");
  });

  it("ended: plate 는 패 소리 + 박수 3개, 마지막 패는 award.final", () => {
    expect(ids(directSignal(plate(0, 3), av("ended")))).toEqual(["award.plate", "emote.clap", "emote.clap", "emote.clap"]);
    expect(ids(directSignal(plate(2, 3), av("ended")))[0]).toBe("award.final");
  });

  it.each<PhaseId>(["lobby", "assigning", "roleReveal", "dayAnnounce", "discussion", "nomination", "runoff", "showdown", "defense", "verdict", "execution", "night", "morning"])(
    "%s 에서는 어떤 result 신호도 소리가 없다",
    (phase) => {
      for (const s of [flip(0), light(true), light(false), plate(0, 3)]) {
        const o = directSignal(s, av(phase));
        expect(o.now).toEqual([]);
        expect(o.scripts).toEqual([]);
        expect(o.duck).toBeNull();
      }
    },
  );

  it("현재 view 가 없으면 무음", () => {
    expect(directSignal(light(true), null).now).toEqual([]);
  });

  it("신호 객체의 키 집합은 정수·불리언 인자뿐이다 (좌석·직업·닉네임·칭호 없음, LS-6)", () => {
    const keys = (s: LocalSignal): string[] => Object.keys(s).sort();
    expect(keys(flip(0))).toEqual(["i", "kind", "step"]);
    expect(keys(light(true))).toEqual(["kind", "step", "win"]);
    expect(keys(plate(0, 3))).toEqual(["k", "kind", "step", "total"]);
  });
});

describe("감독: 결과 진입·재접속·다시 하기 (D-15, LS-10)", () => {
  const local = { now: 1_000, offset: 0, reset: false, lastJoinAt: null };
  const ids = (o: ReturnType<typeof direct>): string[] => [...o.now.map((c) => c.id), ...o.scripts.flatMap((s) => s.items.map((i) => i.id))];

  it("처형·아침에서 ended 로 들어오면 bed.result 만 (일회성 소리는 시계 신호가 낸다)", () => {
    for (const from of ["execution", "morning"] as const) {
      const o = direct(av(from), av("ended"), local);
      expect(o.bed).toBe("bed.result");
      expect(ids(o)).toEqual([]);
    }
  });

  it("처음 스냅샷·연결 번호 변경(재접속)으로 받은 ended 도 bed.result 만", () => {
    const first = direct(null, av("ended"), local);
    expect(first.bed).toBe("bed.result");
    expect(ids(first)).toEqual([]);
    const re = direct(av("execution"), av("ended"), { ...local, reset: true });
    expect(re.bed).toBe("bed.result");
    expect(ids(re)).toEqual([]);
  });

  it("ended 안에서 view 가 다시 와도(준비 표시·닉네임 변경 등) 소리도 취소도 없다", () => {
    const o = direct(av("ended"), { ...av("ended"), players: [{ seat: 0, alive: true }] }, local);
    expect(ids(o)).toEqual([]);
    expect(o.cancel).toEqual([]);
    expect("bed" in o).toBe(false);
  });

  it("다시 하기: [시작] 으로 ended → assigning 이면 game.start, 로비로 돌아오면 bed.lobby", () => {
    const start = direct(av("ended"), av("assigning"), local);
    expect(ids(start)).toEqual(["game.start"]);
    expect(start.bed).toBeNull();
    const back = direct(av("ended"), av("lobby"), local);
    expect(back.bed).toBe("bed.lobby");
    expect(ids(back)).toEqual([]);
  });

  it("ended 를 떠나면 아직 남은 박수 꼬리 대본을 취소한다", () => {
    const o = direct(av("ended"), av("lobby"), local);
    expect(o.cancel).toContain("result:light");
    expect(o.cancel).toContain("result:plate:0");
  });
});
