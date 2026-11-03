import { describe, expect, it } from "vitest";
import { MORNING_TEXT, morningText } from "../../src/game/eliminationText";

// 아침 알림 문장 표(결정 0061-17, UI-SPEC 아침). 사회자 문체 세 문장 — 피해자 있음·의사가 살림·아무 일 없음. 서버는 탈락 seat 와 saved 플래그만 보내고 문장은 화면이 만든다.

describe("MORNING_TEXT", () => {
  it("세 문장과 피해자 본인 문장의 글자가 UI-SPEC 과 같다", () => {
    expect(MORNING_TEXT.killed("서연")).toBe("서연 님이 당했습니다");
    expect(MORNING_TEXT.saved).toBe("누군가 살아났습니다");
    expect(MORNING_TEXT.quiet).toBe("아무 일도 없었습니다");
    expect(MORNING_TEXT.victim).toBe("암살당했습니다");
  });

  it("이름 뒤는 받침과 무관하게 항상 ' 님이'", () => {
    expect(MORNING_TEXT.killed("민")).toBe("민 님이 당했습니다");
    expect(MORNING_TEXT.killed("가나다라마")).toBe("가나다라마 님이 당했습니다");
  });
});

describe("morningText", () => {
  const nick = (seat: number) => (seat === 3 ? "서연" : undefined);

  it("피해자가 있으면 '{닉네임} 님이 당했습니다' 와 target 아이콘", () => {
    expect(morningText({ eliminated: 3 }, nick)).toEqual({ text: "서연 님이 당했습니다", icon: "target" });
  });

  it("saved 이면 '누군가 살아났습니다' 와 heal 아이콘 — 누구인지는 어디에도 없다", () => {
    expect(morningText({ saved: true }, nick)).toEqual({ text: "누군가 살아났습니다", icon: "heal" });
  });

  it("{}·undefined 는 '아무 일도 없었습니다' 이고 아이콘이 없다", () => {
    expect(morningText({}, nick)).toEqual({ text: "아무 일도 없었습니다" });
    expect(morningText(undefined, nick)).toEqual({ text: "아무 일도 없었습니다" });
    expect("icon" in morningText({}, nick)).toBe(false);
  });

  it("닉네임을 못 찾으면 무사 문장", () => {
    expect(morningText({ eliminated: 4 }, nick)).toEqual({ text: "아무 일도 없었습니다" });
  });

  it("피해자와 saved 가 함께 와도(있을 수 없는 조합) 피해자 문장이 이긴다", () => {
    expect(morningText({ eliminated: 3, saved: true }, nick).text).toBe("서연 님이 당했습니다");
  });
});
