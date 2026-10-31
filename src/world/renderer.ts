// 렌더러 인터페이스·예산·강등 사다리. three 는 `import type` 만 쓴다 — 이 파일은 정적 import 경로(메인 번들)에 있어도
// three 본체를 끌고 오지 않는다. three 를 값으로 쓰는 모듈은 threeRenderer.ts·threeCamera.ts·maps/ 이고 06-13 이 import() 로만 연다.
import type { Object3D } from "three";

export type LightingPhase = "talk" | "vote";

export interface Budget {
  /** 화면 배율 상한(장치 배율과 작은 쪽을 쓴다) */
  dpr: number;
  shadowMap: 0 | 512 | 1024;
  lights: "full" | "core";
  props: "full" | "reduced";
  fog: boolean;
  glows: boolean;
}

export const LADDER: readonly Budget[] = [{ dpr: 2, shadowMap: 1024, lights: "full", props: "full", fog: true, glows: true }];
export const DEFAULT_BUDGET_STEP = 0;
/** 장면 전체 그리기 호출 상한(UI-SPEC 렌더 성능 게이트) */
export const DRAW_CALL_BUDGET = 120;

export interface CharacterHandle {
  root: Object3D;
  update(dt: number, t: number, moving: boolean): { headY: number };
  setYaw(yaw: number): void;
  setDim(on: boolean): void;
  dispose(): void;
}
/** 06-11 의 characterKit 이 구조적으로 맞춘다 */
export interface CharacterKit {
  create(figIndex: number, outfitId: string): CharacterHandle;
}

export type MarkerKind = "ring" | "cue";
export interface RendererStats {
  calls: number;
  triangles: number;
  geometries: number;
  textures: number;
  programs: number;
  pointLights: number;
}
export class UnsupportedRendererError extends Error {}

export type RendererStatusEvent = { t: "lost" } | { t: "restored" } | { t: "recreated" };

export interface WorldRenderer {
  readonly canvas: HTMLCanvasElement;
  resize(w: number, h: number): void;
  setView(target: { x: number; z: number }, offsetY: number): void;
  setLighting(phase: LightingPhase): void;
  addCharacter(seat: number, c: CharacterHandle): void;
  removeCharacter(seat: number): void;
  setMarker(kind: MarkerKind, at: { x: number; z: number } | null, scale: number, opacity: number): void;
  project(p: { x: number; y: number; z: number }): { sx: number; sy: number };
  groundAt(sx: number, sy: number): { x: number; z: number };
  render(): void;
  setBudget(step: number): void;
  onStatus(cb: (e: RendererStatusEvent) => void): () => void;
  /** 새 캔버스 + 새 WebGLRenderer, 같은 씬 재사용 */
  recreate(): Promise<void>;
  isContextLost(): boolean;
  info(): RendererStats;
  /** WEBGL_lose_context (테스트 훅이 ?e2e=1 에서만 노출 — 06-13) */
  debugLoseContext(): void;
  debugRestoreContext(): void;
  /** 씬 자원 dispose + renderer.dispose() + forceContextLoss() + 캔버스 제거 */
  dispose(): void;
}

/** 자동 강등을 멈추는 단계: 0→1→2→3 까지만 자동이고 4 이상은 사람 결정이다 */
export const AUTO_LADDER_MAX = 3;
/** 10초 평균이 이 값 미만이면 한 단계 내린다 */
export const AUTO_DEGRADE_FPS = 45;

/** 자동 강등 판정. 10초 평균이 45fps 미만이고 아직 3단계 미만이면 한 단계만 내린다. 되돌리지 않고, 4단계 이상은 올리지 않는다 */
export function nextLadderStep(step: number, avgFps10s: number): number {
  return avgFps10s < AUTO_DEGRADE_FPS && step < AUTO_LADDER_MAX ? step + 1 : step;
}
