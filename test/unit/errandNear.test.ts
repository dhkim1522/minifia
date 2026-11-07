// 심부름 근처 판정·목격 표본·근처 snap·받는 사람·me.record (15-02, D-02·D-04·D-08) — 순수 규칙 시험.
// 실패 출력은 한 줄이어야 해서(TAP) 목록 비교는 JSON 문자열로 한다.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { audience, worldVisibleTo } from "../../shared/game/audience";
import { enterDiscussion } from "../../shared/game/discussion";
import { enterErrand, nearIdsOf, nearSnapFrame, sampleErrand } from "../../shared/game/errand";
import { BAR_MAP, UNIT } from "../../shared/game/map";
import { enterNight } from "../../shared/game/night";
import { ERRAND_MS, ERRAND_NEAR_R, ERRAND_TICK_MS, ERRAND_VIEW_HORIZON_MS, RECORD_MAX } from "../../shared/game/phases";
import type { Player, RoomState } from "../../shared/game/room";
import { nextWakeAt, tick } from "../../shared/game/tick";
import { buildView } from "../../shared/game/view";
import { MOVE_V, positionAtFx, restSegment, snapFrame, truncateSegment } from "../../shared/game/world";
import type { Segment, WorldState } from "../../shared/game/world";
import type { PlaceId } from "../../shared/protocol";
import { seededRandInt } from "../helpers/seededRandom";
import { startedAt } from "../helpers/voteState";

function barErrand(seed = 3, n = 6): RoomState {
  const day = { ...startedAt(n, seed, "dayAnnounce"), map: "bar" as const };
  return tick(day, day.phaseEndsAt!, seededRandInt(seed + 1));
}
const R_FX = ERRAND_NEAR_R * UNIT; // 300

/** 좌석 → 위치 표(고정소수점) 로 만든 posOf. 표에 없으면 위치 없음. */
function posTable(state: RoomState, bySeat: Record<number, { x: number; z: number }>): (id: string) => { x: number; z: number } | undefined {
  return (id) => {
    const p = state.players.find((q) => q.id === id);
    return p === undefined ? undefined : bySeat[p.seat];
  };
}
const idOfSeat = (s: RoomState, seat: number): string => s.players.find((p) => p.seat === seat)!.id;
const withPlayers = (s: RoomState, f: (p: Player) => Player): RoomState => ({ ...s, players: s.players.map(f) });

const L_SEG: Segment = { p: [0, 0, 300, 0, 300, 300], t0: 1000, v: 180 }; // ㄱ자, 총 길이 600

describe("구간 자르기", () => {
  it("첫 선분 중간에서 자르면 p[0..1] 이 그 순간 위치이고 점이 원본보다 많지 않다", () => {
    const now = 1000 + 500; // 90 걸음
    const t = truncateSegment(L_SEG, now, ERRAND_VIEW_HORIZON_MS);
    expect([t.p[0], t.p[1]]).toEqual([90, 0]);
    expect(t.t0).toBe(now);
    expect(t.v).toBe(180);
    expect(t.p.length).toBeLessThanOrEqual(L_SEG.p.length);
  });

  it("horizon 안의 모든 시각에서 위치가 원본과 ±1 안에서 같다", () => {
    const now = 1500;
    const t = truncateSegment(L_SEG, now, ERRAND_VIEW_HORIZON_MS);
    for (const dt of [0, 500, 1000, 1500]) {
      const a = positionAtFx(L_SEG, now + dt);
      const b = positionAtFx(t, now + dt);
      expect(JSON.stringify([Math.abs(a.x - b.x) <= 1, Math.abs(a.z - b.z) <= 1, dt])).toBe(JSON.stringify([true, true, dt]));
    }
  });

  it("horizon 길이만큼만 남기고 그 너머 꼭짓점은 없다", () => {
    const t = truncateSegment(L_SEG, 1500, 1000); // 180 만큼: 90 → 270
    expect(t.p.slice(-2)).toEqual([270, 0]);
    expect(JSON.stringify(t.p)).not.toContain("300");
  });

  it("horizon 이 남은 경로보다 길면 끝점에서 멈춘다", () => {
    const t = truncateSegment(L_SEG, 1000 + 3000, 60_000); // 540 걸음, 남은 60
    expect(t.p.slice(-2)).toEqual([300, 300]);
    expect(t.p.length).toBe(4);
  });

  it("서 있는 구간·끝난 구간·now 가 t0 앞인 구간은 한 점", () => {
    expect(truncateSegment(restSegment(40, 50, 0), 5000, 1500).p).toEqual([40, 50]);
    expect(truncateSegment(L_SEG, 1000 + 10_000, 1500).p).toEqual([300, 300]);
    expect(truncateSegment(L_SEG, 500, 1500).p).toEqual([0, 0]);
  });

  it("입력 객체를 바꾸지 않는다", () => {
    const before = JSON.stringify(L_SEG);
    truncateSegment(L_SEG, 1500, 1500);
    expect(JSON.stringify(L_SEG)).toBe(before);
  });
});

describe("근처 판정", () => {
  const players = [
    { id: "a", seat: 0 },
    { id: "b", seat: 1 },
    { id: "c", seat: 2 },
    { id: "d", seat: 3 },
  ];
  const pos = (m: Record<string, { x: number; z: number } | undefined>) => (id: string) => m[id];

  it("정확히 반경은 포함, 1 더 멀면 제외 · seat 오름차순 · 자기 자신 없음", () => {
    const out = nearIdsOf(players, pos({ a: { x: 0, z: 0 }, d: { x: R_FX, z: 0 }, c: { x: 0, z: -R_FX }, b: { x: R_FX + 1, z: 0 } }), "a", R_FX);
    expect(JSON.stringify(out)).toBe(JSON.stringify(["c", "d"]));
  });

  it("죽은 사람은 보는 쪽도 대상도 아니다", () => {
    const dead = [{ id: "a", seat: 0 }, { id: "b", seat: 1, alive: false }, { id: "c", seat: 2 }];
    const p = pos({ a: { x: 0, z: 0 }, b: { x: 10, z: 0 }, c: { x: 20, z: 0 } });
    expect(nearIdsOf(dead, p, "a", R_FX)).toEqual(["c"]);
    expect(nearIdsOf(dead, p, "b", R_FX)).toEqual([]);
  });

  it("위치가 없는 사람은 제외, 보는 사람이 위치가 없으면 빈 배열", () => {
    expect(nearIdsOf(players, pos({ a: { x: 0, z: 0 }, b: { x: 5, z: 5 } }), "a", R_FX)).toEqual(["b"]);
    expect(nearIdsOf(players, pos({ b: { x: 5, z: 5 } }), "a", R_FX)).toEqual([]);
  });
});

describe("목격 표본", () => {
  const FAR = { x: 600, z: 600 };
  const GLASS = { x: -390, z: -220 }; // glass 장소 중앙
  const PIANO = { x: -260, z: -560 };

  it("새로 가까워진 B 마다 줄이 생기고 place 는 B 에게 가장 가까운 장소 id", () => {
    const s = barErrand();
    const at = s.phaseEndsAt! - 10_000;
    const out = sampleErrand(s, posTable(s, { 0: GLASS, 1: { x: GLASS.x + 20, z: GLASS.z }, 2: PIANO, 3: FAR, 4: { x: 650, z: -650 }, 5: { x: -650, z: 650 } }), at);
    const a = out.players.find((p) => p.seat === 0)!;
    const b = out.players.find((p) => p.seat === 1)!;
    expect(JSON.stringify(a.errandSeen)).toBe(JSON.stringify([{ seat: 1, place: "glass" }]));
    expect(JSON.stringify(b.errandSeen)).toBe(JSON.stringify([{ seat: 0, place: "glass" }]));
    expect(JSON.stringify(a.errandNear)).toBe("[1]");
    expect(out.errandTickAt).toBe(at + ERRAND_TICK_MS);
  });

  it("같은 근처 안에 계속 있으면 줄이 더 안 생기고, 나갔다 다시 들어오면 새 줄", () => {
    const s = barErrand();
    const near = { 0: GLASS, 1: { x: GLASS.x + 20, z: GLASS.z }, 2: FAR, 3: { x: 650, z: -650 }, 4: { x: -650, z: 650 }, 5: { x: 650, z: 650 } };
    const gone = { ...near, 1: PIANO };
    let t = sampleErrand(s, posTable(s, near), 1000);
    t = sampleErrand(t, posTable(t, near), 2000);
    expect(t.players.find((p) => p.seat === 0)!.errandSeen).toHaveLength(1);
    t = sampleErrand(t, posTable(t, gone), 3000);
    expect(JSON.stringify(t.players.find((p) => p.seat === 0)!.errandNear)).toBe("[]");
    t = sampleErrand(t, posTable(t, near), 4000);
    expect(t.players.find((p) => p.seat === 0)!.errandSeen).toHaveLength(2);
  });

  it("상한 RECORD_MAX 에서 멈추고 앞 여섯 줄이 그대로", () => {
    const s = barErrand(3, 8);
    const spots = (bIn: boolean) => {
      const m: Record<number, { x: number; z: number }> = { 0: { x: 0, z: 0 } };
      for (let seat = 1; seat < 8; seat++) m[seat] = bIn ? { x: 10 * seat, z: 0 } : { x: 600, z: 600 - 150 * seat };
      return m;
    };
    // 한 표본에 일곱 명이 한꺼번에 들어와도 앞 여섯(seat 오름차순)에서 멈추고, 나갔다 다시 들어와도 더 안 쌓인다.
    let t = sampleErrand(s, posTable(s, spots(true)), 1000);
    t = sampleErrand(t, posTable(t, spots(false)), 2000);
    t = sampleErrand(t, posTable(t, spots(true)), 3000);
    const seen = t.players.find((p) => p.seat === 0)!.errandSeen!;
    expect(seen.length).toBe(RECORD_MAX);
    expect(seen.map((l) => l.seat)).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it("errand 가 아닌 단계에서는 입력 그대로 · 입력 상태는 바뀌지 않는다", () => {
    const s = barErrand();
    const day = { ...s, phase: "discussion" as const };
    expect(sampleErrand(day, () => ({ x: 0, z: 0 }), 1)).toBe(day);
    const before = JSON.stringify(s);
    sampleErrand(s, () => ({ x: 0, z: 0 }), 1);
    expect(JSON.stringify(s)).toBe(before);
  });

  it("역할 무관: 위치가 같으면 역할만 달라도 같은 근처·같은 목격 줄", () => {
    const s = barErrand();
    const flipped = withPlayers(s, (p) => ({ ...p, role: p.role === "mafia" ? "citizen" : "mafia" }));
    const table = { 0: GLASS, 1: { x: GLASS.x + 30, z: GLASS.z }, 2: PIANO, 3: { x: PIANO.x + 30, z: PIANO.z }, 4: FAR, 5: { x: 650, z: -650 } };
    const pick = (st: RoomState) => JSON.stringify(st.players.map((p) => [p.seat, p.errandNear, p.errandSeen]));
    expect(pick(sampleErrand(s, posTable(s, table), 7))).toBe(pick(sampleErrand(flipped, posTable(flipped, table), 7)));
  });

  it("errand.ts 는 역할을 읽지 않는다(주석 제외)", () => {
    const src = readFileSync("shared/game/errand.ts", "utf8");
    const code = src.split("\n").filter((l) => !l.trim().startsWith("//")).join("\n");
    expect(code.includes(".role")).toBe(false);
  });
});

describe("근처 snap", () => {
  const players = [0, 1, 2, 3].map((seat) => ({ id: `p${seat}`, seat }));
  const world = (segs: Record<string, Segment>): WorldState => ({ segs, lastMoveAt: {}, wanderAt: {} });
  const walker: Segment = { p: [100, 0, 700, 0], t0: 0, v: MOVE_V }; // 3.3초 걸리는 긴 걷기

  it("본인은 전체 구간(snapFrame 과 같은 접기), 근처는 잘린 구간, 반경 밖은 ents 에 없다", () => {
    const w = world({ p0: { p: [0, 0, 500, 0], t0: 0, v: MOVE_V }, p1: walker, p2: restSegment(0, 200, 0), p3: restSegment(0, 600, 0) });
    const f = nearSnapFrame(w, players, "p0", 1000);
    expect(f.near).toBe(true);
    expect(f.ents.map((e) => e.s)).toEqual([0, 1, 2]);
    const own = f.ents.find((e) => e.s === 0)!;
    expect(JSON.stringify(own)).toBe(JSON.stringify(snapFrame(w, [players[0]!], 1000).ents[0]));
    const p1 = f.ents.find((e) => e.s === 1)!;
    expect(p1.p.length).toBeLessThanOrEqual(walker.p.length);
    expect(p1.t0).toBe(1000);
    expect(p1.p[p1.p.length - 2]).toBeLessThan(700); // 목적지 좌표는 새지 않는다
  });

  it("죽은 사람은 없고 일반 snapFrame 에는 near 키가 없다", () => {
    const w = world({ p0: restSegment(0, 0, 0), p1: restSegment(10, 0, 0), p2: restSegment(20, 0, 0), p3: restSegment(30, 0, 0) });
    const withDead = players.map((p) => (p.seat === 2 ? { ...p, alive: false } : p));
    expect(nearSnapFrame(w, withDead, "p0", 0).ents.map((e) => e.s)).toEqual([0, 1, 3]);
    expect("near" in snapFrame(w, players, 0)).toBe(false);
  });

  it("역할이 달라도 같은 위치면 같은 모양(키 이름·구조)", () => {
    const w = world({ p0: restSegment(0, 0, 0), p1: restSegment(10, 0, 0), p2: restSegment(20, 0, 0), p3: restSegment(30, 0, 0) });
    expect(Object.keys(nearSnapFrame(w, players, "p0", 5)).sort().join(",")).toBe("at,ents,k,near,t");
    expect(JSON.stringify(nearSnapFrame(w, players, "p0", 5))).toBe(JSON.stringify(nearSnapFrame(w, players.map((p) => ({ ...p })), "p0", 5)));
  });
});

describe("errand 받는 사람", () => {
  const errand = barErrand();
  const ghostly = (seats: number[]): RoomState => withPlayers(errand, (p) => (seats.includes(p.seat) ? { ...p, alive: false } : p));

  it("산 mover → 본인 + 유령 전원, 유령 mover → 유령 전원", () => {
    const s = ghostly([4, 5]);
    const alive = audience(s, { k: "world", mover: idOfSeat(s, 0) });
    expect(JSON.stringify([...alive].sort())).toBe(JSON.stringify([idOfSeat(s, 0), idOfSeat(s, 4), idOfSeat(s, 5)].sort()));
    const ghost = audience(s, { k: "world", mover: idOfSeat(s, 4) });
    expect(JSON.stringify([...ghost].sort())).toBe(JSON.stringify([idOfSeat(s, 4), idOfSeat(s, 5)].sort()));
  });

  it("산 mover 인데 방에 없으면 빈 집합", () => {
    expect(audience(errand, { k: "world", mover: "nobody" }).size).toBe(0);
  });

  it("worldVisibleTo: 산 viewer → 본인 한 칸, 유령 → 전원", () => {
    const s = ghostly([5]);
    expect([...worldVisibleTo(s, idOfSeat(s, 0))]).toEqual([idOfSeat(s, 0)]);
    expect(worldVisibleTo(s, idOfSeat(s, 5)).size).toBe(6);
  });

  it("회귀: 토론 단계의 산 mover 는 산 사람 전원 + 유령, 단계 길이는 그대로", () => {
    const s = { ...errand, phase: "discussion" as const };
    expect(audience(s, { k: "world", mover: idOfSeat(s, 0) }).size).toBe(6);
    expect(worldVisibleTo(s, idOfSeat(s, 0)).size).toBe(6);
    expect(ERRAND_MS).toBe(40_000);
  });
});

describe("tick·진입·이탈 청소", () => {
  it("nextWakeAt: errand 에서는 errandTickAt 이 마감보다 이르면 그 시각, 다른 단계는 무시", () => {
    const s = barErrand();
    expect(s.errandTickAt).toBe(s.phaseEndsAt! - ERRAND_MS + ERRAND_TICK_MS);
    expect(nextWakeAt(s)).toBe(s.errandTickAt);
    expect(nextWakeAt({ ...s, errandTickAt: s.phaseEndsAt! + 5000 })).toBeLessThanOrEqual(s.phaseEndsAt!);
    expect(nextWakeAt({ ...s, phase: "discussion", errandTickAt: 1 })).not.toBe(1);
  });

  it("enterErrand(at): errandTickAt = at + 1초, errandNear·errandSeen 이 비어 있다", () => {
    const s = barErrand();
    const dirty = withPlayers(s, (p) => ({ ...p, errandNear: [1], errandSeen: [{ seat: 1, place: "glass" as PlaceId }] }));
    const out = enterErrand(dirty, seededRandInt(1), 5000);
    expect(out.errandTickAt).toBe(5000 + ERRAND_TICK_MS);
    expect(out.players.some((p) => "errandNear" in p || "errandSeen" in p)).toBe(false);
  });

  it("enterDiscussion 은 errandTickAt 을 지우고 errandSeen 은 남긴다, enterNight 은 둘 다 지운다", () => {
    const s = withPlayers(barErrand(), (p) => ({ ...p, errandNear: [1], errandSeen: [{ seat: 1, place: "glass" as PlaceId }] }));
    const d = enterDiscussion(s);
    expect("errandTickAt" in d).toBe(false);
    expect(d.players.every((p) => p.errandSeen?.length === 1)).toBe(true);
    const n = enterNight(d);
    expect(n.players.some((p) => "errandNear" in p || "errandSeen" in p)).toBe(false);
  });
});

describe("me.record (D-04)", () => {
  const done3 = (s: RoomState, seats: number[], seen: Array<{ seat: number; place: PlaceId }>): RoomState =>
    withPlayers(s, (p) =>
      seats.includes(p.seat)
        ? { ...p, errandPlaces: ["glass", "piano", "sax"] as PlaceId[], errandDone: ["glass", "piano", "sax"] as PlaceId[], errandSeen: seen }
        : { ...p, errandPlaces: ["glass", "piano", "sax"] as PlaceId[], errandDone: ["glass", "piano"] as PlaceId[], errandSeen: seen },
    );
  const disc = (s: RoomState): RoomState => ({ ...s, phase: "discussion" });
  const meOf = (s: RoomState, seat: number) => buildView(s, idOfSeat(s, seat), 0).me;

  it("토론·산 사람·3곳 처리 → {seat, place} 배열, 줄이 0이면 빈 배열", () => {
    const s = disc(done3(barErrand(), [0], [{ seat: 3, place: "sax" }]));
    expect(JSON.stringify(meOf(s, 0).record)).toBe(JSON.stringify([{ seat: 3, place: "sax" }]));
    expect(JSON.stringify(meOf(disc(done3(barErrand(), [0], [])), 0).record)).toBe("[]");
  });

  it("2곳만 처리했으면 키가 없다", () => {
    const s = disc(done3(barErrand(), [0], [{ seat: 3, place: "sax" }]));
    expect("record" in meOf(s, 1)).toBe(false);
  });

  it("errand·밤 단계, 유령, 다른 사람 view 에는 키가 없다", () => {
    const base = done3(barErrand(), [0, 1], [{ seat: 3, place: "sax" }]);
    expect("record" in meOf(base, 0)).toBe(false); // errand
    expect("record" in meOf({ ...base, phase: "night" }, 0)).toBe(false);
    const ghost = withPlayers(disc(base), (p) => (p.seat === 0 ? { ...p, alive: false } : p));
    expect("record" in meOf(ghost, 0)).toBe(false);
    // 0 번의 줄은 1 번의 view 어디에도 없다
    const json = JSON.stringify(buildView(disc(done3(barErrand(), [0], [{ seat: 3, place: "sax" }])), idOfSeat(disc(base), 2), 0));
    expect(json.includes('"record"')).toBe(false);
  });

  it("일곱 줄이 쌓였어도 여섯 줄, 줄 키는 seat·place 뿐", () => {
    const seven = Array.from({ length: 7 }, (_, i) => ({ seat: i, place: "glass" as PlaceId, extra: "x" }));
    const s = disc(done3(barErrand(), [0], seven as Array<{ seat: number; place: PlaceId }>));
    const rec = meOf(s, 0).record!;
    expect(rec).toHaveLength(RECORD_MAX);
    expect(Object.keys(rec[0]!).sort().join(",")).toBe("place,seat");
  });

  it("마피아·시민이 같은 규칙(역할을 읽지 않는다)", () => {
    const base = disc(done3(barErrand(), [0, 1, 2, 3, 4, 5], [{ seat: 3, place: "sax" }]));
    const roles = base.players.map((p) => p.role);
    expect(new Set(roles).size).toBeGreaterThan(1);
    for (const p of base.players) expect(JSON.stringify(meOf(base, p.seat).record)).toBe(JSON.stringify([{ seat: 3, place: "sax" }]));
  });
});

// BAR_MAP import 가 장소 데이터와 어긋나지 않는지(시험 속 좌표 상수의 근거)
describe("시험 좌표 상수", () => {
  it("glass·piano 중앙", () => {
    const c = (id: string) => BAR_MAP.places!.find((p) => p.id === id)!;
    expect([Math.round(c("glass").x * UNIT), Math.round(c("glass").z * UNIT)]).toEqual([-390, -220]);
    expect([Math.round(c("piano").x * UNIT), Math.round(c("piano").z * UNIT)]).toEqual([-260, -560]);
  });
});
