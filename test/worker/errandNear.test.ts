// 심부름 근처 snap·표본 알람·목격 기록 워커 통합 시험 (15-02, D-02·D-04·D-08, 위협 T-15-05~08).
// 산 사람은 반경 안 사람의 위치만 받는다 — 반경 밖 좌표는 네트워크로도 가지 않는다("오지 않았음" 은 settle 로 증명한다).
// 위치는 메모리의 world 에 직접 쓰고(evict 없이) 표본 알람은 errandTickAt 을 과거로 당겨 돌린다. 실패 출력은 한 줄이어야 해서(TAP) 프레임은 문자열로 비교한다.
import { env } from "cloudflare:workers";
import { runDurableObjectAlarm, runInDurableObject } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { ERRAND_NEAR_R, ERRAND_TICK_MS, ERRAND_VIEW_HORIZON_MS } from "../../shared/game/phases";
import { MOVE_V, restSegment } from "../../shared/game/world";
import type { Segment, WorldState } from "../../shared/game/world";
import type { ServerMessage } from "../../shared/protocol";
import {
  actorsOf,
  advanceTo,
  alarmOf,
  connect,
  killSeats,
  lastViewOf,
  mark,
  nextFrame,
  observe,
  seat,
  send,
  settle,
  startedGame,
  storedRoom,
  worldFramesOf,
  writeRoomEdit,
  flushWorld,
} from "./helpers";
import type { Actor, Game } from "./helpers";

type SnapFrame = Extract<ServerMessage, { t: "world"; k: "snap" }>;
interface StoredPlayer { id: string; seat: number; errandPlaces?: string[]; errandDone?: string[]; errandNear?: number[]; errandSeen?: Array<{ seat: number; place: string }> }

const R = ERRAND_NEAR_R * 100;
const GLASS = { x: -390, z: -220 }; // 재즈 바 glass 장소 중앙(좌표는 map.ts BAR_PLACES)
const SPOTS = { near: { x: -370, z: -220 }, far: { x: 520, z: 500 }, far2: { x: 520, z: -60 }, far3: { x: -40, z: 260 }, far4: { x: -60, z: -560 } };

const playersOf = async (code: string): Promise<StoredPlayer[]> => ((await storedRoom(code)) as unknown as { players: StoredPlayer[] }).players;
const idOfSeat = async (code: string, seatNo: number): Promise<string> => (await playersOf(code)).find((p) => p.seat === seatNo)!.id;
const actorOf = (g: Game, seatNo: number): Actor => g.actors.find((a) => a.seat === seatNo)!;

async function writeSegments(code: string, segs: Record<string, Segment>): Promise<void> {
  await runInDurableObject(env.ROOM.getByName(code), (instance) => {
    const holder = instance as unknown as { world: WorldState };
    holder.world = { ...holder.world, segs: { ...holder.world.segs, ...segs } };
  });
}

/** 좌석 → 고정소수점 위치(서 있는 한 점)로 메모리 world 를 정한다. */
async function placeSeats(code: string, bySeat: Record<number, { x: number; z: number }>): Promise<void> {
  const segs: Record<string, Segment> = {};
  for (const [s, pos] of Object.entries(bySeat)) segs[await idOfSeat(code, Number(s))] = restSegment(pos.x, pos.z, Date.now());
  await writeSegments(code, segs);
}

/** 표본 알람 한 번: errandTickAt 을 과거로 당기고 알람을 evict 없이 돌린다. */
async function tickNow(code: string): Promise<void> {
  const stub = env.ROOM.getByName(code);
  await writeRoomEdit(stub, (room) => ({ ...room, errandTickAt: Date.now() - 1 }));
  await runDurableObjectAlarm(stub);
}

/** startedGame 은 dayAnnounce 를 지나 목표 단계로 가므로, 낮 시작에서 멈춘 판은 여기서 만든다(errand 로 들어오는 전환을 시험이 직접 일으키려고). */
async function startedAtDayAnnounce(): Promise<Game> {
  const room = await seat(5, 0);
  const socks = [room.host, ...room.guests.map((x) => x.sock)];
  send(room.host, { t: "start" });
  for (const sock of socks) await nextFrame(sock, (m) => m.t === "state" && m.view.phase === "assigning");
  await advanceTo(room.code, socks, "dayAnnounce");
  for (const sock of socks) await settle(sock, mark(sock));
  return { code: room.code, socks, actors: actorsOf(room) };
}

const snapsOf = (msgs: ServerMessage[]): SnapFrame[] => msgs.filter((m): m is SnapFrame => m.t === "world" && m.k === "snap");
const seatsOfSnap = (f: SnapFrame | undefined): string => (f === undefined ? "none" : f.ents.map((e) => e.s).sort((a, b) => a - b).join(","));
const SIX_SPREAD = { 0: GLASS, 1: SPOTS.near, 2: SPOTS.far, 3: SPOTS.far2, 4: SPOTS.far3, 5: SPOTS.far4 };

/** 한 표본을 돌리고 소켓마다 그 동안 받은 프레임을 좌석 순서로 돌려준다. */
async function sample(g: Game): Promise<ServerMessage[][]> {
  const marks = g.actors.map((a) => mark(a.sock));
  await tickNow(g.code);
  const out: ServerMessage[][] = [];
  for (const [i, a] of g.actors.entries()) out[i] = await settle(a.sock, marks[i]!);
  return out;
}

describe("표본 알람의 근처 snap (D-02, T-15-05·06)", () => {
  it("산 사람마다 본인 + 근처만 받는다: 반경 밖 좌석은 어떤 프레임에도 없고, 모든 소켓의 snap 모양이 같다", async () => {
    const g = await startedGame("errand");
    await placeSeats(g.code, SIX_SPREAD);
    const got = await sample(g);
    const seatsBy = g.actors.map((a, i) => `${a.seat}:${seatsOfSnap(snapsOf(got[i]!).at(-1))}`);
    expect(seatsBy.join("|")).toBe(g.actors.map((a) => `${a.seat}:${a.seat === 0 || a.seat === 1 ? "0,1" : a.seat}`).join("|"));
    for (const [i, a] of g.actors.entries()) {
      const snap = snapsOf(got[i]!).at(-1)!;
      expect(snap.near).toBe(true);
      expect(Object.keys(snap).sort().join(",")).toBe("at,ents,k,near,t");
      // 반경 밖 좌표 부재: 다른 좌석이 한 번이라도 ents 에 들어 있으면 그 소켓이 그 좌석의 좌표를 안다
      for (const f of snapsOf(got[i]!)) expect(f.ents.filter((e) => e.s !== a.seat && !(a.seat <= 1 && e.s <= 1)).length).toBe(0);
    }
  }, 30_000);

  it("근처 사람의 구간은 지금부터 잘려 와서 목적지 좌표가 반경 밖을 알리지 않는다", async () => {
    const g = await startedGame("errand");
    await placeSeats(g.code, SIX_SPREAD);
    const farEnd = SPOTS.far;
    const id1 = await idOfSeat(g.code, 1);
    // seat 1 은 seat 0 근처에서 먼 곳 하나로 길게 걷는 중(지금은 근처)
    await writeSegments(g.code, { [id1]: { p: [SPOTS.near.x, SPOTS.near.z, farEnd.x, farEnd.z], t0: Date.now(), v: MOVE_V } });
    const got = await sample(g);
    const snap = snapsOf(got[g.actors.indexOf(actorOf(g, 0))]!).at(-1)!;
    const seg1 = snap.ents.find((e) => e.s === 1)!;
    expect(seg1).toBeDefined();
    expect(seg1.v).toBe(MOVE_V);
    const last = seg1.p.slice(-2);
    expect(`${last[0]},${last[1]}`).not.toBe(`${farEnd.x},${farEnd.z}`);
    // 길이는 horizon 만큼(v × 1.5초 = 270)이고 처음은 그 순간 위치 근처
    const len = Math.hypot(last[0]! - seg1.p[0]!, last[1]! - seg1.p[1]!);
    expect(Math.abs(len - (MOVE_V * ERRAND_VIEW_HORIZON_MS) / 1000)).toBeLessThanOrEqual(2);
  }, 30_000);

  it("반경에 들어온 사람이 나타나고 나간 사람이 빠진다 · errandTickAt 이 +1초로 옮겨지고 방 알람이 그 시각으로 걸린다", async () => {
    const g = await startedGame("errand");
    await placeSeats(g.code, SIX_SPREAD);
    let got = await sample(g);
    const a0 = g.actors.indexOf(actorOf(g, 0));
    expect(seatsOfSnap(snapsOf(got[a0]!).at(-1))).toBe("0,1");
    // seat 2 가 들어오고 seat 1 이 나간다
    await placeSeats(g.code, { 1: SPOTS.far3, 2: { x: GLASS.x + R, z: GLASS.z } });
    got = await sample(g);
    expect(seatsOfSnap(snapsOf(got[a0]!).at(-1))).toBe("0,2");
    const room = (await storedRoom(g.code)) as unknown as { errandTickAt: number; phaseEndsAt: number };
    expect(room.errandTickAt).toBeGreaterThan(Date.now() - 5000);
    expect(room.errandTickAt).toBeLessThanOrEqual(Date.now() + ERRAND_TICK_MS);
    expect(await alarmOf(g.code)).toBe(Math.min(room.errandTickAt, room.phaseEndsAt));
  }, 30_000);
});

describe("산 사람의 move 는 본인과 유령에게만 간다 (T-15-05)", () => {
  it("산 A 가 걸으면 A 본인은 world.move 를 받고 다른 산 사람 소켓은 world 프레임이 0개, 유령은 받는다", async () => {
    const g = await startedGame("errand");
    await placeSeats(g.code, SIX_SPREAD);
    await killSeats(g, [5]); // 유령 한 명
    await placeSeats(g.code, SIX_SPREAD);
    const a = actorOf(g, 0);
    const ghost = actorOf(g, 5);
    const marks = g.actors.map((x) => mark(x.sock));
    const got = await observe(g, a, () => send(a.sock, { t: "move", x: -390, z: 20 }));
    const worldKinds = (i: number): string => worldFramesOf(g.actors[i]!.sock, marks[i]!).map((m) => `${m.k}${m.k === "move" ? m.s : ""}`).join(",");
    expect(worldKinds(g.actors.indexOf(a))).toBe("move0");
    expect(worldKinds(g.actors.indexOf(ghost))).toBe("move0");
    for (const x of g.actors.filter((y) => y !== a && y !== ghost)) expect(worldKinds(g.actors.indexOf(x))).toBe("");
    expect(got.length).toBe(g.actors.length);
  }, 30_000);
});

describe("목격 기록 (D-04)", () => {
  it("서로 근처인 두 사람은 표본을 거듭해도 줄이 하나씩, 나갔다 들어오면 새 줄 · 토론에서 3곳을 마친 사람만 me.record 를 받는다", async () => {
    const g = await startedGame("errand");
    await placeSeats(g.code, SIX_SPREAD);
    await sample(g);
    await sample(g);
    let players = await playersOf(g.code);
    const seen = (seatNo: number) => JSON.stringify(players.find((p) => p.seat === seatNo)!.errandSeen);
    expect(seen(0)).toBe(JSON.stringify([{ seat: 1, place: "glass" }]));
    expect(seen(1)).toBe(JSON.stringify([{ seat: 0, place: "glass" }]));
    expect(seen(2)).toBe("[]");
    // 나갔다 다시 들어오면 새 줄(seat 1 이 표본 사이에 멀어졌다 돌아온다)
    await placeSeats(g.code, { 1: SPOTS.far3 });
    await sample(g);
    await placeSeats(g.code, { 1: SPOTS.near });
    await sample(g);
    players = await playersOf(g.code);
    expect(players.find((p) => p.seat === 0)!.errandSeen).toHaveLength(2);

    // seat 0 은 3곳을 마쳤고 seat 1 은 2곳만 마쳤다
    await writeRoomEdit(env.ROOM.getByName(g.code), (room) => ({
      ...room,
      players: (room.players as StoredPlayer[]).map((p) =>
        p.seat === 0 ? { ...p, errandPlaces: ["glass", "piano", "sax"], errandDone: ["glass", "piano", "sax"] } : p.seat === 1 ? { ...p, errandPlaces: ["glass", "piano", "sax"], errandDone: ["glass", "piano"] } : p,
      ),
    }));
    // errand 의 view 에는 아직 record 가 없다
    expect("record" in lastViewOf(actorOf(g, 0).sock).me).toBe(false);
    const marks = g.actors.map((x) => mark(x.sock));
    await advanceTo(g.code, g.socks, "discussion");
    for (const x of g.actors) await settle(x.sock, 0);
    const meOf = (seatNo: number) => lastViewOf(actorOf(g, seatNo).sock).me;
    expect(JSON.stringify(meOf(0).record)).toBe(JSON.stringify([{ seat: 1, place: "glass" }, { seat: 1, place: "glass" }]));
    for (const seatNo of [1, 2, 3, 4, 5]) expect("record" in meOf(seatNo)).toBe(false);
    // 다른 사람이 받은 어떤 프레임에도 record 키가 없다
    for (const [i, x] of g.actors.entries()) {
      if (x.seat === 0) continue;
      expect(x.sock.frames.slice(marks[i]!).some((raw) => raw.includes('"record"'))).toBe(false);
    }
  }, 40_000);

  it("errand 를 벗어나 토론으로 넘어가면 모든 산 사람이 전체 snap(산 사람 전원)을 받는다", async () => {
    const g = await startedGame("errand");
    await placeSeats(g.code, SIX_SPREAD);
    await flushWorld(g.code);
    const marks = g.actors.map((x) => mark(x.sock));
    await advanceTo(g.code, g.socks, "discussion");
    for (const [i, x] of g.actors.entries()) {
      const msgs = await settle(x.sock, marks[i]!);
      const last = snapsOf(msgs).at(-1);
      expect(`${x.seat}:${seatsOfSnap(last)}:${last?.near === undefined}`).toBe(`${x.seat}:0,1,2,3,4,5:true`);
    }
  }, 30_000);
});

describe("errand 진입·hello 의 snap (D-02)", () => {
  it("errand 로 들어오는 전환에서 산 사람마다 근처 snap 을 받고, 재접속(hello)은 같은 규칙, 유령 hello 는 전원", async () => {
    const g = await startedAtDayAnnounce();
    await placeSeats(g.code, SIX_SPREAD);
    await flushWorld(g.code);
    const marks = g.actors.map((x) => mark(x.sock));
    await advanceTo(g.code, g.socks, "errand");
    for (const [i, x] of g.actors.entries()) {
      const msgs = await settle(x.sock, marks[i]!);
      const last = snapsOf(msgs).at(-1);
      expect(`${x.seat}:${seatsOfSnap(last)}:${last?.near}`).toBe(`${x.seat}:${x.seat <= 1 ? "0,1" : x.seat}:true`);
    }

    const helloSeats = async (a: Actor): Promise<string> => {
      const sock = await connect(g.code);
      send(sock, { t: "hello", token: a.token });
      await nextFrame(sock, (m) => m.t === "chatLog");
      const snap = worldFramesOf(sock).find((m): m is SnapFrame => m.k === "snap");
      return `${seatsOfSnap(snap)}:${snap?.near}`;
    };
    expect(await helloSeats(actorOf(g, 0))).toBe("0,1:true");
    expect(await helloSeats(actorOf(g, 3))).toBe("3:true");
    await killSeats(g, [5]);
    expect(await helloSeats(actorOf(g, 5))).toBe("0,1,2,3,4,5:undefined");
  }, 40_000);
});
