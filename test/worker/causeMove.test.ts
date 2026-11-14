// 21-05 위치·가시성 워커 시험(D-10·D-11·D-13·D-18, A5, 위협 T-21-17·T-21-21): 마을 확장판 원인 흐름에서
//  - 밤이 시작되면 산 사람 모두가 자기 집 앞(TOWN_HOUSES front)에 서고 걷지 못하며, 남의 좌표는 가지 않는다(본인 한 칸).
//  - 아침에는 산 사람이 걷고, 걸음은 본인과 유령만 받으며 근처(같은 구역 + 반경) 사람은 표본 알람의 근처 snap 으로만 본다. 아침 표본은 목격 기록을 쌓지 않는다(저장 없음).
//  - 암살 피해자의 분필은 피해자 집 앞이다.
//  - 토론이 시작되면 산 사람이 둘레 자리로 걸어 모이고, 토론 중 걷기는 받아들여지며, 지목 진입에서 다시 둘레로 모인다.
//  - 밤 pick 은 자기 집·동료 집을 골라도 같은 응답이고 마지막 선택이 이긴다(D-10).
// 위치는 메모리 world 에 직접 놓는다(placeSeats). "오지 않았음" 은 settle(ping/pong)로 증명한다. 다른 시험 파일을 import 하지 않는다. 실패 출력은 한 줄이어야 해서(TAP) 목록은 문자열로 비교한다.
import { env } from "cloudflare:workers";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ringSlots } from "../../shared/game/gather";
import { TOWN_HOUSES } from "../../shared/game/mapTown";
import type { ServerMessage } from "../../shared/protocol";
import { openCause, openTown } from "../helpers/playable";
import { actorsOf, advanceTo, alarmAndCollect, flushWorld, lastViewOf, mark, memWorld, moveAs, nextFrame, pause, pickAs, placeSeats, seat, send, settle, storedRoom, withRole, worldsIn, writeRoomEdit } from "./helpers";
import type { Actor, Game } from "./helpers";

type Snap = Extract<ServerMessage, { t: "world"; k: "snap" }>;
type Move = Extract<ServerMessage, { t: "world"; k: "move" }>;
const snapsOf = (msgs: ServerMessage[]): Snap[] => worldsIn(msgs).filter((f): f is Snap => f.k === "snap");
const movesOf = (msgs: ServerMessage[]): Move[] => worldsIn(msgs).filter((f): f is Move => f.k === "move");
const seatsOf = (snap: Snap | undefined): string => (snap === undefined ? "none" : snap.ents.map((e) => e.s).join(","));
const endOf = (p: readonly number[]): string => `${p.at(-2)},${p.at(-1)}`;
const frontOf = (seatNo: number): string => `${TOWN_HOUSES[seatNo]!.front.x},${TOWN_HOUSES[seatNo]!.front.z}`;

/** 6명이 시작해 저녁(errand)까지 넘긴 판. */
async function eveningGame(): Promise<Game> {
  const room = await seat(5, 0);
  const socks = [room.host, ...room.guests.map((g) => g.sock)];
  send(room.host, { t: "start" });
  for (const sock of socks) await nextFrame(sock, (m) => m.t === "state" && m.view.phase === "assigning");
  await advanceTo(room.code, socks, "errand");
  for (const sock of socks) await settle(sock, mark(sock));
  return { code: room.code, socks, actors: actorsOf(room) };
}

/** 저녁 끝 자리가 제각각이게 놓고 밤으로 넘긴 판. 밤 진입 때 각 소켓이 받은 프레임을 같이 돌려준다. */
async function nightGame(): Promise<{ g: Game; frames: ServerMessage[][] }> {
  const g = await eveningGame();
  const spots = [{ x: 320, z: 180 }, { x: -420, z: 380 }, { x: 520, z: 520 }, { x: -320, z: -180 }, { x: 420, z: -380 }, { x: 0, z: 320 }];
  await placeSeats(g.code, Object.fromEntries(g.actors.map((a, i) => [a.seat, spots[i]!])));
  await flushWorld(g.code);
  const marks = g.socks.map((s) => mark(s));
  await advanceTo(g.code, g.socks, "night");
  const frames: ServerMessage[][] = [];
  for (const [i, s] of g.socks.entries()) frames.push(await settle(s, marks[i]!));
  return { g, frames };
}

/** 밤에서 마피아 둘과 시민 c2 가 시민 victim 을 골라 아침(피해자 있음)까지 넘긴 판. */
async function morningGame(): Promise<{ g: Game; victim: Actor; living: Actor[] }> {
  const { g } = await nightGame();
  await writeRoomEdit(env.ROOM.getByName(g.code), (r) => ({ ...r, lamps: Array.from({ length: 8 }, () => true) }));
  const [m1, m2] = withRole(g, "mafia") as [Actor, Actor];
  const [victim, c2] = withRole(g, "citizen") as [Actor, Actor];
  const police = withRole(g, "police")[0]!;
  const doctor = withRole(g, "doctor")[0]!;
  for (const [who, target] of [[m1, victim], [m2, victim], [c2, victim], [police, doctor], [doctor, police]] as Array<[Actor, Actor]>) pickAs(who, target.seat);
  for (const sock of g.socks) await settle(sock, mark(sock));
  await advanceTo(g.code, g.socks, "morning");
  for (const sock of g.socks) await settle(sock, mark(sock));
  return { g, victim, living: g.actors.filter((a) => a.seat !== victim.seat) };
}

describe("마을 확장판 위치 — 밤 집 앞·아침 근처·토론 모이기 (openCause + openTown)", () => {
  let restoreCause: () => void = () => {};
  let restoreTown: () => void = () => {};
  beforeAll(() => {
    restoreCause = openCause();
    restoreTown = openTown();
  });
  afterAll(() => {
    restoreTown();
    restoreCause();
  });

  it("밤 진입: 제각각이던 산 사람 여섯이 모두 자기 집 앞에 서고, 각 소켓의 snap 은 본인 한 칸뿐이다(남의 좌표 없음). 밤의 move 는 무변화다", { timeout: 120_000 }, async () => {
    const { g, frames } = await nightGame();
    const own = g.actors.map((a, i) => `${a.seat}@${endOf(snapsOf(frames[i]!).at(-1)?.ents.find((e) => e.s === a.seat)?.p ?? [])}`).join(" ");
    expect(own).toBe(g.actors.map((a) => `${a.seat}@${frontOf(a.seat)}`).join(" "));
    expect(g.actors.map((a, i) => seatsOf(snapsOf(frames[i]!).at(-1))).join("|")).toBe(g.actors.map((a) => `${a.seat}`).join("|"));
    const before = (await memWorld(g.code)).segs;
    const marks = g.socks.map((s) => mark(s));
    moveAs(g.actors[0]!, 100, 100);
    const got: number[] = [];
    for (const [i, s] of g.socks.entries()) got.push(worldsIn(await settle(s, marks[i]!)).length);
    const after = (await memWorld(g.code)).segs;
    expect(`${got.join(",")}|${JSON.stringify(after) === JSON.stringify(before)}`).toBe("0,0,0,0,0,0|true");
  });

  it("아침: 산 사람이 걷는다(본인 + 유령만 걸음을 받는다). 근처 표본은 근처 사람만 싣고 목격 기록을 쌓거나 저장하지 않는다 (A5·T-21-17)", { timeout: 120_000 }, async () => {
    const { g, victim, living } = await morningGame();
    const [a, c, b, d, e] = living as [Actor, Actor, Actor, Actor, Actor];
    const stored = (await storedRoom(g.code)) as unknown as { errandTickAt?: number; players: Array<{ seat: number; errandNear?: number[]; errandSeen?: unknown[] }> };
    expect(typeof stored.errandTickAt).toBe("number");
    const personal = (rows: typeof stored.players): string => JSON.stringify(rows.map((p) => [p.seat, p.errandNear ?? null, p.errandSeen ?? null]));
    const evening = personal(stored.players);
    // A·C 는 서로 근처, B·D·E 는 멀리 — 모두 같은 광장 구역.
    await placeSeats(g.code, { [a.seat]: { x: 320, z: 180 }, [c.seat]: { x: 420, z: 180 }, [b.seat]: { x: -420, z: 380 }, [d.seat]: { x: 520, z: 520 }, [e.seat]: { x: -320, z: -380 } });
    const marks = g.socks.map((s) => mark(s));
    moveAs(a, 370, 180);
    const moveFrames: ServerMessage[][] = [];
    for (const [i, s] of g.socks.entries()) moveFrames.push(await settle(s, marks[i]!));
    const byActor = (who: Actor, frames: ServerMessage[][]): ServerMessage[] => frames[g.actors.indexOf(who)]!;
    const walked = [a, victim, c, b, d, e].map((who) => `${who === victim ? "ghost" : who === a ? "A" : who === c ? "C" : "far"}:${movesOf(byActor(who, moveFrames)).filter((m) => m.s === a.seat).length}`).join(" ");
    expect(walked).toBe("A:1 ghost:1 C:0 far:0 far:0 far:0");
    // 표본 알람: 근처 snap — C 는 A 와 함께, 먼 사람은 본인뿐이다.
    await writeRoomEdit(env.ROOM.getByName(g.code), (room) => ({ ...room, errandTickAt: Date.now() - 1 }));
    const frames = await alarmAndCollect(g, g.socks.map((s) => mark(s)));
    const near = (who: Actor): string => seatsOf(snapsOf(byActor(who, frames)).at(-1));
    expect(`A=${near(a)} C=${near(c)} B=${near(b)} D=${near(d)} E=${near(e)}`).toBe(`A=${[a.seat, c.seat].sort((x, y) => x - y).join(",")} C=${[a.seat, c.seat].sort((x, y) => x - y).join(",")} B=${b.seat} D=${d.seat} E=${e.seat}`);
    const after = (await storedRoom(g.code)) as unknown as typeof stored;
    expect(`${personal(after.players) === evening}`).toBe("true");
  });

  it("아침 분필(day.chalk)은 피해자 집 앞 좌표다", { timeout: 120_000 }, async () => {
    const { g, victim } = await morningGame();
    const chalk = (lastViewOf(g.socks[0]!).day as { chalk?: { x: number; z: number } } | undefined)?.chalk;
    expect(`${chalk?.x},${chalk?.z}`).toBe(frontOf(victim.seat));
  });

  it("토론 진입: 산 사람 모두에게 둘레 자리로 가는 move 프레임이 가고, 토론 중 걷기는 받아들여지며, 지목 진입에서 다시 둘레로 가는 move 가 간다", { timeout: 180_000 }, async () => {
    const { g, living } = await morningGame();
    const marks = g.socks.map((s) => mark(s));
    await advanceTo(g.code, g.socks, "discussion");
    const frames: ServerMessage[][] = [];
    for (const [i, s] of g.socks.entries()) frames.push(await settle(s, marks[i]!));
    const ring = ringSlots(living.length).map((s) => `${s[0]},${s[1]}`);
    const mine = (who: Actor, f: ServerMessage[][]): Move[] => movesOf(f[g.actors.indexOf(who)]!);
    const gathered = living.map((who) => {
      const own = mine(who, frames).filter((m) => m.s === who.seat);
      return `${who.seat}:${own.length}:${ring.includes(endOf(own.at(-1)?.p ?? []))}`;
    });
    expect(gathered.join(" ")).toBe(living.map((who) => `${who.seat}:1:true`).join(" "));
    // 산 사람이 서로의 move 도 받는다(토론 단계는 방 전원 공개 — 둘레로 걷는 모습).
    expect(living.map((who) => new Set(mine(living[0]!, frames).map((m) => m.s)).has(who.seat)).join(",")).toBe("true,true,true,true,true");
    // 토론 중 걷기는 받아들여진다.
    const walker = living[0]!;
    const walkMarks = g.socks.map((s) => mark(s));
    moveAs(walker, 0, 300);
    const walked: ServerMessage[][] = [];
    for (const [i, s] of g.socks.entries()) walked.push(await settle(s, walkMarks[i]!));
    expect(mine(walker, walked).filter((m) => m.s === walker.seat).length).toBe(1);
    // 지목 진입: 걸어 나갔던 사람이 다시 둘레로 모인다.
    await pause(200);
    const nomMarks = g.socks.map((s) => mark(s));
    await advanceTo(g.code, g.socks, "nomination");
    const back: ServerMessage[][] = [];
    for (const [i, s] of g.socks.entries()) back.push(await settle(s, nomMarks[i]!));
    const again = mine(living[1]!, back).filter((m) => m.s === walker.seat);
    expect(`${again.length}:${ring.includes(endOf(again.at(-1)?.p ?? []))}`).toBe("1:true");
  });

  it("D-10: 밤 pick 은 자기 집·동료 집을 골라도 같은 응답이고(오류 없음, state 한 프레임) 마지막 선택이 이긴다", { timeout: 120_000 }, async () => {
    const { g } = await nightGame();
    const [m1, m2] = withRole(g, "mafia") as [Actor, Actor];
    const [c1] = withRole(g, "citizen") as [Actor];
    const reply = async (who: Actor, target: number): Promise<string> => {
      const from = mark(who.sock);
      pickAs(who, target);
      const got = await settle(who.sock, from);
      return got.map((m) => m.t).join("+");
    };
    const own = await reply(c1, c1.seat);
    const ally = await reply(m1, m2.seat);
    const plain = await reply(c1, m1.seat);
    expect(`${own}|${ally}|${plain}`).toBe("state|state|state");
    // 두 번 고르면 마지막 값이 me.pick 이다.
    await reply(m1, m2.seat);
    await reply(m1, c1.seat);
    expect(`${(lastViewOf(m1.sock).me as { pick?: number }).pick}|${(lastViewOf(c1.sock).me as { pick?: number }).pick}`).toBe(`${c1.seat}|${m1.seat}`);
  });
});
