// 동작(몸짓) 순수 규칙(10-01, 결정 D-3·D-10·D-19, 미결 O-1).
// 순수 모듈이다: 시각·난수를 읽지 않고 입력을 바꾸지 않으며, DOM·workerd API 가 없다(앱·워커 두 tsconfig 에 모두 들어간다).
import type { EmoteId } from "../protocol";

/**
 * 동작 재생 길이(ms). src/world/characterData.ts 의 EMOTES 표에서 (프레임 수 × seg × cycles + hold) × 1000 을 반올림한 값이다.
 * 서버는 장면 데이터를 import 하지 않는다(three 의존 없음) — 표가 바뀌면 test/unit/emote.test.ts 가 어긋남을 잡는다.
 */
export const EMOTE_MS: Readonly<Record<EmoteId, number>> = {
  throat: 1780,
  deny: 1320,
  clap: 1280,
  cry: 1760,
  handshake: 1380,
  point: 1700,
  praise: 1280,
  surprise: 1060,
  dance: 2080,
};

/** 앞 동작이 끝난 뒤에도 마지막 수락과 이 간격(ms)이 지나야 다음 동작을 받는다(O-1 기본값). */
export const EMOTE_MIN_GAP_MS = 1000;
/** 연타 창(ms)과 창 안 최대 수락 수(O-1 기본값): 10초에 5번. */
export const EMOTE_BURST_WINDOW_MS = 10_000;
export const EMOTE_BURST_MAX = 5;

/** 사람별 동작 기록: 재생이 끝나는 시각과 창 안 수락 시각들. 서버 인메모리에만 있고 저장하지 않는다. */
export interface EmoteSenderState {
  until: number;
  at: readonly number[];
}

/**
 * 동작을 받아들일지 정한다. 어기면 조용히 버린다(오류 신호 없음, L30). 검사 순서: 앞 동작 진행 중 → 최소 간격 → 10초 창 개수.
 * 기록 갱신은 수락 때만이다 — 거절하면 next 를 만들지 않는다. 시각은 인자로 받는다(순수).
 */
export function emoteGate(
  prev: EmoteSenderState | undefined,
  id: EmoteId,
  now: number,
): { ok: true; next: EmoteSenderState } | { ok: false } {
  const recent = prev === undefined ? [] : prev.at.filter((t) => t > now - EMOTE_BURST_WINDOW_MS);
  if (prev !== undefined) {
    if (now < prev.until) return { ok: false };
    const last = prev.at.length === 0 ? Number.NEGATIVE_INFINITY : Math.max(...prev.at);
    if (now - last < EMOTE_MIN_GAP_MS) return { ok: false };
    if (recent.length >= EMOTE_BURST_MAX) return { ok: false };
  }
  return { ok: true, next: { until: now + EMOTE_MS[id], at: [...recent, now] } };
}
