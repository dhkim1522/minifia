// 테스트 방 서버 봇 워커 통합 테스트(quick 261025-fx1, 결정 0024): 실제 HTTP·소켓으로 testBots 와 봇 행동을 workerd 에서 확인한다.
// 실패 출력은 한 줄이어야 해서(TAP) 프레임 목록은 summary() 한 줄 문자열로 비교한다.
import { env, exports } from "cloudflare:workers";
import { evictDurableObject, runDurableObjectAlarm, runInDurableObject } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { BOT_CHAT_LINES } from "../../shared/game/bots";
import type { PhaseId, RoomView, ServerMessage } from "../../shared/protocol";
import {
  advanceTo,
  alarmOf,
  closed,
  collect,
  driveToEnded,
  editRoom,
  mapPlayers,
  nextFrame,
  seat,
  send,
  skipThrough,
  storedRoom,
  until,
  votesIn,
} from "./helpers";
import type { Seated, TestSocket } from "./helpers";

const allSockets = (r: Seated): TestSocket[] => [r.host, ...r.guests.map((g) => g.sock)];
const parse = (raw: string): ServerMessage => JSON.parse(raw) as ServerMessage;
type State = Extract<ServerMessage, { t: "state" }>;

/** 프레임 목록을 "[state:night,error:BAD_MESSAGE]" 같은 한 줄로. 빈 목록도 "[]" 라 비어 있지 않다. */
const summary = (msgs: ServerMessage[]): string =>
  `[${msgs
    .map((m) => (m.t === "state" ? `state:${m.view.phase}` : m.t === "error" ? `error:${m.code}` : m.t))
    .join(",")}]`;

let pingCounter = 0;
/** 행동 전에 적어 둔 frames 길이 이후 ~ pong 직전까지 받은 프레임 — "오지 않았음" 의 증명(ping/pong 사이). */
async function settle(sock: TestSocket, from: number): Promise<ServerMessage[]> {
  pingCounter += 1;
  const c = pingCounter;
  send(sock, { t: "ping", c });
  await nextFrame(sock, (m) => m.t === "pong" && m.c === c);
  return sock.frames.slice(from, sock.cursor - 1).map(parse);
}

const mark = (sock: TestSocket): number => sock.frames.length;

/** 방 꾸미기 중 늦게 도착하는 입장 방송을 모든 소켓에서 다 받은 뒤 시작하게 한다(ping/pong 으로 흘려 보낸다). */
async function seatQuiet(guests: number, options?: { testMode?: boolean }): Promise<Seated> {
  const r = await seat(guests, 0, options);
  for (const sock of allSockets(r)) await settle(sock, mark(sock));
  return r;
}
const isPhase = (phase: PhaseId) => (m: ServerMessage): boolean => m.t === "state" && m.view.phase === phase;
const lobbyOf = (n: number) => (m: ServerMessage): boolean => m.t === "state" && m.view.phase === "lobby" && m.view.players.length === n;

async function sendAndSettle(sock: TestSocket, msg: unknown): Promise<ServerMessage[]> {
  const from = mark(sock);
  send(sock, msg);
  return settle(sock, from);
}

function lastView(sock: TestSocket): RoomView {
  const views = collect(sock)
    .map(parse)
    .filter((m): m is State => m.t === "state")
    .map((m) => m.view);
  return views.at(-1)!;
}

type Raw = Record<string, unknown>;
interface BotRaw { id: string; seat: number; isBot?: boolean; token: string; connId: unknown; connected: boolean; nickname: string }
const stored = async (code: string): Promise<Raw> => (await storedRoom(code)) as unknown as Raw;
const playersOf = async (code: string): Promise<BotRaw[]> => (await stored(code)).players as BotRaw[];
const botsOf = async (code: string): Promise<BotRaw[]> => (await playersOf(code)).filter((p) => p.isBot === true).sort((a, b) => a.seat - b.seat);

async function start(r: Seated): Promise<void> {
  send(r.host, { t: "start" });
  for (const s of allSockets(r)) await nextFrame(s, isPhase("assigning"));
}

/**
 * testSkip 을 거듭해 phase 에 닿는다. 저장된 단계를 보고 반복하고,
 * 매번 소켓마다 다음 state 프레임 하나를 기다린다(보내기 전에 읽을 위치를 끝으로 옮긴다).
 */
async function skipUntil(r: Seated, phase: PhaseId): Promise<void> {
  for (let i = 0; i < 40 && (await stored(r.code)).phase !== phase; i += 1) {
    for (const s of allSockets(r)) s.cursor = s.frames.length;
    send(r.host, { t: "testSkip" });
    for (const s of allSockets(r)) await nextFrame(s, (m) => m.t === "state");
  }
  expect((await stored(r.code)).phase).toBe(phase);
}

/**
 * 낮을 넘겨 밤으로 간다. 넘기기가 투표 단계에서 안 던진 봇을 대신 던지게 한 뒤(04-08) 봇 표가 무작위로 후보 선택·처형까지 이어지면
 * 방장이 처형되거나 판이 끝나 밤에 닿지 못할 수 있다 — 그래서 여부 투표에서 봇 전원이 반대를 던져 둔 채 넘겨 밤으로 곧장 간다.
 */
async function skipDayToNight(r: Seated): Promise<void> {
  await skipUntil(r, "execVote");
  await editRoom(r.code, (room) => mapPlayers(room, (p) => (p.isBot === true ? { ...p, execVote: false } : p)));
  await skipUntil(r, "night");
}

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/** reschedule 이 봇 계획을 세워 저장할 때까지 기다린다(단계 전환 방송이 저장보다 먼저 도착할 수 있다). */
async function waitForPlan(code: string): Promise<void> {
  for (let i = 0; i < 60; i += 1) {
    const plan = (await stored(code)).botPlan as { steps: unknown[] } | undefined;
    if (plan !== undefined && plan.steps.length > 0) return;
    await sleep(25);
  }
  throw new Error("waitForPlan: 봇 계획이 저장되지 않았다");
}

/** 계획 키가 저장될 때까지 기다린다(행동이 없는 차례의 빈 계획도 키로 알 수 있다). 마지막으로 읽은 계획을 돌려준다. */
async function waitForPlanKey(code: string): Promise<{ key: string; steps: Array<{ at: number; botId: string; act: { t: string } }> }> {
  for (let i = 0; i < 60; i += 1) {
    const plan = (await stored(code)).botPlan as { key: string; steps: Array<{ at: number; botId: string; act: { t: string } }> } | undefined;
    if (plan !== undefined) return plan;
    await sleep(25);
  }
  throw new Error("waitForPlanKey: 봇 계획 키가 저장되지 않았다");
}

/**
 * 시각 당기기 도우미: 저장된 botPlan.steps 의 at 을 모두 과거로 바꾸고 DO 를 evict 한 뒤 알람을 부른다
 * (forceDue 와 같은 방식 — 생성자가 저장소에서 복구하고 소켓은 하이버네이션으로 남는다).
 */
async function forceBotsDue(code: string): Promise<void> {
  await waitForPlan(code);
  const stub = env.ROOM.getByName(code);
  await runInDurableObject(stub, async (_instance, state) => {
    const room = await state.storage.get<Record<string, unknown>>("room");
    const plan = room?.botPlan as { key: string; steps: Array<Record<string, unknown>> } | undefined;
    if (!room || !plan) throw new Error("forceBotsDue: 봇 계획이 없다");
    const steps = plan.steps.map((s) => ({ ...s, at: Date.now() - 1000 }));
    await state.storage.put("room", { ...room, botPlan: { ...plan, steps } });
  });
  await evictDurableObject(stub);
  expect(await runDurableObjectAlarm(stub)).toBe(true);
}

describe("testBots 거부", () => {
  it("일반 방은 방장·손님 모두 BAD_MESSAGE 오류 프레임 하나뿐이고 방 상태가 그대로다", async () => {
    const r = await seatQuiet(2);
    const before = JSON.stringify((await stored(r.code)).players);
    for (const sock of allSockets(r)) {
      expect(summary(await sendAndSettle(sock, { t: "testBots", count: 3 }))).toBe("[error:BAD_MESSAGE]");
    }
    expect(JSON.stringify((await stored(r.code)).players)).toBe(before);
  });

  it("테스트 방 손님은 NOT_HOST 와 그 소켓에만 state 가 간다", async () => {
    const r = await seatQuiet(2, { testMode: true });
    const guest = r.guests[0]!;
    const hostMark = mark(r.host);
    expect(summary(await sendAndSettle(guest.sock, { t: "testBots", count: 3 }))).toBe("[error:NOT_HOST,state:lobby]");
    expect(summary(await settle(r.host, hostMark))).toBe("[]");
    expect((await botsOf(r.code)).length).toBe(0);
  });

  it("테스트 방 시작 뒤 방장은 WRONG_PHASE 와 state 를 받는다", async () => {
    const r = await seatQuiet(3, { testMode: true });
    await start(r);
    expect(summary(await sendAndSettle(r.host, { t: "testBots", count: 2 }))).toBe("[error:WRONG_PHASE,state:assigning]");
    expect((await botsOf(r.code)).length).toBe(0);
  });

  it("count 8 과 덧붙은 키와 소수는 BAD_MESSAGE 오류뿐이다", async () => {
    const r = await seatQuiet(0, { testMode: true });
    expect(summary(await sendAndSettle(r.host, { t: "testBots", count: 8 }))).toBe("[error:BAD_MESSAGE]");
    expect(summary(await sendAndSettle(r.host, { t: "testBots", count: 2, extra: 1 }))).toBe("[error:BAD_MESSAGE]");
    expect(summary(await sendAndSettle(r.host, { t: "testBots", count: 1.5 }))).toBe("[error:BAD_MESSAGE]");
    expect((await botsOf(r.code)).length).toBe(0);
  });
});

describe("testBots 추가·제거", () => {
  it("방장 testBots 3 이면 두 소켓 모두 인원 5 의 lobby state 를 받고 방장 me.testBots 가 3 이며 손님 프레임에는 봇 표시가 없다", async () => {
    const r = await seatQuiet(1, { testMode: true });
    const guest = r.guests[0]!;
    const guestMark = mark(guest.sock);
    send(r.host, { t: "testBots", count: 3 });
    const hostMsg = (await nextFrame(r.host, lobbyOf(5))) as State;
    const guestMsg = (await nextFrame(guest.sock, lobbyOf(5))) as State;
    expect(String(hostMsg.view.me.testBots)).toBe("3");
    expect(Object.hasOwn(guestMsg.view.me, "testBots")).toBe(false);
    const guestText = guest.sock.frames.slice(guestMark).join("\n");
    expect(guestText.includes("testBots") || guestText.includes("isBot") || guestText.includes("botPlan")).toBe(false);
    const bots = await botsOf(r.code);
    expect(bots.length).toBe(3);
    expect(bots.every((b) => b.isBot === true && b.token === "" && b.connId === null && b.connected)).toBe(true);
  });

  it("testBots 7 이면 인원 8(봇 6)이고 다시 2 면 봇 seat 가 가장 낮은 둘이다", async () => {
    const r = await seatQuiet(1, { testMode: true });
    send(r.host, { t: "testBots", count: 7 });
    await nextFrame(r.host, lobbyOf(8));
    expect((await botsOf(r.code)).length).toBe(6);
    send(r.host, { t: "testBots", count: 2 });
    await nextFrame(r.host, lobbyOf(4));
    expect((await botsOf(r.code)).map((b) => b.seat).join(",")).toBe("2,3");
    // 같은 수 재요청은 프레임이 없다.
    expect(summary(await sendAndSettle(r.host, { t: "testBots", count: 2 }))).toBe("[]");
  });

  it("방장 + 봇 3 은 DO 를 evict 한 뒤에도 방장이 시작할 수 있고 봇 자리는 connected true 다", async () => {
    const r = await seatQuiet(0, { testMode: true });
    send(r.host, { t: "testBots", count: 3 });
    await nextFrame(r.host, lobbyOf(4));
    await evictDurableObject(env.ROOM.getByName(r.code));
    send(r.host, { t: "start" });
    const msg = (await nextFrame(r.host, (m) => m.t === "state" || m.t === "error")) as ServerMessage;
    expect(msg.t === "state" ? msg.view.phase : msg.t === "error" ? msg.code : msg.t).toBe("assigning");
    const view = lastView(r.host);
    const botSeats = (await botsOf(r.code)).map((b) => b.seat);
    expect(view.players.filter((p) => botSeats.includes(p.seat)).every((p) => p.connected)).toBe(true);
    expect(view.players.length).toBe(4);
  });
});

describe("봇 행동", () => {
  it("낮 토론: 손님이 봇 자리에서 온 자유 채팅(ch all, BOT_CHAT_LINES 안의 문구)을 받고 오류·chatReject 프레임은 없다", async () => {
    const r = await seatQuiet(1, { testMode: true });
    send(r.host, { t: "testBots", count: 3 });
    await nextFrame(r.host, lobbyOf(5));
    await start(r);
    await skipUntil(r, "discussion");
    const botSeats = (await botsOf(r.code)).map((b) => b.seat);
    const guest = r.guests[0]!.sock;
    const from = mark(guest);
    await forceBotsDue(r.code);
    const line = (await nextFrame(guest, (m) => m.t === "chat" && botSeats.includes(m.seat))) as Extract<ServerMessage, { t: "chat" }>;
    expect(`${line.ch}:${BOT_CHAT_LINES.includes(line.text)}`).toBe("all:true");
    const frames = (await settle(guest, from)).filter((m) => m.t === "error" || m.t === "chatReject" || m.t === "emoji");
    expect(frames.length).toBe(0);
  }, 30_000);

  // 봇 줄은 사람과 같은 applyChat 본체를 지난다(특권 없음, 결정 0024) — 계획의 무작위를 피해 actAsBot 을 직접 불러 전달 범위와 거절을 확인한다.
  async function botSays(code: string, botId: string, text: string): Promise<void> {
    await runInDurableObject(env.ROOM.getByName(code), async (instance) => {
      await instance["actAsBot"]({ at: Date.now(), botId, act: { t: "chat", text } });
    });
  }

  it("봇 chat: 낮에는 audience 대로 방장과 손님 모두에게 ch all 로 간다", async () => {
    const r = await seatQuiet(1, { testMode: true });
    send(r.host, { t: "testBots", count: 3 });
    await nextFrame(r.host, lobbyOf(5));
    await start(r);
    await skipUntil(r, "discussion");
    const bot = (await botsOf(r.code))[0]!;
    const marks = allSockets(r).map(mark);
    await botSays(r.code, bot.id, "누가 수상해요?");
    const seen = [];
    for (const [i, sock] of allSockets(r).entries()) seen.push(summary((await settle(sock, marks[i]!)).filter((m) => m.t === "chat")));
    expect(seen.join("")).toBe("[chat][chat]");
  }, 30_000);

  it("봇 chat: 밤에는 마피아 봇의 줄이 마피아 방장에게만 ch mafia 로 가고 손님은 한 프레임도 받지 않으며, 마피아가 아닌 봇의 줄은 버려진다", async () => {
    const r = await seatQuiet(1, { testMode: true });
    send(r.host, { t: "testBots", count: 4 });
    await nextFrame(r.host, lobbyOf(6));
    send(r.host, { t: "testRole", role: "mafia" });
    await start(r);
    await skipDayToNight(r);
    const bots = await botsOf(r.code);
    const mafiaBot = bots.find((b) => (b as unknown as { role?: string }).role === "mafia")!;
    const citizenBot = bots.find((b) => (b as unknown as { role?: string }).role !== "mafia")!;
    const guest = r.guests[0]!.sock;
    const mh = mark(r.host);
    const mg = mark(guest);
    await botSays(r.code, mafiaBot.id, "동의해요");
    const hostGot = (await settle(r.host, mh)).filter((m) => m.t === "chat") as Array<Extract<ServerMessage, { t: "chat" }>>;
    const guestGot = await settle(guest, mg);
    expect(`${hostGot.map((m) => `${m.ch}/${m.seat}/${m.text}`).join("|")}#${summary(guestGot.filter((m) => m.t === "chat"))}`).toBe(`mafia/${mafiaBot.seat}/동의해요#[]`);
    const mh2 = mark(r.host);
    const mg2 = mark(guest);
    await botSays(r.code, citizenBot.id, "동의해요");
    expect(`${summary(await settle(r.host, mh2))}${summary(await settle(guest, mg2))}`).toBe("[][]");
  }, 30_000);

  it("밤: 마피아 봇이 저절로 pick 해 방장 me.allyPicks 가 비어 있지 않고 방장·동료가 아니며 아침 결과가 온다", async () => {
    const r = await seatQuiet(0, { testMode: true });
    send(r.host, { t: "testBots", count: 5 });
    await nextFrame(r.host, lobbyOf(6));
    send(r.host, { t: "testRole", role: "mafia" });
    await start(r);
    await skipDayToNight(r);
    await forceBotsDue(r.code);
    const picked = (await nextFrame(r.host, (m) => m.t === "state" && (m.view.me.allyPicks?.length ?? 0) > 0)) as State;
    const allies = picked.view.me.allies ?? [];
    const picks = picked.view.me.allyPicks ?? [];
    expect(picks.every((s) => s !== picked.view.me.seat && !allies.includes(s))).toBe(true);
    send(r.host, { t: "testSkip" });
    const morning = (await nextFrame(r.host, isPhase("morning"))) as State;
    expect(typeof morning.view.day?.morning).toBe("object");
  }, 30_000);
});

describe("알람", () => {
  it("봇 있는 테스트 방 discussion 에서 알람은 봇 행동 시각이고 단계 마감보다 이르다", async () => {
    const r = await seatQuiet(1, { testMode: true });
    send(r.host, { t: "testBots", count: 3 });
    await nextFrame(r.host, lobbyOf(5));
    await start(r);
    await skipUntil(r, "discussion");
    await waitForPlan(r.code);
    const room = (await stored(r.code)) as unknown as { phaseEndsAt: number; botPlan: { steps: Array<{ at: number }> } };
    const alarm = await alarmOf(r.code);
    expect(String(alarm)).toBe(String(room.botPlan.steps[0]!.at));
    expect(alarm! < room.phaseEndsAt).toBe(true);
  }, 30_000);

  it("일반 방 discussion 에서 알람은 단계 마감과 같고 저장된 방에 botPlan 이 없다", async () => {
    const r = await seatQuiet(3);
    await start(r);
    await advanceTo(r.code, allSockets(r), "discussion");
    const room = await stored(r.code);
    expect(String(await alarmOf(r.code))).toBe(String(room.phaseEndsAt));
    expect(Object.hasOwn(room, "botPlan")).toBe(false);
  }, 30_000);
});

describe("대기실 복귀와 방 지우기", () => {
  it("testReset 뒤에도 봇 수와 me.testBots 가 그대로고 botPlan 이 저장되어 있지 않다", async () => {
    const r = await seatQuiet(0, { testMode: true });
    send(r.host, { t: "testBots", count: 3 });
    await nextFrame(r.host, lobbyOf(4));
    await start(r);
    await skipUntil(r, "discussion");
    await waitForPlanKey(r.code); // 토론 단계의 봇 계획이 저장되어 있다
    send(r.host, { t: "testReset" });
    await nextFrame(r.host, lobbyOf(4));
    expect(String(lastView(r.host).me.testBots)).toBe("3");
    expect((await botsOf(r.code)).length).toBe(3);
    expect(Object.hasOwn(await stored(r.code), "botPlan")).toBe(false);
    // 방장이 나가면 봇만 남아 방이 지워진다.
    send(r.host, { t: "leave" });
    expect(await closed(r.host)).toBe("4003 left");
    const res = await exports.default.fetch(`http://x/api/rooms/${r.code}`);
    expect(res.status).toBe(404);
  }, 30_000);
});

describe("누출 없음", () => {
  it("봇 게임 동안 방장·손님 프레임 어디에도 isBot·botPlan·봇 id·token 키가 없고 testBots 는 방장 view.me 에만 있다", async () => {
    const r = await seatQuiet(1, { testMode: true });
    const guest = r.guests[0]!.sock;
    send(r.host, { t: "testBots", count: 4 });
    await nextFrame(r.host, lobbyOf(6));
    await start(r);
    await skipUntil(r, "discussion");
    await forceBotsDue(r.code);
    await skipDayToNight(r);
    await forceBotsDue(r.code);
    await settle(r.host, mark(r.host));
    await settle(guest, mark(guest));
    const botIds = (await botsOf(r.code)).map((b) => b.id);
    expect(botIds.length).toBe(4);
    for (const [who, sock] of [["host", r.host], ["guest", guest]] as const) {
      const text = collect(sock).join("\n");
      expect(`${who}:${text.includes("isBot") || text.includes("botPlan") || text.includes("claimPick")}`).toBe(`${who}:false`);
      expect(`${who}:${text.includes('"token"')}`).toBe(`${who}:false`);
      expect(`${who}:${botIds.some((id) => text.includes(id))}`).toBe(`${who}:false`);
      for (const raw of collect(sock)) {
        const msg = parse(raw);
        if (msg.t !== "state") continue;
        for (const p of msg.view.players) {
          expect(`${who}:${Object.keys(p).sort().join(",")}`).toBe(`${who}:alive,connected,isHost,nickname,seat`);
        }
        const hasTestBots = raw.includes("testBots");
        expect(`${who}:${hasTestBots}`).toBe(`${who}:${who === "host" && msg.view.me.testBots !== undefined}`);
      }
    }
  }, 60_000);
});

// ---- 4페이즈: 봇 투표·변론 (VOTE-01, VOTE-02, VOTE-03, END-02, 결정 0024-6, 0036) ----
/** 방장 + 봇 3 테스트 방을 시작해 phase 에 닿는다(손님 guests 명 추가). */
async function botRoomAt(phase: PhaseId, guests = 0): Promise<Seated> {
  const r = await seatQuiet(guests, { testMode: true });
  send(r.host, { t: "testBots", count: 3 });
  await nextFrame(r.host, lobbyOf(guests + 4));
  await start(r);
  await skipThrough(r, phase);
  return r;
}
const botSeatsOf = async (code: string): Promise<number[]> => (await botsOf(code)).map((b) => b.seat);

describe("봇 투표·변론", () => {
  it("execVote: 봇 표가 들어갈 때마다 방장이 state 를 받고 집계 합계가 봇 수만큼 늘며 방장 view 에 남의 표가 없다", async () => {
    const r = await botRoomAt("execVote");
    const from = mark(r.host);
    await forceBotsDue(r.code);
    await until("봇 표 3개", async () => (await votesIn(r.code, "execVote")) === 3);
    const frames = await settle(r.host, from);
    const states = frames.filter((m): m is State => m.t === "state");
    expect(`${summary(frames)}`).toBe("[state:execVote,state:execVote,state:execVote]");
    const tally = states.at(-1)!.view.day?.execTally;
    expect(String((tally?.yes ?? 0) + (tally?.no ?? 0))).toBe("3");
    expect(Object.hasOwn(states.at(-1)!.view.me, "voteAgree")).toBe(false);
    expect(frames.length === 3 && states.every((m) => !JSON.stringify(m).includes("isBot"))).toBe(true);
  }, 30_000);

  it("candidateVote: 봇 표가 들어가도 방장 소켓에는 프레임이 없고 공개 구간의 voteLog 에 봇 줄이 있다", async () => {
    const r = await botRoomAt("execVote");
    await editRoom(r.code, (room) => mapPlayers(room, (p) => (p.isBot === true ? { ...p, execVote: true } : p)));
    await skipThrough(r, "candidateVote");
    const from = mark(r.host);
    await forceBotsDue(r.code);
    await until("봇 후보 표 3개", async () => (await votesIn(r.code, "candidateVote")) === 3);
    expect(summary(await settle(r.host, from))).toBe("[]");
    const botSeats = await botSeatsOf(r.code);
    await skipThrough(r, "candidateVoteReveal");
    const line = (await storedRoom(r.code)).voteLog!.at(-1)!.cand!;
    expect(line.votes.map((v) => v.seat).sort().join(",")).toBe(botSeats.join(","));
    expect(line.votes.every((v) => v.target !== v.seat)).toBe(true);
  }, 30_000);

  it("defense: 후보가 봇이면 그 봇 자리에서 온 chat 을 방장이 받고 오류 프레임은 없다", async () => {
    const r = await botRoomAt("execVote");
    const [b1, b2, b3] = await botSeatsOf(r.code);
    await editRoom(r.code, (room) => mapPlayers(room, (p) => (p.isBot === true ? { ...p, execVote: true } : p)));
    await skipThrough(r, "candidateVote");
    const picks: Record<number, number> = { 0: b1!, [b1!]: b2!, [b2!]: b1!, [b3!]: b1! };
    await editRoom(r.code, (room) => mapPlayers(room, (p) => ({ ...p, candidateVote: picks[p.seat as number] })));
    await skipThrough(r, "defense");
    expect(String((await storedRoom(r.code)).verdict?.candidate)).toBe(String(b1));
    const from = mark(r.host);
    await forceBotsDue(r.code);
    const chat = await nextFrame(r.host, (m) => m.t === "chat" && m.seat === b1);
    expect(chat.t).toBe("chat");
    expect(summary((await settle(r.host, from)).filter((m) => m.t === "error"))).toBe("[]");
  }, 30_000);
});

describe("누출 없음: 투표·변론·처형·종료", () => {
  it("봇이 던지는 투표와 종료까지 방장·손님 프레임 어디에도 isBot·botPlan·봇 id·token 이 없다", async () => {
    const r = await seatQuiet(1, { testMode: true });
    send(r.host, { t: "testBots", count: 3 });
    await nextFrame(r.host, lobbyOf(5));
    await sendAndSettle(r.host, { t: "testRole", role: "mafia" });
    await start(r);
    const botIds = (await botsOf(r.code)).map((b) => b.id);
    await driveToEnded(r, async () => {
      await forceBotsDue(r.code);
    });
    for (const sock of allSockets(r)) await settle(sock, mark(sock));
    expect(String((await stored(r.code)).phase)).toBe("ended");
    expect(botIds.length).toBe(3);
    for (const [who, sock] of [["host", r.host], ["guest", r.guests[0]!.sock]] as const) {
      const text = collect(sock).join("\n");
      expect(`${who}:${text.includes("isBot") || text.includes("botPlan")}`).toBe(`${who}:false`);
      expect(`${who}:${text.includes('"token"')}`).toBe(`${who}:false`);
      expect(`${who}:${botIds.some((id) => text.includes(id))}`).toBe(`${who}:false`);
      expect(`${who}:${text.includes('"phase":"ended"')}`).toBe(`${who}:true`);
    }
  }, 60_000);
});
