---
phase: 22-cleanup-single-mode
plan: "13"
subsystem: e2e, scene, smoke
tags: [e2e, vote-count, will-flow, new-day-order, p22-3, execution-timeline, smoke]
requires:
  - phase: 22-12
    provides: 처형 6.6초 시간표, 유언 공개 카드, 기록 삭제
provides:
  - 새 낮 순서(토론 → 찬반 → 지목 → 유언 → 처형 → 밤)를 기대하는 로컬 E2E 흐름 전체
  - 새 흐름 vote-count · will-flow · will-flow-sizes(scripts/e2e/day.mjs, 순수 판정 + 단위 시험)
  - 찬반 장면 = 토론 장면 그대로(P22-3)
  - smoke full 의 새 낮 순서 단언
affects: [22-14]
tech-stack:
  added: []
  patterns:
    - "새 흐름 판정은 day.mjs 의 순수 함수 + day.test.mjs 단위 시험, 흐름은 읽고 부르기만 한다"
    - "순차 지목은 pickOnTurn(자기 차례를 기다려 이름표를 누름)으로 E2E 가 구동한다"
key-files:
  created:
    - scripts/e2e/day.mjs
    - scripts/e2e/day.test.mjs
  modified:
    - scripts/e2e/flows.mjs
    - scripts/e2e/lib.mjs
    - scripts/e2e/lib.test.mjs
    - scripts/e2e/browser.mjs
    - scripts/e2e/politics.mjs
    - scripts/e2e/sound.mjs
    - scripts/e2e/host.mjs
    - scripts/e2e/avatar.mjs
    - scripts/e2e/mapselect.mjs
    - scripts/e2e/polish.mjs
    - scripts/e2e/polish.test.mjs
    - scripts/smoke.mjs
    - scripts/bots.mjs
    - scripts/gallery.mjs
    - src/world/presence.ts
    - src/game/scenes.ts
    - src/game/dayView.ts
    - src/components/v2/HeadStack.tsx
    - src/net/chatStore.ts
  deleted:
    - src/components/v2/SureStamp.tsx
decisions:
  - "P22-3: 찬반 장면을 토론 장면 그대로 — FIXED_PHASES 에서 verdict 제거(따라가기 카메라), lightingOf verdict → talk, PHASE_SCENE verdict → day. 헤더 시간대 낱말은 lightingOf 에서 파생이라 '낮 · 찬반' 이 된다(UI-SPEC 단계 표)."
  - "verdict.reject 소리: 삭제하지 않고 남긴다. 레시피·문서 행·사운드랩 항목·소리 개수(54) 계약이 시험에 묶여 있고(soundProtocol·docs/audio.md), 찬반 부결 → '처형 없음' 큰 글 알림음 후보로 24 의 연출 정리에서 다시 정한다. 지금은 어떤 단계도 내지 않으며 E2E V4 가 '처형 없는 판에 verdict.*·ballot.*·execution.* 소리 0건' 으로 고정한다."
  - "CARD_HOLD_EXEC_MS: 2.4초 → WILL_REVEAL_MS(3.0초)로 맞춘다. 유언 공개 카드가 3.0초 서 있는 동안 같은 글이 채팅 기록에 먼저 나타나지 않게 하기 위해서다(UI-SPEC 은 '지금 그대로' 라고만 했으나 옛 2.4초는 처형 알림 2.4초 시절의 값)."
  - "basic-vote: 8명 동시 투표 화면은 순차 지목에서 뜻이 없고 politics-pin 은 핀 조명만 본다 — '내 차례 이름표 7개 44×44·무가림' 판정으로 바꿨다(지우지 않음)."
  - "politics-badge·whisper·runoff·showdown 계열 6흐름은 켜지지 않은 장치(RULES false)의 흐름이라 skipByDefault 그대로 두고 새 순서로 고치지 않았다 — 그 장치를 다시 켜는 판이 생길 때 고친다."
  - "SureStamp·HeadStack sure/sureLabel·pointsTally.sure 는 지웠다(렌더 경로 없음). VoteBadge lead·.mv-stamp CSS·tagOrder lead·WorldStage data-lead 는 결선·결전(켜짐 대기 코드)과 디자인 토큰 시험(tokensV2)에 묶여 남겼다."
metrics:
  tasks: 3
  files-touched: 36
status: complete
actuals:
  tokens: 80000
  tasks: 3
  commits: 5
plan_head_before: 2d5c66db6977edd0de1caf00928d405d6260dae1
plan_head_after: 693dea3b1278fb05c0468c904e9a9d743b53b88e
commits: 5
---

# Phase 22 Plan 13: 바뀐 낮 흐름 로컬 E2E Summary

E2E 흐름의 낮 순서 기대를 토론 → 찬반 → 지목 → 유언 → 처형 → 밤으로 모두 고치고, 새 흐름 vote-count·will-flow·will-flow-sizes(처형자 시트의 폰 6종 기하·키보드 K 336)를 만들어 바뀐 11개 흐름을 로컬에서 모두 통과시켰다. 22-10~12 가 넘긴 P22-3(찬반 장면 = 토론 장면 그대로)과 smoke·소스 잔재를 함께 정리했다.

`commits: 5` 는 `git rev-list --count 2d5c66db..HEAD` 로 잰 값이다(이 SUMMARY 문서 커밋은 세지 않았다). 이 계획은 plan-head 장부를 만들지 못해 기준 커밋은 22-12 SUMMARY 커밋(`2d5c66db`)이다. 

## 커밋

| 커밋 | 종류 | 내용 |
|------|------|------|
| 58edabfe | fix | P22-3 — presence FIXED_PHASES·lightingOf·PHASE_SCENE, 카메라·조명·시간대 시험 15건 기대 갱신 |
| a5a7fb4f | test | E2E 기대값 새 낮 순서 + vote-count·will-flow·will-flow-sizes + 순수 판정·단위 시험 |
| 127abe8d | test | smoke full·봇·갤러리 새 낮 순서 |
| c55df19f | fix | 처형 단계 채팅 카드 보류 3.0초(CARD_HOLD_EXEC_MS) |
| 693dea3b | refactor | SureStamp·HeadStack sure·pointsTally.sure 삭제 |

작업 1·2(기존 흐름 기대값 / 새 흐름)는 `flows.mjs`·`lib.mjs` 가 서로 얽혀 한 커밋으로 묶었고, 작업 3 의 실행 기록은 이 SUMMARY 한 개다(소스 수정은 위 fix 커밋으로 따로 냄).

## E2E 실행 결과 (로컬 `http://localhost:5173`, dev 서버를 이 계획에서 다시 띄움)

플랜의 `--only basic-off,day,noexec,politics-pin,politics-verdict,vote-count,will-flow,ghost,sound-script,emcee-leak,result` 는 `--only` 부분 일치 때문에 `will-flow-sizes`·`result-reveal`·`result-rematch`·`sound-result` 도 함께 고른다(모두 바뀐 흐름이라 그대로 돌렸다). 두 번에 나눠 돌렸고 둘 다 `E2E OK`, 재시도 0.

**실행 1** — `--only basic-off,noexec,vote-count,will-flow,sound-script,emcee-leak,result` (209초)

| 흐름 | 크기 | 결과 | 재시도 |
|------|------|------|--------|
| basic-off | 390x844 | 10/10 통과 | 0 |
| noexec | 390x844 | 35/35 통과 | 0 |
| vote-count | 390x844 | 22/22 통과 | 0 |
| will-flow | 390x844 | 18/18 통과 | 0 |
| will-flow-sizes | 360x640 · 390x664 · 430x932 · 360x560 · 390x844 · 402x874 | 각 11/11 통과(6종) | 0 |
| sound-script | 390x844 | 34/34 통과 | 0 |
| emcee-leak | 390x844 | 26/26 통과 | 0 |
| result | 390x844 | 27/27 통과 | 0 |
| result-reveal | 6종 | 각 34/34 통과 | 0 |
| result-rematch | 360x560 | 19/19 통과 | 0 |
| sound-result | 390x844 | 16/16 통과 | 0 |

**실행 2** — `--only day,ghost,politics-pin,politics-verdict` (기본 4크기 + 추가 2종, 349초)

| 흐름 | 크기 | 결과 | 재시도 |
|------|------|------|--------|
| day | 360x640 · 390x664 · 430x932 · 360x560 · 390x844 · 402x874 | 각 90/90 통과 | 0 |
| ghost | 360x640 72/72 · 430x932 90/90 · 390x664 47/47 · 402x874 90/90 · 360x560 62/62 · 390x844 | 통과(아래 참고) | 0 |
| politics-pin | 6종 | 13~14 통과 / 전부 통과 | 0 |
| politics-verdict | 6종 | 각 25/25 통과 | 0 |

- ghost 의 항목 수가 크기마다 47~90 으로 다른 것은 다음 날 단계 순회(C3)가 거치는 단계 수가 판마다 달라서다(순차 지목에서 자기 차례에 지목이 늦으면 순회가 짧아진다). 모든 크기에서 실패 항목은 0 이다.
- 개발 중 `ghost` 가 390x664 에서 GH13(유령 이름표 대비 4.5:1 — 한 이름표가 1.19:1)로 한 번 실패했고 같은 설정에서 두 번째 실행은 통과했다. 최종 두 실행에서는 나오지 않았다. 알려진 부하 불안정 군(UI#14 가장자리 이름표)으로 보고 회귀로 세지 않았다.
- 폰 6종 전체 회귀·배포는 24 끝의 몫이라 이 계획에서 하지 않았다(`day`·`ghost`·`politics-*` 는 바뀐 흐름이라 6종으로 돌렸다).

## 검증 결과 (실제로 돌린 것)

- `node --test scripts/*.test.mjs scripts/e2e/*.test.mjs` 622/622 통과(day.test.mjs 14건·lib.test.mjs 새 판정 포함).
- `npx vitest run`(전체) 238 파일 통과·5 건너뜀, 7190 통과·238 건너뜀·실패 0.
- `npm run typecheck` 오류 0.
- `node scripts/smoke.mjs http://localhost:5173`(create) 통과, `--stage full --players 5` 통과(2일차 citizenWin).
- 인수 grep: `politics-pin ... skipByDefault: true` 0건 · `BALLOT|ballot-side|data-ballots`(0건 표기 줄 제외) 0 · `data-will-reveal`(politics·lib) 1 이상 · 새 흐름 id `vote-count|will-flow` 등록 · `data-chat-locked`·`말없이 떠났어요` 가 scripts/e2e 에 있음.
- 커밋 전 규칙 패턴 grep(변경 파일): 결과 없음.

## 이월 항목 처리

| 이월 | 처리 |
|------|------|
| P22-3 찬반 장면 | 소스 + 시험 15건 + lib.mjs/polish.mjs 사본 정리 완료 |
| sure·SureStamp·VoteBadge·lead 배관 | SureStamp·HeadStack sure·pointsTally.sure 삭제. VoteBadge lead·tagOrder lead·WorldStage data-lead·`.mv-stamp` CSS 는 남김(위 결정) |
| smoke.mjs 낮 흐름 | 걸음을 새 순서로 다시 씀(찬반 번복·순차 지목·유언·처형), voteLog·ballots·day.verdict 부재, PUBLIC_KEY_PATHS turn, chatLog 유언 카드만. 로컬 full 통과 |
| scripts/e2e 잔재 | VERDICT_TIMING announceAt 3000·V4 verdict.reject(→ 처형 없는 판 소리 0건)·`ballot.*`·measureBallotsBackstop·EX3b·BF 판정·`waitSysLine` 삭제, 정치 흐름·polish·avatar·mapselect·host·sound 정리 |
| orphan verdict.reject | 유지(위 결정) |
| CARD_HOLD_EXEC_MS | 3.0초로 맞춤(위 결정) |

## Deviations from Plan

### 자동 수정·추가

**1. [Rule 3 - 묶음] 작업 1·2 를 한 커밋으로** — `flows.mjs`·`lib.mjs` 에 두 작업의 변경이 섞여 따로 커밋하면 중간 커밋이 깨진다.

**2. [Rule 2 - 연쇄 수정] 계획 files_modified 밖 파일**
- `scripts/e2e/avatar.mjs`·`mapselect.mjs`·`polish.mjs`·`polish.test.mjs`: 찬반 → 지목 → 유언 순서 구동, 유언 단계 몸동작 막힘(AP3a 0건), 시간대 사본.
- `scripts/smoke.mjs`·`bots.mjs`·`gallery.mjs`: 이월 항목.
- `test/unit/scenes.test.ts`·`e2eContract.test.ts`(상수 사본 대조 추가 포함)·`test/client/*`·`test/unit/presence/timeOfDay/dayView`: P22-3·SureStamp 삭제에 따른 기대 갱신.
- `src/game/dayView.ts`·`HeadStack.tsx`·`chatStore.ts`: 위 결정.

**3. [Rule 1] OFF 판정 모양 변경** — 순차 지목(`data-turn*`·`day.turn`)이 기본 규칙이 되어 꺼진 장치 표에서 뺐다. 대신 UI-SPEC "지우는 화면" 표의 선택자(판 종류·튜토리얼·확장판·기록·시상)와 키(`view.mode`·`day.ballots`·`phase errand|tutorial`·`result.awards`)를 더했다.

**4. [Rule 2] emcee-leak 보강** — 계획 문구(P22-11)의 "처형·유언 view 키 집합 동일·시트가 처형자 DOM 에만"을 `willLeakChecks`(LK-W1·LK-W2)로 새로 넣었다(기존 흐름은 단계 키 사본만 대조).

**5. will-flow 를 둘로** — 계획은 will-flow 한 흐름에 폰 6종 (d)를 넣으라 했으나 (a)~(c)는 사람 손님이 필요하고 (d)는 폰 6종을 도는 한 페이지짜리라 `will-flow`(390x844)와 `will-flow-sizes`(6종) 둘로 나눴다. `--only will-flow` 가 둘 다 고른다.

### 인증 게이트

없음.

## 돌리지 못한 검증

- 배포본(원격) E2E·smoke 와 폰 6종 전체 회귀는 계획대로 24 끝으로 미뤘다.
- 실기기 키보드 검사는 하지 않았다: P22-8 의 키보드 올림은 `visualViewport` 가짜(앱 배치 식만 검사)로 K 336 을 흉내 냈다.
- skipByDefault 정치 흐름 6개(badge·whisper·runoff·runoff-tie·showdown·showdown-tie)는 새 순서로 고치지도 돌리지도 않았다(꺼진 장치).
- 알려진 한계: ghost 흐름의 다음 날 단계 순회는 사람 손님이 자기 차례에 지목하는 시간에 의존해 판마다 거치는 단계 수가 다르다(실패는 없음). 6종 전체 회귀 때 더 안정화할지 본다.

## Known Stubs

없음.

## Threat Flags

없음 — 새 E2E 표식은 이미 UI-SPEC 표식 표에 있던 것(`data-verdict-count`·`data-will-*`·`data-chat-locked`)이고 값에 역할·좌석 비밀이 없다. T-22-29 는 emcee-leak 의 LK-W1·LK-W2(역할 다섯 시점 동일, 시트 처형자 DOM 에만)로 닫았다.

## Self-Check: PASSED

- 만든 파일 존재: `scripts/e2e/day.mjs`, `scripts/e2e/day.test.mjs` 있음, `src/components/v2/SureStamp.tsx` 없음(삭제).
- 커밋 존재: 58edabfe, a5a7fb4f, 127abe8d, c55df19f, 693dea3b 모두 HEAD 의 조상.
