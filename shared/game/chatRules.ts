// RED 단계의 뼈대 — 테스트가 import 할 수 있게 모양과 상수만 둔다. 판정은 GREEN 커밋에서 채운다.
import type { ChatRejectWhy } from "../protocol";

export const CHAT_MAX_GRAPHEMES = 100;
export const CHAT_MIN_GAP_MS = 600;
export const CHAT_BURST_WINDOW_MS = 5_000;
export const CHAT_BURST_MAX = 5;
export const CHAT_REPEAT_MS = 3_000;
export const TYPING_MIN_GAP_MS = 1_500;

export function sanitizeChatText(_raw: string): { ok: true; text: string } | { ok: false; why: ChatRejectWhy } {
  return { ok: false, why: "other" };
}

export interface ChatSenderRate {
  lastAt: number;
  recent: number[];
  lastText: string;
  lastTextAt: number;
}
export function checkChatSend(
  _prev: ChatSenderRate | undefined,
  _text: string,
  _now: number,
): { ok: true; next: ChatSenderRate } | { ok: false; why: "rate" | "repeat" } {
  return { ok: false, why: "rate" };
}

export interface TypingRelayState {
  on: boolean;
  lastOnAt: number;
}
export function typingRelay(
  prev: TypingRelayState | undefined,
  _on: boolean,
  _now: number,
): { relay: boolean; next: TypingRelayState } {
  return { relay: false, next: prev ?? { on: false, lastOnAt: 0 } };
}
