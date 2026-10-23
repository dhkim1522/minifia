import { exports } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import type { RoomPreview } from "../../shared/protocol";
import { createRoom, joinOk } from "./helpers";

function getPreview(code: string): Promise<Response> {
  return exports.default.fetch(`http://x/api/rooms/${code}`);
}

describe("GET /api/rooms/{code} 미리보기", () => {
  it("살아 있는 대기실이면 200 RoomPreview 이고 no-store 이며 토큰이 없다", async () => {
    const { code, token } = await createRoom("방장");
    const res = await getPreview(code);
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    const raw = await res.text();
    expect(raw).not.toContain(token);
    expect(JSON.parse(raw)).toEqual({
      code,
      hostNickname: "방장",
      playerCount: 1,
      maxPlayers: 8,
      phase: "lobby",
      players: [{ seat: 0, nickname: "방장" }],
    });
  });

  it("앉은 사람은 자리 순이고 각 항목의 키는 정확히 nickname·seat 다", async () => {
    const { code } = await createRoom("방장");
    const a = await joinOk(code, "철수");
    const b = await joinOk(code, "영희");
    const body = (await (await getPreview(code)).json()) as RoomPreview;
    expect(body.playerCount).toBe(3);
    expect(body.players.map((p) => p.seat)).toEqual([0, a.seat, b.seat]);
    for (const p of body.players) expect(Object.keys(p).sort()).toEqual(["nickname", "seat"]);
  });

  it("없는 방은 404 ROOM_NOT_FOUND", async () => {
    const res = await getPreview("0000");
    expect(res.status).toBe(404);
    expect(((await res.json()) as { error: string }).error).toBe("ROOM_NOT_FOUND");
  });

  it("4자리 숫자가 아닌 코드는 404 ROOM_NOT_FOUND", async () => {
    for (const code of ["12ab", "123", "12345"]) {
      const res = await getPreview(code);
      expect(res.status).toBe(404);
      expect(((await res.json()) as { error: string }).error).toBe("ROOM_NOT_FOUND");
    }
  });
});
