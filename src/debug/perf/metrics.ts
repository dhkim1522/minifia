// RED 껍데기
export const FRAME_CAPACITY = 0;
export class FrameRecorder {
  capacity = 0; length = 0; full = false;
  constructor(_n?: number) {}
  push(_d: number): boolean { return false; }
  frame(_t: number): void {}
  values(): Float32Array { return new Float32Array(0); }
  clear(): void {}
}
export function avgFps(_d: ArrayLike<number>): number { return -1; }
export function jankCount(_d: ArrayLike<number>): number { return -1; }
export function percentile(_s: ArrayLike<number>, _q: number): number { return -1; }
export function rafHzGuess(_m: number): { hz: number; lowPower: boolean } { return { hz: -1, lowPower: true }; }
export function thermalRatio(_a: number, _b: number): { ratio: number | null; suspect: boolean } { return { ratio: -1, suspect: true }; }
export function heartbeatVerdict(_s: unknown): "first" | "clean" | "crashed" { return "first"; }
export function summarizeFrames(_d: ArrayLike<number>): Record<string, any> { return {}; }
