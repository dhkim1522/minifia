// 서버 시계 오프셋 추정과 남은 시간 계산(GAME-01 표시용). 순수 함수라 fake timer 없이 테스트한다.

/** t0 보낸 로컬 시각, t1 받은 로컬 시각, serverNow 서버가 답에 실은 시각 */
export interface ClockSample {
  t0: number;
  t1: number;
  serverNow: number;
}

/** 서버시각 − 로컬시각. 왕복이 가장 짧은 표본이 가장 정확하다. 표본이 없으면 0. */
export function estimateOffset(samples: readonly ClockSample[]): number {
  let best: ClockSample | undefined;
  for (const s of samples) {
    if (best === undefined || s.t1 - s.t0 < best.t1 - best.t0) best = s;
  }
  if (best === undefined) return 0;
  const rtt = best.t1 - best.t0;
  return best.serverNow + rtt / 2 - best.t1;
}

/** 마감 시각(서버 시각)까지 남은 ms. 0 아래로 내려가지 않는다. */
export function remainingMs(deadline: number, offset: number, localNow: number = Date.now()): number {
  return Math.max(0, deadline - (localNow + offset));
}
