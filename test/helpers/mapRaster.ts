// 이동 마스크의 출처를 증명하는 래스터화(20-01, 결정 D-04). test/unit/map.test.ts 의 재즈 바·광장 래스터화를 격자 인자를 받게 일반화했다 —
// 같은 식이라 재즈 바 격자({ size 28, origin −7, walkHalf 5.8 })로 돌리면 BAR_MASK·PLAZA_MASK 가 글자 하나까지 그대로 나온다(test/unit/mapTown.test.ts 가 지킨다).
// 제품 코드에는 없다(삼각함수·hypot 를 쓴다). 마스크 문자열은 이 출력에서 붙여 넣고, 시험이 문자열과 래스터화가 같음을 지킨다.
import { CELL, CHAR_RADIUS, HEAD_TOP_Y, TO_CAMERA } from "../../shared/game/map";
import type { Obstacle } from "../../shared/game/map";

/** 격자: 한 변 칸 수 · 원점(월드 단위) · 이동 한계 ±(월드 단위). 칸 한 변은 CELL(0.5) 공통이다. */
export interface RasterGrid {
  size: number;
  origin: number;
  walkHalf: number;
}

export interface RasterOptions {
  /** 머리 광선 시험을 건너뛰는 칸(문 앞 칸 면제, P20-10). 바닥 막힘은 그대로 본다. 인자는 칸 중심(월드 단위). */
  exempt?: (x: number, z: number) => boolean;
  /** 칸 중심의 구역(방 id 또는 null). 그 방의 컷어웨이 장애물(cut — 지붕·앞벽)은 머리 광선 시험에서 뺀다(방 안에서는 걷힌다). */
  cutZoneOf?: (x: number, z: number) => string | null;
}

export interface RasterResult {
  rows: string[];
  /** 입장 지점에서 닿지 않아 메운 칸. */
  removed: { c: number; r: number }[];
  /** 면제(exempt) 덕분에 열린 칸 — 면제가 없었으면 머리 광선에 막혔을 칸. */
  exempted: { c: number; r: number }[];
}

/** 셀 (c, r) 중심의 월드 좌표(월드 단위). */
export function cellWorld(grid: Pick<RasterGrid, "origin">, c: number, r: number): { x: number; z: number } {
  return { x: grid.origin + CELL / 2 + CELL * c, z: grid.origin + CELL / 2 + CELL * r };
}

/** 월드 점 (px, pz) 를 장애물 로컬 좌표로(three 의 rotation.y 는 (lx, lz) → (lx·cos + lz·sin, −lx·sin + lz·cos)). */
function toLocal(o: Extract<Obstacle, { kind: "rect" }>, px: number, pz: number): { lx: number; lz: number } {
  const dx = px - o.x;
  const dz = pz - o.z;
  const cs = Math.cos(o.rot);
  const sn = Math.sin(o.rot);
  return { lx: cs * dx - sn * dz, lz: sn * dx + cs * dz };
}

/** 거리가 기준과 정확히 같은 동률(예: 벽에서 정확히 0.35)은 부동소수 잡음이라 걸을 수 있는 쪽으로 정한다. */
const TIE_EPS = 1e-9;

/** 셀 중심에서 floor 장애물까지 바닥 거리와 막힘 기준(반지름 + 캐릭터 반지름)의 차. 음수면 막힘. */
export function floorMargin(o: Obstacle, px: number, pz: number): number {
  if (o.kind === "circle") return Math.hypot(px - o.x, pz - o.z) - (o.r + CHAR_RADIUS);
  const { lx, lz } = toLocal(o, px, pz);
  const qx = Math.max(Math.abs(lx) - o.w / 2, 0);
  const qz = Math.max(Math.abs(lz) - o.d / 2, 0);
  return Math.hypot(qx, qz) - CHAR_RADIUS;
}

/** 해석적 광선-부피 판정(슬랩): 원점 (ox,oy,oz) 에서 방향 TO_CAMERA 로 t > 0 구간이 장애물 부피와 만나는지. */
export function rayHitsAnalytic(o: Obstacle, ox: number, oy: number, oz: number): boolean {
  const D = TO_CAMERA;
  const yLo = (o.y0 - oy) / D.y;
  const yHi = (o.y1 - oy) / D.y;
  let lo = Math.min(yLo, yHi);
  let hi = Math.max(yLo, yHi);
  if (o.kind === "circle") {
    const a = D.x * D.x + D.z * D.z;
    const b = 2 * ((ox - o.x) * D.x + (oz - o.z) * D.z);
    const c = (ox - o.x) ** 2 + (oz - o.z) ** 2 - o.r * o.r;
    const disc = b * b - 4 * a * c;
    if (disc < 0) return false;
    const sq = Math.sqrt(disc);
    lo = Math.max(lo, (-b - sq) / (2 * a));
    hi = Math.min(hi, (-b + sq) / (2 * a));
  } else {
    const cs = Math.cos(o.rot);
    const sn = Math.sin(o.rot);
    const lox = cs * (ox - o.x) - sn * (oz - o.z);
    const loz = sn * (ox - o.x) + cs * (oz - o.z);
    const ldx = cs * D.x - sn * D.z;
    const ldz = sn * D.x + cs * D.z;
    for (const [org, dir, half] of [
      [lox, ldx, o.w / 2],
      [loz, ldz, o.d / 2],
    ] as const) {
      if (Math.abs(dir) < 1e-12) {
        if (Math.abs(org) > half) return false;
        continue;
      }
      const t1 = (-half - org) / dir;
      const t2 = (half - org) / dir;
      lo = Math.max(lo, Math.min(t1, t2));
      hi = Math.min(hi, Math.max(t1, t2));
    }
  }
  return hi > 0 && lo <= hi;
}

/** 이 칸에서 이 장애물의 머리 광선 시험을 건너뛰는지: 문 앞 면제 칸이거나, 칸이 속한 방의 컷어웨이 장애물이면 건너뛴다. */
function raySkipped(o: Obstacle, exempt: boolean, zone: string | null): boolean {
  return exempt || (o.cut === true && o.room !== undefined && o.room === zone);
}

/**
 * 원시 래스터화: 셀마다 막힘 여부(true = 막힘). 부풀리기 0.35(바닥을 막는 장애물) + 이동 한계 ±walkHalf + 머리 꼭대기 가려짐.
 * 바닥 막힘은 늘 적용하고, 머리 광선 시험만 면제·컷어웨이 제외를 본다.
 */
function rasterizeRaw(obstacles: readonly Obstacle[], grid: RasterGrid, opts: RasterOptions): { blocked: boolean[][]; exempted: { c: number; r: number }[] } {
  const blockedGrid: boolean[][] = [];
  const exempted: { c: number; r: number }[] = [];
  for (let r = 0; r < grid.size; r++) {
    const row: boolean[] = [];
    for (let c = 0; c < grid.size; c++) {
      const { x, z } = cellWorld(grid, c, r);
      const exempt = opts.exempt?.(x, z) ?? false;
      const zone = opts.cutZoneOf?.(x, z) ?? null;
      let blocked = Math.abs(x) > grid.walkHalf || Math.abs(z) > grid.walkHalf;
      let rayOnlyByExempt = false;
      for (const o of obstacles) {
        if (blocked) break;
        if (o.floor && floorMargin(o, x, z) < -TIE_EPS) blocked = true;
        else if (rayHitsAnalytic(o, x, HEAD_TOP_Y, z)) {
          if (!raySkipped(o, exempt, zone)) blocked = true;
          else if (exempt && !(o.cut === true && o.room !== undefined && o.room === zone)) rayOnlyByExempt = true;
        }
      }
      if (!blocked && rayOnlyByExempt) exempted.push({ c, r });
      row.push(blocked);
    }
    blockedGrid.push(row);
  }
  return { blocked: blockedGrid, exempted };
}

/**
 * 래스터화 = 원시 래스터화 + 닫힌 구멍 메우기: 입장 지점 seed 에서 4방향으로 닿지 않는 걸을 수 있는 칸은
 * 어디서도 도착할 수 없으니(보정이 그 칸을 고르면 캐릭터가 멈춘다) 막는다. 메운 칸은 removed 로 함께 돌려준다.
 */
export function rasterizeGrid(obstacles: readonly Obstacle[], seed: { c: number; r: number }, grid: RasterGrid, opts: RasterOptions = {}): RasterResult {
  const { blocked, exempted } = rasterizeRaw(obstacles, grid, opts);
  const n = grid.size;
  const reach = new Set<number>();
  const stack = [seed];
  while (stack.length > 0) {
    const { c, r } = stack.pop()!;
    if (c < 0 || r < 0 || c >= n || r >= n || blocked[r]![c] || reach.has(r * n + c)) continue;
    reach.add(r * n + c);
    stack.push({ c: c + 1, r }, { c: c - 1, r }, { c, r: r + 1 }, { c, r: r - 1 });
  }
  const removed: { c: number; r: number }[] = [];
  const rows = blocked.map((row, r) =>
    row
      .map((isBlocked, c) => {
        if (isBlocked) return "#";
        if (reach.has(r * n + c)) return ".";
        removed.push({ c, r });
        return "#";
      })
      .join(""),
  );
  return { rows, removed, exempted: exempted.filter((e) => reach.has(e.r * n + e.c)) };
}
