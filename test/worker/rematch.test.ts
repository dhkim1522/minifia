// 다시 하기 (11-08, D-12·D-15, REMATCH-01) — 끝난 판에서 모두 준비한 채 방장이 rematch 하면 같은 방이 round 2 의 assigning 으로 가고 이전 판 흔적이 없다 (누설 L39).
import { describe, expect, it } from "vitest";
import type { RoomView, ServerMessage } from "../../shared/protocol";
import {
  advanceTo,
  chatKeysOf,
  chatLogOf,
  chatSend,
  chatsOf,
  connect,
  endedGame4,
  framesOf,
  helloForLog,
  lastViewOf,
  mark,
  nextFrame,
  resetChatRates,
  send,
  settle,
  storedRoom,
  until,
} from "./helpers";
import type { TestSocket } from "./helpers";

const isAssigning = (m: ServerMessage): boolean => m.t === "state" && m.view.phase === "assigning";

/** 손님 셋이 ready 를 보내고 모든 소켓의 players[].ready 가 반영될 때까지 기다린다. */
async function readyAll(socks: TestSocket[], round = 1): Promise<void> {
  const [, ...guests] = socks;
  for (const s of guests) send(s, { t: "ready", on: true, round });
  await until("모두 준비", async () => socks.every((s) => lastViewOf(s).players.filter((p) => p.ready === true).length === socks.length));
}

describe("다시 하기 (D-12, D-15, L39)", () => {
  it("손님 셋의 ready 가 모든 소켓의 players[].ready 에 실리고(방장 포함), 방장의 rematch 로 모든 소켓이 round 2 의 assigning 을 받는다", { timeout: 40_000 }, async () => {
    const g = await endedGame4();
    const host = g.socks[0]!;
    // 준비 전에는 방장만 준비로 센다
    expect(lastViewOf(host).players.filter((p) => p.ready === true).map((p) => p.seat)).toEqual([0]);
    await readyAll(g.socks);
    for (const s of g.socks) {
      const v = lastViewOf(s);
      expect(v.players.map((p) => p.ready)).toEqual([true, true, true, true]);
      expect(v.phase).toBe("ended");
      expect(v.round).toBe(1);
    }
    send(host, { t: "rematch", round: 1 });
    for (const s of g.socks) {
      const frame = (await nextFrame(s, isAssigning)) as Extract<ServerMessage, { t: "state" }>;
      const view: RoomView = frame.view;
      expect(view.round).toBe(2);
      expect(view.result).toBeUndefined();
      expect(view.day).toBeUndefined();
      expect(view.players.every((p) => p.alive === true)).toBe(true);
      expect(view.players.every((p) => p.ready === undefined && p.sat === undefined)).toBe(true);
      expect(view.me.role).toBeUndefined(); // 역할 공개는 roleReveal 부터
      expect(view.phaseEndsAt).not.toBeNull();
    }
    const stored = await storedRoom(g.code);
    expect(stored.phase).toBe("assigning");
    expect(stored.winner).toBeUndefined();
    expect(stored.voteLog).toBeUndefined();
    expect(stored.players.every((p) => p.role !== undefined && p.alive === undefined)).toBe(true);
  });

  it("새 판 소켓의 state 어디에도 이전 판의 결과·일차 기록이 없고, 판이 roleReveal 로 가면 각자 자기 역할만 받는다", { timeout: 40_000 }, async () => {
    const g = await endedGame4();
    await readyAll(g.socks);
    send(g.socks[0]!, { t: "rematch", round: 1 });
    await advanceTo(g.code, g.socks, "roleReveal");
    for (const s of g.socks) {
      const v = lastViewOf(s);
      expect(v.round).toBe(2);
      expect(v.me.role).toBeDefined();
      expect("result" in v).toBe(false);
      expect(v.day).toBeUndefined();
    }
    const seen = new Set(g.socks.map((s) => lastViewOf(s).me.seat));
    expect(seen.size).toBe(4);
  });

  it("hello 로 다시 붙은 소켓의 chatLog 는 빈 배열이고, 저장소에 chat: 키가 없다가 첫 새 줄이 seq 1 로 시작한다", { timeout: 40_000 }, async () => {
    const g = await endedGame4();
    // 이전 판 줄 하나를 결과 단계에서 만든다
    await resetChatRates(g.code);
    chatSend(g.socks[1]!, "지난 판의 한마디 CANARY");
    await until("지난 판 줄 저장", async () => (await chatKeysOf(g.code)).length > 0);
    await readyAll(g.socks);
    send(g.socks[0]!, { t: "rematch", round: 1 });
    for (const s of g.socks) await nextFrame(s, isAssigning);
    expect(await chatKeysOf(g.code)).toEqual([]);

    const again = await connect(g.code);
    const lines = await helloForLog(again, g.actors[1]!.token);
    expect(lines).toEqual([]);
    expect(framesOf(again).some((m) => JSON.stringify(m).includes("CANARY"))).toBe(false);

    await advanceTo(g.code, g.socks, "dayAnnounce");
    await resetChatRates(g.code);
    const m0 = mark(g.socks[2]!);
    chatSend(g.socks[2]!, "새 판의 첫 줄");
    const got = chatsOf(await settle(g.socks[2]!, m0));
    expect(got.map((l) => `${l.ch}/${l.seq}/${l.text}`)).toEqual(["all/1/새 판의 첫 줄"]);
    expect(chatLogOf(framesOf(again))).toEqual([]);
  });

  it("손님이 보낸 rematch·방장이 준비 없이 보낸 rematch 는 거절된다 — 오류 프레임 없이 보낸 소켓에 state 한 개", { timeout: 40_000 }, async () => {
    const g = await endedGame4();
    const [host, guest] = g.socks as [TestSocket, TestSocket, ...TestSocket[]];
    await readyAll(g.socks);
    const m = mark(guest);
    send(guest, { t: "rematch", round: 1 });
    const got = await settle(guest, m);
    expect(got.map((f) => f.t)).toEqual(["state"]);
    expect((got[0] as Extract<ServerMessage, { t: "state" }>).view.phase).toBe("ended");
    // 방장이 한 명 준비를 풀면 참가자 3명 — 거절
    send(guest, { t: "ready", on: false, round: 1 });
    await until("준비 풀림", async () => lastViewOf(host).players.filter((p) => p.ready === true).length === 3);
    const hm = mark(host);
    send(host, { t: "rematch", round: 1 });
    const hostGot = await settle(host, hm);
    expect(hostGot.map((f) => f.t)).toEqual(["state"]);
    expect((await storedRoom(g.code)).phase).toBe("ended");
  });
});
