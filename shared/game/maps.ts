// 재즈 바는 모든 방의 플레이 맵이다. 광장 데이터는 개발용 장면 측정에 사용한다.
import type { MapId } from "../protocol";
import { BAR_MAP } from "./map";
import type { MapDef } from "./map";
import { PLAZA_MAP } from "./mapPlaza";

export const ROOM_MAP_ID = "bar";

export const MAPS: Readonly<Record<MapId, MapDef>> = { bar: BAR_MAP, plaza: PLAZA_MAP };

/** id 의 맵. */
export function mapOf(id: MapId): MapDef {
  return MAPS[id];
}
