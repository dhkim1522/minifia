// 06-08: 방 DO 의 로비 이동(MAP-02) — move 한 번이 서버 경로가 되어 연결된 모든 소켓에 같은 world.move 로 간다.
// 입장 위치(MAP-01)·hello 뒤 snap(MAP-05)·조용한 거절(UI-SPEC "서버가 막은 탭에 문구 없음")을 DO 밖에서 소켓으로 본다.
import { env } from "cloudflare:workers";
import { evictDurableObject, runDurableObjectAlarm, runInDurableObject } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import type { PhaseId, ServerMessage } from "../../shared/protocol";
import { BAR_MAP, lineWalkable } from "../../shared/game/map";
import { positionAt } from "../../shared/game/world";
import {
  advanceTo,
  chatSend,
  chatsOf,
  closed,
  connect,
  ghostsOf,
  startedGame,
  toPhase,
  worldFramesOf,
  createRoom,
  flushWorld,
  hello,
  joinOk,
  lastViewOf,
  mark,
  nextFrame,
  seat,
  send,
  settle,
  storedRoom,
  alarmOf,
  until,
  wanderTimes,
  worldDirty,
  worldOf,
} from "./helpers";
import type { TestSocket } from "./helpers";

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

type MoveFrame = Extract<ServerMessage, { t: "world"; k: "move" }>;
type SnapFrame = Extract<ServerMessage, { t: "world"; k: "snap" }>;

const parse = (raw: string): ServerMessage => JSON.parse(raw) as ServerMessage;
const isSnap = (m: ServerMessage): m is SnapFrame => m.t === "world" && m.k === "snap";
const isMove = (m: ServerMessage): m is MoveFrame => m.t === "world" && m.k === "move";
/** 걷는 구간(두 점 이상)을 가진 move — 입장 때의 한 점 move 와 구별한다. */
const isWalk = (s: number) => (m: ServerMessage): m is MoveFrame => isMove(m) && m.s === s && m.p.length > 2;
/** 어느 소켓이 받은 world 프레임(원문) 가운데 mark 이후 것. */
const worldsSince = (sock: TestSocket, from: number): string[] => sock.frames.slice(from).filter((f) => parse(f).t === "world");
const errorsSince = (sock: TestSocket, from: number): string[] => sock.frames.slice(from).filter((f) => parse(f).t === "error");

describe("로비 이동 — 트레이서 (MAP-02, MAP-01)", () => {
  it("방장 hello 의 프레임 순서는 [state, world.snap, chatLog] 이고 snap 에 seat 0 이 입장 지점 한 점으로 있다", async () => {
    const { code, token } = await createRoom("방장");
    const host = await connect(code);
    await hello(host, token);
    const snap = (await nextFrame(host, isSnap)) as SnapFrame;
    await nextFrame(host, (m) => m.t === "chatLog");
    const kinds = host.frames.slice(0, 3).map((f) => {
      const m = parse(f);
      return m.t === "world" ? `world.${m.k}` : m.t;
    });
    expect(kinds.join(",")).toBe("state,world.snap,chatLog");
    expect(snap.ents.map((e) => e.s).join(",")).toBe("0");
    expect(snap.ents[0]!.p.join(",")).toBe("360,40");
  });

  it("손님이 참가하면 방장 소켓이 state(2명) 다음에 그 손님의 한 점 world.move 를 받는다", async () => {
    const { code, token } = await createRoom("방장");
    const host = await connect(code);
    await hello(host, token);
    await nextFrame(host, isSnap);
    await nextFrame(host, (m) => m.t === "chatLog");
    const mk = mark(host);
    await joinOk(code, "손님");
    const state = await nextFrame(host, (m) => m.t === "state" && m.view.players.length === 2);
    expect(state.t).toBe("state");
    const move = (await nextFrame(host, isMove)) as MoveFrame;
    expect(move.s).toBe(1);
    expect(move.p.join(",")).toBe("40,360");
    const order = host.frames.slice(mk).map((f) => parse(f).t);
    expect(order.join(",")).toBe("state,world");
  });

  it("손님 hello 의 프레임 순서도 [state, snap] 이고 snap.ents 는 seat 0·1 둘이다", async () => {
    const { code, token } = await createRoom("방장");
    const guest = await joinOk(code, "손님");
    const host = await connect(code);
    await hello(host, token);
    const g = await connect(code);
    await hello(g, guest.token);
    const snap = (await nextFrame(g, isSnap)) as SnapFrame;
    expect(g.frames.slice(0, 2).map((f) => parse(f).t).join(",")).toBe("state,world");
    expect(snap.ents.map((e) => e.s).join(",")).toBe("0,1");
  });

  it("손님의 move 한 번은 방장·손님 소켓에 같은 world.move 로 가고 첫 점은 손님 위치, 끝 점은 목적지다", async () => {
    const s = await seat(1, 0);
    const guest = s.guests[0]!;
    send(guest.sock, { t: "move", x: 300, z: 100 });
    const onHost = (await nextFrame(s.host, isWalk(1))) as MoveFrame;
    const onGuest = (await nextFrame(guest.sock, isWalk(1))) as MoveFrame;
    expect(JSON.stringify(onHost)).toBe(JSON.stringify(onGuest));
    expect(onHost.p.slice(0, 2).join(",")).toBe("40,360");
    expect(onHost.p.slice(-2).join(",")).toBe("300,100");
    expect(onHost.v).toBe(180);
  });

  it("걸을 수 없는 무대 중심 옆 점을 누르면 끝 점이 걸을 수 있는 곳으로 보정된다(정확히 (0,0)은 무대 자리라 서버가 버린다, 08-04·08-09)", async () => {
    const s = await seat(1, 0);
    const guest = s.guests[0]!;
    send(guest.sock, { t: "move", x: 10, z: 0 });
    const f = (await nextFrame(s.host, isWalk(1))) as MoveFrame;
    const end = { x: f.p[f.p.length - 2]!, z: f.p[f.p.length - 1]! };
    expect(lineWalkable(BAR_MAP, end, end)).toBe(true);
  });

  it("같은 손님이 100ms 뒤 다시 보낸 move 는 어느 소켓에도 새 프레임도 오류도 만들지 않는다", async () => {
    const s = await seat(1, 0);
    const guest = s.guests[0]!;
    send(guest.sock, { t: "move", x: 300, z: 100 });
    await nextFrame(s.host, isWalk(1));
    await nextFrame(guest.sock, isWalk(1));
    const mh = mark(s.host);
    const mg = mark(guest.sock);
    await sleep(100);
    send(guest.sock, { t: "move", x: -300, z: 100 });
    await sleep(500);
    await settle(s.host, mh);
    await settle(guest.sock, mg);
    expect(worldsSince(s.host, mh).length).toBe(0);
    expect(worldsSince(guest.sock, mg).length).toBe(0);
    expect(errorsSince(guest.sock, mg).length).toBe(0);
  });

  it("160ms 뒤의 두 번째 move 는 새 프레임이 된다", async () => {
    const s = await seat(1, 0);
    const guest = s.guests[0]!;
    send(guest.sock, { t: "move", x: 300, z: 100 });
    await nextFrame(s.host, isWalk(1));
    await sleep(160);
    send(guest.sock, { t: "move", x: -300, z: 100 });
    const second = (await nextFrame(s.host, (m): m is MoveFrame => isWalk(1)(m) && m.p.slice(-2).join(",") === "-300,100")) as MoveFrame;
    expect(second.s).toBe(1);
  });

  it("hello 전 소켓의 move 는 아무 프레임도 만들지 않는다", async () => {
    const s = await seat(0, 0);
    const anon = await connect(s.code);
    await settle(s.host, 0); // hello 뒤 snap 이 아직 오는 중일 수 있어 먼저 비운다
    const mh = mark(s.host);
    const ma = mark(anon);
    send(anon, { t: "move", x: 300, z: 100 });
    const got = await settle(anon, ma);
    await settle(s.host, mh);
    expect(got.length).toBe(0);
    expect(worldsSince(s.host, mh).length).toBe(0);
  });

  it("형식이 틀린 move(소수·덧붙은 seat)는 기존 규칙대로 BAD_MESSAGE 다", async () => {
    const s = await seat(1, 0);
    const guest = s.guests[0]!;
    await settle(guest.sock, 0); // hello 뒤 snap 이 아직 오는 중일 수 있어 먼저 비운다
    const mk = mark(guest.sock);
    send(guest.sock, { t: "move", x: 1.5, z: 0 });
    send(guest.sock, { t: "move", x: 0, z: 0, seat: 1 });
    const got = await settle(guest.sock, mk);
    expect(got.map((m) => (m.t === "error" ? m.code : m.t)).join(",")).toBe("BAD_MESSAGE,BAD_MESSAGE");
  });
});

// ---- 저장·복원·퇴장·대기실 복귀 (MAP-05, MAP-01) ----

const endOf = (p: number[]): string => p.slice(-2).join(",");
const hasEnd = (w: Awaited<ReturnType<typeof worldOf>>, end: string): boolean => Object.values(w?.segs ?? {}).some((seg) => endOf(seg.p) === end);

/** 이 소켓이 지금까지 받은 world 프레임 수 */
const worldCount = (sock: TestSocket): number => sock.frames.filter((f) => parse(f).t === "world").length;

describe("위치 저장 — 별도 world 키, 2초 디바운스 (MAP-05)", () => {
  it("move 직후 storage world 는 아직 이전 값이고 타이머가 잡혀 있다. flush 뒤에는 compactWorld 모양으로 그 사람 구간이 들어 있다", async () => {
    const s = await seat(1, 0);
    await flushWorld(s.code);
    const before = JSON.stringify(await worldOf(s.code));
    send(s.guests[0]!.sock, { t: "move", x: 300, z: 100 });
    await nextFrame(s.host, isWalk(1));
    expect(JSON.stringify(await worldOf(s.code))).toBe(before);
    expect(await worldDirty(s.code)).toBe(true);
    await flushWorld(s.code);
    const after = await worldOf(s.code);
    expect(after?.v).toBe(1);
    expect(hasEnd(after, "300,100")).toBe(true);
    expect(await worldDirty(s.code)).toBe(false);
  });

  it("알람이 깨어나면 디바운스 중이던 위치를 먼저 저장한다", async () => {
    const s = await seat(1, 0);
    await flushWorld(s.code);
    send(s.guests[0]!.sock, { t: "move", x: 300, z: 100 });
    await nextFrame(s.host, isWalk(1));
    expect(hasEnd(await worldOf(s.code), "300,100")).toBe(false);
    expect(await runDurableObjectAlarm(env.ROOM.getByName(s.code))).toBe(true);
    expect(hasEnd(await worldOf(s.code), "300,100")).toBe(true);
  });

  it("마지막 연결된 사람의 소켓이 닫히면 디바운스 대기 중이던 world 가 즉시 저장된다", async () => {
    const s = await seat(1, 0);
    await flushWorld(s.code);
    send(s.guests[0]!.sock, { t: "move", x: 300, z: 100 });
    await nextFrame(s.host, isWalk(1));
    s.guests[0]!.sock.ws.close();
    await until("손님 끊김 반영", async () => (await storedRoom(s.code)).players.some((p) => (p as { connected?: boolean }).connected === false));
    expect(hasEnd(await worldOf(s.code), "300,100")).toBe(false);
    s.host.ws.close();
    await until("마지막 사람 끊김 저장", async () => hasEnd(await worldOf(s.code), "300,100"));
  });
});

describe("퇴거 복원 (MAP-05)", () => {
  it("이동 → flush → 퇴거 → 재접속 hello 의 snap 이 퇴거 전과 같은 위치(진행 중 구간 포함)다", async () => {
    const s = await seat(1, 0);
    const guest = s.guests[0]!;
    send(guest.sock, { t: "move", x: 300, z: 100 });
    const frame = (await nextFrame(s.host, isWalk(1))) as MoveFrame;
    await flushWorld(s.code);
    await evictDurableObject(env.ROOM.getByName(s.code));
    const g2 = await connect(s.code);
    send(g2, { t: "hello", token: guest.token });
    const snap = (await nextFrame(g2, isSnap)) as SnapFrame;
    const ent = snap.ents.find((e) => e.s === 1)!;
    const t = Date.now();
    const a = positionAt(ent, t);
    const b = positionAt({ p: frame.p, t0: frame.t0, v: frame.v }, t);
    expect(Math.abs(a.x - b.x)).toBeLessThan(0.001);
    expect(Math.abs(a.z - b.z)).toBeLessThan(0.001);
    expect(ent.t0).toBe(frame.t0);
  });

  it("storage 에 world 키가 없는 옛 방(room 키만)을 퇴거 뒤 깨우면 모든 사람이 입장 지점으로 복원된다", async () => {
    const s = await seat(1, 0);
    await flushWorld(s.code);
    await runInDurableObject(env.ROOM.getByName(s.code), async (_i, state) => {
      await state.storage.delete("world");
    });
    await evictDurableObject(env.ROOM.getByName(s.code));
    const g2 = await connect(s.code);
    send(g2, { t: "hello", token: s.guests[0]!.token });
    const snap = (await nextFrame(g2, isSnap)) as SnapFrame;
    expect(snap.ents.map((e) => `${e.s}:${e.p.join(",")}`).join("|")).toBe("0:360,40|1:40,360");
  });
});

describe("퇴장·내보내기·방 삭제 (MAP-01)", () => {
  it("손님이 나가면 즉시 저장된 world 와 이후 snap 에서 그 손님이 빠진다", async () => {
    const s = await seat(1, 0);
    await flushWorld(s.code);
    expect(Object.keys((await worldOf(s.code))!.segs).length).toBe(2);
    send(s.guests[0]!.sock, { t: "leave" });
    expect(await closed(s.guests[0]!.sock)).toBe("4003 left");
    await until("저장된 world 에서 손님 제거", async () => Object.keys((await worldOf(s.code))?.segs ?? {}).length === 1);
    const h2 = await connect(s.code);
    send(h2, { t: "hello", token: s.hostToken });
    const snap = (await nextFrame(h2, isSnap)) as SnapFrame;
    expect(snap.ents.map((e) => e.s).join(",")).toBe("0");
  });

  it("방장이 끊긴 손님을 내보내면 같다", async () => {
    const s = await seat(0, 1);
    await flushWorld(s.code);
    expect(Object.keys((await worldOf(s.code))!.segs).length).toBe(2);
    send(s.host, { t: "kick", seat: s.offline[0]!.seat });
    await until("저장된 world 에서 내보낸 사람 제거", async () => Object.keys((await worldOf(s.code))?.segs ?? {}).length === 1);
  });

  it("방장 혼자 나가 방이 지워지면 world 키도 없다", async () => {
    const s = await seat(0, 0);
    await flushWorld(s.code);
    expect(await worldOf(s.code)).toBeDefined();
    send(s.host, { t: "leave" });
    await until("world 키 삭제", async () => (await worldOf(s.code)) === undefined);
    expect(await worldDirty(s.code)).toBe(false);
  });
});

describe("테스트 방 봇 수·시작·대기실 복귀 (MAP-01)", () => {
  it("봇 3 → 방장 소켓에 state 다음 봇 seat 별 한 점 world.move 3개, 봇 1 로 줄이면 뺀 봇은 world 에서 지워진다", async () => {
    const s = await seat(0, 0, { testMode: true });
    await settle(s.host, 0);
    const mk = mark(s.host);
    send(s.host, { t: "testBots", count: 3 });
    const got = await settle(s.host, mk);
    const names = got.map((m) => (m.t === "world" ? `world.${m.k}` : m.t));
    expect(names.join(",")).toBe("state,world.move,world.move,world.move");
    const moves = got.filter(isMove);
    const seats = moves.map((m) => m.s).sort();
    expect(seats.join(",")).toBe("1,2,3");
    expect(moves.every((m) => m.p.length === 2)).toBe(true);

    send(s.host, { t: "testBots", count: 1 });
    await nextFrame(s.host, (m) => m.t === "state" && m.view.players.length === 2);
    await flushWorld(s.code);
    expect(Object.keys((await worldOf(s.code))!.segs).length).toBe(2);
  });

  it("게임 시작은 world 를 즉시 저장하고, 그 뒤로는 move 를 받아도 어느 소켓에도 world 프레임이 가지 않는다", async () => {
    const s = await seat(3, 0);
    await flushWorld(s.code);
    send(s.guests[0]!.sock, { t: "move", x: 300, z: 100 });
    await nextFrame(s.host, isWalk(1));
    expect(hasEnd(await worldOf(s.code), "300,100")).toBe(false);
    send(s.host, { t: "start" });
    await nextFrame(s.host, (m) => m.t === "state" && m.view.phase !== "lobby");
    await until("시작 때 즉시 저장", async () => hasEnd(await worldOf(s.code), "300,100"));
    const socks = [s.host, ...s.guests.map((g) => g.sock)];
    for (const sock of socks) await settle(sock, 0);
    const counts = socks.map(worldCount);
    send(s.guests[1]!.sock, { t: "move", x: -300, z: 100 });
    for (const sock of socks) await settle(sock, 0);
    expect(socks.map(worldCount).join(",")).toBe(counts.join(","));
  });

  it("테스트 리셋(대기실 복귀)은 모든 소켓이 state 다음 snap 을 받고 모든 사람이 입장 지점이다", async () => {
    const s = await seat(0, 0, { testMode: true });
    send(s.host, { t: "testBots", count: 3 });
    await nextFrame(s.host, (m) => m.t === "state" && m.view.players.length === 4);
    send(s.host, { t: "move", x: 300, z: 100 });
    await nextFrame(s.host, isWalk(0));
    send(s.host, { t: "start" });
    await nextFrame(s.host, (m) => m.t === "state" && m.view.phase !== "lobby");
    expect(lastViewOf(s.host).phase).not.toBe("lobby");
    const mk = mark(s.host);
    send(s.host, { t: "testReset" });
    const got = await settle(s.host, mk);
    const names = got.map((m) => (m.t === "world" ? `world.${m.k}` : m.t));
    expect(names.join(",")).toBe("state,world.snap");
    const snap = got.find(isSnap)!;
    expect(snap.ents.map((e) => `${e.s}:${e.p.join(",")}`).join("|")).toBe("0:360,40|1:40,360|2:540,220|3:-420,-120");
    await until("복귀 즉시 저장", async () => !hasEnd(await worldOf(s.code), "300,100"));
  });
});

// ---- 테스트 방 봇 로비 배회 (MAP-02, 결정 0024) ----

/** 테스트 방(방장 연결 + 봇 count). 방장 소켓이 봇 입장 프레임까지 받은 뒤다. */
async function botRoom(count = 3): Promise<Awaited<ReturnType<typeof seat>>> {
  const s = await seat(0, 0, { testMode: true });
  send(s.host, { t: "testBots", count });
  await nextFrame(s.host, (m) => m.t === "state" && m.view.players.length === count + 1);
  await settle(s.host, 0);
  return s;
}

/** 모든 봇의 wanderAt 을 지금으로 당긴다(저장하지 않는 인메모리 값이라 DO 안에서 직접 고친다). */
async function pullWanderDue(code: string): Promise<void> {
  await runInDurableObject(env.ROOM.getByName(code), async (instance) => {
    const room = instance["room"]!;
    const wanderAt: Record<string, number> = {};
    for (const p of room.players) if (p.isBot === true) wanderAt[p.id] = Date.now() - 1;
    instance["world"] = { ...instance["world"], wanderAt };
  });
}

describe("봇 로비 배회 (결정 0024)", () => {
  it("방장이 연결된 테스트 방에서 봇 wanderAt 이 되면 알람이 사람과 같은 규칙으로 봇의 world.move 를 보낸다", async () => {
    const s = await botRoom(3);
    await pullWanderDue(s.code);
    const mk = mark(s.host);
    expect(await runDurableObjectAlarm(env.ROOM.getByName(s.code))).toBe(true);
    const got = await settle(s.host, mk);
    const moves = got.filter(isMove);
    expect(moves.map((m) => m.s).sort().join(",")).toBe("1,2,3");
    for (const m of moves) {
      const end = { x: m.p[m.p.length - 2]!, z: m.p[m.p.length - 1]! };
      expect(lineWalkable(BAR_MAP, end, end)).toBe(true);
      expect(m.v).toBe(180);
    }
  });

  it("알람 시각은 방 만료와 가장 이른 wanderAt 의 최솟값이다", async () => {
    const s = await botRoom(3);
    const times = await wanderTimes(s.code);
    expect(times.length).toBe(3);
    const expiresAt = (await storedRoom(s.code)).expiresAt;
    expect(await alarmOf(s.code)).toBe(Math.min(expiresAt, ...times));
  });

  it("방장이 끊기면(연결된 사람 0) 배회 시각이 알람에 들어가지 않고 알람은 방 만료로 돌아간다", async () => {
    const s = await botRoom(3);
    s.host.ws.close();
    await until("방장 끊김 반영", async () => (await storedRoom(s.code)).players.some((p) => (p as { connected?: boolean; isBot?: boolean }).isBot !== true && (p as { connected?: boolean }).connected === false));
    const expiresAt = (await storedRoom(s.code)).expiresAt;
    await until("알람이 방 만료로", async () => (await alarmOf(s.code)) === expiresAt);
  });

  it("같은 봇의 wanderAt 을 연달아 당겨도 150ms 안에는 두 번째 프레임이 없다(특권 없음)", async () => {
    const s = await botRoom(1);
    await pullWanderDue(s.code);
    expect(await runDurableObjectAlarm(env.ROOM.getByName(s.code))).toBe(true);
    await nextFrame(s.host, isMove);
    const mk = mark(s.host);
    await pullWanderDue(s.code);
    expect(await runDurableObjectAlarm(env.ROOM.getByName(s.code))).toBe(true);
    const got = await settle(s.host, mk);
    expect(got.filter(isMove).length).toBe(0);
  });

  it("게임이 시작되면 봇은 배회하지 않고 world 프레임도 없다", async () => {
    const s = await botRoom(3);
    send(s.host, { t: "start" });
    await nextFrame(s.host, (m) => m.t === "state" && m.view.phase !== "lobby");
    const mk = mark(s.host);
    await pullWanderDue(s.code);
    await runDurableObjectAlarm(env.ROOM.getByName(s.code));
    const got = await settle(s.host, mk);
    expect(got.filter((m) => m.t === "world").length).toBe(0);
  });
});

// ---- 단계별 이동 (MAP-04, 결정 0060-6): 서버가 막는 표. 산 사람은 낮 시작·토론에서만, 유령은 모든 지도 단계에서 ----

type Game5 = Awaited<ReturnType<typeof startedGame>>;

/** 모든 소켓을 flush 해 소켓별 프레임을 돌려준다. 보낸 소켓(first)을 먼저 flush 한다 — 그 소켓의 pong 이 오면 보낸 메시지의 처리·전송이 끝났다는 증거다. */
async function settleAll(socks: TestSocket[], marks: number[], first: number): Promise<ServerMessage[][]> {
  const out: ServerMessage[][] = socks.map(() => []);
  for (const i of [first, ...socks.map((_, k) => k).filter((k) => k !== first)]) out[i] = await settle(socks[i]!, marks[i]!);
  return out;
}

/** 5명 판을 phase 단계로 옮긴다. 밤·아침은 실제 흐름으로, 지목·변론·찬반·처형은 저장 상태를 옮겨서(흐름 전환 전, 가정 A3) 들어간다. */
async function gameAt(phase: PhaseId): Promise<Game5> {
  if (phase === "night" || phase === "morning" || phase === "discussion") return startedGame(phase, 4);
  const g = await startedGame("discussion", 4);
  await toPhase(g.code, phase, (room) => ({ ...room, verdict: { passed: false, candidate: g.actors[1]!.seat } }));
  for (const sock of g.socks) await settle(sock, mark(sock));
  return g;
}

describe("단계별 이동 — 산 사람은 막히고 유령은 걷는다 (MAP-04, T-08-05)", () => {
  for (const phase of ["nomination", "defense", "verdict", "execution", "night", "morning"] as const) {
    it(`${phase}: 산 사람의 move 는 어느 소켓에도 world 프레임·오류가 없고, 유령의 move 는 유령 소켓에만 간다`, async () => {
      const g = await gameAt(phase);
      const marks = g.socks.map((sock) => mark(sock));
      const mover = g.actors.find((a) => a.role !== "mafia")!;
      send(mover.sock, { t: "move", x: 300, z: 100 });
      // 같은 단계의 채팅은 막히지 않는다. 저장 편집으로 옮긴 단계는 소켓의 마지막 view 가 낡아 단계 키를 저장된 방에서 읽는다.
      if (phase !== "night") chatSend(mover.sock, "움직이지 못해도 말은 해요", `${(await storedRoom(g.code)).day ?? 0}:${phase}`);
      const got = await settleAll(g.socks, marks, g.actors.indexOf(mover));
      expect(got.map((msgs) => msgs.filter((m) => m.t === "world" || m.t === "error").length).join(",")).toBe("0,0,0,0,0");
      if (phase !== "night") expect(got.map((msgs) => chatsOf(msgs).length).join(",")).toBe("1,1,1,1,1");

      // 같은 단계에서 두 사람이 유령이 되면 그 유령의 걸음은 다른 유령에게만 간다.
      const doomed = g.actors.filter((a) => a.role !== "mafia").slice(0, 2);
      const { ghosts, living } = await ghostsOf(g, doomed.map((a) => a.seat));
      const after = g.socks.map((sock) => mark(sock));
      send(ghosts[0]!.sock, { t: "move", x: -300, z: 100 });
      const seen = await settleAll(g.socks, after, g.actors.indexOf(ghosts[0]!));
      const moves = (a: (typeof g.actors)[number]): string => seen[g.actors.indexOf(a)]!.filter((m) => m.t === "world").map((m) => (m.t === "world" && m.k === "move" ? `move:${m.s}` : "other")).join(",");
      expect(moves(ghosts[1]!)).toBe(`move:${ghosts[0]!.seat}`);
      expect(living.map(moves).join("|")).toBe("||");
    }, 40_000);
  }

  it("discussion: 산 사람의 move 는 유령을 포함한 모든 소켓이 world.move 로 받는다", async () => {
    const g = await gameAt("discussion");
    const marks = g.socks.map((sock) => mark(sock));
    const mover = g.actors[1]!;
    send(mover.sock, { t: "move", x: 300, z: 100 });
    const got = await settleAll(g.socks, marks, g.actors.indexOf(mover));
    expect(got.map((msgs) => msgs.filter((m) => m.t === "world").length).join(",")).toBe("1,1,1,1,1");
  }, 40_000);

  it("dayAnnounce: 산 사람의 move 는 모든 소켓이 world.move 로 받는다", async () => {
    const s = await seat(3, 0);
    const socks = [s.host, ...s.guests.map((gst) => gst.sock)];
    send(s.host, { t: "start" });
    for (const sock of socks) await nextFrame(sock, (m) => m.t === "state" && m.view.phase === "assigning");
    await advanceTo(s.code, socks, "dayAnnounce");
    const marks = socks.map((sock) => mark(sock));
    send(s.guests[0]!.sock, { t: "move", x: 300, z: 100 });
    const got = await settleAll(socks, marks, 1);
    expect(got.map((msgs) => msgs.filter((m) => m.t === "world").length).join(",")).toBe("1,1,1,1");
  }, 30_000);

  it("assigning·roleReveal 에서는 산 사람의 move 가 막힌다", async () => {
    const s = await seat(3, 0);
    const socks = [s.host, ...s.guests.map((gst) => gst.sock)];
    send(s.host, { t: "start" });
    for (const sock of socks) await nextFrame(sock, (m) => m.t === "state" && m.view.phase === "assigning");
    let marks = socks.map((sock) => mark(sock));
    send(s.guests[0]!.sock, { t: "move", x: 300, z: 100 });
    let got = await settleAll(socks, marks, 1);
    expect(got.map((msgs) => msgs.filter((m) => m.t === "world").length).join(",")).toBe("0,0,0,0");
    await advanceTo(s.code, socks, "roleReveal");
    marks = socks.map((sock) => mark(sock));
    send(s.guests[0]!.sock, { t: "move", x: 300, z: 100 });
    got = await settleAll(socks, marks, 1);
    expect(got.map((msgs) => msgs.filter((m) => m.t === "world").length).join(",")).toBe("0,0,0,0");
  }, 30_000);
});

describe("무대 자리 (0,0) 입력 차단 (08-04 Threat Flag)", () => {
  it("로비에서 목적지가 정확히 무대 자리(0,0)인 move 는 조용히 버려지고, 옆 점은 받아들여진다", async () => {
    const s = await seat(1, 0);
    const guest = s.guests[0]!;
    await settle(s.host, 0); // 입장 때 늦게 오는 snap·chatLog 가 구간에 끼지 않게 먼저 비운다
    await settle(guest.sock, 0);
    const mk = [mark(s.host), mark(guest.sock)] as const;
    send(guest.sock, { t: "move", x: 0, z: 0 });
    const a = await settle(guest.sock, mk[1]);
    const b = await settle(s.host, mk[0]);
    expect(`${a.filter((m) => m.t === "world" || m.t === "error").length},${b.filter((m) => m.t === "world" || m.t === "error").length}`).toBe("0,0");
    const mk2 = mark(guest.sock);
    send(guest.sock, { t: "move", x: 10, z: 0 });
    await settle(guest.sock, mk2);
    expect(worldFramesOf(guest.sock, mk2).length).toBe(1);
  });
});
