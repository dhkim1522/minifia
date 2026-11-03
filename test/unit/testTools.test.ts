// 테스트 방 방장 도구 규칙(quick 261025-f09, 결정 0022): testSkip·testReset·testRole 의 순수 규칙을 확인한다.
// 실패 출력은 한 줄이어야 해서(TAP) 상태 비교는 키 순서를 맞춘 문자열로, 목록 비교는 요약 문자열로 한다.
import { describe, expect, it } from "vitest";
import { PHASE_DEFS } from "../../shared/game/phases";
import { ROLE_IDS, ROLE_TABLE, assignRoles, giveRoleTo, rolesInPlay, testRoleOptions } from "../../shared/game/roles";
import type { RoleId } from "../../shared/game/roles";
import { attachConnection, createRoomState, joinRoom, startGame } from "../../shared/game/room";
import type { RoomState } from "../../shared/game/room";
import { pickTarget } from "../../shared/game/night";
import { isAlive } from "../../shared/game/alive";
import { castPoint } from "../../shared/game/nomination";
import { castVerdict } from "../../shared/game/verdict";
import { resetToLobby, setBotCount, setBotVote, setTestRole, skipPhase } from "../../shared/game/testTools";
import { tick } from "../../shared/game/tick";
import { buildPreview, buildView } from "../../shared/game/view";
import type { PhaseId } from "../../shared/protocol";
import { seededRandInt } from "../helpers/seededRandom";
import { castVerdicts, startedFrom, stateWithVerdict } from "../helpers/voteState";

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
  /** 2일차 밤: 탈락자·수사 기록·nightPick 이 모두 있는 상태. */
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
    return { ...picked.state, testRole: "mafia" };
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

  it("대기실로 돌아온 방에는 옛 차례 상태(claimOrder·claimIdx·claimStart·claimPick·claimLog)가 하나도 없다 (07-08: 이제 새 판은 만들지 않지만 옛 키가 남은 방도 지운다)", () => {
    const before = {
      ...dayTwoNight(),
      claimOrder: [0, 1],
      claimIdx: 1,
      claimStart: 0,
      claimPick: "police",
      claimLog: [{ n: 1, seat: 0, claim: "none" }],
    } as unknown as RoomState;
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
      "code,createdAt,everConnected,expiresAt,hostId,nextJoinSeq,phase,phaseEndsAt,players,testMode,testRole",
    );
    expect(r.state.phase).toBe("lobby");
    expect(String(r.state.phaseEndsAt)).toBe("null");
    expect(String(r.state.testMode)).toBe("true");
    expect(String(r.state.testRole)).toBe("mafia");
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

describe("skipPhase: 밤을 넘길 때 봇이 먼저 행동한다", () => {
  // 사람은 방장 한 명이고 나머지는 봇. 방장이 마피아가 아니고 마피아 봇이 있는 씨앗을 고른다.
  function nightWithBots(): RoomState {
    for (let seed = 1; seed < 60; seed += 1) {
      const base = stateAt(5, seed, "night");
      const host = base.players.find((p) => p.id === base.hostId)!;
      if (host.role === "mafia") continue;
      return { ...base, players: base.players.map((p) => (p.id === base.hostId ? p : { ...p, isBot: true as const })) };
    }
    throw new Error("no seed");
  }
  it("넘기기 즉시 아침이 되어도 마피아 봇의 지목이 반영되어 누군가 탈락하거나 의사가 막은 기록이 남는다", () => {
    const state = nightWithBots();
    const r = skipPhase(state, state.hostId, START_AT, seededRandInt(7));
    if (!r.ok) throw new Error(r.error);
    expect(r.state.phase).toBe("morning");
    const dead = r.state.players.filter((p) => !isAlive(p)).length;
    const blocked = r.state.players.some((p) => p.role === "mafia" && (p.assassinations ?? []).some((a) => a.died === false));
    expect(dead === 1 || blocked).toBe(true);
  });
  it("사람의 지목은 봇이 덮어쓰지 않는다", () => {
    const state = nightWithBots();
    const host = state.players.find((p) => p.id === state.hostId)!;
    if (host.role !== "police" && host.role !== "doctor") return;
    const target = state.players.find((p) => p.id !== host.id && isAlive(p))!.seat;
    const picked = pickTarget(state, host.id, target);
    if (!picked.ok) throw new Error(picked.error);
    const r = skipPhase(picked.state, state.hostId, START_AT, seededRandInt(7));
    if (!r.ok) throw new Error(r.error);
    const after = r.state.players.find((p) => p.id === host.id)!;
    const rec = host.role === "police" ? after.investigations : after.treatments;
    expect(JSON.stringify(rec)).toContain(`"target":${target}`);
  });
});

describe("skipPhase: 밤을 넘길 때 마피아 봇은 같은 대상으로 모인다 (09-02, 결정 0061-18)", () => {
  /** 사람 1(방장, seat 0) + 봇 5 의 밤. 역할은 seat 별로 직접 정한다(나머지는 시민). */
  function arrangedNight(roles: Record<number, RoleId>): RoomState {
    const base = stateAt(6, 3, "night");
    return {
      ...base,
      players: base.players.map((p) => ({ ...p, role: roles[p.seat] ?? "citizen", ...(p.id === base.hostId ? {} : { isBot: true as const }) })),
    };
  }
  const teamTargets = (s: RoomState): string =>
    s.players
      .filter((p) => p.role === "mafia")
      .map((p) => (p.assassinations ?? []).map((a) => a.target).join("+") || "none")
      .join(",");

  it("사람 마피아가 시민 seat 3 을 골랐으면 마피아 봇이 따라가 산 마피아 전원이 같은 대상이 된다", () => {
    for (let seed = 1; seed <= 20; seed += 1) {
      const state = arrangedNight({ 0: "mafia", 4: "mafia", 2: "police", 5: "doctor" });
      const picked = pickTarget(state, state.hostId, 3);
      if (!picked.ok) throw new Error(picked.error);
      const r = skipPhase(picked.state, state.hostId, START_AT, seededRandInt(seed));
      if (!r.ok) throw new Error(r.error);
      expect(`${seed}:${teamTargets(r.state)}`).toBe(`${seed}:3,3`);
    }
  });

  it("마피아 봇 둘만 있고 아무도 안 골랐으면 둘 다 가장 낮은 산 비마피아를 고른다", () => {
    for (let seed = 1; seed <= 20; seed += 1) {
      const state = arrangedNight({ 2: "mafia", 4: "mafia", 3: "police", 5: "doctor" });
      const r = skipPhase(state, state.hostId, START_AT, seededRandInt(seed));
      if (!r.ok) throw new Error(r.error);
      expect(`${seed}:${teamTargets(r.state)}`).toBe(`${seed}:0,0`);
    }
  });

  it("경찰·의사 봇은 기존대로 randInt(후보 수) 를 seat 오름차순으로 한 번씩 부르고 마피아 봇은 난수를 부르지 않는다", () => {
    const state = arrangedNight({ 2: "mafia", 4: "mafia", 3: "police", 5: "doctor" });
    const calls: number[] = [];
    const inner = seededRandInt(5);
    const r = skipPhase(state, state.hostId, START_AT, (n) => {
      calls.push(n);
      return inner(n);
    });
    if (!r.ok) throw new Error(r.error);
    // 경찰 seat 3 → 자기를 뺀 산 사람 5, 의사 seat 5 → 산 사람 6. 그 뒤 tick 이 아침 문구 등에 부르는 난수는 이 둘 뒤에 온다.
    expect(calls.slice(0, 2).join(",")).toBe("5,6");
  });

  it("이미 고른 봇의 선택은 바뀌지 않는다", () => {
    const state = arrangedNight({ 2: "mafia", 4: "mafia", 3: "police", 5: "doctor" });
    const picked = pickTarget(state, state.players.find((p) => p.seat === 4)!.id, 5);
    if (!picked.ok) throw new Error(picked.error);
    const r = skipPhase(picked.state, state.hostId, START_AT, seededRandInt(2));
    if (!r.ok) throw new Error(r.error);
    // seat 4 가 5 를 골랐으므로 seat 2 봇이 따라가 팀 대상은 5 다.
    expect(teamTargets(r.state)).toBe("5,5");
  });
});

// ---- 4페이즈: 투표 단계 넘기기와 대기실 복귀 (결정 0022, 0024, END-02) ----
/** 사람 1(방장) + 봇 4 테스트 방 대기실. 봇 id 는 순서대로 만든다. */
function botLobby(): RoomState {
  let n = 0;
  const r = setBotCount(lobbyOf(1), HOST_ID, 4, () => `bot-id-${(n += 1)}-bbbbbbbb`);
  if (!r.ok) throw new Error(`setBotCount failed: ${r.error}`);
  return r.state;
}
const skipOk = (state: RoomState, now: number, randInt: (n: number) => number): RoomState => {
  const r = skipPhase(state, state.hostId, now, randInt);
  if (!r.ok) throw new Error(`skipPhase failed: ${r.error}`);
  return r.state;
};
const botsIn = (state: RoomState) => state.players.filter((p) => p.isBot === true).sort((a, b) => a.seat - b.seat);

/** 변론자를 뺀 산 사람 전원이 찬성한 찬반 상태로 만든다(skipPhase 가 봇 찬반을 무작위로 던지지 않게 — 통과를 고정). */
const verdictAllAgree = (state: RoomState): RoomState => {
  const defender = state.verdict?.candidate;
  const agree = Object.fromEntries(state.players.filter((p) => isAlive(p) && p.seat !== defender).map((p) => [p.seat, true]));
  return castVerdicts(state, agree);
};
/** 봇 4명 방의 처형 단계(통과, 변론자 탈락). 새 흐름의 변론 → 찬반 → 처형을 걸어 만든다. */
const executionOf = (candidate: "citizen" | "mafia"): RoomState => stateWithVerdict(5, 6, "execution", { lobby: botLobby(), candidate });

describe("skipPhase: 분기 단계를 따라 끝까지 넘어간다", () => {
  it("defense → verdict(now + 10000) → execution(now + 5000), execution → 승패가 안 났으면 밤, 났으면 ended(마감 없음)", () => {
    const defense = stateWithVerdict(5, 6, "defense", { lobby: botLobby(), candidate: "citizen" });
    const now = defense.phaseEndsAt! - 500;
    const verdict = skipOk(defense, now, seededRandInt(9));
    expect(`${verdict.phase}/${verdict.phaseEndsAt}`).toBe(`verdict/${now + 10_000}`);
    const execution = skipOk(verdictAllAgree(verdict), now, seededRandInt(9));
    expect(`${execution.phase}/${execution.phaseEndsAt}`).toBe(`execution/${now + 5_000}`);
    expect(execution.players.filter((p) => p.alive === false).length).toBe(1);
    const night = skipOk(execution, now, seededRandInt(9));
    expect(night.phase).toBe("night");

    const mafiaDefense = stateWithVerdict(5, 6, "defense", { lobby: botLobby(), candidate: "mafia" });
    const mafiaVerdict = skipOk(mafiaDefense, now, seededRandInt(9));
    const mafiaExecution = skipOk(verdictAllAgree(mafiaVerdict), now, seededRandInt(9));
    const ended = skipOk(mafiaExecution, now, seededRandInt(9));
    expect(`${ended.phase}/${ended.winner}/${ended.phaseEndsAt}`).toBe("ended/citizenWin/null");
  });

  it("찬반이 부결이면 처형 단계로 가도 아무도 탈락하지 않고 밤으로 간다", () => {
    const verdict = skipOk(stateWithVerdict(5, 6, "defense", { lobby: botLobby(), candidate: "citizen" }), 20_000, seededRandInt(9));
    const defender = verdict.verdict!.candidate!;
    const against = Object.fromEntries(verdict.players.filter((p) => p.seat !== defender).map((p) => [p.seat, false]));
    const execution = skipOk(castVerdicts(verdict, against), 20_000, seededRandInt(9));
    expect(execution.phase).toBe("execution");
    expect(execution.players.every((p) => p.alive !== false)).toBe(true);
    expect(skipOk(execution, 20_000, seededRandInt(9)).phase).toBe("night");
  });

  it("ended 에서 skipPhase 는 WRONG_PHASE 다", () => {
    const ended = skipOk(executionOf("mafia"), 20_000, seededRandInt(9));
    expect(ended.phase).toBe("ended");
    const r = skipPhase(ended, ended.hostId, 30_000, seededRandInt(9));
    expect(r.ok ? "ok" : r.error).toBe("WRONG_PHASE");
  });
});

describe("resetToLobby: 투표·처형·종료 필드를 모두 지운다 (END-02, 결정 0022)", () => {
  const GONE = ["voteLog", "verdict", "execution", "nightLog", "winner"];
  const PLAYER_GONE = ["execVote", "candidateVote"];
  function check(before: RoomState, label: string): void {
    const r = resetToLobby(before, before.hostId);
    if (!r.ok) throw new Error(`resetToLobby failed: ${r.error}`);
    for (const key of GONE) expect(`${label}:${key}:${Object.hasOwn(r.state, key)}`).toBe(`${label}:${key}:false`);
    for (const p of r.state.players) {
      for (const key of PLAYER_GONE) expect(`${label}:${p.seat}:${key}:${Object.hasOwn(p, key)}`).toBe(`${label}:${p.seat}:${key}:false`);
      expect(sortedKeys(p)).toBe(p.isBot === true ? "connId,connected,id,isBot,joinSeq,nickname,nicknameKey,seat,token" : "connId,connected,id,joinSeq,nickname,nicknameKey,seat,token");
    }
    expect(sortedKeys(r.state)).toBe("code,createdAt,everConnected,expiresAt,hostId,nextJoinSeq,phase,phaseEndsAt,players,testMode");
  }
  const rich = (state: RoomState): RoomState => ({
    ...state,
    everConnected: true,
    nightLog: [],
    players: state.players.map((p) => ({ ...p, execVote: true, candidateVote: 0 })),
  });

  it("execution 상태에서", () => {
    const execution = executionOf("citizen");
    expect(execution.phase).toBe("execution");
    check(rich(execution), "execution");
  });

  it("ended 상태에서", () => {
    const ended = skipOk(executionOf("mafia"), 20_000, seededRandInt(9));
    expect(ended.phase).toBe("ended");
    check(rich(ended), "ended");
  });
});

// ---- P-13: 테스트 방 봇 투표 선택 규칙(04-15) ----
function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value as Record<string, unknown>)) deepFreeze(child);
  }
  return value;
}

describe("setBotVote", () => {
  it("검사 순서: 일반 방 BAD_MESSAGE → 손님 NOT_HOST → 대기실 밖 WRONG_PHASE → 값 범위 밖 BAD_MESSAGE", () => {
    const normal = lobbyOf(5, false);
    const a = setBotVote(normal, normal.hostId, "yes", "host");
    expect(a.ok ? "ok" : a.error).toBe("BAD_MESSAGE");
    const test = lobbyOf(5);
    const guest = test.players.find((p) => p.id !== test.hostId)!;
    const b = setBotVote(test, guest.id, "yes", "host");
    expect(b.ok ? "ok" : b.error).toBe("NOT_HOST");
    const started = stateAt(5, 1, "discussion");
    const c = setBotVote(started, started.hostId, "yes", "host");
    expect(c.ok ? "ok" : c.error).toBe("WRONG_PHASE");
    // 일반 방은 손님이 보내도 값이 틀려도 BAD_MESSAGE 가 먼저다
    const normalBad = setBotVote(normal, "someone-else", "maybe" as "yes", "host");
    expect(normalBad.ok ? "ok" : normalBad.error).toBe("BAD_MESSAGE");
    const badExec = setBotVote(test, test.hostId, "maybe" as "yes", "host");
    expect(badExec.ok ? "ok" : badExec.error).toBe("BAD_MESSAGE");
    const badPick = setBotVote(test, test.hostId, "yes", "everyone" as "host");
    expect(badPick.ok ? "ok" : badPick.error).toBe("BAD_MESSAGE");
    // 대기실 밖이면 값이 틀려도 WRONG_PHASE 가 먼저다
    const badInGame = setBotVote(started, started.hostId, "maybe" as "yes", "host");
    expect(badInGame.ok ? "ok" : badInGame.error).toBe("WRONG_PHASE");
  });

  it("무작위가 아닌 값만 저장하고 입력 상태는 깊은 동결이어도 바뀌지 않는다", () => {
    const lobby = deepFreeze(lobbyOf(5));
    const both = setBotVote(lobby, lobby.hostId, "no", "other");
    if (!both.ok) throw new Error(both.error);
    expect(JSON.stringify(both.state.testBotVote)).toBe('{"exec":"no","pick":"other"}');
    expect(Object.hasOwn(lobby, "testBotVote")).toBe(false);
    const execOnly = setBotVote(lobby, lobby.hostId, "yes", "random");
    if (!execOnly.ok) throw new Error(execOnly.error);
    expect(JSON.stringify(execOnly.state.testBotVote)).toBe('{"exec":"yes"}');
    const pickOnly = setBotVote(lobby, lobby.hostId, "random", "host");
    if (!pickOnly.ok) throw new Error(pickOnly.error);
    expect(JSON.stringify(pickOnly.state.testBotVote)).toBe('{"pick":"host"}');
  });

  it("둘 다 random 이면 키를 지운다", () => {
    const lobby = deepFreeze({ ...lobbyOf(5), testBotVote: { exec: "no" as const, pick: "host" as const } });
    const r = setBotVote(lobby, lobby.hostId, "random", "random");
    if (!r.ok) throw new Error(r.error);
    expect(Object.hasOwn(r.state, "testBotVote")).toBe(false);
  });

  it("같은 값은 입력 객체 그대로다(없음 = random,random 포함)", () => {
    const set = { ...lobbyOf(5), testBotVote: { exec: "no" as const, pick: "host" as const } };
    const same = setBotVote(set, set.hostId, "no", "host");
    expect(same.ok && same.state === set).toBe(true);
    const none = lobbyOf(5);
    const sameNone = setBotVote(none, none.hostId, "random", "random");
    expect(sameNone.ok && sameNone.state === none).toBe(true);
    const half = { ...lobbyOf(5), testBotVote: { pick: "other" as const } };
    const sameHalf = setBotVote(half, half.hostId, "random", "other");
    expect(sameHalf.ok && sameHalf.state === half).toBe(true);
  });

  it("resetToLobby 가 설정을 남긴다(testRole 처럼) — 없으면 키도 없다", () => {
    const execution = executionOf("citizen");
    const withSetting: RoomState = { ...execution, testBotVote: { exec: "yes", pick: "host" } };
    const r = resetToLobby(withSetting, withSetting.hostId);
    if (!r.ok) throw new Error(r.error);
    expect(JSON.stringify(r.state.testBotVote)).toBe('{"exec":"yes","pick":"host"}');
    const plain = resetToLobby(execution, execution.hostId);
    if (!plain.ok) throw new Error(plain.error);
    expect(Object.hasOwn(plain.state, "testBotVote")).toBe(false);
  });
});

// ---- 8페이즈: 지목·찬반 단계를 넘길 때 안 던진 봇이 먼저 던진다 (08-07, 결정 0024·0060-13) ----
// 두 단계의 마감 훅(resolveNomination·resolveVerdict)이 tick 에 걸려 있어 넘긴 뒤 개인 값(nominate·verdictVote)은 키째 지워진다 —
// 08-11: 단언은 그날 voteLog 줄(지목 cand.votes·찬반 exec)로 옮겼다.
describe("skipPhase: 지목·찬반에서 안 던진 봇이 먼저 던진다", () => {
  const trial = (phase: "nomination" | "verdict", over: Partial<RoomState> = {}, lobby: RoomState = botLobby()): RoomState => {
    const base = startedFrom(lobby, 3, "discussion");
    // 찬반은 지목 마감이 만든 그날 voteLog 줄을 채운다 — 줄이 없으면 기록하지 않으므로 줄을 함께 세운다.
    const line = phase === "verdict" ? { voteLog: [{ n: base.day ?? 1, exec: { yes: 0, no: 0, passed: false }, cand: { votes: [] } }] } : {};
    return { ...base, phase, phaseEndsAt: 100_000 + PHASE_DEFS[phase].durationMs!, ...line, ...over };
  };
  const THROWING = (): number => {
    throw new Error("randInt must not be called");
  };
  const setting = (lobby: RoomState, exec: "random" | "yes" | "no", pick: "random" | "host" | "other"): RoomState => {
    const r = setBotVote(lobby, lobby.hostId, exec, pick);
    if (!r.ok) throw new Error(r.error);
    return r.state;
  };
  /** 그날 voteLog 줄의 지목 목록: "행위자>대상" 을 좌석 오름차순으로. 마감 훅이 개인 키를 지웠으므로 기록은 이 줄뿐이다. */
  const nominates = (s: RoomState): string => (s.voteLog?.[0]?.cand?.votes ?? []).map((v) => `${v.seat}>${v.target}`).join(",");
  /** 그날 voteLog 줄의 찬반 집계. */
  const tally = (s: RoomState): string => JSON.stringify(s.voteLog?.[0]?.exec);

  it("nomination: 안 던진 봇이 botPointTarget 대로 지목하고(봇마다 randInt(후보 수) 한 번), 이미 지목한 봇은 그대로다", () => {
    const state = trial("nomination");
    const first = botsIn(state)[0]!; // seat 1
    const cast = castPoint(state, first.id, 4);
    if (!cast.ok) throw new Error(cast.error);
    const calls: number[] = [];
    const after = skipOk(cast.state, 100_000, (n) => {
      calls.push(n);
      return 0; // 후보 중 가장 낮은 seat
    });
    expect(nominates(after)).toBe("1>4,2>0,3>0,4>0");
    expect(calls.join(",")).toBe("4,4,4");
  });

  it("nomination: pick host 면 봇이 모두 방장을 지목하고 난수를 부르지 않는다", () => {
    const after = skipOk(trial("nomination", {}, setting(botLobby(), "random", "host")), 100_000, THROWING);
    expect(nominates(after)).toBe("1>0,2>0,3>0,4>0");
  });

  it("verdict: 변론자가 아닌 안 던진 봇이 먼저 던지고(봇마다 randInt(100) 한 번) 변론자 봇은 던지지 않으며, 이미 던진 봇은 그대로다", () => {
    const state = trial("verdict", { verdict: { passed: false, candidate: 2 } });
    const first = botsIn(state)[0]!; // seat 1
    const cast = castVerdict(state, first.id, false);
    if (!cast.ok) throw new Error(cast.error);
    const calls: number[] = [];
    const after = skipOk(cast.state, 100_000, (n) => {
      calls.push(n);
      return 0; // randInt(100) = 0 < 70 → 찬성
    });
    // 봇 1 은 먼저 반대, 변론자 봇 2 는 못 던지고, 봇 3·4 는 찬성(70% 미만). 방장은 사람이라 던지지 않는다 → 찬성 2 · 반대 1, 유권자 4 라 부결.
    expect(tally(after)).toBe('{"yes":2,"no":1,"passed":false}');
    expect(after.players.every((p) => p.verdictVote === undefined)).toBe(true);
    expect(calls.filter((n) => n === 100).join(",")).toBe("100,100"); // 봇 찬반 결정 난수만 센다(그 뒤 tick 이 단계 진입에서 부르는 난수는 제외)
  });

  it("verdict: 고정 yes·no 면 봇이 모두 그 값으로 던지고 찬반 결정 난수를 부르지 않는다", () => {
    for (const exec of ["yes", "no"] as const) {
      const state = trial("verdict", { verdict: { passed: false, candidate: 0 } }, setting(botLobby(), exec, "random"));
      const calls: number[] = [];
      const after = skipOk(state, 100_000, (n) => {
        calls.push(n);
        return 0;
      });
      // 변론자는 방장(사람)이다 — 봇 4명이 모두 같은 값으로 던졌다. 유권자 4, 찬성 4 면 통과·반대 4 면 부결.
      expect(`${exec}:${tally(after)}`).toBe(`${exec}:${exec === "yes" ? '{"yes":4,"no":0,"passed":true}' : '{"yes":0,"no":4,"passed":false}'}`);
      expect(`${exec}:${calls.includes(100)}`).toBe(`${exec}:false`); // 봇 찬반 결정 난수(randInt(100))는 부르지 않는다(처형 단계 문구 추첨은 tick 이 부른다)
    }
  });
});
