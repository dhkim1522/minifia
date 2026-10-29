// 여부 투표 트레이서(04-01) — VOTE-01·CONN-02, 결정 0034·D-01·D-02·D-04·D-05·D-25·D-28.
// 낮 토론 → 처형 여부 투표(execVote 10초) → 마감 분기(후보 선택 / 밤)를 실제 전이(startGame, tick)로 만들어 증명한다.
// 실패 출력은 한 줄이어야 해서(TAP) 비교는 가능한 한 문자열 하나로 한다.
import { describe, expect, it } from "vitest";
import { isAlive } from "../../shared/game/alive";
import {
  CANDIDATE_VOTE_MS,
  DISCUSSION_MS,
  EXEC_VOTE_MS,
  MORNING_MS,
  NIGHT_MS,
  PHASE_DEFS,
  candidateRevealMs,
} from "../../shared/game/phases";
import { attachConnection, createRoomState, joinRoom, startGame } from "../../shared/game/room";
import type { Player, RoomState } from "../../shared/game/room";
import { tick } from "../../shared/game/tick";
import {
  castCandidateVote,
  castExecVote,
  enterExecVote,
  execTallyOf,
  resolveExecVote,
  tallyCandidateVote,
} from "../../shared/game/vote";
import { buildView } from "../../shared/game/view";
import type { PhaseId, RoomView } from "../../shared/protocol";
import { seededRandInt } from "../helpers/seededRandom";
import { stateWithVerdict } from "../helpers/voteState";

const START_AT = 10_000;
const NEW_PHASES: readonly PhaseId[] = ["execVote", "candidateVote", "candidateVoteReveal", "defense", "execution", "ended"];

/** n 명이 모두 연결된 대기실. */
function lobbyOf(n: number): RoomState {
  const created = createRoomState({
    code: "0420",
    hostId: "player-id-0000-aaaa",
    hostToken: "token-secret-0000-aaaa-0123456789",
    hostNickname: "이름0",
    now: 0,
  });
  if (!created.ok) throw new Error("createRoomState failed");
  let state = attachConnection(created.state, "player-id-0000-aaaa", "conn-0");
  for (let i = 1; i < n; i += 1) {
    const id = `player-id-000${i}-aaaa`;
    const joined = joinRoom(state, { playerId: id, token: `token-secret-000${i}-aaaa-0123456789`, nickname: `이름${i}` });
    if (!joined.ok) throw new Error(`joinRoom failed: ${joined.error}`);
    state = attachConnection(joined.state, id, `conn-${i}`);
  }
  return state;
}

/** 실제 전이(startGame, tick)로 1일차 목표 단계 상태를 만든다. */
function stateAt(n: number, seed: number, phase: PhaseId): RoomState {
  const lobby = lobbyOf(n);
  const started = startGame(lobby, lobby.hostId, START_AT, seededRandInt(seed));
  if (!started.ok) throw new Error(`startGame failed: ${started.error}`);
  let state = started.state;
  for (let guard = 0; state.phase !== phase; guard += 1) {
    if (state.phaseEndsAt === null || guard > 60) throw new Error(`cannot reach ${phase}`);
    state = tick(state, state.phaseEndsAt, seededRandInt(seed + 1));
  }
  return state;
}

const execVoteOf = (n: number, seed: number): RoomState => stateAt(n, seed, "execVote");

/** 앞 yes 명은 찬성, 그다음 no 명은 반대로 만든다(생존자 순서 = seat 오름차순). 입력은 바꾸지 않는다. */
function withVotes(state: RoomState, yes: number, no: number): RoomState {
  const alive = [...state.players].filter(isAlive).sort((a, b) => a.seat - b.seat);
  const values = new Map<string, boolean>();
  alive.slice(0, yes).forEach((p) => values.set(p.id, true));
  alive.slice(yes, yes + no).forEach((p) => values.set(p.id, false));
  return {
    ...state,
    players: state.players.map((p) => (values.has(p.id) ? { ...p, execVote: values.get(p.id)! } : p)),
  };
}

/** 지정한 seat 를 탈락시킨다. */
function withDead(state: RoomState, seats: number[]): RoomState {
  return { ...state, players: state.players.map((p) => (seats.includes(p.seat) ? { ...p, alive: false } : p)) };
}

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value as Record<string, unknown>)) deepFreeze(child);
  }
  return value;
}

/** 값 안의 모든 객체 키 이름. */
function keyNames(value: unknown, into: Set<string> = new Set()): Set<string> {
  if (Array.isArray(value)) {
    for (const item of value) keyNames(item, into);
  } else if (value !== null && typeof value === "object") {
    for (const [k, v] of Object.entries(value)) {
      into.add(k);
      keyNames(v, into);
    }
  }
  return into;
}

const idOf = (state: RoomState, seat: number): string => state.players.find((p) => p.seat === seat)!.id;
const lastLog = (state: RoomState) => state.voteLog?.at(-1);
const passedOf = (state: RoomState, yes: number, no: number): boolean =>
  lastLog(resolveExecVote(withVotes(state, yes, no)).state)?.exec.passed === true;

describe("단계 표 (D-01·D-25)", () => {
  it("새 단계 여섯 개와 길이·기본 다음 단계가 표대로다", () => {
    const row = (id: PhaseId) => `${PHASE_DEFS[id].durationMs}/${PHASE_DEFS[id].next}/${PHASE_DEFS[id].revealsOwnRole}`;
    expect(
      [
        row("discussion"),
        row("execVote"),
        row("candidateVote"),
        row("candidateVoteReveal"),
        row("defense"),
        row("execution"),
        row("ended"),
      ].join(" "),
    ).toBe(
      `40000/execVote/true 13000/candidateVote/true 15000/candidateVoteReveal/true ${candidateRevealMs(0)}/defense/true 10000/execution/true 5000/night/true null/null/true`,
    );
  });
});

describe("castExecVote (VOTE-01) — 검사 순서와 같은 값 재전송", () => {
  it("execVote 가 아닌 단계는 누구든(탈락자 포함) WRONG_PHASE 다", () => {
    const discussion = withDead(stateAt(5, 1, "discussion"), [4]);
    const alive = castExecVote(discussion, idOf(discussion, 0), true);
    const dead = castExecVote(discussion, idOf(discussion, 4), true);
    expect(`${alive.ok ? "ok" : alive.error} ${dead.ok ? "ok" : dead.error}`).toBe("WRONG_PHASE WRONG_PHASE");
  });

  it("방에 없는 사람과 탈락한 사람은 BAD_MESSAGE 다", () => {
    const base = withDead(execVoteOf(5, 1), [4]);
    const stranger = castExecVote(base, "nobody", true);
    const dead = castExecVote(base, idOf(base, 4), true);
    expect(`${stranger.ok ? "ok" : stranger.error} ${dead.ok ? "ok" : dead.error}`).toBe("BAD_MESSAGE BAD_MESSAGE");
  });

  it("agree 가 불리언이 아니면 BAD_MESSAGE 다", () => {
    const base = execVoteOf(5, 1);
    const results = ["true", 1, null, undefined].map((v) => {
      const r = castExecVote(base, idOf(base, 0), v as unknown as boolean);
      return r.ok ? "ok" : r.error;
    });
    expect(results.join(" ")).toBe("BAD_MESSAGE BAD_MESSAGE BAD_MESSAGE BAD_MESSAGE");
  });

  it("같은 값을 다시 보내면 입력 객체를 그대로 돌려준다", () => {
    const base = execVoteOf(5, 1);
    const first = castExecVote(base, idOf(base, 0), true);
    if (!first.ok) throw new Error("setup rejected");
    const again = castExecVote(first.state, idOf(base, 0), true);
    expect(again.ok && again.state === first.state).toBe(true);
  });

  it("그 사람의 execVote 만 바뀐 새 상태를 돌려주고 phaseEndsAt 은 그대로다(입력을 깊게 얼려도 예외가 없다)", () => {
    const base = deepFreeze(execVoteOf(5, 1));
    const result = castExecVote(base, idOf(base, 2), false);
    if (!result.ok) throw new Error("rejected");
    const changed = result.state.players.filter((p, i) => p !== base.players[i]).map((p) => `${p.seat}:${String(p.execVote)}`);
    expect(`${changed.join(",")} ends=${result.state.phaseEndsAt === base.phaseEndsAt}`).toBe("2:false ends=true");
    expect(result.state === base).toBe(false);
  });

  it("번복: 찬성 → 반대 → 찬성, 마지막 값이 유효하다", () => {
    let state = execVoteOf(5, 1);
    const id = idOf(state, 1);
    const seen: string[] = [];
    for (const agree of [true, false, true]) {
      const r = castExecVote(state, id, agree);
      if (!r.ok) throw new Error("rejected");
      state = r.state;
      const t = execTallyOf(state);
      seen.push(`${t.yes}/${t.no}`);
    }
    expect(seen.join(" ")).toBe("1/0 0/1 1/0");
  });
});

describe("execTallyOf (D-02·Pitfall 2)", () => {
  it("안 던진 사람과 탈락자의 값은 어느 쪽에도 세지 않는다 — undefined 를 반대로 세지 않는다", () => {
    const base = execVoteOf(5, 1);
    expect(JSON.stringify(execTallyOf(base))).toBe(JSON.stringify({ yes: 0, no: 0 }));
    // seat 0..3 은 던졌고 seat 4 는 안 던졌다. 그런데 seat 3 이 탈락했다.
    const voted = withDead(withVotes(base, 2, 2), [3]);
    expect(JSON.stringify(execTallyOf(voted))).toBe(JSON.stringify({ yes: 2, no: 1 }));
  });
});

describe("마감 판정 규칙표 (D-02·D-04, RESEARCH 투표 규칙표)", () => {
  const base = (): RoomState => execVoteOf(5, 1);
  it("던진 표가 0 이면 통과가 아니다", () => {
    expect(passedOf(base(), 0, 0)).toBe(false);
  });
  it("찬성 1 (던진 표 1) 이면 통과다 — 정족수 없음", () => {
    expect(passedOf(base(), 1, 0)).toBe(true);
  });
  it("2:2 는 통과가 아니고 3:2 는 통과다", () => {
    expect(`${passedOf(base(), 2, 2)} ${passedOf(base(), 3, 2)}`).toBe("false true");
  });
  it("생존 5 · 던진 2 · 찬성 2 는 통과, 생존 5 · 던진 4 · 찬성 2 는 아니다 (분모는 던진 표)", () => {
    expect(`${passedOf(base(), 2, 0)} ${passedOf(base(), 2, 2)}`).toBe("true false");
  });
});

describe("resolveExecVote (T-04-02) — 집계 직후 개인 표 삭제", () => {
  it("반환 뒤 어떤 플레이어에도 execVote 키가 없고 voteLog 마지막 줄 키가 정확하다", () => {
    const voted = withVotes(execVoteOf(5, 2), 3, 1);
    const result = resolveExecVote(voted);
    expect(result.state.players.some((p) => Object.hasOwn(p, "execVote"))).toBe(false);
    const line = lastLog(result.state)!;
    expect(`${Object.keys(line).sort().join(",")} ${Object.keys(line.exec).sort().join(",")}`).toBe("exec,n no,passed,yes");
    expect(JSON.stringify(line.exec)).toBe(JSON.stringify({ yes: 3, no: 1, passed: true }));
    expect(result.state.verdict?.passed).toBe(true);
  });

  it("통과면 next 키가 없고, 아니면 next 는 night 이며, stay 는 항상 false 다", () => {
    const base = execVoteOf(5, 2);
    const pass = resolveExecVote(withVotes(base, 3, 1));
    const fail = resolveExecVote(withVotes(base, 1, 1));
    const none = resolveExecVote(base);
    expect(
      [pass, fail, none].map((r) => `${Object.hasOwn(r, "next") ? String(r.next) : "-"}/${r.stay}`).join(" "),
    ).toBe("-/false night/false night/false");
  });

  it("입력을 얼려도 예외가 없다", () => {
    const frozen = deepFreeze(withVotes(execVoteOf(5, 2), 2, 1));
    expect(() => resolveExecVote(frozen)).not.toThrow();
  });
});

describe("tick 연쇄 (D-01·D-04·D-25)", () => {
  for (const seed of [1, 2, 3]) {
    it(`시드 ${seed}: discussion 마감 D 에서 execVote(D+EXEC_VOTE_MS) → 찬성 3·반대 1 이면 candidateVote(D+EXEC_VOTE_MS+CANDIDATE_VOTE_MS)`, () => {
      const discussion = stateAt(5, seed, "discussion");
      const D = discussion.phaseEndsAt!;
      const rand = seededRandInt(seed);
      const execVote = tick(discussion, D, rand);
      expect(`${execVote.phase}/${execVote.phaseEndsAt! - D}`).toBe(`execVote/${EXEC_VOTE_MS}`);
      const cand = tick(withVotes(execVote, 3, 1), D + EXEC_VOTE_MS, rand);
      expect(`${cand.phase}/${cand.phaseEndsAt! - D}`).toBe(`candidateVote/${EXEC_VOTE_MS + CANDIDATE_VOTE_MS}`);
    });

    it(`시드 ${seed}: 0표나 동률이면 night(D+EXEC_VOTE_MS+NIGHT_MS)`, () => {
      const discussion = stateAt(5, seed, "discussion");
      const D = discussion.phaseEndsAt!;
      const rand = seededRandInt(seed);
      const execVote = tick(discussion, D, rand);
      const zero = tick(execVote, D + EXEC_VOTE_MS, rand);
      const tie = tick(withVotes(execVote, 2, 2), D + EXEC_VOTE_MS, rand);
      expect(`${zero.phase}/${zero.phaseEndsAt! - D} ${tie.phase}/${tie.phaseEndsAt! - D}`).toBe(
        `night/${EXEC_VOTE_MS + NIGHT_MS} night/${EXEC_VOTE_MS + NIGHT_MS}`,
      );
    });
  }

  it("알람 지연 따라잡기: discussion 을 마감보다 훨씬 늦게 tick 하면 execVote(0표) · night 를 지나 morning 까지 마감이 이어진다", () => {
    const discussion = stateAt(5, 4, "discussion");
    const D = discussion.phaseEndsAt!;
    const late = tick(discussion, D + EXEC_VOTE_MS + NIGHT_MS, seededRandInt(4));
    expect(`${late.phase}/${late.phaseEndsAt! - D}`).toBe(`morning/${EXEC_VOTE_MS + NIGHT_MS + MORNING_MS}`);
    expect(JSON.stringify(lastLog(late)?.exec)).toBe(JSON.stringify({ yes: 0, no: 0, passed: false }));
  });

  it("discussion 길이는 40초다 (결정 0039)", () => {
    expect(DISCUSSION_MS).toBe(40_000);
  });
});

describe("enterExecVote", () => {
  it("남은 verdict·execution 키와 모든 플레이어의 execVote·candidateVote 키를 지우고 voteLog 는 남긴다", () => {
    const dirty: RoomState = {
      ...withVotes(execVoteOf(5, 1), 2, 1),
      verdict: { passed: true, candidate: 1 },
      execution: { seat: 1, phrase: 2 },
      voteLog: [{ n: 1, exec: { yes: 1, no: 0, passed: true } }],
      players: withVotes(execVoteOf(5, 1), 2, 1).players.map((p) => ({ ...p, candidateVote: 0 })),
    };
    const clean = enterExecVote(dirty);
    expect(
      [
        Object.hasOwn(clean, "verdict"),
        Object.hasOwn(clean, "execution"),
        clean.players.some((p) => Object.hasOwn(p, "execVote") || Object.hasOwn(p, "candidateVote")),
        clean.voteLog?.length,
      ].join(" "),
    ).toBe("false false false 1");
  });
});

describe("CONN-02 — 끊긴 사람이 있어도 타이머대로", () => {
  it("전원 connected false 여도 tick 이 execVote 를 마감대로 넘긴다", () => {
    const base = execVoteOf(5, 1);
    const offline: RoomState = { ...base, players: base.players.map((p) => ({ ...p, connected: false, connId: null })) };
    const next = tick(offline, offline.phaseEndsAt!, seededRandInt(1));
    expect(next.phase).toBe("night");
  });

  it("던진 뒤 끊긴 사람의 표는 센다", () => {
    const voted = withVotes(execVoteOf(5, 1), 1, 0);
    const dropped: RoomState = {
      ...voted,
      players: voted.players.map((p) => (p.seat === 0 ? { ...p, connected: false, connId: null } : p)),
    };
    const next = tick(dropped, dropped.phaseEndsAt!, seededRandInt(1));
    expect(`${next.phase} ${JSON.stringify(lastLog(next)?.exec)}`).toBe(
      `candidateVote ${JSON.stringify({ yes: 1, no: 0, passed: true })}`,
    );
  });
});

describe("투표는 마감을 바꾸지 않는다 (D-28)", () => {
  it("전원이 던져도 phaseEndsAt 그대로이고, 마감 전 tick 은 입력 그대로다", () => {
    let state = execVoteOf(5, 1);
    const ends = state.phaseEndsAt;
    for (const p of [...state.players]) {
      const r = castExecVote(state, p.id, true);
      if (!r.ok) throw new Error("rejected");
      state = r.state;
    }
    expect(state.phaseEndsAt).toBe(ends);
    expect(tick(state, ends! - 1, seededRandInt(1))).toBe(state);
  });
});

describe("뷰 (D-02 익명, T-04-01)", () => {
  const NOW = 123;
  const viewOf = (state: RoomState, seat: number): RoomView => buildView(state, idOf(state, seat), NOW);

  it("execVote 단계에서 모든 viewer(생존·탈락)의 day.execTally 가 같고 execTallyOf 와 같다", () => {
    const state = withDead(withVotes(execVoteOf(6, 1), 2, 1), [5]);
    const want = JSON.stringify(execTallyOf(state));
    const got = state.players.map((p) => JSON.stringify(viewOf(state, p.seat).day?.execTally));
    expect(got.every((g) => g === want)).toBe(true);
    expect(want).toBe(JSON.stringify({ yes: 2, no: 1 }));
  });

  it("me.voteAgree 는 본인이 던졌을 때 본인 view 에만 있다", () => {
    const state = withVotes(execVoteOf(5, 1), 1, 1); // seat 0 찬성, seat 1 반대
    const has = state.players.map((p) => `${p.seat}:${String(viewOf(state, p.seat).me.voteAgree)}`);
    expect(has.join(" ")).toBe("0:true 1:false 2:undefined 3:undefined 4:undefined");
    expect(Object.hasOwn(viewOf(state, 2).me, "voteAgree")).toBe(false);
  });

  it("execVote 가 아닌 단계 view 에는 execTally·voteAgree 키가 없다", () => {
    const state = stateAt(5, 1, "discussion");
    const view = viewOf(state, 0);
    expect(`${Object.hasOwn(view.day!, "execTally")} ${Object.hasOwn(view.me, "voteAgree")}`).toBe("false false");
  });

  it("새 여섯 단계 모두 view.day 가 있고 day.voteLog 는 배열이다(빈 배열 포함)", () => {
    const base = execVoteOf(5, 1);
    const ok = NEW_PHASES.map((phase) => {
      const view = viewOf({ ...base, phase }, 0);
      return `${phase}:${Array.isArray(view.day?.voteLog)}`;
    });
    expect(ok.join(" ")).toBe(NEW_PHASES.map((p) => `${p}:true`).join(" "));
  });

  it("어떤 view 의 어떤 경로에도 키 이름 execVote 가 없다 (마감 전 · 후)", () => {
    const voted = withVotes(execVoteOf(5, 1), 2, 1);
    const after = tick(voted, voted.phaseEndsAt!, seededRandInt(1));
    const names = new Set<string>();
    for (const state of [voted, after]) {
      for (const p of state.players) keyNames(viewOf(state, p.seat), names);
    }
    expect(names.has("execVote")).toBe(false);
  });

  it("차분(기본형): 같은 집계를 다른 세 사람에게 나눠 준 두 상태에서, 표를 안 던진 제3자의 view 가 같다", () => {
    for (const n of [5, 8]) {
      const base = execVoteOf(n, 3);
      const set = (votes: Array<[number, boolean]>): RoomState => ({
        ...base,
        players: base.players.map((p) => {
          const hit = votes.find(([seat]) => seat === p.seat);
          return hit ? { ...p, execVote: hit[1] } : p;
        }),
      });
      const s1 = set([[1, true], [2, true], [3, false]]);
      const s2 = set([[2, true], [4, true], [1, false]]);
      expect(JSON.stringify(viewOf(s1, 0))).toBe(JSON.stringify(viewOf(s2, 0)));
      // 표를 안 던진 탈락 관전자 O(seat 0)도 같다
      expect(JSON.stringify(viewOf(withDead(s1, [0]), 0))).toBe(JSON.stringify(viewOf(withDead(s2, [0]), 0)));
    }
  });
});

// ---- 04-04 Task 1: 후보 선택 수신과 집계 (VOTE-02, D-03, D-04, D-20, D-21) ----

const candidateVoteOf = (n: number, seed: number, candidate: "none" = "none"): RoomState =>
  stateWithVerdict(n, seed, "candidateVote", { candidate });

/** 지정한 seat 들이 고른 값을 서버 저장 필드에 직접 넣는다(집계 규칙만 따로 보려는 준비용 — 수신 검사는 castCandidateVote 테스트가 한다). */
function withCandidateVotes(state: RoomState, picks: Array<[number, number]>): RoomState {
  return {
    ...state,
    players: state.players.map((p) => {
      const hit = picks.find(([seat]) => seat === p.seat);
      return hit ? { ...p, candidateVote: hit[1] } : p;
    }),
  };
}

/** 호출을 기록하는 randInt. 항상 0 을 돌려준다. */
function spyRand(): { randInt: (n: number) => number; calls: number[] } {
  const calls: number[] = [];
  return {
    calls,
    randInt: (n: number): number => {
      calls.push(n);
      return 0;
    },
  };
}

const THROWING_RAND = (): number => {
  throw new Error("randInt must not be called");
};

describe("castCandidateVote (VOTE-02, D-03) — 검사 순서", () => {
  it("candidateVote 가 아닌 단계는 누구든(탈락자 포함) WRONG_PHASE 다", () => {
    const discussion = withDead(stateAt(5, 1, "discussion"), [4]);
    const exec = withDead(execVoteOf(5, 1), [4]);
    const out = [discussion, exec].flatMap((s) =>
      [0, 4].map((seat) => {
        const r = castCandidateVote(s, idOf(s, seat), 1);
        return r.ok ? "ok" : r.error;
      }),
    );
    expect(out.join(" ")).toBe("WRONG_PHASE WRONG_PHASE WRONG_PHASE WRONG_PHASE");
  });

  it("방에 없는 행위자·탈락한 행위자는 BAD_MESSAGE 다", () => {
    const state = withDead(candidateVoteOf(5, 2), [4]);
    const ghost = castCandidateVote(state, "player-id-zzzz-none", 1);
    const dead = castCandidateVote(state, idOf(state, 4), 1);
    expect(`${ghost.ok ? "ok" : ghost.error} ${dead.ok ? "ok" : dead.error}`).toBe("BAD_MESSAGE BAD_MESSAGE");
  });

  it("대상이 정수가 아니거나 앉지 않았거나 탈락자면 BAD_MESSAGE 다 (null 은 취소(결정 0040)라 이 목록에 없고 undefined 는 남는다)", () => {
    const state = withDead(candidateVoteOf(5, 2), [3]);
    const bad = [1.5, Number.NaN, -1, 99, 3, "2" as unknown as number, undefined as unknown as number].map(
      (target) => {
        const r = castCandidateVote(state, idOf(state, 0), target);
        return r.ok ? "ok" : r.error;
      },
    );
    expect(bad.join(" ")).toBe(Array(7).fill("BAD_MESSAGE").join(" "));
  });

  it("자기 자신은 고를 수 없다 — BAD_MESSAGE (D-03, 서버가 방어선)", () => {
    const state = candidateVoteOf(6, 4);
    const results = state.players.map((p) => {
      const r = castCandidateVote(state, p.id, p.seat);
      return r.ok ? "ok" : r.error;
    });
    expect(results.join(" ")).toBe(Array(6).fill("BAD_MESSAGE").join(" "));
  });

  it("같은 값을 다시 보내면 입력 상태 그대로(toBe)다", () => {
    const state = candidateVoteOf(5, 5);
    const first = castCandidateVote(state, idOf(state, 0), 2);
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    const again = castCandidateVote(first.state, idOf(first.state, 0), 2);
    expect(again.ok && again.state === first.state).toBe(true);
  });

  it("그 사람의 candidateVote 만 바뀐 새 상태를 돌려주고 입력과 마감 시각은 바뀌지 않는다", () => {
    const state = deepFreeze(candidateVoteOf(5, 6));
    const result = castCandidateVote(state, idOf(state, 1), 3);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state).not.toBe(state);
    expect(result.state.phaseEndsAt).toBe(state.phaseEndsAt);
    expect(result.state.phase).toBe("candidateVote");
    const changed = result.state.players.filter((p, i) => JSON.stringify(p) !== JSON.stringify(state.players[i]));
    expect(changed.map((p) => `${p.seat}:${p.candidateVote}`).join(" ")).toBe("1:3");
    expect(state.players.every((p) => p.candidateVote === undefined)).toBe(true);
  });

  it("번복: A → B → C, 마지막 값만 남는다 (마감은 그대로)", () => {
    let state = candidateVoteOf(6, 7);
    const deadline = state.phaseEndsAt;
    for (const target of [2, 3, 4]) {
      const r = castCandidateVote(state, idOf(state, 0), target);
      if (!r.ok) throw new Error(`rejected ${target}: ${r.error}`);
      state = r.state;
    }
    expect(state.players.find((p) => p.seat === 0)?.candidateVote).toBe(4);
    expect(state.phaseEndsAt).toBe(deadline);
  });
});

describe("tallyCandidateVote (VOTE-02, D-03, D-04, D-20) — 집계와 서버 셔플", () => {
  const seatsOf = (votes: Array<{ seat: number }>): string => votes.map((v) => v.seat).join(",");

  it("최다 득표가 한 명이면 그 사람이 candidate 다", () => {
    const state = withCandidateVotes(candidateVoteOf(6, 1), [[0, 3], [1, 3], [2, 4], [3, 0]]);
    const result = tallyCandidateVote(state, seededRandInt(1));
    expect(result.candidate).toBe(3);
    expect(result.votes.length).toBe(4);
  });

  it("최다 동률이면 candidate 키 자체가 없고 난수로 고르지 않는다", () => {
    const state = withCandidateVotes(candidateVoteOf(6, 1), [[0, 3], [1, 3], [2, 4], [3, 4]]);
    const result = tallyCandidateVote(state, seededRandInt(1));
    expect("candidate" in result).toBe(false);
    expect(result.votes.length).toBe(4);
    // 동률 판정 자체는 난수를 쓰지 않는다: 셔플 호출(n=4 → 4,3,2)만 있고 그 밖의 호출이 없다.
    const spy = spyRand();
    tallyCandidateVote(state, spy.randInt);
    expect(JSON.stringify(spy.calls)).toBe(JSON.stringify([4, 3, 2]));
  });

  it("0표면 votes [] 이고 candidate 가 없다", () => {
    const result = tallyCandidateVote(candidateVoteOf(5, 1), THROWING_RAND);
    expect(JSON.stringify(result)).toBe(JSON.stringify({ votes: [] }));
  });

  it("살아 있는 투표자의 표만 센다: 탈락한 투표자·저장된 대상이 탈락자인 표는 뺀다", () => {
    const base = withCandidateVotes(candidateVoteOf(6, 2), [[0, 3], [1, 3], [2, 3], [4, 5]]);
    const state = withDead(base, [2, 3]); // 투표자 seat 2 탈락 · 대상 seat 3 탈락
    const result = tallyCandidateVote(state, seededRandInt(2));
    // 남는 표: 4 → 5 하나뿐
    expect(JSON.stringify(result.votes)).toBe(JSON.stringify([{ seat: 4, target: 5 }]));
    expect(result.candidate).toBe(5);
  });

  it("투표자 1명 이하면 randInt 를 부르지 않는다 (던지는 함수를 넘겨도 예외가 없다)", () => {
    const one = withCandidateVotes(candidateVoteOf(5, 3), [[2, 4]]);
    expect(JSON.stringify(tallyCandidateVote(one, THROWING_RAND))).toBe(JSON.stringify({ votes: [{ seat: 2, target: 4 }], candidate: 4 }));
    expect(JSON.stringify(tallyCandidateVote(candidateVoteOf(5, 3), THROWING_RAND))).toBe(JSON.stringify({ votes: [] }));
  });

  it("셔플 호출 순서 계약: 투표자 n 명(n ≥ 2)이면 randInt 인자가 정확히 [n, n-1, …, 2] 이고 randInt(0)·randInt(1) 은 없다", () => {
    for (const n of [4, 5, 6, 7, 8]) {
      const picks: Array<[number, number]> = Array.from({ length: n }, (_, seat) => [seat, (seat + 1) % n]);
      const state = withCandidateVotes(candidateVoteOf(n, 4), picks);
      const spy = spyRand();
      tallyCandidateVote(state, spy.randInt);
      const expected = Array.from({ length: n - 1 }, (_, i) => n - i);
      expect(spy.calls.join(",")).toBe(expected.join(","));
      expect(spy.calls.includes(0) || spy.calls.includes(1)).toBe(false);
    }
  });

  it("투표자가 둘이면 randInt(2) 한 번이다", () => {
    const state = withCandidateVotes(candidateVoteOf(5, 4), [[0, 1], [1, 0]]);
    const spy = spyRand();
    tallyCandidateVote(state, spy.randInt);
    expect(JSON.stringify(spy.calls)).toBe(JSON.stringify([2]));
  });

  it("같은 시드는 같은 순서이고, votes 는 seat 오름차순 목록의 순열이며 각 줄 키는 정확히 seat·target 이다", () => {
    const picks: Array<[number, number]> = [[0, 5], [1, 5], [2, 5], [3, 0], [4, 0], [5, 1], [6, 1], [7, 1]];
    const state = withCandidateVotes(candidateVoteOf(8, 5), picks);
    for (const seed of [1, 2, 3]) {
      const a = tallyCandidateVote(state, seededRandInt(seed));
      const b = tallyCandidateVote(state, seededRandInt(seed));
      expect(JSON.stringify(a)).toBe(JSON.stringify(b));
      expect(seatsOf([...a.votes].sort((x, y) => x.seat - y.seat))).toBe("0,1,2,3,4,5,6,7");
      for (const line of a.votes) expect(Object.keys(line).sort().join(",")).toBe("seat,target");
    }
    const orders = new Set([1, 2, 3, 4, 5, 6].map((seed) => seatsOf(tallyCandidateVote(state, seededRandInt(seed)).votes)));
    expect(orders.size).toBeGreaterThan(1); // 순서가 실제로 섞인다
  });

  it("입력 상태를 바꾸지 않는다 (깊은 동결)", () => {
    const state = deepFreeze(withCandidateVotes(candidateVoteOf(6, 6), [[0, 1], [1, 2], [2, 1]]));
    expect(() => tallyCandidateVote(state, seededRandInt(6))).not.toThrow();
  });

  it("4~8명 × 시드 3개: votes 길이 = 던진 사람 수, candidate 는 votes 로 센 최다 득표자와 같다", () => {
    for (let n = 4; n <= 8; n += 1) {
      for (const seed of [1, 2, 3]) {
        const rand = seededRandInt(seed * 100 + n);
        const picks: Array<[number, number]> = [];
        for (let seat = 0; seat < n; seat += 1) {
          if (rand(4) === 0) continue; // 일부는 못 던진다
          const others = Array.from({ length: n }, (_, i) => i).filter((i) => i !== seat);
          picks.push([seat, others[rand(others.length)]!]);
        }
        const state = withCandidateVotes(candidateVoteOf(n, seed), picks);
        const result = tallyCandidateVote(state, seededRandInt(seed));
        expect(result.votes.length).toBe(picks.length);

        const counts = new Map<number, number>();
        for (const v of result.votes) counts.set(v.target, (counts.get(v.target) ?? 0) + 1);
        const top = Math.max(0, ...counts.values());
        const leaders = [...counts].filter(([, c]) => c === top && top > 0).map(([t]) => t);
        const expected = leaders.length === 1 ? String(leaders[0]) : "none";
        expect(`${n}/${seed}: ${result.candidate === undefined ? "none" : result.candidate}`).toBe(`${n}/${seed}: ${expected}`);
      }
    }
  });
});

// ---- 261029-vvd: 후보 선택 취소 (결정 0040) ----

/** 실제 castCandidateVote 로 표를 넣는다(거부되면 준비가 틀린 것). */
function castPicks(state: RoomState, picks: Array<[number, number]>): RoomState {
  let current = state;
  for (const [seat, target] of picks) {
    const r = castCandidateVote(current, idOf(current, seat), target);
    if (!r.ok) throw new Error(`rejected ${seat}->${target}: ${r.error}`);
    current = r.state;
  }
  return current;
}

/** 취소(target null)를 한 번 보낸다. 거부되면 준비가 틀린 것. */
function cancelPick(state: RoomState, seat: number): RoomState {
  const r = castCandidateVote(state, idOf(state, seat), null);
  if (!r.ok) throw new Error(`cancel rejected ${seat}: ${r.error}`);
  return r.state;
}

describe("castCandidateVote 취소 (결정 0040)", () => {
  it("고른 뒤 null 이면 그 사람의 candidateVote 키만 사라지고 나머지는 그대로이며 결과가 고르기 전 상태와 같다 (깊게 얼려도 예외 없음)", () => {
    const before = candidateVoteOf(5, 1);
    const picked = deepFreeze(castPicks(before, [[0, 2]]));
    const r = castCandidateVote(picked, idOf(picked, 0), null);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.state).not.toBe(picked);
    const mine = r.state.players.find((p) => p.seat === 0)!;
    expect(Object.hasOwn(mine, "candidateVote")).toBe(false);
    expect(r.state.phaseEndsAt).toBe(picked.phaseEndsAt);
    expect(r.state.phase).toBe("candidateVote");
    expect(JSON.stringify(r.state)).toBe(JSON.stringify(before));
    expect(r.state).toEqual(before);
  });

  it("고른 표 없는 null 은 입력 상태 그대로(toBe)다", () => {
    const state = candidateVoteOf(5, 2);
    const r = castCandidateVote(state, idOf(state, 3), null);
    expect(r.ok && r.state === state).toBe(true);
  });

  it("고르기 → 취소 → 다시 고르기 → 취소를 반복해도 마지막 상태만 남고 마감은 그대로다", () => {
    const start = candidateVoteOf(6, 3);
    let state = start;
    for (const target of [2, 3, 4]) {
      state = castPicks(state, [[0, target]]);
      expect(state.players.find((p) => p.seat === 0)?.candidateVote).toBe(target);
      state = cancelPick(state, 0);
      expect(Object.hasOwn(state.players.find((p) => p.seat === 0)!, "candidateVote")).toBe(false);
    }
    expect(JSON.stringify(state)).toBe(JSON.stringify(start));
    state = castPicks(state, [[0, 5]]);
    expect(state.players.find((p) => p.seat === 0)?.candidateVote).toBe(5);
    expect(state.phaseEndsAt).toBe(start.phaseEndsAt);
  });

  it("candidateVote 가 아닌 단계(탈락자 포함)의 null 은 WRONG_PHASE 다", () => {
    const discussion = withDead(stateAt(5, 1, "discussion"), [4]);
    const exec = withDead(execVoteOf(5, 1), [4]);
    const reveal = withDead(stateWithVerdict(5, 1, "candidateVoteReveal"), [4]);
    const out = [discussion, exec, reveal].flatMap((s) =>
      [0, 4].map((seat) => {
        const r = castCandidateVote(s, idOf(s, seat), null);
        return r.ok ? "ok" : r.error;
      }),
    );
    expect(out.join(" ")).toBe(Array(6).fill("WRONG_PHASE").join(" "));
  });

  it("방에 없는 행위자·탈락한 행위자의 null 은 BAD_MESSAGE 다", () => {
    const state = withDead(candidateVoteOf(5, 2), [4]);
    const ghost = castCandidateVote(state, "player-id-zzzz-none", null);
    const dead = castCandidateVote(state, idOf(state, 4), null);
    expect(`${ghost.ok ? "ok" : ghost.error} ${dead.ok ? "ok" : dead.error}`).toBe("BAD_MESSAGE BAD_MESSAGE");
  });

  it("자기 자신 고르기는 여전히 BAD_MESSAGE 다 (취소 도입 뒤에도)", () => {
    const state = castPicks(candidateVoteOf(5, 4), [[0, 2]]);
    const r = castCandidateVote(state, idOf(state, 0), 0);
    expect(r.ok ? "ok" : r.error).toBe("BAD_MESSAGE");
    expect(state.players.find((p) => p.seat === 0)?.candidateVote).toBe(2);
  });

  it("뷰 익명: 4~8명 × 시드 1~3 에서 안 고름·A→B·A 취소 세 상태의 A 외 모든 viewer view 가 같고, A 는 고른 상태에만 voteTarget 이 있으며 취소 뒤 A view 는 안 고름과 같다", () => {
    for (let n = 4; n <= 8; n += 1) {
      for (const seed of [1, 2, 3]) {
        const s0 = withDead(candidateVoteOf(n, seed), n >= 6 ? [n - 1] : []);
        const s1 = castPicks(s0, [[0, 1]]);
        const s2 = cancelPick(s1, 0);
        const viewOfSeat = (state: RoomState, seat: number): string => JSON.stringify(buildView(state, idOf(state, seat), 99));
        for (const p of s0.players) {
          if (p.seat === 0) continue;
          expect(`${n}/${seed}/${p.seat} ${viewOfSeat(s1, p.seat) === viewOfSeat(s0, p.seat)}`).toBe(`${n}/${seed}/${p.seat} true`);
          expect(`${n}/${seed}/${p.seat} ${viewOfSeat(s2, p.seat) === viewOfSeat(s0, p.seat)}`).toBe(`${n}/${seed}/${p.seat} true`);
        }
        const mine = (state: RoomState): RoomView => buildView(state, idOf(state, 0), 99);
        expect(`${n}/${seed} ${String(mine(s0).me.voteTarget)} ${String(mine(s1).me.voteTarget)} ${String(mine(s2).me.voteTarget)}`).toBe(`${n}/${seed} undefined 1 undefined`);
        expect(Object.hasOwn(mine(s2).me, "voteTarget")).toBe(false);
        expect(viewOfSeat(s2, 0)).toBe(viewOfSeat(s0, 0));
      }
    }
  });

  it("결과: X→T·Y→T·A→U 뒤 A 가 취소하고 마감하면 공개 표 2개·A 줄 없음·후보 T·공개 길이 candidateRevealMs(2)", () => {
    const base = candidateVoteOf(5, 1);
    const [a, x, y] = [0, 1, 2];
    const t = 3;
    const u = 4;
    const state = cancelPick(castPicks(base, [[x, t], [y, t], [a, u]]), a);
    const deadline = state.phaseEndsAt!;
    const reveal = tick(state, deadline, seededRandInt(7));
    const cand = reveal.voteLog!.at(-1)!.cand!;
    expect(reveal.phase).toBe("candidateVoteReveal");
    expect(cand.votes.length).toBe(2);
    expect(cand.votes.some((v) => v.seat === a)).toBe(false);
    expect(cand.candidate).toBe(t);
    expect(reveal.phaseEndsAt).toBe(deadline + candidateRevealMs(2));
  });

  it("결과: A 만 던졌다 취소하면 votes []·후보 없음·공개 길이 candidateRevealMs(0), 그 마감 뒤 night 의 view 는 day.noExecution noVotes 다", () => {
    const state = cancelPick(castPicks(candidateVoteOf(5, 2), [[0, 2]]), 0);
    const deadline = state.phaseEndsAt!;
    const reveal = tick(state, deadline, seededRandInt(8));
    const cand = reveal.voteLog!.at(-1)!.cand!;
    expect(JSON.stringify(cand.votes)).toBe("[]");
    expect(Object.hasOwn(cand, "candidate")).toBe(false);
    expect(reveal.phaseEndsAt).toBe(deadline + candidateRevealMs(0));
    const night = tick(reveal, reveal.phaseEndsAt!, seededRandInt(9));
    expect(night.phase).toBe("night");
    const view = buildView(night, idOf(night, 0), 99);
    expect(JSON.stringify(view.day?.noExecution)).toBe(JSON.stringify({ reason: "noVotes" }));
  });

  it("결과: 취소 뒤 다시 고른 표는 새 값으로 센다", () => {
    const state = castPicks(cancelPick(castPicks(candidateVoteOf(5, 3), [[0, 2], [1, 2]]), 0), [[0, 4]]);
    const reveal = tick(state, state.phaseEndsAt!, seededRandInt(10));
    const votes = [...reveal.voteLog!.at(-1)!.cand!.votes].sort((p, q) => p.seat - q.seat);
    expect(JSON.stringify(votes)).toBe(JSON.stringify([{ seat: 0, target: 4 }, { seat: 1, target: 2 }]));
  });
});
