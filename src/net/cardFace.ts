// 역할 카드 면 전이(결정 0012). 순수 함수 — 시각은 인자로만 받고 상태는 새 객체로 돌려준다(clock.ts 규칙).
// 규칙: 사용자가 누르면 앞·뒤가 바뀌고 자동 뒤집기가 소진된다. 자동은 시작 5초에 한 번만.
// 5초 뒤에 들어온 사람은 앞면부터. 역할이 없는 뷰는 뒤집히지 않는다.

export interface CardState {
  face: "back" | "front";
  /** true 면 자동 뒤집기가 소진됐다(눌렀거나 자동이 한 번 돌았다) */
  locked: boolean;
  /** 앞면이 한 번이라도 됐다. [내 역할] 시트가 카드 뒷면만 보일지 정한다. */
  seenFront: boolean;
}

/** 역할 확인 시작 뒤 이 시간 안에 누르지 않으면 저절로 앞면이 된다. */
export const AUTO_FLIP_MS = 5_000;

// 서버 시각 = 로컬 시각 + 오프셋. 역할 확인 시작 t0 = 마감 − 단계 길이.
function serverNow(offset: number, localNow: number): number {
  return localNow + offset;
}

/** 역할 확인이 시작된 뒤 흐른 시간(서버 시각 기준). */
export function sinceStartMs(phaseEndsAt: number, phaseDurationMs: number, offset: number, localNow: number): number {
  const t0 = phaseEndsAt - phaseDurationMs;
  return serverNow(offset, localNow) - t0;
}

/** 자동 뒤집기까지 남은 시간. 이미 지났으면 0 이하. */
export function autoFlipDelayMs(phaseEndsAt: number, phaseDurationMs: number, offset: number, localNow: number): number {
  const t0 = phaseEndsAt - phaseDurationMs;
  return t0 + AUTO_FLIP_MS - serverNow(offset, localNow);
}

/** 처음 보여 줄 면. 5초 이후에 들어온 사람(재접속)은 앞면부터이고 자동 뒤집기는 이미 소진된 것으로 본다. */
export function initialCardState(sinceStart: number, hasRole: boolean): CardState {
  const late = hasRole && sinceStart >= AUTO_FLIP_MS;
  return { face: late ? "front" : "back", locked: late, seenFront: late };
}

/** 카드를 눌렀을 때. 역할이 없으면 그대로. */
export function onTap(s: CardState, hasRole: boolean): CardState {
  if (!hasRole) return s;
  const face = s.face === "back" ? "front" : "back";
  return { face, locked: true, seenFront: s.seenFront || face === "front" };
}

/** 시작 5초가 됐을 때. 이미 잠겼거나 역할이 없으면 그대로(자동은 한 번만). */
export function onAutoTimer(s: CardState, hasRole: boolean): CardState {
  if (s.locked || !hasRole) return s;
  return { face: "front", locked: true, seenFront: true };
}
