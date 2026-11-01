import { describe, expect, it } from "vitest";
import {
  ROOM_TTL_MS,
  UNCONNECTED_ROOM_TTL_MS,
  attachConnection,
  checkStart,
  connectedCount,
  createRoomState,
  detachConnection,
  findPlayerByToken,
  joinRoom,
  kickPlayer,
  leaveRoom,
  normalizeStoredRoom,
  startGame,
} from "../../shared/game/room";
import type { RoomState } from "../../shared/game/room";
import { ASSIGNING_MS, DAY_ANNOUNCE_MS, DISCUSSION_MS, ROLE_REVEAL_MS } from "../../shared/game/phases";
import { tick } from "../../shared/game/tick";
import type { PhaseId } from "../../shared/protocol";
import { ROLE_IDS, ROLE_TABLE } from "../../shared/game/roles";
import type { RoleId } from "../../shared/game/roles";
import { seededRandInt } from "../helpers/seededRandom";
import { buildView } from "../../shared/game/view";
import { nicknameKey, validateNickname } from "../../shared/nickname";

interface Spec {
  id: string;
  seat: number;
  joinSeq: number;
  connected?: boolean;
  nickname?: string;
}

/** 손으로 만든 상태. 첫 번째 사람이 방장이다. */
function room(specs: Spec[], extra: Partial<RoomState> = {}): RoomState {
  const players = specs.map((s) => {
    const nickname = s.nickname ?? `이름${s.seat}`;
    return {
      id: s.id,
      token: `token-${s.id}-0123456789`,
      seat: s.seat,
      nickname,
      nicknameKey: nicknameKey(nickname),
      joinSeq: s.joinSeq,
      connected: s.connected ?? false,
      connId: s.connected ? `c-${s.id}` : null,
    };
  });
  return {
    code: "0420",
    createdAt: 0,
    expiresAt: ROOM_TTL_MS,
    phase: "lobby",
    phaseEndsAt: null,
    hostId: specs[0]!.id,
    nextJoinSeq: Math.max(...specs.map((s) => s.joinSeq)) + 1,
    players,
    ...extra,
  };
}

/** 자리 0~7 이 모두 찬 방. connectedSeats 에 든 자리만 연결 중이다. */
function fullRoom(connectedSeats: number[] = []): RoomState {
  return room(
    Array.from({ length: 8 }, (_, i) => ({ id: `p${i}`, seat: i, joinSeq: i, connected: connectedSeats.includes(i) })),
  );
}

/** 결과를 한 단어로: 성공이면 "ok", 거절이면 오류 코드. 실패 보고서가 한 줄로 읽힌다. */
function outcome(r: { ok: true } | { ok: false; error: string }): string {
  return r.ok ? "ok" : r.error;
}

function join(state: RoomState, id: string, nickname: string) {
  return joinRoom(state, { playerId: id, token: `token-${id}-0123456789`, nickname });
}

function mustJoin(state: RoomState, id: string, nickname: string): RoomState {
  const r = join(state, id, nickname);
  if (!r.ok) throw new Error(`expected join ok, got ${r.error}`);
  return r.state;
}

function hostIdAfterLeave(state: RoomState, leaverId: string): string {
  const r = leaveRoom(state, leaverId);
  if (!r.ok || r.state === null) throw new Error("expected a room to remain");
  return r.state.hostId;
}

function newRoom(nickname = "민수"): RoomState {
  const r = createRoomState({ code: "0420", hostId: "h1", hostToken: "token-host-0123456789", hostNickname: nickname, now: 1000 });
  if (!r.ok) throw new Error("expected ok");
  return r.state;
}

describe("createRoomState", () => {
  it("방장은 seat 0, 연결 안 됨, 대기실 단계로 시작하고 만료 시각이 정해진다", () => {
    const s = newRoom("  Alice  ");
    expect(s.phase).toBe("lobby");
    expect(s.phaseEndsAt).toBeNull();
    // 연결자가 한 번도 없었던 방은 짧게 산다(WR-05) — 첫 attachConnection 이 ROOM_TTL_MS 로 늘린다.
    expect(s.expiresAt).toBe(1000 + UNCONNECTED_ROOM_TTL_MS);
    expect(s.nextJoinSeq).toBe(1);
    const host = s.players[0]!;
    expect(host.seat).toBe(0);
    expect(host.nickname).toBe("Alice");
    expect(host.nicknameKey).toBe("alice");
    expect(host.connected).toBe(false);
    expect(host.connId).toBeNull();
    expect(s.hostId).toBe(host.id);
  });

  it("닉네임은 shared/nickname.ts 규칙으로 정규화되고 nicknameKey 는 그 결과 key 다", () => {
    const checked = validateNickname("민수");
    if (!checked.ok) throw new Error("expected valid nickname");
    const host = newRoom("  민수 ").players[0]!;
    expect(host.nickname).toBe("민수");
    expect(host.nicknameKey).toBe(checked.key);
    // 전각은 NFKC 로 맞춘 key 를 저장한다 (표시 이름은 그대로)
    const wide = newRoom("ＭＩＮＳＵ").players[0]!;
    expect(wide.nickname).toBe("ＭＩＮＳＵ");
    expect(wide.nicknameKey).toBe("minsu");
  });

  it("빈 닉네임·공백·9글자·줄바꿈 포함은 NICKNAME_INVALID", () => {
    for (const nick of ["", "   ", "가나다라마바사아자", "a\nb"]) {
      const r = createRoomState({ code: "0420", hostId: "h", hostToken: "t", hostNickname: nick, now: 0 });
      expect(r).toEqual({ ok: false, error: "NICKNAME_INVALID" });
    }
  });

  it("CR-01: 방장 닉네임이 채움 문자면 NICKNAME_INVALID", () => {
    const r = createRoomState({ code: "0420", hostId: "h", hostToken: "t", hostNickname: "\u{3164}", now: 0 });
    expect(r.ok ? "ok" : r.error).toBe("NICKNAME_INVALID");
  });

  it("글자 수는 grapheme 으로 센다 (이모지 5개는 통과, 가족 이모지 5개도 통과)", () => {
    const emoji = createRoomState({ code: "0420", hostId: "h", hostToken: "t", hostNickname: "😀".repeat(5), now: 0 });
    expect(emoji.ok).toBe(true);
    const family = createRoomState({ code: "0420", hostId: "h", hostToken: "t", hostNickname: "👨‍👩‍👧".repeat(5), now: 0 });
    expect(family.ok).toBe(true);
  });
});

describe("joinRoom (성공 경로)", () => {
  it("방장만 있는 방에 들어오면 seat 1·joinSeq 1·연결 안 됨으로 앉고 nextJoinSeq 가 늘어난다", () => {
    const s = newRoom("민수");
    const r = joinRoom(s, { playerId: "p2", token: "token-p2-0123456789", nickname: "서준" });
    if (!r.ok) throw new Error("expected ok");
    expect(r.player.seat).toBe(1);
    expect(r.player.joinSeq).toBe(1);
    expect(r.player.connected).toBe(false);
    expect(r.player.connId).toBeNull();
    expect(r.player.nickname).toBe("서준");
    expect(r.state.nextJoinSeq).toBe(2);
    expect(r.state.players).toHaveLength(2);
  });

  it("입력 상태를 바꾸지 않고 새 객체를 돌려준다", () => {
    const s = newRoom();
    const before = JSON.stringify(s);
    const r = joinRoom(s, { playerId: "p2", token: "token-p2-0123456789", nickname: "서준" });
    expect(JSON.stringify(s)).toBe(before);
    if (!r.ok) throw new Error("expected ok");
    expect(r.state).not.toBe(s);
  });
});

describe("joinRoom (거절 순서)", () => {
  it("자리 8개가 찬 방(끊긴 사람 포함)에 9번째는 ROOM_FULL 이고 상태는 그대로다", () => {
    const s = fullRoom([0, 1, 2, 3, 4]); // 3명은 연결이 끊겨 있다
    const before = JSON.stringify(s);
    expect(outcome(join(s, "p8", "아홉째"))).toBe("ROOM_FULL");
    expect(JSON.stringify(s)).toBe(before);
  });

  it("대기실이 아니면 GAME_STARTED — 정원 검사보다 먼저다", () => {
    const started = room(
      [
        { id: "a", seat: 0, joinSeq: 0 },
        { id: "b", seat: 1, joinSeq: 1 },
      ],
      { phase: "assigning" },
    );
    expect(outcome(join(started, "c", "새사람"))).toBe("GAME_STARTED");
    const startedFull: RoomState = { ...fullRoom(), phase: "roleReveal" };
    expect(outcome(join(startedFull, "p8", "아홉째"))).toBe("GAME_STARTED");
  });

  it("정원 검사가 닉네임 검사보다 먼저다", () => {
    expect(outcome(join(fullRoom(), "p8", ""))).toBe("ROOM_FULL");
  });

  it("같은 이름은 대소문자·전각을 가리지 않고 NICKNAME_TAKEN", () => {
    const s = room([{ id: "a", seat: 0, joinSeq: 0, nickname: "Minsu" }]);
    expect(outcome(join(s, "b", "minsu"))).toBe("NICKNAME_TAKEN");
    expect(outcome(join(s, "c", "ＭＩＮＳＵ"))).toBe("NICKNAME_TAKEN");
  });

  it("CR-01: ZWJ 를 끼운 이름은 원래 이름과 같아 NICKNAME_TAKEN (순서 무관)", () => {
    const a = room([{ id: "a", seat: 0, joinSeq: 0, nickname: "철수" }]);
    expect(outcome(join(a, "b", "철\u{200D}수"))).toBe("NICKNAME_TAKEN");
    const b = room([{ id: "a", seat: 0, joinSeq: 0, nickname: "철\u{200D}수" }]);
    expect(outcome(join(b, "b", "철수"))).toBe("NICKNAME_TAKEN");
  });

  it("CR-01: 변형 선택자·결합 문자를 끼운 이름은 원래 이름과 같아 NICKNAME_TAKEN", () => {
    const s = room([{ id: "a", seat: 0, joinSeq: 0, nickname: "철수" }]);
    expect(outcome(join(s, "b", "철\u{FE0F}수"))).toBe("NICKNAME_TAKEN");
    expect(outcome(join(s, "c", "철\u{0301}수"))).toBe("NICKNAME_TAKEN");
    expect(outcome(join(s, "d", "영희"))).toBe("ok");
  });

  it("CR-01: 채움 문자 이름은 NICKNAME_INVALID", () => {
    const s = room([{ id: "a", seat: 0, joinSeq: 0, nickname: "철수" }]);
    expect(outcome(join(s, "b", "\u{3164}"))).toBe("NICKNAME_INVALID");
    expect(outcome(join(s, "c", "\u{2800}"))).toBe("NICKNAME_INVALID");
  });

  it("빈 이름·줄바꿈은 NICKNAME_INVALID", () => {
    const s = newRoom();
    expect(outcome(join(s, "b", ""))).toBe("NICKNAME_INVALID");
    expect(outcome(join(s, "b", "\n"))).toBe("NICKNAME_INVALID");
  });

  it("비어 있는 가장 낮은 자리에 앉는다 (0,1,3 이 찼으면 2)", () => {
    const s = room([
      { id: "a", seat: 0, joinSeq: 0 },
      { id: "b", seat: 1, joinSeq: 1 },
      { id: "d", seat: 3, joinSeq: 2 },
    ]);
    const r = join(s, "c", "새사람");
    if (!r.ok) throw new Error("expected ok");
    expect(r.player.seat).toBe(2);
    expect(r.player.joinSeq).toBe(3);
  });
});

describe("leaveRoom", () => {
  it("방장 승계: 들어온 순서(joinSeq)가 가장 빠른 연결된 사람이 이어받는다", () => {
    let s = room([
      { id: "A", seat: 0, joinSeq: 0, connected: true },
      { id: "B", seat: 1, joinSeq: 1, connected: true },
      { id: "C", seat: 2, joinSeq: 2, connected: true },
    ]);
    const afterB = leaveRoom(s, "B");
    if (!afterB.ok || afterB.state === null) throw new Error("expected room");
    s = mustJoin(afterB.state, "D", "넷째"); // seat 1, joinSeq 3
    s = attachConnection(s, "D", "c-D");
    expect(s.players.find((p) => p.id === "D")!.seat).toBe(1);
    expect(hostIdAfterLeave(s, "A")).toBe("C");
  });

  it("방장 승계: 연결된 사람이 먼저다 (먼저 들어왔어도 끊긴 B 보다 연결된 C)", () => {
    const s = room([
      { id: "A", seat: 0, joinSeq: 0, connected: true },
      { id: "B", seat: 1, joinSeq: 1, connected: false },
      { id: "C", seat: 2, joinSeq: 2, connected: true },
    ]);
    expect(hostIdAfterLeave(s, "A")).toBe("C");
  });

  it("방장 승계: 아무도 연결되지 않았으면 전체 joinSeq 최소로 대체한다", () => {
    const s = room([
      { id: "A", seat: 0, joinSeq: 0, connected: false },
      { id: "B", seat: 1, joinSeq: 1, connected: false },
      { id: "C", seat: 2, joinSeq: 2, connected: false },
    ]);
    expect(hostIdAfterLeave(s, "A")).toBe("B");
  });

  it("방장이 아닌 사람이 나가면 방장은 그대로고 그 자리가 빈다", () => {
    const s = room([
      { id: "A", seat: 0, joinSeq: 0 },
      { id: "B", seat: 1, joinSeq: 1 },
    ]);
    const r = leaveRoom(s, "B");
    if (!r.ok || r.state === null) throw new Error("expected room");
    expect(r.state.hostId).toBe("A");
    expect(r.state.players.map((p) => p.seat)).toEqual([0]);
  });

  it("방장이 끊긴 것만으로는 방장이 바뀌지 않는다", () => {
    const s = detachConnection(
      attachConnection(
        room([
          { id: "A", seat: 0, joinSeq: 0 },
          { id: "B", seat: 1, joinSeq: 1, connected: true },
        ]),
        "A",
        "c-A",
      ),
      "A",
      "c-A",
    );
    expect(s.players[0]!.connected).toBe(false);
    expect(s.hostId).toBe("A");
  });

  it("마지막 사람이 나가면 결과 상태는 null 이다", () => {
    expect(leaveRoom(newRoom(), "h1")).toEqual({ ok: true, state: null });
  });

  it("대기실이 아니면 WRONG_PHASE, 방에 없는 id 는 NOT_IN_ROOM", () => {
    const started = room(
      [
        { id: "A", seat: 0, joinSeq: 0 },
        { id: "B", seat: 1, joinSeq: 1 },
      ],
      { phase: "assigning" },
    );
    expect(outcome(leaveRoom(started, "B"))).toBe("WRONG_PHASE");
    expect(outcome(leaveRoom(newRoom(), "nobody"))).toBe("NOT_IN_ROOM");
  });

  it("입력 상태를 바꾸지 않는다", () => {
    const s = room([
      { id: "A", seat: 0, joinSeq: 0 },
      { id: "B", seat: 1, joinSeq: 1 },
    ]);
    const before = JSON.stringify(s);
    leaveRoom(s, "A");
    expect(JSON.stringify(s)).toBe(before);
  });
});

describe("kickPlayer", () => {
  const lobby = () =>
    room([
      { id: "A", seat: 0, joinSeq: 0, connected: true },
      { id: "B", seat: 1, joinSeq: 1, connected: true },
      { id: "C", seat: 2, joinSeq: 2, connected: false, nickname: "서준" },
    ]);

  it("방장이 아닌 사람의 요청은 NOT_HOST", () => {
    expect(outcome(kickPlayer(lobby(), "B", 2))).toBe("NOT_HOST");
  });

  it("연결 중인 사람·방장 자신·빈 자리는 CANNOT_KICK", () => {
    expect(outcome(kickPlayer(lobby(), "A", 1))).toBe("CANNOT_KICK");
    expect(outcome(kickPlayer(lobby(), "A", 0))).toBe("CANNOT_KICK");
    expect(outcome(kickPlayer(lobby(), "A", 5))).toBe("CANNOT_KICK");
  });

  it("게임이 시작된 뒤에는 끊긴 사람도 CANNOT_KICK", () => {
    const started: RoomState = { ...lobby(), phase: "assigning" };
    expect(outcome(kickPlayer(started, "A", 2))).toBe("CANNOT_KICK");
  });

  it("방장이 끊긴 사람을 내보내면 그 사람이 빠지고 자리가 비어 같은 이름으로 다시 참가할 수 있다", () => {
    const s = lobby();
    const before = JSON.stringify(s);
    const r = kickPlayer(s, "A", 2);
    if (!r.ok) throw new Error("expected ok");
    expect(r.removedId).toBe("C");
    expect(r.state.players.map((p) => p.seat)).toEqual([0, 1]);
    expect(JSON.stringify(s)).toBe(before);
    const again = join(r.state, "E", "서준");
    if (!again.ok) throw new Error("expected rejoin ok");
    expect(again.player.seat).toBe(2);
  });
});

describe("connectedCount", () => {
  it("connected 가 참인 사람 수를 센다", () => {
    expect(connectedCount([{ connected: true }, { connected: false }, { connected: true }])).toBe(2);
    expect(connectedCount([])).toBe(0);
  });
});

describe("checkStart", () => {
  /** 방장(자리 0, 연결 중)을 포함해 연결 connected 명 + 끊김 disconnected 명이 앉은 대기실. */
  function lobbyOf(connected: number, disconnected: number): RoomState {
    const specs: Spec[] = [];
    for (let i = 0; i < connected + disconnected; i += 1) {
      specs.push({ id: `p${i}`, seat: i, joinSeq: i, connected: i < connected });
    }
    return room(specs);
  }

  it("연결 4 + 끊김 0 이면 시작할 수 있다", () => {
    expect(checkStart(lobbyOf(4, 0), "p0")).toBeNull();
  });

  it("연결 4 + 끊김 2(자리 6)도 시작할 수 있다 — 끊긴 사람은 자리를 지키지만 세지 않는다", () => {
    expect(checkStart(lobbyOf(4, 2), "p0")).toBeNull();
  });

  it("연결 3 + 끊김 5(자리 8)는 NOT_ENOUGH_PLAYERS", () => {
    expect(checkStart(lobbyOf(3, 5), "p0")).toBe("NOT_ENOUGH_PLAYERS");
  });

  it("참가만 하고 아직 hello 전인 4번째 사람은 세지 않는다 (연결 3 + 끊김 1)", () => {
    expect(checkStart(lobbyOf(3, 1), "p0")).toBe("NOT_ENOUGH_PLAYERS");
  });

  it("방장이 아니면 NOT_HOST, 대기실이 아니면 WRONG_PHASE", () => {
    expect(checkStart(lobbyOf(4, 0), "p1")).toBe("NOT_HOST");
    expect(checkStart({ ...lobbyOf(4, 0), phase: "roleReveal" }, "p0")).toBe("WRONG_PHASE");
  });

  it("검사 순서는 NOT_HOST → WRONG_PHASE → NOT_ENOUGH_PLAYERS 다", () => {
    expect(checkStart({ ...lobbyOf(2, 0), phase: "dayAnnounce" }, "p1")).toBe("NOT_HOST");
    expect(checkStart({ ...lobbyOf(2, 0), phase: "dayAnnounce" }, "p0")).toBe("WRONG_PHASE");
    expect(checkStart(lobbyOf(2, 0), "p0")).toBe("NOT_ENOUGH_PLAYERS");
  });
});

describe("연결 붙이기·떼기", () => {
  it("WR-05: 첫 attachConnection 이 만료를 생성 시각 + ROOM_TTL_MS 로 늘리고, 이후의 attach 는 만료를 건드리지 않는다", () => {
    const created = newRoom();
    expect(created.expiresAt).toBe(1000 + UNCONNECTED_ROOM_TTL_MS);
    const first = attachConnection(created, "h1", "c1");
    expect(first.expiresAt).toBe(1000 + ROOM_TTL_MS);
    const again = attachConnection(first, "h1", "c2");
    expect(again.expiresAt).toBe(first.expiresAt);
  });

  it("WR-05: 표시가 없는 옛 상태(이미 살아 있던 방)는 첫 attach 로 만료가 바뀌지 않는다", () => {
    const legacy = room([{ id: "h1", seat: 0, joinSeq: 0 }], { expiresAt: 5_000 });
    expect(attachConnection(legacy, "h1", "c1").expiresAt).toBe(5_000);
  });

  it("attachConnection 은 새 객체를 돌려주고 입력을 바꾸지 않는다", () => {
    const s = newRoom();
    const a = attachConnection(s, "h1", "c1");
    expect(a).not.toBe(s);
    expect(s.players[0]!.connected).toBe(false);
    expect(a.players[0]!.connected).toBe(true);
    expect(a.players[0]!.connId).toBe("c1");
  });

  it("낡은 소켓의 detach 는 새 연결을 덮지 않는다", () => {
    const s = attachConnection(attachConnection(newRoom(), "h1", "old"), "h1", "new");
    const d = detachConnection(s, "h1", "old");
    expect(d.players[0]!.connected).toBe(true);
    expect(d.players[0]!.connId).toBe("new");
    const d2 = detachConnection(s, "h1", "new");
    expect(d2.players[0]!.connected).toBe(false);
    expect(d2.players[0]!.connId).toBeNull();
  });

  it("findPlayerByToken", () => {
    const s = newRoom();
    expect(findPlayerByToken(s, "token-host-0123456789")?.id).toBe("h1");
    expect(findPlayerByToken(s, "nope")).toBeUndefined();
  });
});

describe("buildView", () => {
  it("공개 항목은 seat·nickname·connected·isHost 네 키뿐이고 토큰·id 가 직렬화에 없다", () => {
    const s = attachConnection(newRoom(), "h1", "c1");
    const view = buildView(s, "h1", 5000);
    expect(Object.keys(view.players[0]!).sort().join(",")).toBe(["alive", "connected", "isHost", "nickname", "seat"].join(","));
    expect(view.me).toEqual({ seat: 0, isHost: true, chat: "all" }); // 07-10: 대기실의 내 채널
    expect(view.serverNow).toBe(5000);
    expect(view.phaseDurationMs).toBeNull();
    const text = JSON.stringify(view);
    expect(text).not.toContain("token-host-0123456789");
    expect(text).not.toContain('"h1"');
    expect(text).not.toContain("c1");
  });

  it("players 는 seat 순으로 정렬된다", () => {
    const s = newRoom();
    const withTwo: RoomState = {
      ...s,
      players: [
        { ...s.players[0]!, id: "p2", seat: 2, nickname: "둘" },
        s.players[0]!,
      ],
    };
    expect(buildView(withTwo, "h1", 0).players.map((p) => p.seat).join(",")).toBe("0,2");
  });

  it("방에 없는 playerId 는 던진다", () => {
    expect(() => buildView(newRoom(), "nobody", 0)).toThrow();
  });
});

describe("startGame (ROLE-01, ROOM-03, 결정 0012)", () => {
  /** 방장(p0)을 포함해 connected 명이 연결 중이고 disconnected 명이 끊긴 채 앉아 있는 대기실. */
  function lobbyOf(connected: number, disconnected: number): RoomState {
    const specs: Spec[] = [];
    for (let i = 0; i < connected + disconnected; i += 1) {
      specs.push({ id: `p${i}`, seat: i, joinSeq: i, connected: i < connected });
    }
    return room(specs);
  }

  /** 역할별 인원을 "mafia:1,police:1,..." 한 줄로 — 실패 보고서가 한 줄로 읽힌다. */
  function counts(state: RoomState): string {
    return ROLE_IDS.map((r) => `${r}:${state.players.filter((p) => p.role === r).length}`).join(",");
  }
  function expected(n: 4 | 5 | 6 | 7 | 8): string {
    return ROLE_IDS.map((r) => `${r}:${ROLE_TABLE[n][r]}`).join(",");
  }
  function mustStart(state: RoomState, now: number, seed: number): RoomState {
    const r = startGame(state, "p0", now, seededRandInt(seed));
    if (!r.ok) throw new Error(`expected start ok, got ${r.error}`);
    return r.state;
  }

  it("연결 3 → NOT_ENOUGH_PLAYERS, 방장 아님 → NOT_HOST, 이미 시작함 → WRONG_PHASE (checkStart 결과 그대로)", () => {
    expect(outcome(startGame(lobbyOf(3, 0), "p0", 1000, seededRandInt(1)))).toBe("NOT_ENOUGH_PLAYERS");
    expect(outcome(startGame(lobbyOf(4, 0), "p1", 1000, seededRandInt(1)))).toBe("NOT_HOST");
    const started = mustStart(lobbyOf(4, 0), 1000, 1);
    expect(outcome(startGame(started, "p0", 2000, seededRandInt(1)))).toBe("WRONG_PHASE");
  });

  it.each([4, 5, 6, 7, 8] as const)("연결 %i명 시작 — 전원에게 구성표대로 역할이 가고 단계·마감·만료가 바뀐다", (n) => {
    const s = mustStart(lobbyOf(n, 0), 10_000, 7);
    expect(counts(s)).toBe(expected(n));
    expect(s.players.every((p) => p.role !== undefined)).toBe(true);
    expect(s.phase).toBe("assigning");
    expect(s.phaseEndsAt).toBe(10_000 + ASSIGNING_MS);
    expect(s.expiresAt).toBe(10_000 + ROOM_TTL_MS);
  });

  it("연결 4 + 끊김 2(자리 6) — 끊긴 두 사람도 포함해 6인 구성표대로 6명 모두 역할을 받는다", () => {
    const s = mustStart(lobbyOf(4, 2), 0, 3);
    expect(counts(s)).toBe("mafia:2,police:1,doctor:1,citizen:2");
    expect(counts(s)).toBe(expected(6));
    const offline = s.players.filter((p) => !p.connected);
    expect(offline.length).toBe(2);
    expect(offline.every((p) => p.role !== undefined)).toBe(true);
  });

  it("같은 시드·같은 상태는 같은 배정이고 입력 상태는 바뀌지 않는다", () => {
    const base = lobbyOf(6, 0);
    const before = JSON.stringify(base);
    const roles = (s: RoomState) => s.players.map((p) => p.role).join(",");
    expect(roles(mustStart(base, 5, 99))).toBe(roles(mustStart(base, 5, 99)));
    expect(JSON.stringify(base)).toBe(before);
    expect(base.players.every((p) => p.role === undefined)).toBe(true);
    // 시드를 바꾸면 어딘가에서 배정이 달라진다(난수원이 실제로 쓰인다)
    const variety = new Set([1, 2, 3, 4, 5, 6].map((seed) => roles(mustStart(base, 5, seed))));
    expect(variety.size > 1).toBe(true);
  });

  it("난수는 주입된 randInt 로만 — Fisher–Yates 라 n−1 번 부르고, 입력 id 순서는 seat 오름차순이다", () => {
    // 자리 순서가 배열 순서와 다른 방: 배열은 seat 5,0,3,1 순
    const specs: Spec[] = [5, 0, 3, 1].map((seat, i) => ({ id: `s${seat}`, seat, joinSeq: i, connected: true }));
    const base = room(specs, { hostId: "s0" });
    const calls: number[] = [];
    const spy = (n: number): number => {
      calls.push(n);
      return 0;
    };
    const r = startGame(base, "s0", 0, spy);
    expect(r.ok).toBe(true);
    expect(calls.length).toBe(3);
    // randInt 가 항상 0 이면 풀의 순서가 결정적이다 — 입력이 seat 오름차순(s0,s1,s3,s5)일 때만 이 배정이 나온다
    const byId = new Map<string, RoleId | undefined>(
      (r.ok ? r.state.players : []).map((p) => [p.id, p.role] as const),
    );
    const pool: RoleId[] = [];
    for (const role of ROLE_IDS) for (let i = 0; i < ROLE_TABLE[4][role]; i += 1) pool.push(role);
    for (let i = pool.length - 1; i >= 1; i -= 1) [pool[i], pool[0]] = [pool[0]!, pool[i]!];
    const seatOrdered = ["s0", "s1", "s3", "s5"];
    expect(seatOrdered.map((id) => byId.get(id)).join(",")).toBe(pool.join(","));
  });
});

describe("normalizeStoredRoom — 저장된 옛 방 (RESEARCH Pattern 6, T-02-14)", () => {
  /** 1페이즈가 저장한 모양: 종착 낮 단계 이름이 문자열 "day" 이고 마감·낮 필드가 없다. */
  function legacyDayRoom(): RoomState {
    const base = room(
      Array.from({ length: 5 }, (_, i) => ({ id: `p${i}`, seat: i, joinSeq: i, connected: true })),
      { phase: "day" as unknown as PhaseId, phaseEndsAt: null },
    );
    return { ...base, players: base.players.map((p, i) => ({ ...p, role: ROLE_IDS[i % ROLE_IDS.length] })) };
  }

  it("1페이즈 종착 낮 단계로 저장된 상태는 dayAnnounce · now+2000 · day 1 이 되고 나머지 필드·players 는 그대로다", () => {
    const stored = legacyDayRoom();
    const got = normalizeStoredRoom(stored, 5_000);
    expect(`${got.phase}:${got.phaseEndsAt}:${got.day}`).toBe(`dayAnnounce:${5_000 + DAY_ANNOUNCE_MS}:1`);
    expect(got.players === stored.players).toBe(true);
    expect(`${got.code}/${got.hostId}/${got.expiresAt}/${got.createdAt}`).toBe(
      `${stored.code}/${stored.hostId}/${stored.expiresAt}/${stored.createdAt}`,
    );
    expect(String(stored.phase)).toBe("day"); // 입력은 바꾸지 않는다
  });

  it("lobby·roleReveal·discussion 상태는 messages 키가 없으면 같은 객체를 돌려준다", () => {
    const lobby = fullRoom([0, 1, 2, 3]);
    const started = startGame(lobby, "p0", 0, seededRandInt(1));
    if (!started.ok) throw new Error(started.error);
    const roleReveal = tick(started.state, ASSIGNING_MS);
    const ticked = tick(roleReveal, ASSIGNING_MS + ROLE_REVEAL_MS + DAY_ANNOUNCE_MS);
    // tick 의 낮 시작 훅이 아직 옛 messages 빈 배열을 쓴다(02-15 가 지운다) — 이 테스트는 그 키가 없는 상태의 동일성을 본다.
    const { messages: _old, ...bare } = ticked as RoomState & { messages?: unknown };
    const discussion = bare as RoomState;
    const same = [lobby, roleReveal, discussion].map((r) => normalizeStoredRoom(r, 9_999) === r);
    expect([lobby.phase, roleReveal.phase, discussion.phase].join(",")).toBe("lobby,roleReveal,discussion");
    expect(same.join(",")).toBe("true,true,true");
  });

  /** 1·2페이즈 초기가 저장한 옛 모양: 채팅 줄을 방 상태에 쥐고 있다. 필드 선언이 사라져도 컴파일되게 단언 캐스트로 만든다. */
  const withOldMessages = (state: RoomState, lines: unknown[] = []): RoomState => ({ ...state, messages: lines }) as unknown as RoomState;

  it("저장된 방에 messages 키가 있으면(빈 배열이어도) 그 키만 지운 새 객체를 돌려주고 다른 필드·단계·마감은 그대로다 (결정 0017-7)", () => {
    const base = { ...fullRoom([0, 1, 2, 3]), phase: "discussion" as PhaseId, phaseEndsAt: 77_000 };
    for (const stored of [withOldMessages(base), withOldMessages(base, [{ seq: 1, seat: 0, template: "innocent", at: 1 }])]) {
      const got = normalizeStoredRoom(stored, 5_000);
      expect(got === stored).toBe(false);
      expect(Object.hasOwn(got, "messages")).toBe(false);
      expect(`${got.phase}:${got.phaseEndsAt}:${got.day}`).toBe(`discussion:77000:${base.day}`);
      expect(got.players === stored.players).toBe(true);
      expect(Object.hasOwn(stored, "messages")).toBe(true); // 입력은 바꾸지 않는다
    }
  });

  it("phase 가 day 이고 messages 도 있으면 dayAnnounce 정규화와 messages 정리가 함께 된다", () => {
    const stored = withOldMessages(legacyDayRoom(), [{ seq: 1, seat: 0, template: "innocent", at: 1 }]);
    const got = normalizeStoredRoom(stored, 5_000);
    expect(`${got.phase}:${got.phaseEndsAt}:${got.day}`).toBe(`dayAnnounce:${5_000 + DAY_ANNOUNCE_MS}:1`);
    expect(Object.hasOwn(got, "messages")).toBe(false);
  });

  /** 결정 0027 이전에 저장된 옛 모양: Player 의 주장 필드 넷을 쥐고 있다. 필드 선언이 사라졌으므로 단언 캐스트로 만든다. */
  const withOldClaimFields = (state: RoomState): RoomState => ({
    ...state,
    players: state.players.map((p) => ({ ...p, claimChoice: "police", claimShown: "police", claimLast: "none", claimChanged: true })),
  }) as unknown as RoomState;
  const OLD_CLAIM_KEYS = ["claimChoice", "claimShown", "claimLast", "claimChanged"];

  it("저장 단계가 옛 공개 연출 이름이면 discussion · now+90000 으로 옮기고 일차·플레이어는 그대로 둔 새 객체를 돌려준다 (결정 0027)", () => {
    const base = fullRoom([0, 1, 2, 3]);
    const stored: RoomState = { ...base, phase: "claimReveal" as unknown as PhaseId, phaseEndsAt: 77_000, day: 3 };
    const got = normalizeStoredRoom(stored, 5_000);
    expect(got === stored).toBe(false);
    expect(`${got.phase}:${got.phaseEndsAt}:${got.day}`).toBe(`discussion:${5_000 + DISCUSSION_MS}:3`);
    expect(got.players === stored.players).toBe(true);
    expect(String(stored.phase)).toBe("claimReveal"); // 입력은 바꾸지 않는다
  });

  it("옛 Player 의 주장 필드 넷은 정규화 결과에서 키째 빠진 새 객체가 되고 다른 필드는 그대로다", () => {
    const stored = withOldClaimFields({ ...fullRoom([0, 1, 2, 3]), phase: "discussion", phaseEndsAt: 77_000, day: 2 });
    const got = normalizeStoredRoom(stored, 5_000);
    expect(got === stored).toBe(false);
    for (const p of got.players) for (const key of OLD_CLAIM_KEYS) expect(Object.hasOwn(p, key)).toBe(false);
    expect(got.players.map((p) => p.id)).toEqual(stored.players.map((p) => p.id));
    expect(`${got.phase}:${got.phaseEndsAt}:${got.day}`).toBe("discussion:77000:2");
    for (const p of stored.players) expect(Object.hasOwn(p, "claimChoice")).toBe(true); // 입력은 바꾸지 않는다
  });

  it("이미 새 모양인 방은 다시 정규화해도 같은 객체다 (T-03.1-04)", () => {
    const once = normalizeStoredRoom(withOldClaimFields({ ...fullRoom([0, 1, 2]), phase: "discussion", phaseEndsAt: 77_000 }), 5_000);
    expect(normalizeStoredRoom(once, 6_000) === once).toBe(true);
  });

  it("messages 키가 없고 phase 가 day 가 아니면 같은 객체를 돌려준다", () => {
    const lobby = fullRoom([0, 1, 2]);
    expect(normalizeStoredRoom(lobby, 1) === lobby).toBe(true);
  });

  // 07-08: claim 단계가 사라졌다 — 배포 시점에 claim 으로 저장된 방은 discussion 으로 옮긴다(T-07-14).
  const CLAIM_STATE_KEYS = ["claimOrder", "claimIdx", "claimStart", "claimPick", "claimLog"];
  const withClaimState = (state: RoomState): RoomState =>
    ({
      ...state,
      claimOrder: [0, 1],
      claimIdx: 1,
      claimStart: 0,
      claimPick: "police",
      claimLog: [{ n: 2, seat: 0, claim: "police" }],
    }) as unknown as RoomState;

  it("07-08 claim 으로 저장된 방은 discussion · now+DISCUSSION_MS 가 되고 claim 계열 다섯 키가 빠지며 입력은 그대로다", () => {
    const stored = withClaimState({ ...fullRoom([0, 1, 2, 3]), phase: "claim" as PhaseId, phaseEndsAt: 77_000, day: 2 });
    const got = normalizeStoredRoom(stored, 5_000);
    expect(got === stored).toBe(false);
    expect(`${got.phase}:${got.phaseEndsAt}:${got.day}`).toBe(`discussion:${5_000 + DISCUSSION_MS}:2`);
    for (const key of CLAIM_STATE_KEYS) expect(Object.hasOwn(got, key)).toBe(false);
    expect(got.players === stored.players).toBe(true);
    expect(String(stored.phase)).toBe("claim");
    expect(Object.hasOwn(stored, "claimOrder")).toBe(true);
  });

  it("07-08 옮겨진 claim 방의 view 는 오류 없이 만들어지고 day 에 turn 이 없다", () => {
    const stored = withClaimState({ ...fullRoom([0, 1, 2, 3]), phase: "claim" as PhaseId, phaseEndsAt: 77_000, day: 2 });
    const day = buildView(normalizeStoredRoom(stored, 5_000), "p1", 5_000).day;
    expect(`${day?.n}:${Object.keys(day ?? {}).includes("turn")}`).toBe("2:false");
  });

  it("07-08 단계가 discussion 이어도 claim 계열 키가 남아 있으면 키만 지우고 단계·마감은 그대로다", () => {
    const stored = withClaimState({ ...fullRoom([0, 1, 2, 3]), phase: "discussion", phaseEndsAt: 77_000, day: 3 });
    const got = normalizeStoredRoom(stored, 5_000);
    expect(got === stored).toBe(false);
    expect(`${got.phase}:${got.phaseEndsAt}:${got.day}`).toBe("discussion:77000:3");
    for (const key of CLAIM_STATE_KEYS) expect(Object.hasOwn(got, key)).toBe(false);
    expect(normalizeStoredRoom(got, 6_000) === got).toBe(true);
  });

  it("새 optional 필드가 없는 1페이즈 모양 상태를 tick 으로 낮 단계까지 넘겨도 buildView 가 기본값으로 뷰를 만든다", () => {
    const lobby = fullRoom([0, 1, 2, 3, 4]);
    const started = startGame(lobby, "p0", 0, seededRandInt(7));
    if (!started.ok) throw new Error(started.error);
    // 1페이즈에서 저장된 방에는 차례 상태·day 가 없다
    const legacy: RoomState = {
      ...started.state,
      players: started.state.players.map((p) => {
        const { alive: _a, ...rest } = p;
        return rest;
      }),
    };
    const line = [ASSIGNING_MS, ROLE_REVEAL_MS, DAY_ANNOUNCE_MS];
    let at = 0;
    const seen: string[] = [];
    let state = legacy;
    for (const ms of line) {
      at += ms;
      state = tick(state, at);
      const view = buildView(state, "p1", at);
      seen.push(`${state.phase}:${view.day === undefined ? "-" : view.day.n}`);
    }
    expect(seen.join(" ")).toBe("roleReveal:- dayAnnounce:1 discussion:1");
    const day = buildView(state, "p1", at).day;
    expect(Object.keys(day ?? {}).includes("messages")).toBe(false);
  });

  it("day 가 아예 없는 discussion 상태도 뷰가 예외 없이 기본값(day 1)을 쥐고 messages 키는 없다", () => {
    const base = fullRoom([0, 1, 2, 3]);
    const bare: RoomState = { ...base, phase: "discussion", phaseEndsAt: 100_000 };
    const day = buildView(bare, "p2", 50_000).day;
    expect(`${day?.n}:${Object.keys(day ?? {}).includes("messages")}`).toBe("1:false");
  });
});
