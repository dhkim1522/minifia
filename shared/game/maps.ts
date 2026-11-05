// 맵 표와 선택 규칙(MAP-06, 결정 D-20·D-21·D-22) — 순수 모듈: 시각·난수는 인자로만 받는다.
// 맵은 MAPS 표에 한 줄을 등록하면 늘어난다. 서버의 이동 판정은 방의 맵(roomMapId → mapOf)을 읽고, 클라이언트는 view.map 으로 같은 표를 읽는다.
import type { MapChoice, MapId } from "../protocol";
import { BAR_MAP } from "./map";
import type { MapDef } from "./map";
import { PLAZA_MAP } from "./mapPlaza";
import type { RoomState } from "./room";

/** 맵 표(결정 D-22). 맵을 늘리려면 MapId 에 id 를 더하고 여기에 한 줄을 등록한다 — Record 라 빠뜨리면 컴파일이 실패한다. */
export const MAPS: Readonly<Record<MapId, MapDef>> = { bar: BAR_MAP, plaza: PLAZA_MAP };

/** id 의 맵. */
export function mapOf(id: MapId): MapDef {
  return MAPS[id];
}

/**
 * 지금 게임에서 고를 수 있는(그리고 random 이 뽑을 수 있는) 맵. 11-13 에서 선택 화면 E2E(map-select)가 통과한 뒤 광장을 열었다.
 * 한 곳에서 광장 노출을 잠근다 — 광장이 불안하면 ["bar"] 한 줄로 되돌린다(칩·시트 탭은 둘 이상일 때만 그려진다).
 */
export const PLAYABLE_MAPS: readonly MapId[] = ["bar", "plaza"];

/**
 * 시작 때 서버가 맵을 정한다(D-21). choice 가 id 면 playable 에 있을 때만 그 id, 없으면 playable[0].
 * random 이면 playable 이 둘 이상일 때만 randInt(playable.length) 로 고른다 — 하나뿐이면 난수를 부르지 않는다(기존 시드 시험 불변).
 */
export function decideMap(choice: MapChoice, randInt: (n: number) => number, playable: readonly MapId[] = PLAYABLE_MAPS): MapId {
  const first = playable[0] ?? "bar";
  if (choice !== "random") return playable.includes(choice) ? choice : first;
  if (playable.length <= 1) return first;
  return playable[randInt(playable.length)] ?? first;
}

/**
 * 방장의 맵 선택(D-20). 방장만, 대기실 또는 결과 단계에서만, 값이 random 이거나 playable 에 있을 때만.
 * 같은 값이면 입력 그대로를 돌려준다(저장·전송을 건너뛰는 근거). 거절은 사유를 구별하지 않는다 — 응답이 같아야 오라클이 되지 않는다(L40).
 */
export function pickMap(
  state: RoomState,
  actorId: string,
  choice: MapChoice,
  playable: readonly MapId[] = PLAYABLE_MAPS,
): { ok: true; state: RoomState } | { ok: false } {
  if (actorId !== state.hostId) return { ok: false };
  if (state.phase !== "lobby" && state.phase !== "ended") return { ok: false };
  if (choice !== "random" && !playable.includes(choice)) return { ok: false };
  if ((state.mapChoice ?? "random") === choice) return { ok: true, state };
  return { ok: true, state: { ...state, mapChoice: choice } };
}

/** 방의 지금 맵: 대기실은 늘 bar(D-22), 시작한 뒤에는 state.map(없으면 bar). */
export function roomMapId(state: Pick<RoomState, "phase" | "map">): MapId {
  return state.phase === "lobby" ? "bar" : (state.map ?? "bar");
}
