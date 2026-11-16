// 23-04: 키워드 목록 초안의 불변식(결정 0089-2·D-05, SC5·SC2, P23-27, T-23-12·14). 목록은 Claude 초안이고 사용자가 나중에 검토한다(0089-23).
// 검사 함수 keywordListProblems 는 순수 함수라 실제 목록과 일부러 깨뜨린 목록 모두에 돌린다.
import { describe, expect, it } from "vitest";
import { normalizeForGuard, violatesKeyword } from "../../shared/game/keywordGuard";
import { genreLabelOf, GENRES, keywordEntryOf, pickKeyword } from "../../shared/game/keywords";
import type { Genre } from "../../shared/game/keywords";
import { countGraphemes } from "../../shared/nickname";
import { seededRandInt } from "../helpers/seededRandom";

/** 영어 역할 문자열은 부분 문자열로 막는다(누설 시험·E2E 의 정규식이 거짓 신호를 내지 않게). none 은 역할 없음 값이다. */
const ROLE_SUBSTRINGS = /mafia|police|doctor|citizen|role|none/i;
/** 한국어 역할 단어는 단어·별칭 전체가 되는 것만 막는다(영화 이름 속 글자는 괜찮다). */
const ROLE_WORDS_KO = new Set(["마피아", "시민", "경찰", "의사"]);

const WORD_MIN = 2;
const WORD_MAX = 12; // UI-SPEC P23-27: 카드 2줄·띠 19자·결과 줄이 이 상한에 기대다
const LABEL_MAX = 6;

/** 모든 형태(단어·별칭)와 그 변형 — 판정이 같은 형태를 막는지 자기 검사한다. */
function variantsOf(form: string): string[] {
  const chars = [...form.replace(/\s+/g, "")];
  return [form, chars.join(" "), chars.join("."), form.toUpperCase()];
}

/** 항목 불변식(크기 불변식 제외)을 어긴 곳을 문장으로 돌려준다. 빈 배열이면 통과. */
export function keywordListProblems(genres: readonly Genre[]): string[] {
  const problems: string[] = [];
  const genreIds = new Set<string>();
  const genreLabels = new Set<string>();
  const normalizedWords = new Map<string, string>(); // 정규화 단어 → 처음 나온 곳

  // 1차: 단어(별칭 충돌 검사에 전체 단어 표가 필요하다)
  for (const g of genres) {
    for (const e of g.words) {
      const n = normalizeForGuard(e.word);
      if (!normalizedWords.has(n)) normalizedWords.set(n, `${g.id}/${e.word}`);
    }
  }

  for (const g of genres) {
    if (g.id.trim() === "") problems.push("장르 id 가 비어 있다");
    if (genreIds.has(g.id)) problems.push(`장르 id 중복: ${g.id}`);
    genreIds.add(g.id);
    if (g.label.trim() === "") problems.push(`장르 라벨이 비어 있다: ${g.id}`);
    else if (countGraphemes(g.label) > LABEL_MAX) problems.push(`장르 라벨이 ${LABEL_MAX}자소 초과: ${g.label}`);
    if (genreLabels.has(g.label)) problems.push(`장르 라벨 중복: ${g.label}`);
    genreLabels.add(g.label);
    if (ROLE_SUBSTRINGS.test(g.label) || ROLE_SUBSTRINGS.test(g.id)) problems.push(`장르 id·라벨에 역할 문자열: ${g.id}/${g.label}`);

    for (const e of g.words) {
      const where = `${g.id}/${e.word}`;
      const len = countGraphemes(e.word);
      if (len < WORD_MIN || len > WORD_MAX) {
        problems.push(`단어 자소 수 ${len} 가 ${WORD_MIN}~${WORD_MAX} 밖: ${where}`);
        continue; // 같은 단어에서 연쇄로 위반을 더 세지 않는다
      }
      const n = normalizeForGuard(e.word);
      if (n.length < WORD_MIN) {
        problems.push(`정규화한 단어가 ${WORD_MIN}자 미만: ${where}`);
        continue;
      }
      if (normalizedWords.get(n) !== where) problems.push(`정규화 단어 중복: ${where} ↔ ${normalizedWords.get(n)}`);
      if (ROLE_SUBSTRINGS.test(e.word) || ROLE_SUBSTRINGS.test(n)) problems.push(`단어에 역할 문자열: ${where}`);
      if (ROLE_WORDS_KO.has(n)) problems.push(`단어가 역할 단어 전체: ${where}`);

      const aliasNormalized = new Set<string>();
      for (const a of e.aliases) {
        const an = normalizeForGuard(a);
        if (an.length < WORD_MIN) {
          problems.push(`별칭 정규화 길이 ${WORD_MIN} 미만: ${where} ← ${JSON.stringify(a)}`);
          continue;
        }
        if (an === n) problems.push(`별칭이 자기 단어와 같다: ${where} ← ${a}`);
        if (aliasNormalized.has(an)) problems.push(`별칭 정규화 중복: ${where} ← ${a}`);
        aliasNormalized.add(an);
        const owner = normalizedWords.get(an);
        if (owner !== undefined && owner !== where) problems.push(`별칭이 다른 항목의 단어와 같다: ${where} ← ${a} (${owner})`);
        if (ROLE_SUBSTRINGS.test(a) || ROLE_SUBSTRINGS.test(an)) problems.push(`별칭에 역할 문자열: ${where} ← ${a}`);
        if (ROLE_WORDS_KO.has(an)) problems.push(`별칭이 역할 단어 전체: ${where} ← ${a}`);
      }

      // 자기 검사(SC2): 모든 형태와 변형이 같은 항목의 판정에 막힌다
      for (const form of [e.word, ...e.aliases]) {
        if (normalizeForGuard(form).length < WORD_MIN) continue; // 위에서 이미 보고했다
        for (const v of variantsOf(form)) {
          if (!violatesKeyword(v, e)) problems.push(`판정이 막지 못하는 형태: ${where} ← ${JSON.stringify(v)}`);
        }
      }
    }
  }
  return problems;
}

const validBase = (): Genre[] => [
  { id: "fruit", label: "과일", words: [{ word: "사과", aliases: ["apple"] }, { word: "바나나", aliases: ["banana"] }] },
];

describe("keywordListProblems — 깨진 목록을 실제로 잡는다", () => {
  it("멀쩡한 목록은 위반 0건", () => {
    expect(keywordListProblems(validBase())).toEqual([]);
  });

  it("한 글자 단어는 위반 1건", () => {
    const g = validBase();
    g[0] = { ...g[0]!, words: [...g[0]!.words, { word: "귤", aliases: [] }] };
    expect(keywordListProblems(g)).toHaveLength(1);
  });

  it("13자소 단어는 위반 1건", () => {
    const g = validBase();
    g[0] = { ...g[0]!, words: [...g[0]!.words, { word: "가나다라마바사아자차카타파", aliases: [] }] };
    expect(keywordListProblems(g)).toHaveLength(1);
  });

  it("별칭 Police 는 위반 1건", () => {
    const g = validBase();
    g[0] = { ...g[0]!, words: [{ word: "사과", aliases: ["apple", "Police"] }, g[0]!.words[1]!] };
    expect(keywordListProblems(g)).toHaveLength(1);
  });

  it("같은 정규화 단어 두 개는 위반 1건", () => {
    const g = validBase();
    g[0] = { ...g[0]!, words: [...g[0]!.words, { word: "사 과", aliases: [] }] };
    expect(keywordListProblems(g)).toHaveLength(1);
  });

  it("별칭이 자기 단어·다른 항목의 단어와 같거나 항목 안에서 겹치면 각각 위반 1건", () => {
    const own = validBase();
    own[0] = { ...own[0]!, words: [{ word: "사과", aliases: ["사 과"] }, own[0]!.words[1]!] };
    expect(keywordListProblems(own)).toHaveLength(1);
    const cross = validBase();
    cross[0] = { ...cross[0]!, words: [{ word: "사과", aliases: ["바나나"] }, cross[0]!.words[1]!] };
    expect(keywordListProblems(cross)).toHaveLength(1);
    const dup = validBase();
    dup[0] = { ...dup[0]!, words: [{ word: "사과", aliases: ["apple", "Apple"] }, dup[0]!.words[1]!] };
    expect(keywordListProblems(dup)).toHaveLength(1);
  });

  it("한국어 역할 단어가 별칭 전체이거나 별칭이 한 글자면 위반 1건", () => {
    const ko = validBase();
    ko[0] = { ...ko[0]!, words: [{ word: "사과", aliases: ["경찰"] }, ko[0]!.words[1]!] };
    expect(keywordListProblems(ko)).toHaveLength(1);
    const one = validBase();
    one[0] = { ...one[0]!, words: [{ word: "사과", aliases: ["a"] }, one[0]!.words[1]!] };
    expect(keywordListProblems(one)).toHaveLength(1);
  });

  it("장르 라벨이 6자소를 넘거나 비어 있으면 위반 1건", () => {
    const long = validBase();
    long[0] = { ...long[0]!, label: "일곱자소라벨이다" };
    expect(keywordListProblems(long)).toHaveLength(1);
    const empty = validBase();
    empty[0] = { ...empty[0]!, label: " " };
    expect(keywordListProblems(empty)).toHaveLength(1);
  });
});

describe("실제 목록 GENRES — 항목 불변식(D-05, P23-27, T-23-12·14, SC2)", () => {
  it("위반이 0건이다", () => {
    expect(keywordListProblems(GENRES)).toEqual([]);
  });

  it("음식·동물·장소 장르가 있고 각각 단어 30개 이상", () => {
    for (const id of ["food", "animal", "place"]) {
      const g = GENRES.find((x) => x.id === id);
      expect(g, `장르 ${id}`).toBeDefined();
      expect(g!.words.length, `${id} 단어 수`).toBeGreaterThanOrEqual(30);
    }
  });
});

// ---- Task 2: 크기 불변식 ----

describe("실제 목록 GENRES — 크기 불변식(SC5)", () => {
  it("장르 6~8개, 장르마다 단어 30개 이상, 전체 210개 이상", () => {
    expect(GENRES.length).toBeGreaterThanOrEqual(6);
    expect(GENRES.length).toBeLessThanOrEqual(8);
    for (const g of GENRES) expect(g.words.length, `${g.id} 단어 수`).toBeGreaterThanOrEqual(30);
    expect(GENRES.reduce((s, g) => s + g.words.length, 0)).toBeGreaterThanOrEqual(210);
  });

  it("영화·음식·동물·장소·스포츠·물건·나라 일곱 장르가 있다", () => {
    expect(GENRES.map((g) => g.id)).toEqual(["movie", "food", "animal", "place", "sport", "object", "country"]);
  });

  it("모든 항목의 별칭이 하나 이상이다(한국어 변형·영어·짧은 이름)", () => {
    for (const g of GENRES) for (const e of g.words) expect(e.aliases.length, `${g.id}/${e.word}`).toBeGreaterThanOrEqual(1);
  });

  it("pickKeyword(seededRandInt(s)) 는 s=1..50 에서 모두 조회되고 둘 이상의 장르가 나온다", () => {
    const picked = new Set<string>();
    for (let s = 1; s <= 50; s++) {
      const { genre, word } = pickKeyword(seededRandInt(s));
      expect(keywordEntryOf(genre, word), `시드 ${s}: ${genre}/${word}`).toBeDefined();
      expect(genreLabelOf(genre), `시드 ${s}: ${genre}`).toBeTruthy();
      picked.add(genre);
    }
    expect(picked.size).toBeGreaterThanOrEqual(2);
  });
});
