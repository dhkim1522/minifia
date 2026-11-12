// 심부름 규칙(15페이즈, 결정 0074 예정) — 순수 모듈: 시각·난수는 인자로만 받고 입력 상태를 바꾸지 않는다.
// 심부름 목록은 모든 역할이 같다(D-03): 이 파일은 역할·연결 상태를 읽지 않는다. 마피아도 같은 모양·같은 개수의 목록을 받고
// 같은 처리 규칙을 지난다(가짜 목록, 방해 행동 없음). 역할만 다른 두 방이 같은 시드로 같은 목록을 얻는 것이 그 증거다.
// 가짜 장소(16페이즈 D-08)는 Player.errandFake 키로만 안다 — 역할은 errandFake.ts 가 읽고 이 파일은 그 키 이름만 다룬다.
// 처리 거절은 사유를 가르지 않고 { ok: false } 하나다(D-08) — 응답이 오라클이 되지 않는다.
import { PLACE_IDS } from "../protocol";
import type { PlaceId, RecordLine, WorldFrame } from "../protocol";
import { isAlive } from "./alive";
import { UNIT } from "./map";
import type { MapDef } from "./map";
import { mapOf, roomMapId } from "./maps";
import { ERRAND_ACT_R, ERRAND_COUNT, ERRAND_NEAR_R, ERRAND_TICK_MS, ERRAND_VIEW_HORIZON_MS, RECORD_MAX } from "./phases";
import type { RoomState } from "./room";
import { positionAtFx, snapFrame, truncateSegment } from "./world";
import type { WorldState } from "./world";

/** 난수 함수: [0, n) 정수. roles.ts 의 randInt 와 같은 계약이다. */
type RandInt = (n: number) => number;

const PLACE_SET: ReadonlySet<string> = new Set(PLACE_IDS);

function isPlaceId(id: string): id is PlaceId {
  return PLACE_SET.has(id);
}

/** 장소 중앙(고정소수점). 맵에 없는 id 는 undefined. */
export function placeCenterFx(map: MapDef, id: string): { x: number; z: number } | undefined {
  const place = map.places?.find((p) => p.id === id);
  if (place === undefined) return undefined;
  return { x: Math.round(place.x * UNIT), z: Math.round(place.z * UNIT) };
}

function distSq(a: { x: number; z: number }, b: { x: number; z: number }): number {
  const dx = a.x - b.x;
  const dz = a.z - b.z;
  return dx * dx + dz * dz;
}

/** 맵 후보 전체 중 posFx 에서 가장 가까운 장소 id(같으면 목록 앞). 후보가 없으면 undefined. */
export function nearestPlaceId(map: MapDef, posFx: { x: number; z: number }): string | undefined {
  let best: string | undefined;
  let bestD = Infinity;
  for (const place of map.places ?? []) {
    const c = placeCenterFx(map, place.id);
    if (c === undefined) continue;
    const d = distSq(c, posFx);
    if (d < bestD) {
      bestD = d;
      best = place.id;
    }
  }
  return best;
}

/**
 * errand 진입 훅. 산 사람(seat 오름차순)마다 맵 후보에서 ERRAND_COUNT 곳을 부분 피셔–예이츠로 뽑아 errandPlaces 에 쓰고 errandDone 은 빈 배열로 둔다.
 * 죽은 사람은 두 키를 지운다. 이전 낮의 errandFake(서버 전용 가짜 장소)도 지운다. 새 낮이므로 서버 전용 errandLast(마지막 목격 줄, 16페이즈 D-10)도 키째 지운다. 난수 호출 순서가 계약이다: seat 오름차순 산 사람, 사람마다 k = 0..count-1 순서로 randInt(n - k).
 * at(진입 시각 = 이전 마감)을 받아 첫 근처·목격 표본 시각 errandTickAt = at + ERRAND_TICK_MS 를 정하고, 모든 사람의 errandNear·errandSeen 을 지운다(15-02).
 */
export function enterErrand(state: RoomState, randInt: RandInt, at: number): RoomState {
  const candidates = (mapOf(roomMapId(state)).places ?? []).map((p) => p.id).filter(isPlaceId);
  const picks = new Map<string, PlaceId[]>();
  const alive = state.players.filter((p) => isAlive(p)).sort((a, b) => a.seat - b.seat);
  for (const p of alive) {
    const pool = [...candidates];
    const count = Math.min(ERRAND_COUNT, pool.length);
    for (let k = 0; k < count; k++) {
      const idx = k + randInt(pool.length - k);
      const tmp = pool[k] as PlaceId;
      pool[k] = pool[idx] as PlaceId;
      pool[idx] = tmp;
    }
    picks.set(p.id, pool.slice(0, count));
  }
  const { errandLast: _last, ...rest } = state;
  return {
    ...rest,
    errandTickAt: at + ERRAND_TICK_MS,
    players: state.players.map((p) => {
      const { errandPlaces: _places, errandDone: _done, errandNear: _near, errandSeen: _seen, errandFake: _fake, ...kept } = p;
      const mine = picks.get(p.id);
      return mine === undefined ? kept : { ...kept, errandPlaces: mine, errandDone: [] };
    }),
  };
}

/**
 * 심부름 처리. errand 단계 · 행위자가 방에 있는 산 사람 · errandPlaces 가 있을 때, 미완료 장소 중 중앙까지 거리가
 * ERRAND_ACT_R × UNIT 이하인 것 가운데 가장 가까운 하나(같으면 목록 앞)를 errandDone 끝에 더한다. 그 밖은 사유를 가르지 않고 { ok: false }.
 */
export function actErrand(
  state: RoomState,
  actorId: string,
  posFx: { x: number; z: number },
): { ok: true; state: RoomState } | { ok: false } {
  if (state.phase !== "errand") return { ok: false };
  const actor = state.players.find((p) => p.id === actorId);
  if (actor === undefined || !isAlive(actor) || actor.errandPlaces === undefined) return { ok: false };
  const done = actor.errandDone ?? [];
  const map = mapOf(roomMapId(state));
  const reach = ERRAND_ACT_R * UNIT;
  let best: PlaceId | undefined;
  let bestD = Infinity;
  for (const id of actor.errandPlaces) {
    if (done.includes(id) || id === actor.errandFake) continue; // 가짜 장소는 후보에서 뺀다 — 후보가 없으면 반경 밖과 같은 { ok: false } 다(D-08)
    const c = placeCenterFx(map, id);
    if (c === undefined) continue;
    const d = distSq(c, posFx);
    if (d <= reach * reach && d < bestD) {
      bestD = d;
      best = id;
    }
  }
  if (best === undefined) return { ok: false };
  const finished = best;
  return {
    ok: true,
    state: {
      ...state,
      players: state.players.map((p) => (p.id === actorId ? { ...p, errandDone: [...done, finished] } : p)),
    },
  };
}

// ---- 근처 판정·목격 표본·근처 snap(15-02, D-02·D-04) — 역할을 읽지 않는다 ----

type Pos = { x: number; z: number };
type Who = { id: string; seat: number; alive?: boolean };

/**
 * 근처 사람 id: viewer 가 산 사람일 때 산 다른 사람 중 위치 사이 거리 ≤ radiusFx(경계 포함)인 id(seat 오름차순).
 * viewer 가 죽었거나 viewer·대상의 위치가 없으면 빈 배열·제외. 자기 자신은 없다.
 */
export function nearIdsOf(
  players: readonly Who[],
  posOf: (id: string) => Pos | undefined,
  viewerId: string,
  radiusFx: number,
  _map?: Pick<MapDef, "rooms">,
): string[] {
  const viewer = players.find((p) => p.id === viewerId);
  if (viewer === undefined || !isAlive(viewer)) return [];
  const mine = posOf(viewerId);
  if (mine === undefined) return [];
  return players
    .filter((p) => p.id !== viewerId && isAlive(p))
    .filter((p) => {
      const there = posOf(p.id);
      return there !== undefined && distSq(mine, there) <= radiusFx * radiusFx;
    })
    .sort((a, b) => a.seat - b.seat)
    .map((p) => p.id);
}

/**
 * errand 표본 한 번(D-04). 산 사람 A 마다 근처 좌석 집합을 구해 이전 errandNear 와 견주고, 새로 들어온 좌석 B(오름차순)마다
 * errandSeen.length < RECORD_MAX 이면 { seat: B.seat, place: B 에게 가장 가까운 맵 장소 id } 를 끝에 더한다(장소를 못 구하면 더하지 않는다).
 * errandNear 는 새 집합(좌석 오름차순)으로 바꾸고 errandTickAt = at + ERRAND_TICK_MS. errand 단계가 아니면 입력 그대로, 입력 상태는 바꾸지 않는다.
 * 마지막 목격(16페이즈 D-10, 서버 전용 errandLast): 산 사람 B 마다 반경 안의 다른 산 사람 중 B 에게 가장 가까운 A(거리가 같으면 낮은 좌석)를 찾아 있으면
 * { seat: B.seat, by: A.seat, place: B 곁 장소 id } 로 B 의 줄을 덮어쓴다. 반경 안에 아무도 없는 표본은 이전 줄을 남긴다(마지막 관찰자 유지). 장소를 못 구하면 덮어쓰지 않는다.
 * 관찰자의 역할·심부름 진행은 읽지 않는다(이 파일의 불변식).
 */
export function sampleErrand(state: RoomState, posOf: (id: string) => Pos | undefined, at: number): RoomState {
  if (state.phase !== "errand") return state;
  const map = mapOf(roomMapId(state));
  const radiusFx = ERRAND_NEAR_R * UNIT;
  const seatOf = new Map(state.players.map((p) => [p.id, p.seat] as const));
  const players = state.players.map((a) => {
    if (!isAlive(a)) return a;
    const nearSeats = nearIdsOf(state.players, posOf, a.id, radiusFx).map((id) => seatOf.get(id) as number);
    const before = new Set(a.errandNear ?? []);
    const seen: RecordLine[] = [...(a.errandSeen ?? [])];
    for (const seat of nearSeats) {
      if (before.has(seat) || seen.length >= RECORD_MAX) continue;
      const other = state.players.find((p) => p.seat === seat);
      const there = other === undefined ? undefined : posOf(other.id);
      const place = there === undefined ? undefined : nearestPlaceId(map, there);
      if (place === undefined || !isPlaceId(place)) continue;
      seen.push({ seat, place });
    }
    return { ...a, errandNear: nearSeats, errandSeen: seen };
  });
  const last = new Map((state.errandLast ?? []).map((row) => [row.seat, row] as const));
  for (const b of state.players) {
    if (!isAlive(b)) continue;
    const here = posOf(b.id);
    if (here === undefined) continue;
    let by: number | undefined;
    let byD = Infinity;
    // nearIdsOf 는 seat 오름차순 — 엄격한 < 로 가르면 거리가 같을 때 낮은 좌석이 남는다.
    for (const id of nearIdsOf(state.players, posOf, b.id, radiusFx)) {
      const other = state.players.find((p) => p.id === id);
      const there = other === undefined ? undefined : posOf(id);
      if (other === undefined || there === undefined) continue;
      const d = distSq(here, there);
      if (d < byD) {
        byD = d;
        by = other.seat;
      }
    }
    if (by === undefined) continue;
    const place = nearestPlaceId(map, here);
    if (place === undefined || !isPlaceId(place)) continue;
    last.set(b.seat, { seat: b.seat, by, place });
  }
  const { errandLast: _before, ...rest } = state;
  const rows = [...last.values()].sort((a, b) => a.seat - b.seat);
  return { ...rest, players, errandTickAt: at + ERRAND_TICK_MS, ...(rows.length > 0 ? { errandLast: rows } : {}) };
}

/**
 * errand 의 근처 snap(D-02): 본인(전체 구간, snapFrame 과 같은 접기 규칙) + 근처 산 사람(지금부터 ERRAND_VIEW_HORIZON_MS 만큼 자른 구간), seat 오름차순.
 * 반경 밖 사람은 어떤 모양으로도 없다. near: true 표시가 붙는다 — 클라이언트가 빠진 사람을 사라진 것으로 읽는다.
 */
export function nearSnapFrame(
  world: WorldState,
  players: readonly Who[],
  viewerId: string,
  now: number,
  _map?: Pick<MapDef, "rooms">,
): Extract<WorldFrame, { k: "snap" }> {
  const has = (id: string): boolean => Object.prototype.hasOwnProperty.call(world.segs, id);
  const posOf = (id: string): Pos | undefined => (has(id) ? positionAtFx(world.segs[id]!, now) : undefined);
  const nearIds = new Set(nearIdsOf(players, posOf, viewerId, ERRAND_NEAR_R * UNIT));
  const own = snapFrame(world, players.filter((p) => p.id === viewerId), now).ents;
  const near = [...players]
    .filter((p) => nearIds.has(p.id))
    .map((p) => {
      const t = truncateSegment(world.segs[p.id]!, now, ERRAND_VIEW_HORIZON_MS);
      return { s: p.seat, p: t.p, t0: t.t0, v: t.v };
    });
  const ents = [...own, ...near].sort((a, b) => a.s - b.s);
  return { t: "world", k: "snap", at: now, ents, near: true };
}
