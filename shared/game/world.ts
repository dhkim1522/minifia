// 로비 이동의 서버 권위 규칙(결정 0044-17). 시각은 인자 now 하나, 난수는 인자 randInt — 이 파일은 시각·난수를 스스로 읽지 않는다.
// 서버(worker/room.ts)와 클라이언트(src/world)가 같은 positionAt 을 쓴다.
// (RED 뼈대: 구현은 GREEN 커밋에서 채운다)
import type { WorldFrame } from "../protocol";
import type { MapDef } from "./map";

export { UNIT } from "./map";
export const MOVE_SPEED = 1.8;
export const MOVE_V = 180;
export const MOVE_MIN_GAP_MS = 150;
export const WORLD_FLUSH_MS = 2000;
export const WANDER_MIN_MS = 3000;
export const WANDER_SPAN_MS = 3000;

export interface Segment {
  p: number[];
  t0: number;
  v: number;
}
export interface WorldState {
  segs: Readonly<Record<string, Segment>>;
  lastMoveAt: Readonly<Record<string, number>>;
  wanderAt: Readonly<Record<string, number>>;
}

export function positionAt(_seg: Segment, _t: number): { x: number; z: number } {
  return { x: 0, z: 0 };
}
export function positionAtFx(_seg: Segment, _t: number): { x: number; z: number } {
  return { x: 0, z: 0 };
}
export function segmentEndsAt(seg: Segment): number {
  return seg.t0;
}
export function restSegment(_xFx: number, _zFx: number, t0: number): Segment {
  return { p: [], t0, v: 0 };
}
export function emptyWorld(): WorldState {
  return { segs: {}, lastMoveAt: {}, wanderAt: {} };
}
export function spawnPlayer(w: WorldState, _playerId: string, _seat: number, _now: number, _map: MapDef): WorldState {
  return w;
}
export function requestMove(
  _w: WorldState,
  _playerId: string,
  _dest: { x: number; z: number },
  _now: number,
  _map: MapDef,
): { ok: true; world: WorldState; seg: Segment } | { ok: false; reason: "UNKNOWN_PLAYER" | "TOO_SOON" } {
  return { ok: false, reason: "TOO_SOON" };
}
export function moveFrame(seat: number, seg: Segment): Extract<WorldFrame, { k: "move" }> {
  return { t: "world", k: "move", s: seat, p: seg.p, t0: seg.t0, v: seg.v };
}
