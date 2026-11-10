---
status: testing
phase: 18-quick-fixes
source: [18-VERIFICATION.md]
started: 2026-11-10T03:20:59Z
updated: 2026-11-10T03:20:59Z
---

## Current Test

number: 1
name: SC-2 낮·밤 조명을 눈으로 비교한다 (광장·재즈 바의 talk·morning·vote 를 night 와 번갈아)
expected: |
  talk·morning 이 night 와 장면만 보고 구분되고, 광장 talk 가 짙은 남색 저녁이 아니라 흐린 낮으로 읽힌다. 저녁 지목(vote)이 밤과 헷갈리지 않는다.
awaiting: user response

## Tests

### 1. SC-2 낮·밤 조명 눈 확인
expected: talk·morning 이 night 와 구분되고 광장 talk 가 흐린 낮으로 읽힌다. vote 가 밤과 헷갈리지 않는다.
result: [pending]

### 2. WR-01·WR-02 처리 방향 결정
expected: 코드로 고치거나(18-REVIEW.md 의 Fix 안) 결정 0081-1 의 알려진 한계로 기록한다. 한 판 안의 옷 유일성에는 영향이 없다.
result: [pending]

### 3. 배포본 smoke full 재확인
expected: node scripts/smoke.mjs --prod --stage full --players 5 --previous-version 2026-11-09T06:26:08Z+4858e54f 가 통과한다(도착 편차 500ms 미만, .msg 읽기 오류 없음, 소켓 유지).
result: [pending]

## Summary

total: 3
passed: 0
issues: 0
pending: 3
skipped: 0
blocked: 0

## Gaps
