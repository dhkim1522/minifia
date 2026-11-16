// 판 기록 한 줄 만들기(23-10, 결정 0089-15·16·21, D-27·D-28) — 순수 함수. 상태에서 D1 games 의 한 줄을 뽑는다.
// 사람이 쓴 글과 신원 값은 읽지 않는다: 이 함수가 읽는 것은 승패·역할·투표 집계·키워드 장르 id·단어·좌석 번호·접속 여부·봇 표시·시각뿐이다.
// 행의 문자열 값은 판 id·승리 진영·장르 id·단어 넷으로 고정이고 나머지는 숫자다(열 16개는 migrations/0001_games.sql 과 같다).
import type { GameWinner } from "../protocol";
import type { RoomState } from "./room";

/** games 표 한 줄 — 열 이름은 마이그레이션과 같은 snake_case 다. 불리언 열은 0|1 이다. */
export interface GameRow {
  id: string;
  ended_at: number;
  winner: "mafia" | "citizen";
  caught_day: number | null;
  first_day_caught: 0 | 1;
  genre: string;
  word: string;
  probe_success: 0 | 1;
  players: number;
  bots: number;
  has_bots: 0 | 1;
  duration_s: number;
  left_count: number;
  note_count: number;
  no_answer_count: number;
  tutorial: number;
}

// D1 CHECK 가 막는 값만 만든다 — INSERT OR IGNORE 는 CHECK 위반을 에러 없이 버리기 때문이다(23-02).
const WINNER_COLUMN: Readonly<Record<GameWinner, "mafia" | "citizen">> = {
  mafiaWin: "mafia",
  citizenWin: "citizen",
};

/**
 * 끝난 판의 D1 행. 판 id·승패·키워드·시작 시각 중 하나라도 없으면 null(옛 판·키워드 없는 판은 기록하지 않는다, D-29).
 * 봇이 있거나 테스트 방이면 has_bots 1 이라 기본 통계에서 빠진다(D-27·D-28). 포스트잇 수·튜토리얼은 24 가 채울 자리라 0 이다.
 */
export function buildGameRow(state: RoomState, now: number): GameRow | null {
  const { gameId, winner, keyword, startedAt } = state;
  if (gameId === undefined || winner === undefined || keyword === undefined || startedAt === undefined) return null;

  const seated = state.players.filter((p) => p.role !== undefined);
  const mafiaSeats = new Set(seated.filter((p) => p.role === "mafia").map((p) => p.seat));
  const bots = seated.filter((p) => p.isBot === true);
  const botSeats = new Set(bots.map((p) => p.seat));

  let caughtDay: number | null = null;
  for (const line of state.voteLog ?? []) {
    const executed = line.cand?.candidate;
    if (executed === undefined || !mafiaSeats.has(executed)) continue;
    if (caughtDay === null || line.n < caughtDay) caughtDay = line.n;
  }

  return {
    id: gameId,
    ended_at: now,
    winner: WINNER_COLUMN[winner],
    caught_day: caughtDay,
    first_day_caught: caughtDay === 1 ? 1 : 0,
    genre: keyword.genre,
    word: keyword.word,
    probe_success: state.keywordProbed === true ? 1 : 0,
    players: seated.length,
    bots: bots.length,
    has_bots: bots.length > 0 || state.testMode === true ? 1 : 0,
    duration_s: Math.round((now - startedAt) / 1000),
    left_count: seated.filter((p) => p.isBot !== true && !p.connected).length,
    note_count: 0,
    no_answer_count: (state.keywordAnswers ?? []).filter((a) => a.text === null && !botSeats.has(a.seat)).length,
    tutorial: 0,
  };
}
