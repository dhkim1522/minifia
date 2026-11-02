---
status: testing
phase: 08-day-execution-ghost
source: [08-VERIFICATION.md]
started: 2026-11-03T00:00:00Z
updated: 2026-11-03T00:00:00Z
---

## Current Test

number: 1
name: 낮 흐름 5분 성능·열감 (실기기 + 크롬 CPU 4배 스로틀)
expected: |
  5분 평균 55fps 이상, 끊김(50ms 초과) 5회 이하, 열감 미지근 이하 (결정 0055·0057)
awaiting: user response

## Tests

### 1. 낮 흐름 5분 성능·열감 (실기기 + 크롬 CPU 4배 스로틀)
expected: 토론 → 지목 → 변론 → 찬반 → 처형 → 밤을 iPhone 16 Pro 와 크롬 4배 스로틀에서 돌려 5분 평균 55fps 이상, 끊김 5회 이하, 열감 미지근 이하 (08-DEVICE-CHECKS.md B1, 사용자 결정 2026-11-03 으로 실기기 묶음)
result: [pending]

### 2. 단계 조명·손가락 지목·변론자 시선의 읽힘
expected: 지목 무대 조명·선두 점광·변론 스포트라이트·찬반·처형·밤·아침에서 누가 중심인지 한눈에 읽히고, 낮이어도 어두운 톤이 유지된다 (08-DEVICE-CHECKS.md B2 등)
result: [pending]

### 3. 유령 이름표 대비 (불투명도 0.6)
expected: 실기기에서 다른 유령의 이름표 글자를 읽을 수 있다. 어려우면 불투명도·글자색을 정한다 (화소 근사 약 1.9~2.5:1, 08-DEVICE-CHECKS.md B3)
result: [pending]

### 4. 스크린 리더로 찬반 부결 판의 처형 단계 안내 듣기
expected: '처형 없음' 만 들린다 (코드 리뷰 CR-01 — 지금 코드는 보이지 않는 안내 영역이 '○○ 님 처형' 도 읽는다. 수정 뒤 확인)
result: [pending]

## Summary

total: 4
passed: 0
issues: 0
pending: 4
skipped: 0
blocked: 0

## Gaps
