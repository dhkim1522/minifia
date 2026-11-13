// 20-03: 마을 한 판의 world 프레임 누설 전수(D-16·D-18·D-22, 위협 T-20-12).
// 심부름(근처·목격) → 토론(걷기·문 통과·재접속·채팅) → 지목 모이기(강제 걷기) → 밤 → 아침을 한 번 걷고,
// 산 사람 소켓이 그 동안 받은 "모든" world 프레임에서 남의 좌표가 그 프레임 시각의 받는 사람 구역 안인지 한 곳(judge)에서 판정한다.
// 받는 사람의 구역은 그 사람이 받은 자기 구간(자기 move·snap 의 자기 칸)을 따라가며 구한다 — 서버 메모리를 다시 읽지 않는다.
// 고정된 두 사람이 기준이다: V 는 광장에, W 는 우체국 안에 서 있다(지목 모이기 전까지 움직이지 않는다). 나머지가 방을 드나든다.
// 유령은 방 안 좌표를 포함해 모두를 보고(D-16), 채팅은 구역과 무관하게 간다(D-16).
// 실제 시간을 기다리지 않는다: 문 통과는 구간 출발을 앞당기고(passDoor) 알람을 돌린다. 프레임은 처음부터 끝까지 모은다 — 통과를 내가 돌린 알람이 내든 제때 깨어난 알람이 내든 불변식은 같다.
// 프레임 수는 실제 시간에 깨어난 심부름 표본 수에 따라 달라지므로 개수는 "있다" 로만 단언한다. 실패 출력은 한 줄이어야 해서(TAP) 문자열로 비교한다.
import { env } from "cloudflare:workers";
import { runDurableObjectAlarm, runInDurableObject } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { TOWN_MAP, TOWN_ROOMS } from "../../shared/game/mapTown";
import { MOVE_V, positionAtFx, restSegment } from "../../shared/game/world";
import type { Segment, WorldState } from "../../shared/game/world";
import { zoneOf } from "../../shared/game/zones";
import type { ServerMessage } from "../../shared/protocol";
import {
  advanceTo,
  chatSend,
  connect,
  flushWorld,
  ghostsOf,
  hello,
  idOfSeat,
  mark,
  memWorld,
  moveAs,
  passDoor,
  placeSeats,
  settle,
  storedRoom,
  townGame,
  withRole,
  writeRoomEdit,
} from "./helpers";
import type { Actor, Game } from "./helpers";

type Pt = { x: number; z: number };
const POST = TOWN_ROOMS.find((r) => r.id === "post")!;
const POLICE = TOWN_ROOMS.find((r) => r.id === "police")!;
const CLINIC = TOWN_ROOMS.find((r) => r.id === "clinic")!;
/** V 가 서 있는 광장 자리: 우체국 문 앞에서 1.0 더 나온 걷는 칸 중심. 문 안쪽 첫 칸과 2.5 — 근처 반경 안이지만 벽 너머다. */
const V_SPOT: Pt = { x: -25, z: -475 };
/** W 가 서 있는 우체국 안 자리. 문 앞 목적지와 2.5 — 근처 반경 안이지만 벽 너머다. */
const W_SPOT: Pt = POST.inside;
/** 우체국 안, 문 바로 안쪽의 걷는 칸 중심 · 안쪽 옆 칸 · 안쪽 깊은 칸. */
const IN_DOOR: Pt = { x: -25, z: -725 };
const POST_SIDE: Pt = { x: 75, z: -775 };
const POST_DEEP: Pt = { x: 75, z: -875 };
/** 그 밖의 산 사람·유령이 서는 광장 자리(우체국·경찰서에서 멀다). */
const Z_SPOT: Pt = { x: 425, z: -125 };
const G_SPOT: Pt = { x: 320, z: 180 };
const CHAT_TEXT = "우체국 안에서 한마디";

/** 연결당 1초 20개 한도의 창을 비운다 — 이 시험은 한 판을 빠르게 걸어 ping 이 한도를 넘을 수 있다(한도는 reconnect.test.ts 가 따로 본다). */
async function clearRates(code: string): Promise<void> {
  await runInDurableObject(env.ROOM.getByName(code), (instance) => {
    (instance as unknown as { rates: WeakMap<object, unknown> }).rates = new WeakMap();
  });
}

/** 이동 요청 사이 150ms 간격의 기록을 비운다(메모리뿐인 값) — 같은 사람이 이어서 걷는 것을 실제 시간을 기다리지 않고 시험한다. */
async function clearMoveGaps(code: string): Promise<void> {
  await runInDurableObject(env.ROOM.getByName(code), (instance) => {
    const holder = instance as unknown as { world: WorldState };
    holder.world = { ...holder.world, lastMoveAt: {} };
  });
}

/** JSON 을 걸어 내려가며 (경로, 키) 를 모두 모은다 — leak.test.ts 의 keyPaths 와 같은 모양이다(그 파일을 import 하면 describe 가 두 번 돈다). */
function keyPaths(value: unknown, path = ""): string[] {
  if (Array.isArray(value)) return value.flatMap((v) => keyPaths(v, `${path}[]`));
  if (value !== null && typeof value === "object") {
    return Object.entries(value as Record<string, unknown>).flatMap(([k, v]) => [`${path}.${k}`, ...keyPaths(v, `${path}.${k}`)]);
  }
  return [];
}

/** 한 사람이 받은 프레임을 소켓이 바뀌어도(재접속) 이어서 모은다. */
class Tape {
  readonly msgs: ServerMessage[] = [];
  private from: number;
  constructor(readonly who: Actor) {
    this.from = who.sock.frames.length;
  }
  /** 지금까지 온 프레임을 모두 옮겨 적는다(ping/pong 으로 flush 한 뒤). */
  async take(): Promise<void> {
    await settle(this.who.sock, mark(this.who.sock));
    const raws = this.who.sock.frames.slice(this.from);
    this.from = this.who.sock.frames.length;
    for (const raw of raws) this.msgs.push(JSON.parse(raw) as ServerMessage);
  }
  /** 새 소켓으로 다시 hello 한다(예전 소켓은 서버가 닫는다). 그 뒤의 프레임은 새 소켓에서 모은다. */
  async reconnect(g: Game): Promise<void> {
    await this.take();
    const sock = await connect(g.code);
    await hello(sock, this.who.token);
    g.socks[g.socks.indexOf(this.who.sock)] = sock;
    this.who.sock = sock;
    this.from = 0;
  }
}

interface Verdict {
  /** 위반 줄: "좌석 s · 프레임 종류 · 좌표 x,z · 그 좌표의 구역 ≠ 받는 사람 구역" */
  violations: string[];
  /** 종류별로 판정한(남의 좌표가 실린) 프레임 수 */
  kinds: Record<"near" | "snap" | "zoneSnap" | "move" | "appear" | "vanish", number>;
  /** 판정한 프레임마다의 받는 사람 구역(이어진 같은 값은 한 번): "post>plaza>post" */
  trail: string;
  /** world 프레임 수(자기 것 포함) */
  frames: number;
}

/**
 * 판정 한 곳(D-18): me 가 받은 프레임을 순서대로 읽으며 자기 구간(자기 move·snap 의 자기 칸)을 따라가고,
 * 남의 좌표가 실린 프레임마다 그 프레임 시각(move·appear 는 t0, snap 은 at)의 내 위치의 구역을 구해 모든 남의 점이 그 구역인지 본다.
 * 사라짐(door vanish)은 좌표 키가 하나도 없어야 한다(d·e·k·s·t 뿐).
 */
function judge(msgs: readonly ServerMessage[], me: number, start: Segment): Verdict {
  let own = start;
  const out: Verdict = { violations: [], kinds: { near: 0, snap: 0, zoneSnap: 0, move: 0, appear: 0, vanish: 0 }, trail: "", frames: 0 };
  const trail: string[] = [];
  const check = (kind: string, at: number, others: Array<{ s: number; p: readonly number[] }>): void => {
    const here = positionAtFx(own, at);
    const zone = zoneOf(TOWN_MAP, here.x, here.z);
    if (trail.at(-1) !== zone) trail.push(zone);
    for (const o of others) {
      for (let i = 0; i + 1 < o.p.length; i += 2) {
        const z = zoneOf(TOWN_MAP, o.p[i]!, o.p[i + 1]!);
        if (z !== zone) out.violations.push(`좌석 ${o.s} · ${kind} · ${o.p[i]},${o.p[i + 1]} · ${z} ≠ 받는 사람(좌석 ${me}) ${zone}`);
      }
    }
  };
  for (const m of msgs) {
    if (m.t !== "world") continue;
    out.frames += 1;
    if (m.k === "move") {
      if (m.s === me) own = { p: m.p, t0: m.t0, v: m.v };
      else {
        out.kinds.move += 1;
        check("move", m.t0, [m]);
      }
    } else if (m.k === "door") {
      if (m.e === "vanish") {
        out.kinds.vanish += 1;
        const keys = Object.keys(m).sort().join(",");
        if (keys !== "d,e,k,s,t") out.violations.push(`좌석 ${m.s} · vanish · 키 ${keys} · 좌표 키가 있다`);
      } else {
        out.kinds.appear += 1;
        check("appear", m.t0, [m]);
      }
    } else {
      const mine = m.ents.find((e) => e.s === me);
      if (mine !== undefined) own = { p: mine.p, t0: mine.t0, v: mine.v };
      const others = m.ents.filter((e) => e.s !== me);
      const kind = m.near === true ? "near" : (m as { zone?: unknown }).zone === true ? "zoneSnap" : "snap";
      if (others.length > 0) out.kinds[kind] += 1;
      check(kind, m.at, others);
    }
  }
  out.trail = trail.join(">");
  return out;
}

interface Run {
  g: Game;
  v: Actor;
  w: Actor;
  x: Actor;
  y: Actor;
  z: Actor;
  ghost: Actor;
  tapes: Map<Actor, Tape>;
  /** 지목 모이기 직전까지 V·W 가 받은 프레임 수(그때까지 둘은 서 있다) */
  cut: { v: number; w: number };
  /** 첫 표본 뒤 저장된 목격 줄: "V=[…] W=[…]" */
  seenAfterFirst: string;
  /** 토론 끝(모이기 직전)의 구역 기억: "W=post X=police Y=plaza" */
  zonesBeforeGather: string;
  /** 모이는 길에 문을 지난 뒤의 구역 기억: "W=plaza X=plaza" */
  zonesAfterGather: string;
}

/** 표본 알람 한 번(evict 없이). */
async function sample(g: Game): Promise<void> {
  await writeRoomEdit(env.ROOM.getByName(g.code), (room) => ({ ...room, errandTickAt: Date.now() - 1 }));
  await runDurableObjectAlarm(env.ROOM.getByName(g.code));
  for (const k of g.socks) await settle(k, mark(k));
}

/** 그 좌석을 0.1초 전에 출발한 구간 p 로 걷게 하고 같은 호출 안에서 표본 알람 본문을 돌린다(구간을 쓴 시각과 표본 시각 사이에 실제 시간이 끼지 않는다). */
async function sampleWalking(g: Game, who: Actor, p: number[]): Promise<void> {
  const id = await idOfSeat(g.code, who.seat);
  await runInDurableObject(env.ROOM.getByName(g.code), async (instance, state) => {
    const holder = instance as unknown as { world: WorldState; room: Record<string, unknown>; alarm: () => Promise<void> };
    const now = Date.now();
    holder.world = { ...holder.world, segs: { ...holder.world.segs, [id]: { p, t0: now - 100, v: MOVE_V } } };
    holder.room = { ...holder.room, errandTickAt: now - 1 };
    await state.storage.put("room", holder.room);
    await holder.alarm();
  });
  for (const k of g.socks) await settle(k, mark(k));
}

/** 걷기 요청 → (보낸 쪽 flush) → 문턱을 지난 것으로 → 알람 → 모든 소켓 flush. 문을 지나지 않는 걷기는 through 를 false 로. */
async function walk(g: Game, who: Actor, dest: Pt, through = true): Promise<void> {
  await clearRates(g.code);
  await clearMoveGaps(g.code);
  moveAs(who, dest.x, dest.z);
  await settle(who.sock, mark(who.sock));
  if (through) {
    await passDoor(g.code, who.seat);
    await runDurableObjectAlarm(env.ROOM.getByName(g.code));
  }
  for (const k of g.socks) await settle(k, mark(k));
}

const memoOf = async (g: Game, who: Actor): Promise<string> => String((await memWorld(g.code)).zones?.[await idOfSeat(g.code, who.seat)]);

/** 마을 한 판을 심부름부터 아침까지 한 번 걷는다. */
async function playOnce(): Promise<Run> {
  const g = await townGame("errand");
  const ghost = withRole(g, "citizen")[0]!;
  const { living } = await ghostsOf(g, [ghost.seat]);
  const [v, w, x, y, z] = [...living].sort((a, b) => a.seat - b.seat) as [Actor, Actor, Actor, Actor, Actor];
  const code = g.code;

  // ---- 심부름: V 광장, W 우체국 안, X 가 우체국 문 앞·안을 오간다 ----
  await placeSeats(code, { [v.seat]: V_SPOT, [w.seat]: W_SPOT, [x.seat]: POST.front, [y.seat]: CLINIC.front, [z.seat]: Z_SPOT, [ghost.seat]: G_SPOT });
  for (const k of g.socks) await settle(k, mark(k));
  const tapes = new Map(g.actors.map((a) => [a, new Tape(a)] as const));
  const takeAll = async (): Promise<void> => {
    await clearRates(code);
    for (const t of tapes.values()) await t.take();
  };

  await sample(g); // X 문 앞(광장): V 의 근처, W 에게는 벽 너머
  const stored = ((await storedRoom(code)) as unknown as { players: Array<{ seat: number; errandSeen?: unknown }> }).players;
  const seenOf = (who: Actor): string => JSON.stringify(stored.find((p) => p.seat === who.seat)!.errandSeen ?? []);
  const seenAfterFirst = `V=${seenOf(v)} W=${seenOf(w)}`;
  await sampleWalking(g, x, [POST.front.x, POST.front.z, IN_DOOR.x, IN_DOOR.z, POST_SIDE.x, POST_SIDE.z]); // 문으로 들어가는 길(표본 때는 아직 광장)
  await placeSeats(code, { [x.seat]: IN_DOOR });
  await sample(g); // X 우체국 안: W 의 근처, V 에게는 벽 너머
  await sampleWalking(g, x, [IN_DOOR.x, IN_DOOR.z, POST.front.x, POST.front.z]); // 문으로 나가는 길(표본 때는 아직 방 안)
  await takeAll();

  // ---- 토론: X 는 경찰서로, Y 는 우체국으로 들어갔다 나온다. 사이에 V·W·유령이 재접속한다 ----
  await placeSeats(code, { [x.seat]: POLICE.front, [y.seat]: POST.front });
  await flushWorld(code);
  await advanceTo(code, g.socks, "discussion");
  await walk(g, x, POLICE.inside);
  await walk(g, y, POST_SIDE);
  await walk(g, y, POST_DEEP, false);
  for (const who of [v, w, ghost]) await tapes.get(who)!.reconnect(g);
  await walk(g, y, POST.front);
  chatSend(w.sock, CHAT_TEXT);
  await settle(w.sock, mark(w.sock));
  await takeAll();
  const zonesBeforeGather = `W=${await memoOf(g, w)} X=${await memoOf(g, x)} Y=${await memoOf(g, y)}`;
  const cut = { v: tapes.get(v)!.msgs.length, w: tapes.get(w)!.msgs.length };

  // ---- 지목 모이기: 서버가 모두를 걷게 한다 — W 는 우체국에서, X 는 경찰서에서 문을 지나 나온다 ----
  await flushWorld(code);
  await advanceTo(code, g.socks, "nomination");
  await passDoor(code, w.seat);
  await passDoor(code, x.seat);
  await runDurableObjectAlarm(env.ROOM.getByName(code));
  await takeAll();
  const zonesAfterGather = `W=${await memoOf(g, w)} X=${await memoOf(g, x)}`;

  // ---- 밤 → 아침: 토론이 끝난 자리(W 우체국 안, X 경찰서 안)로 순간이동한다 ----
  await flushWorld(code);
  await advanceTo(code, g.socks, "night");
  await takeAll();
  await flushWorld(code);
  await advanceTo(code, g.socks, "morning");
  await runDurableObjectAlarm(env.ROOM.getByName(code));
  await takeAll();
  return { g, v, w, x, y, z, ghost, tapes, cut, seenAfterFirst, zonesBeforeGather, zonesAfterGather };
}

let played: Promise<Run> | null = null;
/** 한 판은 한 번만 걷고 시험들이 같은 기록을 본다. */
const play = (): Promise<Run> => (played ??= playOnce());
const T = { timeout: 180_000 };
const startOf = (r: Run, who: Actor): Segment => {
  const spot = who === r.v ? V_SPOT : who === r.w ? W_SPOT : who === r.x ? POST.front : who === r.y ? CLINIC.front : Z_SPOT;
  return restSegment(spot.x, spot.z, 0);
};
const verdictOf = (r: Run, who: Actor, upTo?: number): Verdict => judge(r.tapes.get(who)!.msgs.slice(0, upTo), who.seat, startOf(r, who));

describe("마을 한 판: 산 사람이 받은 모든 world 프레임의 남의 좌표는 받는 사람 구역 안이다 (D-18, T-20-12)", () => {
  it("광장에 선 V·우체국 안에 선 W 가 심부름부터 아침까지 받은 프레임에 다른 구역 좌표가 하나도 없다", T, async () => {
    const r = await play();
    const [forV, forW] = [verdictOf(r, r.v), verdictOf(r, r.w)];
    // 판정한 프레임이 실제로 있다(빈 기록을 통과로 읽지 않는다): 한 번 걸으면 V 는 world 프레임 18개, W 는 14개쯤 받는다(심부름 표본이 제때 더 깨어나면 늘어난다).
    expect(`V: ${forV.violations.length} ${forV.violations[0] ?? "none"} // W: ${forW.violations.length} ${forW.violations[0] ?? "none"} // 프레임 V≥12=${forV.frames >= 12} W≥10=${forW.frames >= 10}`).toBe(
      "V: 0 none // W: 0 none // 프레임 V≥12=true W≥10=true",
    );
  });

  it("방을 드나든 X·Y 와 광장의 Z 가 받은 프레임도 같다", T, async () => {
    const r = await play();
    const got = [r.x, r.y, r.z].map((who) => {
      const verdict = verdictOf(r, who);
      return `${verdict.violations.length} ${verdict.violations[0] ?? "none"}`;
    });
    expect(got.join(" // ")).toBe("0 none // 0 none // 0 none");
  });

  it("지목 모이기 전까지 V 의 구역은 줄곧 광장, W 는 줄곧 우체국이고 — 그 뒤 W 는 문을 지나 광장으로 나왔다가 밤에 우체국으로 돌아간다", T, async () => {
    const r = await play();
    const got = `V=${verdictOf(r, r.v, r.cut.v).trail} W=${verdictOf(r, r.w, r.cut.w).trail} | 끝까지 V=${verdictOf(r, r.v).trail} W=${verdictOf(r, r.w).trail}`;
    expect(got).toBe("V=plaza W=post | 끝까지 V=plaza W=post>plaza>post");
  });

  it("지나간 경로: 근처 snap·이동·문 사라짐·문 나타남·snap 이 V 와 W 모두에게 남의 좌표와 함께 왔고, W 는 문을 지날 때 zone snap 을 받았다", T, async () => {
    const r = await play();
    const seen = (who: Actor): string => {
      const k = verdictOf(r, who).kinds;
      return (["near", "move", "vanish", "appear", "snap", "zoneSnap"] as const).filter((name) => k[name] > 0).join(",");
    };
    expect(`V: ${seen(r.v)} // W: ${seen(r.w)} // ${r.zonesBeforeGather} → ${r.zonesAfterGather}`).toBe(
      "V: near,move,vanish,appear,snap // W: near,move,vanish,appear,snap,zoneSnap // W=post X=police Y=plaza → W=plaza X=plaza",
    );
  });

  it("목격: 첫 표본에서 문 앞 사람은 광장의 V 에게만 적히고 벽 너머 W 에게는 적히지 않는다", T, async () => {
    const r = await play();
    expect(r.seenAfterFirst).toBe(`V=[{"seat":${r.x.seat},"place":"mail"}] W=[]`);
  });
});

describe("유령은 모두 보고, 채팅은 구역과 무관하다 (D-16)", () => {
  it("유령 소켓은 우체국 안·경찰서 안 좌표가 실린 프레임을 받고 문 프레임·zone snap 은 받지 않는다", T, async () => {
    const r = await play();
    const worlds = r.tapes.get(r.ghost)!.msgs.filter((m): m is Extract<ServerMessage, { t: "world" }> => m.t === "world");
    const pts = (f: Extract<ServerMessage, { t: "world" }>): number[] => (f.k === "snap" ? f.ents.filter((e) => e.s !== r.ghost.seat).flatMap((e) => e.p) : f.k === "move" && f.s !== r.ghost.seat ? f.p : []);
    const inZone = (zone: string): number =>
      worlds.filter((f) => {
        const p = pts(f);
        for (let i = 0; i + 1 < p.length; i += 2) if (zoneOf(TOWN_MAP, p[i]!, p[i + 1]!) === zone) return true;
        return false;
      }).length;
    const doors = worlds.filter((f) => f.k === "door").length;
    const zoned = worlds.filter((f) => f.k === "snap" && (f as { zone?: unknown }).zone === true).length;
    expect(`post=${inZone("post") > 0} police=${inZone("police") > 0} doors=${doors} zoneSnaps=${zoned}`).toBe("post=true police=true doors=0 zoneSnaps=0");
  });

  it("우체국 안의 W 가 보낸 공개 채팅이 광장의 V 에게 간다", T, async () => {
    const r = await play();
    const got = r.tapes.get(r.v)!.msgs.filter((m): m is Extract<ServerMessage, { t: "chat" }> => m.t === "chat").filter((m) => m.text === CHAT_TEXT);
    expect(`${got.length} ${got[0]?.ch}/${got[0]?.seat}`).toBe(`1 all/${r.w.seat}`);
  });
});

describe("역할 규칙은 그대로다 (결정 0002·0021)", () => {
  it("산 사람 소켓의 state 프레임에는 남의 역할이 없다(role 은 view.me 에만, players[] 행에 역할 키 없음, spectate 없음) — 유령은 spectate 를 받는다", T, async () => {
    const r = await play();
    const bad: string[] = [];
    let states = 0;
    for (const who of [r.v, r.w, r.x, r.y, r.z]) {
      for (const m of r.tapes.get(who)!.msgs) {
        if (m.t !== "state") continue;
        states += 1;
        for (const path of keyPaths(m)) {
          const key = path.slice(path.lastIndexOf(".") + 1);
          if ((key === "role" || key === "allies") && path !== `.view.me.${key}`) bad.push(`좌석 ${who.seat} ${m.view.phase} ${path}`);
          if (path === ".view.spectate" || path.startsWith(".view.players[].") && (key === "role" || key === "job")) bad.push(`좌석 ${who.seat} ${m.view.phase} ${path}`);
        }
      }
    }
    const ghostSpectate = r.tapes.get(r.ghost)!.msgs.some((m) => m.t === "state" && m.view.spectate !== undefined);
    expect(`states>0=${states > 0} bad=${bad.length} ${bad[0] ?? "none"} ghostSpectate=${ghostSpectate}`).toBe("states>0=true bad=0 none ghostSpectate=true");
  });
});
