// 23-03: 금지어 판정 violatesKeyword 의 우회 표(결정 0089-5·D-08, SC2, T-23-09). RESEARCH P3 실행 확인 표 전부를 단언한다.
import { describe, expect, it } from "vitest";
import { choseongOf, normalizeForGuard, violatesKeyword } from "../../shared/game/keywordGuard";

const HARRY = { word: "해리포터", aliases: ["Harry Potter", "해리", "해포", "potter", "harry", "포터"] } as const;

describe("violatesKeyword — 해리포터 표(RESEARCH P3)", () => {
  const blocked: ReadonlyArray<readonly [string, string]> = [
    ["해.리.포.터", "기호 제거 후 해리포터"],
    ["해리_포터", "밑줄"],
    ["Harry_Potter", "별칭 + 밑줄"],
    ["Harry Potter", "별칭 그대로"],
    ["HARRY POTTER", "대문자"],
    ["ｈａｒｒｙ", "전각 영문"],
    ["해리potter", "혼합 표기는 별칭이 막는다"],
    ["ㅎㄹㅍㅌ", "초성"],
    ["ㅎ ㄹ ㅍ ㅌ", "초성 + 공백"],
    ["해리 포 터", "공백 삽입"],
    ["해-리-포-터", "하이픈 삽입"],
    ["해​리포터", "영폭 공백 삽입"],
    ["해리포터를 좋아해요", "부분 포함"],
  ];
  for (const [input, why] of blocked) {
    it(`막힘: ${JSON.stringify(input)} (${why})`, () => {
      expect(violatesKeyword(input, HARRY)).toBe(true);
    });
  }

  const passed: ReadonlyArray<readonly [string, string]> = [
    ["hery foter", "철자를 일부러 틀린 우회는 매너(0089-5)"],
    ["마법사 안경 소년", "무관한 설명"],
    ["ㅎㄹ", "초성열이 키워드 전체 초성열보다 짧다"],
    ["ㅎㄹㅍ", "초성열이 키워드 전체 초성열보다 짧다"],
    ["a해b리c포d터", "글자를 끼운 우회는 매너(0089-5)"],
  ];
  for (const [input, why] of passed) {
    it(`통과: ${JSON.stringify(input)} (${why})`, () => {
      expect(violatesKeyword(input, HARRY)).toBe(false);
    });
  }

  it("키워드와 모든 별칭 자기 자신은 막힌다", () => {
    for (const form of [HARRY.word, ...HARRY.aliases]) expect(violatesKeyword(form, HARRY)).toBe(true);
  });

  it("별칭 단독(Potter) 도 막힌다", () => {
    expect(violatesKeyword("Potter", HARRY)).toBe(true);
  });
});

describe("violatesKeyword — 경계", () => {
  it("숫자 키워드(007, 별칭 없음): 007작전·0 0 7 은 막힌다", () => {
    const k = { word: "007", aliases: [] };
    expect(violatesKeyword("007작전", k)).toBe(true);
    expect(violatesKeyword("0 0 7", k)).toBe(true);
  });

  it("2글자 키워드(사과): 초성 ㅅㄱ 은 통과, 사 과 는 막힌다", () => {
    const k = { word: "사과", aliases: [] };
    expect(violatesKeyword("ㅅㄱ", k)).toBe(false);
    expect(violatesKeyword("사 과", k)).toBe(true);
  });

  it("영어 키워드(BTS, 별칭 방탄소년단): b.t.s 는 막히고 초성 검사는 없다", () => {
    const k = { word: "BTS", aliases: ["방탄소년단"] };
    expect(violatesKeyword("b.t.s", k)).toBe(true);
    expect(violatesKeyword("ㅂㅌㅅㄴㄷ", k)).toBe(true); // 별칭 방탄소년단(5글자 음절)의 초성은 막는다
    expect(violatesKeyword("ㅂㅌㅅ", k)).toBe(false); // 영어 키워드는 초성 검사 없음
  });

  it("길이 1 형태(별칭 a)는 무시해 apple 같은 답을 막지 않는다", () => {
    const k = { word: "사과", aliases: ["a"] };
    expect(violatesKeyword("apple", k)).toBe(false);
    expect(violatesKeyword("바나나", k)).toBe(false);
  });

  it("빈 문자열·기호뿐인 답은 막히지 않는다(다른 규칙이 거른다)", () => {
    expect(violatesKeyword("", HARRY)).toBe(false);
    expect(violatesKeyword("!!! ... ???", HARRY)).toBe(false);
    expect(violatesKeyword("   ", HARRY)).toBe(false);
  });

  it("NFD 로 쪼갠 입력도 NFKC 가 합쳐 막힌다", () => {
    expect(violatesKeyword("해리포터".normalize("NFD"), HARRY)).toBe(true);
  });

  it("호환 자모 ㅎㅐㄹㅣㅍㅗㅌㅓ 는 NFKC 가 합쳐 막힌다", () => {
    expect(violatesKeyword("ㅎㅐㄹㅣㅍㅗㅌㅓ", HARRY)).toBe(true);
  });

  it("길이가 바뀌는 정규화 입력(ﬁ)에서도 오류 없이 판정한다", () => {
    expect(() => violatesKeyword("ﬁ ﬂ ㎏ ①", HARRY)).not.toThrow();
    expect(violatesKeyword("ﬁre", { word: "fire", aliases: [] })).toBe(true);
  });

  it("알려진 한계, 0091 에 기록: 고양이 에 가을이 왔다 는 초성열 ㄱㅇㅇ 이 들어 있어 막힌다(D-08 문언대로)", () => {
    expect(violatesKeyword("가을이 왔다", { word: "고양이", aliases: [] })).toBe(true);
  });
});

describe("normalizeForGuard · choseongOf", () => {
  it("NFKC → 글자·숫자 외 제거 → 소문자", () => {
    expect(normalizeForGuard("Ｈａrry_Pot-ter 007!")).toBe("harrypotter007");
    expect(normalizeForGuard("해​리 포.터")).toBe("해리포터");
  });

  it("완성형 음절은 조합형 초성 자모로, 그 밖은 그대로 바꾼다", () => {
    expect(choseongOf("해리포터")).toBe("ᄒᄅᄑᄐ");
    expect(choseongOf("ab1")).toBe("ab1");
  });
});
