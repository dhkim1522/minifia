import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { CandidateVoteLine, SummaryRow, VoteLogEntry } from "../../shared/protocol";
import {
  RESULT_FLIP_AT_MS,
  RESULT_SUMMARY_AT_MS,
  UNKNOWN_NAME,
  VERDICT_TEXT,
  defenseAnnounce,
  endedAnnounce,
  endedSubtitle,
  noExecutionPrefix,
  noExecutionText,
  summaryLines,
  winnerText,
} from "../../src/game/verdict";

// 08-20: 결과 화면·밤 패널·단계 안내가 쓰는 문구와 결과 연출 시각만 검사한다(후보 공개 시간표·테이블 기하·후광은 v1.0 테이블 화면과 함께 지웠다).
// DOM 없는 순수 모듈이라 직접 부른다.
const sameSeatVotes = (pairs: [number, number][]): CandidateVoteLine[] => pairs.map(([seat, target]) => ({ seat, target }));

describe("결과 화면 연출 시각 (UI-SPEC 11.2)", () => {
  it("값이 UI-SPEC 와 같다", () => {
    expect([RESULT_FLIP_AT_MS, RESULT_SUMMARY_AT_MS]).toEqual([300, 900]);
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

// ---- 문구 정본 (UI-SPEC 7.2·7.3, D-11, D-19, D-27, D-34) ----
const NAMES: Record<number, string> = { 0: "나나나나나", 1: "지호", 2: "도윤", 3: "서연", 4: "하늘" };
const nameOf = (seat: number): string | undefined => NAMES[seat];

describe("VERDICT_TEXT — UI-SPEC 7.2 와 글자까지 같다", () => {
  it("옛 후보 선택 안내 키는 없다 (결정 0040: 이름을 글자 그대로 두지 않아 남은 참조를 grep 이 잡는다)", () => {
    expect(Object.hasOwn(VERDICT_TEXT, ["candidate", "Hint"].join(""))).toBe(false);
  });

  it("남은 고정 문구 전부 (지운 화면 전용 키는 없다)", () => {
    expect(VERDICT_TEXT).toMatchObject({
      candidateNone: "선택 안 함",
      votedSuffix: "님에게 투표했어요",
      endedTitle: "게임 종료",
      summaryTitle: "이번 판 기록",
      homeButton: "처음으로",
      roomCloseNote: "이 방은 30분 뒤에 닫혀요",
    });
    expect(Object.keys(VERDICT_TEXT).sort()).toEqual(["announce", "candidateNone", "endedTitle", "homeButton", "roomCloseNote", "summaryTitle", "votedSuffix"]);
  });

  it("값이 UI-SPEC 문서에도 그대로 있다 (문서가 있을 때)", () => {
    const path = new URL("../../.planning/milestones/v1.0-phases/04-execution-verdict/04-UI-SPEC.md", import.meta.url);
    if (!existsSync(path)) return;
    const doc = readFileSync(path, "utf8");
    const flat = (v: unknown): string[] => (typeof v === "string" ? [v] : typeof v === "object" && v !== null ? Object.values(v).flatMap(flat) : []);
    for (const text of flat(VERDICT_TEXT)) expect(doc, text).toContain(text);
  });

  it("읽기용 단계 안내와 보조 문구 함수", () => {
    expect(VERDICT_TEXT.announce.execVote).toBe("처형 여부 투표. 오늘 처형을 할까요?");
    expect(VERDICT_TEXT.announce.candidateVote).toBe("후보 선택 투표. 처형할 사람을 고르세요");
    expect(VERDICT_TEXT.announce.candidateVoteReveal).toBe("투표 공개");
    expect(defenseAnnounce("도윤")).toBe("도윤님의 최후 변론");
    expect(defenseAnnounce(null)).toBe("내 최후 변론");
    expect(endedAnnounce("citizenWin")).toBe("게임이 끝났습니다. 시민 팀 승리");
    expect(endedAnnounce("mafiaWin")).toBe("게임이 끝났습니다. 마피아 팀 승리");
    expect(noExecutionPrefix("tie")).toBe("처형 무효. 동률이라 처형하지 않아요. ");
  });
});

describe("noExecutionText · winnerText (D-34, UI-SPEC 7.2)", () => {
  it("무효 이유 부제 세 개", () => {
    expect(noExecutionText("notMajority")).toBe("찬성이 과반이 아니에요");
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

describe("summaryLines · endedSubtitle (D-27, UI-SPEC 7.2 ended)", () => {
  const voteLog: VoteLogEntry[] = [
    { n: 1, exec: { yes: 3, no: 1, passed: true }, cand: { votes: sameSeatVotes([[0, 2], [1, 2], [3, 4]]), candidate: 2 } },
    { n: 2, exec: { yes: 1, no: 3, passed: false } },
    { n: 3, exec: { yes: 3, no: 0, passed: true }, cand: { votes: [] } },
    { n: 4, exec: { yes: 3, no: 0, passed: true }, cand: { votes: sameSeatVotes([[0, 1], [3, 4]]) } },
  ];

  it("낮 → 밤 순서로 일차 오름차순, 낮은 처형·무효 네 갈래", () => {
    const summary: SummaryRow[] = [
      { n: 2, exec: { yes: 1, no: 3, passed: false }, night: { target: 1, died: true } },
      { n: 1, exec: { yes: 3, no: 1, passed: true, candidate: 2 }, night: { target: 3, died: false } },
      { n: 3, exec: { yes: 3, no: 0, passed: true } },
      { n: 4, exec: { yes: 3, no: 0, passed: true }, night: { died: false } },
    ];
    const lines = summaryLines(summary, voteLog, nameOf);
    expect(lines.map((l) => [l.label, l.text])).toEqual([
      ["1일차 낮", "도윤님 처형 (2표)"],
      ["1일차 밤", "서연님을 노렸지만 의사가 지켰어요"],
      ["2일차 낮", "처형 없음 (찬성 1 · 반대 3)"],
      ["2일차 밤", "지호님 사망"],
      ["3일차 낮", "처형 없음 (던진 표 없음)"],
      ["4일차 낮", "처형 없음 (동률)"],
      ["4일차 밤", "아무 일도 없었어요"],
    ]);
  });

  it("exec 가 없는 일차는 낮 행이 없고 night 가 없으면 밤 행이 없다", () => {
    const lines = summaryLines([{ n: 1, night: { target: 1, died: true } }, { n: 2, exec: { yes: 0, no: 2, passed: false } }], [], nameOf);
    expect(lines.map((l) => l.label)).toEqual(["1일차 밤", "2일차 낮"]);
  });

  it("밤에 지목 자체가 없으면 아무 일도 없었어요", () => {
    const lines = summaryLines([{ n: 1, night: { died: false } }], [], nameOf);
    expect(lines).toEqual([{ n: 1, kind: "night", label: "1일차 밤", text: "아무 일도 없었어요" }]);
  });

  it("투표 기록을 못 찾아도 예외 없이 표 수만 뺀다", () => {
    const lines = summaryLines([{ n: 7, exec: { yes: 3, no: 0, passed: true, candidate: 2 } }], voteLog, nameOf);
    expect(lines[0].text).toBe("도윤님 처형");
  });

  it("입력을 바꾸지 않는다", () => {
    const summary: SummaryRow[] = [{ n: 2 }, { n: 1 }];
    summaryLines(summary, [], nameOf);
    expect(summary.map((r) => r.n)).toEqual([2, 1]);
  });

  it("endedSubtitle: 마지막 행에 night 가 있으면 밤, 없으면 낮, 행이 없으면 빈 문자열", () => {
    expect(endedSubtitle([{ n: 1, exec: { yes: 1, no: 1, passed: false } }, { n: 2, night: { target: 1, died: true } }])).toBe("2일차 밤");
    expect(endedSubtitle([{ n: 1, night: { died: false } }, { n: 2, exec: { yes: 3, no: 0, passed: true, candidate: 1 } }])).toBe("2일차 낮");
    expect(endedSubtitle([])).toBe("");
  });
});

describe("T-04-40: 닉네임은 평문으로만 이어 붙인다", () => {
  const evil = (seat: number): string | undefined => (seat === 1 ? "<b>가나다라</b>" : seat === 2 ? "{x}&amp;" : undefined);
  it("문구 함수가 마크업·중괄호를 그대로 둔 문자열을 돌려준다", () => {
    expect(summaryLines([{ n: 1, night: { target: 1, died: true } }], [], evil)[0].text).toBe("<b>가나다라</b>님 사망");
    expect(defenseAnnounce("<i>")).toBe("<i>님의 최후 변론");
  });
  it("이름을 못 찾으면 알 수 없는 사람", () => {
    const lost = (): string | undefined => undefined;
    expect(summaryLines([{ n: 1, night: { target: 9, died: true } }], [], lost)[0].text).toBe(`${UNKNOWN_NAME}님 사망`);
    expect(UNKNOWN_NAME).toBe("알 수 없는 사람");
  });
});
