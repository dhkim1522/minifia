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
