// 재즈 바 이동 격자와 경로(결정 0044-17: 클라이언트는 목적지만, 서버가 경로를 정한다).
// 현재 시각·난수를 읽지 않고, 삼각함수·hypot 없이 정수·제곱근·사칙연산만 쓴다(RESEARCH R4) — 서버와 클라이언트가 같은 값을 얻게.
// (RED 단계 임시 뼈대: 상수만 확정이고 함수는 아직 구현 전이다.)

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

export function parseMask(_rows: readonly string[]): Uint8Array {
  return new Uint8Array(0);
}

export function isWalkable(_map: MapDef, _c: number, _r: number): boolean {
  return false;
}

export function cellOfFx(_xFx: number, _zFx: number): { c: number; r: number } {
  return { c: 0, r: 0 };
}

export function cellCenterFx(_c: number, _r: number): { x: number; z: number } {
  return { x: 0, z: 0 };
}

export function snapToWalkable(
  _map: MapDef,
  _p: { x: number; z: number },
): { x: number; z: number; snapped: boolean } {
  return { x: 0, z: 0, snapped: false };
}

export function findPath(
  _map: MapDef,
  _from: { c: number; r: number },
  _to: { c: number; r: number },
): { c: number; r: number }[] | null {
  return null;
}

export function lineWalkable(_map: MapDef, _a: { x: number; z: number }, _b: { x: number; z: number }): boolean {
  return false;
}

export function smoothPath(_map: MapDef, _pts: { x: number; z: number }[]): { x: number; z: number }[] {
  return [];
}

export function routeFx(_map: MapDef, _from: { x: number; z: number }, _to: { x: number; z: number }): number[] {
  return [];
}

export function walkableCells(_map: MapDef): { c: number; r: number }[] {
  return [];
}
