// 밤 워커 통합 테스트(03-07): 실제 소켓으로 밤 행동·받는 사람 한정 전송·아침 결과를 workerd 에서 확인한다.
// 실패 출력은 한 줄이어야 해서(TAP) 프레임 목록은 summary() 한 줄 문자열로 비교한다.
import { describe, expect, it } from "vitest";
import type { RoomView, RoleId, ServerMessage } from "../../shared/protocol";
import { advanceTo, alarmOf, chatMsg, collect, connect, forceDue, hello, nextFrame, seat, send, storedRoom } from "./helpers";
import type { Seated, TestSocket } from "./helpers";

interface Actor {
  sock: TestSocket;
  token: string;
  seat: number;
  role: RoleId;
}

const allSockets = (r: Seated): TestSocket[] => [r.host, ...r.guests.map((g) => g.sock)];

const parse = (raw: string): ServerMessage => JSON.parse(raw) as ServerMessage;

const viewsIn = (sock: TestSocket, phase: string): RoomView[] =>
  collect(sock)
    .map(parse)
    .filter((m): m is Extract<ServerMessage, { t: "state" }> => m.t === "state" && m.view.phase === phase)
    .map((m) => m.view);

/** 프레임 목록을 "[state:night,error:BAD_MESSAGE]" 같은 한 줄로. 빈 목록도 "[]" 라 비어 있지 않다. */
const summary = (msgs: ServerMessage[]): string =>
  `[${msgs
    .map((m) => (m.t === "state" ? `state:${m.view.phase}` : m.t === "error" ? `error:${m.code}` : m.t))
    .join(",")}]`;

let pingCounter = 0;
/**
 * `from`(그 소켓의 frames 길이를 행동 전에 적어 둔 값) 이후 ~ pong 직전까지 받은 프레임. 소켓마다 보낸 순서대로 전달되므로
 * ping 을 보내 pong 이 올 때까지 사이에 낀 프레임이 곧 그 행동이 만든 프레임 전부다("오지 않았음" 의 증명).
 */
async function settle(sock: TestSocket, from: number): Promise<ServerMessage[]> {
  pingCounter += 1;
  const c = pingCounter;
  send(sock, { t: "ping", c });
  await nextFrame(sock, (m) => m.t === "pong" && m.c === c);
  return sock.frames.slice(from, sock.cursor - 1).map(parse);
}

const mark = (sock: TestSocket): number => sock.frames.length;

/** 소켓이 받은 마지막 state view. */
function lastView(sock: TestSocket): RoomView {
  const views = collect(sock)
    .map(parse)
    .filter((m): m is Extract<ServerMessage, { t: "state" }> => m.t === "state")
    .map((m) => m.view);
  return views.at(-1)!;
}

/** 모든 소켓의 마지막 view 로 사람마다 seat·역할을 읽는다(역할은 무작위라 테스트가 이렇게 고른다). */
function actorsOf(r: Seated): Actor[] {
  const tokens = [r.hostToken, ...r.guests.map((g) => g.token)];
  return allSockets(r).map((sock, i) => {
    const view = lastView(sock);
    return { sock, token: tokens[i]!, seat: view.me.seat, role: view.me.role! };
  });
}

const withRole = (actors: Actor[], role: RoleId): Actor[] => actors.filter((a) => a.role === role);

/** 연결 `players` 명 방을 시작해 밤까지 넘긴다. */
async function startedAtNight(players: number): Promise<Seated> {
  const r = await seat(players - 1, 0);
  send(r.host, { t: "start" });
  for (const s of allSockets(r)) await nextFrame(s, (m) => m.t === "state" && m.view.phase === "assigning");
  await advanceTo(r.code, allSockets(r), "night");
  return r;
}

/** 행동을 보내고 그 소켓이 받은 프레임(pong 직전까지)을 돌려준다. */
async function pick(a: Actor, target: number | Record<string, unknown>): Promise<ServerMessage[]> {
  const from = mark(a.sock);
  send(a.sock, typeof target === "number" ? { t: "pick", target } : target);
  return settle(a.sock, from);
}

describe("밤 행동 한 줄 (NIGHT-02)", () => {
  it("경찰의 pick 은 경찰 소켓에만 me.pick state 로 가고 살아 있는 다른 소켓은 프레임을 받지 않는다", async () => {
    const r = await startedAtNight(5);
    const actors = actorsOf(r);
    const police = withRole(actors, "police")[0]!;
    const citizen = withRole(actors, "citizen")[0]!;
    const others = actors.filter((a) => a !== police);
    const marks = new Map(others.map((a) => [a, mark(a.sock)]));

    const mine = await pick(police, citizen.seat);
    expect(summary(mine)).toBe("[state:night]");
    expect(String((mine[0] as Extract<ServerMessage, { t: "state" }>).view.me.pick)).toBe(String(citizen.seat));

    for (const a of others) expect(summary(await settle(a.sock, marks.get(a)!))).toBe("[]");
  });

  it("같은 대상을 다시 보내면 경찰 소켓도 state 를 받지 않고 저장된 선택은 그대로다", async () => {
    const r = await startedAtNight(5);
    const actors = actorsOf(r);
    const police = withRole(actors, "police")[0]!;
    const citizen = withRole(actors, "citizen")[0]!;
    await pick(police, citizen.seat);

    expect(summary(await pick(police, citizen.seat))).toBe("[]");
    const stored = (await storedRoom(r.code)).players as Array<{ seat: number; nightPick?: number }>;
    const saved = stored.find((p) => p.seat === police.seat)!;
    expect(String(saved.nightPick)).toBe(String(citizen.seat));
  });

  it("알 수 없는 키·범위 밖·문자열 target 은 BAD_MESSAGE 이고 다른 소켓에 아무것도 가지 않는다", async () => {
    const r = await startedAtNight(5);
    const actors = actorsOf(r);
    const police = withRole(actors, "police")[0]!;
    const others = actors.filter((a) => a !== police);
    const marks = new Map(others.map((a) => [a, mark(a.sock)]));

    expect(summary(await pick(police, { t: "pick", target: 1, extra: 1 }))).toBe("[error:BAD_MESSAGE]");
    expect(summary(await pick(police, { t: "pick", target: 9 }))).toBe("[error:BAD_MESSAGE]");
    expect(summary(await pick(police, { t: "pick", target: "1" }))).toBe("[error:BAD_MESSAGE]");

    for (const a of others) expect(summary(await settle(a.sock, marks.get(a)!))).toBe("[]");
  });

  it("밤 마감 뒤 모든 소켓이 같은 day.morning 을 받고 본인 역할의 일지(me.records)를 경찰·마피아·의사만 받는다", async () => {
    const r = await startedAtNight(5);
    const actors = actorsOf(r);
    const mafia = withRole(actors, "mafia")[0]!;
    const police = withRole(actors, "police")[0]!;
    const doctor = withRole(actors, "doctor")[0]!;
    const victim = withRole(actors, "citizen")[0]!;
    await pick(mafia, victim.seat);
    await pick(police, mafia.seat);
    await pick(doctor, doctor.seat);

    await advanceTo(r.code, allSockets(r), "morning");

    const mornings = actors.map((a) => viewsIn(a.sock, "morning").at(-1)!);
    const first = JSON.stringify(mornings[0]!.day?.morning);
    expect(first.includes(`"eliminated":${victim.seat}`)).toBe(true);
    for (const v of mornings) expect(JSON.stringify(v.day?.morning)).toBe(first);

    const policeView = viewsIn(police.sock, "morning").at(-1)!;
    expect(String(policeView.me.records?.length)).toBe("1");
    expect(JSON.stringify(policeView.me.records?.[0])).toBe(JSON.stringify({ n: 1, target: mafia.seat, isMafia: true }));
    // 마피아는 암살일지(그 밤 지목한 시민이 죽음), 의사는 치료일지(자기 보호)를 받고 시민은 키가 없다(D-10).
    expect(JSON.stringify(viewsIn(mafia.sock, "morning").at(-1)!.me.records)).toBe(
      JSON.stringify([{ n: 1, target: victim.seat, died: true }]),
    );
    expect(JSON.stringify(viewsIn(doctor.sock, "morning").at(-1)!.me.records)).toBe(
      JSON.stringify([{ n: 1, target: doctor.seat }]),
    );
    for (const a of actors.filter((x) => x.role === "citizen")) {
      expect(Object.hasOwn(viewsIn(a.sock, "morning").at(-1)!.me, "records")).toBe(false);
    }
  });
});

/** 행동을 보내고, 받은 소켓(들)과 못 받아야 하는 소켓(들)의 프레임 요약을 돌려준다. */
async function sendAndSettle(
  from: Actor,
  msg: unknown,
  watchers: Actor[],
): Promise<{ own: ServerMessage[]; seen: Map<Actor, ServerMessage[]> }> {
  const marks = new Map(watchers.map((a) => [a, mark(a.sock)]));
  const ownMark = mark(from.sock);
  send(from.sock, msg);
  const own = await settle(from.sock, ownMark);
  const seen = new Map<Actor, ServerMessage[]>();
  for (const a of watchers) seen.set(a, await settle(a.sock, marks.get(a)!));
  return { own, seen };
}

describe("마피아 밤 (NIGHT-01·D-07)", () => {
  it("마피아 A 의 pick 은 살아 있는 마피아 둘에게만 state 로 가고 나머지 네 소켓은 프레임을 받지 않는다", async () => {
    const r = await startedAtNight(6);
    const actors = actorsOf(r);
    const [a, b] = withRole(actors, "mafia") as [Actor, Actor];
    const victim = withRole(actors, "citizen")[0]!;
    const rest = actors.filter((x) => x.role !== "mafia");

    const { own, seen } = await sendAndSettle(a, { t: "pick", target: victim.seat }, [b, ...rest]);
    expect(summary(own)).toBe("[state:night]");
    expect(String((own[0] as Extract<ServerMessage, { t: "state" }>).view.me.pick)).toBe(String(victim.seat));
    expect(summary(seen.get(b)!)).toBe("[state:night]");
    expect(JSON.stringify((seen.get(b)![0] as Extract<ServerMessage, { t: "state" }>).view.me.allyPicks)).toBe(`[${victim.seat}]`);
    for (const x of rest) expect(summary(seen.get(x)!)).toBe("[]");
  });
});

describe("밤 채팅 (D-17·COMM-04, 07-11 자유 채팅)", () => {
  it("마피아의 밤 chat·emoji 는 살아 있는 마피아 둘에게만 가고 비마피아 네 소켓은 chat·emoji 프레임을 받지 않는다", async () => {
    const r = await startedAtNight(6);
    const actors = actorsOf(r);
    const [a, b] = withRole(actors, "mafia") as [Actor, Actor];
    const rest = actors.filter((x) => x.role !== "mafia");

    const said = await sendAndSettle(a, chatMsg(a.sock, "그 사람으로 가요"), [b, ...rest]);
    expect(summary(said.own)).toBe("[chat]");
    expect(summary(said.seen.get(b)!)).toBe("[chat]");
    expect(Object.keys(said.own[0]!).sort().join(",")).toBe("at,ch,seat,seq,t,text");
    expect((said.own[0] as Extract<ServerMessage, { t: "chat" }>).ch).toBe("mafia");
    for (const x of rest) expect(summary(said.seen.get(x)!)).toBe("[]");

    const emoted = await sendAndSettle(a, { t: "emoji", icon: "smile" }, [b, ...rest]);
    expect(summary(emoted.own)).toBe("[emoji]");
    expect(summary(emoted.seen.get(b)!)).toBe("[emoji]");
    for (const x of rest) expect(summary(emoted.seen.get(x)!)).toBe("[]");
  });

  it("살아 있는 시민의 밤 chat 은 그 소켓만 chatReject + state 를 받고, 마피아의 빠른 메시지(say)는 BAD_MESSAGE 뿐이다", async () => {
    const r = await startedAtNight(6);
    const actors = actorsOf(r);
    const [a, b] = withRole(actors, "mafia") as [Actor, Actor];
    const citizen = withRole(actors, "citizen")[0]!;
    const rest = actors.filter((x) => x !== citizen);

    const wrong = await sendAndSettle(citizen, chatMsg(citizen.sock, "동의해요"), rest);
    expect(summary(wrong.own)).toBe("[chatReject,state:night]");
    for (const x of rest) expect(summary(wrong.seen.get(x)!)).toBe("[]");

    const say = await sendAndSettle(a, { t: "say", template: "nightAgree" }, [b, citizen]);
    expect(summary(say.own)).toBe("[error:BAD_MESSAGE]");
    expect(summary(say.seen.get(b)!)).toBe("[]");
    expect(summary(say.seen.get(citizen)!)).toBe("[]");
  });

  it("밤 chat 은 방 저장소(room 키)를 바꾸지 않는다 — 줄 번호·메시지가 저장되지 않는다", async () => {
    const r = await startedAtNight(6);
    const actors = actorsOf(r);
    const [a] = withRole(actors, "mafia") as [Actor, Actor];
    const before = (await storedRoom(r.code)) as unknown as Record<string, unknown>;

    await sendAndSettle(a, chatMsg(a.sock, "그 사람으로 가요"), []);
    const after = (await storedRoom(r.code)) as unknown as Record<string, unknown>;
    expect(Object.hasOwn(after, "messages")).toBe(false);
    expect(JSON.stringify(after).includes("그 사람으로 가요")).toBe(false);
    expect(String(after.nextMessageSeq)).toBe(String(before.nextMessageSeq));
    expect(String(after.nextNightSeq)).toBe("undefined");
  });
});

describe("마감 (NIGHT-05)", () => {
  it("모든 행동 역할이 고른 뒤에도 밤은 진입 때 마감·알람 그대로 남는다", async () => {
    const r = await startedAtNight(6);
    const actors = actorsOf(r);
    const endsAt = lastView(r.host).phaseEndsAt;
    const [a, b] = withRole(actors, "mafia") as [Actor, Actor];
    const police = withRole(actors, "police")[0]!;
    const doctor = withRole(actors, "doctor")[0]!;
    const victim = withRole(actors, "citizen")[0]!;

    await pick(a, victim.seat);
    await pick(b, victim.seat);
    await pick(police, a.seat);
    await pick(doctor, doctor.seat);

    const stored = await storedRoom(r.code);
    expect(stored.phase).toBe("night");
    expect(String(stored.phaseEndsAt)).toBe(String(endsAt));
    expect(String(await alarmOf(r.code))).toBe(String(endsAt));
  });
});

describe("낮 방송 회귀", () => {
  it("낮 토론 chat 은 지금처럼 모든 소켓에 간다", async () => {
    const r = await seat(4, 0);
    send(r.host, { t: "start" });
    for (const s of allSockets(r)) await nextFrame(s, (m) => m.t === "state" && m.view.phase === "assigning");
    await advanceTo(r.code, allSockets(r), "discussion");
    const actors = actorsOf(r);
    const [speaker, ...rest] = actors as [Actor, ...Actor[]];

    const said = await sendAndSettle(speaker, chatMsg(speaker.sock, "저 아니에요"), rest);
    expect(summary(said.own)).toBe("[chat]");
    for (const x of rest) expect(summary(said.seen.get(x)!)).toBe("[chat]");
  });
});

interface FirstNight {
  r: Seated;
  actors: Actor[];
  dead: Actor;
  mafia: [Actor, Actor];
  police: Actor;
  doctor: Actor;
  /** 살아남은 시민. */
  living: Actor;
  alive: Actor[];
}

/** 6명 방 1일차 밤: 마피아 둘이 시민 하나를 고르고 의사가 자신을 지킨다. 아침이 되면 그 시민이 탈락해 있다. */
async function diedFirstNight(): Promise<FirstNight> {
  const r = await startedAtNight(6);
  const actors = actorsOf(r);
  const [a, b] = withRole(actors, "mafia") as [Actor, Actor];
  const police = withRole(actors, "police")[0]!;
  const doctor = withRole(actors, "doctor")[0]!;
  const [dead, living] = withRole(actors, "citizen") as [Actor, Actor];
  await pick(a, dead.seat);
  await pick(b, dead.seat);
  await pick(doctor, doctor.seat);
  await pick(police, a.seat);
  await advanceTo(r.code, allSockets(r), "morning");
  return { r, actors, dead, mafia: [a, b], police, doctor, living, alive: actors.filter((x) => x !== dead) };
}

const stateOf = (m: ServerMessage | undefined): RoomView => (m as Extract<ServerMessage, { t: "state" }>).view;
const hasSpectate = (sock: TestSocket): boolean => collect(sock).some((raw) => raw.includes('"spectate"'));

describe("관전 (결정 0021)", () => {
  it("탈락한 시민의 소켓만 탈락한 아침 state 부터 모든 직업(spectate.seats)을 받는다", async () => {
    const { actors, dead, alive } = await diedFirstNight();

    const morning = viewsIn(dead.sock, "morning").at(-1)!;
    const expected = [...actors].sort((x, y) => x.seat - y.seat).map((x) => ({ seat: x.seat, job: x.role }));
    expect(JSON.stringify(morning.spectate?.seats)).toBe(JSON.stringify(expected));
    // 탈락 전(밤 이하)의 프레임에는 spectate 키가 없다.
    const beforeMorning = collect(dead.sock).filter((raw) => !raw.includes('"phase":"morning"'));
    expect(String(beforeMorning.some((raw) => raw.includes('"spectate"')))).toBe("false");
    for (const x of alive) expect(String(hasSpectate(x.sock))).toBe("false");
  });

  it("다음 밤에 마피아·경찰의 선택 state 는 행위자 쪽과 관전자 소켓에만 가고 살아 있는 시민은 프레임을 받지 않는다", async () => {
    const { r, dead, mafia, police, doctor, living, alive } = await diedFirstNight();
    const [a, b] = mafia;
    await advanceTo(r.code, allSockets(r), "night");

    const mafiaPick = await sendAndSettle(a, { t: "pick", target: living.seat }, [b, dead, police, doctor, living]);
    expect(summary(mafiaPick.own)).toBe("[state:night]");
    expect(summary(mafiaPick.seen.get(b)!)).toBe("[state:night]");
    expect(JSON.stringify(stateOf(mafiaPick.seen.get(b)![0]).me.allyPicks)).toBe(`[${living.seat}]`);
    expect(summary(mafiaPick.seen.get(dead)!)).toBe("[state:night]");
    expect(JSON.stringify(stateOf(mafiaPick.seen.get(dead)![0]).spectate?.picks?.mafia)).toBe(`[${living.seat}]`);
    for (const x of [police, doctor, living]) expect(summary(mafiaPick.seen.get(x)!)).toBe("[]");

    const policePick = await sendAndSettle(police, { t: "pick", target: a.seat }, [a, b, doctor, living, dead]);
    expect(summary(policePick.own)).toBe("[state:night]");
    expect(summary(policePick.seen.get(dead)!)).toBe("[state:night]");
    expect(JSON.stringify(stateOf(policePick.seen.get(dead)![0]).spectate?.picks?.police)).toBe(`[${a.seat}]`);
    for (const x of [a, b, doctor, living]) expect(summary(policePick.seen.get(x)!)).toBe("[]");
    expect(alive.length).toBe(5);
  });

  it("다음 밤 마피아 chat 은 마피아 둘과 관전자 소켓에만 chat 이 가고 살아 있는 비마피아는 0개다", async () => {
    const { r, dead, mafia, police, doctor, living } = await diedFirstNight();
    const [a, b] = mafia;
    await advanceTo(r.code, allSockets(r), "night");

    const said = await sendAndSettle(a, chatMsg(a.sock, "그 사람으로 가요"), [b, dead, police, doctor, living]);
    expect(summary(said.own)).toBe("[chat]");
    expect(summary(said.seen.get(b)!)).toBe("[chat]");
    expect(summary(said.seen.get(dead)!)).toBe("[chat]");
    for (const x of [police, doctor, living]) expect(summary(said.seen.get(x)!)).toBe("[]");
  });

  it("재접속한 탈락자의 첫 state 에 spectate 가 있다", async () => {
    const { r, dead } = await diedFirstNight();
    const fresh = await connect(r.code);
    const first = await hello(fresh, dead.token);
    expect(String(first.view.spectate?.seats.length)).toBe("6");
  });
});

describe("탈락자 거부 (ELIM-01)", () => {
  it("탈락자의 pick 은 BAD_MESSAGE + state, say·emoji 는 BAD_MESSAGE 뿐이고 아무 소켓에도 chat·emoji 가 가지 않으며, 탈락자의 chat 은 ch ghost 로 탈락자에게만 간다", async () => {
    const { r, dead, mafia, police, doctor, living } = await diedFirstNight();
    const [a, b] = mafia;
    await advanceTo(r.code, allSockets(r), "night");
    const watchers = [a, b, police, doctor, living];

    const picked = await sendAndSettle(dead, { t: "pick", target: living.seat }, watchers);
    expect(summary(picked.own)).toBe("[error:BAD_MESSAGE,state:night]");
    const said = await sendAndSettle(dead, { t: "say", template: "nightAgree" }, watchers);
    expect(summary(said.own)).toBe("[error:BAD_MESSAGE]");
    const emoted = await sendAndSettle(dead, { t: "emoji", icon: "smile" }, watchers);
    expect(summary(emoted.own)).toBe("[error:BAD_MESSAGE]");
    for (const x of watchers) {
      expect(summary(picked.seen.get(x)!)).toBe("[]");
      expect(summary(said.seen.get(x)!)).toBe("[]");
      expect(summary(emoted.seen.get(x)!)).toBe("[]");
    }
    const ghost = await sendAndSettle(dead, chatMsg(dead.sock, "아쉽네요"), watchers);
    expect(summary(ghost.own)).toBe("[chat]");
    expect((ghost.own[0] as Extract<ServerMessage, { t: "chat" }>).ch).toBe("ghost");
    for (const x of watchers) expect(summary(ghost.seen.get(x)!)).toBe("[]");
  });

});

describe("마감 뒤 행동", () => {
  it("마감 시각이 지난 뒤(알람 전) 도착한 pick 은 먼저 아침으로 넘기고 WRONG_PHASE 다", async () => {
    const r = await startedAtNight(5);
    const actors = actorsOf(r);
    const police = withRole(actors, "police")[0]!;
    const target = withRole(actors, "citizen")[0]!;
    const others = actors.filter((x) => x !== police);
    const marks = new Map(actors.map((x) => [x, mark(x.sock)]));

    await forceDue(r.code, "phaseEndsAt");
    send(police.sock, { t: "pick", target: target.seat });
    await nextFrame(police.sock, (m) => m.t === "error");
    await nextFrame(police.sock, (m) => m.t === "state");

    expect(summary(await settle(police.sock, marks.get(police)!))).toBe("[state:morning,error:WRONG_PHASE,state:morning]");
    for (const x of others) expect(summary(await settle(x.sock, marks.get(x)!))).toBe("[state:morning]");
    expect((await storedRoom(r.code)).phase).toBe("morning");
  });
});
