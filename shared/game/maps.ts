// 맵 표와 선택 규칙(MAP-06, 결정 D-20·D-21·D-22) — 순수 모듈: 시각·난수는 인자로만 받는다.
// 맵은 MAPS 표에 한 줄을 등록하면 늘어난다. 서버의 이동 판정은 방의 맵(roomMapId → mapOf)을 읽고, 클라이언트는 view.map 으로 같은 표를 읽는다.
import type { GameMode, MapChoice, MapId } from "../protocol";
import { BAR_MAP } from "./map";
import type { MapDef } from "./map";
import { PLAZA_MAP } from "./mapPlaza";
import { TOWN_MAP } from "./mapTown";
import type { RoomState } from "./room";

/** 맵 표(결정 D-22). 맵을 늘리려면 MapId 에 id 를 더하고 여기에 한 줄을 등록한다 — Record 라 빠뜨리면 컴파일이 실패한다. */
export const MAPS: Readonly<Record<MapId, MapDef>> = { bar: BAR_MAP, plaza: PLAZA_MAP, town: TOWN_MAP };

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

/**
 * 판 종류의 고정 맵(20페이즈 D-02): 확장판 판은 방장 선택과 상관없이 늘 마을에서 시작한다. 기본 마피아는 칸이 없어 방장 선택(decideMap)대로다.
 * PLAYABLE_MAPS 처럼 한 곳에서 바꾸는 표다 — town 은 PLAYABLE_MAPS 에 넣지 않는다(맵 카드·칩에 나오지 않는다, UI-SPEC P20-16).
 * 시험은 이 표의 extended 칸을 지워 잠그고(test/unit/setup.ts·test/worker/setup.ts), 마을이 필요한 시험만 test/helpers/playable.ts 의 openTown() 으로 켠다.
 */
export const MODE_MAPS: Partial<Record<GameMode, MapId>> = { extended: "town" };

/** 시작하는 판의 맵: 판 종류의 고정 맵이 있으면 그 값, 없으면 decideMap 이 정한 값 그대로. 난수를 부르지 않는다 — decideMap 을 먼저 불러 난수 순서를 그대로 둔다(beginGame). */
export function startMapOf(mode: GameMode, decided: MapId): MapId {
  return (Object.hasOwn(MODE_MAPS, mode) ? MODE_MAPS[mode] : undefined) ?? decided;
}

/** 방의 지금 맵: 대기실은 늘 bar(D-22, 20페이즈 D-03 — 확장판 방의 대기실도 재즈 바다), 시작한 뒤에는 state.map(없으면 bar). */
export function roomMapId(state: Pick<RoomState, "phase" | "map">): MapId {
  return state.phase === "lobby" ? "bar" : (state.map ?? "bar");
}
