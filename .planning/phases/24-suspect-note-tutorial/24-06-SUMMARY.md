---
phase: 24-suspect-note-tutorial
plan: "06"
subsystem: records-card-ui
tags: [rolecard, records-tab, suspect-log, e2e-harness, rename]
status: complete
requires: ["24-01"]
provides:
  - "RoleCardTab 'records'(라벨 '답과 의심'), 선택 시 시트 제목 '모두의 기록'"
  - "RecordsPanel: section.mf-answers__day[data-log-day], ul[data-suspect-list] > li[data-suspect-row][data-suspect-from][data-suspect-to]"
  - "browser.mjs dismissAnswerSheetInit 가 '모두의 기록'·'모두의 답' 두 제목을 모두 닫음"
affects: [24-10, 24-11]
actuals:
  tokens: 9000
  tasks: 2
  commits: 3
plan_head_before: d47891e7c04cbc57e63a1ae869fc3d5903b7a97a
plan_head_after: ba6720970bc6169d2596f679bc24b0ad7714b3f2
tech-stack:
  added: []
  patterns:
    - "일차 구역 배열: 첫날 답 구역 + suspectLogByDay 구역을 일차 내림차순으로 합친다. 첫날 구역 표식(data-answer-*)은 그대로"
    - "표식 이름은 꺼진 장치 접두(data-record*)를 피해 data-log-day (D-27)"
key-files:
  created: []
  modified:
    - src/components/RoleCardSheet.tsx
    - src/screens/RoomScreen.tsx
    - src/styles/rolecard.css
    - test/client/roleCardSheet.test.tsx
    - test/client/roomScreen.test.tsx
    - test/client/journal.test.tsx
    - scripts/e2e/keyword.mjs
    - scripts/e2e/browser.mjs
    - docs/screen-map.md
decisions:
  - "구역 머리 sticky 때문에 .mf-answers__head 에 면 night-800(시트 면과 같음)·z-index 1 을 줬다 — 아래 줄이 비쳐 보이지 않게"
  - "의심 줄의 두 닉네임은 flex 1 1 0 으로 남는 폭을 반씩 나눠 각각 한 줄 말줄임, 접근성 이름은 줄(li)의 aria-label 전체"
requirements-completed: [SC1]
metrics:
  duration: "약 25분"
  completed: 2026-11-17
---

# Phase 24 Plan 06: 기록 카드 "답과 의심" Summary

역할 카드 시트의 "첫날 답" 탭을 일차별 기록 탭("답과 의심", `data-rolecard-tab="records"`)으로 일반화했다. 본문은 일차 구역을 최신 일차가 위로 쌓고(머리 줄은 스크롤 중 위에 붙음), 첫날 구역은 23 의 답 목록 그대로, 둘째 날 이후 구역은 의심 줄(붙인 → 받은) 목록이다. 탭을 고르면 시트 제목은 "모두의 기록"이다.

## 한 일

**Task 1 — RecordsPanel (커밋 b7245fd4 RED → 5deb9279 GREEN)**
- RED: 시험의 탭 키·라벨·제목 기대를 새 값으로 바꾸고, 구역 순서·줄 수·접근성 이름·내 줄·답+의심 혼합·빈 일차·8줄·XSS 텍스트 노드·`data-record*` 속성 부재·CSS(sticky·말줄임·내 줄 night-700) 단언과 roomScreen 의 "둘째 날 의심 기록이 있어도 자동으로 열리지 않음" 을 더했다. 24건 실패를 확인하고 커밋(타입 검사는 RED 쪽 `"records"` 가 유니온에 없어 깨지지 않도록 시험 한 곳만 `as RoleCardTab` 캐스트로 두었다가 GREEN 에서 제거).
- GREEN(한 커밋): `RoleCardTab` 유니온 개명이 typecheck 로 RoomScreen·시험을 묶기 때문에 한 커밋이다. 탭 존재 조건 = 첫날 답 또는 `view.day.suspectLog` 줄이 하나라도 있음. `AnswersPanel` → `RecordsPanel`(`suspectLogByDay(view)` 사용). 의심 줄은 좌석 점 12 + 닉네임 → chevronRight 16 → 좌석 점 12 + 닉네임, 내가 붙인 줄은 면 night-700·이름 "내가 붙인 의심", 그 밖은 "{붙인}님이 {받은}님에게 의심". 의심 없는 일차는 구역·빈 문구 없음. 처음 열 때 scrollTop 0. RoomScreen 자동 열림 키 `records`(조건 그대로 — 첫날만).

**Task 2 — E2E 사본·하네스 (커밋 ba672097, 별도)**
- `browser.mjs` `dismissAnswerSheetInit`: 선택자가 `"모두의 기록"` 과 `"모두의 답"` 두 제목을 모두 닫는다(`__kwWatch` 예외 유지).
- `keyword.mjs`: `data-rolecard-tab` 값 `answers` → `records`(3곳 + 개수 읽기 1곳), 라벨·주석 "첫날 답" → "답과 의심". `data-answer-list`·`data-answer-row` 읽기는 첫날 구역 안에 그대로 남아 변경 없음.
- `docs/screen-map.md`: RESEARCH P5 목록의 문서 항목(탭 표식 개명, 새 표식 지도, 시트 제목). 

## 검증 (실제로 돌린 것)
- `npx vitest run test/client/roleCardSheet.test.tsx test/client/roomScreen.test.tsx test/client/journal.test.tsx` — 3 파일 182 통과.
- `npx vitest run --project client`(GREEN 직전) — 1 실패(journal, 아래 편차 1)를 고친 뒤 위 3 파일 재실행 통과. 고친 뒤 client 전체를 다시 돌리지는 않았다(바뀐 범위는 위 세 파일로 한정, 웨이브 끝 전체 회귀는 오케스트레이터/24-10).
- `npm run typecheck` 초록(GREEN 커밋 시점·최종).
- `node --test scripts/e2e/keyword.test.mjs scripts/e2e/lib.test.mjs` — 405 통과, 0 실패.
- 수용 기준 grep: `"records"` 4, `data-log-day` 2, `suspectLogByDay(` 1, `tab: "records"`(RoomScreen) 1, `data-record`(RoleCardSheet) 0, browser.mjs `모두의 기록` 4·`모두의 답` 3, keyword.mjs `data-rolecard-tab="answers"` 0.
- 위생 grep(`git grep` 위생 패턴) 바뀐 파일 전부 결과 없음.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] journal 시험의 `text-overflow` 전역 금지가 의심 줄 말줄임과 충돌**
- **Found during:** Task 1 GREEN, `npx vitest run --project client`
- **Issue:** `test/client/journal.test.tsx` 가 `rolecard.css` 전체에 `text-overflow` 가 없어야 한다고 단언한다(일지 이름 칸용). 계획이 요구한 의심 줄 닉네임 말줄임을 같은 파일에 넣으면 실패한다.
- **Fix:** 단언을 일지 규칙(선택자에 `mf-journal` 이 든 규칙)의 본문에만 걸도록 한정했다. 일지 쪽 금지는 그대로 검사된다.
- **Files modified:** test/client/journal.test.tsx
- **Commit:** 5deb9279

**2. [Rule 2/계획 목록 보충] `docs/screen-map.md` 개명 반영**
- 계획 `files_modified` 에는 없지만 RESEARCH P5 개명 영향 목록(문서 항목)과 지시("목록 전부 고친다")에 따라 E2E 사본 커밋(ba672097)에서 고쳤다. `scripts/uat-test-room.mjs` 의 "첫날 답" 은 데이터 설명이라 계획대로 그대로 뒀다. `scripts/e2e/flows.mjs` 의 "모두의 답" 은 기능 이름을 가리키는 주석뿐이라 그대로.

## Known Stubs
없음.

## Threat Flags
없음. 닉네임은 텍스트 노드·aria-label 값으로만 쓰고(T-24-16, 시험으로 확인), 새 표식 이름은 `data-record*` 접두와 부딪히지 않는다(T-24-18, 시험 + grep 0).

## 돌리지 못한 것 · 이월
- **브라우저 E2E(keyword·basic-off 부분 회귀)와 360×560 실제 스크롤·탭·[닫기] 가림 확인**: 계획대로 24-10 이 한다(must_haves 의 backstop 항목). 이 계획에서는 jsdom 시험·CSS 단언까지만 했다.
- **24-11 로 넘김**: UI-SPEC 문서의 구역 표식 이름을 `data-record-day` → `data-log-day` 로 정정(D-27).
- **이월 메모(표식·이름)**: 구역 `section[data-log-day=n]`(첫날 답 구역은 `data-answer-day=1` 도 함께), 의심 목록 `ul[data-suspect-list]`, 줄 `li[data-suspect-row][data-suspect-from][data-suspect-to]`, 탭 `data-rolecard-tab="records"`, 시트 제목·`aria-label` "모두의 기록"(탭 선택 시만, 아니면 "역할 카드"). E2E 에서 시트를 닫는 코드는 두 제목을 모두 다뤄야 한다.
- 시트 높이·스크롤의 눈 확인(실기기)은 결정에 따라 끝에 몰아서 한다.

## Self-Check: PASSED
- 커밋 존재: b7245fd4, 5deb9279, ba672097 (`git merge-base --is-ancestor` 확인).
- 파일 존재: RoleCardSheet.tsx 의 `RecordsPanel`, rolecard.css `.mf-suspect__*`, browser.mjs 두 제목 선택자.
