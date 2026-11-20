import { describe, expect, it } from "vitest";
import { BAR_SEATS_FX } from "../../shared/game/map";
import type { ServerMessage } from "../../shared/protocol";
import { connect, editRoom, hello, lastViewOf, mark, nextFrame, seat, send, settle, startedGame, storedRoom, worldOf } from "./helpers";

const assigning = (msg: ServerMessage) => msg.t === "state" && msg.view.phase === "assigning";
const isSnap = (msg: ServerMessage) => msg.t === "world" && msg.k === "snap";

describe("재즈 바 고정 맵", () => {
  it.each([undefined, "random", "plaza", "bar"] as const)("이전 대기실 선택 %s와 상관없이 재즈 바에서 시작한다", async (mapChoice) => {
    const room = await seat(3, 0);
    const sockets = [room.host, ...room.guests.map(({ sock }) => sock)];
    if (mapChoice !== undefined) await editRoom(room.code, (state) => ({ ...state, mapChoice }));
    for (const sock of sockets) {
      await settle(sock, 0);
      expect(lastViewOf(sock)).toMatchObject({ phase: "lobby", mapChoice: "bar" });
      expect(lastViewOf(sock)).not.toHaveProperty("map");
    }
    send(room.host, { t: "start" });
    for (const sock of sockets) {
      const state = await nextFrame(sock, assigning);
      expect(state).toMatchObject({ t: "state", view: { map: "bar" } });
      const snap = await nextFrame(sock, isSnap);
      if (snap.t !== "world" || snap.k !== "snap") throw new Error("착석 스냅이 없다");
      expect(snap.ents.map(({ p }) => p.slice(-2))).toEqual([0, 2, 4, 5].map((chair) => BAR_SEATS_FX[chair]));
    }
  });

  it("이전 맵 선택은 송신자에게만 현재 상태를 돌려주고 저장하지 않는다", async () => {
    const room = await seat(1, 0);
    const guest = room.guests[0]!.sock;
    for (const sock of [room.host, guest]) await settle(sock, 0);
    for (const [sender, other] of [[room.host, guest], [guest, room.host]] as const) {
      for (const map of ["plaza", "random", "bar"] as const) {
        const senderMark = mark(sender);
        const otherMark = mark(other);
        send(sender, { t: "mapPick", map });
        expect(await settle(sender, senderMark)).toMatchObject([{ t: "state", view: { mapChoice: "bar" } }]);
        expect(await settle(other, otherMark)).toEqual([]);
      }
    }
    expect(await storedRoom(room.code)).not.toHaveProperty("mapChoice");
  });

  it("진행 중 광장 방을 저장소에서 복원할 때 단계·역할을 유지하고 재즈 바 의자에 앉힌다", { timeout: 30_000 }, async () => {
    const room = await startedGame("discussion", 3);
    const before = await storedRoom(room.code);
    const host = room.actors.find((p) => p.seat === 0)!;
    await editRoom(room.code, (state) => {
      const { barChairs: _previous, ...old } = state;
      return { ...old, map: "plaza", mapChoice: "plaza" };
    });
    const reconnect = await connect(room.code);
    const resumed = await hello(reconnect, host.token);
    expect(resumed.view).toMatchObject({ phase: "discussion", map: "bar", mapChoice: "bar", me: { seat: host.seat, role: host.role } });
    const snap = await nextFrame(reconnect, isSnap);
    expect(snap).toMatchObject({ ents: [0, 2, 4, 5].map((chair) => ({ p: BAR_SEATS_FX[chair] })) });
    expect(await storedRoom(room.code)).toMatchObject({ phase: before.phase, day: before.day, map: "bar", barChairs: { 0: 0, 1: 2, 2: 4, 3: 5 } });
    expect(Object.values((await worldOf(room.code))!.segs).map(({ p }) => p)).toEqual([0, 2, 4, 5].map((chair) => BAR_SEATS_FX[chair]));
  });
});
