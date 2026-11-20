// 22-03: 옛 방 정규화(결정 0089, D-03·D-29) — 옛 표시가 있는 방만 대기실로 되돌리고, 표시 없는 판은 DO 가 다시 깨어나도 그대로 둔다.
// 22-04 가 등불·현장·건너뛰기 키 표시를, 22-05 가 마을(town) 표시를 더했다. 22-06 이 errand 단계·키 표시를 더했고 22-07 이 mode(판 종류)·players[].stats 키 표시를 더했다.
import { describe, expect, it } from "vitest";
import { attachConnection, createRoomState, isLegacyV3Room, joinRoom, normalizeStoredRoom, startGame, toLobbyFromLegacy } from "../../shared/game/room";
import type { RoomState } from "../../shared/game/room";
import { seededRandInt } from "../helpers/seededRandom";

const HOST = "player-id-0000-aaaa";

function lobby(n = 4): RoomState {
  const created = createRoomState({ code: "0420", hostId: HOST, hostToken: "token-secret-0000-aaaa-0123456789", hostNickname: "이름0", now: 0 });
  if (!created.ok) throw new Error("createRoomState failed");
  let state = attachConnection(created.state, HOST, "conn-0");
  for (let i = 1; i < n; i += 1) {
    const id = `player-id-000${i}-aaaa`;
    const joined = joinRoom(state, { playerId: id, token: `token-secret-000${i}-aaaa-0123456789`, nickname: `이름${i}` });
    if (!joined.ok) throw new Error(`joinRoom failed: ${joined.error}`);
    state = attachConnection(joined.state, id, `conn-${i}`);
  }
  return { ...state, mapChoice: "plaza" };
}

function started(n = 4): RoomState {
  const r = startGame(lobby(n), HOST, 1000, seededRandInt(1));
  if (!r.ok) throw new Error("start failed");
  return r.state;
}

/** 옛 튜토리얼 단계로 저장된 방(배포 전 상태)을 흉내 낸다. */
function oldTutorialRoom(): RoomState {
  return { ...started(4), phase: "tutorial", day: 1, voteLog: [], winner: "citizens" } as unknown as RoomState;
}

describe("normalizeStoredRoom — 옛 튜토리얼 방 (D-03·D-29, T-22-03)", () => {
  it("phase 가 tutorial 로 저장된 방은 대기실로 되돌아가고 방·사람 식별은 남는다", () => {
    const stored = oldTutorialRoom();
    const out = normalizeStoredRoom(stored, 5000);
    const people = out.players.map((p) => `${p.id}/${p.seat}/${p.nickname}/${p.token}`).join(",");
    const want = stored.players.map((p) => `${p.id}/${p.seat}/${p.nickname}/${p.token}`).join(",");
    expect(`${out.phase}/${out.code}/${out.hostId}/${out.mapChoice}/${people === want}`).toBe("lobby/0420/player-id-0000-aaaa/plaza/true");
  });

  it("되돌린 대기실에는 판 진행 키(day·voteLog·winner·phaseEndsAt 마감)와 역할이 없다", () => {
    const out = normalizeStoredRoom(oldTutorialRoom(), 5000);
    const gameKeys = ["day", "voteLog", "verdict", "winner", "map", "tutorialPassed"].filter((k) => Object.hasOwn(out, k));
    const roles = out.players.filter((p) => Object.hasOwn(p, "role")).length;
    expect(`${gameKeys.join(",")}/${out.phaseEndsAt}/${roles}`).toBe("/null/0");
  });

  it("tutorialPassed 방 키가 있는 판 중 방도 대기실로 되돌아간다", () => {
    const stored = { ...started(4), phase: "discussion", day: 1, tutorialPassed: [HOST] } as unknown as RoomState;
    expect(normalizeStoredRoom(stored, 5000).phase).toBe("lobby");
  });

  it("tutorialDone 개인 키를 가진 사람이 있는 판 중 방도 대기실로 되돌아간다", () => {
    const base = started(4);
    const stored = { ...base, phase: "discussion", day: 1, players: base.players.map((p, i) => (i === 0 ? { ...p, tutorialDone: true } : p)) } as unknown as RoomState;
    const out = normalizeStoredRoom(stored, 5000);
    expect(`${out.phase}/${out.players.some((p) => Object.hasOwn(p, "tutorialDone"))}`).toBe("lobby/false");
  });

  it("옛 표시가 없는 판 중 방은 같은 단계·같은 day 의 같은 객체다 (DO 재기동 안전, T-22-04)", () => {
    const discussion = { ...started(4), phase: "discussion", phaseEndsAt: 90_000, day: 2 } as RoomState;
    const night = { ...started(4), phase: "night", phaseEndsAt: 60_000, day: 2 } as RoomState;
    const a = normalizeStoredRoom(discussion, 5000);
    const b = normalizeStoredRoom(night, 5000);
    expect(`${a === discussion}/${a.phase}/${a.day}/${b === night}/${b.phase}/${b.day}`).toBe("true/discussion/2/true/night/2");
  });

  it("대기실 방의 tutorialPassed 키는 지워지고 나머지는 그대로다", () => {
    const base = lobby(4);
    const stored = { ...base, tutorialPassed: [HOST] } as unknown as RoomState;
    const out = normalizeStoredRoom(stored, 5000);
    expect(`${Object.hasOwn(out, "tutorialPassed")}/${JSON.stringify(out) === JSON.stringify(base)}`).toBe("false/true");
  });

  it("두 번 정규화해도 같다 (두 번째는 같은 객체)", () => {
    const once = normalizeStoredRoom(oldTutorialRoom(), 5000);
    expect(normalizeStoredRoom(once, 6000) === once).toBe(true);
  });
});

describe("normalizeStoredRoom — 옛 원인 흐름 방 (22-04, D-03, T-22-06)", () => {
  it("등불 키(lamps)가 있는 판 중 방은 대기실로 되돌아가고 등불 키는 없다", () => {
    const stored = { ...started(4), phase: "night", day: 2, lamps: [true, false, true, false, true, false, true, false] } as unknown as RoomState;
    const out = normalizeStoredRoom(stored, 5000);
    expect(`${out.phase}/${Object.hasOwn(out, "lamps")}/${out.code}`).toBe("lobby/false/0420");
  });

  it("아침 현장 키(scene)가 있는 판 중 방은 대기실로 되돌아간다", () => {
    const stored = { ...started(4), phase: "morning", day: 2, scene: { house: 1, footprints: 0, windowLit: false, touched: {} } } as unknown as RoomState;
    expect(normalizeStoredRoom(stored, 5000).phase).toBe("lobby");
  });

  it("건너뛰기 표·자른 등불·살핀 지점 개인 키가 있는 판 중 방은 각각 대기실로 되돌아가고 그 키는 남지 않는다", () => {
    for (const key of ["skipVote", "errandCut", "sceneSeen"]) {
      const base = started(4);
      const stored = { ...base, phase: "discussion", day: 2, players: base.players.map((p, i) => (i === 0 ? { ...p, [key]: key === "skipVote" ? true : [] } : p)) } as unknown as RoomState;
      const out = normalizeStoredRoom(stored, 5000);
      expect(`${key}:${out.phase}/${out.players.some((p) => Object.hasOwn(p, key))}`).toBe(`${key}:lobby/false`);
    }
  });

  it("대기실 방에 남은 현장·등불 키는 지워지고 나머지는 그대로다", () => {
    const base = lobby(4);
    const stored = { ...base, scene: { house: 0 }, lamps: [true] } as unknown as RoomState;
    const out = normalizeStoredRoom(stored, 5000);
    expect(`${Object.hasOwn(out, "scene")}/${Object.hasOwn(out, "lamps")}/${JSON.stringify(out) === JSON.stringify(base)}`).toBe("false/false/true");
  });
});

describe("normalizeStoredRoom — 옛 마을 방 (22-05, D-03·D-29, T-22-08)", () => {
  it("map 이 town 인 판 중 방은 대기실로 되돌아간다", () => {
    const stored = { ...started(4), phase: "discussion", day: 1, map: "town" } as unknown as RoomState;
    const out = normalizeStoredRoom(stored, 5000);
    expect(`${out.phase}/${Object.hasOwn(out, "map")}/${out.code}/${out.hostId}`).toBe("lobby/false/0420/player-id-0000-aaaa");
  });

  it("map 이 town 인 끝난 방(ended)도 대기실로 되돌아간다", () => {
    const stored = { ...started(4), phase: "ended", day: 3, winner: "citizens", map: "town" } as unknown as RoomState;
    expect(normalizeStoredRoom(stored, 5000).phase).toBe("lobby");
  });

  it("판 중 방의 mapChoice 가 town 이면 대기실로 되돌린 뒤 mapChoice 는 기본값(키 없음)이다", () => {
    const stored = { ...started(4), phase: "discussion", day: 1, mapChoice: "town" } as unknown as RoomState;
    const out = normalizeStoredRoom(stored, 5000);
    expect(`${out.phase}/${Object.hasOwn(out, "mapChoice")}`).toBe("lobby/false");
  });

  it("대기실 방의 mapChoice 가 town 이면 기본값으로 정규화되고 나머지는 그대로다", () => {
    const base = lobby(4);
    const { mapChoice: _kept, ...rest } = base;
    const stored = { ...base, mapChoice: "town" } as unknown as RoomState;
    const out = normalizeStoredRoom(stored, 5000);
    expect(`${out.phase}/${Object.hasOwn(out, "mapChoice")}/${JSON.stringify(out) === JSON.stringify(rest)}`).toBe("lobby/false/true");
  });

  it("맵이 bar·plaza 인 판 중 방과 plaza 를 고른 대기실 방은 같은 객체다 (DO 재기동 안전)", () => {
    const playing = { ...started(4), phase: "discussion", day: 1 } as unknown as RoomState;
    const idle = lobby(4);
    expect(`${normalizeStoredRoom(playing, 5000) === playing}/${normalizeStoredRoom(idle, 5000) === idle}`).toBe("true/true");
  });
});

describe("normalizeStoredRoom — 옛 심부름 방 (22-06, D-04·D-03, T-22-10)", () => {
  const ERRAND_PLAYER_KEYS = ["errandPlaces", "errandDone", "errandNear", "errandSeen", "errandFake"] as const;

  it("errand 단계로 저장된 방은 PHASE_DEFS 에 없는 단계라 tick 이 죽기 전에 대기실로 되돌아가고 방·사람 식별은 남는다", () => {
    const stored = { ...started(4), phase: "errand", day: 1, errandTickAt: 9000 } as unknown as RoomState;
    const out = normalizeStoredRoom(stored, 5000);
    const people = out.players.map((p) => `${p.id}/${p.seat}`).join(",");
    const want = stored.players.map((p) => `${p.id}/${p.seat}`).join(",");
    expect(`${out.phase}/${out.code}/${out.hostId}/${people === want}/${out.phaseEndsAt}/${Object.hasOwn(out, "errandTickAt")}`).toBe("lobby/0420/player-id-0000-aaaa/true/null/false");
  });

  it("심부름 개인 키(errandPlaces·errandDone·errandNear·errandSeen·errandFake)를 가진 판 중 방은 각각 대기실로 되돌아가고 그 키는 남지 않는다", () => {
    for (const key of ERRAND_PLAYER_KEYS) {
      const base = started(4);
      const stored = { ...base, phase: "discussion", day: 1, players: base.players.map((p, i) => (i === 0 ? { ...p, [key]: [] } : p)) } as unknown as RoomState;
      const out = normalizeStoredRoom(stored, 5000);
      expect(`${key}:${out.phase}/${out.players.some((p) => Object.hasOwn(p, key))}`).toBe(`${key}:lobby/false`);
    }
  });

  it("마지막 목격 줄(errandLast)·표본 시각(errandTickAt) 방 키가 있는 판 중 방도 대기실로 되돌아간다", () => {
    for (const key of ["errandLast", "errandTickAt"]) {
      const stored = { ...started(4), phase: "morning", day: 1, [key]: key === "errandLast" ? [] : 1 } as unknown as RoomState;
      const out = normalizeStoredRoom(stored, 5000);
      expect(`${key}:${out.phase}/${Object.hasOwn(out, key)}`).toBe(`${key}:lobby/false`);
    }
  });

  it("대기실 방에 남은 심부름 키는 지워지고 나머지는 그대로다", () => {
    const base = lobby(4);
    const stored = { ...base, errandTickAt: 1, players: base.players.map((p, i) => (i === 1 ? { ...p, errandPlaces: ["glass"], errandDone: [] } : p)) } as unknown as RoomState;
    const out = normalizeStoredRoom(stored, 5000);
    expect(`${Object.hasOwn(out, "errandTickAt")}/${out.players.some((p) => Object.hasOwn(p, "errandPlaces") || Object.hasOwn(p, "errandDone"))}/${JSON.stringify(out) === JSON.stringify(base)}`).toBe("false/false/true");
  });

  it("심부름 키가 없는 판 중 방은 같은 객체다 (DO 재기동 안전, T-22-04)", () => {
    const plain = { ...started(4), phase: "discussion", day: 1 } as RoomState;
    expect(normalizeStoredRoom(plain, 5000)).toBe(plain);
  });
});

describe("normalizeStoredRoom — 옛 판 종류 방 (22-07, D-01·D-03·D-29, T-22-13)", () => {
  it("mode 가 basic 으로 저장된 토론 방은 대기실로 되돌아가고 mode 키는 남지 않으며 방·사람 식별은 남는다", () => {
    const stored = { ...started(4), phase: "discussion", day: 1, mode: "basic" } as unknown as RoomState;
    const out = normalizeStoredRoom(stored, 5000);
    const people = out.players.map((p) => `${p.id}/${p.seat}`).join(",");
    const want = stored.players.map((p) => `${p.id}/${p.seat}`).join(",");
    expect(`${out.phase}/${out.code}/${out.hostId}/${people === want}/${out.phaseEndsAt}/${Object.hasOwn(out, "mode")}`).toBe("lobby/0420/player-id-0000-aaaa/true/null/false");
  });

  it("mode 가 extended 로 저장된 끝난 방(ended)도 대기실로 되돌아간다", () => {
    const stored = { ...started(4), phase: "ended", day: 2, winner: "citizens", mode: "extended" } as unknown as RoomState;
    const out = normalizeStoredRoom(stored, 5000);
    expect(`${out.phase}/${Object.hasOwn(out, "mode")}/${Object.hasOwn(out, "winner")}`).toBe("lobby/false/false");
  });

  it("mode 가 extended 로 저장된 대기실 방은 mode 키만 지워지고 나머지는 그대로다", () => {
    const base = lobby(4);
    const stored = { ...base, mode: "extended" } as unknown as RoomState;
    const out = normalizeStoredRoom(stored, 5000);
    expect(`${Object.hasOwn(out, "mode")}/${JSON.stringify(out) === JSON.stringify(base)}`).toBe("false/true");
  });

  it("허용 밖 값(turbo)이 저장된 방도 mode 키는 지워진다", () => {
    const stored = { ...lobby(4), mode: "turbo" } as unknown as RoomState;
    expect(Object.hasOwn(normalizeStoredRoom(stored, 5000), "mode")).toBe(false);
  });

  it("players[].stats 키를 가진 판 중 방은 대기실로 되돌아가고 대기실 방은 그 키만 지워진다", () => {
    const base = started(4);
    const playing = { ...base, phase: "discussion", day: 1, players: base.players.map((p, i) => (i === 0 ? { ...p, stats: { emotes: 1, says: 2 } } : p)) } as unknown as RoomState;
    const out = normalizeStoredRoom(playing, 5000);
    expect(`${out.phase}/${out.players.some((p) => Object.hasOwn(p, "stats"))}`).toBe("lobby/false");
    const lob = lobby(4);
    const stored = { ...lob, players: lob.players.map((p, i) => (i === 1 ? { ...p, stats: { emotes: 0, says: 0 } } : p)) } as unknown as RoomState;
    const outLobby = normalizeStoredRoom(stored, 5000);
    expect(`${outLobby.players.some((p) => Object.hasOwn(p, "stats"))}/${JSON.stringify(outLobby) === JSON.stringify(lob)}`).toBe("false/true");
  });

  it("mode 키가 없는 판 중 방은 같은 객체다 (DO 재기동 안전, T-22-04)", () => {
    const plain = { ...started(4), phase: "discussion", day: 1 } as RoomState;
    expect(normalizeStoredRoom(plain, 5000)).toBe(plain);
  });
});

describe("isLegacyV3Room · toLobbyFromLegacy", () => {
  it("판정: tutorial·errand 단계, tutorialPassed·tutorialDone·errandPlaces·mode·stats 키, map town 만 참이고 표시 없는 방은 거짓이다", () => {
    const plain = started(4);
    const withDone = { ...plain, players: plain.players.map((p, i) => (i === 0 ? { ...p, tutorialDone: true } : p)) } as unknown as RoomState;
    const town = { ...plain, map: "town" } as unknown as RoomState;
    const errandPhase = { ...plain, phase: "errand" } as unknown as RoomState;
    const errandKey = { ...plain, players: plain.players.map((p, i) => (i === 0 ? { ...p, errandPlaces: [] } : p)) } as unknown as RoomState;
    const modeKey = { ...plain, mode: "basic" } as unknown as RoomState;
    const statsKey = { ...plain, players: plain.players.map((p, i) => (i === 0 ? { ...p, stats: {} } : p)) } as unknown as RoomState;
    const flags = [oldTutorialRoom(), { ...plain, tutorialPassed: [HOST] } as unknown as RoomState, withDone, town, errandPhase, errandKey, modeKey, statsKey, plain, lobby(4)].map((s) => isLegacyV3Room(s));
    expect(flags.join(",")).toBe("true,true,true,true,true,true,true,true,false,false");
  });

  it("toLobbyFromLegacy 는 입력 상태를 바꾸지 않는다", () => {
    const stored = oldTutorialRoom();
    const before = JSON.stringify(stored);
    toLobbyFromLegacy(stored);
    expect(JSON.stringify(stored)).toBe(before);
  });
});
