import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { VoteLogEntry } from "../../shared/protocol";
import { recordRows } from "../../src/game/recordRows";

// 유저 기록 카드의 행 만들기(04-27, VOTE-04, D-02, D-08, P-16). 입력은 서버가 모두에게 같게 보낸 공개 기록뿐이다.

const NAMES: Record<number, string> = { 0: "지우", 1: "하윤", 2: "도현", 3: "민서" };
const nameOf = (seat: number): string | undefined => NAMES[seat];

const VOTES: VoteLogEntry[] = [
  { n: 1, exec: { yes: 1, no: 3, passed: false }, cand: { votes: [{ seat: 1, target: 2 }, { seat: 0, target: 2 }], candidate: 2 } },
  { n: 2, exec: { yes: 3, no: 1, passed: true } },
];

describe("recordRows — 순서", () => {
  it("일차 내림차순이고 같은 일차는 처형 여부 → 후보 선택 순이다", () => {
    const rows = recordRows(1, VOTES, nameOf);
    expect(rows.map((r) => `${r.day}:${r.kind}`)).toEqual(["2:exec", "1:exec", "1:cand"]);
  });

  it("기록이 오름차순으로 와도 최신 일차가 위다", () => {
    const rows = recordRows(3, [...VOTES].reverse(), nameOf);
    expect(rows.map((r) => `${r.day}:${r.kind}`)).toEqual(["2:exec", "1:exec"]);
  });

  it("행은 주장 종류가 없고 처형 여부·후보 선택 두 종류뿐이다", () => {
    const kinds = new Set(recordRows(1, VOTES, nameOf).map((r) => r.kind));
    expect([...kinds].sort()).toEqual(["cand", "exec"]);
  });
});

describe("recordRows — 처형 여부 집계 (D-02, T-04-67)", () => {
  it("모든 seat 에게 같은 집계 한 줄: `처형 여부 찬성 N · 반대 M`, 통과면 뒤에 아무것도 없다", () => {
    const a = recordRows(1, VOTES, nameOf).filter((r) => r.kind === "exec");
    const b = recordRows(3, VOTES, nameOf).filter((r) => r.kind === "exec");
    expect(a).toEqual(b);
    expect(a.map((r) => r.text)).toEqual(["처형 여부 찬성 3 · 반대 1", "처형 여부 찬성 1 · 반대 3 · 미통과"]);
  });

  it("집계 줄에는 찬성·반대 수 말고 개인 표시(이름·seat)가 없다", () => {
    for (const r of recordRows(1, VOTES, nameOf).filter((x) => x.kind === "exec")) {
      expect(r.target).toBeUndefined();
      expect(r.text).toMatch(/^처형 여부 찬성 \d+ · 반대 \d+( · 미통과)?$/);
    }
  });
});

describe("recordRows — 후보 선택 (D-07, P-16)", () => {
  it("이 사람의 줄이 있으면 대상 이름이 담긴 행이 하나 생긴다", () => {
    const rows = recordRows(1, VOTES, nameOf).filter((r) => r.kind === "cand");
    expect(rows).toEqual([{ key: "cand-1", day: 1, kind: "cand", target: "도현" }]);
  });

  it("cand 가 있는데 이 사람 줄이 없으면(탈락·무효표 구별 불가) 행이 없다", () => {
    expect(recordRows(3, VOTES, nameOf).filter((r) => r.kind === "cand")).toEqual([]);
  });

  it("cand 자체가 없는 일차에는 행이 없다", () => {
    expect(recordRows(1, [{ n: 2, exec: { yes: 1, no: 0, passed: true } }], nameOf).filter((r) => r.kind === "cand")).toEqual([]);
  });

  it("대상 닉네임을 못 찾으면 `알 수 없는 사람`", () => {
    const votes: VoteLogEntry[] = [{ n: 1, exec: { yes: 0, no: 0, passed: false }, cand: { votes: [{ seat: 1, target: 9 }] } }];
    expect(recordRows(1, votes, nameOf).find((r) => r.kind === "cand")?.target).toBe("알 수 없는 사람");
  });
});

describe("recordRows — 불변·빈 입력", () => {
  it("입력 배열을 바꾸지 않는다", () => {
    const v = JSON.stringify(VOTES);
    recordRows(1, VOTES, nameOf);
    expect(JSON.stringify(VOTES)).toBe(v);
  });

  it("아무 기록도 없으면 빈 배열", () => {
    expect(recordRows(1, [], nameOf)).toEqual([]);
  });

  it("key 는 행마다 겹치지 않는다", () => {
    const keys = recordRows(1, VOTES, nameOf).map((r) => r.key);
    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe("recordRows — 소스 규약", () => {
  it("직업 단어를 만들지 않고 DOM 을 쓰지 않는다", () => {
    const code = readFileSync("src/game/recordRows.ts", "utf8").replace(/\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");
    expect(/마피아|경찰|의사|시민/.test(code)).toBe(false);
    expect(/document|window|spectate|\bme\.role\b/.test(code)).toBe(false);
  });
});
