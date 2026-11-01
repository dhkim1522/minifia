// 채팅 본문 정리와 서버 제한 규칙(UI-SPEC D5, CHAT-05)·입력 중 신호 간격(CHAT-04).
// 순수 모듈이다: 시각은 인자로만 받고 난수를 읽지 않으며 입력을 바꾸지 않는다. DOM·workerd API 가 없다(앱·워커 두 tsconfig 에 모두 들어간다).
// 판정은 서버가 한다. 화면의 maxlength 100 은 편의일 뿐이다.
import type { ChatRejectWhy } from "../protocol";
import { countGraphemes } from "../nickname";

// ---- UI-SPEC D5 시작값. 9페이즈 팀 테스트 뒤 여기만 고친다. ----
/** 공백 정리 뒤 1~100자(자소). */
export const CHAT_MAX_GRAPHEMES = 100;
/** 같은 사람 최소 전송 간격(마지막 수락 기준). */
export const CHAT_MIN_GAP_MS = 600;
/** 이 창 안에서 */
export const CHAT_BURST_WINDOW_MS = 5_000;
/** 이 줄 수까지 수락하고 그 다음부터 거절한다. */
export const CHAT_BURST_MAX = 5;
/** 같은 문장을 이 시간 안에 다시 보내면 거절한다. */
export const CHAT_REPEAT_MS = 3_000;
/** 입력 중 켜짐 신호를 같은 사람에게서 이 간격에 한 번만 중계한다(UI-SPEC 머리 위 입력 중). */
export const TYPING_MIN_GAP_MS = 1_500;

// 공백으로 바꿀 문자: 제어(Cc)·줄(Zl)·문단(Zp) 구분, 이모지를 잇는 ZWJ(U+200D)를 뺀 서식(Cf),
// 그리고 글자 범주지만 화면에는 빈칸인 채움 문자 다섯(U+115F U+1160 U+3164 U+FFA0 U+2800).
// 방향 제어(U+202E)·영폭 공백으로 줄을 위장하는 것을 막는 기준은 shared/nickname.ts 와 같다(소스에는 이스케이프로만 쓴다).
// replace 전용 전역 정규식이다. g 플래그가 있으므로 .test() 에 쓰지 않는다(lastIndex 함정, nickname.ts 주석).
const TO_SPACE = /[\p{Cc}\p{Zl}\p{Zp}\u{115F}\u{1160}\u{3164}\u{FFA0}\u{2800}]|(?!\u{200D})\p{Cf}/gu;
const SPACES = /\p{Zs}+/gu;
// .test() 전용 비전역 정규식: 화면에 실제로 보이는 글자(글자·숫자·기호·구두점).
const VISIBLE = /[\p{L}\p{N}\p{S}\p{P}]/u;

/**
 * 본문 정리: NFC → 금지 문자를 공백으로 → 공백을 하나로 접고 앞뒤를 자른다.
 * 보이는 글자가 없으면 other, 자소 100개를 넘으면 length. 입력은 스키마의 UTF-16 상한(300)을 이미 지난 값이어야 한다.
 */
export function sanitizeChatText(raw: string): { ok: true; text: string } | { ok: false; why: ChatRejectWhy } {
  const text = raw.normalize("NFC").replace(TO_SPACE, " ").replace(SPACES, " ").trim();
  if (text.length === 0 || !VISIBLE.test(text)) return { ok: false, why: "other" };
  // 코드 단위가 100 이하면 자소는 100 이하다. 그 위에서만 Intl.Segmenter 를 돌린다.
  if (text.length > CHAT_MAX_GRAPHEMES && countGraphemes(text) > CHAT_MAX_GRAPHEMES) return { ok: false, why: "length" };
  return { ok: true, text };
}

/** 한 사람의 전송 기록: 마지막 수락 시각, 5초 창 안의 수락 시각들, 마지막 수락 문장과 그 시각. 수락한 전송만 남긴다. */
export interface ChatSenderRate {
  lastAt: number;
  recent: number[];
  lastText: string;
  lastTextAt: number;
}

/**
 * 도배 제한. 판정 순서는 간격 → 창 → 반복이다. 거절된 전송은 기록을 만들지 않는다(마지막 수락 시각이 기준).
 * text 는 sanitizeChatText 를 지난 값이어야 한다. prev 가 없으면 보낸 적 없는 사람이다.
 */
export function checkChatSend(
  prev: ChatSenderRate | undefined,
  text: string,
  now: number,
): { ok: true; next: ChatSenderRate } | { ok: false; why: "rate" | "repeat" } {
  const recent = (prev?.recent ?? []).filter((t) => t > now - CHAT_BURST_WINDOW_MS);
  if (prev !== undefined && now - prev.lastAt < CHAT_MIN_GAP_MS) return { ok: false, why: "rate" };
  if (recent.length >= CHAT_BURST_MAX) return { ok: false, why: "rate" };
  if (prev !== undefined && text === prev.lastText && now - prev.lastTextAt < CHAT_REPEAT_MS) return { ok: false, why: "repeat" };
  return { ok: true, next: { lastAt: now, recent: [...recent, now], lastText: text, lastTextAt: now } };
}

/** 입력 중 중계 기록: 지금 켜져 있는지와 마지막으로 켜짐을 중계한 시각. */
export interface TypingRelayState {
  on: boolean;
  lastOnAt: number;
}

/**
 * 입력 중 신호를 중계할지 정한다. 오류 신호 없이 조용히 거른다.
 * 켜짐은 마지막 켜짐 중계 후 1.5초가 지나야 다시 중계하고(무시한 신호는 기록을 바꾸지 않는다), 꺼짐은 켜져 있을 때만 중계한다.
 */
export function typingRelay(
  prev: TypingRelayState | undefined,
  on: boolean,
  now: number,
): { relay: boolean; next: TypingRelayState } {
  const state: TypingRelayState = prev ?? { on: false, lastOnAt: Number.NEGATIVE_INFINITY };
  if (on) {
    if (now - state.lastOnAt < TYPING_MIN_GAP_MS) return { relay: false, next: state };
    return { relay: true, next: { on: true, lastOnAt: now } };
  }
  if (!state.on) return { relay: false, next: state };
  return { relay: true, next: { on: false, lastOnAt: state.lastOnAt } };
}
