// 찬반 규칙 시험 — 결정 0089-18(D-10·D-11), 옛 DAY-06·결정 0053·0060-4.
// 기존 test/unit/verdict.test.ts 는 화면 쪽 src/game/verdict.ts 시험이라 이름을 피했다.
// 새 낮 순서: 토론 → 찬반(후보 없음) → 지목 → 유언 → 처형. 유권자 = 산 사람 전원, 던진 표의 과반이 찬성(찬성 × 2 > 찬성 + 반대 ⟺ 찬성 > 반대)이면 통과.
// 못 던진 사람은 분모에 없다(옛 "못 던진 표도 분모" 규칙과 반대). 0표·동수는 부결. 개인 값은 집계 직후 사라진다.
// 실패 출력은 한 줄이어야 해서(TAP) 비교는 가능한 한 문자열 하나로 한다.
import { describe, expect, it } from "vitest";
import { PHASE_DEFS } from "../../shared/game/phases";
import type { RoomState } from "../../shared/game/room";
import { tick } from "../../shared/game/tick";
import { noExecutionOf } from "../../shared/game/execution";
import { castVerdict, resolveVerdict, verdictTallyOf, verdictVotersOf } from "../../shared/game/verdict";
import { seededRandInt } from "../helpers/seededRandom";
import { startedAt } from "../helpers/voteState";

/** n 명 방의 찬반 단계 첫 순간(실제 전이로 닿는다 — 토론 마감 바로 뒤). */
function verdictOf(n = 8): RoomState {
  return startedAt(n, 1, "verdict");
}

const idOf = (state: RoomState, seat: number): string => state.players.find((p) => p.seat === seat)!.id;
const err = (r: { ok: boolean; error?: string }): string => (r.ok ? "ok" : (r.error ?? "?"));

/** 좌석 오름차순으로 앞 yes 명은 찬성, 그다음 no 명은 반대로 verdictVote 를 직접 채운다(나머지는 못 던진 사람). */
function withVotes(state: RoomState, yes: number, no: number): RoomState {
  const seats = state.players.map((p) => p.seat).sort((a, b) => a - b);
  const values = new Map<number, boolean>();
  seats.slice(0, yes).forEach((s) => values.set(s, true));
  seats.slice(yes, yes + no).forEach((s) => values.set(s, false));
  return { ...state, players: state.players.map((p) => (values.has(p.seat) ? { ...p, verdictVote: values.get(p.seat)! } : p)) };
}

function withDead(state: RoomState, seats: number[]): RoomState {
  return { ...state, players: state.players.map((p) => (seats.includes(p.seat) ? { ...p, alive: false } : p)) };
}

const passedOf = (state: RoomState, yes: number, no: number): boolean => {
  const line = resolveVerdict(withVotes(state, yes, no)).state.voteLog?.at(-1);
  return line?.exec.passed === true;
};

describe("낮 단계 순서 — 토론 → 찬반 → 지목 → 유언 → 처형 → 밤 (D-10)", () => {
  it("단계 표의 기본 다음 단계 사슬", () => {
    const chain = ["discussion", "verdict", "nomination", "defense", "execution", "night"] as const;
    const links = chain.slice(0, -1).map((id, i) => `${id}>${PHASE_DEFS[id].next}`);
    expect(links.join(" ")).toBe("discussion>verdict verdict>nomination nomination>defense defense>execution execution>night");
  });

  it("찬반 단계는 10초이고 역할 노출은 true 다", () => {
    const d = PHASE_DEFS.verdict;
    expect(`${d.durationMs}/${d.revealsOwnRole}`).toBe("10000/true");
  });

  it("토론 마감은 곧바로 찬반이다(지목이 먼저 오지 않는다)", () => {
    const discussion = startedAt(4, 1, "discussion");
    expect(tick(discussion, discussion.phaseEndsAt!, seededRandInt(2)).phase).toBe("verdict");
  });
});

describe("castVerdict — 검사 순서가 계약이다 (T-08-04)", () => {
  it("유권자의 찬성은 그 사람의 verdictVote 만 바꾼 새 상태가 되고 같은 값은 입력 객체 그대로다", () => {
    const base = verdictOf();
    const r = castVerdict(base, idOf(base, 1), true);
    if (!r.ok) throw new Error("rejected");
    const changed = r.state.players.filter((p, i) => p !== base.players[i]).map((p) => `${p.seat}:${String(p.verdictVote)}`);
    expect(changed.join(",")).toBe("1:true");
    const again = castVerdict(r.state, idOf(base, 1), true);
    expect(again.ok && again.state === r.state).toBe(true);
  });

  it("반대로 바꾸면 마지막 값이 유효하다", () => {
    const base = verdictOf();
    const first = castVerdict(base, idOf(base, 1), true);
    if (!first.ok) throw new Error("rejected");
    const flipped = castVerdict(first.state, idOf(base, 1), false);
    if (!flipped.ok) throw new Error("rejected");
    expect(flipped.state.players.find((p) => p.seat === 1)!.verdictVote).toBe(false);
  });

  it("죽은 사람(유령)과 방에 없는 사람은 BAD_MESSAGE 다. 산 사람은 누구나 던진다(후보가 없다)", () => {
    const base = withDead(verdictOf(), [5]);
    expect([3, 5].map((s) => err(castVerdict(base, idOf(base, s), true))).join(" ") + " " + err(castVerdict(base, "nobody", true))).toBe("ok BAD_MESSAGE BAD_MESSAGE");
  });

  it("verdict 가 아닌 단계는 행위자 검사보다 먼저 WRONG_PHASE 다", () => {
    const defense = { ...verdictOf(), phase: "defense" as const };
    expect(`${err(castVerdict(defense, idOf(defense, 1), true))} ${err(castVerdict(defense, "nobody", true))}`).toBe("WRONG_PHASE WRONG_PHASE");
  });

  it("agree 가 불리언이 아니면 BAD_MESSAGE 다", () => {
    const base = verdictOf();
    const results = ["true", 1, null, undefined].map((v) => err(castVerdict(base, idOf(base, 1), v as unknown as boolean)));
    expect(results.join(" ")).toBe("BAD_MESSAGE BAD_MESSAGE BAD_MESSAGE BAD_MESSAGE");
  });
});

describe("유권자·집계 (D-11)", () => {
  it("산 사람 8명이면 유권자는 8명 전원이다(후보 제외 없음)", () => {
    expect(verdictVotersOf(verdictOf()).length).toBe(8);
  });

  it("유령은 유권자가 아니다", () => {
    expect(verdictVotersOf(withDead(verdictOf(), [5, 6])).length).toBe(6);
  });

  it("verdictTallyOf 는 {yes, no} 만 돌려준다(던진 표만 센다)", () => {
    expect(JSON.stringify(verdictTallyOf(withVotes(verdictOf(), 4, 2)))).toBe('{"yes":4,"no":2}');
  });

  it("유령이 던졌던 값은 세지 않는다", () => {
    const base = withDead(withVotes(verdictOf(), 5, 0), [4]);
    expect(JSON.stringify(verdictTallyOf(base))).toBe('{"yes":4,"no":0}');
  });
});

describe("resolveVerdict — 던진 표의 과반이 찬성이면 통과, 아니면(0표·동수 포함) 부결 (D-11)", () => {
  it("경계값: (찬성,반대) = (1,0) 통과 · (1,1) 부결 · (0,0) 부결 · (4,3) 통과 · (3,4) 부결", () => {
    const base = verdictOf(8);
    const cells = [
      [1, 0],
      [1, 1],
      [0, 0],
      [4, 3],
      [3, 4],
    ] as const;
    expect(cells.map(([y, n]) => passedOf(base, y, n)).join(" ")).toBe("true false false true false");
  });

  it("8명 중 3명만 던져도 분모는 던진 표다: (2,1) 통과", () => {
    expect(passedOf(verdictOf(8), 2, 1)).toBe(true);
  });

  it("통과면 verdict {passed:true, ballots} 이고 다음 단계는 표의 기본(nomination)이다", () => {
    const r = resolveVerdict(withVotes(verdictOf(), 3, 1));
    expect(`${JSON.stringify(r.state.verdict)} ${r.stay} ${String(r.next)}`).toBe(`${JSON.stringify({ passed: true, ballots: { yes: [0, 1, 2], no: [3] } })} false undefined`);
  });

  it("부결이면 다음 단계는 night(afterDayOf)이고 그날 voteLog 줄에 reason rejected 가 남는다", () => {
    const r = resolveVerdict(withVotes(verdictOf(), 1, 2));
    const line = r.state.voteLog!.at(-1)!;
    expect(`${String(r.next)} ${JSON.stringify(line.exec)} ${String(line.reason)}`).toBe(`night ${JSON.stringify({ yes: 1, no: 2, passed: false })} rejected`);
  });

  it("0표도 부결(rejected)이다", () => {
    const r = resolveVerdict(verdictOf());
    expect(`${String(r.next)} ${String(r.state.voteLog!.at(-1)!.reason)}`).toBe("night rejected");
  });

  it("찬반 마감이 그날 voteLog 줄을 만든다(지목 마감이 아니라) — {n, exec}, 통과면 reason 없음", () => {
    const base = withVotes(verdictOf(), 4, 1);
    const before = base.voteLog?.length ?? 0;
    const line = resolveVerdict(base).state.voteLog!.at(-1)!;
    expect(`${line.n === (base.day ?? 1)} ${JSON.stringify(line.exec)} ${Object.hasOwn(line, "reason")} ${Object.hasOwn(line, "cand")} ${resolveVerdict(base).state.voteLog!.length - before}`).toBe(
      `true ${JSON.stringify({ yes: 4, no: 1, passed: true })} false false 1`,
    );
  });

  it("부결로 온 밤의 noExecutionOf 는 rejected 다", () => {
    const rejected = resolveVerdict(withVotes(verdictOf(), 0, 3));
    const night = tick({ ...rejected.state, phaseEndsAt: 0 }, 0, seededRandInt(3));
    expect(`${night.phase} ${JSON.stringify(noExecutionOf(night))}`).toBe('night {"reason":"rejected"}');
  });

  it("집계 직후 모든 플레이어에서 verdictVote 키가 없다 (익명, T-08-15)", () => {
    const r = resolveVerdict(withVotes(verdictOf(), 4, 3));
    expect(r.state.players.some((p) => "verdictVote" in p)).toBe(false);
  });

  it("마감(phaseEndsAt)은 읽거나 바꾸지 않고 입력 상태도 바꾸지 않는다", () => {
    const base = withVotes(verdictOf(), 4, 3);
    const before = JSON.stringify(base);
    const r = resolveVerdict(base);
    castVerdict(base, idOf(base, 1), false);
    verdictTallyOf(base);
    expect(`${JSON.stringify(base) === before} ${r.state.phaseEndsAt === base.phaseEndsAt}`).toBe("true true");
  });
});

describe("tick 으로 닿는 흐름 (D-10·D-11)", () => {
  it("통과로 마감하면 지목(nomination)으로 가고 순차 지목 차례 정보가 생긴다", () => {
    const voted = withVotes(verdictOf(5), 3, 0);
    const next = tick(voted, voted.phaseEndsAt!, seededRandInt(4));
    expect(`${next.phase} ${next.pickTurn?.order.length ?? "none"}`).toBe("nomination 5");
  });

  it("부결로 마감하면 night 이다", () => {
    const voted = withVotes(verdictOf(5), 1, 2);
    expect(tick(voted, voted.phaseEndsAt!, seededRandInt(4)).phase).toBe("night");
  });

  it("던져도 마감(phaseEndsAt)은 그대로이고, 마감 전 tick 은 입력 그대로다 (조기 종료 없음)", () => {
    let state = verdictOf(5);
    const ends = state.phaseEndsAt;
    for (const p of verdictVotersOf(state)) {
      const r = castVerdict(state, p.id, true);
      if (!r.ok) throw new Error("rejected");
      state = r.state;
    }
    expect(`${state.phaseEndsAt === ends} ${tick(state, ends! - 1) === state}`).toBe("true true");
  });

  it("던진 뒤 연결이 끊긴 유권자의 표도 센다 (옛 CONN-02)", () => {
    const voted = withVotes(verdictOf(5), 3, 0);
    const dropped: RoomState = {
      ...voted,
      players: voted.players.map((p) => (p.seat === 0 ? { ...p, connected: false, connId: null } : p)),
    };
    expect(passedOf(dropped, 3, 0)).toBe(true);
  });

  it("입력을 깊게 얼려도 castVerdict·verdictTallyOf·resolveVerdict 가 예외 없이 돈다", () => {
    const freeze = <T>(v: T): T => {
      if (v !== null && typeof v === "object" && !Object.isFrozen(v)) {
        Object.freeze(v);
        for (const c of Object.values(v as Record<string, unknown>)) freeze(c);
      }
      return v;
    };
    const base = freeze(withVotes(verdictOf(), 4, 1));
    expect(() => {
      castVerdict(base, idOf(base, 5), true);
      verdictTallyOf(base);
      resolveVerdict(base);
    }).not.toThrow();
  });
});

describe("resolveVerdict — 찬반 기록 ballots (결정 0066-3, 22-12 가 지운다)", () => {
  const setVotes = (state: RoomState, votes: Record<number, boolean>): RoomState => ({
    ...state,
    players: state.players.map((p) => (Object.hasOwn(votes, p.seat) ? { ...p, verdictVote: votes[p.seat]! } : p)),
  });

  it("찬성·반대 좌석을 오름차순으로 남기고 미투표 좌석은 어느 목록에도 없다; 개인 verdictVote 키는 모두 지운다", () => {
    const r = resolveVerdict(setVotes(verdictOf(), { 3: true, 0: true, 2: false }));
    expect(JSON.stringify(r.state.verdict?.ballots)).toBe(JSON.stringify({ yes: [0, 3], no: [2] }));
    expect(r.state.players.some((p) => Object.hasOwn(p, "verdictVote"))).toBe(false);
  });

  it("아무도 안 던졌으면 두 목록이 모두 비어 있고, 입력 상태는 바뀌지 않는다", () => {
    const base = verdictOf();
    const before = JSON.stringify(base);
    const r = resolveVerdict(base);
    expect(JSON.stringify(r.state.verdict?.ballots)).toBe('{"yes":[],"no":[]}');
    expect(JSON.stringify(base)).toBe(before);
  });

  it("탈락한 사람의 남은 값은 세지 않는다", () => {
    const dead = withDead(setVotes(verdictOf(), { 0: true, 1: false }), [1]);
    expect(JSON.stringify(resolveVerdict(dead).state.verdict?.ballots)).toBe(JSON.stringify({ yes: [0], no: [] }));
  });
});
