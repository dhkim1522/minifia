// 변론 → 처형 진입 훅과 view 필드 (04-04 Task 2) — VOTE-02·VOTE-03·VOTE-04, 결정 0034·0036, D-06·D-07·D-09·D-11·D-21·D-25·D-34.
// 상태는 모두 실제 투표 주입과 tick 으로 만든다(test/helpers/voteState.ts, Pitfall 12). 실패 출력은 한 줄이어야 해서(TAP) 비교는 가능한 한 문자열 하나로 한다.
import { describe, expect, it } from "vitest";
import { isAlive } from "../../shared/game/alive";
import { enterExecution, noExecutionOf } from "../../shared/game/execution";
import type { RoomState } from "../../shared/game/room";
import { tick } from "../../shared/game/tick";
import { buildView } from "../../shared/game/view";
import { EXECUTION_PHRASE_COUNT } from "../../shared/protocol";
import type { PhaseId, RoomView } from "../../shared/protocol";
import { seededRandInt } from "../helpers/seededRandom";
import { stateWithVerdict } from "../helpers/voteState";

const NOW = 20_000;
const SEEDS = [1, 2, 3] as const;
const ROLE_WORDS = new Set(["mafia", "police", "doctor", "citizen", "none"]);

const idOf = (state: RoomState, seat: number): string => state.players.find((p) => p.seat === seat)!.id;
const viewOf = (state: RoomState, seat: number): RoomView => buildView(state, idOf(state, seat), NOW);
const aliveSeats = (state: RoomState): number[] =>
  state.players.filter(isAlive).map((p) => p.seat).sort((a, b) => a - b);

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
    const { candidate: _drop, ...noCandidate } = stateWithVerdict(6, 1, "defense").verdict!;
    const tied: RoomState = { ...stateWithVerdict(6, 1, "defense"), verdict: noCandidate };
    expect(enterExecution(tied, THROWING_RAND)).toBe(tied);
  });

  it("입력 상태를 바꾸지 않는다 (깊은 동결) · 직업 값은 execution 어디에도 없다", () => {
    const before = deepFreeze(defenseOf(2));
    const after = enterExecution(before, seededRandInt(2));
    expect(ROLE_WORDS.has(String(Object.values(after.execution!).join("|")))).toBe(false);
    expect(Object.values(after.execution!).every((v) => typeof v === "number")).toBe(true);
  });
});

describe("view: 서버 전용 키 이름 (D-19, T-04-10)", () => {
  it("어떤 view 에도 서버 전용 키 이름 candidateVote·verdict·lastExecPhrase 가 없다 (변론 · 처형)", () => {
    for (const phase of ["defense", "execution"] as const) {
      const state = stateWithVerdict(6, 2, phase);
      const text = JSON.stringify(state.players.map((p) => viewOf(state, p.seat)));
      for (const key of ["candidateVote", "verdict", "lastExecPhrase", "execVote"]) {
        // 8페이즈(08-07): 처형 단계에는 공개 와이어 필드 day.verdict({yes,no,passed})가 있다 — 서버 전용 RoomState.verdict 와 이름만 같다.
        const want = key === "verdict" && phase === "execution";
        expect(`${phase}/${key}: ${text.includes(`"${key}":`)}`).toBe(`${phase}/${key}: ${want}`);
      }
    }
  });
});

describe("view: day.candidate · day.execution (D-06, D-09, D-11)", () => {
  it("day.candidate 는 변론·처형에서 후보가 있을 때 모든 viewer 에게 같다", () => {
    const rows: string[] = [];
    for (const phase of ["defense", "execution"] as const) {
      const state = stateWithVerdict(6, 1, phase);
      const values = new Set(state.players.map((p) => String(viewOf(state, p.seat).day?.candidate)));
      rows.push(`${phase}=${[...values].join("|")}`);
    }
    const x = stateWithVerdict(6, 1, "defense").verdict!.candidate;
    expect(typeof x).toBe("number");
    expect(rows.join(" ")).toBe(`defense=${x} execution=${x}`);
  });

  it("day.execution 은 execution 단계에만, 키가 정확히 seat·phrase 다", () => {
    const rows: string[] = [];
    for (const phase of ["defense", "execution"] as const) {
      const state = stateWithVerdict(6, 1, phase);
      rows.push(`${phase}:${Object.keys(viewOf(state, 1).day?.execution ?? {}).sort().join(",") || "-"}`);
    }
    expect(rows.join(" ")).toBe("defense:- execution:phrase,seat");
  });

  it("처형 직업 비공개 (D-09): execution 단계 살아 있는 viewer 의 view 에서 역할 단어는 .me.role·.day.roles[] 경로에만 있다", () => {
    const allowed = new Set([".me.role", ".day.roles[]"]);
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

  it("처형이 이뤄진 날의 밤 view 에는 키가 없다", () => {
    for (const seed of SEEDS) {
      const night = nightWith(stateWithVerdict(6, seed, "execution"), seed);
      expect(night.players.filter((p) => p.alive === false).length).toBe(1);
      expect(night.players.every((p) => !("noExecution" in (viewOf(night, p.seat).day ?? {})))).toBe(true);
      expect(noExecutionOf(night)).toBeUndefined();
    }
  });

  it("밤이 아닌 단계(defense·execution·ended)의 view 에는 키가 없다", () => {
    const rows: string[] = [];
    const cases: Array<[string, RoomState]> = [
      ["defense", stateWithVerdict(6, 1, "defense")],
      ["execution", stateWithVerdict(6, 1, "execution")],
      ["ended", { ...nightWith(stateWithVerdict(6, 1, "execution"), 1), phase: "ended", phaseEndsAt: null }],
    ];
    for (const [name, state] of cases) {
      rows.push(`${name}:${state.players.some((p) => "noExecution" in (viewOf(state, p.seat).day ?? {}))}`);
    }
    expect(rows.join(" ")).toBe("defense:false execution:false ended:false");
  });

  it("voteLog 가 없는 옛 상태의 밤에는 키가 없다; 밤이 아니면 noExecutionOf 는 undefined", () => {
    const night = nightWith(stateWithVerdict(6, 1, "execution"), 1);
    const { voteLog: _drop, ...old } = night;
    expect(noExecutionOf(old as RoomState)).toBeUndefined();
    expect(old.players.every((p) => !("noExecution" in (viewOf(old as RoomState, p.seat).day ?? {})))).toBe(true);
    expect(noExecutionOf({ ...night, phase: "morning" })).toBeUndefined();
  });

  it("입력 상태를 바꾸지 않는다 (깊은 동결)", () => {
    const night = deepFreeze(nightWith(stateWithVerdict(6, 1, "execution"), 1));
    expect(() => noExecutionOf(night)).not.toThrow();
  });
});

describe("새 단계 전수 누출 검사 (4~8명 × 변론·처형 두 단계 × 모든 viewer × 시드 3, T-04-10·T-04-11·T-04-12)", () => {
  it("token·id 가 없고, role·allies 키는 me 아래에만 있으며, 공개 항목은 다섯 키뿐이고, 서버 전용 키가 없으며, day 키가 단계별 허용 목록과 같다", () => {
    const violations: string[] = [];
    let views = 0;
    const serverOnly = ["candidateVote", "execVote", "verdict", "lastExecPhrase", "nightPick", "claimPick"];
    for (let n = 4; n <= 8; n += 1) {
      for (const seed of SEEDS) {
        for (const phase of ["defense", "execution"] as const) {
          const state = stateWithVerdict(n, seed, phase);
          for (const viewer of state.players) {
            views += 1;
            const tag = `${n}/${seed}/${phase}/seat${viewer.seat}`;
            const view = buildView(state, viewer.id, NOW);
            const text = JSON.stringify(view);
            for (const q of state.players) {
              if (text.includes(q.token)) violations.push(`${tag}: token of seat${q.seat}`);
              if (text.includes(q.id)) violations.push(`${tag}: id of seat${q.seat}`);
            }
            const paths = new Set<string>();
            const walk = (value: unknown, path: string): void => {
              if (Array.isArray(value)) value.forEach((v) => walk(v, `${path}[]`));
              else if (value !== null && typeof value === "object") {
                for (const [k, v] of Object.entries(value)) {
                  paths.add(`${path}.${k}`);
                  walk(v, `${path}.${k}`);
                }
              }
            };
            walk(view, "");
            for (const path of paths) {
              const key = path.slice(path.lastIndexOf(".") + 1);
              if (key === "role" && path !== ".me.role") violations.push(`${tag}: role at ${path}`);
              if (key === "allies" && path !== ".me.allies") violations.push(`${tag}: allies at ${path}`);
              // 8페이즈(08-07): 처형 단계의 day.verdict 는 공개 와이어 필드다(서버 전용 verdict 와 이름만 같다).
              if (serverOnly.includes(key) && path !== ".day.verdict") violations.push(`${tag}: server-only key at ${path}`);
            }
            for (const entry of view.players) {
              const keys = Object.keys(entry).sort().join(",");
              if (keys !== "alive,connected,isHost,nickname,seat") violations.push(`${tag}: players[] keys ${keys}`);
            }
            const want = ["n", "roles", "voteLog", "candidate"];
            if (phase === "execution") want.push("execution", "verdict"); // 8페이즈(08-07): 처형 단계의 찬반 결과 수 day.verdict
            const got = Object.keys(view.day ?? {}).sort().join(",");
            if (got !== want.sort().join(",")) violations.push(`${tag}: day keys ${got}`);
          }
        }
      }
    }
    expect(views).toBe(3 * 2 * (4 + 5 + 6 + 7 + 8));
    expect(violations.join("; ")).toBe("");
  });
});
