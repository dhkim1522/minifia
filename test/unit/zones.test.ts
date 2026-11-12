// 문 통과의 순수 규칙(20-02): 다음 통과 시각 nextCrossingAt · 구역 기억 맞추기 reconcileZones·settleZones · world.zones 저장(D-14·D-15).
// 실패 출력이 한 줄이 되게(TAP) 값은 문자열로 비교한다.
import { describe, expect, it } from "vitest";
import { BAR_MAP } from "../../shared/game/map";
import { PLAZA_MAP } from "../../shared/game/mapPlaza";
import { TOWN_MAP, TOWN_ROOMS } from "../../shared/game/mapTown";
import { MOVE_V, compactWorld, despawnPlayer, emptyWorld, respawnAll, restoreWorld, segmentEndsAt } from "../../shared/game/world";
import type { Segment, WorldState } from "../../shared/game/world";
import { clipToZone, nextCrossingAt, reconcileZones, settleZones, zoneAt, zoneOf } from "../../shared/game/zones";

const T0 = 1_700_000_000_000; // 실제 서버 시각 크기(32비트를 넘는다)
const POST = TOWN_ROOMS.find((r) => r.id === "post")!;
const PUB = TOWN_ROOMS.find((r) => r.id === "pub")!;
const seg = (p: number[], t0 = T0): Segment => ({ p, t0, v: MOVE_V });
const stand = (at: { x: number; z: number }, t0 = T0): Segment => ({ p: [at.x, at.z], t0, v: MOVE_V });
const PLAZA_SPOT = { x: 25, z: 325 }; // 광장 가운데 쪽 걷는 칸
/** 우체국 문 앞 → 방 안(직선, 문턱을 한 번 넘는다) */
const ENTER = seg([POST.front.x, POST.front.z, POST.inside.x, POST.inside.z]);
/** 방 안 → 문 앞 */
const LEAVE = seg([POST.inside.x, POST.inside.z, POST.front.x, POST.front.z]);
const zonesOfSeg = (s: Segment): string => {
  const out: string[] = [];
  for (let i = 0; i + 1 < s.p.length; i += 2) out.push(zoneOf(TOWN_MAP, s.p[i]!, s.p[i + 1]!));
  return out.join(",");
};
const j = (x: unknown): string => JSON.stringify(x);
/** 구역 기억을 id 순으로 한 줄로 (키 순서에 기대지 않는다) */
const zs = (z: WorldState["zones"] | undefined): string =>
  z === undefined
    ? "none"
    : Object.keys(z)
        .sort()
        .map((id) => `${id}:${z[id]}`)
        .join(",");

describe("다음 문 통과 시각 nextCrossingAt (D-14)", () => {
  it("문 앞 → 방 안: 구간 안의 정수 ms 이고 그 시각은 post, 1ms 전은 plaza 다", () => {
    const tc = nextCrossingAt(TOWN_MAP, ENTER, ENTER.t0);
    const got = tc === null ? "null" : `${Number.isInteger(tc)} ${tc > ENTER.t0 && tc < segmentEndsAt(ENTER)} ${zoneAt(TOWN_MAP, ENTER, tc)} ${zoneAt(TOWN_MAP, ENTER, tc - 1)}`;
    expect(got).toBe("true true post plaza");
  });

  it("after 가 구간 출발 전이거나 통과 1ms 전이면 같은 시각, 통과 시각 이후면 null 이다", () => {
    const tc = nextCrossingAt(TOWN_MAP, ENTER, ENTER.t0) ?? -1;
    const rel = (t: number | null): string => (t === null ? "null" : t === tc ? "tc" : `tc${t - tc >= 0 ? "+" : ""}${t - tc}`);
    const got = [
      nextCrossingAt(TOWN_MAP, ENTER, ENTER.t0 - 5000),
      nextCrossingAt(TOWN_MAP, ENTER, tc - 1),
      nextCrossingAt(TOWN_MAP, ENTER, tc),
      nextCrossingAt(TOWN_MAP, ENTER, tc + 100),
      nextCrossingAt(TOWN_MAP, ENTER, segmentEndsAt(ENTER) + 1000),
    ].map(rel);
    expect(`${tc > 0} ${got.join(",")}`).toBe("true tc,tc,null,null,null");
  });

  it("방 안 → 문 앞: 그 시각은 plaza, 1ms 전은 post 다", () => {
    const tc = nextCrossingAt(TOWN_MAP, LEAVE, LEAVE.t0);
    const got = tc === null ? "null" : `${zoneAt(TOWN_MAP, LEAVE, tc)} ${zoneAt(TOWN_MAP, LEAVE, tc - 1)}`;
    expect(got).toBe("plaza post");
  });

  it("광장 안에서만 걷는 구간·서 있는 구간(광장·방 안)은 null 이다", () => {
    const got = [
      nextCrossingAt(TOWN_MAP, seg([PLAZA_SPOT.x, PLAZA_SPOT.z, POST.front.x, POST.front.z]), T0),
      nextCrossingAt(TOWN_MAP, stand(PLAZA_SPOT), T0),
      nextCrossingAt(TOWN_MAP, stand(POST.inside), T0),
      nextCrossingAt(TOWN_MAP, stand(POST.inside), T0 + 60_000),
    ];
    expect(j(got)).toBe("[null,null,null,null]");
  });

  it("방이 없는 맵(재즈 바·광장)은 같은 구간이어도 늘 null 이다", () => {
    const got = [nextCrossingAt(BAR_MAP, ENTER, T0), nextCrossingAt(PLAZA_MAP, ENTER, T0), nextCrossingAt({}, LEAVE, T0), nextCrossingAt({ rooms: [] }, ENTER, T0 - 10)];
    expect(j(got)).toBe("[null,null,null,null]");
  });

  it("두 번 넘는 길(우체국 안 → 문 앞 → 술집 문 앞 → 술집 안): 처음은 나오는 순간, 그 뒤는 술집에 드는 순간, 그 뒤는 null", () => {
    const s = seg([POST.inside.x, POST.inside.z, POST.front.x, POST.front.z, PUB.front.x, PUB.front.z, PUB.inside.x, PUB.inside.z]);
    const t1 = nextCrossingAt(TOWN_MAP, s, s.t0);
    const t2 = t1 === null ? null : nextCrossingAt(TOWN_MAP, s, t1);
    const t3 = t2 === null ? "none" : nextCrossingAt(TOWN_MAP, s, t2);
    const got = t1 === null || t2 === null ? "null" : `${zoneAt(TOWN_MAP, s, t1 - 1)}>${zoneAt(TOWN_MAP, s, t1)} ${zoneAt(TOWN_MAP, s, t2 - 1)}>${zoneAt(TOWN_MAP, s, t2)} ${t2 > t1} ${t3}`;
    expect(got).toBe("post>plaza plaza>pub true null");
  });

  it("나타남 구간: clipToZone(통과 시각)의 모든 점이 post 이고 끝점이 방 안 자리, t0 는 통과 시각이다", () => {
    const tc = nextCrossingAt(TOWN_MAP, ENTER, ENTER.t0) ?? -1;
    const cut = clipToZone(TOWN_MAP, ENTER, tc);
    const end = `${cut.p[cut.p.length - 2]},${cut.p[cut.p.length - 1]}`;
    expect(`${tc > 0} ${zonesOfSeg(cut)} end=${end} t0=${cut.t0 === tc}`).toBe(`true post,post end=${POST.inside.x},${POST.inside.z} t0=true`);
  });

  it("입력 구간을 바꾸지 않는다", () => {
    const before = j(ENTER);
    nextCrossingAt(TOWN_MAP, ENTER, ENTER.t0);
    expect(j(ENTER)).toBe(before);
  });
});

/** a = 우체국 안, b = 광장, c = 술집 안에 서 있는 world */
const standing = (zones?: WorldState["zones"]): WorldState => ({
  ...emptyWorld(),
  segs: { a: stand(POST.inside), b: stand(PLAZA_SPOT), c: stand(PUB.inside) },
  ...(zones === undefined ? {} : { zones }),
});

describe("구역 기억 맞추기 reconcileZones·settleZones (D-14)", () => {
  it("기억이 없는 사람은 알림 없이 지금 구역이 기억된다", () => {
    const r = reconcileZones(TOWN_MAP, standing(), ["a", "b", "c"], T0);
    expect(`${j(r.changes)} ${zs(r.world.zones)}`).toBe("[] a:post,b:plaza,c:pub");
  });

  it("기억이 plaza 인 사람이 지금 post 면 changes 에 한 건이고 기억이 post 로 바뀐다(다른 사람은 그대로)", () => {
    const r = reconcileZones(TOWN_MAP, standing({ a: "plaza", b: "plaza", c: "pub" }), ["a", "b", "c"], T0);
    expect(`${j(r.changes)} ${zs(r.world.zones)}`).toBe('[{"id":"a","from":"plaza","to":"post"}] a:post,b:plaza,c:pub');
  });

  it("구간의 지금 위치로 판정한다: 문 앞 → 방 안 구간은 통과 1ms 전까지 바뀜이 없고 통과 시각에 한 건이다", () => {
    const tc = nextCrossingAt(TOWN_MAP, ENTER, ENTER.t0) ?? -1;
    const w: WorldState = { ...emptyWorld(), segs: { a: ENTER }, zones: { a: "plaza" } };
    const before = reconcileZones(TOWN_MAP, w, ["a"], tc - 1);
    const at = reconcileZones(TOWN_MAP, w, ["a"], tc);
    expect(`${tc > 0} ${j(before.changes)} ${j(at.changes)}`).toBe('true [] [{"id":"a","from":"plaza","to":"post"}]');
  });

  it("아무도 안 바뀌면 같은 world 객체를 돌려준다", () => {
    const w = standing({ a: "post", b: "plaza", c: "pub" });
    const r = reconcileZones(TOWN_MAP, w, ["a", "b", "c"], T0);
    expect(`${r.world === w} ${j(r.changes)}`).toBe("true []");
  });

  it("ids 에 없는 사람·구간이 없는 사람은 건드리지 않고, 여러 명이 바뀌면 ids 순서대로 낸다", () => {
    const w = standing({ a: "plaza", b: "post", c: "plaza" });
    const r = reconcileZones(TOWN_MAP, w, ["c", "ghost", "a"], T0);
    expect(`${j(r.changes)} ${zs(r.world.zones)}`).toBe('[{"id":"c","from":"plaza","to":"pub"},{"id":"a","from":"plaza","to":"post"}] a:post,b:post,c:pub');
  });

  it("입력 world 를 바꾸지 않는다", () => {
    const w = standing({ a: "plaza", b: "plaza", c: "pub" });
    const before = j(w);
    reconcileZones(TOWN_MAP, w, ["a", "b", "c"], T0);
    settleZones(TOWN_MAP, w, ["a", "b", "c"], T0);
    expect(j(w)).toBe(before);
  });

  it("settleZones 는 바뀜 목록 없이 모두를 지금 구역으로 기억한다(이미 맞으면 같은 객체)", () => {
    const w = standing({ a: "plaza", c: "plaza" });
    const settled = settleZones(TOWN_MAP, w, ["a", "b", "c"], T0);
    const again = settleZones(TOWN_MAP, settled, ["a", "b", "c"], T0);
    expect(`${zs(settled.zones)} ${again === settled} ${j(reconcileZones(TOWN_MAP, settled, ["a", "b", "c"], T0).changes)}`).toBe("a:post,b:plaza,c:pub true []");
  });

  it("방이 없는 맵에서는 둘 다 world 를 그대로 돌려주고 구역 기억을 만들지 않는다", () => {
    const w = standing();
    const r = reconcileZones(BAR_MAP, w, ["a", "b", "c"], T0);
    const s = settleZones(PLAZA_MAP, w, ["a", "b", "c"], T0);
    expect(`${r.world === w} ${j(r.changes)} ${s === w} ${"zones" in r.world}`).toBe("true [] true false");
  });
});

describe("구역 기억의 저장·복원 world.zones (T-20-08)", () => {
  const players = [
    { id: "a", seat: 0 },
    { id: "b", seat: 1 },
  ];
  const world = (zones: WorldState["zones"]): WorldState => ({ ...emptyWorld(), segs: { a: stand(POST.inside), b: stand(PLAZA_SPOT) }, ...(zones === undefined ? {} : { zones }) });

  it("compactWorld → (JSON) → restoreWorld 를 거쳐 방에 있는 사람의 구역 기억이 남는다", () => {
    const stored = JSON.parse(JSON.stringify(compactWorld(world({ a: "post", b: "plaza" }), T0))) as unknown;
    const back = restoreWorld(stored, players, T0 + 10, TOWN_MAP);
    expect(`${zs((stored as { zones?: WorldState["zones"] }).zones)} ${zs(back.zones)}`).toBe("a:post,b:plaza a:post,b:plaza");
  });

  it("방에 없는 id 와 ZONE_IDS 밖 값·문자열이 아닌 값은 버린다", () => {
    const stored = { ...compactWorld(world(undefined), T0), zones: { a: "post", b: "cellar", gone: "pub" } };
    const stored2 = { ...compactWorld(world(undefined), T0), zones: { a: 3, b: "plaza" } };
    const stored3 = { ...compactWorld(world(undefined), T0), zones: ["post", "plaza"] };
    const got = [restoreWorld(stored, players, T0, TOWN_MAP).zones, restoreWorld(stored2, players, T0, TOWN_MAP).zones, restoreWorld(stored3, players, T0, TOWN_MAP).zones];
    expect(got.map(zs).join(" | ")).toBe("a:post | b:plaza | none");
  });

  it("구역 기억이 없는 world 는 저장에도 복원에도 zones 키가 없다(재즈 바·광장의 저장 모양 그대로)", () => {
    const stored = compactWorld(world(undefined), T0);
    const back = restoreWorld(JSON.parse(JSON.stringify(stored)), players, T0, TOWN_MAP);
    expect(`${"zones" in stored} ${"zones" in back}`).toBe("false false");
  });

  it("compactWorld 는 구역 기억을 복사한다(같은 객체를 내주지 않는다)", () => {
    const zones = { a: "post", b: "plaza" } as const;
    const stored = compactWorld(world(zones), T0);
    expect(`${zs(stored.zones)} ${stored.zones !== zones}`).toBe("a:post,b:plaza true");
  });

  it("despawnPlayer 는 그 사람 칸만 지우고 respawnAll 은 구역 기억 전체를 지운다", () => {
    const w = world({ a: "post", b: "plaza" });
    const left = despawnPlayer(w, "a");
    const fresh = respawnAll(w, players, T0, TOWN_MAP);
    expect(`${zs(left.zones)} ${"zones" in fresh}`).toBe("b:plaza false");
  });
});
