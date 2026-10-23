// RED 뼈대: GREEN 에서 채운다.
export interface CardState {
  face: "back" | "front";
  locked: boolean;
  seenFront: boolean;
}

export const AUTO_FLIP_MS = 5_000;

export function sinceStartMs(_phaseEndsAt: number, _phaseDurationMs: number, _offset: number, _localNow: number): number {
  return Number.NaN;
}

export function autoFlipDelayMs(_phaseEndsAt: number, _phaseDurationMs: number, _offset: number, _localNow: number): number {
  return Number.NaN;
}

export function initialCardState(_sinceStart: number, _hasRole: boolean): CardState {
  return { face: "front", locked: false, seenFront: false };
}

export function onTap(s: CardState, _hasRole: boolean): CardState {
  return s;
}

export function onAutoTimer(s: CardState, _hasRole: boolean): CardState {
  return s;
}
