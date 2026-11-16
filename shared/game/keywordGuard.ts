// 23-03: 키워드 단계 답의 금지어 판정(결정 0089-5·D-08, SC2). 순수 모듈 — 의존이 없고 시각·난수를 읽지 않는다.
// 서버 전용이다: 클라이언트(src/)는 import 하지 않는다(정적 가드 keywordStaticGuard.test, Pitfall 8). 자유 채팅에는 쓰지 않는다(D-26).
//
// 규칙: 답과 키워드·별칭을 NFKC → 글자·숫자 외 제거 → 소문자로 정규화한 뒤 부분 포함이면 막는다.
// 3글자 이상(완성형 음절만) 키워드는 초성열이 답의 초성열에 들어 있어도 막는다. 2글자·영어 키워드는 초성 검사를 하지 않는다.
// 철자를 일부러 틀린 우회(hery foter)와 글자를 끼운 우회(a해b리c포d터)는 통과한다 — 매너에 맡긴다(0089-5).
// NFKC 는 NFD 입력과 호환 자모 초성(ㅁ)·모음은 음절로 합치지만, 받침 자리의 호환 자모 자음(ㅇㄹ ㅇ)은 종성이 아니라 초성 자모로만 바꿔
// 앞 음절과 합치지 못한다(ㅁㅕㅇㄹㅑㅇ → 며ᄋ랴ᄋ, 명량 아님). 그래서 음절 부분 포함·초성열 검사에 더해 자모 골격(jamoSkeleton)으로도 비교한다:
// 음절을 초성·중성·종성으로 풀고 종성을 같은 자음의 초성으로, 겹모음·겹받침을 낱 자모로 접어 같은 글자의 다른 인코딩을 같은 열로 만든다(WR-01).
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

/** 종성 자모(U+11A8..11C2, 27개) → 같은 자음의 초성 자모 열. 겹받침은 낱 자음 초성 둘로 접는다. */
const JONG_TO_CHO: readonly (readonly number[])[] = [
  [0x1100], [0x1101], [0x1100, 0x1109], [0x1102], [0x1102, 0x110c], [0x1102, 0x1112], [0x1103],
  [0x1105], [0x1105, 0x1100], [0x1105, 0x1106], [0x1105, 0x1107], [0x1105, 0x1109], [0x1105, 0x1110], [0x1105, 0x1111], [0x1105, 0x1112],
  [0x1106], [0x1107], [0x1107, 0x1109], [0x1109], [0x110a], [0x110b], [0x110c], [0x110e], [0x110f], [0x1110], [0x1111], [0x1112],
];
const JONG_BASE = 0x11a8;
const JONG_COUNT = 27;
/** 겹모음(U+116A..1174 중) → 낱 모음 열. 풀어 쓴 ㅗㅏ 와 합쳐 쓴 ㅘ 를 같은 열로 만든다. */
const COMPOUND_VOWEL: Readonly<Record<number, readonly number[]>> = {
  0x116a: [0x1169, 0x1161], 0x116b: [0x1169, 0x1162], 0x116c: [0x1169, 0x1175],
  0x116f: [0x116e, 0x1165], 0x1170: [0x116e, 0x1166], 0x1171: [0x116e, 0x1175], 0x1174: [0x1173, 0x1175],
};

/**
 * 자모 골격: 정규형 문자열의 완성형 음절을 초성·중성·종성으로 풀고, 조합형 자모는 종성→초성·겹모음→낱 모음으로 접는다. 그 밖의 글자는 그대로 둔다.
 * 호환 자모로 풀어 쓴 답(ㅁㅕㅇㄹㅑㅇ)과 음절로 쓴 키워드(명량)가 같은 열이 된다. 입력은 normalizeForGuard 를 지난 문자열이다.
 */
export function jamoSkeleton(s: string): string {
  const out: number[] = [];
  const pushJamo = (c: number): void => {
    if (c >= JONG_BASE && c < JONG_BASE + JONG_COUNT) out.push(...JONG_TO_CHO[c - JONG_BASE]!);
    else out.push(...(COMPOUND_VOWEL[c] ?? [c]));
  };
  for (const ch of s) {
    const c = ch.codePointAt(0)!;
    if (isSyllable(c)) {
      const i = c - SYLLABLE_BASE;
      out.push(CHOSEONG_BASE + Math.floor(i / SYLLABLES_PER_CHOSEONG));
      pushJamo(0x1161 + Math.floor((i % SYLLABLES_PER_CHOSEONG) / 28));
      const jong = i % 28;
      if (jong > 0) pushJamo(JONG_BASE + jong - 1);
    } else if (c >= 0x1100 && c <= 0x11ff) pushJamo(c);
    else out.push(c);
  }
  return out.map((c) => String.fromCodePoint(c)).join("");
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
  // 자모 골격 부분 포함(WR-01): 받침을 호환 자모로 풀어 쓴 답을 잡는다. 길이는 음절 기준(2 이상)으로 같은 문턱을 쓴다.
  const answerSkeleton = jamoSkeleton(n);
  if (normalized.some((f) => f.length >= 2 && answerSkeleton.includes(jamoSkeleton(f)))) return true;
  const answerCho = choseongOf(n);
  return normalized.some((f) => f.length >= 3 && allSyllables(f) && answerCho.includes(choseongOf(f)));
}
