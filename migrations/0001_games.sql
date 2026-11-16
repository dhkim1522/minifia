-- 판 기록(결정 0089-21, 23-02). 닉네임·채팅·답 글은 저장하지 않는다 — 열은 이 16개뿐이다.
-- 원격 적용은 24 배포 첫 단계(D-19). 적용된 뒤에는 새 마이그레이션 파일로만 바꾼다.
CREATE TABLE games (
  id TEXT PRIMARY KEY,
  ended_at INTEGER NOT NULL,                       -- epoch ms
  winner TEXT NOT NULL CHECK (winner IN ('mafia', 'citizen')),
  caught_day INTEGER,                              -- 마피아가 처음 잡힌 날, 없으면 NULL
  first_day_caught INTEGER NOT NULL DEFAULT 0,
  genre TEXT NOT NULL,
  word TEXT NOT NULL,
  probe_success INTEGER NOT NULL DEFAULT 0,
  players INTEGER NOT NULL,
  bots INTEGER NOT NULL DEFAULT 0,
  has_bots INTEGER NOT NULL DEFAULT 0,
  duration_s INTEGER NOT NULL,
  left_count INTEGER NOT NULL DEFAULT 0,
  note_count INTEGER NOT NULL DEFAULT 0,
  no_answer_count INTEGER NOT NULL DEFAULT 0,
  tutorial INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX games_ended_at ON games (ended_at);
