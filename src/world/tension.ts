// 시민 편 긴장 연출 스케줄러 (NIGHT-10, UI-SPEC A3 ①).
// 입력은 난수 함수·타이머 함수·모션 줄이기뿐이다. 서버 프레임·서버 시각·마피아 수·방 시드와 끊겨 있다(결정 0061-15, L3).
// 이 모듈은 아무것도 import 하지 않는다(정적 검사 시험이 고정한다). 12페이즈 소리는 onCue 이벤트에 얹는다.
// 큐 시각은 밤 화면이 뜬 로컬 시각 기준 ms 다.

/** 맥박 한 바퀴(sdBeat) 길이 */
export const TENSION_BEAT_MS = 1300;
/** 첫 큐의 가장 이른 시각 — 밤 시작 5초 뒤 이후 */
export const TENSION_FIRST_MIN_MS = 5000;
/** 큐 사이 간격 범위 */
export const TENSION_GAP_MIN_MS = 4000;
export const TENSION_GAP_MAX_MS = 9000;
/** 큐 창 상한 — 밤 30초 안, 장면 전환 막보다 앞선다. 밤 길이 상수는 서버 모듈과 끊기 위해 가져오지 않는다 */
export const TENSION_WINDOW_MS = 28000;
/** 큐 개수 범위 */
export const TENSION_CUE_MIN = 2;
export const TENSION_CUE_MAX = 4;
/** 큐 때 세게 뛰는 최대 불투명도 */
export const TENSION_CUE_PEAK = 0.95;
/** 모션 줄이기일 때 고정 비네트 불투명도 */
export const TENSION_REDUCED_OPACITY = 0.4;

/** 첫 큐는 FIRST_MIN 에서 이만큼 안에서 고른다(첫 두 큐가 늘 창 안에 들게 하는 폭) */
const FIRST_SPREAD_MS = 4000;

/**
 * 난수만으로 큐 시각 목록을 만든다. 개수 2~4, 첫 큐 ≥ 5000, 간격 4000~9000.
 * 창(28초)을 넘는 큐는 버린다. 첫 두 큐는 항상 창 안이라 최소 2개가 남는다.
 */
export function planTensionCues(rng: () => number): number[] {
  const count = TENSION_CUE_MIN + Math.floor(rng() * (TENSION_CUE_MAX - TENSION_CUE_MIN + 1));
  const cues: number[] = [];
  let at = TENSION_FIRST_MIN_MS + Math.floor(rng() * FIRST_SPREAD_MS);
  for (let i = 0; i < count; i += 1) {
    if (i > 0) at += TENSION_GAP_MIN_MS + Math.floor(rng() * (TENSION_GAP_MAX_MS - TENSION_GAP_MIN_MS + 1));
    if (at >= TENSION_WINDOW_MS) break;
    cues.push(at);
  }
  return cues;
}

export interface TensionOptions {
  onCue: (atMs: number) => void;
  rng?: () => number;
  setTimer?: (fn: () => void, ms: number) => unknown;
  clearTimer?: (handle: unknown) => void;
  reducedMotion?: boolean;
}

export interface TensionHandle {
  stop(): void;
  cues: readonly number[];
}

/** 큐마다 타이머를 예약해 onCue(atMs) 를 낸다. 모션 줄이기면 하나도 예약하지 않는다. stop() 은 남은 타이머를 모두 지운다 */
export function startTension(opts: TensionOptions): TensionHandle {
  if (opts.reducedMotion === true) return { stop() {}, cues: [] };
  const rng = opts.rng ?? Math.random;
  const setTimer = opts.setTimer ?? ((fn: () => void, ms: number): unknown => setTimeout(fn, ms));
  const clearTimer = opts.clearTimer ?? ((h: unknown): void => clearTimeout(h as ReturnType<typeof setTimeout>));
  const cues = planTensionCues(rng);
  const handles = new Set<unknown>();
  for (const at of cues) {
    const h = setTimer(() => {
      handles.delete(h);
      opts.onCue(at);
    }, at);
    handles.add(h);
  }
  return {
    cues,
    stop() {
      for (const h of handles) clearTimer(h);
      handles.clear();
    },
  };
}
