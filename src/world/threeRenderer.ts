// three 구현 (RED 스텁)
import type { WorldRenderer } from "./renderer";

export function createThreeRenderer(_opts: { host: HTMLElement; width: number; height: number; budgetStep: number; allowSoftware: boolean }): Promise<WorldRenderer> {
  return Promise.reject(new Error("not implemented"));
}
