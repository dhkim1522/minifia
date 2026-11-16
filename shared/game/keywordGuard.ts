// 23-03: 키워드 단계 답의 금지어 판정(결정 0089-5·D-08, SC2). 순수 모듈 — 의존이 없고 시각·난수를 읽지 않는다.
// 서버 전용이다: 클라이언트(src/)는 import 하지 않는다(정적 가드 keywordStaticGuard.test, Pitfall 8). 자유 채팅에는 쓰지 않는다(D-26).
//
// 규칙: 답과 키워드·별칭을 NFKC → 글자·숫자 외 제거 → 소문자로 정규화한 뒤 부분 포함이면 막는다.
// 3글자 이상(완성형 음절만) 키워드는 초성열이 답의 초성열에 들어 있어도 막는다. 2글자·영어 키워드는 초성 검사를 하지 않는다.
// 철자를 일부러 틀린 우회(hery foter)와 글자를 끼운 우회(a해b리c포d터)는 통과한다 — 매너에 맡긴다(0089-5).
// NFD 입력·호환 자모는 NFKC 가 이미 합치므로 따로 NFC 변환을 두지 않는다. 직접 만든 매핑 표는 쓰지 않는다.
// 알려진 한계: 3글자 키워드의 초성열이 흔한 단어와 우연히 겹칠 수 있다(고양이 ㄱㅇㅇ ↔ 가을이). D-08 문언대로 막는다(0091 에 기록).

/** 판정 대상 키워드 한 항목의 금지 형태. keywords.ts 를 import 하지 않으려고 구조 타입으로 둔다. */
export interface KeywordForms {
  readonly word: string;
  readonly aliases: readonly string[];
}

const SYLLABLE_BASE = 0xac00;
const SYLLABLE_COUNT = 11172;
const CHOSEONG_BASE = 0x1100;
/** 한 초성에 딸린 완성형 음절 수(중성 21 × 종성 28). */
const SYLLABLES_PER_CHOSEONG = 588;

/**
 * 판정용 정규형: NFKC → 글자·숫자(\p{L}\p{N}) 외 제거 → 소문자.
 * 백트래킹 없는 문자 범주 치환이라 입력이 길어도 선형이다(T-23-10). g 플래그 정규식은 replace 에만 쓴다(.test() 의 lastIndex 함정 회피).
 */
export function normalizeForGuard(s: string): string {
  return s.normalize("NFKC").replace(/[^\p{L}\p{N}]/gu, "").toLowerCase();
}

const isSyllable = (c: number): boolean => c >= SYLLABLE_BASE && c < SYLLABLE_BASE + SYLLABLE_COUNT;

/** 완성형 음절은 조합형 초성 자모(U+1100..1112)로, 그 밖의 글자는 그대로 바꾼다. */
export function choseongOf(s: string): string {
  let out = "";
  for (const ch of s) {
    const c = ch.codePointAt(0)!;
    out += isSyllable(c) ? String.fromCodePoint(CHOSEONG_BASE + Math.floor((c - SYLLABLE_BASE) / SYLLABLES_PER_CHOSEONG)) : ch;
  }
  return out;
}

const allSyllables = (s: string): boolean => [...s].every((ch) => isSyllable(ch.codePointAt(0)!));

/**
 * 답이 이 방의 키워드·별칭을 드러내면 true. 검사 대상은 방의 키워드 한 항목뿐이다.
 * 길이 1 형태는 모든 답을 막을 수 있어 무시한다. 빈 답·기호뿐인 답은 막지 않는다(다른 규칙이 거른다).
 */
export function violatesKeyword(answer: string, forms: KeywordForms): boolean {
  const n = normalizeForGuard(answer);
  const normalized = [forms.word, ...forms.aliases].map(normalizeForGuard);
  if (normalized.some((f) => f.length >= 2 && n.includes(f))) return true;
  const answerCho = choseongOf(n);
  return normalized.some((f) => f.length >= 3 && allSyllables(f) && answerCho.includes(choseongOf(f)));
}
