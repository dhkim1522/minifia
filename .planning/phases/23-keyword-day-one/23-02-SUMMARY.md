---
phase: 23-keyword-day-one
plan: "02"
subsystem: game-log-storage
tags: [d1, migration, vitest, deploy-guard, games-cli, tdd]
requires: ["23-01"]
provides:
  - "wrangler.jsonc d1_databases DB(minifia-v3-games, migrations_dir migrations, database_id 없음)"
  - "migrations/0001_games.sql: games 표 16열 + games_ended_at 색인"
  - "워커 시험 메모리 D1: vitest.config.ts 의 TEST_MIGRATIONS + test/worker/setup.ts 의 applyD1Migrations"
  - "scripts/games.mjs: planGames·summarySql·formatSummary·runGames, npm run games"
  - "judgeDeployTarget d1Databases 검사: database_id 없는 D1 이면 배포 전에 멈춤"
affects: [23-10, 23-13]
actuals:
  tokens: 6400
  tasks: 3
  commits: 6
plan_head_before: f596448f729143f16a572ee7c2859ffafffcc595
plan_head_after: 56cb78bca28b0c6f33aa043a0332814199022fae
tech-stack:
  added: []
  patterns:
    - "시험 환경에서 실제 마이그레이션 파일을 메모리 D1 에 적용(readD1Migrations 노드 쪽 → miniflare 바인딩 → setup 의 applyD1Migrations)"
    - "조회 명령은 순수 함수(planGames·summarySql·formatSummary) + 주입 가능한 실행기(runGames deps.exec)로 나눠 wrangler 없이 시험"
    - "wrangler 를 셸 없이 node 로 직접 호출(설치된 wrangler/bin/wrangler.js 를 require.resolve 로 찾음)"
key-files:
  created:
    - migrations/0001_games.sql
    - test/worker/d1.test.ts
    - test/worker/env.d.ts
    - scripts/games.mjs
    - scripts/games.test.mjs
  modified:
    - wrangler.jsonc
    - vitest.config.ts
    - test/worker/setup.ts
    - package.json
    - scripts/deploy-target.mjs
    - scripts/check-deploy-target.mjs
    - scripts/deploy-target.test.mjs
decisions:
  - "wrangler 호출은 npx 가 아니라 process.execPath + wrangler/bin/wrangler.js, shell false — Windows 에서 shell:true 로 가면 SQL 의 괄호·따옴표가 cmd 를 지나 깨지므로 셸을 아예 쓰지 않는다"
  - "runGames 의 exec 는 wrangler 인자 배열만 받는다(npx 를 계획의 예시 그대로 쓰지 않음)"
  - "CHECK 거절 시험은 일반 INSERT 로 한다 — INSERT OR IGNORE 는 CHECK 위반도 삼킨다"
status: complete
---

# Phase 23 Plan 02: D1 판 기록 바탕 Summary

D1 바인딩(database_id 없음)·games 마이그레이션 0001·워커 시험 메모리 D1·`npm run games` 조회 명령·database_id 없는 배포를 막는 가드를 깔았다. 원격 D1 은 만들지도 건드리지도 않았다(D-19). 행 만들기·넣기(buildGameRow·recordGame)는 23-10.

## 완료한 일

| Task | 이름 | 커밋 |
|------|------|------|
| 1 RED | D1 games 표 시험 | bd45ece5 |
| 1 GREEN | D1 바인딩과 games 마이그레이션, 시험 메모리 D1 | ea723e42 |
| 2 RED | npm run games 인자 가드·출력 시험 | 54626193 |
| 2 GREEN | npm run games — 판 기록 한 화면 조회 | 4628b5ce |
| 3 RED | D1 database_id 배포 가드 시험 | 8a612268 |
| 3 GREEN | database_id 없는 D1 이면 배포를 멈춘다 | 56cb78bc |

## 검증 결과

- RED 확인: d1.test 3개 전부 실패(`env.DB` undefined), games.test 파일 로드 실패(모듈 없음), deploy-target.test 2 fail.
- Task 1: `npx vitest run test/worker/d1.test.ts test/worker/start.test.ts` 9 passed, `npm run typecheck` 통과.
- Task 2: `node --test scripts/games.test.mjs` fail 0. Task 3: `node --test scripts/deploy-target.test.mjs scripts/check-account.test.mjs scripts/games.test.mjs` pass 52 / fail 0.
- D-30: `npm run build` 는 database_id 없는 바인딩으로 통과(종료 0). 마지막에 typecheck·build 다시 돌려 둘 다 0.
- 인수 기준: `"d1_databases"` 1, 주석 뺀 `database_id` 0, `CREATE TABLE games` 1, `applyD1Migrations` setup 1, `"games": "node scripts/games.mjs"` 1, `judgeWhoami` 사용, `shell: true` 0.
- 워커 전체(`vitest run --project worker`) 3번 실행: 1회차 2파일 실패(이름 미확인, 출력이 잘림), 2회차 bots.test.ts 1건 실패, bots.test.ts 단독 재실행 1회 실패 뒤 1회 통과, 3회차 46 passed·4 skipped 전부 초록. 부하 간헐로 보이며 이 계획이 건드린 부분(setup 의 마이그레이션 적용)은 원인이 아니다. 1회차 실패 파일 이름은 확인하지 못했다.
- dev 서버: database_id 없는 바인딩으로 `npm run dev` 가 떠서 `curl http://localhost:5173/api/health` 가 200(`{"ok":true,...}`).
- 로컬 `npm run games`(`wrangler d1 migrations apply DB --local` 뒤): `아직 기록이 없어요`. `npm run games -- --command x` 는 `알 수 없는 인자 — 아무것도 실행하지 않았다` 와 사용법만 찍는다.
- `node scripts/check-deploy-target.mjs`: 종료 1, "D1 바인딩 DB 의 database_id 가 없음 — 24 배포 첫 단계…" 한 줄(D-19 의도대로 지금은 배포가 막힌다).

## 로컬 상태 폴더 관찰 (RESEARCH A1, 23-13 에 넘김)

`wrangler d1 migrations apply DB --local` 은 `.wrangler/state/v3/d1` 에 적용한다. `vite dev` 를 띄웠던 같은 작업 폴더에 `.wrangler/state/v3/{d1,do,kv,r2,cache}` 가 함께 있어 같은 루트를 쓰는 것으로 보인다. 그러나 dev 서버가 실제로 이 d1 폴더에 쓰는지(판을 끝낸 뒤 `npm run games` 에 보이는지)는 행 넣기(23-10)가 없어 이 계획에서는 확인하지 못했다. 이 관찰은 확정이 아니다.

## 계획과 달라진 곳 (Deviations)

**1. [Rule 1 - 시험 버그] INSERT OR IGNORE 는 CHECK 위반을 삼킨다**
- 발견: Task 1 GREEN 중 d1.test 의 "승자 'x' 는 CHECK 로 거절" 단언이 resolve 로 통과해 실패.
- 조치: 거절 시험은 `INSERT OR IGNORE` 를 일반 `INSERT` 로 바꿔서 한다. 중복 id 무시는 기존 단언이 그대로 확인.
- **23-10 에 넘길 점**: `insertGame` 이 `INSERT OR IGNORE` 를 쓰면 winner 가 잘못된 행은 에러 없이 조용히 버려진다. 행 빌더가 'mafia'|'citizen' 만 만들게 하고, 실패가 보이길 원하면 중복 id 만 ON CONFLICT(id) DO NOTHING 으로 무시하는 방법이 있다.
- 파일: test/worker/d1.test.ts, 커밋 ea723e42.

**2. [Rule 1 - 시험 버그] 열 이름 금지어 정규식이 계약 열을 잡았다**
- 발견: `/answer/` 가 계약 열 `no_answer_count` 에 걸림. 열 집합을 16개로 정확히 고정하는 단언이 이미 닉네임·채팅·답 글 열을 막으므로 부정 정규식 루프는 지웠다.

**3. [설계 선택] wrangler 호출 방식**
- 계획 예시는 `spawnSync("npx", ["wrangler", ...])` 였으나, 코드 상수 SQL 에 괄호·따옴표가 있어 Windows 에서 shell 을 켜면 깨지고 켜지 않으면 `npx.cmd` 를 못 부른다. 둘 다 피하려고 `process.execPath` 로 설치된 `wrangler/bin/wrangler.js` 를 직접 실행한다(shell false, `wrangler/package.json` 을 `require.resolve` 로 찾음). 실제 조작은 로컬 macOS 에서만 확인했고 Windows 동작은 확인하지 못했다.
- 이에 맞춰 `runGames` 의 가짜 실행기 계약을 "wrangler 인자 배열 하나만 받는다" 로 했다(계획의 `exec` 의도와 같고 시그니처만 단순화).

## 하지 않은 것 / 확인하지 못한 것

- `npm run games -- --remote` 를 실제로 돌리지 않았다(wrangler whoami 가 계정에 닿는 일은 이 페이즈 범위 밖). 개인 계정 확인 순서·거부는 가짜 실행기로만 시험했다.
- 원격 D1 생성·원격 마이그레이션·배포는 하지 않았다. 24 가 첫 단계로 할 명령은 RESEARCH 538~546행 그대로이고 23-13 결정 0091 에 적힌다.
- `npm run e2e`·`vite preview` 는 돌리지 않았다.

## 이월 (23-10·23-13·24)

- 23-10: `buildGameRow`·`insertGame`(INSERT OR IGNORE 의 CHECK 삼킴 주의), `recordGame`. 시험은 setup 이 이미 메모리 D1 을 준비하므로 `env.DB` 로 바로 SELECT 하면 된다. 실패 격리 시험은 `env.DB.prepare` 를 던지게 바꾼다.
- 23-13: 결정 0091 에 (a) 원격 D1 생성·id 기입·원격 마이그레이션은 24 첫 일, (b) `--local` 조회가 dev 서버와 같은 상태 폴더를 쓰는지는 확인 전(위 관찰), (c) 배포 가드가 id 없는 D1 을 막으니 24 가 id 를 채워야 배포된다는 점을 알려진 한계로 옮긴다.
- 24: `wrangler.jsonc d1_databases[0]` 에 `"database_id"` 손으로 기입하면 가드가 풀린다. 그 전의 `npm run deploy` 는 check-deploy-target 에서 멈춘다.

## Known Stubs

없음.

## Threat Flags

없음. T-23-05(자동 생성)·T-23-06(인자)·T-23-07(계정)·T-23-08(열 집합)은 각각 배포 가드 시험, planGames 허용 목록·상수 SQL·shell false, runGames 의 whoami 선행 판정, d1.test 열 집합 고정으로 완화했다.

## Self-Check: PASSED

- 파일: wrangler.jsonc, migrations/0001_games.sql, vitest.config.ts, test/worker/{setup.ts,env.d.ts,d1.test.ts}, scripts/{games.mjs,games.test.mjs,deploy-target.mjs,check-deploy-target.mjs,deploy-target.test.mjs}, package.json 모두 존재.
- 커밋 6개(bd45ece5, ea723e42, 54626193, 4628b5ce, 8a612268, 56cb78bc)가 HEAD 의 조상임을 확인.
