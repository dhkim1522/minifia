// 20-01 트레이서: 확장판 판이 마을(town)에서 시작하고(D-01·D-02·D-03), 산 사람의 이동 프레임이 구역으로 걸러진다(D-13·D-14·D-19, 위협 T-20-01·T-20-02).
// 본인·유령은 전체 구간을, 같은 구역의 산 사람은 문턱에서 끝나는 구간만 받고, 다른 구역의 산 사람에게는 그 프레임이 가지 않는다("오지 않았음" 은 settle 로 증명한다).
// 이 폴더는 판 종류의 고정 맵을 잠가 두므로(test/worker/setup.ts) 마을 판은 openTown() 으로 그 시험 동안만 켠다. 위치는 메모리의 world 에 직접 쓴다(helpers 의 townGame·placeSeats).
// 실패 출력은 한 줄이어야 해서(TAP) 프레임은 문자열로 비교한다.
import { describe, expect, it } from "vitest";
import { lineWalkable } from "../../shared/game/map";
import { TOWN_MAP, TOWN_ROOMS } from "../../shared/game/mapTown";
import { zoneOf } from "../../shared/game/zones";
import type { PhaseId, ServerMessage } from "../../shared/protocol";
import { openTown } from "../helpers/playable";
import {
  actorOf,
  actorsOf,
  advanceTo,
  endedGame4,
  flushWorld,
  ghostsOf,
  lastViewOf,
  mark,
  moveAs,
  nextFrame,
  observe,
  placeSeats,
  readyUp,
  seat,
  send,
  settle,
  startedGame,
  storedRoom,
  townGame,
  withRole,
  worldFramesOf,
} from "./helpers";
import type { Actor, Game } from "./helpers";

type MoveFrame = Extract<ServerMessage, { t: "world"; k: "move" }>;
type StateFrame = Extract<ServerMessage, { t: "state" }>;

const POST = TOWN_ROOMS.find((r) => r.id === "post")!;
/** 우체국 안의 또 다른 걷는 칸 중심(방 안 자리와 다른 곳). */
const POST_SIDE = { x: 75, z: -775 };
/** 광장 한가운데 근처의 걷는 자리(입장 지점 0). */
const PLAZA_SPOT = { x: 320, z: 180 };

const isAssigning = (m: ServerMessage): boolean => m.t === "state" && m.view.phase === "assigning";
/** 기본 마피아로 고른 4명 판을 phase 까지 넘긴다(startedGame 과 같은 순서). 고정 맵을 켠 채(제품과 같은 표) 시작해도 방장 선택대로여야 한다. */
async function basicGame(phase: PhaseId): Promise<Game> {
  const close = openTown();
  try {
    const room = await seat(3, 0);
    const socks = [room.host, ...room.guests.map((g) => g.sock)];
    send(room.host, { t: "modePick", mode: "basic" });
    for (const s of socks) await nextFrame(s, (m) => m.t === "state" && m.view.mode === "basic");
    send(room.host, { t: "start" });
    for (const s of socks) await nextFrame(s, isAssigning);
    await advanceTo(room.code, socks, "dayAnnounce");
    for (const s of socks) await settle(s, mark(s));
    const actors = actorsOf(room);
    await advanceTo(room.code, socks, phase);
    for (const s of socks) await settle(s, mark(s));
    return { code: room.code, socks, actors };
  } finally {
    close();
  }
}

/** 그 좌석의 move 프레임들. */
const movesOf = (msgs: ServerMessage[], seatNo: number): MoveFrame[] => msgs.filter((m): m is MoveFrame => m.t === "world" && m.k === "move" && m.s === seatNo);
/** 프레임 꼭짓점들이 지나는 구역(중복 없이, 처음 나온 순서). */
function zonesOf(f: MoveFrame): string {
  const seen: string[] = [];
  for (let i = 0; i + 1 < f.p.length; i += 2) {
    const zone = zoneOf(TOWN_MAP, f.p[i]!, f.p[i + 1]!);
    if (!seen.includes(zone)) seen.push(zone);
  }
  return seen.join(">");
}
/** "프레임 수: 꼭짓점들 [구역들] | …" 한 줄. */
const line = (frames: MoveFrame[]): string => `${frames.length}: ${frames.map((f) => `${f.p.join(",")} [${zonesOf(f)}]`).join(" | ")}`;

describe("확장판 판은 마을에서 시작한다 (D-01·D-02·D-03)", () => {
  it("확장판(기본값) 방을 시작하면 네 소켓 모두 assigning 의 view.map 이 town 이고, 대기실의 view.map 은 town 이 아니다", { timeout: 30_000 }, async () => {
    const close = openTown();
    try {
      const room = await seat(3, 0);
      const socks = [room.host, ...room.guests.map((g) => g.sock)];
      const lobbyMaps = socks.map((s) => String(lastViewOf(s).map)).join(",");
      send(room.host, { t: "start" });
      const maps: string[] = [];
      for (const s of socks) maps.push(String(((await nextFrame(s, isAssigning)) as StateFrame).view.map));
      expect(`${lobbyMaps} / ${maps.join(",")} / ${(await storedRoom(room.code) as unknown as { map?: string }).map}`).toBe("undefined,undefined,undefined,undefined / town,town,town,town / town");
    } finally {
      close();
    }
  });

  it("같은 구성에서 판 종류를 기본 마피아로 바꾸면 시작 뒤 view.map 은 방장 선택대로(이 폴더의 잠금으로 bar)다", { timeout: 30_000 }, async () => {
    const close = openTown();
    try {
      const room = await seat(3, 0);
      const socks = [room.host, ...room.guests.map((g) => g.sock)];
      send(room.host, { t: "modePick", mode: "basic" });
      for (const s of socks) await nextFrame(s, (m) => m.t === "state" && m.view.mode === "basic");
      send(room.host, { t: "start" });
      const maps: string[] = [];
      for (const s of socks) maps.push(String(((await nextFrame(s, isAssigning)) as StateFrame).view.map));
      expect(maps.join(",")).toBe("bar,bar,bar,bar");
    } finally {
      close();
    }
  });
});

describe("마을 판의 이동 프레임은 구역으로 걸러진다 (D-13·D-14·D-19, T-20-01)", () => {
  it("문 앞의 산 사람이 우체국 안으로 걸으면: 본인은 방 안 자리까지 전체, 광장의 산 사람은 문턱에서 끝나는 구간, 방 안의 산 사람은 아무것도 받지 않는다", { timeout: 60_000 }, async () => {
    const g = await townGame("discussion");
    const [a, b, c] = [actorOf(g, 0), actorOf(g, 1), actorOf(g, 2)];
    await placeSeats(g.code, { 0: POST.front, 1: PLAZA_SPOT, 2: POST_SIDE });
    const frames = await observe(g, a, () => moveAs(a, POST.inside.x, POST.inside.z));
    const got = [a, b, c].map((who) => line(movesOf(frames[g.actors.indexOf(who)]!, a.seat))).join(" // ");
    const full = `${POST.front.x},${POST.front.z},${POST.inside.x},${POST.inside.z}`;
    const clipped = `${POST.front.x},${POST.front.z},${POST.inside.x},${POST.inner.z1}`;
    expect(got).toBe(`1: ${full} [plaza>post] // 1: ${clipped} [plaza] // 0: `);
    // 광장에 선 나머지 산 사람(좌석 3·4·5)도 문턱에서 끝나는 같은 구간을 받는다
    const others = [3, 4, 5].map((s) => line(movesOf(frames[g.actors.indexOf(actorOf(g, s))]!, a.seat)));
    expect([...new Set(others)].join(" // ")).toBe(`1: ${clipped} [plaza]`);
  });

  it("우체국 안의 산 사람이 광장으로 나오면: 본인은 전체, 같은 방의 산 사람은 문턱 앞에서 끝나는 구간, 광장의 산 사람은 아무것도 받지 않는다", { timeout: 60_000 }, async () => {
    const g = await townGame("discussion");
    const [a, b, c, d] = [actorOf(g, 0), actorOf(g, 1), actorOf(g, 2), actorOf(g, 3)];
    await placeSeats(g.code, { 0: POST.front, 1: PLAZA_SPOT, 2: POST.inside, 3: POST_SIDE });
    const frames = await observe(g, c, () => moveAs(c, POST.front.x, POST.front.z));
    const of = (who: Actor): MoveFrame[] => movesOf(frames[g.actors.indexOf(who)]!, c.seat);
    const mine = of(c)[0];
    const roomMate = of(d)[0];
    const got = [
      `${of(c).length}:${mine === undefined ? "" : `${mine.p.at(-2)},${mine.p.at(-1)} [${zonesOf(mine)}]`}`,
      `${of(d).length}:${roomMate === undefined ? "" : `z=${roomMate.p.at(-1)} [${zonesOf(roomMate)}]`}`,
      `${of(a).length}`,
      `${of(b).length}`,
    ].join(" // ");
    expect(got).toBe(`1:${POST.front.x},${POST.front.z} [post>plaza] // 1:z=${POST.inner.z1 - 1} [post] // 0 // 0`);
  });

  it("유령은 구역과 상관없이 전체 구간을 받는다(탈락자 관전, 결정 0021)", { timeout: 60_000 }, async () => {
    const g = await townGame("discussion");
    const citizen = withRole(g, "citizen")[0]!;
    const { living } = await ghostsOf(g, [citizen.seat]);
    const [a, b] = [living[0]!, living[1]!];
    await placeSeats(g.code, { [a.seat]: POST.front, [b.seat]: PLAZA_SPOT, [citizen.seat]: PLAZA_SPOT });
    const frames = await observe(g, a, () => moveAs(a, POST.inside.x, POST.inside.z));
    const got = [citizen, b].map((who) => line(movesOf(frames[g.actors.indexOf(who)]!, a.seat))).join(" // ");
    const head = `${POST.front.x},${POST.front.z},${POST.inside.x}`;
    expect(got).toBe(`1: ${head},${POST.inside.z} [plaza>post] // 1: ${head},${POST.inner.z1} [plaza]`);
  });

  it("서버가 단계 배치로 걷게 할 때도(syncLayout) 방 안 사람의 좌표는 광장의 산 사람에게 가지 않고 본인은 전체 구간을 받는다", { timeout: 60_000 }, async () => {
    const g = await townGame("discussion");
    const [b, c] = [actorOf(g, 1), actorOf(g, 2)];
    await placeSeats(g.code, { 1: PLAZA_SPOT, 2: POST.inside });
    await flushWorld(g.code);
    const marks = g.socks.map((s) => mark(s));
    await advanceTo(g.code, g.socks, "nomination");
    const after: ServerMessage[][] = [];
    for (let i = 0; i < g.socks.length; i++) after.push(await settle(g.socks[i]!, marks[i]!));
    const mine = movesOf(after[g.actors.indexOf(c)]!, c.seat);
    const seenByB = movesOf(after[g.actors.indexOf(b)]!, c.seat);
    const leaked = seenByB.filter((f) => zonesOf(f) !== "plaza").length;
    const othersSeenByB = worldFramesOf(g.socks[g.actors.indexOf(b)]!, marks[g.actors.indexOf(b)]!).filter((f) => f.k === "move" && f.s !== c.seat).length;
    expect(`${mine.length}:${mine[0] === undefined ? "" : zonesOf(mine[0])} leaked=${leaked} others>0=${othersSeenByB > 0}`).toBe("1:post>plaza leaked=0 others>0=true");
  });

  it("좌표 한계 끝(±1200)으로 가라는 요청은 서버가 걷기 한계(±10) 안의 걷는 자리로 보정한다 (T-20-02)", { timeout: 60_000 }, async () => {
    const g = await townGame("discussion");
    const a = actorOf(g, 0);
    await placeSeats(g.code, { 0: PLAZA_SPOT });
    const frames = await observe(g, a, () => moveAs(a, 1200, 1200));
    const mine = movesOf(frames[g.actors.indexOf(a)]!, a.seat)[0];
    const end = mine === undefined ? { x: 9999, z: 9999 } : { x: mine.p.at(-2)!, z: mine.p.at(-1)! };
    expect(`${mine !== undefined} ${Math.abs(end.x) <= 1000 && Math.abs(end.z) <= 1000} ${lineWalkable(TOWN_MAP, end, end)}`).toBe("true true true");
  });
});

describe("방이 없는 맵은 구역이 하나다 — 재즈 바 판의 이동 프레임은 그대로 (D-04)", () => {
  it("재즈 바에서 도는 판(잠금 그대로)의 이동 요청은 모든 소켓이 같은 move 프레임 하나를 받는다", { timeout: 60_000 }, async () => {
    const g = await startedGame("discussion", 3);
    const a = actorOf(g, 0);
    const frames = await observe(g, a, () => moveAs(a, 25, -575));
    const lines = g.actors.map((who) => movesOf(frames[g.actors.indexOf(who)]!, a.seat).map((f) => JSON.stringify(f)).join("|"));
    expect(`${String(lastViewOf(a.sock).map)} ${new Set(lines).size} ${lines[0]!.length > 0 && !lines[0]!.includes("|")}`).toBe("bar 1 true");
  });
});

describe("기본 마피아 판은 고정 맵이 켜져 있어도 재즈 바 그대로다 (D-02·D-04)", () => {
  it("기본 마피아 판의 이동 요청은 모든 소켓이 같은 move 프레임 하나를 받고, 우체국 자리로 가라는 요청도 재즈 바의 걷는 자리로 보정된다", { timeout: 60_000 }, async () => {
    const g = await basicGame("discussion");
    const a = actorOf(g, 0);
    const frames = await observe(g, a, () => moveAs(a, POST.inside.x, POST.inside.z));
    const lines = g.actors.map((who) => movesOf(frames[g.actors.indexOf(who)]!, a.seat).map((f) => f.p.join(",")).join("|"));
    const end = lines[0]!.split(",").slice(-2).map(Number);
    expect(`${String(lastViewOf(a.sock).mode)}/${String(lastViewOf(a.sock).map)} ${new Set(lines).size} ${lines[0]!.length > 0 && !lines[0]!.includes("|")} ${Math.abs(end[0]!) <= 580 && Math.abs(end[1]!) <= 580}`).toBe(
      "basic/bar 1 true true",
    );
  });
});

describe("다시 하기로 시작한 확장판 판도 마을이다 (D-02)", () => {
  it("끝난 판에서 모두 준비하고 방장이 rematch 하면 round 2 의 view.map 이 모든 소켓에서 town 이다", { timeout: 60_000 }, async () => {
    const g = await endedGame4();
    const host = g.socks[0]!;
    await readyUp(g.socks.slice(1), g.socks, 4);
    const close = openTown();
    try {
      send(host, { t: "rematch", round: 1 });
      const got: string[] = [];
      for (const s of g.socks) {
        const view = ((await nextFrame(s, isAssigning)) as StateFrame).view;
        got.push(`${view.round}:${String(view.map)}`);
      }
      expect(got.join(",")).toBe("2:town,2:town,2:town,2:town");
    } finally {
      close();
    }
  });
});
