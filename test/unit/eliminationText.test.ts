import { describe, expect, it } from "vitest";
import { MORNING_PHRASE_COUNT } from "../../shared/protocol";
import { ELIMINATION_TAILS, eliminationTitle, MORNING_SAFE, morningCardText } from "../../src/game/eliminationText";

// 탈락 문구 표(UI-SPEC M, 시안 M1·M2). 서버는 번호만 보내고 문장은 화면이 만든다. 이름 뒤는 받침과 무관하게 항상 '님이'.

describe("ELIMINATION_TAILS", () => {
  it("길이가 서버 MORNING_PHRASE_COUNT 와 같다", () => {
    expect(ELIMINATION_TAILS.length).toBe(MORNING_PHRASE_COUNT);
  });

  it("UI-SPEC 표의 여덟 문장과 순서·글자가 같다", () => {
    expect(ELIMINATION_TAILS.join("|")).toBe(
      [
        "이슬이 되어 사라졌습니다",
        "조용히 눈을 감았습니다",
        "억울하게 목숨을 잃었습니다",
        "차갑게 식은 채 발견되었습니다",
        "끝내 아침을 맞지 못했습니다",
        "어둠 속으로 사라졌습니다",
        "마지막 숨을 거두었습니다",
        "밤사이 변을 당했습니다",
      ].join("|"),
    );
  });
});

describe("eliminationTitle", () => {
  it("이름 뒤에 받침과 무관하게 항상 '님이'", () => {
    expect(eliminationTitle(1, "서연")).toBe("서연님이 이슬이 되어 사라졌습니다");
    expect(eliminationTitle(2, "지호")).toBe("지호님이 조용히 눈을 감았습니다");
    expect(eliminationTitle(3, "가나다라마").startsWith("가나다라마님이 ")).toBe(true);
    expect(eliminationTitle(8, "민")).toBe("민님이 밤사이 변을 당했습니다");
  });

  it("범위 밖 번호(0·9·1.5·NaN·undefined)는 첫 문구를 쓴다(예외 없음)", () => {
    const first = "서연님이 이슬이 되어 사라졌습니다";
    expect(eliminationTitle(0, "서연")).toBe(first);
    expect(eliminationTitle(9, "서연")).toBe(first);
    expect(eliminationTitle(1.5, "서연")).toBe(first);
    expect(eliminationTitle(Number.NaN, "서연")).toBe(first);
    expect(eliminationTitle(undefined, "서연")).toBe(first);
  });
});

describe("morningCardText", () => {
  const nick = (seat: number) => (seat === 2 ? "민지" : undefined);

  it("{} 와 undefined 는 무사 문구", () => {
    expect(JSON.stringify(morningCardText({}, nick))).toBe(JSON.stringify(MORNING_SAFE));
    expect(JSON.stringify(morningCardText(undefined, nick))).toBe(JSON.stringify(MORNING_SAFE));
  });

  it("{eliminated 2, phrase 5} + 닉네임 '민지' → 제목 하나(sub 없음)", () => {
    const t = morningCardText({ eliminated: 2, phrase: 5 }, nick);
    expect(t.title).toBe("민지님이 끝내 아침을 맞지 못했습니다");
    expect(t.sub === undefined).toBe(true);
  });

  it("닉네임을 못 찾으면 무사 문구", () => {
    expect(JSON.stringify(morningCardText({ eliminated: 4, phrase: 1 }, nick))).toBe(JSON.stringify(MORNING_SAFE));
  });
});
