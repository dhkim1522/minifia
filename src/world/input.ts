// 탭 판정(순수). 시각은 인자로만 받는다 — 이 파일은 Date.now() 를 부르지 않는다(UI-SPEC "터치해서 걷기" 1번).
//
// 탭 = 10px 이상 움직이지 않고 350ms 넘게 누르지 않은 한 손가락. 두 번째 손가락은 첫 손가락이 떼어질 때까지 무시한다.
// 마우스 클릭도 같다. 탭 간격 150ms 는 서버 속도 제한(MOVE_MIN_GAP_MS)과 같은 값이라 화면에서 먼저 걸러 보이지 않게 둔다.

/** 이 거리(px) 이상 움직이면 탭이 아니다 */
export const TAP_SLOP_PX = 10;
/** 이 시간(ms)을 넘기면 탭이 아니다 */
export const TAP_MAX_MS = 350;
/** 탭과 탭 사이 최소 간격(ms) */
export const TAP_MIN_GAP_MS = 150;

export interface TapPoint {
  x: number;
  y: number;
}

export interface TapTracker {
  down(id: number, x: number, y: number, t: number): void;
  move(id: number, x: number, y: number): void;
  /** 뗐을 때 탭이면 뗀 자리를, 아니면 null */
  up(id: number, x: number, y: number, t: number): TapPoint | null;
  cancel(id: number): void;
}

export function createTapTracker(): TapTracker {
  let active: { id: number; x0: number; y0: number; t0: number; moved: boolean } | null = null;

  const exceeds = (x: number, y: number): boolean => {
    if (active === null) return false;
    const dx = x - active.x0;
    const dy = y - active.y0;
    return dx * dx + dy * dy >= TAP_SLOP_PX * TAP_SLOP_PX;
  };

  return {
    down(id, x, y, t) {
      if (active !== null) return; // 두 번째 손가락은 무시
      active = { id, x0: x, y0: y, t0: t, moved: false };
    },
    move(id, x, y) {
      if (active === null || active.id !== id) return;
      if (exceeds(x, y)) active.moved = true; // 나갔다 돌아와도 탭이 아니다
    },
    up(id, x, y, t) {
      if (active === null || active.id !== id) return null;
      const a = active;
      active = null;
      if (a.moved) return null;
      const dx = x - a.x0;
      const dy = y - a.y0;
      if (dx * dx + dy * dy >= TAP_SLOP_PX * TAP_SLOP_PX) return null;
      if (t - a.t0 > TAP_MAX_MS) return null;
      return { x, y };
    },
    cancel(id) {
      if (active !== null && active.id === id) active = null;
    },
  };
}

export interface TapGate {
  /** 받으면 true 이고 시계를 t 로 옮긴다. 거절하면 시계는 그대로다 */
  accept(t: number): boolean;
}

export function createTapGate(minGapMs: number = TAP_MIN_GAP_MS): TapGate {
  let last = -Infinity;
  return {
    accept(t) {
      if (t - last < minGapMs) return false;
      last = t;
      return true;
    },
  };
}
