// 23-06 Task 1: 키워드 답 제출·마감 규칙(D-07·D-09·D-24). 순수 함수라 상태를 실제 시작 전이로 만들고 필요한 값만 손으로 박는다.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { closeKeyword, submitAnswer } from "../../shared/game/keywordAnswer";
import { GENRES } from "../../shared/game/keywords";
import { ANSWER_MAX_GRAPHEMES } from "../../shared/game/answerRules";
import type { RoomState } from "../../shared/game/room";
import { tick } from "../../shared/game/tick";
import { openKeyword } from "../helpers/keyword";
import { startedAt } from "../helpers/voteState";

let restore: () => void = () => {};
beforeEach(() => {
  restore = openKeyword();
});
afterEach(() => restore());

const WORD = "해리포터";

/** 5명 keyword 단계. 키워드를 해리포터로 고정하고 좌석 0 이 마피아, 나머지는 시민 편이 되도록 역할을 손으로 박는다. 좌석 4 는 봇. */
function keywordState(): RoomState {
  const s = startedAt(5, 3, "keyword");
  return {
    ...s,
    keyword: { genre: GENRES[0]!.id, word: WORD },
    players: s.players.map((p) => ({ ...p, role: p.seat === 0 ? ("mafia" as const) : ("citizen" as const), ...(p.seat === 4 ? { isBot: true as const } : {}) })),
  };
}
const idOf = (s: RoomState, seat: number): string => s.players.find((p) => p.seat === seat)!.id;
const must = <T extends { ok: boolean }>(r: T): Extract<T, { ok: true }> => {
  expect(r.ok).toBe(true);
  return r as Extract<T, { ok: true }>;
};

describe("submitAnswer 검사 순서 (D-07)", () => {
  it("keyword 단계가 아니면 WRONG_PHASE", () => {
    const s = { ...keywordState(), phase: "dayAnnounce" as const };
    expect(submitAnswer(s, idOf(s, 1), "안경", true)).toEqual({ ok: false, error: "WRONG_PHASE" });
  });

  it("방에 없는 사람·죽은 사람·봇은 BAD_MESSAGE", () => {
    const s = keywordState();
    expect(submitAnswer(s, "nobody", "안경", true)).toEqual({ ok: false, error: "BAD_MESSAGE" });
    expect(submitAnswer(s, idOf(s, 4), "안경", false)).toEqual({ ok: false, error: "BAD_MESSAGE" });
    const dead = { ...s, players: s.players.map((p) => (p.seat === 1 ? { ...p, alive: false } : p)) };
    expect(submitAnswer(dead, idOf(dead, 1), "안경", true)).toEqual({ ok: false, error: "BAD_MESSAGE" });
  });

  it("서버 봇 경로는 산 봇의 확정만 받으며 금지어 충돌을 마피아 떠보기로 기록하지 않는다", () => {
    const base = keywordState();
    const state = { ...base, players: base.players.map((p) => p.seat === 4 ? { ...p, role: "mafia" as const } : p) };
    const botId = idOf(state, 4);
    expect(submitAnswer(state, idOf(state, 1), "안경", true, "bot")).toEqual({ ok: false, error: "BAD_MESSAGE" });
    expect(submitAnswer(state, botId, "안경", false, "bot")).toEqual({ ok: false, error: "BAD_MESSAGE" });
    expect(submitAnswer(state, botId, WORD, true, "bot")).toEqual({ ok: false, error: "BAD_MESSAGE" });
    const answer = must(submitAnswer(state, botId, "안경", true, "bot")).state;
    expect(answer.keywordProbed).toBeUndefined();
    expect(answer.answerSubmits).toEqual([{ seat: 4, text: "안경" }]);
  });

  it("이미 확정한 사람의 다음 요청은 같은 객체로 조용히 무변화", () => {
    const s = keywordState();
    const first = must(submitAnswer(s, idOf(s, 1), "안경", true));
    expect(first.state.answerSubmits).toEqual([{ seat: 1, text: "안경" }]);
    const again = submitAnswer(first.state, idOf(s, 1), "다른 답", true);
    expect(again).toEqual({ ok: true, state: first.state });
    expect(again.ok && again.state).toBe(first.state);
    const draftAgain = submitAnswer(first.state, idOf(s, 1), "초안", false);
    expect(draftAgain.ok && draftAgain.state).toBe(first.state);
  });

  it("정리 실패(보이는 글자 없음)·20자소 초과는 BAD_MESSAGE, 정확히 20자소는 통과", () => {
    const s = keywordState();
    expect(submitAnswer(s, idOf(s, 1), "​‮", true)).toEqual({ ok: false, error: "BAD_MESSAGE" });
    expect(submitAnswer(s, idOf(s, 1), "가".repeat(ANSWER_MAX_GRAPHEMES + 1), false)).toEqual({ ok: false, error: "BAD_MESSAGE" });
    expect(submitAnswer(s, idOf(s, 1), "가".repeat(ANSWER_MAX_GRAPHEMES), false).ok).toBe(true);
  });
});

describe("초안 (final:false)", () => {
  it("저장한다 — 금지어여도 검사하지 않는다", () => {
    const s = keywordState();
    const r = must(submitAnswer(s, idOf(s, 1), "해리포터 짱", false));
    expect(r.state.players.find((p) => p.seat === 1)!.answerDraft).toBe("해리포터 짱");
    expect(r.state.keywordProbed).toBeUndefined();
    expect(r.state.answerSubmits).toBeUndefined();
  });

  it("정리한 글로 저장하고 같은 값은 같은 객체, 공백뿐이면 키를 지운다", () => {
    const s = keywordState();
    const a = must(submitAnswer(s, idOf(s, 1), "  안경   쓴 사람 ", false));
    expect(a.state.players.find((p) => p.seat === 1)!.answerDraft).toBe("안경 쓴 사람");
    const same = submitAnswer(a.state, idOf(s, 1), "안경 쓴 사람", false);
    expect(same.ok && same.state).toBe(a.state);
    const erased = must(submitAnswer(a.state, idOf(s, 1), "   ", false));
    expect("answerDraft" in erased.state.players.find((p) => p.seat === 1)!).toBe(false);
    const noop = submitAnswer(s, idOf(s, 1), "  ", false);
    expect(noop.ok && noop.state).toBe(s);
  });
});

describe("확정 (final:true)", () => {
  it("빈 글은 BAD_MESSAGE", () => {
    const s = keywordState();
    expect(submitAnswer(s, idOf(s, 1), "   ", true)).toEqual({ ok: false, error: "BAD_MESSAGE" });
  });

  it("통과하면 낸 순서대로 answerSubmits 에 쌓이고 그 사람의 초안이 지워진다", () => {
    const s = keywordState();
    const d = must(submitAnswer(s, idOf(s, 3), "초안", false));
    const a = must(submitAnswer(d.state, idOf(s, 3), "안경", true));
    const b = must(submitAnswer(a.state, idOf(s, 1), "마법", true));
    expect(b.state.answerSubmits).toEqual([
      { seat: 3, text: "안경" },
      { seat: 1, text: "마법" },
    ]);
    expect("answerDraft" in b.state.players.find((p) => p.seat === 3)!).toBe(false);
  });

  it("금지어(단어·별칭·초성)는 BAD_MESSAGE — 시민의 거절은 상태 변경을 싣지 않는다", () => {
    const s = keywordState();
    for (const text of ["해리포터", "harry potter 같은", "ㅎㄹㅍㅌ", "해포"]) {
      const r = submitAnswer(s, idOf(s, 1), text, true);
      expect(r).toEqual({ ok: false, error: "BAD_MESSAGE" });
    }
  });

  it("마피아의 금지어 거절은 keywordProbed 를 켜는 state 를 싣는다 — 이미 켜져 있으면 싣지 않는다", () => {
    const s = keywordState();
    const first = submitAnswer(s, idOf(s, 0), "해리포터", true);
    expect(first.ok).toBe(false);
    expect(!first.ok && first.error).toBe("BAD_MESSAGE");
    expect(!first.ok && first.state?.keywordProbed).toBe(true);
    // 켜진 상태에서는 state 없음(응답은 같다)
    const probed = { ...s, keywordProbed: true as const };
    expect(submitAnswer(probed, idOf(s, 0), "해리포터", true)).toEqual({ ok: false, error: "BAD_MESSAGE" });
  });

  it("거절 뒤 다른 글은 받아지고 첫 확정은 바뀌지 않는다", () => {
    const s = keywordState();
    const rejected = submitAnswer(s, idOf(s, 0), "해리포터", true);
    const base = !rejected.ok && rejected.state !== undefined ? rejected.state : s;
    const ok = must(submitAnswer(base, idOf(s, 0), "안경", true));
    expect(ok.state.answerSubmits).toEqual([{ seat: 0, text: "안경" }]);
    expect(ok.state.keywordProbed).toBe(true);
  });
});

describe("closeKeyword (D-24)", () => {
  it("확정 낸 순서 → 쓰던 글(좌석 순, 금지어 없음) → 답 없음(좌석 순, 봇 포함)", () => {
    let s = keywordState();
    s = must(submitAnswer(s, idOf(s, 3), "안경", true)).state;
    s = must(submitAnswer(s, idOf(s, 1), "마법", true)).state;
    s = must(submitAnswer(s, idOf(s, 0), "빗자루", false)).state;
    s = must(submitAnswer(s, idOf(s, 2), "해리포터 짱", false)).state;
    const r = closeKeyword(s);
    expect(r.stay).toBe(false);
    expect(r.state.keywordAnswers).toEqual([
      { order: 1, seat: 3, text: "안경" },
      { order: 2, seat: 1, text: "마법" },
      { order: 3, seat: 0, text: "빗자루" },
      { order: 4, seat: 2, text: null },
      { order: 5, seat: 4, text: null },
    ]);
    expect("answerSubmits" in r.state).toBe(false);
    expect(r.state.players.some((p) => "answerDraft" in p)).toBe(false);
  });

  it("아무도 안 냈으면 전원 null 좌석 순, 죽은 사람은 목록에 없다", () => {
    const s0 = keywordState();
    const s = { ...s0, players: s0.players.map((p) => (p.seat === 2 ? { ...p, alive: false } : p)) };
    const r = closeKeyword(s);
    expect(r.state.keywordAnswers).toEqual([
      { order: 1, seat: 0, text: null },
      { order: 2, seat: 1, text: null },
      { order: 3, seat: 3, text: null },
      { order: 4, seat: 4, text: null },
    ]);
  });

  it("봇에 남은 초안(있을 수 없는 값)이 있어도 봇은 늘 null 이다", () => {
    const s0 = keywordState();
    const s = { ...s0, players: s0.players.map((p) => (p.seat === 4 ? { ...p, answerDraft: "봇의 글" } : p)) };
    expect(closeKeyword(s).state.keywordAnswers!.find((r) => r.seat === 4)!.text).toBeNull();
  });
});

describe("tick: keyword 마감 훅", () => {
  it("keyword 마감이 지나면 closeKeyword 를 거쳐 dayAnnounce 에서 keywordAnswers 가 모두 채워진다", () => {
    let s = keywordState();
    s = must(submitAnswer(s, idOf(s, 1), "마법", true)).state;
    s = must(submitAnswer(s, idOf(s, 2), "초안글", false)).state;
    const after = tick(s, s.phaseEndsAt!, () => 0);
    expect(after.phase).toBe("dayAnnounce");
    expect(after.keywordAnswers).toEqual([
      { order: 1, seat: 1, text: "마법" },
      { order: 2, seat: 2, text: "초안글" },
      { order: 3, seat: 0, text: null },
      { order: 4, seat: 3, text: null },
      { order: 5, seat: 4, text: null },
    ]);
    expect(after.answerSubmits).toBeUndefined();
  });
});
