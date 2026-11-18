// 맵 장면 공통 인터페이스(MAP-06, 결정 D-22). 재즈 바의 BarScene에 선택적 프레임 갱신 훅을 더한다.
// 렌더러(threeRenderer)는 이 모양만 안다 — 맵을 늘리려면 장면 빌더를 하나 더 만들어 렌더러의 mapId 선택에 등록한다.
import type { BarScene } from "./bar";

export type MapScene = BarScene & {
  /** 매 프레임 호출(선택). dt 는 초, t 는 단조 증가하는 초. 광장 시계 바늘이 쓴다 */
  update?(dt: number, t: number): void;
};
