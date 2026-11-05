// 방 연속성(11-04): 방장 자동 이양(D-17, CONNX-01). 서버 전용 연결 기록(disconnectedAt·left)은 프레임에 새지 않는다 (L43).
// 시간을 기다리지 않는다 — 저장된 disconnectedAt 을 과거로 옮기고 알람을 당겨 돌린다(테스트 방의 유예는 3초).
import { env } from "cloudflare:workers";
import { runDurableObjectAlarm } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import type { ServerMessage } from "../../shared/protocol";
import { alarmOf, closed, connect, editRoom, endedGame4, flushWorld, hello, mapPlayers, nextFrame, seat, send, startedGame, storedRoom, until, worldOf } from "./helpers";

type StoredPlayer = { id: string; seat: number; connected: boolean; disconnectedAt?: number; left?: true };
type StoredHost = { hostId: string; players: StoredPlayer[] };

const stored = async (code: string): Promise<StoredHost> => (await storedRoom(code)) as unknown as StoredHost;

const seatState = (seatNo: number, connected: boolean) => (m: ServerMessage): boolean =>
  m.t === "state" && m.view.players.find((p) => p.seat === seatNo)?.connected === connected;

const hostSeatOf = (m: ServerMessage): number | undefined =>
  m.t === "state" ? m.view.players.find((p) => p.isHost)?.seat : undefined;

/** 유예(3초)는 넘고 정리 시간(6초)은 안 넘은 끊긴 지 시간 — 이양만 일어나고 옛 방장은 아직 지워지지 않는다. */
const PAST_GRACE_MS = 4000;

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
    await agePast(r.code, before.hostId, PAST_GRACE_MS);
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
    await agePast(r.code, before.hostId, PAST_GRACE_MS);
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
    await editRoom(r.code, (room) => mapPlayers(room, (p) => ({ ...p, disconnectedAt: Date.now() - PAST_GRACE_MS })));
    await runDurableObjectAlarm(env.ROOM.getByName(r.code));
    expect((await stored(r.code)).hostId).toBe(before.hostId);

    const back = await connect(r.code);
    const first = await hello(back, g1.token);
    expect(first.view.me.isHost).toBe(true);
    expect((await stored(r.code)).hostId).not.toBe(before.hostId);
  });
});

/** 저장된 방에서 이 사람의 끊긴 시각을 ms 만큼 과거로 옮긴다. */
async function ageOf(code: string, playerId: string, ms: number): Promise<void> {
  await agePast(code, playerId, ms);
}

const idOfSeat = async (code: string, seatNo: number): Promise<string> =>
  (await stored(code)).players.find((p) => p.seat === seatNo)!.id;

describe("대기실 정리 (D-18, CONNX-02)", () => {
  it("대기실에서 손님 소켓이 끊기면 알람이 정리 시각(테스트 방 6초)에 맞춰지고, 그 시각이 지나 알람이 돌면 모든 소켓의 players 와 월드에서 사라지며 그 토큰은 invalid_token 으로 닫힌다", async () => {
    const r = await seat(2, 0, { testMode: true });
    const [g1, g2] = r.guests as [(typeof r.guests)[number], (typeof r.guests)[number]];
    const g2Id = await idOfSeat(r.code, g2.seat);
    await flushWorld(r.code);
    expect((await worldOf(r.code))!.segs[g2Id]).toBeDefined();

    g2.sock.ws.close();
    await nextFrame(g1.sock, seatState(g2.seat, false));
    await until("정리 알람", async () => {
      const at = (await stored(r.code)).players.find((p) => p.id === g2Id)?.disconnectedAt;
      return at !== undefined && (await alarmOf(r.code)) === at + 6000;
    });
    // 정리 시간 안에 알람이 돌면 그대로다.
    await runDurableObjectAlarm(env.ROOM.getByName(r.code));
    expect((await stored(r.code)).players.map((p) => p.id)).toContain(g2Id);

    await ageOf(r.code, g2Id, 10_000);
    g1.sock.cursor = g1.sock.frames.length;
    expect(await runDurableObjectAlarm(env.ROOM.getByName(r.code))).toBe(true);
    const gone = await nextFrame(g1.sock, (m) => m.t === "state" && !m.view.players.some((p) => p.seat === g2.seat));
    expect(gone.t).toBe("state");
    await nextFrame(r.host, (m) => m.t === "state" && !m.view.players.some((p) => p.seat === g2.seat));
    expect((await stored(r.code)).players.map((p) => p.id)).not.toContain(g2Id);
    expect((await worldOf(r.code))!.segs[g2Id]).toBeUndefined();

    const back = await connect(r.code);
    send(back, { t: "hello", token: g2.token });
    expect(await closed(back)).toBe("4003 invalid_token");
  });

  it("옛 방장: 이양된 뒤 계속 끊겨 있으면 같은 규칙으로 지워지고 방에는 연결된 새 방장이 남는다", async () => {
    const r = await seat(1, 0, { testMode: true });
    const g1 = r.guests[0]!;
    const before = await stored(r.code);
    r.host.ws.close();
    await nextFrame(g1.sock, seatState(0, false));
    await until("disconnectedAt 기록", async () => (await stored(r.code)).players.find((p) => p.id === before.hostId)?.disconnectedAt !== undefined);
    await ageOf(r.code, before.hostId, 10_000);
    await runDurableObjectAlarm(env.ROOM.getByName(r.code));
    const room = await stored(r.code);
    expect(room.players.map((p) => p.id)).not.toContain(before.hostId);
    expect(room.players).toHaveLength(1);
    expect(room.hostId).toBe(room.players[0]!.id);
    expect(room.players[0]!.connected).toBe(true);
  });

  it("게임 중(낮 토론)에는 끊긴 지 아무리 오래돼도 지우지 않는다", { timeout: 40_000 }, async () => {
    const g = await startedGame("discussion", 3);
    const idle = g.actors.find((a) => a.seat !== 0)!;
    const idleId = await idOfSeat(g.code, idle.seat);
    idle.sock.ws.close();
    await until("끊김 기록", async () => (await stored(g.code)).players.find((p) => p.id === idleId)?.disconnectedAt !== undefined);
    await ageOf(g.code, idleId, 10 * 60_000);
    await runDurableObjectAlarm(env.ROOM.getByName(g.code));
    const room = await stored(g.code);
    expect(room.players).toHaveLength(4);
    expect(room.players.find((p) => p.id === idleId)!.connected).toBe(false);
  });
});

describe("결과 단계 나가기 (D-14)", () => {
  it("leave 를 보낸 소켓은 4003 'left' 로 닫히고 다른 소켓의 players 에는 그 사람이 connected false 로 남는다(left 는 프레임에 없다)", { timeout: 40_000 }, async () => {
    const g = await endedGame4();
    const leaver = g.actors.find((a) => a.seat !== 0)!;
    const stayer = g.actors.find((a) => a.seat === 0)!;
    stayer.sock.cursor = stayer.sock.frames.length;
    send(leaver.sock, { t: "leave" });
    expect(await closed(leaver.sock)).toBe("4003 left");
    const m = await nextFrame(stayer.sock, (f) => f.t === "state" && f.view.players.find((p) => p.seat === leaver.seat)?.connected === false);
    expect(m.t === "state" && m.view.players).toHaveLength(4);
    expect(JSON.stringify(m)).not.toContain('"left"');
    const room = await stored(g.code);
    const rec = room.players.find((p) => p.seat === leaver.seat)!;
    expect(rec.left).toBe(true);
    expect(rec.connected).toBe(false);
    expect(room.players).toHaveLength(4);
    expect(room.hostId).toBe(room.players.find((p) => p.seat === 0)!.id);
  });

  it("방장이 나가면 즉시 연결된 가장 이른 joinSeq 사람에게 넘어간다", { timeout: 40_000 }, async () => {
    const g = await endedGame4();
    const host = g.actors.find((a) => a.seat === 0)!;
    const next = g.actors.filter((a) => a !== host).sort((a, b) => a.seat - b.seat)[0]!;
    next.sock.cursor = next.sock.frames.length;
    send(host.sock, { t: "leave" });
    expect(await closed(host.sock)).toBe("4003 left");
    const m = await nextFrame(next.sock, (f) => f.t === "state" && f.view.me.isHost);
    expect(m.t === "state" && m.view.me.isHost).toBe(true);
    const room = await stored(g.code);
    expect(room.players.find((p) => p.id === room.hostId)!.seat).toBe(next.seat);
  });

  it("나간 사람은 같은 토큰으로 다시 들어올 수 없다", { timeout: 40_000 }, async () => {
    const g = await endedGame4();
    const leaver = g.actors.find((a) => a.seat !== 0)!;
    send(leaver.sock, { t: "leave" });
    await closed(leaver.sock);
    const back = await connect(g.code);
    send(back, { t: "hello", token: leaver.token });
    expect(await closed(back)).toBe("4003 invalid_token");
  });

  it("끊긴 사람은 결과 단계에서 아무리 오래돼도 지우지 않는다", { timeout: 40_000 }, async () => {
    const g = await endedGame4();
    const idle = g.actors.find((a) => a.seat !== 0)!;
    const idleId = await idOfSeat(g.code, idle.seat);
    idle.sock.ws.close();
    await until("끊김 기록", async () => (await stored(g.code)).players.find((p) => p.id === idleId)?.disconnectedAt !== undefined);
    await ageOf(g.code, idleId, 10 * 60_000);
    await runDurableObjectAlarm(env.ROOM.getByName(g.code));
    expect((await stored(g.code)).players).toHaveLength(4);
  });

  it("진행 중 판의 leave 는 이전처럼 WRONG_PHASE 다", { timeout: 40_000 }, async () => {
    const g = await startedGame("discussion", 3);
    const who = g.actors.find((a) => a.seat !== 0)!;
    who.sock.cursor = who.sock.frames.length;
    send(who.sock, { t: "leave" });
    const err = await nextFrame(who.sock, (m) => m.t === "error");
    expect(err).toEqual({ t: "error", code: "WRONG_PHASE" });
    expect((await stored(g.code)).players).toHaveLength(4);
  });
});
