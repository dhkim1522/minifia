// 장면 상태 순수 모듈 — GHOST-01·MAP-04·DAY-04·05, 08-UI-SPEC 카메라·단계 조명·유령.
// 순수: three·DOM 이 없고 입력은 서버 view 와 화면 연출 시각뿐이다. 결정 0002 — 화면은 받은 것만 그린다.
// (RED 단계 뼈대: 아직 동작을 구현하지 않는다)
import type { PhaseId, RoomView } from "../../shared/protocol";

export type LightingStage = "talk" | "vote" | "trial" | "night" | "morning";
export type CameraMode = { mode: "follow" } | { mode: "fixed"; target: { x: number; z: number }; zoom: number };
export interface Tension {
  level: 0 | 1 | 2;
  focus?: number;
}
export interface SeatLook {
  show: true;
  ghost: boolean;
  pointAt?: number;
  fadeAt?: number;
}
export interface SceneLook {
  camera: CameraMode;
  lighting: LightingStage;
  tension: 0 | 1 | 2;
  focusSeat?: number;
  seats: Record<number, SeatLook>;
}

export function visibleSeats(_view: RoomView, _fading?: ReadonlyMap<number, number>, _now?: number): Record<number, SeatLook> {
  return {};
}
export function cameraModeOf(_view: RoomView, _stageH: number): CameraMode {
  return { mode: "follow" };
}
export function lightingOf(_phase: PhaseId): LightingStage {
  return "talk";
}
export function tensionOf(_view: RoomView): Tension {
  return { level: 0 };
}
export function sceneLook(_view: RoomView, _opts: { stageH: number; fading?: ReadonlyMap<number, number>; now?: number; mine?: number }): SceneLook {
  return { camera: { mode: "follow" }, lighting: "talk", tension: 0, seats: {} };
}
