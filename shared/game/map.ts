// 재즈 바 이동 격자와 경로(결정 0044-17: 클라이언트는 목적지만, 서버가 경로를 정한다).
// 격자는 맵마다 다를 수 있다(20페이즈 D-04): 한 변 칸 수(size)·원점(origin)·이동 한계(walkHalf)를 MapDef 에서 읽고, 없으면 재즈 바 값(GRID_ORIGIN·WALK_HALF)이다.
// 현재 시각·난수를 읽지 않고, 삼각함수·hypot 없이 정수·제곱근·사칙연산만 쓴다(RESEARCH R4) — 서버와 클라이언트가 같은 값을 얻게.

/** 1 월드 단위 = 100 (고정소수점, 와이어·저장 공통) */
export const UNIT = 100;
/** 격자 한 칸(월드 단위) */
export const CELL = 0.5;
/** 격자 한 변 칸 수 */
export const GRID_SIZE = 28;
/** 격자 원점(월드 단위, x·z 공통) */
export const GRID_ORIGIN = -7;
/** 별도 범위가 없는 맵의 이동 한계 ±(월드 단위) */
export const WALK_HALF = 5.8;
/** 캐릭터 반지름(월드 단위) */
export const CHAR_RADIUS = 0.35;
/** 머리 꼭대기 높이 = 2.45 × 0.83 */
export const HEAD_TOP_Y = 2.0335;

export interface Spawn {
  x: number;
  z: number;
  yaw?: number;
}

export interface MapDef {
  /** protocol.ts 의 MapId 와 같은 합집합이다 — 이 파일은 import 가 없는 순수 모듈이라(소스 규약 시험) 타입을 되풀이해 적는다. 어긋나면 maps.ts 의 MAPS(Record<MapId, MapDef>)가 컴파일에서 잡는다. */
  id: "bar" | "plaza";
  size: number;
  /** 격자 원점(월드 단위, x·z 공통). 없으면 GRID_ORIGIN(재즈 바·광장). 격자는 맵마다 다를 수 있다(20페이즈 D-04). */
  origin?: number;
  /** 이동 한계 ±(월드 단위). 없으면 WALK_HALF. */
  walkHalf?: number;
  mask: Uint8Array;
  spawns: readonly Spawn[];
  /**
   * 무대 자리(고정소수점). 있으면 이 한 점이 이동 마스크의 단일 예외다 — lineWalkable 참고. 없는 맵은 예외가 없다.
   * 무대 원기둥 안이라 마스크로는 막힌 칸이다(변론자가 서는 자리, 결정 0060-7).
   */
  stage?: { x: number; z: number };
  /** 무대와 가까워도 의자를 가로지르면 안 되는 맵은 출입 바닥점을 지정한다. */
  stageDoors?: readonly { x: number; z: number }[];
  /** 바닥을 가로지르지 않고 의자로만 드나드는 고정소수점 경로의 끝점. */
  seats?: readonly { x: number; z: number; door: { x: number; z: number } }[];
}

/** 변론자가 서는 무대 위 자리(고정소수점). 블록아웃 design/v2.0/screens/bar.js 의 ctx.center 와 같은 점이다(높이 0.29 는 화면 규칙, A4). */
export const STAGE_SPOT = { x: 0, z: 0 } as const;
/** 무대 자리에 닿는 선분의 최대 길이(고정소수점 3.0). 무대 둘레 한 걸음이고, 이보다 먼 점과는 이어지지 않는다. */
export const STAGE_REACH_FX = 300;

/**
 * 캐릭터 머리 꼭대기에서 카메라 쪽으로 가는 평행 광선 방향 = 카메라 위치 − 주시점.
 * 위치 오프셋은 yaw π/4 · 거리 17(수평 성분 17·sin/cos π/4 = 12.0208153) · 높이 12.5 이고 주시 높이가 0.6 이라 y 는 12.5 − 0.6 = 11.9 다.
 */
export const TO_CAMERA: { x: number; y: number; z: number } = { x: 12.0208153, y: 11.9, z: 12.0208153 };

/**
 * 장애물 원문. floor 는 바닥을 막는지(false 면 가려짐 검사에만 쓴다). 길이 단위는 월드 단위.
 */
export type Obstacle = (
  | { kind: "circle"; x: number; z: number; r: number; y0: number; y1: number; floor: boolean }
  | { kind: "rect"; x: number; z: number; w: number; d: number; rot: number; y0: number; y1: number; floor: boolean }
);

/** 작은 재즈 바의 조형과 이동 마스크가 공유하는 월드 좌표. */
export const BAR_ROOM_HALF = 4.7;
export const BAR_STAGE_RADIUS = 0.66;
export const BAR_STAGE_HEIGHT = 0.1175;
export const BAR_SEAT_RADIUS = 0.36;
export const BAR_SEAT_HEIGHT = 0.19;
export const BAR_PIANO = { x: -1.85, z: -BAR_ROOM_HALF + 0.63, width: 1.62, depth: 0.66 } as const;
export const BAR_COUNTER = { x: BAR_ROOM_HALF - 0.35, z: -1.24, width: 0.55, depth: 2.05 } as const;

/** 승인된 앞뒤 엇갈린 8자리. 4명은 앞·뒤 각 두 자리(좌석 0~3)를 쓴다. */
export const BAR_SEATS_FX = [
  [-136, 130], [-149, -183], [-13, -236], [194, 31],
  [-196, -54], [118, -161], [1, 220], [135, 173],
] as const;

/** 의자마다 이동 가능한 바닥과 연결하는 인접 칸 중심. 일반 경로는 의자 칸을 통과하지 않는다. */
const BAR_SEAT_DOORS_FX = [
  [-225, 125], [-225, -175], [-75, -275], [275, 25],
  [-225, -125], [75, -225], [75, 225], [225, 225],
] as const;

/** 배포 마스크는 28×28의 공통 격자 원점을 쓴다. 좁은 통로 옆 피아노·바·중앙 스탠드·의자는 막는다. */
export const BAR_MASK: readonly string[] = [
  "############################",
  "############################",
  "############################",
  "############################",
  "############################",
  "#####...#####..........#####",
  "#####...#####..........#####",
  "#####...#####..........#####",
  "#####........##......#######",
  "#####.....#####.#....#######",
  "#####.....##.#.###...#######",
  "#####.....##...###...#######",
  "#####....##..##......#######",
  "#####....##.####.##..#######",
  "#####.......#######..#######",
  "#####.....#########....#####",
  "#####.....########.....#####",
  "#####.....##.#####.....#####",
  "#####........##.##.....#####",
  "#####........##........#####",
  "#####..................#####",
  "#####..................#####",
  "#####..................#####",
  "############################",
  "############################",
  "############################",
  "############################",
  "############################",
];

export const BAR_SPAWNS: readonly Spawn[] = [
  { x: 1.0, z: 2.95, yaw: 0.34 },
  { x: -2.85, z: -0.65, yaw: 0.48 },
  { x: 0.75, z: -2.95, yaw: 0.12 },
  { x: 2.85, z: 1.25, yaw: -0.36 },
  { x: -2.85, z: 1.85, yaw: 0.86 },
  { x: 2.85, z: -1.75, yaw: -0.24 },
  { x: -1.25, z: 2.95, yaw: 0.72 },
  { x: 2.55, z: 2.65, yaw: -0.08 },
];

export const BAR_MAP: MapDef = {
  id: "bar",
  size: GRID_SIZE,
  walkHalf: BAR_ROOM_HALF - CHAR_RADIUS,
  mask: parseMask(BAR_MASK),
  spawns: BAR_SPAWNS,
  stage: STAGE_SPOT,
  stageDoors: [{ x: -125, z: 25 }, { x: 125, z: -25 }, { x: -25, z: -125 }, { x: -75, z: 175 }],
  seats: BAR_SEATS_FX.map(([x, z], i) => {
    const [dx, dz] = BAR_SEAT_DOORS_FX[i]!;
    return { x, z, door: { x: dx, z: dz } };
  }),
};

/** 칸 한 변(고정소수점) = CELL × UNIT */
const CELL_FX = 50;

/** 맵의 격자 원점(고정소수점) = origin × UNIT. origin 이 없으면 재즈 바 값 −700. */
function originFx(map: Pick<MapDef, "origin"> | undefined): number {
  return Math.round((map?.origin ?? GRID_ORIGIN) * UNIT);
}

/** 맵의 이동 한계(고정소수점) = walkHalf × UNIT. walkHalf 가 없으면 재즈 바 값 580. */
function limitFx(map: Pick<MapDef, "walkHalf">): number {
  return Math.round((map.walkHalf ?? WALK_HALF) * UNIT);
}

interface Pt {
  x: number;
  z: number;
}

interface CellRC {
  c: number;
  r: number;
}

/**
 * ASCII 행 배열('.' 걷기·'#' 막힘)을 행 우선 Uint8Array(1 = 걷기)로 바꾼다.
 * 줄 길이가 다르거나, '.'·'#' 밖의 글자가 있거나, 정사각이 아니면 던진다.
 */
export function parseMask(rows: readonly string[]): Uint8Array {
  const size = rows.length;
  const out = new Uint8Array(size * size);
  for (let r = 0; r < size; r++) {
    const row = rows[r]!;
    if (row.length !== size) throw new Error(`parseMask: row ${r} has length ${row.length}, expected ${size}`);
    for (let c = 0; c < size; c++) {
      const ch = row[c];
      if (ch === ".") out[r * size + c] = 1;
      else if (ch !== "#") throw new Error(`parseMask: unexpected character at row ${r} col ${c}`);
    }
  }
  return out;
}

/** 칸 번호(c 열, r 행)가 범위 안이고 걸을 수 있는지. 입력은 칸 번호. */
export function isWalkable(map: MapDef, c: number, r: number): boolean {
  if (!Number.isInteger(c) || !Number.isInteger(r)) return false;
  if (c < 0 || r < 0 || c >= map.size || r >= map.size) return false;
  return map.mask[r * map.size + c] === 1;
}

/** 고정소수점 좌표(1/100 단위)가 속한 칸. 범위 밖도 계산한다(걸을 수 있는지는 isWalkable 로). map 을 주면 그 맵의 원점, 없으면 재즈 바 원점이다. */
export function cellOfFx(xFx: number, zFx: number, map?: Pick<MapDef, "origin">): { c: number; r: number } {
  const o = originFx(map);
  return { c: Math.floor((xFx - o) / CELL_FX), r: Math.floor((zFx - o) / CELL_FX) };
}

/** 칸 번호의 중심을 고정소수점 정수 좌표로. map 을 주면 그 맵의 원점, 없으면 재즈 바 원점이다. */
export function cellCenterFx(c: number, r: number, map?: Pick<MapDef, "origin">): { x: number; z: number } {
  const o = originFx(map);
  return { x: o + c * CELL_FX + CELL_FX / 2, z: o + r * CELL_FX + CELL_FX / 2 };
}

/** 걸을 수 있는 모든 칸 번호를 행 우선으로. */
export function walkableCells(map: MapDef): { c: number; r: number }[] {
  const out: CellRC[] = [];
  for (let r = 0; r < map.size; r++) {
    for (let c = 0; c < map.size; c++) {
      if (map.mask[r * map.size + c] === 1) out.push({ c, r });
    }
  }
  return out;
}

function clampFx(v: number, limit: number): number {
  return v < -limit ? -limit : v > limit ? limit : v;
}

/**
 * 고정소수점 점을 걸을 수 있는 점으로 보정한다. 먼저 맵의 이동 한계로 자르고, 점이 닿는 칸이 모두 걸을 수 있으면
 * 그 좌표 그대로, 아니면 가장 가까운 걸을 수 있는 칸 중심(정수 제곱거리 → 행 → 열 순 결정적 동률 처리)으로 옮긴다.
 * snapped 는 결과가 입력과 다르면 true 다. 걸을 수 있는 칸이 하나도 없으면 자른 좌표를 돌려준다.
 */
export function snapToWalkable(map: MapDef, p: { x: number; z: number }): { x: number; z: number; snapped: boolean } {
  const limit = limitFx(map);
  const x = clampFx(p.x, limit);
  const z = clampFx(p.z, limit);
  if (lineWalkable(map, { x, z }, { x, z })) return { x, z, snapped: x !== p.x || z !== p.z };
  let bestD = Infinity;
  let bx = x;
  let bz = z;
  let found = false;
  for (let r = 0; r < map.size; r++) {
    for (let c = 0; c < map.size; c++) {
      if (map.mask[r * map.size + c] !== 1) continue;
      const m = cellCenterFx(c, r, map);
      const d = (m.x - x) * (m.x - x) + (m.z - z) * (m.z - z);
      if (d < bestD) {
        bestD = d;
        bx = m.x;
        bz = m.z;
        found = true;
      }
    }
  }
  return { x: bx, z: bz, snapped: found };
}

/** 이진 힙 원소: 우선순위 (f, h, 칸 번호) 오름차순. */
interface HeapNode {
  f: number;
  h: number;
  id: number;
}

function heapLess(a: HeapNode, b: HeapNode): boolean {
  if (a.f !== b.f) return a.f < b.f;
  if (a.h !== b.h) return a.h < b.h;
  return a.id < b.id;
}

function heapPush(heap: HeapNode[], node: HeapNode): void {
  let i = heap.length;
  heap.push(node);
  while (i > 0) {
    const parent = (i - 1) >> 1;
    if (!heapLess(heap[i]!, heap[parent]!)) break;
    const tmp = heap[i]!;
    heap[i] = heap[parent]!;
    heap[parent] = tmp;
    i = parent;
  }
}

function heapPop(heap: HeapNode[]): HeapNode {
  const top = heap[0]!;
  const last = heap.pop()!;
  if (heap.length > 0) {
    heap[0] = last;
    let i = 0;
    for (;;) {
      const l = 2 * i + 1;
      const r = l + 1;
      let m = i;
      if (l < heap.length && heapLess(heap[l]!, heap[m]!)) m = l;
      if (r < heap.length && heapLess(heap[r]!, heap[m]!)) m = r;
      if (m === i) break;
      const tmp = heap[i]!;
      heap[i] = heap[m]!;
      heap[m] = tmp;
      i = m;
    }
  }
  return top;
}

/** 8방향 이웃 순서(고정): 위·왼·오른·아래 다음 대각 넷. 비용은 직선 10·대각 14. */
const NEIGHBORS: readonly [number, number][] = [
  [0, -1],
  [-1, 0],
  [1, 0],
  [0, 1],
  [-1, -1],
  [1, -1],
  [-1, 1],
  [1, 1],
];

/**
 * 칸 번호 사이의 8방향 A* 경로(시작·끝 칸 포함). 대각 이동은 두 옆 칸이 모두 걸을 수 있을 때만 한다.
 * 출발·도착이 막혔거나 이어지지 않으면 null. 우선순위 (f, h, 칸 번호) 라 같은 입력은 항상 같은 경로다.
 */
export function findPath(map: MapDef, from: { c: number; r: number }, to: { c: number; r: number }): { c: number; r: number }[] | null {
  const n = map.size;
  if (!isWalkable(map, from.c, from.r) || !isWalkable(map, to.c, to.r)) return null;
  const start = from.r * n + from.c;
  const goal = to.r * n + to.c;
  if (start === goal) return [{ c: from.c, r: from.r }];

  const octile = (c: number, r: number): number => {
    const dc = Math.abs(c - to.c);
    const dr = Math.abs(r - to.r);
    return 10 * (dc + dr) - 6 * (dc < dr ? dc : dr);
  };

  const g = new Int32Array(n * n).fill(0x7fffffff);
  const parent = new Int32Array(n * n).fill(-1);
  const closed = new Uint8Array(n * n);
  const heap: HeapNode[] = [];
  g[start] = 0;
  heapPush(heap, { f: octile(from.c, from.r), h: octile(from.c, from.r), id: start });

  while (heap.length > 0) {
    const cur = heapPop(heap);
    if (closed[cur.id] === 1) continue;
    closed[cur.id] = 1;
    if (cur.id === goal) break;
    const cc = cur.id % n;
    const cr = (cur.id - cc) / n;
    for (const [dc, dr] of NEIGHBORS) {
      const nc = cc + dc;
      const nr = cr + dr;
      if (!isWalkable(map, nc, nr)) continue;
      const diagonal = dc !== 0 && dr !== 0;
      if (diagonal && (!isWalkable(map, cc + dc, cr) || !isWalkable(map, cc, cr + dr))) continue;
      const nid = nr * n + nc;
      if (closed[nid] === 1) continue;
      const ng = g[cur.id]! + (diagonal ? 14 : 10);
      if (ng < g[nid]!) {
        g[nid] = ng;
        parent[nid] = cur.id;
        const h = octile(nc, nr);
        heapPush(heap, { f: ng + h, h, id: nid });
      }
    }
  }

  if (closed[goal] !== 1) return null;
  const rev: CellRC[] = [];
  for (let id = goal; id !== -1; id = parent[id]!) {
    const c = id % n;
    rev.push({ c, r: (id - c) / n });
  }
  return rev.reverse();
}

/**
 * 고정소수점 두 점 사이 선분이 닿는 모든 칸(슈퍼커버: 선분이 칸 경계·꼭짓점에 닿기만 해도 그 칸 포함)이
 * 걸을 수 있는지. 격자 밖에 닿으면 false. 같은 두 점이면 그 점이 닿는 칸 전부를 본다.
 *
 * 무대의 정확한 끝점은 인접 바닥과 이어진다(결정 0060-7). 작은 재즈 바는 무대와 의자가 가까워 출입 바닥점을 지정한다.
 * 해당 무대·의자를 가로지르는 일반 선분은 계속 막힌다. snapToWalkable·저장 복원·routeFx가 이 판정을 공유한다.
 */
export function lineWalkable(map: MapDef, a: { x: number; z: number }, b: { x: number; z: number }): boolean {
  const aSeat = seatAt(map, a);
  const bSeat = seatAt(map, b);
  if (aSeat !== undefined || bSeat !== undefined) {
    if (aSeat !== undefined && bSeat !== undefined) return aSeat === bSeat;
    const door = (aSeat ?? bSeat)!.door;
    const other = aSeat === undefined ? a : b;
    return other.x === door.x && other.z === door.z;
  }
  const stage = map.stage;
  if (stage !== undefined) {
    const aStage = a.x === stage.x && a.z === stage.z;
    const bStage = b.x === stage.x && b.z === stage.z;
    if (aStage && bStage) return true;
    if (aStage || bStage) {
      const q = aStage ? b : a;
      if (map.stageDoors !== undefined) return map.stageDoors.some((door) => door.x === q.x && door.z === q.z);
      const dx = q.x - stage.x;
      const dz = q.z - stage.z;
      if (dx * dx + dz * dz <= STAGE_REACH_FX * STAGE_REACH_FX && lineWalkableBase(map, q, q)) return true;
    }
  }
  return lineWalkableBase(map, a, b);
}

/** 예외 없는 슈퍼커버 판정(본체). */
function lineWalkableBase(map: MapDef, a: { x: number; z: number }, b: { x: number; z: number }): boolean {
  const span = map.size * CELL_FX;
  const o = originFx(map);
  let ax = a.x - o;
  let az = a.z - o;
  let bx = b.x - o;
  let bz = b.z - o;
  if (ax < 0 || az < 0 || bx < 0 || bz < 0 || ax > span || az > span || bx > span || bz > span) return false;
  if (ax > bx) {
    [ax, bx] = [bx, ax];
    [az, bz] = [bz, az];
  }
  const dx = bx - ax;
  const dz = bz - az;
  const cFirst = Math.ceil(ax / CELL_FX) - 1;
  const cLast = Math.floor(bx / CELL_FX);
  if (dx === 0) {
    const rFirst = Math.ceil(Math.min(az, bz) / CELL_FX) - 1;
    const rLast = Math.floor(Math.max(az, bz) / CELL_FX);
    for (let c = cFirst; c <= cLast; c++) {
      for (let r = rFirst; r <= rLast; r++) if (!isWalkable(map, c, r)) return false;
    }
    return true;
  }
  // z(x) = (az·dx + dz·(x − ax)) / dx — 분자만 정수로 다룬다(분모 dx > 0).
  for (let c = cFirst; c <= cLast; c++) {
    const xl = Math.max(ax, c * CELL_FX);
    const xr = Math.min(bx, c * CELL_FX + CELL_FX);
    const n1 = az * dx + dz * (xl - ax);
    const n2 = az * dx + dz * (xr - ax);
    const rFirst = Math.ceil(Math.min(n1, n2) / (CELL_FX * dx)) - 1;
    const rLast = Math.floor(Math.max(n1, n2) / (CELL_FX * dx));
    for (let r = rFirst; r <= rLast; r++) if (!isWalkable(map, c, r)) return false;
  }
  return true;
}

/**
 * 고정소수점 점 목록을 그리디 시선 스무딩한다: 현재 점에서 lineWalkable 로 닿는 가장 먼 점으로 건너뛴다.
 * 이웃한 두 점은 이미 이어져 있다고 본다(findPath 의 칸 중심 목록).
 */
export function smoothPath(map: MapDef, pts: { x: number; z: number }[]): { x: number; z: number }[] {
  if (pts.length <= 2) return pts.map((p) => ({ x: p.x, z: p.z }));
  const out: Pt[] = [pts[0]!];
  let i = 0;
  const last = pts.length - 1;
  while (i < last) {
    let j = last;
    while (j > i + 1 && !lineWalkable(map, pts[i]!, pts[j]!)) j--;
    out.push(pts[j]!);
    i = j;
  }
  return out.map((p) => ({ x: p.x, z: p.z }));
}

/**
 * 꼭짓점 당기기: 안쪽 꼭짓점을 이웃 둘을 잇는 선분 쪽으로 8분의 k 만큼(k = 8 → 1) 옮겨 보고, 양쪽 선분이 모두 걸을 수 있는
 * 가장 큰 k 를 쓴다. 칸 중심 경로가 남기는 우회를 줄인다. 4번 돌고 smoothPath 로 다시 건너뛸 수 있는 점을 지운다.
 */
function relaxPath(map: MapDef, pts: { x: number; z: number }[]): { x: number; z: number }[] {
  const out: Pt[] = pts.map((p) => ({ x: p.x, z: p.z }));
  for (let pass = 0; pass < 4; pass++) {
    let moved = false;
    for (let i = 1; i < out.length - 1; i++) {
      const p = out[i - 1]!;
      const v = out[i]!;
      const n = out[i + 1]!;
      const ex = n.x - p.x;
      const ez = n.z - p.z;
      const len2 = ex * ex + ez * ez;
      if (len2 === 0) continue;
      let t = ((v.x - p.x) * ex + (v.z - p.z) * ez) / len2;
      t = t < 0 ? 0 : t > 1 ? 1 : t;
      const qx = p.x + t * ex;
      const qz = p.z + t * ez;
      for (let k = 8; k >= 1; k--) {
        const cand = { x: Math.round(v.x + ((qx - v.x) * k) / 8), z: Math.round(v.z + ((qz - v.z) * k) / 8) };
        if (cand.x === v.x && cand.z === v.z) break;
        if (lineWalkable(map, p, cand) && lineWalkable(map, cand, n)) {
          out[i] = cand;
          moved = true;
          break;
        }
      }
    }
    if (!moved) break;
  }
  return smoothPath(map, out);
}

/**
 * 출발·도착(고정소수점)을 걸을 수 있는 점으로 보정하고 꼭짓점 배열 [x0,z0,x1,z1,…] 을 돌려준다(전부 정수).
 * 같은 칸이거나 곧바로 보이면 두 점, 아니면 A* 칸 중심 경로를 시선 스무딩하고 꼭짓점을 당긴 점들. 이어지지 않으면 출발점 하나.
 */
export function routeFx(map: MapDef, from: { x: number; z: number }, to: { x: number; z: number }): number[] {
  if (map.stage === undefined && map.seats === undefined) return routeBase(map, from, to);
  const s = snapToWalkable(map, from);
  const e = snapToWalkable(map, to);
  const aSeat = seatAt(map, s);
  const bSeat = seatAt(map, e);
  if (aSeat !== undefined || bSeat !== undefined) {
    if (aSeat !== undefined && aSeat === bSeat) return [s.x, s.z, e.x, e.z];
    const start = aSeat?.door ?? s;
    const end = bSeat?.door ?? e;
    const path = routeStageOrFloor(map, start, end);
    if (path[path.length - 2] !== end.x || path[path.length - 1] !== end.z) return [s.x, s.z];
    return [...(aSeat ? [s.x, s.z] : []), ...path, ...(bSeat ? [e.x, e.z] : [])];
  }
  return routeStageOrFloor(map, s, e);
}

function seatAt(map: MapDef, p: Pt): NonNullable<MapDef["seats"]>[number] | undefined {
  return map.seats?.find((seat) => seat.x === p.x && seat.z === p.z);
}

function routeStageOrFloor(map: MapDef, s: Pt, e: Pt): number[] {
  if (map.stage !== undefined) {
    if (isStageSpot(map, s) || isStageSpot(map, e)) return routeViaStage(map, s, e);
  }
  return routeBase(map, s, e);
}

function isStageSpot(map: MapDef, p: { x: number; z: number }): boolean {
  return map.stage !== undefined && p.x === map.stage.x && p.z === map.stage.z;
}

/**
 * 무대 자리를 걸을 수 있는 칸 중심 하나(무대에서 STAGE_REACH_FX 안)와 이은 선분으로 드나든다: 무대 ↔ other 의 직선 합이 가장 짧은 칸을 고른다
 * (정수 제곱거리 → 행 → 열 순 결정적 동률 처리). 없으면 null. 일반 A* 길은 칸 중심만 지나므로 무대 자리를 지나지 않는다.
 */
function pickStageDoor(map: MapDef, stage: { x: number; z: number }, other: { x: number; z: number }): { x: number; z: number } | null {
  let best: { x: number; z: number } | null = null;
  let bestCost = Infinity;
  if (map.stageDoors !== undefined) {
    for (const door of map.stageDoors) {
      const d = (door.x - other.x) ** 2 + (door.z - other.z) ** 2;
      if (d < bestCost) {
        bestCost = d;
        best = door;
      }
    }
    return best;
  }
  for (let r = 0; r < map.size; r++) {
    for (let c = 0; c < map.size; c++) {
      if (map.mask[r * map.size + c] !== 1) continue;
      const m = cellCenterFx(c, r, map);
      const d1 = (m.x - stage.x) * (m.x - stage.x) + (m.z - stage.z) * (m.z - stage.z);
      if (d1 > STAGE_REACH_FX * STAGE_REACH_FX) continue;
      const cost = Math.sqrt(d1) + Math.sqrt((m.x - other.x) * (m.x - other.x) + (m.z - other.z) * (m.z - other.z));
      if (cost < bestCost) {
        bestCost = cost;
        best = m;
      }
    }
  }
  return best;
}

/** 출발이나 도착이 무대 자리일 때의 길. 닿는 거리 안이면 곧바로 두 점, 아니면 가까운 문(칸 중심)까지 일반 길로 간 뒤 무대와 이어진다. */
function routeViaStage(map: MapDef, s: { x: number; z: number }, e: { x: number; z: number }): number[] {
  if (lineWalkable(map, s, e)) return [s.x, s.z, e.x, e.z];
  const fromStage = isStageSpot(map, s);
  const door = pickStageDoor(map, fromStage ? s : e, fromStage ? e : s);
  if (door === null) return [s.x, s.z];
  if (fromStage) {
    const rest = routeBase(map, door, e);
    if (rest[rest.length - 2] !== e.x || rest[rest.length - 1] !== e.z) return [s.x, s.z]; // 문에서 목적지로 이어지지 않으면 출발점 하나
    const same = rest.length === 4 && rest[0] === rest[2] && rest[1] === rest[3];
    return [s.x, s.z, ...(same ? rest.slice(2) : rest)];
  }
  const lead = routeBase(map, s, door);
  if (lead[lead.length - 2] !== door.x || lead[lead.length - 1] !== door.z) return [s.x, s.z];
  const same = lead.length === 4 && lead[0] === lead[2] && lead[1] === lead[3];
  return [...(same ? lead.slice(2) : lead), e.x, e.z];
}

/** 무대 예외 없는 보통 길(본체). */
function routeBase(map: MapDef, from: { x: number; z: number }, to: { x: number; z: number }): number[] {
  const s = snapToWalkable(map, from);
  const e = snapToWalkable(map, to);
  const sc = cellOfFx(s.x, s.z, map);
  const ec = cellOfFx(e.x, e.z, map);
  if ((sc.c === ec.c && sc.r === ec.r) || lineWalkable(map, s, e)) return [s.x, s.z, e.x, e.z];
  const cells = findPath(map, sc, ec);
  if (cells === null) return [s.x, s.z];
  const pts: Pt[] = cells.map((cell) => cellCenterFx(cell.c, cell.r, map));
  pts[0] = { x: s.x, z: s.z };
  pts[pts.length - 1] = { x: e.x, z: e.z };
  const flat: number[] = [];
  for (const p of relaxPath(map, smoothPath(map, pts))) flat.push(p.x, p.z);
  return flat;
}
