// 로비 이동의 서버 권위 규칙(결정 0044-17). 시각은 인자 now 하나, 난수는 인자 randInt — 이 파일은 시각·난수를 스스로 읽지 않는다.
// 서버(worker/room.ts)와 클라이언트(src/world)가 같은 positionAt 을 쓴다.
//
// 좌표는 1/100 단위 정수(UNIT = 100), 시각은 서버 ms, 속도 v 는 단위/초 × 100(= 고정소수점 거리/초)이다.
// 클라이언트가 보내는 것은 목적지 두 정수뿐이다 — 속도·경로·출발점·시각은 서버가 정한다(T-06-10).
// 입력 월드는 바꾸지 않고 새 객체를 돌려준다. 삼각함수 없이 사칙연산·제곱근만 써서 서버와 폰이 같은 값을 얻는다.
import type { WorldFrame } from "../protocol";
import { MOVE_COORD_LIMIT } from "../protocol";
import type { MapDef } from "./map";
import { UNIT, routeFx, snapToWalkable } from "./map";

export { UNIT } from "./map";
/** 걷는 속도(단위/초). 서버 상수이고 모든 구간 프레임에 v 로 실린다(UI-SPEC 사용자 확정 시작값). */
export const MOVE_SPEED = 1.8;
/** MOVE_SPEED × UNIT — 구간의 v */
export const MOVE_V = 180;
/** 한 사람의 이동 성공 뒤 다음 요청을 받는 최소 간격(ms) */
export const MOVE_MIN_GAP_MS = 150;
/** 위치 저장 디바운스(ms). 잃는 범위는 배포·크래시 직전 이 안의 탭이다(RESEARCH A6). */
export const WORLD_FLUSH_MS = 2000;
/** 봇 배회 간격: WANDER_MIN_MS + [0, WANDER_SPAN_MS) */
export const WANDER_MIN_MS = 3000;
export const WANDER_SPAN_MS = 3000;

/** 이동 구간: p = 꼭짓점 [x0,z0,x1,z1,…](고정소수점 정수), t0 = 출발 서버 ms, v = 단위/초 × 100. 한 점(p 길이 2)이면 서 있는 것이다. */
export interface Segment {
  p: number[];
  t0: number;
  v: number;
}

/** 방의 이동 상태. lastMoveAt·wanderAt 은 저장하지 않는다(하이버네이션·배포 뒤 비어도 무해, 가정 A1). */
export interface WorldState {
  segs: Readonly<Record<string, Segment>>;
  lastMoveAt: Readonly<Record<string, number>>;
  wanderAt: Readonly<Record<string, number>>;
}

/** 고정소수점 실수 좌표(반올림 전)의 구간 위치. 누적 길이 선형 보간, 길이 0 선분은 건너뛴다. */
function interpFx(seg: Segment, t: number): { x: number; z: number } {
  const p = seg.p;
  const x0 = p[0] ?? 0;
  const z0 = p[1] ?? 0;
  const n = p.length >> 1;
  if (n < 2 || !(seg.v > 0) || t <= seg.t0) return { x: x0, z: z0 };
  let remain = (seg.v * (t - seg.t0)) / 1000;
  for (let i = 0; i + 1 < n; i++) {
    const ax = p[2 * i]!;
    const az = p[2 * i + 1]!;
    const bx = p[2 * i + 2]!;
    const bz = p[2 * i + 3]!;
    const dx = bx - ax;
    const dz = bz - az;
    const len = Math.sqrt(dx * dx + dz * dz);
    if (len === 0) continue;
    if (remain < len) {
      const f = remain / len;
      return { x: ax + dx * f, z: az + dz * f };
    }
    remain -= len;
  }
  return { x: p[2 * n - 2]!, z: p[2 * n - 1]! };
}

/** 시각 t(서버 ms)의 구간 위치(월드 단위, 실수). t < t0 이면 시작점, 끝 이후면 끝점. 클라이언트가 화면 링을 그릴 때 쓴다. */
export function positionAt(seg: Segment, t: number): { x: number; z: number } {
  const q = interpFx(seg, t);
  return { x: q.x / UNIT + 0, z: q.z / UNIT + 0 };
}

/** positionAt 을 고정소수점 정수(반올림)로. 서버가 걷는 중 새 요청의 출발점을 정할 때 쓴다. */
export function positionAtFx(seg: Segment, t: number): { x: number; z: number } {
  const q = interpFx(seg, t);
  return { x: Math.round(q.x) + 0, z: Math.round(q.z) + 0 };
}

/** 구간이 끝나는 서버 ms(올림). 한 점이거나 v ≤ 0 이면 t0. */
export function segmentEndsAt(seg: Segment): number {
  const p = seg.p;
  const n = p.length >> 1;
  if (n < 2 || !(seg.v > 0)) return seg.t0;
  let total = 0;
  for (let i = 0; i + 1 < n; i++) {
    const dx = p[2 * i + 2]! - p[2 * i]!;
    const dz = p[2 * i + 3]! - p[2 * i + 1]!;
    total += Math.sqrt(dx * dx + dz * dz);
  }
  return Math.ceil(seg.t0 + (total * 1000) / seg.v);
}

/** 서 있는 한 점 구간 */
export function restSegment(xFx: number, zFx: number, t0: number): Segment {
  return { p: [xFx, zFx], t0, v: MOVE_V };
}

export function emptyWorld(): WorldState {
  return { segs: {}, lastMoveAt: {}, wanderAt: {} };
}

/** seat 의 입장 지점(고정소수점 정수). 입장 지점이 없는 맵(테스트용)은 걸을 수 있는 가장 가까운 점이다. */
function spawnPointFx(seat: number, map: MapDef): { x: number; z: number } {
  const sp = map.spawns.length > 0 ? map.spawns[((seat % map.spawns.length) + map.spawns.length) % map.spawns.length] : undefined;
  if (sp === undefined) {
    const s = snapToWalkable(map, { x: 0, z: 0 });
    return { x: s.x, z: s.z };
  }
  return { x: Math.round(sp.x * UNIT), z: Math.round(sp.z * UNIT) };
}

function withoutKey<T>(rec: Readonly<Record<string, T>>, key: string): Record<string, T> {
  const out: Record<string, T> = {};
  for (const k of Object.keys(rec)) if (k !== key) out[k] = rec[k]!;
  return out;
}

/** 입장: 자기 seat 입장 지점에 선다. 이전 간격 기록은 지운다. */
export function spawnPlayer(w: WorldState, playerId: string, seat: number, now: number, map: MapDef): WorldState {
  const at = spawnPointFx(seat, map);
  return {
    segs: { ...w.segs, [playerId]: restSegment(at.x, at.z, now) },
    lastMoveAt: withoutKey(w.lastMoveAt, playerId),
    wanderAt: w.wanderAt,
  };
}

/**
 * 이동 요청. 검사 순서: 방에 있는지 → 간격 150ms → 지금 위치 → 보정된 목적지까지의 경로.
 * 목적지가 막힌 곳·맵 밖이면 보정된 점이 구간의 끝점이다. 걷는 중이면 지금 위치(positionAtFx)에서 새 경로를 만든다.
 * 거절하면 상태를 바꾸지 않는다(간격 시계도 늘리지 않는다).
 */
export function requestMove(
  w: WorldState,
  playerId: string,
  dest: { x: number; z: number },
  now: number,
  map: MapDef,
): { ok: true; world: WorldState; seg: Segment } | { ok: false; reason: "UNKNOWN_PLAYER" | "TOO_SOON" } {
  const cur = Object.prototype.hasOwnProperty.call(w.segs, playerId) ? w.segs[playerId] : undefined;
  if (cur === undefined) return { ok: false, reason: "UNKNOWN_PLAYER" };
  const last = Object.prototype.hasOwnProperty.call(w.lastMoveAt, playerId) ? w.lastMoveAt[playerId] : undefined;
  if (last !== undefined && now - last < MOVE_MIN_GAP_MS) return { ok: false, reason: "TOO_SOON" };

  const from = positionAtFx(cur, now);
  // 스키마가 정수·범위를 지키지만 이 함수는 단독으로도 안전하다: 비정상 좌표는 제자리로 본다.
  const dx = Number.isFinite(dest.x) ? Math.round(dest.x) : from.x;
  const dz = Number.isFinite(dest.z) ? Math.round(dest.z) : from.z;
  const clampLimit = (v: number): number => (v < -MOVE_COORD_LIMIT ? -MOVE_COORD_LIMIT : v > MOVE_COORD_LIMIT ? MOVE_COORD_LIMIT : v);
  const p = routeFx(map, from, { x: clampLimit(dx), z: clampLimit(dz) });

  const stationary = p.length < 4 || (p.length === 4 && p[0] === p[2] && p[1] === p[3]);
  const seg: Segment = stationary ? restSegment(p[0] ?? from.x, p[1] ?? from.z, now) : { p, t0: now, v: MOVE_V };
  return {
    ok: true,
    world: { segs: { ...w.segs, [playerId]: seg }, lastMoveAt: { ...w.lastMoveAt, [playerId]: now }, wanderAt: w.wanderAt },
    seg,
  };
}

/** 한 사람의 새 구간 프레임. 공개 식별자는 seat 뿐이다(playerId·토큰·역할 자리 없음). p 는 복사한다. */
export function moveFrame(seat: number, seg: Segment): Extract<WorldFrame, { k: "move" }> {
  return { t: "world", k: "move", s: seat, p: [...seg.p], t0: seg.t0, v: seg.v };
}
