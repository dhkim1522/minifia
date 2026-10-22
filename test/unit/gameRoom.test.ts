import { describe, expect, it } from "vitest";
import {
  ROOM_TTL_MS,
  attachConnection,
  createRoomState,
  detachConnection,
  findPlayerByToken,
} from "../../shared/game/room";
import type { RoomState } from "../../shared/game/room";
import { buildView } from "../../shared/game/view";

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

  it("빈 닉네임·공백·9자 이상·줄바꿈 포함은 NICKNAME_INVALID", () => {
    for (const nick of ["", "   ", "123456789", "a\nb"]) {
      const r = createRoomState({ code: "0420", hostId: "h", hostToken: "t", hostNickname: nick, now: 0 });
      expect(r).toEqual({ ok: false, error: "NICKNAME_INVALID" });
    }
  });

  it("글자 수는 코드 포인트로 센다 (이모지 8개는 통과)", () => {
    const r = createRoomState({ code: "0420", hostId: "h", hostToken: "t", hostNickname: "😀".repeat(8), now: 0 });
    expect(r.ok).toBe(true);
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
