// 맵 장면 공통 인터페이스(MAP-06, 결정 D-22). 재즈 바(bar.ts)가 먼저 만든 BarScene 을 모양의 원천으로 삼고,
// 맵마다 다른 두 가지만 느슨하게 둔다: 펜던트 둘째 점광원은 없을 수 있고(광장은 가로등 하나), 매 프레임 갱신 훅(광장 시계 바늘)은 선택이다.
// 렌더러(threeRenderer)는 이 모양만 안다 — 맵을 늘리려면 장면 빌더를 하나 더 만들어 렌더러의 mapId 선택에 등록한다.
import type { PointLight } from "three";
import type { RoomId } from "../../../shared/protocol";
import type { BarScene } from "./bar";

export type MapScene = Omit<BarScene, "lights"> & {
  lights: Omit<BarScene["lights"], "pendantB"> & { pendantB?: PointLight };
  /** 매 프레임 호출(선택). dt 는 초, t 는 단조 증가하는 초. 광장 시계 바늘이 쓴다 */
  update?(dt: number, t: number): void;
  /**
   * 방 컷어웨이(선택, 마을만 — 20페이즈 D-10·P20-7). open 에 든 방은 지붕·앞벽·간판이 걷히고(불투명도 0) 나머지는 덮인다(1).
   * instant 가 아니면 update 틱이 0.25초에 따라간다(도중에 바뀌면 지금 값에서 이어감). 언제 걷을지는 런타임이 정한다
   */
  setCutaway?(open: ReadonlySet<RoomId>, instant: boolean): void;
  /** 집 주인(선택, 마을만 — D-07). 이번 판에 앉은 좌석 번호들. 주인 있는 집만 창이 켜지고 문패·지붕 표식에 좌석 색 원 + 얼굴이 뜬다 */
  setOwners?(seats: readonly number[]): void;
  /** 방마다 지금 지붕 불투명도(선택, 마을만). 1 = 덮임, 0 = 걷힘. 시험 훅이 읽는다 */
  roofs?(): Readonly<Record<RoomId, number>>;
  /**
   * 켜진 당번 가로등(선택, 마을만 — 21페이즈 D-06·D-24). lit = 지금 켜진 모양으로 그릴 가로등 번호(좌석 번호와 같다). 켜짐은 0.4초, 꺼짐은 0.8초에 따라가고(update 틱),
   * instant 면 바로 놓는다. 부른 적이 없으면 창은 20페이즈 그대로 주인만 따른다. 창은 주인 ∧ lit 인 집만 켜진다
   */
  setLamps?(lit: readonly number[], instant: boolean): void;
  /** 아침 현장 단서 decal(선택, 마을만 — D-13·D-26). house = 현장 집의 좌석 번호, null 이면 없음. 0.3초에 나타나고 instant 면 바로 */
  setClue?(house: number | null, instant: boolean): void;
};
