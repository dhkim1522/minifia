import { describe, expect, it } from "vitest";
import { claimOptions, currentClaimSeat, enterClaim, resolveClaimTurn, selectClaim } from "../../shared/game/claim";
import {
  ASSIGNING_MS,
  CLAIM_TURN_MS,
  DAY_ANNOUNCE_MS,
  DISCUSSION_MS,
  ROLE_REVEAL_MS,
} from "../../shared/game/phases";
import { attachConnection, createRoomState, joinRoom, startGame } from "../../shared/game/room";
import type { RoomState } from "../../shared/game/room";
import { tick } from "../../shared/game/tick";
import { buildView } from "../../shared/game/view";
import type { Claim, PhaseId } from "../../shared/protocol";
import { seededRandInt } from "../helpers/seededRandom";

const START_AT = 10_000;
/** 시작부터 1일차 claim 첫 차례 마감까지 (assigning → roleReveal → dayAnnounce → 첫 차례). */
const FIRST_TURN_ENDS_AT = START_AT + ASSIGNING_MS + ROLE_REVEAL_MS + DAY_ANNOUNCE_MS + CLAIM_TURN_MS;

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

/** 실제 전이(startGame, tick)로 1일차 claim 에 막 들어간 상태를 만든다. prep 은 대기실을 시작 전에 고친다(방장 바꾸기 등). */
function claimState(n: number, seed = 1, prep: (lobby: RoomState) => RoomState = (l) => l): RoomState {
  const lobby = prep(lobbyOf(n));
  const started = startGame(lobby, lobby.hostId, START_AT, seededRandInt(seed));
  if (!started.ok) throw new Error(`startGame failed: ${started.error}`);
  let state = started.state;
  while (state.phase !== "claim") {
    if (state.phaseEndsAt === null) throw new Error("phase has no deadline");
    state = tick(state, state.phaseEndsAt);
  }
  return state;
}

const hostOfState = (s: RoomState) => s.players.find((p) => p.id === s.hostId)!;

describe("차례 한 바퀴 트레이서 (D-01·D-02·D-05)", () => {
  it("5명 claim 진입: 방장부터 오름차순 순서, 첫 차례 마감은 진입 마감 + 8000", () => {
    const s = claimState(5);
    expect(s.phase).toBe("claim");
    expect(s.claimOrder).toEqual([0, 1, 2, 3, 4]);
    expect(s.claimIdx).toBe(0);
    expect(s.claimStart).toBe(hostOfState(s).seat);
    expect(s.phaseEndsAt).toBe(FIRST_TURN_ENDS_AT);
    expect(s.claimLog ?? []).toEqual([]);
    expect(currentClaimSeat(s)).toBe(0);
  });

  it("방장이 selectClaim 하면 입력은 그대로이고 결과는 claimPick 과 마감 당기기뿐이다", () => {
    const s = claimState(5);
    const frozen = JSON.stringify(s);
    const t = FIRST_TURN_ENDS_AT - 5000;
    const r = selectClaim(s, s.hostId, "police", t);
    expect(r.ok).toBe(true);
    expect(JSON.stringify(s)).toBe(frozen);
    if (!r.ok) return;
    expect(r.state.claimPick).toBe("police");
    expect(r.state.phaseEndsAt).toBe(t);
    expect(r.state.phase).toBe("claim");
  });

  it("고른 뒤 tick 하면 claimLog 에 한 줄이 쌓이고 다음 차례로 넘어가며 claimPick 이 지워진다", () => {
    const s = claimState(5);
    const t = FIRST_TURN_ENDS_AT - 5000;
    const picked = selectClaim(s, s.hostId, "police", t);
    if (!picked.ok) throw new Error("selectClaim rejected");
    const after = tick(picked.state, t);
    expect(after.phase).toBe("claim");
    expect(after.claimIdx).toBe(1);
    expect(after.claimLog).toEqual([{ n: 1, seat: 0, claim: "police" }]);
    expect(Object.hasOwn(after, "claimPick")).toBe(false);
    expect(after.phaseEndsAt).toBe(t + CLAIM_TURN_MS);
  });

  it("아무도 안 고르면 차례마다 말 안 함이 쌓이고 마지막 차례 마감에서 낮 토론으로 간다", () => {
    let s = claimState(5);
    const ends: number[] = [];
    for (let i = 0; i < 4; i += 1) {
      const at = s.phaseEndsAt!;
      ends.push(at);
      s = tick(s, at);
      expect(s.phase).toBe("claim");
    }
    expect(s.claimLog).toEqual([0, 1, 2, 3].map((seat) => ({ n: 1, seat, claim: "none" })));
    const last = s.phaseEndsAt!;
    expect(last).toBe(FIRST_TURN_ENDS_AT + 4 * CLAIM_TURN_MS);
    s = tick(s, last);
    expect(s.phase).toBe("discussion");
    expect(s.phaseEndsAt).toBe(last + DISCUSSION_MS);
    expect(s.claimLog).toHaveLength(5);
    expect(s.claimLog!.at(-1)).toEqual({ n: 1, seat: 4, claim: "none" });
    expect(ends).toEqual([0, 1, 2, 3].map((i) => FIRST_TURN_ENDS_AT + i * CLAIM_TURN_MS));
  });

  it("알람이 늦어도 tick 한 번이 차례를 따라잡고 마감은 이전 마감 + 8000 으로 연쇄된다", () => {
    const s = claimState(5);
    const t = FIRST_TURN_ENDS_AT - 5000;
    const picked = selectClaim(s, s.hostId, "police", t);
    if (!picked.ok) throw new Error("selectClaim rejected");
    const lastTurnEnd = t + 4 * CLAIM_TURN_MS;
    const caught = tick(picked.state, lastTurnEnd + 60_000);
    expect(caught.phase).toBe("discussion");
    expect(caught.phaseEndsAt).toBe(lastTurnEnd + DISCUSSION_MS);
    expect(caught.claimLog).toHaveLength(5);
    expect(caught.claimLog![0]).toEqual({ n: 1, seat: 0, claim: "police" });
    // 한 번에 부른 결과는 마감마다 한 번씩 부른 결과와 같다 (모든 폰이 같은 마감).
    let stepped = picked.state;
    while (stepped.phase === "claim") stepped = tick(stepped, stepped.phaseEndsAt!);
    expect(JSON.stringify(caught)).toBe(JSON.stringify(stepped));
  });

  it("claim 뷰: 모든 viewer 가 같은 turn.seat·claimLog 를 받고 day 키는 정확히 claimLog,n,roles,turn,voteLog 이다", () => {
    const s = claimState(5);
    const t = FIRST_TURN_ENDS_AT - 5000;
    const picked = selectClaim(s, s.hostId, "police", t);
    if (!picked.ok) throw new Error("selectClaim rejected");
    const turnOne = tick(picked.state, t);
    for (const state of [s, turnOne]) {
      const turnSeat = currentClaimSeat(state);
      for (const p of state.players) {
        const view = buildView(state, p.id, state.phaseEndsAt! - 1000);
        expect(Object.keys(view.day!).sort()).toEqual(["claimLog", "n", "roles", "turn", "voteLog"]);
        expect(view.day!.turn).toEqual({ seat: turnSeat });
        expect(view.day!.claimLog).toEqual(state.claimLog ?? []);
        expect(Object.hasOwn(view.me, "claim")).toBe(false);
        expect(view.phaseDurationMs).toBe(CLAIM_TURN_MS);
        expect(view.phaseEndsAt).toBe(state.phaseEndsAt);
      }
    }
  });

  it("낮 토론 뷰: turn 키가 없고 claimLog 5줄이 실린다", () => {
    let s = claimState(5);
    while (s.phase === "claim") s = tick(s, s.phaseEndsAt!);
    expect(s.phase).toBe("discussion");
    const view = buildView(s, s.hostId, s.phaseEndsAt! - 1000);
    expect(Object.keys(view.day!).sort()).toEqual(["claimLog", "n", "roles", "voteLog"]);
    expect(view.day!.claimLog).toHaveLength(5);
  });

  it("claimOptions 는 이번 판 직업 뒤에 말 안 함이다", () => {
    expect(claimOptions(5)).toEqual(["mafia", "police", "doctor", "citizen", "none"] as Claim[]);
    expect(claimOptions(4)).toEqual(["mafia", "police", "citizen", "none"] as Claim[]);
  });
});

// ---- Task 2: 규칙 전 경로 ----

const idAt = (s: RoomState, seat: number): string => s.players.find((p) => p.seat === seat)!.id;
const markDead = (s: RoomState, ...seats: number[]): RoomState => ({
  ...s,
  players: s.players.map((p) => (seats.includes(p.seat) ? { ...p, alive: false } : p)),
});
/** 차례 상태를 지운 같은 방 — enterClaim 을 직접 시험할 때 쓴다. */
function withoutTurnState(s: RoomState): RoomState {
  const { claimOrder: _o, claimIdx: _i, claimStart: _st, claimPick: _p, claimLog: _l, ...rest } = s;
  return rest;
}

/** 지금 claim 단계의 모든 차례를 시간 초과로 보낸다(picks 가 있으면 그 seat 는 일찍 고른다). 끝나면 discussion 상태. */
function playOutClaim(start: RoomState, picks: Record<number, Claim> = {}): RoomState {
  let s = start;
  while (s.phase === "claim") {
    const seat = currentClaimSeat(s)!;
    const pick = picks[seat];
    if (pick !== undefined) {
      const r = selectClaim(s, idAt(s, seat), pick, s.phaseEndsAt! - 1000);
      if (!r.ok) throw new Error(`selectClaim rejected: ${r.error}`);
      s = tick(r.state, r.state.phaseEndsAt!);
    } else {
      s = tick(s, s.phaseEndsAt!);
    }
  }
  return s;
}

/** discussion 에서 밤·아침을 실제 전이로 지나 다음 낮 claim 에 들어간 상태. */
function nextClaimDay(discussion: RoomState): RoomState {
  const day = discussion.day!;
  let s = discussion;
  while (!(s.phase === "claim" && s.day === day + 1)) s = tick(s, s.phaseEndsAt!, seededRandInt(5));
  return s;
}

/** 실제 전이로 phase 에 닿은 상태. lobby 는 대기실 그대로. */
function stateAtPhase(n: number, phase: PhaseId): RoomState {
  const lobby = lobbyOf(n);
  if (phase === "lobby") return lobby;
  const started = startGame(lobby, lobby.hostId, START_AT, seededRandInt(3));
  if (!started.ok) throw new Error(`startGame failed: ${started.error}`);
  let s = started.state;
  while (s.phase !== phase) s = tick(s, s.phaseEndsAt!, seededRandInt(5));
  return s;
}

const frozenJson = (s: RoomState): string => JSON.stringify(s);

describe("시작 자리와 순서 (D-01·D-02)", () => {
  it("방장이 seat 2 인 방: 1일차 claimOrder 는 [2,3,4,0,1], claimStart 2", () => {
    const s = claimState(5, 1, (lobby) => ({ ...lobby, hostId: idAt(lobby, 2) }));
    expect(s.claimOrder).toEqual([2, 3, 4, 0, 1]);
    expect(s.claimStart).toBe(2);
    expect(currentClaimSeat(s)).toBe(2);
  });

  it("다음 낮마다 시작이 한 칸 이동하고 끝에서 처음으로 이어진다 (0 → 1 → 2 → 3 → 4 → 0)", () => {
    let s = claimState(5);
    const starts: number[] = [];
    const orders: number[][] = [];
    for (let day = 1; day <= 6; day += 1) {
      expect(s.day).toBe(day);
      starts.push(s.claimStart!);
      orders.push(s.claimOrder!);
      const discussion = playOutClaim(s);
      if (day < 6) s = nextClaimDay(discussion);
    }
    expect(starts).toEqual([0, 1, 2, 3, 4, 0]);
    expect(orders[1]).toEqual([1, 2, 3, 4, 0]);
    expect(orders[4]).toEqual([4, 0, 1, 2, 3]);
    expect(orders[5]).toEqual([0, 1, 2, 3, 4]);
  });

  it("탈락자는 순서에 없다 (1일차 seat 1 탈락 → [0,2,3,4])", () => {
    const s = enterClaim(markDead(withoutTurnState(claimState(5)), 1));
    expect(s.claimOrder).toEqual([0, 2, 3, 4]);
    expect(s.claimStart).toBe(0);
  });

  it("시작 후보가 탈락자면 다음 살아 있는 자리로 건너뛴다 (직전 시작 0, seat 1 탈락 → 2일차 시작 2)", () => {
    const base = { ...withoutTurnState(claimState(5)), claimStart: 0, day: 2 };
    const s = enterClaim(markDead(base, 1));
    expect(s.claimStart).toBe(2);
    expect(s.claimOrder).toEqual([2, 3, 4, 0]);
  });

  it("직전 시작이 마지막 생존 자리면 맨 앞 생존 자리로 돌아간다", () => {
    const base = { ...withoutTurnState(claimState(5)), claimStart: 4, day: 3 };
    expect(enterClaim(base).claimOrder).toEqual([0, 1, 2, 3, 4]);
    expect(enterClaim(markDead(base, 0)).claimStart).toBe(1);
  });

  it("방장이 탈락했으면 1일차도 첫 생존 자리에서 시작한다", () => {
    const s = enterClaim(markDead(withoutTurnState(claimState(5)), 0));
    expect(s.claimStart).toBe(1);
    expect(s.claimOrder).toEqual([1, 2, 3, 4]);
  });

  it("생존자가 한 명이면 순서 길이가 1이고 그 차례 하나 뒤 tick 이 discussion 으로 간다", () => {
    const base = enterClaim(markDead(withoutTurnState(claimState(5)), 0, 1, 2, 4));
    expect(base.claimOrder).toEqual([3]);
    const entered: RoomState = { ...base, phaseEndsAt: FIRST_TURN_ENDS_AT };
    const out = tick(entered, FIRST_TURN_ENDS_AT);
    expect(out.phase).toBe("discussion");
    expect(out.claimLog).toEqual([{ n: 1, seat: 3, claim: "none" }]);
    expect(out.phaseEndsAt).toBe(FIRST_TURN_ENDS_AT + DISCUSSION_MS);
  });

  it("생존자가 없으면 차례 키를 만들지 않고 resolveClaimTurn 은 줄 없이 머물지 않는다", () => {
    const s = enterClaim(markDead(withoutTurnState(claimState(5)), 0, 1, 2, 3, 4));
    expect(Object.hasOwn(s, "claimOrder")).toBe(false);
    expect(Object.hasOwn(s, "claimStart")).toBe(false);
    const r = resolveClaimTurn(s);
    expect(r.stay).toBe(false);
    expect(r.state.claimLog ?? []).toEqual([]);
  });

  it("enterClaim 은 직전 claimPick 이 남아 있어도 지운다", () => {
    const s = enterClaim({ ...claimState(5), claimPick: "police" });
    expect(Object.hasOwn(s, "claimPick")).toBe(false);
  });
});

describe("selectClaim 검사 순서 (D-03, T-03.1-02)", () => {
  const NON_CLAIM: PhaseId[] = ["lobby", "assigning", "roleReveal", "dayAnnounce", "discussion", "night", "morning"];

  it("claim 이 아닌 일곱 단계에서는 탈락자든 아니든 WRONG_PHASE 다", () => {
    for (const phase of NON_CLAIM) {
      const s = stateAtPhase(5, phase);
      const t = START_AT;
      for (const state of [s, markDead(s, 3)]) {
        const frozen = frozenJson(state);
        for (const seat of [0, 3]) {
          const r = selectClaim(state, idAt(state, seat), "none", t);
          expect(`${phase}/${seat}:${r.ok ? "ok" : r.error}`).toBe(`${phase}/${seat}:WRONG_PHASE`);
        }
        expect(frozenJson(state)).toBe(frozen);
      }
    }
  });

  it("방에 없는 actorId 는 BAD_MESSAGE, 탈락자는 BAD_MESSAGE (차례 검사보다 먼저)", () => {
    const s = markDead(claimState(5), 3);
    const frozen = frozenJson(s);
    const ghost = selectClaim(s, "ghost-id", "none", FIRST_TURN_ENDS_AT - 1000);
    expect(ghost.ok ? "ok" : ghost.error).toBe("BAD_MESSAGE");
    const dead = selectClaim(s, idAt(s, 3), "none", FIRST_TURN_ENDS_AT - 1000);
    expect(dead.ok ? "ok" : dead.error).toBe("BAD_MESSAGE");
    expect(frozenJson(s)).toBe(frozen);
  });

  it("차례가 아닌 살아 있는 사람은 WRONG_PHASE 다 (값이 틀려도 차례가 먼저)", () => {
    const s = claimState(5);
    const frozen = frozenJson(s);
    for (const seat of [1, 2, 3, 4]) {
      const r = selectClaim(s, idAt(s, seat), "police", FIRST_TURN_ENDS_AT - 1000);
      expect(`${seat}:${r.ok ? "ok" : r.error}`).toBe(`${seat}:WRONG_PHASE`);
    }
    const wrongValue = selectClaim(s, idAt(s, 2), "nope" as Claim, FIRST_TURN_ENDS_AT - 1000);
    expect(wrongValue.ok ? "ok" : wrongValue.error).toBe("WRONG_PHASE");
    expect(frozenJson(s)).toBe(frozen);
  });

  it("차례인 사람의 구성에 없는 값·문자열이 아닌 값·빈 문자열은 BAD_MESSAGE 다", () => {
    const s = claimState(4); // 4명판에는 doctor 가 없다
    const frozen = frozenJson(s);
    for (const bad of ["doctor", "", "constructor", 123, null, undefined, {}] as unknown[]) {
      const r = selectClaim(s, s.hostId, bad as Claim, FIRST_TURN_ENDS_AT - 1000);
      expect(`${String(bad)}:${r.ok ? "ok" : r.error}`).toBe(`${String(bad)}:BAD_MESSAGE`);
    }
    expect(frozenJson(s)).toBe(frozen);
  });

  it("같은 차례에 두 번째 selectClaim 은 WRONG_PHASE 다", () => {
    const s = claimState(5);
    const first = selectClaim(s, s.hostId, "police", FIRST_TURN_ENDS_AT - 1000);
    if (!first.ok) throw new Error("setup");
    const frozen = frozenJson(first.state);
    const second = selectClaim(first.state, s.hostId, "doctor", FIRST_TURN_ENDS_AT - 900);
    expect(second.ok ? "ok" : second.error).toBe("WRONG_PHASE");
    expect(frozenJson(first.state)).toBe(frozen);
  });

  it("차례를 넘긴 사람은 더 못 고르고 다음 사람은 고를 수 있다", () => {
    let s = claimState(5);
    const first = selectClaim(s, s.hostId, "police", FIRST_TURN_ENDS_AT - 1000);
    if (!first.ok) throw new Error("setup");
    s = tick(first.state, first.state.phaseEndsAt!);
    const again = selectClaim(s, idAt(s, 0), "police", s.phaseEndsAt! - 1000);
    expect(again.ok ? "ok" : again.error).toBe("WRONG_PHASE");
    const next = selectClaim(s, idAt(s, 1), "citizen", s.phaseEndsAt! - 1000);
    expect(next.ok).toBe(true);
  });

  it("말 안 함(none)은 구성에 없는 직업이 아니라 허용되고 tick 하면 기록에 none 으로 남는다", () => {
    const s = claimState(5);
    const r = selectClaim(s, s.hostId, "none", FIRST_TURN_ENDS_AT - 1000);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const after = tick(r.state, r.state.phaseEndsAt!);
    expect(after.claimLog).toEqual([{ n: 1, seat: 0, claim: "none" }]);
  });

  it("판정은 보낸 사람의 실제 역할과 무관하다 (경찰 아닌 사람도 police 를 주장할 수 있다)", () => {
    const s = claimState(5);
    const notPolice = s.players.find((p) => p.seat === 0)!.role !== "police";
    const r = selectClaim(s, s.hostId, "police", FIRST_TURN_ENDS_AT - 1000);
    expect(notPolice || r.ok).toBe(true);
    expect(r.ok).toBe(true);
  });
});

describe("시간 초과와 이월 없음 (D-02)", () => {
  it("끊긴 사람의 차례는 연결 여부를 보지 않고 마감에 말 안 함이 된다", () => {
    const s = claimState(5);
    const offline: RoomState = {
      ...s,
      players: s.players.map((p) => (p.seat === 0 ? { ...p, connected: false, connId: null } : p)),
    };
    const after = tick(offline, offline.phaseEndsAt!);
    expect(after.claimLog).toEqual([{ n: 1, seat: 0, claim: "none" }]);
  });

  it("1일차에 police 를 주장해도 2일차 같은 자리의 시간 초과는 none 이다 (어제 값이 새지 않는다)", () => {
    const day1 = playOutClaim(claimState(5), { 0: "police" });
    expect(day1.claimLog![0]).toEqual({ n: 1, seat: 0, claim: "police" });
    const day2 = playOutClaim(nextClaimDay(day1));
    const seatZero = day2.claimLog!.filter((e) => e.seat === 0);
    expect(seatZero).toEqual([
      { n: 1, seat: 0, claim: "police" },
      { n: 2, seat: 0, claim: "none" },
    ]);
  });

  it("일차가 바뀌어도 claimLog 는 쌓이고 같은 일차 안에서는 차례 순서다", () => {
    const day1 = playOutClaim(claimState(5), { 2: "citizen" });
    expect(day1.claimLog!.map((e) => `${e.n}:${e.seat}`)).toEqual(["1:0", "1:1", "1:2", "1:3", "1:4"]);
    const day2 = playOutClaim(nextClaimDay(day1));
    expect(day2.claimLog!.map((e) => `${e.n}:${e.seat}`)).toEqual([
      "1:0", "1:1", "1:2", "1:3", "1:4",
      "2:1", "2:2", "2:3", "2:4", "2:0",
    ]);
  });

  it("탈락자는 그날 기록 줄이 없다 (2일차부터)", () => {
    const day1 = playOutClaim(claimState(5));
    const dayTwo = nextClaimDay(markDead(day1, 3));
    const done = playOutClaim(dayTwo);
    expect(done.claimLog!.filter((e) => e.n === 2).map((e) => e.seat)).toEqual([1, 2, 4, 0]);
  });
});
