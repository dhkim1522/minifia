// 테스트 방 서버 봇 워커 통합 테스트(quick 261025-fx1, 결정 0024): 실제 HTTP·소켓으로 testBots 와 봇 행동을 workerd 에서 확인한다.
// 실패 출력은 한 줄이어야 해서(TAP) 프레임 목록은 summary() 한 줄 문자열로 비교한다.
import { env, exports } from "cloudflare:workers";
import { evictDurableObject, runDurableObjectAlarm, runInDurableObject } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { BOT_CHAT_LINES, BOT_WILL_LINES } from "../../shared/game/bots";
import { LAST_WORD_CHIPS } from "../../shared/game/showdown";
import { PHASE_DEFS, PICK_TURN_MS } from "../../shared/game/phases";
import type { PhaseId, RoomView, ServerMessage } from "../../shared/protocol";
import {
  advanceTo,
  alarmOf,
  closePhase,
  closed,
  collect,
  driveToEnded,
  editRoom,
  flushWorld,
  mapPlayers,
  nextFrame,
  seat,
  send,
  skipOnce,
  skipThrough,
  storedRoom,
  toPhase,
  until,
  votesIn,
  writeRoomEdit,
  worldFramesOf,
  worldOf,
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
 * 낮을 넘겨 밤으로 간다. 넘기기가 지목 단계에서 안 던진 봇을 대신 던지게 한 뒤(04-08) 봇 표가 무작위로 변론·처형까지 이어지면
 * 방장이 처형되거나 판이 끝나 밤에 닿지 못할 수 있다 — 그래서 지목을 모두 동률로 정해 둔 채 넘겨 밤으로 곧장 간다.
 */
async function skipDayToNight(r: Seated): Promise<void> {
  await skipUntil(r, "nomination");
  await editRoom(r.code, (room) => {
    // 모두가 다음 좌석을 가리킨다 → 모든 사람이 한 표씩 받는 동률 → 지목 마감 뒤 곧장 밤.
    const seats = (room.players as Array<{ seat: number }>).map((p) => p.seat).sort((a, b) => a - b);
    return mapPlayers(room, (p) => ({ ...p, nominate: seats[(seats.indexOf(p.seat as number) + 1) % seats.length] }));
  });
  await skipUntil(r, "night");
}

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/** reschedule 이 봇 계획을 세워 저장할 때까지 기다린다(단계 전환 방송이 저장보다 먼저 도착할 수 있다). */
/**
 * 순차 지목(결정 0063-1)에서 지금 차례가 봇 차례가 될 때까지 마감을 당겨 한 걸음씩 넘기고(사람 차례는 기권), 그 봇의 point 가 저장될 때까지 알람 사슬을 돌린다.
 * 봇은 차례가 시작되면 계획을 세우고(reschedule) 알람이 그 계획을 실행한다 — 이미 걸린 알람은 자동으로 돌 수 있어 수동 실행은 거듭 확인만 한다.
 * 그 봇의 좌석을 돌려준다.
 */
async function walkToBotPoint(code: string): Promise<number> {
  for (let guard = 0; guard < 12; guard += 1) {
    await closePhase(code); // 모이기·사람 차례(기권)·확정 뒤 사이를 한 걸음 넘긴다 — 시작 상태가 이미 끝난 봇 차례여도 다음 차례로 간다
    const room = await stored(code);
    const turn = room.pickTurn as { order: number[]; i: number; doneAt?: number } | undefined;
    if (room.phase !== "nomination" || turn === undefined || turn.i >= turn.order.length) throw new Error(`walkToBotPoint: 지목 차례를 벗어났다 ${String(room.phase)} ${JSON.stringify(turn)}`);
    const owner = turn.i >= 0 ? (await playersOf(code)).find((p) => p.seat === turn.order[turn.i]) : undefined;
    // 봇 차례면 알람 사슬(계획 저장 → 계획 실행)이 point 를 저장할 때까지 기다린다. 알람은 자동으로 이미 돌았을 수 있다.
    if (owner?.isBot === true) {
      await chaseAlarms(code, "봇 지목", async () => ((await stored(code)).pickTurn as { doneAt?: number }).doneAt !== undefined);
      return owner.seat;
    }
  }
  throw new Error("walkToBotPoint: 봇 차례에 닿지 못했다");
}

/** 조건이 참이 될 때까지 알람을 거듭 돌린다(봇 차례 시작 → 계획 저장 → 계획 실행이 알람 사슬이다). 알람이 없으면 false 를 돌려줄 뿐이다. */
async function chaseAlarms(code: string, label: string, ready: () => Promise<boolean>): Promise<void> {
  const stub = env.ROOM.getByName(code);
  for (let i = 0; i < 40; i += 1) {
    if (await ready()) return;
    await runDurableObjectAlarm(stub);
    await sleep(25);
  }
  if (!(await ready())) throw new Error(`chaseAlarms: ${label} 이(가) 이뤄지지 않았다`);
}

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
  // 12-03: 저장소만 고치면 evict 전에 봇 알람이 낡은 메모리 방으로 덮어쓴다 — 메모리 사본도 같이 고치는 writeRoomEdit 를 쓴다.
  await writeRoomEdit(stub, (room) => {
    const plan = room.botPlan as { key: string; steps: Array<Record<string, unknown>> } | undefined;
    if (!plan) throw new Error("forceBotsDue: 봇 계획이 없다");
    const steps = plan.steps.map((s) => ({ ...s, at: Date.now() - 1000 }));
    return { ...room, botPlan: { ...plan, steps } };
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
    const frames = (await settle(guest, from)).filter((m) => m.t === "error" || m.t === "chatReject");
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

describe("마피아 봇 협응 (09-02, 결정 0061-18)", () => {
  it("밤: 계획에 적힌 대상이 서로 달라도 마피아 봇 둘은 실행 시점에 같은 seat 을 고른다", async () => {
    const r = await seatQuiet(0, { testMode: true });
    send(r.host, { t: "testBots", count: 5 });
    await nextFrame(r.host, lobbyOf(6));
    send(r.host, { t: "testRole", role: "citizen" });
    await start(r);
    await skipDayToNight(r);
    await waitForPlan(r.code);
    // 계획 시점의 대상을 일부러 서로 다르게 만든다 — 실행 시점 재계산이 없으면 두 봇이 다른 대상을 고른다.
    await editRoom(r.code, (room) => {
      const players = room.players as Array<{ id: string; seat: number; role?: string; alive?: boolean }>;
      const mafiaIds = players.filter((p) => p.role === "mafia").map((p) => p.id);
      const targets = players.filter((p) => p.role !== "mafia" && p.alive !== false).map((p) => p.seat).sort((a, b) => b - a);
      const plan = room.botPlan as { key: string; steps: Array<{ botId: string; act: { t: string; target?: number } }> };
      let i = 0;
      const steps = plan.steps.map((st) => {
        if (st.act.t !== "pick" || !mafiaIds.includes(st.botId)) return st;
        const target = targets[i % targets.length]!;
        i += 1;
        return { ...st, act: { ...st.act, target } };
      });
      return { ...room, botPlan: { ...plan, steps } };
    });
    await forceBotsDue(r.code);
    const players = (await stored(r.code)).players as Array<{ role?: string; nightPick?: number }>;
    const picks = players.filter((p) => p.role === "mafia").map((p) => String(p.nightPick));
    expect(picks.length >= 2 && picks.every((x) => x !== "undefined") && new Set(picks).size === 1).toBe(true);
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
  // 08-11: 지목·찬반 단계의 봇 행동(point·verdict)은 아래 "봇 지목·찬반·토론 끝내기" describe 가 이미 본다. 여기는 실제 흐름으로 지목 줄이 기록으로 남는 것과 봇 변론자의 chat 만 본다.
  it("nomination: 봇 차례가 되면 봇 지목이 모두에게 공개되고, 끝까지 넘기면 그날 voteLog 줄 cand.votes 에 봇 줄로 남는다", async () => {
    const r = await botRoomAt("nomination"); // 방장(사람, 차례 순서 첫째) + 봇 3
    const botSeats = await botSeatsOf(r.code);
    for (const seat of botSeats) {
      const from = mark(r.host);
      expect(await walkToBotPoint(r.code)).toBe(seat);
      const frames = await settle(r.host, from);
      const view = (frames.filter((m): m is State => m.t === "state").at(-1)!).view;
      expect(`${seat}:${JSON.stringify(view.day?.points?.some((l) => l.seat === seat))}`).toBe(`${seat}:true`);
      expect(JSON.stringify(frames).includes("botPlan")).toBe(false);
    }
    // 마지막 봇의 확정 뒤 사이 → 끝 알림 → 집계까지 마감을 당겨 넘긴다.
    for (let i = 0; i < 4 && (await storedRoom(r.code)).phase === "nomination"; i += 1) await closePhase(r.code);
    const line = (await storedRoom(r.code)).voteLog!.at(-1)!.cand!;
    expect(line.votes.map((v) => v.seat).sort().join(",")).toBe(botSeats.join(","));
    expect(line.votes.every((v) => v.target !== v.seat)).toBe(true);
    expect(await votesIn(r.code, "nominate")).toBe(0); // 마감 훅이 개인 키를 지웠다
  }, 60_000);

  it("defense: 변론자가 봇이면 그 봇 자리에서 온 chat 을 방장이 받고 오류 프레임은 없다", async () => {
    const r = await botRoomAt("nomination");
    const [b1, b2, b3] = await botSeatsOf(r.code);
    const picks: Record<number, number> = { 0: b1!, [b1!]: b2!, [b2!]: b1!, [b3!]: b1! };
    await editRoom(r.code, (room) => mapPlayers(room, (p) => ({ ...p, nominate: picks[p.seat as number] })));
    await skipThrough(r, "defense");
    expect(String((await storedRoom(r.code)).verdict?.candidate)).toBe(String(b1));
    const from = mark(r.host);
    await forceBotsDue(r.code);
    const chat = await nextFrame(r.host, (m) => m.t === "chat" && m.seat === b1);
    expect(chat.t).toBe("chat");
    expect(summary((await settle(r.host, from)).filter((m) => m.t === "error"))).toBe("[]");
  }, 30_000);
});

describe("봇 결선 투표 (09.1.1-05, 결정 0066-4)", () => {
  it("결선 투표 창(step 1)에서 후보가 아닌 봇이 사람과 같은 길로 한 표씩 던지고, 집계 뒤 변론 또는 밤으로 이어지며, 프레임에는 개인 선택·봇 계획이 새지 않는다", async () => {
    const r = await botRoomAt("nomination"); // 방장(좌석 0) + 봇 3(좌석 1~3)
    const botSeats = await botSeatsOf(r.code);
    expect(botSeats.join(",")).toBe("1,2,3");
    // 방장과 봇 1 이 후보인 결선 앞머리를 세운다(지목 집계가 만드는 모양 그대로).
    await editRoom(r.code, (room) => {
      const { pickTurn: _pickTurn, botPlan: _botPlan, ...rest } = room as Record<string, unknown>;
      return { ...rest, phase: "runoff", runoff: { cand: [0, 1], step: 0 }, phaseEndsAt: Date.now() + 600_000 };
    });
    for (const sock of allSockets(r)) await settle(sock, mark(sock));
    await waitForPlanKey(r.code); // 앞머리의 빈 계획이 저장될 때까지(깨어난 방의 reschedule 이 끝난 뒤에 마감을 당긴다)
    await closePhase(r.code); // 앞머리 → 투표 창
    expect(String(((await stored(r.code)).runoff as { step: number }).step)).toBe("1");
    const from = mark(r.host);
    await forceBotsDue(r.code);
    await until("봇 표", async () => (await playersOf(r.code)).filter((p) => (p as unknown as { runoffVote?: number }).runoffVote !== undefined).length === 2);
    const voters = ((await stored(r.code)).players as Array<{ seat: number; runoffVote?: number }>).filter((p) => p.runoffVote !== undefined);
    expect(voters.map((p) => p.seat).sort().join(",")).toBe("2,3");
    expect(voters.every((p) => p.runoffVote === 0 || p.runoffVote === 1)).toBe(true);
    // 후보 봇(1)·방장(0)은 던지지 않는다.
    const frames = await settle(r.host, from);
    const text = JSON.stringify(frames);
    expect(text.includes("runoffVote") || text.includes("botPlan") || text.includes("isBot")).toBe(false);
    const view = (frames.filter((m): m is State => m.t === "state").at(-1)!).view;
    expect(JSON.stringify(view.day?.runoff?.voted)).toBe("[2,3]");
    expect(Object.hasOwn(view.me, "ballot")).toBe(false);
    // 결과(step 2) → 집계
    await closePhase(r.code);
    await closePhase(r.code);
    const after = await stored(r.code);
    expect(["defense", "night"].includes(String(after.phase))).toBe(true);
    expect(after.runoff).toBeUndefined();
  }, 60_000);
});

describe("누출 없음: 투표·변론·처형·종료", () => {
  it("봇이 던지는 투표와 종료까지 방장·손님 프레임 어디에도 isBot·botPlan·봇 id·token 이 없다", async () => {
    const r = await seatQuiet(1, { testMode: true });
    send(r.host, { t: "testBots", count: 3 });
    await nextFrame(r.host, lobbyOf(5));
    await sendAndSettle(r.host, { t: "testRole", role: "mafia" });
    await start(r);
    const botIds = (await botsOf(r.code)).map((b) => b.id);
    await driveToEnded(r, async (stage) => {
      if (stage === "nomination") await walkToBotPoint(r.code); // 순차 지목: 봇 차례가 와서 지목이 끝날 때까지(결정 0063-1)
      else await forceBotsDue(r.code);
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

// ---- 8페이즈: 봇의 토론 끝내기·지목·찬반 (08-07, DAY-03·04·06, 결정 0024·0060-13) ----
// 저장 상태를 toPhase 로 옮긴 뒤 알람 한 번으로 봇 계획을 세우고(reschedule), forceBotsDue 로 행동 시각을 당긴다.
/** 알람을 한 번 돌려 지금 단계의 봇 계획을 세운다. */
const armBots = async (code: string): Promise<void> => {
  expect(await runDurableObjectAlarm(env.ROOM.getByName(code))).toBe(true);
};
type PlanRaw = { key: string; steps: Array<{ at: number; botId: string; act: { t: string } }> } | undefined;
const planKinds = async (code: string): Promise<string> => {
  const plan = (await stored(code)).botPlan as PlanRaw;
  return (plan?.steps ?? []).map((st) => st.act.t).sort().join(",");
};
const countWith = async (code: string, key: string): Promise<number> => ((await playersOf(code)) as unknown as Array<Record<string, unknown>>).filter((p) => p[key] !== undefined).length;

describe("봇 지목·찬반·토론 끝내기", () => {
  it("nomination: 봇 차례가 시작된 알람 사슬 안에서 그 봇의 point 가 저장되고(차례 시작 − 확정 < 1000ms), 계획 키는 차례마다 nomination:${마감} 으로 바뀌고, 방장의 day.points 에 봇 줄만 쌓인다", async () => {
    const r = await seatQuiet(0, { testMode: true });
    send(r.host, { t: "testBots", count: 3 });
    await nextFrame(r.host, lobbyOf(4));
    await sendAndSettle(r.host, { t: "testBotVote", exec: "no", pick: "host" });
    await start(r);
    await skipThrough(r, "nomination"); // 모이는 중
    const [b1, b2] = await botsOf(r.code);
    await closePhase(r.code); // 방장(좌석 0) 차례
    await closePhase(r.code); // 방장 기권 → 사이
    await closePhase(r.code); // 사이 끝 → 첫 봇(좌석 1) 차례 시작: 봇 계획이 선다
    await chaseAlarms(r.code, "봇 지목", async () => ((await stored(r.code)).pickTurn as { doneAt?: number }).doneAt !== undefined);
    const done = await stored(r.code);
    const turn = done.pickTurn as { i: number; endsAt: number; doneAt: number };
    expect(`${turn.i}/${turn.doneAt - (turn.endsAt - PICK_TURN_MS) < 1000}`).toBe("1/true");
    expect(String(((await playersOf(r.code)).find((p) => p.seat === b1!.seat) as unknown as Record<string, unknown>).nominate)).toBe("0");
    const key1 = (done.botPlan as { key: string }).key;
    expect(key1).toBe(`nomination:${String(done.phaseEndsAt)}`); // 마감이 당겨져 키가 바뀌고 계획은 비었다
    // 다음 봇 차례: 마감이 달라지니 계획 키도 새 마감으로 바뀐다(차례가 시작된 직후든 이미 지목한 뒤든 키 = nomination:지금 마감).
    await closePhase(r.code);
    await chaseAlarms(r.code, "다음 봇 지목", async () => ((await stored(r.code)).pickTurn as { i: number; doneAt?: number }).i === 2 && ((await stored(r.code)).pickTurn as { doneAt?: number }).doneAt !== undefined);
    const next = await stored(r.code);
    expect(`${(next.botPlan as { key: string }).key !== key1}/${(next.botPlan as { key: string }).key === `nomination:${String(next.phaseEndsAt)}`}`).toBe("true/true");
    expect(JSON.stringify(lastView(r.host).day?.points)).toBe(JSON.stringify([{ seat: b1!.seat, target: 0 }, { seat: b2!.seat, target: 0 }]));
    expect(JSON.stringify(collect(r.host)).includes("isBot")).toBe(false);
  }, 60_000);

  it("verdict: 변론자가 아닌 봇만 던지고, 방장은 첫 투표마다 state 를 받으며 day.voted 에 값 없이 좌석만 있다", async () => {
    const r = await botRoomAt("discussion");
    const [b1, b2, b3] = await botSeatsOf(r.code);
    await toPhase(r.code, "verdict", (room) => ({ ...room, verdict: { passed: false, candidate: b1 } }));
    await armBots(r.code);
    expect(await planKinds(r.code)).toBe("verdict,verdict");
    const from = mark(r.host);
    await forceBotsDue(r.code);
    await until("봇 찬반 2개", async () => (await countWith(r.code, "verdictVote")) === 2);
    const frames = await settle(r.host, from);
    expect(summary(frames)).toBe("[state:verdict,state:verdict]");
    const last = frames.filter((m): m is State => m.t === "state").at(-1)!.view;
    expect(JSON.stringify(last.day?.voted)).toBe(JSON.stringify([b2, b3]));
    expect(Object.hasOwn(last.me, "verdictVote")).toBe(false);
    expect(frames.some((m) => JSON.stringify(m).includes('"agree"'))).toBe(false);
  }, 30_000);

  it("discussion: 봇 셋이 모두 토론 끝내기를 누르면 산 넷의 과반(3)이라 다음 단계로 넘어가고 마감이 now + 다음 단계 길이다", async () => {
    const r = await botRoomAt("discussion");
    await toPhase(r.code, "discussion");
    await armBots(r.code);
    expect((await planKinds(r.code)).split(",").filter((k) => k === "endDiscussion").length).toBe(3);
    const nextId = PHASE_DEFS.discussion.next!;
    const before = Date.now();
    await forceBotsDue(r.code);
    await until("토론 끝", async () => (await stored(r.code)).phase === nextId);
    const phaseEndsAt = (await stored(r.code)).phaseEndsAt as number;
    expect(phaseEndsAt >= before + PHASE_DEFS[nextId].durationMs! - 50 && phaseEndsAt <= Date.now() + PHASE_DEFS[nextId].durationMs! + 50).toBe(true);
  }, 30_000);

  it("봇 point·verdict 도 사람과 같은 apply 본체를 지난다: 자기 지목·범위 밖 대상·변론자의 찬반은 거절되고 규칙을 지키는 행동만 저장된다", async () => {
    const r = await botRoomAt("discussion");
    const bots = await botsOf(r.code);
    const [b1, b2, b3] = bots as [BotRaw, BotRaw, BotRaw];
    const past = Date.now() - 1000;
    // 순차 지목(결정 0063-1): 봇 point 도 사람과 같은 castTurnPoint 를 지난다 — 차례 주인의 올바른 지목만 저장된다.
    const turnOf = (room: Record<string, unknown>, ownerSeat: number): Record<string, unknown> => {
      const order = (room.players as Array<{ seat: number }>).map((p) => p.seat).sort((x, y) => x - y);
      return { order, i: order.indexOf(ownerSeat), endsAt: Date.now() + PICK_TURN_MS };
    };
    const planOf = (room: Record<string, unknown>, steps: Array<{ at: number; botId: string; act: unknown }>): Record<string, unknown> => ({
      ...room,
      botPlan: { key: `nomination:${String(room.phaseEndsAt)}`, steps },
    });
    const nominated = async (): Promise<string> =>
      ((await stored(r.code)).players as Array<Record<string, unknown>>)
        .filter((p) => p.isBot === true)
        .map((p) => `${String(p.seat)}>${String(p.nominate)}`)
        .join(",");
    // b1 차례에 자기 자신을 지목 → 거절(BAD_MESSAGE)
    await toPhase(r.code, "nomination", (room) => planOf({ ...room, pickTurn: turnOf(room, b1.seat) }, [{ at: past, botId: b1.id, act: { t: "point", target: b1.seat } }]));
    await armBots(r.code);
    expect(await nominated()).toBe(`${b1.seat}>undefined,${b2.seat}>undefined,${b3.seat}>undefined`);
    // b2 차례에 범위 밖 대상 → 거절(BAD_MESSAGE)
    await toPhase(r.code, "nomination", (room) => planOf({ ...room, pickTurn: turnOf(room, b2.seat) }, [{ at: past, botId: b2.id, act: { t: "point", target: 99 } }]));
    await armBots(r.code);
    expect(await nominated()).toBe(`${b1.seat}>undefined,${b2.seat}>undefined,${b3.seat}>undefined`);
    // b3 차례: 차례가 아닌 b1 의 지목은 거절(WRONG_PHASE), 차례 주인 b3 의 올바른 지목만 저장된다
    await toPhase(r.code, "nomination", (room) =>
      planOf({ ...room, pickTurn: turnOf(room, b3.seat) }, [
        { at: past, botId: b1.id, act: { t: "point", target: b3.seat } },
        { at: past + 1, botId: b3.id, act: { t: "point", target: b1.seat } },
      ]),
    );
    await armBots(r.code);
    expect(await nominated()).toBe(`${b1.seat}>undefined,${b2.seat}>undefined,${b3.seat}>${b1.seat}`);
    await toPhase(r.code, "verdict", (stateRoom) => ({
      ...stateRoom,
      verdict: { passed: false, candidate: b1.seat },
      botPlan: {
        key: `verdict:${String(stateRoom.phaseEndsAt)}`,
        steps: [
          { at: past, botId: b1.id, act: { t: "verdict", agree: true } },
          { at: past + 1, botId: b2.id, act: { t: "verdict", agree: true } },
        ],
      },
    }));
    await armBots(r.code);
    const after = (await stored(r.code)).players as Array<Record<string, unknown>>;
    expect(after.filter((p) => p.isBot === true).map((p) => `${String(p.seat)}:${String(p.verdictVote)}`).join(",")).toBe(`${b1.seat}:undefined,${b2.seat}:true,${b3.seat}:undefined`);
  }, 30_000);
});

describe("봇 유언·다가가기 (09-12, 결정 0061-18)", () => {
  it("1일차 토론: 봇이 같은 applyWill 본체로 BOT_WILL_LINES 중 한 줄을 저장하고 사람 소켓에는 프레임이 없다", async () => {
    const r = await seatQuiet(1, { testMode: true });
    send(r.host, { t: "testBots", count: 3 });
    await nextFrame(r.host, lobbyOf(5));
    await start(r);
    await skipUntil(r, "discussion");
    for (const sock of allSockets(r)) await settle(sock, mark(sock));
    const marks = allSockets(r).map(mark);
    await forceBotsDue(r.code);
    const bots = (await playersOf(r.code)).filter((p) => p.isBot === true) as Array<BotRaw & { will?: string }>;
    expect(bots.length).toBe(3);
    for (const b of bots) expect(`${b.seat}:${BOT_WILL_LINES.includes(b.will ?? "")}`).toBe(`${b.seat}:true`);
    for (const [i, sock] of allSockets(r).entries()) {
      const frames = (await settle(sock, marks[i]!)).filter((m) => m.t === "error" || m.t === "chatReject");
      expect(frames.length).toBe(0);
    }
  }, 30_000);

  it("밤: 마피아 봇이 approach 로 대상 곁까지 걷고, 시민 편 사람 소켓은 world 프레임이 0개다", async () => {
    const r = await seatQuiet(0, { testMode: true });
    send(r.host, { t: "testBots", count: 5 });
    await nextFrame(r.host, lobbyOf(6));
    send(r.host, { t: "testRole", role: "citizen" });
    await start(r);
    await skipDayToNight(r);
    await waitForPlan(r.code);
    await flushWorld(r.code);
    const before = (await worldOf(r.code))!;
    const hostMark = mark(r.host);
    await forceBotsDue(r.code);
    expect(worldFramesOf(r.host, hostMark).length).toBe(0);
    await flushWorld(r.code);
    const after = (await worldOf(r.code))!;
    const players = (await playersOf(r.code)) as Array<BotRaw & { role?: string; nightPick?: number }>;
    const mafias = players.filter((p) => p.role === "mafia");
    const target = players.find((p) => p.seat === mafias[0]!.nightPick)!;
    const at = (w: typeof after, id: string): [number, number] => [w.segs[id]!.p.at(-2)!, w.segs[id]!.p.at(-1)!];
    const [tx, tz] = at(after, target.id);
    for (const m of mafias) {
      const [bx, bz] = at(after, m.id);
      const [px, pz] = at(before, m.id);
      expect(`${m.seat}:${Math.hypot(bx - tx, bz - tz) <= 400}`).toBe(`${m.seat}:true`);
      expect(`${m.seat}:${bx !== px || bz !== pz}`).toBe(`${m.seat}:true`);
    }
  }, 30_000);
});

describe("봇 마지막 3인 (09.1.1-07, 결정 0066-5)", () => {
  /** 방장(좌석 0) + 봇 3(좌석 1~3) 중 봇 3 이 죽은 낮의 마지막 3인(차례 순서 [0, 1, 2], 봇은 1·2)을 세운다. 단계 마감은 멀리 둔다. */
  async function showdownRoom(i: number): Promise<Seated> {
    const r = await botRoomAt("nomination");
    await editRoom(r.code, (room) => {
      const { pickTurn: _pickTurn, botPlan: _botPlan, ...rest } = room as Record<string, unknown>;
      const ends = Date.now() + 600_000;
      return {
        ...mapPlayers(rest as never, (p) => (p.seat === 3 ? { ...p, alive: false } : p)),
        phase: "showdown",
        showdown: { order: [0, 1, 2], i, endsAt: ends },
        phaseEndsAt: ends,
      };
    });
    for (const sock of allSockets(r)) await settle(sock, mark(sock));
    await waitForPlanKey(r.code);
    return r;
  }

  it("봇 차례: 봇이 사람과 같은 chat 길로 LAST_WORD_CHIPS 한 줄을 말해 모두 ch all 로 받고 그 차례의 한마디가 된다; 프레임에 봇 계획이 새지 않는다", async () => {
    const r = await showdownRoom(1);
    const from = mark(r.host);
    await forceBotsDue(r.code);
    const chat = await nextFrame(r.host, (m) => m.t === "chat" && m.seat === 1);
    expect(chat.t === "chat" && LAST_WORD_CHIPS.includes(chat.text)).toBe(true);
    await until("한마디 확정", async () => ((await stored(r.code)).showdown as { word?: string }).word !== undefined);
    const sd = (await stored(r.code)).showdown as { word: string; doneAt: number; i: number };
    expect(`${sd.i}:${LAST_WORD_CHIPS.includes(sd.word)}`).toBe("1:true");
    const frames = await settle(r.host, from);
    const text = JSON.stringify(frames);
    expect(text.includes("botPlan") || text.includes("isBot")).toBe(false);
    expect(summary(frames.filter((m) => m.t === "error" || m.t === "chatReject"))).toBe("[]");
    const view = (frames.filter((m): m is State => m.t === "state").at(-1)!).view;
    expect(view.day?.showdown?.word).toBe(sd.word);
  }, 60_000);

  it("동시 지목: 산 봇 둘이 자기를 뺀 산 사람에게 point 하고 voted 에 좌석만 공개되며 대상은 프레임 어디에도 없다 (방장은 던지지 않았으니 me.ballot 없음)", async () => {
    const r = await showdownRoom(3);
    const from = mark(r.host);
    await forceBotsDue(r.code);
    await until("봇 지목", async () => (await playersOf(r.code)).filter((p) => (p as unknown as { showdownPick?: number }).showdownPick !== undefined).length === 2);
    const picks = ((await stored(r.code)).players as Array<{ seat: number; showdownPick?: number }>).filter((p) => p.showdownPick !== undefined);
    expect(picks.map((p) => p.seat).sort().join(",")).toBe("1,2");
    expect(picks.every((p) => p.showdownPick !== p.seat && [0, 1, 2].includes(p.showdownPick!))).toBe(true);
    const frames = await settle(r.host, from);
    const text = JSON.stringify(frames);
    expect(text.includes("showdownPick") || text.includes("botPlan") || text.includes("isBot")).toBe(false);
    const view = (frames.filter((m): m is State => m.t === "state").at(-1)!).view;
    expect(JSON.stringify(view.day?.showdown?.voted)).toBe("[1,2]");
    expect(Object.hasOwn(view.me, "ballot")).toBe(false);
  }, 60_000);
});
