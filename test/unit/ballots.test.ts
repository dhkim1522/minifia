// ballots 카드 본문 형식의 왕복(09.1.1-03, 결정 0066-3). 화면이 같은 파일로 읽는다.
import { describe, expect, it } from "vitest";
import { ballotsCardText, parseBallotsCardText } from "../../shared/game/ballots";

const json = (v: unknown): string => JSON.stringify(v);

describe("ballotsCardText / parseBallotsCardText", () => {
  it("찬성좌석들|반대좌석들 을 쉼표로 쓰고, 한쪽이 비면 빈 문자열이다", () => {
    expect(ballotsCardText({ yes: [3, 4, 5], no: [2] })).toBe("3,4,5|2");
    expect(ballotsCardText({ yes: [], no: [1, 6] })).toBe("|1,6");
    expect(ballotsCardText({ yes: [0], no: [] })).toBe("0|");
    expect(ballotsCardText({ yes: [], no: [] })).toBe("|");
  });

  it("왕복: 쓴 것을 다시 읽으면 같은 목록이다", () => {
    for (const b of [{ yes: [3, 4, 5], no: [2] }, { yes: [], no: [1, 6] }, { yes: [0], no: [] }, { yes: [], no: [] }]) {
      expect(json(parseBallotsCardText(ballotsCardText(b)))).toBe(json(b));
    }
  });

  it("모양이 틀리면 null 이다(구분자 없음·숫자 아님·범위 밖·소수·중복·여분 구분자)", () => {
    for (const bad of ["", "1,2", "a|1", "1|b", "8|1", "1|-1", "1.5|2", "1,1|2", "1|2|3", "1,,2|3", " 1|2"]) {
      expect(parseBallotsCardText(bad)).toBeNull();
    }
  });
});
