---
phase: 12-sound-polish
plan: "03"
subsystem: test-stability
tags: [vitest, durable-object, flaky-test, npm-audit, bots]
requires:
  - phase: 12-01
    provides: 정리 계획(삭제 표) — 이 계획은 표의 M-4·M-5 를 맡는다
provides:
  - editRoom 이 evict 전의 낡은 메모리 방 저장에 덮이지 않는다(writeRoomEdit)
  - 손으로 정한 봇 표를 봇의 남은 계획이 덮지 못하게 하는 clearBotSteps
  - 바뀐 단계의 state 를 사건으로 기다리는 awaitTransition(skipOnce 가 사용)
  - skip·todo·재시도·한도 상수를 고정하는 flakeGuard
  - npm audit 결과 표(결정 0070 의 입력)
affects: [12-12, bots.test.ts]
tech-stack:
  added: []
  patterns: ["DO 저장소를 고치는 시험 도우미는 살아 있는 인스턴스의 메모리 사본도 함께 고친다", "단계 전이는 '아무 프레임'이 아니라 바뀐 단계의 프레임으로 기다린다"]
key-files:
  created: [test/worker/waitHelpers.test.ts, test/unit/flakeGuard.test.ts]
  modified: [test/worker/helpers.ts]
key-decisions:
  - "원인은 대기 조건(H1~H4)이 아니라 editRoom 경합과 봇 남은 계획이었다 — 고친 곳은 도우미의 쓰기 길과 편집 내용이다"
  - "bots.test.ts 의 자체 forceBotsDue 는 같은 경합이 있으나 계획 파일 목록 밖이라 고치지 않고 이월한다"
  - "npm audit 은 --force 없이 적용 가능한 수정이 없다 — package.json·package-lock.json 불변"
requirements-completed: []
metrics:
  duration: 약 60분
  completed: 2026-11-06
status: complete
actuals:
  tokens: 21000
  tasks: 3
  commits: 2
plan_head_before: 11a532c6c533315aa95ee21afe114711d1d7fcf4
plan_head_after: d57a372dd0b471cdba2760c5e00a5ec3b83bc05a
---

# Phase 12 Plan 03: 시험 안정화와 의존성 점검 Summary

**`testTools` 'ended' 군의 간헐 실패 원인을 부하 반복으로 재현·증명해(13회 중 5회 실패 → 수정 뒤 부하 30회 연속 통과) 시험 도우미의 쓰기 경합으로 고치고, npm audit 6건이 모두 개발 의존성 사슬이며 운영 경로 0건임을 표로 남겼다.**

`commits:` 는 이 계획 커밋 2개(`git log --grep "(12-03)"`)다. 원장 범위 `plan_head_before..plan_head_after` 에는 같은 작업 트리에서 병렬로 도는 12-07·12-08·12-09 의 커밋이 섞여 있어 그 개수를 쓰지 않았다.

## 원인 진단

**재현.** 수정 전 코드에 행동을 바꾸지 않는 계측(skipOnce 의 전·후 단계, 프레임 수, 소요 ms)만 넣고, 부하를 건 채 `test/worker/testTools.test.ts` 를 반복했다. 부하는 `npx vitest run test/worker` 루프 2개를 동시에 돌린 것이고, 같은 작업 트리에서 병렬 실행기들도 돌고 있었다. 조용한 상태의 기준은 1회만 측정했다(34.3초, 'ended' 시험 각 약 4.05초, 3회는 못 채움).

| 구분 | 횟수 | 결과 |
|------|------|------|
| 수정 전, 부하 | 13 | 5회 실패(2·4·9·11·12번째), 실패 시험은 `ended 에서 testReset`(5회) · `ended 에서 testSkip`(2회) |
| editRoom 메모리 수정만 | 2 | 1회 실패 — 두 번째 경로가 드러남 |
| 최종 수정 | 30 | 30회 통과, 실패 0 |

**실패 형태.** 두 시험이 `driveToEnded` 마지막 `skipThrough(…, "ended")` 안 `skipOnce` 에서 10초 `nextFrame` 시간 초과(총 13초 안팎)로 죽는다. 계측한 실패 메시지는 `before=night … frames=[error:RATE_LIMITED] | []` 였다. 호스트 소켓이 `RATE_LIMITED`(소켓당 1초 20개 한도, `worker/room.ts` 의 RATE_MAX_MESSAGES)를 받고 그 뒤로 state 를 못 받은 것이다.

**증명된 원인.** 판이 'ended' 로 끝나지 않고 다음 날로 넘어가서, `skipThrough` 가 최대 40번 testSkip 을 몰아 보내다 호스트가 한도에 걸린 것이다. 판이 안 끝난 이유는 `driveToEnded` 가 손으로 넣은 봇 찬성 표(`verdictVote: true`)가 사라졌기 때문이다. 사라지는 길이 둘이고 둘 다 계측으로 잡았다.

1. **낡은 메모리 방 덮어쓰기.** `editRoom` 은 저장소에만 쓰고 `evictDurableObject`(약 2초 걸림)를 기다린다. 그 사이에 봇 알람이 돌면 `runDueBots` 가 살아 있는 인스턴스의 **메모리 방**을 통째로 저장해 방금 쓴 표를 지운다. 증거: 저장된 방에서 봇 하나는 자기 무작위 표를 갖고 나머지 둘은 표가 없었고, 결과 표가 `yes[2,4] no[3]`(과반 미달)이었다.
2. **봇의 남은 계획 행동.** 봇은 찬반 단계가 시작될 때 1~6초 안의 무작위 시각에 무작위 표를 던지도록 계획(`botPlan.steps`)을 세운다. 손으로 정한 표를 넣어도 남은 계획이 알람에 깨어 덮는다. 1번만 고친 뒤 실패에서 봇 3이 `v:false` 를 갖고 있었다.

**기각한 가설.**

| 가설 | 판정 | 근거 |
|------|------|------|
| H1 skipOnce 가 뒤늦은 같은 단계 프레임에 일찍 풀림 | 기각(관찰된 적 없음) | 계측한 skipOnce 421회 모두 소켓당 state 프레임이 정확히 1개였다 |
| H2 evict 뒤 첫 전이가 `nextFrame` 한도 초과 | 기각 | 421회의 전이 소요 최대 21ms |
| H3 `until` 3초 한도 | 기각 | 실패 지점은 `until` 이 아니라 skipOnce 의 RATE_LIMITED |
| H4 앞선 시험이 남긴 타이머가 섞임 | 기각 | 실패는 시험 순서와 무관하게 'ended' 군에서만, 한 시험 안에서 닫혀 있다 |

H1 은 현재 코드에서 일어나지 않았지만 구조적 위험이라(완료 조건이 '아무 프레임') 같이 고쳤다. 한도는 올리지 않았다.

## 수정

- `writeRoomEdit`(신규, `editRoom` 이 사용): 저장소와 살아 있는 인스턴스의 메모리 방을 같은 값으로 고친다.
- `clearBotSteps`(신규): `driveToEnded` 의 지목·찬반 편집에서 봇의 남은 계획 행동을 비운다(계획 키는 남겨 다시 세워지지 않게 한다).
- `awaitTransition`(신규, `skipOnce` 가 사용): 보내기 전 저장된 단계를 읽고, 모든 소켓이 **바뀐 단계**의 state 를 받을 때까지 기다린다. 못 받으면 단계·소켓·한도를 메시지에 담아 던진다. 한도는 `TRANSITION_WAIT_MS = 10_000` 한 곳(08-11 값 그대로).
- 결정적 시험(`test/worker/waitHelpers.test.ts`, 6개): 가짜 소켓으로 뒤늦은 프레임 경합과 옛 대기가 일찍 풀린다는 사실, 시간 초과 메시지, 소켓별 대기, 낡은 프레임 무시, 옛 editRoom 방식이 값을 잃고 새 방식이 지킨다는 사실, 남은 계획이 표를 덮고 `clearBotSteps` 가 막는다는 사실.
- 가드(`test/unit/flakeGuard.test.ts`, 4개): 시험·도우미에 skip·todo·retry 없음, `vitest.config.ts` 에 retry 없음, `endedRoom`·`driveToEnded` 보존, 한도 상수 10초 고정.
- `testTools.test.ts`·`bots.test.ts` 는 고치지 않았다(도우미 시그니처가 호출부와 호환된다).

## 안정 확인

- **부하 30회 연속 통과**: `testTools.test.ts` 30회, 실패 0. 부하 = `npx vitest run test/worker` 루프 2개 + 병렬 실행기들(load average 약 6).
- `bots.test.ts`(같은 도우미 사용, driveToEnded 호출): 10회 중 3회 실패. 같은 부하에서 **수정 전 도우미로 돌린 사본은 12회 중 6회 실패**라서 이 계획과 무관한 기존 불안정이다(아래 이월 항목). 실패 시험은 'ended' 군이 아니다.
- `continuity.test.ts`('옛 방장이 같은 토큰으로 돌아오면' 포함): 수정 전 도우미 15회 + 수정 후 45회 모두 통과. 부하를 가장 높게 건 첫 동시 실행에서 두 사본이 각 1개씩 실패했으나 로그를 남기지 못해 원인을 확인하지 못했다. **같은 원인이라는 증거는 없다.**
- 최종 확인: `npm run typecheck` 오류 0, `deps.test.ts`·`flakeGuard.test.ts`·`waitHelpers.test.ts`·`testTools.test.ts` 49개 통과.

## audit 결과

`npm audit --omit=dev`: **found 0 vulnerabilities** (운영 경로 0건, T-12-10). 전체 `npm audit` 은 6건(moderate 3 · high 3)이고 전부 개발 의존성 사슬이다.

| 패키지 | 심각도 | 경로 | 운영 경로 | 조치/불가 이유 |
|--------|--------|------|-----------|----------------|
| undici 7.0.0–7.30.0 (설치 7.29.1) | high | miniflare → wrangler · @cloudflare/vite-plugin | 아니오(개발 도구) | 불가: 수정은 @cloudflare/vite-plugin 1.67.0 상향을 요구하고 package.json 정확 고정 범위 밖이라 `--force` 가 필요하다 |
| miniflare 4.20250906.1–5.20261019.2-beta | moderate | wrangler · vite-plugin · vitest-plugin 안쪽 | 아니오 | 불가: undici 와 같다(전이 의존) |
| wrangler 4.36.0–4.152.0 (설치 4.151.3) | moderate | 직접 개발 의존 | 아니오 | 불가: 같다 |
| @cloudflare/vite-plugin 1.13.0–1.65.0 (설치 1.64.0) | moderate | 직접 개발 의존 | 아니오 | 불가: 1.67.0 이 필요, 범위 밖 |
| @cloudflare/vitest-plugin 1.0.0–1.4.7 (설치 1.4.6) | high | 직접 개발 의존(miniflare·wrangler·zod 경유) | 아니오 | 불가: 1.6.0 이 필요, 범위 밖 |
| zod <4.6.6 (vitest-plugin 안쪽 4.6.5) | high | @cloudflare/vitest-plugin/node_modules/zod | 아니오 | 불가: vitest-plugin 1.6.0 이 필요, 범위 밖 |

- `npm audit fix --dry-run`(force 없음): 취약점 수정 0건이다. 출력된 변경은 제거 3건(tslib·@img/sharp-wasm32·@emnapi/runtime)뿐이라 취약점과 무관해 적용하지 않았다.
- `package.json` 불변, `package-lock.json` 불변, `three` 는 0.186.1 그대로, 소리 의존성은 들어오지 않았다.
- 결정 0070(12-12)에 쓸 내용: 6건 모두 개발 전용(시험 러너·로컬 서버·배포 CLI 사슬)이고 해소하려면 wrangler·@cloudflare/vite-plugin·@cloudflare/vitest-plugin 상향이 필요하다. 상향은 정확 고정 정책과 맞물려 별도 결정(범위 밖)이다.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] 진단이 가리킨 원인이 계획의 가설 목록과 달랐다**
- **Found during:** Task 1
- **Issue:** 계획은 '기다리는 조건'(H1~H4)을 의심했으나 실제 원인은 도우미의 쓰기 경합(editRoom 의 메모리 방 덮어쓰기)과 봇의 남은 계획 행동이다.
- **Fix:** 원인이 있는 곳(`editRoom`·`driveToEnded` 편집)을 고치고, 계획이 요구한 사건 기준 대기(`awaitTransition`)도 같이 넣어 결정적 시험으로 고정했다. 계획이 허용한 "다른 원인이면 그 원인을 흉내 낸 시험"에 해당한다.
- **Files modified:** test/worker/helpers.ts, test/worker/waitHelpers.test.ts
- **Commit:** efda5ced

**2. [범위 판단] `bots.test.ts` 의 같은 경합은 고치지 않았다**
- **Found during:** Task 3 안정 확인
- **Issue:** `bots.test.ts` 의 자체 `forceBotsDue` 가 같은 '저장소만 쓰고 evict' 방식이라 같은 경합이 있다. 이 계획의 파일 목록 밖이다.
- **Fix:** 코드 변경 없음. 검증된 한 군데 수정안을 이월한다(임시 사본으로 12회 돌려 'verdict' 시험 실패 0, 수정 전 22회 중 4회 실패).

### Auth gates

없음.

## Known Stubs

없음.

## Threat Flags

없음. (T-12-08 은 flakeGuard 로, T-12-09 는 package.json·lock 불변으로, T-12-SC 는 새 패키지 없음으로 완화했다.)

## 이월 메모

- 원인: `editRoom` 이 evict 전에 봇 알람의 낡은 메모리 방 저장에 덮이고, 봇의 남은 계획이 손으로 정한 표를 덮어 판이 안 끝나 호스트가 RATE_LIMITED. 고친 곳은 `test/worker/helpers.ts`(writeRoomEdit·clearBotSteps·awaitTransition).
- 안정 확인: testTools 부하 30회 연속 통과(수정 전 13회 중 5회 실패). 한도·재시도는 건드리지 않았고 flakeGuard 가 고정한다.
- audit: 운영 경로 0건. 전체 6건은 개발 사슬이고 force 없이 적용 가능한 수정은 0건이라 package.json·lock 불변. 12-12 는 이 문서의 "## audit 결과" 표를 결정 0070 에 옮긴다.
- 미해결(이 계획 밖): `test/worker/bots.test.ts` 가 부하에서 10회 중 3회 실패하며 수정 전 도우미에서도 같다(12회 중 6회). 'verdict: 변론자가 아닌 봇만' 은 `forceBotsDue`(bots.test.ts 175행)의 `runInDurableObject`+`storage.put` 을 `writeRoomEdit(stub, (room) => …)` 로 바꾸면 사라진다(임시 사본 12회 중 0회 실패). 'discussion: 봇 셋이 모두…'(계획이 마감 여유로 잘려 2개)와 '봇 chat: 밤에는'(undefined id)은 시간 기반이라 별도 원인이다.
- `continuity.test.ts` 'old host returns' 는 60회 중 재현되지 않았고 같은 원인의 증거가 없다.
- 병렬 실행기들이 같은 작업 트리에서 돌면 부하가 높아 `bots.test.ts` 가 가끔 실패할 수 있다. 웨이브 게이트에서 그 시험이 단독 실패하면 이 항목이다.

## Self-Check: PASSED

- 파일: test/worker/helpers.ts, test/worker/waitHelpers.test.ts, test/unit/flakeGuard.test.ts, 이 SUMMARY 존재 확인.
- 커밋: 662f6bd5(test), efda5ced(fix) 모두 HEAD 의 조상이다.
