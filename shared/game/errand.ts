// 심부름 규칙(15페이즈, 결정 0074 예정) — 순수 모듈: 시각·난수는 인자로만 받고 입력 상태를 바꾸지 않는다.
// 심부름 목록은 모든 역할이 같다(D-03): 이 파일은 역할·연결 상태를 읽지 않는다. 마피아도 같은 모양·같은 개수의 목록을 받고
// 같은 처리 규칙을 지난다(가짜 목록, 방해 행동 없음). 역할만 다른 두 방이 같은 시드로 같은 목록을 얻는 것이 그 증거다.
// 처리 거절은 사유를 가르지 않고 { ok: false } 하나다(D-08) — 응답이 오라클이 되지 않는다.
import { PLACE_IDS } from "../protocol";
import type { PlaceId } from "../protocol";
import { isAlive } from "./alive";
import { UNIT } from "./map";
import type { MapDef } from "./map";
import { mapOf, roomMapId } from "./maps";
import { ERRAND_ACT_R, ERRAND_COUNT } from "./phases";
import type { RoomState } from "./room";

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
 * 죽은 사람은 두 키를 지운다. 난수 호출 순서가 계약이다: seat 오름차순 산 사람, 사람마다 k = 0..count-1 순서로 randInt(n - k).
 */
export function enterErrand(state: RoomState, randInt: RandInt): RoomState {
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
  return {
    ...state,
    players: state.players.map((p) => {
      const { errandPlaces: _places, errandDone: _done, ...kept } = p;
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
    if (done.includes(id)) continue;
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
