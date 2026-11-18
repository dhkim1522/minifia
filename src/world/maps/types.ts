// 맵 장면 공통 인터페이스(MAP-06, 결정 D-22). 프레임 갱신 훅에서 조명과 광장의 시계를 움직인다.
// 렌더러(threeRenderer)는 이 모양만 안다 — 맵을 늘리려면 장면 빌더를 하나 더 만들어 렌더러의 mapId 선택에 등록한다.
import type { BarScene } from "./bar";

export type MapScene = BarScene;
