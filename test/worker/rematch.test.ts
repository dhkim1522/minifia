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
  emoteSend,
  readyUp,
  settle,
  startedGame,
  storedRoom,
  toEndedByMafia,
  typingSend,
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

    // 같은 토큰의 새 소켓이 이전 소켓(socks[1])을 대체했으므로 나머지 소켓과 새 소켓으로 단계를 넘긴다.
    await advanceTo(g.code, [g.socks[0]!, g.socks[2]!, g.socks[3]!, again], "dayAnnounce");
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

const stateOnly = (msgs: ServerMessage[]): Array<Extract<ServerMessage, { t: "state" }>> => msgs.filter((m): m is Extract<ServerMessage, { t: "state" }> => m.t === "state");
/** 응답 view 의 모양: 최상위 키(탈락한 본인에게만 가는 spectate 는 거절과 무관해 뺀다) + players[] 키 집합 + me 키 집합. 값은 보지 않는다. */
const shapeOf = (v: RoomView): string => `${Object.keys(v).filter((k) => k !== "spectate").sort().join(",")}|${v.players.map((p) => Object.keys(p).sort().join("+")).join("/")}|${Object.keys(v.me).sort().join(",")}`;

describe("다시 하기 거절 응답은 오라클이 아니다 (L40, T-11-27)", () => {
  it("결과 단계: 방장 아님·방장의 ready·판 번호 틀림·참가자 3명뿐 — 보낸 소켓에 state 정확히 한 개, 오류 0, 다른 소켓 0프레임, 응답 모양 동일", { timeout: 60_000 }, async () => {
    const g = await endedGame4();
    const [host, g1, g2, g3] = g.socks as [TestSocket, TestSocket, TestSocket, TestSocket];
    await readyUp([g1, g2], g.socks, 3); // 방장 + 둘 = 참가자 3명
    const cases: Array<[string, TestSocket, unknown]> = [
      ["방장 아님", g3, { t: "rematch", round: 1 }],
      ["방장이 ready", host, { t: "ready", on: true, round: 1 }],
      ["ready 판 번호 틀림", g3, { t: "ready", on: true, round: 7 }],
      ["rematch 판 번호 틀림", host, { t: "rematch", round: 7 }],
      ["참가자 3명뿐", host, { t: "rematch", round: 1 }],
    ];
    const shapes: string[] = [];
    for (const [name, from, msg] of cases) {
      const marks = g.socks.map((s) => mark(s));
      send(from, msg);
      for (const [i, s] of g.socks.entries()) {
        const got = await settle(s, marks[i]!);
        if (s === from) {
          expect(`${name}:${got.map((m) => m.t).join(",")}`).toBe(`${name}:state`);
          shapes.push(shapeOf(stateOnly(got)[0]!.view));
        } else {
          expect(`${name}:${got.length}`).toBe(`${name}:0`);
        }
      }
    }
    // 모양은 보낸 사람(방장/손님)의 me 만 갈릴 수 있다 — 최상위·players 모양은 사유와 무관하게 같다.
    expect([...new Set(shapes.map((x) => x.split("|").slice(0, 2).join("|")))]).toHaveLength(1);
    expect((await storedRoom(g.code)).phase).toBe("ended");
  });

  it("게임 중(단계 틀림): 손님의 ready·rematch 와 방장의 ready·rematch 도 같은 응답이고 상태는 그대로다", { timeout: 60_000 }, async () => {
    const game = await startedGame("discussion", 5);
    const [host, guest] = game.socks as [TestSocket, TestSocket, ...TestSocket[]];
    const before = JSON.stringify(await storedRoom(game.code));
    const shapes: string[] = [];
    for (const [name, from, msg] of [
      ["손님 ready", guest, { t: "ready", on: true, round: 1 }],
      ["손님 rematch", guest, { t: "rematch", round: 1 }],
      ["방장 ready", host, { t: "ready", on: true, round: 1 }],
      ["방장 rematch", host, { t: "rematch", round: 1 }],
    ] as Array<[string, TestSocket, unknown]>) {
      const marks = game.socks.map((s) => mark(s));
      send(from, msg);
      for (const [i, s] of game.socks.entries()) {
        const got = await settle(s, marks[i]!);
        if (s === from) {
          expect(`${name}:${got.map((m) => m.t).join(",")}`).toBe(`${name}:state`);
          shapes.push(shapeOf(stateOnly(got)[0]!.view).split("|").slice(0, 2).join("|"));
        } else {
          expect(`${name}:${got.length}`).toBe(`${name}:0`);
        }
      }
    }
    expect(new Set(shapes).size).toBe(1);
    expect(JSON.stringify(await storedRoom(game.code))).toBe(before);
  });
});

describe("이전 판 round 의 메시지는 폐기된다 (L41, T-11-28)", () => {
  it("round 1 단계 키로 보낸 chat·typing·emote 는 round 2 에서 아무에게도 가지 않고, 이전 round 의 ready·rematch 는 거절 응답이다", { timeout: 120_000 }, async () => {
    const g = await endedGame4();
    const [host, ...guests] = g.socks as [TestSocket, ...TestSocket[]];
    await readyUp(guests, g.socks, 4);
    send(host, { t: "rematch", round: 1 });
    for (const s of g.socks) await nextFrame(s, isAssigning);
    await advanceTo(g.code, g.socks, "dayAnnounce");
    for (const s of g.socks) await settle(s, mark(s));
    expect(lastViewOf(host).round).toBe(2);

    // 같은 일차·같은 단계 이름이지만 round 가 1 인 키 — 현재 키는 2:1:dayAnnounce 다.
    const stale = `1:1:dayAnnounce`;
    expect(phaseKeyOfView(host)).toBe("2:1:dayAnnounce");
    await resetChatRates(g.code);
    const marks = g.socks.map((s) => mark(s));
    send(guests[0]!, { t: "chat", text: "지난 판 키의 채팅", pk: stale });
    send(guests[1]!, { t: "typing", on: true, pk: stale });
    emoteSend(guests[2]!, "clap", stale);
    for (const [i, s] of g.socks.entries()) {
      const got = await settle(s, marks[i]!);
      expect(got.filter((m) => m.t === "chat" || m.t === "typing" || m.t === "emote")).toEqual([]);
      // 보낸 사람에게만 chat 거절(+자기 state)이 갈 수 있다
      if (s !== guests[0]) expect(got).toEqual([]);
    }
    expect(await chatKeysOf(g.code)).toEqual([]);

    // 이전 round 의 ready·rematch: 게임 중에도 결과 단계에서도 거절 응답(state 한 개)이다.
    const m1 = host.frames.length;
    send(host, { t: "rematch", round: 1 });
    expect((await settle(host, m1)).map((m) => m.t)).toEqual(["state"]);

    await toEndedByMafia(g.code, g.socks);
    expect(lastViewOf(host).round).toBe(2);
    await readyUp(guests, g.socks, 4, 2);
    for (const [name, from, msg] of [
      ["이전 round ready", guests[0]!, { t: "ready", on: false, round: 1 }],
      ["이전 round rematch", host, { t: "rematch", round: 1 }],
    ] as Array<[string, TestSocket, unknown]>) {
      const marks2 = g.socks.map((s) => mark(s));
      send(from, msg);
      for (const [i, s] of g.socks.entries()) {
        const got = await settle(s, marks2[i]!);
        expect(`${name}:${s === from ? got.map((m) => m.t).join(",") : got.length}`).toBe(`${name}:${s === from ? "state" : 0}`);
      }
    }
    expect(lastViewOf(guests[0]!).players.filter((p) => p.ready === true).length).toBe(4); // 이전 round 의 ready off 는 무시됐다
    // 지금 round(2) 의 rematch 는 받아들여져 round 3 이 된다.
    send(host, { t: "rematch", round: 2 });
    for (const s of g.socks) await nextFrame(s, (m) => m.t === "state" && m.view.phase === "assigning" && m.view.round === 3);
  });
});

/** 소켓 view 로 만든 지금의 단계 키(`판:일차:단계`). */
function phaseKeyOfView(sock: TestSocket): string {
  const v = lastViewOf(sock);
  return `${v.round ?? 1}:${v.day?.n ?? 0}:${v.phase}`;
}
