// 06-08: 방 DO 의 로비 이동(MAP-02) — move 한 번이 서버 경로가 되어 연결된 모든 소켓에 같은 world.move 로 간다.
// 입장 위치(MAP-01)·hello 뒤 snap(MAP-05)·조용한 거절(UI-SPEC "서버가 막은 탭에 문구 없음")을 DO 밖에서 소켓으로 본다.
import { env } from "cloudflare:workers";
import { evictDurableObject, runDurableObjectAlarm, runInDurableObject } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import type { ServerMessage } from "../../shared/protocol";
import { BAR_MAP, lineWalkable } from "../../shared/game/map";
import { positionAt } from "../../shared/game/world";
import {
  closed,
  connect,
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
  until,
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
  it("방장 hello 의 프레임 순서는 [state, world.snap] 이고 snap 에 seat 0 이 입장 지점 한 점으로 있다", async () => {
    const { code, token } = await createRoom("방장");
    const host = await connect(code);
    await hello(host, token);
    const snap = (await nextFrame(host, isSnap)) as SnapFrame;
    const kinds = host.frames.slice(0, 2).map((f) => {
      const m = parse(f);
      return m.t === "world" ? `world.${m.k}` : m.t;
    });
    expect(kinds.join(",")).toBe("state,world.snap");
    expect(snap.ents.map((e) => e.s).join(",")).toBe("0");
    expect(snap.ents[0]!.p.join(",")).toBe("360,40");
  });

  it("손님이 참가하면 방장 소켓이 state(2명) 다음에 그 손님의 한 점 world.move 를 받는다", async () => {
    const { code, token } = await createRoom("방장");
    const host = await connect(code);
    await hello(host, token);
    await nextFrame(host, isSnap);
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

  it("걸을 수 없는 무대 중심을 누르면 끝 점이 걸을 수 있는 곳으로 보정된다", async () => {
    const s = await seat(1, 0);
    const guest = s.guests[0]!;
    send(guest.sock, { t: "move", x: 0, z: 0 });
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
