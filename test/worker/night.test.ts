// 밤 워커 통합 테스트(03-07): 실제 소켓으로 밤 행동·받는 사람 한정 전송·아침 결과를 workerd 에서 확인한다.
// 실패 출력은 한 줄이어야 해서(TAP) 프레임 목록은 summary() 한 줄 문자열로 비교한다.
import { describe, expect, it } from "vitest";
import type { RoomView, RoleId, ServerMessage } from "../../shared/protocol";
import { advanceTo, alarmOf, backdateSends, collect, nextFrame, seat, send, storedRoom } from "./helpers";
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

  it("밤 마감 뒤 모든 소켓이 같은 day.morning 을 받고 경찰만 수사 기록(me.records)을 받는다", async () => {
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
    for (const a of actors.filter((x) => x !== police)) {
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

describe("밤 채팅 (D-17·COMM-04)", () => {
  it("마피아의 밤 say·emoji 는 살아 있는 마피아 둘에게만 가고 비마피아 네 소켓은 chat·emoji 프레임을 받지 않는다", async () => {
    const r = await startedAtNight(6);
    const actors = actorsOf(r);
    const [a, b] = withRole(actors, "mafia") as [Actor, Actor];
    const victim = withRole(actors, "citizen")[0]!;
    const rest = actors.filter((x) => x.role !== "mafia");

    const said = await sendAndSettle(a, { t: "say", template: "nightTarget", target: victim.seat }, [b, ...rest]);
    expect(summary(said.own)).toBe("[chat]");
    expect(summary(said.seen.get(b)!)).toBe("[chat]");
    expect(Object.keys(said.own[0]!).sort().join(",")).toBe("at,seat,seq,t,target,template");
    for (const x of rest) expect(summary(said.seen.get(x)!)).toBe("[]");

    await backdateSends(r.code);
    const emoted = await sendAndSettle(a, { t: "emoji", icon: "smile" }, [b, ...rest]);
    expect(summary(emoted.own)).toBe("[emoji]");
    expect(summary(emoted.seen.get(b)!)).toBe("[emoji]");
    for (const x of rest) expect(summary(emoted.seen.get(x)!)).toBe("[]");
  });

  it("살아 있는 시민의 밤 say 는 그 소켓만 WRONG_PHASE + state 를 받고, 마피아의 낮 문구는 BAD_MESSAGE 뿐이다", async () => {
    const r = await startedAtNight(6);
    const actors = actorsOf(r);
    const [a, b] = withRole(actors, "mafia") as [Actor, Actor];
    const citizen = withRole(actors, "citizen")[0]!;
    const rest = actors.filter((x) => x !== citizen);

    const wrong = await sendAndSettle(citizen, { t: "say", template: "nightAgree" }, rest);
    expect(summary(wrong.own)).toBe("[error:WRONG_PHASE,state:night]");
    for (const x of rest) expect(summary(wrong.seen.get(x)!)).toBe("[]");

    const day = await sendAndSettle(a, { t: "say", template: "innocent" }, [b, citizen]);
    expect(summary(day.own)).toBe("[error:BAD_MESSAGE]");
    expect(summary(day.seen.get(b)!)).toBe("[]");
    expect(summary(day.seen.get(citizen)!)).toBe("[]");
  });

  it("밤 say 는 메시지를 저장하지 않고 낮 번호는 그대로이며 밤 번호만 오른다", async () => {
    const r = await startedAtNight(6);
    const actors = actorsOf(r);
    const [a] = withRole(actors, "mafia") as [Actor, Actor];
    const victim = withRole(actors, "citizen")[0]!;
    const before = (await storedRoom(r.code)) as unknown as Record<string, unknown>;

    await sendAndSettle(a, { t: "say", template: "nightTarget", target: victim.seat }, []);
    const after = (await storedRoom(r.code)) as unknown as Record<string, unknown>;
    expect(Object.hasOwn(after, "messages")).toBe(false);
    expect(JSON.stringify(after).includes("nightTarget")).toBe(false);
    expect(String(after.nextMessageSeq)).toBe(String(before.nextMessageSeq));
    expect(String(before.nextNightSeq)).toBe("undefined");
    expect(String(after.nextNightSeq)).toBe("2");
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
  it("낮 토론 say 는 지금처럼 모든 소켓에 간다", async () => {
    const r = await seat(4, 0);
    send(r.host, { t: "start" });
    for (const s of allSockets(r)) await nextFrame(s, (m) => m.t === "state" && m.view.phase === "assigning");
    await advanceTo(r.code, allSockets(r), "discussion");
    const actors = actorsOf(r);
    const [speaker, ...rest] = actors as [Actor, ...Actor[]];

    const said = await sendAndSettle(speaker, { t: "say", template: "innocent" }, rest);
    expect(summary(said.own)).toBe("[chat]");
    for (const x of rest) expect(summary(said.seen.get(x)!)).toBe("[chat]");
  });
});
