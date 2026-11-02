// 결정 0059 의 예측·섞기 순수 계산. 시각은 모두 인자이고 three·DOM·Date 를 쓰지 않는다.
// 서버 위치의 진실은 그대로 서버 구간이고(결정 0002), 여기는 화면에만 쓰는 계산이다.
import type { MapDef } from "../../shared/game/map";
import { BAR_MAP } from "../../shared/game/map";
import type { Segment } from "../../shared/game/world";
import { planMoveSegment } from "../../shared/game/world";

/**
 * 내 탭의 예측 구간: 서버가 같은 시각에 같은 목적지를 받았을 때 만드는 구간(같은 공용 본체, 결정 0059-1).
 * base(지금 내 구간)가 없으면 null.
 */
export function predictSegment(base: Segment | undefined, dest: { x: number; z: number }, at: number, map: MapDef = BAR_MAP): Segment | null {
  if (base === undefined) return null;
  return planMoveSegment(base, dest, at, map);
}
