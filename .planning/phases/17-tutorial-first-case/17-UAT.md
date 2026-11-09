---
status: testing
phase: 17-tutorial-first-case
source: [17-VERIFICATION.md]
started: 2026-11-09T07:00:24Z
updated: 2026-11-09T07:00:24Z
---

## Current Test

number: 1
name: 실기기 혼자 하기 한 번 끝까지 (처음 온 사람 1명 관찰)
expected: |
  사회자 웅얼 목소리와 장면 효과음이 거슬리지 않고 장면과 맞게 들린다. 직접 누르는 순간마다 램프 빛 깜빡임 테두리가 시선을 끌어 무엇을 눌러야 하는지 헤매지 않는다. 끝난 뒤 게임의 목적·한 판 흐름·직업별 할 일을 말로 설명할 수 있고, 첫 판을 해 보고 싶어 한다.
awaiting: user response

## Tests

### 1. 실기기 혼자 하기 한 번 끝까지 (처음 온 사람 1명 관찰)
expected: 사회자 웅얼 목소리와 장면 효과음이 거슬리지 않고 장면과 맞게 들린다. 램프 빛 깜빡임 테두리가 시선을 끌어 헤매지 않는다. 끝난 뒤 목적·한 판 흐름·직업별 할 일을 말로 설명하고 첫 판을 해 보고 싶어 한다.
result: [pending]

### 2. 장면 3~6 을 약 5분 반복 재생하며 프레임 속도 측정 (실기기)
expected: 평균 55fps 이상. 끊김이 눈에 띄지 않는다.
result: [pending]

### 3. 방장 + 손님 실기기 2대 이상 함께 진행 (손님 한 명은 중간에 앱을 껐다 켬)
expected: 모두 끝내면(또는 150초가 지나면) 역할 확인으로 넘어간다. 끝낸 사람이 재접속하면 기다림 화면이 곧바로 보이고 장면 1 이 눈에 띄게 다시 재생되지 않는다(코드 리뷰 WR-02 체감 확인).
result: [pending]

## Summary

total: 3
passed: 0
issues: 0
pending: 3
skipped: 0
blocked: 0

## Gaps
