// 찬반 규칙 시험 — DAY-06, 결정 0053·0060-4.
// 기존 test/unit/verdict.test.ts 는 화면 쪽 src/game/verdict.ts 시험이라 이름을 피했다.
// 유권자 = 변론자를 뺀 산 사람(E), 찬성 × 2 > E 면 통과. 못 던진 사람은 기권이고 분모에는 있다. 개인 값은 집계 직후 사라진다.
// 지목 마감(resolveNomination)을 실제로 지나 변론자·그날 voteLog 줄을 만든 상태에서 시작한다.
// 실패 출력은 한 줄이어야 해서(TAP) 비교는 가능한 한 문자열 하나로 한다.
import { describe, expect, it } from "vitest";
import { resolveNomination } from "../../shared/game/nomination";
import { PHASE_DEFS } from "../../shared/game/phases";
import type { RoomState } from "../../shared/game/room";
import { tick } from "../../shared/game/tick";
import { castVerdict, resolveVerdict, verdictTallyOf, verdictVotersOf, votedSeatsOf } from "../../shared/game/verdict";
import { startedAt } from "../helpers/voteState";

const DEFENDER = 3;

/** n 명 방에서 모두가 변론자(좌석 3)를 가리켜 지목 마감을 지난 뒤 phase 만 verdict 로 둔 상태. */
function verdictOf(n = 8): RoomState {
  const base: RoomState = { ...startedAt(n, 1, "discussion"), phase: "nomination" };
  const pointed: RoomState = {
    ...base,
    players: base.players.map((p) => (p.seat === DEFENDER ? p : { ...p, nominate: DEFENDER })),
  };
  return { ...resolveNomination(pointed).state, phase: "verdict" };
}

const idOf = (state: RoomState, seat: number): string => state.players.find((p) => p.seat === seat)!.id;
const err = (r: { ok: boolean; error?: string }): string => (r.ok ? "ok" : (r.error ?? "?"));

/** 유권자 좌석 순서(변론자 제외, 오름차순)로 앞 yes 명은 찬성, 그다음 no 명은 반대로 verdictVote 를 직접 채운다. */
function withVotes(state: RoomState, yes: number, no: number): RoomState {
  const seats = state.players.map((p) => p.seat).filter((s) => s !== DEFENDER).sort((a, b) => a - b);
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

describe("castVerdict — 검사 순서가 계약이다 (DAY-06, T-08-04)", () => {
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

  it("변론자 본인과 죽은 사람(유령)과 방에 없는 사람은 BAD_MESSAGE 다", () => {
    const base = withDead(verdictOf(), [5]);
    expect([DEFENDER, 5].map((s) => err(castVerdict(base, idOf(base, s), true))).join(" ") + " " + err(castVerdict(base, "nobody", true))).toBe(
      "BAD_MESSAGE BAD_MESSAGE BAD_MESSAGE",
    );
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

describe("유권자·던진 좌석 (DAY-06)", () => {
  it("산 사람 8명이면 유권자는 변론자를 뺀 7명이다", () => {
    expect(verdictVotersOf(verdictOf()).length).toBe(7);
  });

  it("유령은 유권자가 아니다", () => {
    expect(verdictVotersOf(withDead(verdictOf(), [5, 6])).length).toBe(5);
  });

  it("votedSeatsOf 는 던진 유권자 좌석 오름차순이고 변론자·유령의 남은 값은 세지 않는다", () => {
    const base = withDead(withVotes(verdictOf(), 3, 1), [2]); // 유권자 0,1,2,4 중 0,1,2 찬성 4 반대
    const withStale = { ...base, players: base.players.map((p) => (p.seat === DEFENDER ? { ...p, verdictVote: true } : p)) };
    expect(votedSeatsOf(withStale).join(",")).toBe("0,1,4");
  });

  it("verdictTallyOf 는 유권자 중 찬성·반대·유권자 수를 센다", () => {
    const t = verdictTallyOf(withVotes(verdictOf(), 4, 2));
    expect(`${t.yes}/${t.no}/${t.voters}`).toBe("4/2/7");
  });
});

describe("resolveVerdict — 분모는 던진 표가 아니라 유권자 수다 (DAY-06, 결정 0053-3)", () => {
  it("유권자 7: 찬성 4 반대 0 은 통과, 찬성 3 반대 0 은 부결이다", () => {
    const base = verdictOf();
    expect(`${passedOf(base, 4, 0)} ${passedOf(base, 3, 0)}`).toBe("true false");
  });

  it("유권자 7: 찬성 4 반대 3 은 통과다", () => {
    expect(passedOf(verdictOf(), 4, 3)).toBe(true);
  });

  it("유권자 4(산 사람 5): 찬성 2 반대 2 는 부결이고 찬성 3 은 통과다", () => {
    const base = verdictOf(5);
    expect(`${passedOf(base, 2, 2)} ${passedOf(base, 3, 0)}`).toBe("false true");
  });

  it("아무도 안 던지면 부결이다", () => {
    expect(passedOf(verdictOf(), 0, 0)).toBe(false);
  });

  it("유령이 된 만큼 분모도 줄어든다 (유권자 7 → 6: 찬성 4 통과, 찬성 3 부결)", () => {
    const ghost = withDead(verdictOf(), [5]);
    expect(`${passedOf(ghost, 4, 0)} ${passedOf(ghost, 3, 0)}`).toBe("true false");
  });

  it("유령이 던졌던 값은 세지 않는다", () => {
    const base = withDead(withVotes(verdictOf(), 5, 0), [5]); // 찬성 0,1,2,4,5 중 5 가 죽음
    const t = verdictTallyOf(base);
    expect(`${t.yes}/${t.no}/${t.voters}`).toBe("4/0/6");
  });

  it("집계 뒤 그날 voteLog 줄의 exec 만 채워지고 지목 쪽 cand 는 그대로다", () => {
    const base = withVotes(verdictOf(), 4, 1);
    const before = base.voteLog!.at(-1)!;
    const r = resolveVerdict(base);
    const line = r.state.voteLog!.at(-1)!;
    expect(JSON.stringify(line.exec)).toBe(JSON.stringify({ yes: 4, no: 1, passed: true }));
    expect(`${line.n === before.n} ${line.cand === before.cand} ${r.state.voteLog!.length === base.voteLog!.length}`).toBe("true true true");
  });

  it("verdict 상태는 후보를 유지하고 passed 를 정한다. 다음 단계는 기본(execution)이다", () => {
    const r = resolveVerdict(withVotes(verdictOf(), 4, 0));
    expect(`${JSON.stringify(r.state.verdict)} ${r.stay} ${String(r.next)}`).toBe(`${JSON.stringify({ passed: true, candidate: DEFENDER })} false undefined`);
  });

  it("집계 직후 모든 플레이어에서 verdictVote 키가 없다 (익명, T-08-15)", () => {
    const r = resolveVerdict(withVotes(verdictOf(), 4, 3));
    expect(r.state.players.some((p) => "verdictVote" in p)).toBe(false);
  });

  it("그날 줄이 없으면 voteLog 는 그대로 둔다", () => {
    const base = withVotes(verdictOf(), 4, 0);
    const noLog: RoomState = { ...base, voteLog: [] };
    expect(resolveVerdict(noLog).state.voteLog?.length).toBe(0);
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

describe("vote.test 에서 옮긴 뜻 (08-28, DAY-06·07)", () => {
  it("단계 표: 찬반은 10000ms 이고 기본 다음 단계는 execution, 역할 노출은 true 다 (옛 단계 표 시험의 새 흐름 행)", () => {
    const d = PHASE_DEFS.verdict;
    expect(`${d.durationMs}/${d.next}/${d.revealsOwnRole}`).toBe("10000/execution/true");
  });

  it("던져도 마감(phaseEndsAt)은 그대로이고, 마감 전 tick 은 입력 그대로다 (옛 D-28)", () => {
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
    const voted = withVotes(verdictOf(5), 3, 0); // 유권자 4 중 3 찬성
    const dropped: RoomState = {
      ...voted,
      players: voted.players.map((p) => (p.seat === 0 ? { ...p, connected: false, connId: null } : p)),
    };
    expect(passedOf(dropped, 3, 0)).toBe(true);
    expect(votedSeatsOf(dropped).join(",")).toBe("0,1,2");
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
