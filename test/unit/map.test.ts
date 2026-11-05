import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { seededRandInt } from "../helpers/seededRandom";
import {
  BAR_MAP,
  BAR_MASK,
  BAR_OBSTACLES,
  BAR_SPAWNS,
  CELL,
  CHAR_RADIUS,
  GRID_ORIGIN,
  GRID_SIZE,
  HEAD_TOP_Y,
  type MapDef,
  type Obstacle,
  type Spawn,
  STAGE_REACH_FX,
  STAGE_SPOT,
  TO_CAMERA,
  UNIT,
  WALK_HALF,
  cellCenterFx,
  cellOfFx,
  findPath,
  isWalkable,
  lineWalkable,
  parseMask,
  routeFx,
  smoothPath,
  snapToWalkable,
  walkableCells,
} from "../../shared/game/map";
import { PLAZA_MAP, PLAZA_MASK, PLAZA_OBSTACLES, PLAZA_SPAWNS } from "../../shared/game/mapPlaza";

/** 테스트 전용 작은 맵: 원점부터 rows.length 칸만 쓴다. */
function mk(rows: readonly string[]): MapDef {
  return { id: "bar", size: rows.length, mask: parseMask(rows), spawns: [] };
}

/** 점 배열 [x0,z0,x1,z1,…] 의 모든 선분이 lineWalkable 인지. */
function allSegmentsWalkable(map: MapDef, flat: number[]): boolean {
  for (let i = 0; i + 3 < flat.length; i += 2) {
    if (!lineWalkable(map, { x: flat[i]!, z: flat[i + 1]! }, { x: flat[i + 2]!, z: flat[i + 3]! })) return false;
  }
  return true;
}

/**
 * 28×28 격자 한가운데(칸 11..16)에 6×6 무늬를 놓고 나머지는 막는다.
 * snapToWalkable 의 ±580 자르기가 원점 쪽 작은 맵을 깎으므로, 보정·경로 테스트는 한가운데에 놓은 무늬로 한다.
 */
function embed6(rows: readonly string[]): MapDef {
  const pad = "#".repeat(28);
  const side = "#".repeat(11);
  const full = Array.from({ length: 28 }, (_, r) =>
    r >= 11 && r < 17 ? `${side}${rows[r - 11]}${"#".repeat(28 - 17)}` : pad,
  );
  return mk(full);
}
/** embed6 무늬의 (c, r) 칸 중심. */
function P(c: number, r: number): { x: number; z: number } {
  return cellCenterFx(c + 11, r + 11);
}

const OPEN6 = mk(Array.from({ length: 6 }, () => "......"));
// 가운데(열 2) 세로 벽, 맨 아래 줄만 통로
const WALL6 = mk(["..#...", "..#...", "..#...", "..#...", "..#...", "......"]);
const OPEN6C = embed6(Array.from({ length: 6 }, () => "......"));
const WALL6C = embed6(["..#...", "..#...", "..#...", "..#...", "..#...", "......"]);

describe("고정소수점 단위", () => {
  it("1 월드 단위는 100 이다", () => {
    expect(UNIT).toBe(100);
  });
});

describe("parseMask", () => {
  it("'.' 은 1(걷기), '#' 은 0(막힘)으로 행 우선 배열이 된다", () => {
    expect(Array.from(parseMask(["..", "#."]))).toEqual([1, 1, 0, 1]);
  });

  it("줄 길이가 다르면 던진다", () => {
    expect(() => parseMask(["..", "."])).toThrow();
  });

  it("'.'·'#' 밖 글자가 있으면 던진다", () => {
    expect(() => parseMask(["..", ".x"])).toThrow();
  });
});

describe("격자 좌표 변환", () => {
  it("cellOfFx 는 원점 -700, 칸 50 으로 칸을 구한다", () => {
    expect(cellOfFx(-700, -700)).toEqual({ c: 0, r: 0 });
    expect(cellOfFx(-650, -651)).toEqual({ c: 1, r: 0 });
  });

  it("cellCenterFx 는 칸 중심을 정수로 돌려준다", () => {
    expect(cellCenterFx(0, 0)).toEqual({ x: -675, z: -675 });
    expect(cellCenterFx(1, 2)).toEqual({ x: -625, z: -575 });
  });

  it("isWalkable 은 범위 밖과 막힌 칸을 거절한다", () => {
    const m = mk(["..", "#."]);
    expect(isWalkable(m, 0, 0)).toBe(true);
    expect(isWalkable(m, 0, 1)).toBe(false);
    expect(isWalkable(m, -1, 0)).toBe(false);
    expect(isWalkable(m, 2, 0)).toBe(false);
    expect(isWalkable(m, 0, 2)).toBe(false);
  });

  it("walkableCells 는 행 우선으로 걸을 수 있는 칸만 돌려준다", () => {
    expect(walkableCells(mk(["..", "#."]))).toEqual([
      { c: 0, r: 0 },
      { c: 1, r: 0 },
      { c: 1, r: 1 },
    ]);
  });
});

describe("snapToWalkable", () => {
  it("걸을 수 있는 칸 안의 점은 좌표 그대로, snapped false", () => {
    const p = { x: P(2, 3).x - 10, z: P(2, 3).z + 7 };
    expect(snapToWalkable(OPEN6C, p)).toEqual({ x: p.x, z: p.z, snapped: false });
  });

  it("막힌 칸의 점은 가장 가까운 걸을 수 있는 칸 중심으로 간다(동률은 행 → 열 작은 순)", () => {
    const m = embed6(["......", "......", "..#...", "......", "......", "......"]);
    // 막힌 칸 (2,2) 중심: 거리 50 인 이웃이 넷 — 행이 작은 (2,1) 이 이긴다.
    expect(snapToWalkable(m, P(2, 2))).toEqual({ ...P(2, 1), snapped: true });
  });

  it("맵 바깥은 가장 가까운 걸을 수 있는 칸 중심으로 간다", () => {
    expect(snapToWalkable(OPEN6C, { x: 100000, z: 100000 })).toEqual({ ...P(5, 5), snapped: true });
  });

  it("±580 으로 자른다: 28칸 열린 맵에서 먼 점은 (580,-580)", () => {
    const open28 = mk(Array.from({ length: 28 }, () => ".".repeat(28)));
    expect(snapToWalkable(open28, { x: 100000, z: -100000 })).toEqual({ x: 580, z: -580, snapped: true });
  });
});

describe("findPath", () => {
  it("같은 칸이면 그 칸 하나", () => {
    expect(findPath(OPEN6, { c: 2, r: 3 }, { c: 2, r: 3 })).toEqual([{ c: 2, r: 3 }]);
  });

  it("대각 이동은 두 옆 칸이 모두 걸을 수 있을 때만(모서리 끼어들기 금지)", () => {
    expect(findPath(mk([".#", ".."]), { c: 0, r: 0 }, { c: 1, r: 1 })).toEqual([
      { c: 0, r: 0 },
      { c: 0, r: 1 },
      { c: 1, r: 1 },
    ]);
    expect(findPath(mk([".#", "#."]), { c: 0, r: 0 }, { c: 1, r: 1 })).toBeNull();
    expect(findPath(mk(["..", ".."]), { c: 0, r: 0 }, { c: 1, r: 1 })).toEqual([
      { c: 0, r: 0 },
      { c: 1, r: 1 },
    ]);
  });

  it("벽을 돌아가는 길을 찾고 같은 입력에는 같은 출력", () => {
    const a = findPath(WALL6, { c: 0, r: 0 }, { c: 5, r: 0 });
    expect(a).not.toBeNull();
    expect(a).toEqual(findPath(WALL6, { c: 0, r: 0 }, { c: 5, r: 0 }));
    expect(a!.some((p) => p.r === 5)).toBe(true);
  });

  it("출발·도착이 막혔거나 이어지지 않으면 null", () => {
    expect(findPath(mk([".#.", ".#.", ".#."]), { c: 0, r: 0 }, { c: 2, r: 2 })).toBeNull();
    expect(findPath(mk(["#.", ".."]), { c: 0, r: 0 }, { c: 1, r: 1 })).toBeNull();
  });
});

describe("lineWalkable (슈퍼커버)", () => {
  it("열린 맵의 칸 중심 사이 선분은 통과", () => {
    expect(lineWalkable(OPEN6, cellCenterFx(0, 0), cellCenterFx(5, 5))).toBe(true);
  });

  it("벽 칸을 지나는 선분은 막힘", () => {
    expect(lineWalkable(WALL6, cellCenterFx(0, 0), cellCenterFx(5, 0))).toBe(false);
  });

  it("꼭짓점을 정확히 지나면 이웃 두 칸도 검사한다", () => {
    // (0,0) 중심 → (1,1) 중심은 네 칸의 공통 꼭짓점을 지난다. (1,0) 이 막혀 있으면 막힘.
    expect(lineWalkable(mk([".#", ".."]), cellCenterFx(0, 0), cellCenterFx(1, 1))).toBe(false);
    expect(lineWalkable(mk(["..", ".."]), cellCenterFx(0, 0), cellCenterFx(1, 1))).toBe(true);
  });

  it("같은 점(길이 0)은 그 점이 닿는 칸이 모두 걸을 수 있어야 통과", () => {
    expect(lineWalkable(WALL6, cellCenterFx(1, 1), cellCenterFx(1, 1))).toBe(true);
    expect(lineWalkable(WALL6, cellCenterFx(2, 1), cellCenterFx(2, 1))).toBe(false);
  });
});

describe("smoothPath", () => {
  it("보이는 점은 건너뛰고 못 보이는 점만 남긴다", () => {
    const pts = [cellCenterFx(0, 0), cellCenterFx(1, 0), cellCenterFx(2, 0), cellCenterFx(3, 0)];
    expect(smoothPath(OPEN6, pts)).toEqual([cellCenterFx(0, 0), cellCenterFx(3, 0)]);
  });
});

describe("routeFx", () => {
  it("같은 칸 안 이동은 시작·끝 두 점", () => {
    const a = { x: P(1, 1).x - 20, z: P(1, 1).z - 20 };
    const b = { x: P(1, 1).x + 20, z: P(1, 1).z - 10 };
    expect(routeFx(OPEN6C, a, b)).toEqual([a.x, a.z, b.x, b.z]);
  });

  it("직선으로 보이는 두 점은 두 점", () => {
    const a = { x: P(0, 0).x - 20, z: P(0, 0).z - 20 };
    const b = { x: P(5, 5).x + 20, z: P(5, 5).z + 10 };
    expect(routeFx(OPEN6C, a, b)).toEqual([a.x, a.z, b.x, b.z]);
  });

  it("벽을 돌아가는 꼭짓점이 1개 이상 있고 모든 선분이 걸을 수 있다", () => {
    const from = P(0, 0);
    const to = P(5, 0);
    const flat = routeFx(WALL6C, from, to);
    expect(flat.length).toBeGreaterThanOrEqual(6);
    expect(flat.length % 2).toBe(0);
    expect(flat.slice(0, 2)).toEqual([from.x, from.z]);
    expect(flat.slice(-2)).toEqual([to.x, to.z]);
    expect(allSegmentsWalkable(WALL6C, flat)).toBe(true);
    expect(flat.every(Number.isInteger)).toBe(true);
  });

  it("막힌 도착점은 보정된 점에서 끝난다", () => {
    const flat = routeFx(WALL6C, P(0, 0), P(2, 2));
    const snapped = snapToWalkable(WALL6C, P(2, 2));
    expect(snapped.snapped).toBe(true);
    expect(flat.slice(-2)).toEqual([snapped.x, snapped.z]);
  });

  it("막힌 출발점은 보정된 점에서 시작한다", () => {
    const flat = routeFx(WALL6C, P(2, 2), P(5, 0));
    const snapped = snapToWalkable(WALL6C, P(2, 2));
    expect(flat.slice(0, 2)).toEqual([snapped.x, snapped.z]);
  });

  it("같은 입력은 같은 출력", () => {
    const a = routeFx(WALL6C, P(0, 0), P(5, 0));
    expect(a).toEqual(routeFx(WALL6C, P(0, 0), P(5, 0)));
  });

  it("도달 불가면 출발점 한 점", () => {
    const m = embed6([".#....", ".#....", ".#....", ".#....", ".#....", ".#...."]);
    expect(routeFx(m, P(0, 0), P(5, 5))).toEqual([P(0, 0).x, P(0, 0).z]);
  });
});

// ───────────────────────── 재즈 바 장애물·마스크·입장 지점 (Task 2) ─────────────────────────

/** 셀 (c, r) 중심의 월드 좌표(월드 단위). 테스트의 래스터화 전용. */
function cellWorld(c: number, r: number): { x: number; z: number } {
  return { x: GRID_ORIGIN + CELL / 2 + CELL * c, z: GRID_ORIGIN + CELL / 2 + CELL * r };
}

/** 월드 점 (px, pz) 를 장애물 로컬 좌표로(three 의 rotation.y 는 (lx, lz) → (lx·cos + lz·sin, −lx·sin + lz·cos)). */
function toLocal(o: Extract<Obstacle, { kind: "rect" }>, px: number, pz: number): { lx: number; lz: number } {
  const dx = px - o.x;
  const dz = pz - o.z;
  const cs = Math.cos(o.rot);
  const sn = Math.sin(o.rot);
  return { lx: cs * dx - sn * dz, lz: sn * dx + cs * dz };
}

/** 거리가 기준과 정확히 같은 동률(예: 카운터 끝에서 정확히 0.35)은 부동소수 잡음이라 걸을 수 있는 쪽으로 정한다. */
const TIE_EPS = 1e-9;

/** 셀 중심에서 floor 장애물까지 바닥 거리와 막힘 기준(반지름 + 캐릭터 반지름)의 차. 음수면 막힘. */
function floorMargin(o: Obstacle, px: number, pz: number): number {
  if (o.kind === "circle") return Math.hypot(px - o.x, pz - o.z) - (o.r + CHAR_RADIUS);
  const { lx, lz } = toLocal(o, px, pz);
  const qx = Math.max(Math.abs(lx) - o.w / 2, 0);
  const qz = Math.max(Math.abs(lz) - o.d / 2, 0);
  return Math.hypot(qx, qz) - CHAR_RADIUS;
}

/** 해석적 광선-부피 판정(슬랩): 원점 (ox,oy,oz) 에서 방향 TO_CAMERA 로 t > 0 구간이 장애물 부피와 만나는지. */
function rayHitsAnalytic(o: Obstacle, ox: number, oy: number, oz: number): boolean {
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

/** 원시 래스터화: 셀마다 막힘 여부(true = 막힘). 부풀리기 0.35 + 이동 한계 ±5.8 + 머리 꼭대기 가려짐. */
function rasterizeRaw(obstacles: readonly Obstacle[]): boolean[][] {
  const grid: boolean[][] = [];
  for (let r = 0; r < GRID_SIZE; r++) {
    const row: boolean[] = [];
    for (let c = 0; c < GRID_SIZE; c++) {
      const { x, z } = cellWorld(c, r);
      let blocked = Math.abs(x) > WALK_HALF || Math.abs(z) > WALK_HALF;
      for (const o of obstacles) {
        if (blocked) break;
        if (o.floor && floorMargin(o, x, z) < -TIE_EPS) blocked = true;
        else if (rayHitsAnalytic(o, x, HEAD_TOP_Y, z)) blocked = true;
      }
      row.push(blocked);
    }
    grid.push(row);
  }
  return grid;
}

/**
 * 래스터화 = 원시 래스터화 + 닫힌 구멍 메우기: 입장 지점 seed 에서 4방향으로 닿지 않는 걸을 수 있는 칸은
 * 어디서도 도착할 수 없으니(보정이 그 칸을 고르면 캐릭터가 멈춘다) 막는다. 메운 칸은 removed 로 함께 돌려준다.
 * 제품 코드에는 없고 이 테스트가 마스크의 출처를 증명한다.
 */
function rasterize(
  obstacles: readonly Obstacle[],
  seed: { c: number; r: number },
): { rows: string[]; removed: { c: number; r: number }[] } {
  const grid = rasterizeRaw(obstacles);
  const reach = new Set<number>();
  const stack = [seed];
  while (stack.length > 0) {
    const { c, r } = stack.pop()!;
    if (c < 0 || r < 0 || c >= GRID_SIZE || r >= GRID_SIZE || grid[r]![c] || reach.has(r * GRID_SIZE + c)) continue;
    reach.add(r * GRID_SIZE + c);
    stack.push({ c: c + 1, r }, { c: c - 1, r }, { c, r: r + 1 }, { c, r: r - 1 });
  }
  const removed: { c: number; r: number }[] = [];
  const rows = grid.map((row, r) =>
    row
      .map((blocked, c) => {
        if (blocked) return "#";
        if (reach.has(r * GRID_SIZE + c)) return ".";
        removed.push({ c, r });
        return "#";
      })
      .join(""),
  );
  return { rows, removed };
}

/** 마스크 출처 계산에 쓰는 시작 칸 = 입장 지점 0번이 속한 칸. */
function seedCell(spawns: readonly Spawn[] = BAR_SPAWNS): { c: number; r: number } {
  const s0 = spawns[0]!;
  return cellOfFx(Math.round(s0.x * UNIT), Math.round(s0.z * UNIT));
}

if (process.env.MAP_PRINT === "1") {
  describe("마스크 출력(MAP_PRINT=1 일 때만)", () => {
    it("래스터화 결과를 줄로 출력", () => {
      process.stdout.write(`\n${rasterize(BAR_OBSTACLES, seedCell()).rows.map((l) => `  "${l}",`).join("\n")}\n`);
    });
    it("광장 래스터화 결과를 줄로 출력", () => {
      const out = rasterize(PLAZA_OBSTACLES, seedCell(PLAZA_SPAWNS));
      process.stdout.write(`\nPLAZA\n${out.rows.map((l) => `  "${l}",`).join("\n")}\nremoved ${JSON.stringify(out.removed)}\n`);
    });
  });
}

describe("재즈 바 장애물 원문 (bar.js)", () => {
  const circles = BAR_OBSTACLES.filter((o) => o.kind === "circle");
  const rects = BAR_OBSTACLES.filter((o) => o.kind === "rect");

  it("바 카운터 1·스툴 4·피아노 1·무대 1·탁자 5·의자 10·펜던트 갓 2 = 24개", () => {
    expect(BAR_OBSTACLES.length).toBe(24);
    expect(rects.length).toBe(2); // 바 카운터, 피아노
    expect(circles.length).toBe(22);
    expect(BAR_OBSTACLES.filter((o) => !o.floor).length).toBe(2); // 펜던트 갓
  });

  it("바 카운터: 폭 1.0 × 깊이 6.2 @ (−5.7, −2.2), 윗판까지 1.13", () => {
    const o = rects.find((r) => r.rot === 0)!;
    expect(o).toMatchObject({ x: -5.7, z: -2.2, w: 1, d: 6.2, y0: 0, y1: 1.13, floor: true });
  });

  it("피아노: 1.6 × 1.2 @ (−4.6, −5.0), 회전 0.6, 높이 1.55", () => {
    const o = rects.find((r) => r.rot !== 0)!;
    expect(o).toMatchObject({ x: -4.6, z: -5, w: 1.6, d: 1.2, rot: 0.6, y0: 0, y1: 1.55, floor: true });
  });

  it("무대: 반지름 1.18 높이 0.28 @ (0,0)", () => {
    expect(circles).toContainEqual({ kind: "circle", x: 0, z: 0, r: 1.18, y0: 0, y1: 0.28, floor: true });
  });

  it("스툴 4개: x −4.8, z = −4.4 + 1.4 i, 반지름 0.24 높이 0.76", () => {
    for (let i = 0; i < 4; i++) {
      const z = Math.round((-4.4 + i * 1.4) * 10) / 10;
      expect(circles).toContainEqual({ kind: "circle", x: -4.8, z, r: 0.24, y0: 0, y1: 0.76, floor: true });
    }
  });

  const TABLES: [number, number][] = [
    [4.6, 1.2],
    [1.2, 4.6],
    [4.4, -3.2],
    [-3.2, 4.4],
    [-2.4, -4.6],
  ];

  it("탁자 5개: 반지름 0.5 높이 0.79", () => {
    for (const [x, z] of TABLES) {
      expect(circles).toContainEqual({ kind: "circle", x, z, r: 0.5, y0: 0, y1: 0.79, floor: true });
    }
  });

  it("의자 10개: 탁자 방향 u 에 수직 ±(u.z, −u.x) × 0.8, 반지름 0.43 높이 0.99 (소수 넷째 자리)", () => {
    const chairs = circles.filter((o) => o.r === 0.43);
    expect(chairs.length).toBe(10);
    for (const [x, z] of TABLES) {
      const n = Math.sqrt(x * x + z * z);
      for (const sign of [1, -1]) {
        const cx = x + (sign * -z * 0.8) / n;
        const cz = z + (sign * x * 0.8) / n;
        const hit = chairs.find((o) => Math.abs(o.x - cx) < 5e-5 && Math.abs(o.z - cz) < 5e-5);
        expect(hit, `table (${x},${z}) chair sign ${sign}`).toBeDefined();
        expect(hit).toMatchObject({ y0: 0, y1: 0.99, floor: true });
      }
    }
  });

  it("펜던트 갓 2개: (−2.4, −4.6)·(4.4, −3.2), 반지름 0.3, y 2.67~2.93, 바닥은 막지 않는다", () => {
    for (const [x, z] of [
      [-2.4, -4.6],
      [4.4, -3.2],
    ]) {
      expect(circles).toContainEqual({ kind: "circle", x, z, r: 0.3, y0: 2.67, y1: 2.93, floor: false });
    }
  });
});

describe("BAR_MASK", () => {
  it("28줄 × 28글자, '.'·'#' 뿐", () => {
    expect(BAR_MASK.length).toBe(28);
    for (const row of BAR_MASK) expect(row).toMatch(/^[.#]{28}$/);
  });

  it("BAR_MAP 은 마스크를 그대로 쓴다", () => {
    expect(BAR_MAP.id).toBe("bar");
    expect(BAR_MAP.size).toBe(28);
    expect(Array.from(BAR_MAP.mask)).toEqual(Array.from(parseMask(BAR_MASK)));
    expect(BAR_MAP.spawns).toBe(BAR_SPAWNS);
  });

  it("장애물 래스터화(부풀리기 0.35 + 이동 한계 ±5.8 + 머리 꼭대기 가려짐 + 닫힌 구멍 메우기)와 글자 하나까지 같다", () => {
    expect(BAR_MASK).toEqual(rasterize(BAR_OBSTACLES, seedCell()).rows);
  });

  it("닫힌 구멍으로 메운 칸은 뒤쪽 구석 (2,2)·(3,2) 두 칸뿐이다(바 카운터·피아노 뒤)", () => {
    expect(rasterize(BAR_OBSTACLES, seedCell()).removed).toEqual([
      { c: 2, r: 2 },
      { c: 3, r: 2 },
    ]);
  });

  it("거리가 기준과 정확히 같은 동률 칸은 걸을 수 있는 쪽이고, 동률이 아닌 칸은 부동소수 잡음(1e-9)보다 확실히 갈린다", () => {
    const ties: string[] = [];
    for (let r = 0; r < GRID_SIZE; r++) {
      for (let c = 0; c < GRID_SIZE; c++) {
        const { x, z } = cellWorld(c, r);
        for (const o of BAR_OBSTACLES) {
          if (!o.floor) continue;
          const m = floorMargin(o, x, z);
          if (Math.abs(m) <= TIE_EPS) ties.push(`${c},${r}`);
          else expect(Math.abs(m), `cell ${c},${r}`).toBeGreaterThan(1e-6);
        }
        // 이동 한계 ±5.8 도 같다: 칸 중심은 ±5.75 와 ±6.25 뿐이라 동률이 없다.
        expect(Math.abs(Math.abs(x) - WALK_HALF)).toBeGreaterThan(0.01);
      }
    }
    // 동률 칸은 마스크에서 걸을 수 있다.
    for (const t of ties) {
      const [c, r] = t.split(",").map(Number) as [number, number];
      const { x, z } = cellWorld(c, r);
      const hit = BAR_OBSTACLES.some((o) => !o.floor && rayHitsAnalytic(o, x, HEAD_TOP_Y, z));
      if (!hit) expect(isWalkable(BAR_MAP, c, r), `tie ${t}`).toBe(true);
    }
    process.stdout.write(`동률 칸: ${ties.length}개 ${ties.join(" ")}\n`);
  });

  it("걸을 수 있는 칸의 중심은 모두 |x|,|z| ≤ 5.8", () => {
    const cells = walkableCells(BAR_MAP);
    expect(cells.length).toBeGreaterThan(0);
    for (const { c, r } of cells) {
      const { x, z } = cellWorld(c, r);
      expect(Math.abs(x)).toBeLessThanOrEqual(WALK_HALF);
      expect(Math.abs(z)).toBeLessThanOrEqual(WALK_HALF);
    }
  });

  it("가구 중심이 든 칸은 막혀 있다(무대·탁자 5·스툴 4·피아노·바 카운터)", () => {
    const centers: [string, number, number][] = [
      ["무대", 0, 0],
      ["탁자1", 4.6, 1.2],
      ["탁자2", 1.2, 4.6],
      ["탁자3", 4.4, -3.2],
      ["탁자4", -3.2, 4.4],
      ["탁자5", -2.4, -4.6],
      ["스툴0", -4.8, -4.4],
      ["스툴1", -4.8, -3.0],
      ["스툴2", -4.8, -1.6],
      ["스툴3", -4.8, -0.2],
      ["피아노", -4.6, -5.0],
      ["바 카운터", -5.7, -2.2],
    ];
    for (const [name, x, z] of centers) {
      const { c, r } = cellOfFx(Math.round(x * UNIT), Math.round(z * UNIT));
      expect(isWalkable(BAR_MAP, c, r), name).toBe(false);
    }
  });

  it("걸을 수 있는 칸은 한 덩어리다(한 칸에서 BFS 로 전부 닿는다)", () => {
    const cells = walkableCells(BAR_MAP);
    const seen = new Set<number>([cells[0]!.r * GRID_SIZE + cells[0]!.c]);
    const queue = [cells[0]!];
    while (queue.length > 0) {
      const cur = queue.pop()!;
      for (const [dc, dr] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ] as const) {
        const nc = cur.c + dc;
        const nr = cur.r + dr;
        const id = nr * GRID_SIZE + nc;
        if (isWalkable(BAR_MAP, nc, nr) && !seen.has(id)) {
          seen.add(id);
          queue.push({ c: nc, r: nr });
        }
      }
    }
    expect(seen.size).toBe(cells.length);
    process.stdout.write(`걸을 수 있는 셀 수: ${cells.length} / ${GRID_SIZE * GRID_SIZE}\n`);
  });
});

describe("BAR_SPAWNS (ctx.talk 원문)", () => {
  const TALK: [number, number][] = [
    [3.6, 0.4],
    [0.4, 3.6],
    [5.4, 2.2],
    [-4.2, -1.2],
    [3.4, -2.6],
    [-2.6, 3.4],
    [-4.2, 0.2],
    [2.2, 5.4],
  ];

  it("8곳이 원문 좌표 그대로", () => {
    expect(BAR_SPAWNS.map((s) => [s.x, s.z])).toEqual(TALK);
  });

  it("yaw 는 0번·2번·3번·6번만 있고 원문 값과 같다", () => {
    expect(BAR_SPAWNS[0]!.yaw).toBeCloseTo(Math.atan2(1.0, 0.8), 6);
    expect(BAR_SPAWNS[2]!.yaw).toBeCloseTo(Math.atan2(-1.0, -1.0), 6);
    expect(BAR_SPAWNS[3]!.yaw).toBeCloseTo(-Math.PI / 2, 6);
    expect(BAR_SPAWNS[6]!.yaw).toBeCloseTo(-Math.PI / 2, 6);
    for (const i of [1, 4, 5, 7]) expect(BAR_SPAWNS[i]!.yaw).toBeUndefined();
  });

  it("모두 걸을 수 있다(점이 닿는 칸이 전부 걸을 수 있다)", () => {
    for (const s of BAR_SPAWNS) {
      const p = { x: Math.round(s.x * UNIT), z: Math.round(s.z * UNIT) };
      const snapped = snapToWalkable(BAR_MAP, p);
      expect(snapped, `spawn ${s.x},${s.z}`).toEqual({ ...p, snapped: false });
    }
  });

  it("모든 쌍이 경로로 이어지고 거리가 1.0 이상", () => {
    for (let i = 0; i < BAR_SPAWNS.length; i++) {
      for (let j = i + 1; j < BAR_SPAWNS.length; j++) {
        const a = BAR_SPAWNS[i]!;
        const b = BAR_SPAWNS[j]!;
        expect(Math.hypot(a.x - b.x, a.z - b.z), `${i}-${j}`).toBeGreaterThanOrEqual(1.0);
        const ca = cellOfFx(Math.round(a.x * UNIT), Math.round(a.z * UNIT));
        const cb = cellOfFx(Math.round(b.x * UNIT), Math.round(b.z * UNIT));
        expect(findPath(BAR_MAP, ca, cb), `${i}-${j}`).not.toBeNull();
      }
    }
  });
});

// ───────────────────────── 경로 속성 (Task 3) ─────────────────────────

/** 선분 위를 촘촘히 표본으로 훑어 칸 바닥(floor)이 막힌 곳을 지나는지 본다 — lineWalkable 과 독립된 검사(열린 구간만). */
function sampledCrossesBlocked(map: MapDef, a: { x: number; z: number }, b: { x: number; z: number }): boolean {
  const steps = 800;
  for (let i = 0; i <= steps; i++) {
    const x = a.x + ((b.x - a.x) * i) / steps;
    const z = a.z + ((b.z - a.z) * i) / steps;
    const { c, r } = cellOfFx(x, z);
    if (!isWalkable(map, c, r)) return true;
  }
  return false;
}

function clamp580(v: number): number {
  return Math.max(-580, Math.min(580, v));
}

function sqrtLen(flat: number[]): number {
  let total = 0;
  for (let i = 0; i + 3 < flat.length; i += 2) {
    const dx = flat[i + 2]! - flat[i]!;
    const dz = flat[i + 3]! - flat[i + 1]!;
    total += Math.sqrt(dx * dx + dz * dz);
  }
  return total;
}

describe("routeFx 속성 테스트 (재즈 바, 시드 1..200)", () => {
  const cells = walkableCells(BAR_MAP);
  /** 걸을 수 있는 칸 둘의 안쪽(경계에서 1~49 떨어진) 임의 고정소수점 점 쌍. */
  function pair(seed: number): { from: { x: number; z: number }; to: { x: number; z: number } } {
    const rnd = seededRandInt(seed);
    const pick = (): { x: number; z: number } => {
      const cell = cells[rnd(cells.length)]!;
      const base = cellCenterFx(cell.c, cell.r);
      return { x: base.x - 25 + 1 + rnd(49), z: base.z - 25 + 1 + rnd(49) };
    };
    return { from: pick(), to: pick() };
  }

  it("길이가 짝수·4 이상이고 첫 점 = 출발, 끝 점 = 도착, 모든 선분이 걸을 수 있다(슈퍼커버와 표본 둘 다)", () => {
    for (let seed = 1; seed <= 200; seed++) {
      const { from, to } = pair(seed);
      const flat = routeFx(BAR_MAP, from, to);
      expect(flat.length % 2, `seed ${seed}`).toBe(0);
      expect(flat.length, `seed ${seed}`).toBeGreaterThanOrEqual(4);
      // 걸을 수 있는 칸 안의 점은 그대로 쓰되 이동 한계 ±580 밖으로는 나가지 않는다(자르기).
      expect(flat.slice(0, 2), `seed ${seed}`).toEqual([clamp580(from.x), clamp580(from.z)]);
      expect(flat.slice(-2), `seed ${seed}`).toEqual([clamp580(to.x), clamp580(to.z)]);
      expect(flat.every(Number.isInteger), `seed ${seed}`).toBe(true);
      expect(allSegmentsWalkable(BAR_MAP, flat), `seed ${seed}`).toBe(true);
      for (let i = 0; i + 3 < flat.length; i += 2) {
        const crossed = sampledCrossesBlocked(BAR_MAP, { x: flat[i]!, z: flat[i + 1]! }, { x: flat[i + 2]!, z: flat[i + 3]! });
        expect(crossed, `seed ${seed} seg ${i / 2}`).toBe(false);
      }
    }
  });

  it("같은 입력 두 번은 깊은 같음(결정성)", () => {
    for (let seed = 1; seed <= 200; seed++) {
      const { from, to } = pair(seed);
      expect(routeFx(BAR_MAP, from, to), `seed ${seed}`).toEqual(routeFx(BAR_MAP, from, to));
    }
  });

  it("경로 총 길이는 직선 길이 이상 직선 × 1.6 이하(최댓값은 출력)", () => {
    let worst = 0;
    for (let seed = 1; seed <= 200; seed++) {
      const { from, to } = pair(seed);
      const flat = routeFx(BAR_MAP, from, to);
      const straight = Math.sqrt((clamp580(to.x) - clamp580(from.x)) ** 2 + (clamp580(to.z) - clamp580(from.z)) ** 2);
      const len = sqrtLen(flat);
      expect(len, `seed ${seed}`).toBeGreaterThanOrEqual(straight - 1e-6);
      if (straight > 0) worst = Math.max(worst, len / straight);
      expect(len, `seed ${seed}`).toBeLessThanOrEqual(straight * 1.6);
    }
    process.stdout.write(`경로/직선 최댓값(시드 200): ${worst.toFixed(4)}\n`);
  });

  it("막힌 도착점(무대 근처 10,0 — 무대 자리 0,0 은 08-04 의 단일 예외)은 걸을 수 있는 칸의 보정된 점에서 끝난다", () => {
    const from = { x: -420, z: -420 };
    const flat = routeFx(BAR_MAP, from, { x: 10, z: 0 });
    const snapped = snapToWalkable(BAR_MAP, { x: 10, z: 0 });
    expect(snapped.snapped).toBe(true);
    expect(flat.slice(-2)).toEqual([snapped.x, snapped.z]);
    const end = cellOfFx(snapped.x, snapped.z);
    expect(isWalkable(BAR_MAP, end.c, end.r)).toBe(true);
    expect(allSegmentsWalkable(BAR_MAP, flat)).toBe(true);
  });

  it("출발이 막힌 칸이면 첫 점은 보정된 점", () => {
    const blockedStart = { x: 0, z: 0 };
    const snapped = snapToWalkable(BAR_MAP, blockedStart);
    const flat = routeFx(BAR_MAP, blockedStart, { x: 450, z: 450 });
    expect(flat.slice(0, 2)).toEqual([snapped.x, snapped.z]);
    expect(allSegmentsWalkable(BAR_MAP, flat)).toBe(true);
  });

  it("맵 바깥·이동 한계 밖 목적지도 걸을 수 있는 칸에서 끝나고 경로가 막힌 곳을 지나지 않는다", () => {
    for (const to of [
      { x: 100000, z: 100000 },
      { x: -100000, z: 0 },
      { x: 0, z: -100000 },
      { x: 700, z: -700 },
    ]) {
      const flat = routeFx(BAR_MAP, { x: 400, z: 400 }, to);
      const end = cellOfFx(flat[flat.length - 2]!, flat[flat.length - 1]!);
      expect(isWalkable(BAR_MAP, end.c, end.r)).toBe(true);
      expect(Math.abs(flat[flat.length - 2]!)).toBeLessThanOrEqual(580);
      expect(Math.abs(flat[flat.length - 1]!)).toBeLessThanOrEqual(580);
      expect(allSegmentsWalkable(BAR_MAP, flat)).toBe(true);
    }
  });
});

describe("가려짐 없음: 걸을 수 있는 모든 칸의 머리 꼭대기 광선", () => {
  /** 해석 판정(슬랩)과 독립된 두 번째 판정: 광선을 촘촘히 걸어가며 장애물 부피 안에 드는지 본다. */
  function marchHits(x: number, z: number, dirY: number): boolean {
    const D = { x: TO_CAMERA.x, y: dirY, z: TO_CAMERA.z };
    for (let t = 0; t <= 2; t += 0.0005) {
      const px = x + D.x * t;
      const py = HEAD_TOP_Y + D.y * t;
      const pz = z + D.z * t;
      for (const o of BAR_OBSTACLES) {
        if (py < o.y0 || py > o.y1) continue;
        if (o.kind === "circle") {
          if ((px - o.x) ** 2 + (pz - o.z) ** 2 <= o.r * o.r) return true;
        } else {
          const { lx, lz } = toLocal(o, px, pz);
          if (Math.abs(lx) <= o.w / 2 && Math.abs(lz) <= o.d / 2) return true;
        }
      }
    }
    return false;
  }

  it("TO_CAMERA 방향으로 가구에 막히는 칸이 걸을 수 있는 칸에 없다", () => {
    for (const { c, r } of walkableCells(BAR_MAP)) {
      const { x, z } = cellWorld(c, r);
      expect(marchHits(x, z, TO_CAMERA.y), `cell ${c},${r}`).toBe(false);
    }
  });

  it("TO_CAMERA 는 제품 카메라(yaw π/4, 거리 17, 높이 12.5, 주시 높이 0.6)의 위치 − 주시점과 같다", () => {
    expect(TO_CAMERA.x).toBeCloseTo(17 * Math.sin(Math.PI / 4), 6);
    expect(TO_CAMERA.z).toBeCloseTo(17 * Math.cos(Math.PI / 4), 6);
    expect(TO_CAMERA.y).toBeCloseTo(12.5 - 0.6, 6);
  });

  it("계획 원문의 방향(높이 12.5)으로 봐도 걸을 수 있는 칸은 가려지지 않는다", () => {
    for (const { c, r } of walkableCells(BAR_MAP)) {
      const { x, z } = cellWorld(c, r);
      expect(marchHits(x, z, 12.5), `cell ${c},${r}`).toBe(false);
    }
  });

  it("검사가 헛돌지 않는다: 막힌 칸 가운데 펜던트 때문에만 막힌 칸이 있다", () => {
    let onlyByRay = 0;
    for (let r = 0; r < GRID_SIZE; r++) {
      for (let c = 0; c < GRID_SIZE; c++) {
        const { x, z } = cellWorld(c, r);
        if (BAR_OBSTACLES.some((o) => o.floor && floorMargin(o, x, z) < -TIE_EPS)) continue;
        if (Math.abs(x) > WALK_HALF || Math.abs(z) > WALK_HALF) continue;
        if (marchHits(x, z, TO_CAMERA.y)) {
          onlyByRay++;
          expect(isWalkable(BAR_MAP, c, r), `cell ${c},${r}`).toBe(false);
        }
      }
    }
    expect(onlyByRay).toBeGreaterThan(0);
  });
});

describe("map.ts 소스 규약", () => {
  const source = readFileSync(new URL("../../shared/game/map.ts", import.meta.url), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/.*$/gm, "");

  it("삼각함수·hypot·random·현재 시각을 쓰지 않는다(주석 제외)", () => {
    expect(source).not.toMatch(/Math\.(hypot|sin|cos|tan|asin|acos|atan|atan2|random)\b/);
    expect(source).not.toMatch(/Date\.now|new Date|performance\.now/);
  });

  it("DOM·workerd API 를 쓰지 않고 import 가 없다(순수 모듈)", () => {
    expect(source).not.toMatch(/\b(document|window|crypto|fetch)\b/);
    expect(source).not.toMatch(/^\s*import\s/m);
  });
});

// ---- 08-04: 무대 자리 단일 예외 (사용자 확정 2026-11-02, 결정 0060-7, T-08-18) ----
// 변론자가 서는 STAGE_SPOT(0,0)은 무대 원기둥 안이라 막힌 칸이다. 예외는 정확히 그 한 점과, 그 점에 닿는 300 안의 짧은 선분뿐이다.
describe("STAGE_SPOT 단일 예외 (결정 0060-7)", () => {
  const S = { x: STAGE_SPOT.x, z: STAGE_SPOT.z };
  /** 무대 예외가 없는 같은 맵: 예외 밖의 판정이 그대로인지 비교하는 기준. */
  const NO_STAGE: MapDef = { ...BAR_MAP, stage: undefined };
  /** RESEARCH 패턴 4 의 8곳(서로 203) */
  const SLOTS8 = [
    [0, 265],
    [-187, 187],
    [-265, 0],
    [-187, -187],
    [0, -265],
    [187, -187],
    [265, 0],
    [187, 187],
  ].map(([x, z]) => ({ x: x!, z: z! }));

  it("상수: STAGE_SPOT 은 (0,0), 닿는 거리는 300 이고 BAR_MAP.stage 가 같은 점이다", () => {
    expect(`${STAGE_SPOT.x},${STAGE_SPOT.z}`).toBe("0,0");
    expect(STAGE_REACH_FX).toBe(300);
    expect(BAR_MAP.stage).toEqual({ x: 0, z: 0 });
  });

  it("무대 자리는 예외가 없으면 막힌 점이다(무대 원기둥 안)", () => {
    expect(lineWalkable(NO_STAGE, S, S)).toBe(false);
  });

  it("lineWalkable: 두 끝이 모두 STAGE_SPOT 이면 true", () => {
    expect(lineWalkable(BAR_MAP, S, S)).toBe(true);
  });

  it("lineWalkable: 슬롯 8곳 → STAGE_SPOT, STAGE_SPOT → 슬롯 8곳 모두 true(방향 무관)", () => {
    for (const q of SLOTS8) {
      expect(lineWalkable(NO_STAGE, q, q)).toBe(true); // 슬롯 자체는 걸을 수 있는 점
      expect(`${q.x},${q.z}:${lineWalkable(BAR_MAP, q, S)}`).toBe(`${q.x},${q.z}:true`);
      expect(`${q.x},${q.z}:${lineWalkable(BAR_MAP, S, q)}`).toBe(`${q.x},${q.z}:true`);
    }
  });

  it("lineWalkable: 다른 점(10,0)·(-10,0)·(0,10)의 한 점 판정은 그대로 막혀 있다", () => {
    for (const q of [
      { x: 10, z: 0 },
      { x: -10, z: 0 },
      { x: 0, z: 10 },
      { x: 0, z: -10 },
      { x: 1, z: 1 },
    ]) {
      expect(lineWalkable(BAR_MAP, q, q)).toBe(false);
    }
  });

  it("lineWalkable: (0,350) → STAGE_SPOT 은 닿는 거리 300 밖이라 false", () => {
    expect(lineWalkable(NO_STAGE, { x: 0, z: 350 }, { x: 0, z: 350 })).toBe(true); // 걸을 수 있는 점이지만
    expect(lineWalkable(BAR_MAP, { x: 0, z: 350 }, S)).toBe(false);
    expect(lineWalkable(BAR_MAP, S, { x: 0, z: 350 })).toBe(false);
  });

  it("lineWalkable: 막힌 점 → STAGE_SPOT 은 false", () => {
    for (const q of [
      { x: 100, z: 0 },
      { x: 0, z: 100 },
      { x: 60, z: 60 },
    ]) {
      expect(lineWalkable(NO_STAGE, q, q)).toBe(false);
      expect(lineWalkable(BAR_MAP, q, S)).toBe(false);
      expect(lineWalkable(BAR_MAP, S, q)).toBe(false);
    }
  });

  it("예외는 정확히 한 점에만 붙는다: 25 간격 격자에서 STAGE_SPOT 과의 선분은 '걸을 수 있는 끝점 + 거리 300 이내' 일 때만 true", () => {
    const bad: string[] = [];
    for (let x = -600; x <= 600; x += 25) {
      for (let z = -600; z <= 600; z += 25) {
        if (x === 0 && z === 0) continue;
        const q = { x, z };
        const expected = lineWalkable(NO_STAGE, q, q) && x * x + z * z <= STAGE_REACH_FX * STAGE_REACH_FX;
        if (lineWalkable(BAR_MAP, S, q) !== expected || lineWalkable(BAR_MAP, q, S) !== expected) bad.push(`${x},${z}`);
      }
    }
    expect(bad.join(" ")).toBe("");
  });

  it("무대가 아닌 두 점의 판정은 예외 없는 맵과 같다(무대 둘레 막힌 칸을 걸어 지나가지 못한다)", () => {
    const bad: string[] = [];
    const pts: { x: number; z: number }[] = [];
    for (let x = -550; x <= 550; x += 110) for (let z = -550; z <= 550; z += 110) if (x !== 0 || z !== 0) pts.push({ x, z });
    for (const a of pts) {
      for (const b of pts) {
        if (lineWalkable(BAR_MAP, a, b) !== lineWalkable(NO_STAGE, a, b)) bad.push(`${a.x},${a.z}>${b.x},${b.z}`);
      }
    }
    expect(bad.join(" ")).toBe("");
    // 무대를 가로지르는 선분은 그대로 막혀 있다.
    expect(lineWalkable(BAR_MAP, { x: -265, z: 0 }, { x: 265, z: 0 })).toBe(false);
    expect(lineWalkable(BAR_MAP, { x: 0, z: -265 }, { x: 0, z: 265 })).toBe(false);
  });

  it("snapToWalkable(STAGE_SPOT) 은 그 자리에 둔다, 근처 점은 걸을 수 있는 곳으로 옮긴다", () => {
    expect(snapToWalkable(BAR_MAP, S)).toEqual({ x: 0, z: 0, snapped: false });
    const near = snapToWalkable(BAR_MAP, { x: 10, z: 0 });
    expect(near.snapped).toBe(true);
    expect(lineWalkable(NO_STAGE, near, near)).toBe(true);
  });

  it("routeFx: 무대에서 입장 지점으로 — 첫 점 [0,0], 끝 점은 그 입장 지점, 모든 선분 lineWalkable (8곳)", () => {
    for (const [i, sp] of BAR_SPAWNS.entries()) {
      const to = { x: Math.round(sp.x * UNIT), z: Math.round(sp.z * UNIT) };
      const flat = routeFx(BAR_MAP, S, to);
      expect(`${i}:${flat[0]},${flat[1]}`).toBe(`${i}:0,0`);
      expect(`${i}:${flat.at(-2)},${flat.at(-1)}`).toBe(`${i}:${to.x},${to.z}`);
      expect(`${i}:${allSegmentsWalkable(BAR_MAP, flat)}`).toBe(`${i}:true`);
    }
  });

  it("routeFx: 입장 지점에서 무대로 — 끝 점 [0,0], 첫 점은 그 입장 지점, 모든 선분 lineWalkable (8곳)", () => {
    for (const [i, sp] of BAR_SPAWNS.entries()) {
      const from = { x: Math.round(sp.x * UNIT), z: Math.round(sp.z * UNIT) };
      const flat = routeFx(BAR_MAP, from, S);
      expect(`${i}:${flat.at(-2)},${flat.at(-1)}`).toBe(`${i}:0,0`);
      expect(`${i}:${flat[0]},${flat[1]}`).toBe(`${i}:${from.x},${from.z}`);
      expect(`${i}:${allSegmentsWalkable(BAR_MAP, flat)}`).toBe(`${i}:true`);
    }
  });

  it("routeFx: 무대 → 슬롯 8곳 · 슬롯 8곳 → 무대는 곧바로 두 점(닿는 거리 안)", () => {
    for (const q of SLOTS8) {
      expect(routeFx(BAR_MAP, S, q)).toEqual([0, 0, q.x, q.z]);
      expect(routeFx(BAR_MAP, q, S)).toEqual([q.x, q.z, 0, 0]);
    }
  });

  it("routeFx: 무대 → 무대는 제자리, 무대가 없는 맵은 예전과 같다", () => {
    expect(routeFx(BAR_MAP, S, S)).toEqual([0, 0, 0, 0]);
    const from = { x: 360, z: 40 };
    const to = { x: -420, z: 20 };
    expect(routeFx(BAR_MAP, from, to)).toEqual(routeFx(NO_STAGE, from, to));
  });

  it("routeFx: 일반 길은 무대 자리를 지나지 않는다(칸 중심 경로) — 시드 입장 지점 쌍 56개", () => {
    const pts = BAR_SPAWNS.map((sp) => ({ x: Math.round(sp.x * UNIT), z: Math.round(sp.z * UNIT) }));
    for (const a of pts) {
      for (const b of pts) {
        if (a === b) continue;
        const flat = routeFx(BAR_MAP, a, b);
        expect(allSegmentsWalkable(NO_STAGE, flat)).toBe(true); // 예외 없이도 걸을 수 있는 길
      }
    }
  });
});


// ───────────────────────── 시계탑 광장 (11-06 Task 2, D-22) ─────────────────────────

describe("시계탑 광장 장애물 원문 (plaza.js)", () => {
  const O = PLAZA_OBSTACLES;
  const rects = O.filter((o): o is Extract<Obstacle, { kind: "rect" }> => o.kind === "rect");
  const circles = O.filter((o): o is Extract<Obstacle, { kind: "circle" }> => o.kind === "circle");
  it("연단 1·벤치 2·나무 밑동 2·나무 줄기 2·가로등 4·시계탑 1 = 12개이고 모두 바닥을 막는다(floor)", () => {
    expect(O.length).toBe(12);
    expect(O.every((o) => o.floor)).toBe(true);
  });
  it("연단: 막힘 반지름 1.4(아래 단 윗면, 밑면은 1.45) 높이 0.46 @ (0,0)", () => {
    expect(circles.find((c) => c.x === 0 && c.z === 0)).toMatchObject({ r: 1.4, y0: 0, y1: 0.46 });
  });
  it("벤치 2개: 1.4×0.42 @ (4.6,−3.4) 회전 0 · (−3.4,4.6) 회전 π/2, 높이 0.72", () => {
    const b = rects.filter((r) => r.w === 1.4);
    expect(b.map((r) => [r.x, r.z, r.d, r.rot, r.y1])).toEqual([
      [4.6, -3.4, 0.42, 0, 0.72],
      [-3.4, 4.6, 0.42, Math.PI / 2, 0.72],
    ]);
  });
  it("나무 2그루: 밑동 0.9×0.9 높이 0.48 + 같은 자리 줄기 반지름 0.11 높이 2.35 @ (−4.6,4.4)·(4.4,−4.6)", () => {
    const base = rects.filter((r) => r.w === 0.9);
    expect(base.map((r) => [r.x, r.z, r.d, r.y1])).toEqual([
      [-4.6, 4.4, 0.9, 0.48],
      [4.4, -4.6, 0.9, 0.48],
    ]);
    const trunk = circles.filter((c) => c.r === 0.11);
    expect(trunk.map((c) => [c.x, c.z, c.y1])).toEqual([
      [-4.6, 4.4, 2.35],
      [4.4, -4.6, 2.35],
    ]);
  });
  it("가로등 4개: 반지름 0.08 높이 2.75 @ (3.8,−2.4)·(−2.4,3.8)·(−3.6,1.0)·(1.0,−3.6)", () => {
    const l = circles.filter((c) => c.r === 0.08);
    expect(l.map((c) => [c.x, c.z, c.y1])).toEqual([
      [3.8, -2.4, 2.75],
      [-2.4, 3.8, 2.75],
      [-3.6, 1.0, 2.75],
      [1.0, -3.6, 2.75],
    ]);
  });
  it("시계탑: 2.6×2.6 @ (−4.3,−4.3) 높이 5.8", () => {
    expect(rects.find((r) => r.w === 2.6)).toMatchObject({ x: -4.3, z: -4.3, d: 2.6, rot: 0, y0: 0, y1: 5.8 });
  });
});

describe("PLAZA_MASK", () => {
  it("28줄 × 28글자, '.'·'#' 뿐", () => {
    expect(PLAZA_MASK.length).toBe(GRID_SIZE);
    for (const row of PLAZA_MASK) expect(row).toMatch(/^[.#]{28}$/);
  });
  it("PLAZA_MAP 은 마스크·입장 지점·무대 자리를 그대로 쓴다", () => {
    expect(PLAZA_MAP.id).toBe("plaza");
    expect(PLAZA_MAP.size).toBe(GRID_SIZE);
    expect(Array.from(PLAZA_MAP.mask)).toEqual(Array.from(parseMask(PLAZA_MASK)));
    expect(PLAZA_MAP.spawns).toBe(PLAZA_SPAWNS);
    expect(PLAZA_MAP.stage).toEqual(STAGE_SPOT);
  });
  it("장애물 래스터화(bar 와 같은 규칙: 부풀리기 0.35 + 이동 한계 ±5.8 + 머리 꼭대기 가려짐 + 닫힌 구멍 메우기)와 글자 하나까지 같다", () => {
    expect(PLAZA_MASK).toEqual(rasterize(PLAZA_OBSTACLES, seedCell(PLAZA_SPAWNS)).rows);
  });
  it("닫힌 구멍으로 메운 칸이 없다 — 걸을 수 있는 칸은 모두 입장 지점에서 닿는다", () => {
    expect(rasterize(PLAZA_OBSTACLES, seedCell(PLAZA_SPAWNS)).removed).toEqual([]);
  });
  it("걸을 수 있는 칸의 중심은 모두 |x|,|z| ≤ 5.8", () => {
    for (const { c, r } of walkableCells(PLAZA_MAP)) {
      const { x, z } = cellCenterFx(c, r);
      expect(Math.abs(x) <= 580 && Math.abs(z) <= 580, `${c},${r}`).toBe(true);
    }
  });
  it("가구 중심이 든 칸은 막혀 있다(연단·벤치 2·나무 2·가로등 4·시계탑)", () => {
    for (const o of PLAZA_OBSTACLES) {
      const { c, r } = cellOfFx(Math.round(o.x * UNIT), Math.round(o.z * UNIT));
      expect(isWalkable(PLAZA_MAP, c, r), `${o.x},${o.z}`).toBe(false);
    }
  });
  it("걸을 수 있는 칸은 한 덩어리다(한 칸에서 닿는 칸 수 = 전체)", () => {
    const cells = walkableCells(PLAZA_MAP);
    const seen = new Set<number>();
    const stack = [cells[0]!];
    while (stack.length > 0) {
      const { c, r } = stack.pop()!;
      if (!isWalkable(PLAZA_MAP, c, r) || seen.has(r * GRID_SIZE + c)) continue;
      seen.add(r * GRID_SIZE + c);
      stack.push({ c: c + 1, r }, { c: c - 1, r }, { c, r: r + 1 }, { c, r: r - 1 });
    }
    expect(seen.size).toBe(cells.length);
  });
  it("재즈 바 마스크와 다르다(맵마다 자기 마스크로 판정한다)", () => {
    expect(PLAZA_MASK).not.toEqual(BAR_MASK);
  });
});

describe("PLAZA_SPAWNS (plaza.js 의 ctx.talk 원문)", () => {
  const TALK: [number, number][] = [
    [3.2, 1.8],
    [1.8, 3.2],
    [4.6, -1.6],
    [-2.2, -2.8],
    [-2.4, 2.6],
    [2.8, -2.8],
    [-1.6, 4.4],
    [-3.2, -1.8],
  ];
  it("8곳이 원문 좌표 그대로이고 yaw 는 지정하지 않는다(카메라 쪽)", () => {
    expect(PLAZA_SPAWNS.map((s) => [s.x, s.z])).toEqual(TALK);
    for (const s of PLAZA_SPAWNS) expect(s.yaw).toBeUndefined();
  });
  it("모두 걸을 수 있다(점이 닿는 칸이 전부 걸을 수 있다)", () => {
    for (const s of PLAZA_SPAWNS) {
      const p = { x: Math.round(s.x * UNIT), z: Math.round(s.z * UNIT) };
      expect(snapToWalkable(PLAZA_MAP, p), `spawn ${s.x},${s.z}`).toEqual({ ...p, snapped: false });
    }
  });
  it("모든 쌍이 경로로 이어지고 거리가 1.0 이상", () => {
    for (let i = 0; i < PLAZA_SPAWNS.length; i++) {
      for (let j = i + 1; j < PLAZA_SPAWNS.length; j++) {
        const a = PLAZA_SPAWNS[i]!;
        const b = PLAZA_SPAWNS[j]!;
        expect(Math.hypot(a.x - b.x, a.z - b.z), `${i}-${j}`).toBeGreaterThanOrEqual(1.0);
        const ca = cellOfFx(Math.round(a.x * UNIT), Math.round(a.z * UNIT));
        const cb = cellOfFx(Math.round(b.x * UNIT), Math.round(b.z * UNIT));
        expect(findPath(PLAZA_MAP, ca, cb), `${i}-${j}`).not.toBeNull();
      }
    }
  });
  it("무대 자리 (0,0)는 마스크로는 막힌 칸이고 단일 예외로만 선분이 통한다", () => {
    const { c, r } = cellOfFx(0, 0);
    expect(isWalkable(PLAZA_MAP, c, r)).toBe(false);
    for (const s of PLAZA_SPAWNS) {
      const p = { x: Math.round(s.x * UNIT), z: Math.round(s.z * UNIT) };
      expect(lineWalkable({ ...PLAZA_MAP, stage: undefined }, p, { x: 0, z: 0 })).toBe(false);
    }
  });
});
