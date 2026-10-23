// 남은 시간 계산과 표시 훅(GAME-01 표시용). 판정에는 쓰이지 않는다 — 단계 전환은 서버가 정한다.
// countdown 은 순수 함수라 fake timer 없이 테스트한다. 시각은 인자로만 받는다(clock.ts 규칙).
import { useEffect, useState } from "react";
import { remainingMs } from "./clock";

/** 마지막 5초: 이 값 이하(0 초과)로 남으면 강조한다. */
export const URGENT_MS = 5_000;

/** 다시 그리는 간격. 막대 transition 길이와 같다. */
const REDRAW_MS = 250;

export interface CountdownValue {
  remainingMs: number;
  /** 올림한 남은 초. 0 이면 마감. */
  seconds: number;
  /** 0 < 남은 시간 <= 5000ms */
  urgent: boolean;
  /** 남은 시간 ÷ 단계 길이, 0~1 로 자른다. */
  ratio: number;
}

/** endsAt 은 서버 시각 마감. 서버 시각 = 로컬 시각 + offset. */
export function countdown(endsAt: number, durationMs: number, offset: number, localNow: number): CountdownValue {
  const remaining = remainingMs(endsAt, offset, localNow);
  const ratio = durationMs > 0 ? Math.min(1, Math.max(0, remaining / durationMs)) : 0;
  return {
    remainingMs: remaining,
    seconds: Math.ceil(remaining / 1000),
    urgent: remaining > 0 && remaining <= URGENT_MS,
    ratio,
  };
}

/** 15 → "0:15", 75 → "1:15". */
export function formatMmSs(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const mm = Math.floor(s / 60);
  const ss = s % 60;
  return `${mm}:${ss < 10 ? "0" : ""}${ss}`;
}

/**
 * 남은 시간이 있는 동안 250ms 마다 다시 그린다. 탭이 다시 보이면 한 번 바로 다시 계산한다.
 * 마감이 지나면 간격 타이머를 멈추고 0 에 머문다(연결 상태와 무관하게 endsAt 기준).
 */
export function useCountdown(endsAt: number, durationMs: number, offset: number): CountdownValue {
  const [, setTick] = useState(0);
  const value = countdown(endsAt, durationMs, offset, Date.now());
  const running = value.remainingMs > 0;

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setTick((t) => t + 1), REDRAW_MS);
    return () => clearInterval(id);
  }, [running]);

  useEffect(() => {
    const onVisible = () => setTick((t) => t + 1);
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, []);

  return value;
}
