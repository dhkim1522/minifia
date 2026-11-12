// 구역 판정(20페이즈 D-13·D-14) — 순수 모듈: 시각·난수를 읽지 않고 삼각함수 없이 사칙연산만 쓴다.
// 구역은 위치의 순수 함수다: 방 안쪽 사각형의 엄격한 안쪽이면 그 방, 그 밖(문턱·벽·광장·골목)은 plaza.
import type { ZoneId } from "../protocol";
import type { MapDef } from "./map";
import type { Segment } from "./world";

/** 자리 함수(RED): 구현 전. */
export function zoneOf(_map: Pick<MapDef, "rooms">, _xFx: number, _zFx: number): ZoneId {
  return "plaza";
}

/** 자리 함수(RED): 구현 전. */
export function zoneAt(_map: Pick<MapDef, "rooms">, _seg: Segment, _t: number): ZoneId {
  return "plaza";
}

/** 자리 함수(RED): 구현 전. */
export function clipToZone(_map: Pick<MapDef, "rooms">, seg: Segment, _from: number): Segment {
  return seg;
}
