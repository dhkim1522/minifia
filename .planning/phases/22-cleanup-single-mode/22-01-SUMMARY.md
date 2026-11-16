---
phase: 22-cleanup-single-mode
plan: "01"
subsystem: shared/server/audio
tags: [cleanup, awards, sound, e2e]
requires: []
provides:
  - "ResultView(GameResult) 에 awards 없음 — result 키는 seats·summary·winner"
  - "Player.stats·bumpStat 없음"
  - "소리 id 68개(award.* 없음), 결과 신호는 flip·light 둘"
affects: [22-03, 22-07]
key-files:
  modified:
    - shared/game/view.ts
    - shared/protocol.ts
    - shared/game/room.ts
    - worker/room.ts
    - src/audio/director.ts
    - src/audio/recipes.ts
    - src/audio/script.ts
    - src/audio/signals.ts
    - src/debug/soundLab.ts
    - src/debug/soundLabTable.ts
    - scripts/e2e/lib.mjs
    - scripts/e2e/sound.mjs
    - docs/audio.md
  deleted:
    - shared/game/awards.ts
    - shared/game/stats.ts
    - test/helpers/awardsState.ts
    - test/unit/awards.test.ts
    - test/unit/awardsProps.test.ts
    - test/unit/stats.test.ts
    - test/worker/awards.test.ts
    - test/worker/stats.test.ts
decisions:
  - "시상(칭호 계산)을 서버·와이어·소리·사운드랩·시험·E2E 판정에서 모두 지운다(D-19, 결정 0089-20)"
metrics:
  tasks: 2
status: complete
actuals:
  tokens: 60000
  tasks: 2
  commits: 2
plan_head_before: 2b71a00cf64844e18cd9cd9525bd42dd151c2061
plan_head_after: eabc6c66e4c5a1de1bb46f7b701a07710bb16d00
commits: 2
completed: 2026-11-16
---

# Phase 22 Plan 01: 시상 칭호 제거 Summary

시상(칭호 계산·통계 카운터·시상 소리·사운드랩 항목·E2E 시상 판정)을 서버부터 소리까지 한 번에 걷어 냈다. 결과 view 의 키는 `seats·summary·winner` 셋뿐이고 어느 소켓·어느 단계 프레임에도 `awards` 가 없다.

## 기준선 (Wave 0)

작업 전 `npm test`: 318 파일 통과·6 skipped, 9074 테스트 통과·262 skipped, 실패 0. `npm run typecheck`: 오류 0(exit 0).

## 커밋

- `a693661b` refactor(22-01): 시상 칭호 계산·통계 카운터 제거 (Task 1, 트레이서)
- `eabc6c66` refactor(22-01): 시상 소리·사운드랩·E2E 시상 판정 제거 (Task 2)

## 한 일

**Task 1 (트레이서)** — 서버 → 와이어 → 방 DO → 시험까지 한 번에 지웠다.
- `awards.ts`·`stats.ts`와 시상·통계 시험 5개·`awardsState` helper 삭제.
- `view.ts` ended 분기가 `{ winner, seats, summary }` 만 만든다. `protocol.ts` 에서 `GameResult.awards`·`AWARD_IDS`·`AwardId`·`AwardLine` 삭제.
- `Player.stats` 필드와 `worker/room.ts` 의 `bumpStat` 두 호출(emote·say) 삭제. 처리 순서는 그대로.
- 시험: endgame·view·bench 는 result 키 단언을 `seats,summary,winner` 로, leak.test 는 "모든 프레임에 `awards` 문자열 0건"(ended 포함) 한 단언으로 바꾸고 재접속 hello 의 result 가 같은지만 본다. resultScreen.test 는 awards 고정값·makeView 옵션을 지웠고 "시상 표식 0건" 회귀 단언은 남겼다.

**Task 2** — 소리·사운드랩·E2E.
- `award.plate`·`award.final` 레시피·설명 표·`SOUND_IDS`, `awardScript`·`plateCues`·`AwardInput`·`AWARD_CLAP_DB`·`RESULT_AT.award*`, 신호 `step: "plate"`, 감독의 `RESULT_PLATE_KEY(S_MAX)` 삭제.
- 사운드랩 결과 묶음은 `result.win`·`result.lose`, 제목 "결과". 시험 버튼은 `resultScript` 만 재생한다.
- E2E `soundResultChecks` 에서 R4 삭제(번호는 다시 매기지 않음), `isResultOneShot` 의 `award.` 접두와 R6 설명의 `award.*` 삭제, sound.mjs 참고 출력에서 award 집계 삭제.

## 검증 결과

- Task 1 verify(`vitest run` endgame·view·leak·bench·resultScreen + `npm run typecheck`): 통과.
- Task 2 verify(소리 시험 6개 + `node --test scripts/e2e/lib.test.mjs` + typecheck): vitest 456 통과, node --test 통과(exit 0), typecheck 오류 0.
- 계획 끝 검증: `npx vitest run --project unit` 151 파일·5109 통과, `--project worker` 마지막 실행 63 파일·649 통과(아래 flaky 참고), `node --test scripts/*.test.mjs scripts/e2e/*.test.mjs` exit 0.
- 인수 기준: `git grep "computeAwards|AWARD_IDS|AwardLine|bumpStat" -- shared src worker test` 0건, `git grep "award" -- shared worker` 0건, `git grep "award\.|plateCues|awardScript|RESULT_PLATE_KEY" -- src` 0건, `stats?:` 0건, `summary,winner` 1건.

## Deviations from Plan

### 계획 밖으로 손댄 파일

**1. [Rule 3 - 막는 문제] 소리 수 70 → 68 고정값 동기화**
- award 레시피 2개를 지우면 소리 id 가 70 → 68(침대 7 + 효과음 61)이 되어 고정 개수를 단언하는 곳이 깨진다. 계획 3)이 "새 수로 맞춘다"고 허용한 범위다.
- 수정: `src/debug/soundLabTable.ts` `SOUND_LIMITS.count`, `scripts/e2e/lib.mjs` `SOUND_RENDER_LIMITS.count`, `scripts/e2e/sound.mjs` 주석(옛 57개 → 68개), `docs/audio.md`(소리 수·`bed.result` 설명·award 두 행·"칭호별 개별 소리" 문구), `test/unit/soundProtocol.test.ts`·`soundRecipes.test.ts`·`soundLab.test.ts`·`scripts/e2e/lib.test.mjs` 의 개수 단언.
- `docs/audio.md` 와 `test/unit/soundProtocol.test.ts` 는 계획 files_modified 에 없었지만 같은 개수를 쓰므로 함께 고쳤다(레시피 지도가 모든 id 를 담아야 통과하는 시험이 있다).

**2. [Rule 3] 계획 files_modified 밖 시험 보정**
- `test/unit/rematch.test.ts`: `dirtyPlayer` 의 `stats` 리터럴이 `Player` 타입에서 사라져 타입 오류 → 해당 줄 삭제(rematch 가 `stats` 를 안 남기는 단언은 그대로).
- `test/worker/endedChat.test.ts`: "결과 단계 줄은 판 통계 say 를 올리지 않는다" 는 비교 대상이 없어져 공허해짐 → "저장된 사람에 stats 가 없다" 단언으로 바꿨다.
- `test/unit/soundDirector.test.ts` 는 award 단언이 없어 손대지 않았다.

**3. 계획 4)의 "award.* 가 SOUND_IDS 에 없다" 단언**
- `soundRecipes.test`·`soundLab.test`·`soundResult.test`·`soundScript.test` 에 한 줄씩 "award 키·소리 없음" 회귀 단언을 넣었다. `soundEngine.test` 는 우선 0 소리 목록의 `award.final` 을 같은 우선 0 인 `result.win` 으로 바꿨다.

### 알려 둘 것

- **worker 시험 flaky**: `--project worker` 병렬 전체 실행에서 `bots.test`·`lampLeak.test`·`waitHelpers.test` 가 실행마다 다른 시험이 1~3건 실패했다(타임아웃·`awaitTransition` 10s 대기, `Cannot read properties of undefined (reading 'id')`). 같은 파일 단독 재실행과 worker 전체 재실행에서는 통과했다. 이 계획이 닿지 않은 영역(봇·심부름 등불)이라 부하에 따른 간헐 실패로 보고 이 계획의 회귀로 세지 않는다. 기준선(`npm test` 전체)은 실패 0 이었다.
- 저장된 옛 방의 `players[].stats` 런타임 키는 계획대로 손대지 않았다(22-03 `legacyRoom.test.ts` 키 목록에 22-07 이 넣는다).
- `test/client/resultScreen.test.tsx` 는 Task 2 에서 한 번 더 고쳤다(plate 신호 비교를 "flip·light 밖 신호 0" 으로). 계획상 Task 1 파일이다.

## Known Stubs

없음.

## Threat Flags

없음. 결과 view 의 공개 키가 줄었고 새 공개 값·엔드포인트는 없다(T-22-01 mitigate: leak.test 가 모든 프레임의 `awards` 문자열 0건을 단언).

## Self-Check: PASSED

- 삭제 확인: `shared/game/awards.ts`, `shared/game/stats.ts` 없음.
- 커밋 존재: `a693661b`, `eabc6c66` 모두 HEAD 의 조상.
