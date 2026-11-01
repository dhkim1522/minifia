// 07-10: 입력 중(typing)의 서버 길 — 보낸 사람 상태 → 채널 → audience → deliver → 소켓. 07-11·07-14 가 채팅 줄 시험을 이 파일에 더한다.
// 받을 권리가 없는 소켓에는 프레임이 한 건도 가지 않는다는 것을 "오지 않았음"(settle 이 ping/pong 으로 증명)으로 본다.
import { env } from "cloudflare:workers";
import { runInDurableObject } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import type { PhaseId, ServerMessage } from "../../shared/protocol";
import { actorsOf, advanceTo, connect, createRoom, editRoom, hello, joinOk, mapPlayers, mark, nextFrame, seat, send, settle, storedRoom, typingSend } from "./helpers";
import type { Actor, TestSocket } from "./helpers";

/** settle 이 돌려준 프레임 가운데 typing 만 한 줄 문자열로(실패 보고가 한 줄이어야 한다). */
const typings = (msgs: ServerMessage[]): string => msgs.filter((m) => m.t === "typing").map((m) => JSON.stringify(m)).join("|");
const errors = (msgs: ServerMessage[]): string => msgs.filter((m) => m.t === "error").map((m) => JSON.stringify(m)).join("|");

/** 두 소켓을 차례로 flush 한다: 보낸 쪽을 먼저(서버가 신호를 처리했음을 보인다) 받는 쪽을 뒤에 본다. */
async function flushBoth(sender: TestSocket, fromSender: number, receiver: TestSocket, fromReceiver: number): Promise<{ sent: ServerMessage[]; got: ServerMessage[] }> {
  const sent = await settle(sender, fromSender);
  const got = await settle(receiver, fromReceiver);
  return { sent, got };
}

describe("입력 중 — 트레이서 (CHAT-04)", () => {
  it("입력 중: 로비 손님의 켜짐이 방장 소켓에 {t,seat,on} 으로 가고 손님 자신에게는 되돌아가지 않는다", async () => {
    const s = await seat(1, 0);
    const guest = s.guests[0]!;
    const mh = mark(s.host);
    const mg = mark(guest.sock);
    typingSend(guest.sock, true);
    const { sent, got } = await flushBoth(guest.sock, mg, s.host, mh);
    expect(typings(got)).toBe(`{"t":"typing","seat":${guest.seat},"on":true}`);
    expect(typings(sent)).toBe("");
  });

  it("입력 중: 꺼짐도 방장 소켓에 on:false 로 간다", async () => {
    const s = await seat(1, 0);
    const guest = s.guests[0]!;
    const m0h = mark(s.host);
    const m0g = mark(guest.sock);
    typingSend(guest.sock, true);
    await flushBoth(guest.sock, m0g, s.host, m0h);
    const mh = mark(s.host);
    const mg = mark(guest.sock);
    typingSend(guest.sock, false);
    const { got } = await flushBoth(guest.sock, mg, s.host, mh);
    expect(typings(got)).toBe(`{"t":"typing","seat":${guest.seat},"on":false}`);
  });

  it("입력 중: 단계 키가 서버와 다르면 아무 소켓에도 가지 않고 오류도 없다", async () => {
    const s = await seat(1, 0);
    const guest = s.guests[0]!;
    const mh = mark(s.host);
    const mg = mark(guest.sock);
    send(guest.sock, { t: "typing", on: true, pk: "9:night" });
    const { sent, got } = await flushBoth(guest.sock, mg, s.host, mh);
    expect(`${typings(got)}/${typings(sent)}/${errors(sent)}`).toBe("//");
  });

  it("입력 중: hello 전 소켓의 신호는 버려진다", async () => {
    const { code, token } = await createRoom("방장");
    const host = await connect(code);
    await hello(host, token);
    await joinOk(code, "손님");
    const anon = await connect(code);
    const mh = mark(host);
    const ma = mark(anon);
    send(anon, { t: "typing", on: true, pk: "0:lobby" });
    const { sent, got } = await flushBoth(anon, ma, host, mh);
    expect(`${typings(got)}/${typings(sent)}/${errors(sent)}`).toBe("//");
  });

  it("입력 중: 덧붙은 seat 가 있으면 BAD_MESSAGE 이고 아무에게도 가지 않는다", async () => {
    const s = await seat(1, 0);
    const guest = s.guests[0]!;
    const mh = mark(s.host);
    const mg = mark(guest.sock);
    send(guest.sock, { t: "typing", on: true, pk: "0:lobby", seat: 3 });
    const { sent, got } = await flushBoth(guest.sock, mg, s.host, mh);
    expect(`${typings(got)}/${errors(sent)}`).toBe('/{"t":"error","code":"BAD_MESSAGE"}');
  });

  it("입력 중: pk 33자는 BAD_MESSAGE 이다", async () => {
    const s = await seat(1, 0);
    const guest = s.guests[0]!;
    const mg = mark(guest.sock);
    send(guest.sock, { t: "typing", on: true, pk: "a".repeat(33) });
    expect(errors(await settle(guest.sock, mg))).toBe('{"t":"error","code":"BAD_MESSAGE"}');
  });
});

// ---- 채널별 입력 중 · 1.5초 간격 (CHAT-02·03·04, 07-10 Task 2) ----
// 6명 판을 실제로 시작해(방장 + 손님 5) 원하는 단계까지 마감을 당기고, 모든 소켓의 프레임을 ping/pong 으로 flush 해 둔 채 돌려준다.

interface Game {
  code: string;
  socks: TestSocket[];
  actors: Actor[];
}

async function startedAt(phase: PhaseId): Promise<Game> {
  const room = await seat(5, 0);
  const socks = [room.host, ...room.guests.map((g) => g.sock)];
  send(room.host, { t: "start" });
  for (const sock of socks) await nextFrame(sock, (m) => m.t === "state" && m.view.phase === "assigning");
  await advanceTo(room.code, socks, "dayAnnounce");
  for (const sock of socks) await settle(sock, mark(sock));
  const actors = actorsOf(room);
  await advanceTo(room.code, socks, phase);
  for (const sock of socks) await settle(sock, mark(sock));
  return { code: room.code, socks, actors };
}

const withRole = (g: Game, role: string): Actor[] => g.actors.filter((a) => a.role === role).sort((a, b) => a.seat - b.seat);

/** 저장된 방에서 이 좌석들을 탈락시킨다(DO 가 evict 되어 저장소에서 다시 읽는다 — 소켓은 하이버네이션으로 남는다). */
async function kill(g: Game, seats: number[]): Promise<void> {
  await editRoom(g.code, (room) => mapPlayers(room, (p) => (seats.includes(p.seat as number) ? { ...p, alive: false } : p)));
}

/** 행동 직전에 모든 소켓의 위치를 적어 두고(mark), 행동을 한 뒤 모든 소켓을 flush 해 소켓별 typing 프레임 목록을 돌려준다. */
async function typingsAfter(g: Game, act: () => void): Promise<Map<number, string>> {
  const marks = g.socks.map((sock) => mark(sock));
  act();
  const out = new Map<number, string>();
  // 보낸 소켓이 처리를 마쳤다는 증거(pong)를 먼저 받고 나서 나머지를 flush 한다.
  for (let i = 0; i < g.socks.length; i += 1) out.set(g.actors.findIndex((a) => a.sock === g.socks[i]), typings(await settle(g.socks[i]!, marks[i]!)));
  return out;
}

/** 좌석 -> 받은 typing 프레임 문자열을 '좌석:프레임' 줄로(비어 있는 소켓은 생략). 한 줄 문자열이라 실패 보고가 한 줄이다. */
const receivedLine = (g: Game, got: Map<number, string>): string =>
  g.actors
    .map((a, i) => ({ seat: a.seat, text: got.get(i) ?? "" }))
    .filter((x) => x.text !== "")
    .sort((a, b) => a.seat - b.seat)
    .map((x) => `${x.seat}=${x.text}`)
    .join(" ");

const frame = (seatNo: number, on: boolean): string => `{"t":"typing","seat":${seatNo},"on":${on}}`;

describe("입력 중 — 밤의 채널 (CHAT-02·04)", () => {
  it("입력 중: 밤에 산 마피아가 켜면 다른 산 마피아와 탈락자만 받고 시민·경찰·의사와 자신은 한 프레임도 받지 않는다", async () => {
    const g = await startedAt("night");
    const [mafiaA, mafiaB] = withRole(g, "mafia") as [Actor, Actor];
    const citizens = withRole(g, "citizen");
    await kill(g, [citizens[0]!.seat]);
    const got = await typingsAfter(g, () => typingSend(mafiaA.sock, true));
    expect(receivedLine(g, got)).toBe([mafiaB, citizens[0]!].sort((a, b) => a.seat - b.seat).map((a) => `${a.seat}=${frame(mafiaA.seat, true)}`).join(" "));
  });

  it("입력 중: 밤에 산 시민·경찰·의사의 신호는 아무에게도 가지 않는다", async () => {
    const g = await startedAt("night");
    const senders = [...withRole(g, "citizen"), ...withRole(g, "police"), ...withRole(g, "doctor")];
    const got = await typingsAfter(g, () => {
      for (const a of senders) typingSend(a.sock, true);
    });
    expect(receivedLine(g, got)).toBe("");
  });

  it("입력 중: 밤에 탈락자가 켜면 다른 탈락자에게만 가고 산 마피아에게도 가지 않는다", async () => {
    const g = await startedAt("night");
    const [x, y] = withRole(g, "citizen") as [Actor, Actor];
    await kill(g, [x.seat, y.seat]);
    const got = await typingsAfter(g, () => typingSend(x.sock, true));
    expect(receivedLine(g, got)).toBe(`${y.seat}=${frame(x.seat, true)}`);
  });
});

describe("입력 중 — 낮의 채널 (CHAT-03·04)", () => {
  it("입력 중: 낮에 탈락자가 켜면 다른 탈락자만 받고 산 사람은 한 프레임도 받지 않는다", async () => {
    const g = await startedAt("discussion");
    const [x, y] = withRole(g, "citizen") as [Actor, Actor];
    await kill(g, [x.seat, y.seat]);
    const got = await typingsAfter(g, () => typingSend(x.sock, true));
    expect(receivedLine(g, got)).toBe(`${y.seat}=${frame(x.seat, true)}`);
  });

  it("입력 중: 낮에 산 사람이 켜면 다른 산 사람과 탈락자 모두 받고 보낸 사람은 받지 않는다", async () => {
    const g = await startedAt("discussion");
    const [x] = withRole(g, "citizen") as [Actor];
    const sender = withRole(g, "police")[0]!;
    await kill(g, [x.seat]);
    const got = await typingsAfter(g, () => typingSend(sender.sock, true));
    const want = g.actors.filter((a) => a !== sender).sort((a, b) => a.seat - b.seat).map((a) => `${a.seat}=${frame(sender.seat, true)}`).join(" ");
    expect(receivedLine(g, got)).toBe(want);
  });

  it("입력 중: 역할 확인(roleReveal) 중에는 단계 키가 맞아도 아무에게도 가지 않는다", async () => {
    const g = await startedAtRoleReveal();
    const room = await storedRoom(g.code);
    const sender = g.actors[0]!;
    const got = await typingsAfter(g, () => send(sender.sock, { t: "typing", on: true, pk: `${room.day ?? 0}:${room.phase}` }));
    expect(`${room.phase}/${receivedLine(g, got)}`).toBe("roleReveal/");
  });
});

/** roleReveal 에서 멈춘 판(역할은 아직 view 에 있을 수 있어 actorsOf 는 dayAnnounce 에서 읽는다). */
async function startedAtRoleReveal(): Promise<Game> {
  const room = await seat(5, 0);
  const socks = [room.host, ...room.guests.map((g) => g.sock)];
  send(room.host, { t: "start" });
  for (const sock of socks) await nextFrame(sock, (m) => m.t === "state" && m.view.phase === "assigning");
  await advanceTo(room.code, socks, "roleReveal");
  for (const sock of socks) await settle(sock, mark(sock));
  const actors = socks.map((sock, i) => ({ sock, token: "", seat: i, role: "citizen" as const }));
  return { code: room.code, socks, actors };
}

describe("입력 중 — 단계 키 · 간격 (T-07-20, T-07-22)", () => {
  it("입력 중: 밤의 단계 키를 아침에 보내면 넓은 채널로 돌리지 않고 아무에게도 가지 않는다", async () => {
    const g = await startedAt("night");
    const nightKey = `${(await storedRoom(g.code)).day ?? 0}:night`;
    await advanceTo(g.code, g.socks, "morning");
    for (const sock of g.socks) await settle(sock, mark(sock));
    const mafiaA = withRole(g, "mafia")[0]!;
    const got = await typingsAfter(g, () => send(mafiaA.sock, { t: "typing", on: true, pk: nightKey }));
    expect(`${(await storedRoom(g.code)).phase}/${receivedLine(g, got)}`).toBe("morning/");
  });

  it("입력 중: 같은 사람의 켜짐은 1.5초 안에 한 번만 중계되고 1.5초 뒤에는 다시 중계된다", async () => {
    const g = await startedAt("discussion");
    const sender = withRole(g, "police")[0]!;
    const watcher = withRole(g, "doctor")[0]!;
    const first = await typingsAfter(g, () => typingSend(sender.sock, true));
    expect(first.get(g.actors.indexOf(watcher))).toBe(frame(sender.seat, true));
    const again = await typingsAfter(g, () => typingSend(sender.sock, true));
    expect(receivedLine(g, again)).toBe("");
    await ageTypingRelays(g.code, 1_600);
    const later = await typingsAfter(g, () => typingSend(sender.sock, true));
    expect(later.get(g.actors.indexOf(watcher))).toBe(frame(sender.seat, true));
  });

  it("입력 중: 켜짐 없이 온 꺼짐은 중계되지 않고 켜진 뒤의 꺼짐은 중계된다", async () => {
    const g = await startedAt("discussion");
    const sender = withRole(g, "police")[0]!;
    const watcher = withRole(g, "doctor")[0]!;
    const bare = await typingsAfter(g, () => typingSend(sender.sock, false));
    expect(receivedLine(g, bare)).toBe("");
    await typingsAfter(g, () => typingSend(sender.sock, true));
    const off = await typingsAfter(g, () => typingSend(sender.sock, false));
    expect(off.get(g.actors.indexOf(watcher))).toBe(frame(sender.seat, false));
  });
});

/** 중계 기록의 마지막 켜짐 시각을 ms 만큼 과거로 당긴다 — 1.5초를 실제로 기다리지 않는다(인메모리 typingRelays). */
async function ageTypingRelays(code: string, ms: number): Promise<void> {
  await runInDurableObject(env.ROOM.getByName(code), async (instance) => {
    const relays = instance["typingRelays"] as Map<string, { on: boolean; lastOnAt: number }>;
    for (const [id, st] of relays) relays.set(id, { ...st, lastOnAt: st.lastOnAt - ms });
  });
}
