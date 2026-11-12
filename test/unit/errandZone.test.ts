// 심부름 근처 판정·목격 표본·근처 snap 의 구역 거르기 (20-03, D-17·D-18, 위협 T-20-10) — 순수 규칙 시험.
// 근처는 "반경 안 이고 같은 구역" 이다: 벽 너머 사람은 반경 안이어도 근처가 아니고, 목격 기록·마지막 목격에도 오르지 않는다.
// 방이 없는 맵(재즈 바)·맵 인자가 없는 호출은 거리만 본다(기존 동작 그대로). 실패 출력은 한 줄이어야 해서(TAP) 문자열로 비교한다.
import { describe, expect, it } from "vitest";
import { nearIdsOf, nearSnapFrame, sampleErrand } from "../../shared/game/errand";
import { BAR_MAP, UNIT, cellCenterFx, cellOfFx, isWalkable } from "../../shared/game/map";
import { TOWN_MAP, TOWN_ROOMS } from "../../shared/game/mapTown";
import { ERRAND_NEAR_R } from "../../shared/game/phases";
import type { RoomState } from "../../shared/game/room";
import { tick } from "../../shared/game/tick";
import { MOVE_V, emptyWorld, positionAtFx, restSegment } from "../../shared/game/world";
import type { Segment, WorldState } from "../../shared/game/world";
import { zoneOf } from "../../shared/game/zones";
import { seededRandInt } from "../helpers/seededRandom";
import { startedAt } from "../helpers/voteState";

type Pt = { x: number; z: number };
const R_FX = ERRAND_NEAR_R * UNIT; // 300
const POST = TOWN_ROOMS.find((r) => r.id === "post")!;
/** 우체국 안, 문 바로 안쪽의 걷는 칸 중심. */
const IN_DOOR: Pt = { x: -25, z: -725 };
/** 우체국 문 밖 1.0 앞의 걷는 칸 중심(문 앞 목적지). IN_DOOR 와 1.5 떨어져 있다 — 근처 반경 3.0 안이다. */
const OUT_DOOR: Pt = POST.front;
/** 우체국 안쪽 깊은 걷는 칸 중심. IN_DOOR 와 1.8 떨어져 있다(OUT_DOOR 보다 멀다). */
const IN_DEEP: Pt = { x: 75, z: -875 };
/** 광장 한가운데 쪽 자리 — 위 셋 모두와 근처 반경 밖이다. */
const FAR: Pt = { x: 320, z: 180 };
const FAR2: Pt = { x: -420, z: 380 };
const FAR3: Pt = { x: 520, z: 520 };

const dist = (a: Pt, b: Pt): number => Math.hypot(a.x - b.x, a.z - b.z);
const walkable = (p: Pt): boolean => {
  const c = cellOfFx(p.x, p.z, TOWN_MAP);
  const mid = cellCenterFx(c.c, c.r, TOWN_MAP);
  return isWalkable(TOWN_MAP, c.c, c.r) && mid.x === p.x && mid.z === p.z;
};

function townErrand(seed = 3, n = 6): RoomState {
  const day = { ...startedAt(n, seed, "dayAnnounce"), map: "town" as const };
  return tick(day, day.phaseEndsAt!, seededRandInt(seed + 1));
}
function barErrand(seed = 3, n = 6): RoomState {
  const day = { ...startedAt(n, seed, "dayAnnounce"), map: "bar" as const };
  return tick(day, day.phaseEndsAt!, seededRandInt(seed + 1));
}
const idOfSeat = (s: RoomState, seat: number): string => s.players.find((p) => p.seat === seat)!.id;
function posTable(state: RoomState, bySeat: Record<number, Pt>): (id: string) => Pt | undefined {
  return (id) => {
    const p = state.players.find((q) => q.id === id);
    return p === undefined ? undefined : bySeat[p.seat];
  };
}
const seatsOf = (state: RoomState, ids: readonly string[]): string => ids.map((id) => state.players.find((p) => p.id === id)!.seat).join(",");
/** 좌석 0 = 우체국 안 문 옆, 1 = 문 밖, 2 = 우체국 안 깊은 곳, 3~5 = 광장 먼 곳. */
const SPREAD: Record<number, Pt> = { 0: IN_DOOR, 1: OUT_DOOR, 2: IN_DEEP, 3: FAR, 4: FAR2, 5: FAR3 };
/** 점 목록이 지나는 구역(중복 없이, 처음 나온 순서). */
function zonesOfPts(p: readonly number[]): string {
  const seen: string[] = [];
  for (let i = 0; i + 1 < p.length; i += 2) {
    const zone = zoneOf(TOWN_MAP, p[i]!, p[i + 1]!);
    if (!seen.includes(zone)) seen.push(zone);
  }
  return seen.join(">");
}

describe("시험 자리의 전제", () => {
  it("문 안·문 밖·안쪽 깊은 곳은 걷는 칸 중심이고, 문 밖이 안쪽 깊은 곳보다 문 안에 가깝고 둘 다 근처 반경 안이다", () => {
    const got = [
      [IN_DOOR, OUT_DOOR, IN_DEEP].map(walkable).join(","),
      [IN_DOOR, OUT_DOOR, IN_DEEP].map((p) => zoneOf(TOWN_MAP, p.x, p.z)).join(","),
      dist(IN_DOOR, OUT_DOOR) < dist(IN_DOOR, IN_DEEP) && dist(IN_DOOR, IN_DEEP) <= R_FX && dist(OUT_DOOR, IN_DEEP) > R_FX,
      [FAR, FAR2, FAR3].every((f) => [IN_DOOR, OUT_DOOR, IN_DEEP].every((p) => dist(f, p) > R_FX)),
    ].join(" ");
    expect(got).toBe("true,true,true post,plaza,post true true");
  });
});

describe("근처 판정 nearIdsOf 의 맵 인자 (D-17)", () => {
  const s = townErrand();
  const pos = posTable(s, SPREAD);

  it("마을: 벽 너머(문 안 ↔ 문 밖)는 반경 안이어도 서로 근처가 아니다", () => {
    const got = `${seatsOf(s, nearIdsOf(s.players, pos, idOfSeat(s, 0), R_FX, TOWN_MAP))} / ${seatsOf(s, nearIdsOf(s.players, pos, idOfSeat(s, 1), R_FX, TOWN_MAP))}`;
    expect(got).toBe("2 / ");
  });

  it("마을: 같은 방 안의 두 사람은 서로 근처다", () => {
    const got = `${seatsOf(s, nearIdsOf(s.players, pos, idOfSeat(s, 0), R_FX, TOWN_MAP))} / ${seatsOf(s, nearIdsOf(s.players, pos, idOfSeat(s, 2), R_FX, TOWN_MAP))}`;
    expect(got).toBe("2 / 0");
  });

  it("마을: 둘 다 광장이면 거리만 본다(문 밖 두 사람)", () => {
    const both = posTable(s, { ...SPREAD, 0: { x: 25, z: -575 } });
    expect(seatsOf(s, nearIdsOf(s.players, both, idOfSeat(s, 0), R_FX, TOWN_MAP))).toBe("1");
  });

  it("맵 인자가 없으면 지금처럼 거리만 본다", () => {
    expect(seatsOf(s, nearIdsOf(s.players, pos, idOfSeat(s, 0), R_FX))).toBe("1,2");
  });

  it("방이 없는 맵(재즈 바)을 넘겨도 인자가 없을 때와 같다", () => {
    const all = s.players.map((p) => `${seatsOf(s, nearIdsOf(s.players, pos, p.id, R_FX, BAR_MAP))}=${seatsOf(s, nearIdsOf(s.players, pos, p.id, R_FX))}`);
    expect(all.join(" | ")).toBe("1,2=1,2 | 0=0 | 0=0 | = | = | =");
  });
});

describe("목격 표본 sampleErrand 는 같은 구역 사람만 적는다 (D-18)", () => {
  const s = townErrand();
  const next = sampleErrand(s, posTable(s, SPREAD), 5000);
  const playerOf = (seat: number) => next.players.find((p) => p.seat === seat)!;

  it("벽 너머 사람은 근처 집합(errandNear)·목격 줄(errandSeen)에 오르지 않고 같은 방 사람은 오른다", () => {
    const row = (seat: number): string => `${seat}:near=[${(playerOf(seat).errandNear ?? []).join(",")}] seen=${JSON.stringify(playerOf(seat).errandSeen ?? [])}`;
    expect([0, 1, 2].map(row).join(" | ")).toBe(
      '0:near=[2] seen=[{"seat":2,"place":"mail"}] | 1:near=[] seen=[] | 2:near=[0] seen=[{"seat":0,"place":"mail"}]',
    );
  });

  it("마지막 목격(errandLast)의 관찰자도 같은 구역에서만 고른다 — 더 가까운 벽 너머 사람은 관찰자가 되지 않는다", () => {
    expect(JSON.stringify(next.errandLast)).toBe('[{"seat":0,"by":2,"place":"mail"},{"seat":2,"by":0,"place":"mail"}]');
  });

  it("문을 지나 같은 방에 들어오면 그때 목격 줄이 생긴다(구역이 같아진 표본)", () => {
    const after = sampleErrand(next, posTable(next, { ...SPREAD, 1: POST.inside }), 6000);
    const seen = (seat: number): string => JSON.stringify(after.players.find((p) => p.seat === seat)!.errandSeen ?? []);
    expect(`${seen(0)} ${seen(1)}`).toBe('[{"seat":2,"place":"mail"},{"seat":1,"place":"mail"}] [{"seat":0,"place":"mail"},{"seat":2,"place":"mail"}]');
  });

  it("재즈 바 판의 표본은 거리만 본다(같은 좌표, 맵만 다르다)", () => {
    const bar = barErrand();
    const barNext = sampleErrand(bar, posTable(bar, { 0: { x: -390, z: -220 }, 1: { x: -370, z: -220 }, 2: { x: 520, z: 500 } }), 5000);
    const near = (seat: number): string => (barNext.players.find((p) => p.seat === seat)!.errandNear ?? []).join(",");
    expect(`${near(0)}/${near(1)}/${near(2)}`).toBe("1/0/");
  });
});

describe("근처 snap nearSnapFrame 의 맵 인자 (D-17, T-20-10)", () => {
  const s = townErrand();
  const NOW = 10_000;
  const segs: Record<string, Segment> = {};
  for (const [seat, p] of Object.entries(SPREAD)) segs[idOfSeat(s, Number(seat))] = restSegment(p.x, p.z, 0);
  const world = (over: Record<number, Segment> = {}): WorldState => {
    const merged = { ...segs };
    for (const [seat, seg] of Object.entries(over)) merged[idOfSeat(s, Number(seat))] = seg;
    return { ...emptyWorld(), segs: merged };
  };
  /** 우체국 안 자리에서 문을 지나 문 앞으로 곧게 걷는 구간(0.1초 전 출발 — 지금은 아직 방 안이다). */
  const WALK_OUT: Segment = { p: [POST.inside.x, POST.inside.z, POST.front.x, POST.front.z], t0: NOW - 100, v: MOVE_V };
  const seatsIn = (f: { ents: Array<{ s: number }> }): string => f.ents.map((e) => e.s).join(",");

  it("마을: 방 안 사람의 근처 snap 에 벽 너머 사람이 없고, 문 밖 사람의 근처 snap 에는 방 안 사람이 없다", () => {
    const got = `${seatsIn(nearSnapFrame(world(), s.players, idOfSeat(s, 0), NOW, TOWN_MAP))} / ${seatsIn(nearSnapFrame(world(), s.players, idOfSeat(s, 1), NOW, TOWN_MAP))}`;
    expect(got).toBe("0,2 / 1");
  });

  it("마을: 문을 지나 나가는 중인 같은 방 사람의 구간은 그 방 안에서 끝난다(문턱 뒤 좌표가 없다)", () => {
    const frame = nearSnapFrame(world({ 2: WALK_OUT }), s.players, idOfSeat(s, 0), NOW, TOWN_MAP);
    const walker = frame.ents.find((e) => e.s === 2)!;
    const here = positionAtFx(WALK_OUT, NOW);
    expect(`${seatsIn(frame)} [${zonesOfPts(walker.p)}] start=${walker.p[0]},${walker.p[1]} t0=${walker.t0} endZ=${walker.p[walker.p.length - 1]} v=${walker.v} near=${frame.near}`).toBe(
      `0,2 [post] start=${here.x},${here.z} t0=${NOW} endZ=${POST.inner.z1 - 1} v=${MOVE_V} near=true`,
    );
  });

  it("마을: 본인의 구간은 문을 지나도 자르지 않는다", () => {
    const frame = nearSnapFrame(world({ 2: WALK_OUT }), s.players, idOfSeat(s, 2), NOW, TOWN_MAP);
    const mine = frame.ents.find((e) => e.s === 2)!;
    expect(`${seatsIn(frame)} [${zonesOfPts(mine.p)}] end=${mine.p[mine.p.length - 2]},${mine.p[mine.p.length - 1]}`).toBe(`0,2 [post>plaza] end=${POST.front.x},${POST.front.z}`);
  });

  it("맵 인자가 없으면 지금처럼 반경 안 사람을 모두 싣는다", () => {
    expect(seatsIn(nearSnapFrame(world(), s.players, idOfSeat(s, 0), NOW))).toBe("0,1,2");
  });

  it("방이 없는 맵(재즈 바)을 넘겨도 인자가 없을 때와 프레임이 같다", () => {
    const w = world({ 2: WALK_OUT });
    const same = s.players.every((p) => JSON.stringify(nearSnapFrame(w, s.players, p.id, NOW, BAR_MAP)) === JSON.stringify(nearSnapFrame(w, s.players, p.id, NOW)));
    expect(same).toBe(true);
  });
});
