import { describe, expect, it } from "vitest";
import {
  countGraphemes,
  NICKNAME_MAX_GRAPHEMES,
  nicknameKey,
  normalizeNickname,
  validateNickname,
} from "../../shared/nickname";

const FAMILY = "\u{1F468}‍\u{1F469}‍\u{1F467}";
const NFD_HAN = "한";

describe("validateNickname - 정상 입력", () => {
  it("한글 이름을 그대로 받는다", () => {
    const r = validateNickname("민수");
    expect(r).toEqual({ ok: true, nickname: "민수", key: nicknameKey("민수") });
  });

  it("앞뒤 공백을 지운다", () => {
    const r = validateNickname("  민수  ");
    expect(r.ok && r.nickname).toBe("민수");
  });

  it("안쪽 연속 공백을 하나로 줄인다", () => {
    const r = validateNickname("김  민수");
    expect(r.ok && r.nickname).toBe("김 민수");
  });

  it("8글자는 받는다", () => {
    expect(NICKNAME_MAX_GRAPHEMES).toBe(8);
    expect(validateNickname("가나다라마바사아").ok).toBe(true);
  });

  it("가족 이모지는 글자 1개로 세고 받는다", () => {
    expect(countGraphemes(FAMILY)).toBe(1);
    const r = validateNickname(FAMILY);
    expect(r.ok && r.nickname).toBe(FAMILY);
  });

  it("NFD 로 적은 한글은 NFC 와 같은 이름이 된다", () => {
    const r = validateNickname(NFD_HAN);
    expect(r.ok && r.nickname).toBe("한");
    expect(normalizeNickname(NFD_HAN)).toBe("한");
  });

  it("결과의 key 는 nicknameKey(nickname) 와 같다", () => {
    const r = validateNickname("  Minsu ");
    expect(r.ok && r.key).toBe(nicknameKey("Minsu"));
  });
});

describe("validateNickname - 거부", () => {
  it("9글자는 TOO_LONG", () => {
    expect(validateNickname("가나다라마바사아자")).toEqual({ ok: false, reason: "TOO_LONG" });
  });

  it("빈 값은 EMPTY", () => {
    expect(validateNickname("")).toEqual({ ok: false, reason: "EMPTY" });
  });

  it("공백뿐인 값은 EMPTY", () => {
    expect(validateNickname("   ")).toEqual({ ok: false, reason: "EMPTY" });
  });

  it.each([
    ["널 문자", "a\u0000b"],
    ["영폭 공백", "a​b"],
    ["방향 제어", "a‮b"],
    ["줄바꿈", "a\nb"],
  ])("%s 가 들어 있으면 INVALID_CHARS", (_name, raw) => {
    expect(validateNickname(raw)).toEqual({ ok: false, reason: "INVALID_CHARS" });
  });

  it("U+200D 하나뿐인 값은 보이는 글자가 없어 INVALID_CHARS", () => {
    expect(validateNickname("‍")).toEqual({ ok: false, reason: "INVALID_CHARS" });
  });
});

describe("CR-01 보이지 않는 문자", () => {
  it("CR-01: ZWJ 를 끼운 이름은 원래 이름과 같은 키다", () => {
    expect(nicknameKey("철\u{200D}수")).toBe(nicknameKey("철수"));
  });

  it("CR-01: ZWJ 를 끼운 이름은 표시 이름을 그대로 두고 키만 원래 이름과 같다", () => {
    const r = validateNickname("철\u{200D}수");
    expect(r.ok && r.nickname).toBe("철\u{200D}수");
    expect(r.ok && r.key).toBe(nicknameKey("철수"));
  });

  it("CR-01: 변형 선택자(U+FE0F)를 끼운 이름은 원래 이름과 같은 키다", () => {
    expect(nicknameKey("철\u{FE0F}수")).toBe(nicknameKey("철수"));
  });

  it("CR-01: 결합 문자(U+0301)를 끼운 이름은 원래 이름과 같은 키다", () => {
    expect(nicknameKey("철\u{0301}수")).toBe(nicknameKey("철수"));
  });

  it("CR-01: 제거로 이웃하게 된 자모는 두 번째 NFKC 로 합쳐 같은 키다", () => {
    expect(nicknameKey("\u{1112}\u{0301}\u{1161}")).toBe(nicknameKey("하"));
  });

  it("CR-01: 변형 선택자를 끼운 이름은 표시 이름을 그대로 둔다", () => {
    const r = validateNickname("철\u{FE0F}수");
    expect(r.ok && r.nickname).toBe("철\u{FE0F}수");
  });

  it.each([
    ["U+3164", "\u{3164}"],
    ["U+2800", "\u{2800}"],
    ["U+115F", "\u{115F}"],
    ["U+1160", "\u{1160}"],
    ["U+FFA0", "\u{FFA0}"],
    ["U+3164 앞뒤 공백", " \u{3164} "],
    ["U+3164 가 글자 사이", "철\u{3164}수"],
    ["U+2800 가 글자 사이", "민\u{2800}수"],
    ["U+FF9E 반각 탁점 하나(키가 빔)", "\u{FF9E}"],
    ["U+3164 9번 반복(TOO_LONG 아님)", "\u{3164}".repeat(9)],
    ["U+FF9E 9번 반복(TOO_LONG 아님)", "\u{FF9E}".repeat(9)],
  ])("CR-01: %s 는 INVALID_CHARS", (_name, raw) => {
    const r = validateNickname(raw);
    expect(r.ok ? "ok" : r.reason).toBe("INVALID_CHARS");
  });

  it("CR-01: 하트 이모지는 입력 그대로 받고 키는 변형 선택자 없는 하트와 같다", () => {
    const r = validateNickname("\u{2764}\u{FE0F}");
    expect(r.ok && r.nickname).toBe("\u{2764}\u{FE0F}");
    expect(r.ok && r.key).toBe(nicknameKey("\u{2764}"));
  });

  it("CR-01: 무지개 깃발은 입력 그대로 받는다", () => {
    const r = validateNickname("\u{1F3F3}\u{FE0F}\u{200D}\u{1F308}");
    expect(r.ok && r.nickname).toBe("\u{1F3F3}\u{FE0F}\u{200D}\u{1F308}");
  });

  it("CR-01: 피부색 수정자는 키에서 지우지 않는다", () => {
    const r = validateNickname("\u{1F44D}\u{1F3FD}");
    expect(r.ok).toBe(true);
    expect(r.ok && r.key === nicknameKey("\u{1F44D}")).toBe(false);
  });

  it("CR-01: 한글 음절은 결합 문자 제거의 영향을 받지 않는다", () => {
    expect(nicknameKey("민수")).toBe("민수");
    expect(nicknameKey("\u{1112}\u{1161}\u{11AB}")).toBe("\u{D55C}");
  });

  it("CR-01: 가족 이모지 8개는 글자 8개로 받는다", () => {
    expect(validateNickname("\u{1F468}\u{200D}\u{1F469}\u{200D}\u{1F467}".repeat(8)).ok).toBe(true);
  });
});

describe("nicknameKey", () => {
  it("대소문자와 전각 문자를 같은 키로 만든다", () => {
    const k = nicknameKey("Minsu");
    expect(nicknameKey("minsu")).toBe(k);
    expect(nicknameKey("ＭＩＮＳＵ")).toBe(k);
  });

  it("NFD 와 NFC 로 다르게 적은 같은 한글은 같은 키가 된다", () => {
    expect(nicknameKey(NFD_HAN)).toBe(nicknameKey("한"));
  });
});
