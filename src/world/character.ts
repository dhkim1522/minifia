// 06-11 RED 단계 뼈대 — 구현은 GREEN 커밋에서 채운다.
import type { Group } from "three";

export const CHAR_SCALE = 0.83;
export const WALK_PHASE_RATE = 0;

export interface WorldCharacter {
  root: Group;
  update(dt: number, t: number, moving: boolean): { headY: number };
  setYaw(yaw: number): void;
  meshCount(): number;
}

export function createCharacter(_figIndex: number, _outfit?: string): WorldCharacter {
  throw new Error("not implemented");
}
export function figForSeat(_seat: number): number {
  return -1;
}
export const characterKit = {
  create(_figIndex: number, _outfitId: string): WorldCharacter {
    throw new Error("not implemented");
  },
};
