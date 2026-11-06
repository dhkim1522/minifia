import { describe, expect, it } from "vitest";
import {
  RESULT_TEXT,
  defenseAnnounce,
  endedAnnounce,
  noExecutionPrefix,
  noExecutionText,
  winnerText,
} from "../../src/game/verdict";

// 08-20: 결과 화면·밤 패널·단계 안내가 쓰는 문구와 결과 연출 시각만 검사한다(후보 공개 시간표·테이블 기하·후광은 v1.0 테이블 화면과 함께 지웠다).
// DOM 없는 순수 모듈이라 직접 부른다.
describe("결과 화면 문구 (11-05, 결정 0051)", () => {
  it("제목 세 개뿐이다: 결과 · 시민 승리 · 마피아 승리 (읽는 글은 승리 한 줄)", () => {
    expect(RESULT_TEXT).toEqual({ title: { result: "결과", citizenWin: "시민 승리", mafiaWin: "마피아 승리" } });
  });

  it("옛 결과 화면 전용 연출 시각·요약 함수는 없다", async () => {
    const mod = (await import("../../src/game/verdict")) as Record<string, unknown>;
    for (const gone of ["RESULT_FLIP_AT_MS", "RESULT_SUMMARY_AT_MS", "summaryLines", "endedSubtitle", "UNKNOWN_NAME"]) expect(Object.hasOwn(mod, gone), gone).toBe(false);
  });
});

describe("순수 모듈 검사 (D-38)", () => {
  it("DOM·현재 시각·난수를 쓰지 않는다", async () => {
    const { readFileSync } = await import("node:fs");
    const src = readFileSync(new URL("../../src/game/verdict.ts", import.meta.url), "utf8")
      .split("\n")
      .filter((line) => !/^\s*(\/\/|\*|\/\*)/.test(line))
      .join("\n");
    expect(src).not.toMatch(/Date\.now|Math\.random|document\.|window\./);
  });
});

// ---- 문구 정본 (UI-SPEC 7.2·7.3, D-11, D-19, D-34) ----

describe("verdict 문구 함수 — UI-SPEC 7.2·7.3", () => {
  it("읽기용 단계 안내와 보조 문구 함수", () => {
    expect(defenseAnnounce("도윤")).toBe("도윤님의 최후 변론");
    expect(defenseAnnounce(null)).toBe("내 최후 변론");
    expect(endedAnnounce("citizenWin")).toBe("게임이 끝났습니다. 시민 팀 승리");
    expect(endedAnnounce("mafiaWin")).toBe("게임이 끝났습니다. 마피아 팀 승리");
    expect(noExecutionPrefix("tie")).toBe("처형 무효. 동률이라 처형하지 않아요. ");
  });
});

describe("noExecutionText · winnerText (D-34, UI-SPEC 7.2)", () => {
  it("무효 이유 부제 둘(찬반 부결은 처형 단계가 알린다)", () => {
    expect(noExecutionText("tie")).toBe("동률이라 처형하지 않아요");
    expect(noExecutionText("noVotes")).toBe("던진 표가 없어요");
  });
  it("승리 배너", () => {
    expect(winnerText("citizenWin")).toEqual({ title: "시민 팀 승리", sub: "마피아가 모두 탈락했어요", announce: "게임이 끝났습니다. 시민 팀 승리" });
    expect(winnerText("mafiaWin")).toEqual({
      title: "마피아 팀 승리",
      sub: "마피아 수가 나머지 생존자 수와 같아졌어요",
      announce: "게임이 끝났습니다. 마피아 팀 승리",
    });
  });
});

describe("T-04-40: 닉네임은 평문으로만 이어 붙인다", () => {
  it("문구 함수가 마크업·중괄호를 그대로 둔 문자열을 돌려준다", () => {
    expect(defenseAnnounce("<i>")).toBe("<i>님의 최후 변론");
  });
});
