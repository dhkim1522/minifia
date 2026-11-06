---
phase: 11-result-rematch
plan: "11"
subsystem: src/game + src/components/v2 + src/screens + scripts/e2e
tags: [result-log-tab, timeline, day-card, day-detail, claims, whisper-jump, tdd, e2e]
requires: [11-03, 11-07, 11-09]
provides: [timelineOf, dayLinesOf, TimelineStrip, TlFace, DayDetail, ResultPanel view·onJumpWhisper·focusDay, timelineChecks(TL1~TL7), readTimeline, TIMELINE_CARD]
affects: [11-12]
tech-stack:
  added: []
  patterns: [기록 탭 내용은 순수 모듈(timelineView)이 공개 값만으로 만든다, 탈락 일차 규칙은 서버 모듈 import 없이 화면 모듈에 다시 쓴다, 귓속말 쌍은 탭 이동 + 그날 구분선으로 몸통만 스크롤]
key-files:
  created:
    - src/game/timelineView.ts
    - src/components/v2/TimelineStrip.tsx
    - src/components/v2/DayDetail.tsx
    - test/unit/timelineView.test.ts
    - test/client/timelineStrip.test.tsx
    - test/client/dayDetail.test.tsx
    - test/helpers/timelineState.ts
  modified:
    - src/components/v2/ResultPanel.tsx
    - src/screens/ResultScreen.tsx
    - src/styles/v2.css
    - test/client/resultPanel.test.tsx
    - test/client/resultScreen.test.tsx
    - test/unit/e2eContract.test.ts
    - scripts/e2e/result.mjs
    - scripts/e2e/result.test.mjs
    - scripts/e2e/flows.mjs
key-decisions:
  - "득표 배지는 VoteBadge 대신 숫자만 그리는 .mf-tl__votes — VoteBadge 의 '표' 단위가 글자라 '숫자 외 보이는 글자 0' 계약과 어긋난다"
  - "거짓 주장(lie) = 주장 ≠ 진짜 직업이고 그 사람이 마피아일 때만. 진홍 점선은 .mf-tl__claim.is-lie 의 칩 윤곽 하나뿐"
  - "마지막 3인 결전 날은 view 가 last 표시를 옮기지 않으므로 '후보가 있고 찬반이 0·0' 으로 처형을 읽는다"
  - "귓속말 쌍 이동은 ResultScreen 의 jumpDay → ResultPanel focusDay 로, 귓속말 탭 몸통의 그날 구분선(data-day)이 맨 위에 오도록 몸통 scrollTop 만 움직인다(scrollIntoView 는 페이지를 밀 수 있어 쓰지 않음)"
requirements-completed: [END-03, END-04]
status: complete
commits: 7
plan_head_before: 2ab4b84db8b024b996c24a2abbc0dfe13cede475
plan_head_after: 74ad6d52bbed05c79cd85454b15e2ceafb39ffb7
actuals:
  tokens: 16000
  tasks: 3
  commits: 7
duration: 10min
completed: 2026-11-05
---

# Phase 11 Plan 11: 기록 타임라인 Summary

결과 화면 기록 탭을 일차 카드 띠(72×112, 낮 얼굴 + 진짜 직업 칩 / 밤 ghost·heal·quiet)와 하루 상세(지목·찬반·주장·말 바꿈·귓속말 쌍·밤)로 채웠고, 보이는 글자는 숫자뿐이며 거짓 주장은 마피아만 진홍 점선이다.

## 한 일

- **Task 1 (tracer)**: `timelineOf` 일차 카드, `dayLinesOf` 지목, `TimelineStrip`, `DayDetail` 지목 줄, ResultPanel 기록 탭 연결(열기 전 DOM 없음). 트레이서 검증: 대상 시험 131개 통과 + typecheck(내 파일 오류 0) 확인 후 확장.
- **Task 2**: 찬반(ballots)·주장(그날 산 사람의 유효 주장, none 제외)·말 바꿈·귓속말 쌍·밤. 탈락 일차 규칙: 처형·밤 사망 모두 그날 낮까지 산 채, 밤 줄의 마피아는 처형된 일차의 밤부터 빠지고 밤 사망자는 그 밤까지 포함.
- **Task 3**: `timelineChecks` TL1~TL7 + `readTimeline`, result-awards 흐름 끝(시상식을 `finishCeremony` 로 넘긴 뒤)에 같은 판으로 기록 탭 판정.

## E2E 결과

`npm run e2e -- --url http://localhost:5193 --only result-awards --sizes 360x560,390x844` (포트 5193 개발 서버, 끝나고 종료):

| 흐름 | 크기 | 통과/전체 |
|------|------|-----------|
| result-awards | 360x560 | 20/20 |
| result-awards | 390x844 | 20/20 |
| result (접두 일치로 함께 돎) | 390x844 | 25/25 |

실패 0. 실측 확인(임시 출력으로 본 뒤 제거): 360x560 확장 패널 392, 390x844 520, 카드 72×112, 첫 카드 pressed, scrollLeft 0, 처형 카드 칩 `mafia` == 서버 직업, 상세 overflow-y auto.

## 대상 시험

`timelineView.test.ts`·`timelineStrip`·`dayDetail`·`resultPanel`·`resultScreen -t "기록 탭"`·`e2eContract`·`tokensV2`·`result.test.mjs`·`lib.test.mjs`(315) 통과. typecheck 는 내 파일 오류 0.

## Deviations from Plan

**1. [Rule 1 - Bug] VoteBadge 대신 숫자 전용 배지** — VoteBadge 는 '표' 단위 글자를 그려 TL4(숫자·공백 외 글자 0)와 모순. `.mf-tl__votes` 로 숫자만 그림. VoteBadge 는 건드리지 않음.
**2. [Rule 3] 시험 도우미 `test/helpers/timelineState.ts` 추가** — 계획 파일 목록에 없지만 네 시험 파일이 같은 3일 판을 공유하려고 만든 테스트 전용 파일.
**3. [Rule 3] 기존 시험 두 곳 갱신** — resultScreen 의 "`result.seats` 읽는 소스" 가드에 `timelineView.ts` 추가(ended 전용 순수 모듈), result.test.mjs 의 표식 목록 정확 비교에 새 표식 3개 추가.
**4. [Rule 2] 귓속말 탭의 그날로 이동** — 계획은 "탭 이동"만 말했지만 계약("귓속말 탭의 그날로 이동")을 지키려 구분선에 `data-day`, ResultPanel 에 `focusDay`, ResultScreen 에 `jumpDay`(탭 행으로 직접 고르면 지움)를 더함.
**5. TL7 한계** — result-awards 의 한 판은 1일차 낮에 끝나(4인, 마피아 처형) 카드가 한 장이다. TL7 은 그 경우 "한 장을 눌러도 상세가 그대로"만 실측하고, 다른 카드로의 전환은 jsdom 시험(resultScreen·resultPanel)이 덮는다. 실행 시간을 늘리지 않는 계획 지시를 따랐다.
**6. 병렬 실행기 영향** — 같은 작업 트리에서 11-12(다시 하기 알약)가 `ResultScreen.tsx`·`v2.css` 를 동시에 고쳐서, 내 커밋은 `git apply --cached` 로 내 hunk 만 골라 올렸다. resultScreen 시험 파일의 11-12·11-13 RED 13개(알약·sat·꾸미기 등)는 그쪽 미완성 작업이라 실패로 남아 있고 내 시험과 무관하다. typecheck 의 ReadyPill·useReady·BenchView·hourglass·opacity 오류도 같은 이유.

## Known Stubs

없음. 기록 탭은 모두 실제 공개 값에 연결되어 있다.

## Threat Flags

없음. T-11-36(timelineView 입력 키를 시험이 Proxy 로 고정: result.seats·summary, day.voteLog, 로그 claim·ballots·whisper), T-11-37(닉네임은 img alt·aria-label·React 속성뿐, 마크업 닉네임 시험) 완화됨.

## 이월 메모

- `timelineOf(view: {result, day?.voteLog}, log?) → DayCard[] {n, day: executed{seat,job}|none, night: null|none|died{seat}|saved{seat}}`, `dayLinesOf(view, log: {claim,ballots,whisper}, n) → {pointing{arrows,counts}, ballots|null, claims[{seat,claimed,job,lie}], swaps[], whispers[{from,to}], night|null{mafias,target?,result}}` (src/game/timelineView.ts).
- `TimelineStrip {cards, selected, onSelect, contacts}`(+ `TlFace`), `DayDetail {lines, contacts, onJumpWhisper?}`. 기록 탭은 ResultPanel 의 `view` prop 으로 그리고(`logSlot` 이 있으면 그것이 우선) 선택 일차 상태는 `LogBody` 안에 있다. 11-12 는 이 탭에 손대지 않는다.
- `ResultPanel` 새 props `view·onJumpWhisper·focusDay`. ResultScreen 이 `jumpWhisper`(jumpDay 설정 + 귓속말 탭)·`onTabRow`(직접 탭 선택 시 jumpDay 지움)를 쥔다.
- 표식: `data-day-card="{n}"`(aria-pressed)·`data-day-detail="{n}"`·`data-whisper-pair`·`data-timeline-strip`·행 `data-row=pointing|ballots|claims|swaps|whispers|night`·`data-claim`/`data-lie`·`data-night-result`·귓속말 구분선 `data-day`. 기록 탭 몸통 클래스 `mf-result__body--log`.
- result.mjs 새 export: `timelineChecks`(TL1~TL7)·`readTimeline`·`TIMELINE_CARD {w72,h112,gap8}`, RESULT_MARKERS 에 표식 3개. 결과 화면 E2E 는 최종 상태를 재기 전에 `finishCeremony` 가 필요하다.
- CSS 는 v2.css 끝의 `.mf-tl__*` 블록(새 색·토큰 없음, 진홍은 `.is-lie` 점선과 마피아 칩뿐).
- 남은 통합 점검: 11-12·11-13 이 끝나면 resultScreen.test.tsx 전체가 초록이어야 하고, 한 판이 길어지는 E2E(2일 이상)가 생기면 TL7 의 다른 카드 전환을 실측으로 올릴 수 있다.

## Self-Check: PASSED

- 파일 존재: src/game/timelineView.ts · src/components/v2/TimelineStrip.tsx · src/components/v2/DayDetail.tsx · test/unit/timelineView.test.ts · test/client/timelineStrip.test.tsx · test/client/dayDetail.test.tsx · test/helpers/timelineState.ts 확인.
- 커밋 7개(e4f281e0, ad910bd6, fb29cd03, e0a24363, f9c1a8a4, b5dd977d, 74ad6d52) 존재, HEAD 의 조상. `commits: 7` 은 `git log --grep="(11-11)"` 로 센 값이고 `plan_head_before..HEAD` 범위에는 11-08·11-12 의 커밋이 섞여 있다.
