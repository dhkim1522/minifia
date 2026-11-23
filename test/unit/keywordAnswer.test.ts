// 23-06 Task 1: 키워드 답 제출·마감 규칙(D-07·D-09·D-24). 순수 함수라 상태를 실제 시작 전이로 만들고 필요한 값만 손으로 박는다.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { closeKeyword, submitAnswer } from "../../shared/game/keywordAnswer";
import { GENRES } from "../../shared/game/keywords";
import { ANSWER_MAX_GRAPHEMES } from "../../shared/game/answerRules";
import { DAY_ANNOUNCE_MS, FIRST_ANSWER_TURN_MS } from "../../shared/game/phases";
import type { RoomState } from "../../shared/game/room";
import { tick } from "../../shared/game/tick";
import { buildView } from "../../shared/game/view";
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

  it("마피아 단서는 제시어가 들어 있어도 다른 단서와 같은 구조로 접수하고 본인에게 보낸다", () => {
    const s = keywordState();
    const id = idOf(s, 0);
    for (const text of [WORD, "안경"]) {
      const { state } = must(submitAnswer(s, id, text, true));
      expect(buildView(state, id, 0).me.answer).toEqual({ text, final: true });
      expect(buildView(state, idOf(s, 1), 0).me.answer).toBeUndefined();
      expect(state.keywordProbed).toBeUndefined();
    }
  });

  it("시민 편에는 금지된 등록 별칭 초안의 안내가 보이고 수정할 수 있다", () => {
    const s = keywordState();
    const citizen = idOf(s, 1);
    const mafia = idOf(s, 0);
    const first = must(submitAnswer(s, citizen, "해포", false)).state;
    const both = must(submitAnswer(first, mafia, "해포", false)).state;
    expect(buildView(both, citizen, 0).me.answer).toEqual({ text: "해포", final: false, keywordBlocked: true });
    expect(buildView(both, mafia, 0).me.answer).toEqual({ text: "해포", final: false });
    expect(submitAnswer(both, citizen, "해포", true)).toEqual({ ok: false, error: "BAD_MESSAGE" });
    const corrected = must(submitAnswer(both, citizen, "안경", false)).state;
    expect(buildView(corrected, citizen, 0).me.answer).toEqual({ text: "안경", final: false });
    const ok = must(submitAnswer(corrected, citizen, "안경", true));
    expect(ok.state.answerSubmits).toEqual([{ seat: 1, text: "안경" }]);
  });
});

describe("closeKeyword (D-24)", () => {
  it("금지 확정은 기존 초안이 남아 있어도 미제출이며 첫 번째 유효한 확정부터 공개한다", () => {
    let s = keywordState();
    s = must(submitAnswer(s, idOf(s, 0), WORD, true)).state;
    s = must(submitAnswer(s, idOf(s, 1), "안경", true)).state;
    const priorDraft = { ...s, players: s.players.map((p) => p.seat === 0 ? { ...p, answerDraft: "옛 초안" } : p) };
    const rows = closeKeyword(priorDraft).state.keywordAnswers;
    expect(rows?.[0]).toEqual({ order: 1, seat: 1, text: "안경" });
    expect(rows?.find(({ seat }) => seat === 0)?.text).toBeNull();
  });

  it("첫 확정만 시작자를 정하고, 이후 확정·초안·미제출은 의자 순으로 섞인다", () => {
    let s = keywordState();
    s = must(submitAnswer(s, idOf(s, 0), "빗자루", false)).state;
    s = must(submitAnswer(s, idOf(s, 3), "안경", true)).state;
    s = must(submitAnswer(s, idOf(s, 1), "마법", true)).state;
    s = must(submitAnswer(s, idOf(s, 2), "해리포터 짱", false)).state;
    const r = closeKeyword(s);
    expect(r.stay).toBe(false);
    expect(r.state.keywordAnswers).toEqual([
      { order: 1, seat: 3, text: "안경" },
      { order: 2, seat: 2, text: null },
      { order: 3, seat: 4, text: null },
      { order: 4, seat: 0, text: "빗자루" },
      { order: 5, seat: 1, text: "마법" },
    ]);
    expect("answerSubmits" in r.state).toBe(false);
    expect(r.state.players.some((p) => "answerDraft" in p)).toBe(false);
  });

  it("아무도 확정하지 않았으면 첫 물리 의자부터 시작하고 탈락한 사람은 건너뛴다", () => {
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

  it.each([
    [0, 2, 1, 3],
    [0, 1, 3, 2, 4],
    [0, 1, 4, 2, 5, 3],
    [0, 1, 5, 2, 6, 4, 3],
    [0, 1, 4, 6, 2, 7, 5, 3],
  ].map((seats) => ({ count: seats.length, seats })))("$count 인의 시작 좌석을 회전해도 실제 의자의 시계 방향을 따른다", ({ count, seats }) => {
    const s = startedAt(count, 3, "keyword");
    const starter = 2;
    const answered = must(submitAnswer(s, idOf(s, starter), "재밌는 이야기", true)).state;
    const start = seats.indexOf(starter);
    expect(closeKeyword(answered).state.keywordAnswers?.map((row) => row.seat)).toEqual([...seats.slice(start), ...seats.slice(0, start)]);
  });
});

describe("tick: keyword 마감 훅", () => {
  it("다음 마감마다 한 명씩 발표하고 마지막 답 뒤 제시어를 공개한 다음 토론한다", () => {
    let s = keywordState();
    s = must(submitAnswer(s, idOf(s, 1), "마법", true)).state;
    s = must(submitAnswer(s, idOf(s, 2), "초안글", false)).state;
    const start = s.phaseEndsAt!;
    const rows = [
      { seat: 1, text: "마법" }, { seat: 3, text: null }, { seat: 2, text: "초안글" },
      { seat: 4, text: null }, { seat: 0, text: null },
    ];
    for (const [i, row] of rows.entries()) {
      const now = start + i * FIRST_ANSWER_TURN_MS;
      s = tick(s, now, () => 0);
      expect(s.phase).toBe("dayAnnounce");
      expect(s.phaseEndsAt).toBe(now + FIRST_ANSWER_TURN_MS);
      expect(s.answerSubmits).toBeUndefined();
      expect(buildView(s, idOf(s, 0), now).day?.keyword?.presentation).toEqual({ order: i + 1, total: 5, ...row });
    }
    const reveal = tick(s, s.phaseEndsAt!, () => 0);
    expect(reveal.phase).toBe("answerReveal");
    expect(reveal.phaseEndsAt).toBe(s.phaseEndsAt! + 3_000);
    const discussion = tick(reveal, reveal.phaseEndsAt!, () => 0);
    expect(discussion.phase).toBe("discussion");
    expect(discussion.keywordPresentationIndex).toBeUndefined();
    expect(buildView(discussion, idOf(s, 0), reveal.phaseEndsAt!).day?.keyword?.answers).toEqual(rows.map((row, i) => ({ order: i + 1, ...row })));
  });

  it("늦은 알람은 현재 차례만 열고, 옛 저장의 단순 낮 시작은 종전 마감을 쓴다", () => {
    const s = keywordState();
    const start = s.phaseEndsAt!;
    const now = start + 2 * FIRST_ANSWER_TURN_MS + 17;
    const caughtUp = tick(s, now, () => 0);
    expect(buildView(caughtUp, idOf(s, 0), now).day?.keyword?.presentation).toEqual({ order: 3, total: 5, seat: 3, text: null });
    const { keywordPresentationIndex: _i, ...old } = caughtUp;
    const oldAnnouncement = { ...old, phaseEndsAt: now + DAY_ANNOUNCE_MS };
    expect(buildView(oldAnnouncement, idOf(s, 0), now).day?.keyword).toBeUndefined();
    expect(tick(oldAnnouncement, now + DAY_ANNOUNCE_MS, () => 0).phase).toBe("answerReveal");
  });
});
