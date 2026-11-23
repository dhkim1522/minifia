import { env, exports } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import { BAR_SEATS_FX } from "../../shared/game/map";
import type { CreateRoomResponse } from "../../shared/protocol";
import { openKeyword } from "../helpers/keyword";
import { alarmOf, closePhase, connect, editRoom, framesOf, hello, joinOk, lastViewOf, mark, nextFrame, openDiscussionSkip, send, settle, storedRoom, writeRoomEdit } from "./helpers";
import type { TestSocket } from "./helpers";

const createRoom = (origin: string, options: { playtest?: true; testMode?: true }) => exports.default.fetch(`${origin}/api/rooms`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ nickname: "방장", ...options }),
});

async function settleAll(sockets: TestSocket[]) {
  for (const sock of sockets) await settle(sock, mark(sock));
}

async function seatFour(playtest = true) {
  const response = await createRoom("http://localhost", { ...(playtest === true ? { playtest } : {}), testMode: true });
  expect(response.status).toBe(201);
  const { code, token } = await response.json() as CreateRoomResponse;
  const host = await connect(code);
  await hello(host, token);
  const guests = [];
  for (const name of ["수아", "연희", "동민"]) {
    const guest = await joinOk(code, name);
    const socket = await connect(code);
    await hello(socket, guest.token);
    guests.push(socket);
  }
  return { code, host, sockets: [host, ...guests] };
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

  it("4인이 집결하고 답·의심표·합의·첫 투표·밤 행동을 첫 아침까지 완료한다", async () => {
    const restore = openKeyword();
    try {
      const { code, host, sockets } = await seatFour();
      send(host, { t: "start" });
      await nextFrame(host, (msg) => msg.t === "state" && msg.view.phase === "assigning");
      await closePhase(code);
      await settleAll(sockets);
      for (const sock of sockets) {
        const view = lastViewOf(sock);
        expect(view).toMatchObject({ playtest: true, phase: "roleReveal", map: "bar", phaseDurationMs: 55_000 });
        expect(view.players.every((player) => player.look === undefined || player.look === "coat")).toBe(true);
      }
      const gathered = framesOf(host).filter((f) => f.t === "world" && f.k === "snap").at(-1);
      expect(gathered?.ents.map(({ p }) => p.slice(-2))).toEqual([0, 2, 4, 5].map((index) => BAR_SEATS_FX[index]));
      const lockedRole = mark(host);
      send(host, { t: "move", x: 300, z: 100 });
      expect((await settle(host, lockedRole)).some((f) => f.t === "world")).toBe(false);
      for (const sock of sockets.slice(0, 3)) {
        send(sock, { t: "roleReady" });
        await settle(sock, mark(sock));
        expect(lastViewOf(sock).me.roleReady).toBe(true);
      }
      expect(lastViewOf(sockets[3]!).me).not.toHaveProperty("roleReady");
      expect((await storedRoom(code)).phase).toBe("roleReveal");
      send(sockets[3]!, { t: "roleReady" });
      await settleAll(sockets);
      expect(lastViewOf(host)).toMatchObject({ phase: "keyword", phaseDurationMs: 35_000 });

      const keyDeadline = (await storedRoom(code)).phaseEndsAt!;
      for (const sock of sockets) {
        send(sock, { t: "answer", text: "낯설었어", final: true });
        await settle(sock, mark(sock));
        expect(lastViewOf(sock).me.answer).toMatchObject({ final: true });
      }
      const keyEndsEarly = (await storedRoom(code)).phaseEndsAt!;
      expect(keyEndsEarly).toBeLessThan(keyDeadline);
      expect(await alarmOf(code)).toBe(keyEndsEarly);
      const clockwiseSeats = [0, 2, 1, 3];
      for (const [i, seat] of clockwiseSeats.entries()) {
        for (const sock of sockets) {
          if (lastViewOf(sock).day?.keyword?.presentation?.order !== i + 1) {
            await nextFrame(sock, (m) => m.t === "state" && m.view.day?.keyword?.presentation?.order === i + 1, 6000);
          }
          expect(lastViewOf(sock).day?.keyword?.presentation).toEqual({ order: i + 1, total: 4, seat, text: "낯설었어" });
        }
        await closePhase(code);
      }
      await settleAll(sockets);
      const reveal = lastViewOf(host);
      expect(reveal).toMatchObject({ phase: "answerReveal", phaseDurationMs: 3_000 });
      expect(reveal.day?.keyword?.answer).toEqual(expect.any(String));
      expect(reveal.day?.keyword?.answers?.map(({ seat }) => seat)).toEqual(clockwiseSeats);
      await closePhase(code);
      await settleAll(sockets);
      expect(lastViewOf(host)).toMatchObject({ phase: "discussion", phaseDurationMs: 120_000 });
      expect(lastViewOf(host).day?.keyword).toEqual(reveal.day?.keyword);
      const hostSeat = lastViewOf(host).me.seat;
      const nearSeat = lastViewOf(sockets[1]!).me.seat;
      const farSeat = lastViewOf(sockets[2]!).me.seat;
      const noWalk = mark(host);
      send(host, { t: "move", x: -100, z: 350 });
      expect((await settle(host, noWalk)).some((f) => f.t === "world")).toBe(false);
      const noPoint = mark(host);
      send(sockets[2]!, { t: "suspect", target: farSeat });
      await nextFrame(sockets[2]!, (m) => m.t === "error" && m.code === "BAD_MESSAGE");
      expect((await settle(host, noPoint)).some((f) => f.t === "emote")).toBe(false);
      const beforeNote = sockets.map(mark);
      send(host, { t: "suspect", target: nearSeat });
      await settleAll(sockets);
      for (const [i, sock] of sockets.entries()) {
        expect(framesOf(sock).slice(beforeNote[i]).some((f) => f.t === "emote" && f.id === "point")).toBe(false);
        expect(lastViewOf(sock).day?.suspectLog).toEqual([{ n: 1, from: hostSeat, to: nearSeat }]);
      }

      await openDiscussionSkip(code);
      send(host, { t: "endDiscussion", on: true });
      await settle(host, mark(host));
      expect(lastViewOf(host).me.endDiscussion).toBe(true);
      for (const sock of sockets.slice(1, 3)) {
        send(sock, { t: "endDiscussion", on: true });
        await settle(sock, mark(sock));
      }
      expect((await storedRoom(code)).phase).toBe("discussion");
      const firstBallotFrom = mark(host);
      send(sockets[3]!, { t: "endDiscussion", on: true });
      await settleAll(sockets);
      expect(lastViewOf(host)).toMatchObject({ phase: "verdict", phaseDurationMs: 28_000, day: { firstBallot: { count: 0 } } });
      const gatheredAgain = framesOf(host).slice(firstBallotFrom).filter((m) => m.t === "world" && m.k === "move");
      expect(gatheredAgain).toEqual([]); // 토론에서 이미 착석한 사람의 경로를 투표 때 다시 만들지 않는다.
      const lockBallot = mark(host);
      send(host, { t: "move", x: 300, z: 100 });
      expect((await settle(host, lockBallot)).some((f) => f.t === "world")).toBe(false);
      const ballotEnd = lastViewOf(host).phaseEndsAt!;

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
      const ballotEndsEarly = (await storedRoom(code)).phaseEndsAt!;
      expect(ballotEndsEarly).toBeLessThan(ballotEnd);
      expect(await alarmOf(code)).toBe(ballotEndsEarly);
      await nextFrame(host, (m) => m.t === "state" && m.view.day?.firstBallot?.result !== undefined);
      await settleAll(sockets);
      for (const sock of sockets) {
        expect(lastViewOf(sock)).toMatchObject({ phase: "verdict", phaseEndsAt: ballotEndsEarly + 7_000, phaseDurationMs: 7_000, day: { firstBallot: { count: 4, result: { target: null, reason: "held", votes: 0, holds: 4 } } } });
        expect(lastViewOf(sock).me).not.toHaveProperty("firstBallot");
      }

      await closePhase(code);
      await settleAll(sockets);
      const endsAt = lastViewOf(host).phaseEndsAt;
      const [citizen, otherCitizen] = sockets.filter((sock) => lastViewOf(sock).me.role === "citizen") as [TestSocket, TestSocket];
      const mafia = sockets.find((sock) => lastViewOf(sock).me.role === "mafia")!;
      const police = sockets.find((sock) => lastViewOf(sock).me.role === "police")!;
      expect(lastViewOf(citizen)).toMatchObject({ phase: "night", phaseDurationMs: 30_000, phaseEndsAt: endsAt });
      send(citizen, { t: "pick", target: lastViewOf(mafia).me.seat });
      await nextFrame(citizen, (m) => m.t === "error" && m.code === "BAD_MESSAGE");
      send(police, { t: "nightDone" });
      await nextFrame(police, (m) => m.t === "error" && m.code === "BAD_MESSAGE");
      await settleAll(sockets);
      const beforePrivate = sockets.map(mark);
      send(citizen, { t: "nightDone" });
      await nextFrame(citizen, (m) => m.t === "state" && m.view.me.nightDone === true);
      for (const [i, sock] of sockets.entries()) {
        if (sock !== citizen) expect((await settle(sock, beforePrivate[i]!)).filter((m) => m.t === "state")).toEqual([]);
      }
      send(mafia, { t: "pick", target: lastViewOf(citizen).me.seat });
      await settle(mafia, mark(mafia));
      send(police, { t: "pick", target: lastViewOf(mafia).me.seat });
      await settle(police, mark(police));
      expect((await storedRoom(code)).phaseEndsAt).toBe(endsAt);
      expect(lastViewOf(citizen).me).not.toHaveProperty("pick");
      send(otherCitizen, { t: "nightDone" });
      await settle(otherCitizen, mark(otherCitizen));
      const nightEndsEarly = (await storedRoom(code)).phaseEndsAt!;
      expect(nightEndsEarly).toBeLessThan(endsAt!);
      expect(await alarmOf(code)).toBe(nightEndsEarly);
      await settleAll(sockets);
      for (const sock of sockets) {
        const view = lastViewOf(sock);
        expect(view.phaseEndsAt).toBe(nightEndsEarly);
        if (sock === mafia || sock === police) expect(JSON.stringify(view)).not.toContain("nightDone");
        else expect(view.me.nightDone).toBe(true);
      }
      await nextFrame(host, (m) => m.t === "state" && m.view.phase === "morning");
      await settleAll(sockets);
      expect(lastViewOf(host)).toMatchObject({ phase: "morning", phaseDurationMs: 10_000, day: { morning: { eliminated: lastViewOf(citizen).me.seat } } });
      expect(lastViewOf(police).me.records).toHaveLength(1);
      expect(lastViewOf(otherCitizen).me).not.toHaveProperty("nightDone");
    } finally {
      restore();
    }
  }, 30_000);

  it("동의 창이 닫혀 있거나 다른 차례에서 보낸 건너뛰기 입력은 거절한다", async () => {
    const { code, host, sockets } = await seatFour();
    const startsAt = Date.now();
    const opensAt = startsAt + 3_000;
    const phaseEndsAt = startsAt + 120_000;
    await writeRoomEdit(env.ROOM.getByName(code), (state) => ({ ...state, phase: "discussion", phaseStartsAt: startsAt, phaseEndsAt, day: 1 }));
    send(host, { t: "phaseSkip", opensAt, on: true });
    await nextFrame(host, (m) => m.t === "error" && m.code === "WRONG_PHASE");

    const openedAt = Date.now() - 100;
    await writeRoomEdit(env.ROOM.getByName(code), (state) => ({ ...state, phaseStartsAt: openedAt - 3_000 }));
    send(host, { t: "phaseSkip", opensAt, on: true });
    await nextFrame(host, (m) => m.t === "error" && m.code === "WRONG_PHASE");

    send(host, { t: "phaseSkip", opensAt: openedAt, on: true });
    await settleAll(sockets);
    for (const socket of sockets) {
      const view = lastViewOf(socket);
      expect(view.phaseSkip).toEqual({ count: 1, total: 4, canVote: true, opensAt: openedAt });
      expect(view.me.phaseSkip).toBe(socket === host ? true : undefined);
    }
    send(host, { t: "phaseSkip", opensAt: openedAt, on: false });
    await settleAll(sockets);
    expect(lastViewOf(host).phaseSkip?.count).toBe(0);
    expect(lastViewOf(host).me.phaseSkip).toBeUndefined();

    for (const socket of sockets) {
      send(socket, { t: "phaseSkip", opensAt: openedAt, on: true });
      await settle(socket, mark(socket));
    }
    expect(lastViewOf(host).phase).toBe("verdict");
    expect(lastViewOf(host).phaseSkip?.count).toBe(0);
    const stored = await storedRoom(code);
    expect(await alarmOf(code)).toBe(stored.phaseEndsAt);
  });

  it("일반 방에서도 전원이 역할을 확인하면 마감 전에 진행한다", async () => {
    const { code, host, sockets } = await seatFour(false);
    const phaseEndsAt = Date.now() + 15_000;
    await writeRoomEdit(env.ROOM.getByName(code), (state) => ({
      ...state, phase: "roleReveal", phaseEndsAt, day: 1,
      players: (state.players as Array<Record<string, unknown>>).map((p) => ({ ...p, role: "citizen" })),
    }));
    for (const socket of sockets.slice(0, 3)) {
      send(socket, { t: "roleReady" });
      await settle(socket, mark(socket));
      expect(lastViewOf(socket).me.roleReady).toBe(true);
    }
    expect((await storedRoom(code)).phase).toBe("roleReveal");
    send(sockets[3]!, { t: "roleReady" });
    await settleAll(sockets);
    expect(lastViewOf(host).phase).toBe("dayAnnounce");
    expect(lastViewOf(host).phaseEndsAt).toBeLessThan(phaseEndsAt);
  });
});
