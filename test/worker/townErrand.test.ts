// 20-03: 마을의 심부름 근처 snap·목격 기록·마지막 목격은 같은 구역 사람만 담는다(D-17·D-18, 위협 T-20-10),
// 밤·아침 순간이동 뒤에는 구역 기억을 알림 없이 맞춘다(settleZones, T-20-11) — 워커 통합 시험.
// 위치는 메모리의 world 에 직접 쓰고(placeSeats) 표본 알람은 errandTickAt 을 과거로 당겨 돌린다. 실제 시간을 기다리지 않는다:
// 걷는 구간의 표본은 구간을 쓰는 호출 안에서 알람 본문을 바로 돌리고(sampleWalking), 문 통과는 구간 출발을 앞당긴다(passDoor).
// 실패 출력은 한 줄이어야 해서(TAP) 프레임은 문자열로 비교한다.
import { env } from "cloudflare:workers";
import { runDurableObjectAlarm, runInDurableObject } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { TOWN_ROOMS } from "../../shared/game/mapTown";
import { MOVE_V } from "../../shared/game/world";
import type { WorldState } from "../../shared/game/world";
import type { ServerMessage } from "../../shared/protocol";
import {
  actorOf,
  advanceTo,
  alarmAndCollect,
  connect,
  doorCount,
  flushWorld,
  hello,
  idOfSeat,
  lastViewOf,
  mark,
  memWorld,
  passDoor,
  placeSeats,
  settle,
  snapLine,
  storedRoom,
  townGame,
  worldsIn,
  writeRoomEdit,
  zoneSnaps,
  zonesOfPts,
} from "./helpers";
import type { Actor, Game } from "./helpers";

type Snap = Extract<ServerMessage, { t: "world"; k: "snap" }>;
interface StoredPlayer { id: string; seat: number; errandPlaces?: string[]; errandDone?: string[]; errandNear?: number[]; errandSeen?: Array<{ seat: number; place: string }> }

const POST = TOWN_ROOMS.find((r) => r.id === "post")!;
/** 우체국 안, 문 바로 안쪽의 걷는 칸 중심. */
const IN_DOOR = { x: -25, z: -725 };
/** 우체국 문 밖 1.0 앞(문 앞 목적지). IN_DOOR 와 1.5 떨어져 있다 — 근처 반경 3.0 안이다. */
const OUT_DOOR = POST.front;
/** 우체국 안쪽 깊은 걷는 칸 중심(편지 장소 자리). IN_DOOR 와 1.8 떨어져 있다. */
const IN_DEEP = { x: 75, z: -875 };
/** 좌석 0 = 우체국 안 문 옆(A), 1 = 문 밖(B), 2 = 우체국 안 깊은 곳(C), 3~5 = 서로도 근처가 아닌 광장 먼 곳. */
const SPREAD = { 0: IN_DOOR, 1: OUT_DOOR, 2: IN_DEEP, 3: { x: 320, z: 180 }, 4: { x: -420, z: 380 }, 5: { x: 520, z: 520 } };

const snapsOf = (msgs: ServerMessage[]): Snap[] => worldsIn(msgs).filter((f): f is Snap => f.k === "snap");
const playersOf = async (code: string): Promise<StoredPlayer[]> => ((await storedRoom(code)) as unknown as { players: StoredPlayer[] }).players;

/** 표본 알람 한 번(evict 없이)과 그 동안 소켓마다 받은 프레임(g.actors 순서). */
async function sample(g: Game): Promise<ServerMessage[][]> {
  const marks = g.socks.map((k) => mark(k));
  await writeRoomEdit(env.ROOM.getByName(g.code), (room) => ({ ...room, errandTickAt: Date.now() - 1 }));
  return alarmAndCollect(g, marks);
}

/**
 * 그 좌석을 0.1초 전에 출발한 구간 p 로 걷게 하고 같은 호출 안에서 표본 알람 본문을 돌린다 — 구간을 쓴 시각과 표본 시각 사이에 실제 시간이 끼지 않는다
 * (시험이 느리게 돌아도 표본 때 그 사람은 출발점에서 0.1초 걸은 자리다).
 */
async function sampleWalking(g: Game, seatNo: number, p: number[]): Promise<ServerMessage[][]> {
  const marks = g.socks.map((k) => mark(k));
  const id = await idOfSeat(g.code, seatNo);
  await runInDurableObject(env.ROOM.getByName(g.code), async (instance, state) => {
    const holder = instance as unknown as { world: WorldState; room: Record<string, unknown>; alarm: () => Promise<void> };
    const now = Date.now();
    holder.world = { ...holder.world, segs: { ...holder.world.segs, [id]: { p, t0: now - 100, v: MOVE_V } } };
    holder.room = { ...holder.room, errandTickAt: now - 1 };
    await state.storage.put("room", holder.room);
    await holder.alarm();
  });
  const out: ServerMessage[][] = [];
  for (let i = 0; i < g.socks.length; i++) out.push(await settle(g.socks[i]!, marks[i]!));
  return out;
}

/** 새 소켓으로 다시 hello 하고 그 소켓이 받은 첫 world snap 을 돌려준다(예전 소켓은 서버가 닫는다). */
async function helloSnap(g: Game, who: Actor): Promise<Snap | undefined> {
  const sock = await connect(g.code);
  await hello(sock, who.token);
  return snapsOf(await settle(sock, 0))[0];
}

const of = (g: Game, frames: ServerMessage[][], who: Actor): ServerMessage[] => frames[g.actors.indexOf(who)]!;

describe("심부름 근처 snap 은 같은 구역만 싣는다 (D-17, T-20-10)", () => {
  it("표본 알람: 우체국 안 사람의 근처 snap 에 문 밖 좌석이 없고 같은 방 좌석이 있다 — 문 밖 사람은 본인뿐이다", { timeout: 60_000 }, async () => {
    const g = await townGame("errand");
    await placeSeats(g.code, SPREAD);
    const frames = await sample(g);
    const line = (seatNo: number): string => {
      const snap = snapsOf(of(g, frames, actorOf(g, seatNo))).at(-1);
      return `${seatNo}: ${snapLine(snap, seatNo)} near=${snap?.near}`;
    };
    expect([0, 1, 2].map(line).join(" | ")).toBe("0: seats=0,2 others=[post] near=true | 1: seats=1 others=[] near=true | 2: seats=0,2 others=[post] near=true");
  });

  it("문을 지나 나가는 같은 방 사람의 구간은 방 안에서 끝나게 잘려 온다 — 문턱 뒤 좌표는 가지 않는다", { timeout: 60_000 }, async () => {
    const g = await townGame("errand");
    await placeSeats(g.code, SPREAD);
    // C: 안쪽 깊은 곳 → 방 안 자리 → 문 앞. 문턱까지 2.5 라 근처 구간 길이(1.5초 = 2.7)가 문턱을 넘는다.
    const frames = await sampleWalking(g, 2, [IN_DEEP.x, IN_DEEP.z, POST.inside.x, POST.inside.z, POST.front.x, POST.front.z]);
    const snap = snapsOf(of(g, frames, actorOf(g, 0))).at(-1);
    const walker = snap?.ents.find((e) => e.s === 2);
    const outside = snapsOf(of(g, frames, actorOf(g, 1))).at(-1);
    expect(`${snapLine(snap, 0)} endZ=${walker?.p.at(-1)} // ${snapLine(outside, 1)}`).toBe(`seats=0,2 others=[post] endZ=${POST.inner.z1 - 1} // seats=1 others=[]`);
  });

  it("심부름 중 재접속 snap 도 같은 구역만 싣는다", { timeout: 60_000 }, async () => {
    const g = await townGame("errand");
    await placeSeats(g.code, SPREAD);
    const inside = await helloSnap(g, actorOf(g, 0));
    const outside = await helloSnap(g, actorOf(g, 1));
    expect(`${snapLine(inside, 0)} near=${inside?.near} // ${snapLine(outside, 1)} near=${outside?.near}`).toBe("seats=0,2 others=[post] near=true // seats=1 others=[] near=true");
  });
});

describe("목격 기록·마지막 목격은 같은 구역 사람만 적는다 (D-18)", () => {
  it("벽 너머 사람은 errandSeen·errandLast 에 오르지 않고, 토론의 me.record 에도 그 좌석 줄이 없다", { timeout: 60_000 }, async () => {
    const g = await townGame("errand");
    await placeSeats(g.code, SPREAD);
    await sample(g);
    await sample(g);
    const players = await playersOf(g.code);
    const seen = (seatNo: number): string => JSON.stringify(players.find((p) => p.seat === seatNo)!.errandSeen ?? []);
    const last = JSON.stringify(((await storedRoom(g.code)) as unknown as { errandLast?: unknown }).errandLast ?? []);
    expect(`${seen(0)} ${seen(1)} ${seen(2)} last=${last}`).toBe(
      '[{"seat":2,"place":"mail"}] [] [{"seat":0,"place":"mail"}] last=[{"seat":0,"by":2,"place":"mail"},{"seat":2,"by":0,"place":"mail"}]',
    );

    // 좌석 0(방 안)·1(문 밖)이 심부름 3곳을 마친 것으로 두고 토론으로 넘긴다 — 둘 다 me.record 를 받는다.
    const done = ["mail", "clock", "bench"];
    await writeRoomEdit(env.ROOM.getByName(g.code), (room) => ({
      ...room,
      players: (room.players as StoredPlayer[]).map((p) => (p.seat <= 1 ? { ...p, errandPlaces: done, errandDone: done } : p)),
    }));
    await advanceTo(g.code, g.socks, "discussion");
    for (const x of g.actors) await settle(x.sock, 0);
    const record = (seatNo: number): string => JSON.stringify(lastViewOf(actorOf(g, seatNo).sock).me.record);
    expect(`${record(0)} ${record(1)}`).toBe('[{"seat":2,"place":"mail"}] []');
  });
});

/**
 * 마을 토론에서 좌석 0·2 를 우체국 안에 세운 채(토론이 끝난 자리 = 우체국 안) 지목으로 넘기고, 둘이 모이는 길에 문을 지나 광장으로 나온 것까지 알린다.
 * 그 뒤 밤이 되면 둘은 우체국 안 자리로 순간이동한다 — 구역 기억(광장)과 새 자리(우체국)가 어긋난 채다.
 */
async function gatheredFromPost(): Promise<Game> {
  const g = await townGame("discussion");
  await placeSeats(g.code, SPREAD);
  await flushWorld(g.code);
  await advanceTo(g.code, g.socks, "nomination");
  await passDoor(g.code, 0);
  await passDoor(g.code, 2);
  await alarmAndCollect(g, g.socks.map((k) => mark(k)));
  await flushWorld(g.code);
  return g;
}
const memoOf = async (g: Game, seatNo: number): Promise<string> => String((await memWorld(g.code)).zones?.[await idOfSeat(g.code, seatNo)]);

describe("밤·아침 순간이동 뒤 구역 기억 (settleZones, T-20-11)", () => {
  it("밤: 광장에서 우체국 안 자리로 옮겨진 사람은 snap 을 한 번만 받고(zone snap 이 따로 가지 않는다) 구역 기억이 새 자리로 맞춰진다", { timeout: 90_000 }, async () => {
    const g = await gatheredFromPost();
    const before = `${await memoOf(g, 0)},${await memoOf(g, 2)}`;
    const marks = g.socks.map((k) => mark(k));
    await advanceTo(g.code, g.socks, "night");
    const frames: ServerMessage[][] = [];
    for (let i = 0; i < g.socks.length; i++) frames.push(await settle(g.socks[i]!, marks[i]!));
    const moved = of(g, frames, actorOf(g, 0));
    const got = `before=${before} snaps=${snapsOf(moved).length} zoneSnaps=${zoneSnaps(moved).length} doors=${frames.map(doorCount).join("")} memory=${await memoOf(g, 0)},${await memoOf(g, 2)}`;
    expect(got).toBe("before=plaza,plaza snaps=1 zoneSnaps=0 doors=000000 memory=post,post");
  });

  it("아침: 우체국 안에서 깨어난 사람은 밖의 산 사람의 아침 snap 에 없고, 그 사람의 아침 snap 에는 같은 방 사람만 있다 — 문 프레임은 없다", { timeout: 90_000 }, async () => {
    const g = await gatheredFromPost();
    await advanceTo(g.code, g.socks, "night");
    for (const k of g.socks) await settle(k, mark(k));
    await flushWorld(g.code);
    const marks = g.socks.map((k) => mark(k));
    await advanceTo(g.code, g.socks, "morning");
    // 아침 진입 뒤 알람을 한 번 더 돌린다 — 구역 기억이 어긋나 있으면 이때 문 프레임이 나간다.
    await runDurableObjectAlarm(env.ROOM.getByName(g.code));
    const frames: ServerMessage[][] = [];
    for (let i = 0; i < g.socks.length; i++) frames.push(await settle(g.socks[i]!, marks[i]!));
    const line = (seatNo: number): string => {
      const snaps = snapsOf(of(g, frames, actorOf(g, seatNo)));
      return `${seatNo}: ${snaps.length} ${snapLine(snaps.at(-1), seatNo)}`;
    };
    const coords = of(g, frames, actorOf(g, 1)).flatMap((m) => (m.t === "world" && m.k === "snap" ? m.ents.filter((e) => e.s !== 1).flatMap((e) => e.p) : []));
    const got = `${[0, 1, 2].map(line).join(" | ")} outsideSaw=[${zonesOfPts(coords)}] doors=${frames.map(doorCount).join("")} zoneSnaps=${frames.map((f) => zoneSnaps(f).length).join("")}`;
    expect(got).toBe("0: 1 seats=0,2 others=[post] | 1: 1 seats=1,3,4,5 others=[plaza] | 2: 1 seats=0,2 others=[post] outsideSaw=[plaza] doors=000000 zoneSnaps=000000");
  });
});
