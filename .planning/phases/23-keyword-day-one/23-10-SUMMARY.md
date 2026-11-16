---
phase: 23-keyword-day-one
plan: "10"
subsystem: game-log-d1
tags: [d1, game-log, waituntil, privacy, tdd, leak-guard]
requires: ["23-02", "23-08"]
provides:
  - "shared/game/gameLog.ts: GameRow(16열)·buildGameRow(state, now) 순수 함수"
  - "worker/gameLog.ts: insertGame(db, row) — 바인딩 INSERT OR IGNORE 한 번"
  - "방 DO recordGame(prev): ended 전환에서 한 번, ctx.waitUntil + 고정 문구 로그로 실패를 삼킴"
  - "RoomState.startedAt(beginGame 이 now 로 기록)·gameId(handleStart·handleRematch 가 uuid 부여) — 서버 전용"
  - "startedAt·gameId 서버 전용 감시선 세 곳(leak.test·view.test·smoke)"
affects: [23-13, 24]
actuals:
  tokens: 9500
  tasks: 3
  commits: 5
plan_head_before: 4f02d342d1b59ab7b72f71eada6fda2861d51987
plan_head_after: bf5ef431e6ed3eb461cda47da08bac03a605c1ee
tech-stack:
  added: []
  patterns:
    - "행 만들기는 순수 함수(shared) / 넣기는 워커 한 줄(worker) / 부르기는 방 DO 동기 함수 — afterTransition 의 emitResultLog 옆"
    - "실패 격리 시험은 games 표를 RENAME 했다가 되돌리고, console.error 스파이로 고정 문구 한 줄만 나갔음을 확인"
key-files:
  created:
    - shared/game/gameLog.ts
    - worker/gameLog.ts
    - test/unit/gameLog.test.ts
    - test/worker/gameLog.test.ts
  modified:
    - shared/game/room.ts
    - worker/room.ts
    - test/unit/rematch.test.ts
    - test/unit/view.test.ts
    - test/worker/leak.test.ts
    - scripts/smoke.mjs
decisions:
  - "caught_day 는 voteLog 줄의 cand.candidate 가 마피아 좌석인 가장 작은 n — exec.passed 는 따로 보지 않는다(cand.candidate 는 처형자가 정해진 날에만 있다)"
  - "gameId 는 beginGame 이 아니라 워커가 붙인다(beginGame 은 순수) — startGame·rematch 결과를 받은 직후 { ...result.state, gameId: crypto.randomUUID() }"
  - "winner 는 WIRE_WINNER 의 반대 표(mafiaWin→mafia, citizenWin→citizen)로만 만든다 — INSERT OR IGNORE 가 CHECK 위반을 삼키기 때문(23-02 이월)"
status: complete
---

# Phase 23 Plan 10: 판 기록 D1 한 줄 Summary

판이 ended 로 들어서는 전환에서 한 번 D1 `games` 에 한 줄이 남는다. 행은 닉네임·채팅·답 글·토큰을 읽지 않는 순수 함수가 만들고, 삽입은 `ctx.waitUntil` 로 기다리지 않으며 실패해도 결과 화면과 다시 하기는 그대로다. 원격 D1 은 건드리지 않았고(D-19) 시험은 miniflare 메모리 D1 만 썼다.

## 완료한 일

| Task | 이름 | 커밋 |
|------|------|------|
| 1 RED | 판 기록 행 만들기 실패 시험 | fe630fbc |
| 1 GREEN | buildGameRow, startedAt·gameId 상태 키 | babdeba5 |
| 2 RED | D1 판 기록 방 DO 실패 시험 | 9a5c1c6c |
| 2 GREEN | insertGame·recordGame·판 id 부여 | 4cf13662 |
| 3 | startedAt·gameId 서버 전용 감시선 | bf5ef431 |

## 검증 결과 (실제로 돌린 것)

- Task 1 RED: gameLog 모듈 없음으로 파일 로드 실패 확인. GREEN: `vitest run test/unit/gameLog.test.ts gameRoom.test.ts rematch.test.ts` 통과, `npm run typecheck` 오류 없음.
- Task 2 RED: `../../worker/gameLog` 없음으로 파일 로드 실패 확인. GREEN: `vitest run test/worker/gameLog.test.ts d1.test.ts resultLog.test.ts rematch.test.ts` 24 passed, typecheck 통과.
- Task 3: `vitest run test/worker/leak.test.ts test/unit/view.test.ts` 통과(leak 은 아래 deviation 수정 뒤), `node --test scripts/smoke.test.mjs` pass 15 / fail 0, typecheck 통과.
- 전체: `vitest run --project worker` 49 files passed·4 skipped(542 passed, 이번 마지막 실행은 한 번에 초록), `vitest run --project unit` 129 passed·1 skipped(4315 passed).
- 인수 기준: `buildGameRow` 정의 1, gameLog.ts 의 `nickname|chat|answerDraft|token` 0, room.ts `startedAt` 2, worker/room.ts `recordGame(` 2·`waitUntil` 2, `INSERT OR IGNORE INTO games` 1, worker/gameLog.ts `${` 0, 세 감시선 파일 모두 gameId·startedAt 1 이상.
- Task 3 RED 확인(계획 요구): `shared/game/view.ts` 360행 view 반환에 `gameId: state.gameId` 를 임시로 실어 보니 view.test 4건이 빨갛게 되었고, 원복 뒤 `git diff -- shared/` 로 변경 없음 확인. 최초 상태로는 이미 초록이라 GREEN 커밋은 없다(view 를 고칠 위반이 없었다) — 감시선 추가 자체가 RED 커밋 하나다.
- 실패 격리 시험은 표를 RENAME 해 삽입이 실제로 실패하게 만들고 `console.error("game log failed")` 가 한 줄(인자 1개)로 나갔음을 단언한다. 처음에는 로그가 보이지 않아 삽입이 실제로 실패했는지 의심됐고, 스파이 단언을 넣어 확인했다.

## 계획과 달라진 곳 (Deviations)

**1. [Rule 1 - 시험 기대값] 다시 하기 허용 키 시험 두 곳에 startedAt·gameId 가 새로 나타남**
- 발견: Task 1 의 `test/unit/rematch.test.ts` ALLOWED_ROOM, Task 3 중 전체 `leak.test.ts` 의 다시 하기 시험 ROOM_KEYS 가 새 판 상태 키 집합을 정확히 비교한다. beginGame 이 startedAt 을 쓰고 워커가 gameId 를 쓰니 키 집합이 늘어났다.
- 조치: 두 시험의 기대 키에 새 판이 쓰는 두 키를 더하고 이유를 주석에 달았다. 지난 판의 값을 넘겨받는 것이 아니라(rematch 허용 목록은 그대로) 새 판에서 서버가 새로 쓰는 키다. 계획 `files_modified` 에 `test/unit/rematch.test.ts` 가 없어 추가했다.
- 커밋: babdeba5, bf5ef431.

**2. [설계 선택] 테스트 판을 사람 4 + 봇 1 로 돌릴 때의 표 보정**
- driveToEnded 는 호스트+봇 방 전제라 사람 손님 표가 비어 있다. 시험에서 hook 으로 사람 손님의 찬반·지목 표를 호스트 처형에 맞춰 넣어 판이 끝나게 했다(헬퍼 파일은 건드리지 않음).

## 하지 않은 것 / 확인하지 못한 것

- 원격 D1·배포·`--remote` 는 하지 않았다(D-19). dev 서버(`vite dev`)가 판을 끝낸 뒤 `.wrangler/state/v3/d1` 에 실제로 쓰는지, `npm run games` 에 보이는지는 확인하지 못했다(23-02 이월 그대로, 23-13 에 넘김). 워커 시험은 miniflare 메모리 D1 이라 이 의문에 답하지 않는다.
- `no_answer_count` 가 봇 좌석을 `isBot` 으로 가려내므로 keywordAnswers 에 봇 줄이 들어오는 경우(결정 0089)에만 의미가 있다. 사람 판의 답 없음 수는 시험으로 고정했다.
- `left_count` 는 ended 진입 시점의 끊김이라 판 중간에 나갔다 돌아온 사람은 못 센다(RESEARCH Q7 알려진 한계). `note_count`·`tutorial` 은 0 으로 고정이고 24 가 채운다.
- ended 를 거치지 않고 만료된 판은 기록하지 않는다(D-16). 이를 별도 시험으로 만들지는 않았다 — recordGame 이 ended 전환에서만 불리는 구조라 코드로 보장된다.
- E2E·실기기 확인은 하지 않았다.

## 이월 (23-13·24)

- 23-13 결정 0091: games 행 모양이 이 계획에서 굳었다(`reversibility: costly`). 열 의미: `caught_day` 는 마피아가 처음 처형된 일차(처형 무효 날은 건너뜀), `has_bots` 는 봇이 있거나 테스트 방이면 1, `left_count` 는 ended 진입 시점 끊김, `probe_success` 는 keywordProbed.
- 24: 원격 D1 생성·id 기입·원격 마이그레이션 뒤에야 실제 행이 쌓인다. 그때 INSERT OR IGNORE 가 CHECK 위반을 조용히 버리는 점(23-02)은 행 만들기가 승리 진영을 두 값으로만 만들어 막는다.

## Known Stubs

없음. `note_count`·`tutorial` 의 고정 0 은 계획이 정한 값(24 가 채움)이며 UI 로 흐르지 않는다.

## Threat Flags

없음. T-23-36(개인정보)은 buildGameRow 가 해당 필드를 읽지 않고 JSON 단언·감시선으로 막고, T-23-37 은 전 값 바인딩·`${` 0, T-23-38 은 waitUntil+catch·실패 격리 시험, T-23-39 는 고정 문구 한 줄(인자 1개)로 완화했다.

## Self-Check: PASSED

- 파일: shared/game/gameLog.ts, worker/gameLog.ts, test/unit/gameLog.test.ts, test/worker/gameLog.test.ts 존재.
- 커밋 5개(fe630fbc, babdeba5, 9a5c1c6c, 4cf13662, bf5ef431)가 HEAD 의 조상임을 확인.
