// 결정 0059 의 예측·섞기 순수 계산(RED 껍데기).
import type { MapDef } from "../../shared/game/map";
import type { Segment } from "../../shared/game/world";

export function predictSegment(_base: Segment | undefined, _dest: { x: number; z: number }, _at: number, _map?: MapDef): Segment | null {
  return null;
}
