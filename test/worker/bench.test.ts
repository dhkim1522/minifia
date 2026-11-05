// 쉬는 사람(bench, 11-08, 결정 D-13·D-18, 누설 L38): 다시 하기에서 준비하지 않은 사람은 참가자 목록 밖에서 기다린다.
// 게임 중 그들의 소켓이 받는 것은 hello·rematch 의 쉬는 사람 전용 state 한 개와 pong 뿐이고, 그들의 메시지는 상태를 바꾸지 않으며 응답도 없다.
import { env } from "cloudflare:workers";
import { runDurableObjectAlarm } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import type { ServerMessage } from "../../shared/protocol";
import {
  advanceTo,
  chatKeysOf,
  chatSend,
  closePhase,
  closed,
  connect,
  editRoom,
  framesOf,
  hello,
  killSeats,
  lastViewOf,
  mark,
  nextFrame,
  pause,
  resetChatRates,
  richEndedGame6,
  send,
  settle,
  storedRoom,
  until,
} from "./helpers";
import type { RichGame6, TestSocket } from "./helpers";

type StateFrame = Extract<ServerMessage, { t: "state" }>;
const isAssigning = (m: ServerMessage): boolean => m.t === "state" && m.view.phase === "assigning";
const isEnded = (m: ServerMessage): boolean => m.t === "state" && m.view.phase === "ended";
const notPong = (m: ServerMessage): boolean => m.t !== "pong";

interface Rested {
  g: RichGame6;
  /** 방장 + 준비한 손님 셋. */
  players: TestSocket[];
  /** 준비하지 않아 쉬는 두 사람. */
  resting: [TestSocket, TestSocket];
  restingTokens: [string, string];
  restingSeats: [number, number];
  /** 다시 하기를 보내기 직전 쉬는 두 소켓이 받은 프레임 수 — 그 앞은 지난 판 결과 단계까지의 프레임이다. */
  since: [number, number];
  /** 같은 시점에 참가자 네 소켓이 받은 프레임 수. */
  playersSince: number[];
}

/** 6명 판을 ended 까지 모은 뒤 4명만 준비해 다시 하기를 시작한다. 쉬는 두 소켓은 쉬는 사람 state 한 개를 받은 상태다. */
async function restedGame(): Promise<Rested> {
  const g = await richEndedGame6();
  const players = g.socks.slice(0, 4);
  const resting = g.socks.slice(4) as [TestSocket, TestSocket];
  for (const s of players.slice(1)) send(s, { t: "ready", on: true, round: 1 });
  await until("네 명 준비", async () => players.every((s) => lastViewOf(s).players.filter((p) => p.ready === true).length === 4));
  const since: [number, number] = [mark(resting[0]), mark(resting[1])];
  const playersSince = players.map((s) => mark(s));
  send(players[0]!, { t: "rematch", round: 1 });
  for (const s of players) await nextFrame(s, isAssigning);
  for (const s of resting) await nextFrame(s, (m) => m.t === "state" && m.view.resting === true);
  for (const s of g.socks) await settle(s, mark(s));
  return {
    since,
    playersSince,
    g,
    players,
    resting,
    restingTokens: [g.actors[4]!.token, g.actors[5]!.token],
    restingSeats: [g.actors[4]!.seat, g.actors[5]!.seat],
  };
}

/** 쉬는 사람이 보낼 수 있는 모든 종류의 메시지(스키마를 통과하는 것들) — 한 초에 20개 한도를 넘지 않게 두 묶음이다. */
function junkBatches(pk: string, token: string): unknown[][] {
  return [
    [
      { t: "chat", text: "쉬는 사람의 채팅", pk },
      { t: "typing", on: true, pk },
      { t: "emote", id: "clap", pk },
      { t: "point", target: 0 },
      { t: "pick", target: 0 },
      { t: "verdict", agree: true },
      { t: "dress", look: "hood" },
      { t: "ready", on: true, round: 2 },
      { t: "rematch", round: 2 },
      { t: "mapPick", map: "bar" },
      { t: "badge", role: "police" },
      { t: "whisper", to: 0, text: "몰래" },
      { t: "will", text: "유언" },
      { t: "note", text: "쪽지" },
    ],
    [
      { t: "move", x: 0, z: 0 },
      { t: "endDiscussion", on: true },
      { t: "start" },
      { t: "kick", seat: 0 },
      { t: "hello", token },
      { t: "testSkip" },
      { t: "testReset" },
      { t: "testRole", role: "mafia" },
      { t: "testBots", count: 1 },
      { t: "testBotVote", exec: "yes", pick: "host" },
    ],
  ];
}

describe("쉬는 사람 — 판 중 전 구간 (D-13, L38)", () => {
  it(
    "다시 하기 직후 쉬는 사람은 전용 state 한 개를 받고, 이후 assigning~morning 내내 아무 프레임도 받지 않는다",
    { timeout: 120_000 },
    async () => {
      const t = await restedGame();
      for (const [i, s] of t.resting.entries()) {
        const fresh = framesOf(s).slice(t.since[i]).filter(notPong);
        expect(fresh.map((m) => m.t)).toEqual(["state"]);
        const states = fresh.filter((m): m is StateFrame => m.t === "state");
        expect(states.length).toBe(1);
        const v = states[0]!.view;
        expect(v.resting).toBe(true);
        expect(v.round).toBe(2);
        expect(v.players.length).toBe(1);
        expect(fresh.filter((m) => m.t === "world" || m.t === "chat" || m.t === "chatLog" || m.t === "resultLog").length).toBe(0);
      }
      // 참가자의 state 에는 쉬는 사람의 존재가 어디에도 없다
      const restNames = t.g.actors.slice(4).map((a) => lastViewOf(a.sock).players[0]!.nickname);
      for (const s of t.players) {
        const text = JSON.stringify(lastViewOf(s));
        for (const name of restNames) expect(text).not.toContain(name);
        expect(lastViewOf(s).players.map((p) => p.seat).sort()).not.toContain(t.restingSeats[0]);
        expect(lastViewOf(s).players.length).toBe(4);
      }
      const code = t.g.code;
      for (const phase of ["roleReveal", "dayAnnounce", "discussion", "nomination", "night", "morning"] as const) {
        await advanceTo(code, t.players, phase);
        for (const s of t.resting) expect(await settle(s, mark(s))).toEqual([]);
      }
      for (const [i, s] of t.resting.entries()) {
        expect(framesOf(s).slice(t.since[i]).filter(notPong).map((m) => m.t)).toEqual(["state"]);
      }
    },
  );

  it(
    "쉬는 사람이 보낸 어떤 메시지도 상태·저장소·다른 소켓·보낸 소켓에 변화가 없다 (응답 프레임도 오류 프레임도 없다)",
    { timeout: 120_000 },
    async () => {
      const t = await restedGame();
      await advanceTo(t.g.code, t.players, "discussion");
      const [r0] = t.resting;
      const others = [...t.players, t.resting[1]];
      for (const s of [r0, ...others]) await settle(s, mark(s));
      const roomBefore = JSON.stringify(await storedRoom(t.g.code));
      const keysBefore = await chatKeysOf(t.g.code);
      const pk = `2:${lastViewOf(t.players[0]!).day?.n ?? 1}:discussion`;
      for (const batch of junkBatches(pk, t.restingTokens[0])) {
        const marks = [r0, ...others].map((s) => mark(s));
        for (const m of batch) send(r0, m);
        await pause(50);
        for (const [i, s] of [r0, ...others].entries()) expect(await settle(s, marks[i]!)).toEqual([]);
        await pause(1_100);
      }
      expect(JSON.stringify(await storedRoom(t.g.code))).toBe(roomBefore);
      expect(await chatKeysOf(t.g.code)).toEqual(keysBefore);
      // ping 은 pong
      const m0 = mark(r0);
      send(r0, { t: "ping", c: 4242 });
      await nextFrame(r0, (m) => m.t === "pong" && m.c === 4242);
      expect(framesOf(r0).slice(m0).map((m) => m.t)).toEqual(["pong"]);
    },
  );
});

describe("쉬는 사람 — 접속·나가기·정리 (D-13, D-18)", () => {
  it(
    "끊겨도 다른 소켓에 state 가 가지 않고, 같은 토큰으로 돌아오면 쉬는 사람 state 한 개만 받는다 (월드·chatLog 없음)",
    { timeout: 120_000 },
    async () => {
      const t = await restedGame();
      const [r0] = t.resting;
      const marks = t.players.map((s) => mark(s));
      r0.ws.close(1000, "bye");
      await until("bench 끊김", async () => {
        const room = (await storedRoom(t.g.code)) as unknown as { bench: Array<{ seat: number; connected: boolean; disconnectedAt?: number }> };
        const row = room.bench.find((p) => p.seat === t.restingSeats[0]);
        return row?.connected === false && typeof row.disconnectedAt === "number";
      });
      for (const [i, s] of t.players.entries()) expect(await settle(s, marks[i]!)).toEqual([]);
      const marks2 = t.players.map((s) => mark(s));

      const back = await connect(t.g.code);
      const first = await hello(back, t.restingTokens[0]);
      expect(first.view.resting).toBe(true);
      expect(first.view.me.seat).toBe(t.restingSeats[0]);
      expect(await settle(back, 0)).toEqual([first]);
      for (const [i, s] of t.players.entries()) expect(await settle(s, marks2[i]!)).toEqual([]);
      const room = (await storedRoom(t.g.code)) as unknown as { bench: Array<{ seat: number; connected: boolean; disconnectedAt?: number }> };
      const row = room.bench.find((p) => p.seat === t.restingSeats[0])!;
      expect(row.connected).toBe(true);
      expect(Object.hasOwn(row, "disconnectedAt")).toBe(false);
    },
  );

  it("leave 는 bench 에서 빼고 소켓을 4003 left 로 닫는다 — 그 토큰은 더는 들어올 수 없고, 다른 소켓은 프레임이 없다", { timeout: 120_000 }, async () => {
    const t = await restedGame();
    const [r0] = t.resting;
    const marks = t.players.map((s) => mark(s));
    send(r0, { t: "leave" });
    expect(await closed(r0)).toBe("4003 left");
    const room = (await storedRoom(t.g.code)) as unknown as { bench?: Array<{ seat: number }> };
    expect((room.bench ?? []).map((p) => p.seat)).toEqual([t.restingSeats[1]]);
    for (const [i, s] of t.players.entries()) expect(await settle(s, marks[i]!)).toEqual([]);
    const again = await connect(t.g.code);
    send(again, { t: "hello", token: t.restingTokens[0] });
    expect(await closed(again)).toBe("4003 invalid_token");
  });

  it("끊긴 지 정리 시간이 지난 쉬는 사람은 알람이 bench 에서 지운다 (연결된 쉬는 사람은 남는다)", { timeout: 120_000 }, async () => {
    const t = await restedGame();
    const [r0] = t.resting;
    r0.ws.close(1000, "bye");
    await until("bench 끊김", async () => {
      const room = (await storedRoom(t.g.code)) as unknown as { bench: Array<{ seat: number; connected: boolean }> };
      return room.bench.find((p) => p.seat === t.restingSeats[0])?.connected === false;
    });
    await editRoom(t.g.code, (room) => ({
      ...room,
      bench: (room.bench as Array<Record<string, unknown>>).map((p) => (p.seat === t.restingSeats[0] ? { ...p, disconnectedAt: Date.now() - 400_000 } : p)),
    }));
    expect(await runDurableObjectAlarm(env.ROOM.getByName(t.g.code))).toBe(true);
    const room = (await storedRoom(t.g.code)) as unknown as { bench?: Array<{ seat: number }> };
    expect((room.bench ?? []).map((p) => p.seat)).toEqual([t.restingSeats[1]]);
  });
});

describe("쉬는 사람 — 결과 합류 (D-13, sat)", () => {
  it(
    "판이 ended 로 들어서면 쉬는 사람은 sat 로 합류해 결과 state 와 그 판의 숨은 기록을 받는다. 그 전에는 마피아 밤 채팅을 받지 않았다",
    { timeout: 180_000 },
    async () => {
      const t = await restedGame();
      const code = t.g.code;
      await advanceTo(code, t.players, "night");
      const mafiaSock = t.players.find((s) => lastViewOf(s).me.role === "mafia")!;
      const roles = t.players.map((s) => ({ sock: s, seat: lastViewOf(s).me.seat, role: lastViewOf(s).me.role }));
      await resetChatRates(code);
      chatSend(mafiaSock, "밤 마피아 줄 BENCHCANARY");
      for (const s of t.players) await settle(s, mark(s));
      const victims = roles.filter((r) => r.role !== "mafia").sort((a, b) => (a.role === "police" ? -1 : b.role === "police" ? 1 : a.seat - b.seat)).slice(0, 2);
      await killSeats({ code, socks: t.players, actors: [] }, victims.map((v) => v.seat));
      await advanceTo(code, t.players, "morning");
      for (const [i, s] of t.resting.entries()) {
        expect(framesOf(s).slice(t.since[i]).filter(notPong).length).toBe(1);
        expect(JSON.stringify(framesOf(s).slice(t.since[i]))).not.toContain("BENCHCANARY");
      }
      const marks = t.resting.map((s) => mark(s));
      await closePhase(code);
      for (const s of t.g.socks) await nextFrame(s, isEnded);
      for (const [i, s] of t.resting.entries()) {
        const got = await settle(s, marks[i]!);
        const state = got.find((m): m is StateFrame => m.t === "state")!;
        expect(state.view.phase).toBe("ended");
        expect(state.view.resting).toBeUndefined();
        expect(state.view.me.role).toBeUndefined();
        expect(state.view.result?.seats.length).toBe(4);
        expect(state.view.players.filter((p) => p.sat === true).map((p) => p.seat).sort()).toEqual([...t.restingSeats].sort());
        const log = got.filter((m) => m.t === "resultLog");
        expect(JSON.stringify(log)).toContain("BENCHCANARY");
      }
      for (const s of t.players) {
        const v = lastViewOf(s);
        expect(v.players.filter((p) => p.sat === true).length).toBe(2);
        expect(v.result?.awards?.length).toBe(4);
      }
      const stored = (await storedRoom(code)) as unknown as { bench?: unknown; players: Array<{ sat?: boolean; role?: string }> };
      expect(stored.bench).toBeUndefined();
      expect(stored.players.filter((p) => p.sat === true).every((p) => p.role === undefined)).toBe(true);
      // 합류한 뒤에는 결과 단계의 의상 고르기가 된다
      send(t.resting[0], { t: "dress", look: "noir" });
      await until("sat 의상", async () => lastViewOf(t.players[0]!).players.find((p) => p.seat === t.restingSeats[0])?.look === "noir");
    },
  );
});

describe("쉬는 사람 신분 행 × 전 구간 (L38)", () => {
  it(
    "쉬는 사람이 있는 판에서 참가자(방장·마피아·경찰·시민) 소켓이 받은 모든 프레임에 쉬는 사람의 닉네임·좌석·토큰이 없고, 판이 끝나기 전까지 players[] 는 네 명뿐이다. 끝나면 sat 로만 공개된다",
    { timeout: 180_000 },
    async () => {
      const t = await restedGame();
      const code = t.g.code;
      const restNames = t.resting.map((s) => lastViewOf(s).players[0]!.nickname);
      const restSeats = new Set<number>(t.restingSeats);
      await advanceTo(code, t.players, "dayAnnounce");
      await advanceTo(code, t.players, "discussion");
      // 낮에 채팅·동작·이동·주장이 오간다 — 쉬는 사람이 받는 길이 하나라도 있으면 아래 단언이 깨진다
      await resetChatRates(code);
      const view0 = lastViewOf(t.players[0]!);
      const pk = `${view0.round ?? 1}:${view0.day?.n ?? 0}:${view0.phase}`;
      send(t.players[1]!, { t: "chat", text: "낮의 한마디", pk });
      send(t.players[2]!, { t: "badge", role: "citizen" });
      send(t.players[3]!, { t: "move", x: 100, z: 100 });
      for (const s of t.players) await settle(s, mark(s));
      await advanceTo(code, t.players, "night");
      for (const s of t.players) await settle(s, mark(s));
      const beforeEnd = t.players.map((s) => mark(s));

      for (const [i, s] of t.players.entries()) {
        const frames = framesOf(s).slice(t.playersSince[i]!, beforeEnd[i]!);
        const json = JSON.stringify(frames);
        for (const name of restNames) expect(json.includes(name)).toBe(false);
        for (const token of t.restingTokens) expect(json.includes(token)).toBe(false);
        for (const m of frames) {
          if (m.t === "state") {
            expect(m.view.players.length).toBe(4);
            expect(m.view.players.some((p) => restSeats.has(p.seat) || p.sat === true)).toBe(false);
            expect("resting" in m.view).toBe(false);
          }
          if (m.t === "chat") expect(restSeats.has(m.seat)).toBe(false);
          if (m.t === "world" && m.k === "snap") expect(m.ents.length).toBeLessThanOrEqual(4);
        }
      }

      // 끝나면 합류한 사람은 sat 표시와 함께 공개된다.
      const roles = t.players.map((s) => ({ seat: lastViewOf(s).me.seat, role: lastViewOf(s).me.role }));
      const victims = roles.filter((r) => r.role !== "mafia").sort((a, b) => a.seat - b.seat).slice(0, 2).map((r) => r.seat);
      await killSeats({ code, socks: t.players, actors: [] }, victims);
      await advanceTo(code, t.players, "morning");
      await closePhase(code);
      for (const s of t.players) await nextFrame(s, isEnded);
      for (const s of t.players) {
        const v = lastViewOf(s);
        expect(v.players.filter((p) => p.sat === true).map((p) => p.seat).sort()).toEqual([...restSeats].sort());
        expect(v.players.length).toBe(6);
      }
    },
  );
});
