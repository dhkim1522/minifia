// 판 기록 행 만들기 (23-10 Task 1) — D-15·D-16·D-27·D-28, 결정 0089-21.
// 상태를 손으로 짜서 열 계산을 하나씩 본다. 닉네임·답 글이 행에 없음은 JSON 문자열로 확인한다.
import { describe, expect, it } from "vitest";
import { buildGameRow } from "../../shared/game/gameLog";
import { beginGame, type Player, type RoomState } from "../../shared/game/room";
import { keywordPickerNow, openKeyword } from "../helpers/keyword";
import { seededRandInt } from "../helpers/seededRandom";

function person(seat: number, over: Partial<Player> = {}): Player {
  return {
    id: `p${seat}`,
    token: `t${seat}`,
    seat,
    nickname: seat === 0 ? "하윤" : `이름${seat}`,
    nicknameKey: `k${seat}`,
    joinSeq: seat,
    connected: true,
    connId: null,
    role: seat === 1 || seat === 4 ? "mafia" : "citizen",
    ...over,
  };
}

const START = 1_000_000;

/** 5명 판 — 마피아 좌석 1·4, 좌석 4 는 봇. */
function ended(over: Partial<RoomState> = {}): RoomState {
  return {
    code: "ABCD",
    createdAt: START,
    expiresAt: START + 9_999_999,
    phase: "ended",
    phaseEndsAt: null,
    hostId: "p0",
    nextJoinSeq: 5,
    players: [person(0), person(1), person(2), person(3), person(4, { isBot: true, token: "", connected: true })],
    winner: "citizenWin",
    keyword: { genre: "food", word: "김밥" },
    startedAt: START,
    gameId: "11111111-2222-3333-4444-555555555555",
    voteLog: [],
    ...over,
  };
}

const NOW = START + 754_400;

describe("buildGameRow null 조건", () => {
  it("gameId·winner·keyword·startedAt 중 하나라도 없으면 null", () => {
    expect(buildGameRow(ended(), NOW)).not.toBeNull();
    expect(buildGameRow(ended({ gameId: undefined }), NOW)).toBeNull();
    expect(buildGameRow(ended({ winner: undefined }), NOW)).toBeNull();
    expect(buildGameRow(ended({ keyword: undefined }), NOW)).toBeNull();
    expect(buildGameRow(ended({ startedAt: undefined }), NOW)).toBeNull();
  });
});

describe("buildGameRow 열 계산", () => {
  it("승리 진영은 mafia|citizen 만", () => {
    expect(buildGameRow(ended({ winner: "mafiaWin" }), NOW)?.winner).toBe("mafia");
    expect(buildGameRow(ended({ winner: "citizenWin" }), NOW)?.winner).toBe("citizen");
  });

  it("잡힌 날 = 처형자가 마피아인 가장 이른 일차", () => {
    const row = buildGameRow(
      ended({
        voteLog: [
          { n: 1, exec: { yes: 2, no: 1, passed: true }, cand: { candidate: 2 } },
          { n: 2, exec: { yes: 2, no: 1, passed: true }, cand: { candidate: 1 } },
        ],
      }),
      NOW,
    );
    expect(row?.caught_day).toBe(2);
    expect(row?.first_day_caught).toBe(0);
  });

  it("첫날 마피아가 처형되면 첫날 잡힘", () => {
    const row = buildGameRow(ended({ voteLog: [{ n: 1, exec: { yes: 3, no: 0, passed: true }, cand: { candidate: 1 } }] }), NOW);
    expect(row?.caught_day).toBe(1);
    expect(row?.first_day_caught).toBe(1);
  });

  it("처형 없음만 있으면 caught_day null", () => {
    const row = buildGameRow(
      ended({ voteLog: [{ n: 1, exec: { yes: 0, no: 3, passed: false } }, { n: 2, exec: { yes: 2, no: 1, passed: true }, cand: {} }] }),
      NOW,
    );
    expect(row?.caught_day).toBeNull();
    expect(row?.first_day_caught).toBe(0);
  });

  it("인원·봇·봇 표시: 쉬는 사람(sat)은 인원에서 빠진다", () => {
    const sat = person(5, { role: undefined, sat: true });
    const row = buildGameRow(ended({ players: [...ended().players, sat] }), NOW);
    expect(row?.players).toBe(5);
    expect(row?.bots).toBe(1);
    expect(row?.has_bots).toBe(1);
  });

  it("봇이 없어도 테스트 방이면 has_bots 1, 둘 다 아니면 0", () => {
    const humans = ended().players.slice(0, 4);
    expect(buildGameRow(ended({ players: humans }), NOW)?.has_bots).toBe(0);
    expect(buildGameRow(ended({ players: humans, testMode: true }), NOW)?.has_bots).toBe(1);
    expect(buildGameRow(ended({ players: humans }), NOW)?.bots).toBe(0);
  });

  it("길이는 초 단위 반올림", () => {
    expect(buildGameRow(ended(), NOW)?.duration_s).toBe(754);
    expect(buildGameRow(ended(), START + 754_600)?.duration_s).toBe(755);
  });

  it("이탈 수 = 역할 있는 사람 중 끊긴 사람(봇·역할 없는 사람 제외)", () => {
    const players = [
      person(0, { connected: false }),
      person(1),
      person(2, { connected: false }),
      person(3),
      person(4, { isBot: true, connected: false }),
      person(5, { role: undefined, sat: true, connected: false }),
    ];
    expect(buildGameRow(ended({ players }), NOW)?.left_count).toBe(2);
  });

  it("답 없음 수 = 첫날 공개 목록에서 text null 인 사람(봇 제외)", () => {
    const row = buildGameRow(
      ended({
        keywordAnswers: [
          { order: 1, seat: 0, text: "안경" },
          { order: 2, seat: 2, text: null },
          { order: 3, seat: 3, text: null },
          { order: 4, seat: 4, text: null },
        ],
      }),
      NOW,
    );
    expect(row?.no_answer_count).toBe(2);
  });

  it("떠보기 성공은 keywordProbed 일 때만, 포스트잇·튜토리얼은 0", () => {
    expect(buildGameRow(ended(), NOW)?.probe_success).toBe(0);
    const row = buildGameRow(ended({ keywordProbed: true }), NOW);
    expect(row?.probe_success).toBe(1);
    expect(row?.note_count).toBe(0);
    expect(row?.tutorial).toBe(0);
  });

  it("장르 id 와 단어, 판 id, 끝난 시각", () => {
    const row = buildGameRow(ended(), NOW);
    expect(row?.genre).toBe("food");
    expect(row?.word).toBe("김밥");
    expect(row?.id).toBe("11111111-2222-3333-4444-555555555555");
    expect(row?.ended_at).toBe(NOW);
  });
});

describe("buildGameRow 개인정보 부재 (T-23-36)", () => {
  it("닉네임·답 글·채팅·토큰이 행 어디에도 없다", () => {
    const state = ended({
      keywordAnswers: [{ order: 1, seat: 0, text: "안경" }],
      players: ended().players.map((p, i) => (i === 0 ? { ...p, answerDraft: "초안글", will: "유언글" } : p)),
      chat: undefined,
    } as Partial<RoomState>);
    const json = JSON.stringify(buildGameRow(state, NOW));
    for (const secret of ["하윤", "안경", "초안글", "유언글", "t0", "p0"]) expect(json).not.toContain(secret);
  });

  it("열은 마이그레이션의 16개뿐", () => {
    expect(Object.keys(buildGameRow(ended(), NOW) ?? {}).sort()).toEqual(
      [
        "id", "ended_at", "winner", "caught_day", "first_day_caught", "genre", "word", "probe_success",
        "players", "bots", "has_bots", "duration_s", "left_count", "note_count", "no_answer_count", "tutorial",
      ].sort(),
    );
  });
});

describe("beginGame startedAt (D-16)", () => {
  it("시작 시각을 now 로 기록한다", () => {
    const restore = openKeyword();
    try {
      const lobby = ended({ phase: "lobby", winner: undefined, startedAt: undefined, gameId: undefined });
      const started = beginGame({ ...lobby, players: lobby.players.slice(0, 4).map((p) => ({ ...p, role: undefined })) }, 4242, seededRandInt(1), keywordPickerNow());
      expect(started.startedAt).toBe(4242);
    } finally {
      restore();
    }
  });
});
