// 07-10: 입력 중(typing)의 서버 길 — 보낸 사람 상태 → 채널 → audience → deliver → 소켓. 07-11 이 채팅 줄(chat) 시험을, 07-14 가 복원 시험을 이 파일에 더한다.
// 받을 권리가 없는 소켓에는 프레임이 한 건도 가지 않는다는 것을 "오지 않았음"(settle 이 ping/pong 으로 증명)으로 본다.
import { env } from "cloudflare:workers";
import { runInDurableObject } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import type { PhaseId, ServerMessage } from "../../shared/protocol";
import { actorsOf, advanceTo, chatSend, chatsOf, connect, createRoom, editRoom, hello, joinOk, mapPlayers, mark, nextFrame, resetChatRates, seat, send, settle, skipThrough, storedRoom, summary, typingSend, pointAll, verdictAll } from "./helpers";
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

// ---- 채팅 줄 — 트레이서 (CHAT-01, 07-11 Task 1) ----
describe("채팅 — 트레이서 (CHAT-01)", () => {
  it("채팅: 로비 손님의 줄이 정리되어 방장·손님 모두에게 같은 프레임으로 가고 state 방송은 없다", async () => {
    const s = await seat(1, 0);
    const guest = s.guests[0]!;
    // 입장 때 쌓인 state 가 모두 도착한 뒤에 위치를 적는다 — 아니면 늦게 온 입장 state 를 채팅이 만든 것으로 센다.
    await settle(s.host, 0);
    await settle(guest.sock, 0);
    const mh = mark(s.host);
    const mg = mark(guest.sock);
    chatSend(guest.sock, "  안녕   하세요 ");
    const sent = await settle(guest.sock, mg);
    const got = await settle(s.host, mh);
    expect(chatsOf(got)).toHaveLength(1);
    expect(chatsOf(sent)).toHaveLength(1);
    const line = chatsOf(got)[0]!;
    expect(`${line.t}|${line.ch}|${line.seat}|${line.seq}|${line.text}`).toBe(`chat|all|${guest.seat}|1|안녕 하세요`);
    expect(typeof line.at).toBe("number");
    expect(JSON.stringify(chatsOf(sent)[0])).toBe(JSON.stringify(line));
    expect(sent.filter((m) => m.t === "state")).toHaveLength(0);
    expect(got.filter((m) => m.t === "state")).toHaveLength(0);
  });

  it("채팅: 이어서 방장의 줄은 seq 2 이다", async () => {
    const s = await seat(1, 0);
    const guest = s.guests[0]!;
    chatSend(guest.sock, "안녕하세요");
    await settle(guest.sock, mark(guest.sock));
    const mh = mark(s.host);
    const mg = mark(guest.sock);
    chatSend(s.host, "반가워요");
    const got = await settle(guest.sock, mg);
    const own = await settle(s.host, mh);
    expect(chatsOf(got).map((c) => `${c.seat}:${c.seq}:${c.text}`).join("|")).toBe("0:2:반가워요");
    expect(chatsOf(own).map((c) => `${c.seat}:${c.seq}:${c.text}`).join("|")).toBe("0:2:반가워요");
  });
});

// ---- 채널 · 거절 · 단계 키 · 화면 없는 단계 (CHAT-02·03·05, 07-11 Task 2) ----

/** 한 줄을 "채널/보낸 좌석/번호/본문" 으로(실패 보고가 한 줄이어야 한다). */
const lineOf = (c: Extract<ServerMessage, { t: "chat" }>): string => `${c.ch}/${c.seat}/${c.seq}/${c.text}`;

/**
 * 행동 직전 모든 소켓의 위치를 적고, 행동을 한 뒤 보낸 소켓을 먼저(서버가 처리했다는 증거) 나머지를 뒤에 flush 한다.
 * 돌려주는 배열은 g.actors 와 같은 순서다.
 */
async function observe(g: Game, sender: Actor, act: () => void): Promise<ServerMessage[][]> {
  const marks = g.socks.map((sock) => mark(sock));
  act();
  const out: ServerMessage[][] = g.socks.map(() => []);
  const si = g.actors.indexOf(sender);
  out[si] = await settle(g.socks[si]!, marks[si]!);
  for (let i = 0; i < g.socks.length; i += 1) if (i !== si) out[i] = await settle(g.socks[i]!, marks[i]!);
  return out;
}

/** chat 프레임을 받은 좌석 오름차순 목록 "좌석:줄,..." (받지 않은 소켓은 생략). */
const chatReceivers = (g: Game, got: ServerMessage[][]): string =>
  g.actors
    .map((a, i) => ({ seat: a.seat, lines: chatsOf(got[i]!).map(lineOf).join("+") }))
    .filter((x) => x.lines !== "")
    .sort((a, b) => a.seat - b.seat)
    .map((x) => `${x.seat}:${x.lines}`)
    .join(" ");

const wantLine = (seats: number[], line: string): string => [...seats].sort((a, b) => a - b).map((n) => `${n}:${line}`).join(" ");

/** 보낸 사람 외 소켓이 받은 프레임 요약 "[]" 을 좌석 순으로 이어 붙인다 — 모두 "[]" 이면 아무 프레임도 가지 않았다. */
const othersQuiet = (g: Game, got: ServerMessage[][], sender: Actor): string =>
  g.actors
    .map((a, i) => ({ a, i }))
    .filter((x) => x.a !== sender)
    .sort((x, y) => x.a.seat - y.a.seat)
    .map((x) => summary(got[x.i]!))
    .join("");

/** 저장된 전송 기록을 ms 만큼 과거로 당긴다 — 600ms 간격을 실제로 기다리지 않는다(인메모리 chatRates). 반복 기준 시각도 같이 당긴다. */
async function ageChatRates(code: string, ms: number): Promise<void> {
  await runInDurableObject(env.ROOM.getByName(code), async (instance) => {
    const rates = instance["chatRates"] as Map<string, { lastAt: number; recent: number[]; lastText: string; lastTextAt: number }>;
    for (const [id, r] of rates) rates.set(id, { ...r, lastAt: r.lastAt - ms, recent: r.recent.map((t) => t - ms), lastTextAt: r.lastTextAt - ms });
  });
}

describe("채팅 — 채널 (CHAT-02·03)", () => {
  it("채널: 밤에 산 마피아의 줄은 다른 산 마피아와 탈락자에게만 ch mafia 로 가고 시민·경찰·의사는 한 프레임도 받지 않는다", async () => {
    const g = await startedAt("night");
    const [mafiaA, mafiaB] = withRole(g, "mafia") as [Actor, Actor];
    const dead = withRole(g, "citizen")[0]!;
    await kill(g, [dead.seat]);
    const got = await observe(g, mafiaA, () => chatSend(mafiaA.sock, "그 사람으로 가요"));
    expect(chatReceivers(g, got)).toBe(wantLine([mafiaA.seat, mafiaB.seat, dead.seat], `mafia/${mafiaA.seat}/1/그 사람으로 가요`));
    for (const a of g.actors) if (![mafiaA, mafiaB, dead].includes(a)) expect(`${a.seat}${summary(got[g.actors.indexOf(a)]!)}`).toBe(`${a.seat}[]`);
  });

  it("채널: 밤에 산 시민·경찰·의사의 전송은 보낸 사람만 chatReject phase 와 state 를 받고 다른 소켓은 한 프레임도 받지 않는다", async () => {
    const g = await startedAt("night");
    for (const sender of [withRole(g, "citizen")[0]!, withRole(g, "police")[0]!, withRole(g, "doctor")[0]!]) {
      const got = await observe(g, sender, () => chatSend(sender.sock, "저 마피아 아니에요"));
      const own = got[g.actors.indexOf(sender)]!;
      expect(`${sender.role}${summary(own)}`).toBe(`${sender.role}[chatReject,state:night]`);
      expect(`${sender.role}${JSON.stringify(own.find((m) => m.t === "chatReject"))}`).toBe(`${sender.role}{"t":"chatReject","why":"phase"}`);
      expect(`${sender.role}${othersQuiet(g, got, sender)}`).toBe(`${sender.role}${"[]".repeat(g.actors.length - 1)}`);
    }
  });

  it("채널: 밤에 탈락자의 줄은 ch ghost 로 탈락자에게만 가고 산 마피아에게도 가지 않는다", async () => {
    const g = await startedAt("night");
    const [x, y] = withRole(g, "citizen") as [Actor, Actor];
    await kill(g, [x.seat, y.seat]);
    const got = await observe(g, x, () => chatSend(x.sock, "아쉽네요"));
    expect(chatReceivers(g, got)).toBe(wantLine([x.seat, y.seat], `ghost/${x.seat}/1/아쉽네요`));
  });

  it("채널: 낮 토론에서 탈락자의 줄은 ch ghost 로 탈락자만 받고 산 사람은 한 프레임도 받지 않는다", async () => {
    const g = await startedAt("discussion");
    const [x, y] = withRole(g, "citizen") as [Actor, Actor];
    await kill(g, [x.seat, y.seat]);
    const got = await observe(g, x, () => chatSend(x.sock, "구경 중이에요"));
    expect(chatReceivers(g, got)).toBe(wantLine([x.seat, y.seat], `ghost/${x.seat}/1/구경 중이에요`));
    for (const a of g.actors) if (![x, y].includes(a)) expect(`${a.seat}${summary(got[g.actors.indexOf(a)]!)}`).toBe(`${a.seat}[]`);
  });

  it("채널: 낮 토론에서 산 사람의 줄은 산 사람과 탈락자 모두에게 ch all 로 간다", async () => {
    const g = await startedAt("discussion");
    const dead = withRole(g, "citizen")[0]!;
    const sender = withRole(g, "police")[0]!;
    await kill(g, [dead.seat]);
    const got = await observe(g, sender, () => chatSend(sender.sock, "누가 수상해요?"));
    expect(chatReceivers(g, got)).toBe(wantLine(g.actors.map((a) => a.seat), `all/${sender.seat}/1/누가 수상해요?`));
  });
});

/** 지목으로 첫 시민을 변론자로 몰고(그는 둘째 시민을 가리킨다) 변론 → 찬반 → 처형까지 끌고 간다(08-11 새 흐름). 찬반은 변론자를 뺀 전원 찬성이다. */
async function startedAtVerdictStage(phase: "defense" | "verdict" | "execution"): Promise<Game> {
  const g = await startedAt("nomination");
  const [candidate, other] = withRole(g, "citizen") as [Actor, Actor];
  await pointAll(g.code, g.actors, Object.fromEntries(g.actors.map((a) => [a.seat, a === candidate ? other.seat : candidate.seat])));
  if (phase !== "defense") {
    await advanceTo(g.code, g.socks, "verdict");
    if (phase === "execution") {
      await verdictAll(g.code, g.actors, Object.fromEntries(g.actors.filter((a) => a !== candidate).map((a) => [a.seat, true])));
    }
  }
  for (const sock of g.socks) await settle(sock, mark(sock));
  return g;
}

describe("채팅 — 화면 없는 단계도 받는다 (D1, 결정 0044-23)", () => {
  const stages = ["nomination", "defense", "verdict", "execution", "morning"] as const;
  it.each(stages)("단계: %s 에서 산 사람의 줄이 서버 audience 규칙대로 ch all 로 모두에게 간다", async (phase) => {
    const g = phase === "nomination" || phase === "morning" ? await startedAt(phase) : await startedAtVerdictStage(phase);
    expect((await storedRoom(g.code)).phase).toBe(phase);
    const sender = withRole(g, "police")[0]!;
    const got = await observe(g, sender, () => chatSend(sender.sock, "투표 신중하게 해요"));
    expect(chatReceivers(g, got)).toBe(wantLine(g.actors.map((a) => a.seat), `all/${sender.seat}/1/투표 신중하게 해요`));
  });

  it("단계: 최후 변론에서 후보가 아닌 산 사람 누구나 쓸 수 있다", async () => {
    const g = await startedAtVerdictStage("defense");
    const room = await storedRoom(g.code);
    const bystanders = g.actors.filter((a) => a.seat !== room.verdict?.candidate);
    const sender = bystanders.find((a) => a.role === "doctor")!;
    const got = await observe(g, sender, () => chatSend(sender.sock, "믿어 주세요"));
    expect(chatReceivers(g, got)).toBe(wantLine(g.actors.map((a) => a.seat), `all/${sender.seat}/1/믿어 주세요`));
  });

  it("단계: 역할 확인(roleReveal) 중에는 단계 키가 맞아도 chatReject phase 이고 다른 소켓은 한 프레임도 받지 않는다", async () => {
    const g = await startedAtRoleReveal();
    const room = await storedRoom(g.code);
    const sender = g.actors[0]!;
    const got = await observe(g, sender, () => chatSend(sender.sock, "안녕", `${room.day ?? 0}:${room.phase}`));
    expect(`${room.phase}${summary(got[0]!)}${othersQuiet(g, got, sender)}`).toBe(`roleReveal[chatReject,state:roleReveal]${"[]".repeat(g.actors.length - 1)}`);
  });
});

describe("채팅 — 단계 어긋남 (T-07-24)", () => {
  it("단계 어긋남: 밤의 단계 키로 아침 이후 도착한 마피아 줄은 폐기되고 보낸 사람에게만 chatReject phase 와 state 가 가며 어느 소켓도 chat 을 받지 않는다", async () => {
    const g = await startedAt("night");
    const nightKey = `${(await storedRoom(g.code)).day ?? 0}:night`;
    const mafiaA = withRole(g, "mafia")[0]!;
    await advanceTo(g.code, g.socks, "morning");
    for (const sock of g.socks) await settle(sock, mark(sock));
    const got = await observe(g, mafiaA, () => chatSend(mafiaA.sock, "그 사람으로 가요", nightKey));
    expect(`${summary(got[g.actors.indexOf(mafiaA)]!)}${othersQuiet(g, got, mafiaA)}`).toBe(`[chatReject,state:morning]${"[]".repeat(g.actors.length - 1)}`);
    expect(chatReceivers(g, got)).toBe("");
  });

  it("단계 어긋남: 형식이 맞아도 서버 단계와 다른 단계 키는 폐기된다 (낮 키로 보낸 밤 전송)", async () => {
    const g = await startedAt("night");
    const mafiaA = withRole(g, "mafia")[0]!;
    const got = await observe(g, mafiaA, () => chatSend(mafiaA.sock, "동의해요", "1:discussion"));
    expect(`${summary(got[g.actors.indexOf(mafiaA)]!)}${chatReceivers(g, got)}`).toBe("[chatReject,state:night]");
  });
});

describe("채팅 — 거절 (CHAT-05, D5)", () => {
  /** 로비 방장+손님 한 명. 거절은 보낸 사람(손님)에게만 가고 방장은 아무것도 받지 않는다. */
  async function lobbyPair(): Promise<{ code: string; host: TestSocket; guest: TestSocket }> {
    const s = await seat(1, 0);
    await settle(s.host, 0);
    await settle(s.guests[0]!.sock, 0);
    return { code: s.code, host: s.host, guest: s.guests[0]!.sock };
  }
  const rejectOf = (msgs: ServerMessage[]): string => msgs.filter((m) => m.t === "chatReject").map((m) => JSON.stringify(m)).join("|");

  async function rejectedAs(text: string, pre?: (code: string) => Promise<void>): Promise<{ own: string; host: string }> {
    const p = await lobbyPair();
    await pre?.(p.code);
    const mh = mark(p.host);
    const mg = mark(p.guest);
    chatSend(p.guest, text);
    const own = await settle(p.guest, mg);
    const host = await settle(p.host, mh);
    return { own: `${summary(own)}${rejectOf(own)}`, host: summary(host) };
  }

  it("거절: 공백뿐인 줄은 other 로 막히고 방장에게는 아무 프레임도 가지 않는다", async () => {
    const r = await rejectedAs("   \t  ");
    expect(`${r.own}${r.host}`).toBe('[chatReject]{"t":"chatReject","why":"other"}[]');
  });

  it("거절: 101자는 length 로 막히고 100자는 통과한다", async () => {
    const r = await rejectedAs("가".repeat(101));
    expect(`${r.own}${r.host}`).toBe('[chatReject]{"t":"chatReject","why":"length"}[]');
    const ok = await rejectedAs("가".repeat(100));
    expect(`${ok.own}${ok.host}`).toBe("[chat][chat]");
  });

  it("거절: 600ms 안의 두 번째 줄은 rate 로 막히고 방장은 첫 줄만 받는다", async () => {
    const p = await lobbyPair();
    const mh = mark(p.host);
    const mg = mark(p.guest);
    chatSend(p.guest, "하나");
    chatSend(p.guest, "둘");
    const own = await settle(p.guest, mg);
    const host = await settle(p.host, mh);
    expect(`${summary(own)}${rejectOf(own)}${summary(host)}`).toBe('[chat,chatReject]{"t":"chatReject","why":"rate"}[chat]');
  });

  it("거절: 간격을 지켜도 같은 문장을 3초 안에 다시 보내면 repeat 로 막힌다", async () => {
    const p = await lobbyPair();
    chatSend(p.guest, "믿어 주세요");
    await settle(p.guest, mark(p.guest));
    await ageChatRates(p.code, 700);
    const mh = mark(p.host);
    const mg = mark(p.guest);
    chatSend(p.guest, "믿어 주세요");
    const own = await settle(p.guest, mg);
    const host = await settle(p.host, mh);
    expect(`${summary(own)}${rejectOf(own)}${summary(host)}`).toBe('[chatReject]{"t":"chatReject","why":"repeat"}[]');
  });

  it("거절: 5초 안에 여섯 번째 줄은 rate 로 막힌다", async () => {
    const p = await lobbyPair();
    for (let i = 1; i <= 5; i += 1) {
      chatSend(p.guest, `줄 ${i}`);
      await settle(p.guest, mark(p.guest));
      await ageChatRates(p.code, 700);
    }
    const mh = mark(p.host);
    const mg = mark(p.guest);
    chatSend(p.guest, "줄 6");
    const own = await settle(p.guest, mg);
    const host = await settle(p.host, mh);
    expect(`${summary(own)}${rejectOf(own)}${summary(host)}`).toBe('[chatReject]{"t":"chatReject","why":"rate"}[]');
  });

  it("거절: 거절된 전송은 기록을 만들지 않아 기록을 비우면 같은 문장이 곧바로 통과한다 (resetChatRates)", async () => {
    const p = await lobbyPair();
    chatSend(p.guest, "하나");
    chatSend(p.guest, "둘");
    await settle(p.guest, mark(p.guest));
    await resetChatRates(p.code);
    const mg = mark(p.guest);
    chatSend(p.guest, "둘");
    expect(summary(await settle(p.guest, mg))).toBe("[chat]");
  });

  it("거절: hello 전 소켓의 채팅은 보낸 소켓만 BAD_MESSAGE 를 받고 방장은 한 프레임도 받지 않는다", async () => {
    const { code, token } = await createRoom("방장");
    const host = await connect(code);
    await hello(host, token);
    await joinOk(code, "손님");
    await settle(host, 0);
    const anon = await connect(code);
    const mh = mark(host);
    const ma = mark(anon);
    send(anon, { t: "chat", text: "안녕", pk: "0:lobby" });
    const own = await settle(anon, ma);
    const got = await settle(host, mh);
    expect(`${summary(own)}${summary(got)}`).toBe("[error:BAD_MESSAGE][]");
  });
});

describe("채팅 — 채널별 줄 번호 (리서치 Pitfall 1, 결정 0058-5)", () => {
  // 줄 번호는 DO 메모리(chatLog)에 있다 — 마감을 당기는 도우미(forceDue)는 DO 를 evict 해 번호가 1 로 돌아가므로,
  // 단계는 evict 하지 않는 테스트 방 넘기기(testSkip)로 넘긴다. 저장·복원 뒤에도 이어지는 것은 07-14 가 시험한다.
  it("줄 번호: 낮 all 줄 번호에는 밤 마피아 줄 때문에 생긴 틈이 없고 mafia 번호는 판 내내 이어진다", async () => {
    const room = await seat(5, 0, { testMode: true });
    const socks = [room.host, ...room.guests.map((x) => x.sock)];
    send(room.host, { t: "start" });
    for (const sock of socks) await nextFrame(sock, (m) => m.t === "state" && m.view.phase === "assigning");
    await skipThrough(room, "dayAnnounce");
    const actors = actorsOf(room);
    const g: Game = { code: room.code, socks, actors };
    await skipThrough(room, "discussion");
    for (const sock of socks) await settle(sock, mark(sock));
    const [a, b] = withRole(g, "citizen") as [Actor, Actor];
    const mafia = withRole(g, "mafia")[0]!;
    const watcher = withRole(g, "doctor")[0]!;
    const seen = (got: ServerMessage[][]): string => chatsOf(got[g.actors.indexOf(watcher)]!).map(lineOf).join("+");
    const toPhase = async (phase: PhaseId): Promise<void> => {
      // 연결당 1초 20개 한도(RATE_LIMITED)에 걸리지 않게 단계를 넘기기 전에 창을 비운다.
      await new Promise<void>((resolve) => setTimeout(resolve, 1_050));
      await skipThrough(room, phase);
      for (const sock of socks) await settle(sock, mark(sock));
      await resetChatRates(g.code);
    };

    const l1 = await observe(g, a, () => chatSend(a.sock, "하나"));
    const l2 = await observe(g, b, () => chatSend(b.sock, "둘"));
    expect(`${seen(l1)} ${seen(l2)}`).toBe(`all/${a.seat}/1/하나 all/${b.seat}/2/둘`);

    await toPhase("night");
    const n1 = await observe(g, mafia, () => chatSend(mafia.sock, "동의해요"));
    expect(`${seen(n1)}|${chatsOf(n1[g.actors.indexOf(mafia)]!).map(lineOf).join("+")}`).toBe(`|mafia/${mafia.seat}/1/동의해요`);

    await toPhase("discussion");
    const l3 = await observe(g, a, () => chatSend(a.sock, "셋"));
    expect(seen(l3)).toBe(`all/${a.seat}/3/셋`);

    await toPhase("night");
    const n2 = await observe(g, mafia, () => chatSend(mafia.sock, "그 사람으로 가요"));
    expect(chatsOf(n2[g.actors.indexOf(mafia)]!).map(lineOf).join("+")).toBe(`mafia/${mafia.seat}/2/그 사람으로 가요`);
  }, 30_000);
});
