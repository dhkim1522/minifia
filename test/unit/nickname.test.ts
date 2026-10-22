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
