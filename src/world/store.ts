// RED 단계의 뼈대 — 동작은 GREEN 에서 채운다.
import type { Segment } from "../../shared/game/world";
import type { WorldFrame } from "../../shared/protocol";

export type WorldStoreListener = () => void;

export class WorldStore {
  applyFrame(_frame: WorldFrame, _epoch: number): void {}
  reset(): void {}
  isReady(): boolean {
    return false;
  }
  seats(): number[] {
    return [];
  }
  segOf(_seat: number): Segment | undefined {
    return undefined;
  }
  positionOf(_seat: number, _serverNow: number): { x: number; z: number } | null {
    return null;
  }
  subscribe(_cb: WorldStoreListener): () => void {
    return () => {};
  }
}
