---
status: diagnosed
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
  truth: "여러 명이 겹쳐도 내 이름표('(나)')는 맨 위에서 전부 읽히고 뒤 이름표가 비치지 않는다. 내 이름표는 걷는 영역 안에서 화면 밖으로 나가지 않는다"
  decision: "사용자 결정(2026-11-01): 내 이름표 맨 위 + 다른 이름표와 겹친 맨 앞 이름표만 면을 불투명에 가깝게(안 겹치면 80% 유지). 다른 사람 이름표는 캐릭터 위 제자리에 두고 가장자리 잘림은 수용. [테스트]와 알림 겹침은 개발용이라 수용"
  status: failed
  reason: "User reported: 06-UI-REVIEW 경고 1·2 — 반투명 이름표 겹침으로 '(나)' 가림, 360폭 가장자리 이름표 잘림, 입장 알림과 [테스트] 겹침"
  severity: major
  test: 4
  root_cause: "코드가 아니라 06-UI-SPEC 계약 결함. (1) writeTags 의 z 순서에 '나' 우선이 없고(발 y 순위·동점 seat 큰 쪽 위) 면이 --overlay-ink 80% 라 한 점에 모이면 '(나)' 가 가려지고 뒤 글자가 비친다 — 계약의 '면 80%·맨 앞은 읽힘·밀지 않음' 이 서로 모순. (2) 화면 안 보장(PAN_BOX·clampTarget·NT4)은 내 이름표에만 걸려 다른 사람 이름표는 360폭 가장자리에서 잘린다. (3) 레이어 표가 [테스트](top 70, z 50)와 TopToast(top 88)를 같은 띠에 둠"
  artifacts:
    - path: ".planning/phases/06-world-skeleton/06-UI-SPEC.md"
      issue: "이름표 329·335·304행, 가시성 381·382·596·609행, 레이어 166·167·234행"
    - path: "src/world/runtime.ts"
      issue: "writeTags 758~783 — '나' 우선 없음, 가장자리 클램프 없음"
    - path: "src/styles/v2.css"
      issue: ".mv-tag 면 --overlay-ink(0.8)"
    - path: "src/styles/lobby.css"
      issue: ".mf-lobby__test top 70·z 50 이 알림 띠와 겹침"
    - path: "scripts/e2e/lib.mjs"
      issue: "NT3 는 z 고유성만, NT4 는 내 이름표만 판정"
  missing:
    - "사용자 결정에 따른 UI-SPEC 개정(이름표 순서·면, 다른 사람 이름표 가장자리, [테스트] 자리)"
    - "개정에 맞춘 writeTags·CSS·E2E 판정"
  debug_session: .planning/debug/nametag-overlap-clip.md
- gap_id: G-06-6
  truth: "배포본에서 연결이 끊기면 재접속 띠가 뜨고 복구 뒤 사라진다"
  status: failed
  reason: "User reported: 배포본 reconnect E2E offline 10회 띠 0회(로컬은 10/10)"
  severity: major
  test: 6
  root_cause: "제품이 아니라 E2E 하네스. dropSockets 가 ws.close() 로 끊김을 흉내 내는데 배포 서버는 클라이언트 Close 프레임에 답하지 않아 close 이벤트가 약 10초 뒤(1006)에 온다. 하네스가 3초 뒤 online 을 켜면 앱 wake() 가 CLOSING 소켓을 새 소켓으로 바꿔 늦은 close 를 무시하므로 띠가 뜨지 않는다. 배포본에서 오프라인 14초 유지 때 실제 띠는 정상으로 떴다. deployhold 는 배포가 소켓을 끊지 않는데도 띠를 기다린다"
  artifacts:
    - path: "scripts/e2e/browser.mjs"
      issue: "dropSockets(1140행)가 서버 close 핸드셰이크에 의존"
    - path: "scripts/e2e/flows.mjs"
      issue: "reconnectAction offline(약 679행) 3초 복귀, deployHoldFlow 가 배포본에서 띠를 요구"
    - path: "worker/room.ts"
      issue: "webSocketClose(719행)가 ws.close 로 핸드셰이크를 끝내지 않음(선택 위생)"
  missing:
    - "dropSockets 가 앱 방 소켓에 CloseEvent(1006) 를 먼저 보내고 ws.close() — 배포본에서 검증됨"
    - "deployhold: 배포 주소에서는 '띠 없음·소켓 유지·위치 0·콘솔 0' 을 통과로"
    - "(선택) webSocketClose 에서 예약 코드 제외하고 ws.close(code, reason)"
  debug_session: .planning/debug/reconnect-banner-deployed.md
