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

/**
 * 강등 사다리(UI-SPEC "미달 때 줄이는 순서" 1~5 를 누적으로). 0 = 기본. 그림자 끔(shadowMap 0)은 사다리에 없다 — 사람 결정으로만.
 *  1 배율 1.5 · 2 배율 1.25 + 그림자 512 · 3 점광원 core(무대 위만, 펜던트는 emissive) · 4 소품 reduced(먼 소품 제거) · 5 안개·빛 무리 끔.
 * 6단계(맵을 미리 구운 이미지로)는 렌더러 교체라 이 표에 없다(결정 0046 탈출구).
 */
export const LADDER: readonly Budget[] = [
  { dpr: 2, shadowMap: 1024, lights: "full", props: "full", fog: true, glows: true },
  { dpr: 1.5, shadowMap: 1024, lights: "full", props: "full", fog: true, glows: true },
  { dpr: 1.25, shadowMap: 512, lights: "full", props: "full", fog: true, glows: true },
  { dpr: 1.25, shadowMap: 512, lights: "core", props: "full", fog: true, glows: true },
  { dpr: 1.25, shadowMap: 512, lights: "core", props: "reduced", fog: true, glows: true },
  { dpr: 1.25, shadowMap: 512, lights: "core", props: "reduced", fog: false, glows: false },
];
export const DEFAULT_BUDGET_STEP = 0;
/** 장면 전체 그리기 호출 상한(UI-SPEC 렌더 성능 게이트) */
export const DRAW_CALL_BUDGET = 120;

export interface CharacterHandle {
  root: Object3D;
  update(dt: number, t: number, moving: boolean): { headY: number };
  setYaw(yaw: number): void;
  setDim(on: boolean): void;
  /** 유령(반투명) 켜기/끄기 — 시험 가짜 객체 호환을 위해 optional (08-10) */
  setGhost?(on: boolean, opacity?: number): void;
  setOpacity?(alpha: number): void;
  /** 손가락 유지 자세·발밑 고리 — optional (08-10) */
  holdPose?(id: "point" | null): void;
  setRing?(color: string | null): void;
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

/** 화면 배율: 장치 배율과 단계 상한 중 작은 쪽 */
export function pixelRatioFor(budget: Budget, deviceDpr: number): number {
  return Math.min(deviceDpr, budget.dpr);
}

/** 자동 강등을 멈추는 단계: 0→1→2→3 까지만 자동이고 4 이상은 사람 결정이다 */
export const AUTO_LADDER_MAX = 3;
/** 10초 평균이 이 값 미만이면 한 단계 내린다 */
export const AUTO_DEGRADE_FPS = 45;

/** 자동 강등 판정. 10초 평균이 45fps 미만이고 아직 3단계 미만이면 한 단계만 내린다. 되돌리지 않고, 4단계 이상은 올리지 않는다 */
export function nextLadderStep(step: number, avgFps10s: number): number {
  return avgFps10s < AUTO_DEGRADE_FPS && step < AUTO_LADDER_MAX ? step + 1 : step;
}
