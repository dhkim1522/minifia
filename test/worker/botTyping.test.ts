// feedback-1 (09-24): 봇 입력 중 신호. 봇은 채팅 줄 직전에 서버 안에서 사람과 같은 중계 본체(relayTyping)로 입력 중 켜짐을 낸다.
// 받는 사람은 사람의 typing 과 같은 audience 다 — 밤 마피아 봇의 입력 중은 산 마피아·유령 소켓에만 가고 산 시민 편 소켓은 typing 프레임 0개다.
// "오지 않았음" 은 settle(ping/pong)로 증명한다. 실패 출력은 한 줄이어야 해서(TAP) 프레임은 요약 문자열로 비교한다.
import { evictDurableObject, runDurableObjectAlarm, runInDurableObject } from "cloudflare:test";
import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import type { BotStep } from "../../shared/game/bots";
import type { ServerMessage } from "../../shared/protocol";
import { advanceTo, editRoom, mapPlayers, mark, nextFrame, pause, seat, send, settle, storedRoom, until } from "./helpers";
import type { Seated, TestSocket } from "./helpers";

type TypingFrame = Extract<ServerMessage, { t: "typing" }>;
const typingsOf = (msgs: ServerMessage[]): TypingFrame[] => msgs.filter((m): m is TypingFrame => m.t === "typing");
const chatsOf = (msgs: ServerMessage[]): Array<Extract<ServerMessage, { t: "chat" }>> => msgs.filter((m): m is Extract<ServerMessage, { t: "chat" }> => m.t === "chat");

interface Raw {
  id: string;
  seat: number;
  isBot?: boolean;
  role?: string;
  alive?: boolean;
}
const playersOf = async (code: string): Promise<Raw[]> => (await storedRoom(code)).players as unknown as Raw[];

/** 방장 + 손님 둘 + 봇 셋의 테스트 방을 시작해 phase 까지 넘기고, 모든 소켓을 flush 해 둔다. */
async function botRoom(phase: "discussion" | "night"): Promise<{ r: Seated; socks: TestSocket[]; bots: Raw[] }> {
  const r = await seat(2, 0, { testMode: true });
  const socks = [r.host, ...r.guests.map((g) => g.sock)];
  for (const s of socks) await settle(s, mark(s));
  send(r.host, { t: "testBots", count: 3 });
  await until("봇 셋", async () => (await playersOf(r.code)).filter((p) => p.isBot === true).length === 3);
  for (const s of socks) await settle(s, mark(s));
  send(r.host, { t: "start" });
  for (const s of socks) await nextFrame(s, (m) => m.t === "state" && m.view.phase === "assigning");
  await advanceTo(r.code, socks, phase);
  for (const s of socks) await settle(s, mark(s));
  const bots = (await playersOf(r.code)).filter((p) => p.isBot === true).sort((a, b) => a.seat - b.seat);
  return { r, socks, bots };
}

/** 봇 한 명의 typing → chat 두 단계만 남기고 과거로 당긴 뒤 알람을 돌려 실행시킨다(plan.key 는 그대로 — 낡은 계획으로 버려지지 않게). */
async function runTypingThenChat(code: string, botId: string, text: string): Promise<void> {
  let key = "";
  for (let i = 0; i < 60 && key === ""; i += 1) {
    const plan = ((await storedRoom(code)) as unknown as { botPlan?: { key: string } }).botPlan;
    if (plan !== undefined) key = plan.key;
    else await pause(25);
  }
  expect(key).not.toBe("");
  const stub = env.ROOM.getByName(code);
  const past = Date.now() - 1000;
  const steps: BotStep[] = [
    { at: past, botId, act: { t: "typing" } },
    { at: past, botId, act: { t: "chat", text } },
  ];
  await runInDurableObject(stub, async (_i, state) => {
    const room = await state.storage.get<Record<string, unknown>>("room");
    if (!room) throw new Error("방이 없다");
    await state.storage.put("room", { ...room, botPlan: { key, steps } });
  });
  await evictDurableObject(stub);
  expect(await runDurableObjectAlarm(stub)).toBe(true);
}

describe("봇 입력 중 신호 — 낮 토론 (feedback-1)", () => {
  it("사람 소켓은 그 봇 좌석의 typing on 프레임을 그 봇의 chat 줄보다 먼저 받는다", async () => {
    const { r, socks, bots } = await botRoom("discussion");
    const bot = bots[0]!;
    const from = socks.map((s) => mark(s));
    await runTypingThenChat(r.code, bot.id, "저 아니에요");
    await nextFrame(r.host, (m) => m.t === "chat" && m.seat === bot.seat);
    for (const [i, s] of socks.entries()) {
      const got = await settle(s, from[i]!);
      const order = got.filter((m) => (m.t === "typing" && m.seat === bot.seat) || (m.t === "chat" && m.seat === bot.seat)).map((m) => (m.t === "typing" ? `typing:${m.on}` : "chat"));
      expect(`${i}:${order.join(",")}`).toBe(`${i}:typing:true,chat`);
    }
  }, 40_000);
});

describe("봇 입력 중 신호 — 밤 마피아 채널 (T-09-50)", () => {
  /** 봇 하나를 마피아로, 방장은 산 마피아, 손님 0 은 산 시민, 손님 1 은 탈락(유령)으로 맞춘 밤. */
  async function nightWithGhost(): Promise<{ r: Seated; mafiaBot: Raw; host: TestSocket; citizen: TestSocket; ghost: TestSocket }> {
    const { r, socks, bots } = await botRoom("night");
    const mafiaBot = bots[0]!;
    const players = await playersOf(r.code);
    const hostSeat = players.find((p) => p.isBot !== true && p.seat === 0)!.seat;
    const guestSeats = r.guests.map((g) => g.seat);
    await editRoom(r.code, (room) =>
      mapPlayers(room, (p) => {
        const s = p.seat as number;
        if (p.id === mafiaBot.id) return { ...p, role: "mafia", alive: true };
        if (s === hostSeat) return { ...p, role: "mafia", alive: true };
        if (s === guestSeats[0]) return { ...p, role: "citizen", alive: true };
        if (s === guestSeats[1]) return { ...p, role: "citizen", alive: false };
        return { ...p, role: "citizen", alive: true };
      }),
    );
    for (const s of socks) await settle(s, mark(s));
    return { r, mafiaBot, host: r.host, citizen: r.guests[0]!.sock, ghost: r.guests[1]!.sock };
  }

  const actTyping = async (code: string, botId: string): Promise<void> => {
    await runInDurableObject(env.ROOM.getByName(code), async (instance) => {
      await instance["actAsBot"]({ at: 0, botId, act: { t: "typing" } });
    });
  };

  it("마피아 봇의 typing 은 산 마피아·유령 소켓에만 가고 산 시민 소켓은 typing 프레임이 0개다", async () => {
    const { r, mafiaBot, host, citizen, ghost } = await nightWithGhost();
    const marks = [host, citizen, ghost].map((s) => mark(s));
    await actTyping(r.code, mafiaBot.id);
    const [h, c, g] = await Promise.all([host, citizen, ghost].map((s, i) => settle(s, marks[i]!)));
    expect(`host:${typingsOf(h!).map((m) => `${m.seat}:${m.on}`).join(",")}`).toBe(`host:${mafiaBot.seat}:true`);
    expect(`ghost:${typingsOf(g!).map((m) => `${m.seat}:${m.on}`).join(",")}`).toBe(`ghost:${mafiaBot.seat}:true`);
    expect(`citizen:${typingsOf(c!).length}:${chatsOf(c!).length}`).toBe("citizen:0:0");
  }, 40_000);

  it("시민 편 봇의 typing 은 밤에 아무에게도 가지 않는다 (채널이 없다)", async () => {
    const { r, host, citizen, ghost } = await nightWithGhost();
    const citizenBot = (await playersOf(r.code)).find((p) => p.isBot === true && p.role === "citizen" && p.alive === true)!;
    const marks = [host, citizen, ghost].map((s) => mark(s));
    await actTyping(r.code, citizenBot.id);
    const got = await Promise.all([host, citizen, ghost].map((s, i) => settle(s, marks[i]!)));
    expect(got.map((m) => typingsOf(m).length).join(",")).toBe("0,0,0");
  }, 40_000);

  it("같은 봇의 typing 을 1.5초 안에 두 번 켜도 두 번째는 중계되지 않는다 (typingRelay 간격)", async () => {
    const { r, mafiaBot, host } = await nightWithGhost();
    const from = mark(host);
    await actTyping(r.code, mafiaBot.id);
    await actTyping(r.code, mafiaBot.id);
    const got = await settle(host, from);
    expect(typingsOf(got).length).toBe(1);
    expect(got.map((m) => (m.t === "typing" ? m.seat : -1)).filter((x) => x >= 0).join(",")).toBe(String(mafiaBot.seat));
  }, 40_000);
});
