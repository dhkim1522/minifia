// RED 단계의 자리표시 구현. 다음 커밋(feat)에서 채운다.
export interface ClockSample {
  t0: number;
  t1: number;
  serverNow: number;
}

export function estimateOffset(_samples: readonly ClockSample[]): number {
  return 0;
}

export function remainingMs(_deadline: number, _offset: number, _localNow: number = Date.now()): number {
  return 0;
}
