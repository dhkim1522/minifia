// 맵 장면 공통 인터페이스(MAP-06, 결정 D-22). 재즈 바(bar.ts)가 먼저 만든 BarScene 을 모양의 원천으로 삼고,
// 맵마다 다른 두 가지만 느슨하게 둔다: 펜던트 둘째 점광원은 없을 수 있고(광장은 가로등 하나), 매 프레임 갱신 훅(광장 시계 바늘)은 선택이다.
// 렌더러(threeRenderer)는 이 모양만 안다 — 맵을 늘리려면 장면 빌더를 하나 더 만들어 렌더러의 mapId 선택에 등록한다.
import type { PointLight } from "three";
import type { BarScene } from "./bar";

export type MapScene = Omit<BarScene, "lights"> & {
  lights: Omit<BarScene["lights"], "pendantB"> & { pendantB?: PointLight };
  /** 매 프레임 호출(선택). dt 는 초, t 는 단조 증가하는 초. 광장 시계 바늘이 쓴다 */
  update?(dt: number, t: number): void;
};
