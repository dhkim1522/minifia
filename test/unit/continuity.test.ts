import { describe, expect, it } from "vitest";
import {
  HOST_GRACE_MS,
  HOST_GRACE_TEST_MS,
  LOBBY_PRUNE_MS,
  LOBBY_PRUNE_TEST_MS,
  nextContinuityAt,
  pruneBench,
  pruneLobby,
  resolveHost,
} from "../../shared/game/continuity";
import { ROOM_TTL_MS } from "../../shared/game/room";
import type { Player, RoomState } from "../../shared/game/room";
import type { PhaseId } from "../../shared/protocol";

function player(i: number, over: Partial<Player> = {}): Player {
  return {
    id: `p${i}`,
    token: `token-p${i}-0123456789`,
    seat: i,
    nickname: `이름${i}`,
    nicknameKey: `이름${i}`,
    joinSeq: i,
    connected: true,
    connId: `c${i}`,
    ...over,
  };
}

/** 방장 p0 이 T0 에 끊긴 4인 방. */
const T0 = 1_000_000;
function room(players: Player[], over: Partial<RoomState> = {}, phase: PhaseId = "lobby"): RoomState {
  return {
    code: "0420",
    createdAt: 0,
    expiresAt: ROOM_TTL_MS,
    phase,
    phaseEndsAt: null,
    hostId: "p0",
    nextJoinSeq: players.length,
    players,
    ...over,
  };
}
const hostDown = (over: Partial<Player> = {}): Player => player(0, { connected: false, connId: null, disconnectedAt: T0, ...over });

describe("resolveHost (방장 이양, D-17, CONNX-01)", () => {
  it("상수: 45초, 테스트 방 3초", () => {
    expect(HOST_GRACE_MS).toBe(45_000);
    expect(HOST_GRACE_TEST_MS).toBe(3_000);
  });

  it("방장이 연결돼 있으면 같은 객체", () => {
    const s = room([player(0), player(1), player(2)]);
    expect(resolveHost(s, T0 + 999_999)).toBe(s);
  });

  it("끊겼어도 유예 미만이면 같은 객체", () => {
    const s = room([hostDown(), player(1), player(2)]);
    expect(resolveHost(s, T0 + HOST_GRACE_MS - 1)).toBe(s);
  });

  it("유예 이상이면 연결된 사람 중 joinSeq 가 가장 작은 사람이 방장이 된다 (입력 불변)", () => {
    const players = [hostDown(), player(3), player(1, { joinSeq: 7 }), player(2, { joinSeq: 5 })];
    const s = room(players);
    const out = resolveHost(s, T0 + HOST_GRACE_MS);
    expect(out.hostId).toBe("p3"); // joinSeq 3 < 5 < 7
    expect(s.hostId).toBe("p0");
    expect(out.players).toBe(s.players);
  });

  it("끊긴 사람은 후보가 아니다 — 연결된 사람 가운데에서만 고른다", () => {
    const s = room([hostDown(), player(1, { connected: false, connId: null, disconnectedAt: T0 }), player(2)]);
    expect(resolveHost(s, T0 + HOST_GRACE_MS).hostId).toBe("p2");
  });

  it("봇과 left 는 후보가 아니다", () => {
    const s = room([hostDown(), player(1, { isBot: true }), player(2, { left: true }), player(3)]);
    expect(resolveHost(s, T0 + HOST_GRACE_MS).hostId).toBe("p3");
  });

  it("후보가 없으면 방장은 그대로고 같은 객체", () => {
    const s = room([hostDown(), player(1, { isBot: true }), player(2, { connected: false, connId: null })]);
    expect(resolveHost(s, T0 + 10 * HOST_GRACE_MS)).toBe(s);
  });

  it("disconnectedAt 이 없는 끊긴 방장은 건드리지 않는다", () => {
    const s = room([hostDown({ disconnectedAt: undefined }), player(1)]);
    expect(resolveHost(s, T0 + 10 * HOST_GRACE_MS)).toBe(s);
  });

  it("테스트 방은 3초에 넘어간다", () => {
    const s = room([hostDown(), player(1)], { testMode: true });
    expect(resolveHost(s, T0 + HOST_GRACE_TEST_MS - 1)).toBe(s);
    expect(resolveHost(s, T0 + HOST_GRACE_TEST_MS).hostId).toBe("p1");
  });

  it("멱등: 이양된 결과에 다시 불러도 같은 객체", () => {
    const s = room([hostDown(), player(1), player(2)]);
    const once = resolveHost(s, T0 + HOST_GRACE_MS);
    expect(resolveHost(once, T0 + HOST_GRACE_MS)).toBe(once);
  });

  it("옛 방장이 돌아와도(연결됨) 방장은 되돌려지지 않는다", () => {
    const s = room([hostDown(), player(1)]);
    const moved = resolveHost(s, T0 + HOST_GRACE_MS);
    const back = { ...moved, players: moved.players.map((p) => (p.id === "p0" ? player(0) : p)) };
    expect(resolveHost(back, T0 + 2 * HOST_GRACE_MS)).toBe(back);
    expect(back.hostId).toBe("p1");
  });

  it("어떤 단계에서도 일어난다 (게임 중·결과)", () => {
    for (const phase of ["discussion", "night", "ended"] as const) {
      const s = room([hostDown(), player(1)], {}, phase);
      expect(resolveHost(s, T0 + HOST_GRACE_MS).hostId).toBe("p1");
    }
  });
});

describe("nextContinuityAt", () => {
  it("방장이 연결돼 있으면 Infinity", () => {
    expect(nextContinuityAt(room([player(0), player(1)]))).toBe(Number.POSITIVE_INFINITY);
  });

  it("끊긴 방장 + 후보가 있으면 disconnectedAt + 유예", () => {
    expect(nextContinuityAt(room([hostDown(), player(1)]))).toBe(T0 + HOST_GRACE_MS);
    expect(nextContinuityAt(room([hostDown(), player(1)], { testMode: true }))).toBe(T0 + HOST_GRACE_TEST_MS);
  });

  it("후보가 없으면 알람을 걸지 않는다 (과거 시각으로 알람이 돌지 않게)", () => {
    expect(nextContinuityAt(room([hostDown(), player(1, { connected: false, connId: null })]))).toBe(Number.POSITIVE_INFINITY);
  });
});

const gone = (i: number, at: number, over: Partial<Player> = {}): Player =>
  player(i, { connected: false, connId: null, disconnectedAt: at, ...over });

describe("pruneLobby (대기실 정리, D-18, CONNX-02)", () => {
  it("상수: 3분, 테스트 방 6초", () => {
    expect(LOBBY_PRUNE_MS).toBe(180_000);
    expect(LOBBY_PRUNE_TEST_MS).toBe(6_000);
  });

  it("끊긴 지 정리 시간 이상 지난 사람만 뺀다 — 연결됨·유예 미만·disconnectedAt 없음은 남는다", () => {
    const s = room([
      player(0),
      gone(1, T0), // 지워진다
      gone(2, T0 + 1), // 1ms 모자란다
      player(3),
      gone(4, T0, { disconnectedAt: undefined }), // 기록 없음
    ]);
    const out = pruneLobby(s, T0 + LOBBY_PRUNE_MS);
    expect(out.removedIds).toEqual(["p1"]);
    expect(out.state.players.map((p) => p.id)).toEqual(["p0", "p2", "p3", "p4"]);
    expect(s.players).toHaveLength(5); // 입력 불변
  });

  it("방장과 봇은 지우지 않는다", () => {
    const s = room([gone(0, T0), gone(1, T0, { isBot: true }), player(2)]);
    const out = pruneLobby(s, T0 + 10 * LOBBY_PRUNE_MS);
    expect(out.state).toBe(s);
    expect(out.removedIds).toEqual([]);
  });

  it("대기실이 아니면 절대 지우지 않는다 (게임 중·결과 단계) — 같은 객체", () => {
    for (const phase of ["assigning", "discussion", "night", "ended"] as const) {
      const s = room([player(0), gone(1, T0)], {}, phase);
      const out = pruneLobby(s, T0 + 10 * LOBBY_PRUNE_MS);
      expect(out.state).toBe(s);
      expect(out.removedIds).toEqual([]);
    }
  });

  it("지울 사람이 없으면 같은 객체", () => {
    const s = room([player(0), gone(1, T0)]);
    expect(pruneLobby(s, T0 + 1).state).toBe(s);
  });

  it("테스트 방은 6초", () => {
    const s = room([player(0), gone(1, T0)], { testMode: true });
    expect(pruneLobby(s, T0 + LOBBY_PRUNE_TEST_MS - 1).removedIds).toEqual([]);
    expect(pruneLobby(s, T0 + LOBBY_PRUNE_TEST_MS).removedIds).toEqual(["p1"]);
  });

  it("옛 방장: 이양된 뒤 계속 끊겨 있으면 같은 규칙으로 지워지고, 방에는 연결된 새 방장이 남는다", () => {
    const s = room([gone(0, T0), player(1)]);
    const now = T0 + LOBBY_PRUNE_MS;
    const moved = resolveHost(s, now);
    const out = pruneLobby(moved, now);
    expect(out.removedIds).toEqual(["p0"]);
    expect(out.state.hostId).toBe("p1");
    expect(out.state.players.map((p) => p.id)).toEqual(["p1"]);
  });

  it("멱등: 정리된 결과에 다시 불러도 같은 객체", () => {
    const once = pruneLobby(room([player(0), gone(1, T0)]), T0 + LOBBY_PRUNE_MS).state;
    expect(pruneLobby(once, T0 + LOBBY_PRUNE_MS).state).toBe(once);
  });
});

describe("nextContinuityAt — 정리 마감 합류", () => {
  it("대기실의 끊긴 사람(방장 제외) 가운데 가장 이른 disconnectedAt + 정리 시간", () => {
    const s = room([player(0), gone(1, T0 + 500), gone(2, T0)]);
    expect(nextContinuityAt(s)).toBe(T0 + LOBBY_PRUNE_MS);
    expect(nextContinuityAt({ ...s, testMode: true })).toBe(T0 + LOBBY_PRUNE_TEST_MS);
  });

  it("방장 이양 마감이 더 이르면 그것이다", () => {
    const s = room([gone(0, T0), player(1), gone(2, T0 - 1)]);
    expect(nextContinuityAt(s)).toBe(T0 + HOST_GRACE_MS);
  });

  it("대기실이 아니면 정리 마감이 없다", () => {
    expect(nextContinuityAt(room([player(0), gone(1, T0)], {}, "discussion"))).toBe(Number.POSITIVE_INFINITY);
  });

  it("봇과 기록 없는 사람은 마감을 만들지 않는다", () => {
    const s = room([player(0), gone(1, T0, { isBot: true }), gone(2, T0, { disconnectedAt: undefined })]);
    expect(nextContinuityAt(s)).toBe(Number.POSITIVE_INFINITY);
  });
});

describe("pruneBench (쉬는 사람 정리, D-13·D-18, 11-08)", () => {
  const sitter = (i: number, over: Partial<Player> = {}): Player => player(i, over);
  const withBench = (bench: Player[], over: Partial<RoomState> = {}, phase: PhaseId = "discussion"): RoomState =>
    ({ ...room([player(0), player(1), player(2), player(3)], over, phase), bench }) as RoomState;

  it("끊긴 지 정리 시간(180초) 이상이면 bench 에서 빠지고 removedIds 에 담긴다 — 경계 179_999 / 180_000", () => {
    const s = withBench([sitter(4, { connected: false, connId: null, disconnectedAt: T0 }), sitter(5, { connected: false, connId: null, disconnectedAt: T0 + 1 })]);
    const early = pruneBench(s, T0 + LOBBY_PRUNE_MS - 1);
    expect(early.state).toBe(s);
    expect(early.removedIds).toEqual([]);
    const at = pruneBench(s, T0 + LOBBY_PRUNE_MS);
    expect(at.removedIds).toEqual(["p4"]);
    expect(at.state.bench!.map((p) => p.id)).toEqual(["p5"]);
    expect(s.bench!.length).toBe(2);
    const later = pruneBench(at.state, T0 + LOBBY_PRUNE_MS + 1);
    expect(later.removedIds).toEqual(["p5"]);
    expect(Object.hasOwn(later.state, "bench")).toBe(false);
  });

  it("테스트 방은 6초", () => {
    const s = withBench([sitter(4, { connected: false, connId: null, disconnectedAt: T0 })], { testMode: true });
    expect(pruneBench(s, T0 + LOBBY_PRUNE_TEST_MS - 1).removedIds).toEqual([]);
    expect(pruneBench(s, T0 + LOBBY_PRUNE_TEST_MS).removedIds).toEqual(["p4"]);
  });

  it("연결된 쉬는 사람과 끊긴 시각이 없는 사람은 지우지 않는다. bench 가 없으면 같은 객체", () => {
    const s = withBench([sitter(4), sitter(5, { connected: false, connId: null })]);
    expect(pruneBench(s, T0 + 100 * LOBBY_PRUNE_MS).state).toBe(s);
    const noBench = room([player(0), player(1)]);
    expect(pruneBench(noBench, T0).state).toBe(noBench);
  });

  it("어떤 단계에서도 일한다(게임 중)", () => {
    for (const phase of ["assigning", "night", "morning"] as const) {
      const s = withBench([sitter(4, { connected: false, connId: null, disconnectedAt: T0 })], {}, phase);
      expect(pruneBench(s, T0 + LOBBY_PRUNE_MS).removedIds).toEqual(["p4"]);
    }
  });

  it("결과 단계 players 의 끊긴 사람은 pruneLobby·pruneBench 어느 쪽도 지우지 않는다 (다시 하기가 한 번에 정리)", () => {
    const s = room([player(0), player(1), gone(2, T0), player(3)], {}, "ended");
    expect(pruneLobby(s, T0 + 10 * LOBBY_PRUNE_MS).state).toBe(s);
    expect(pruneBench(s, T0 + 10 * LOBBY_PRUNE_MS).state).toBe(s);
  });

  it("nextContinuityAt 가 bench 정리 마감을 합친다", () => {
    const s = withBench([sitter(4, { connected: false, connId: null, disconnectedAt: T0 + 5 })]);
    expect(nextContinuityAt(s)).toBe(T0 + 5 + LOBBY_PRUNE_MS);
    expect(nextContinuityAt({ ...s, testMode: true })).toBe(T0 + 5 + LOBBY_PRUNE_TEST_MS);
    expect(nextContinuityAt(withBench([sitter(4)]))).toBe(Number.POSITIVE_INFINITY);
  });
});
