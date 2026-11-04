// 유언 편지 순수 모델(결정 0063-3, UI-SPEC C-1~C-3). 시간 값은 기본값이고 여기 한 곳에서만 고친다.
// 인장 글자는 SEAL_GLYPH 하나(0063-4 'M' — 정식 이름 뒤 이 줄만 바꾼다). DOM·시각을 읽지 않는다.
import { countGraphemes } from "../../shared/nickname";
import type { RoomView } from "../../shared/protocol";
import { dayEvents } from "./dayView";

/** 편지지 등장(T0 기준 0 ~ 700ms) */
export const LETTER_RISE_MS = 700;
/** 첫 줄 쓰기 시작 */
export const LETTER_WRITE_AT_MS = 800;
/** 줄 사이 */
export const LETTER_LINE_GAP_MS = 100;
/** 글자당 쓰기 시간 */
export const LETTER_MS_PER_CHAR = 190;
/** 쓰기 전체 상한 W */
export const LETTER_WRITE_MAX_MS = 2300;
/** 쓰기 끝 → 인장 */
export const LETTER_SEAL_GAP_MS = 100;
export const LETTER_SEAL_MS = 500;
/** 접힘 시작(= 채팅 카드 도착)과 접힘 길이, 편지 제거 시각 */
export const LETTER_FOLD_AT_MS = 5000;
export const LETTER_FOLD_MS = 420;
export const LETTER_END_AT_MS = 5420;
/** 글꼴 로드를 기다리는 최대 시간. 넘으면 대체 글꼴로 진행 */
export const LETTER_FONT_WAIT_MS = 1000;
/** 편지지 높이 범위 */
export const LETTER_PAPER_MAX_H = 340;
export const LETTER_PAPER_MIN_H = 220;
/** 글 크기 3단: 긴 유언일수록 글자와 줄 간격을 함께 줄인다 */
export const LETTER_TIERS = [
  { font: 46, line: 56 },
  { font: 36, line: 44 },
  { font: 28, line: 32 },
] as const;
/** 인장 글자(미결 M-7 — 정식 이름이 정해지면 이 줄만 바꾼다) */
export const SEAL_GLYPH = "M";

export interface LineWrite {
  /** 편지 T0 기준 시작 ms */
  at: number;
  ms: number;
  /** clip-path steps() 단계 = 그 줄 글자 수 */
  steps: number;
}

export interface WriteSchedule {
  lines: LineWrite[];
  /** 쓰기 전체 길이 W */
  writeMs: number;
  sealAt: number;
  foldAt: number;
  endAt: number;
}

/**
 * 줄(글꼴로 나뉜 보이는 줄) 목록에서 쓰기 시간표. W = min(2300, 190 × 전체 글자 수)를 줄 글자 수 비율로 나누고
 * 줄 사이 100ms 는 W 안에 든다. 마지막 줄이 나머지를 받아 쓰기 끝이 정확히 800 + W 다. 공백뿐이면 null(편지 없음).
 */
export function writeSchedule(lines: readonly string[]): WriteSchedule | null {
  const counts = lines.map((l) => countGraphemes(l.trim())).filter((n) => n > 0);
  if (counts.length === 0) return null;
  const total = counts.reduce((a, b) => a + b, 0);
  const writeMs = Math.min(LETTER_WRITE_MAX_MS, LETTER_MS_PER_CHAR * total);
  const pool = writeMs - LETTER_LINE_GAP_MS * (counts.length - 1);
  const out: LineWrite[] = [];
  let at = LETTER_WRITE_AT_MS;
  let used = 0;
  counts.forEach((steps, i) => {
    const ms = i === counts.length - 1 ? pool - used : Math.round((pool * steps) / total);
    used += ms;
    out.push({ at, ms, steps });
    at += ms + LETTER_LINE_GAP_MS;
  });
  return {
    lines: out,
    writeMs,
    sealAt: LETTER_WRITE_AT_MS + writeMs + LETTER_SEAL_GAP_MS,
    foldAt: LETTER_FOLD_AT_MS,
    endAt: LETTER_END_AT_MS,
  };
}

export interface TierChoice {
  tier: 1 | 2 | 3;
  font: number;
  line: number;
  lines: number;
  /** 3단계로도 안쪽 높이를 넘음 → 편지지를 가용 높이까지 키우라는 신호 */
  overflow: boolean;
}

/** 1 → 2 → 3단계 순서로 줄 수를 재어 안쪽 높이(편지지 높이 − 56)에 들어가는 첫 단계. 3단계로도 넘으면 3단계 + overflow. */
export function chooseTier(measureLines: (tier: { font: number; line: number }) => number, innerHeight: number): TierChoice {
  let last: TierChoice | null = null;
  for (let i = 0; i < LETTER_TIERS.length; i++) {
    const t = LETTER_TIERS[i]!;
    const lines = measureLines(t);
    last = { tier: (i + 1) as 1 | 2 | 3, font: t.font, line: t.line, lines, overflow: lines * t.line > innerHeight };
    if (!last.overflow) return last;
  }
  return last!;
}

/** 가용 높이를 편지지 높이 범위(220~340)로 자른다 */
export function paperHeight(available: number): number {
  return Math.min(LETTER_PAPER_MAX_H, Math.max(LETTER_PAPER_MIN_H, available));
}

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
