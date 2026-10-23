---
status: testing
phase: 02-day-discussion
source: [02-VERIFICATION.md]
started: 2026-10-23T19:03:45Z
updated: 2026-10-23T19:03:45Z
---

## Current Test

number: 1
name: 폭 360px 폰, 8명 방에서 직업 공개와 낮 토론 화면 (HANDOFF 실기기 확인 1)
expected: |
  이웃 자리의 완료 알약·주장 알약이 겹치지 않고, 앞쪽 자리의 이름표·주장 알약·방장 배지 3줄이 하단 패널에 가려지지 않는다
awaiting: user response

## Tests

### 1. 360px 폰, 8명 방에서 직업 공개와 낮 토론 화면
expected: 이웃 자리의 완료·주장 알약이 겹치지 않고, 앞쪽 자리 3줄이 하단 패널에 가려지지 않는다
result: [pending]

### 2. 가장자리 자리 말풍선과 동시 전송 (실기기 확인 2)
expected: 말풍선이 화면 밖으로 잘리지 않고(clamp), 동시에 뜨면 나중 것이 위에 보인다. 3초 뒤 사라진다
result: [pending]

### 3. 어제와 다른 직업 공개 시 "경찰 · 말 바꿈" 알약 (실기기 확인 3)
expected: 알약이 최대 112px 한 줄이고 이웃 이름표를 가리지 않는다. 모든 폰에 말 바꿈이 보인다
result: [pending]

### 4. 360×640 에서 직업 공개 화면과 방장의 낮 토론 화면 (실기기 확인 4·5)
expected: 두 화면 모두 세로 스크롤이 없고, 3줄 메시지 로그와 방장 줄·보내기 줄이 한 화면에 들어온다
result: [pending]

### 5. 8자 닉네임이 보낸 "[닉네임]은 마피아였어요" 메시지 로그 (리뷰 WR-05)
expected: 문장 끝의 직업 이름이 말줄임(…)으로 잘리지 않고 읽힌다
result: [pending]

### 6. 빠른 메시지를 2초 간격으로 연달아 전송 (결정 0016-6, 리뷰 WR-02)
expected: 정상 간격에서 RATE_LIMITED 오탐으로 메시지가 표시 없이 사라지지 않는다
result: [pending]

### 7. iPhone Safari·Android Chrome 에서 낮 한 바퀴
expected: 두 기기 모두 같은 시각에 단계가 넘어가고, 이모티콘이 약 2초 떴다 사라지며, 공개 팝·흔들림이 부드럽다
result: [pending]

### 8. 결정 요청 — ROADMAP 성공 기준 1 문구와 구현의 차이
expected: |
  2일차 이후 시간이 넘으면 "말 안 함" 이 아니라 어제 주장이 이어지는 동작(CONTEXT D-09, 결정 0015)을 계속 채택하고 ROADMAP SC1·REQUIREMENTS DAY-02 문구를 맞출지, 구현을 바꿀지 정한다
result: [pending]

## Summary

total: 8
passed: 0
issues: 0
pending: 8
skipped: 0
blocked: 0

## Gaps
