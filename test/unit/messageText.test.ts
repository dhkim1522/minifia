import { describe, expect, it } from "vitest";
import { EMOJI_IDS, TEMPLATE_IDS } from "../../shared/protocol";
import { EMOJI_TEXT, hasBatchim, messageText, TEMPLATE_CHIP, TEMPLATE_ORDER } from "../../src/game/messageText";

const NAMES: Record<number, string> = {
  1: "하윤",
  2: "도현",
  3: "지우",
  4: "Kim",
  5: "민수1",
  6: "서준😀",
};
const nick = (seat: number) => NAMES[seat];

describe("hasBatchim", () => {
  it("받침 있는 한글은 true, 없는 한글·영문·숫자·빈 문자열은 false", () => {
    expect(hasBatchim("윤")).toBe(true);
    expect(hasBatchim("우")).toBe(false);
    expect(hasBatchim("A")).toBe(false);
    expect(hasBatchim("1")).toBe(false);
    expect(hasBatchim("")).toBe(false);
  });
});

describe("messageText: 템플릿 → 문장", () => {
  it("suspect · trust · vote 는 닉네임 뒤에 고정 문구", () => {
    expect(messageText({ template: "suspect", target: 1 }, nick)).toBe("하윤 의심돼요");
    expect(messageText({ template: "trust", target: 1 }, nick)).toBe("하윤 믿어요");
    expect(messageText({ template: "vote", target: 1 }, nick)).toBe("하윤 투표해요");
  });

  it("innocent 는 대상 없이 '저 아니에요'", () => {
    expect(messageText({ template: "innocent" }, nick)).toBe("저 아니에요");
  });

  it("claimed: 닉네임 받침에 따라 은/는, 직업 받침에 따라 이었어요/였어요", () => {
    expect(messageText({ template: "claimed", target: 1, claimedRole: "police" }, nick)).toBe("하윤은 경찰이었어요");
    expect(messageText({ template: "claimed", target: 2, claimedRole: "mafia" }, nick)).toBe("도현은 마피아였어요");
    expect(messageText({ template: "claimed", target: 3, claimedRole: "doctor" }, nick)).toBe("지우는 의사였어요");
    expect(messageText({ template: "claimed", target: 1, claimedRole: "citizen" }, nick)).toBe("하윤은 시민이었어요");
  });

  it("claimed: 영문·숫자·이모지로 끝나는 이름은 '는'", () => {
    expect(messageText({ template: "claimed", target: 4, claimedRole: "citizen" }, nick)).toBe("Kim는 시민이었어요");
    expect(messageText({ template: "claimed", target: 5, claimedRole: "citizen" }, nick)).toBe("민수1는 시민이었어요");
    expect(messageText({ template: "claimed", target: 6, claimedRole: "citizen" }, nick)).toBe("서준😀는 시민이었어요");
  });

  it("빈칸 미리보기: 대상이 없으면 [○○], 직업이 없으면 [직업]", () => {
    expect(messageText({ template: "suspect" }, nick)).toBe("[○○] 의심돼요");
    expect(messageText({ template: "claimed" }, nick)).toBe("[○○]는 [직업]이었어요");
    expect(messageText({ template: "claimed", target: 1 }, nick)).toBe("하윤은 [직업]이었어요");
    expect(messageText({ template: "claimed", claimedRole: "police" }, nick)).toBe("[○○]는 경찰이었어요");
  });

  it("nicknameOf 가 undefined 를 주면 그 자리는 [○○]", () => {
    expect(messageText({ template: "vote", target: 99 }, nick)).toBe("[○○] 투표해요");
  });
});

describe("문구 칩·이모티콘 이름", () => {
  it("TEMPLATE_ORDER 는 suspect, trust, innocent, claimed, vote 이고 다섯 템플릿을 모두 담는다", () => {
    expect(TEMPLATE_ORDER).toEqual(["suspect", "trust", "innocent", "claimed", "vote"]);
    expect([...TEMPLATE_ORDER].sort()).toEqual([...TEMPLATE_IDS].sort());
  });

  it("TEMPLATE_CHIP 글자는 UI-SPEC 문구 칩과 같다", () => {
    expect(TEMPLATE_CHIP).toEqual({
      suspect: "[○○] 의심돼요",
      trust: "[○○] 믿어요",
      innocent: "저 아니에요",
      claimed: "[○○]는 [직업]이었어요",
      vote: "[○○] 투표해요",
    });
  });

  it("EMOJI_TEXT: 여덟 개 모두 있고 grin 만 이름과 칸 글자가 다르다", () => {
    expect(Object.keys(EMOJI_TEXT).sort()).toEqual([...EMOJI_IDS].sort());
    expect(EMOJI_TEXT.grin).toEqual({ name: "크게 웃음", cell: "크게" });
    expect(EMOJI_TEXT.smile).toEqual({ name: "웃음", cell: "웃음" });
    expect(EMOJI_TEXT.surprised).toEqual({ name: "놀람", cell: "놀람" });
    expect(EMOJI_TEXT.suspicious).toEqual({ name: "의심", cell: "의심" });
    expect(EMOJI_TEXT.angry).toEqual({ name: "화남", cell: "화남" });
    expect(EMOJI_TEXT.sad).toEqual({ name: "슬픔", cell: "슬픔" });
    expect(EMOJI_TEXT.heart).toEqual({ name: "좋아요", cell: "좋아요" });
    expect(EMOJI_TEXT.exclaim).toEqual({ name: "느낌표", cell: "느낌표" });
  });
});
