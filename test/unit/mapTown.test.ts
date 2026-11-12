// 마을 맵(20-01): 격자 일반화(D-04) · 구역 판정(D-13) · 마을 장애물·마스크·방 넷·집 여덟(D-05~D-08) · 판 종류의 고정 맵(D-02).
// 실패 출력이 한 줄이 되게(TAP) 마스크·경로·프레임은 문자열로 비교한다.
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
import type { MapDef, Spawn } from "../../shared/game/map";
import { PLAZA_MASK, PLAZA_OBSTACLES, PLAZA_SPAWNS } from "../../shared/game/mapPlaza";

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
