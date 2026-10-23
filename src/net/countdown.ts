// RED 뼈대: GREEN 에서 채운다.
export const URGENT_MS = 5_000;

export function countdown(_endsAt: number, _durationMs: number, _offset: number, _localNow: number) {
  return { remainingMs: -1, seconds: -1, urgent: false, ratio: -1 };
}

export function formatMmSs(_seconds: number): string {
  return "";
}

export function useCountdown(endsAt: number, durationMs: number, offset: number) {
  return countdown(endsAt, durationMs, offset, 0);
}
