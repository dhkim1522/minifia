---
status: testing
phase: 06-world-skeleton
source: [06-VERIFICATION.md]
started: 2026-11-01T05:45:15Z
updated: 2026-11-01T05:45:15Z
---

## Current Test

number: 1
name: 배포를 가로지르는 맵 로비 위치 이어짐(deployhold)
expected: |
  다음 v2 배포(사용자 허락) 때 `npm run e2e -- --only deployhold` 를 배포와 동시에 돌린다. 두 페이지가 로비에 있는 동안 배포해도 위치가 어긋나지 않고, 콘솔 경고가 없고, 재접속 띠가 남지 않는다.
awaiting: user response

## Tests

### 1. 배포를 가로지르는 맵 로비 위치 이어짐(deployhold)
expected: 다음 v2 배포 때 `npm run e2e -- --only deployhold` 통과(위치 어긋남 0·콘솔 이상 0·띠 잔류 0)
result: [pending]

### 2. 코드 리뷰 수정 6건 배포 뒤 배포본 재확인
expected: a9707d9·2f0974d·7e71d9c·167f62a·a50547b·60fa788 이 들어간 빌드를 배포한 뒤 `npm run e2e -- --only world --sizes 390x664` 20/20, `node scripts/smoke.mjs --prod` 통과
result: [pending]

### 3. WR-02 숨은 탭 소실 타이머 동작
expected: iPhone 에서 화면 잠금 30초 뒤·카카오톡 전환 뒤·카메라 앱 뒤 복귀할 때 5초 안에 장면이 다시 보이거나 실패 카드가 뜨고, 흰·검은 화면이 남지 않는다
result: [pending]

### 4. 8명 이름표 읽힘과 360폭 가장자리 이름표
expected: 8명이 모여도 맨 앞 이름표(특히 '(나)')가 전부 읽히고, 걷는 영역 안에서 이름표가 화면 밖으로 나가지 않는다(06-UI-REVIEW 경고 1·2)
result: [pending]

### 5. 실제 폰 두 대 이상 로비
expected: 서로의 캐릭터·닉네임이 보이고, 탭한 쪽이 걷는 경로가 다른 폰에서도 같은 경로·속도로 보인다
result: [pending]

## Summary

total: 5
passed: 0
issues: 0
pending: 5
skipped: 0
blocked: 0

## Gaps
