import { describe, expect, it } from "vitest";
import {
  type MapDef,
  UNIT,
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

const OPEN6 = mk(Array.from({ length: 6 }, () => "......"));
// 가운데(열 2) 세로 벽, 맨 아래 줄만 통로
const WALL6 = mk(["..#...", "..#...", "..#...", "..#...", "..#...", "......"]);

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
    expect(snapToWalkable(OPEN6, { x: -660, z: -610 })).toEqual({ x: -660, z: -610, snapped: false });
  });

  it("막힌 칸의 점은 가장 가까운 걸을 수 있는 칸 중심으로 간다(동률은 행 → 열 작은 순)", () => {
    const m = mk(["......", "......", "..#...", "......", "......", "......"]);
    // 막힌 칸 (2,2) 중심 (-575,-575): 거리 50 인 이웃이 넷 — 행이 작은 (2,1) 이 이긴다.
    expect(snapToWalkable(m, { x: -575, z: -575 })).toEqual({ x: -575, z: -625, snapped: true });
  });

  it("맵 범위 밖은 범위 안 가장 가까운 칸 중심으로 간다", () => {
    expect(snapToWalkable(OPEN6, { x: 0, z: 0 })).toEqual({ x: -425, z: -425, snapped: true });
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
    expect(findPath(mk([".#"]), { c: 0, r: 0 }, { c: 1, r: 0 })).toBeNull();
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
    expect(routeFx(OPEN6, { x: -680, z: -680 }, { x: -660, z: -670 })).toEqual([-680, -680, -660, -670]);
  });

  it("직선으로 보이는 두 점은 두 점", () => {
    expect(routeFx(OPEN6, { x: -680, z: -680 }, { x: -430, z: -420 })).toEqual([-680, -680, -430, -420]);
  });

  it("벽을 돌아가는 꼭짓점이 1개 이상 있고 모든 선분이 걸을 수 있다", () => {
    const from = cellCenterFx(0, 0);
    const to = cellCenterFx(5, 0);
    const flat = routeFx(WALL6, from, to);
    expect(flat.length).toBeGreaterThanOrEqual(6);
    expect(flat.length % 2).toBe(0);
    expect(flat.slice(0, 2)).toEqual([from.x, from.z]);
    expect(flat.slice(-2)).toEqual([to.x, to.z]);
    expect(allSegmentsWalkable(WALL6, flat)).toBe(true);
    expect(flat.every(Number.isInteger)).toBe(true);
  });

  it("막힌 도착점은 보정된 점에서 끝난다", () => {
    const flat = routeFx(WALL6, cellCenterFx(0, 0), cellCenterFx(2, 2));
    const snapped = snapToWalkable(WALL6, cellCenterFx(2, 2));
    expect(flat.slice(-2)).toEqual([snapped.x, snapped.z]);
  });

  it("같은 입력은 같은 출력", () => {
    const a = routeFx(WALL6, { x: -690, z: -690 }, { x: -410, z: -690 });
    expect(a).toEqual(routeFx(WALL6, { x: -690, z: -690 }, { x: -410, z: -690 }));
  });

  it("도달 불가면 출발점 한 점", () => {
    const m = mk([".#.", ".#.", ".#."]);
    expect(routeFx(m, cellCenterFx(0, 0), cellCenterFx(2, 2))).toEqual([-675, -675]);
  });
});
