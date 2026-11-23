// 23-01 트레이서: 첫날 roleReveal → keyword → dayAnnounce, 키워드 선택(beginGame), view 모양(D-01·D-05·D-06·D-29).
// 키워드는 서버 전용 값이다 — 장르 라벨은 모두에게, 단어는 산 시민 편 본인에게만(마피아 view 에는 키가 없다).
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { genreLabelOf, GENRES, keywordEntryOf, KEYWORD_SWITCH } from "../../shared/game/keywords";
import { answerOpenOf } from "../../shared/game/keywordAnswer";
import { noExecutionOf } from "../../shared/game/execution";
import { phaseDurationOf } from "../../shared/game/discussion";
import {
  afterDayOf,
  ANSWER_REVEAL_MS,
  firstDayAnswerPending,
  KEYWORD_MS,
  nextPhaseOf,
  NO_EXECUTION_MS,
  PHASE_DEFS,
  ROLE_REVEAL_MS,
} from "../../shared/game/phases";
import { beginGame, startGame } from "../../shared/game/room";
import type { RoomState } from "../../shared/game/room";
import { tick } from "../../shared/game/tick";
import { buildView } from "../../shared/game/view";
import { keywordPickerNow, openKeyword } from "../helpers/keyword";
import { seededRandInt } from "../helpers/seededRandom";
import { castPoints, castVerdicts, lobbyOf, startedAt, stateWithVerdict } from "../helpers/voteState";

let restore: () => void = () => {};
beforeEach(() => {
  restore = openKeyword();
});
afterEach(() => restore());

describe("키워드 상수와 단계 표 (D-01)", () => {
  it("keyword 단계는 35초이며 본인 역할을 보낸다", () => {
    expect(KEYWORD_MS).toBe(35_000);
    expect(PHASE_DEFS.keyword.revealsOwnRole).toBe(true);
    expect(PHASE_DEFS.keyword.durationMs).toBe(KEYWORD_MS);
    expect(nextPhaseOf("roleReveal")).toBe("keyword");
    expect(nextPhaseOf("keyword")).toBe("dayAnnounce");
  });
});

describe("키워드 모듈 (영화 장르)", () => {
  it("장르 라벨은 영화, 단어는 30개 이상, 첫 항목은 해리포터(표본 별칭 포함)", () => {
    expect(GENRES[0]!.label).toBe("영화");
    expect(GENRES[0]!.words.length).toBeGreaterThanOrEqual(30);
    expect(GENRES[0]!.words[0]!.word).toBe("해리포터");
    expect(GENRES[0]!.words[0]!.aliases).toContain("Harry Potter");
    expect(genreLabelOf(GENRES[0]!.id)).toBe("영화");
    expect(keywordEntryOf(GENRES[0]!.id, "해리포터")?.word).toBe("해리포터");
    expect(keywordEntryOf(GENRES[0]!.id, "없는말")).toBeUndefined();
  });
});

describe("beginGame 의 키워드 선택 (D-05·D-29)", () => {
  it("시작하면 서버 전용 keyword { genre, word } 가 있고 단어 목록에서 조회된다", () => {
    const started = startGame(lobbyOf(6), "player-id-0000-aaaa", 1000, seededRandInt(1), keywordPickerNow());
    expect(started.ok).toBe(true);
    if (!started.ok) return;
    const kw = started.state.keyword;
    expect(kw).toBeDefined();
    expect(keywordEntryOf(kw!.genre, kw!.word)).toBeDefined();
  });

  it("스위치를 끄면 keyword 키가 없고, 들어온 상태에 있던 keyword 도 지운다", () => {
    KEYWORD_SWITCH.on = false;
    const lobby: RoomState = { ...lobbyOf(6), keyword: { genre: GENRES[0]!.id, word: "해리포터" } };
    const next = beginGame(lobby, 1000, seededRandInt(1), keywordPickerNow());
    expect("keyword" in next).toBe(false);
  });

  it("키워드는 맨 끝에서 난수를 두 번만 더 쓴다(역할·맵 순서는 그대로)", () => {
    const count = (): number => {
      const gen = seededRandInt(7);
      let n = 0;
      beginGame(lobbyOf(6), 1000, (k) => {
        n += 1;
        return gen(k);
      }, keywordPickerNow());
      return n;
    };
    const on = count();
    KEYWORD_SWITCH.on = false;
    expect(on - count()).toBe(2);
  });
});

describe("roleReveal → keyword → dayAnnounce (D-01·D-29)", () => {
  it("keyword 가 있으면 역할 확인 마감 뒤 keyword, 마감은 35초 뒤, state.day 는 아직 없다", () => {
    const reveal = startedAt(6, 3, "roleReveal");
    expect(reveal.keyword).toBeDefined();
    const at = reveal.phaseEndsAt!;
    const kw = tick(reveal, at, seededRandInt(4));
    expect(kw.phase).toBe("keyword");
    expect(kw.phaseEndsAt).toBe(at + KEYWORD_MS);
    expect(kw.day).toBeUndefined();
    expect(ROLE_REVEAL_MS).toBeGreaterThan(0);
  });

  it("keyword 마감 뒤 dayAnnounce 가 되고 일차 1", () => {
    const kw = startedAt(6, 3, "keyword");
    const next = tick(kw, kw.phaseEndsAt!, seededRandInt(4));
    expect(next.phase).toBe("dayAnnounce");
    expect(next.day).toBe(1);
  });

  it("keyword 가 없는 상태(옛 방·스위치 끔)는 역할 확인 다음이 곧장 dayAnnounce", () => {
    const reveal = startedAt(6, 3, "roleReveal");
    const { keyword: _drop, ...bare } = reveal;
    const next = tick(bare as RoomState, bare.phaseEndsAt!, seededRandInt(4));
    expect(next.phase).toBe("dayAnnounce");
    expect(next.day).toBe(1);
  });
});

describe("keyword 단계 view (D-06 누설 없음)", () => {
  const kwState = (): RoomState => startedAt(6, 3, "keyword");

  it("모든 viewer 의 day.keyword 는 { genre: 장르 라벨 } 로 같다", () => {
    const state = kwState();
    const label = genreLabelOf(state.keyword!.genre);
    for (const p of state.players) {
      const view = buildView(state, p.id, state.phaseEndsAt! - 1000);
      expect(view.phase).toBe("keyword");
      expect(view.day?.keyword).toEqual({ genre: label });
    }
  });

  it("시민·경찰·의사 본인은 me.keyword 로 단어를 받고, 마피아는 키 자체가 없다", () => {
    const state = kwState();
    const word = state.keyword!.word;
    let mafia = 0;
    let citizenSide = 0;
    for (const p of state.players) {
      const view = buildView(state, p.id, state.phaseEndsAt! - 1000);
      if (p.role === "mafia") {
        mafia += 1;
        expect("keyword" in view.me).toBe(false);
        expect(JSON.stringify(view)).not.toContain(word);
      } else {
        citizenSide += 1;
        expect(view.me.keyword).toBe(word);
      }
    }
    expect(mafia).toBeGreaterThan(0);
    expect(citizenSide).toBeGreaterThan(0);
  });

  it("역할 확인·낮 시작 단계의 view 에는 me.keyword 가 없다", () => {
    for (const phase of ["roleReveal", "dayAnnounce"] as const) {
      const state = startedAt(6, 3, phase);
      for (const p of state.players) {
        expect("keyword" in buildView(state, p.id, 20_000).me).toBe(false);
      }
    }
  });
});

// ---- 23-05: 첫날 정답 공개 단계 answerReveal (D-02·D-22·D-29) ----

const withoutKeyword = (state: RoomState): RoomState => {
  const { keyword: _drop, ...bare } = state;
  return bare as RoomState;
};
const againstAll = (state: RoomState): RoomState =>
  castVerdicts(state, Object.fromEntries(state.players.map((p) => [p.seat, false])));

describe("answerReveal 상수와 단계 표 (D-02·D-22)", () => {
  it("ANSWER_REVEAL_MS 3000, NO_EXECUTION_MS 1400, answerReveal → night, 본인 역할을 싣는 단계다", () => {
    expect(ANSWER_REVEAL_MS).toBe(3000);
    expect(NO_EXECUTION_MS).toBe(1400);
    expect(PHASE_DEFS.answerReveal.durationMs).toBe(3000);
    expect(PHASE_DEFS.answerReveal.revealsOwnRole).toBe(true);
    expect(nextPhaseOf("answerReveal")).toBe("night");
    // 표의 execution.next 는 night 그대로(둘째 날 이후가 쓴다) — 첫날 분기는 마감 훅과 afterDayOf 가 한다
    expect(nextPhaseOf("execution")).toBe("night");
  });

  it("이전 저장 방은 첫날 공개가 남았을 때만 저녁에 제시어를 공개한다", () => {
    expect(firstDayAnswerPending({ day: 1, keyword: {} })).toBe(true);
    expect(firstDayAnswerPending({ keyword: {} })).toBe(true); // day 없음 = 첫날(day ?? 1)
    expect(firstDayAnswerPending({ day: 2, keyword: {} })).toBe(false);
    expect(firstDayAnswerPending({ day: 1 })).toBe(false);
    expect(afterDayOf({ day: 1, keyword: {} })).toBe("answerReveal");
    expect(afterDayOf({ day: 1, keyword: {}, keywordReveal: "beforeDiscussion" })).toBe("night");
    expect(afterDayOf({ day: 2, keyword: {} })).toBe("night");
    expect(afterDayOf({ day: 1 })).toBe("night");
  });
});

const legacyBeforeReveal = ({ keywordReveal: _reveal, ...state }: RoomState): RoomState => state;

describe("첫날 처형 뒤 전이", () => {
  it("배포할 때 이미 처형 중이었던 이전 판은 저녁 공개 뒤 밤으로 이어진다", () => {
    const exec = legacyBeforeReveal(stateWithVerdict(6, 1, "execution"));
    expect(exec.day).toBe(1);
    expect(exec.keyword).toBeDefined();
    const at = exec.phaseEndsAt!;
    const reveal = tick(exec, at, seededRandInt(9));
    expect(reveal.phase).toBe("answerReveal");
    expect(reveal.phaseEndsAt).toBe(at + ANSWER_REVEAL_MS);
    expect(phaseDurationOf(reveal)).toBe(ANSWER_REVEAL_MS);
    expect(noExecutionOf(reveal)).toBeUndefined();
    const night = tick(reveal, reveal.phaseEndsAt!, seededRandInt(9));
    expect(night.phase).toBe("night");
    expect(night.keywordReveal).toBe("afterDay");
  });

  it("새 판은 첫날 처형 뒤 두 번째 제시어 공개를 하지 않는다", () => {
    const exec = stateWithVerdict(6, 1, "execution");
    expect(exec.keywordReveal).toBe("beforeDiscussion");
    expect(tick(exec, exec.phaseEndsAt!, seededRandInt(9)).phase).toBe("night");
  });

  it("day 2 처형 → 곧장 night(answerReveal 없음)", () => {
    const exec = { ...stateWithVerdict(6, 1, "execution"), day: 2 };
    expect(tick(exec, exec.phaseEndsAt!, seededRandInt(9)).phase).toBe("night");
  });

  it("day 1 처형으로 마피아 전멸(승패) → ended(answerReveal 을 건너뛴다)", () => {
    const exec = stateWithVerdict(4, 1, "execution", { candidate: "mafia" });
    const next = tick(exec, exec.phaseEndsAt!, seededRandInt(9));
    expect(next.phase).toBe("ended");
    expect(next.winner).toBe("citizenWin");
  });

  it("keyword 가 없는 방(D-29)은 day 1 처형 뒤도 night", () => {
    const exec = withoutKeyword(stateWithVerdict(6, 1, "execution"));
    expect(tick(exec, exec.phaseEndsAt!, seededRandInt(9)).phase).toBe("night");
  });
});

describe("처형 없는 첫날 → answerReveal 4.4초 (D-22)", () => {
  it("이전 판의 day 1 찬반 부결 → answerReveal, 길이 4400, noExecutionOf 가 rejected", () => {
    const verdict = legacyBeforeReveal(againstAll(stateWithVerdict(6, 1, "verdict")));
    const at = verdict.phaseEndsAt!;
    const reveal = tick(verdict, at, seededRandInt(9));
    expect(reveal.phase).toBe("answerReveal");
    expect(phaseDurationOf(reveal)).toBe(ANSWER_REVEAL_MS + NO_EXECUTION_MS);
    expect(reveal.phaseEndsAt).toBe(at + 4400);
    expect(noExecutionOf(reveal)).toEqual({ reason: "rejected" });
    expect(tick(reveal, reveal.phaseEndsAt!, seededRandInt(9)).phase).toBe("night");
  });

  it("day 1 지목 0표·동점 → answerReveal, 길이 4400, 이유 noVotes·tie", () => {
    for (const [picks, reason] of [[{}, "noVotes"], [{ 0: 1, 1: 0 }, "tie"]] as const) {
      const nomination = legacyBeforeReveal(castPoints(startedAt(6, 1, "nomination"), picks));
      let s = nomination;
      for (let guard = 0; s.phase === "nomination" && guard < 30; guard += 1) s = tick(s, s.phaseEndsAt!, seededRandInt(9));
      expect(s.phase).toBe("answerReveal");
      expect(phaseDurationOf(s)).toBe(4400);
      expect(noExecutionOf(s)).toEqual({ reason });
    }
  });

  it("day 2 부결 → 곧장 night", () => {
    const verdict = { ...againstAll(stateWithVerdict(6, 1, "verdict")), day: 2 };
    expect(tick(verdict, verdict.phaseEndsAt!, seededRandInt(9)).phase).toBe("night");
  });

  it("keyword 없는 day 1 부결 → night(D-29)", () => {
    const verdict = withoutKeyword(againstAll(stateWithVerdict(6, 1, "verdict")));
    expect(tick(verdict, verdict.phaseEndsAt!, seededRandInt(9)).phase).toBe("night");
  });
});

// ---- 23-05 Task 2: 정답 view — answerOpenOf·day.keyword.answer (D-03·D-14·D-23, T-23-15) ----

describe("정답은 answerReveal 진입 프레임부터 모두에게 같은 값으로 (answerOpenOf)", () => {
  const tickTo = (state: RoomState, phase: RoomState["phase"]): RoomState => {
    let s = state;
    for (let guard = 0; s.phase !== phase; guard += 1) {
      if (s.phaseEndsAt === null || guard > 40) throw new Error(`cannot reach ${phase} from ${state.phase}`);
      s = tick(s, s.phaseEndsAt, seededRandInt(11));
    }
    return s;
  };
  const answerOf = (state: RoomState, id: string): string | undefined =>
    (buildView(state, id, 20_000).day?.keyword as { answer?: string } | undefined)?.answer;

  it("answerOpenOf: keyword 가 있고 첫날 answerReveal일 때만 참", () => {
    const kw = { genre: "movie", word: "w" } as RoomState["keyword"];
    const base = { keyword: kw } as unknown as RoomState;
    expect(answerOpenOf({ ...base, phase: "answerReveal", day: 1 })).toBe(true);
    expect(answerOpenOf({ ...base, phase: "night", day: 1 })).toBe(false);
    expect(answerOpenOf({ ...base, phase: "morning", day: 1 })).toBe(false);
    for (const phase of ["keyword", "dayAnnounce", "discussion", "verdict", "nomination", "runoff", "showdown", "defense", "execution"] as const) {
      expect(answerOpenOf({ ...base, phase, day: 1 }), phase).toBe(false);
    }
    expect(answerOpenOf({ ...base, phase: "keyword" })).toBe(false); // keyword 단계는 day 가 아직 없다
    expect(answerOpenOf({ ...base, phase: "discussion", day: 2 })).toBe(false);
    expect(answerOpenOf({ ...base, phase: "ended", day: 1 })).toBe(false);
    expect(answerOpenOf({ ...base, phase: "answerReveal", day: 1, keyword: undefined })).toBe(false);
  });

  it("키워드 입력과 마지막 답 발표까지 정답과 다른 사람의 답을 미리 싣지 않는다", () => {
    let s = startedAt(6, 1, "keyword");
    const word = s.keyword!.word;
    const orders: number[] = [];
    while (s.phase === "keyword" || s.phase === "dayAnnounce") {
      for (const p of s.players) {
        const view = buildView(s, p.id, s.phaseEndsAt! - 1000);
        expect(view.day?.keyword?.answer).toBeUndefined();
        expect(view.day?.keyword?.answers).toBeUndefined();
        if (p.role === "mafia") expect(JSON.stringify(view)).not.toContain(word);
      }
      if (s.phase === "dayAnnounce") orders.push(buildView(s, s.players[0]!.id, s.phaseEndsAt! - 1).day!.keyword!.presentation!.order);
      s = tick(s, s.phaseEndsAt!, seededRandInt(9));
    }
    expect(orders).toEqual([1, 2, 3, 4, 5, 6]);
    expect(s.phase).toBe("answerReveal");
    expect(phaseDurationOf(s)).toBe(ANSWER_REVEAL_MS);
    expect(tick(s, s.phaseEndsAt!, seededRandInt(9)).phase).toBe("discussion");
  });

  it("제시어와 답 목록은 첫 공개부터 토론과 밤의 기록에도 이어진다", () => {
    const reveal = tickTo(startedAt(6, 1, "keyword"), "answerReveal");
    expect(reveal.phase).toBe("answerReveal");
    const word = reveal.keyword!.word;
    const label = genreLabelOf(reveal.keyword!.genre);
    const night = tickTo(reveal, "night");
    const discussion = tickTo(reveal, "discussion");
    for (const state of [reveal, discussion, night]) for (const p of state.players) {
      expect(buildView(state, p.id, state.phaseEndsAt! - 1).day?.keyword).toEqual({ genre: label, answer: word, answers: reveal.keywordAnswers });
    }
  });

  it("둘째 날과 게임 종료 화면에서도 공개했던 제시어가 남는다", () => {
    const day2 = { ...startedAt(6, 1, "discussion"), day: 2 };
    for (const p of day2.players) expect(answerOf(day2, p.id)).toBe(day2.keyword?.word);
    const exec = stateWithVerdict(4, 1, "execution", { candidate: "mafia" });
    const ended = tick(exec, exec.phaseEndsAt!, seededRandInt(9));
    expect(ended.phase).toBe("ended");
    for (const p of ended.players) expect(answerOf(ended, p.id)).toBe(ended.keyword?.word);
  });

  it("keyword 가 없는 판의 view 에는 day.keyword 가 없다(옛 방)", () => {
    const reveal = withoutKeyword({ ...startedAt(6, 1, "discussion"), day: 2 });
    for (const p of reveal.players) expect(buildView(reveal, p.id, 20_000).day?.keyword).toBeUndefined();
  });
});
