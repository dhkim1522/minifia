// 21-05 건너뛰기 워커 시험(D-21·D-23, 위협 T-21-18·T-21-20): 확장판 저녁·아침에 산 사람이 skip 을 누르면 누른 수(day.skipCount)만 모두에게 공개되고,
// 산 사람 과반이 누르는 순간 서버가 그 단계를 곧바로 마감해 다음 단계로 간다. 취소(on false)는 수를 줄인다. 누가 눌렀는지는 본인 view(me.skip)에만 있다.
// 판은 마을 확장판 원인 흐름(openCause + openTown), 참가자 여섯(방장 + 손님 다섯 — 산 사람 여섯의 과반은 네 명).
// 다른 시험 파일을 import 하지 않는다. 실패 출력은 한 줄이어야 해서(TAP) 목록은 문자열로 비교한다.
import { env } from "cloudflare:workers";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { RoomView } from "../../shared/protocol";
import { openCause, openTown } from "../helpers/playable";
import { actorsOf, advanceTo, lastViewOf, mark, nextFrame, pickAs, seat, send, settle, withRole, writeRoomEdit } from "./helpers";
import type { Actor, Game } from "./helpers";

const skipOf = (view: RoomView): number | undefined => (view.day as { skipCount?: number } | undefined)?.skipCount;
const mineOf = (view: RoomView): boolean => (view.me as { skip?: true }).skip === true;

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

/** 저녁 → 밤 → 아침(피해자 있음 — 아침 길이가 0 이 아니다)까지 넘긴 판. */
async function morningGame(): Promise<Game> {
  const g = await eveningGame();
  await advanceTo(g.code, g.socks, "night");
  for (const sock of g.socks) await settle(sock, mark(sock));
  await writeRoomEdit(env.ROOM.getByName(g.code), (r) => ({ ...r, lamps: Array.from({ length: 8 }, () => true) }));
  const [m1, m2] = withRole(g, "mafia") as [Actor, Actor];
  const [victim, c2] = withRole(g, "citizen") as [Actor, Actor];
  const police = withRole(g, "police")[0]!;
  const doctor = withRole(g, "doctor")[0]!;
  for (const [who, target] of [[m1, victim], [m2, victim], [c2, victim], [police, doctor], [doctor, police]] as Array<[Actor, Actor]>) pickAs(who, target.seat);
  for (const sock of g.socks) await settle(sock, mark(sock));
  await advanceTo(g.code, g.socks, "morning");
  for (const sock of g.socks) await settle(sock, mark(sock));
  return g;
}

/** 한 사람이 skip 을 보내고, 모든 소켓이 그 결과 프레임을 받을 때까지 기다린다(settle). */
async function press(g: Game, who: Actor, on: boolean): Promise<void> {
  const marks = g.socks.map((s) => mark(s));
  send(who.sock, { t: "skip", on });
  for (const [i, s] of g.socks.entries()) await settle(s, marks[i]!);
}

const countsOf = (g: Game): string => g.socks.map((s) => skipOf(lastViewOf(s)) ?? "-").join(",");
const minesOf = (g: Game): string => g.actors.map((a) => (mineOf(lastViewOf(a.sock)) ? a.seat : "-")).join(",");

describe("건너뛰기 — 마을 확장판 저녁·아침 (openCause + openTown)", () => {
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

  it("저녁: 누를 때마다 모든 소켓의 day.skipCount 가 같은 수로 오르고 me.skip 은 누른 본인에게만 있다. 취소는 수를 줄인다", { timeout: 120_000 }, async () => {
    const g = await eveningGame();
    expect(`${lastViewOf(g.socks[0]!).phase}|${countsOf(g)}`).toBe("errand|0,0,0,0,0,0");
    const [a, b, c] = g.actors as [Actor, Actor, Actor];
    await press(g, a, true);
    expect(`${countsOf(g)}|${minesOf(g)}`).toBe(`1,1,1,1,1,1|${a.seat},-,-,-,-,-`);
    await press(g, b, true);
    expect(countsOf(g)).toBe("2,2,2,2,2,2");
    await press(g, c, true);
    expect(countsOf(g)).toBe("3,3,3,3,3,3");
    await press(g, c, false);
    expect(`${countsOf(g)}|${minesOf(g)}`).toBe(`2,2,2,2,2,2|${a.seat},${b.seat},-,-,-,-`);
    // 같은 값을 다시 보내도 수는 그대로다(연타 — 저장·방송 없음).
    const marks = g.socks.map((s) => mark(s));
    send(a.sock, { t: "skip", on: true });
    const frames: number[] = [];
    for (const [i, s] of g.socks.entries()) frames.push((await settle(s, marks[i]!)).filter((m) => m.t === "state").length);
    expect(`${frames.join(",")}|${countsOf(g)}`).toBe("0,0,0,0,0,0|2,2,2,2,2,2");
  });

  it("저녁: 산 사람 과반(여섯 중 넷)이 누르는 순간 모든 소켓의 다음 상태 프레임이 밤이고, 새 밤의 view 에는 skipCount 가 없다", { timeout: 120_000 }, async () => {
    const g = await eveningGame();
    for (const who of g.actors.slice(0, 3)) await press(g, who, true);
    expect(`${lastViewOf(g.socks[0]!).phase}|${countsOf(g)}`).toBe("errand|3,3,3,3,3,3");
    const marks = g.socks.map((s) => mark(s));
    send(g.actors[3]!.sock, { t: "skip", on: true });
    const phases: string[] = [];
    for (const [i, s] of g.socks.entries()) {
      const next = await nextFrame(s, (m) => m.t === "state" && m.view.phase !== "errand");
      await settle(s, marks[i]!);
      phases.push(next.t === "state" ? next.view.phase : next.t);
    }
    expect(phases.join(",")).toBe("night,night,night,night,night,night");
    expect(`${countsOf(g)}|${minesOf(g)}`).toBe("-,-,-,-,-,-|-,-,-,-,-,-");
  });

  it("아침: 같은 규칙으로 과반이 누르면 곧바로 토론으로 넘어간다", { timeout: 120_000 }, async () => {
    const g = await morningGame();
    expect(`${lastViewOf(g.socks[0]!).phase}|${countsOf(g)}`).toBe("morning|0,0,0,0,0,0");
    for (const who of g.actors.slice(0, 3)) await press(g, who, true);
    expect(countsOf(g)).toBe("3,3,3,3,3,3");
    send(g.actors[3]!.sock, { t: "skip", on: true });
    const phases: string[] = [];
    for (const s of g.socks) {
      const next = await nextFrame(s, (m) => m.t === "state" && m.view.phase !== "morning");
      phases.push(next.t === "state" ? next.view.phase : next.t);
    }
    expect(phases.join(",")).toBe("discussion,discussion,discussion,discussion,discussion,discussion");
  });

  it("토론에서 보낸 skip 은 받지 않는다 — 수가 생기지 않고 단계가 그대로다", { timeout: 120_000 }, async () => {
    const g = await morningGame();
    await advanceTo(g.code, g.socks, "discussion");
    for (const s of g.socks) await settle(s, mark(s));
    for (const who of g.actors) send(who.sock, { t: "skip", on: true });
    for (const s of g.socks) await settle(s, 0);
    expect(`${lastViewOf(g.socks[0]!).phase}|${countsOf(g)}|${minesOf(g)}`).toBe("discussion|-,-,-,-,-,-|-,-,-,-,-,-");
  });
});
