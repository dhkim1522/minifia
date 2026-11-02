import { describe, expect, it } from "vitest";
import * as discussionModule from "../../shared/game/discussion";
import { endCountOf, endReached, enterDiscussion, phaseDurationOf, toggleEnd } from "../../shared/game/discussion";
import * as phasesModule from "../../shared/game/phases";
import { DISCUSSION_MS } from "../../shared/game/phases";
import { ROOM_TTL_MS } from "../../shared/game/room";
import type { Player, RoomState } from "../../shared/game/room";
import type { PhaseId } from "../../shared/protocol";

function player(i: number): Player {
  return {
    id: `p${i}`,
    token: `token-p${i}-0123456789`,
    seat: i,
    nickname: `이름${i}`,
    nicknameKey: `이름${i}`,
    joinSeq: i,
    connected: true,
    connId: `c${i}`,
  };
}

/** 5명 방, 방장은 p0. */
function room(phase: PhaseId, phaseEndsAt: number | null, extra: Record<string, unknown> = {}): RoomState {
  return {
    code: "0420",
    createdAt: 0,
    expiresAt: ROOM_TTL_MS,
    phase,
    phaseEndsAt,
    day: 1,
    hostId: "p0",
    nextJoinSeq: 5,
    players: [0, 1, 2, 3, 4].map(player),
    ...extra,
  } as RoomState;
}

// 결과는 한 줄 문자열로 비교한다(TAP 증거 규칙).
describe("phaseDurationOf - 단계 길이 파생 (결정 0017-5, Pitfall 3)", () => {
  it("phaseDurationOf 는 단계 표 길이 그대로다: discussion 90000, dayAnnounce 2000, lobby null", () => {
    const got = (["discussion", "dayAnnounce", "lobby"] as const)
      .map((phase) => `${phase}:${phaseDurationOf(room(phase, phase === "lobby" ? null : 100_000))}`)
      .join(" ");
    expect(got).toBe("discussion:90000 dayAnnounce:2000 lobby:null");
  });

  it("저장된 옛 상태에 연장 표시(extendUsed true)가 남아 있어도 discussion 길이는 DISCUSSION_MS(90000) 이다", () => {
    expect(phaseDurationOf(room("discussion", 100_000, { extendUsed: true }))).toBe(DISCUSSION_MS);
  });

  it("discussion 모듈이 내보내는 것은 단계 길이 파생과 토론 끝내기 네 함수뿐이다 (연장 함수는 없다, 8페이즈 결정 0060)", () => {
    expect(Object.keys(discussionModule).sort().join(",")).toBe("endCountOf,endReached,enterDiscussion,phaseDurationOf,toggleEnd");
  });

  it("phases 모듈에 연장 길이 상수가 없다", () => {
    expect(Object.keys(phasesModule).filter((k) => k.startsWith("EXTEND")).join(",")).toBe("");
  });
});

// ---- 8페이즈 토론 끝내기(DAY-03, 결정 0060-2, RESEARCH Pitfall 1) ----
const errOf = (r: { ok: boolean; error?: string }): string => (r.ok ? "ok" : (r.error ?? "?"));
const withEnd = (state: RoomState, seats: number[]): RoomState => ({
  ...state,
  players: state.players.map((p) => (seats.includes(p.seat) ? { ...p, endVote: true as const } : p)),
});
const withDeadSeats = (state: RoomState, seats: number[]): RoomState => ({
  ...state,
  players: state.players.map((p) => (seats.includes(p.seat) ? { ...p, alive: false } : p)),
});

describe("토론 끝내기(DAY-03)", () => {
  it("산 사람이 누르면 그 사람의 endVote 만 true 가 된 새 상태이고, 같은 값은 입력 객체 그대로다", () => {
    const base = room("discussion", 100_000);
    const r = toggleEnd(base, "p1", true);
    if (!r.ok) throw new Error("rejected");
    const changed = r.state.players.filter((p, i) => p !== base.players[i]).map((p) => `${p.seat}:${String(p.endVote)}`);
    expect(changed.join(",")).toBe("1:true");
    const again = toggleEnd(r.state, "p1", true);
    expect(again.ok && again.state === r.state).toBe(true);
  });

  it("취소(on false)는 endVote 키를 지우고, 키가 없는데 false 면 입력 객체 그대로다", () => {
    const pressed = withEnd(room("discussion", 100_000), [1]);
    const r = toggleEnd(pressed, "p1", false);
    if (!r.ok) throw new Error("rejected");
    expect(r.state.players.some((p) => "endVote" in p)).toBe(false);
    const idle = room("discussion", 100_000);
    const noop = toggleEnd(idle, "p2", false);
    expect(noop.ok && noop.state === idle).toBe(true);
  });

  it("죽은 사람과 방에 없는 사람은 BAD_MESSAGE, 불리언이 아닌 값도 BAD_MESSAGE 다", () => {
    const base = withDeadSeats(room("discussion", 100_000), [4]);
    const results = [toggleEnd(base, "p4", true), toggleEnd(base, "nobody", true), toggleEnd(base, "p1", "yes" as unknown as boolean)];
    expect(results.map(errOf).join(" ")).toBe("BAD_MESSAGE BAD_MESSAGE BAD_MESSAGE");
  });

  it("discussion 이 아닌 단계는 행위자 검사보다 먼저 WRONG_PHASE 다", () => {
    const base = room("nomination", 100_000);
    expect(`${errOf(toggleEnd(base, "p1", true))} ${errOf(toggleEnd(base, "nobody", true))}`).toBe("WRONG_PHASE WRONG_PHASE");
  });

  it("endCountOf 는 산 사람의 endVote 만 센다 (죽은 사람의 남은 값은 세지 않는다)", () => {
    const base = withDeadSeats(withEnd(room("discussion", 100_000), [0, 1, 4]), [4]);
    expect(endCountOf(base)).toBe(2);
  });

  it("endReached: 산 4 · 누름 3 은 과반, 산 5 · 누름 2 는 아니다", () => {
    const four = withEnd(withDeadSeats(room("discussion", 100_000), [4]), [0, 1, 2]);
    const five = withEnd(room("discussion", 100_000), [0, 1]);
    expect(`${endReached(four)} ${endReached(five)}`).toBe("true false");
  });

  it("입력 상태를 바꾸지 않는다", () => {
    const base = withEnd(room("discussion", 100_000), [0, 1]);
    const before = JSON.stringify(base);
    toggleEnd(base, "p2", true);
    toggleEnd(base, "p1", false);
    endCountOf(base);
    endReached(base);
    enterDiscussion(base);
    expect(JSON.stringify(base)).toBe(before);
  });
});

describe("enterDiscussion — 낮 시작 청소 (결정 0060-2, Pitfall 1)", () => {
  const dirty = (): RoomState => {
    const base = room("dayAnnounce", 100_000, {
      verdict: { passed: true, candidate: 2 },
      execution: { seat: 2, phrase: 1 },
      voteLog: [{ n: 1, exec: { yes: 4, no: 1, passed: true }, cand: { votes: [{ seat: 0, target: 2 }], candidate: 2 } }],
      lastExecPhrase: 3,
    });
    return {
      ...base,
      players: base.players.map((p) => ({ ...p, nominate: 2, verdictVote: true, endVote: true as const, ...(p.seat === 4 ? { alive: false } : {}) })),
    };
  };

  it("verdict·execution 과 모든 플레이어의 nominate·verdictVote·endVote 를 키째 지운다", () => {
    const r = enterDiscussion(dirty());
    const stale = r.players.filter((p) => "nominate" in p || "verdictVote" in p || "endVote" in p).length;
    expect(`${"verdict" in r} ${"execution" in r} ${stale}`).toBe("false false 0");
  });

  it("voteLog 와 그 밖의 키·플레이어 값은 그대로 둔다", () => {
    const before = dirty();
    const r = enterDiscussion(before);
    expect(r.voteLog === before.voteLog).toBe(true);
    expect(`${r.lastExecPhrase} ${r.day} ${r.players.find((p) => p.seat === 4)?.alive} ${r.players.length}`).toBe("3 1 false 5");
  });
});
