// 저녁 목격 기록이 밤·아침을 지나 토론까지 이어지는 워커 통합 시험 (21-04, D-05·D-09·D-19, 위협 T-21-08).
// 확장판은 저녁(errand) → 밤 → (아침) → 토론이다. 저녁의 목록·진행·목격 줄은 서버에 남지만 view 는 errand·discussion 단계에서만 싣는다.
// 처리·표본은 실제 흐름으로 만든다(처리 메시지를 보내고 표본 알람을 돌린다). 실패 출력은 한 줄이어야 해서(TAP) 값은 JSON 문자열로 견준다.
import { env } from "cloudflare:workers";
import { runDurableObjectAlarm, runInDurableObject } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { placeCenterFx } from "../../shared/game/errand";
import { ERRAND_MIN_GAP_MS } from "../../shared/game/phases";
import { mapOf } from "../../shared/game/maps";
import { restSegment } from "../../shared/game/world";
import type { Segment, WorldState } from "../../shared/game/world";
import type { MapId, ServerMessage } from "../../shared/protocol";
import { advanceTo, lastViewOf, mark, pause, pickAs, send, settle, startedGame, storedRoom, withRole, writeRoomEdit } from "./helpers";
import type { Actor, Game } from "./helpers";

type Pos = { x: number; z: number };
interface StoredPlayer { id: string; seat: number; errandPlaces?: string[]; errandDone?: string[]; errandNear?: number[]; errandSeen?: Array<{ seat: number; place: string }> }

const GLASS: Pos = { x: -390, z: -220 }; // 재즈 바 glass 장소 중앙(좌표는 map.ts BAR_PLACES)
const NEAR_GLASS: Pos = { x: GLASS.x + 20, z: GLASS.z };
const FAR: Pos[] = [{ x: 520, z: 500 }, { x: 520, z: -60 }, { x: -40, z: 260 }, { x: -60, z: -560 }];

const playersOf = async (code: string): Promise<StoredPlayer[]> => ((await storedRoom(code)) as unknown as { players: StoredPlayer[] }).players;
const storedOf = async (code: string, seatNo: number): Promise<StoredPlayer> => (await playersOf(code)).find((p) => p.seat === seatNo)!;

/** 좌석 → 서 있는 한 점으로 메모리 world 를 정한다(evict 없음). */
async function placeSeats(code: string, bySeat: Record<number, Pos>): Promise<void> {
  const segs: Record<string, Segment> = {};
  for (const [s, pos] of Object.entries(bySeat)) segs[(await storedOf(code, Number(s))).id] = restSegment(pos.x, pos.z, Date.now());
  await runInDurableObject(env.ROOM.getByName(code), (instance) => {
    const holder = instance as unknown as { world: WorldState };
    holder.world = { ...holder.world, segs: { ...holder.world.segs, ...segs } };
  });
}

/** 표본 알람 한 번(errandTickAt 을 과거로 당겨 evict 없이 돌린다). */
async function tickNow(code: string): Promise<void> {
  const stub = env.ROOM.getByName(code);
  await writeRoomEdit(stub, (room) => ({ ...room, errandTickAt: Date.now() - 1 }));
  await runDurableObjectAlarm(stub);
}

/** 실제 시간 표본이 누름과 겹치지 않게 다음 표본을 멀리 미룬다(20-03). */
async function deferTicks(code: string): Promise<void> {
  await writeRoomEdit(env.ROOM.getByName(code), (room) => ({ ...room, errandTickAt: Date.now() + 3_600_000 }));
}

/** 행위자가 자기 목록 장소를 count 곳 처리한다 — 장소 중앙에 서서 errand 메시지를 보낸다(사람과 같은 경로). */
async function doErrands(g: Game, a: Actor, count: number): Promise<void> {
  const map = mapOf(((await storedRoom(g.code)) as unknown as { map?: MapId }).map ?? "bar");
  const places = (await storedOf(g.code, a.seat)).errandPlaces!;
  for (const place of places.slice(0, count)) {
    await pause(ERRAND_MIN_GAP_MS + 50);
    await placeSeats(g.code, { [a.seat]: placeCenterFx(map, place)! });
    send(a.sock, { t: "errand" });
    await settle(a.sock, mark(a.sock));
  }
}

/** 밤에 마피아 전원이 X 를 고르고 서버가 받을 때까지 기다린다(선택이 있어야 아침이 온다). */
async function pickX(g: Game, x: Actor): Promise<void> {
  for (const m of withRole(g, "mafia")) pickAs(m, x.seat);
  for (const s of g.socks) await settle(s, mark(s));
}

const hasKey = (a: Actor, key: "errand" | "record"): boolean => key in lastViewOf(a.sock).me;
const phasesWith = (a: Actor, key: "errand" | "record"): string[] => {
  const phases = new Set<string>();
  for (const raw of a.sock.frames) {
    const m = JSON.parse(raw) as ServerMessage;
    if (m.t === "state" && key in m.view.me) phases.add(m.view.phase);
  }
  return [...phases].sort();
};

/**
 * 역할 roleOfA 인 A 와 다른 역할 B 를 근처에 두고 표본 한 번 → A 는 3곳, B 는 2곳을 처리한다.
 * 밤에 마피아 전원이 A·B 가 아닌 시민 X 를 골라 아침이 오게 한다(탈락자 X).
 */
async function eveningGame(roleOfA: "mafia" | "citizen"): Promise<{ g: Game; a: Actor; b: Actor; x: Actor }> {
  const g = await startedGame("errand");
  const a = withRole(g, roleOfA)[0]!;
  const b = g.actors.find((p) => p !== a && p.role !== roleOfA)!;
  const x = g.actors.find((p) => p !== a && p !== b && p.role === "citizen")!;
  const layout: Record<number, Pos> = {};
  const others = g.actors.filter((p) => p !== a && p !== b);
  others.forEach((p, i) => (layout[p.seat] = FAR[i]!));
  layout[a.seat] = GLASS;
  layout[b.seat] = NEAR_GLASS;
  await placeSeats(g.code, layout);
  await tickNow(g.code);
  await deferTicks(g.code);
  await doErrands(g, a, 3);
  await doErrands(g, b, 2);
  return { g, a, b, x };
}

for (const roleOfA of ["citizen", "mafia"] as const) {
  describe(`저녁 목격이 밤·아침을 지나 토론까지 (A=${roleOfA}, D-05·D-09·D-19)`, () => {
    it("A 는 3곳을 모두 처리해(역할 무관) 토론 view 에 me.record 로 B 의 좌석을 받고, 2곳뿐인 B 는 키가 없다", async () => {
      const { g, a, b, x } = await eveningGame(roleOfA);
      expect(JSON.stringify((await storedOf(g.code, a.seat)).errandDone)).toBe(JSON.stringify((await storedOf(g.code, a.seat)).errandPlaces));
      expect(lastViewOf(a.sock).me.errand?.done.length).toBe(3);
      await advanceTo(g.code, g.socks, "night");
      await pickX(g, x);
      await advanceTo(g.code, g.socks, "morning");
      await advanceTo(g.code, g.socks, "discussion");
      expect(JSON.stringify(lastViewOf(a.sock).me.record)).toBe(JSON.stringify([{ seat: b.seat, place: "glass" }]));
      expect(hasKey(b, "record")).toBe(false);
      for (const p of g.actors.filter((q) => q !== a)) expect(`${p.seat}:${hasKey(p, "record")}`).toBe(`${p.seat}:false`);
    }, 60_000);

    it("me.errand 는 errand 에만 me.record 는 discussion 에만 실린다 — 밤·아침 view 에 두 키가 없다(T-21-08)", async () => {
      const { g, a, x } = await eveningGame(roleOfA);
      await advanceTo(g.code, g.socks, "night");
      await pickX(g, x);
      expect(`${hasKey(a, "errand")}:${hasKey(a, "record")}`).toBe("false:false");
      await advanceTo(g.code, g.socks, "morning");
      expect(`${hasKey(a, "errand")}:${hasKey(a, "record")}`).toBe("false:false");
      await advanceTo(g.code, g.socks, "discussion");
      expect(`${hasKey(a, "errand")}:${hasKey(a, "record")}`).toBe("false:true");
      expect(JSON.stringify(phasesWith(a, "errand"))).toBe(JSON.stringify(["errand"]));
      expect(JSON.stringify(phasesWith(a, "record"))).toBe(JSON.stringify(["discussion"]));
    }, 60_000);

    it("다음 날 저녁 진입이 저녁 값을 지운다 — 서버 상태의 A 에 목격 줄·진행이 비고 me.record 키가 없다", async () => {
      const { g, a, x } = await eveningGame(roleOfA);
      await advanceTo(g.code, g.socks, "night");
      await pickX(g, x);
      await advanceTo(g.code, g.socks, "morning");
      await advanceTo(g.code, g.socks, "discussion");
      expect(hasKey(a, "record")).toBe(true);
      await advanceTo(g.code, g.socks, "errand");
      const stored = await storedOf(g.code, a.seat);
      expect(JSON.stringify({ seen: stored.errandSeen ?? null, near: stored.errandNear ?? null, done: stored.errandDone ?? null })).toBe(JSON.stringify({ seen: null, near: null, done: [] }));
      expect(`${hasKey(a, "record")}:${hasKey(a, "errand")}`).toBe("false:true");
    }, 60_000);
  });
}
