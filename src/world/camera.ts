// 정사영 카메라 수학(순수). three 를 import 하지 않는다 — 렌더러가 같은 상수로 three 카메라를 만든다.
// RED 뼈대: 상수만 실제 값이고 함수는 아직 틀린 값을 돌려준다(같은 작업의 GREEN 에서 구현으로 바뀐다).

export interface V3 {
  x: number;
  y: number;
  z: number;
}
export interface Canvas {
  w: number;
  h: number;
}

export const PX_PER_UNIT = 58.2;
export const CAM_YAW = Math.PI / 4;
export const CAM_DIST = 17;
export const CAM_HEIGHT = 12.5;
export const LOOK_Y = 0.6;
export const DEFAULT_TARGET = { x: -0.4, z: -0.4 };
export const FOLLOW_TAU_MS = 350 / Math.LN10;
export const RESIZE_SETTLE_MS = 180;
export const HEADER_BOTTOM = 62;
export const PANEL_HEIGHT = 88;
export const NAMETAG_MAX_W = 180;
export const NAMETAG_H = 24;
export const PAN_BOX = { minX: -4.0, maxX: 4.0, minZ: -4.0, maxZ: 4.0 };
export const PLATE_FAR = 30;
export const STAGE_SIZES: readonly { w: number; h: number; label: string }[] = [];

export function cameraBasis(): { right: V3; up: V3; back: V3 } {
  const z = { x: 0, y: 0, z: 0 };
  return { right: z, up: z, back: z };
}
export function stageRect(_c: Canvas, _panelHeight: number = PANEL_HEIGHT): { top: number; bottom: number; left: number; right: number } {
  return { top: 0, bottom: 0, left: 0, right: 0 };
}
export function stageOffsetY(_canvasH: number, _stageTop: number, _stageBottom: number): number {
  return 0;
}
export function groundToScreen(_p: V3, _target: { x: number; z: number }, _c: Canvas, _offsetY: number): { sx: number; sy: number } {
  return { sx: 0, sy: 0 };
}
export function screenToGround(_sx: number, _sy: number, _target: { x: number; z: number }, _c: Canvas, _offsetY: number): { x: number; z: number } {
  return { x: 0, z: 0 };
}
export function screenRay(_sx: number, _sy: number, _target: { x: number; z: number }, _c: Canvas, _offsetY: number): { origin: V3; dir: V3 } {
  const z = { x: 0, y: 0, z: 0 };
  return { origin: z, dir: z };
}
export function clampTarget(p: { x: number; z: number }, _box: typeof PAN_BOX = PAN_BOX): { x: number; z: number } {
  return p;
}
export function followStep(cam: { x: number; z: number }, _target: { x: number; z: number }, _dtMs: number, _reduced: boolean): { x: number; z: number } {
  return cam;
}
