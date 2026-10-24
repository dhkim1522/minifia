---
status: testing
phase: 02-day-discussion
source: [02-VERIFICATION.md]
started: 2026-10-23T19:03:45Z
updated: 2026-10-24T09:00:00Z
---

## Current Test

number: 8
name: 결정 요청 — ROADMAP 성공 기준 1 문구와 구현의 차이
expected: |
  2일차 이후 시간이 넘으면 어제 주장이 이어지는 동작(봇으로 확인)을 채택하고 문구를 맞출지, 구현을 바꿀지 정한다
awaiting: user response

## Tests

### 1. 360px 폰, 8명 방에서 직업 공개와 낮 토론 화면
expected: 이웃 자리의 완료·주장 알약이 겹치지 않고, 앞쪽 자리 3줄이 하단 패널에 가려지지 않는다
result: issue
reported: "8명이 테이블에 놓였을 때 이름, 직업, 말풍선, 알약 등의 가시성이 떨어진다. 알약도 각자 자리의 정확한 위치에 뜨는 느낌이 아니고 조금씩 어긋난다. 원형 테이블 구도를 시작 전에만 쓰거나 폐기하고, 카트라이더 로비처럼 캐릭터를 격자로 나란히 두고 칸 안에 이름·직업·방장 표시·알약·말풍선·이모티콘을 정해진 위치에 표시하자. 메시지 공간과 낮 토론 역할 UI/UX 도 다시 잡아야 할 수 있다."
severity: major

### 2. 가장자리 자리 말풍선과 동시 전송 (실기기 확인 2)
expected: 말풍선이 화면 밖으로 잘리지 않고(clamp), 동시에 뜨면 나중 것이 위에 보인다. 3초 뒤 사라진다
result: skipped
reason: "결정 0017 로 대상이 바뀜(말풍선 대상 없음 — 빠른 메시지 말풍선 제거). G-02-1 갭 닫기 후 새 화면으로 다시 확인"

### 3. 어제와 다른 직업 공개 시 "경찰 · 말 바꿈" 알약 (실기기 확인 3)
expected: 알약이 최대 112px 한 줄이고 이웃 이름표를 가리지 않는다. 모든 폰에 말 바꿈이 보인다
result: skipped
reason: "결정 0017 로 대상이 바뀜("말 바꿈" 알약 대상 없음 — ↺ 배지로 대체). G-02-1 갭 닫기 후 새 화면으로 다시 확인"

### 4. 360×640 에서 직업 공개 화면과 방장의 낮 토론 화면 (실기기 확인 4·5)
expected: 두 화면 모두 세로 스크롤이 없고, 3줄 메시지 로그와 방장 줄·보내기 줄이 한 화면에 들어온다
result: skipped
reason: "결정 0017 로 대상이 바뀜(방장 줄 대상 없음 — 방장 전용 기능 제거). G-02-1 갭 닫기 후 새 화면으로 다시 확인"

### 5. 8자 닉네임이 보낸 "[닉네임]은 마피아였어요" 메시지 로그 (리뷰 WR-05)
expected: 문장 끝의 직업 이름이 말줄임(…)으로 잘리지 않고 읽힌다
result: skipped
reason: "결정 0017 로 대상이 바뀜(8자 닉네임 대상 없음 — 닉네임 최대 5자). G-02-1 갭 닫기 후 새 화면으로 다시 확인"

### 6. 빠른 메시지를 2초 간격으로 연달아 전송 (결정 0016-6, 리뷰 WR-02)
expected: 정상 간격에서 RATE_LIMITED 오탐으로 메시지가 표시 없이 사라지지 않는다
result: issue
reported: "봇 시나리오(scripts/uat-day.mjs --prod)로 확인: 보낸 순간 + 2000ms 간격(클라이언트 잠금이 풀리는 가장 이른 시각)으로 보내면 5명판 3/16, 8명판 7/28 이 RATE_LIMITED 로 거부됨. 2050·2150ms 간격은 0건. 클라이언트는 RATE_LIMITED 를 표시 없이 다시 잠그므로 메시지가 말없이 사라짐"
severity: major

### 7. iPhone Safari·Android Chrome 에서 낮 한 바퀴
expected: 두 기기 모두 같은 시각에 단계가 넘어가고, 이모티콘이 약 2초 떴다 사라지며, 공개 팝·흔들림이 부드럽다
result: [pending]
note: "봇 확인(5명·8명, 배포본): 단계 전환·이모티콘 도착 차이 0~23ms, phaseEndsAt 모든 폰 같음, 이모티콘은 메시지 목록에 없음. 남은 것은 실기기에서만 볼 수 있는 애니메이션 부드러움과 실제 폰 시계 차이"

### 8. 결정 요청 — ROADMAP 성공 기준 1 문구와 구현의 차이
expected: |
  2일차 이후 시간이 넘으면 "말 안 함" 이 아니라 어제 주장이 이어지는 동작(CONTEXT D-09, 결정 0015)을 계속 채택하고 ROADMAP SC1·REQUIREMENTS DAY-02 문구를 맞출지, 구현을 바꿀지 정한다
result: [pending]
note: "봇 확인: 2일차에 고르지 않으면 어제 주장(police)이 그대로 공개되고, 이틀 다 안 고르면 none"

## Summary

total: 8
passed: 0
issues: 2
pending: 2
skipped: 4
blocked: 0

## Gaps

- gap_id: G-02-1
  truth: "8명 방에서 이름·직업(주장)·방장 표시·완료·말풍선·이모티콘이 자리마다 정해진 위치에 겹침 없이 읽힌다"
  status: failed
  reason: "User reported: 가시성이 떨어지고 알약이 자리에서 조금씩 어긋난다. 시안 6차례 비교 후 테이블 유지 개선안(결정 0017)으로 확정"
  severity: major
  test: 1
  root_cause: "원근 타원(rx40·ry22)에 8자리를 놓아 글자(14px 고정)와 캐릭터(scale .62~1)가 따로 움직임. 떠 있는 층은 clamp(70px, x%, 100%-70px) 로 가로를 가둬 360px 에서 가장자리 자리(약 36px)의 말풍선·완료가 30px 넘게 안쪽으로 밀림"
  artifacts:
    - path: "src/components/Table.tsx"
      issue: "floatStyle clamp 와 tagTop 오프셋이 자리 좌표와 따로 계산됨"
    - path: "shared/seatLayout.ts"
      issue: "원근 타원 좌표"
  missing:
    - "결정 0017(승인 시안 design/screens/day-v3/SPEC.md): 둘러앉은 테이블 유지, 장면 픽셀 좌표·인원별 반지름 표로 좌석·이름표·이모티콘을 같은 좌표에서 계산(clamp 제거)"
    - "이름표 2줄(색깔점+이름 / 주장, 말 안 함 \"-\", 말 바꿈 ↺ 배지), 빠른 메시지 말풍선 제거(이모티콘만), 보낸 사람 이름표 반전"
    - "하단: 채팅 미리보기 1줄 + 확장 모달(채팅 내역) + [빠른 메시지][이모티콘], 방장 연장·넘기기 제거(서버 extend/skip 포함)"
    - "채팅 서버 저장 제거(messages 보관 대신 방송만), 닉네임 최대 5자"
    - "직업 공개 화면·4/6/7명 배치는 시안 승인 후 계획에 포함"
  debug_session: ""

- gap_id: G-02-2
  truth: "정상 간격(잠금이 풀린 직후)으로 보낸 빠른 메시지·이모티콘이 표시 없이 사라지지 않는다"
  status: failed
  reason: "봇 시나리오: 2000ms 간격 전송의 약 19~25% 가 RATE_LIMITED"
  severity: major
  test: 6
  root_cause: "클라이언트 잠금(보낸 순간 + 2000ms)과 서버 한도(도착 간격 2000ms)가 같아, 앞 요청보다 뒤 요청이 네트워크에서 조금이라도 빨리 도착하면 서버가 거부. 클라이언트는 RATE_LIMITED 를 표시 없이 다시 잠금(DiscussionControls)"
  artifacts:
    - path: "shared/game/chat.ts"
      issue: "SEND_COOLDOWN_MS 2000 을 서버 판정과 클라이언트 잠금이 함께 씀"
    - path: "src/components/DiscussionControls.tsx"
      issue: "RATE_LIMITED 를 표시 없이 다시 잠금"
  missing:
    - "서버 한도를 클라이언트 잠금보다 짧게(결정 0016-6 의 대안: 서버 1800ms, 클라이언트 2000ms 유지)"
    - "scripts/uat-day.mjs 의 2000ms 간격 오탐 0 을 회귀 확인으로 사용"
  debug_session: ""
