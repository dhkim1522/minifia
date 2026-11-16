// 22-03: 옛 방 정규화(결정 0089, D-03·D-29) — 옛 표시가 있는 방만 대기실로 되돌리고, 표시 없는 판은 DO 가 다시 깨어나도 그대로 둔다.
// 이후 계획(22-04~22-07)이 같은 판정(isLegacyV3Room)에 표시(등불·현장·건너뛰기 키, town, errand 단계·키, mode 키)를 하나씩 더한다.
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

describe("isLegacyV3Room · toLobbyFromLegacy", () => {
  it("판정: tutorial 단계·tutorialPassed·tutorialDone 만 참이고 표시 없는 방은 거짓이다", () => {
    const plain = started(4);
    const withDone = { ...plain, players: plain.players.map((p, i) => (i === 0 ? { ...p, tutorialDone: true } : p)) } as unknown as RoomState;
    const flags = [oldTutorialRoom(), { ...plain, tutorialPassed: [HOST] } as unknown as RoomState, withDone, plain, lobby(4)].map((s) => isLegacyV3Room(s));
    expect(flags.join(",")).toBe("true,true,true,false,false");
  });

  it("toLobbyFromLegacy 는 입력 상태를 바꾸지 않는다", () => {
    const stored = oldTutorialRoom();
    const before = JSON.stringify(stored);
    toLobbyFromLegacy(stored);
    expect(JSON.stringify(stored)).toBe(before);
  });
});
