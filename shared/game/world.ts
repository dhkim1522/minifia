// 로비 이동의 서버 권위 규칙(결정 0044-17). 시각은 인자 now 하나, 난수는 인자 randInt — 이 파일은 시각·난수를 스스로 읽지 않는다.
// 서버(worker/room.ts)와 클라이언트(src/world)가 같은 positionAt 을 쓴다.
//
// 좌표는 1/100 단위 정수(UNIT = 100), 시각은 서버 ms, 속도 v 는 단위/초 × 100(= 고정소수점 거리/초)이다.
// 클라이언트가 보내는 것은 목적지 두 정수뿐이다 — 속도·경로·출발점·시각은 서버가 정한다(T-06-10).
// 입력 월드는 바꾸지 않고 새 객체를 돌려준다. 삼각함수 없이 사칙연산·제곱근만 써서 서버와 폰이 같은 값을 얻는다.
import type { WorldFrame } from "../protocol";
import { MOVE_COORD_LIMIT } from "../protocol";
import type { MapDef } from "./map";
import { UNIT, cellCenterFx, lineWalkable, routeFx, snapToWalkable, walkableCells } from "./map";

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

// ---- 입장·퇴장·복귀와 저장/복원·스냅샷 ----

/** 저장 모양. 끝난 구간은 한 점으로 접힌다. lastMoveAt·wanderAt 은 싣지 않는다(가정 A1). */
export interface StoredWorld {
  v: 1;
  segs: Record<string, Segment>;
}

/** 퇴장: 구간·간격·배회 기록을 모두 지운다. */
export function despawnPlayer(w: WorldState, playerId: string): WorldState {
  return { segs: withoutKey(w.segs, playerId), lastMoveAt: withoutKey(w.lastMoveAt, playerId), wanderAt: withoutKey(w.wanderAt, playerId) };
}

/** 대기실 복귀: 방에 있는 모두를 자기 seat 입장 지점 한 점으로 세운다. 방에 없는 사람과 간격·배회 기록은 버린다. */
export function respawnAll(_w: WorldState, players: readonly { id: string; seat: number }[], now: number, map: MapDef): WorldState {
  let out = emptyWorld();
  for (const pl of players) out = spawnPlayer(out, pl.id, pl.seat, now, map);
  return out;
}

/** 저장·스냅샷 공통 접기 규칙: 끝난 구간은 [끝x, 끝z] 한 점, 진행 중이면 그대로. 배열은 복사한다. */
function foldSegment(seg: Segment, now: number): Segment {
  if (now >= segmentEndsAt(seg) && seg.p.length >= 2) {
    return { p: [seg.p[seg.p.length - 2]!, seg.p[seg.p.length - 1]!], t0: seg.t0, v: seg.v };
  }
  return { p: [...seg.p], t0: seg.t0, v: seg.v };
}

/** 지연 저장용 모양. 끝난 구간은 한 점으로 접는다. */
export function compactWorld(w: WorldState, now: number): StoredWorld {
  const segs: Record<string, Segment> = {};
  for (const id of Object.keys(w.segs)) segs[id] = foldSegment(w.segs[id]!, now);
  return { v: 1, segs };
}

/** 저장된 v 의 상한(MOVE_V 보다 넉넉하게). 이보다 큰 값은 손상으로 본다. */
const MAX_STORED_V = 1000;

function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === "object" && x !== null && !Array.isArray(x);
}

/** unknown 한 구간을 형태 검사한다(zod 를 쓰지 않는다 — shared/game 은 클라이언트 번들에도 들어간다). 통과하면 p·t0·v 만 새로 만들어 돌려준다. */
function parseStoredSegment(raw: unknown, map: MapDef): Segment | null {
  if (!isRecord(raw)) return null;
  const { p, t0, v } = raw;
  if (!Array.isArray(p) || p.length < 2 || p.length % 2 !== 0) return null;
  for (const c of p) {
    if (typeof c !== "number" || !Number.isInteger(c) || c < -MOVE_COORD_LIMIT || c > MOVE_COORD_LIMIT) return null;
  }
  if (typeof t0 !== "number" || !Number.isFinite(t0)) return null;
  if (typeof v !== "number" || !Number.isFinite(v) || v <= 0 || v > MAX_STORED_V) return null;
  const pts = p as number[];
  // 모든 선분(한 점이면 그 점)이 걸을 수 있어야 한다 — 맵 데이터가 바뀐 옛 저장값·손상값은 입장 지점으로.
  if (pts.length === 2) {
    if (!lineWalkable(map, { x: pts[0]!, z: pts[1]! }, { x: pts[0]!, z: pts[1]! })) return null;
  } else {
    for (let i = 0; i + 3 < pts.length; i += 2) {
      if (!lineWalkable(map, { x: pts[i]!, z: pts[i + 1]! }, { x: pts[i + 2]!, z: pts[i + 3]! })) return null;
    }
  }
  return { p: [...pts], t0, v };
}

/**
 * 하이버네이션·배포 뒤 복원. 모르는 모양·방에 없는 사람·막힌 점·범위 밖 점·v ≤ 0 은 버리고 그 사람을 입장 지점에 세운다.
 * 결과에는 방에 있는 사람만 들어 있고 간격·배회 기록은 비어 있다.
 */
export function restoreWorld(stored: unknown, players: readonly { id: string; seat: number }[], now: number, map: MapDef): WorldState {
  const segsRaw: Record<string, unknown> | null =
    isRecord(stored) && stored.v === 1 && isRecord(stored.segs) ? (stored.segs as Record<string, unknown>) : null;
  let out = emptyWorld();
  for (const pl of players) {
    const raw = segsRaw !== null && Object.prototype.hasOwnProperty.call(segsRaw, pl.id) ? segsRaw[pl.id] : undefined;
    const seg = raw === undefined ? null : parseStoredSegment(raw, map);
    out = seg === null ? spawnPlayer(out, pl.id, pl.seat, now, map) : { ...out, segs: { ...out.segs, [pl.id]: seg } };
  }
  return out;
}

/** 접속 때 모두의 지금 구간. seat 오름차순, 방에 있고 world 에 있는 사람만, 접기 규칙은 compactWorld 와 같다. */
export function snapFrame(
  w: WorldState,
  players: readonly { id: string; seat: number }[],
  now: number,
): Extract<WorldFrame, { k: "snap" }> {
  const ents = [...players]
    .sort((a, b) => a.seat - b.seat)
    .flatMap((pl) => {
      const seg = Object.prototype.hasOwnProperty.call(w.segs, pl.id) ? w.segs[pl.id] : undefined;
      if (seg === undefined) return [];
      const f = foldSegment(seg, now);
      return [{ s: pl.seat, p: f.p, t0: f.t0, v: f.v }];
    });
  return { t: "world", k: "snap", at: now, ents };
}

// ---- 테스트 방 봇 로비 배회 ----

/**
 * 봇 배회 계획. 이동을 직접 적용하지 않고 목적지만 낸다 — 방 DO 가 사람과 같은 requestMove(간격 검사 포함)를 거쳐 적용한다(결정 0024 "봇은 특권 없음").
 * 난수 호출 순서가 계약이다: seat 오름차순 봇마다, 때가 된 봇은 [목적지 셀 randInt(셀 수), 다음 간격 randInt(WANDER_SPAN_MS)],
 * 처음 보는 봇은 [간격] 하나(첫 호출은 이동 없이 계획만 세운다). 때가 안 된 봇은 난수를 쓰지 않는다.
 * bots 에 없는 id 의 wanderAt 은 지운다. segs·lastMoveAt 은 그대로 돌려준다.
 */
export function planWander(
  w: WorldState,
  bots: readonly { id: string; seat: number }[],
  now: number,
  randInt: (n: number) => number,
  map: MapDef,
): { world: WorldState; moves: { playerId: string; dest: { x: number; z: number } }[] } {
  const wanderAt: Record<string, number> = {};
  const moves: { playerId: string; dest: { x: number; z: number } }[] = [];
  let cells: { c: number; r: number }[] | null = null;
  for (const bot of [...bots].sort((a, b) => a.seat - b.seat)) {
    const planned = Object.prototype.hasOwnProperty.call(w.wanderAt, bot.id) ? w.wanderAt[bot.id] : undefined;
    if (planned === undefined) {
      wanderAt[bot.id] = now + WANDER_MIN_MS + randInt(WANDER_SPAN_MS);
      continue;
    }
    if (now < planned) {
      wanderAt[bot.id] = planned;
      continue;
    }
    cells ??= walkableCells(map);
    if (cells.length > 0) {
      const cell = cells[randInt(cells.length)]!;
      moves.push({ playerId: bot.id, dest: cellCenterFx(cell.c, cell.r) });
    }
    wanderAt[bot.id] = now + WANDER_MIN_MS + randInt(WANDER_SPAN_MS);
  }
  return { world: { segs: w.segs, lastMoveAt: w.lastMoveAt, wanderAt }, moves };
}

/** 주어진 봇들의 다음 배회 시각(wanderAt 최솟값). 계획이 있는 봇이 없으면 null. */
export function nextWanderAt(w: WorldState, botIds: readonly string[]): number | null {
  let min: number | null = null;
  for (const id of botIds) {
    if (!Object.prototype.hasOwnProperty.call(w.wanderAt, id)) continue;
    const t = w.wanderAt[id]!;
    if (min === null || t < min) min = t;
  }
  return min;
}
