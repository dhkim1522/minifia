// 12-10: 판결 순간 소리 — 처형 진입 대본·결과 무관 앞머리·도착 지연 유예·재접속 (D-13, LS-10, LS-11, T-12-36, T-12-40).
// 시각 기준: T0 = endsAt − EXECUTION_MS (서버 시각). 항목의 절대 시각 = local.now + local.offset + 예약 지연.
import { describe, expect, it } from "vitest";
import { EXECUTION_MS } from "../../shared/game/phases";
import type { PhaseId, PublicPlayer, RoomView } from "../../shared/protocol";
import { AUDIO_VIEW_FIELDS, audioViewOf, type AudioView } from "../../src/audio/audioView";
import { direct, directSignal, GRACE_MS, type DirectOutput, type LocalClock } from "../../src/audio/director";
import { recipeDurationMs } from "../../src/audio/recipes";
import { verdictScript } from "../../src/audio/script";
import { SCREEN_COUNTERPART } from "../../src/audio/recipes";
import { BALLOT_END_AT } from "../../src/game/verdictMoment";

const T0 = 5_000_000;
const ANNOUNCE_AT = 2600;

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

function clock(over: Partial<LocalClock> = {}): LocalClock {
  return { now: T0, offset: 0, reset: false, lastJoinAt: null, ...over };
}

interface ExecOpts {
  passed?: boolean;
  last?: boolean;
  hasBallots?: boolean;
  candidate?: number | null;
}
function exec(o: ExecOpts = {}): AudioView {
  const { passed = true, last = false, hasBallots = !last, candidate = 2 } = o;
  return av("execution", { endsAt: T0 + EXECUTION_MS, verdict: { passed, last }, hasBallots, candidate });
}
const verdictPhase = (): AudioView => av("verdict", { endsAt: T0, candidate: 2 });

interface Slot {
  /** T0 기준 ms (서버 시각) */
  at: number;
  id: string;
  gainDb?: number;
  cents?: number;
}

/** 출력의 모든 소리 줄을 T0 기준 절대 시각으로 편다. 지금 내는 줄은 도착 시각(local.now)이다 */
function slots(out: DirectOutput, local: LocalClock): Slot[] {
  const serverNow = local.now + local.offset;
  const list: Slot[] = [];
  for (const c of out.now) list.push({ at: serverNow - T0, id: c.id, ...(c.gainDb !== undefined ? { gainDb: c.gainDb } : {}), ...(c.cents !== undefined ? { cents: c.cents } : {}) });
  for (const s of out.scripts) for (const i of s.items) list.push({ at: serverNow + i.at - T0, id: i.id, ...(i.gainDb !== undefined ? { gainDb: i.gainDb } : {}), ...(i.cents !== undefined ? { cents: i.cents } : {}) });
  return list.sort((a, b) => a.at - b.at || a.id.localeCompare(b.id));
}
const key = (s: Slot): string => `${s.at}:${s.id}`;
const sorted = (l: Slot[]): Slot[] => [...l].sort((a, b) => a.at - b.at || a.id.localeCompare(b.id));

function enter(o: ExecOpts, delay = 0): { out: DirectOutput; local: LocalClock } {
  const local = clock({ now: T0 + delay });
  return { out: direct(verdictPhase(), exec(o), local), local };
}

describe("처형 진입 판결 대본 (D-13)", () => {
  it("통과: 심장 박동 다섯 · 600 ballot.yes · 1000 ballot.no · 4600 ui.card · 2600 gavel+rise · 0 pin.on", () => {
    const { out, local } = enter({ passed: true });
    expect(slots(out, local).map(key)).toEqual(
      [
        "0:pin.on",
        "0:verdict.heart",
        "600:ballot.yes",
        "800:verdict.heart",
        "1000:ballot.no",
        "1500:verdict.heart",
        "2050:verdict.heart",
        "2400:verdict.heart",
        "2600:execution.gavel",
        "2600:execution.rise",
        `${BALLOT_END_AT}:ui.card`,
      ].sort((a, b) => Number(a.split(":")[0]) - Number(b.split(":")[0]) || a.localeCompare(b)),
    );
  });

  it("침대 덕킹: 0 부터 BALLOT_END_AT 까지 −14dB, 복귀 800ms (스크립트 한 줄에 실린다)", () => {
    const { out } = enter({ passed: true });
    const run = out.scripts.find((s) => s.key === "phase:execution:1");
    expect(run?.duck).toEqual({ fromMs: 0, toMs: BALLOT_END_AT, db: -14, returnMs: 800 });
    expect(out.bed).toBeUndefined(); // 침대는 bed.vote 로 이미 같다
  });

  it("부결: 2600 이 verdict.reject (gavel·rise 없음)", () => {
    const { out, local } = enter({ passed: false });
    const s = slots(out, local);
    expect(s.filter((x) => x.id === "verdict.reject").map((x) => x.at)).toEqual([ANNOUNCE_AT]);
    expect(s.some((x) => x.id === "execution.gavel" || x.id === "execution.rise")).toBe(false);
    expect(s.filter((x) => x.id === "verdict.heart")).toHaveLength(5);
  });

  it("마지막 3인 처형: 0ms 에 gavel + rise (+ 핀) 뿐, 심장 박동·찬반 둔탁음·덕킹 없음", () => {
    const { out, local } = enter({ last: true, hasBallots: false });
    expect(slots(out, local).map(key)).toEqual(["0:execution.gavel", "0:execution.rise", "0:pin.on"]);
    expect(out.scripts.every((s) => s.duck === null)).toBe(true);
  });

  it("찬반 기록이 없으면(마지막 3인이 아님) 둔탁음·카드·핀이 없다", () => {
    const { out, local } = enter({ passed: true, hasBallots: false });
    const ids = slots(out, local).map((x) => x.id);
    expect(ids).not.toContain("ballot.yes");
    expect(ids).not.toContain("ballot.no");
    expect(ids).not.toContain("ui.card");
    expect(ids).not.toContain("pin.on");
  });

  it("변론자(candidate)가 없으면 pin.on 이 없다", () => {
    const { out, local } = enter({ passed: true, candidate: null });
    expect(slots(out, local).some((x) => x.id === "pin.on")).toBe(false);
  });

  it("대본 본체는 12-02 verdictScript 와 같다 (이 규칙이 따로 시각을 만들지 않는다)", () => {
    const { out, local } = enter({ passed: true });
    const nominal = verdictScript({ passed: true, last: false, hasBallots: true }).items.map((i) => key({ at: i.at, id: i.id }));
    const got = slots(out, local).filter((x) => x.id !== "pin.on").map(key);
    expect(got.sort()).toEqual([...nominal].sort());
  });

  it("마지막 소리의 시각 + 길이가 EXECUTION_MS 안이다", () => {
    for (const passed of [true, false]) {
      const { out, local } = enter({ passed });
      for (const s of slots(out, local)) {
        expect(s.at + recipeDurationMs(s.id as never), `${passed} ${s.id}`).toBeLessThanOrEqual(EXECUTION_MS);
      }
    }
  });
});

describe("결과 무관 앞머리 (T-12-36, LS-1)", () => {
  it("2600 미만 항목(id·at·gain·cents)이 통과/부결에서 모두 같다", () => {
    const a = enter({ passed: true });
    const b = enter({ passed: false });
    const head = (r: { out: DirectOutput; local: LocalClock }): Slot[] => slots(r.out, r.local).filter((x) => x.at < ANNOUNCE_AT);
    expect(head(a).length).toBeGreaterThan(5);
    expect(head(a)).toEqual(head(b));
  });

  it("덕킹 구간도 같다", () => {
    const a = enter({ passed: true }).out.scripts.find((s) => s.key === "phase:execution:1")!.duck;
    const b = enter({ passed: false }).out.scripts.find((s) => s.key === "phase:execution:1")!.duck;
    expect(a).toEqual(b);
  });

  it("지연 도착 열 전체에서도 앞머리가 같다", () => {
    for (const d of [0, 100, 300, 800, 2000]) {
      const a = enter({ passed: true }, d);
      const b = enter({ passed: false }, d);
      const head = (r: { out: DirectOutput; local: LocalClock }): Slot[] => slots(r.out, r.local).filter((x) => x.at < ANNOUNCE_AT);
      expect(head(a), `delay ${d}`).toEqual(head(b));
    }
  });
});

describe("도착 지연 유예 (LS-11, T-12-40)", () => {
  it("유예 상수는 250ms 한 곳이다", () => {
    expect(GRACE_MS).toBe(250);
  });

  it.each([0, 100, 300, 800])("도착 지연 %dms: 예약 지점은 서버 시각 T0 + at 이고 유예보다 지난 항목은 버려진다", (delay) => {
    const { out, local } = enter({ passed: true }, delay);
    const got = slots(out, local);
    const nominal = [
      ...verdictScript({ passed: true, last: false, hasBallots: true }).items.map((i) => ({ at: i.at, id: i.id as string })),
      { at: 0, id: "pin.on" },
    ];
    const kept = nominal.filter((i) => i.at - delay >= -GRACE_MS);
    // 지금 내는 항목(이미 지났지만 유예 안)은 도착 시각(= delay)에, 앞의 항목은 T0 + at 에 선다
    const expected = kept.map((i) => ({ at: Math.max(i.at, delay), id: i.id }));
    expect(got.map(key).sort()).toEqual(expected.map(key).sort());
    expect(got.some((x) => x.id === "execution.gavel" && x.at === ANNOUNCE_AT)).toBe(true);
  });

  it("열 단언: 800ms 지연이면 0 의 심장 박동은 버려지고 600(ballot.yes, 유예 안)·800(경계) 은 지금 난다", () => {
    const { out, local } = enter({ passed: true }, 800);
    const now = out.now.map((c) => c.id).sort();
    expect(now).toEqual(["ballot.yes", "verdict.heart"]);
    const all = slots(out, local);
    expect(all.filter((x) => x.id === "verdict.heart").map((x) => x.at)).toEqual([800, 1500, 2050, 2400]);
    expect(all.some((x) => x.id === "pin.on")).toBe(false);
  });

  it("도착이 늦은 덕킹은 남은 구간만: toMs = 4600 − 지연", () => {
    for (const d of [0, 100, 300, 800]) {
      const duck = enter({ passed: true }, d).out.scripts.find((s) => s.key === "phase:execution:1")!.duck!;
      expect(duck.fromMs).toBe(0);
      expect(duck.toMs).toBe(BALLOT_END_AT - d);
      expect(duck.returnMs).toBe(800);
    }
  });

  it("오프셋이 있어도 서버 시각 기준이다 (local.now + offset)", () => {
    const local = clock({ now: T0 - 40_000 + 300, offset: 40_000 });
    const out = direct(verdictPhase(), exec({ passed: true }), local);
    const base = enter({ passed: true }, 300);
    expect(slots(out, local).map(key)).toEqual(slots(base.out, base.local).map(key));
  });

  it("어떤 지연에서도 2600 항목은 남는다", () => {
    for (const d of [0, 100, 300, 800, 1500, 2599]) {
      const { out, local } = enter({ passed: false }, d);
      expect(slots(out, local).some((x) => x.id === "verdict.reject" && x.at === ANNOUNCE_AT), `delay ${d}`).toBe(true);
    }
  });
});

describe("재접속·되풀이·정리 (LS-10)", () => {
  it("처형 중간에 처음 받은 view 는 침대뿐 (대본·소리 없음)", () => {
    const out = direct(null, exec({ passed: true }), clock({ now: T0 + 1500 }));
    expect(out.bed).toBe("bed.vote");
    expect(out.scripts).toEqual([]);
    expect(out.now).toEqual([]);
  });

  it("연결 번호가 바뀐 렌더는 처형 대본이 없다", () => {
    const out = direct(verdictPhase(), exec({ passed: true }), clock({ reset: true }));
    expect(out.scripts).toEqual([]);
    expect(out.now).toEqual([]);
    expect(out.bed).toBe("bed.vote");
  });

  it("같은 처형 view 의 되풀이는 새 예약이 없다", () => {
    const out = direct(exec({ passed: true }), exec({ passed: true }), clock({ now: T0 + 500 }));
    expect(out.scripts).toEqual([]);
    expect(out.now).toEqual([]);
    expect(out.cancel).toEqual([]);
  });

  it("처형이 끝나 밤으로 가면 남은 처형 대본 키를 취소한다", () => {
    const out = direct(exec({ passed: true }), av("night", { endsAt: T0 + 40_000 }), clock({ now: T0 + 3000 }));
    expect(out.cancel).toContain("phase:execution:1");
  });

  it("verdict 가 없는 처형 view(이상한 값)는 대본이 없다", () => {
    const out = direct(verdictPhase(), av("execution", { endsAt: T0 + EXECUTION_MS, candidate: 2 }), clock());
    expect(out.scripts).toEqual([]);
    expect(out.now).toEqual([]);
  });

  it("마감이 없는 처형 view 는 대본이 없다", () => {
    const out = direct(verdictPhase(), av("execution", { endsAt: null, verdict: { passed: true, last: false }, hasBallots: true, candidate: 2 }), clock());
    expect(out.scripts).toEqual([]);
    expect(sorted(slots(out, clock())).length).toBe(0);
  });
});

describe("audioViewOf: 판결 필드는 공개 불리언뿐 (LS-6)", () => {
  const players: PublicPlayer[] = [0, 1, 2, 3].map((seat) => ({ seat, nickname: `p${seat}`, connected: true, isHost: seat === 0 }));
  const view = (day: RoomView["day"]): RoomView => ({
    code: "0042", phase: "execution", phaseEndsAt: T0 + EXECUTION_MS, phaseDurationMs: null, serverNow: T0, minPlayers: 4, maxPlayers: 8, players, me: { seat: 1, isHost: false }, day,
  });

  it("verdict 는 {passed, last}, 찬반 기록은 있는가 불리언만 — 수·좌석은 읽지 않는다", () => {
    const a = audioViewOf(view({ n: 1, roles: [], candidate: 2, verdict: { yes: 2, no: 1, passed: true }, ballots: { yes: [0, 1], no: [3] } }));
    expect(a.verdict).toEqual({ passed: true, last: false });
    expect(a.hasBallots).toBe(true);
    expect(JSON.stringify(a)).not.toContain("ballots");
    expect(Object.keys(a).every((k) => (AUDIO_VIEW_FIELDS as readonly string[]).includes(k))).toBe(true);
  });

  it("마지막 3인 처형은 last 참, 기록 없음", () => {
    const a = audioViewOf(view({ n: 1, roles: [], candidate: 2, verdict: { yes: 0, no: 0, passed: true, last: true } }));
    expect(a.verdict).toEqual({ passed: true, last: true });
    expect(a.hasBallots).toBe(false);
  });

  it("처형 단계가 아니면 null·거짓", () => {
    const a = audioViewOf(view({ n: 1, roles: [] }));
    expect(a.verdict).toBeNull();
    expect(a.hasBallots).toBe(false);
  });

  it("찬반 기록 안의 좌석·수를 바꿔도 출력이 같다", () => {
    const mk = (yes: number[], no: number[]) => audioViewOf(view({ n: 1, roles: [], candidate: 2, verdict: { yes: yes.length, no: no.length, passed: yes.length > no.length }, ballots: { yes, no } }));
    expect(mk([0, 1, 3], [])).toEqual(mk([0, 3], [1]));
  });
});

// ───────────────────────── 결선·마지막 3인·핀 (D-3) ─────────────────────────

const ids = (out: DirectOutput): string[] => out.now.map((c) => c.id);
const quiet = (out: DirectOutput): boolean => out.cancel.length === 0 && !("bed" in out) && out.scripts.length === 0 && out.now.length === 0 && out.duck === null;
const runoff = (step: 0 | 1 | 2): AudioView => av("runoff", { endsAt: T0 + 20_000, runoff: { step } });
const showdown = (i: number, over: Partial<AudioView> = {}): AudioView => av("showdown", { endsAt: T0 + 30_000, showdown: { order: [0, 1, 3], i }, ...over });

describe("결선 (runoff.intro · pin.on · runoff.reveal)", () => {
  it("runoff 진입: runoff.intro 와 pin.on 이 한 번씩 (침대는 bed.vote 그대로)", () => {
    const out = direct(av("nomination", { endsAt: T0 }), runoff(0), clock());
    expect(ids(out).sort()).toEqual(["pin.on", "runoff.intro"]);
    expect("bed" in out).toBe(false);
  });

  it("step 이 2 로 바뀌는 순간 runoff.reveal 한 번", () => {
    expect(ids(direct(runoff(1), runoff(2), clock()))).toEqual(["runoff.reveal"]);
    expect(ids(direct(runoff(0), runoff(2), clock()))).toEqual(["runoff.reveal"]);
  });

  it("step 0 → 1·같은 step 되풀이(2 → 2)는 소리가 없다", () => {
    expect(quiet(direct(runoff(0), runoff(1), clock()))).toBe(true);
    expect(quiet(direct(runoff(2), runoff(2), clock()))).toBe(true);
  });

  it("첫 스냅샷·epoch 변경은 침대만 (step 2 여도 reveal 없음)", () => {
    const first = direct(null, runoff(2), clock());
    expect(first.now).toEqual([]);
    expect(first.bed).toBe("bed.vote");
    expect(direct(runoff(1), runoff(2), clock({ reset: true })).now).toEqual([]);
  });
});

describe("마지막 3인 (pin.on · showdown.reveal)", () => {
  it("모이기(i −1)에는 소리가 없고, 0~2 차례 시작마다 pin.on 한 번", () => {
    expect(direct(av("nomination", { endsAt: T0 }), showdown(-1), clock()).now).toEqual([]);
    expect(ids(direct(showdown(-1), showdown(0), clock()))).toEqual(["pin.on"]);
    expect(ids(direct(showdown(0), showdown(1), clock()))).toEqual(["pin.on"]);
    expect(ids(direct(showdown(1), showdown(2), clock()))).toEqual(["pin.on"]);
  });

  it("같은 차례 안(확정·한마디 갱신)은 말하는 사람이 같아 소리가 없다", () => {
    const done = showdown(0, { showdown: { order: [0, 1, 3], i: 0 } });
    expect(quiet(direct(showdown(0), done, clock()))).toBe(true);
  });

  it("동시 지목(i 3)에는 핀 소리가 없고, 공개(i 4)가 되는 순간 showdown.reveal 한 번", () => {
    expect(direct(showdown(2), showdown(3), clock()).now).toEqual([]);
    expect(ids(direct(showdown(3), showdown(4), clock()))).toEqual(["showdown.reveal"]);
    expect(quiet(direct(showdown(4), showdown(4), clock()))).toBe(true);
  });

  it("첫 스냅샷은 침대만이다", () => {
    expect(direct(null, showdown(1), clock()).now).toEqual([]);
  });
});

describe("신호 vote·deny (LS-7)", () => {
  it.each(["lobby", "discussion", "nomination", "runoff", "showdown", "defense", "verdict", "execution", "morning", "ended"] as const)("%s: vote → vote.cast, deny → ui.deny 한 번", (phase) => {
    expect(directSignal({ kind: "vote" }, av(phase)).now).toEqual([{ id: "vote.cast" }]);
    expect(directSignal({ kind: "deny" }, av(phase)).now).toEqual([{ id: "ui.deny" }]);
  });

  it("밤에는 둘 다 무음", () => {
    expect(quiet(directSignal({ kind: "vote" }, av("night")))).toBe(true);
    expect(quiet(directSignal({ kind: "deny" }, av("night")))).toBe(true);
  });

  it("신호에는 값이 없다 — 객체 키가 kind 하나뿐이다", () => {
    const yes = { kind: "vote" as const };
    const no = { kind: "vote" as const };
    expect(JSON.stringify(directSignal(yes, av("verdict")))).toBe(JSON.stringify(directSignal(no, av("verdict", { mySeat: 3 }))));
    expect(Object.keys(yes)).toEqual(["kind"]);
  });

  it("이 계획이 새로 내는 id 는 모두 화면 대응 표에 있다", () => {
    for (const id of ["runoff.intro", "runoff.reveal", "showdown.reveal", "vote.cast", "ui.deny", "pin.on"] as const) expect(SCREEN_COUNTERPART[id], id).toBeTruthy();
  });
});
