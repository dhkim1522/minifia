// 판 기록 한 줄 넣기(23-10, 결정 0089-16·21, D-16). 행 모양은 shared/game/gameLog.ts, 표는 migrations/0001_games.sql.
// 모든 값은 바인딩으로 넣는다 — SQL 문자열에 값을 끼워 넣지 않는다(T-23-37).
// INSERT OR IGNORE: 같은 판 id 가 두 번 와도 한 줄이다. CHECK 위반도 에러 없이 버려지므로 행 만들기가 승리 진영을 mafia|citizen 으로만 만든다.
import type { GameRow } from "../shared/game/gameLog";

const INSERT_SQL =
  "INSERT OR IGNORE INTO games (id, ended_at, winner, caught_day, first_day_caught, genre, word, probe_success, players, bots, has_bots, duration_s, left_count, note_count, no_answer_count, tutorial) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";

export async function insertGame(db: D1Database, row: GameRow): Promise<void> {
  await db
    .prepare(INSERT_SQL)
    .bind(
      row.id,
      row.ended_at,
      row.winner,
      row.caught_day,
      row.first_day_caught,
      row.genre,
      row.word,
      row.probe_success,
      row.players,
      row.bots,
      row.has_bots,
      row.duration_s,
      row.left_count,
      row.note_count,
      row.no_answer_count,
      row.tutorial,
    )
    .run();
}
