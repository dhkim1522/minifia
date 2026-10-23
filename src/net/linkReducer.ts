// 연결 상태기계(순수). 시각은 이벤트의 now 로만 받는다 — 내부에서 Date.now() 를 부르지 않는다.
import type { RemovedReason } from "../../shared/protocol";
import { CLOSE_CODES } from "../../shared/protocol";

export type LinkStatus = "connecting" | "open" | "reconnecting" | "failed" | "replaced" | "removed";
export type BannerMode = "hidden" | "reconnecting" | "restored";

export interface LinkState {
  status: LinkStatus;
  banner: BannerMode;
  /** 화면이 보이는 중인지(visibilitychange) */
  visible: boolean;
  /** 보이는 상태에서의 첫 실패 시각. 숨겨지면 null 로 비운다(화면이 꺼진 시간은 세지 않음) */
  failingSince: number | null;
  attempts: number;
  /** 소켓이 열릴 때마다 1씩 늘어난다 */
  epoch: number;
  /** 서버 state 를 한 번이라도 받았는지 */
  hasView: boolean;
  restoredUntil: number | null;
  removedReason: RemovedReason | null;
}

export type LinkEvent =
  | { type: "open"; now: number }
  | { type: "state"; now: number }
  | { type: "close"; code: number; reason: string; now: number }
  | { type: "visibility"; visible: boolean; now: number }
  | { type: "tick"; now: number }
  | { type: "retry"; now: number }
  | { type: "roomGone"; now: number };

export const FAIL_AFTER_MS = 30_000;
export const RESTORED_MS = 2_000;
export const STALE_CHECK_AFTER = 3;

const REMOVED_REASONS: readonly string[] = ["left", "kicked", "invalid_token", "room_closed"];

export function initialLinkState(_now: number, visible: boolean): LinkState {
  return {
    status: "connecting",
    banner: "hidden",
    visible,
    failingSince: null,
    attempts: 0,
    epoch: 0,
    hasView: false,
    restoredUntil: null,
    removedReason: null,
  };
}

export function linkReducer(s: LinkState, e: LinkEvent): LinkState {
  switch (e.type) {
    case "open":
      if (s.status === "removed" || s.status === "replaced" || s.status === "failed") return s;
      return { ...s, status: "open", attempts: 0, failingSince: null, epoch: s.epoch + 1 };

    case "state":
      if (s.status === "removed" || s.status === "replaced" || s.status === "failed") return s;
      return {
        ...s,
        hasView: true,
        ...(s.banner === "reconnecting" ? { banner: "restored" as const, restoredUntil: e.now + RESTORED_MS } : {}),
      };

    case "close": {
      if (s.status === "removed" || s.status === "replaced" || s.status === "failed") return s;
      if (e.code === CLOSE_CODES.REPLACED) return { ...s, status: "replaced", banner: "hidden", restoredUntil: null };
      if (e.code === CLOSE_CODES.REMOVED) {
        const removedReason = REMOVED_REASONS.includes(e.reason) ? (e.reason as RemovedReason) : "room_closed";
        return { ...s, status: "removed", banner: "hidden", restoredUntil: null, removedReason };
      }
      return {
        ...s,
        status: "reconnecting",
        attempts: s.attempts + 1,
        failingSince: s.visible ? (s.failingSince ?? e.now) : null,
        banner: s.hasView ? "reconnecting" : "hidden",
        restoredUntil: null,
      };
    }

    case "tick":
      if (s.banner === "restored" && s.restoredUntil !== null && e.now >= s.restoredUntil) {
        return { ...s, banner: "hidden", restoredUntil: null };
      }
      return s;

    // [다시 연결](replaced)·[다시 시도](failed): 처음부터 다시 연결한다.
    case "retry":
      if (s.status !== "failed" && s.status !== "replaced") return s;
      return {
        ...s,
        status: "connecting",
        attempts: 0,
        failingSince: s.visible ? e.now : null,
        banner: s.hasView ? "reconnecting" : "hidden",
        restoredUntil: null,
        removedReason: null,
      };

    // 보이는 시간 30초 규칙·visibility·roomGone 은 Task 2 에서 채운다.
    case "visibility":
    case "roomGone":
      return s;
  }
}

/** 재연결 대기(ms): min(5000, 500·2^(attempts−1)) + 지터. RED 단계 뼈대. */
export function retryDelayMs(_attempts: number, _rand01: number): number {
  return 0;
}
