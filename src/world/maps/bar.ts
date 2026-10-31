// 재즈 바 장면 (RED 스텁: 빈 장면)
import { DirectionalLight, Group, HemisphereLight, Mesh, PointLight, Scene } from "three";
import type { Budget, LightingPhase } from "../renderer";

const tune = { hemi: 0, moon: 0, sky: ["", "", ""] as [string, string, string] };
export const LIGHT_TUNE: Record<LightingPhase, typeof tune> = { talk: tune, vote: tune };

export interface MarkerRing {
  group: Group;
  ring: Mesh;
  outline: Mesh;
}
export interface BarScene {
  root: Scene;
  lights: { hemi: HemisphereLight; moon: DirectionalLight; stage: PointLight; pendantA: PointLight; pendantB: PointLight };
  meshes: Record<string, Mesh>;
  markers: { ring: MarkerRing; cue: MarkerRing };
  plate: Mesh;
  setLighting(phase: LightingPhase): void;
  dispose(): void;
}

export function buildBarScene(_budget: Budget): BarScene {
  const empty = (): MarkerRing => ({ group: new Group(), ring: new Mesh(), outline: new Mesh() });
  return {
    root: new Scene(),
    lights: { hemi: new HemisphereLight(), moon: new DirectionalLight(), stage: new PointLight(), pendantA: new PointLight(), pendantB: new PointLight() },
    meshes: {},
    markers: { ring: empty(), cue: empty() },
    plate: new Mesh(),
    setLighting() {},
    dispose() {},
  };
}
