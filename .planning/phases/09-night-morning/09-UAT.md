---
status: testing
phase: 09-night-morning
source: [09-VERIFICATION.md]
started: 2026-11-03T08:30:37Z
updated: 2026-11-03T08:30:37Z
---

## Current Test

number: 1
name: 팀(4명 이상)이 배포본에서 낮 + 밤이 이어지는 한 판을 끝까지 한다 (성공 기준 5, 표 D)
expected: |
  이동·채팅·밤 긴장이 대면 마피아 같은 느낌을 주는지 기록한다. 확정 실패 원인도 기록한다.
awaiting: 사용자 실기기·팀 테스트 (09-DEVICE-CHECKS.md 의 표 B·C·D)

## Tests

### 1. 팀 한 판 (표 D)
expected: 낮 + 밤이 맵 위에서 이어지는 한 판을 끝까지, 느낌을 기록
result: [pending]

### 2. 실기기 성능 B1/B12
expected: 5분 평균 55fps 이상, 끊김 5회 이하
result: [pending]

### 3. 시민 편 어둠 가독 B2
expected: 글자 4.5:1 이상, 내 위치를 잃지 않음
result: [pending]

### 4. 밤 이름표·얼굴 칸 누르기 B3/B6/B7
expected: 손가락으로 눌리고 8자 이름이 넘치지 않음
result: [pending]

### 5. 아침 가독과 카드 시간순 B4/B10
expected: 3초 안에 읽히고 카드가 겹치지 않음
result: [pending]

### 6. 유언 시트 + iOS 키보드 B5
expected: 키보드 위에 시트, 저장 뒤 닫힘
result: [pending]

### 7. 맥박·번쩍임·베기·막 체감 B8/B9
expected: 긴장되지만 어지럽지 않음, 모션 줄이기에서 약해짐
result: [pending]

### 8. 다른 기기·브라우저 (표 C)
expected: 각 환경에서 유언 시트·얼굴 칸·이름표 버튼 동작
result: [pending]

## Summary

total: 8
passed: 0
issues: 0
pending: 8
skipped: 0
blocked: 0

## Gaps
