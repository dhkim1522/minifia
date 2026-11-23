import type { RoomView } from "../../shared/protocol";
import { dayEvents } from "./dayView";

// 편지 등장과 인장 시각은 화면·소리가 공유한다. 채팅 공개 시계와 편지 읽기 시간은 따로 간다.
export const LETTER_RISE_MS = 700;
export const LETTER_SEAL_AT_MS = LETTER_RISE_MS + 60;
export const LETTER_SEAL_MS = 500;
export const LETTER_CHAT_AT_MS = 5000;
export const LETTER_READ_MS = 10000;
export const LETTER_FOLD_MS = 420;
export const SEAL_GLYPH = "M";

/** 줄바꿈이 든 유언을 공백으로 이어 한 문단으로(9페이즈 규칙) */
export function oneParagraph(text: string): string {
  return text.replace(/\s*[\r\n]+\s*/g, " ").trim();
}

/**
 * 이 화면에서 편지가 시작되는 시각 T0(아침 단계 진입 기준 ms) = 그 사람 화면의 아침 36px 알림 시작 시각.
 * dayEvents 의 알림 at 을 그대로 써서(일반 400·경찰 2600·피해자 700) 같은 규칙을 두 벌 만들지 않는다.
 * 밤 → 아침이 아니거나 첫 스냅샷·reset 이거나 탈락자가 없으면 null.
 */
export function letterT0(prev: RoomView | null, cur: RoomView, opts: { reset?: boolean } = {}): number | null {
  if (prev === null || opts.reset === true || prev.phase !== "night" || cur.phase !== "morning") return null;
  if (cur.day?.morning?.eliminated === undefined) return null;
  const announce = dayEvents(prev, cur).announces[0];
  return announce === undefined ? null : announce.at;
}
