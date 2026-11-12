// 지목 규칙 표 시험 — DAY-04·05, 결정 0060-3.
// 지목(nomination 15초)에서 산 사람이 산 사람을 가리키고, 마감에서 최다 득표 한 명이 변론자가 된다.
// 실제 전이(startGame)로 만든 낮 상태에서 단계만 nomination 으로 둔다(흐름 전환은 08-11).
// 실패 출력은 한 줄이어야 해서(TAP) 비교는 가능한 한 문자열 하나로 한다.
import { describe, expect, it } from "vitest";
import {
  castPoint,
  castTurnPoint,
  enterNomination,
  majorityOf,
  nominationStepMs,
  pointLinesOf,
  resolveNomination,
  stepNomination,
  tallyPoints,
} from "../../shared/game/nomination";
import {
  NOMINATION_END_MS,
  NOMINATION_GATHER_MS,
  PHASE_DEFS,
  PICK_GAP_MS,
  PICK_TURN_MS,
  nominationMaxMs,
} from "../../shared/game/phases";
import { enterDiscussion, phaseDurationOf } from "../../shared/game/discussion";
import { rulesetOf } from "../../shared/game/ruleset";
import type { RoomState } from "../../shared/game/room";
import { tick } from "../../shared/game/tick";
import { castPoints, nominationSpanMs, startedAt } from "../helpers/voteState";
const GAME_RULES = rulesetOf("extended");

/** n 명이 산 채로 지목 단계에 있는 방(1일차). */
function nominationOf(n = 5): RoomState {
  return { ...startedAt(n, 1, "discussion"), phase: "nomination" };
}

const idOf = (state: RoomState, seat: number): string => state.players.find((p) => p.seat === seat)!.id;
const keysOf = (value: unknown): string => JSON.stringify(Object.keys(value as object).sort());
const err = (r: { ok: boolean; error?: string }): string => (r.ok ? "ok" : (r.error ?? "?"));

/** seat → 가리킨 seat 로 nominate 를 직접 채운다(규칙 함수를 거치지 않는 상태 만들기). */
function withPoints(state: RoomState, targetBySeat: Record<number, number>): RoomState {
  return {
    ...state,
    players: state.players.map((p) => (p.seat in targetBySeat ? { ...p, nominate: targetBySeat[p.seat]! } : p)),
  };
}

function withDead(state: RoomState, seats: number[]): RoomState {
  return { ...state, players: state.players.map((p) => (seats.includes(p.seat) ? { ...p, alive: false } : p)) };
}

const hasNominateKey = (state: RoomState): boolean => state.players.some((p) => "nominate" in p);

describe("majorityOf (DAY-04·05)", () => {
  it("산 사람 수의 과반은 ⌊n ÷ 2⌋ + 1 이다", () => {
    expect([2, 3, 4, 5, 8].map(majorityOf).join(" ")).toBe("2 2 3 3 5");
  });
});

describe("tallyPoints (DAY-04·05)", () => {
  it("3:1:1 이면 3표 대상이 leader 이고 과반 수는 3 이다", () => {
    const state = withPoints(nominationOf(), { 0: 2, 1: 2, 3: 2, 2: 0, 4: 1 });
    const t = tallyPoints(state);
    expect(`${t.leader} ${t.majority} ${JSON.stringify(t.counts)} ${t.votes.length}`).toBe(
      `2 3 ${JSON.stringify({ 0: 1, 1: 1, 2: 3 })} 5`,
    );
  });

  it("2:2:1 동률이면 leader 가 없다", () => {
    const state = withPoints(nominationOf(), { 0: 2, 1: 2, 2: 0, 3: 0, 4: 1 });
    expect(String(tallyPoints(state).leader)).toBe("undefined");
  });

  it("0표면 votes 가 비고 leader 가 없다", () => {
    const t = tallyPoints(nominationOf());
    expect(`${JSON.stringify(t.votes)} ${String(t.leader)}`).toBe("[] undefined");
  });

  it("죽은 사람이 던진 표와 죽은 대상을 가리킨 표는 세지 않는다 (A1 방어)", () => {
    const state = withDead(withPoints(nominationOf(), { 0: 2, 1: 2, 3: 2, 4: 2 }), [3, 2]);
    // 3 은 죽은 행위자, 2 는 죽은 대상 — 남는 표가 없다
    expect(`${JSON.stringify(tallyPoints(state).votes)} ${String(tallyPoints(state).leader)}`).toBe("[] undefined");
  });

  it("pointLinesOf 는 좌석 오름차순이다", () => {
    const state = withPoints(nominationOf(), { 4: 0, 1: 2, 3: 2 });
    expect(JSON.stringify(pointLinesOf(state))).toBe(
      JSON.stringify([
        { seat: 1, target: 2 },
        { seat: 3, target: 2 },
        { seat: 4, target: 0 },
      ]),
    );
  });
});

describe("resolveNomination — 마감 훅 (DAY-05, 결정 0060-3)", () => {
  it("최다 한 명이면 변론자로 정하고 기본 다음 단계(defense)로 간다", () => {
    const base = withPoints(nominationOf(), { 4: 0, 3: 2, 1: 2, 0: 2, 2: 1 });
    const r = resolveNomination(base);
    const line = r.state.voteLog?.at(-1);
    expect(`${r.stay} ${String(r.next)} ${JSON.stringify(r.state.verdict)}`).toBe(`false undefined ${JSON.stringify({ passed: false, candidate: 2 })}`);
    expect(JSON.stringify(line)).toBe(
      JSON.stringify({
        n: base.day ?? 1,
        exec: { yes: 0, no: 0, passed: false },
        cand: {
          votes: [
            { seat: 0, target: 2 },
            { seat: 1, target: 2 },
            { seat: 2, target: 1 },
            { seat: 3, target: 2 },
            { seat: 4, target: 0 },
          ],
          candidate: 2,
        },
      }),
    );
    expect(hasNominateKey(r.state)).toBe(false);
  });

  it("최다가 셋 이상 동률이면 next 가 night 이고 후보가 없다 (결선 없음, 결정 0066-4)", () => {
    // 0→1, 1→2, 2→0: 세 명이 한 표씩 최다 동점
    const r = resolveNomination(withPoints(nominationOf(), { 0: 1, 1: 2, 2: 0 }));
    const cand = r.state.voteLog?.at(-1)?.cand;
    expect(`${String(r.next)} ${keysOf(cand ?? {})} ${JSON.stringify(r.state.verdict)}`).toBe(`night ${keysOf({ votes: 1 })} ${JSON.stringify({ passed: false })}`);
    expect(r.state.runoff).toBeUndefined();
    expect(hasNominateKey(r.state)).toBe(false);
  });

  // 기본판(결정 0072)에서 꺼짐 — 판 규칙의 runoff 를 켜면 다시 돈다
  it.skipIf(!GAME_RULES.runoff)("최다가 정확히 둘 동점이면 next 가 runoff 이고 후보 둘이 낮은 좌석부터 서며 그날 줄에는 candidate 가 없다 (결정 0066-4)", () => {
    const r = resolveNomination(withPoints(nominationOf(), { 0: 2, 1: 2, 2: 0, 3: 0, 4: 1 }));
    const cand = r.state.voteLog?.at(-1)?.cand;
    expect(`${String(r.next)} ${keysOf(cand ?? {})} ${JSON.stringify(r.state.verdict)} ${JSON.stringify(r.state.runoff)}`).toBe(
      `runoff ${keysOf({ votes: 1 })} ${JSON.stringify({ passed: false })} ${JSON.stringify({ cand: [0, 2], step: 0 })}`,
    );
    expect(r.stay).toBe(false);
    expect(hasNominateKey(r.state)).toBe(false);
    expect(r.state.pickTurn).toBeUndefined();
  });

  it("0표여도 그날 줄은 항상 쌓이고 next 가 night 이다", () => {
    const r = resolveNomination(nominationOf());
    const line = r.state.voteLog?.at(-1);
    expect(`${String(r.next)} ${JSON.stringify(line?.cand?.votes)} ${line?.n}`).toBe("night [] 1");
  });

  it("이전 날 기록은 그대로 두고 줄만 더한다", () => {
    const old = { n: 0, exec: { yes: 1, no: 0, passed: true } };
    const base = { ...nominationOf(), voteLog: [old] };
    const r = resolveNomination(base);
    expect(`${r.state.voteLog?.length} ${r.state.voteLog?.[0] === old}`).toBe("2 true");
  });

  it("입력 상태를 바꾸지 않는다", () => {
    const base = withPoints(nominationOf(), { 0: 2, 1: 2, 3: 2 });
    const before = JSON.stringify(base);
    resolveNomination(base);
    tallyPoints(base);
    expect(JSON.stringify(base)).toBe(before);
  });
});

describe("vote.test 에서 옮긴 뜻 (08-28, DAY-06·07)", () => {
  it("단계 표: 지목 진입 길이는 기본판 15000ms(순차 지목이 켜지면 모이기 3000ms)이고 기본 다음 단계는 defense, 역할 노출은 true 다 (옛 단계 표 시험의 새 흐름 행)", () => {
    const d = PHASE_DEFS.nomination;
    expect(`${d.durationMs}/${d.next}/${d.revealsOwnRole}`).toBe(`${GAME_RULES.pickTurn ? 3000 : 15000}/defense/true`);
  });

  it("던진 뒤 연결이 끊긴 사람의 표도 센다 (옛 CONN-02)", () => {
    const base = withPoints(nominationOf(), { 0: 2, 1: 2 });
    const dropped: RoomState = {
      ...base,
      players: base.players.map((p) => (p.seat === 0 ? { ...p, connected: false, connId: null } : p)),
    };
    const t = tallyPoints(dropped);
    expect(`${t.leader} ${JSON.stringify(t.counts)}`).toBe(`2 ${JSON.stringify({ 2: 2 })}`);
  });

  it("입력을 깊게 얼려도 castTurnPoint·tallyPoints·resolveNomination 이 예외 없이 돈다", () => {
    const freeze = <T>(v: T): T => {
      if (v !== null && typeof v === "object" && !Object.isFrozen(v)) {
        Object.freeze(v);
        for (const c of Object.values(v as Record<string, unknown>)) freeze(c);
      }
      return v;
    };
    // 첫 차례가 선 순차 지목 상태: 모이기 마감에 한 걸음 → 차례 주인이 지목할 수 있다.
    const entered = enterNomination(startedAt(5, 1, "nomination"));
    const gathered = stepNomination({ ...entered, phaseEndsAt: 100_000 }, 100_000);
    const base = freeze({ ...gathered.state, phaseEndsAt: 100_000 + PICK_TURN_MS });
    const owner = base.players.find((p) => p.seat === base.pickTurn!.order[0])!;
    expect(() => {
      castTurnPoint(base, owner.id, base.players.find((p) => p.seat !== owner.seat)!.seat, 100_001);
      tallyPoints(base);
      resolveNomination(base);
    }).not.toThrow();
  });

  it("4~8명 × 모두 다음 좌석을 가리키는 판과 한 명에게 몰린 판: votes 길이는 던진 사람 수이고 leader 는 최다 득표자다", () => {
    const got: string[] = [];
    for (let n = 4; n <= 8; n += 1) {
      const room = startedAt(n, 1, "discussion");
      const pointed = { ...room, phase: "nomination" as const };
      const target: Record<number, number> = {};
      for (let s = 1; s < n; s += 1) target[s] = 0; // 0번 제외 모두 0번을 가리킨다
      const t = tallyPoints(withPoints(pointed, target));
      got.push(`${n}:${t.votes.length}/${t.leader}`);
    }
    expect(got.join(" ")).toBe("4:3/0 5:4/0 6:5/0 7:6/0 8:7/0");
  });
});

// ---- 순차 지목 엔진 (09.1-01, 결정 0063-1·0063-4, M-5) ----
// 이 계획은 tick 표에 엔진을 걸지 않는다 — 시험은 진입 함수를 직접 부른다(09.1-04 가 건다).
describe("순차 지목 엔진 (결정 0063-1·0063-4)", () => {
  const T = 100_000;
  /** n 명 판의 지목 진입 직후: 모이기 3초 마감이 걸린 상태. */
  const enteredAt = (n = 4, seed = 1): RoomState => {
    const s = enterNomination(startedAt(n, seed, "nomination"));
    return { ...s, phaseEndsAt: T + nominationStepMs(s) };
  };
  /** 한 걸음: 마감 시각 at 에 stepNomination 을 적용하고 새 마감(at + 단계 길이)을 건다. */
  const run = (s: RoomState, at: number): RoomState => {
    const r = stepNomination(s, at);
    return { ...r.state, phaseEndsAt: r.stay ? at + nominationStepMs(r.state) : null };
  };
  const turnOf = (s: RoomState): string => JSON.stringify(s.pickTurn);

  it("시간 상수와 최악 길이 공식: 모이기 3000 · 차례 8000 · 사이 900 · 끝 2000, 최악은 3000 + n × 8900 + 2000", () => {
    expect([NOMINATION_GATHER_MS, PICK_TURN_MS, PICK_GAP_MS, NOMINATION_END_MS].join(" ")).toBe("3000 8000 900 2000");
    expect([8, 4, 2].map(nominationMaxMs).join(" ")).toBe("76200 40600 22800");
  });

  it("enterNomination: 산 사람 좌석 오름차순 order, i -1, 남은 nominate 는 모두 지워지고 입력은 그대로다", () => {
    const base = withDead(withPoints(nominationOf(5), { 0: 1, 2: 3, 4: 0 }), [3]);
    const before = JSON.stringify(base);
    const s = enterNomination(base);
    expect(JSON.stringify(s.pickTurn)).toBe(JSON.stringify({ order: [0, 1, 2, 4], i: -1 }));
    expect(hasNominateKey(s)).toBe(false);
    expect(JSON.stringify(base)).toBe(before);
  });

  it("nominationStepMs: 모이기 3000 · 차례 중 8000 · 확정 뒤 900 · 끝 알림 2000 · pickTurn 없으면 단계 표 값", () => {
    const entered = enteredAt();
    const turn = run(entered, T + 3000);
    const done = castTurnPoint(turn, idOf(turn, 0), 1, T + 5000);
    if (!done.ok) throw new Error("rejected");
    const end: RoomState = { ...turn, pickTurn: { order: [0, 1, 2, 3], i: 4 } };
    const none: RoomState = { ...turn };
    delete none.pickTurn;
    const got = [entered, turn, done.state, end, none].map(nominationStepMs);
    expect(got.join(" ")).toBe(`3000 8000 900 2000 ${PHASE_DEFS.nomination.durationMs}`);
  });

  it("stepNomination 한 걸음씩: 모이기 → 첫 차례 → 기권 → 사이 뒤 다음 차례 → 마지막 뒤 끝 알림 → 집계", () => {
    const s0 = enteredAt();
    const r0 = stepNomination(s0, T + 3000);
    const s1 = r0.state;
    const r1 = stepNomination(s1, T + 11_000); // 미확정 → 기권
    const r2 = stepNomination(r1.state, T + 11_900); // 사이 끝 → 다음 차례
    const lastDone: RoomState = { ...r2.state, pickTurn: { order: [0, 1, 2, 3], i: 3, endsAt: T + 30_000, doneAt: T + 20_000 } };
    const r3 = stepNomination(lastDone, T + 20_900); // 마지막 확정 뒤 → 끝 알림
    const r4 = stepNomination(r3.state, T + 22_900); // 끝 알림 뒤 → 집계
    expect(
      [r0, r1, r2, r3, r4]
        .map((r) => `${String(r.stay)}:${JSON.stringify(r.state.pickTurn)}`)
        .join("\n"),
    ).toBe(
      [
        `true:{"order":[0,1,2,3],"i":0,"endsAt":${T + 11_000}}`,
        `true:{"order":[0,1,2,3],"i":0,"endsAt":${T + 11_000},"doneAt":${T + 11_000},"skip":true}`,
        `true:{"order":[0,1,2,3],"i":1,"endsAt":${T + 19_900}}`,
        `true:{"order":[0,1,2,3],"i":4}`,
        `false:undefined`,
      ].join("\n"),
    );
  });

  it("pickTurn 이 없으면 안전장치로 바로 집계한다(resolveNomination 결과)", () => {
    const s = nominationOf(4);
    expect(JSON.stringify(stepNomination(s, T))).toBe(JSON.stringify(resolveNomination(s)));
  });

  it("castTurnPoint: 차례 주인의 지목은 그 차례를 즉시 확정하고 마감을 now + 900 으로 옮긴다", () => {
    const turn = run(enteredAt(), T + 3000);
    const r = castTurnPoint(turn, idOf(turn, 0), 2, T + 4000);
    if (!r.ok) throw new Error("rejected");
    const p = r.state.players.find((q) => q.seat === 0)!;
    expect(`${String(p.nominate)} ${turnOf(r.state)} ${String(r.state.phaseEndsAt)}`).toBe(
      `2 {"order":[0,1,2,3],"i":0,"endsAt":${T + 11_000},"doneAt":${T + 4000}} ${T + 4900}`,
    );
  });

  it("4명 한 바퀴: 자리 순서 · 8초 차례 · 기권 · 0.9초 사이 · 끝 2초 · 집계 — 마감 사슬을 한 문자열로 고정한다", () => {
    let s = enteredAt();
    const trace: string[] = [`enter ${s.phaseEndsAt}`];
    const pick = (seat: number, target: number, at: number): void => {
      const r = castTurnPoint(s, idOf(s, seat), target, at);
      if (!r.ok) throw new Error(`rejected ${seat}->${target}: ${r.error}`);
      s = r.state;
      trace.push(`pick${seat}>${target}@${at} ${s.phaseEndsAt}`);
    };
    const step = (at: number): void => {
      s = run(s, at);
      trace.push(`step@${at} i=${String(s.pickTurn?.i)} end=${String(s.pickTurn?.endsAt)} next=${String(s.phaseEndsAt)}`);
    };
    step(T + 3000); // seat0 차례 시작
    pick(0, 1, T + 5000);
    step(T + 5900); // seat1 차례
    step(T + 13_900); // seat1 기권
    step(T + 14_800); // seat2 차례
    pick(2, 1, T + 15_000);
    step(T + 15_900); // seat3 차례
    pick(3, 1, T + 16_000);
    step(T + 16_900); // 끝 알림
    const last = stepNomination(s, T + 18_900);
    const verdict = JSON.stringify(last.state.verdict);
    const cand = JSON.stringify(last.state.voteLog?.at(-1)?.cand);
    expect(trace.join("\n")).toBe(
      [
        `enter ${T + 3000}`,
        `step@${T + 3000} i=0 end=${T + 11_000} next=${T + 11_000}`,
        `pick0>1@${T + 5000} ${T + 5900}`,
        `step@${T + 5900} i=1 end=${T + 13_900} next=${T + 13_900}`,
        `step@${T + 13_900} i=1 end=${T + 13_900} next=${T + 14_800}`,
        `step@${T + 14_800} i=2 end=${T + 22_800} next=${T + 22_800}`,
        `pick2>1@${T + 15_000} ${T + 15_900}`,
        `step@${T + 15_900} i=3 end=${T + 23_900} next=${T + 23_900}`,
        `pick3>1@${T + 16_000} ${T + 16_900}`,
        `step@${T + 16_900} i=4 end=undefined next=${T + 18_900}`,
      ].join("\n"),
    );
    expect(`${String(last.stay)} ${String(last.next)} ${verdict} ${cand} ${String("pickTurn" in last.state)}`).toBe(
      `false undefined {"passed":false,"candidate":1} {"votes":[{"seat":0,"target":1},{"seat":2,"target":1},{"seat":3,"target":1}],"candidate":1} false`,
    );
  });

  it("과반(4명 중 3표)이 나와도 마지막 차례까지 돈다 — i 가 order.length 에 닿을 때까지 stay true (0063-4)", () => {
    let s = enteredAt();
    let at = T + 3000;
    const stays: string[] = [];
    s = run(s, at); // seat0 차례
    for (const [seat, target] of [[0, 1], [1, 2], [2, 1], [3, 1]] as const) {
      const r = castTurnPoint(s, idOf(s, seat), target, at + 100);
      if (!r.ok) throw new Error("rejected");
      s = r.state;
      at = s.phaseEndsAt!;
      const step = stepNomination(s, at);
      stays.push(`${seat}:${String(step.stay)}:${String(step.state.pickTurn?.i)}`);
      s = { ...step.state, phaseEndsAt: at + nominationStepMs(step.state) };
    }
    const fin = stepNomination(s, s.phaseEndsAt!);
    expect(`${stays.join(" ")} fin:${String(fin.stay)}`).toBe("0:true:1 1:true:2 2:true:3 3:true:4 fin:false");
  });

  it("resolveNomination 결과에는 pickTurn 키가 없다", () => {
    const s = enteredAt();
    expect("pickTurn" in resolveNomination(s).state).toBe(false);
  });
});

// ---- 차례 거절 규칙 (09.1-01 Task 2, UI-SPEC L15 순수 몫) ----
describe("castTurnPoint 거절 규칙 (L15 순수 몫)", () => {
  const T = 200_000;
  /** 4명 판, seat 0 의 차례가 T+3000 에 시작된 상태(마감 T+11000). */
  const seat0Turn = (): RoomState => {
    const s = enterNomination(startedAt(4, 1, "nomination"));
    const r = stepNomination({ ...s, phaseEndsAt: T + 3000 }, T + 3000);
    return { ...r.state, phaseEndsAt: T + 11_000 };
  };
  const verdictOf = (s: RoomState, actor: string, target: number, now: number): string => {
    const before = JSON.stringify(s);
    const r = castTurnPoint(s, actor, target, now);
    const unchanged = JSON.stringify(s) === before;
    return `${err(r)}${unchanged ? "" : " MUTATED"}`;
  };

  it("차례 주인이 산 남을 가리키면 받아들인다", () => {
    const s = seat0Turn();
    expect(verdictOf(s, idOf(s, 0), 3, T + 4000)).toBe("ok");
  });

  it("단계 검사가 먼저다: nomination 이 아니면 누구든 WRONG_PHASE", () => {
    const s: RoomState = { ...seat0Turn(), phase: "discussion" };
    expect(verdictOf(s, idOf(s, 0), 1, T + 4000)).toBe("WRONG_PHASE");
  });

  it("행위자 검사: 모르는 id · 탈락한 사람은 BAD_MESSAGE (유령은 남의 차례에 보내도 BAD_MESSAGE)", () => {
    const s = withDead(seat0Turn(), [3]);
    expect([verdictOf(s, "nobody", 1, T + 4000), verdictOf(s, idOf(s, 3), 1, T + 4000)].join(" ")).toBe("BAD_MESSAGE BAD_MESSAGE");
  });

  it("차례 검사: 차례 아닌 산 사람 · pickTurn 없음 · 모이는 중 · 끝 알림 · 이미 확정 · 마감 시각 이후는 WRONG_PHASE", () => {
    const s = seat0Turn();
    const turn = s.pickTurn!;
    const noTurn: RoomState = { ...s };
    delete noTurn.pickTurn;
    const cases: Array<[string, RoomState, string, number]> = [
      ["남의 차례", s, idOf(s, 1), T + 4000],
      ["pickTurn 없음", noTurn, idOf(s, 0), T + 4000],
      ["모이는 중", { ...s, pickTurn: { order: turn.order, i: -1 } }, idOf(s, 0), T + 1000],
      ["끝 알림", { ...s, pickTurn: { order: turn.order, i: turn.order.length } }, idOf(s, 0), T + 4000],
      ["이미 확정", { ...s, pickTurn: { ...turn, doneAt: T + 4000 } }, idOf(s, 0), T + 4500],
      ["마감 정각", s, idOf(s, 0), T + 11_000],
      ["마감 뒤", s, idOf(s, 0), T + 12_000],
    ];
    expect(cases.map(([name, st, who, now]) => `${name}:${verdictOf(st, who, 1, now)}`).join(" ")).toBe(
      "남의 차례:WRONG_PHASE pickTurn 없음:WRONG_PHASE 모이는 중:WRONG_PHASE 끝 알림:WRONG_PHASE 이미 확정:WRONG_PHASE 마감 정각:WRONG_PHASE 마감 뒤:WRONG_PHASE",
    );
  });

  it("확정한 차례 주인이 다시 보내면 WRONG_PHASE (바꾸기 없음)", () => {
    const s = seat0Turn();
    const first = castTurnPoint(s, idOf(s, 0), 1, T + 4000);
    if (!first.ok) throw new Error("rejected");
    expect(verdictOf(first.state, idOf(s, 0), 2, T + 4100)).toBe("WRONG_PHASE");
  });

  it("대상 검사: 정수 아님 · 없는 좌석 · 탈락한 사람 · 자기 자신은 BAD_MESSAGE", () => {
    const s = withDead(seat0Turn(), [2]);
    const who = idOf(s, 0);
    expect([1.5, Number.NaN, 99, 2, 0].map((t) => verdictOf(s, who, t, T + 4000)).join(" ")).toBe(
      "BAD_MESSAGE BAD_MESSAGE BAD_MESSAGE BAD_MESSAGE BAD_MESSAGE",
    );
  });

  it("검사 순서: 차례 아닌 산 사람은 대상이 틀려도 WRONG_PHASE (차례 검사가 대상 검사보다 먼저)", () => {
    const s = seat0Turn();
    expect(verdictOf(s, idOf(s, 1), 99, T + 4000)).toBe("WRONG_PHASE");
  });
});

describe("끊긴 차례 (M-3)", () => {
  const T = 300_000;
  const offline = (s: RoomState, seat: number): RoomState => ({
    ...s,
    players: s.players.map((p) => (p.seat === seat ? { ...p, connected: false, connId: null } : p)),
  });
  const seat0Turn = (): RoomState => {
    const s = offline(enterNomination(startedAt(4, 1, "nomination")), 0);
    const r = stepNomination({ ...s, phaseEndsAt: T + 3000 }, T + 3000);
    return { ...r.state, phaseEndsAt: T + 11_000 };
  };

  it("차례 주인의 connected 가 false 여도 마감 전 지목은 받아들인다", () => {
    const s = seat0Turn();
    expect(err(castTurnPoint(s, idOf(s, 0), 1, T + 10_999))).toBe("ok");
  });

  it("끊긴 채로 두면 8초를 다 기다린 뒤 기권으로 확정된다(doneAt = endsAt, skip)", () => {
    const s = seat0Turn();
    const r = stepNomination(s, s.phaseEndsAt!);
    expect(JSON.stringify(r.state.pickTurn)).toBe(
      JSON.stringify({ order: [0, 1, 2, 3], i: 0, endsAt: T + 11_000, doneAt: T + 11_000, skip: true }),
    );
  });
});

describe("단계 길이와 지움 (09.1-01)", () => {
  it("phaseDurationOf: nomination + pickTurn 이면 세부 단계 길이, pickTurn 이 없으면 지금 값(단계 표)", () => {
    const entered = enterNomination(startedAt(4, 1, "nomination"));
    const none: RoomState = { ...entered };
    delete none.pickTurn;
    expect(`${String(phaseDurationOf(entered))} ${String(phaseDurationOf(none))}`).toBe(`3000 ${PHASE_DEFS.nomination.durationMs}`);
  });

  it("enterDiscussion 결과에는 pickTurn 키가 없다", () => {
    const entered = enterNomination(startedAt(4, 1, "nomination"));
    expect("pickTurn" in enterDiscussion(entered)).toBe(false);
  });
});

describe("시험 도우미: 지목 방식과 무관 (09.1-03)", () => {
  it("castPoints 는 pickTurn 이 있으면 차례를 걸어 끝 알림 자리에 서고, 대상 없는 좌석은 기권, 나머지는 nominate", () => {
    const entered = enterNomination(startedAt(4, 1, "nomination"));
    const s = castPoints({ ...entered, phaseEndsAt: 100_000 + nominationStepMs(entered) }, { 0: 1, 2: 1, 3: 1 });
    const nominates = s.players.map((p) => `${p.seat}>${p.nominate ?? "-"}`).join(",");
    expect(`${String(s.pickTurn?.i)} ${nominates}`).toBe("4 0>1,1>-,2>1,3>1");
  });

  // 기본판(결정 0072)에서 꺼짐 — 차례 없는 지목이 동시 투표이므로 castPoints 가 던지지 않는다. 판 규칙의 pickTurn 을 켜면 다시 돈다
  it.skipIf(!GAME_RULES.pickTurn)("castPoints 는 pickTurn 이 없는 지목 상태를 받으면 Error (차례 없는 옛 동시 지목은 없다, 09.1-05)", () => {
    expect(() => castPoints(nominationOf(4), { 0: 1, 1: 0 })).toThrow();
  });

  it("nominationSpanMs: 전환 뒤 startedAt 의 지목 길이는 기본판 투표 15000ms, 순차 지목이면 차례 사슬 전체 길이 nominationMaxMs(4) 다 (전원 기권)", () => {
    expect(nominationSpanMs(startedAt(4, 1, "nomination"), 2)).toBe(GAME_RULES.pickTurn ? nominationMaxMs(4) : 15_000);
  });

  it("nominationSpanMs 는 지목이 아닌 상태를 받으면 Error", () => {
    expect(() => nominationSpanMs(startedAt(4, 1, "discussion"), 2)).toThrow();
  });
});

describe("기본판 투표 castPoint·집계 (결정 0072, D-03)", () => {
  const vote = (state: RoomState, actorSeat: number, target: number) => castPoint(state, idOf(state, actorSeat), target);

  it("castPoint 거부 코드: 단계가 아니면 WRONG_PHASE, 죽은·없는 행위자, 정수 아님·죽은·없는 대상, 자기 자신은 BAD_MESSAGE", () => {
    const base = withDead(nominationOf(), [4]);
    const rows = [
      err(castPoint({ ...base, phase: "discussion" }, idOf(base, 0), 1)),
      err(vote(base, 4, 1)),
      err(castPoint(base, "nobody", 1)),
      err(vote(base, 0, 1.5)),
      err(vote(base, 0, 4)),
      err(vote(base, 0, 9)),
      err(vote(base, 0, 0)),
      err(vote(base, 0, 1)),
    ];
    expect(rows.join(" ")).toBe("WRONG_PHASE BAD_MESSAGE BAD_MESSAGE BAD_MESSAGE BAD_MESSAGE BAD_MESSAGE BAD_MESSAGE ok");
  });

  it("같은 값을 다시 던지면 입력과 같은 객체이고, 다른 값이면 그 사람의 nominate 만 바뀐다 (취소 없음)", () => {
    const base = nominationOf();
    const first = vote(base, 0, 1);
    if (!first.ok) throw new Error("rejected");
    const again = castPoint(first.state, idOf(base, 0), 1);
    expect(again.ok && again.state === first.state).toBe(true);
    const changed = vote(first.state, 0, 2);
    if (!changed.ok) throw new Error("rejected");
    expect(changed.state.players.map((p) => `${p.seat}:${p.nominate ?? "-"}`).join(" ")).toBe("0:2 1:- 2:- 3:- 4:-");
    expect(first.state.players[0]!.nominate).toBe(1); // 입력은 바꾸지 않는다
  });

  it("2:2 동점이면 next night 이고 결과 상태에 runoff 키가 없고 candidate 없는 줄에 표 4줄이 쌓인다", () => {
    const base = withPoints(nominationOf(), { 0: 2, 1: 2, 2: 0, 3: 0 });
    const r = resolveNomination(base);
    const line = r.state.voteLog?.at(-1);
    expect(`${String(r.next)} ${r.state.runoff === undefined} ${JSON.stringify(r.state.verdict)} ${line?.cand?.votes.length} ${line?.cand?.candidate}`).toBe(
      `night true ${JSON.stringify({ passed: false })} 4 undefined`,
    );
  });

  it("3:1:1 이 아니라 최다가 셋 동점이어도 0표여도 night 이다", () => {
    const tie3 = resolveNomination(withPoints(nominationOf(), { 0: 1, 1: 2, 2: 0 }));
    const none = resolveNomination(nominationOf());
    expect(`${String(tie3.next)} ${String(none.next)}`).toBe("night night");
  });

  it("최다 한 명이면 next 없이(defense) verdict.candidate 가 그 좌석이다", () => {
    const r = resolveNomination(withPoints(nominationOf(), { 0: 3, 1: 3, 2: 3, 4: 1 }));
    expect(`${String(r.next)} ${JSON.stringify(r.state.verdict)}`).toBe(`undefined ${JSON.stringify({ passed: false, candidate: 3 })}`);
  });
});
