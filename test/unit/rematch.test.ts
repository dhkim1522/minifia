// 다시 하기 순수 규칙 (11-08, D-12·D-15, REMATCH-01, 누설 L39). 방장이 rematch 하면 허용 목록 리터럴로 새 판이 만들어지고 이전 판의 필드는 하나도 남지 않는다.
import { describe, expect, it } from "vitest";
import { assignRoles } from "../../shared/game/roles";
import { ROOM_TTL_MS, roundOf } from "../../shared/game/room";
import type { Player, RoomState } from "../../shared/game/room";
import { REMATCH_MAX_AGE_MS, isReady, rematch, setReady } from "../../shared/game/rematch";
import { ASSIGNING_MS } from "../../shared/game/phases";
import { seededRandInt } from "../helpers/seededRandom";

const T0 = 5_000_000;
const NOW = T0 + 60_000;

/** 이전 판의 비공개 필드를 전부 달고 있는 사람 행(역할·밤 선택·수사·유언·주장·통계·준비·앉음). */
function dirtyPlayer(i: number, over: Partial<Player> = {}): Player {
  return {
    id: `p${i}`,
    token: `token-p${i}-0123456789abc`,
    seat: i,
    nickname: `이름${i}`,
    nicknameKey: `이름${i}`,
    joinSeq: i,
    connected: true,
    connId: `c${i}`,
    role: i === 0 ? "mafia" : "citizen",
    alive: i % 2 === 0,
    nightPick: 1,
    investigations: [{ n: 1, target: 2, isMafia: false }],
    assassinations: [{ n: 1, target: 2, died: true }],
    treatments: [{ n: 1, target: 2 }],
    nominate: 2,
    verdictVote: true,
    runoffVote: 1,
    showdownPick: 2,
    endVote: true,
    will: "유언 CANARY",
    badge: "police",
    badgeSwapped: true,
    badgeLog: [{ n: 1, v: "police" }],
    stats: { say: 3, emote: 1 },
    disconnectedAt: undefined,
    ...over,
  };
}

/** 4명(방장 p0 + 손님 p1~p3)이 모두 준비한 끝난 판. 방과 사람에 이전 판의 모든 게임 필드가 달려 있다. */
function endedRoom(players: Player[], over: Record<string, unknown> = {}): RoomState {
  const base = {
    code: "0420",
    createdAt: T0,
    expiresAt: T0 + 30 * 60 * 1000,
    everConnected: true,
    phase: "ended",
    phaseEndsAt: null,
    day: 2,
    round: 1,
    morning: { deaths: [] },
    nightNote: "쪽지 CANARY",
    chalk: { x: 1, z: 2 },
    verdict: { passed: true, candidate: 1 },
    voteLog: [{ n: 1, exec: { yes: 3, no: 0, passed: true } }],
    execution: { seat: 1, phrase: 0 },
    nightLog: [{ n: 1, died: true }],
    winner: "citizenWin",
    whispers: [{ n: 1, from: 1, to: 2, text: "귓속말 CANARY", at: 1 }],
    botPlan: { key: "x", steps: [] },
    pickTurn: { order: [0], i: 0 },
    runoff: { cand: [0, 1], step: 0 },
    showdown: { order: [0, 1, 2], i: 0 },
    map: "bar",
    mapChoice: "random",
    hostId: "p0",
    nextJoinSeq: players.length,
    players,
    ...over,
  };
  return base as unknown as RoomState;
}

const ready = (i: number, over: Partial<Player> = {}): Player => dirtyPlayer(i, { ready: true, ...over });
const four = (): Player[] => [dirtyPlayer(0), ready(1), ready(2), ready(3)];
const keysOf = (value: object): string => Object.keys(value).sort().join(",");

describe("isReady (D-12)", () => {
  it("방장·봇은 늘 참, 손님은 ready 가 true 일 때만", () => {
    expect(isReady(dirtyPlayer(0), "p0")).toBe(true);
    expect(isReady(dirtyPlayer(5, { isBot: true }), "p0")).toBe(true);
    expect(isReady(ready(1), "p0")).toBe(true);
    expect(isReady(dirtyPlayer(1), "p0")).toBe(false);
  });
});

describe("setReady (D-12, REMATCH-01)", () => {
  const ended = endedRoom([dirtyPlayer(0), dirtyPlayer(1), ready(2), dirtyPlayer(3)]);

  it("손님 on → ready:true, 입력 불변", () => {
    const r = setReady(ended, "p1", true, 1);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.state.players.find((p) => p.id === "p1")?.ready).toBe(true);
    expect(ended.players.find((p) => p.id === "p1")?.ready).toBeUndefined();
  });

  it("같은 값은 입력 그대로, off 는 키째 지운다", () => {
    const same = setReady(ended, "p2", true, 1);
    expect(same.ok && same.state === ended).toBe(true);
    const sameOff = setReady(ended, "p1", false, 1);
    expect(sameOff.ok && sameOff.state === ended).toBe(true);
    const off = setReady(ended, "p2", false, 1);
    expect(off.ok).toBe(true);
    if (off.ok) expect(Object.hasOwn(off.state.players.find((p) => p.id === "p2")!, "ready")).toBe(false);
  });

  it("방장·봇·모르는 사람·나간 사람은 ok:false", () => {
    expect(setReady(ended, "p0", true, 1).ok).toBe(false);
    const withBot = endedRoom([dirtyPlayer(0), dirtyPlayer(1), dirtyPlayer(2, { isBot: true }), dirtyPlayer(3)]);
    expect(setReady(withBot, "p2", true, 1).ok).toBe(false);
    expect(setReady(ended, "nobody", true, 1).ok).toBe(false);
    const left = endedRoom([dirtyPlayer(0), dirtyPlayer(1, { left: true }), dirtyPlayer(2), dirtyPlayer(3)]);
    expect(setReady(left, "p1", true, 1).ok).toBe(false);
  });

  it("ended 가 아니면, round 가 다르면 ok:false", () => {
    expect(setReady({ ...ended, phase: "lobby" }, "p1", true, 1).ok).toBe(false);
    expect(setReady({ ...ended, phase: "night" }, "p1", true, 1).ok).toBe(false);
    expect(setReady(ended, "p1", true, 2).ok).toBe(false);
    expect(setReady(ended, "p1", true, 0).ok).toBe(false);
  });
});

describe("rematch 게이트 (D-12)", () => {
  const rand = seededRandInt(3);
  it("방장이 아니면·ended 가 아니면·round 가 다르면·참가자 3명이면 ok:false", () => {
    const s = endedRoom(four());
    expect(rematch(s, "p1", 1, NOW, rand).ok).toBe(false);
    expect(rematch({ ...s, phase: "lobby" }, "p0", 1, NOW, rand).ok).toBe(false);
    expect(rematch(s, "p0", 2, NOW, rand).ok).toBe(false);
    expect(rematch(endedRoom([dirtyPlayer(0), ready(1), ready(2)]), "p0", 1, NOW, rand).ok).toBe(false);
    // 네 명이어도 한 명이 준비하지 않았으면 참가자는 3명이다
    expect(rematch(endedRoom([dirtyPlayer(0), ready(1), ready(2), dirtyPlayer(3)]), "p0", 1, NOW, rand).ok).toBe(false);
    // 준비했어도 끊겼으면 참가자가 아니다
    expect(rematch(endedRoom([dirtyPlayer(0), ready(1), ready(2), ready(3, { connected: false, connId: null })]), "p0", 1, NOW, rand).ok).toBe(false);
  });

  it("round 가 없는 옛 방은 1 로 읽는다", () => {
    const { round: _r, ...rest } = endedRoom(four()) as unknown as Record<string, unknown>;
    const r = rematch(rest as unknown as RoomState, "p0", 1, NOW, rand);
    expect(r.ok).toBe(true);
    if (r.ok) expect(roundOf(r.state)).toBe(2);
  });
});

describe("rematch 허용 목록 리터럴 (D-15, 누설 L39)", () => {
  const ALLOWED_ROOM = "code,createdAt,everConnected,expiresAt,hostId,map,mapChoice,nextJoinSeq,phase,phaseEndsAt,players,round,testBotVote,testMode,testRole";
  const ALLOWED_PLAYER = "connId,connected,id,joinSeq,look,nickname,nicknameKey,seat,token";

  it("4명 모두 준비 → round+1 의 assigning, 모두 역할을 받고, 방과 사람 행의 키 집합이 허용 목록과 정확히 같다", () => {
    const players = four().map((p, i) => ({ ...p, look: (["coat", "mafia", "police", "doctor"] as const)[i] }));
    const s = endedRoom(players, { testMode: true, testRole: "police", testBotVote: { exec: "yes" }, mapChoice: "bar" });
    const r = rematch(s, "p0", 1, NOW, seededRandInt(9));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const next = r.state;
    expect(next.phase).toBe("assigning");
    expect(next.phaseEndsAt).toBe(NOW + ASSIGNING_MS);
    expect(roundOf(next)).toBe(2);
    expect(next.bench).toBeUndefined();
    expect(Object.hasOwn(next, "bench")).toBe(false);
    expect(next.players.every((p) => p.role !== undefined)).toBe(true);
    expect(keysOf(next)).toBe(ALLOWED_ROOM);
    for (const p of next.players) expect(keysOf(p)).toBe(`${ALLOWED_PLAYER},role`);
    // look·mapChoice·테스트 방 설정은 이어진다
    expect(next.players.map((p) => p.look)).toEqual(["coat", "mafia", "police", "doctor"]);
    expect(next.mapChoice).toBe("bar");
    expect(next.testMode).toBe(true);
    expect(next.testBotVote).toEqual({ exec: "yes" });
    expect(next.hostId).toBe("p0");
    expect(next.nextJoinSeq).toBe(4);
    expect(r.removedIds).toEqual([]);
  });

  it("이전 판의 게임 필드가 어느 이름으로도 남지 않는다", () => {
    const r = rematch(endedRoom(four()), "p0", 1, NOW, seededRandInt(9));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const text = JSON.stringify(r.state);
    for (const canary of ["CANARY", "citizenWin", "nightLog", "voteLog", "whispers", "badgeLog", "stats", "nightPick", "investigations", "assassinations", "treatments"]) {
      expect(text).not.toContain(canary);
    }
    for (const key of ["winner", "day", "morning", "nightNote", "chalk", "verdict", "voteLog", "execution", "nightLog", "whispers", "botPlan", "pickTurn", "runoff", "showdown"]) {
      expect(Object.hasOwn(r.state, key)).toBe(false);
    }
    for (const p of r.state.players) {
      for (const key of ["alive", "nightPick", "investigations", "assassinations", "treatments", "nominate", "verdictVote", "runoffVote", "showdownPick", "endVote", "will", "badge", "badgeSwapped", "badgeLog", "stats", "ready", "sat", "disconnectedAt", "left"]) {
        expect(Object.hasOwn(p, key)).toBe(false);
      }
    }
  });

  it("같은 시드는 같은 역할 배정(좌석 오름차순 id → assignRoles), 입력 상태는 바뀌지 않는다", () => {
    const s = endedRoom(four());
    const before = JSON.stringify(s);
    const a = rematch(s, "p0", 1, NOW, seededRandInt(5));
    const b = rematch(s, "p0", 1, NOW, seededRandInt(5));
    expect(JSON.stringify(s)).toBe(before);
    if (!a.ok || !b.ok) throw new Error("rematch failed");
    const rolesOf = (st: RoomState): string => st.players.map((p) => `${p.id}:${p.role}`).join(",");
    expect(rolesOf(a.state)).toBe(rolesOf(b.state));
    const expected = assignRoles(["p0", "p1", "p2", "p3"], seededRandInt(5));
    expect(rolesOf(a.state)).toBe(["p0", "p1", "p2", "p3"].map((id) => `${id}:${expected.get(id)}`).join(","));
  });

  it("만료는 min(방 생성 + 12시간, now + 3시간)", () => {
    expect(REMATCH_MAX_AGE_MS).toBe(12 * 60 * 60 * 1000);
    const early = rematch(endedRoom(four()), "p0", 1, NOW, seededRandInt(1));
    if (!early.ok) throw new Error("rematch failed");
    expect(early.state.expiresAt).toBe(NOW + ROOM_TTL_MS);
    const late = rematch(endedRoom(four(), { createdAt: NOW - REMATCH_MAX_AGE_MS + 1_000 }), "p0", 1, NOW, seededRandInt(1));
    if (!late.ok) throw new Error("rematch failed");
    expect(late.state.expiresAt).toBe(NOW + 1_000);
  });

  it("테스트 방 직업 지정은 방장에게 맞바꿔진다(startGame 과 같은 길)", () => {
    const s = endedRoom(four(), { testMode: true, testRole: "doctor" });
    const r = rematch(s, "p0", 1, NOW, seededRandInt(2));
    if (!r.ok) throw new Error("rematch failed");
    expect(r.state.players.find((p) => p.id === "p0")?.role).toBe("doctor");
  });

  it("봇은 늘 준비된 참가자이고 쉬는 사람이 되지 않는다", () => {
    const bot = dirtyPlayer(3, { isBot: true, token: "", connId: null });
    const r = rematch(endedRoom([dirtyPlayer(0), ready(1), ready(2), bot]), "p0", 1, NOW, seededRandInt(4));
    if (!r.ok) throw new Error("rematch failed");
    expect(r.state.players.map((p) => p.id)).toEqual(["p0", "p1", "p2", "p3"]);
    expect(r.state.players.find((p) => p.id === "p3")?.isBot).toBe(true);
    expect(r.state.bench).toBeUndefined();
  });
});
