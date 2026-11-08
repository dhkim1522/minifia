// 심부름(15페이즈, 결정 0074 예정) 워커 통합 시험: 트레이서(봇 방이 낮 시작 → 심부름 → 토론을 지나 봇 전원이 3곳을 처리)와
// 응답 동일성(거절 이유·역할이 달라도 같은 응답 모양)·스키마 거부. 실패 출력은 한 줄이어야 해서(TAP) 프레임 목록은 문자열로 비교한다.
import { env } from "cloudflare:workers";
import { runDurableObjectAlarm, runInDurableObject } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { ERRAND_ACT_R, ERRAND_MIN_GAP_MS } from "../../shared/game/phases";
import { placeCenterFx } from "../../shared/game/errand";
import { UNIT, snapToWalkable } from "../../shared/game/map";
import type { MapDef } from "../../shared/game/map";
import { mapOf } from "../../shared/game/maps";
import { restSegment } from "../../shared/game/world";
import type { WorldState } from "../../shared/game/world";
import type { MapId, RoomView, ServerMessage } from "../../shared/protocol";
import {
  killSeats,
  lastViewOf,
  mark,
  nextFrame,
  observe,
  pause,
  seat,
  send,
  settle,
  skipThrough,
  startedGame,
  storedRoom,
  until,
  writeRoomEdit,
  advanceTo,
} from "./helpers";
import type { Actor, Game, Seated, TestSocket } from "./helpers";

type Raw = Record<string, unknown>;
interface StoredPlayer { id: string; seat: number; isBot?: boolean; role?: string; errandPlaces?: string[]; errandDone?: string[]; errandFake?: string }
interface PlanStep { at: number; botId: string; act: { t: string } }
const stored = async (code: string): Promise<Raw> => (await storedRoom(code)) as unknown as Raw;
const playersOf = async (code: string): Promise<StoredPlayer[]> => (await stored(code)).players as StoredPlayer[];
const allSockets = (r: Seated): TestSocket[] => [r.host, ...r.guests.map((g) => g.sock)];
const mapOfRoom = async (code: string): Promise<MapDef> => mapOf(((await stored(code)).map as MapId | undefined) ?? "bar");
const centerOf = (map: MapDef, id: string): { x: number; z: number } => placeCenterFx(map, id)!;
const kinds = (msgs: ServerMessage[]): string => `[${msgs.map((m) => m.t).join(",")}]`;

/** 메모리의 world 에서 한 사람을 그 자리에 세운다(서 있는 한 점 구간). evict 하지 않는다. */
async function placeAt(code: string, playerId: string, pos: { x: number; z: number }): Promise<void> {
  await runInDurableObject(env.ROOM.getByName(code), (instance) => {
    const holder = instance as unknown as { world: WorldState };
    holder.world = { ...holder.world, segs: { ...holder.world.segs, [playerId]: restSegment(pos.x, pos.z, Date.now()) } };
  });
}

async function segEndOf(code: string, playerId: string): Promise<{ x: number; z: number; points: number }> {
  return runInDurableObject(env.ROOM.getByName(code), (instance) => {
    const seg = (instance as unknown as { world: WorldState }).world.segs[playerId]!;
    return { x: seg.p[seg.p.length - 2]!, z: seg.p[seg.p.length - 1]!, points: seg.p.length / 2 };
  });
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

describe("트레이서: 봇 방이 낮 시작 → 심부름 → 토론을 지난다 (ERRAND-01·02·04)", () => {
  it("봇이 걸어가 처리하고 봇 전원이 3곳을 마치며 방장이 넘기면 토론으로 간다", async () => {
    const r = await seat(0, 0, { testMode: true });
    for (const s of allSockets(r)) await settle(s, mark(s));
    send(r.host, { t: "testBots", count: 5 });
    await nextFrame(r.host, (m) => m.t === "state" && m.view.phase === "lobby" && m.view.players.length === 6);
    send(r.host, { t: "start" });
    await nextFrame(r.host, (m) => m.t === "state" && m.view.phase === "assigning");
    await skipThrough(r, "errand");

    // 1) 단계·목록: 사람(방장)도 같은 모양의 목록을 받고 진행은 비어 있다
    const view: RoomView = lastViewOf(r.host);
    expect(view.phase).toBe("errand");
    expect(view.me.errand?.places).toHaveLength(3);
    expect(view.me.errand?.done).toEqual([]);
    const bots = (await playersOf(r.code)).filter((p) => p.isBot === true);
    expect(bots).toHaveLength(5);
    for (const b of bots) expect(b.errandPlaces).toHaveLength(3);
    const map = await mapOfRoom(r.code);

    // 2) errandGo: 봇을 입장 지점에 세운 뒤 계획의 errandGo 를 돌리면 걷기 구간의 끝이 미완료 장소 중 가장 가까운 곳 중앙(걷기 칸 보정 후)이다
    const key = await planKeyOf(r.code);
    await runSteps(r.code, key, []); // 진짜 알람이 먼저 돌려 둔 걷기를 끊는다 — 아래에서 위치를 직접 정한다
    const starts = new Map<string, { x: number; z: number }>();
    for (const [i, b] of bots.entries()) {
      const sp = map.spawns[i % map.spawns.length]!;
      const start = { x: Math.round(sp.x * UNIT), z: Math.round(sp.z * UNIT) };
      starts.set(b.id, start);
      await placeAt(r.code, b.id, start);
    }
    await runSteps(r.code, key, bots.map((b) => ({ botId: b.id, act: { t: "errandGo" } })));
    for (const b of bots) {
      const from = starts.get(b.id)!;
      let best = b.errandPlaces![0]!;
      let bestD = Infinity;
      // 가짜(서버 전용 errandFake)는 마지막으로 미룬다 — 가짜가 아닌 미완료 장소가 있으면 그중 가장 가까운 곳이 목표다(D-08).
      for (const id of b.errandPlaces!.filter((x) => x !== b.errandFake)) {
        const c = centerOf(map, id);
        const d = (c.x - from.x) ** 2 + (c.z - from.z) ** 2;
        if (d < bestD) {
          bestD = d;
          best = id;
        }
      }
      const snapped = snapToWalkable(map, centerOf(map, best));
      const end = await segEndOf(r.code, b.id);
      expect(`${b.id}:${Math.hypot(end.x - snapped.x, end.z - snapped.z) <= 30}`).toBe(`${b.id}:true`);
    }

    // 3) errandAct: 봇을 각자 목록 장소 중앙에 세우고 계획의 errandAct 를 돌리면 장소 하나씩 처리된다. 마피아 봇은 가짜를 마지막에 가고 거기서 조용히 실패해 2/3 에서 멈추고,
    //    시민 봇은 3/3 이다(D-08). 걷는 순서는 가짜가 아닌 곳 먼저, 가짜는 마지막이다.
    const mafiaBots = bots.filter((b) => b.role === "mafia");
    expect(mafiaBots.length).toBeGreaterThan(0);
    for (const b of mafiaBots) expect(b.errandPlaces).toContain(b.errandFake);
    for (const b of bots.filter((x) => x.role !== "mafia")) expect(b.errandFake).toBeUndefined();
    const orderOf = (b: StoredPlayer): string[] => [...b.errandPlaces!.filter((x) => x !== b.errandFake), ...b.errandPlaces!.filter((x) => x === b.errandFake)];
    for (let k = 0; k < 3; k += 1) {
      await pause(ERRAND_MIN_GAP_MS + 50);
      for (const b of bots) await placeAt(r.code, b.id, centerOf(map, orderOf(b)[k]!));
      await runSteps(r.code, key, bots.map((b) => ({ botId: b.id, act: { t: "errandAct" } })));
      await until(`봇 ${k + 1}번째 처리`, async () =>
        (await playersOf(r.code)).filter((p) => p.isBot === true).every((p) => p.errandDone?.length === (p.role === "mafia" ? Math.min(k + 1, 2) : k + 1)),
      );
    }
    for (const b of (await playersOf(r.code)).filter((p) => p.isBot === true)) {
      const original = bots.find((x) => x.id === b.id)!;
      const expected = original.role === "mafia" ? original.errandPlaces!.filter((x) => x !== original.errandFake) : original.errandPlaces!;
      expect(`${b.id}:${JSON.stringify([...b.errandDone!].sort())}`).toBe(`${b.id}:${JSON.stringify([...expected].sort())}`);
      expect(b.errandDone).not.toContain(original.errandFake ?? "__none__");
    }

    // 4) 방장이 넘기면 토론으로 간다 — 단계가 바뀐 뒤 view 에는 me.errand 가 없다
    await skipThrough(r, "discussion");
    expect("errand" in lastViewOf(r.host).me).toBe(false);
  }, 60_000);
});

/** 모든 장소 중앙에서 가장 먼 입장 지점(서 있어도 처리 반경 밖). */
function farPoint(map: MapDef): { x: number; z: number } {
  let best = { x: 0, z: 0 };
  let bestD = -1;
  for (const s of map.spawns) {
    const p = { x: Math.round(s.x * UNIT), z: Math.round(s.z * UNIT) };
    const d = Math.min(...(map.places ?? []).map((pl) => Math.hypot(pl.x * UNIT - p.x, pl.z * UNIT - p.z)));
    if (d > bestD) {
      bestD = d;
      best = p;
    }
  }
  expect(bestD).toBeGreaterThan(ERRAND_ACT_R * UNIT);
  return best;
}

describe("응답 동일성 · 스키마", () => {
  const idOf = async (code: string, seatNo: number): Promise<string> => (await playersOf(code)).find((p) => p.seat === seatNo)!.id;
  const placesOf = async (code: string, id: string): Promise<string[]> => (await playersOf(code)).find((p) => p.id === id)!.errandPlaces!;
  const doneOf = async (code: string, id: string): Promise<string[]> => (await playersOf(code)).find((p) => p.id === id)!.errandDone!;

  /** 한 번 보내고 (보낸 소켓 프레임 · 다른 소켓 프레임) 모양을 한 줄로 돌려준다. */
  async function press(g: Game, actor: Actor): Promise<string> {
    const frames = await observe(g, actor, () => send(actor.sock, { t: "errand" }));
    const mine = frames[g.actors.indexOf(actor)]!;
    const others = frames.filter((_, i) => i !== g.actors.indexOf(actor)).map((f) => kinds(f)).join("");
    const text = JSON.stringify(mine);
    expect(text).not.toContain("\"x\":");
    return `${kinds(mine)}|${others}`;
  }

  it("거절 이유가 여섯 가지여도, 마피아든 시민이든 응답은 같다(보낸 소켓에 state 한 프레임, 다른 소켓 0, 오류 없음)", async () => {
    const g = await startedGame("errand");
    const map = await mapOfRoom(g.code);
    const far = farPoint(map);
    const mafia = g.actors.find((a) => a.role === "mafia")!;
    const citizen = g.actors.find((a) => a.role === "citizen")!;
    const rejected: string[] = [];
    for (const a of [mafia, citizen]) {
      const id = await idOf(g.code, a.seat);
      const places = await placesOf(g.code, id);
      const fake = (await playersOf(g.code)).find((p) => p.id === id)!.errandFake;
      expect(fake === undefined).toBe(a.role !== "mafia");
      // 마피아는 가짜가 아닌 곳을 [0]·[1] 로 쓴다(가짜는 처리되지 않는다 — D-08)
      const mine = [...places.filter((x) => x !== fake), ...places.filter((x) => x === fake)];
      const outside = (map.places ?? []).map((p) => p.id).find((p) => !mine.includes(p))!;
      // 1) 반경 밖
      await placeAt(g.code, id, far);
      rejected.push(await press(g, a));
      await pause(ERRAND_MIN_GAP_MS + 50);
      // 2) 목록 밖 장소 곁
      await placeAt(g.code, id, centerOf(map, outside));
      rejected.push(await press(g, a));
      await pause(ERRAND_MIN_GAP_MS + 50);
      // 가짜 곁(마피아만): 반경 밖과 같은 응답이고 진행은 오르지 않는다
      if (fake !== undefined) {
        await placeAt(g.code, id, centerOf(map, fake));
        rejected.push(await press(g, a));
        expect(JSON.stringify(await doneOf(g.code, id))).toBe("[]");
        await pause(ERRAND_MIN_GAP_MS + 50);
      }
      // 성공(같은 모양의 한 프레임이지만 진행이 오른다)
      await placeAt(g.code, id, centerOf(map, mine[0]!));
      await press(g, a);
      expect(await doneOf(g.code, id)).toEqual([mine[0]]);
      expect(lastViewOf(a.sock).me.errand?.done).toEqual([mine[0]]);
      await pause(ERRAND_MIN_GAP_MS + 50);
      // 3) 이미 처리한 곳
      rejected.push(await press(g, a));
      // 4) 간격: 직전 요청 직후(250ms 안)의 요청은 서 있는 곳이 유효해도 받지 않는다
      await placeAt(g.code, id, centerOf(map, mine[1]!));
      rejected.push(await press(g, a));
      expect(await doneOf(g.code, id)).toEqual([mine[0]]);
      // 간격이 지나면 같은 자리에서 받아들인다
      await pause(ERRAND_MIN_GAP_MS + 50);
      await press(g, a);
      expect(await doneOf(g.code, id)).toEqual([mine[0], mine[1]]);
    }
    expect(rejected).toHaveLength(9); // 시민 4 + 마피아 4 + 마피아의 가짜 곁 1
    expect(new Set(rejected).size).toBe(1);
    expect(rejected[0]).toBe("[state]|[][][][][]");
  }, 90_000);

  it("죽은 사람·errand 가 아닌 단계도 같은 응답이다", async () => {
    const g = await startedGame("errand");
    const map = await mapOfRoom(g.code);
    const dead = g.actors.find((a) => a.role === "citizen")!;
    const deadId = await idOf(g.code, dead.seat);
    const deadPlace = (await placesOf(g.code, deadId))[0]!;
    await killSeats(g, [dead.seat]);
    await placeAt(g.code, deadId, centerOf(map, deadPlace));
    const afterDeath = await press(g, dead);
    const living = g.actors.find((a) => a.seat !== dead.seat && a.role === "mafia")!;
    const livingId = await idOf(g.code, living.seat);
    const livingPlace = (await placesOf(g.code, livingId))[0]!;
    await placeAt(g.code, livingId, centerOf(map, livingPlace));
    await pause(ERRAND_MIN_GAP_MS + 50);
    await advanceTo(g.code, g.socks, "discussion");
    for (const s of g.socks) await settle(s, mark(s));
    await placeAt(g.code, livingId, centerOf(map, livingPlace));
    const afterPhase = await press(g, living);
    expect(afterDeath).toBe("[state]|[][][][][]");
    expect(afterPhase).toBe("[state]|[][][][][]");
    expect(await doneOf(g.code, livingId)).toEqual([]);
  }, 60_000);

  it("스키마: {t:'errand'} 에 다른 키가 붙으면 BAD_MESSAGE 오류 한 프레임", async () => {
    const g = await startedGame("errand");
    const first = g.socks[0]!;
    const from = mark(first);
    send(first, { t: "errand", place: "glass" });
    expect(kinds(await settle(first, from))).toBe("[error]");
  }, 30_000);
});
