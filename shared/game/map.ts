// 재즈 바 이동 격자와 경로(결정 0044-17: 클라이언트는 목적지만, 서버가 경로를 정한다).
// 현재 시각·난수를 읽지 않고, 삼각함수·hypot 없이 정수·제곱근·사칙연산만 쓴다(RESEARCH R4) — 서버와 클라이언트가 같은 값을 얻게.

/** 1 월드 단위 = 100 (고정소수점, 와이어·저장 공통) */
export const UNIT = 100;
/** 격자 한 칸(월드 단위) */
export const CELL = 0.5;
/** 격자 한 변 칸 수 */
export const GRID_SIZE = 28;
/** 격자 원점(월드 단위, x·z 공통) */
export const GRID_ORIGIN = -7;
/** 이동 한계 ±(월드 단위) */
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
  id: "bar";
  size: number;
  mask: Uint8Array;
  spawns: readonly Spawn[];
}

/** 캐릭터 머리 꼭대기에서 카메라 쪽으로 가는 평행 광선 방향: yaw π/4, 거리 17, 높이 12.5 (정사영 카메라) */
export const TO_CAMERA: { x: number; y: number; z: number } = { x: 12.0208153, y: 12.5, z: 12.0208153 };

/** 장애물 원문. floor 는 바닥을 막는지(false 면 가려짐 검사에만 쓴다). 길이 단위는 월드 단위. */
export type Obstacle =
  | { kind: "circle"; x: number; z: number; r: number; y0: number; y1: number; floor: boolean }
  | { kind: "rect"; x: number; z: number; w: number; d: number; rot: number; y0: number; y1: number; floor: boolean };

// RED 단계 임시 자리표시: 아래 BAR_* 는 아직 비어 있다.
export const BAR_OBSTACLES: readonly Obstacle[] = [];
export const BAR_MASK: readonly string[] = [];
export const BAR_SPAWNS: readonly Spawn[] = [];
export const BAR_MAP: MapDef = { id: "bar", size: GRID_SIZE, mask: new Uint8Array(0), spawns: BAR_SPAWNS };

/** 칸 한 변(고정소수점) = CELL × UNIT */
const CELL_FX = 50;
/** 격자 원점(고정소수점) = GRID_ORIGIN × UNIT */
const ORIGIN_FX = -700;
/** 이동 한계(고정소수점) = WALK_HALF × UNIT */
const LIMIT_FX = 580;

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

/** 고정소수점 좌표(1/100 단위)가 속한 칸. 범위 밖도 계산한다(걸을 수 있는지는 isWalkable 로). */
export function cellOfFx(xFx: number, zFx: number): { c: number; r: number } {
  return { c: Math.floor((xFx - ORIGIN_FX) / CELL_FX), r: Math.floor((zFx - ORIGIN_FX) / CELL_FX) };
}

/** 칸 번호의 중심을 고정소수점 정수 좌표로. */
export function cellCenterFx(c: number, r: number): { x: number; z: number } {
  return { x: ORIGIN_FX + c * CELL_FX + CELL_FX / 2, z: ORIGIN_FX + r * CELL_FX + CELL_FX / 2 };
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

function clampFx(v: number): number {
  return v < -LIMIT_FX ? -LIMIT_FX : v > LIMIT_FX ? LIMIT_FX : v;
}

/**
 * 고정소수점 점을 걸을 수 있는 점으로 보정한다. 먼저 ±580 으로 자르고, 점이 닿는 칸이 모두 걸을 수 있으면
 * 그 좌표 그대로, 아니면 가장 가까운 걸을 수 있는 칸 중심(정수 제곱거리 → 행 → 열 순 결정적 동률 처리)으로 옮긴다.
 * snapped 는 결과가 입력과 다르면 true 다. 걸을 수 있는 칸이 하나도 없으면 자른 좌표를 돌려준다.
 */
export function snapToWalkable(map: MapDef, p: { x: number; z: number }): { x: number; z: number; snapped: boolean } {
  const x = clampFx(p.x);
  const z = clampFx(p.z);
  if (lineWalkable(map, { x, z }, { x, z })) return { x, z, snapped: x !== p.x || z !== p.z };
  let bestD = Infinity;
  let bx = x;
  let bz = z;
  let found = false;
  for (let r = 0; r < map.size; r++) {
    for (let c = 0; c < map.size; c++) {
      if (map.mask[r * map.size + c] !== 1) continue;
      const m = cellCenterFx(c, r);
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
 */
export function lineWalkable(map: MapDef, a: { x: number; z: number }, b: { x: number; z: number }): boolean {
  const span = map.size * CELL_FX;
  let ax = a.x - ORIGIN_FX;
  let az = a.z - ORIGIN_FX;
  let bx = b.x - ORIGIN_FX;
  let bz = b.z - ORIGIN_FX;
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
 * 출발·도착(고정소수점)을 걸을 수 있는 점으로 보정하고 꼭짓점 배열 [x0,z0,x1,z1,…] 을 돌려준다(전부 정수).
 * 같은 칸이거나 곧바로 보이면 두 점, 아니면 A* 칸 중심 경로를 시선 스무딩한 점들. 이어지지 않으면 출발점 하나.
 */
export function routeFx(map: MapDef, from: { x: number; z: number }, to: { x: number; z: number }): number[] {
  const s = snapToWalkable(map, from);
  const e = snapToWalkable(map, to);
  const sc = cellOfFx(s.x, s.z);
  const ec = cellOfFx(e.x, e.z);
  if ((sc.c === ec.c && sc.r === ec.r) || lineWalkable(map, s, e)) return [s.x, s.z, e.x, e.z];
  const cells = findPath(map, sc, ec);
  if (cells === null) return [s.x, s.z];
  const pts: Pt[] = cells.map((cell) => cellCenterFx(cell.c, cell.r));
  pts[0] = { x: s.x, z: s.z };
  pts[pts.length - 1] = { x: e.x, z: e.z };
  const flat: number[] = [];
  for (const p of smoothPath(map, pts)) flat.push(p.x, p.z);
  return flat;
}
