import { describe, expect, it } from "vitest";
import {
  HOST_GRACE_MS,
  HOST_GRACE_TEST_MS,
  nextContinuityAt,
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
    expect(out.hostId).toBe("p2");
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
