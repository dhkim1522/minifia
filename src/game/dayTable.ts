// RED 단계 자리 표시자 — GREEN 에서 실제 배치 함수로 바꾼다.
export const DAY_SCENE_W = 0;
export const DAY_SCENE_H = 0;
export const NARROW_SCENE_BELOW = 0;
export const SEAT_CY_MIN = 0;
export const TABLE_FIT_MIN_H = 0;
export const NAME_TAG_MAX_W = 0;

export interface DayGeometry {
  cx: number;
  cy: number;
  rx: number;
  ry: number;
  felt: { left: number; top: number; width: number; height: number };
}

export interface DaySeatPlace {
  seat: number;
  slot: number;
  x: number;
  y: number;
  depth: number;
  scale: number;
  z: number;
  figLeft: number;
  figTop: number;
  tagLeft: number;
  tagTop: number;
  tagZ: number;
  emojiLeft: number;
  emojiTop: number;
}

export function dayTableGeometry(_sceneW: number, _sceneH?: number): DayGeometry {
  return { cx: 0, cy: 0, rx: 0, ry: 0, felt: { left: 0, top: 0, width: 0, height: 0 } };
}

export function daySeatLayout(
  _seats: readonly { seat: number }[],
  _mySeat: number,
  _sceneW: number,
  _sceneH?: number,
): DaySeatPlace[] {
  return [];
}

export function px(_n: number): string {
  return "";
}
