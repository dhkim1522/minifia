import { describe, expect, it } from "vitest";
import { claimOptions, currentClaimSeat, selectClaim } from "../../shared/game/claim";
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
import type { Claim } from "../../shared/protocol";
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

/** 실제 전이(startGame, tick)로 1일차 claim 에 막 들어간 상태를 만든다. */
function claimState(n: number, seed = 1): RoomState {
  const lobby = lobbyOf(n);
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

  it("claim 뷰: 모든 viewer 가 같은 turn.seat·claimLog 를 받고 day 키는 정확히 claimLog,n,roles,turn 이다", () => {
    const s = claimState(5);
    const t = FIRST_TURN_ENDS_AT - 5000;
    const picked = selectClaim(s, s.hostId, "police", t);
    if (!picked.ok) throw new Error("selectClaim rejected");
    const turnOne = tick(picked.state, t);
    for (const state of [s, turnOne]) {
      const turnSeat = currentClaimSeat(state);
      for (const p of state.players) {
        const view = buildView(state, p.id, state.phaseEndsAt! - 1000);
        expect(Object.keys(view.day!).sort()).toEqual(["claimLog", "n", "roles", "turn"]);
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
    expect(Object.keys(view.day!).sort()).toEqual(["claimLog", "n", "roles"]);
    expect(view.day!.claimLog).toHaveLength(5);
  });

  it("claimOptions 는 이번 판 직업 뒤에 말 안 함이다", () => {
    expect(claimOptions(5)).toEqual(["mafia", "police", "doctor", "citizen", "none"] as Claim[]);
    expect(claimOptions(4)).toEqual(["mafia", "police", "citizen", "none"] as Claim[]);
  });
});
