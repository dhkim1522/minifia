---
phase: 23-keyword-day-one
plan: "12"
subsystem: e2e-keyword-early
tags: [e2e, keyword, early-advance, uat-test-room, harness]
requires: ["23-04", "23-10", "23-11"]
provides:
  - "scripts/e2e/keyword.mjs: KW1~KW13 순수 판정(P23-1~13), 사본 상수 여덟(키워드·읽기·정답 공개·20자소·간격·조기 유예·거절 문구·알림 시간), 흐름 keyword·keyword-sizes·early"
  - "scripts/e2e/browser.mjs dismissAnswerSheetInit: 키워드 감시(window.__kwWatch)가 없는 페이지에서 첫날 토론 때 저절로 열리는 모두의 답을 100ms 마다 닫는 하네스 init 스크립트"
  - "hostBandChecks 의 ended 정답 예외(answer 옵션) — HB6·HB7 이 정답이 공개된 결과에서 띠 보임·한 줄을 기대"
  - "scripts/uat-test-room.mjs: 첫날 키워드 → 낮 시작 → 토론 → 찬반 → 정답 공개 → 밤 새 낮 순서와 키워드 검사 셋(24 의 배포 smoke 가 그대로 쓴다)"
affects: [23-13, 24]
actuals:
  tokens: 20500
  tasks: 3
  commits: 4
plan_head_before: 62d0dc26b3b728b13b5da81f9219f2f2495d9585
plan_head_after: 87818320c20fa1f2e1c30e3f8eb79079ad7a952c
tech-stack:
  added: []
  patterns:
    - "판정 문턱은 keyword.mjs 의 순수 함수에만 두고 흐름은 측정값만 모아 넘긴다(day.mjs 와 같은 모양)"
    - "입력줄 상태·거절 알림 시간·조기 진행 표식은 페이지 안 init 스크립트(30ms 폴링)가 기록하고 흐름이 읽는다 — 키워드·역할 값은 기록하지 않는다"
    - "마피아 소켓 누설은 다시 연결(reload) 전에 watchSockets 를 걸어 그 연결의 프레임 원문을 센다(시민 쪽을 대조군으로)"
key-files:
  created:
    - scripts/e2e/keyword.mjs
    - scripts/e2e/keyword.test.mjs
  modified:
    - scripts/e2e/flows.mjs
    - scripts/e2e/host.mjs
    - scripts/e2e/lib.mjs
    - scripts/e2e/lib.test.mjs
    - scripts/e2e/browser.mjs
    - scripts/e2e/politics.mjs
    - scripts/e2e/sound.mjs
    - scripts/uat-test-room.mjs
    - test/unit/e2eContract.test.ts
    - test/worker/bots.test.ts
decisions:
  - "KW13 비교에서 23페이즈 전부터 있던 마피아 전용 me 키(allies·records·allyPicks·nightTally·nightSure)와 방장 전용 테스트 키(testMode·testRole·testBots·testBotVote)는 뺀다 — 키워드와 무관한 기존 역할 차이다. 시민 쪽 대조군은 키워드 단계 연결(재접속 직후 프레임)에서만 잡힌다(me.keyword 는 키워드 단계 밖에서는 시민에게도 오지 않는다)"
  - "keyword 흐름의 KW6 뒤 방장도 다른 글을 내서 사람 전원이 제출 → 조기 진행으로 키워드가 끝난다(계획은 방장이 쓰던 글만 두고 시간 끝). 목록은 참가자 ①·방장 ②·봇 둘 '답 없음'이라 '낸 순서·답 없음 맨 끝' 판정이 둘 다 선다. 마감 시간 끝 경로(초안 확정)는 이 계획에서 E2E 로 보지 않는다"
status: complete
---

# Phase 23 Plan 12: 키워드·조기 진행 로컬 E2E Summary

새 흐름 셋(keyword·keyword-sizes·early)이 로컬 dev 서버(http://localhost:5173)에서 모두 통과하고(KW1~KW13), 첫날 키워드·정답 공개·조기 진행 때문에 어긋난 기존 흐름 기대를 고쳤으며, 24 가 쓸 배포 검증 스크립트(uat-test-room)를 새 낮 순서로 다시 썼다. 배포·원격 D1·폰 6종 전체 회귀는 하지 않았다.

## 커밋

| Task | 이름 | 커밋 |
|------|------|------|
| 1 RED | 키워드 E2E 판정 실패 시험 | 47143add |
| 1 GREEN | 키워드 E2E 판정과 사본 상수(+host.mjs BAND_REQUIRED·ended 정답 예외) | 79d90a20 |
| 2 (+3의 uat) | 키워드·조기 진행 E2E 흐름, uat-test-room 새 흐름, 하네스 자동 닫기 | f47198b6 |
| 3 | 첫날 키워드·정답 공개에 맞춘 기존 E2E 기대 | 87818320 |

계획은 uat-test-room 을 Task 3 커밋에 넣으라고 했지만 Task 2 커밋에 함께 들어갔다(같은 세션에서 먼저 끝나 같이 묶음). 내용 영향은 없다.

## E2E 실행 결과 (로컬, `--url http://localhost:5173`)

### 새 흐름 — `npm run e2e -- --url http://localhost:5173 --only keyword,keyword-sizes,early`

최종 실행 65초, E2E OK, 재시도 0.

| 흐름 | 크기 | 판정 | 결과 |
|------|------|------|------|
| keyword | 390x844 | KW1(둘, 계속되는 판·첫날 끝), KW2, KW3, KW4(+4a), KW5, KW6, KW8, KW9, KW10, KW11, KW13, G·H1 | 19/19 통과 |
| keyword-sizes | 360x640 / 390x664 / 430x932 / 360x560 / 402x874 / 390x844 | KW6(폰마다 1), KW7(참가자·방장 2), KW7b | 각 6/6 통과 |
| early | 390x844 | KW12(키워드·찬반·밤 세 단계) + 참고 측정 세 줄 | 7/7 통과 |

early 의 측정(참고): 키워드 1522ms·early·calm, 찬반 1523ms·early·번복이 마감을 464ms 늘림, 밤 1512ms·early·두 페이지 마감 같음.

개발 중 거친 실패(투명하게): keyword 첫 실행은 (1) KW13 이 마피아 전용 me 키(allies·records)를 키워드 차이로 오판, (2) 시민 쪽 대조군을 토론 시점 재접속으로 잡았는데 me.keyword 가 키워드 단계 밖에서는 시민에게도 없어 0건, (3) 두 번째 게임에서 첫날 토론 때 저절로 열린 '모두의 답' 시트가 테스트 시트를 가려 클릭 시간 초과(재시도 4회 모두 같은 자리)였다. (1)(2)는 판정·측정 설계를, (3)은 하네스를 고쳤다(아래 편차). 고친 뒤 재시도 없이 통과.

### 기존 흐름 (계획의 10개 + 확인용)

실행 명령: 묶음 1 `--only basic-off,noexec,vote-count,will-flow,result` / 묶음 2 `--only politics-pin,politics-verdict,ghost,sound-script,emcee-leak` / 고친 뒤 `--only noexec` 와 `--only politics-verdict,sound-script,day` / 확인용 `--only emcee-band,emcee-tools`. `--only` 는 부분 일치라 묶음 1 은 will-flow-sizes·result-reveal·result-rematch·sound-result 도, `result` 는 그것들도 함께 돌았다(아래 표에 포함).

| 흐름 | 크기 | 첫 실행 | 조치 | 최종 |
|------|------|---------|------|------|
| basic-off | 390x844 | 10/10 | 없음 | 통과 |
| noexec | 390x844 | 33/35 (NE2 둘) | 기대 수정(아래 표) | 35/35 통과 |
| vote-count | 390x844 | 22/22 | 없음 | 통과 |
| will-flow | 390x844 | 18/18 | 없음 | 통과 |
| will-flow-sizes | 6종 | 각 11/11 | 없음 | 통과 |
| result | 390x844 | 27/27 | 없음 | 통과 |
| result-reveal | 6종 | 각 34/34 | 없음 | 통과 |
| result-rematch | 360x560 | 19/19 | 없음 | 통과 |
| sound-result | 390x844 | 16/16 | 없음 | 통과 |
| politics-pin | 6종 | 14·13·13·14·13·13 모두 통과 | 없음 | 통과 |
| politics-verdict | 6종 | 각 0/1 (S4 단계 도달, 재시도 4×6) | 기대 수정 | 각 25/25 통과 |
| ghost | 6종 | 92·71·71·85·72·70 모두 통과 | 없음 | 통과 |
| sound-script | 390x844 | 32/34 (SC8·SC9) | 기대 수정 | 34/34 통과 |
| emcee-leak | 390x844 | 26/26 | 없음 | 통과 |
| day | 6종 | (고치기 전 실행하지 않음) | 예방 수정 후 실행 | 각 90/90 통과 |
| emcee-band | 6종 | 각 63/63 | host.mjs 수정(keyword·ended 정답 예외) 뒤 확인 | 통과 |
| emcee-tools | 390x844 | 17/17 | 없음 | 통과 |

간헐 재시도는 모두 위 politics-verdict 의 실제 기대 불일치였다(운에 의한 재통과 없음). 폰 6종 흐름 묶음 부하 간헐은 이번엔 관찰되지 않았다.

### 고친 기대와 근거 (T-23-45)

| 흐름·항목 | 이전 기대 | 이후 기대 | 근거 |
|-----------|-----------|-----------|------|
| noexec NE2 | "처형 없음" 큰 글 뒤 곧바로 밤(4초) | 큰 글 → 정답 공개(answerReveal) → 밤(9초), 지난 단계에 answerReveal 이 night 앞에 있다 | D-22: 첫날 처형 없음 알림 자리는 answerReveal 진입(큰 글 1.4초 + 정답 3초) |
| politics-verdict 처형 끝 | 처형 뒤 `night` 를 2.5초 안에 | `execution` 을 떠남(첫날 answerReveal·그 밖 night) | 처형 시간표 판정(executionTimelineChecks)은 night 에 의존하지 않고 첫 비-execution 기록을 끝으로 본다. 판정 문턱은 그대로 |
| sound-script SC9 | [찬성] 뒤 7.2초 기다린 마지막 5초 timer.tick | 마감 2.4초 전까지 틱을 먼저 읽고 그 뒤 [찬성](SC7) | D-11/D-25: 산 사람 전원이 던지면 1.5초로 마감이 줄어 SC9 구간이 사라지고, 같은 이유로 SC8(지목 진입)도 앞당겨 어긋났다. 판정 항목·문턱은 그대로, 순서만 바꿈 |
| day 처형 뒤 밤 | 서버 타이머 9초 | 14초 | 처형 6.6초 + 정답 공개 3초 = 9.6초가 9초를 넘음(예방 수정, 고치기 전 실행은 하지 않음) |
| bots.test.ts | 허용 단계에 keyword·answerReveal 없음 | 둘 추가, nomination 다음에 answerReveal 허용 | 23-01·05·06 이월 메모 |

## uat-test-room (로컬 한 번)

`node scripts/uat-test-room.mjs http://localhost:5173` → 39/39 통과, UAT TEST-ROOM OK. 새 순서 roleReveal → keyword → dayAnnounce → discussion → verdict → answerReveal → night → morning → dayAnnounce 와 키워드 검사 셋(모든 소켓 `day.keyword.genre` 같음, 마피아 소켓 `me.keyword` 키 없음·프레임 원문에 키워드 없음) + 금지어 BAD_MESSAGE·첫날 답 목록·정답 공개 뒤 공개 값을 본다. 전이 표는 smoke.mjs 와 같고 e2eContract 가 두 표를 대조한다(정규식 → 표 파싱으로 바꿈).

## 실행한 verify

- `node --test scripts/e2e/keyword.test.mjs scripts/e2e/*.test.mjs` 통과, 전체 `node --test scripts/*.test.mjs scripts/e2e/*.test.mjs` 654 pass / 0 fail.
- `npx vitest run test/unit/e2eContract.test.ts` 87 passed(사본 상수 여덟 + uat 전이 표 대조 포함).
- `npx vitest run test/worker/bots.test.ts` 26 passed.
- `npm run typecheck` 종료 0, `error TS` 0.
- `npx vitest run`(전체) 7527 passed · 1 failed(아래 Deferred) · 238 skipped.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] 첫날 토론 자동 열림 시트가 기존 흐름의 단추를 가림**
- **Found during:** Task 2 (keyword 두 번째 판 skipTo)
- **Issue:** `skipTo(…, "discussion")` 로 첫날 토론에 닿으면 모두의 답 시트가 저절로 열려(P23-8, 앱 정상 동작) 테스트 시트 닫기·찬반 단추를 가린다 — 첫날 토론을 거치는 모든 기존 흐름이 같은 문제를 가진다.
- **Fix:** 앱은 그대로 두고 하네스 init 스크립트 `dismissAnswerSheetInit`(browser.mjs, openHostPage 에서 모든 페이지에 넣음)이 `window.__kwWatch` 가 없는 페이지에서만 그 시트를 닫는다. 키워드 흐름은 `__kwWatch` 가 있어 시트가 열린 채로 KW8·KW9·KW10 을 검사한다.
- **Files modified:** scripts/e2e/browser.mjs
- **Commit:** f47198b6

**2. [Rule 1 - Bug] KW13 판정 오판**
- **Found during:** Task 2 첫 실행
- **Issue:** 마피아 전용 기존 me 키(allies·records)를 키워드 차이로 셌고, 시민 대조군을 키워드 단계 밖에서 잡으려 했다.
- **Fix:** kw13Leak 에 `roleMe`(기존 역할 키) 허용과 키워드 단계 시작 때 두 페이지를 다시 연결해 그 연결의 프레임을 세는 방식으로 바꿈, 단위 시험 추가.
- **Commit:** f47198b6

**3. [Rule 2 - 계획 문구와 다른 선택] keyword 흐름에서 방장도 답을 낸다**
- 계획은 방장이 쓰던 글만 두고 시간이 끝나게 하라 했지만, 방장도 다른 글을 내서 사람 전원 제출 → 조기 진행으로 이어지게 했다(두 사람이 낸 순서 ①②·봇 둘 '답 없음'을 한 번에 본다). 시간 끝(마감 700ms 전 초안 전송) 경로의 E2E 는 없다.

**4. [범위 확장] host.mjs·lib.mjs**
- 23-11 이월: `hostBandChecks` 에 `answer` 옵션을 더해 ended 에서 정답이 공개된 판은 띠 보임·한 줄을 기대하게 했다(HOST_OFF_PHASES 는 그대로). emcee-band 6종 통과로 확인.

기타: `--only keyword` 는 keyword-sizes 도 고르는 부분 일치라 단독 실행에 `--only keyword_` 를 썼다(결과 동일 흐름).

## Deferred Issues

- `test/worker/basicDay.test.ts`("토론 끝내기 과반 → 찬반 → 순차 지목 → 변론 → 처형 → 밤")가 간헐 실패한다 — 처형당한 a3 의 직업이 무작위라 마피아면 곧장 `ended` 가 되어 `night` 기대가 어긋난다(2회 단독 실행 중 1회 통과·1회 실패, 전체 실행 1회 실패). 이 계획의 변경과 무관한 기존 직업 무작위 간헐이고 고치지 않았다(범위 밖).
- 마감 시간 끝(쓰던 글 자동 확정) 경로, 정답 공개 단계 중 새로고침은 E2E 로 보지 않았다.

## Known Stubs

없음.

## Threat Flags

없음 — 새 네트워크·인증·파일 접근면 없음. T-23-43(KW3·KW13 이 마피아 DOM 원문·속성·프레임에 정답 없음을 실제 브라우저로 확인 — 통과), T-23-44(모든 실행에 로컬 주소, 배포·원격 D1 없음), T-23-45(고친 기대의 이전·이후를 위 표에 기록), T-23-SC(패키지 설치 없음).

## Self-Check: PASSED

- 파일 존재: scripts/e2e/keyword.mjs, scripts/e2e/keyword.test.mjs — 확인.
- 커밋 존재(`git merge-base --is-ancestor`): 47143add, 79d90a20, f47198b6, 87818320 — 확인. `commits: 4` 는 `git rev-list --count 62d0dc26..HEAD` 측정값(이 SUMMARY 커밋 제외).
- 수용 기준: `grep -c 'export function' scripts/e2e/keyword.mjs` 15(≥13), `EARLY_GRACE_MS_COPY`·`"keyword"` 가 e2eContract·host.mjs 에 있음, flows.mjs 에 keyword·keyword-sizes·early 등록, uat-test-room 에 keyword·answerReveal 있음.
