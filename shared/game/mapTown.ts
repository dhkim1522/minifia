// 마을 맵 이동 데이터(20페이즈 D-05~D-08) — 자리 값(RED): 구현 전이라 마스크는 모두 막힘이고 표는 비어 있다.
import type { RoomId } from "../protocol";
import { STAGE_SPOT, parseMask } from "./map";
import type { MapDef, Obstacle, PlaceDef, RoomDef, Spawn } from "./map";
import { PLAZA_SPAWNS } from "./mapPlaza";

/** 집 한 채(좌석 n 의 집, D-07). 들어갈 수 없다. face 는 문 있는 면(광장 쪽), front 는 문 앞 목적지(고정소수점). */
export interface HouseDef {
  seat: number;
  x: number;
  z: number;
  face: "n" | "s" | "e" | "w";
  front: { x: number; z: number };
}

export const TOWN_ROOMS: readonly RoomDef[] = [];
export const TOWN_HOUSES: readonly HouseDef[] = [];
export const TOWN_PROPS: readonly Obstacle[] = [];
export const TOWN_OBSTACLES: readonly Obstacle[] = [];
const NO_RECT = { x0: 0, z0: 0, x1: 0, z1: 0 };
export const TOWN_DOOR_EXEMPT: Readonly<Record<RoomId, { x0: number; z0: number; x1: number; z1: number }>> = { post: NO_RECT, pub: NO_RECT, clinic: NO_RECT, police: NO_RECT };
export const TOWN_SPAWNS: readonly Spawn[] = PLAZA_SPAWNS;
export const TOWN_PLACES: readonly PlaceDef[] = [];
export const TOWN_MASK: readonly string[] = Array.from({ length: 48 }, () => "#".repeat(48));
export const TOWN_MAP: MapDef = { id: "town", size: 48, origin: -12, walkHalf: 10, mask: parseMask(TOWN_MASK), spawns: TOWN_SPAWNS, stage: STAGE_SPOT, places: TOWN_PLACES, rooms: TOWN_ROOMS };
