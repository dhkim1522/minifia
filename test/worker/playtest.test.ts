import { exports } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import type { CreateRoomResponse } from "../../shared/protocol";
import { openKeyword } from "../helpers/keyword";
import { closePhase, connect, editRoom, hello, joinOk, lastViewOf, mark, nextFrame, send, settle, storedRoom } from "./helpers";
import type { TestSocket } from "./helpers";

const createRoom = (origin: string, options: { playtest?: true; testMode?: true }) => exports.default.fetch(`${origin}/api/rooms`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ nickname: "방장", ...options }),
});

async function settleAll(sockets: TestSocket[]) {
  for (const sock of sockets) await settle(sock, mark(sock));
}

describe("첫날 실험방 HTTP·소켓", () => {
  it.each(["https://minifia.dhplay.workers.dev", "https://minifia-v3.dhplay.workers.dev.example"])("다른 호스트 %s에서는 실험방 생성을 거절한다", async (origin) => {
    const res = await createRoom(origin, { playtest: true });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "BAD_REQUEST" });
  });

  it("v3 공개 주소에서 실험방을 명시적으로 만들 수 있다", async () => {
    const origin = "https://minifia-v3.dhplay.workers.dev";
    for (const playtest of [true, undefined] as const) {
      const response = await createRoom(origin, playtest === true ? { playtest } : {});
      expect(response.status).toBe(201);
      const { code, token } = await response.json() as CreateRoomResponse;
      const { view } = await hello(await connect(code), token);
      expect(view.playtest).toBe(playtest);
      expect(view.me.testMode).toBeUndefined();
      if (playtest === true) {
        const guest = await joinOk(code, "참가자");
        const { view: joined } = await hello(await connect(code), guest.token);
        expect(joined).toMatchObject({ playtest: true, phase: "lobby", me: { isHost: false } });
      }
    }
  });

  it("4인 실제 연결의 역할 확인, 토론 하한, 비공개 지목 보류와 고정 밤을 첫 아침까지 지킨다", async () => {
    const restore = openKeyword();
    try {
      const response = await createRoom("http://localhost", { playtest: true, testMode: true });
      expect(response.status).toBe(201);
      const room = await response.json() as CreateRoomResponse;
      const host = await connect(room.code);
      await hello(host, room.token);
      const sockets = [host];
      for (const name of ["수아", "연희", "동민"]) {
        const guest = await joinOk(room.code, name);
        const socket = await connect(room.code);
        await hello(socket, guest.token);
        sockets.push(socket);
      }
      send(host, { t: "start" });
      await nextFrame(host, (msg) => msg.t === "state" && msg.view.phase === "assigning");
      await closePhase(room.code);
      await settleAll(sockets);
      for (const sock of sockets) {
        const view = lastViewOf(sock);
        expect(view).toMatchObject({ playtest: true, phase: "roleReveal", map: "bar", phaseDurationMs: 55_000 });
        expect(view.players.every((player) => player.look === undefined || player.look === "coat")).toBe(true);
      }
      for (const sock of sockets.slice(0, 3)) {
        send(sock, { t: "roleReady" });
        await settle(sock, mark(sock));
        expect(lastViewOf(sock).me.roleReady).toBe(true);
      }
      expect(lastViewOf(sockets[3]!).me).not.toHaveProperty("roleReady");
      expect((await storedRoom(room.code)).phase).toBe("roleReveal");
      send(sockets[3]!, { t: "roleReady" });
      await settleAll(sockets);
      expect(lastViewOf(host)).toMatchObject({ phase: "keyword", phaseDurationMs: 33_000 });

      await closePhase(room.code);
      await closePhase(room.code);
      await settleAll(sockets);
      expect(lastViewOf(host)).toMatchObject({ phase: "discussion", phaseDurationMs: 120_000 });
      send(host, { t: "endDiscussion", on: true });
      await nextFrame(host, (m) => m.t === "error" && m.code === "WRONG_PHASE");
      expect((await storedRoom(room.code)).phase).toBe("discussion");
      expect(lastViewOf(host).me).not.toHaveProperty("endDiscussion");
      await editRoom(room.code, (state) => ({ ...state, phaseEndsAt: Date.now() + 72_000 }));
      for (const sock of sockets.slice(0, 3)) {
        send(sock, { t: "endDiscussion", on: true });
        await settle(sock, mark(sock));
      }
      await settleAll(sockets);
      expect(lastViewOf(host)).toMatchObject({ phase: "verdict", phaseDurationMs: 28_000, day: { firstBallot: { count: 0 } } });

      send(host, { t: "firstBallot", target: null });
      await settleAll(sockets);
      expect(lastViewOf(host).me.firstBallot).toBeNull();
      for (const sock of sockets.slice(1)) {
        const before = lastViewOf(sock);
        expect(before.me).not.toHaveProperty("firstBallot");
        expect(before.day).toMatchObject({ firstBallot: { count: 1 } });
        expect(before.day?.firstBallot).not.toHaveProperty("result");
      }
      for (const sock of sockets.slice(1)) {
        send(sock, { t: "firstBallot", target: null });
        await settle(sock, mark(sock));
      }
      await closePhase(room.code);
      await settleAll(sockets);
      for (const sock of sockets) {
        expect(lastViewOf(sock)).toMatchObject({ phase: "verdict", phaseDurationMs: 7_000, day: { firstBallot: { count: 4, result: { target: null, reason: "held", votes: 0, holds: 4 } } } });
        expect(lastViewOf(sock).me).not.toHaveProperty("firstBallot");
      }

      await closePhase(room.code);
      await closePhase(room.code);
      await settleAll(sockets);
      const endsAt = lastViewOf(host).phaseEndsAt;
      const citizen = sockets.find((sock) => lastViewOf(sock).me.role === "citizen")!;
      const mafia = sockets.find((sock) => lastViewOf(sock).me.role === "mafia")!;
      const police = sockets.find((sock) => lastViewOf(sock).me.role === "police")!;
      expect(lastViewOf(citizen)).toMatchObject({ phase: "night", phaseDurationMs: 30_000, phaseEndsAt: endsAt });
      send(citizen, { t: "pick", target: lastViewOf(mafia).me.seat });
      await nextFrame(citizen, (m) => m.t === "error" && m.code === "BAD_MESSAGE");
      send(mafia, { t: "pick", target: lastViewOf(citizen).me.seat });
      send(police, { t: "pick", target: lastViewOf(mafia).me.seat });
      await settleAll(sockets);
      expect((await storedRoom(room.code)).phaseEndsAt).toBe(endsAt);
      expect(lastViewOf(citizen).me).not.toHaveProperty("pick");
      await closePhase(room.code);
      await settleAll(sockets);
      expect(lastViewOf(host)).toMatchObject({ phase: "morning", phaseDurationMs: 10_000, day: { morning: { eliminated: lastViewOf(citizen).me.seat } } });
      expect(lastViewOf(police).me.records).toHaveLength(1);
    } finally {
      restore();
    }
  }, 30_000);
});
