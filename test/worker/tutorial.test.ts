// 함께 진행 서버 게이트 트레이서(17페이즈, 결정 0078·0080). 방장이 start 에 tutorial: true 를 실으면 방이 tutorial 단계로 가고,
// 앉은 사람 모두가 tutorialDone 을 보내면 assigning → roleReveal 로 이어진다. 공개 값(view.tutorial·me.tutorialDone)·경계·끊김 시험은 17-12 가 이 파일에 더했다.
import { env } from "cloudflare:workers";
import { runDurableObjectAlarm } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { PLAZA_SPAWNS } from "../../shared/game/mapPlaza";
import type { RoomView, ServerMessage } from "../../shared/protocol";
import { openPlaza } from "../helpers/playable";
import { advanceTo, editRoom, forceDue, lastViewOf, mark, nextFrame, seat, send, settle, storedRoom, until, worldOf, type StoredRoom, type TestSocket } from "./helpers";

type Stored = Omit<StoredRoom, "players"> & { tutorialPassed?: string[]; players: Array<{ id: string; seat: number }> };

const inPhase = (phase: string) => (m: ServerMessage): boolean => m.t === "state" && m.view.phase === phase;

async function viewIn(sock: TestSocket, phase: string): Promise<RoomView> {
  const m = await nextFrame(sock, inPhase(phase));
  if (m.t !== "state") throw new Error("state 프레임이 아니다");
  return m.view;
}

describe("함께 진행 게이트 (TUT-02)", () => {
  it("방장이 tutorial: true 로 시작하면 모두 tutorial 단계(마감 150초)이고 어떤 view 에도 role·allies 가 없다", async () => {
    const r = await seat(3, 0);
    send(r.host, { t: "start", tutorial: true });
    const sockets = [r.host, ...r.guests.map((g) => g.sock)];
    for (const s of sockets) {
      const view = await viewIn(s, "tutorial");
      expect(view.phaseEndsAt! - view.serverNow).toBeGreaterThan(148_000);
      expect(view.phaseEndsAt! - view.serverNow).toBeLessThanOrEqual(150_000 + 2_000);
      expect("role" in view.me).toBe(false);
      expect("allies" in view.me).toBe(false);
    }
    expect((await storedRoom(r.code)).phase).toBe("tutorial");
  });

  it("전원이 tutorialDone 을 보내면 assigning 으로 넘어가 tutorialPassed 가 지워지고, 이어서 roleReveal 에서 각자 역할이 보인다", async () => {
    const r = await seat(3, 0);
    const sockets = [r.host, ...r.guests.map((g) => g.sock)];
    send(r.host, { t: "start", tutorial: true });
    for (const s of sockets) await viewIn(s, "tutorial");

    // 손님 둘이 먼저 — 두 사람만 표시되고 단계는 그대로다
    for (const g of r.guests.slice(0, 2)) {
      const from = mark(g.sock);
      send(g.sock, { t: "tutorialDone" });
      await settle(g.sock, from);
    }
    const partial = (await storedRoom(r.code)) as Stored;
    expect(partial.phase).toBe("tutorial");
    const idOfSeat = (seatNo: number): string => partial.players.find((p) => p.seat === seatNo)!.id;
    expect([...(partial.tutorialPassed ?? [])].sort()).toEqual(r.guests.slice(0, 2).map((g) => idOfSeat(g.seat)).sort());

    // 나머지 둘(손님 하나와 방장)이 보내면 넘어간다
    send(r.guests[2]!.sock, { t: "tutorialDone" });
    send(r.host, { t: "tutorialDone" });
    for (const s of sockets) await viewIn(s, "assigning");
    const after = (await storedRoom(r.code)) as Stored;
    expect(after.phase).toBe("assigning");
    expect("tutorialPassed" in after).toBe(false);

    await advanceTo(r.code, sockets, "roleReveal");
    for (const s of sockets) expect(lastViewOf(s).me.role).toBeDefined();
  });

  it("tutorial 키가 없는 start 는 지금처럼 곧장 assigning 이다 (서버 기본 꺼짐)", async () => {
    const r = await seat(3, 0);
    send(r.host, { t: "start" });
    await viewIn(r.host, "assigning");
    expect((await storedRoom(r.code)).phase).toBe("assigning");
  });
});

describe("공개 진행 값 (TUT-02, 0080-10·11)", () => {
  it("켜고 시작하면 모든 소켓의 view.tutorial = { done: 0, total: 4, endsAt: phaseEndsAt } 이고 me 에 tutorialDone 키가 없다", async () => {
    const r = await seat(3, 0);
    const sockets = [r.host, ...r.guests.map((g) => g.sock)];
    send(r.host, { t: "start", tutorial: true });
    for (const s of sockets) {
      const view = await viewIn(s, "tutorial");
      expect(view.tutorial).toEqual({ done: 0, total: 4, endsAt: view.phaseEndsAt });
      expect("tutorialDone" in view.me).toBe(false);
    }
  });

  it("손님 둘이 끝났음을 보내면 모든 소켓의 done 이 2 가 되고, 보낸 둘의 me 에만 tutorialDone === true 가 있다", async () => {
    const r = await seat(3, 0);
    const sockets = [r.host, ...r.guests.map((g) => g.sock)];
    send(r.host, { t: "start", tutorial: true });
    const first = await viewIn(r.host, "tutorial");
    for (const s of sockets.slice(1)) await viewIn(s, "tutorial");

    const sender = r.guests.slice(0, 2);
    for (const g of sender) send(g.sock, { t: "tutorialDone" });
    for (const s of sockets) {
      const m = await nextFrame(s, (f) => f.t === "state" && f.view.phase === "tutorial" && f.view.tutorial?.done === 2);
      if (m.t !== "state") throw new Error("state 프레임이 아니다");
      expect(m.view.tutorial).toEqual({ done: 2, total: 4, endsAt: first.tutorial!.endsAt });
    }
    for (const g of sender) expect(lastViewOf(g.sock).me.tutorialDone).toBe(true);
    for (const s of [r.host, r.guests[2]!.sock]) {
      expect("tutorialDone" in lastViewOf(s).me).toBe(false);
    }
  });

  it("나머지 둘도 보내 assigning 이 된 프레임에는 view.tutorial·me.tutorialDone 키가 없다", async () => {
    const r = await seat(3, 0);
    const sockets = [r.host, ...r.guests.map((g) => g.sock)];
    send(r.host, { t: "start", tutorial: true });
    for (const s of sockets) await viewIn(s, "tutorial");
    for (const s of sockets) send(s, { t: "tutorialDone" });
    for (const s of sockets) {
      const view = await viewIn(s, "assigning");
      expect("tutorial" in view).toBe(false);
      expect("tutorialDone" in view.me).toBe(false);
    }
  });

  it("끄고 시작한 방의 assigning view 에는 두 키가 없고, 대기실 view 에도 없다", async () => {
    const r = await seat(3, 0);
    const lobby = lastViewOf(r.host);
    expect("tutorial" in lobby).toBe(false);
    expect("tutorialDone" in lobby.me).toBe(false);
    send(r.host, { t: "start" });
    const view = await viewIn(r.host, "assigning");
    expect("tutorial" in view).toBe(false);
    expect("tutorialDone" in view.me).toBe(false);
  });
});

const errorsOf = (msgs: ServerMessage[]): string[] => msgs.filter((m): m is Extract<ServerMessage, { t: "error" }> => m.t === "error").map((m) => m.code);

describe("튜토리얼 경계 (TUT-02·TUT-05, 0080-10·19)", () => {
  it("대기실에서 보낸 tutorialDone 은 보낸 소켓에만 WRONG_PHASE 가 가고 다른 소켓 프레임은 0이다", async () => {
    const r = await seat(3, 0);
    const sockets = [r.host, ...r.guests.map((g) => g.sock)];
    for (const s of sockets) await settle(s, 0);
    const marks = sockets.map((s) => mark(s));
    send(r.guests[0]!.sock, { t: "tutorialDone" });
    const own = await settle(r.guests[0]!.sock, marks[1]!);
    expect(errorsOf(own)).toEqual(["WRONG_PHASE"]);
    for (const i of [0, 2, 3]) expect(await settle(sockets[i]!, marks[i]!)).toEqual([]);
    expect((await storedRoom(r.code)).phase).toBe("lobby");
  });

  it("덧붙은 키·잘못된 타입은 BAD_MESSAGE 이고 단계는 그대로이며, 손님의 start 는 방장만이라 거절된다", async () => {
    const r = await seat(3, 0);
    const sockets = [r.host, ...r.guests.map((g) => g.sock)];
    for (const s of sockets) await settle(s, 0);

    for (const bad of [{ t: "start", tutorial: "yes" }, { t: "tutorialDone", x: 1 }, { t: "start", tutorial: true, x: 1 }]) {
      const marks = sockets.map((s) => mark(s));
      send(r.host, bad);
      expect(errorsOf(await settle(r.host, marks[0]!))).toEqual(["BAD_MESSAGE"]);
      for (const i of [1, 2, 3]) expect(await settle(sockets[i]!, marks[i]!)).toEqual([]);
    }
    expect((await storedRoom(r.code)).phase).toBe("lobby");

    const guestMark = mark(r.guests[0]!.sock);
    send(r.guests[0]!.sock, { t: "start", tutorial: true });
    expect(errorsOf(await settle(r.guests[0]!.sock, guestMark))).toEqual(["NOT_HOST"]);
    expect((await storedRoom(r.code)).phase).toBe("lobby");
  });

  it("같은 사람이 tutorialDone 을 두 번 보내면 두 번째 뒤 어느 소켓에도 프레임이 가지 않는다", async () => {
    const r = await seat(3, 0);
    const sockets = [r.host, ...r.guests.map((g) => g.sock)];
    send(r.host, { t: "start", tutorial: true });
    for (const s of sockets) await viewIn(s, "tutorial");
    const sender = r.guests[0]!.sock;
    send(sender, { t: "tutorialDone" });
    for (const s of sockets) await nextFrame(s, (m) => m.t === "state" && m.view.tutorial?.done === 1);
    const marks = sockets.map((s) => mark(s));
    send(sender, { t: "tutorialDone" });
    for (const [i, s] of sockets.entries()) expect(await settle(s, marks[i]!)).toEqual([]);
    const stored = (await storedRoom(r.code)) as Stored;
    expect(stored.tutorialPassed).toHaveLength(1);
  });

  it("사람 넷 중 둘이 끝낸 뒤 나머지 둘의 소켓이 닫히면 단계가 assigning 으로 넘어가고 roleReveal 까지 정상 진행한다 (끊김 = 끝낸 것)", async () => {
    const r = await seat(3, 0);
    const sockets = [r.host, ...r.guests.map((g) => g.sock)];
    send(r.host, { t: "start", tutorial: true });
    for (const s of sockets) await viewIn(s, "tutorial");
    for (const g of r.guests.slice(0, 2)) send(g.sock, { t: "tutorialDone" });
    for (const s of sockets) await nextFrame(s, (m) => m.t === "state" && m.view.tutorial?.done === 2);

    // 하나가 끊겨도 아직 한 명이 남아 있다
    r.guests[2]!.sock.ws.close();
    await until("끊김이 done 에 든다", async () => (await storedRoom(r.code)).phase === "tutorial" && lastViewOf(r.guests[0]!.sock).tutorial?.done === 3);
    expect((await storedRoom(r.code)).phase).toBe("tutorial");

    // 마지막 한 명이 끊기면 서버가 다시 보고 넘긴다
    r.host.ws.close();
    const watchers = r.guests.slice(0, 2).map((g) => g.sock);
    for (const s of watchers) await viewIn(s, "assigning");
    const after = (await storedRoom(r.code)) as Stored;
    expect(after.phase).toBe("assigning");
    expect("tutorialPassed" in after).toBe(false);

    await advanceTo(r.code, watchers, "roleReveal");
    for (const s of watchers) expect(lastViewOf(s).me.role).toBeDefined();
  });

  it("사람 둘 + 서버 봇 둘은 view.tutorial.total 이 2 이고 사람 둘이 끝내면 넘어간다", async () => {
    const r = await seat(1, 0);
    const sockets = [r.host, r.guests[0]!.sock];
    for (const s of sockets) await settle(s, 0);
    send(r.host, { t: "testBots", count: 2 });
    for (const s of sockets) await nextFrame(s, (m) => m.t === "state" && m.view.phase === "lobby" && m.view.players.length === 4);
    send(r.host, { t: "start", tutorial: true });
    for (const s of sockets) {
      const view = await viewIn(s, "tutorial");
      expect(view.tutorial).toEqual({ done: 0, total: 2, endsAt: view.phaseEndsAt });
    }
    send(r.host, { t: "tutorialDone" });
    for (const s of sockets) await nextFrame(s, (m) => m.t === "state" && m.view.tutorial?.done === 1);
    expect((await storedRoom(r.code)).phase).toBe("tutorial");
    send(r.guests[0]!.sock, { t: "tutorialDone" });
    for (const s of sockets) await viewIn(s, "assigning");
  });

  it("아무도 끝내지 않아도 마감(150초)이 지난 알람이 tutorial 에서 assigning 으로 넘긴다", async () => {
    const r = await seat(3, 0);
    const sockets = [r.host, ...r.guests.map((g) => g.sock)];
    send(r.host, { t: "start", tutorial: true });
    for (const s of sockets) await viewIn(s, "tutorial");
    await forceDue(r.code, "phaseEndsAt");
    expect(await runDurableObjectAlarm(env.ROOM.getByName(r.code))).toBe(true);
    for (const s of sockets) await viewIn(s, "assigning");
    const after = (await storedRoom(r.code)) as Stored;
    expect(after.phase).toBe("assigning");
    expect("tutorialPassed" in after).toBe(false);
  });

  it("광장 맵으로 켜고 시작하면 모든 소켓이 tutorial 단계에서 광장 입장 지점의 snap 을 받고 assigning 에서도 store 위치가 광장 좌표다", async () => {
    const restore = openPlaza();
    try {
      const r = await seat(3, 0);
      const sockets = [r.host, ...r.guests.map((g) => g.sock)];
      for (const s of sockets) await settle(s, 0);
      await editRoom(r.code, (room) => ({ ...room, mapChoice: "plaza" }));
      const marks = sockets.map((s) => mark(s));
      send(r.host, { t: "start", tutorial: true });
      const spots = new Set(PLAZA_SPAWNS.map((p) => `${Math.round(p.x * 100)},${Math.round(p.z * 100)}`));
      for (const [i, s] of sockets.entries()) {
        const frames = await settle(s, marks[i]!);
        const tutorialStates = frames.filter((m) => m.t === "state" && m.view.phase === "tutorial");
        expect(tutorialStates.length).toBeGreaterThan(0);
        const snaps = frames.filter((m): m is Extract<ServerMessage, { t: "world"; k: "snap" }> => m.t === "world" && m.k === "snap");
        expect(snaps).toHaveLength(1);
        expect(snaps[0]!.ents).toHaveLength(4);
        for (const e of snaps[0]!.ents) {
          const x = e.p[e.p.length - 2]!;
          const z = e.p[e.p.length - 1]!;
          expect(spots.has(`${x},${z}`), `seat ${e.s} at ${x},${z}`).toBe(true);
        }
      }
      for (const s of sockets) send(s, { t: "tutorialDone" });
      for (const s of sockets) await viewIn(s, "assigning");
      const world = await worldOf(r.code);
      const segs = Object.values(world!.segs);
      expect(segs).toHaveLength(4);
      for (const seg of segs) {
        const x = seg.p[seg.p.length - 2]!;
        const z = seg.p[seg.p.length - 1]!;
        expect(spots.has(`${x},${z}`), `store at ${x},${z}`).toBe(true);
      }
    } finally {
      restore();
    }
  });

  it("테스트 방 되돌리기를 tutorial 단계에서 하면 대기실로 가고 저장된 방에 tutorialPassed 가 없다", async () => {
    const r = await seat(3, 0, { testMode: true });
    const sockets = [r.host, ...r.guests.map((g) => g.sock)];
    send(r.host, { t: "start", tutorial: true });
    for (const s of sockets) await viewIn(s, "tutorial");
    send(r.guests[0]!.sock, { t: "tutorialDone" });
    for (const s of sockets) await nextFrame(s, (m) => m.t === "state" && m.view.tutorial?.done === 1);
    expect((await storedRoom(r.code) as Stored).tutorialPassed).toHaveLength(1);

    send(r.host, { t: "testReset" });
    for (const s of sockets) await viewIn(s, "lobby");
    const after = (await storedRoom(r.code)) as Stored;
    expect(after.phase).toBe("lobby");
    expect("tutorialPassed" in after).toBe(false);
    for (const s of sockets) {
      const view = lastViewOf(s);
      expect("tutorial" in view).toBe(false);
      expect("tutorialDone" in view.me).toBe(false);
    }
  });
});
