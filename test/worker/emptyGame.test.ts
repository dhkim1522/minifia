// 결정 0076: 게임 중 사람이 모두 끊긴 방은 EMPTY_GAME_CLOSE_MS 뒤에 닫힌다(버려진 방이 만료 3시간까지 단계를 돌며 저장소를 쓰지 않게).
import { env } from "cloudflare:workers";
import { runDurableObjectAlarm } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { EMPTY_GAME_CLOSE_MS } from "../../shared/game/continuity";
import { alarmOf, mapPlayers, startedGame, storedRoom, until, writeRoomEdit } from "./helpers";

type Raw = { connected: boolean; isBot?: true; disconnectedAt?: number };
const humansOf = async (code: string): Promise<Raw[]> => ((await storedRoom(code)).players as unknown as Raw[]).filter((p) => p.isBot !== true);

describe("버려진 게임 방 닫기 (결정 0076)", () => {
  it("모두 끊기면 알람이 마지막 끊김 + 5분에 걸리고, 그 시각이 지나면 방이 지워진다", async () => {
    const g = await startedGame("discussion", 3);
    for (const s of g.socks) s.ws.close(1000, "bye");
    await until("모두 끊김", async () => (await humansOf(g.code)).every((p) => !p.connected && p.disconnectedAt !== undefined));
    const last = Math.max(...(await humansOf(g.code)).map((p) => p.disconnectedAt!));
    expect(await alarmOf(g.code)).toBeLessThanOrEqual(last + EMPTY_GAME_CLOSE_MS);

    const stub = env.ROOM.getByName(g.code);
    await writeRoomEdit(stub, (room) => mapPlayers(room, (p) => (p.isBot === true ? p : { ...p, disconnectedAt: Date.now() - EMPTY_GAME_CLOSE_MS - 1 })));
    await runDurableObjectAlarm(stub);
    expect(await storedRoom(g.code)).toBeUndefined();
  }, 30_000);

  it("한 사람이라도 연결돼 있으면 닫지 않는다", async () => {
    const g = await startedGame("discussion", 3);
    for (const s of g.socks.slice(1)) s.ws.close(1000, "bye");
    await until("손님 끊김", async () => (await humansOf(g.code)).filter((p) => !p.connected).length === 3);
    const stub = env.ROOM.getByName(g.code);
    await writeRoomEdit(stub, (room) => mapPlayers(room, (p) => (p.connected === true ? p : { ...p, disconnectedAt: Date.now() - EMPTY_GAME_CLOSE_MS - 1 })));
    await runDurableObjectAlarm(stub);
    expect(await storedRoom(g.code)).toBeDefined();
  }, 30_000);
});
