// 심부름 규칙(15페이즈, 결정 0074 예정): 단계 표·장소 배정·맵 장소 데이터·처리 규칙·봇 계획·view·이동 권한을 확인한다.
// 실패 출력은 한 줄이어야 해서(TAP) 목록 비교는 JSON 문자열로 한다.
import { readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { isAlive } from "../../shared/game/alive";
import { channelOf } from "../../shared/game/audience";
import { BOT_END_MARGIN_MS, botPlanKey, planBotSteps } from "../../shared/game/bots";
import { actErrand, enterErrand, nearestPlaceId, placeCenterFx, sampleErrand } from "../../shared/game/errand";
import { BAR_MAP, BAR_PLACES, UNIT, cellOfFx, isWalkable, routeFx, snapToWalkable } from "../../shared/game/map";
import { PLAZA_MAP, PLAZA_PLACES } from "../../shared/game/mapPlaza";
import { mapOf } from "../../shared/game/maps";
import { canMoveIn } from "../../shared/game/movement";
import { ERRAND_ACT_R, ERRAND_COUNT, ERRAND_MS, PHASE_DEFS } from "../../shared/game/phases";
import type { Player, RoomState } from "../../shared/game/room";
import { tick } from "../../shared/game/tick";
import { buildView } from "../../shared/game/view";
import { PLACE_IDS } from "../../shared/protocol";
import { ClientMessageSchema } from "../../shared/schemas";
import { seededRandInt } from "../helpers/seededRandom";
import { lobbyOf, startedAt, startedFrom } from "../helpers/voteState";

/** 재즈 바로 고정한 심부름 방(시작 때 맵은 시드로 정해지므로 시험이 맵을 고정한다). */
function barRoom(seed: number, phase: "dayAnnounce" | "errand", n = 6): RoomState {
  const day = { ...startedAt(n, seed, "dayAnnounce"), map: "bar" as const };
  return phase === "dayAnnounce" ? day : tick(day, day.phaseEndsAt!, seededRandInt(seed + 1));
}
const byId = (state: RoomState, id: string): Player => state.players.find((p) => p.id === id)!;

describe("단계 표", () => {
  it("낮 시작 다음이 errand 이고 길이 40초 · errand 다음이 토론", () => {
    expect(PHASE_DEFS.dayAnnounce.next).toBe("errand");
    expect(PHASE_DEFS.errand.durationMs).toBe(ERRAND_MS);
    expect(ERRAND_MS).toBe(40_000);
    expect(PHASE_DEFS.errand.next).toBe("discussion");
  });

  it("tick 이 dayAnnounce 마감에서 errand, errand 마감에서 discussion 으로 간다", () => {
    const day = barRoom(3, "dayAnnounce");
    const errand = tick(day, day.phaseEndsAt!, seededRandInt(9));
    expect(errand.phase).toBe("errand");
    expect(errand.phaseEndsAt).toBe(day.phaseEndsAt! + ERRAND_MS);
    const talk = tick(errand, errand.phaseEndsAt!, seededRandInt(9));
    expect(talk.phase).toBe("discussion");
  });

  it("상수는 phases.ts 한 곳에만 정의된다", () => {
    const hits = ["shared", "src", "worker"]
      .flatMap((dir) => readdirTs(dir))
      .filter((f) => /export const ERRAND_MS\s*=/.test(readFileSync(f, "utf8")));
    expect(hits).toEqual(["shared/game/phases.ts"]);
  });
});

function readdirTs(dir: string): string[] {
  const out: string[] = [];
  const walk = (d: string): void => {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      const p = `${d}/${e.name}`;
      if (e.isDirectory()) walk(p);
      else if (/\.(ts|tsx)$/.test(e.name)) out.push(p);
    }
  };
  walk(dir);
  return out;
}

describe("맵 장소 데이터", () => {
  const cases = [
    { name: "재즈 바", map: BAR_MAP, places: BAR_PLACES, expected: ["glass", "piano", "sax", "stool", "door", "poster", "record", "candle"] },
    { name: "시계탑 광장", map: PLAZA_MAP, places: PLAZA_PLACES, expected: ["clock", "fountain", "bench", "lamp", "mail", "tree", "flower", "stand"] },
  ];
  for (const c of cases) {
    it(`${c.name}: 8곳·id 고유·PLACE_IDS 안`, () => {
      expect(c.map.places).toBe(c.places);
      expect(c.places.map((p) => p.id)).toEqual(c.expected);
      expect(new Set(c.places.map((p) => p.id)).size).toBe(8);
      for (const p of c.places) expect(PLACE_IDS as readonly string[]).toContain(p.id);
    });
    it(`${c.name}: 중앙이 걷기 칸·서로 2.0 이상·모든 입장 지점에서 닿는다`, () => {
      for (const p of c.places) {
        const cell = cellOfFx(Math.round(p.x * UNIT), Math.round(p.z * UNIT));
        expect(`${p.id}:${isWalkable(c.map, cell.c, cell.r)}`).toBe(`${p.id}:true`);
        expect(snapToWalkable(c.map, { x: Math.round(p.x * UNIT), z: Math.round(p.z * UNIT) }).snapped).toBe(false);
      }
      for (let i = 0; i < c.places.length; i += 1) {
        for (let j = i + 1; j < c.places.length; j += 1) {
          const a = c.places[i]!;
          const b = c.places[j]!;
          expect(`${a.id}-${b.id}:${Math.hypot(a.x - b.x, a.z - b.z) >= 2.0}`).toBe(`${a.id}-${b.id}:true`);
        }
      }
      for (const s of c.map.spawns) {
        for (const p of c.places) {
          const from = { x: Math.round(s.x * UNIT), z: Math.round(s.z * UNIT) };
          const to = { x: Math.round(p.x * UNIT), z: Math.round(p.z * UNIT) };
          const route = routeFx(c.map, from, to);
          const endX = route[route.length - 2]!;
          const endZ = route[route.length - 1]!;
          const gap = Math.hypot(endX - to.x, endZ - to.z) / UNIT;
          expect(`${p.id}@${s.x},${s.z}:${gap <= 0.3}`).toBe(`${p.id}@${s.x},${s.z}:true`);
        }
      }
    });
  }
  it("placeCenterFx·nearestPlaceId", () => {
    expect(placeCenterFx(BAR_MAP, "glass")).toEqual({ x: Math.round(BAR_PLACES[0]!.x * UNIT), z: Math.round(BAR_PLACES[0]!.z * UNIT) });
    expect(placeCenterFx(BAR_MAP, "clock")).toBeUndefined();
    const c = placeCenterFx(BAR_MAP, "sax")!;
    expect(nearestPlaceId(BAR_MAP, { x: c.x + 10, z: c.z - 10 })).toBe("sax");
    expect(nearestPlaceId({ ...BAR_MAP, places: undefined }, c)).toBeUndefined();
  });
});

describe("enterErrand", () => {
  const stateAt = (seed: number, n = 6): RoomState => barRoom(seed, "errand", n);

  it("산 사람마다 서로 다른 3곳(맵 후보 안), 진행은 빈 배열", () => {
    const s = stateAt(5);
    expect(s.phase).toBe("errand");
    const candidates = new Set(BAR_PLACES.map((p) => p.id));
    for (const p of s.players) {
      expect(p.errandPlaces).toHaveLength(ERRAND_COUNT);
      expect(new Set(p.errandPlaces).size).toBe(ERRAND_COUNT);
      for (const id of p.errandPlaces!) expect(candidates.has(id)).toBe(true);
      expect(p.errandDone).toEqual([]);
    }
  });

  it("같은 시드·같은 입력이면 같은 결과, 입력 상태는 바뀌지 않는다", () => {
    const base = barRoom(5, "dayAnnounce");
    const frozen = JSON.stringify(base);
    const a = enterErrand(base, seededRandInt(7), 0);
    const b = enterErrand(base, seededRandInt(7), 0);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    expect(JSON.stringify(base)).toBe(frozen);
  });

  it("역할만 다른 두 방이 같은 시드로 같은 장소 목록을 얻는다(역할을 읽지 않는다)", () => {
    const base = barRoom(5, "dayAnnounce");
    const flipped: RoomState = {
      ...base,
      players: base.players.map((p) => ({ ...p, role: p.role === "mafia" ? "citizen" : "mafia" })),
    };
    const a = enterErrand(base, seededRandInt(11), 0);
    const b = enterErrand(flipped, seededRandInt(11), 0);
    expect(JSON.stringify(a.players.map((p) => [p.errandPlaces, p.errandDone]))).toBe(JSON.stringify(b.players.map((p) => [p.errandPlaces, p.errandDone])));
    // 마피아와 시민의 키 이름·개수·길이가 같다
    const shapes = new Set(a.players.map((p) => `${Object.keys(p).filter((k) => k.startsWith("errand")).join(",")}/${p.errandPlaces!.length}/${p.errandDone!.length}`));
    expect(shapes.size).toBe(1);
  });

  it("난수 호출 순서: seat 오름차순 산 사람, 사람마다 k = 0..2 에 randInt(n - k)", () => {
    const base = barRoom(5, "dayAnnounce");
    const calls: number[] = [];
    enterErrand(
      base,
      (n) => {
        calls.push(n);
        return 0;
      },
      0,
    );
    expect(calls).toEqual(Array.from({ length: 6 }, () => [8, 7, 6]).flat());
  });

  it("죽은 사람은 두 키가 없고 난수도 쓰지 않는다", () => {
    const base = barRoom(5, "dayAnnounce");
    const dead = base.players[2]!.id;
    const withDead: RoomState = { ...base, players: base.players.map((p) => (p.id === dead ? { ...p, alive: false, errandPlaces: ["glass"], errandDone: [] } : p)) };
    let calls = 0;
    const out = enterErrand(
      withDead,
      (n) => {
        calls += 1;
        return n - 1;
      },
      0,
    );
    expect(calls).toBe(5 * 3);
    expect(Object.keys(byId(out, dead)).some((k) => k.startsWith("errand"))).toBe(false);
    expect(isAlive(byId(out, dead))).toBe(false);
  });

  it("광장 방은 광장 후보에서 뽑는다", () => {
    const base = { ...barRoom(5, "dayAnnounce"), map: "plaza" as const };
    const out = enterErrand(base, seededRandInt(3), 0);
    const candidates = new Set(PLAZA_PLACES.map((p) => p.id));
    for (const p of out.players) for (const id of p.errandPlaces!) expect(candidates.has(id)).toBe(true);
  });

  it("places 가 없는 맵은 빈 목록", () => {
    const base = barRoom(5, "dayAnnounce");
    const real = mapOf("bar");
    const saved = real.places;
    try {
      (real as { places?: unknown }).places = undefined;
      const out = enterErrand(base, seededRandInt(3), 0);
      for (const p of out.players) expect(p.errandPlaces).toEqual([]);
    } finally {
      (real as { places?: unknown }).places = saved;
    }
  });
});

describe("errandLast — 마지막 목격 표본 (16페이즈 D-10, A2)", () => {
  type Pos = { x: number; z: number };
  const base = (): RoomState => barRoom(5, "errand", 6);
  /** 좌석 → 위치. 적지 않은 좌석은 서로 멀리 떨어진 먼 곳에 둔다(반경 300 밖). */
  const posBySeat = (s: RoomState, at: Record<number, Pos>): ((id: string) => Pos | undefined) => {
    const seatOf = new Map(s.players.map((p) => [p.id, p.seat] as const));
    return (id) => at[seatOf.get(id)!] ?? { x: 9000 + (seatOf.get(id)! * 1000), z: 9000 };
  };
  const rowsOf = (s: RoomState): string => JSON.stringify((s.errandLast ?? []).map((r) => [r.seat, r.by]));
  const sample = (s: RoomState, at: Record<number, Pos>, t = 1000): RoomState => sampleErrand(s, posBySeat(s, at), t);

  it("반경 안 관찰자가 둘이면 더 가까운 사람이 마지막 목격자이고 줄은 seat 오름차순이다", () => {
    const got = sample(base(), { 0: { x: 0, z: 0 }, 1: { x: 100, z: 0 }, 2: { x: 0, z: 200 } });
    // 0 에게는 1(100)이, 1 에게는 0(100)이, 2 에게는 0(200)이 가장 가깝다
    expect(rowsOf(got)).toBe(JSON.stringify([[0, 1], [1, 0], [2, 0]]));
    for (const r of got.errandLast!) expect((PLACE_IDS as readonly string[]).includes(r.place)).toBe(true);
  });

  it("거리가 같으면 낮은 좌석", () => {
    const got = sample(base(), { 0: { x: 0, z: 0 }, 1: { x: 100, z: 0 }, 2: { x: -100, z: 0 } });
    expect(JSON.stringify(got.errandLast!.find((r) => r.seat === 0))).toBe(JSON.stringify({ seat: 0, by: 1, place: got.errandLast!.find((r) => r.seat === 0)!.place }));
  });

  it("반경 안에 아무도 없는 표본은 이전 줄을 남기고, 뒤 표본에서 다른 사람이 더 가까우면 바뀐다", () => {
    const first = sample(base(), { 0: { x: 0, z: 0 }, 1: { x: 100, z: 0 } });
    expect(rowsOf(first)).toBe(JSON.stringify([[0, 1], [1, 0]]));
    const alone = sample(first, {}, 2000);
    expect(rowsOf(alone)).toBe(rowsOf(first));
    expect(JSON.stringify(alone.errandLast)).toBe(JSON.stringify(first.errandLast));
    // 5 번이 0 번 곁 50 으로 오면 0 번의 마지막 관찰자는 5 번으로 바뀐다(1 번은 그대로 100)
    const closer = sample(alone, { 0: { x: 0, z: 0 }, 1: { x: 100, z: 0 }, 5: { x: 0, z: 50 } }, 3000);
    expect(closer.errandLast!.find((r) => r.seat === 0)!.by).toBe(5);
  });

  it("죽은 사람은 관찰자도 대상도 아니다", () => {
    const s = base();
    const dead: RoomState = { ...s, players: s.players.map((p) => (p.seat === 1 ? { ...p, alive: false } : p)) };
    const got = sample(dead, { 0: { x: 0, z: 0 }, 1: { x: 50, z: 0 }, 2: { x: 0, z: 200 } });
    expect(rowsOf(got)).toBe(JSON.stringify([[0, 2], [2, 0]]));
  });

  it("errand 단계가 아니면 입력 그대로다", () => {
    const talk = tick(base(), base().phaseEndsAt!, seededRandInt(3));
    expect(talk.phase).toBe("discussion");
    expect(sampleErrand(talk, () => ({ x: 0, z: 0 }), 1)).toBe(talk);
  });

  it("관찰자의 역할·심부름 진행과 무관하게 같은 줄이 나온다(역할만 뒤집은 두 방 비교) · 입력은 바뀌지 않는다", () => {
    const s = base();
    const flipped: RoomState = {
      ...s,
      players: s.players.map((p) => ({ ...p, role: p.role === "mafia" ? "citizen" : "mafia", errandDone: p.seat % 2 === 0 ? [...(p.errandPlaces ?? [])] : [] })),
    };
    const at = { 0: { x: 0, z: 0 }, 1: { x: 100, z: 0 }, 2: { x: 0, z: 200 } };
    const frozen = JSON.stringify(flipped);
    expect(JSON.stringify(sample(s, at).errandLast)).toBe(JSON.stringify(sample(flipped, at).errandLast));
    expect(JSON.stringify(flipped)).toBe(frozen);
  });

  it("enterErrand 가 errandLast 를 키째 지운다(새 낮의 시작)", () => {
    const day = { ...barRoom(5, "dayAnnounce"), errandLast: [{ seat: 0, by: 1, place: "glass" as const }] };
    const errand = enterErrand(day, seededRandInt(7), 0);
    expect("errandLast" in errand).toBe(false);
    expect(day.errandLast).toHaveLength(1);
  });
});

describe("actErrand", () => {
  const at = (id: string, state: RoomState) => {
    const c = placeCenterFx(BAR_MAP, byId(state, id).errandPlaces![0]!)!;
    return c;
  };
  const room = (): RoomState => barRoom(5, "errand");

  it("처리 반경 안이면 ok 이고 errandDone 끝에 그 id 가 더해진다", () => {
    const s = room();
    const id = s.players[0]!.id;
    const target = byId(s, id).errandPlaces![0]!;
    const near = { x: at(id, s).x + Math.round(ERRAND_ACT_R * UNIT) - 1, z: at(id, s).z };
    const r = actErrand(s, id, near);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(byId(r.state, id).errandDone).toEqual([target]);
      expect(byId(s, id).errandDone).toEqual([]); // 입력은 그대로
    }
  });

  it("반경 밖·이미 처리한 곳·errand 아닌 단계·죽은 사람·목록 밖 장소 곁은 { ok: false }", () => {
    const s = room();
    const id = s.players[0]!.id;
    const c = at(id, s);
    expect(actErrand(s, id, { x: c.x + Math.round(ERRAND_ACT_R * UNIT) + 1, z: c.z })).toEqual({ ok: false });
    const done = actErrand(s, id, c);
    expect(done.ok).toBe(true);
    if (done.ok) expect(actErrand(done.state, id, c)).toEqual({ ok: false });
    expect(actErrand({ ...s, phase: "discussion" }, id, c)).toEqual({ ok: false });
    expect(actErrand({ ...s, players: s.players.map((p) => (p.id === id ? { ...p, alive: false } : p)) }, id, c)).toEqual({ ok: false });
    expect(actErrand(s, "nobody", c)).toEqual({ ok: false });
    const outside = BAR_PLACES.map((p) => p.id).find((p) => !byId(s, id).errandPlaces!.includes(p as never))!;
    expect(actErrand(s, id, placeCenterFx(BAR_MAP, outside)!)).toEqual({ ok: false });
    const noList: RoomState = { ...s, players: s.players.map((p) => (p.id === id ? { ...p, errandPlaces: undefined } : p)) };
    expect(actErrand(noList, id, c)).toEqual({ ok: false });
  });

  it("두 미완료 장소가 모두 반경 안이면 더 가까운 것(같으면 목록 앞), 3곳을 모두 처리하면 { ok: false }", () => {
    const s = room();
    const id = s.players[0]!.id;
    const withList = (places: string[]): RoomState => ({ ...s, players: s.players.map((p) => (p.id === id ? { ...p, errandPlaces: places as never[], errandDone: [] } : p)) });
    // 맵 데이터 위에서 두 장소가 모두 반경 안인 경우는 없다(서로 2.0 이상 떨어져 있고 반경 1.2) — 같은 id 두 번으로 동률(목록 앞)을 확인한다.
    const dc = placeCenterFx(BAR_MAP, "door")!;
    const tie = actErrand(withList(["door", "door"]), id, dc);
    expect(tie.ok && byId(tie.state, id).errandDone).toEqual(["door"]);
    // 반경(1.2)을 넓혀 볼 수 없으니 가까운 쪽 선택은 두 중앙 중 가까운 쪽으로 처리되는지만 본다.
    const glass = placeCenterFx(BAR_MAP, "glass")!;
    const stool = placeCenterFx(BAR_MAP, "stool")!;
    const near = actErrand(withList(["stool", "glass"]), id, { x: glass.x + 5, z: glass.z });
    expect(near.ok && byId(near.state, id).errandDone).toEqual(["glass"]);
    void stool;
    let cur = withList(["glass", "stool", "door"]);
    for (const place of ["glass", "stool", "door"]) {
      const res = actErrand(cur, id, placeCenterFx(BAR_MAP, place)!);
      expect(res.ok).toBe(true);
      if (res.ok) cur = res.state;
    }
    expect(byId(cur, id).errandDone).toEqual(["glass", "stool", "door"]);
    expect(actErrand(cur, id, placeCenterFx(BAR_MAP, "glass")!)).toEqual({ ok: false });
  });
});

describe("actErrand — 마피아 가짜 장소 (16페이즈 D-08, A1)", () => {
  /** id 의 목록을 주어진 장소들로 두고 errandFake 키를 fake 로 둔 방(fake 가 없으면 키 없음). */
  const withFake = (s: RoomState, id: string, places: string[], fake?: string): RoomState => ({
    ...s,
    players: s.players.map((p) => {
      if (p.id !== id) return p;
      const { errandFake: _old, ...rest } = p as Player & { errandFake?: string };
      return { ...rest, errandPlaces: places as never[], errandDone: [], ...(fake === undefined ? {} : { errandFake: fake }) } as Player;
    }),
  });
  const base = (): { s: RoomState; id: string } => {
    const s = barRoom(5, "errand");
    return { s, id: s.players[0]!.id };
  };

  it("가짜 장소 중앙에서 처리하면 { ok: false }, 같은 사람이 진짜 장소 중앙에서는 ok 다", () => {
    const { s, id } = base();
    const r = withFake(s, id, ["glass", "stool", "door"], "stool");
    expect(JSON.stringify(actErrand(r, id, placeCenterFx(BAR_MAP, "stool")!))).toBe('{"ok":false}');
    const real = actErrand(r, id, placeCenterFx(BAR_MAP, "glass")!);
    expect(JSON.stringify(real.ok && byId(real.state, id).errandDone)).toBe(JSON.stringify(["glass"]));
  });

  it("가짜와 진짜가 둘 다 반경 안이면 진짜가 처리된다(가짜가 목록 앞이어도). 가짜 키가 없는 사람은 15 와 같이 목록 앞이 처리된다", () => {
    const { s, id } = base();
    const a = placeCenterFx(BAR_MAP, "stool")!;
    const b = placeCenterFx(BAR_MAP, "glass")!;
    const mid = { x: Math.round((a.x + b.x) / 2), z: Math.round((a.z + b.z) / 2) }; // 둘 다 정확히 반경 경계(1.2) 위
    const fake = actErrand(withFake(s, id, ["stool", "glass", "door"], "stool"), id, mid);
    expect(JSON.stringify(fake.ok && byId(fake.state, id).errandDone)).toBe(JSON.stringify(["glass"]));
    const plain = actErrand(withFake(s, id, ["stool", "glass", "door"]), id, mid);
    expect(JSON.stringify(plain.ok && byId(plain.state, id).errandDone)).toBe(JSON.stringify(["stool"]));
  });

  it("진짜 두 곳을 모두 처리한 뒤 가짜만 남으면 어디서도 { ok: false } 다(2/3 에서 멈춘다)", () => {
    const { s, id } = base();
    let cur = withFake(s, id, ["glass", "stool", "door"], "stool");
    for (const place of ["glass", "door"]) {
      const res = actErrand(cur, id, placeCenterFx(BAR_MAP, place)!);
      expect(res.ok).toBe(true);
      if (res.ok) cur = res.state;
    }
    expect(JSON.stringify(byId(cur, id).errandDone)).toBe('["glass","door"]');
    expect(JSON.stringify(actErrand(cur, id, placeCenterFx(BAR_MAP, "stool")!))).toBe('{"ok":false}');
  });

  it("enterErrand 는 이전 errandFake 를 지운다", () => {
    const { s, id } = base();
    const stale = withFake(s, id, ["glass", "stool", "door"], "stool");
    expect(enterErrand(stale, seededRandInt(3), 0).players.some((p) => "errandFake" in p)).toBe(false);
  });
});

describe("스키마", () => {
  it("{t:'errand'} 는 받고 다른 키가 붙으면 거부", () => {
    expect(ClientMessageSchema.safeParse({ t: "errand" }).success).toBe(true);
    expect(ClientMessageSchema.safeParse({ t: "errand", place: "glass" }).success).toBe(false);
    expect(ClientMessageSchema.safeParse({ t: "errand", x: 1, z: 1 }).success).toBe(false);
  });
});

describe("view", () => {
  const errandRoom = (): RoomState => barRoom(5, "errand");

  it("errand 단계의 산 사람 본인 view 에만 me.errand = { places(3), done } 가 있다", () => {
    const s = errandRoom();
    for (const p of s.players) {
      const v = buildView(s, p.id, s.phaseEndsAt! - 1000);
      expect(v.me.errand).toEqual({ places: p.errandPlaces, done: [] });
      expect(v.me.errand!.places).toHaveLength(3);
      const text = JSON.stringify(v);
      // 좌표는 어디에도 없다: 장소 id 는 있어도 숫자 좌표 키가 없다
      expect(text).not.toMatch(/"errand":\{[^}]*"x"/);
      // 다른 사람의 목록은 누설되지 않는다: 다른 사람 전용 키가 없다
      expect(Object.keys(v.me.errand!).sort()).toEqual(["done", "places"]);
      for (const q of v.players) expect(Object.keys(q)).not.toContain("errand");
    }
  });

  it("토론·밤 단계·유령 view 에는 me.errand 키가 없다", () => {
    const s = errandRoom();
    const id = s.players[0]!.id;
    const talk = tick(s, s.phaseEndsAt!, seededRandInt(2));
    expect(talk.phase).toBe("discussion");
    expect("errand" in buildView(talk, id, talk.phaseEndsAt! - 1000).me).toBe(false);
    const night: RoomState = { ...s, phase: "night" };
    expect("errand" in buildView(night, id, 0).me).toBe(false);
    const ghost: RoomState = { ...s, players: s.players.map((p) => (p.id === id ? { ...p, alive: false } : p)) };
    expect("errand" in buildView(ghost, id, 0).me).toBe(false);
  });
});

describe("movement·채팅", () => {
  it("errand 에서 산 사람은 걷고(마피아·시민 모두), 말할 수 없다", () => {
    expect(canMoveIn("errand", true)).toBe(true);
    expect(canMoveIn("errand", false)).toBe(true);
    const s = barRoom(5, "errand");
    for (const p of s.players) expect(channelOf(s, p.id)).toBeNull();
  });
});

describe("봇 계획", () => {
  const botRoom = (): RoomState => {
    const lobby = lobbyOf(3);
    const withBots: RoomState = {
      ...lobby,
      players: [
        ...lobby.players,
        ...[3, 4, 5].map((i) => ({ ...lobby.players[0]!, id: `bot-id-000${i}-aaaa`, token: `bot-token-000${i}-aaaa-0123456789`, seat: i, nickname: `봇${i}`, nicknameKey: `봇${i}`, isBot: true as const, joinSeq: i })),
      ],
    };
    return startedFrom(withBots, 4, "errand");
  };

  it("errand 계획이 선다: 산 봇마다 errandGo 3 + errandAct 6, 시각은 계약대로", () => {
    const s = botRoom();
    expect(botPlanKey(s)).toBe(`errand:${s.phaseEndsAt}`);
    const now = s.phaseEndsAt! - ERRAND_MS;
    const steps = planBotSteps(s, now, () => {
      throw new Error("errand 계획은 난수를 부르지 않는다");
    });
    const bots = s.players.filter((p) => p.isBot === true);
    expect(bots).toHaveLength(3);
    for (const bot of bots) {
      const mine = steps.filter((x) => x.botId === bot.id);
      expect(mine.filter((x) => x.act.t === "errandGo")).toHaveLength(3);
      expect(mine.filter((x) => x.act.t === "errandAct")).toHaveLength(6);
      const goTimes = mine.filter((x) => x.act.t === "errandGo").map((x) => x.at - now);
      expect(goTimes).toEqual([500, 12_500, 24_500]);
      const actTimes = mine.filter((x) => x.act.t === "errandAct").map((x) => x.at - now);
      expect(actTimes).toEqual([9_500, 11_500, 21_500, 23_500, 33_500, 35_500]);
      for (const x of mine) expect(x.at).toBeLessThan(s.phaseEndsAt! - BOT_END_MARGIN_MS);
    }
  });

  it("마감 여유 안으로 밀리는 항목은 기존 규칙대로 버려지고 난수는 앞뒤로 같다", () => {
    const s = botRoom();
    const late = s.phaseEndsAt! - 20_000;
    const steps = planBotSteps(s, late, () => {
      throw new Error("no random");
    });
    for (const x of steps) expect(x.at).toBeLessThan(s.phaseEndsAt! - BOT_END_MARGIN_MS);
    // 난수 없음: 던지는 randInt 로도 계획이 서므로(위) 호출 수는 0 이다.
    let calls = 0;
    planBotSteps(s, s.phaseEndsAt! - ERRAND_MS, (n) => {
      calls += 1;
      return n - 1;
    });
    expect(calls).toBe(0);
  });
});
