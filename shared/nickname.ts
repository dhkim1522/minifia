// 닉네임 규칙(D-06). 서버(방 Durable Object)와 클라이언트가 이 파일 하나를 함께 쓴다.
// 앱·워커 두 tsconfig 에 모두 들어가므로 DOM·workerd 전용 API 는 쓰지 않는다.
//
// 이름은 이 게임의 유일한 공개 식별자라, 눈에 보이지 않는 문자로 같은 이름을 위장하지 못하게 한다(CR-01).
// - 채움 문자(U+115F U+1160 U+3164 U+FFA0 U+2800)는 화면에 빈칸으로 보여 이름을 위장하므로 어디에 있든 거부한다.
// - ZWJ·변형 선택자·결합 문자는 이모지 표시에 필요해 표시 이름에는 남기고, 비교 키에서만 뺀다.
// 소스의 특수 문자는 모두 중괄호 코드 포인트 이스케이프로 쓴다. 눈에 보이지 않는 리터럴을 두지 않는다(IN-07).

// 고정 테이블 이름표를 말줄임 없이 보여 주려고 5자(결정 0017-4)
export const NICKNAME_MAX_GRAPHEMES = 5;
export type NicknameError = "EMPTY" | "TOO_LONG" | "INVALID_CHARS";

const segmenter = new Intl.Segmenter("ko", { granularity: "grapheme" });

// 이모지를 잇는 U+200D(ZWJ)만 서식 문자(Cf) 중 예외로 허용한다.
const ZWJ = "\u{200D}";
// 제어(Cc), 줄·문단 구분(Zl, Zp), 서식(Cf) 문자. 영폭 공백·방향 제어로 이름을 위장하는 것을 막는다.
const FORBIDDEN = /[\p{Cc}\p{Zl}\p{Zp}\p{Cf}]/u;
// 화면에 실제로 보이는 글자(글자·숫자·기호·구두점)가 하나라도 있어야 한다.
const VISIBLE = /[\p{L}\p{N}\p{S}\p{P}]/u;
// 한글 채움 문자 셋(U+115F U+1160 U+3164 U+FFA0)과 점자 빈칸(U+2800). 글자 범주라 위 검사를 통과하지만 화면에는 빈칸이다.
// .test() 전용 비전역 정규식이다. g 플래그를 쓰면 lastIndex 가 남아 같은 입력의 결과가 번갈아 바뀐다.
const INVISIBLE_FILLER = /[\u{115F}\u{1160}\u{3164}\u{FFA0}\u{2800}]/u;
// 비교 키에서만 지우는 문자: 채움 문자, ZWJ(U+200D), 변형 선택자(U+FE00-U+FE0F), 결합 문자(일반 범주 M).
// 한글 음절·자모는 범주 Lo 라 영향이 없다. replace 전용 전역 정규식이라 .test() 에 쓰지 않는다.
const KEY_IGNORED_CHARS = /[\u{115F}\u{1160}\u{3164}\u{FFA0}\u{2800}\u{200D}\u{FE00}-\u{FE0F}\p{M}]/gu;

export function countGraphemes(s: string): number {
  let n = 0;
  for (const _ of segmenter.segment(s)) n += 1;
  return n;
}

/** NFC → 앞뒤 공백 제거 → 안쪽 공백(Zs) 연속을 공백 하나로. 탭·줄바꿈(Cc)은 건드리지 않고 검증에서 거부한다. */
export function normalizeNickname(raw: string): string {
  return raw.normalize("NFC").trim().replace(/\p{Zs}+/gu, " ");
}

/**
 * 중복 비교 키: NFKC 로 전각·호환 문자를 맞추고, 보이지 않는 문자를 지운 뒤, 다시 NFKC 로 이웃하게 된 자모·결합을 합치고, 소문자로.
 * 표시 이름(normalizeNickname 결과)은 바꾸지 않는다. 키에서도 채움 문자를 지우는 것은 이 함수를 따로 부르는 곳을 위한 이중 방어다.
 */
export function nicknameKey(nickname: string): string {
  return nickname.normalize("NFKC").replace(KEY_IGNORED_CHARS, "").normalize("NFKC").toLowerCase();
}

function hasForbiddenChar(s: string): boolean {
  return FORBIDDEN.test(s.split(ZWJ).join("")) || INVISIBLE_FILLER.test(s);
}

export function validateNickname(
  raw: string,
): { ok: true; nickname: string; key: string } | { ok: false; reason: NicknameError } {
  const nickname = normalizeNickname(raw);
  if (nickname.length === 0) return { ok: false, reason: "EMPTY" };
  if (hasForbiddenChar(nickname) || !VISIBLE.test(nickname)) return { ok: false, reason: "INVALID_CHARS" };
  // 보이는 글자 검사를 통과해도 키가 비는 값(예: U+FF9E 반각 탁점)은 거부한다. 길이 검사보다 앞이라 INVALID_CHARS 가 TOO_LONG 보다 먼저다.
  const key = nicknameKey(nickname);
  if (key.length === 0) return { ok: false, reason: "INVALID_CHARS" };
  if (countGraphemes(nickname) > NICKNAME_MAX_GRAPHEMES) return { ok: false, reason: "TOO_LONG" };
  return { ok: true, nickname, key };
}
