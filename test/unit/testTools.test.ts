// 테스트 방 방장 도구 규칙(quick 261025-f09, 결정 0022): testSkip·testReset·testRole 의 순수 규칙을 확인한다.
// 실패 출력은 한 줄이어야 해서(TAP) 상태 비교는 키 순서를 맞춘 문자열로, 목록 비교는 요약 문자열로 한다.
import { describe, expect, it } from "vitest";
import { PHASE_DEFS } from "../../shared/game/phases";
import { ROLE_IDS, ROLE_TABLE, assignRoles, giveRoleTo, rolesInPlay, testRoleOptions } from "../../shared/game/roles";
import type { RoleId } from "../../shared/game/roles";
import { attachConnection, createRoomState, joinRoom, startGame } from "../../shared/game/room";
import type { RoomState } from "../../shared/game/room";
import { pickTarget } from "../../shared/game/night";
import { resetToLobby, setTestRole, skipPhase } from "../../shared/game/testTools";
import { tick } from "../../shared/game/tick";
import { buildPreview, buildView } from "../../shared/game/view";
import type { PhaseId } from "../../shared/protocol";
import { seededRandInt } from "../helpers/seededRandom";

const START_AT = 10_000;
const HOST_ID = "player-id-0000-aaaa";

/** n 명이 모두 연결된 대기실. testMode 가 true 면 테스트 방이다. */
function lobbyOf(n: number, testMode = true): RoomState {
  const created = createRoomState({
    code: "0420",
    hostId: HOST_ID,
    hostToken: "token-secret-0000-aaaa-0123456789",
    hostNickname: "이름0",
    now: 0,
    ...(testMode ? { testMode: true } : {}),
  });
  if (!created.ok) throw new Error("createRoomState failed");
  let state = attachConnection(created.state, HOST_ID, "conn-0");
  for (let i = 1; i < n; i += 1) {
    const id = `player-id-000${i}-aaaa`;
    const joined = joinRoom(state, { playerId: id, token: `token-secret-000${i}-aaaa-0123456789`, nickname: `이름${i}` });
    if (!joined.ok) throw new Error(`joinRoom failed: ${joined.error}`);
    state = attachConnection(joined.state, id, `conn-${i}`);
  }
  return state;
}

/** 실제 전이(startGame, tick)로 phase 에 닿은 상태. */
function stateAt(n: number, seed: number, phase: PhaseId, testMode = true): RoomState {
  const lobby = lobbyOf(n, testMode);
  const started = startGame(lobby, lobby.hostId, START_AT, seededRandInt(seed));
  if (!started.ok) throw new Error(`startGame failed: ${started.error}`);
  let state = started.state;
  while (state.phase !== phase) {
    if (state.phaseEndsAt === null) throw new Error("phase has no deadline");
    state = tick(state, state.phaseEndsAt, seededRandInt(seed + 1));
  }
  return state;
}

/** 키 순서와 상관없이 같은 내용이면 같은 한 줄 문자열. */
function canon(value: unknown): string {
  return JSON.stringify(value, (_key, v: unknown) =>
    v !== null && typeof v === "object" && !Array.isArray(v)
      ? Object.fromEntries(Object.entries(v as Record<string, unknown>).sort(([a], [b]) => (a < b ? -1 : 1)))
      : v,
  );
}

const sortedKeys = (o: object): string => Object.keys(o).sort().join(",");
// claim 은 한 번에 한 차례만 넘어가므로 아래 별도 묶음에서 다룬다(결정 0023).
const SKIPPABLE: PhaseId[] = ["assigning", "roleReveal", "dayAnnounce", "discussion", "night", "morning"];

describe("createRoomState testMode", () => {
  it("testMode true 를 주면 state.testMode 가 true 다", () => {
    expect(String(lobbyOf(4, true).testMode)).toBe("true");
  });
  it("testMode 를 안 주면 testMode 키가 없다", () => {
    expect(Object.hasOwn(lobbyOf(4, false), "testMode")).toBe(false);
  });
  it("testMode false 를 주면 testMode 키가 없다", () => {
    const created = createRoomState({
      code: "0420",
      hostId: HOST_ID,
      hostToken: "token-secret-0000-aaaa-0123456789",
      hostNickname: "이름0",
      now: 0,
      testMode: false,
    });
    expect(created.ok && Object.hasOwn(created.state, "testMode")).toBe(false);
  });
});

describe("testRoleOptions", () => {
  it("1~4명은 마피아·경찰·시민(의사 없음)이다", () => {
    for (const n of [1, 2, 3, 4]) expect(testRoleOptions(n).join(",")).toBe("mafia,police,citizen");
  });
  it("5~8명은 네 직업 모두 ROLE_IDS 순서다", () => {
    for (const n of [5, 6, 7, 8]) expect(testRoleOptions(n).join(",")).toBe(ROLE_IDS.join(","));
  });
});

describe("giveRoleTo", () => {
  const ids = ["a", "b", "c", "d", "e"];
  const assigned = assignRoles(ids, seededRandInt(3));
  const roleOf = (m: Map<string, RoleId>): string => ids.map((id) => m.get(id)).join(",");

  it("대상이 이미 그 직업이면 내용이 같다", () => {
    const mine = assigned.get("a")!;
    expect(roleOf(giveRoleTo(assigned, ids, "a", mine))).toBe(roleOf(assigned));
  });
  it("대상이 그 직업을 받고 직업 수는 그대로다", () => {
    for (const role of ROLE_IDS) {
      const out = giveRoleTo(assigned, ids, "a", role);
      expect(out.get("a")).toBe(role);
      expect([...out.values()].sort().join(",")).toBe([...assigned.values()].sort().join(","));
    }
  });
  it("그 직업을 받은 사람 가운데 앞선 사람과 바꾼다", () => {
    const role = [...assigned.values()].find((r) => r !== assigned.get("a"))!;
    const partner = ids.find((id) => assigned.get(id) === role)!;
    const out = giveRoleTo(assigned, ids, "a", role);
    expect(out.get(partner)).toBe(assigned.get("a"));
  });
  it("입력 Map 을 바꾸지 않는다", () => {
    const before = roleOf(assigned);
    giveRoleTo(assigned, ids, "a", "doctor");
    expect(roleOf(assigned)).toBe(before);
  });
  it("그 직업을 받은 사람이 없으면 RangeError 다", () => {
    const four = ["a", "b", "c", "d"];
    const m = assignRoles(four, seededRandInt(1));
    expect(() => giveRoleTo(m, four, "a", "doctor")).toThrow(RangeError);
  });
});

describe("skipPhase 거부", () => {
  it("일반 방은 방장이어도 BAD_MESSAGE 다", () => {
    const state = stateAt(5, 1, "discussion", false);
    const r = skipPhase(state, state.hostId, START_AT, seededRandInt(1));
    expect(r.ok ? "ok" : r.error).toBe("BAD_MESSAGE");
  });
  it("테스트 방 손님은 NOT_HOST 다", () => {
    const state = stateAt(5, 1, "discussion");
    const guest = state.players.find((p) => p.id !== state.hostId)!;
    const r = skipPhase(state, guest.id, START_AT, seededRandInt(1));
    expect(r.ok ? "ok" : r.error).toBe("NOT_HOST");
  });
  it("대기실은 WRONG_PHASE 다", () => {
    const state = lobbyOf(5);
    const r = skipPhase(state, state.hostId, START_AT, seededRandInt(1));
    expect(r.ok ? "ok" : r.error).toBe("WRONG_PHASE");
  });
  it("일반 방이 대기실이어도 testMode 검사가 먼저라 BAD_MESSAGE 다", () => {
    const state = lobbyOf(5, false);
    const guest = state.players.find((p) => p.id !== state.hostId)!;
    const r = skipPhase(state, guest.id, START_AT, seededRandInt(1));
    expect(r.ok ? "ok" : r.error).toBe("BAD_MESSAGE");
  });
});

describe("skipPhase 동작", () => {
  for (const phase of SKIPPABLE) {
    it(`${phase} 에서 정확히 한 단계만 넘기고 새 마감은 now + 다음 단계 길이다`, () => {
      const state = stateAt(6, 7, phase);
      const now = state.phaseEndsAt! - 500;
      const r = skipPhase(state, state.hostId, now, seededRandInt(9));
      if (!r.ok) throw new Error(`skipPhase failed: ${r.error}`);
      const next = PHASE_DEFS[phase].next!;
      expect(r.state.phase).toBe(next);
      expect(String(r.state.phaseEndsAt)).toBe(String(now + PHASE_DEFS[next].durationMs!));
    });
    it(`${phase} 의 결과는 정상 마감 tick 과 마감 시각만 다르다`, () => {
      const state = stateAt(6, 7, phase);
      const now = state.phaseEndsAt! - 500;
      const r = skipPhase(state, state.hostId, now, seededRandInt(9));
      if (!r.ok) throw new Error(`skipPhase failed: ${r.error}`);
      const normal = tick(state, state.phaseEndsAt!, seededRandInt(9));
      expect(canon({ ...r.state, phaseEndsAt: 0 })).toBe(canon({ ...normal, phaseEndsAt: 0 }));
    });
    it(`${phase} 에서 입력 상태를 바꾸지 않는다`, () => {
      const state = stateAt(6, 7, phase);
      const copy = structuredClone(state);
      skipPhase(state, state.hostId, state.phaseEndsAt! - 500, seededRandInt(9));
      expect(canon(state)).toBe(canon(copy));
    });
  }

  it("claim 중 넘기기는 차례 단위다: 지금 차례가 말 안 함으로 쌓이고 단계는 그대로이며 마감은 now + 8000, 마지막 차례면 discussion 이다", () => {
    let state = stateAt(6, 7, "claim");
    const n = state.players.length;
    for (let i = 0; i < n; i += 1) {
      const turnSeat = state.claimOrder![state.claimIdx ?? 0]!;
      const now = state.phaseEndsAt! - 500;
      const r = skipPhase(state, state.hostId, now, seededRandInt(9));
      if (!r.ok) throw new Error(`skipPhase failed: ${r.error}`);
      expect(r.state.claimLog!.at(-1)).toEqual({ n: 1, seat: turnSeat, claim: "none" });
      if (i < n - 1) {
        expect(`${r.state.phase}/${r.state.claimIdx}/${r.state.phaseEndsAt}`).toBe(`claim/${i + 1}/${now + 8000}`);
      } else {
        expect(`${r.state.phase}/${r.state.claimLog!.length}/${r.state.phaseEndsAt}`).toBe(`discussion/${n}/${now + 90_000}`);
      }
      state = r.state;
    }
  });

  it("claim 중 넘기기 결과는 정상 마감 tick 과 마감 시각만 다르다", () => {
    const state = stateAt(6, 7, "claim");
    const now = state.phaseEndsAt! - 500;
    const r = skipPhase(state, state.hostId, now, seededRandInt(9));
    if (!r.ok) throw new Error(`skipPhase failed: ${r.error}`);
    const normal = tick(state, state.phaseEndsAt!, seededRandInt(9));
    expect(canon({ ...r.state, phaseEndsAt: 0 })).toBe(canon({ ...normal, phaseEndsAt: 0 }));
  });

  it("밤에 마피아가 시민을 고른 뒤 넘기면 아침에 그 시민이 탈락하고 문구가 있다", () => {
    const night = stateAt(6, 4, "night");
    const mafia = night.players.find((p) => p.role === "mafia")!;
    const citizen = night.players.find((p) => p.role === "citizen")!;
    const picked = pickTarget(night, mafia.id, citizen.seat);
    if (!picked.ok) throw new Error(`pickTarget failed: ${picked.error}`);
    const r = skipPhase(picked.state, night.hostId, night.phaseEndsAt! - 1000, seededRandInt(5));
    if (!r.ok) throw new Error(`skipPhase failed: ${r.error}`);
    expect(r.state.phase).toBe("morning");
    expect(String(r.state.morning?.eliminated)).toBe(String(citizen.seat));
    expect(r.state.morning?.phrase === undefined).toBe(false);
    expect(String(r.state.players.find((p) => p.id === citizen.id)!.alive)).toBe("false");
  });

  it("아침에서 넘기면 낮 시작 발표이고 일차가 1 오른다", () => {
    const morning = stateAt(6, 4, "morning");
    const r = skipPhase(morning, morning.hostId, morning.phaseEndsAt! - 1000, seededRandInt(5));
    if (!r.ok) throw new Error(`skipPhase failed: ${r.error}`);
    expect(r.state.phase).toBe("dayAnnounce");
    expect(String(r.state.day)).toBe(String((morning.day ?? 0) + 1));
  });
});

describe("resetToLobby", () => {
  /** 2일차 밤: 탈락자·주장·수사 기록·nightPick·lastSendAt 이 모두 있는 상태. */
  function dayTwoNight(): RoomState {
    let state = stateAt(6, 4, "night");
    const mafia = state.players.find((p) => p.role === "mafia")!;
    const citizen = state.players.find((p) => p.role === "citizen")!;
    const police = state.players.find((p) => p.role === "police")!;
    for (const [actor, target] of [
      [mafia.id, citizen.seat],
      [police.id, mafia.seat],
    ] as const) {
      const picked = pickTarget(state, actor, target);
      if (!picked.ok) throw new Error(`pickTarget failed: ${picked.error}`);
      state = picked.state;
    }
    while (!(state.phase === "night" && state.day === 2)) {
      const r = skipPhase(state, state.hostId, state.phaseEndsAt! - 100, seededRandInt(2));
      if (!r.ok) throw new Error(`skipPhase failed: ${r.error}`);
      state = r.state;
    }
    const alivePolice = state.players.find((p) => p.role === "police")!;
    const aliveMafia = state.players.find((p) => p.role === "mafia")!;
    const picked = pickTarget(state, alivePolice.id, aliveMafia.seat);
    if (!picked.ok) throw new Error(`pickTarget failed: ${picked.error}`);
    return {
      ...picked.state,
      nextMessageSeq: 5,
      testRole: "mafia",
      players: picked.state.players.map((p) => ({ ...p, lastSendAt: 777 })),
    };
  }

  it("일반 방은 BAD_MESSAGE, 손님은 NOT_HOST, 대기실은 WRONG_PHASE 다", () => {
    const normal = stateAt(5, 1, "discussion", false);
    const a = resetToLobby(normal, normal.hostId);
    expect(a.ok ? "ok" : a.error).toBe("BAD_MESSAGE");
    const test = stateAt(5, 1, "discussion");
    const guest = test.players.find((p) => p.id !== test.hostId)!;
    const b = resetToLobby(test, guest.id);
    expect(b.ok ? "ok" : b.error).toBe("NOT_HOST");
    const lobby = lobbyOf(5);
    const c = resetToLobby(lobby, lobby.hostId);
    expect(c.ok ? "ok" : c.error).toBe("WRONG_PHASE");
  });

  it("대기실로 돌아온 방에는 차례 상태(claimOrder·claimIdx·claimStart·claimPick·claimLog)가 하나도 없다", () => {
    const before = dayTwoNight();
    expect(Object.hasOwn(before, "claimOrder") && Object.hasOwn(before, "claimLog")).toBe(true); // 비어 있는 시험이 아니다
    const r = resetToLobby(before, before.hostId);
    if (!r.ok) throw new Error(`resetToLobby failed: ${r.error}`);
    for (const key of ["claimOrder", "claimIdx", "claimStart", "claimPick", "claimLog"]) {
      expect(`${key}:${Object.hasOwn(r.state, key)}`).toBe(`${key}:false`);
    }
  });

  it("최상위 키는 허용 목록뿐이고 phase 는 lobby, phaseEndsAt 은 null 이다", () => {
    const before = dayTwoNight();
    const r = resetToLobby(before, before.hostId);
    if (!r.ok) throw new Error(`resetToLobby failed: ${r.error}`);
    expect(sortedKeys(r.state)).toBe(
      "code,createdAt,everConnected,expiresAt,hostId,nextJoinSeq,nextMessageSeq,phase,phaseEndsAt,players,testMode,testRole",
    );
    expect(r.state.phase).toBe("lobby");
    expect(String(r.state.phaseEndsAt)).toBe("null");
    expect(String(r.state.testMode)).toBe("true");
    expect(String(r.state.testRole)).toBe("mafia");
    expect(String(r.state.nextMessageSeq)).toBe("5");
  });

  it("testRole 이 없으면 testRole 키도 없다", () => {
    const { testRole: _dropped, ...before } = dayTwoNight();
    const r = resetToLobby(before, before.hostId);
    if (!r.ok) throw new Error(`resetToLobby failed: ${r.error}`);
    expect(Object.hasOwn(r.state, "testRole")).toBe(false);
  });

  it("플레이어는 여덟 키뿐이고 자리·닉네임·연결·인원은 그대로다", () => {
    const before = dayTwoNight();
    const r = resetToLobby(before, before.hostId);
    if (!r.ok) throw new Error(`resetToLobby failed: ${r.error}`);
    expect(String(r.state.players.length)).toBe(String(before.players.length));
    for (const p of r.state.players) {
      expect(sortedKeys(p)).toBe("connId,connected,id,joinSeq,nickname,nicknameKey,seat,token");
      const old = before.players.find((q) => q.id === p.id)!;
      expect(`${p.seat}|${p.nickname}|${p.connected}|${p.connId}`).toBe(`${old.seat}|${old.nickname}|${old.connected}|${old.connId}`);
    }
  });

  it("끊긴 사람은 끊긴 채로 남는다", () => {
    const before = dayTwoNight();
    const dropped = { ...before, players: before.players.map((p, i) => (i === 2 ? { ...p, connected: false, connId: null } : p)) };
    const r = resetToLobby(dropped, dropped.hostId);
    if (!r.ok) throw new Error(`resetToLobby failed: ${r.error}`);
    expect(String(r.state.players[2]!.connected)).toBe("false");
  });

  it("입력 상태를 바꾸지 않고 결과로 바로 새 판을 시작할 수 있다", () => {
    const before = dayTwoNight();
    const copy = structuredClone(before);
    const r = resetToLobby(before, before.hostId);
    if (!r.ok) throw new Error(`resetToLobby failed: ${r.error}`);
    expect(canon(before)).toBe(canon(copy));
    const started = startGame(r.state, r.state.hostId, START_AT, seededRandInt(8));
    expect(started.ok ? "ok" : started.error).toBe("ok");
  });
});

describe("setTestRole", () => {
  it("일반 방은 BAD_MESSAGE, 손님은 NOT_HOST, 대기실 밖은 WRONG_PHASE 다", () => {
    const normal = lobbyOf(5, false);
    const a = setTestRole(normal, normal.hostId, "mafia");
    expect(a.ok ? "ok" : a.error).toBe("BAD_MESSAGE");
    const test = lobbyOf(5);
    const guest = test.players.find((p) => p.id !== test.hostId)!;
    const b = setTestRole(test, guest.id, "mafia");
    expect(b.ok ? "ok" : b.error).toBe("NOT_HOST");
    const started = stateAt(5, 1, "discussion");
    const c = setTestRole(started, started.hostId, "mafia");
    expect(c.ok ? "ok" : c.error).toBe("WRONG_PHASE");
  });

  it("4명 대기실에서 doctor 는 BAD_MESSAGE 다", () => {
    const lobby = lobbyOf(4);
    const r = setTestRole(lobby, lobby.hostId, "doctor");
    expect(r.ok ? "ok" : r.error).toBe("BAD_MESSAGE");
  });

  it("mafia 를 고르면 state.testRole 이 mafia 이고 입력은 그대로다", () => {
    const lobby = lobbyOf(5);
    const copy = structuredClone(lobby);
    const r = setTestRole(lobby, lobby.hostId, "mafia");
    if (!r.ok) throw new Error(`setTestRole failed: ${r.error}`);
    expect(String(r.state.testRole)).toBe("mafia");
    expect(canon(lobby)).toBe(canon(copy));
  });

  it("null 은 testRole 키가 없는 상태다", () => {
    const lobby = { ...lobbyOf(5), testRole: "police" as const };
    const r = setTestRole(lobby, lobby.hostId, null);
    if (!r.ok) throw new Error(`setTestRole failed: ${r.error}`);
    expect(Object.hasOwn(r.state, "testRole")).toBe(false);
  });

  it("같은 값을 다시 지정하면 입력 객체 그대로다", () => {
    const lobby = { ...lobbyOf(5), testRole: "police" as const };
    const r = setTestRole(lobby, lobby.hostId, "police");
    expect(r.ok && r.state === lobby).toBe(true);
    const none = lobbyOf(5);
    const r2 = setTestRole(none, none.hostId, null);
    expect(r2.ok && r2.state === none).toBe(true);
  });
});

describe("startGame + testRole", () => {
  const countsOf = (state: RoomState): string =>
    ROLE_IDS.map((role) => state.players.filter((p) => p.role === role).length).join(",");

  it("4~8명 모든 구성 직업과 시드 1~20 에서 방장이 그 직업이고 직업 수가 구성표와 같다", () => {
    const failures: string[] = [];
    for (let n = 4; n <= 8; n += 1) {
      const table = ROLE_TABLE[n as 4 | 5 | 6 | 7 | 8];
      const expected = ROLE_IDS.map((role) => table[role]).join(",");
      for (const role of rolesInPlay(n)) {
        for (let seed = 1; seed <= 20; seed += 1) {
          const lobby = { ...lobbyOf(n), testRole: role };
          const r = startGame(lobby, lobby.hostId, START_AT, seededRandInt(seed));
          if (!r.ok) {
            failures.push(`${n}/${role}/${seed}:start`);
            continue;
          }
          const host = r.state.players.find((p) => p.id === lobby.hostId)!;
          if (host.role !== role) failures.push(`${n}/${role}/${seed}:host=${host.role}`);
          if (countsOf(r.state) !== expected) failures.push(`${n}/${role}/${seed}:counts=${countsOf(r.state)}`);
        }
      }
    }
    expect(failures.slice(0, 3).join(";")).toBe("");
  });

  it("방장이 이미 그 직업이면 testRole 이 없는 배정과 같다", () => {
    let same = 0;
    for (let seed = 1; seed <= 20; seed += 1) {
      const base = startGame(lobbyOf(6), HOST_ID, START_AT, seededRandInt(seed));
      if (!base.ok) throw new Error("start failed");
      const hostRole = base.state.players.find((p) => p.id === HOST_ID)!.role!;
      const withRole = startGame({ ...lobbyOf(6), testRole: hostRole }, HOST_ID, START_AT, seededRandInt(seed));
      if (!withRole.ok) throw new Error("start failed");
      expect(canon(withRole.state.players.map((p) => p.role))).toBe(canon(base.state.players.map((p) => p.role)));
      same += 1;
    }
    expect(String(same)).toBe("20");
  });

  it("testRole 이 doctor 인데 4명으로 시작하면 testRole 없는 배정과 같다", () => {
    for (let seed = 1; seed <= 10; seed += 1) {
      const base = startGame(lobbyOf(4), HOST_ID, START_AT, seededRandInt(seed));
      const forced = startGame({ ...lobbyOf(4), testRole: "doctor" }, HOST_ID, START_AT, seededRandInt(seed));
      if (!base.ok || !forced.ok) throw new Error("start failed");
      expect(canon(forced.state.players.map((p) => p.role))).toBe(canon(base.state.players.map((p) => p.role)));
    }
  });

  it("testMode 가 없는 방에 testRole 을 억지로 넣어도 무시된다", () => {
    for (let seed = 1; seed <= 10; seed += 1) {
      const base = startGame(lobbyOf(6, false), HOST_ID, START_AT, seededRandInt(seed));
      const forced = startGame({ ...lobbyOf(6, false), testRole: "doctor" }, HOST_ID, START_AT, seededRandInt(seed));
      if (!base.ok || !forced.ok) throw new Error("start failed");
      expect(canon(forced.state.players.map((p) => p.role))).toBe(canon(base.state.players.map((p) => p.role)));
    }
  });
});

describe("buildView / buildPreview 공개 범위", () => {
  const guestOf = (state: RoomState) => state.players.find((p) => p.id !== state.hostId)!;

  it("테스트 방 방장 view 는 me.testMode true 이고 대기실에서 testRole 이 있으면 me.testRole 이 실린다", () => {
    const lobby = { ...lobbyOf(5), testRole: "police" as const };
    const view = buildView(lobby, lobby.hostId, 1);
    expect(String(view.me.testMode)).toBe("true");
    expect(String(view.me.testRole)).toBe("police");
  });

  it("testRole 이 없으면 me.testRole 키도 없다", () => {
    const lobby = lobbyOf(5);
    expect(Object.hasOwn(buildView(lobby, lobby.hostId, 1).me, "testRole")).toBe(false);
  });

  it("roleReveal 이후 방장 view 에는 me.testRole 이 없고 me.testMode 는 있다", () => {
    const base = stateAt(5, 3, "roleReveal");
    const state = { ...base, testRole: "police" as const };
    const view = buildView(state, state.hostId, 1);
    expect(Object.hasOwn(view.me, "testRole")).toBe(false);
    expect(String(view.me.testMode)).toBe("true");
  });

  it("손님 view 와 일반 방 방장 view 의 JSON 에는 testMode·testRole 이 없다", () => {
    const test = { ...lobbyOf(5), testRole: "police" as const };
    const guestJson = JSON.stringify(buildView(test, guestOf(test).id, 1));
    expect(guestJson.includes("testMode") || guestJson.includes("testRole")).toBe(false);
    const normal = { ...lobbyOf(5, false), testRole: "police" as const };
    const hostJson = JSON.stringify(buildView(normal, normal.hostId, 1));
    expect(hostJson.includes("testMode") || hostJson.includes("testRole")).toBe(false);
  });

  it("미리보기에는 testMode·testRole 이 없다", () => {
    const test = { ...lobbyOf(5), testRole: "police" as const };
    const json = JSON.stringify(buildPreview(test));
    expect(json.includes("testMode") || json.includes("testRole")).toBe(false);
  });

  it("방장 view 에는 다른 사람의 역할이 없다", () => {
    const state = stateAt(5, 3, "roleReveal");
    const json = JSON.stringify(buildView(state, state.hostId, 1));
    const roleKeys = json.match(/"role":/g) ?? [];
    expect(String(roleKeys.length)).toBe("1");
  });
});
