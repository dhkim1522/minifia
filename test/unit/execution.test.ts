// 공개 구간 → 변론 → 처형 진입 훅과 view 필드 (04-04 Task 2) — VOTE-02·VOTE-03·VOTE-04, 결정 0034·0036, D-06·D-07·D-09·D-11·D-21·D-25·D-34.
// 상태는 모두 실제 투표 주입과 tick 으로 만든다(test/helpers/voteState.ts, Pitfall 12). 실패 출력은 한 줄이어야 해서(TAP) 비교는 가능한 한 문자열 하나로 한다.
import { describe, expect, it } from "vitest";
import { isAlive } from "../../shared/game/alive";
import {
  enterCandidateVoteReveal,
  enterExecution,
  noExecutionOf,
  routeAfterCandidateVote,
} from "../../shared/game/execution";
import { CANDIDATE_REVEAL_MS, DEFENSE_MS, EXECUTION_MS, NIGHT_MS } from "../../shared/game/phases";
import type { RoomState } from "../../shared/game/room";
import { tick } from "../../shared/game/tick";
import { tallyCandidateVote } from "../../shared/game/vote";
import { buildView } from "../../shared/game/view";
import { EXECUTION_PHRASE_COUNT } from "../../shared/protocol";
import type { PhaseId, RoomView } from "../../shared/protocol";
import { seededRandInt } from "../helpers/seededRandom";
import { castCandidateVotes, castExecVotes, startedAt, stateWithVerdict } from "../helpers/voteState";

const NOW = 20_000;
const SEEDS = [1, 2, 3] as const;
const ROLE_WORDS = new Set(["mafia", "police", "doctor", "citizen", "none"]);

const idOf = (state: RoomState, seat: number): string => state.players.find((p) => p.seat === seat)!.id;
const viewOf = (state: RoomState, seat: number): RoomView => buildView(state, idOf(state, seat), NOW);
const aliveSeats = (state: RoomState): number[] =>
  state.players.filter(isAlive).map((p) => p.seat).sort((a, b) => a - b);
const lastLog = (state: RoomState) => state.voteLog?.at(-1);

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value as Record<string, unknown>)) deepFreeze(child);
  }
  return value;
}

function spyRand(returns: (n: number) => number = () => 0): { randInt: (n: number) => number; calls: number[] } {
  const calls: number[] = [];
  return {
    calls,
    randInt: (n: number): number => {
      calls.push(n);
      return returns(n);
    },
  };
}

const THROWING_RAND = (): number => {
  throw new Error("randInt must not be called");
};

/** JSON 을 걸어 내려가며 (경로, 문자열 값) 을 모은다. 배열 칸은 [] 로 접는다(leak.test.ts 와 같은 방식). */
function stringPaths(value: unknown, path = ""): Array<[string, string]> {
  if (Array.isArray(value)) return value.flatMap((v) => stringPaths(v, `${path}[]`));
  if (value !== null && typeof value === "object") {
    return Object.entries(value as Record<string, unknown>).flatMap(([k, v]) => stringPaths(v, `${path}.${k}`));
  }
  return typeof value === "string" ? [[path, value]] : [];
}

/** tick 으로 목표 단계가 될 때까지 마감마다 넘긴다. */
function tickTo(state: RoomState, phase: PhaseId, seed: number): RoomState {
  let current = state;
  for (let guard = 0; current.phase !== phase; guard += 1) {
    if (current.phaseEndsAt === null || guard > 60) throw new Error(`cannot reach ${phase} from ${state.phase}`);
    current = tick(current, current.phaseEndsAt, seededRandInt(seed));
  }
  return current;
}

describe("enterCandidateVoteReveal (VOTE-02, D-20, D-21)", () => {
  it("그날 voteLog 줄에 cand {votes, candidate} 가 붙고 exec 는 그대로, verdict.candidate 가 tally 결과와 같다", () => {
    for (const seed of SEEDS) {
      const before = stateWithVerdict(6, seed, "candidateVote", { candidate: "citizen" });
      const expected = tallyCandidateVote(before, seededRandInt(seed));
      const after = enterCandidateVoteReveal(before, seededRandInt(seed));
      const line = lastLog(after)!;
      expect(JSON.stringify(line.cand)).toBe(JSON.stringify({ votes: expected.votes, candidate: expected.candidate }));
      expect(JSON.stringify(line.exec)).toBe(JSON.stringify(lastLog(before)!.exec));
      expect(JSON.stringify(after.verdict)).toBe(JSON.stringify({ passed: true, candidate: expected.candidate }));
      expect(after.voteLog!.length).toBe(before.voteLog!.length);
    }
  });

  it("동률이면 cand {votes} 뿐(candidate 키 없음)이고 verdict 에도 candidate 가 없다; 0표면 votes []", () => {
    const tie = enterCandidateVoteReveal(stateWithVerdict(6, 1, "candidateVote", { candidate: "tie" }), seededRandInt(1));
    expect(Object.keys(lastLog(tie)!.cand!).join(",")).toBe("votes");
    expect(lastLog(tie)!.cand!.votes.length).toBe(2);
    expect(JSON.stringify(tie.verdict)).toBe(JSON.stringify({ passed: true }));

    const none = enterCandidateVoteReveal(stateWithVerdict(6, 1, "candidateVote", { candidate: "none" }), THROWING_RAND);
    expect(`${lastLog(none)!.cand!.votes.length}/${Object.keys(lastLog(none)!.cand!).join(",")}`).toBe("0/votes");
    expect(JSON.stringify(none.verdict)).toBe(JSON.stringify({ passed: true }));
  });

  it("어떤 플레이어에도 candidateVote 키가 없다 (공개 기록으로 남았으니 서버 전용 필드는 지운다)", () => {
    const before = stateWithVerdict(6, 2, "candidateVote");
    expect(before.players.some((p) => p.candidateVote !== undefined)).toBe(true);
    const after = enterCandidateVoteReveal(before, seededRandInt(2));
    expect(after.players.some((p) => "candidateVote" in p)).toBe(false);
  });

  it("난수는 셔플에서만 쓴다: 던진 표 n 명이면 인자가 [n, n-1, …, 2] 뿐이다", () => {
    const before = stateWithVerdict(6, 3, "candidateVote");
    const n = before.players.filter((p) => p.candidateVote !== undefined).length;
    const spy = spyRand();
    enterCandidateVoteReveal(before, spy.randInt);
    expect(spy.calls.join(",")).toBe(Array.from({ length: n - 1 }, (_, i) => n - i).join(","));
  });

  it("입력 상태를 바꾸지 않는다 (깊은 동결)", () => {
    const before = deepFreeze(stateWithVerdict(6, 1, "candidateVote"));
    expect(() => enterCandidateVoteReveal(before, seededRandInt(1))).not.toThrow();
  });

  it("그날 줄이 없으면(도달할 수 없는 경로) voteLog 는 그대로 두고 verdict 만 갱신한다", () => {
    const before = stateWithVerdict(6, 1, "candidateVote");
    const { voteLog: _drop, ...noLog } = before;
    const after = enterCandidateVoteReveal(noLog as RoomState, seededRandInt(1));
    expect("voteLog" in after).toBe(false);
    expect(after.verdict?.candidate).toBeDefined();
  });
});

describe("routeAfterCandidateVote (D-25)", () => {
  it("후보가 있으면 next 가 없고(표의 기본 defense), 없으면 next 'night' 이다; stay 는 항상 false", () => {
    const withCandidate = enterCandidateVoteReveal(stateWithVerdict(6, 1, "candidateVote"), seededRandInt(1));
    const tied = enterCandidateVoteReveal(stateWithVerdict(6, 1, "candidateVote", { candidate: "tie" }), seededRandInt(1));
    const zero = enterCandidateVoteReveal(stateWithVerdict(6, 1, "candidateVote", { candidate: "none" }), seededRandInt(1));
    const row = (s: RoomState) => {
      const r = routeAfterCandidateVote(s);
      return `${r.next ?? "default"}/${r.stay}/${r.state === s}`;
    };
    expect(`${row(withCandidate)} ${row(tied)} ${row(zero)}`).toBe("default/false/true night/false/true night/false/true");
  });
});

describe("enterExecution (VOTE-04, D-06, D-09, D-11)", () => {
  const defenseOf = (seed: number): RoomState => stateWithVerdict(6, seed, "defense");

  it("후보만 alive false 가 되고 다른 필드(역할 포함)는 그대로다; execution {seat, phrase}, lastExecPhrase = phrase", () => {
    for (const seed of SEEDS) {
      const before = defenseOf(seed);
      const x = before.verdict!.candidate!;
      const after = enterExecution(before, seededRandInt(seed));
      const xBefore = before.players.find((p) => p.seat === x)!;
      const xAfter = after.players.find((p) => p.seat === x)!;
      expect(xAfter.alive).toBe(false);
      expect(JSON.stringify({ ...xAfter, alive: undefined })).toBe(JSON.stringify({ ...xBefore, alive: undefined }));
      const others = (s: RoomState) => JSON.stringify(s.players.filter((p) => p.seat !== x));
      expect(others(after)).toBe(others(before));
      expect(Object.keys(after.execution!).sort().join(",")).toBe("phrase,seat");
      expect(after.execution!.seat).toBe(x);
      expect(after.lastExecPhrase).toBe(after.execution!.phrase);
      expect(after.execution!.phrase >= 1 && after.execution!.phrase <= EXECUTION_PHRASE_COUNT).toBe(true);
    }
  });

  it("문구는 직전 처형 문구를 뺀 오름차순 후보 중 randInt(후보 수) 한 번이다 (0 → 가장 작은 번호, 마지막 → 가장 큰 번호)", () => {
    const base = defenseOf(1);
    const phraseWith = (last: number | undefined, pick: (n: number) => number) => {
      const spy = spyRand(pick);
      const s = enterExecution(last === undefined ? base : { ...base, lastExecPhrase: last }, spy.randInt);
      return `${s.execution!.phrase}/${spy.calls.join(",")}`;
    };
    // 직전 문구 없음: 후보 [1,2,3,4]
    expect(phraseWith(undefined, () => 0)).toBe("1/4");
    expect(phraseWith(undefined, (n) => n - 1)).toBe("4/4");
    // 직전 문구 2: 후보 [1,3,4]
    expect(phraseWith(2, () => 0)).toBe("1/3");
    expect(phraseWith(2, (n) => n - 1)).toBe("4/3");
    expect(phraseWith(2, () => 1)).toBe("3/3");
    // 직전 문구 1: 후보 [2,3,4]
    expect(phraseWith(1, () => 0)).toBe("2/3");
    // 직전 문구 4: 후보 [1,2,3]
    expect(phraseWith(4, (n) => n - 1)).toBe("3/3");
  });

  it("같은 시드로 연속 처형해도 직전 문구는 다시 나오지 않는다 (4~8명 × 시드 3)", () => {
    for (let n = 4; n <= 8; n += 1) {
      for (const seed of SEEDS) {
        const first = enterExecution(stateWithVerdict(n, seed, "defense"), seededRandInt(seed));
        const second = enterExecution(
          { ...stateWithVerdict(n, seed, "defense"), lastExecPhrase: first.lastExecPhrase },
          seededRandInt(seed),
        );
        expect(`${n}/${seed}: ${second.execution!.phrase === first.execution!.phrase}`).toBe(`${n}/${seed}: false`);
      }
    }
  });

  it("후보가 없으면 입력 그대로이고 난수를 부르지 않는다", () => {
    const tied = tickTo(stateWithVerdict(6, 1, "candidateVote", { candidate: "tie" }), "candidateVoteReveal", 1);
    expect(enterExecution(tied, THROWING_RAND)).toBe(tied);
  });

  it("입력 상태를 바꾸지 않는다 (깊은 동결) · 직업 값은 execution 어디에도 없다", () => {
    const before = deepFreeze(defenseOf(2));
    const after = enterExecution(before, seededRandInt(2));
    expect(ROLE_WORDS.has(String(Object.values(after.execution!).join("|")))).toBe(false);
    expect(Object.values(after.execution!).every((v) => typeof v === "number")).toBe(true);
  });
});

describe("tick 연쇄: 후보 선택 → 공개 → 변론 → 처형 → 밤 (D-25, D-28)", () => {
  it("6명 × 시드 3: 마감마다 정확한 단계·마감·내용으로 흐른다", () => {
    for (const seed of SEEDS) {
      const s0 = stateWithVerdict(6, seed, "candidateVote", { candidate: "citizen" });
      const x = s0.players.filter(isAlive).sort((a, b) => a.seat - b.seat).find((p) => p.role === "citizen")!.seat;
      const viewerSeat = aliveSeats(s0).find((seat) => seat !== x)!;
      const t0 = s0.phaseEndsAt!;
      const rand = seededRandInt(seed + 9);

      const reveal = tick(s0, t0, rand);
      expect(`${reveal.phase}/${reveal.phaseEndsAt! - t0}`).toBe(`candidateVoteReveal/${CANDIDATE_REVEAL_MS}`);
      expect(lastLog(reveal)!.cand!.candidate).toBe(x);

      const defense = tick(reveal, reveal.phaseEndsAt!, rand);
      expect(`${defense.phase}/${defense.phaseEndsAt! - reveal.phaseEndsAt!}`).toBe(`defense/${DEFENSE_MS}`);
      expect(viewOf(defense, viewerSeat).day?.candidate).toBe(x);
      expect(defense.players.find((p) => p.seat === x)!.alive).not.toBe(false);

      const execution = tick(defense, defense.phaseEndsAt!, rand);
      expect(`${execution.phase}/${execution.phaseEndsAt! - defense.phaseEndsAt!}`).toBe(`execution/${EXECUTION_MS}`);
      expect(execution.players.find((p) => p.seat === x)!.alive).toBe(false);
      expect(viewOf(execution, viewerSeat).day?.execution?.seat).toBe(x);

      const night = tick(execution, execution.phaseEndsAt!, rand);
      expect(`${night.phase}/${night.phaseEndsAt! - execution.phaseEndsAt!}`).toBe(`night/${NIGHT_MS}`);
    }
  });

  it("알람이 늦어 한 번에 따라잡아도 같은 결과다 (공개·변론·처형 훅이 모두 돈다)", () => {
    const s0 = stateWithVerdict(6, 2, "candidateVote");
    const stepwise = tickTo(s0, "night", 5);
    const caughtUp = tick(s0, s0.phaseEndsAt! + CANDIDATE_REVEAL_MS + DEFENSE_MS + EXECUTION_MS + 1, seededRandInt(5));
    expect(caughtUp.phase).toBe("night");
    expect(caughtUp.phaseEndsAt).toBe(stepwise.phaseEndsAt);
    expect(JSON.stringify(caughtUp.players)).toBe(JSON.stringify(stepwise.players));
    expect(caughtUp.players.filter((p) => p.alive === false).length).toBe(1);
  });

  it("동률 → 공개(votes 둘 이상, candidate 없음) → 4초 뒤 바로 밤", () => {
    const s0 = stateWithVerdict(6, 1, "candidateVote", { candidate: "tie" });
    const t0 = s0.phaseEndsAt!;
    const reveal = tick(s0, t0, seededRandInt(1));
    expect(reveal.phase).toBe("candidateVoteReveal");
    expect(reveal.phaseEndsAt).toBe(t0 + CANDIDATE_REVEAL_MS);
    expect(lastLog(reveal)!.cand!.votes.length).toBeGreaterThanOrEqual(2);
    expect("candidate" in lastLog(reveal)!.cand!).toBe(false);
    expect(viewOf(reveal, 0).day?.candidate).toBeUndefined();
    const night = tick(reveal, reveal.phaseEndsAt!, seededRandInt(1));
    expect(`${night.phase}/${night.phaseEndsAt! - reveal.phaseEndsAt!}`).toBe(`night/${NIGHT_MS}`);
    expect(night.players.every(isAlive)).toBe(true);
  });

  it("0표 → 공개(votes []) → 4초 뒤 밤: 공개 구간은 두 경우 모두 4초를 거친다", () => {
    const s0 = stateWithVerdict(6, 1, "candidateVote", { candidate: "none" });
    const reveal = tick(s0, s0.phaseEndsAt!, seededRandInt(1));
    expect(reveal.phase).toBe("candidateVoteReveal");
    expect(reveal.phaseEndsAt).toBe(s0.phaseEndsAt! + CANDIDATE_REVEAL_MS);
    expect(`${lastLog(reveal)!.cand?.votes.length}/${Object.keys(lastLog(reveal)!.cand ?? {}).join(",")}`).toBe("0/votes");
    const night = tick(reveal, reveal.phaseEndsAt!, seededRandInt(1));
    expect(night.phase).toBe("night");
  });
});

describe("view: me.voteTarget (D-19, A7, T-04-10)", () => {
  const picked = (): RoomState => castCandidateVotes(stateWithVerdict(6, 4, "candidateVote", { candidate: "none" }), { 0: 3 });

  it("candidateVote 단계 본인이 골랐을 때만 me.voteTarget 이 있다; 남의 view 에는 어떤 키로도 없다", () => {
    const state = picked();
    const keys = state.players.map((p) => `${p.seat}:${"voteTarget" in viewOf(state, p.seat).me ? viewOf(state, p.seat).me.voteTarget : "-"}`);
    expect(keys.join(" ")).toBe("0:3 1:- 2:- 3:- 4:- 5:-");
  });

  it("다른 단계에는 값이 남아 있어도 싣지 않는다; 탈락한 본인에게도 없다", () => {
    const state = picked();
    for (const phase of ["discussion", "defense", "execution", "night"] as const) {
      expect(`${phase}:${"voteTarget" in viewOf({ ...state, phase }, 0).me}`).toBe(`${phase}:false`);
    }
    const dead = { ...state, players: state.players.map((p) => (p.seat === 0 ? { ...p, alive: false } : p)) };
    expect("voteTarget" in viewOf(dead, 0).me).toBe(false);
  });

  it("같은 상태에서 다른 사람들의 후보 선택만 다른 두 상태의 제3자 view (생존·관전 둘 다) 는 JSON 이 같다", () => {
    const base = stateWithVerdict(6, 4, "candidateVote", { candidate: "none" });
    const a = castCandidateVotes(base, { 1: 2, 2: 3, 4: 1 });
    const b = castCandidateVotes(base, { 1: 4, 2: 5, 3: 1, 4: 2 });
    expect(JSON.stringify(viewOf(a, 0))).toBe(JSON.stringify(viewOf(b, 0)));
    const dead = (s: RoomState): RoomState => ({ ...s, players: s.players.map((p) => (p.seat === 0 ? { ...p, alive: false } : p)) });
    expect(JSON.stringify(viewOf(dead(a), 0))).toBe(JSON.stringify(viewOf(dead(b), 0)));
  });

  it("어떤 view 에도 서버 전용 키 이름 candidateVote·verdict·lastExecPhrase 가 없다 (후보 선택 중 · 공개 · 변론 · 처형)", () => {
    for (const phase of ["candidateVote", "candidateVoteReveal", "defense", "execution"] as const) {
      const state = stateWithVerdict(6, 2, phase);
      const text = JSON.stringify(state.players.map((p) => viewOf(state, p.seat)));
      for (const key of ["candidateVote", "verdict", "lastExecPhrase", "execVote"]) {
        expect(`${phase}/${key}: ${text.includes(`"${key}":`)}`).toBe(`${phase}/${key}: false`);
      }
    }
  });
});

describe("view: day.candidate · day.execution (D-06, D-09, D-11)", () => {
  it("day.candidate 는 공개 구간·변론·처형에서 후보가 있을 때만, 모든 viewer 에게 같다", () => {
    const rows: string[] = [];
    for (const phase of ["candidateVote", "candidateVoteReveal", "defense", "execution"] as const) {
      const state = stateWithVerdict(6, 1, phase);
      const values = new Set(state.players.map((p) => String(viewOf(state, p.seat).day?.candidate)));
      rows.push(`${phase}=${[...values].join("|")}`);
    }
    const x = stateWithVerdict(6, 1, "defense").verdict!.candidate;
    expect(typeof x).toBe("number");
    expect(rows.join(" ")).toBe(`candidateVote=undefined candidateVoteReveal=${x} defense=${x} execution=${x}`);
  });

  it("후보가 없으면(동률) 공개 구간 view 에 day.candidate 키가 없다", () => {
    const state = stateWithVerdict(6, 1, "candidateVoteReveal", { candidate: "tie" });
    expect(state.players.every((p) => !("candidate" in (viewOf(state, p.seat).day ?? {})))).toBe(true);
  });

  it("day.execution 은 execution 단계에만, 키가 정확히 seat·phrase 다", () => {
    const rows: string[] = [];
    for (const phase of ["candidateVote", "candidateVoteReveal", "defense", "execution"] as const) {
      const state = stateWithVerdict(6, 1, phase);
      rows.push(`${phase}:${Object.keys(viewOf(state, 1).day?.execution ?? {}).sort().join(",") || "-"}`);
    }
    expect(rows.join(" ")).toBe("candidateVote:- candidateVoteReveal:- defense:- execution:phrase,seat");
  });

  it("처형 직업 비공개 (D-09): execution 단계 살아 있는 viewer 의 view 에서 역할 단어는 .me.role·.day.roles[]·.day.claimLog[].claim 경로에만 있다", () => {
    const allowed = new Set([".me.role", ".day.roles[]", ".day.claimLog[].claim"]);
    for (const n of [4, 5, 6, 7, 8]) {
      for (const seed of SEEDS) {
        const state = stateWithVerdict(n, seed, "execution");
        expect(typeof state.execution?.seat).toBe("number");
        for (const seat of aliveSeats(state)) {
          const stray = stringPaths(viewOf(state, seat)).filter(([path, value]) => ROLE_WORDS.has(value) && !allowed.has(path));
          expect(`${n}/${seed}/${seat}: ${stray.map(([p]) => p).join(",")}`).toBe(`${n}/${seed}/${seat}: `);
        }
      }
    }
  });

  it("처형된 본인 view 에는 spectate.seats 가 있다 (결정 0021) — 살아 있는 viewer 에는 없다", () => {
    const state = stateWithVerdict(6, 3, "execution");
    const x = state.execution!.seat;
    expect(viewOf(state, x).spectate?.seats.length).toBe(6);
    const others = aliveSeats(state).map((seat) => "spectate" in viewOf(state, seat));
    expect(others.every((has) => !has)).toBe(true);
  });
});

describe("noExecutionOf · day.noExecution (D-34)", () => {
  const nightWith = (state: RoomState, seed: number): RoomState => tickTo(state, "night", seed);
  const reasonsOf = (state: RoomState): string => {
    const seen = new Set(state.players.map((p) => (JSON.stringify(viewOf(state, p.seat).day?.noExecution) ?? "-")));
    return [...seen].join("|");
  };

  it("여부 0표 → 밤 view 에 {reason:'noVotes'}", () => {
    for (const seed of SEEDS) {
      expect(reasonsOf(nightWith(startedAt(6, seed, "execVote"), seed))).toBe('{"reason":"noVotes"}');
    }
  });

  it("여부 1:1 · 1:2 (반대 다수·동률) → {reason:'notMajority'}", () => {
    const base = startedAt(6, 1, "execVote");
    const [a, b, c] = aliveSeats(base);
    expect(reasonsOf(nightWith(castExecVotes(base, { [a!]: true, [b!]: false }), 1))).toBe('{"reason":"notMajority"}');
    expect(reasonsOf(nightWith(castExecVotes(base, { [a!]: true, [b!]: false, [c!]: false }), 1))).toBe(
      '{"reason":"notMajority"}',
    );
  });

  it("후보 선택 0표 → 공개 뒤 밤 view 에 {reason:'noVotes'}, 후보 최다 동률 → {reason:'tie'}", () => {
    expect(reasonsOf(nightWith(stateWithVerdict(6, 1, "candidateVote", { candidate: "none" }), 1))).toBe('{"reason":"noVotes"}');
    expect(reasonsOf(nightWith(stateWithVerdict(6, 1, "candidateVote", { candidate: "tie" }), 1))).toBe('{"reason":"tie"}');
  });

  it("모든 viewer(생존·탈락)의 값이 같고 키는 정확히 reason 하나다", () => {
    const night = nightWith(stateWithVerdict(6, 2, "candidateVote", { candidate: "tie" }), 2);
    const dead: RoomState = { ...night, players: night.players.map((p) => (p.seat === 0 ? { ...p, alive: false } : p)) };
    for (const state of [night, dead]) {
      expect(reasonsOf(state)).toBe('{"reason":"tie"}');
      expect(JSON.stringify(Object.keys(viewOf(state, 1).day!.noExecution!))).toBe(JSON.stringify(["reason"]));
    }
  });

  it("처형이 이뤄진 날의 밤 view 에는 키가 없다", () => {
    for (const seed of SEEDS) {
      const night = nightWith(stateWithVerdict(6, seed, "execution"), seed);
      expect(night.players.filter((p) => p.alive === false).length).toBe(1);
      expect(night.players.every((p) => !("noExecution" in (viewOf(night, p.seat).day ?? {})))).toBe(true);
      expect(noExecutionOf(night)).toBeUndefined();
    }
  });

  it("같은 판이 아침으로 넘어가면 키가 없고, 다음 날 처형 무효 밤에는 그날 이유로 다시 실린다 (전날 이유가 남지 않음)", () => {
    const night1 = nightWith(startedAt(6, 1, "execVote"), 1);
    expect(reasonsOf(night1)).toBe('{"reason":"noVotes"}');
    const morning = tickTo(night1, "morning", 1);
    expect(morning.players.every((p) => !("noExecution" in (viewOf(morning, p.seat).day ?? {})))).toBe(true);
    const vote2 = tickTo(morning, "execVote", 1);
    expect(vote2.day).toBe(2);
    const [a, b] = aliveSeats(vote2);
    const night2 = nightWith(castExecVotes(vote2, { [a!]: true, [b!]: false }), 1);
    expect(night2.day).toBe(2);
    expect(reasonsOf(night2)).toBe('{"reason":"notMajority"}');
  });

  it("밤이 아닌 단계(execVote·candidateVote·candidateVoteReveal·defense·execution·ended)의 view 에는 키가 없다", () => {
    const rows: string[] = [];
    const tied = stateWithVerdict(6, 1, "candidateVoteReveal", { candidate: "tie" });
    const cases: Array<[string, RoomState]> = [
      ["execVote", startedAt(6, 1, "execVote")],
      ["candidateVote", stateWithVerdict(6, 1, "candidateVote", { candidate: "none" })],
      ["candidateVoteReveal", tied],
      ["defense", stateWithVerdict(6, 1, "defense")],
      ["execution", stateWithVerdict(6, 1, "execution")],
      ["ended", { ...nightWith(tied, 1), phase: "ended", phaseEndsAt: null }],
    ];
    for (const [name, state] of cases) {
      rows.push(`${name}:${state.players.some((p) => "noExecution" in (viewOf(state, p.seat).day ?? {}))}`);
    }
    expect(rows.join(" ")).toBe(
      "execVote:false candidateVote:false candidateVoteReveal:false defense:false execution:false ended:false",
    );
  });

  it("voteLog 가 없는 옛 상태의 밤에는 키가 없다; 밤이 아니면 noExecutionOf 는 undefined", () => {
    const night = nightWith(startedAt(6, 1, "execVote"), 1);
    const { voteLog: _drop, ...old } = night;
    expect(noExecutionOf(old as RoomState)).toBeUndefined();
    expect(old.players.every((p) => !("noExecution" in (viewOf(old as RoomState, p.seat).day ?? {})))).toBe(true);
    expect(noExecutionOf({ ...night, phase: "morning" })).toBeUndefined();
  });

  it("입력 상태를 바꾸지 않는다 (깊은 동결)", () => {
    const night = deepFreeze(nightWith(stateWithVerdict(6, 1, "candidateVote", { candidate: "tie" }), 1));
    expect(() => noExecutionOf(night)).not.toThrow();
  });
});
