// 연결 상태기계(순수). RED 단계 뼈대 — 전이 규칙은 GREEN 에서 채운다.
import type { RemovedReason } from "../../shared/protocol";

export type LinkStatus = "connecting" | "open" | "reconnecting" | "failed" | "replaced" | "removed";
export type BannerMode = "hidden" | "reconnecting" | "restored";

export interface LinkState {
  status: LinkStatus;
  banner: BannerMode;
  visible: boolean;
  failingSince: number | null;
  attempts: number;
  epoch: number;
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

export function linkReducer(s: LinkState, _e: LinkEvent): LinkState {
  return s;
}
