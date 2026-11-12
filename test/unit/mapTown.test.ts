// 마을 맵(20-01): 격자 일반화(D-04) · 구역 판정(D-13) · 마을 장애물·마스크·방 넷·집 여덟(D-05~D-08) · 판 종류의 고정 맵(D-02).
// 실패 출력이 한 줄이 되게(TAP) 마스크·경로·프레임은 문자열로 비교한다.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { rasterizeGrid } from "../helpers/mapRaster";
import type { RasterGrid } from "../helpers/mapRaster";
import { seededRandInt } from "../helpers/seededRandom";
import {
  BAR_MAP,
  BAR_MASK,
  BAR_OBSTACLES,
  BAR_SPAWNS,
  GRID_ORIGIN,
  GRID_SIZE,
  HEAD_TOP_Y,
  STAGE_SPOT,
  UNIT,
  WALK_HALF,
  cellCenterFx,
  cellOfFx,
  isWalkable,
  lineWalkable,
  routeFx,
  snapToWalkable,
} from "../../shared/game/map";
import type { MapDef, Obstacle, RoomDef, Spawn } from "../../shared/game/map";
import { PLAZA_MAP, PLAZA_MASK, PLAZA_OBSTACLES, PLAZA_PLACES, PLAZA_SPAWNS } from "../../shared/game/mapPlaza";
import { TOWN_DOOR_EXEMPT, TOWN_HOUSES, TOWN_MAP, TOWN_MASK, TOWN_OBSTACLES, TOWN_PLACES, TOWN_PROPS, TOWN_ROOMS, TOWN_SPAWNS } from "../../shared/game/mapTown";
import { MAPS, PLAYABLE_MAPS, mapOf } from "../../shared/game/maps";
import { clipToZone, zoneAt, zoneOf } from "../../shared/game/zones";
import { MOVE_V, positionAtFx, segmentEndsAt } from "../../shared/game/world";
import type { Segment } from "../../shared/game/world";
import { MAP_CHOICES, PLACE_IDS, ROOM_IDS, ZONE_IDS } from "../../shared/protocol";

const BAR_GRID: RasterGrid = { size: GRID_SIZE, origin: GRID_ORIGIN, walkHalf: WALK_HALF };
const flatRows = (rows: readonly string[]): string => rows.join("/");
const fx = (v: number): number => Math.round(v * UNIT);
const seedOf = (spawns: readonly Spawn[], map?: Pick<MapDef, "origin">): { c: number; r: number } => cellOfFx(fx(spawns[0]!.x), fx(spawns[0]!.z), map);

// ───────────────────────── 격자 일반화 (D-04) ─────────────────────────

describe("격자 일반화 (D-04) — 재즈 바·광장은 그대로", () => {
  it("일반화 래스터화가 재즈 바 격자로 BAR_MASK 를 글자 하나까지 그대로 낸다", () => {
    expect(flatRows(rasterizeGrid(BAR_OBSTACLES, seedOf(BAR_SPAWNS), BAR_GRID).rows)).toBe(flatRows(BAR_MASK));
  });

  it("일반화 래스터화가 재즈 바 격자로 PLAZA_MASK 를 글자 하나까지 그대로 낸다", () => {
    expect(flatRows(rasterizeGrid(PLAZA_OBSTACLES, seedOf(PLAZA_SPAWNS), BAR_GRID).rows)).toBe(flatRows(PLAZA_MASK));
  });

  it("맵 인자가 없거나 origin 이 없는 맵이면 cellOfFx·cellCenterFx 는 재즈 바 격자(원점 −700) 그대로다", () => {
    const got = [cellOfFx(-700, -700), cellOfFx(-1, 649), cellOfFx(-700, -700, BAR_MAP), cellCenterFx(0, 0), cellCenterFx(27, 3), cellCenterFx(27, 3, BAR_MAP)];
    expect(JSON.stringify(got)).toBe('[{"c":0,"r":0},{"c":13,"r":26},{"c":0,"r":0},{"x":-675,"z":-675},{"x":675,"z":-525},{"x":675,"z":-525}]');
  });

  it("origin 이 있는 맵이면 cellOfFx·cellCenterFx 가 그 원점을 쓴다 (원점 −12 → −1200)", () => {
    const town = { origin: -12 };
    const got = [cellOfFx(-1200, -1200, town), cellOfFx(0, 975, town), cellCenterFx(0, 0, town), cellCenterFx(47, 24, town)];
    expect(JSON.stringify(got)).toBe('[{"c":0,"r":0},{"c":24,"r":43},{"x":-1175,"z":-1175},{"x":1175,"z":25}]');
  });

  // 재즈 바 마스크를 원점 −9 로 옮긴 맵: 월드 좌표가 −200 씩 밀릴 뿐 같은 길이 나와야 한다(걷기 한계는 9 로 넓혀 자르기가 끼어들지 않게 한다).
  const SHIFT = 200;
  const shifted: MapDef = { ...BAR_MAP, origin: -9, walkHalf: 9, stage: { x: -SHIFT, z: -SHIFT } };

  it("원점을 옮긴 맵의 길은 재즈 바의 길을 그대로 옮긴 것이다 (시드 40쌍)", () => {
    const rand = seededRandInt(2001);
    const pick = (): { x: number; z: number } => ({ x: rand(1161) - 580, z: rand(1161) - 580 });
    const moved: string[] = [];
    const base: string[] = [];
    for (let i = 0; i < 40; i++) {
      const a = pick();
      const b = pick();
      base.push(routeFx(BAR_MAP, a, b).map((v) => v - SHIFT).join(","));
      moved.push(routeFx(shifted, { x: a.x - SHIFT, z: a.z - SHIFT }, { x: b.x - SHIFT, z: b.z - SHIFT }).join(","));
    }
    expect(moved.join(" | ")).toBe(base.join(" | "));
  });

  it("walkHalf 가 있는 맵이면 snapToWalkable 이 그 한계로 자른다 (재즈 바는 ±580 그대로)", () => {
    const open: MapDef = { id: "bar", size: 4, origin: -1, walkHalf: 0.7, mask: new Uint8Array(16).fill(1), spawns: [] };
    const got = [snapToWalkable(open, { x: 500, z: -500 }), snapToWalkable(open, { x: 60, z: 10 }), snapToWalkable(BAR_MAP, { x: 5000, z: 300 })];
    expect(JSON.stringify(got)).toBe('[{"x":70,"z":-70,"snapped":true},{"x":60,"z":10,"snapped":false},{"x":580,"z":300,"snapped":true}]');
  });

  it("원점을 옮긴 맵에서 격자 밖에 닿는 선분은 걸을 수 없고 안의 선분은 걸을 수 있다", () => {
    const open: MapDef = { id: "bar", size: 4, origin: -1, walkHalf: 1, mask: new Uint8Array(16).fill(1), spawns: [] };
    const got = [lineWalkable(open, { x: -90, z: -90 }, { x: 90, z: 90 }), lineWalkable(open, { x: -90, z: 0 }, { x: 110, z: 0 }), lineWalkable(open, { x: -101, z: 0 }, { x: 0, z: 0 })];
    expect(got.join(",")).toBe("true,false,false");
  });
});

/** 소스 규약 시험용: 주석을 뺀 소스. */
function sourceOf(rel: string): string {
  return readFileSync(new URL(`../../${rel}`, import.meta.url), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/.*$/gm, "");
}

// ───────────────────────── 구역 판정 (D-13·D-14) ─────────────────────────

describe("구역 판정 zoneOf·zoneAt·clipToZone (D-13)", () => {
  // 안쪽 사각형 둘만 가진 작은 표(마을의 우체국·술집과 같은 수치). 마을 실물은 아래 마을 맵 절이 본다.
  const POST: RoomDef = { id: "post", inner: { x0: -200, z0: -970, x1: 200, z1: -690 }, door: { x: 0, z: -675 }, front: { x: 25, z: -575 }, inside: { x: 25, z: -825 } };
  const PUB: RoomDef = { id: "pub", inner: { x0: 690, z0: -200, x1: 970, z1: 200 }, door: { x: 675, z: 0 }, front: { x: 575, z: 25 }, inside: { x: 825, z: 25 } };
  const M = { rooms: [POST, PUB] };
  const T0 = 1_700_000_000_000; // 실제 서버 시각 크기(32비트를 넘는다)
  const seg = (p: number[], t0 = T0): Segment => ({ p, t0, v: MOVE_V });
  const zonesOfSeg = (s: Segment): string => {
    const out: string[] = [];
    for (let i = 0; i + 1 < s.p.length; i += 2) out.push(zoneOf(M, s.p[i]!, s.p[i + 1]!));
    return out.join(",");
  };

  it("프로토콜의 방·구역 id: 방 넷, 구역은 plaza + 방 넷", () => {
    expect(`${ROOM_IDS.join(",")} / ${ZONE_IDS.join(",")}`).toBe("post,pub,clinic,police / plaza,post,pub,clinic,police");
  });

  it("안쪽 사각형의 엄격한 안쪽이면 그 방, 경계 위와 그 밖은 plaza", () => {
    const got = [
      zoneOf(M, 25, -825), // 우체국 안
      zoneOf(M, 0, -690), // 문턱 안쪽 면(경계)
      zoneOf(M, 0, -691), // 경계에서 1 안쪽
      zoneOf(M, 200, -800), // 동쪽 경계
      zoneOf(M, 199, -969), // 모서리에서 1 안쪽
      zoneOf(M, 0, -675), // 문 중심(벽 두께 안)
      zoneOf(M, 0, 0), // 광장
      zoneOf(M, 825, 25), // 술집 안
      zoneOf(M, 690, 0), // 술집 문턱 경계
    ];
    expect(got.join(",")).toBe("post,plaza,post,plaza,post,plaza,plaza,pub,plaza");
  });

  it("방이 없는 맵(재즈 바·광장·rooms 없는 맵)은 어느 점이든 plaza", () => {
    const got = [zoneOf(BAR_MAP, 25, -825), zoneOf(PLAZA_MAP, 825, 25), zoneOf({}, 0, -800), zoneOf({ rooms: [] }, 0, -800)];
    expect(got.join(",")).toBe("plaza,plaza,plaza,plaza");
  });

  it("zoneAt 은 그 시각 구간 위치의 구역이다", () => {
    const s = seg([25, -575, 25, -825]); // 문 앞 → 방 안, 250 을 180/초로 = 1389ms
    const got = [zoneAt(M, s, T0 - 5), zoneAt(M, s, T0), zoneAt(M, s, T0 + 600), zoneAt(M, s, T0 + 700), zoneAt(M, s, segmentEndsAt(s) + 1000)];
    expect(got.join(",")).toBe("plaza,plaza,plaza,post,post");
  });

  it("밖에서 안으로: 문턱 안쪽 면(z −690)에서 끝나고 모든 꼭짓점이 plaza 다", () => {
    const s = seg([300, -500, 25, -575, 25, -825, 100, -900]);
    const cut = clipToZone(M, s, T0);
    expect(`${JSON.stringify(cut.p)} t0=${cut.t0 - T0} v=${cut.v} zones=${zonesOfSeg(cut)}`).toBe(`[300,-500,25,-575,25,-690] t0=0 v=${MOVE_V} zones=plaza,plaza,plaza`);
  });

  it("안에서 밖으로: 문턱 안쪽 면 바로 앞(z −691)에서 끝나고 모든 꼭짓점이 그 방이다", () => {
    const s = seg([100, -900, 25, -825, 25, -575, 300, -500]);
    const cut = clipToZone(M, s, T0);
    expect(`${JSON.stringify(cut.p)} t0=${cut.t0 - T0} zones=${zonesOfSeg(cut)}`).toBe("[100,-900,25,-825,25,-691] t0=0 zones=post,post,post");
  });

  it("구역이 바뀌지 않는 구간은 입력과 같은 값이다 (광장 안 · 방 안 · 방 없는 맵)", () => {
    const plaza = seg([300, -500, 25, -575, -300, -400]);
    const inside = seg([100, -900, 25, -825, -100, -750]);
    const got = [clipToZone(M, plaza, T0), clipToZone(M, inside, T0), clipToZone(BAR_MAP, seg([25, -575, 25, -825]), T0), clipToZone(M, plaza, T0 - 50)];
    const want = [plaza, inside, seg([25, -575, 25, -825]), plaza];
    expect(JSON.stringify(got)).toBe(JSON.stringify(want));
  });

  it("걷는 도중(from > t0)에 자르면 그 순간 위치에서 시작하고 t0 = from 이다", () => {
    const s = seg([25, -575, 25, -825]);
    const from = T0 + 300; // 54 걸음 → z −629
    const here = positionAtFx(s, from);
    const cut = clipToZone(M, s, from);
    expect(`${JSON.stringify(cut.p)} t0=${cut.t0 - T0}`).toBe(`[${here.x},${here.z},25,-690] t0=300`);
  });

  it("이미 방 안에 든 뒤(from 이 문턱을 지난 시각)에 자르면 그 방의 남은 구간 전체다", () => {
    const s = seg([25, -575, 25, -825, 100, -900]);
    const from = T0 + 800; // 144 걸음 → z −719 (우체국 안)
    const cut = clipToZone(M, s, from);
    expect(`${JSON.stringify(cut.p)} t0=${cut.t0 - T0} zones=${zonesOfSeg(cut)}`).toBe("[25,-719,25,-825,100,-900] t0=800 zones=post,post,post");
  });

  it("끝난 구간·서 있는 구간은 그 자리 한 점이다", () => {
    const walked = seg([25, -575, 25, -625]);
    const rest = seg([25, -825]);
    const got = [clipToZone(M, walked, segmentEndsAt(walked) + 5000), clipToZone(M, rest, T0 + 10)];
    expect(JSON.stringify(got.map((g) => g.p))).toBe("[[25,-625],[25,-825]]");
  });

  it("자른 구간의 어느 시각 위치도 출발 구역 밖이 아니다 (우체국 드나들기, 10ms 간격)", () => {
    const bad: string[] = [];
    for (const s of [seg([300, -500, 25, -575, 25, -825, 100, -900]), seg([100, -900, 25, -825, 25, -575, 300, -500]), seg([575, 25, 825, 25, 900, -100])]) {
      const zone0 = zoneAt(M, s, T0);
      const cut = clipToZone(M, s, T0);
      for (let t = T0; t <= segmentEndsAt(s) + 20; t += 10) if (zoneAt(M, cut, t) !== zone0) bad.push(`${JSON.stringify(s.p)}@${t - T0}`);
    }
    expect(bad.join(" ")).toBe("");
  });

  it("zones.ts 소스 규약: 삼각함수·hypot·random·현재 시각·DOM·workerd API 를 쓰지 않는다(주석 제외)", () => {
    const source = sourceOf("shared/game/zones.ts");
    expect(source).not.toMatch(/Math\.(hypot|sin|cos|tan|asin|acos|atan|atan2|random)\b/);
    expect(source).not.toMatch(/Date\.now|new Date|performance\.now/);
    expect(source).not.toMatch(/\b(document|window|crypto|fetch)\b/);
  });
});

// ───────────────────────── 마을 맵 (D-05~D-08) ─────────────────────────

const TOWN_GRID: RasterGrid = { size: 48, origin: -12, walkHalf: 10 };
type Rect = { x0: number; z0: number; x1: number; z1: number };
const inRect = (r: Rect, x: number, z: number): boolean => x >= r.x0 && x <= r.x1 && z >= r.z0 && z <= r.z1;
/** 문 앞 칸 면제(P20-10): 칸 중심(월드 단위)이 면제 사각형 안(경계 포함)이면 머리 광선 시험을 건너뛴다. */
const townExempt = (x: number, z: number): boolean => Object.values(TOWN_DOOR_EXEMPT).some((r) => inRect(r, x, z));
/** 칸 중심의 방(없으면 null): 그 방의 지붕·앞벽은 안에서 걷히므로 머리 광선 시험에서 뺀다. */
const townCutZone = (x: number, z: number): string | null => {
  const zone = zoneOf(TOWN_MAP, fx(x), fx(z));
  return zone === "plaza" ? null : zone;
};
const rasterTown = (obstacles: readonly Obstacle[] = TOWN_OBSTACLES) =>
  rasterizeGrid(obstacles, seedOf(TOWN_SPAWNS, TOWN_MAP), TOWN_GRID, { exempt: townExempt, cutZoneOf: townCutZone });

/** 가장 가까운 걷는 칸 중심(정수 제곱거리 → 행 → 열 순 결정적 동률 처리, snapToWalkable 의 보정 순서와 같다). front·inside 리터럴의 정의식이다. */
function nearestWalkCenter(map: MapDef, p: { x: number; z: number }): { x: number; z: number } {
  let best = { x: Number.NaN, z: Number.NaN };
  let bestD = Infinity;
  for (let r = 0; r < map.size; r++) {
    for (let c = 0; c < map.size; c++) {
      if (!isWalkable(map, c, r)) continue;
      const m = cellCenterFx(c, r, map);
      const d = (m.x - p.x) * (m.x - p.x) + (m.z - p.z) * (m.z - p.z);
      if (d < bestD) {
        bestD = d;
        best = m;
      }
    }
  }
  return best;
}

const xz = (p: { x: number; z: number }): string => `${p.x},${p.z}`;
const isCenterOfWalkCell = (p: { x: number; z: number }): boolean => {
  const cell = cellOfFx(p.x, p.z, TOWN_MAP);
  return isWalkable(TOWN_MAP, cell.c, cell.r) && xz(cellCenterFx(cell.c, cell.r, TOWN_MAP)) === xz(p);
};
/** 방의 문이 난 벽: 문 중심이 안쪽 사각형의 어느 쪽 밖에 있는지로 정한다. */
const doorSideOf = (room: RoomDef): "n" | "s" | "e" | "w" => (room.door.z > room.inner.z1 ? "s" : room.door.z < room.inner.z0 ? "n" : room.door.x > room.inner.x1 ? "e" : "w");
const OUT: Record<"n" | "s" | "e" | "w", { x: number; z: number }> = { n: { x: 0, z: -1 }, s: { x: 0, z: 1 }, e: { x: 1, z: 0 }, w: { x: -1, z: 0 } };
/** 문 벽 두께 띠(0.3) 안에 중심이 든 칸 가운데 걷는 칸(= 문 칸)의 중심 목록. */
function doorCells(room: RoomDef): { x: number; z: number }[] {
  const side = doorSideOf(room);
  const out: { x: number; z: number }[] = [];
  for (let r = 0; r < TOWN_MAP.size; r++) {
    for (let c = 0; c < TOWN_MAP.size; c++) {
      const m = cellCenterFx(c, r, TOWN_MAP);
      const alongX = m.x > room.inner.x0 - 30 && m.x < room.inner.x1 + 30;
      const alongZ = m.z > room.inner.z0 - 30 && m.z < room.inner.z1 + 30;
      const inBand =
        side === "s" ? alongX && m.z > room.inner.z1 && m.z < room.inner.z1 + 30
        : side === "n" ? alongX && m.z < room.inner.z0 && m.z > room.inner.z0 - 30
        : side === "e" ? alongZ && m.x > room.inner.x1 && m.x < room.inner.x1 + 30
        : alongZ && m.x < room.inner.x0 && m.x > room.inner.x0 - 30;
      if (inBand && isWalkable(TOWN_MAP, c, r)) out.push(m);
    }
  }
  return out;
}
/** 안쪽 사각형 안에 중심이 든 칸 가운데 rows 에서 걷는 칸 수와 전체 칸 수. */
function innerCount(room: RoomDef, rows: readonly string[]): { walk: number; all: number } {
  let walk = 0;
  let all = 0;
  for (let r = 0; r < TOWN_MAP.size; r++) {
    for (let c = 0; c < TOWN_MAP.size; c++) {
      const m = cellCenterFx(c, r, TOWN_MAP);
      if (zoneOf({ rooms: [room] }, m.x, m.z) !== room.id) continue;
      all += 1;
      if (rows[r]![c] === ".") walk += 1;
    }
  }
  return { walk, all };
}
const walkCount = (rows: readonly string[]): number => rows.join("").split("").filter((ch) => ch === ".").length;

if (process.env.MAP_PRINT === "1") {
  describe("마스크 출력(MAP_PRINT=1 일 때만)", () => {
    it("마을 래스터화 결과를 줄로 출력", () => {
      const out = rasterTown();
      const bare = rasterTown(TOWN_OBSTACLES.filter((o) => !TOWN_PROPS.includes(o)));
      const inner = TOWN_ROOMS.map((room) => `${room.id} ${innerCount(room, out.rows).walk}/${innerCount(room, bare.rows).walk}/${innerCount(room, out.rows).all}`).join(" · ");
      process.stdout.write(
        `\nTOWN\n${out.rows.map((l) => `  "${l}",`).join("\n")}\nwalkable ${walkCount(out.rows)} / ${48 * 48}\nexempted ${JSON.stringify(out.exempted)}\nremoved ${JSON.stringify(out.removed)}\ninner(걷는/소품 없이/전체) ${inner}\n`,
      );
    });
  });
}

describe("마을 맵 등록 (D-01·D-05·D-08)", () => {
  it("TOWN_MAP: id town · 48×48 · 원점 −12 · 걷기 한계 10, 입장 지점은 광장 그대로, 무대 자리 그대로", () => {
    const got = `${TOWN_MAP.id}/${TOWN_MAP.size}/${TOWN_MAP.origin}/${TOWN_MAP.walkHalf}/${TOWN_MAP.spawns === PLAZA_SPAWNS}/${TOWN_SPAWNS === PLAZA_SPAWNS}/${xz(TOWN_MAP.stage!)}/${TOWN_MAP.rooms === TOWN_ROOMS}/${TOWN_MAP.places === TOWN_PLACES}`;
    expect(got).toBe(`town/48/-12/10/true/true/${xz(STAGE_SPOT)}/true/true`);
  });

  it("MAPS.town 으로 등록되고, 고를 수 있는 맵(PLAYABLE_MAPS·MAP_CHOICES)에는 없다", () => {
    const got = `${MAPS.town === TOWN_MAP}/${mapOf("town").id}/${[...PLAYABLE_MAPS].includes("town")}/${(MAP_CHOICES as readonly string[]).includes("town")}`;
    expect(got).toBe("true/town/false/false");
  });

  it("방은 넷이고 id 순서는 post·pub·clinic·police, 안쪽 사각형·문 중심은 치수표 그대로다", () => {
    const got = TOWN_ROOMS.map((r) => `${r.id}:${r.inner.x0},${r.inner.z0},${r.inner.x1},${r.inner.z1}@${xz(r.door)}`).join(" ");
    expect(got).toBe("post:-200,-970,200,-690@0,-675 pub:690,-200,970,200@675,0 clinic:-200,690,200,970@0,675 police:-970,-200,-690,200@-675,0");
  });

  it("집은 여덟이고 좌석 0~7 의 중심·문 있는 면은 시안 A 그대로다", () => {
    const got = TOWN_HOUSES.map((h) => `${h.seat}:${h.x},${h.z}${h.face}`).join(" ");
    expect(got).toBe("0:-5,-8.4s 1:5,-8.4s 2:8.4,-5w 3:8.4,5w 4:5,8.4n 5:-5,8.4n 6:-8.4,5e 7:-8.4,-5e");
  });

  it("장애물 원문 = 광장 원문 + 방·집 — 모두 회전 없는 사각형이고 집 몸통·지붕은 머리(2.0335)보다 낮다", () => {
    const added = TOWN_OBSTACLES.slice(PLAZA_OBSTACLES.length);
    const houses = added.filter((o) => o.room === undefined);
    const got = [
      PLAZA_OBSTACLES.every((o, i) => TOWN_OBSTACLES[i] === o),
      added.length > 0 && added.every((o) => o.kind === "rect" && o.rot === 0),
      houses.length === 16 && houses.every((o) => o.y1 < HEAD_TOP_Y),
      houses.filter((o) => o.floor).length === 8,
      TOWN_PROPS.length >= 8 && TOWN_PROPS.every((o) => TOWN_OBSTACLES.includes(o) && o.room !== undefined && o.cut === undefined && (o.floor ? o.y1 <= 1.2 : o.y0 >= 1.2)),
      ROOM_IDS.every((id) => added.some((o) => o.room === id && o.cut === true && !o.floor)), // 방마다 지붕
    ];
    expect(got.join(",")).toBe("true,true,true,true,true,true");
  });
});

describe("마을 마스크 (P20-0·P20-1·P20-10)", () => {
  it("TOWN_MASK 는 48줄 × 48글자('.'·'#' 뿐)이고 TOWN_OBSTACLES 의 래스터화와 글자 하나까지 같다", () => {
    expect(`${TOWN_MASK.length}/${TOWN_MASK.every((l) => /^[.#]{48}$/.test(l))}`).toBe("48/true");
    expect(flatRows(TOWN_MASK)).toBe(flatRows(rasterTown().rows));
  });

  it("면제 덕분에 열린 칸은 방마다 문턱 두 칸(모두 여덟)뿐이고, 가운데 광장(±5.8 안)은 광장 마스크와 같다", () => {
    const out = rasterTown();
    const doors = TOWN_ROOMS.flatMap((room) => doorCells(room).map(xz)).sort();
    const exempted = out.exempted.map((cell) => xz(cellCenterFx(cell.c, cell.r, TOWN_MAP))).sort();
    expect(exempted.join(" ")).toBe(doors.join(" "));
    expect(exempted.length).toBe(8);
    // 광장 격자의 칸 (c, r) 은 마을 격자의 (c + 10, r + 10) 이다(원점 −7 과 −12 의 차 5 = 10칸). 광장 이동 한계 안쪽 칸만 본다.
    const diff: string[] = [];
    for (let r = 2; r <= 25; r++) for (let c = 2; c <= 25; c++) if (PLAZA_MASK[r]![c] !== TOWN_MASK[r + 10]![c + 10]) diff.push(`${c},${r}`);
    expect(diff.join(" ")).toBe("");
  });
});

describe("방 넷 (D-06·P20-19)", () => {
  it.each(ROOM_IDS.map((id) => [id] as const))("%s: 문 칸은 가운데 두 칸이고 문턱은 plaza 다", (id) => {
    const room = TOWN_ROOMS.find((r) => r.id === id)!;
    const side = doorSideOf(room);
    const want = (side === "n" || side === "s" ? [{ x: room.door.x - 25, z: room.door.z }, { x: room.door.x + 25, z: room.door.z }] : [{ x: room.door.x, z: room.door.z - 25 }, { x: room.door.x, z: room.door.z + 25 }]).map(xz).join(" ");
    const cells = doorCells(room);
    expect(`${cells.map(xz).join(" ")} / ${cells.map((p) => zoneOf(TOWN_MAP, p.x, p.z)).join(",")}`).toBe(`${want} / plaza,plaza`);
  });

  it.each(ROOM_IDS.map((id) => [id] as const))("%s: 걷는 안쪽은 소품을 두고도 열에 일곱 이상·8칸 이상 남는다", (id) => {
    const room = TOWN_ROOMS.find((r) => r.id === id)!;
    const withProps = innerCount(room, TOWN_MASK).walk;
    const bare = innerCount(room, rasterTown(TOWN_OBSTACLES.filter((o) => !TOWN_PROPS.includes(o))).rows).walk;
    expect(`${withProps >= 8}/${bare > 0 && withProps / bare >= 0.7}/${withProps < bare}`).toBe("true/true/true");
  });

  it.each(ROOM_IDS.map((id) => [id] as const))("%s: 문 앞 목적지·방 안 자리는 걷는 칸 중심이고 정의식(문 중심 바깥 1.0 · 안쪽 가운데의 가장 가까운 걷는 칸 중심)과 같다", (id) => {
    const room = TOWN_ROOMS.find((r) => r.id === id)!;
    const out = OUT[doorSideOf(room)];
    const front = nearestWalkCenter(TOWN_MAP, { x: room.door.x + out.x * 100, z: room.door.z + out.z * 100 });
    const inside = nearestWalkCenter(TOWN_MAP, { x: (room.inner.x0 + room.inner.x1) / 2, z: (room.inner.z0 + room.inner.z1) / 2 });
    const got = `${xz(room.front)}/${xz(room.inside)}/${isCenterOfWalkCell(room.front)}/${isCenterOfWalkCell(room.inside)}/${zoneOf(TOWN_MAP, room.front.x, room.front.z)}/${zoneOf(TOWN_MAP, room.inside.x, room.inside.z)}`;
    expect(got).toBe(`${xz(front)}/${xz(inside)}/true/true/plaza/${id}`);
  });

  it("zoneOf 실물: 경계 위는 plaza, 경계에서 1 안쪽은 그 방", () => {
    const got = TOWN_ROOMS.map((r) => `${zoneOf(TOWN_MAP, r.inner.x0, r.inside.z)},${zoneOf(TOWN_MAP, r.inner.x0 + 1, r.inside.z)},${zoneOf(TOWN_MAP, r.inside.x, r.inner.z1)},${zoneOf(TOWN_MAP, r.inside.x, r.inner.z1 - 1)}`).join(" ");
    expect(got).toBe("plaza,post,plaza,post plaza,pub,plaza,pub plaza,clinic,plaza,clinic plaza,police,plaza,police");
  });

  it.each(ROOM_IDS.map((id) => [id] as const))("%s: 문 앞 → 방 안 길을 자르면 밖 구간은 모두 plaza 이고 문턱 안쪽 면을 넘지 않는다, 되돌아 나오는 길은 모두 그 방이다", (id) => {
    const room = TOWN_ROOMS.find((r) => r.id === id)!;
    const T0 = 1_700_000_000_000;
    const zones = (s: Segment): string => {
      const out: string[] = [];
      for (let i = 0; i + 1 < s.p.length; i += 2) out.push(zoneOf(TOWN_MAP, s.p[i]!, s.p[i + 1]!));
      return [...new Set(out)].join(",");
    };
    const enter: Segment = { p: routeFx(TOWN_MAP, room.front, room.inside), t0: T0, v: MOVE_V };
    const leave: Segment = { p: routeFx(TOWN_MAP, room.inside, room.front), t0: T0, v: MOVE_V };
    const cutIn = clipToZone(TOWN_MAP, enter, T0);
    const cutOut = clipToZone(TOWN_MAP, leave, T0);
    const end = { x: cutIn.p[cutIn.p.length - 2]!, z: cutIn.p[cutIn.p.length - 1]! };
    const side = doorSideOf(room);
    const atFace = side === "s" ? end.z === room.inner.z1 : side === "n" ? end.z === room.inner.z0 : side === "e" ? end.x === room.inner.x1 : end.x === room.inner.x0;
    const got = `${xz({ x: enter.p[enter.p.length - 2]!, z: enter.p[enter.p.length - 1]! })}/${zones(cutIn)}/${atFace}/${zones(cutOut)}/${cutIn.p.length < enter.p.length || xz(end) !== xz(room.inside)}`;
    expect(got).toBe(`${xz(room.inside)}/plaza/true/${id}/true`);
  });
});

describe("집 여덟 (D-07)", () => {
  it("집 문 앞 목적지는 걷는 칸 중심이고 정의식(문 있는 면 가운데에서 바깥 1.0 의 가장 가까운 걷는 칸 중심)과 같다", () => {
    const want = TOWN_HOUSES.map((h) => {
      const out = OUT[h.face];
      return xz(nearestWalkCenter(TOWN_MAP, { x: fx(h.x) + out.x * 220, z: fx(h.z) + out.z * 220 }));
    });
    expect(`${TOWN_HOUSES.map((h) => xz(h.front)).join(" ")} / ${TOWN_HOUSES.every((h) => isCenterOfWalkCell(h.front) && zoneOf(TOWN_MAP, h.front.x, h.front.z) === "plaza")}`).toBe(`${want.join(" ")} / true`);
  });

  it("집 몸통은 걸을 수 없다 — 집 중심 칸이 막혀 있다", () => {
    const got = TOWN_HOUSES.map((h) => lineWalkable(TOWN_MAP, { x: fx(h.x), z: fx(h.z) }, { x: fx(h.x), z: fx(h.z) }));
    expect(got.join(",")).toBe(Array.from({ length: 8 }, () => "false").join(","));
  });
});

describe("마을의 길 (D-19) — 서버가 문을 지나는 길을 정한다", () => {
  it("입장 지점 0 에서 입장 지점 7곳·방 안 넷·방 문 앞 넷·집 문 앞 여덟·장소 8곳 모두에 닿는다(끝점 0.3 안)", () => {
    const from = { x: fx(TOWN_SPAWNS[0]!.x), z: fx(TOWN_SPAWNS[0]!.z) };
    const targets: Array<[string, { x: number; z: number }]> = [
      ...TOWN_SPAWNS.slice(1).map((s, i): [string, { x: number; z: number }] => [`spawn${i + 1}`, { x: fx(s.x), z: fx(s.z) }]),
      ...TOWN_ROOMS.flatMap((r): Array<[string, { x: number; z: number }]> => [[`${r.id}.inside`, r.inside], [`${r.id}.front`, r.front]]),
      ...TOWN_HOUSES.map((h): [string, { x: number; z: number }] => [`house${h.seat}`, h.front]),
      ...TOWN_PLACES.map((p): [string, { x: number; z: number }] => [`place.${p.id}`, { x: fx(p.x), z: fx(p.z) }]),
    ];
    const bad: string[] = [];
    for (const [label, to] of targets) {
      const p = routeFx(TOWN_MAP, from, to);
      const ex = p[p.length - 2]!;
      const ez = p[p.length - 1]!;
      let ok = p.length >= 4 && (ex - to.x) * (ex - to.x) + (ez - to.z) * (ez - to.z) <= 30 * 30;
      for (let i = 0; ok && i + 3 < p.length; i += 2) ok = lineWalkable(TOWN_MAP, { x: p[i]!, z: p[i + 1]! }, { x: p[i + 2]!, z: p[i + 3]! });
      if (!ok) bad.push(label);
    }
    expect(`${targets.length} ${bad.join(",")}`).toBe("31 ");
  });

  it("걷는 칸은 모두 입장 지점에서 닿는다(닫힌 구멍 없음)", () => {
    expect(rasterTown().removed.length + (walkCount(TOWN_MASK) > 600 ? 0 : 1000)).toBe(0);
  });
});

describe("마을 장소 8곳 (D-08·P20-20)", () => {
  const rectGap = (o: Obstacle, x: number, z: number): number => (o.kind === "rect" ? Math.hypot(Math.max(Math.abs(x - o.x) - o.w / 2, 0), Math.max(Math.abs(z - o.z) - o.d / 2, 0)) : Infinity);

  it("id 는 PLACE_IDS 안의 여덟 가지이고 방 안 넷(mail·glass·flower·poster)은 각 방, 광장 넷은 plaza 다", () => {
    const got = TOWN_PLACES.map((p) => `${p.id}:${zoneOf(TOWN_MAP, fx(p.x), fx(p.z))}`).sort().join(" ");
    expect(`${TOWN_PLACES.every((p) => (PLACE_IDS as readonly string[]).includes(p.id))}/${new Set(TOWN_PLACES.map((p) => p.id)).size} ${got}`).toBe(
      "true/8 bench:plaza clock:plaza flower:clinic fountain:plaza glass:pub mail:post poster:police tree:plaza",
    );
  });

  it("모두 걷는 자리이고 서로 2.0 이상 떨어져 있다. 광장 넷은 광장 좌표 그대로, 방 안 넷은 걷는 칸 중심이고 소품에서 한 칸(0.5) 이상이다", () => {
    const walk = TOWN_PLACES.every((p) => lineWalkable(TOWN_MAP, { x: fx(p.x), z: fx(p.z) }, { x: fx(p.x), z: fx(p.z) }));
    let minGap = Infinity;
    for (let i = 0; i < TOWN_PLACES.length; i++) for (let j = i + 1; j < TOWN_PLACES.length; j++) minGap = Math.min(minGap, Math.hypot(TOWN_PLACES[i]!.x - TOWN_PLACES[j]!.x, TOWN_PLACES[i]!.z - TOWN_PLACES[j]!.z));
    const plazaSame = ["clock", "bench", "tree", "fountain"].every((id) => {
      const a = TOWN_PLACES.find((p) => p.id === id);
      const b = PLAZA_PLACES.find((p) => p.id === id)!;
      return a !== undefined && a.x === b.x && a.z === b.z;
    });
    const indoor = TOWN_PLACES.filter((p) => zoneOf(TOWN_MAP, fx(p.x), fx(p.z)) !== "plaza");
    const indoorOk = indoor.length === 4 && indoor.every((p) => isCenterOfWalkCell({ x: fx(p.x), z: fx(p.z) }) && TOWN_PROPS.every((o) => rectGap(o, p.x, p.z) >= 0.5 - 1e-9));
    expect(`${TOWN_PLACES.length}/${walk}/${minGap >= 2}/${plazaSame}/${indoorOk}`).toBe("8/true/true/true/true");
  });
});

describe("mapTown.ts 소스 규약", () => {
  const source = sourceOf("shared/game/mapTown.ts");

  it("삼각함수·hypot·random·현재 시각을 쓰지 않는다(주석 제외)", () => {
    expect(source).not.toMatch(/Math\.(hypot|sin|cos|tan|asin|acos|atan|atan2|random)\b/);
    expect(source).not.toMatch(/Date\.now|new Date|performance\.now/);
  });

  it("DOM·workerd API 를 쓰지 않는다(순수 모듈)", () => {
    expect(source).not.toMatch(/\b(document|window|crypto|fetch)\b/);
  });
});
