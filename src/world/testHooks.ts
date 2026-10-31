// E2E 훅 (RED 단계의 빈 껍데기 — 06-13 Task 3 GREEN 에서 채운다)
import type { StorageLike } from "../net/session";
import type { WorldRenderer } from "./renderer";
import type { MapStatusState } from "./status";
import type { WorldStore } from "./store";

export const WORLD_TEST_KEY = "minifia:e2e";

export interface WorldTestHooks {
  sample(seat: number, t?: number): { x: number; z: number } | null;
  seats(): number[];
  ring(): { x: number; z: number } | null;
  status(): MapStatusState["status"];
  interactiveMs(): number | null;
  screenOf(x: number, z: number): { sx: number; sy: number } | null;
  debug: { loseContext(): void; restoreContext(): void; info(): ReturnType<WorldRenderer["info"]> | null; recreate(): Promise<void> };
}

declare global {
  interface Window {
    __mfWorld?: WorldTestHooks;
  }
}

export interface HookRuntime {
  sample(seat: number, t?: number): { x: number; z: number } | null;
  ring(): { x: number; z: number } | null;
  status(): MapStatusState;
  interactiveMs(): number | null;
  renderer(): WorldRenderer | null;
}

export function worldTestHooksEnabled(_search: string, _storage: StorageLike | null, _dev = false): boolean {
  return false;
}

export function installWorldTestHooks(_runtime: HookRuntime, _store: WorldStore): () => void {
  return () => {};
}
