import { describe, expect, it } from "vitest";
import {
  ROOM_TTL_MS,
  attachConnection,
  checkStart,
  connectedCount,
  createRoomState,
  detachConnection,
  findPlayerByToken,
  joinRoom,
  kickPlayer,
  leaveRoom,
} from "../../shared/game/room";
import type { RoomState } from "../../shared/game/room";
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
    expect(s.expiresAt).toBe(1000 + ROOM_TTL_MS);
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

  it("글자 수는 grapheme 으로 센다 (이모지 8개는 통과, 가족 이모지 8개도 통과)", () => {
    const emoji = createRoomState({ code: "0420", hostId: "h", hostToken: "t", hostNickname: "😀".repeat(8), now: 0 });
    expect(emoji.ok).toBe(true);
    const family = createRoomState({ code: "0420", hostId: "h", hostToken: "t", hostNickname: "👨‍👩‍👧".repeat(8), now: 0 });
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
    expect(checkStart({ ...lobbyOf(2, 0), phase: "day" }, "p1")).toBe("NOT_HOST");
    expect(checkStart({ ...lobbyOf(2, 0), phase: "day" }, "p0")).toBe("WRONG_PHASE");
    expect(checkStart(lobbyOf(2, 0), "p0")).toBe("NOT_ENOUGH_PLAYERS");
  });
});

describe("연결 붙이기·떼기", () => {
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
    expect(Object.keys(view.players[0]!).sort()).toEqual(["connected", "isHost", "nickname", "seat"]);
    expect(view.me).toEqual({ seat: 0, isHost: true });
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
