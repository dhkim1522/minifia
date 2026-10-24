// 밤 워커 통합 테스트(03-07): 실제 소켓으로 밤 행동·받는 사람 한정 전송·아침 결과를 workerd 에서 확인한다.
// 실패 출력은 한 줄이어야 해서(TAP) 프레임 목록은 summary() 한 줄 문자열로 비교한다.
import { describe, expect, it } from "vitest";
import type { RoomView, RoleId, ServerMessage } from "../../shared/protocol";
import { advanceTo, collect, nextFrame, seat, send, storedRoom } from "./helpers";
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
