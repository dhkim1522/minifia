// 보낸 행동의 거절을 알아보는 아주 작은 훅 (09.1.1-08). 서버는 마감 직후 같은 거절을 오류 프레임으로 곧바로 돌려준다(요청 번호가 없다).
// 그래서 "최근 windowMs 안에 이 종류를 보냈다" 를 기억해 두었다가 오류가 오면 그 행동의 거절로 본다. 지목·유언·쪽지의 기존 규칙(pointSent·willBusy)은 그대로 두고 이 훅이 배지 한 분기를 더한다.
// 한 번에 한 가지만 기억한다(가장 마지막으로 보낸 것). 시각은 부르는 쪽이 줄 수 있다(시험).
import { useMemo, useRef } from "react";

/** 거절을 기다리는 행동 종류 */
export type SendKind = "badge" | "whisper";

/** 보낸 뒤 이 시간 안의 오류 프레임은 그 행동의 거절로 본다(지목과 같은 값) */
export const SEND_GUARD_MS = 3000;

export interface SendGuard {
  /** 방금 이 종류를 보냈다고 기억한다 */
  mark(kind: SendKind, now?: number): void;
  /** 기억한 행동이 windowMs 안이면 그 종류를 돌려주되 잊지 않는다(오류 코드를 보고 이 행동의 거절인지 정하기 전에 읽는다). 오래됐거나 없으면 null */
  peek(now?: number): SendKind | null;
  /** 기억한 행동이 windowMs 안이면 그 종류를 돌려주고 잊는다. 오래됐거나 없으면 null */
  take(now?: number): SendKind | null;
  /** 서버가 확인했다 — 그 종류를 기억하고 있으면 잊는다 */
  clear(kind: SendKind): void;
}

export function useSendGuard(windowMs: number = SEND_GUARD_MS): SendGuard {
  const last = useRef<{ kind: SendKind; at: number } | null>(null);
  return useMemo<SendGuard>(
    () => ({
      mark: (kind, now = Date.now()) => {
        last.current = { kind, at: now };
      },
      peek: (now = Date.now()) => {
        const s = last.current;
        return s !== null && now - s.at < windowMs ? s.kind : null;
      },
      take: (now = Date.now()) => {
        const s = last.current;
        last.current = null;
        return s !== null && now - s.at < windowMs ? s.kind : null;
      },
      clear: (kind) => {
        if (last.current?.kind === kind) last.current = null;
      },
    }),
    [windowMs],
  );
}
