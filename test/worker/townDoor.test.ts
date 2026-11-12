// 20-02: 문을 지나는 순간을 서버가 알린다(D-14·D-15 의 와이어, D-16, D-22 — 위협 T-20-05·T-20-06·T-20-07·T-20-08).
// 떠나는 구역의 산 사람은 좌표 없는 사라짐(door vanish), 들어가는 구역의 산 사람은 그 구역 안 구간의 나타남(door appear),
// 넘은 본인은 새 구역 사람만 담긴 snap(zone) 을 받는다. 유령은 문 프레임 없이 전체 구간을 본다. 재접속 snap 도 구역으로 걸러진다.
// 실제 시간을 기다리지 않는다: 메모리 구간의 출발 시각을 앞당겨(passDoor) 문턱을 이미 지난 상태로 만들고 알람을 돌린다.
// 프레임은 걷기 요청 "전" 부터 모은다 — 문 통과를 내가 돌린 알람이 내든 제때 울린 알람이 내든 받는 프레임은 같다.
// 실패 출력은 한 줄이어야 해서(TAP) 프레임은 문자열로 비교한다.
import { env } from "cloudflare:workers";
import { evictDurableObject, runDurableObjectAlarm, runInDurableObject } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { TOWN_MAP, TOWN_ROOMS } from "../../shared/game/mapTown";
import { MOVE_V } from "../../shared/game/world";
import type { Segment, WorldState } from "../../shared/game/world";
import { nextCrossingAt, zoneOf } from "../../shared/game/zones";
import type { ServerMessage } from "../../shared/protocol";
import {
  alarmOf,
  connect,
  flushWorld,
  ghostsOf,
  hello,
  idOfSeat,
  mark,
  memWorld,
  moveAs,
  pause,
  placeSeats,
  settle,
  shiftSeg,
  startedGame,
  storedRoom,
  townGame,
  withRole,
  worldOf,
} from "./helpers";
import type { Actor, Game } from "./helpers";

type World = Extract<ServerMessage, { t: "world" }>;
type Snap = Extract<World, { k: "snap" }>;

const POST = TOWN_ROOMS.find((r) => r.id === "post")!;
/** 우체국 안의 또 다른 걷는 칸 중심(방 안 자리와 다른 곳). */
const POST_SIDE = { x: 75, z: -775 };
/** 광장 한가운데 근처의 걷는 자리(입장 지점 0). 우체국 문까지 걸어서 몇 초 걸린다. */
const PLAZA_SPOT = { x: 320, z: 180 };

const worlds = (msgs: ServerMessage[]): World[] => msgs.filter((m): m is World => m.t === "world");
/** 점 목록이 지나는 구역(중복 없이, 처음 나온 순서). */
function zonesOfPts(p: readonly number[]): string {
  const seen: string[] = [];
  for (let i = 0; i + 1 < p.length; i += 2) {
    const zone = zoneOf(TOWN_MAP, p[i]!, p[i + 1]!);
    if (!seen.includes(zone)) seen.push(zone);
  }
  return seen.join(">");
}
const endOf = (p: readonly number[]): string => `${p[p.length - 2]},${p[p.length - 1]}`;
/** 그 좌석의 문 프레임들을 한 줄로: "개수: vanish:post keys=d,e,k,s,t | appear:post [구역] end=x,z". 사라짐은 키 이름을 그대로 적는다(좌표 키가 없음을 보인다). */
function doorLine(msgs: ServerMessage[], seatNo: number): string {
  const doors = worlds(msgs).filter((f) => f.k === "door" && f.s === seatNo);
  const one = (f: World): string => {
    if (f.k !== "door") return "?";
    if (f.e === "vanish") return `vanish:${f.d} keys=${Object.keys(f).sort().join(",")}`;
    return `appear:${f.d} [${zonesOfPts(f.p)}] end=${endOf(f.p)}`;
  };
  return `${doors.length}: ${doors.map(one).join(" | ")}`;
}
/** 문 프레임 수(좌석 무관). */
const doorCount = (msgs: ServerMessage[]): number => worlds(msgs).filter((f) => f.k === "door").length;
/** zone 표시가 붙은 snap 들. */
const zoneSnaps = (msgs: ServerMessage[]): Snap[] => worlds(msgs).filter((f): f is Snap => f.k === "snap" && (f as { zone?: unknown }).zone === true);
/** snap 한 개를 한 줄로: "seats=0,2 others=[post]" — others 는 보는 사람(me) 말고 다른 좌석들의 점이 지나는 구역. */
function snapLine(f: Snap | undefined, me: number): string {
  if (f === undefined) return "none";
  const others = f.ents.filter((e) => e.s !== me).flatMap((e) => e.p);
  return `seats=${f.ents.map((e) => e.s).join(",")} others=[${zonesOfPts(others)}]`;
}
/** 그 좌석이 실린 world 프레임 수(move·door 의 s, snap 의 ents). "그 사람에 대해 아무것도 받지 않았다" 의 증명에 쓴다. */
const mentions = (msgs: ServerMessage[], seatNo: number): number =>
  worlds(msgs).filter((f) => (f.k === "snap" ? f.ents.some((e) => e.s === seatNo) : f.s === seatNo)).length;
/** 그 좌석의 move 프레임들: "개수: [구역] end=x,z". */
function moveLine(msgs: ServerMessage[], seatNo: number): string {
  const moves = worlds(msgs).filter((f) => f.k === "move" && f.s === seatNo);
  return `${moves.length}: ${moves.map((f) => (f.k === "move" ? `[${zonesOfPts(f.p)}] end=${endOf(f.p)}` : "?")).join(" | ")}`;
}
const seats = (...who: Actor[]): string => who.map((a) => a.seat).sort((x, y) => x - y).join(",");

interface Scene {
  g: Game;
  /** 걷는 산 사람 */
  a: Actor;
  /** 광장의 산 사람 */
  b: Actor;
  /** 우체국 안의 산 사람 */
  c: Actor;
  /** 탈락자(유령) */
  d: Actor;
  /** 그 밖의 산 사람(광장) */
  rest: Actor[];
  of: (frames: ServerMessage[][], who: Actor) => ServerMessage[];
}

/** 마을 토론 단계: 시민 한 명이 유령(d), 산 사람 a 는 aAt, b·나머지는 광장, c 는 우체국 안. 놓은 자리의 구역 기억도 맞춰져 있다(placeSeats). */
async function scene(aAt: { x: number; z: number }): Promise<Scene> {
  const g = await townGame("discussion");
  const d = withRole(g, "citizen")[0]!;
  const { living } = await ghostsOf(g, [d.seat]);
  const [a, b, c, ...rest] = living as [Actor, Actor, Actor, ...Actor[]];
  const spots: Record<number, { x: number; z: number }> = { [a.seat]: aAt, [b.seat]: PLAZA_SPOT, [c.seat]: POST_SIDE, [d.seat]: PLAZA_SPOT };
  for (const r of rest) spots[r.seat] = PLAZA_SPOT;
  await placeSeats(g.code, spots);
  return { g, a, b, c, d, rest, of: (frames, who) => frames[g.actors.indexOf(who)]! };
}

/** 메모리 구간을 직접 쓴다(걷기 요청 없이 — 알람이 따로 걸리지 않는다). agoMs 전에 출발한 것으로 둔다. 구역 기억은 건드리지 않는다. */
async function walkSeat(code: string, seatNo: number, p: number[], agoMs = 0): Promise<Segment> {
  const id = await idOfSeat(code, seatNo);
  const seg: Segment = { p, t0: Date.now() - agoMs, v: MOVE_V };
  await runInDurableObject(env.ROOM.getByName(code), (instance) => {
    const holder = instance as unknown as { world: WorldState };
    holder.world = { ...holder.world, segs: { ...holder.world.segs, [id]: seg } };
  });
  return seg;
}

/** 그 좌석의 다음 문 통과가 이미 지난 것으로 만든다(구간 출발을 앞당긴다). 통과가 없으면 던진다. */
async function passDoor(code: string, seatNo: number): Promise<void> {
  const seg = (await memWorld(code)).segs[await idOfSeat(code, seatNo)]!;
  const now = Date.now();
  const tc = nextCrossingAt(TOWN_MAP, seg, now);
  if (tc === null) throw new Error("passDoor: 넘을 문이 없다(이미 넘었거나 같은 구역 안 걷기)");
  await shiftSeg(code, seatNo, tc - now + 40);
}

/** 알람을 한 번 돌리고 모든 소켓을 flush 해 marks 이후의 프레임을 소켓별로 돌려준다. */
async function alarmAndCollect(g: Game, marks: number[]): Promise<ServerMessage[][]> {
  await runDurableObjectAlarm(env.ROOM.getByName(g.code));
  const out: ServerMessage[][] = [];
  for (let i = 0; i < g.socks.length; i++) out.push(await settle(g.socks[i]!, marks[i]!));
  return out;
}

/** 걷기 요청 → (보낸 쪽 flush) → 문턱을 지난 것으로 → 알람. 걷기 요청 전부터의 프레임을 돌려준다. */
async function walkThroughDoor(s: Scene, dest: { x: number; z: number }): Promise<ServerMessage[][]> {
  const marks = s.g.socks.map((k) => mark(k));
  moveAs(s.a, dest.x, dest.z);
  await settle(s.a.sock, mark(s.a.sock));
  await passDoor(s.g.code, s.a.seat);
  return alarmAndCollect(s.g, marks);
}

/** 새 소켓으로 다시 hello 하고 그 소켓이 받은 첫 world snap 을 돌려준다(예전 소켓은 서버가 닫는다). */
async function helloSnap(g: Game, who: Actor): Promise<Snap | undefined> {
  const sock = await connect(g.code);
  await hello(sock, who.token);
  return worlds(await settle(sock, 0)).find((f): f is Snap => f.k === "snap");
}

describe("문으로 들어가는 순간 (D-14·D-15·D-16, T-20-05·T-20-06)", () => {
  it("광장의 산 사람은 좌표 없는 사라짐 한 개, 방 안의 산 사람은 그 방 안 구간의 나타남 한 개를 받는다", { timeout: 60_000 }, async () => {
    const s = await scene(POST.front);
    const frames = await walkThroughDoor(s, POST.inside);
    const got = `${doorLine(s.of(frames, s.b), s.a.seat)} // ${doorLine(s.of(frames, s.c), s.a.seat)}`;
    expect(got).toBe(`1: vanish:post keys=d,e,k,s,t // 1: appear:post [post] end=${POST.inside.x},${POST.inside.z}`);
  });

  it("방 안의 산 사람이 들어온 사람에 대해 받은 것은 그 나타남 하나뿐이고, 광장의 산 사람이 받은 좌표는 모두 plaza 다", { timeout: 60_000 }, async () => {
    const s = await scene(POST.front);
    const frames = await walkThroughDoor(s, POST.inside);
    const others = [s.b, ...s.rest].map((who) => `${moveLine(s.of(frames, who), s.a.seat)} doors=${doorCount(s.of(frames, who))} snaps=${worlds(s.of(frames, who)).filter((f) => f.k === "snap").length}`);
    const got = `c:${mentions(s.of(frames, s.c), s.a.seat)} // ${[...new Set(others)].join(" ## ")}`;
    expect(got).toBe(`c:1 // 1: [plaza] end=${POST.inside.x},${POST.inner.z1} doors=1 snaps=0`);
  });

  it("넘은 본인은 zone snap 한 개를 받고 거기에는 본인과 그 방 사람만(방 안 좌표로) 실린다 — 문 프레임은 받지 않는다", { timeout: 60_000 }, async () => {
    const s = await scene(POST.front);
    const frames = await walkThroughDoor(s, POST.inside);
    const mine = s.of(frames, s.a);
    const snaps = zoneSnaps(mine);
    expect(`${snaps.length} ${snapLine(snaps[0], s.a.seat)} doors=${doorCount(mine)}`).toBe(`1 seats=${seats(s.a, s.c)} others=[post] doors=0`);
  });

  it("유령은 문 프레임·zone snap 을 받지 않고 들어가는 사람의 전체 구간을 받는다", { timeout: 60_000 }, async () => {
    const s = await scene(POST.front);
    const frames = await walkThroughDoor(s, POST.inside);
    const ghost = s.of(frames, s.d);
    expect(`doors=${doorCount(ghost)} zoneSnaps=${zoneSnaps(ghost).length} ${moveLine(ghost, s.a.seat)}`).toBe(`doors=0 zoneSnaps=0 1: [plaza>post] end=${POST.inside.x},${POST.inside.z}`);
  });

  it("넘기 전: 광장 먼 곳에서 방 안으로 걷기 시작한 직후(알람 전) 방 안의 산 사람은 그 사람에 대해 아무것도 받지 않는다", { timeout: 60_000 }, async () => {
    const s = await scene(PLAZA_SPOT);
    const marks = s.g.socks.map((k) => mark(k));
    moveAs(s.a, POST.inside.x, POST.inside.z);
    const out: ServerMessage[][] = [];
    for (const who of [s.a, ...s.g.actors.filter((x) => x !== s.a)]) out[s.g.actors.indexOf(who)] = await settle(who.sock, marks[s.g.actors.indexOf(who)]!);
    const seg = (await memWorld(s.g.code)).segs[await idOfSeat(s.g.code, s.a.seat)]!;
    const walking = zonesOfPts(seg.p) === "plaza>post" && (nextCrossingAt(TOWN_MAP, seg, Date.now()) ?? 0) > Date.now() + 1000;
    expect(`walking=${walking} c:${mentions(s.of(out, s.c), s.a.seat)} doors=${s.g.actors.map((who) => doorCount(s.of(out, who))).join("")} b:${moveLine(s.of(out, s.b), s.a.seat).replace(/ end=.*/, "")}`).toBe(
      "walking=true c:0 doors=000000 b:1: [plaza]",
    );
  });
});

describe("문으로 나오는 순간 (D-14·D-15)", () => {
  it("같은 방의 산 사람은 좌표 없는 사라짐, 광장의 산 사람은 광장 쪽 구간의 나타남, 본인은 광장 사람만 담긴 zone snap 을 받는다", { timeout: 60_000 }, async () => {
    const s = await scene(POST.inside);
    const frames = await walkThroughDoor(s, POST.front);
    const mine = s.of(frames, s.a);
    const got = [
      doorLine(s.of(frames, s.c), s.a.seat),
      doorLine(s.of(frames, s.b), s.a.seat),
      `${zoneSnaps(mine).length} ${snapLine(zoneSnaps(mine)[0], s.a.seat)} doors=${doorCount(mine)}`,
    ].join(" // ");
    expect(got).toBe(
      `1: vanish:post keys=d,e,k,s,t // 1: appear:post [plaza] end=${POST.front.x},${POST.front.z} // 1 seats=${seats(s.a, s.b, ...s.rest)} others=[plaza] doors=0`,
    );
  });

  it("방 안에 남은 산 사람이 나간 사람에 대해 받은 좌표는 모두 그 방 안이다(문턱 앞에서 끝나는 move 하나)", { timeout: 60_000 }, async () => {
    const s = await scene(POST.inside);
    const frames = await walkThroughDoor(s, POST.front);
    const roomMate = s.of(frames, s.c);
    expect(`${moveLine(roomMate, s.a.seat).replace(/ end=.*,/, " endZ=")} snaps=${worlds(roomMate).filter((f) => f.k === "snap").length}`).toBe(`1: [post] endZ=${POST.inner.z1 - 1} snaps=0`);
  });
});

describe("같은 알람에서 두 사람이 엇갈려 넘는다 (D-14)", () => {
  it("구역이 바뀐 두 사람은 문 프레임 대신 zone snap 을 받고, 바뀌지 않은 광장의 산 사람은 사라짐 하나·나타남 하나를 받는다", { timeout: 60_000 }, async () => {
    const s = await scene(POST.front);
    // a: 문 앞 → 방 안, c: 방 안 → 문 앞. 둘 다 2초 전에 출발한 구간을 직접 쓴다(이미 문턱을 지났고 구역 기억은 출발 구역 그대로다).
    await walkSeat(s.g.code, s.a.seat, [POST.front.x, POST.front.z, POST.inside.x, POST.inside.z], 2000);
    await walkSeat(s.g.code, s.c.seat, [POST_SIDE.x, POST_SIDE.z, POST.inside.x, POST.inside.z, POST.front.x, POST.front.z], 3000);
    const frames = await alarmAndCollect(s.g, s.g.socks.map((k) => mark(k)));
    const [mineA, mineC, seenB] = [s.of(frames, s.a), s.of(frames, s.c), s.of(frames, s.b)];
    const got = [
      `a: ${zoneSnaps(mineA).length} ${snapLine(zoneSnaps(mineA)[0], s.a.seat)} doors=${doorCount(mineA)}`,
      `c: ${zoneSnaps(mineC).length} ${snapLine(zoneSnaps(mineC)[0], s.c.seat)} doors=${doorCount(mineC)}`,
      `b: ${doorLine(seenB, s.a.seat)} ## ${doorLine(seenB, s.c.seat)}`,
      `ghost: ${worlds(s.of(frames, s.d)).length}`,
    ].join(" // ");
    expect(got).toBe(
      [
        `a: 1 seats=${seats(s.a)} others=[] doors=0`,
        `c: 1 seats=${seats(s.b, s.c, ...s.rest)} others=[plaza] doors=0`,
        `b: 1: vanish:post keys=d,e,k,s,t ## 1: appear:post [plaza] end=${POST.front.x},${POST.front.z}`,
        "ghost: 0",
      ].join(" // "),
    );
  });
});

describe("문 통과 시각의 알람과 구역 기억의 저장 (T-20-07·T-20-08)", () => {
  it("문을 지나는 길을 걷기 시작하면 알람이 그 통과 시각 이하로(단계 마감보다 이르게) 걸린다", { timeout: 60_000 }, async () => {
    const s = await scene(PLAZA_SPOT);
    moveAs(s.a, POST.inside.x, POST.inside.z);
    await settle(s.a.sock, mark(s.a.sock));
    const seg = (await memWorld(s.g.code)).segs[await idOfSeat(s.g.code, s.a.seat)]!;
    const tc = nextCrossingAt(TOWN_MAP, seg, seg.t0);
    const alarm = await alarmOf(s.g.code);
    const phaseEndsAt = (await storedRoom(s.g.code)).phaseEndsAt as number;
    expect(`${tc !== null && tc < phaseEndsAt} ${alarm !== null && tc !== null && alarm <= tc}`).toBe("true true");
  });

  it("이미 더 이른 알람이 걸려 있으면 다시 걸지 않는다(결정 0076)", { timeout: 60_000 }, async () => {
    const s = await scene(PLAZA_SPOT);
    const early = Date.now() + 2000;
    await runInDurableObject(env.ROOM.getByName(s.g.code), async (_i, state) => {
      await state.storage.setAlarm(early);
    });
    moveAs(s.a, POST.inside.x, POST.inside.z);
    await settle(s.a.sock, mark(s.a.sock));
    await pause(30);
    const seg = (await memWorld(s.g.code)).segs[await idOfSeat(s.g.code, s.a.seat)]!;
    const tc = nextCrossingAt(TOWN_MAP, seg, seg.t0);
    expect(`${tc !== null && tc > early} ${(await alarmOf(s.g.code)) === early}`).toBe("true true");
  });

  it("문을 지난 뒤 위치 저장에 구역 기억이 실린다", { timeout: 60_000 }, async () => {
    const s = await scene(POST.front);
    const id = await idOfSeat(s.g.code, s.a.seat);
    await flushWorld(s.g.code);
    const before = (await worldOf(s.g.code)) as unknown as { zones?: Record<string, string> };
    await walkThroughDoor(s, POST.inside);
    await flushWorld(s.g.code);
    const after = (await worldOf(s.g.code)) as unknown as { zones?: Record<string, string> };
    expect(`${before.zones?.[id]} > ${after.zones?.[id]}`).toBe("plaza > post");
  });

  it("저장 뒤 DO 가 내려갔다 다시 깨어나도(재시작) 알람이 놓친 문 통과를 낸다", { timeout: 60_000 }, async () => {
    const s = await scene(PLAZA_SPOT);
    const marks = s.g.socks.map((k) => mark(k));
    moveAs(s.a, POST.inside.x, POST.inside.z);
    await settle(s.a.sock, mark(s.a.sock));
    await flushWorld(s.g.code);
    await evictDurableObject(env.ROOM.getByName(s.g.code));
    await passDoor(s.g.code, s.a.seat);
    const frames = await alarmAndCollect(s.g, marks);
    const got = `${doorLine(s.of(frames, s.b), s.a.seat)} // ${doorLine(s.of(frames, s.c), s.a.seat).replace(/ end=.*/, "")} // ${zoneSnaps(s.of(frames, s.a)).length}`;
    expect(got).toBe("1: vanish:post keys=d,e,k,s,t // 1: appear:post [post] // 1");
  });
});

describe("재접속 snap 도 구역으로 걸러진다 (T-20-06)", () => {
  it("방 안을 걷다 밖으로 나갈 사람이 아직 방 안일 때: 광장 사람의 hello snap 에는 그 사람이 없고, 같은 방 사람의 hello snap 에는 방 안 구간만 있다", { timeout: 60_000 }, async () => {
    const s = await scene(POST.inside);
    // 방 안을 몇 번 오간 뒤 문으로 나가 광장까지 가는 길(나가는 순간은 몇 초 뒤다)
    const loop = [POST.inside, POST_SIDE, POST.inside, POST_SIDE, POST.inside, POST_SIDE, POST.inside, POST.front, PLAZA_SPOT].flatMap((q) => [q.x, q.z]);
    await walkSeat(s.g.code, s.a.seat, loop);
    const forPlaza = await helloSnap(s.g, s.b);
    const forRoom = await helloSnap(s.g, s.c);
    const aInRoom = forRoom?.ents.find((e) => e.s === s.a.seat);
    const got = [
      snapLine(forPlaza, s.b.seat),
      snapLine(forRoom, s.c.seat),
      aInRoom === undefined ? "none" : `walking=${aInRoom.p.length > 2} endZ=${aInRoom.p[aInRoom.p.length - 1]}`,
    ].join(" // ");
    expect(got).toBe(`seats=${seats(s.b, ...s.rest)} others=[plaza] // seats=${seats(s.a, s.c)} others=[post] // walking=true endZ=${POST.inner.z1 - 1}`);
  });

  it("유령의 hello snap 은 구역과 상관없이 모두의 전체 구간이다(결정 0021)", { timeout: 60_000 }, async () => {
    const s = await scene(POST.inside);
    const loop = [POST.inside, POST_SIDE, POST.inside, POST_SIDE, POST.inside, POST.front, PLAZA_SPOT].flatMap((q) => [q.x, q.z]);
    await walkSeat(s.g.code, s.a.seat, loop);
    const forGhost = await helloSnap(s.g, s.d);
    const aSeen = forGhost?.ents.find((e) => e.s === s.a.seat);
    expect(`${forGhost?.ents.length} ${aSeen === undefined ? "none" : zonesOfPts(aSeen.p)}`).toBe("6 post>plaza");
  });
});

describe("심부름 단계에는 문 프레임이 없다 (D-17 의 바탕 — 근처 snap 은 20-03)", () => {
  it("심부름 중에 문을 지나도 누구에게도 door 프레임·zone snap 이 가지 않는다", { timeout: 60_000 }, async () => {
    const g = await townGame("errand");
    const a = g.actors.find((x) => x.seat === 0)!;
    await placeSeats(g.code, Object.fromEntries(g.actors.map((x) => [x.seat, x === a ? POST.front : PLAZA_SPOT])));
    await walkSeat(g.code, a.seat, [POST.front.x, POST.front.z, POST.inside.x, POST.inside.z], 2000);
    const frames = await alarmAndCollect(g, g.socks.map((k) => mark(k)));
    const zone = (await memWorld(g.code)).zones?.[await idOfSeat(g.code, a.seat)];
    expect(`doors=${frames.map(doorCount).join("")} zoneSnaps=${frames.map((f) => zoneSnaps(f).length).join("")} memory=${zone}`).toBe("doors=000000 zoneSnaps=000000 memory=post");
  });
});

describe("방이 없는 맵은 그대로다 — 재즈 바 판에는 문 프레임·zone 표시·구역 기억이 없다 (D-04)", () => {
  it("재즈 바에서 도는 판에서 같은 걷기와 알람을 해도 모든 소켓의 world 프레임에 door·zone 이 0개이고 저장에도 zones 가 없다", { timeout: 60_000 }, async () => {
    const g = await startedGame("discussion", 3);
    const a = g.actors.find((x) => x.seat === 0)!;
    const marks = g.socks.map((k) => mark(k));
    moveAs(a, POST.front.x, POST.front.z);
    await settle(a.sock, mark(a.sock));
    await pause(160);
    moveAs(a, POST.inside.x, POST.inside.z);
    await settle(a.sock, mark(a.sock));
    await shiftSeg(g.code, a.seat, 5000);
    const frames = await alarmAndCollect(g, marks);
    await flushWorld(g.code);
    const stored = (await worldOf(g.code)) as unknown as Record<string, unknown>;
    const snap = await helloSnap(g, g.actors[1]!);
    const got = `moves>0=${frames.every((f) => worlds(f).some((w) => w.k === "move"))} doors=${frames.map(doorCount).join("")} zoneKeys=${frames.map((f) => worlds(f).filter((w) => "zone" in w).length).join("")} stored=${"zones" in stored} mem=${"zones" in (await memWorld(g.code))} helloZone=${snap !== undefined && "zone" in snap} helloSeats=${snap?.ents.length}`;
    expect(got).toBe("moves>0=true doors=0000 zoneKeys=0000 stored=false mem=false helloZone=false helloSeats=4");
  });
});
