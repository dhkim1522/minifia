---
phase: quick-261025-fx1
plan: 01
subsystem: test-room-server-bots
tags: [test-room, durable-object, websocket, server-bots, alarm, tdd, deploy]
status: complete
requires:
  - phase: quick-261025-f09
    provides: testMode 방 플래그, checkTestHost 검사 순서, rejectTestTool, TestTools 시트, uat-test-room 모양
  - phase: 03-night-morning
    provides: pickTarget·pickRecipientIds·nightChatRecipientIds, say/emote 1.8초 한도, selectClaim, ON_ENTER 진입 훅 표
provides:
  - "{ t: \"testBots\", count } (strict 0..7) 와 방장 대기실 view 의 me.testBots (손님·일반 방·게임 중에는 키 없음)"
  - shared/game/bots.ts 순수 규칙 (BOT_NAMES, botClaimChoice, botNightTarget, botPlanKey, planBotSteps, syncBotPlan, takeDueBotSteps, botWakeAt)
  - shared/game/testTools.ts setBotCount, Player.isBot / RoomState.botPlan 서버 전용 필드
  - worker/room.ts 의 apply* 본체 분리, runDueBots, 봇 행동 시각을 합친 알람, 깨어날 때 봇 연결 유지
  - TestTools 시트 '봇' 줄 ([봇 줄이기] N명 [봇 늘리기], [5명 채우기]), Icon minus
  - scripts/uat-test-bots.mjs 배포본 확인, 결정 0024
affects: [결정 0023 차례 주장 구현(botClaimChoice 한 곳), 4페이즈 확인 작업(폰 한 대로 전 단계)]
actuals:
  tokens: 22614
  tasks: 3
  commits: 6
plan_head_before: 036893fc66854b7b33e0b27f0dc0e085ffd3dec1
plan_head_after: 0f0314f98251f301798cdb05b798ae8689d71c5c
tech-stack:
  added: []
  patterns:
    - "봇 = 방 상태의 소켓 없는 Player(isBot, 토큰 빈 문자열, connected 고정) — view 허용 목록 리터럴이라 표시가 저절로 빠진다"
    - "봇 계획은 reschedule 에서 지금 단계에 맞추고(키 = 단계:마감) 알람 하나가 min(단계 마감, 방 만료, 다음 봇 행동)에 깨운다 — 단계가 바뀌면 낡은 계획은 저절로 버려진다"
    - "봇 실행은 사람 소켓 처리기와 같은 apply*(playerId, …) 본체를 부르고 거부는 버린다(특권 없음)"
key-files:
  created:
    - shared/game/bots.ts
    - scripts/uat-test-bots.mjs
    - docs/decisions/0024-test-room-bots.md
    - test/unit/bots.test.ts
    - test/worker/bots.test.ts
  modified:
    - shared/protocol.ts
    - shared/schemas.ts
    - shared/game/room.ts
    - shared/game/testTools.ts
    - shared/game/view.ts
    - worker/room.ts
    - src/components/TestTools.tsx
    - src/components/Icon.tsx
    - src/styles/testtools.css
    - test/client/testTools.test.tsx
    - HANDOFF.md
key-decisions:
  - "봇은 방 상태 안의 가짜 플레이어이고 행동 계획(botPlan)은 서버 전용 — DO 알람 하나가 단계 마감·방 만료·다음 봇 행동 중 가장 이른 시각에 깨운다(메모리 타이머 없음)"
  - "봇 실행은 사람과 같은 applyClaim·applySay·applyEmoji·applyPick 만 부른다(특권 없음, 거부는 버림)"
  - "결정 0023 구현 때 바꿀 곳은 shared/game/bots.ts 의 botClaimChoice 한 함수(차례가 아니면 null, botPlanKey 에 차례 번호 추가)"
  - "봇은 방장 이어받기 후보가 아니고 사람이 모두 나가면 방을 지운다; 사람이 한 명도 연결되어 있지 않으면 봇은 계획을 세우지 않는다"
patterns-established:
  - "RED 는 자리 표시 모듈(throw)과 상수만 두고 테스트가 설정 오류가 아니라 단언/미구현으로 실패하게 해 gsd check tdd-red-evidence 가 RED_EVIDENCE_OK 를 낸다"
requirements-completed: [QUICK-261025-fx1]
---

# Phase quick-261025-fx1 Plan 01: 테스트 방 서버 봇 Summary

**테스트 방 방장이 대기실 [테스트] 시트의 '봇' 줄로 서버 봇 0~7명을 앉히면, 봇이 방 Durable Object 안에서 사람과 같은 처리기로 직업 공개·토론·밤 행동을 하고 어떤 프레임에도 봇 표시가 새지 않는 폰 한 대용 4~8명 판이 배포됐다.**

- 소요: 로컬 시계 기준 11:41 경 ~ 마지막 스모크 직후(약 30분 안팎), 과제 3개, 변경 파일 16개(+1867/-45)
- 배포: https://minifia.dhplay.workers.dev — 새 버전 `2026-10-25T02:55:38Z+b4bed28`, 이전 버전 `2026-10-25T02:23:07Z+d82c615`

## 과제별 결과

| 과제 | 내용 | 커밋 |
| ---- | ---- | ---- |
| 1 (트레이서) RED | 단위 47 + 워커 14 테스트, 자리 표시 모듈·`MAX_TEST_BOTS` | b7e4849 |
| 1 GREEN | `testBots` 와이어, bots.ts 규칙, setBotCount, apply* 분리, 알람 합치기, 깨어날 때 봇 연결 유지, view `me.testBots` | 88ba0ff |
| 2 RED | 봇 줄 화면 테스트 11개 | 26f5d80 |
| 2 GREEN | '봇' 줄 + minus 아이콘 + 토큰 CSS | 367b11c |
| 3 | `uat-test-bots.mjs` + 결정 0024 (배포 전 커밋) | b4bed28 |
| 3 | HANDOFF 갱신 + 개인 원격 push | 0f0314f |

### TDD RED 증거 (`gsd check tdd-red-evidence`)

- 단위 `test/unit/bots.test.ts` — `RED_EVIDENCE_OK` (target_test_failed, 47/47 실패). semanticAssessment: 대상 테스트는 자리 표시 `setBotCount` 의 `not implemented` 로 실패(모듈 로드·설정 오류가 아님), 의도한 이유(기능 없음).
- 워커 `test/worker/bots.test.ts` — `RED_EVIDENCE_OK`. 대상 "테스트 방 손님은 NOT_HOST …" 가 `expected '[error:BAD_MESSAGE]' to be '[error:NOT_HOST,state:lobby]'` 단언으로 실패. 이미 통과하던 3개(일반 방 거부·count 8 거부·일반 방 알람)는 회귀 가드다.
- 화면 `test/client/testTools.test.tsx` — `RED_EVIDENCE_OK`. 대상 "인원 4·봇 3 …" 가 "Unable to find an element with the text: 3명" 으로 실패.
- 첫 시도의 RED 는 describe 본문에서 자리 표시 함수가 던져 파일 전체가 수집 실패했으므로(INVALID_RED 유형) 고정물을 `it` 안으로 옮겨 다시 측정했다.

## 검증 결과

- 게이트(배포 전): `npx vitest run` 69 파일 1486 테스트 초록, `npm run typecheck`(error TS 0), `npm run build` 초록.
- 수락 기준: 과제 1·2 의 grep/diff 기준 모두 PASS (규칙 파일 phases·tick·night·claim·chat·roles 는 d82c615 대비 무변경, bots.ts 에 `Math.random`·`Date.now` 없음, 색 hex 없음).
- 배포본 `node scripts/uat-test-bots.mjs --prod --previous-version 2026-10-25T02:23:07Z+d82c615` — `UAT TEST-BOTS OK` 39/39, 종료 코드 0 (재실행 38/38 도 OK).
- 회귀: `node scripts/uat-test-room.mjs --prod` — `UAT TEST-ROOM OK` 26/26. `node scripts/smoke.mjs --prod --stage full` — `SMOKE OK full code=4566 players=5 spread=23ms reveal=21ms version=2026-10-25T02:55:38Z+b4bed28`.
- push: `036893f..0f0314f main -> main` (개인 SSH 원격), `git rev-parse HEAD` = `origin/main` = `0f0314f`.
- 배포 계정 확인: 배포 직전 `npx wrangler whoami` 출력의 이메일이 dhkim1522@naver.com (개인 계정), Worker `minifia` 만 배포.

## 결정 0023 구현 때 바꿀 곳

`shared/game/bots.ts` 의 **`botClaimChoice(state, bot, randInt)`** 한 함수. 그 봇 차례가 아니면 `null` 을 돌려주게 하고, 차례마다 계획이 새로 서도록 `botPlanKey` 에 차례 번호를 더한다. 나머지(계획·실행·알람·누출 경계)는 그대로다. (파일 머리말과 결정 0024 결과에 같은 내용을 적었다.)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] RED 가 수집 단계에서 실패하지 않도록 자리 표시 모듈을 RED 커밋에 포함**
- **Found during:** Task 1 RED
- **Issue:** `shared/game/bots.ts`·`setBotCount` 가 없으면 테스트 파일이 import 단계에서 실패해 `gsd check tdd-red-evidence` 가 INVALID_RED(fixture/load failure)로 판정한다.
- **Fix:** RED 커밋에 throw 만 하는 자리 표시 `bots.ts`, `setBotCount`, 상수 `MAX_TEST_BOTS` 를 두고 GREEN 에서 실제 구현으로 교체했다.
- **Files modified:** shared/game/bots.ts, shared/game/testTools.ts, shared/protocol.ts
- **Commit:** b7e4849

**2. [Rule 1 - Bug] 단위 테스트 고정물의 시각·인원 오류**
- **Found during:** Task 1 GREEN
- **Issue:** 계획 시각 `now` 를 단계 시작과 무관한 상수로 주어 모든 행동이 마감 500ms 전 규칙으로 버려졌고, 호출 순서 테스트가 4명 미만 판을 만들었다.
- **Fix:** `nowOf(state)`(마감 − 단계 길이)로 바꾸고 호출 순서 테스트를 봇 셋(총 4명)으로 고쳤다. 구현 변경 없음, 테스트 고정물만.
- **Files modified:** test/unit/bots.test.ts
- **Commit:** 88ba0ff

**3. [계획 문구 확인] 회귀 결과 수치**
- 회귀 `uat-test-room` 은 26/26 이다. f09 HANDOFF 는 27/27 로 적혀 있는데 이번에는 `--previous-version` 없이 실행해 버전 확인 1줄이 빠진 것으로 보인다(실패 항목 없음, 종료 코드 0).

**Total deviations:** 3 (Rule 3 ×1, Rule 1 ×1, 표기 확인 ×1). **Impact:** 범위·와이어 계약·공개 경계 변화 없음.

## 알려진 한계 (Known Stubs 없음)

- 스텁·TODO 없음. 사람이 한 명도 연결되지 않은 방에서 단계 중간에 사람이 다시 연결되면 그 단계의 봇 계획은 비어 있고 다음 단계부터 행동한다(버려진 방이 알람으로 깨는 것을 막기 위한 의도된 단순화).
- 폰(360px) 확인은 자동 검사로 볼 수 없어 남아 있다: '봇' 줄이 한 줄에 드는지·누르기 쉬운지, 봇이 평범한 플레이어로 보이는지, 봇 행동의 자연스러움. HANDOFF 에 확인 목록을 적었다.

## Threat Flags

없음 — 새 네트워크 엔드포인트·인증 경로·스키마 경계 변경 없음(기존 WebSocket 메시지 한 종류 추가, 위협 모델 T-fx1-01~08 의 완화는 단위·워커 테스트와 배포본 스크립트 a·b·c·d·e·f·h 로 확인).

## Self-Check: PASSED

- 생성 파일 존재: shared/game/bots.ts, scripts/uat-test-bots.mjs, docs/decisions/0024-test-room-bots.md, test/unit/bots.test.ts, test/worker/bots.test.ts — FOUND
- 커밋 존재(`git merge-base --is-ancestor`): b7e4849, 88ba0ff, 26f5d80, 367b11c, b4bed28, 0f0314f — FOUND
- `commits: 6` 은 `git rev-list --count 036893f..HEAD` 로 측정한 값이다.
