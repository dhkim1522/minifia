// RED 껍데기 — 구현은 GREEN 커밋에서 채운다
import type { MapDef } from "../../../shared/game/map";
export interface ScenarioOptions { seed: number; chars: number; map: MapDef }
export type ScenarioEvent =
  | { kind: "move"; at: number; seat: number; p: number[]; t0: number; v: number }
  | { kind: "emote"; at: number; seat: number; id: "clap" | "deny" };
export interface Scenario { initial(): { s: number; p: number[]; t0: number; v: number }[]; advance(untilMs: number): ScenarioEvent[] }
export interface PerfParams { scene: "talk" | "vote"; minutes: number; dpr: number | null; budget: number; seed: number; chars: number; shot: boolean; nav: boolean }
export function mulberry32(_seed: number): () => number { return () => 0; }
export function createScenario(_o: ScenarioOptions): Scenario { return { initial: () => [], advance: () => [] }; }
export function parsePerfParams(_p: URLSearchParams): PerfParams { return { scene: "vote", minutes: 0, dpr: 0, budget: 0, seed: 0, chars: 0, shot: true, nav: true }; }
