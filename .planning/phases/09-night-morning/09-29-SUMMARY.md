---
phase: 09-night-morning
plan: "29"
subsystem: client-result-screen
tags: [gap-closure, result, layout, e2e, feedback-6]
status: complete

requires:
  - phase: 09-night-morning
    provides: 결과 화면(ResultScreen) 공개 연출, 09-27 이 고친 E2E 측정 도우미
provides:
  - 결과 화면 [처음으로] 줄 아래 고정 + 위 영역(.mf-result__body)만 스크롤
  - scripts/e2e resultFitChecks(RS-FIT)·readResultFit — 폰 6종 크기별 측정
affects: [09-30, 11]

key-files:
  modified:
    - src/screens/ResultScreen.tsx
    - src/styles/result.css
    - test/client/resultScreen.test.tsx
    - scripts/e2e/lib.mjs
    - scripts/e2e/lib.test.mjs
    - scripts/e2e/browser.mjs
    - scripts/e2e/flows.mjs

decisions:
  - "결과 화면은 .mf-result 가 스크롤하지 않고(overflow hidden) .mf-result__inner(height 100% flex column) 안에서 .mf-result__body 만 스크롤, footer 는 flex none 으로 아래 고정. 아래 여백(24 + safe-area)은 footer 가 가진다"
  - "시각 값(색·글자·카드 크기)은 그대로. 작은 폰 카드 축소는 하지 않음(11페이즈가 결과 화면을 다시 만든다)"

metrics:
  tasks: 2
  commits: 4
  completed: 2026-11-04

actuals:
  tokens: 14000
  tasks: 2
  commits: 4
plan_head_before: 5c06cc12451aa575b805b95b64c175a2d856f642
plan_head_after: 93410c257a4ca71c9c56f6529196a31210572c32
---

# Phase 9 Plan 29: 결과 화면 [처음으로] 아래 고정 Summary

게임이 끝난 결과 화면에서 [처음으로] 와 보조 문구를 화면 아래에 고정하고, 제목·배너·직업 카드·판 요약은 그 위 영역 안에서만 스크롤하게 바꿨다. 폰 6종 로컬 E2E 로 버튼이 스크롤 없이 화면 안에 있고 눌리는 것을 확인했다.

## 한 일

- Task 1 (`398aaa6` RED, `0293359` GREEN): ResultScreen 마크업에 `div.mf-result__body`(head·banner·grid·summary)를 더하고 footer 는 inner 의 마지막 자식으로 뒀다. result.css 는 `.mf-result` overflow hidden, `.mf-result__inner` height 100% flex column, `.mf-result__body` flex 1 1 0·min-height 0·overflow-y auto·overflow-x hidden·overscroll-behavior contain, `.mf-result__foot` flex none + 아래 여백 24 + safe-area.
- Task 2 (`4db3577` RED, `93410c2` GREEN): lib.mjs `resultFitChecks`(RS-FIT), browser.mjs `readResultFit`, flows.mjs resultFlow 가 각 판 결과 확인 뒤 LOBBY_SIZES 6종으로 뷰포트를 바꿔 가며 잰 뒤 원래 크기로 되돌린다.

## 시험 결과

- `npx vitest run test/client/resultScreen.test.tsx test/client/screens.test.tsx test/unit/e2eContract.test.ts` 초록
- `node --test scripts/e2e/lib.test.mjs` 155 통과 / 0 실패
- 로컬 `npm run e2e -- --url http://localhost:5173 --only result` → **E2E OK, 22/22**. RS-FIT 는 폰 6종 x 두 판 = 12개 모두 통과:

| 크기 | 시민 승 | 마피아 승 |
|------|---------|-----------|
| 360x640 | 통과 | 통과 |
| 390x664 | 통과 | 통과 |
| 430x932 | 통과 | 통과 |
| 360x560 | 통과 | 통과 |
| 390x844 | 통과 | 통과 |
| 402x874 | 통과 | 통과 |

개발 서버는 끝난 뒤 껐다(5173 응답 없음 확인).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - 기존 시험 갱신] 옛 레이아웃을 고정하던 정적 단언 두 개**
- **Found during:** Task 1 RED
- **Issue:** `result.css 정적 단언` 의 "스크롤 본문: .mf-result overflow-y auto" 와 "inner padding 아래 24 + safe-area" 가 새 구조와 충돌
- **Fix:** 각각 ".mf-result hidden + .mf-result__body 스크롤" 과 ".mf-result__foot padding-bottom 24 + safe-area" 로 바꿨다(RED 커밋에 포함). 단언 정신(가로 스크롤 없음, 아래 여백)은 유지
- **Files modified:** test/client/resultScreen.test.tsx
- **Commit:** 398aaa6

**2. [Rule 3 - 기록] 커밋 장부 파일 지연 생성**
- plan_head_before 장부를 첫 RED 커밋 직후에 HEAD~1 로 만들었다(값은 정확함: `5c06cc1`). commits 4 는 `rev-list` 로 측정.

그 밖에는 계획대로 실행했다.

## Known Stubs

없음.

## Threat Flags

없음. 배치 변경과 E2E 측정만 있고 데이터·네트워크 표면 변화 없음(T-09-59 는 RS-FIT 로 완화).

## Self-Check: PASSED

- 수정 파일 7개 존재 확인, 커밋 4개 `git log` 로 확인(398aaa6, 0293359, 4db3577, 93410c2)
