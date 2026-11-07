// 15페이즈 새 표면 전수 누설 시험 (15-06, D-02·D-04·D-05·D-06·D-08, 위협 T-15-23·24·25): 역할 다섯 시점(마피아·경찰·의사·시민·유령)이 심부름·토론·밤·아침에 받은
// 실제 소켓 프레임을 모아 ① me.errand 구조 ② 위치 비공개(근처 집합을 시험이 독립 계산) ③ 목격 기록 ④ 밤 응답 동일성 ⑤ 아침 흔적을 단언한다.
// "오지 않았음" 은 settle(ping/pong)로 증명한다. 위치는 메모리 world 에 직접 쓰고 표본 알람은 errandTickAt 을 과거로 당겨 돌린다(errandNear.test.ts 의 선례).
// 서버 구현의 근처 판정 함수를 다시 쓰지 않는다 — 기대 근처 집합은 아래 nearOf 가 좌표만으로 독립 계산한다. 실패 출력은 한 줄이어야 해서(TAP) 프레임은 문자열로 비교한다.
import { env } from "cloudflare:workers";
import { runDurableObjectAlarm, runInDurableObject } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { ERRAND_NEAR_R } from "../../shared/game/phases";
import { MOVE_V, restSegment } from "../../shared/game/world";
import type { Segment, WorldState } from "../../shared/game/world";
import { OUTFIT_IDS, PLACE_IDS, TRACE_PIECE_IDS } from "../../shared/protocol";
import type { ServerMessage } from "../../shared/protocol";
import {
  actorsOf,
  advanceTo,
  connect,
  flushWorld,
  ghostsOf,
  lastViewOf,
  mark,
  moveAs,
  nextFrame,
  observe,
  pickAs,
  seat,
  send,
  settle,
  stable,
  startedGame,
  storedRoom,
  summary,
  withRole,
  worldFramesOf,
  writeRoomEdit,
} from "./helpers";
import type { Actor, Game, TestSocket } from "./helpers";

type SnapFrame = Extract<ServerMessage, { t: "world"; k: "snap" }>;
interface StoredPlayer { id: string; seat: number; errandPlaces?: string[]; errandDone?: string[] }

// ---- 허용 목록 검사 도우미(제품 코드가 아니라 이 시험의 것이다) ----

const FORBIDDEN_KEYS = ["token", "id", "playerId", "connId", "nicknameKey", "joinSeq", "hostId"];
/** 어떤 프레임의 어떤 깊이에도 키로 없어야 하는 서버 전용 이름(T-15-25). */
const SERVER_ONLY_NEW = ["errandPlaces", "errandDone", "errandNear", "errandSeen", "errandTickAt", "nightPick"];
/**
 * 15페이즈가 view 에 더한 경로 전부(이유 한 줄씩). 이 밖의 새 경로가 이 접두 아래에 보이면 실패한다.
 *  - .view.me.errand(.places[]·.done[]): errand 단계의 산 본인에게만, 장소 id 목록과 처리한 순서(좌표·역할 없음).
 *  - .view.me.record([].seat·.place): 토론 단계에서 3곳을 마친 산 본인에게만, 근처에서 본 좌석·장소 id.
 *  - .view.day.morning.trace: 탈락자가 있는 아침의 모든 view 에 같은 값 하나(조각 id).
 */
const ALLOWED_NEW_PATHS: ReadonlySet<string> = new Set([
  ".view.me.errand", ".view.me.errand.places", ".view.me.errand.done",
  ".view.me.record", ".view.me.record[].seat", ".view.me.record[].place",
  ".view.day.morning", ".view.day.morning.eliminated", ".view.day.morning.saved", ".view.day.morning.trace",
]);
const NEW_PREFIXES = [".view.me.errand", ".view.me.record", ".view.day.morning"];
const WORLD_PATHS = new Set([".t", ".k", ".s", ".p", ".t0", ".v", ".at", ".near", ".ents", ".ents[].s", ".ents[].p", ".ents[].t0", ".ents[].v"]);
const ROLE_WORDS = new Set<string>(["mafia", "police", "doctor", "citizen", "none"]);
const OUTFITS = new Set<string>(OUTFIT_IDS);

function keyPaths(value: unknown, path = ""): string[] {
  if (Array.isArray(value)) return value.flatMap((v) => keyPaths(v, `${path}[]`));
  if (value !== null && typeof value === "object") {
    return Object.entries(value as Record<string, unknown>).flatMap(([k, v]) => [`${path}.${k}`, ...keyPaths(v, `${path}.${k}`)]);
  }
  return [];
}
function stringPaths(value: unknown, path = ""): Array<[string, string]> {
  if (Array.isArray(value)) return value.flatMap((v) => stringPaths(v, `${path}[]`));
  if (value !== null && typeof value === "object") {
    return Object.entries(value as Record<string, unknown>).flatMap(([k, v]) => stringPaths(v, `${path}.${k}`));
  }
  return typeof value === "string" ? [[path, value]] : [];
}
/** path 가 새 접두 중 하나의 "그 키 자신 또는 그 아래" 인가(.view.me.records 같은 이름이 겹치는 기존 키는 제외). */
const underNew = (path: string): boolean => NEW_PREFIXES.some((p) => path === p || path.startsWith(`${p}.`) || path.startsWith(`${p}[]`));

/** 한 프레임(원문)이 새 표면 규칙을 어기는 곳을 한 줄씩. 비어 있어야 통과다. */
function violationsOf(raw: string): string[] {
  const msg = JSON.parse(raw) as ServerMessage;
  const out: string[] = [];
  for (const path of keyPaths(msg)) {
    const key = path.slice(path.lastIndexOf(".") + 1);
    if (FORBIDDEN_KEYS.includes(key)) out.push(`forbidden ${path}`);
    if (SERVER_ONLY_NEW.includes(key)) out.push(`server-only ${path}`);
    if (underNew(path) && !ALLOWED_NEW_PATHS.has(path)) out.push(`not allowed ${path}`);
    if (msg.t === "world" && !WORLD_PATHS.has(path)) out.push(`world path ${path}`);
  }
  for (const [path, value] of stringPaths(msg)) {
    // 장소·흔적 id 가 역할 단어나 의상 id 와 같으면 의상·역할이 샌 것과 구분되지 않는다.
    if ([".view.me.errand.places[]", ".view.me.errand.done[]", ".view.me.record[].place", ".view.day.morning.trace"].includes(path)) {
      if (ROLE_WORDS.has(value) || OUTFITS.has(value)) out.push(`role-like value ${path}=${value}`);
    }
  }
  if (msg.t === "state") {
    const paths = new Set(keyPaths(msg));
    if (paths.has(".view.me.errand") && msg.view.phase !== "errand") out.push(`errand outside errand: ${msg.view.phase}`);
    if (paths.has(".view.me.record") && msg.view.phase !== "discussion") out.push(`record outside discussion: ${msg.view.phase}`);
    if (paths.has(".view.day.morning.trace") && msg.view.phase !== "morning") out.push(`trace outside morning: ${msg.view.phase}`);
  }
  return out;
}
/** 프레임에 me.record 키가 있는가. 장소 id 에도 "record" 가 있어 문자열 검색은 쓰지 않고 키 경로로 본다. */
const hasRecordKey = (raw: string): boolean => keyPaths(JSON.parse(raw)).some((p) => p === ".view.me.record" || p.startsWith(".view.me.record[]"));
/** 소켓이 지금까지 받은 모든 프레임의 위반 목록. */
const violationsOfSock = (sock: TestSocket, from = 0): string[] => sock.frames.slice(from).flatMap((raw) => violationsOf(raw));

// ---- 위치 도우미 ----

const R = ERRAND_NEAR_R * 100; // 월드 고정소수점 단위(×100)
type Pos = { x: number; z: number };
const GLASS: Pos = { x: -390, z: -220 };
/** 서로 반경 안·밖·정확히 경계가 섞인 배치. 좌석 → 좌표. */
const L1: Record<number, Pos> = {
  0: GLASS,
  1: { x: GLASS.x + R, z: GLASS.z }, // 0 과 정확히 R(경계 포함)
  2: { x: GLASS.x, z: GLASS.z + R + 1 }, // 0 과 R+1(밖), 1 과도 밖
  3: { x: 520, z: 500 },
  4: { x: 540, z: 500 }, // 3 과 근처
  5: { x: -40, z: -560 },
};
const L2: Record<number, Pos> = {
  0: GLASS,
  1: { x: 520, z: -60 },
  2: { x: GLASS.x + R - 1, z: GLASS.z }, // 0 과 R-1(안)
  3: { x: -40, z: -540 }, // 5 와 근처
  4: { x: 540, z: 500 },
  5: { x: -40, z: -560 },
};

/** 시험이 독립 계산하는 기대 근처 집합(본인 제외, 오름차순). 서버의 판정 함수를 쓰지 않는다. */
function nearOf(layout: Record<number, Pos>, seatNo: number): number[] {
  const me = layout[seatNo]!;
  return Object.entries(layout)
    .map(([s, p]) => [Number(s), p] as const)
    .filter(([s, p]) => s !== seatNo && Math.hypot(p.x - me.x, p.z - me.z) <= R)
    .map(([s]) => s)
    .sort((a, b) => a - b);
}

const playersOf = async (code: string): Promise<StoredPlayer[]> => ((await storedRoom(code)) as unknown as { players: StoredPlayer[] }).players;
const idOfSeat = async (code: string, seatNo: number): Promise<string> => (await playersOf(code)).find((p) => p.seat === seatNo)!.id;
const actorOf = (g: Game, seatNo: number): Actor => g.actors.find((a) => a.seat === seatNo)!;

async function placeSeats(code: string, layout: Record<number, Pos>): Promise<void> {
  const segs: Record<string, Segment> = {};
  for (const [s, pos] of Object.entries(layout)) segs[await idOfSeat(code, Number(s))] = restSegment(pos.x, pos.z, Date.now());
  await runInDurableObject(env.ROOM.getByName(code), (instance) => {
    const holder = instance as unknown as { world: WorldState };
    holder.world = { ...holder.world, segs: { ...holder.world.segs, ...segs } };
  });
}

async function tickNow(code: string): Promise<void> {
  const stub = env.ROOM.getByName(code);
  await writeRoomEdit(stub, (room) => ({ ...room, errandTickAt: Date.now() - 1 }));
  await runDurableObjectAlarm(stub);
}

/** 한 표본을 돌리고 소켓마다(g.actors 순서) 그 동안 받은 프레임을 돌려준다. */
async function sample(g: Game): Promise<ServerMessage[][]> {
  const marks = g.actors.map((a) => mark(a.sock));
  await tickNow(g.code);
  const out: ServerMessage[][] = [];
  for (const [i, a] of g.actors.entries()) out[i] = await settle(a.sock, marks[i]!);
  return out;
}

const snapsOf = (msgs: ServerMessage[]): SnapFrame[] => msgs.filter((m): m is SnapFrame => m.t === "world" && m.k === "snap");
const seatsOfSnap = (f: SnapFrame | undefined): string => (f === undefined ? "none" : f.ents.map((e) => e.s).sort((a, b) => a - b).join(","));
const expectedSeats = (layout: Record<number, Pos>, seatNo: number): string => [seatNo, ...nearOf(layout, seatNo)].sort((a, b) => a - b).join(",");

/** 낮 시작에서 멈춘 판(errand 진입 전환을 시험이 직접 일으키려고). */
async function startedAtDayAnnounce(): Promise<Game> {
  const room = await seat(5, 0);
  const socks = [room.host, ...room.guests.map((x) => x.sock)];
  send(room.host, { t: "start" });
  for (const sock of socks) await nextFrame(sock, (m) => m.t === "state" && m.view.phase === "assigning");
  await advanceTo(room.code, socks, "dayAnnounce");
  for (const sock of socks) await settle(sock, mark(sock));
  return { code: room.code, socks, actors: actorsOf(room) };
}

/** 이 토큰으로 새 소켓을 열어 hello 로 첫 state 를 받는다(탈락 뒤 유령 시점의 view). */
async function reconnect(code: string, a: Actor): Promise<TestSocket> {
  const sock = await connect(code);
  send(sock, { t: "hello", token: a.token });
  await nextFrame(sock, (m) => m.t === "chatLog");
  await settle(sock, 0);
  return sock;
}

// ---- 시험 ----

describe("① 심부름 me.errand — 역할 다섯 시점의 구조가 같다 (D-03, T-15-23)", () => {
  it("산 마피아·경찰·의사·시민 view 의 me.errand 는 키 집합이 정확히 done,places 이고 장소 3곳은 서로 다른 PLACE_IDS 이며 done 은 빈 배열이다. 유령에게는 키가 없다", async () => {
    const g = await startedGame("errand");
    const ghost = withRole(g, "citizen")[1]!;
    const shapes: string[] = [];
    for (const a of g.actors) {
      const errand = lastViewOf(a.sock).me.errand;
      expect(`${a.role}:${Object.keys(errand ?? {}).sort().join(",")}`).toBe(`${a.role}:done,places`);
      expect(errand!.places.length).toBe(3);
      expect(new Set(errand!.places).size).toBe(3);
      expect(errand!.places.every((p) => (PLACE_IDS as readonly string[]).includes(p))).toBe(true);
      expect(errand!.done).toEqual([]);
      shapes.push(`${Object.keys(errand!).sort().join(",")}|${errand!.places.length}|${errand!.done.length}`);
    }
    expect(new Set(shapes).size).toBe(1);

    await ghostsOf(g, [ghost.seat]);
    const sock = await reconnect(g.code, ghost);
    expect("errand" in lastViewOf(sock).me).toBe(false);
    // 다섯 시점(+유령)이 받은 모든 프레임: 금지 키·서버 전용 이름·허용 목록 밖 새 경로·역할 닮은 값이 없다.
    for (const s of [...g.socks, sock]) expect(violationsOfSock(s).join(" | ")).toBe("");
  }, 40_000);
});

describe("② 위치 비공개 — 산 사람은 본인 + 근처만, 유령은 전원 (D-02, T-15-24)", () => {
  it("표본마다 모든 산 소켓이 받은 snap 좌석 = 본인 + (시험이 독립 계산한) 근처, 반경 밖 좌석은 어떤 프레임에도 없다 (경계 R 포함·R+1 제외, 배치를 바꿔 반복)", async () => {
    const g = await startedGame("errand");
    for (const layout of [L1, L2]) {
      await placeSeats(g.code, layout);
      const marks = g.actors.map((a) => mark(a.sock));
      const got = await sample(g);
      for (const [i, a] of g.actors.entries()) {
        const allowed = new Set([a.seat, ...nearOf(layout, a.seat)]);
        const snaps = snapsOf(got[i]!);
        expect(`${a.seat}:${seatsOfSnap(snaps.at(-1))}`).toBe(`${a.seat}:${expectedSeats(layout, a.seat)}`);
        expect(`${a.seat}:${snaps.at(-1)!.near}`).toBe(`${a.seat}:true`);
        // 이 표본 동안 받은 모든 world 프레임의 좌석은 허용 집합 안이다.
        for (const f of worldFramesOf(a.sock, marks[i]!)) {
          const seats = f.k === "snap" ? f.ents.map((e) => e.s) : [f.s];
          expect(`${a.seat}:${seats.filter((s) => !allowed.has(s)).join(",")}`).toBe(`${a.seat}:`);
        }
      }
    }
    expect(violationsOfSock(g.socks[0]!).concat(...g.socks.slice(1).map((s) => violationsOfSock(s))).join(" | ")).toBe("");
  }, 40_000);

  it("근처 사람의 snap 구간 마지막 꼭짓점은 반경 안이다(경로 전체를 싣지 않는다)", async () => {
    const g = await startedGame("errand");
    const id1 = await idOfSeat(g.code, 1);
    await placeSeats(g.code, L1);
    // seat 1 은 반경 밖 먼 곳으로 길게 걷는 중이다(지금 위치는 seat 0 의 근처).
    await runInDurableObject(env.ROOM.getByName(g.code), (instance) => {
      const holder = instance as unknown as { world: WorldState };
      holder.world = { ...holder.world, segs: { ...holder.world.segs, [id1]: { p: [L1[1]!.x, L1[1]!.z, 520, 500], t0: Date.now(), v: MOVE_V } as Segment } };
    });
    const got = await sample(g);
    const snap = snapsOf(got[g.actors.indexOf(actorOf(g, 0))]!).at(-1)!;
    const seg = snap.ents.find((e) => e.s === 1)!;
    expect(seg).toBeDefined();
    const [x, z] = seg.p.slice(-2) as [number, number];
    expect(`${x},${z}`).not.toBe("520,500");
    expect(Math.hypot(x - GLASS.x, z - GLASS.z)).toBeLessThanOrEqual(R + 400); // 구간은 몇 초 앞까지만 잘려 있다
    expect(seg.p.length).toBeGreaterThanOrEqual(4);
    // 먼 목적지 좌표 자체는 이 소켓의 어떤 프레임에도 문자열로 없다.
    expect(g.actors[0]!.sock.frames.some((raw) => raw.includes("520,500"))).toBe(false);
  }, 40_000);

  it("산 사람의 move 는 본인과 유령에게만 간다: 마피아·경찰·의사·시민이 각각 걸어도 다른 산 사람 소켓의 world 프레임은 0개이고 유령은 받는다", async () => {
    const g = await startedGame("errand");
    const ghostActor = withRole(g, "citizen")[1]!;
    await ghostsOf(g, [ghostActor.seat]);
    await placeSeats(g.code, L1);
    const movers: Actor[] = [withRole(g, "mafia")[0]!, withRole(g, "police")[0]!, withRole(g, "doctor")[0]!, withRole(g, "citizen")[0]!];
    for (const m of movers) {
      const marks = g.actors.map((x) => mark(x.sock));
      const at = L1[m.seat]!;
      await observe(g, m, () => moveAs(m, at.x, at.z + 40));
      const kinds = (x: Actor): string => worldFramesOf(x.sock, marks[g.actors.indexOf(x)]!).map((f) => `${f.k}${f.k === "move" ? f.s : ""}`).join(",");
      expect(`${m.role}>self:${kinds(m)}`).toBe(`${m.role}>self:move${m.seat}`);
      expect(`${m.role}>ghost:${kinds(ghostActor)}`).toBe(`${m.role}>ghost:move${m.seat}`);
      for (const x of g.actors.filter((y) => y !== m && y !== ghostActor)) expect(`${m.role}>${x.role}${x.seat}:${kinds(x)}`).toBe(`${m.role}>${x.role}${x.seat}:`);
    }
    for (const s of g.socks) expect(violationsOfSock(s).join(" | ")).toBe("");
  }, 40_000);

  it("errand 로 들어오는 전환: 산 사람마다 본인 + 근처 snap, 유령 snap 은 전원(near 표시 없음)", async () => {
    const g = await startedAtDayAnnounce();
    await placeSeats(g.code, L1);
    await flushWorld(g.code);
    const ghostActor = actorOf(g, 5);
    await ghostsOf(g, [5]);
    const marks = g.actors.map((a) => mark(a.sock));
    await advanceTo(g.code, g.socks, "errand");
    for (const [i, a] of g.actors.entries()) {
      const last = snapsOf(await settle(a.sock, marks[i]!)).at(-1);
      if (a === ghostActor) expect(`ghost:${seatsOfSnap(last)}:${last?.near === undefined}`).toBe("ghost:0,1,2,3,4,5:true");
      else expect(`${a.seat}:${seatsOfSnap(last)}:${last?.near}`).toBe(`${a.seat}:${expectedSeats(L1, a.seat)}:true`);
    }
    for (const s of g.socks) expect(violationsOfSock(s).join(" | ")).toBe("");
  }, 40_000);

  it("errand 를 벗어난 토론 전환에서만 전체 snap 이 가고, 다음 날 errand 진입에서 다시 근처 snap 이 간다", async () => {
    const g = await startedGame("errand");
    await placeSeats(g.code, L1);
    await flushWorld(g.code);
    let marks = g.actors.map((a) => mark(a.sock));
    await advanceTo(g.code, g.socks, "discussion");
    for (const [i, a] of g.actors.entries()) {
      const last = snapsOf(await settle(a.sock, marks[i]!)).at(-1);
      expect(`${a.seat}:${seatsOfSnap(last)}:${last?.near === undefined}`).toBe(`${a.seat}:0,1,2,3,4,5:true`);
    }
    await advanceTo(g.code, g.socks, "dayAnnounce"); // 다음 날 낮 시작
    for (const a of g.actors) await settle(a.sock, mark(a.sock));
    await placeSeats(g.code, L2);
    await flushWorld(g.code);
    marks = g.actors.map((a) => mark(a.sock));
    await advanceTo(g.code, g.socks, "errand");
    for (const [i, a] of g.actors.entries()) {
      const last = snapsOf(await settle(a.sock, marks[i]!)).at(-1);
      expect(`${a.seat}:${seatsOfSnap(last)}:${last?.near}`).toBe(`${a.seat}:${expectedSeats(L2, a.seat)}:true`);
    }
  }, 60_000);
});

describe("③ 목격 기록 — 3곳을 마친 산 본인에게만 (D-04, T-15-23)", () => {
  /** 역할 role 인 A 와 다른 역할 B 를 근처에 두고 표본 둘, A 만 3곳 완료로 만들고 토론으로 넘긴다. */
  async function recordGame(roleOfA: "mafia" | "citizen" | "police" | "doctor", alone: boolean): Promise<{ g: Game; a: Actor; b: Actor; ghost: Actor; ghostSock: TestSocket; marks: number[]; live: TestSocket[] }> {
    const g = await startedGame("errand");
    const a = withRole(g, roleOfA)[0]!;
    const rest = g.actors.filter((x) => x !== a);
    const b = rest.find((x) => x.role !== roleOfA)!;
    const ghost = rest.filter((x) => x !== b).at(-1)!;
    const layout: Record<number, Pos> = {};
    const far = [L1[3]!, L1[4]!, L1[5]!, L1[2]!, L2[1]!, { x: 100, z: 560 }];
    g.actors.forEach((x, i) => (layout[x.seat] = far[i]!));
    layout[a.seat] = GLASS;
    layout[b.seat] = alone ? { x: 300, z: 0 } : { x: GLASS.x + 20, z: GLASS.z };
    await placeSeats(g.code, layout);
    await sample(g);
    await sample(g);
    await writeRoomEdit(env.ROOM.getByName(g.code), (room) => ({
      ...room,
      players: (room.players as StoredPlayer[]).map((p) =>
        p.seat === a.seat ? { ...p, errandPlaces: ["glass", "piano", "sax"], errandDone: ["glass", "piano", "sax"] } : p.seat === b.seat ? { ...p, errandPlaces: ["glass", "piano", "sax"], errandDone: ["glass", "piano"] } : p,
      ),
    }));
    // errand 단계 view 에는 아직 record 가 없다.
    expect(`${a.role}:${"record" in lastViewOf(a.sock).me}`).toBe(`${a.role}:false`);
    await ghostsOf(g, [ghost.seat]);
    const ghostSock = await reconnect(g.code, ghost);
    const marks = g.actors.map((x) => mark(x.sock));
    // 같은 토큰으로 다시 연결하면 옛 소켓은 닫힌다 — 이후 단계 전환은 살아 있는 소켓(유령은 새 소켓)으로만 기다린다.
    const live = [...g.actors.filter((x) => x !== ghost).map((x) => x.sock), ghostSock];
    await advanceTo(g.code, live, "discussion");
    for (const s of live) await settle(s, 0);
    return { g, a, b, ghost, ghostSock, marks, live };
  }

  for (const roleOfA of ["mafia", "citizen"] as const) {
    it(`A(${roleOfA})만 me.record 를 받고 줄 키는 seat·place 뿐이다. B(2곳)·유령·그 밖 사람의 어떤 프레임에도 "record" 키가 없다`, async () => {
      const { g, a, b, ghost, ghostSock, marks } = await recordGame(roleOfA, false);
      const rec = lastViewOf(a.sock).me.record!;
      expect(rec.length).toBeGreaterThan(0);
      expect(rec.every((l) => Object.keys(l).sort().join(",") === "place,seat" && l.seat === b.seat)).toBe(true);
      for (const x of g.actors.filter((y) => y !== a)) {
        expect(`${x.role}${x.seat}:${"record" in lastViewOf(x.sock).me}`).toBe(`${x.role}${x.seat}:false`);
        expect(`${x.role}${x.seat}:${x.sock.frames.slice(marks[g.actors.indexOf(x)]!).some(hasRecordKey)}`).toBe(`${x.role}${x.seat}:false`);
      }
      expect("record" in lastViewOf(ghostSock).me).toBe(false);
      expect(ghostSock.frames.some(hasRecordKey)).toBe(false);
      expect(b.seat).not.toBe(ghost.seat);
      for (const s of [...g.socks, ghostSock]) expect(violationsOfSock(s).join(" | ")).toBe("");
    }, 60_000);
  }

  it("근처에서 아무도 못 본 A 는 빈 배열을 받는다(키는 있다)", async () => {
    const { a } = await recordGame("police", true);
    expect(JSON.stringify(lastViewOf(a.sock).me.record)).toBe("[]");
  }, 60_000);

  it("record 는 토론 단계 프레임에서만 나타난다 — errand·밤·아침 state 프레임에는 키가 없다", async () => {
    const { g, a, live } = await recordGame("doctor", false);
    await advanceTo(g.code, live, "night");
    await advanceTo(g.code, live, "morning");
    const phasesWithRecord = new Set<string>();
    for (const raw of a.sock.frames) {
      const m = JSON.parse(raw) as ServerMessage;
      if (m.t === "state" && "record" in m.view.me) phasesWithRecord.add(m.view.phase);
    }
    expect([...phasesWithRecord]).toEqual(["discussion"]);
    // 다른 사람의 소켓에서는 한 번도 나오지 않는다.
    for (const x of g.actors.filter((y) => y !== a)) expect(`${x.role}${x.seat}:${x.sock.frames.some(hasRecordKey)}`).toBe(`${x.role}${x.seat}:false`);
  }, 60_000);
});

describe("④ 밤 고르기 — 모든 역할이 같은 입력에 같은 모양의 응답 (D-05, T-15-23)", () => {
  /** 보낸 소켓이 받은 프레임을 me 를 뺀 휘발 필드 제외 문자열로. 역할마다 me 의 내용은 다르지만 그 밖은 한 글자도 같아야 한다. */
  const outsideMe = (msgs: ServerMessage[]): string => stable(msgs.map((m) => (m.t === "state" ? ({ ...m, view: { ...m.view, me: undefined } } as unknown as ServerMessage) : m)));

  it("마피아·경찰·의사·시민이 같은 산 대상을 고르면 응답은 모두 state 한 프레임(오류 없음)이고 me 밖이 같으며, 죽은 대상·앉지 않은 seat 는 모두 같은 오류 열이다", async () => {
    const g = await startedGame("night");
    const target = withRole(g, "citizen")[0]!;
    const who: Actor[] = [withRole(g, "mafia")[0]!, withRole(g, "police")[0]!, withRole(g, "doctor")[0]!, withRole(g, "citizen")[1]!];
    const rows: string[] = [];
    const outside: string[] = [];
    for (const a of who) {
      const from = mark(a.sock);
      pickAs(a, target.seat);
      const got = await settle(a.sock, from);
      rows.push(`${a.role}:${summary(got)}`);
      outside.push(outsideMe(got));
      expect(`${a.role}:${lastViewOf(a.sock).me.pick}`).toBe(`${a.role}:${target.seat}`); // 시민의 선택도 본인에게 같은 모양으로 돌아온다
    }
    expect(rows.map((r) => r.slice(r.indexOf(":") + 1)).join("|")).toBe(Array(4).fill("[state:night]").join("|"));
    expect(new Set(outside).size).toBe(1);

    await killSeatOf(g, withRole(g, "citizen")[0]!.seat);
    for (const bad of [target.seat, 9]) {
      const seen = new Set<string>();
      for (const a of who) {
        const from = mark(a.sock);
        pickAs(a, bad);
        seen.add(summary(await settle(a.sock, from)));
      }
      expect(`${bad}:${[...seen].length}:${[...seen][0]!.includes("error:BAD_MESSAGE")}`).toBe(`${bad}:1:true`);
    }
    for (const s of g.socks) expect(violationsOfSock(s).join(" | ")).toBe("");
  }, 60_000);
});

/** 저장된 방에서 이 좌석을 탈락시킨다(소켓은 그대로). */
async function killSeatOf(g: Game, seatNo: number): Promise<void> {
  await ghostsOf(g, [seatNo]);
}

describe("⑤ 아침 흔적 — 역할·의상·좌석·풀 없이 모든 시점에 같은 값 (D-06, T-15-23)", () => {
  it("마피아 전원과 시민 하나가 같은 X 를 골라 탈락한 아침: 마피아·경찰·의사·시민·유령 소켓의 day.morning 키는 eliminated·trace, trace 값이 같고 조각 id 이며 의상·역할 단어가 아니다", async () => {
    const g = await startedGame("night");
    const mafias = withRole(g, "mafia");
    const [x, other] = withRole(g, "citizen") as [Actor, Actor];
    for (const m of mafias) pickAs(m, x.seat);
    pickAs(other, x.seat);
    for (const a of g.actors) await settle(a.sock, mark(a.sock));
    const marks = g.actors.map((a) => mark(a.sock));
    await advanceTo(g.code, g.socks, "morning");
    for (const [i, a] of g.actors.entries()) await settle(a.sock, marks[i]!);
    const mornings = g.actors.map((a) => lastViewOf(a.sock).day?.morning);
    for (const [i, a] of g.actors.entries()) {
      expect(`${a.role}${a.seat}:${Object.keys(mornings[i] ?? {}).sort().join(",")}`).toBe(`${a.role}${a.seat}:eliminated,trace`);
    }
    expect(new Set(mornings.map((m) => JSON.stringify(m))).size).toBe(1);
    const trace = mornings[0]!.trace!;
    expect((TRACE_PIECE_IDS as readonly string[]).includes(trace)).toBe(true);
    expect(OUTFITS.has(trace) || ROLE_WORDS.has(trace)).toBe(false);
    // 아침 state 프레임에서 trace 값은 그 경로에만 있다 — 좌석·의상 id 가 붙은 다른 경로는 없다.
    const morningFrames = g.actors.flatMap((a) => a.sock.frames.slice(marks[g.actors.indexOf(a)]!)).filter((raw) => raw.includes(`"trace"`));
    expect(morningFrames.length).toBeGreaterThan(0);
    for (const raw of morningFrames) expect(JSON.stringify((JSON.parse(raw) as { view: { day: { morning: unknown } } }).view.day.morning)).toBe(JSON.stringify(mornings[0]));
    // 탈락자 X 는 이제 유령이다 — 흔적을 낸 시민(other)의 좌석은 어느 프레임에도 trace 곁에 없다.
    for (const s of g.socks) expect(violationsOfSock(s).join(" | ")).toBe("");
  }, 60_000);

  it("의사가 구한 아침(saved)·아무도 안 고른 아침(빈 {})에는 trace 키가 없다", async () => {
    const g = await startedGame("night");
    const [m1, m2] = withRole(g, "mafia") as [Actor, Actor];
    const x = withRole(g, "citizen")[0]!;
    const doctor = withRole(g, "doctor")[0]!;
    pickAs(m1, x.seat);
    pickAs(m2, x.seat);
    pickAs(doctor, x.seat);
    for (const a of g.actors) await settle(a.sock, mark(a.sock));
    await advanceTo(g.code, g.socks, "morning");
    for (const a of g.actors) await settle(a.sock, 0);
    expect(JSON.stringify(lastViewOf(g.socks[0]!).day?.morning)).toBe(JSON.stringify({ saved: true }));
    for (const s of g.socks) expect(violationsOfSock(s).join(" | ")).toBe("");

    const h = await startedGame("night");
    await advanceTo(h.code, h.socks, "morning");
    for (const a of h.actors) await settle(a.sock, 0);
    expect(JSON.stringify(lastViewOf(h.socks[0]!).day?.morning)).toBe("{}");
  }, 60_000);
});

describe("⑥ 허용 목록 검사는 새 키를 놓치지 않는다 (음성 시험)", () => {
  const stateRaw = (me: Record<string, unknown>, phase = "errand", extra: Record<string, unknown> = {}): string =>
    JSON.stringify({ t: "state", view: { phase, me: { seat: 0, isHost: false, ...me }, day: { n: 1 }, ...extra } });

  it("허용 밖 키(me.errandNear·me.errand.near·me.record[].role·morning.victim)·서버 전용 이름·금지 키·엉뚱한 단계의 새 필드는 실패로 판정한다", () => {
    expect(violationsOf(stateRaw({ errand: { places: ["glass", "piano", "sax"], done: [] } }))).toEqual([]);
    expect(violationsOf(stateRaw({ errandNear: [1, 2] })).join("|")).toContain("server-only .view.me.errandNear");
    expect(violationsOf(stateRaw({ errand: { places: ["glass"], done: [], near: [1] } })).join("|")).toContain("not allowed .view.me.errand.near");
    expect(violationsOf(stateRaw({ errandDone: ["glass"] })).join("|")).toContain("server-only");
    expect(violationsOf(stateRaw({ record: [{ seat: 1, place: "glass", role: "mafia" }] }, "discussion")).join("|")).toContain("not allowed .view.me.record[].role");
    expect(violationsOf(stateRaw({}, "morning", { day: { n: 1, morning: { eliminated: 1, trace: "pin", victim: "mafia" } } })).join("|")).toContain("not allowed .view.day.morning.victim");
    expect(violationsOf(stateRaw({ id: "x" })).join("|")).toContain("forbidden .view.me.id");
    expect(violationsOf(stateRaw({ errand: { places: ["glass", "piano", "sax"], done: [] } }, "discussion")).join("|")).toContain("errand outside errand");
    expect(violationsOf(stateRaw({ record: [] }, "night")).join("|")).toContain("record outside discussion");
    expect(violationsOf(stateRaw({ errand: { places: ["mafia"], done: [] } })).join("|")).toContain("role-like value");
    expect(violationsOf(JSON.stringify({ t: "world", k: "snap", at: 1, ents: [{ s: 1, p: [0, 0], t0: 1, v: 1, role: "mafia" }] })).join("|")).toContain("world path");
  });
});
