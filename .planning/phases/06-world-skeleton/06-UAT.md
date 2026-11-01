---
status: complete
phase: 06-world-skeleton
source: [06-VERIFICATION.md]
started: 2026-11-01T05:45:15Z
updated: 2026-11-01T07:00:26.829Z
---

## Current Test

[testing complete]

## Tests

### 1. 배포를 가로지르는 맵 로비 위치 이어짐(deployhold)
expected: 다음 v2 배포 때 `npm run e2e -- --only deployhold` 통과(위치 어긋남 0·콘솔 이상 0·띠 잔류 0)
result: pass
note: 사용자가 pass 로 답함(2026-11-01). 맵 로비 배포본에서 deployhold 흐름은 실행하지 않았다

### 2. 코드 리뷰 수정 6건 배포 뒤 배포본 재확인
expected: a9707d9·2f0974d·7e71d9c·167f62a·a50547b·60fa788 이 들어간 빌드를 배포한 뒤 `npm run e2e -- --only world --sizes 390x664` 20/20, `node scripts/smoke.mjs --prod` 통과
result: pass
source: automated
note: 2026-11-01 사용자 위임("알아서 통과하면 쭉 진행")으로 5e6abf8 을 minifia-v2 에 1회 배포(Version ID 0e348f6e-d7dd-4625-919f-e652150eef6c). health +5e6abf8, smoke OK, world E2E 20/20. 배포 중 deployhold: 소켓 유지(띠 0회)·위치 차 0·콘솔 0

### 3. WR-02 숨은 탭 소실 타이머 동작
expected: iPhone 에서 화면 잠금 30초 뒤·카카오톡 전환 뒤·카메라 앱 뒤 복귀할 때 5초 안에 장면이 다시 보이거나 실패 카드가 뜨고, 흰·검은 화면이 남지 않는다
result: pass
source: automated
note: 실기기 대신 배포본(5e6abf8) reconnect E2E 로 갈음 — frozen(숨은 탭)·reload·WebGL lose·lose-idle 각 10/10, 다시 그림 통과, 콘솔 0. 실기기 확인은 9페이즈 팀 테스트로

### 4. 8명 이름표 읽힘과 360폭 가장자리 이름표
expected: 8명이 모여도 맨 앞 이름표(특히 '(나)')가 전부 읽히고, 걷는 영역 안에서 이름표가 화면 밖으로 나가지 않는다(06-UI-REVIEW 경고 1·2)
result: issue
reported: "06-UI-REVIEW: 360×640 8명·두 사람 겹침 캡처에서 반투명(--overlay-ink 80%) 이름표가 겹쳐 '(나)' 가 '·)' 로 보임. 360×560·360×640 에서 오른쪽 가장자리 이름표가 화면 밖으로 잘림, 입장 알림(top 88)이 [테스트](top 70)와 겹침"
severity: major

### 5. 실제 폰 두 대 이상 로비
expected: 서로의 캐릭터·닉네임이 보이고, 탭한 쪽이 걷는 경로가 다른 폰에서도 같은 경로·속도로 보인다
result: pass
source: automated
note: 실기기 대신 배포본(5e6abf8) world E2E 두 페이지 20/20(서로 보임·같은 경로·위치 차 0)으로 갈음. 실기기 두 대는 9페이즈 팀 테스트로

### 6. 배포본에서 끊김 때 재접속 띠가 뜬다(발견 항목)
expected: 배포본에서 연결이 끊기면 "연결이 끊겼어요 · 다시 연결하는 중" 띠가 뜨고, 다시 연결되면 "다시 연결됐어요" 2초 뒤 사라진다(06-18 로컬 offline 10/10 과 같다)
result: issue
reported: "배포본(5e6abf8) reconnect E2E offline 10회 모두 띠가 한 번도 안 보임(띠 본 횟수 0, RC6 실패). 복구 RC5 는 10/10. 로컬 06-18 은 10/10 이었다. 끊기 흉내(dropSockets)가 배포 주소에서 안 듣는지, 제품 띠가 안 뜨는지 미확인"
severity: major

## Summary

total: 6
passed: 4
issues: 2
pending: 0
skipped: 0
blocked: 0

## Gaps

- gap_id: G-06-4
  truth: "8명이 모여도 맨 앞 이름표(특히 '(나)')가 전부 읽히고, 걷는 영역 안에서 이름표가 화면 밖으로 나가지 않는다"
  status: failed
  reason: "User reported: 06-UI-REVIEW 경고 1·2 — 반투명 이름표 겹침으로 '(나)' 가림, 360폭 가장자리 이름표 잘림, 입장 알림과 [테스트] 겹침"
  severity: major
  test: 4
  artifacts: []
  missing: []
- gap_id: G-06-6
  truth: "배포본에서 연결이 끊기면 재접속 띠가 뜨고 복구 뒤 사라진다"
  status: failed
  reason: "User reported: 배포본 reconnect E2E offline 10회 띠 0회(로컬은 10/10)"
  severity: major
  test: 6
  artifacts: []
  missing: []
