// 21-06 테스트 방 서버 봇의 원인 흐름 완주(D-29, 위협 T-21-24): 마을 확장판 원인 흐름(openCause + openTown) 테스트 방에서 방장 + testBots 로 판을 시작해
//  - 저녁: 봇 계획(errandGo·errandAct)이 사람과 같은 applyMove·applyErrand 본체로 가로등을 처리한다(errandDone 은 가로등 id 뿐). 저녁을 넘기면 밤의 day.lamps 가 그 처리와 같다.
//  - 방장 testSkip 이 새 단계(저녁 → 밤 → 아침 → 토론)마다 정상으로 넘기고 낮 시작 발표(dayAnnounce)는 한 번도 없다.
//  - 봇 방이 새 흐름으로 끝(ended)까지 가며 오류 프레임이 없다. 아침은 봇이 살피지 않아도 testSkip 으로 지난다.
// 봇은 특권이 없다 — 위치는 메모리 world 에 직접 놓고(placeSeats) 계획의 단계를 때가 된 것으로 바꿔 알람을 돌린다(errand.test.ts 의 선례). 다른 시험 파일을 import 하지 않는다.
// 실패 출력은 한 줄이어야 해서(TAP) 목록은 문자열로 비교한다.
import { env } from "cloudflare:workers";
import { runDurableObjectAlarm, runInDurableObject } from "cloudflare:test";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { placeCenterFx } from "../../shared/game/errand";
import { UNIT, snapToWalkable } from "../../shared/game/map";
import { mapOf } from "../../shared/game/maps";
import { TOWN_LAMPS } from "../../shared/game/mapTown";
import { ERRAND_MIN_GAP_MS } from "../../shared/game/phases";
import type { WorldState } from "../../shared/game/world";
import type { MapId, ServerMessage } from "../../shared/protocol";
import { openCause, openTown } from "../helpers/playable";
import { driveToEnded, framesOf, lastViewOf, mark, nextFrame, pause, placeSeats, seat, send, settle, skipOnce, skipThrough, storedRoom, until, writeRoomEdit } from "./helpers";
import type { Seated, TestSocket } from "./helpers";

const LAMP_IDS: readonly string[] = TOWN_LAMPS.map((l) => l.id);
interface StoredPlayer { id: string; seat: number; isBot?: boolean; role?: string; errandPlaces?: string[]; errandDone?: string[]; errandCut?: string[] }
interface PlanStep { at: number; botId: string; act: { t: string } }
const stored = async (code: string): Promise<Record<string, unknown>> => (await storedRoom(code)) as unknown as Record<string, unknown>;
const playersOf = async (code: string): Promise<StoredPlayer[]> => (await stored(code)).players as StoredPlayer[];
const botsOf = async (code: string): Promise<StoredPlayer[]> => (await playersOf(code)).filter((p) => p.isBot === true).sort((a, b) => a.seat - b.seat);
const allSockets = (r: Seated): TestSocket[] => [r.host, ...r.guests.map((g) => g.sock)];
const lampCenterFx = (id: string): { x: number; z: number } => placeCenterFx(mapOf("town"), id)!;

/** 테스트 방(방장 + 봇 n)을 시작해 assigning 프레임까지 받은 판. role 을 주면 방장 직업을 먼저 정한다. */
async function botTable(bots: number, role?: "mafia" | "citizen"): Promise<Seated> {
  const r = await seat(0, 0, { testMode: true });
  for (const s of allSockets(r)) await settle(s, mark(s));
  send(r.host, { t: "testBots", count: bots });
  await nextFrame(r.host, (m) => m.t === "state" && m.view.phase === "lobby" && m.view.players.length === bots + 1);
  if (role !== undefined) {
    send(r.host, { t: "testRole", role });
    await settle(r.host, mark(r.host));
  }
  send(r.host, { t: "start" });
  await nextFrame(r.host, (m) => m.t === "state" && m.view.phase === "assigning");
  return r;
}

/** 저장된 botPlan 이 errand 계획으로 서 있을 때까지 기다리고 그 키를 돌려준다. */
async function planKeyOf(code: string): Promise<string> {
  let key = "";
  await until("errand 봇 계획", async () => {
    const plan = (await stored(code)).botPlan as { key: string; steps: PlanStep[] } | undefined;
    key = plan?.key ?? "";
    return key.startsWith("errand:");
  });
  return key;
}

/** 계획의 남은 단계를 주어진 단계들(지금 때가 된 것)로 바꾸고(저장소·메모리) 알람을 evict 없이 돌린다. 계획에 적힌 단계를 그대로 실행하는 같은 경로다. */
async function runSteps(code: string, key: string, steps: Array<{ botId: string; act: { t: string } }>): Promise<void> {
  const stub = env.ROOM.getByName(code);
  await writeRoomEdit(stub, (room) => ({ ...room, botPlan: { key, steps: steps.map((s) => ({ ...s, at: Date.now() - 1000 })) } }));
  await runDurableObjectAlarm(stub);
}

async function segEndOf(code: string, playerId: string): Promise<{ x: number; z: number }> {
  return runInDurableObject(env.ROOM.getByName(code), (instance) => {
    const seg = (instance as unknown as { world: WorldState }).world.segs[playerId]!;
    return { x: seg.p[seg.p.length - 2]!, z: seg.p[seg.p.length - 1]!, points: seg.p.length / 2 };
  });
}

/** 방장 소켓이 받은 state 프레임의 단계 수열(같은 값이 이어지면 하나로 줄이고 assigning 앞의 대기실 프레임은 뺀다). */
function chainOf(sock: TestSocket): string {
  const phases: string[] = [];
  for (const m of framesOf(sock)) {
    if (m.t !== "state") continue;
    if (phases.length === 0 && m.view.phase !== "assigning") continue;
    if (phases.at(-1) !== m.view.phase) phases.push(m.view.phase);
  }
  return phases.join(" → ");
}

describe("테스트 방 봇 — 마을 확장판 원인 흐름 (openCause + openTown, D-29)", () => {
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

  it("저녁: 봇이 가로등으로 걸어가 사람과 같은 본체로 처리하고(errandDone 은 가로등 id 뿐, 합 1 이상) 넘기면 밤의 day.lamps 가 그 처리와 같다", { timeout: 90_000 }, async () => {
    const r = await botTable(5);
    await skipThrough(r, "errand");
    expect(String((await stored(r.code)).map)).toBe("town" satisfies MapId);
    const bots = await botsOf(r.code);
    expect(bots.length).toBe(5);
    for (const b of bots) expect(`${b.id}:${(b.errandPlaces ?? []).length}:${(b.errandPlaces ?? []).every((id) => LAMP_IDS.includes(id))}`).toBe(`${b.id}:3:true`);
    const map = mapOf("town");

    // 표본 알람(1초 간격)은 이 시험이 보는 것이 아니다 — 멀리 미룬다.
    const key = await planKeyOf(r.code);
    await writeRoomEdit(env.ROOM.getByName(r.code), (room) => ({ ...room, errandTickAt: Date.now() + 3_600_000 }));
    await runSteps(r.code, key, []); // 진짜 알람이 먼저 돌려 둔 걷기를 끊는다 — 아래에서 위치를 직접 정한다

    // errandGo: 입장 지점에 세운 뒤 계획의 errandGo 를 돌리면 걷기 구간의 끝이 미완료 가로등 중 가장 가까운 곳 중앙(걷기 칸 보정 후)이다.
    const starts = bots.map((b, i) => {
      const sp = map.spawns[i % map.spawns.length]!;
      return { x: Math.round(sp.x * UNIT), z: Math.round(sp.z * UNIT) };
    });
    await placeSeats(r.code, Object.fromEntries(bots.map((b, i) => [b.seat, starts[i]!])));
    await runSteps(r.code, key, bots.map((b) => ({ botId: b.id, act: { t: "errandGo" } })));
    const reached: string[] = [];
    for (const [i, b] of bots.entries()) {
      let best = b.errandPlaces![0]!;
      let bestD = Infinity;
      for (const id of b.errandPlaces!) {
        const c = lampCenterFx(id);
        const d = (c.x - starts[i]!.x) ** 2 + (c.z - starts[i]!.z) ** 2;
        if (d < bestD) {
          bestD = d;
          best = id;
        }
      }
      const snapped = snapToWalkable(map, lampCenterFx(best));
      const end = await segEndOf(r.code, b.id);
      reached.push(`${b.id}:${Math.hypot(end.x - snapped.x, end.z - snapped.z) <= 30}`);
    }
    expect(reached.join(" ")).toBe(bots.map((b) => `${b.id}:true`).join(" "));

    // errandAct: 각자 목록의 k 번째 가로등 중앙에 세우고 계획의 errandAct 를 돌리면 가로등 하나씩 처리된다(원인 흐름에는 가짜 장소가 없어 3/3).
    for (let k = 0; k < 3; k += 1) {
      await pause(ERRAND_MIN_GAP_MS + 50);
      await placeSeats(r.code, Object.fromEntries(bots.map((b) => [b.seat, lampCenterFx(b.errandPlaces![k]!)])));
      await runSteps(r.code, key, bots.map((b) => ({ botId: b.id, act: { t: "errandAct" } })));
      await until(`봇 ${k + 1}번째 처리`, async () => (await botsOf(r.code)).every((p) => p.errandDone?.length === k + 1));
    }
    const done = await botsOf(r.code);
    const doneIds = done.flatMap((b) => b.errandDone ?? []);
    expect(`${doneIds.length >= 1}/${doneIds.every((id) => LAMP_IDS.includes(id))}/${done.every((b) => JSON.stringify([...b.errandDone!].sort()) === JSON.stringify([...b.errandPlaces!].sort()))}`).toBe("true/true/true");
    expect(done.some((b) => b.errandCut !== undefined)).toBe(false); // 봇은 길게 누르지 않는다 — 자른 등불이 없다

    // 방장이 저녁을 넘기면 밤이고 모든 등불 켜짐 여덟 개는 봇이 처리한 가로등과 같다(방장은 켜지 않았다).
    await skipOnce(r);
    const view = lastViewOf(r.host);
    const lamps = (view.day as { lamps?: boolean[] } | undefined)?.lamps ?? [];
    const lit = new Set(doneIds);
    expect(`${view.phase}/${lamps.length}/${lamps.join(",")}`).toBe(`night/8/${LAMP_IDS.map((id) => lit.has(id)).join(",")}`);
  });

  it("방장 testSkip 이 새 단계마다 정상으로 넘긴다: 저녁 → 밤 → 아침(현장 있음) → 토론 — 봇이 살피지 않아도 아침은 지나가고 낮 시작 발표·오류 프레임은 한 번도 없다", { timeout: 90_000 }, async () => {
    const r = await botTable(5, "mafia");
    await skipThrough(r, "errand");
    await skipOnce(r); // 저녁 → 밤
    expect(String((await stored(r.code)).phase)).toBe("night");
    // 방장(마피아)이 시민 봇 하나를 고르고, 의사 봇은 자기 집을 고르게 해 둔다(의사가 피해자를 막으면 현장이 없어 아침이 0 길이로 지나간다 — 21-01). 나머지 봇의 밤 선택은 testSkip 의 botsPickNow 가 한다.
    const victim = (await botsOf(r.code)).find((b) => b.role === "citizen")!;
    await writeRoomEdit(env.ROOM.getByName(r.code), (room) => ({
      ...room,
      players: (room.players as Array<Record<string, unknown>>).map((p) => (p.isBot === true && p.role === "doctor" ? { ...p, nightPick: p.seat } : p)),
    }));
    send(r.host, { t: "pick", target: victim.seat });
    for (const s of allSockets(r)) await settle(s, mark(s));
    await skipOnce(r); // 밤 → 아침: 봇 밤 선택은 botsPickNow 로 서 있다
    expect(String((await stored(r.code)).phase)).toBe("morning");
    for (const s of allSockets(r)) await settle(s, mark(s));
    const day = lastViewOf(r.host).day as { morning?: { eliminated?: number }; scene?: { house: number } } | undefined;
    expect(`${day?.morning?.eliminated}/${day?.scene?.house}`).toBe(`${victim.seat}/${victim.seat}`);
    expect(((await stored(r.code)).nightLog as unknown[] | undefined)?.length).toBe(1);
    await skipOnce(r); // 아침 → 토론 (봇은 현장을 살피지 않았다)
    expect(String((await stored(r.code)).phase)).toBe("discussion");
    for (const s of allSockets(r)) await settle(s, mark(s));
    expect(chainOf(r.host)).toBe("assigning → roleReveal → errand → night → morning → discussion");
    expect(framesOf(r.host).filter((m: ServerMessage) => m.t === "error").length).toBe(0);
    expect((await botsOf(r.code)).some((b) => (b as unknown as { sceneSeen?: unknown }).sceneSeen !== undefined)).toBe(false);
  });

  it("봇 방이 새 흐름으로 ended 까지 자동 완주한다(저녁 → 밤 → [아침] → 토론 → 지목 → 변론 → 찬반 → 처형 → 끝), 오류 프레임이 없다", { timeout: 120_000 }, async () => {
    const r = await botTable(3, "mafia"); // 방장(마피아) + 봇 3 = 마피아 하나라 처형으로 시민이 이긴다
    await driveToEnded(r);
    for (const s of allSockets(r)) await settle(s, mark(s));
    expect(String((await stored(r.code)).phase)).toBe("ended");
    // 아무도 죽지 않은 밤(방장 마피아가 고르지 않았다)은 현장이 없어 아침이 길이 0 이라 프레임 없이 지나간다(21-01) — 낮 시작 발표(dayAnnounce)는 한 번도 없다.
    expect(chainOf(r.host)).toBe("assigning → roleReveal → errand → night → discussion → nomination → defense → verdict → execution → ended");
    expect(framesOf(r.host).filter((m: ServerMessage) => m.t === "error").length).toBe(0);
  });
});
