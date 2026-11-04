// review-WR-01, 결정 0061-3·4, 알람 지연 재현 (09-24).
// 알람이 아침 길이 이상 늦어 한 번의 tick 이 밤 → 아침 → 낮 시작을 지나가도, 밤에 걸은 마피아의 구간이 버려지고 산 사람 전원이 home 에 서며
// 소켓마다 아침 경로와 같은 규칙(worldVisibleTo)의 snap 을 한 번 받는다. 정상 경로 누설 시험은 nightLeak.test.ts 가 그대로 지킨다.
import { runDurableObjectAlarm, runInDurableObject } from "cloudflare:test";
import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import type { ServerMessage } from "../../shared/protocol";
import { MORNING_MAX_MS } from "../../shared/game/phases";
import { editRoom, flushWorld, homeBySeat, layOf, mark, moveAs, nextFrame, pause, pickAs, segEndsBySeat, settle, snapSeatsOf, startedGame, withRole, worldFramesOf, worldOf } from "./helpers";
import type { Game } from "./helpers";

/** 마지막 world snap 의 '좌석:x,z' 오름차순 문자열. snap 이 없으면 'none'. */
function snapPoints(msgs: ServerMessage[]): string {
  const snaps = msgs.filter((m): m is Extract<ServerMessage, { t: "world"; k: "snap" }> => m.t === "world" && m.k === "snap");
  const last = snaps.at(-1);
  if (last === undefined) return "none";
  return [...last.ents].sort((a, b) => a.s - b.s).map((e) => `${e.s}:${e.p.join(",")}`).join("|");
}

/** home 문자열('일차|0:x,z|...') 중 이 좌석들만. */
const homeRows = (home: string, seats: number[]): string =>
  home
    .split("|")
    .slice(1)
    .filter((row) => seats.includes(Number(row.split(":")[0])))
    .join("|");

/** 밤에 마피아 둘이 시민 한 명을 고르고 마피아 한 명이 걷게 한 뒤, 아침 길이 + 1초 늦게 알람을 돌려 낮 시작 쪽으로 한 번에 따라잡는다. */
async function lateCatchup(withVictim: boolean): Promise<{ g: Game; victim: Game["actors"][number]; walker: Game["actors"][number]; home: string; before: string; got: ServerMessage[][]; marks: number[] }> {
  const g = await startedGame("night");
  const [walker, other] = withRole(g, "mafia") as [Game["actors"][number], Game["actors"][number]];
  const victim = withRole(g, "citizen")[0]!;
  if (withVictim) {
    pickAs(walker, victim.seat);
    pickAs(other, victim.seat);
  }
  moveAs(walker, 300, 100);
  await pause(200);
  moveAs(walker, 200, -100);
  for (const sock of g.socks) await settle(sock, mark(sock));
  await flushWorld(g.code);
  const home = await homeBySeat(g.code);
  const before = await segEndsBySeat(g.code, 1);
  await editRoom(g.code, (room) => ({ ...room, phaseEndsAt: Date.now() - (MORNING_MAX_MS + 1000) }));
  const marks = g.socks.map((s) => mark(s));

  expect(await runDurableObjectAlarm(env.ROOM.getByName(g.code))).toBe(true);
  for (const sock of g.socks) await nextFrame(sock, (m) => m.t === "state" && (m.view.phase === "dayAnnounce" || m.view.phase === "discussion"));
  const got = await Promise.all(g.actors.map((a, i) => settle(a.sock, marks[i]!)));
  return { g, victim, walker, home, before, got, marks };
}

describe("알람 따라잡기 — 밤 → 아침 → 낮 시작 (review-WR-01)", () => {
  it("피해자가 없는 밤: 걷던 마피아의 구간이 버려져 산 사람 여섯 모두 home 에 서고, 소켓마다 snap 이 하나다", async () => {
    const { g, walker, home, got, marks } = await lateCatchup(false);
    const everyone = g.actors.map((a) => a.seat).sort((p, q) => p - q);

    // 밤에 걸은 마피아의 구간 끝점이 자기 home 좌표다(밤 걸음 버림)
    const ends = await segEndsBySeat(g.code, 1);
    expect(homeRows(ends, [walker.seat])).toBe(homeRows(home, [walker.seat]));
    expect(homeRows(ends, everyone)).toBe(homeRows(home, everyone));

    for (const a of g.actors) {
      const i = g.actors.indexOf(a);
      expect(`${a.role}:${worldFramesOf(a.sock, marks[i]!).map((m) => m.k).join(",")}`).toBe(`${a.role}:snap`);
      expect(snapSeatsOf(got[i]!)).toBe(everyone.join(","));
      expect(snapPoints(got[i]!)).toBe(homeRows(home, everyone));
    }
  }, 40_000);

  it("피해자가 있는 밤: 산 다섯 소켓은 산 사람 다섯의 snap 하나, 탈락한 피해자 소켓은 여섯 모두의 snap 정확히 하나를 받는다", async () => {
    const { g, victim, home, got, marks } = await lateCatchup(true);
    const alive = g.actors.filter((a) => a !== victim);
    const aliveSeats = alive.map((a) => a.seat).sort((p, q) => p - q);
    const everyone = g.actors.map((a) => a.seat).sort((p, q) => p - q);

    for (const a of alive) {
      const i = g.actors.indexOf(a);
      expect(`${a.role}:${worldFramesOf(a.sock, marks[i]!).map((m) => m.k).join(",")}`).toBe(`${a.role}:snap`);
      expect(snapSeatsOf(got[i]!)).toBe(aliveSeats.join(","));
      expect(snapPoints(got[i]!)).toBe(homeRows(home, aliveSeats));
    }
    const vi = g.actors.indexOf(victim);
    expect(worldFramesOf(victim.sock, marks[vi]!).map((m) => m.k).join(",")).toBe("snap");
    expect(snapSeatsOf(got[vi]!)).toBe(everyone.join(","));
    expect(snapPoints(got[vi]!)).toBe(homeRows(home, everyone));
  }, 40_000);

  it("멱등: 건너뛴 아침의 키가 기록되고, 같은 단계에서 위치 동기화가 다시 돌아도 같은 snap 이 다시 가지 않는다", async () => {
    const { g } = await lateCatchup(true);
    const lay = await layOf(g.code);
    expect(lay.key).not.toBeNull();
    expect(lay.key!.endsWith(":night")).toBe(false);
    expect(lay.key).toMatch(/:morning$/);
    expect((await worldOf(g.code)) !== undefined).toBe(true);

    const marks = g.socks.map((s) => mark(s));
    await runInDurableObject(env.ROOM.getByName(g.code), async (instance) => {
      await instance["syncPositions"](Date.now());
    });
    for (const sock of g.socks) await settle(sock, mark(sock));
    g.socks.forEach((sock, i) => expect(worldFramesOf(sock, marks[i]!).filter((m) => m.k === "snap")).toHaveLength(0));
  }, 40_000);
});
