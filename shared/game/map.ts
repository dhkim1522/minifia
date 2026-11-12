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

/** 심부름 장소 후보 한 곳(월드 단위, 결정 0074). 이 파일은 import 없는 순수 모듈이라 id 를 string 으로 두고 닫힌 집합(PLACE_IDS)은 시험이 맞춘다. */
export interface PlaceDef {
  id: string;
  x: number;
  z: number;
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
  /** 심부름 장소 후보(결정 0074, 맵당 8곳). 없는 맵(시험용)은 심부름 목록이 빈 배열이다. */
  places?: readonly PlaceDef[];
  /** 실내 방(20페이즈 D-06·D-13). 없는 맵(재즈 바·광장)은 구역이 광장 하나다. */
  rooms?: readonly RoomDef[];
}

/**
 * 실내 방 하나(고정소수점). id 는 protocol.ts 의 RoomId 와 같은 합집합이다 — 이 파일은 import 없는 순수 모듈이라 되풀이해 적고,
 * 어긋나면 mapTown.ts·zones.ts 의 Record<RoomId, …> 가 컴파일에서 잡는다.
 */
export interface RoomDef {
  id: "post" | "pub" | "clinic" | "police";
  /** 벽 안쪽 사각형. 이 사각형의 엄격한 안쪽이 그 방 구역이고 경계(문턱 포함)는 바깥이다(zones.ts zoneOf). */
  inner: { x0: number; z0: number; x1: number; z1: number };
  /** 문 중심 = 문 벽 두께의 가운데. */
  door: { x: number; z: number };
  /** 문 앞 목적지: 문 중심에서 바깥으로 1.0 에 가장 가까운 걷는 칸 중심(UI-SPEC P20-10). */
  front: { x: number; z: number };
  /** 방 안 자리: 안쪽 사각형 가운데에서 가장 가까운 걷는 칸 중심. */
  inside: { x: number; z: number };
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
 * room 은 그 장애물이 속한 방, cut 은 방 안에 들어가면 걷히는 부분(지붕·앞벽·문 위 이마)이다(20페이즈 D-10) —
 * 마스크를 만들 때 그 방 안 칸의 머리 가림 시험에서만 뺀다. 재즈 바·광장 원문에는 두 키가 없다.
 */
export type Obstacle = (
  | { kind: "circle"; x: number; z: number; r: number; y0: number; y1: number; floor: boolean }
  | { kind: "rect"; x: number; z: number; w: number; d: number; rot: number; y0: number; y1: number; floor: boolean }
) & { room?: RoomDef["id"]; cut?: true };

/**
 * 재즈 바 장애물 원문(design/v2.0/blockout/bar.js). 길이는 월드 단위, rot 는 three 의 rotation.y(라디안).
 * 순서: 바 카운터 · 스툴 4 · 피아노 · 무대 · 탁자 5 · 의자 10 · 펜던트 갓 2.
 * 의자 중심은 탁자 중심 (x, z) 에서 단위벡터 u 에 수직인 ±(−z, x)/|(x, z)| × 0.8 을 소수 넷째 자리로 적었다(bar.js 의 table()).
 * 의자 발자국 0.62×0.6(회전)은 반지름 0.43 원으로 근사한다 — 원이 사각형을 덮으니 막힘이 넓어지는 쪽이다(가정 A1).
 */
export const BAR_OBSTACLES: readonly Obstacle[] = [
  // 바 카운터 box(1.0, 1.05, 6.2) @ (−5.7, −2.2), 윗판 높이 1.09 + 0.04
  { kind: "rect", x: -5.7, z: -2.2, w: 1.0, d: 6.2, rot: 0, y0: 0, y1: 1.13, floor: true },
  // 스툴 cyl(0.24 …) @ x −4.8, z −4.4 + i·1.4, 높이 약 0.76
  { kind: "circle", x: -4.8, z: -4.4, r: 0.24, y0: 0, y1: 0.76, floor: true },
  { kind: "circle", x: -4.8, z: -3.0, r: 0.24, y0: 0, y1: 0.76, floor: true },
  { kind: "circle", x: -4.8, z: -1.6, r: 0.24, y0: 0, y1: 0.76, floor: true },
  { kind: "circle", x: -4.8, z: -0.2, r: 0.24, y0: 0, y1: 0.76, floor: true },
  // 피아노 그룹 @ (−4.6, −5.0) rotation.y 0.6, 몸통 1.6×1.2, 뚜껑을 올려 높이 약 1.55
  { kind: "rect", x: -4.6, z: -5.0, w: 1.6, d: 1.2, rot: 0.6, y0: 0, y1: 1.55, floor: true },
  // 무대 원기둥 반지름 1.18 · 높이 0.28 @ (0, 0)
  { kind: "circle", x: 0, z: 0, r: 1.18, y0: 0, y1: 0.28, floor: true },
  // 탁자 5개(반지름 0.5, 높이 약 0.79)
  { kind: "circle", x: 4.6, z: 1.2, r: 0.5, y0: 0, y1: 0.79, floor: true },
  { kind: "circle", x: 1.2, z: 4.6, r: 0.5, y0: 0, y1: 0.79, floor: true },
  { kind: "circle", x: 4.4, z: -3.2, r: 0.5, y0: 0, y1: 0.79, floor: true },
  { kind: "circle", x: -3.2, z: 4.4, r: 0.5, y0: 0, y1: 0.79, floor: true },
  { kind: "circle", x: -2.4, z: -4.6, r: 0.5, y0: 0, y1: 0.79, floor: true },
  // 의자 10개(탁자마다 둘, 반지름 0.43 · 높이 0.99): 탁자 (4.6, 1.2)
  { kind: "circle", x: 4.3981, z: 1.9741, r: 0.43, y0: 0, y1: 0.99, floor: true },
  { kind: "circle", x: 4.8019, z: 0.4259, r: 0.43, y0: 0, y1: 0.99, floor: true },
  // 탁자 (1.2, 4.6)
  { kind: "circle", x: 0.4259, z: 4.8019, r: 0.43, y0: 0, y1: 0.99, floor: true },
  { kind: "circle", x: 1.9741, z: 4.3981, r: 0.43, y0: 0, y1: 0.99, floor: true },
  // 탁자 (4.4, −3.2)
  { kind: "circle", x: 4.8705, z: -2.553, r: 0.43, y0: 0, y1: 0.99, floor: true },
  { kind: "circle", x: 3.9295, z: -3.847, r: 0.43, y0: 0, y1: 0.99, floor: true },
  // 탁자 (−3.2, 4.4)
  { kind: "circle", x: -3.847, z: 3.9295, r: 0.43, y0: 0, y1: 0.99, floor: true },
  { kind: "circle", x: -2.553, z: 4.8705, r: 0.43, y0: 0, y1: 0.99, floor: true },
  // 탁자 (−2.4, −4.6)
  { kind: "circle", x: -1.6907, z: -4.9701, r: 0.43, y0: 0, y1: 0.99, floor: true },
  { kind: "circle", x: -3.1093, z: -4.2299, r: 0.43, y0: 0, y1: 0.99, floor: true },
  // 펜던트 갓 2개(가려짐 전용, 바닥은 막지 않음): 반지름 0.3, y 2.67~2.93
  { kind: "circle", x: -2.4, z: -4.6, r: 0.3, y0: 2.67, y1: 2.93, floor: false },
  { kind: "circle", x: 4.4, z: -3.2, r: 0.3, y0: 2.67, y1: 2.93, floor: false },
];

/**
 * 재즈 바 이동 마스크 28×28: '.' 걷기 · '#' 막힘. 줄 = z −6.75(뒷벽) → 6.75(앞), 글자 = x −6.75(왼 벽) → 6.75.
 * 칸 중심이 BAR_OBSTACLES 를 캐릭터 반지름 0.35 만큼 부풀린 곳, |x|·|z| > 5.8(이동 한계), 머리 꼭대기(y 2.0335)에서
 * 카메라 쪽 평행 광선이 가구(펜던트 갓 포함)에 막히는 자리, 입장 지점에서 닿지 않는 닫힌 구멍이면 '#'.
 * 바꾸려면 BAR_OBSTACLES 를 고치고 `MAP_PRINT=1 npx vitest run test/unit/map.test.ts -t 래스터화` 출력으로 다시 만든다 —
 * test/unit/map.test.ts 가 이 글자들과 래스터화가 같음을 지킨다.
 */
export const BAR_MASK: readonly string[] = [
  "############################",
  "############################",
  "########..................##",
  "############..............##",
  "############..............##",
  "###########.........###...##",
  "#####..##...........####..##",
  "#####................###..##",
  "#####................####.##",
  "####..................###.##",
  "######....................##",
  "#####.......####..........##",
  "#####......######.........##",
  "######.....######......#..##",
  "#####......######.....###.##",
  "####.......######.....###.##",
  "##..........####......###.##",
  "##...................###..##",
  "##...................###..##",
  "##........................##",
  "##....#...................##",
  "##...####........##.......##",
  "##...#####....#####.......##",
  "##....####...######.......##",
  "##......##....###.........##",
  "##........................##",
  "############################",
  "############################",
];

/** 입장 지점 8곳 = bar.js 의 ctx.talk 원문 좌표·yaw(yaw 가 없는 곳은 클라이언트가 카메라 쪽 π/4 로 둔다). */
export const BAR_SPAWNS: readonly Spawn[] = [
  { x: 3.6, z: 0.4, yaw: 0.896055 }, // atan2(1.0, 0.8)
  { x: 0.4, z: 3.6 },
  { x: 5.4, z: 2.2, yaw: -2.356194 }, // atan2(−1.0, −1.0)
  { x: -4.2, z: -1.2, yaw: -1.570796 }, // −π/2
  { x: 3.4, z: -2.6 },
  { x: -2.6, z: 3.4 },
  { x: -4.2, z: 0.2, yaw: -1.570796 }, // −π/2
  { x: 2.2, z: 5.4 },
];

/** 재즈 바 심부름 장소 후보 8곳(결정 0074) — 가구 곁 걷기 칸 중심. id 는 protocol.ts 의 PLACE_IDS 와 시험이 맞춘다. */
export const BAR_PLACES: readonly PlaceDef[] = [
  { id: "glass", x: -3.9, z: -2.2 },
  { id: "piano", x: -2.6, z: -5.6 },
  { id: "sax", x: -0.2, z: -5.2 },
  { id: "stool", x: -3.9, z: 0.2 },
  { id: "door", x: 5.2, z: 5.0 },
  { id: "poster", x: 2.6, z: -5.6 },
  { id: "record", x: 5.2, z: -0.6 },
  { id: "candle", x: -0.4, z: 2.6 },
];

/** 재즈 바 이동 맵(모듈 로드 때 마스크 문자열을 한 번 변환한다 — 결정적). */
export const BAR_MAP: MapDef = { id: "bar", size: GRID_SIZE, mask: parseMask(BAR_MASK), spawns: BAR_SPAWNS, stage: STAGE_SPOT, places: BAR_PLACES };

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
export function cellOfFx(xFx: number, zFx: number, _map?: Pick<MapDef, "origin">): { c: number; r: number } {
  return { c: Math.floor((xFx - ORIGIN_FX) / CELL_FX), r: Math.floor((zFx - ORIGIN_FX) / CELL_FX) };
}

/** 칸 번호의 중심을 고정소수점 정수 좌표로. */
export function cellCenterFx(c: number, r: number, _map?: Pick<MapDef, "origin">): { x: number; z: number } {
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
 *
 * 단일 예외(map.stage, 사용자 확정 2026-11-02, 결정 0060-7): 한 끝이 정확히 무대 자리이고 다른 끝이 걸을 수 있는 점이면서
 * STAGE_REACH_FX 안이면 true, 두 끝이 모두 무대 자리여도 true 다. 그 밖의 판정은 예외 없는 규칙 그대로다 —
 * 무대 근처 다른 점이나 무대를 가로지르는 선분은 계속 막혀 있다. snapToWalkable·저장 복원(parseStoredSegment)·routeFx 가 이 함수를 공유한다.
 */
export function lineWalkable(map: MapDef, a: { x: number; z: number }, b: { x: number; z: number }): boolean {
  const stage = map.stage;
  if (stage !== undefined) {
    const aStage = a.x === stage.x && a.z === stage.z;
    const bStage = b.x === stage.x && b.z === stage.z;
    if (aStage && bStage) return true;
    if (aStage || bStage) {
      const q = aStage ? b : a;
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
  if (map.stage !== undefined) {
    const s = snapToWalkable(map, from);
    const e = snapToWalkable(map, to);
    if (isStageSpot(map, s) || isStageSpot(map, e)) return routeViaStage(map, s, e);
  }
  return routeBase(map, from, to);
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
  for (let r = 0; r < map.size; r++) {
    for (let c = 0; c < map.size; c++) {
      if (map.mask[r * map.size + c] !== 1) continue;
      const m = cellCenterFx(c, r);
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
  const sc = cellOfFx(s.x, s.z);
  const ec = cellOfFx(e.x, e.z);
  if ((sc.c === ec.c && sc.r === ec.r) || lineWalkable(map, s, e)) return [s.x, s.z, e.x, e.z];
  const cells = findPath(map, sc, ec);
  if (cells === null) return [s.x, s.z];
  const pts: Pt[] = cells.map((cell) => cellCenterFx(cell.c, cell.r));
  pts[0] = { x: s.x, z: s.z };
  pts[pts.length - 1] = { x: e.x, z: e.z };
  const flat: number[] = [];
  for (const p of relaxPath(map, smoothPath(map, pts))) flat.push(p.x, p.z);
  return flat;
}
