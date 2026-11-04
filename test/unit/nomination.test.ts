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
import type { RoomState } from "../../shared/game/room";
import { tick } from "../../shared/game/tick";
import { startedAt } from "../helpers/voteState";

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

describe("castPoint — 검사 순서가 계약이다 (DAY-04, T-08-04)", () => {
  it("산 사람이 산 사람을 가리키면 그 사람의 nominate 만 바뀐 새 상태가 된다", () => {
    const base = nominationOf();
    const r = castPoint(base, idOf(base, 1), 2);
    if (!r.ok) throw new Error("rejected");
    const changed = r.state.players.filter((p, i) => p !== base.players[i]).map((p) => `${p.seat}:${String(p.nominate)}`);
    expect(changed.join(",")).toBe("1:2");
    expect(r.state === base).toBe(false);
  });

  it("같은 값을 다시 보내면 입력 객체를 그대로 돌려준다", () => {
    const base = nominationOf();
    const first = castPoint(base, idOf(base, 1), 2);
    if (!first.ok) throw new Error("setup rejected");
    const again = castPoint(first.state, idOf(base, 1), 2);
    expect(again.ok && again.state === first.state).toBe(true);
  });

  it("다른 사람으로 바꾸면 마지막 값이 유효하다", () => {
    let state = nominationOf();
    for (const target of [2, 3, 4]) {
      const r = castPoint(state, idOf(state, 1), target);
      if (!r.ok) throw new Error("rejected");
      state = r.state;
    }
    expect(state.players.find((p) => p.seat === 1)!.nominate).toBe(4);
  });

  it("자기 자신·죽은 대상·빈 좌석·정수 아님·취소(null)는 BAD_MESSAGE 다", () => {
    const base = withDead(nominationOf(), [4]);
    const results = [1, 4, 99, 1.5, Number.NaN, null, "2"].map((t) => err(castPoint(base, idOf(base, 1), t as unknown as number)));
    expect(results.join(" ")).toBe(Array(7).fill("BAD_MESSAGE").join(" "));
  });

  it("죽은 행위자와 방에 없는 사람은 BAD_MESSAGE 다", () => {
    const base = withDead(nominationOf(), [4]);
    expect(`${err(castPoint(base, idOf(base, 4), 1))} ${err(castPoint(base, "nobody", 1))}`).toBe("BAD_MESSAGE BAD_MESSAGE");
  });

  it("nomination 이 아닌 단계는 행위자 검사보다 먼저 WRONG_PHASE 다", () => {
    const discussion = { ...nominationOf(), phase: "discussion" as const };
    expect(`${err(castPoint(discussion, "nobody", 1))} ${err(castPoint(discussion, idOf(discussion, 0), 1))}`).toBe(
      "WRONG_PHASE WRONG_PHASE",
    );
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

  it("동률이면 next 가 night 이고 후보가 없다", () => {
    const r = resolveNomination(withPoints(nominationOf(), { 0: 2, 1: 2, 2: 0, 3: 0, 4: 1 }));
    const cand = r.state.voteLog?.at(-1)?.cand;
    expect(`${String(r.next)} ${keysOf(cand ?? {})} ${JSON.stringify(r.state.verdict)}`).toBe(`night ${keysOf({ votes: 1 })} ${JSON.stringify({ passed: false })}`);
    expect(hasNominateKey(r.state)).toBe(false);
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
    castPoint(base, idOf(base, 4), 2);
    tallyPoints(base);
    expect(JSON.stringify(base)).toBe(before);
  });
});

describe("vote.test 에서 옮긴 뜻 (08-28, DAY-06·07)", () => {
  it("단계 표: 지목은 15000ms 이고 기본 다음 단계는 defense, 역할 노출은 true 다 (옛 단계 표 시험의 새 흐름 행)", () => {
    const d = PHASE_DEFS.nomination;
    expect(`${d.durationMs}/${d.next}/${d.revealsOwnRole}`).toBe("15000/defense/true");
  });

  it("던져도 마감(phaseEndsAt)은 그대로이고, 마감 전 tick 은 입력 그대로다 (옛 D-28)", () => {
    let state = nominationOf();
    const ends = state.phaseEndsAt;
    for (const p of state.players) {
      const target = state.players.find((q) => q.seat !== p.seat)!.seat;
      const r = castPoint(state, p.id, target);
      if (!r.ok) throw new Error("rejected");
      state = r.state;
    }
    expect(`${state.phaseEndsAt === ends} ${tick(state, ends! - 1) === state}`).toBe("true true");
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

  it("입력을 깊게 얼려도 castPoint·tallyPoints·resolveNomination 이 예외 없이 돈다", () => {
    const freeze = <T>(v: T): T => {
      if (v !== null && typeof v === "object" && !Object.isFrozen(v)) {
        Object.freeze(v);
        for (const c of Object.values(v as Record<string, unknown>)) freeze(c);
      }
      return v;
    };
    const base = freeze(withPoints(nominationOf(), { 0: 2, 1: 2, 3: 2 }));
    expect(() => {
      castPoint(base, idOf(base, 4), 2);
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
