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
  UNIT,
  WALK_HALF,
  cellCenterFx,
  cellOfFx,
  lineWalkable,
  routeFx,
  snapToWalkable,
} from "../../shared/game/map";
import type { MapDef, RoomDef, Spawn } from "../../shared/game/map";
import { PLAZA_MAP, PLAZA_MASK, PLAZA_OBSTACLES, PLAZA_SPAWNS } from "../../shared/game/mapPlaza";
import { clipToZone, zoneAt, zoneOf } from "../../shared/game/zones";
import { MOVE_V, positionAtFx, segmentEndsAt } from "../../shared/game/world";
import type { Segment } from "../../shared/game/world";
import { ROOM_IDS, ZONE_IDS } from "../../shared/protocol";

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
