import { describe, expect, it } from "vitest";
import { createRoomState, joinRoom } from "../../shared/game/room";
import type { RoomState } from "../../shared/game/room";
import { buildPreview, buildView } from "../../shared/game/view";

function newRoom(nickname = "민수"): RoomState {
  const r = createRoomState({ code: "0420", hostId: "h1", hostToken: "token-host-0123456789", hostNickname: nickname, now: 1000 });
  if (!r.ok) throw new Error("expected ok");
  return r.state;
}

function withJoin(state: RoomState, id: string, nickname: string): RoomState {
  const r = joinRoom(state, { playerId: id, token: `token-${id}-0123456789`, nickname });
  if (!r.ok) throw new Error(`expected join ok, got ${r.error}`);
  return r.state;
}

describe("buildPreview (대기실)", () => {
  it("링크로 들어온 사람이 자리 순 {seat, nickname} 으로 미리보기에 나타난다", () => {
    const s = withJoin(newRoom("민수"), "p2", "서준");
    expect(buildPreview(s)).toEqual({
      code: "0420",
      hostNickname: "민수",
      playerCount: 2,
      maxPlayers: 8,
      phase: "lobby",
      players: [
        { seat: 0, nickname: "민수" },
        { seat: 1, nickname: "서준" },
      ],
    });
  });

  it("같은 상태의 buildView 에도 들어온 사람이 나타난다", () => {
    const s = withJoin(newRoom(), "p2", "서준");
    const view = buildView(s, "p2", 5000);
    expect(view.players).toHaveLength(2);
    expect(view.me.seat).toBe(1);
  });
});

// ---- 누출 검사 ----

const SECRET_WORDS = ["mafia", "police", "doctor", "citizen", "connected"];

/** 손으로 만든 방. 플레이어마다 미래 필드(role)까지 붙여, 새 필드가 생겨도 미리보기로 새지 않는지 본다. */
function leakyRoom(phase: RoomState["phase"]): RoomState {
  const base = newRoom("민수");
  const players = [
    { id: "id-zero-aaa", token: "token-secret-aaa", seat: 0, nickname: "민수", joinSeq: 0, connected: true, role: "mafia" },
    { id: "id-two-bbb", token: "token-secret-bbb", seat: 2, nickname: "서준", joinSeq: 2, connected: false, role: "police" },
    { id: "id-one-ccc", token: "token-secret-ccc", seat: 1, nickname: "지아", joinSeq: 1, connected: true, role: "doctor" },
    { id: "id-three-ddd", token: "token-secret-ddd", seat: 3, nickname: "하준", joinSeq: 3, connected: false, role: "citizen" },
  ].map((p) => ({ ...p, nicknameKey: p.nickname, connId: p.connected ? `conn-${p.seat}` : null }));
  return { ...base, phase, hostId: "id-zero-aaa", players } as unknown as RoomState;
}

describe("buildPreview 누출 검사", () => {
  for (const phase of ["lobby", "assigning", "roleReveal", "dayAnnounce", "claim", "discussion"] as const) {
    it(`${phase} 단계: 토큰·내부 id·역할·연결 상태 문자열이 직렬화에 없다`, () => {
      const text = JSON.stringify(buildPreview(leakyRoom(phase)));
      for (const secret of ["token-secret-", "id-zero-aaa", "id-two-bbb", "id-one-ccc", "id-three-ddd", "conn-", ...SECRET_WORDS]) {
        expect(text, `"${secret}" 가 미리보기에 있다`).not.toContain(secret);
      }
    });
  }

  it("대기실: players 항목은 정확히 nickname·seat 두 키이고 seat 오름차순이다", () => {
    const players = buildPreview(leakyRoom("lobby")).players;
    expect(players.map((p) => p.seat)).toEqual([0, 1, 2, 3]);
    for (const p of players) expect(Object.keys(p).sort()).toEqual(["nickname", "seat"]);
  });

  it("대기실 밖 단계: 앉은 사람 목록을 공개하지 않지만 playerCount 는 끊긴 사람을 포함한 자리 수다", () => {
    for (const phase of ["assigning", "roleReveal", "dayAnnounce", "claim", "discussion"] as const) {
      const preview = buildPreview(leakyRoom(phase));
      expect(preview.players).toEqual([]);
      expect(preview.playerCount).toBe(4);
      expect(preview.phase).toBe(phase);
    }
  });

  it("미리보기 최상위 키는 허용 목록뿐이다", () => {
    expect(Object.keys(buildPreview(leakyRoom("lobby"))).sort()).toEqual([
      "code",
      "hostNickname",
      "maxPlayers",
      "phase",
      "playerCount",
      "players",
    ]);
  });
});
