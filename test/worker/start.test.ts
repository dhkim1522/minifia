import { env } from "cloudflare:workers";
import { runInDurableObject } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import type { RoomView, ServerMessage } from "../../shared/protocol";
import {
  connect,
  createRoom,
  flat,
  hello,
  joinOk,
  joinRoom,
  nextFrame,
  nextState,
  send,
} from "./helpers";
import type { TestSocket } from "./helpers";

interface Seated {
  code: string;
  host: TestSocket;
  hostToken: string;
  /** 연결된 참가자(소켓 있음). */
  guests: Array<{ sock: TestSocket; token: string; seat: number }>;
  /** HTTP 로만 참가한 미연결 참가자. */
  offline: Array<{ token: string; seat: number }>;
}

/** 방장 + 연결 참가자 `connectedGuests` 명 + HTTP 로만 참가한 `offlineGuests` 명. */
async function seat(connectedGuests: number, offlineGuests: number): Promise<Seated> {
  const { code, token } = await createRoom("방장");
  const host = await connect(code);
  await hello(host, token);
  const guests: Seated["guests"] = [];
  for (let i = 0; i < connectedGuests; i += 1) {
    const j = await joinOk(code, `손님${i}`);
    const sock = await connect(code);
    await hello(sock, j.token);
    guests.push({ sock, token: j.token, seat: j.seat });
  }
  const offline: Seated["offline"] = [];
  for (let i = 0; i < offlineGuests; i += 1) offline.push(await joinOk(code, `유령${i}`));
  return { code, host, hostToken: token, guests, offline };
}

async function storedRoom(code: string): Promise<{
  phase: string;
  phaseEndsAt: number | null;
  players: Array<{ role?: string }>;
}> {
  let room: unknown;
  await runInDurableObject(env.ROOM.getByName(code), async (_i, state) => {
    room = await state.storage.get("room");
  });
  return room as { phase: string; phaseEndsAt: number | null; players: Array<{ role?: string }> };
}

const assigning = (m: ServerMessage): boolean => m.t === "state" && m.view.phase === "assigning";

describe("start", () => {
  it("연결 4명이 모이고 방장이 시작하면 모든 소켓이 같은 phaseEndsAt·phaseDurationMs 3000 의 assigning state 를 받고 알람이 그 시각에 맞춰진다", async () => {
    const r = await seat(3, 0);
    send(r.host, { t: "start" });
    const sockets = [r.host, ...r.guests.map((g) => g.sock)];
    const views: RoomView[] = [];
    for (const s of sockets) {
      const m = await nextFrame(s, assigning);
      if (m.t === "state") views.push(m.view);
    }
    expect(views).toHaveLength(4);
    expect(new Set(views.map((v) => v.phaseEndsAt)).size).toBe(1);
    expect(views.every((v) => v.phaseDurationMs === 3000)).toBe(true);
    let alarm: number | null = null;
    await runInDurableObject(env.ROOM.getByName(r.code), async (_i, state) => {
      alarm = await state.storage.getAlarm();
    });
    expect(alarm).toBe(views[0]!.phaseEndsAt);
  });

  it("연결 4 + HTTP 로만 참가한 2명(자리 6) 이면 시작되고 6명 모두 역할을 받아 개수가 2·1·1·2 다", async () => {
    const r = await seat(3, 2);
    send(r.host, { t: "start" });
    await nextFrame(r.host, assigning);
    const room = await storedRoom(r.code);
    expect(room.players).toHaveLength(6);
    const counts: Record<string, number> = {};
    for (const p of room.players) counts[p.role ?? "none"] = (counts[p.role ?? "none"] ?? 0) + 1;
    expect(counts).toEqual({ mafia: 2, police: 1, doctor: 1, citizen: 2 });
  });

  it("연결 3 + 미연결 1(자리 4) 이면 NOT_ENOUGH_PLAYERS 와 lobby state 를 다시 보낸다", async () => {
    const r = await seat(2, 1);
    send(r.host, { t: "start" });
    const err = await nextFrame(r.host, (m) => m.t === "error");
    expect(flat(err)).toBe(JSON.stringify({ t: "error", code: "NOT_ENOUGH_PLAYERS" }));
    const state = await nextState(r.host);
    expect(state.view.phase).toBe("lobby");
    expect(state.view.players).toHaveLength(4);
  });

  it("참가자의 start 는 NOT_HOST", async () => {
    const r = await seat(3, 0);
    send(r.guests[0]!.sock, { t: "start" });
    const err = await nextFrame(r.guests[0]!.sock, (m) => m.t === "error");
    expect(flat(err)).toBe(JSON.stringify({ t: "error", code: "NOT_HOST" }));
    expect((await storedRoom(r.code)).phase).toBe("lobby");
  });

  it("시작 뒤 방장 kick 은 CANNOT_KICK, 새 HTTP 참가는 409 GAME_STARTED", async () => {
    const r = await seat(3, 1);
    send(r.host, { t: "start" });
    await nextFrame(r.host, assigning);
    send(r.host, { t: "kick", seat: r.offline[0]!.seat });
    const err = await nextFrame(r.host, (m) => m.t === "error");
    expect(flat(err)).toBe(JSON.stringify({ t: "error", code: "CANNOT_KICK" }));
    const res = await joinRoom(r.code, "늦은손님");
    expect(res.status).toBe(409);
    expect(((await res.json()) as { error: string }).error).toBe("GAME_STARTED");
  });

  it("시작 뒤 미연결이던 사람이 자기 토큰으로 hello 하면 다른 사람과 같은 phaseEndsAt 의 assigning state 를 받는다", async () => {
    const r = await seat(3, 1);
    send(r.host, { t: "start" });
    const hostView = await nextFrame(r.host, assigning);
    const late = await connect(r.code);
    const back = await hello(late, r.offline[0]!.token);
    expect(back.view.phase).toBe("assigning");
    expect(back.view.me.seat).toBe(r.offline[0]!.seat);
    expect(hostView.t === "state" && hostView.view.phaseEndsAt).toBe(back.view.phaseEndsAt);
  });
});
