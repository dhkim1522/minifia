// 방 연속성(11-04): 방장 자동 이양(D-17, CONNX-01). 서버 전용 연결 기록(disconnectedAt·left)은 프레임에 새지 않는다 (L43).
// 시간을 기다리지 않는다 — 저장된 disconnectedAt 을 과거로 옮기고 알람을 당겨 돌린다(테스트 방의 유예는 3초).
import { env } from "cloudflare:workers";
import { runDurableObjectAlarm } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import type { ServerMessage } from "../../shared/protocol";
import { alarmOf, connect, editRoom, hello, mapPlayers, nextFrame, seat, storedRoom, until } from "./helpers";

type StoredPlayer = { id: string; seat: number; connected: boolean; disconnectedAt?: number; left?: true };
type StoredHost = { hostId: string; players: StoredPlayer[] };

const stored = async (code: string): Promise<StoredHost> => (await storedRoom(code)) as unknown as StoredHost;

const seatState = (seatNo: number, connected: boolean) => (m: ServerMessage): boolean =>
  m.t === "state" && m.view.players.find((p) => p.seat === seatNo)?.connected === connected;

const hostSeatOf = (m: ServerMessage): number | undefined =>
  m.t === "state" ? m.view.players.find((p) => p.isHost)?.seat : undefined;

/** 저장된 방장 자리의 disconnectedAt 을 과거로 옮겨 유예가 지난 것으로 만든다(DO 를 evict 하므로 소켓은 하이버네이션). */
async function agePast(code: string, hostId: string, ms: number): Promise<void> {
  await editRoom(code, (room) =>
    mapPlayers(room, (p) => (p.id === hostId ? { ...p, disconnectedAt: Date.now() - ms } : p)),
  );
}

describe("방장 이양 (D-17, CONNX-01)", () => {
  it("방장 소켓이 끊기면 connected false 가 바로 가고 disconnectedAt 이 기록되며 알람이 유예 시각으로 맞춰진다 — 아직 이양은 없다", async () => {
    const r = await seat(2, 0, { testMode: true });
    const g1 = r.guests[0]!;
    r.host.ws.close();
    await nextFrame(g1.sock, seatState(0, false));
    await until("알람이 유예 시각", async () => {
      const room = await stored(r.code);
      const host = room.players.find((p) => p.id === room.hostId)!;
      return host.disconnectedAt !== undefined && (await alarmOf(r.code)) === host.disconnectedAt + 3000;
    });
    const room = await stored(r.code);
    expect(room.players.find((p) => p.id === room.hostId)!.connected).toBe(false);
    // 유예 안에 알람이 돌아도 이양은 없다(멱등).
    await runDurableObjectAlarm(env.ROOM.getByName(r.code));
    const after = await stored(r.code);
    expect(after.hostId).toBe(room.hostId);
  });

  it("유예가 지나 알람이 돌면 연결된 사람 중 joinSeq 가 가장 작은 사람에게 넘어가고 새 방장만 me.isHost 가 true 다", async () => {
    const r = await seat(2, 0, { testMode: true });
    const [g1, g2] = r.guests as [(typeof r.guests)[number], (typeof r.guests)[number]];
    const before = await stored(r.code);
    r.host.ws.close();
    await nextFrame(g1.sock, seatState(0, false));
    await until("disconnectedAt 기록", async () => (await stored(r.code)).players.find((p) => p.id === before.hostId)?.disconnectedAt !== undefined);
    g1.sock.cursor = g1.sock.frames.length;
    g2.sock.cursor = g2.sock.frames.length;
    await agePast(r.code, before.hostId, 10_000);
    expect(await runDurableObjectAlarm(env.ROOM.getByName(r.code))).toBe(true);

    const m1 = await nextFrame(g1.sock, (m) => m.t === "state" && m.view.me.isHost);
    const m2 = await nextFrame(g2.sock, (m) => m.t === "state" && m.view.players.find((p) => p.isHost)?.seat === g1.seat);
    expect(m1.t === "state" && m1.view.me.isHost).toBe(true);
    expect(m2.t === "state" && m2.view.me.isHost).toBe(false);
    const after = await stored(r.code);
    expect(after.players.find((p) => p.id === after.hostId)!.seat).toBe(g1.seat);
  });

  it("옛 방장이 같은 토큰으로 돌아오면 일반 참가자로 들어오고 방장은 되돌려지지 않는다", async () => {
    const r = await seat(2, 0, { testMode: true });
    const g1 = r.guests[0]!;
    const before = await stored(r.code);
    r.host.ws.close();
    await nextFrame(g1.sock, seatState(0, false));
    await until("disconnectedAt 기록", async () => (await stored(r.code)).players.find((p) => p.id === before.hostId)?.disconnectedAt !== undefined);
    await agePast(r.code, before.hostId, 10_000);
    await runDurableObjectAlarm(env.ROOM.getByName(r.code));
    await nextFrame(g1.sock, (m) => m.t === "state" && m.view.me.isHost);

    const back = await connect(r.code);
    const first = await hello(back, r.hostToken);
    expect(first.view.me.isHost).toBe(false);
    expect(first.view.players.find((p) => p.isHost)?.seat).toBe(g1.seat);
    const room = await stored(r.code);
    expect(room.hostId).not.toBe(before.hostId);
    expect(room.players.find((p) => p.id === before.hostId)!.disconnectedAt).toBeUndefined();
  });

  it("유예 안에 돌아오면 이양이 없다", async () => {
    const r = await seat(2, 0, { testMode: true });
    const g1 = r.guests[0]!;
    const before = await stored(r.code);
    r.host.ws.close();
    await nextFrame(g1.sock, seatState(0, false));
    const back = await connect(r.code);
    const first = await hello(back, r.hostToken);
    expect(first.view.me.isHost).toBe(true);
    await runDurableObjectAlarm(env.ROOM.getByName(r.code));
    expect((await stored(r.code)).hostId).toBe(before.hostId);
  });

  it("연결된 후보가 없으면 방장은 그대로고, 후보가 다시 연결되는 순간 유예를 넘겼으면 그 자리에서 넘어간다", async () => {
    const r = await seat(1, 0, { testMode: true });
    const g1 = r.guests[0]!;
    const before = await stored(r.code);
    g1.sock.ws.close();
    r.host.ws.close();
    await until("둘 다 끊김 기록", async () => (await stored(r.code)).players.every((p) => !p.connected && p.disconnectedAt !== undefined));
    await editRoom(r.code, (room) => mapPlayers(room, (p) => ({ ...p, disconnectedAt: Date.now() - 10_000 })));
    await runDurableObjectAlarm(env.ROOM.getByName(r.code));
    expect((await stored(r.code)).hostId).toBe(before.hostId);

    const back = await connect(r.code);
    const first = await hello(back, g1.token);
    expect(first.view.me.isHost).toBe(true);
    expect((await stored(r.code)).hostId).not.toBe(before.hostId);
  });
});
