// 닉네임 규칙(D-06). 서버(방 Durable Object)와 클라이언트가 이 파일 하나를 함께 쓴다.
// 앱·워커 두 tsconfig 에 모두 들어가므로 DOM·workerd 전용 API 는 쓰지 않는다.

export const NICKNAME_MAX_GRAPHEMES = 8;
export type NicknameError = "EMPTY" | "TOO_LONG" | "INVALID_CHARS";

const segmenter = new Intl.Segmenter("ko", { granularity: "grapheme" });

// 이모지를 잇는 U+200D(ZWJ)만 서식 문자(Cf) 중 예외로 허용한다.
const ZWJ = "\u{200D}";
// 제어(Cc), 줄·문단 구분(Zl, Zp), 서식(Cf) 문자. 영폭 공백·방향 제어로 이름을 위장하는 것을 막는다.
const FORBIDDEN = /[\p{Cc}\p{Zl}\p{Zp}\p{Cf}]/u;
// 화면에 실제로 보이는 글자(글자·숫자·기호·구두점)가 하나라도 있어야 한다.
const VISIBLE = /[\p{L}\p{N}\p{S}\p{P}]/u;

export function countGraphemes(s: string): number {
  let n = 0;
  for (const _ of segmenter.segment(s)) n += 1;
  return n;
}

/** NFC → 앞뒤 공백 제거 → 안쪽 공백(Zs) 연속을 공백 하나로. 탭·줄바꿈(Cc)은 건드리지 않고 검증에서 거부한다. */
export function normalizeNickname(raw: string): string {
  return raw.normalize("NFC").trim().replace(/\p{Zs}+/gu, " ");
}

// 비교 키에서만 지우는 문자. ZWJ 는 이모지 결합 때문에 표시 이름에는 남기고 비교 키에서만 뺀다(CR-01).
// replace 전용 전역 정규식이라 .test() 에 쓰지 않는다(lastIndex 가 남는다).
const KEY_IGNORED_CHARS = /[\u{200D}]/gu;

/** 중복 비교 키: NFKC 로 전각·호환 문자를 맞추고, 보이지 않는 결합 문자를 지우고, 소문자로. */
export function nicknameKey(nickname: string): string {
  return nickname.normalize("NFKC").replace(KEY_IGNORED_CHARS, "").toLowerCase();
}

function hasForbiddenChar(s: string): boolean {
  return FORBIDDEN.test(s.split(ZWJ).join(""));
}

export function validateNickname(
  raw: string,
): { ok: true; nickname: string; key: string } | { ok: false; reason: NicknameError } {
  const nickname = normalizeNickname(raw);
  if (nickname.length === 0) return { ok: false, reason: "EMPTY" };
  if (hasForbiddenChar(nickname) || !VISIBLE.test(nickname)) return { ok: false, reason: "INVALID_CHARS" };
  if (countGraphemes(nickname) > NICKNAME_MAX_GRAPHEMES) return { ok: false, reason: "TOO_LONG" };
  return { ok: true, nickname, key: nicknameKey(nickname) };
}
