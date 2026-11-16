// 판 기록 D1(23-02, D-15·D-18): setup 이 실제 마이그레이션 파일을 메모리 D1 에 적용한 상태에서 games 표 계약을 고정한다.
// 열 집합을 정확히 고정하는 것이 이 시험의 핵심이다 — 닉네임·채팅·답 글 열이 생기면 여기서 실패한다(결정 0089-21).
import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";

const CONTRACT_COLUMNS = [
  "id",
  "ended_at",
  "winner",
  "caught_day",
  "first_day_caught",
  "genre",
  "word",
  "probe_success",
  "players",
  "bots",
  "has_bots",
  "duration_s",
  "left_count",
  "note_count",
  "no_answer_count",
  "tutorial",
];

describe("D1 games 표", () => {
  it("games 표와 games_ended_at 색인이 마이그레이션으로 만들어져 있다", async () => {
    const { results } = await env.DB.prepare("SELECT type, name FROM sqlite_master WHERE name IN ('games', 'games_ended_at')").all<{
      type: string;
      name: string;
    }>();
    const found = Object.fromEntries(results.map((r) => [r.name, r.type]));
    expect(found).toEqual({ games: "table", games_ended_at: "index" });
  });

  it("열 이름 집합이 16개 계약과 정확히 같다(닉네임·채팅·답 글 열 없음)", async () => {
    const { results } = await env.DB.prepare("PRAGMA table_info(games)").all<{ name: string }>();
    expect(results.map((r) => r.name).sort()).toEqual([...CONTRACT_COLUMNS].sort());
    for (const name of results.map((r) => r.name)) {
      expect(name).not.toMatch(/nick|chat|text|answer|name_/i);
    }
  });

  it("같은 id 두 번 INSERT OR IGNORE 는 1행, 승자 값은 CHECK 로 거절, 기본값 열은 생략 시 0", async () => {
    const insert = `INSERT OR IGNORE INTO games (id, ended_at, winner, genre, word, players, duration_s) VALUES (?, ?, ?, ?, ?, ?, ?)`;
    await env.DB.prepare(insert).bind("g-1", 1_000, "mafia", "food", "김밥", 5, 300).run();
    await env.DB.prepare(insert).bind("g-1", 2_000, "citizen", "food", "김밥", 5, 300).run();
    const rows = await env.DB.prepare("SELECT * FROM games WHERE id = 'g-1'").all<Record<string, unknown>>();
    expect(rows.results).toHaveLength(1);
    const row = rows.results[0]!;
    expect(row.winner).toBe("mafia");
    expect(row.caught_day).toBeNull();
    for (const col of ["first_day_caught", "probe_success", "bots", "has_bots", "left_count", "note_count", "no_answer_count", "tutorial"]) {
      expect(row[col], col).toBe(0);
    }
    await expect(env.DB.prepare(insert).bind("g-2", 1_000, "x", "food", "김밥", 5, 300).run()).rejects.toThrow();
  });
});
